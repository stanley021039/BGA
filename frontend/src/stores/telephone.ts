import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { usePartyActionsStore } from './party-actions';
import { useQueuedSave } from '../composables/queued-save';
import {
  readTelephoneStrokes,
  type TelephoneDraft,
  type TelephoneSnapshot,
  type TelephoneStroke,
} from '../contracts/telephone';
interface DraftAttempt {
  context: string;
  revision: number;
  serialized: string;
  payload: { stepId: string; requestId: string } & TelephoneDraft;
}
export const useTelephoneStore = defineStore('telephone', () => {
  const room = useRoomStore(),
    actions = usePartyActionsStore(),
    state = computed(() =>
      room.snapshot?.type === 'telephone' ? (room.snapshot as TelephoneSnapshot) : null,
    ),
    setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase)),
    settingsEditable = computed(() => room.host && setup.value && !room.terminal);
  const sources = ref<string[]>([]),
    canonical = ref(''),
    settingsDirty = computed(() => JSON.stringify([...sources.value].sort()) !== canonical.value);
  const settings = useQueuedSave<{ sources: string[] }>({
    allowed: () => settingsEditable.value,
    blocked: () => room.busy,
    save: (value) => room.command('settings', value),
    failure: () => room.message,
  });
  watch(
    [() => JSON.stringify(state.value?.options.sources), settingsEditable, () => room.scope],
    () => {
      const current = state.value;
      if (!current) return;
      const adopt =
        !canonical.value ||
        !settingsEditable.value ||
        (!settings.pending.value && !settingsDirty.value);
      canonical.value = JSON.stringify([...current.options.sources].sort());
      if (adopt) sources.value = [...current.options.sources];
      if (!settingsEditable.value) settings.reset();
    },
    { immediate: true },
  );
  function queueSources() {
    if (!settingsEditable.value) return;
    if (!sources.value.length) {
      sources.value = [...(state.value?.options.sources || [])];
      settings.invalidate('至少選擇一種情境題庫。');
      return;
    }
    settings.enqueue({ sources: [...sources.value] });
  }
  async function start() {
    if (!settingsEditable.value || (state.value?.players.length || 0) < 3) return;
    if (settingsDirty.value && !settings.pending.value) queueSources();
    if ((await settings.flush()) && !settings.error.value) await room.command('start', {});
  }
  const strokes = shallowRef<TelephoneStroke[]>([]),
    text = ref(''),
    saving = ref(false),
    finishing = ref(false),
    activeStroke = ref(false),
    notice = ref(''),
    storageNotice = ref(''),
    accepted = ref(''),
    foreground = ref(!document.hidden),
    now = ref(Date.now()),
    serverTime = ref(Date.now());
  const offset = computed(() => now.value - serverTime.value),
    expired = computed(() => !!state.value?.deadline && serverTime.value >= state.value.deadline),
    context = computed(() =>
      room.seat && !room.terminal && state.value?.phase === 'passing' && state.value.stepId
        ? `${room.scope}:${room.code}:${state.value.me}:${state.value.stepId}`
        : '',
    ),
    content = computed<TelephoneDraft>(() =>
      state.value?.task?.kind === 'drawing'
        ? { strokes: strokes.value }
        : { text: text.value.trim() },
    ),
    serialized = computed(() => JSON.stringify(content.value)),
    dirty = computed(() => serialized.value !== accepted.value);
  const acceptedCount = computed(() => {
    try {
      const value = JSON.parse(accepted.value || '{}');
      return state.value?.task?.kind === 'drawing'
        ? value.strokes?.length || 0
        : [...(value.text || '')].length;
    } catch {
      return 0;
    }
  });
  const allowed = computed(
      () =>
        !!context.value &&
        room.connected &&
        foreground.value &&
        !expired.value &&
        !state.value?.task?.submitted,
    ),
    editable = computed(() => allowed.value && !room.busy && !actions.pending && !finishing.value);
  let disposed = false,
    anchored = false,
    revision = 0,
    automatic = false,
    savedKey = '',
    anchor = Date.now(),
    at = performance.now(),
    timer: ReturnType<typeof setTimeout> | null = null,
    cacheTimer: ReturnType<typeof setTimeout> | null = null,
    clock: ReturnType<typeof setInterval> | null = null;
  let retry: DraftAttempt | null = null,
    job: {
      controller: AbortController;
      attempt: DraftAttempt;
      promise: Promise<boolean> | null;
    } | null = null;
  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  function save() {
    if (cacheTimer) clearTimeout(cacheTimer);
    cacheTimer = null;
    if (!savedKey) return;
    try {
      sessionStorage.setItem(
        savedKey,
        JSON.stringify({ strokes: strokes.value, text: text.value }),
      );
    } catch {
      storageNotice.value = '此分頁無法保存本地草稿，重新整理前請確認伺服器同步狀態。';
    }
  }
  function cache() {
    if (!cacheTimer) cacheTimer = setTimeout(save, 150);
  }
  function forget() {
    if (cacheTimer) clearTimeout(cacheTimer);
    cacheTimer = null;
    if (savedKey)
      try {
        sessionStorage.removeItem(savedKey);
      } catch {}
    savedKey = '';
  }
  function reset() {
    clearTimer();
    job?.controller.abort();
    job = null;
    saving.value = finishing.value = activeStroke.value = false;
    automatic = false;
    retry = null;
    strokes.value = [];
    text.value = '';
    accepted.value = '';
    notice.value = storageNotice.value = '';
    revision++;
    actions.setTarget(context.value + ':' + revision);
  }
  function initialize() {
    forget();
    reset();
    const current = state.value;
    if (!current || !context.value || !current.task || current.task.submitted) return;
    savedKey = `telephone:${room.code}:${current.me}:${current.stepId}`;
    const draft = current.task.draft;
    strokes.value = draft && 'strokes' in draft ? structuredClone(draft.strokes) : [];
    text.value = draft && 'text' in draft ? draft.text : '';
    accepted.value = JSON.stringify(
      current.task.kind === 'drawing' ? { strokes: strokes.value } : { text: text.value.trim() },
    );
    try {
      const local = JSON.parse(sessionStorage.getItem(savedKey) || 'null');
      if (local) {
        if (current.task.kind === 'drawing')
          strokes.value = readTelephoneStrokes(local.strokes || []);
        else if (
          typeof local.text === 'string' &&
          [...local.text.trim()].length <= 80 &&
          !/[\u0000-\u001f\u007f]/.test(local.text)
        )
          text.value = local.text;
      }
    } catch {
      storageNotice.value = '本地草稿無法讀取，已恢復伺服器接受的內容。';
    }
    if (dirty.value) notice.value = '已恢復本地草稿，尚未全部同步；可按同步草稿。';
  }
  function schedule() {
    if (timer || job || disposed || !automatic || !dirty.value || !allowed.value || finishing.value)
      return;
    const remaining = (state.value?.deadline || 0) - serverTime.value;
    timer = setTimeout(
      () => {
        timer = null;
        void sync();
      },
      Math.max(0, Math.min(1000, remaining - 250)),
    );
  }
  async function sync(): Promise<boolean> {
    clearTimer();
    if (disposed || !allowed.value || finishing.value) return false;
    if (job?.promise) return job.promise;
    if (!dirty.value) return true;
    if (room.busy || actions.pending) return false;
    const current = state.value!,
      attempt =
        retry && retry.context === context.value && retry.revision === revision
          ? retry
          : {
              context: context.value,
              revision,
              serialized: serialized.value,
              payload: {
                stepId: current.stepId!,
                requestId: crypto.randomUUID(),
                ...structuredClone(content.value),
              },
            };
    const next = {
      controller: new AbortController(),
      attempt,
      promise: null as Promise<boolean> | null,
    };
    job = next;
    saving.value = true;
    notice.value = '正在同步私人草稿…';
    const timeout = setTimeout(
      () =>
        next.controller.abort(
          new DOMException('草稿同步結果尚未確認，可重試同一草稿。', 'TimeoutError'),
        ),
      10000,
    );
    next.promise = (async () => {
      try {
        const value = await room.request('telephone/draft', attempt.payload, {
          signal: next.controller.signal,
          affectsConnection: false,
        });
        if (disposed || job !== next || attempt.context !== context.value) return false;
        room.accept(value);
        if (attempt.context !== context.value) return false;
        accepted.value = attempt.serialized;
        retry = null;
        notice.value =
          attempt.revision === revision
            ? '草稿已獲伺服器接受。'
            : '較早的草稿已接受，還有新內容尚未同步。';
        return true;
      } catch (cause) {
        if (
          !disposed &&
          job === next &&
          attempt.context === context.value &&
          !(cause instanceof DOMException && cause.name === 'AbortError')
        ) {
          retry = attempt;
          if (attempt.revision === revision) automatic = false;
          notice.value = cause instanceof Error ? cause.message : '私人草稿同步失敗，可手動重試。';
        }
        return false;
      } finally {
        clearTimeout(timeout);
        if (job === next) {
          job = null;
          saving.value = false;
          if (automatic && dirty.value && attempt.revision !== revision) schedule();
        }
      }
    })();
    return next.promise;
  }
  function changed() {
    revision++;
    actions.setTarget(context.value + ':' + revision);
    retry = null;
    automatic = true;
    notice.value = '有本地內容尚未同步。';
    cache();
    schedule();
  }
  function changeStrokes(values: TelephoneStroke[]) {
    if (!editable.value) return;
    strokes.value = readTelephoneStrokes(values);
    changed();
  }
  function changeText(value: string) {
    if (!editable.value) return;
    text.value = [...value.replace(/[\u0000-\u001f\u007f]/g, '')].slice(0, 80).join('');
    changed();
  }
  function undo() {
    if (!activeStroke.value && strokes.value.length) changeStrokes(strokes.value.slice(0, -1));
  }
  function clear() {
    if (!activeStroke.value) changeStrokes([]);
  }
  async function submit(skip = false) {
    if (!allowed.value || finishing.value || actions.pending || room.busy || activeStroke.value)
      return false;
    if (
      !skip &&
      (state.value?.task?.kind === 'drawing' ? !strokes.value.length : !text.value.trim())
    )
      return false;
    const key = context.value,
      value = structuredClone(content.value);
    finishing.value = true;
    automatic = false;
    clearTimer();
    const pending = job;
    if (pending) {
      pending.controller.abort();
      await pending.promise;
    }
    try {
      if (disposed || key !== context.value || !allowed.value) return false;
      const ok = await actions.command(skip ? 'skip' : 'submit', skip ? {} : value);
      if (ok && key === context.value) forget();
      return ok;
    } finally {
      if (key === context.value) finishing.value = false;
    }
  }
  function tick() {
    now.value = Date.now();
    serverTime.value = anchor + performance.now() - at;
    if (expired.value) {
      clearTimer();
      automatic = false;
      activeStroke.value = false;
      if (clock) clearInterval(clock);
      clock = null;
    }
  }
  function clockMode() {
    if (clock) clearInterval(clock);
    clock = null;
    tick();
    if (state.value?.phase === 'passing' && !expired.value && !document.hidden)
      clock = setInterval(tick, 250);
  }
  watch(
    state,
    (current) => {
      if (current) {
        anchor = anchored
          ? Math.max(anchor + performance.now() - at, current.serverNow)
          : current.serverNow;
        anchored = true;
        at = performance.now();
      }
      clockMode();
    },
    { immediate: true, flush: 'sync' },
  );
  watch(context, initialize, { immediate: true, flush: 'sync' });
  watch(
    [() => state.value?.task?.submitted, () => room.terminal],
    () => {
      if (state.value?.task?.submitted || room.terminal) {
        clearTimer();
        automatic = false;
        activeStroke.value = false;
        job?.controller.abort();
        forget();
      }
    },
    { flush: 'sync' },
  );
  watch(
    () => room.busy,
    (value) => {
      if (!value) schedule();
    },
  );
  function visibility() {
    foreground.value = !document.hidden;
    if (document.hidden) {
      save();
      clearTimer();
      automatic = false;
      activeStroke.value = false;
      job?.controller.abort(
        new DOMException('背景同步已暫停，回到前景後請確認草稿狀態。', 'TimeoutError'),
      );
    }
    clockMode();
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    save();
    disposed = true;
    reset();
    if (cacheTimer) clearTimeout(cacheTimer);
    if (clock) clearInterval(clock);
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    state,
    setup,
    settingsEditable,
    sources,
    queueSources,
    start,
    settingsPending: settings.pending,
    settingsError: settings.error,
    settingsSaved: settings.saved,
    strokes,
    text,
    saving,
    finishing,
    activeStroke,
    notice,
    storageNotice,
    now,
    offset,
    expired,
    allowed,
    editable,
    dirty,
    acceptedCount,
    sync,
    changeStrokes,
    changeText,
    undo,
    clear,
    submit,
  };
});
