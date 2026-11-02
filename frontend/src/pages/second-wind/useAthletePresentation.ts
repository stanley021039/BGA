import { nextTick, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue';
import { useRoomStore } from '../../stores/room';
import type { AthleteGame } from '../../contracts/second-wind';
import { createAthleteMotion, type AthleteDice, type AthletePath } from './athlete-motion';

export function useAthletePresentation(root: Ref<HTMLElement | null>, game: Ref<AthleteGame>) {
  const room = useRoomStore(),
    dice = shallowRef<AthleteDice[]>([]),
    tokens = ref<AthletePath[]>([]);
  const owner = createAthleteMotion(
    (id) => {
      tokens.value = tokens.value.filter((t) => t.id !== id);
    },
    () => {
      tokens.value = [];
    },
  );
  watch(
    () => [
      game.value,
      game.value.revision,
      game.value.events.at(-1)?.id,
      room.connected,
      room.connecting,
      room.scope,
      game.value.race,
      game.value.stage,
    ],
    async () => {
      const g = game.value,
        scope = `${room.scope}:${room.code}:${room.snapshot?.roundId}:${g.stage || 'race'}:${g.race || 0}`;
      const result = owner.observe(
        scope,
        g,
        room.connected && !room.connecting,
        room.snapshot?.serverNow,
      );
      dice.value = result.dice;
      if (!result.cue) {
        if (!owner.active()) tokens.value = [];
        return;
      }
      tokens.value = result.cue.paths;
      await nextTick();
      owner.play(root.value, result.cue);
    },
    { immediate: true, flush: 'post' },
  );
  onScopeDispose(() => {
    owner.dispose();
    tokens.value = [];
  });
  return { dice, tokens };
}
