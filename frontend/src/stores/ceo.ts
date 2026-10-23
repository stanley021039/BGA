import { computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { usePartyActionsStore } from './party-actions';
import type { CeoSnapshot } from '../contracts/ceo';
export const useCeoStore = defineStore('ceo', () => {
  const room = useRoomStore(),
    actions = usePartyActionsStore();
  const state = computed(() =>
    room.snapshot?.type === 'ceo' ? (room.snapshot as CeoSnapshot) : null,
  );
  const game = computed(() => state.value?.game || null);
  const setup = computed(
    () => !!state.value && ['waiting', 'finished'].includes(state.value.phase),
  );
  const me = computed(() => game.value?.players.find((p) => p.id === state.value?.me));
  const canAct = computed(
    () =>
      !!me.value &&
      state.value?.phase === 'playing' &&
      game.value?.turnId === state.value.me &&
      room.connected &&
      !room.busy &&
      !actions.pending &&
      !actions.canRetry,
  );
  watch(
    () => `${room.scope}:${state.value?.roundId}:${game.value?.revision}`,
    (value) => actions.setTarget(value),
    { immediate: true },
  );
  function act(action: 'acquire' | 'buyStock' | 'dividend', data: Record<string, unknown> = {}) {
    if (!canAct.value || !game.value) return Promise.resolve(false);
    return actions.command(action, { ...data, expectedRevision: game.value.revision });
  }
  return { state, game, setup, me, canAct, act, start: () => room.command('start', {}) };
});
