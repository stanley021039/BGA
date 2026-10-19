import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { ApiError } from '../services/http';
import { pokerContributionTiers, type PokerSnapshot } from '../contracts/poker';
export const usePokerStore = defineStore('poker', () => {
  const room = useRoomStore(),
    state = computed(() =>
      room.snapshot?.type === 'poker' ? (room.snapshot as PokerSnapshot) : null,
    ),
    me = computed(() => state.value?.players.find((p) => p.id === state.value?.me)),
    actor = computed(() => state.value?.players[state.value.turn]),
    setup = computed(() => !!state.value && ['waiting', 'showdown'].includes(state.value.phase)),
    active = computed(() => !!state.value && !setup.value),
    myTurn = computed(() => active.value && actor.value?.id === state.value?.me),
    due = computed(() => Math.max(0, (state.value?.currentBet || 0) - (me.value?.bet || 0))),
    callAmount = computed(() => Math.min(due.value, me.value?.stack || 0)),
    maximum = computed(() => (me.value?.bet || 0) + (me.value?.stack || 0)),
    minimum = computed(() =>
      Math.min((state.value?.currentBet || 0) + (state.value?.minRaise || 20), maximum.value),
    ),
    tiers = computed(() => pokerContributionTiers(state.value?.players || []));
  const pending = ref(false),
    failed = ref(false),
    notice = ref(''),
    uncertain = ref(false),
    amount = ref<string | number>(''),
    now = ref(Date.now()),
    serverTime = ref(Date.now()),
    foreground = ref(!document.hidden);
  const offset = computed(() => now.value - serverTime.value),
    deadline = computed(() => (active.value ? state.value?.deadline || null : null)),
    expired = computed(() => !!deadline.value && serverTime.value >= deadline.value),
    context = computed(() =>
      state.value && room.seat && !room.terminal
        ? `${room.scope}:${state.value.hand}:${state.value.phase}:${actor.value?.id || ''}:${state.value.deadline}:${state.value.currentBet}:${me.value?.bet}:${me.value?.stack}`
        : '',
    );
  const canAct = computed(
      () =>
        myTurn.value &&
        room.connected &&
        foreground.value &&
        !expired.value &&
        !pending.value &&
        !room.busy &&
        !uncertain.value,
    ),
    canRaise = computed(
      () =>
        canAct.value &&
        !!state.value?.canRaise &&
        (me.value?.stack || 0) > due.value &&
        maximum.value > (state.value?.currentBet || 0),
    ),
    canAllIn = computed(
      () => canAct.value && ((me.value?.stack || 0) <= due.value || !!state.value?.canRaise),
    ),
    raiseValid = computed(() => {
      const target = Number(amount.value);
      return (
        String(amount.value).trim() !== '' &&
        Number.isSafeInteger(target) &&
        target > (state.value?.currentBet || 0) &&
        target <= maximum.value &&
        (target >= minimum.value || target === maximum.value)
      );
    }),
    canRebuy = computed(
      () =>
        setup.value &&
        me.value?.stack === 0 &&
        room.connected &&
        !room.busy &&
        !pending.value &&
        !uncertain.value,
    );
  let disposed = false,
    applying = false,
    controller: AbortController | null = null,
    clock: ReturnType<typeof setInterval> | null = null,
    anchor = Date.now(),
    at = performance.now(),
    anchored = false,
    uncertainAfter = 0;
  function abort() {
    controller?.abort();
    controller = null;
    if (pending.value) room.busy = false;
    pending.value = false;
  }
  watch(
    context,
    () => {
      amount.value = String(minimum.value);
      if (pending.value && !applying) {
        abort();
        uncertain.value = true;
        uncertainAfter = room.lastReceivedAt;
        notice.value = '牌桌已變更，正在確認最新行動；不會自動重送下注。';
      }
    },
    { immediate: true, flush: 'sync' },
  );
  watch(
    () => room.lastReceivedAt,
    (value) => {
      if (uncertain.value && value > uncertainAfter) {
        uncertain.value = false;
        notice.value = '已更新牌桌，請依目前狀態重新選擇操作。';
        failed.value = false;
      }
    },
  );
  async function run(
    route: 'action' | 'rebuy',
    data: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (
      disposed ||
      controller ||
      room.busy ||
      uncertain.value ||
      !room.connected ||
      !room.seat ||
      (route === 'action' && !canAct.value) ||
      (route === 'rebuy' && !canRebuy.value)
    )
      return false;
    const request = new AbortController(),
      scope = room.scope,
      key = context.value,
      previous = state.value;
    controller = request;
    pending.value = true;
    room.busy = true;
    notice.value = '正在送出…';
    failed.value = false;
    const timer = setTimeout(
      () =>
        request.abort(
          new DOMException('操作結果尚未確認；正在更新牌桌，不會自動重送下注。', 'TimeoutError'),
        ),
      10000,
    );
    try {
      const value = await room.request(route, data, { signal: request.signal });
      if (disposed || controller !== request || scope !== room.scope || key !== context.value)
        return false;
      applying = true;
      try {
        room.accept(value);
      } finally {
        applying = false;
      }
      if (room.terminal) return false;
      notice.value = '';
      if (
        route === 'action' &&
        state.value &&
        previous?.hand === state.value.hand &&
        previous.phase === state.value.phase &&
        state.value.phase !== 'showdown' &&
        previous.board.length === state.value.board.length &&
        !document.hidden
      ) {
        const clip = window.AudioSettings?.playEffect?.('confirm');
        if (clip) {
          ownClips.add(clip);
          const forget = () => ownClips.delete(clip);
          clip.addEventListener('ended', forget, { once: true });
          clip.addEventListener('error', forget, { once: true });
          if (ownClips.size > 4) {
            const old = ownClips.values().next().value;
            window.AudioSettings?.stopEffect(old);
            if (old) ownClips.delete(old);
          }
        }
      }
      return true;
    } catch (cause) {
      if (
        !disposed &&
        controller === request &&
        scope === room.scope &&
        !(cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        failed.value = true;
        notice.value = cause instanceof Error ? cause.message : '操作失敗，請查看目前牌桌。';
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
  function act(action: 'fold' | 'check' | 'call' | 'raise' | 'allin') {
    if (
      (action === 'raise' && (!canRaise.value || !raiseValid.value)) ||
      (action === 'allin' && !canAllIn.value) ||
      (action === 'check' && due.value > 0) ||
      (action === 'call' && !due.value)
    )
      return Promise.resolve(false);
    return run('action', {
      action,
      ...(action === 'raise' ? { amount: Number(amount.value) } : {}),
    });
  }
  function rebuy() {
    return run('rebuy');
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
    if (active.value && !expired.value && foreground.value) clock = setInterval(tick, 250);
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
  const ownClips = new Set<HTMLAudioElement>();
  function stopSounds() {
    for (const clip of ownClips) window.AudioSettings?.stopEffect(clip);
    ownClips.clear();
  }
  function visibility() {
    foreground.value = !document.hidden;
    if (document.hidden) {
      stopSounds();
      controller?.abort(
        new DOMException('背景操作已暫停；回到前景後請確認最新牌桌。', 'TimeoutError'),
      );
    }
    clockMode();
  }
  document.addEventListener('visibilitychange', visibility);
  watch(
    () => room.terminal,
    (value) => {
      if (value) {
        abort();
        uncertain.value = false;
        stopSounds();
      }
    },
  );
  onScopeDispose(() => {
    disposed = true;
    abort();
    if (clock) clearInterval(clock);
    stopSounds();
    document.removeEventListener('visibilitychange', visibility);
  });
  return {
    state,
    me,
    actor,
    setup,
    active,
    myTurn,
    due,
    callAmount,
    minimum,
    maximum,
    tiers,
    pending,
    failed,
    notice,
    uncertain,
    amount,
    now,
    offset,
    deadline,
    expired,
    canAct,
    canRaise,
    canAllIn,
    raiseValid,
    canRebuy,
    act,
    rebuy,
  };
});
