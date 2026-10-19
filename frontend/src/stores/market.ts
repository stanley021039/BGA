import { defineStore } from 'pinia';
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { useRequests } from '../composables/requests';
import { ApiError, requestJson } from '../services/http';
import { fileBase64 } from '../services/files';
import {
  readMarketState,
  readMarketOK,
  readMarketPreview,
  readMarketImages,
  readMarketImage,
  readMarketDraw,
  readMarketRecheck,
  marketRequestId,
  defaultMarketImageLimits,
  validMarketDate,
  officialMarketUrl,
} from '../contracts/market';
import type {
  MarketState,
  MarketPreview,
  MarketImage,
  MarketImageLimits,
} from '../contracts/market';
interface MarketAttempt {
  path: string;
  payload: Record<string, unknown>;
  userId: string;
  acknowledged: boolean;
  label: string;
}
const unresolved = (error: unknown) =>
  !(error instanceof ApiError) ||
  !error.status ||
  error.status >= 500 ||
  error.status === 408 ||
  error.status === 429;
export const useMarketStore = defineStore('market', () => {
  const requests = useRequests(),
    state = shallowRef<MarketState | null>(null),
    loading = ref(false),
    busy = ref(false),
    message = ref(''),
    failed = ref(false),
    adminDenied = ref(false),
    view = ref('daily'),
    selectedId = ref(''),
    followCurrent = ref(true),
    now = ref(Date.now()),
    attempt = shallowRef<MarketAttempt | null>(null);
  const admin = computed(() => state.value?.me.role === 'admin' && !adminDenied.value),
    selected = computed(() => state.value?.rounds.find((r) => r.id === selectedId.value) || null),
    current = computed(
      () =>
        state.value?.rounds
          .slice()
          .reverse()
          .find((r) => r.phase === 'open' && !r.result && now.value < Date.parse(r.cutoffAt)) ||
        null,
    );
  const draft = reactive({ roundId: '', optionId: '', forecastTick: 0, expectedRevision: 0 }),
    closed = computed(
      () =>
        !selected.value ||
        selected.value.phase === 'void' ||
        !!selected.value.result ||
        now.value >= Date.parse(selected.value.cutoffAt),
    ),
    dirty = computed(() =>
      selected.value?.rules.version === 3
        ? draft.forecastTick !== (selected.value.vote?.forecastTick ?? null)
        : !!draft.optionId && draft.optionId !== selected.value?.vote?.optionId,
    );
  const preview = shallowRef<{
      details: MarketPreview;
      payload: Record<string, unknown>;
      userId: string;
    } | null>(null),
    settleDraft = reactive({ roundId: '', returnPct: '', reason: '' });
  let anchor = Date.now(),
    at = performance.now(),
    loadVersion = 0,
    tickTimer: ReturnType<typeof setInterval> | undefined,
    pollTimer: ReturnType<typeof setInterval> | undefined,
    started = false;
  async function request(path: string, body?: Record<string, unknown>, timeoutMs = 20000) {
    return requests.run(async (signal) => {
      const controller = new AbortController(),
        cancel = () => controller.abort(signal.reason),
        timeout = setTimeout(
          () =>
            controller.abort(new DOMException('請求逾時，請確認狀態後再操作。', 'TimeoutError')),
          timeoutMs,
        );
      signal.addEventListener('abort', cancel, { once: true });
      try {
        signal.throwIfAborted();
        return await requestJson(path, {
          method: body === undefined ? 'GET' : 'POST',
          body,
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 403 && path.startsWith('/api/admin/')) {
          adminDenied.value = true;
          preview.value = null;
          if (view.value === 'admin') setView('daily');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
      }
    });
  }
  function tick() {
    now.value = anchor + performance.now() - at;
  }
  function resetDraft() {
    const r = selected.value;
    Object.assign(draft, {
      roundId: r?.id || '',
      optionId: r?.vote?.optionId || '',
      forecastTick: r?.vote?.forecastTick ?? 0,
      expectedRevision: r?.vote?.revision || 0,
    });
  }
  function chooseRound(id: string, follow = false) {
    if (busy.value || attempt.value) return;
    selectedId.value = id;
    followCurrent.value = follow;
    resetDraft();
  }
  function setView(value: string) {
    const next =
      ['daily', 'uploads', 'records', 'marketHistory', 'leaderboard', 'admin'].includes(value) &&
      !(value === 'admin' && !!state.value && !admin.value)
        ? value
        : 'daily';
    view.value = next;
    if (location.hash.slice(1) !== next) history.replaceState(null, '', '#' + next);
  }
  async function load(quiet = false) {
    const version = ++loadVersion;
    loading.value = true;
    try {
      let value = readMarketState(await request(admin.value ? '/api/admin/market' : '/api/market'));
      if (
        value.me.role === 'admin' &&
        !adminDenied.value &&
        (!state.value || state.value.me.role !== 'admin')
      )
        value = readMarketState(await request('/api/admin/market'));
      if (!requests.active() || version !== loadVersion) return false;
      const previous = state.value?.me.id;
      if (previous && previous !== value.me.id) {
        attempt.value = null;
        preview.value = null;
        selectedId.value = '';
        adminDenied.value = false;
        message.value = '登入帳號已變更，請重新核對預測。';
      }
      state.value = value;
      anchor = Date.parse(value.serverNow);
      at = performance.now();
      tick();
      if (followCurrent.value || !value.rounds.some((r) => r.id === selectedId.value))
        selectedId.value = (current.value || value.rounds[0])?.id || '';
      if (draft.roundId !== selectedId.value) resetDraft();
      if (!settleDraft.roundId || !value.rounds.some((r) => r.id === settleDraft.roundId))
        settleDraft.roundId = value.rounds[0]?.id || '';
      if (preview.value) {
        const r = value.rounds.find((r) => r.id === preview.value?.details.roundId);
        if (
          !r ||
          r.phase === 'void' ||
          (r.result?.revision || 0) !== preview.value.details.expectedRevision
        )
          preview.value = null;
      }
      if (!quiet) {
        failed.value = false;
        message.value = current.value
          ? '選擇預測後提交，截止前可以修改。'
          : '目前沒有開放中的預測，可查看既有交易日與歷史。';
      }
      setView(location.hash.slice(1) || view.value);
      return true;
    } catch (error) {
      if (requests.active() && version === loadVersion) {
        failed.value = true;
        message.value = error instanceof Error ? error.message : '無法讀取股市冥燈';
      }
      return false;
    } finally {
      if (requests.active() && version === loadVersion) loading.value = false;
    }
  }
  async function execute(job: MarketAttempt) {
    if (busy.value || !requests.active() || job.userId !== state.value?.me.id) return false;
    busy.value = true;
    message.value = '正在處理…';
    failed.value = false;
    try {
      if (!job.acknowledged) {
        readMarketOK(await request(job.path, job.payload));
        job.acknowledged = true;
      }
      if (!(await load(true)))
        throw Error('操作已確認，但畫面更新失敗。請確認同一筆操作以更新狀態。');
      if (job.userId !== state.value?.me.id) return false;
      if (attempt.value === job) attempt.value = null;
      if (job.path === '/api/market/vote') resetDraft();
      message.value = job.label;
      return true;
    } catch (error) {
      if (requests.active()) {
        failed.value = true;
        message.value = error instanceof Error ? error.message : '操作結果未確認';
        if (!job.acknowledged && !unresolved(error)) {
          attempt.value = null;
          const preserve = { ...draft };
          await load(true);
          if (
            error instanceof ApiError &&
            error.code === 'STALE_VOTE' &&
            selected.value?.id === preserve.roundId
          ) {
            Object.assign(draft, preserve, {
              expectedRevision: selected.value.vote?.revision || 0,
            });
            message.value = '預測已在另一個頁面更新。已同步版本並保留你的選擇，請核對後再提交。';
          }
        } else {
          attempt.value = job;
          message.value += ' 請重試確認同一筆操作；不會建立新操作。';
        }
      }
      return false;
    } finally {
      if (requests.active()) busy.value = false;
    }
  }
  function mutate(path: string, payload: Record<string, unknown>, label: string) {
    if (busy.value || attempt.value || !state.value) return Promise.resolve(false);
    const job = {
      path,
      payload: structuredClone({ ...payload, requestId: marketRequestId() }),
      userId: state.value.me.id,
      acknowledged: false,
      label,
    };
    attempt.value = job;
    return execute(job);
  }
  function vote() {
    const r = selected.value;
    if (!r || closed.value || !dirty.value || draft.roundId !== r.id) return Promise.resolve(false);
    return mutate(
      '/api/market/vote',
      {
        roundId: r.id,
        expectedRevision: draft.expectedRevision,
        ...(r.rules.version === 3
          ? { forecastTick: draft.forecastTick }
          : { optionId: draft.optionId }),
      },
      '預測已儲存。',
    );
  }
  async function getPreview() {
    if (!admin.value || busy.value || attempt.value) return false;
    const r = state.value?.rounds.find((r) => r.id === settleDraft.roundId);
    if (!r || r.phase === 'void' || now.value < Date.parse(r.settlementAfter)) return false;
    busy.value = true;
    failed.value = false;
    preview.value = null;
    try {
      const payload = {
        roundId: r.id,
        expectedRevision: r.result?.revision || 0,
        returnPct: settleDraft.returnPct,
        reason: settleDraft.reason,
      };
      const details = readMarketPreview(await request('/api/admin/market/preview', payload));
      if (details.roundId !== r.id || details.expectedRevision !== payload.expectedRevision)
        throw Error('結算版本已更新，請重新預覽');
      preview.value = {
        details,
        payload: { ...payload, returnPct: details.returnPct },
        userId: state.value!.me.id,
      };
      return true;
    } catch (error) {
      failed.value = true;
      message.value = error instanceof Error ? error.message : '無法預覽結算';
      return false;
    } finally {
      if (requests.active()) busy.value = false;
    }
  }
  async function settle() {
    const value = preview.value;
    if (!value || !admin.value || value.userId !== state.value?.me.id) return false;
    preview.value = null;
    return mutate(
      '/api/admin/market/settle',
      { ...value.payload, confirmed: true },
      '結算已完成，積分與異動紀錄已更新。',
    );
  }
  async function recheck(targetDate: string) {
    if (
      !admin.value ||
      busy.value ||
      attempt.value ||
      !state.value?.automation.enabled ||
      !validMarketDate(targetDate) ||
      now.value < Date.parse(targetDate + 'T14:00:00+08:00')
    )
      return false;
    busy.value = true;
    failed.value = false;
    try {
      const out = readMarketRecheck(
        await request('/api/admin/market/recheck', { targetDate, confirmed: true }, 60000),
        targetDate,
      );
      await load(true);
      message.value =
        targetDate +
        '：' +
        (out.review === true
          ? '官方資料需人工複核，原積分保持不變。'
          : out.received === true
            ? '官方資料已交叉核對，請確認目前紀錄。'
            : '本次未取得可採用的新資料，保留既有結果與積分。');
      return true;
    } catch (error) {
      failed.value = true;
      await load(true);
      message.value =
        error instanceof Error ? error.message : '官方重查結果尚未確認，請核對後再決定是否重查。';
      return false;
    } finally {
      if (requests.active()) busy.value = false;
    }
  }
  function timers() {
    clearInterval(tickTimer);
    clearInterval(pollTimer);
    tick();
    if (document.hidden) return;
    tickTimer = setInterval(tick, 1000);
    pollTimer = setInterval(() => {
      if (!document.hidden && !loading.value && !busy.value && !attempt.value) void load(true);
    }, 15000);
  }
  function start() {
    if (started) return;
    started = true;
    setView(location.hash.slice(1));
    void load();
    timers();
  }
  const visibility = () => {
    if (started) timers();
  };
  document.addEventListener('visibilitychange', visibility);
  const hash = () => setView(location.hash.slice(1));
  window.addEventListener('hashchange', hash);
  onScopeDispose(() => {
    loadVersion++;
    clearInterval(tickTimer);
    clearInterval(pollTimer);
    window.removeEventListener('hashchange', hash);
    document.removeEventListener('visibilitychange', visibility);
    attempt.value = null;
    preview.value = null;
    state.value = null;
  });
  watch(
    () => settleDraft.roundId,
    () => {
      settleDraft.returnPct = '';
      settleDraft.reason = '';
      preview.value = null;
    },
  );
  return {
    state,
    loading,
    busy,
    message,
    failed,
    admin,
    view,
    selectedId,
    followCurrent,
    now,
    attempt,
    selected,
    current,
    draft,
    closed,
    dirty,
    preview,
    settleDraft,
    request,
    active: requests.active,
    load,
    chooseRound,
    setView,
    start,
    mutate,
    vote,
    getPreview,
    settle,
    recheck,
    retry: () => (attempt.value ? execute(attempt.value) : Promise.resolve(false)),
  };
});

interface UploadAttempt {
  payload: Record<string, unknown>;
  acknowledged: boolean;
  userId: string;
}
interface ApprovalAttempt {
  requestId: string;
  images: { id: string; version: number }[];
  details: MarketImage[];
  acknowledged: boolean;
  uncertain: boolean;
  invalid: boolean;
  error: string;
  userId: string;
}
export const useMarketGalleryStore = defineStore('market.gallery', () => {
  const market = useMarketStore(),
    limits = ref<MarketImageLimits>({ ...defaultMarketImageLimits }),
    mine = shallowRef<MarketImage[]>([]),
    review = shallowRef<MarketImage[]>([]),
    draw = shallowRef<Record<string, MarketImage | null>>({}),
    drawTarget = ref(''),
    drawBusy = ref(false),
    drawError = ref('');
  const mineBusy = ref(false),
    mineError = ref(''),
    reviewBusy = ref(false),
    reviewError = ref(''),
    reviewMessage = ref(''),
    uploadBusy = ref(false),
    uploadReading = ref(false),
    uploadMessage = ref(''),
    uploadFailed = ref(false),
    upload = shallowRef<{
      mime: string;
      base64: string;
      url: string;
      name: string;
      width: number;
      height: number;
    } | null>(null),
    uploadAttempt = shallowRef<UploadAttempt | null>(null),
    approval = shallowRef<ApprovalAttempt | null>(null),
    approvalBusy = ref(false);
  const buckets = ref<string[]>([]),
    weekdays = ref<number[]>([]),
    filterBuckets = ref<string[]>([]),
    filterWeekdays = ref<number[]>([]),
    selected = ref<string[]>([]),
    reloadKey = ref(0);
  let mineVersion = 0,
    reviewVersion = 0,
    drawVersion = 0,
    uploadVersion = 0,
    disposed = false;
  function clearUpload() {
    if (upload.value?.url) URL.revokeObjectURL(upload.value.url);
    upload.value = null;
  }
  async function loadMine() {
    const version = ++mineVersion;
    mineBusy.value = true;
    mineError.value = '';
    try {
      const value = readMarketImages(await market.request('/api/market/images/mine'));
      if (disposed || version !== mineVersion) return false;
      mine.value = value.images;
      limits.value = value.limits;
      reloadKey.value++;
      return true;
    } catch (error) {
      if (!disposed && version === mineVersion)
        mineError.value = error instanceof Error ? error.message : '無法讀取投稿';
      return false;
    } finally {
      if (!disposed && version === mineVersion) mineBusy.value = false;
    }
  }
  async function loadReview() {
    if (!market.admin) return false;
    const version = ++reviewVersion;
    reviewBusy.value = true;
    reviewError.value = '';
    reviewMessage.value = '';
    const query = new URLSearchParams();
    if (filterBuckets.value.length) query.set('buckets', filterBuckets.value.join(','));
    if (filterWeekdays.value.length) query.set('weekdays', filterWeekdays.value.join(','));
    try {
      const value = readMarketImages(
        await market.request(
          '/api/admin/market/images' + (query.size ? '?' + query.toString() : ''),
        ),
      );
      if (disposed || version !== reviewVersion) return false;
      review.value = value.images;
      limits.value = value.limits;
      selected.value = selected.value.filter((id) => value.images.some((i) => i.id === id));
      reloadKey.value++;
      return true;
    } catch (error) {
      if (!disposed && version === reviewVersion)
        reviewError.value = error instanceof Error ? error.message : '無法讀取審核清單';
      return false;
    } finally {
      if (!disposed && version === reviewVersion) reviewBusy.value = false;
    }
  }
  async function drawImages() {
    const r = market.selected;
    if (!r || drawBusy.value) return;
    const version = ++drawVersion,
      target = r.targetDate,
      curve = r.rules.version === 3;
    drawBusy.value = true;
    drawError.value = '';
    try {
      const value = readMarketDraw(
        await market.request('/api/market/images/draw', {
          targetDate: target,
          ...(curve ? { layout: 'curve-five' } : {}),
        }),
        target,
        curve,
      );
      if (!disposed && version === drawVersion) {
        draw.value = value;
        drawTarget.value = target;
        reloadKey.value++;
      }
    } catch (error) {
      if (!disposed && version === drawVersion)
        drawError.value = error instanceof Error ? error.message : '無法抽選圖片';
    } finally {
      if (!disposed && version === drawVersion) drawBusy.value = false;
    }
  }
  async function chooseFile(file?: File) {
    if (uploadAttempt.value || uploadBusy.value) return;
    const version = ++uploadVersion;
    clearUpload();
    uploadMessage.value = '';
    uploadFailed.value = false;
    if (!file) return;
    uploadReading.value = true;
    let bitmap: ImageBitmap | undefined;
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        !file.size ||
        file.size > limits.value.maxUploadBytes
      )
        throw Error('請選擇大於 0 且不超過 2 MiB 的 PNG、JPEG 或 WebP');
      bitmap = await createImageBitmap(file);
      if (
        bitmap.width > limits.value.maxDimension ||
        bitmap.height > limits.value.maxDimension ||
        bitmap.width * bitmap.height > limits.value.maxPixels
      )
        throw Error('圖片最多 4096 × 4096，總像素最多 800 萬');
      const base64 = await fileBase64(file, limits.value.maxUploadBytes);
      if (disposed || version !== uploadVersion) return;
      upload.value = {
        mime: file.type,
        base64,
        url: URL.createObjectURL(file),
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
      };
      uploadMessage.value = '請核對圖片、適用區間與星期後送出。';
    } catch (error) {
      if (!disposed && version === uploadVersion) {
        uploadFailed.value = true;
        uploadMessage.value = error instanceof Error ? error.message : '無法讀取圖片';
      }
    } finally {
      bitmap?.close();
      if (!disposed && version === uploadVersion) uploadReading.value = false;
    }
  }
  async function submitUpload() {
    if (uploadBusy.value || uploadReading.value || !market.state) return false;
    if (!uploadAttempt.value) {
      if (
        !upload.value ||
        !buckets.value.length ||
        !weekdays.value.length ||
        mine.value.length >= limits.value.maxPerUser
      )
        return false;
      uploadAttempt.value = {
        payload: structuredClone({
          requestId: marketRequestId(),
          mime: upload.value.mime,
          base64: upload.value.base64,
          buckets: [...buckets.value],
          weekdays: [...weekdays.value],
        }),
        acknowledged: false,
        userId: market.state.me.id,
      };
    }
    const job = uploadAttempt.value;
    if (job.userId !== market.state.me.id) return false;
    uploadBusy.value = true;
    uploadFailed.value = false;
    uploadMessage.value = '正在送出投稿…';
    try {
      if (!job.acknowledged) {
        const out = readMarketOK(await market.request('/api/market/images', job.payload));
        if (disposed || uploadAttempt.value !== job || job.userId !== market.state?.me.id)
          return false;
        if (readMarketImage(out.image).status !== 'pending')
          throw Error('投稿回應狀態不正確，請確認同一筆結果');
        job.acknowledged = true;
      }
      if (!(await loadMine())) throw Error('投稿已儲存，清單更新失敗');
      if (disposed) return false;
      uploadAttempt.value = null;
      clearUpload();
      uploadMessage.value = '投稿已送出，等待管理員核准。';
      return true;
    } catch (error) {
      if (!disposed && uploadAttempt.value === job) {
        uploadFailed.value = true;
        if (!job.acknowledged && !unresolved(error)) {
          uploadAttempt.value = null;
          uploadMessage.value = error instanceof Error ? error.message : '投稿失敗';
        } else
          uploadMessage.value =
            (job.acknowledged ? '投稿已儲存，但清單更新失敗。' : '投稿結果尚未確認。') +
            ' 請重試確認同一筆投稿，避免重複建立。';
      }
      return false;
    } finally {
      if (!disposed) uploadBusy.value = false;
    }
  }
  function openApproval(all = false) {
    if (!market.admin || reviewBusy.value || approvalBusy.value || approval.value) return false;
    const details = review.value.filter((i) => all || selected.value.includes(i.id));
    if (!details.length || details.length > limits.value.maxApprovalBatch) return false;
    approval.value = {
      requestId: marketRequestId(),
      images: details.map((i) => ({ id: i.id, version: i.version })),
      details: structuredClone(details),
      acknowledged: false,
      uncertain: false,
      invalid: false,
      error: '',
      userId: market.state!.me.id,
    };
    return true;
  }
  function closeApproval() {
    if (!approvalBusy.value && !approval.value?.uncertain) approval.value = null;
  }
  async function approve() {
    const job = approval.value;
    if (
      !job ||
      !market.admin ||
      approvalBusy.value ||
      job.invalid ||
      job.userId !== market.state?.me.id
    )
      return false;
    approvalBusy.value = true;
    job.error = '';
    try {
      if (!job.acknowledged) {
        const out = readMarketOK(
          await market.request('/api/admin/market/images/approve', {
            requestId: job.requestId,
            confirmed: true,
            images: job.images,
          }),
        );
        if (disposed || approval.value !== job || job.userId !== market.state?.me.id) return false;
        const returned = Array.isArray(out.images) ? out.images.map(readMarketImage) : [];
        if (
          returned.length !== job.images.length ||
          returned.some(
            (image) =>
              !job.images.some(
                (wanted) => wanted.id === image.id && wanted.version + 1 === image.version,
              ) || image.status !== 'approved',
          ) ||
          out.approved !== job.images.length
        )
          throw Error('核准回應張數不符，請確認同一批結果');
        job.acknowledged = true;
      }
      if (!(await loadReview())) throw Error('圖片已核准，清單更新失敗');
      if (disposed) return false;
      approval.value = null;
      selected.value = [];
      reviewMessage.value = '已核准本次確認的 ' + job.images.length + ' 張圖片。';
      return true;
    } catch (error) {
      if (!disposed && approval.value === job) {
        job.uncertain = job.acknowledged || unresolved(error);
        job.invalid = !job.uncertain;
        job.error = job.uncertain
          ? '結果尚未確認，重試只確認同一批圖片與版本。'
          : (error instanceof Error ? error.message : '核准失敗') + ' 請返回清單更新後重新確認。';
        approval.value = { ...job };
      }
      return false;
    } finally {
      if (!disposed) approvalBusy.value = false;
    }
  }
  watch(
    () => market.selected?.id,
    () => {
      drawVersion++;
      draw.value = {};
      drawTarget.value = '';
      drawBusy.value = false;
      drawError.value = '';
      if (market.view === 'daily' && market.selected) void drawImages();
    },
  );
  watch([() => market.view, () => market.admin], ([view]) => {
    if (view === 'daily' && market.selected && drawTarget.value !== market.selected.targetDate)
      void drawImages();
    if (view === 'uploads') void loadMine();
    if (view === 'admin' && market.admin) void loadReview();
  });
  watch(
    [filterBuckets, filterWeekdays],
    () => {
      if (market.view === 'admin') void loadReview();
    },
    { deep: true },
  );
  watch(
    () => market.admin,
    (allowed) => {
      if (!allowed) {
        reviewVersion++;
        reviewBusy.value = false;
        review.value = [];
        selected.value = [];
        approval.value = null;
      }
    },
  );
  watch(
    () => market.state?.me.id,
    (id, old) => {
      if (old && id !== old) {
        uploadVersion++;
        mineVersion++;
        reviewVersion++;
        drawVersion++;
        mineBusy.value = false;
        reviewBusy.value = false;
        drawBusy.value = false;
        uploadBusy.value = false;
        uploadReading.value = false;
        draw.value = {};
        drawTarget.value = '';
        uploadAttempt.value = null;
        approval.value = null;
        clearUpload();
        mine.value = [];
        review.value = [];
        selected.value = [];
      }
    },
  );
  onScopeDispose(() => {
    disposed = true;
    mineVersion++;
    reviewVersion++;
    drawVersion++;
    uploadVersion++;
    clearUpload();
    uploadAttempt.value = null;
    approval.value = null;
  });
  return {
    limits,
    mine,
    review,
    draw,
    drawTarget,
    drawBusy,
    drawError,
    mineBusy,
    mineError,
    reviewBusy,
    reviewError,
    reviewMessage,
    uploadBusy,
    uploadReading,
    uploadMessage,
    uploadFailed,
    upload,
    uploadAttempt,
    approval,
    approvalBusy,
    buckets,
    weekdays,
    filterBuckets,
    filterWeekdays,
    selected,
    reloadKey,
    loadMine,
    loadReview,
    drawImages,
    chooseFile,
    submitUpload,
    openApproval,
    closeApproval,
    approve,
  };
});
