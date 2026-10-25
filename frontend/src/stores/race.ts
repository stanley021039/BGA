import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { useQueuedSave } from '../composables/queued-save';
import { ApiError } from '../services/http';
import type { RaceSnapshot } from '../contracts/race';
export const useRaceStore = defineStore('race', () => {
  const room = useRoomStore(),
    state = computed(() =>
      room.snapshot?.type === 'thunder' ? (room.snapshot as RaceSnapshot) : null,
    ),
    setup = computed(() => !!state.value && ['waiting', 'finished'].includes(state.value.phase)),
    settingsEditable = computed(() => setup.value && room.settingsManager && !room.terminal),
    devilsRun = ref(false),
    canonical = ref(false),
    settingsDirty = computed(() => devilsRun.value !== canonical.value);
  const save = useQueuedSave<{ devilsRun: boolean }>({
    allowed: () => settingsEditable.value,
    blocked: () => room.busy,
    save: (value) => room.command('settings', value),
    failure: () => room.message,
  });
  watch(
    [() => state.value?.options.devilsRun, settingsEditable, () => room.scope],
    () => {
      if (!state.value) return;
      const adopt = !settingsEditable.value || (!save.pending.value && !settingsDirty.value);
      canonical.value = state.value.options.devilsRun;
      if (adopt) devilsRun.value = canonical.value;
      if (!settingsEditable.value) save.reset();
    },
    { immediate: true },
  );
  function queue() {
    if (settingsEditable.value) save.enqueue({ devilsRun: devilsRun.value });
  }
  async function start() {
    if (!settingsEditable.value || (state.value?.players.filter((p) => !p.kicked).length || 0) < 2)
      return;
    if (settingsDirty.value && !save.pending.value) queue();
    if ((await save.flush()) && !save.error.value) await room.command('start', {});
  }
  const pending = ref(false),
    notice = ref(''),
    failed = ref(false),
    uncertain = ref(false),
    foreground = ref(!document.hidden),
    now = ref(Date.now()),
    serverTime = ref(Date.now()),
    offset = computed(() => now.value - serverTime.value),
    expired = computed(
      () => !setup.value && !!state.value?.deadline && serverTime.value >= state.value.deadline,
    );
  const connected = computed(() => room.connected),
    busy = computed(() => pending.value || room.busy),
    canAct = computed(
      () =>
        !!state.value &&
        !setup.value &&
        state.value.actor === state.value.me &&
        connected.value &&
        foreground.value &&
        !busy.value &&
        !uncertain.value &&
        !expired.value,
    ),
    context = computed(() =>
      state.value && room.seat && !room.terminal
        ? `${room.scope}:${state.value.round}:${state.value.phase}:${state.value.actor}:${state.value.active?.car}:${state.value.active?.remaining}:${state.value.diceCheck?.id}:${state.value.diceCheck?.status}:${state.value.diceCheck?.startedAt}:${state.value.pending?.top}:${state.value.pending?.direction}`
        : '',
    );
  let controller: AbortController | null = null,
    disposed = false,
    applying = false,
    uncertainAfter = 0,
    anchored = false,
    anchor = Date.now(),
    at = performance.now(),
    clock: ReturnType<typeof setInterval> | null = null;
  function abort() {
    controller?.abort();
    controller = null;
    if (pending.value) room.busy = false;
    pending.value = false;
  }
  watch(
    context,
    () => {
      if (pending.value && !applying) {
        abort();
        uncertain.value = true;
        uncertainAfter = room.lastReceivedAt;
        notice.value = '比賽狀態已更新，先確認目前車輛與點數再操作。';
      }
    },
    { flush: 'sync' },
  );
  watch(
    () => room.lastReceivedAt,
    (value) => {
      if (uncertain.value && value > uncertainAfter) {
        uncertain.value = false;
        failed.value = false;
        notice.value = '已更新比賽，請依目前狀態選擇下一步。';
      }
    },
  );
  async function run(action: string, data: Record<string, unknown> = {}): Promise<boolean> {
    if (disposed || !canAct.value || controller) return false;
    const request = new AbortController(),
      scope = room.scope,
      key = context.value,
      payload = structuredClone({ ...data, action });
    controller = request;
    pending.value = true;
    room.busy = true;
    notice.value = '正在送出…';
    failed.value = false;
    const timer = setTimeout(
      () =>
        request.abort(
          new DOMException(
            '操作結果尚未確認，更新比賽後再選擇下一步；不會自動重送。',
            'TimeoutError',
          ),
        ),
      10000,
    );
    try {
      const next = await room.request('action', payload, { signal: request.signal });
      if (disposed || controller !== request || scope !== room.scope || key !== context.value)
        return false;
      applying = true;
      try {
        room.accept(next);
      } finally {
        applying = false;
      }
      if (room.terminal) return false;
      notice.value = '';
      return true;
    } catch (cause) {
      if (
        !disposed &&
        controller === request &&
        scope === room.scope &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        failed.value = true;
        notice.value = cause instanceof Error ? cause.message : '操作未完成，請確認目前比賽。';
        if (!(cause instanceof ApiError) || !cause.status || cause.status >= 500) {
          uncertain.value = true;
          uncertainAfter = room.lastReceivedAt;
        }
      }
      return false;
    } finally {
      clearTimeout(timer);
      if (controller === request) {
        controller = null;
        pending.value = false;
        if (scope === room.scope) room.busy = false;
      }
    }
  }
  function tick() {
    now.value = Date.now();
    serverTime.value = anchor + performance.now() - at;
    if (expired.value && clock) {
      clearInterval(clock);
      clock = null;
    }
  }
  function clockMode() {
    if (clock) clearInterval(clock);
    clock = null;
    tick();
    if (state.value && !setup.value && !expired.value && foreground.value)
      clock = setInterval(tick, 250);
  }
  watch(
    state,
    (value) => {
      if (value) {
        anchor = anchored
          ? Math.max(anchor + performance.now() - at, value.serverNow)
          : value.serverNow;
        anchored = true;
        at = performance.now();
      }
      clockMode();
    },
    { immediate: true, flush: 'sync' },
  );
  function visibility() {
    foreground.value = !document.hidden;
    if (document.hidden)
      controller?.abort(new DOMException('背景操作已暫停，回到前景後確認比賽。', 'TimeoutError'));
    clockMode();
  }
  document.addEventListener('visibilitychange', visibility);
  watch(
    () => room.terminal,
    (value) => {
      if (value) abort();
    },
  );
  onScopeDispose(() => {
    disposed = true;
    abort();
    if (clock) clearInterval(clock);
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    state,
    setup,
    settingsEditable,
    devilsRun,
    queue,
    start,
    settingsPending: save.pending,
    settingsError: save.error,
    settingsSaved: save.saved,
    pending,
    busy,
    notice,
    failed,
    uncertain,
    connected,
    canAct,
    now,
    offset,
    expired,
    run,
    lesson: false,
  };
});
