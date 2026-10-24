import StrokeCanvas from '../engines/stroke-canvas.js';
import DrawResults from '../engines/draw-results.js';
import DrawCanvasSession from '../engines/draw-canvas-session.js';
import ArtworkExport from '../engines/artwork-export.js';
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { readPublicDrawSnapshot, readResultSave } from '../contracts/draw-results';
import type {
  PublicDrawSnapshot,
  ResultSaveReceipt,
  ResultsEngine,
  ResultsView,
  VotePresentation,
} from '../contracts/draw-results';
import { strings } from '../services/validation';

export const useDrawResultsStore = defineStore('draw-results', () => {
  const room = useRoomStore(),
    view = shallowRef<ResultsView | null>(null),
    filter = ref<'all' | 'mine' | 'saved'>('all');
  const savedIds = shallowRef(new Set<string>()),
    optimistic = shallowRef(new Map<string, boolean>());
  const busy = ref(false),
    message = ref(''),
    failed = ref(false),
    initError = ref('');
  let engine: ResultsEngine | null = null,
    disposed = false;
  const encoders = new Set<
    ReturnType<NonNullable<Window['StrokeCanvas']>['createDrawingRenderer']>
  >();
  const controllers = new Set<AbortController>();
  const enabled = computed(
    () => !!room.seat && !!room.snapshot && room.type === 'draw' && !room.terminal,
  );
  const saved = computed(() => {
    const ids = new Set(savedIds.value);
    for (const [id, selected] of optimistic.value) {
      if (selected) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  });
  const results = computed(() => view.value?.results || []);
  const filtered = computed(() =>
    results.value.filter((result) =>
      filter.value === 'mine'
        ? result.artist.id === room.snapshot?.me
        : filter.value === 'saved'
          ? saved.value.has(result.resultId)
          : true,
    ),
  );
  const current = (scope: number) => !disposed && room.scope === scope && enabled.value;
  const aborted = () => new DOMException('房間已更新', 'AbortError');
  async function request(
    route: string,
    data?: Record<string, unknown>,
    query?: Record<string, string>,
  ) {
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(
      () => controller.abort(new DOMException('讀取或送出結果尚未確認，請重試。', 'TimeoutError')),
      10000,
    );
    try {
      return await room.request(route, data, { query, signal: controller.signal });
    } finally {
      clearTimeout(timer);
      controllers.delete(controller);
    }
  }
  function initialize(): ResultsEngine {
    if (engine) return engine;
    if (!DrawResults || !DrawCanvasSession || !StrokeCanvas)
      throw Error('畫作工具無法載入，請重新整理。');
    const validateCanvas = DrawCanvasSession.validSnapshot;
    engine = DrawResults.createStore({
      validateCanvas,
      loadResult: async (id, code) => {
        if (!enabled.value || code !== room.code) throw aborted();
        const scope = room.scope,
          value = await request('draw/result', undefined, { resultId: id });
        if (!current(scope)) throw aborted();
        const snapshot = readPublicDrawSnapshot(value, validateCanvas);
        if (snapshot.result.resultId !== id) throw Error('畫作回應與選取的回合不符。');
        return snapshot;
      },
      saveResult: async (snapshot, { recollect, isCurrent }, code) => {
        const scope = room.scope;
        if (!current(scope) || code !== room.code || !isCurrent()) throw aborted();
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const renderer = StrokeCanvas!.createDrawingRenderer(canvas, { maxCheckpoints: 2 });
        encoders.add(renderer);
        try {
          await renderer.renderCooperatively(snapshot.canvas.strokes);
          if (!current(scope) || !isCurrent()) throw aborted();
          const base64 = StrokeCanvas!.drawingDataURL(canvas, 1024 * 1024).split(',')[1];
          return readResultSave(
            await request('draw/result/save', {
              resultId: snapshot.result.resultId,
              base64,
              ...(recollect ? { recollect: true } : {}),
            }),
          );
        } finally {
          encoders.delete(renderer);
          renderer.reset();
          canvas.width = canvas.height = 0;
        }
      },
      voteResult: (id, code) => {
        if (!enabled.value || code !== room.code) return Promise.reject(aborted());
        return request('draw/result/ban', { resultId: id });
      },
      onState: (value) => {
        room.accept(value);
      },
      onChange: (value) => {
        if (!disposed) view.value = value;
      },
    });
    if (room.snapshot) engine.update(room.snapshot);
    view.value = engine.view();
    initError.value = '';
    return engine;
  }
  function overlay(id: string, value?: boolean) {
    const next = new Map(optimistic.value);
    if (value === undefined) next.delete(id);
    else next.set(id, value);
    optimistic.value = next;
  }
  async function refreshSaved(id: string, scope: number) {
    try {
      const state = await request('state');
      if (!current(scope)) return;
      room.accept(state);
      overlay(id);
      if (!strings(room.snapshot?.savedResultIds).includes(id)) engine?.forgetSave(id);
    } catch {
      /* A confirmed save remains visible until a fresh snapshot reconciles it. */
    }
  }
  function update() {
    if (!room.snapshot || !enabled.value) return;
    const previous = savedIds.value,
      next = new Set(strings(room.snapshot.savedResultIds)),
      pending = new Map(optimistic.value);
    for (const [id, selected] of pending) if (next.has(id) === selected) pending.delete(id);
    optimistic.value = pending;
    savedIds.value = next;
    for (const id of previous) if (!next.has(id) && !pending.has(id)) engine?.forgetSave(id);
    try {
      const owner = initialize();
      owner.update(room.snapshot);
      const keep = new Set(owner.view().results.map((result) => result.resultId));
      if (owner.view().selectedId) keep.add(owner.view().selectedId!);
      if (owner.view().savingId) keep.add(owner.view().savingId!);
      const retained = new Map([...optimistic.value].filter(([id]) => keep.has(id)));
      if (retained.size !== optimistic.value.size) optimistic.value = retained;
    } catch (cause) {
      initError.value = cause instanceof Error ? cause.message : '無法載入畫作工具';
    }
  }
  function reset() {
    for (const controller of controllers) controller.abort();
    controllers.clear();
    for (const renderer of encoders) renderer.reset();
    encoders.clear();
    engine?.reset();
    savedIds.value = new Set();
    optimistic.value = new Map();
    filter.value = 'all';
    busy.value = false;
    message.value = '';
    failed.value = false;
    initError.value = '';
  }
  async function select(id?: string | null, reload = false) {
    if (!enabled.value) return null;
    try {
      if (
        id &&
        !filtered.value.some((result) => result.resultId === id) &&
        results.value.some((result) => result.resultId === id)
      )
        filter.value = 'all';
      const selected =
        id === null
          ? null
          : id && filtered.value.some((result) => result.resultId === id)
            ? id
            : filtered.value.find((result) => result.resultId === view.value?.selectedId)
                ?.resultId ||
              filtered.value[0]?.resultId ||
              null;
      return await initialize().select(selected, { reload });
    } catch (cause) {
      initError.value = cause instanceof Error ? cause.message : '無法讀取畫作';
      return null;
    }
  }
  async function load(id: string): Promise<PublicDrawSnapshot> {
    if (!enabled.value) throw aborted();
    return initialize().load(id);
  }
  async function save(
    id = view.value?.selectedId,
    recollect = false,
  ): Promise<ResultSaveReceipt | null> {
    if (!id || !enabled.value || busy.value) return null;
    message.value = '';
    failed.value = false;
    const scope = room.scope;
    try {
      const owner = initialize();
      await owner.load(id);
      if (!current(scope)) return null;
      const receipt = await owner.save(id, { recollect });
      if (receipt && current(scope)) {
        overlay(id, true);
        void refreshSaved(id, scope);
      }
      return current(scope) ? receipt : null;
    } catch (cause) {
      if (current(scope)) {
        message.value = cause instanceof Error ? cause.message : '收藏失敗';
        failed.value = true;
      }
      return null;
    }
  }
  async function vote(id = view.value?.selectedId) {
    if (!id || !enabled.value) return null;
    try {
      return await initialize().vote(id);
    } catch (cause) {
      message.value = cause instanceof Error ? cause.message : '無法投票';
      failed.value = true;
      return null;
    }
  }
  function votePresentation(id = view.value?.selectedId): VotePresentation {
    if (!engine || !DrawResults)
      return {
        label: '禁止題目',
        disabled: true,
        summary: '',
        status: '正在讀取投票資訊…',
        kind: 'info',
      };
    // Reading the reactive view makes the pure engine's current vote visible to Vue.
    void view.value;
    return DrawResults.votePresentation(engine.voteView(id));
  }
  async function unsave(id: string) {
    if (!enabled.value || busy.value || view.value?.savingId) return false;
    const scope = room.scope;
    busy.value = true;
    failed.value = false;
    message.value = '正在取消收藏…';
    try {
      const state = await request('draw/result/unsave', { resultId: id, confirmed: true });
      if (!current(scope)) return false;
      engine?.forgetSave(id);
      overlay(id, false);
      room.accept(state);
      message.value = '已取消私人收藏，公開畫作與得分仍保留。';
      return true;
    } catch (cause) {
      if (current(scope)) {
        message.value = cause instanceof Error ? cause.message : '取消收藏失敗';
        failed.value = true;
      }
      return false;
    } finally {
      if (current(scope)) busy.value = false;
    }
  }
  async function exportWork(job: (scope: number) => Promise<void>) {
    if (!enabled.value || busy.value) return false;
    const scope = room.scope;
    busy.value = true;
    failed.value = false;
    message.value = '正在準備畫作…';
    try {
      await job(scope);
      if (!current(scope)) return false;
      message.value = '畫作已匯出。';
      return true;
    } catch (cause) {
      if (current(scope)) {
        if (cause instanceof Error && cause.name === 'AbortError') {
          message.value = '';
          failed.value = false;
        } else {
          message.value = cause instanceof Error ? cause.message : '匯出失敗';
          failed.value = true;
        }
      }
      return false;
    } finally {
      if (current(scope)) busy.value = false;
    }
  }
  function exporter() {
    if (!ArtworkExport) throw Error('匯出工具無法載入，請重新整理。');
    return ArtworkExport;
  }
  const download = (id = view.value?.selectedId) =>
    exportWork(async (scope) => {
      if (!id) throw Error('請先選擇一幅畫作');
      const snapshot = await load(id),
        api = exporter(),
        blob = await api.png(snapshot);
      if (!current(scope)) throw aborted();
      api.download(blob, api.name(snapshot));
    });
  const exportAll = (currentRun = false) =>
    exportWork(async (scope) => {
      const list = (
          currentRun
            ? results.value.filter((result) => result.gameRunId === view.value?.gameRunId)
            : filtered.value
        ).slice(0, 8),
        entries: { name: string; blob: Blob }[] = [];
      if (!list.length) throw Error('目前沒有可以匯出的公開畫作');
      const api = exporter();
      for (const result of list) {
        if (!current(scope)) throw aborted();
        const snapshot = await load(result.resultId),
          blob = await api.png(snapshot);
        if (!current(scope)) throw aborted();
        entries.push({ name: api.name(snapshot), blob });
      }
      const blob = await api.zip(entries);
      if (!current(scope)) throw aborted();
      api.download(blob, '你畫我猜_畫作集.zip');
    });
  const share = (id: string) =>
    exportWork(async (scope) => {
      const snapshot = await load(id),
        api = exporter(),
        blob = await api.png(snapshot);
      if (!current(scope)) throw aborted();
      const file = new File([blob], api.name(snapshot), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({
          files: [file],
          title: '你畫我猜 · ' + (snapshot.result.answer || '畫作'),
        });
      else api.download(blob, file.name);
    });
  watch(() => room.snapshot, update, { immediate: true });
  watch(
    () => [room.scope, room.terminal],
    () => {
      reset();
      if (enabled.value) update();
    },
  );
  onScopeDispose(() => {
    disposed = true;
    reset();
    engine = null;
  });
  return {
    view,
    results,
    filtered,
    filter,
    saved,
    enabled,
    busy,
    message,
    failed,
    initError,
    select,
    load,
    save,
    vote,
    votePresentation,
    unsave,
    download,
    exportAll,
    share,
  };
});
