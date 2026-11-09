import AudioSettings from '../engines/audio-settings.js';
import { computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoomStore } from './room';
import { usePartyActionsStore } from './party-actions';
import type { AthleteSnapshot } from '../contracts/second-wind';
export const useAthleteStore = defineStore('second-wind', () => {
  const room = useRoomStore(),
    actions = usePartyActionsStore();
  const state = computed(() =>
    room.snapshot?.type === 'second-wind' ? (room.snapshot as AthleteSnapshot) : null,
  );
  const game = computed(() => state.value?.game || null);
  const setup = computed(
    () => !!state.value && ['waiting', 'finished'].includes(state.value.phase),
  );
  const ready = computed(
    () => room.connected && !room.busy && !actions.pending && !actions.canRetry,
  );
  watch(
    () => `${room.scope}:${state.value?.roundId}:${game.value?.revision}`,
    (value) => actions.setTarget(value),
    { immediate: true },
  );
  watch(state, (next, previous) => {
    if (
      !next?.game ||
      !previous?.game ||
      !next.roundId ||
      next.roundId !== previous.roundId ||
      next.code !== previous.code ||
      next.interrupted
    )
      return;
    const events = next.game.events;
    const priorEvents = previous.game.events;
    const beganRace = !previous.game.racers && !!next.game.racers;
    const lastId = beganRace ? 0 : priorEvents.at(-1)?.id || 0;
    const fresh = events.filter((event) => event.id > lastId);
    if (
      (beganRace && previous.game.phase === 'race-rolloff') ||
      fresh.some((event) => ['die', 'reroll', 'rolloff-die'].includes(event.type))
    )
      AudioSettings?.playEffect?.('dice-roll');
    if (fresh.some((event) => ['power', 'reroll'].includes(event.type)))
      AudioSettings?.playEffect?.('quacks-ruby');
  });
  function act(type: string, data: Record<string, unknown> = {}) {
    if (!ready.value || !game.value) return Promise.resolve(false);
    return actions.command(type, { ...data, expectedRevision: game.value.revision });
  }
  return { state, game, setup, ready, act, start: () => room.command('start', {}) };
});
