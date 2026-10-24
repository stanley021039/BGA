import AudioSettings from '../engines/audio-settings.js';
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { useQueuedSave } from '../composables/queued-save';
import { ApiError } from '../services/http';
import type { IngredientColor, QuacksSnapshot } from '../contracts/quacks';
interface Attempt {
  scope: number;
  context: string;
  payload: Record<string, unknown>;
}
export const useQuacksStore = defineStore('quacks', () => {
  const room = useRoomStore(),
    state = computed(() =>
      room.snapshot?.type === 'quacks' ? (room.snapshot as QuacksSnapshot) : null,
    ),
    mine = computed(() => state.value?.mine || null),
    own = computed(() => state.value?.recipes.find((p) => p.id === state.value?.me) || null),
    setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase)),
    editableSettings = computed(() => setup.value && room.host && !room.terminal);
  const draft = reactive({ witches: false, alchemists: false, hiddenProgress: false, bookSet: 1 }),
    canonical = ref(''),
    dirty = computed(() => !!canonical.value && JSON.stringify(draft) !== canonical.value);
  const settings = useQueuedSave<typeof draft>({
    allowed: () => editableSettings.value,
    blocked: () => room.busy,
    save: (value) => room.command('settings', value),
    failure: () => room.message,
  });
  watch(
    [() => JSON.stringify(state.value?.options), editableSettings, () => room.scope],
    () => {
      const o = state.value?.options;
      if (!o) return;
      const adopt =
        !canonical.value || !editableSettings.value || (!settings.pending.value && !dirty.value);
      canonical.value = JSON.stringify({
        witches: o.witches,
        alchemists: o.alchemists,
        hiddenProgress: o.hiddenProgress,
        bookSet: o.bookSet,
      });
      if (adopt) Object.assign(draft, JSON.parse(canonical.value));
      if (!editableSettings.value) settings.reset();
    },
    { immediate: true },
  );
  function queueSettings() {
    if (!editableSettings.value) return;
    if (!draft.witches && draft.bookSet > 4) draft.bookSet = 1;
    settings.enqueue({ ...draft });
  }
  async function start() {
    if (!editableSettings.value || (state.value?.players.length || 0) < 2) return;
    if (dirty.value && !settings.pending.value) queueSettings();
    if ((await settings.flush()) && !settings.error.value) await room.command('start', {});
  }
  const now = ref(Date.now());
  let introClock: ReturnType<typeof setInterval> | null = null;
  function clockMode() {
    if (introClock) clearInterval(introClock);
    introClock = null;
    now.value = Date.now();
    if (state.value?.phase === 'round-intro' && !document.hidden)
      introClock = setInterval(() => (now.value = Date.now()), 100);
  }
  watch([() => state.value?.phase, () => state.value?.nextRoundAt], clockMode, { immediate: true });
  const context = computed(() => {
      const s = state.value;
      return s
        ? JSON.stringify([
            room.scope,
            s.roundId,
            s.phase,
            s.stage,
            s.step,
            s.mine?.pending?.id || '',
            s.mine?.ready || false,
          ])
        : '';
    }),
    retry = shallowRef<Attempt | null>(null),
    pending = ref(false),
    notice = ref(''),
    selectedPot = ref(''),
    selectedBook = ref<IngredientColor>('orange'),
    coinFilter = ref(''),
    nameDraft = ref('');
  let controller: AbortController | null = null,
    disposed = false;
  const available = computed(
      () =>
        !!state.value &&
        !!room.seat &&
        room.connected &&
        !room.terminal &&
        !state.value.interrupted &&
        !pending.value &&
        !room.busy &&
        !document.hidden,
    ),
    canRetry = computed(
      () =>
        !!retry.value &&
        retry.value.scope === room.scope &&
        retry.value.context === context.value &&
        available.value,
    );
  async function execute(attempt: Attempt): Promise<boolean> {
    if (!available.value || attempt.scope !== room.scope || attempt.context !== context.value)
      return false;
    const request = new AbortController();
    controller = request;
    pending.value = true;
    room.busy = true;
    notice.value = '正在送出…';
    retry.value = null;
    const timer = setTimeout(
      () =>
        request.abort(
          new DOMException('操作結果尚未確認，可更新房間後重試同一操作。', 'TimeoutError'),
        ),
      10000,
    );
    try {
      const value = await room.request('action', attempt.payload, { signal: request.signal });
      if (disposed || controller !== request || attempt.scope !== room.scope) return false;
      room.accept(value);
      notice.value = '';
      if (!room.terminal && attempt.payload.action === 'next' && !document.hidden)
        AudioSettings?.playEffect?.('turn');
      return !room.terminal;
    } catch (cause) {
      if (
        !disposed &&
        controller === request &&
        attempt.scope === room.scope &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        notice.value = cause instanceof Error ? cause.message : '操作失敗，請更新房間後重試。';
        if (
          (!(cause instanceof ApiError) || !cause.status || cause.status >= 500) &&
          attempt.context === context.value
        )
          retry.value = attempt;
      }
      return false;
    } finally {
      clearTimeout(timer);
      if (controller === request) {
        controller = null;
        pending.value = false;
        if (attempt.scope === room.scope) room.busy = false;
      }
    }
  }
  function command(action: string, data: Record<string, unknown> = {}, requestId?: string) {
    const s = state.value;
    if (!s) return Promise.resolve(false);
    return execute({
      scope: room.scope,
      context: context.value,
      payload: structuredClone({
        ...data,
        action,
        roundId: s.roundId,
        requestId: requestId || crypto.randomUUID(),
      }),
    });
  }
  function retrySame() {
    return retry.value && canRetry.value ? execute(retry.value) : Promise.resolve(false);
  }
  function clear() {
    controller?.abort();
    controller = null;
    retry.value = null;
    if (pending.value) room.busy = false;
    pending.value = false;
    notice.value = '';
    coinFilter.value = '';
  }
  watch(context, () => {
    if (retry.value?.context !== context.value) retry.value = null;
    coinFilter.value = '';
  });
  watch([() => room.scope, () => room.terminal], () => {
    clear();
    selectedPot.value = state.value?.me || '';
  });
  watch(
    [() => state.value?.recipes.map((p) => p.id + ':' + p.hidden).join(','), () => state.value?.me],
    () => {
      const s = state.value;
      if (!s) return;
      const p = s.recipes.find((p) => p.id === selectedPot.value);
      if (!p || (p.hidden && p.id !== s.me)) selectedPot.value = s.me;
    },
    { immediate: true },
  );
  const viewed = computed(
    () => state.value?.recipes.find((p) => p.id === selectedPot.value && !p.hidden) || own.value,
  );
  watch(
    () => own.value?.potName,
    (value) => {
      nameDraft.value = value || '';
    },
    { immediate: true },
  );
  function setName() {
    const name = nameDraft.value.trim();
    if (!name || [...name].length > 24 || /[\u0000-\u001f\u007f]/.test(name)) {
      notice.value = '大釜名稱需為 1–24 字，不能換行。';
      return Promise.resolve(false);
    }
    return command('name-pot', { name });
  }
  function drawFortune() {
    const s = state.value;
    if (!s || s.phase !== 'fortune' || s.me !== s.roundStarterId) return Promise.resolve(false);
    return command('draw-fortune', {}, 'fortune-' + s.roundId);
  }
  function visibility() {
    clockMode();
    if (document.hidden) {
      controller?.abort(
        new DOMException('背景操作已暫停，回到前景後先確認房間狀態。', 'TimeoutError'),
      );
    }
  }
  document.addEventListener('visibilitychange', visibility);
  onScopeDispose(() => {
    disposed = true;
    clear();
    if (introClock) clearInterval(introClock);
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    state,
    mine,
    own,
    setup,
    now,
    editableSettings,
    draft,
    queueSettings,
    start,
    settingsPending: settings.pending,
    settingsError: settings.error,
    settingsSaved: settings.saved,
    available,
    pending,
    notice,
    canRetry,
    retrySame,
    command,
    selectedPot,
    viewed,
    selectedBook,
    coinFilter,
    nameDraft,
    setName,
    drawFortune,
  };
});
