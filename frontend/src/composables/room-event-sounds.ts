import GameSounds from '../engines/game-sounds.js';
import { onScopeDispose, watch, type ComputedRef } from 'vue';
import type { BluffSnapshot } from '../contracts/bluff';
import type { GiftSnapshot } from '../contracts/gift';
import type { MajoritySnapshot } from '../contracts/majority';
import type { PokerSnapshot } from '../contracts/poker';
import type { RoomSnapshot } from '../contracts/room';
import type { TrpgSnapshot } from '../contracts/trpg';
import type { useRoomStore } from '../stores/room';

type Cue = { cue: string; key: string };

export function pokerCues(value: PokerSnapshot, previous: PokerSnapshot): Cue | undefined {
  const key = 'poker:' + value.hand;
  if (value.phase === 'showdown' && (previous.phase !== 'showdown' || value.hand !== previous.hand))
    return { cue: 'reveal', key: key + ':showdown' };

  const actor = value.players[value.turn];
  if (
    value.phase !== 'waiting' &&
    value.phase !== 'showdown' &&
    actor?.id === value.me &&
    !actor.folded &&
    actor.stack > 0 &&
    value.deadline !== null &&
    value.deadline > value.serverNow &&
    (previous.hand !== value.hand ||
      previous.phase !== value.phase ||
      previous.players[previous.turn]?.id !== value.me ||
      previous.deadline !== value.deadline)
  )
    return { cue: 'turn', key: key + ':turn:' + value.phase + ':' + value.deadline };

  if (value.hand === previous.hand && value.board.length > previous.board.length)
    return { cue: 'card-draw', key: key + ':board:' + value.board.length };
}

export function trpgCues(value: TrpgSnapshot, previous: TrpgSnapshot): Cue | undefined {
  const result = value.results.at(-1);
  if (
    !result ||
    previous.phase !== 'planning' ||
    previous.sceneId !== result.sceneId ||
    value.results.length !== previous.results.length + 1 ||
    !['reveal', 'finished'].includes(value.phase)
  )
    return;
  return { cue: 'settlement', key: 'trpg:result:' + result.sceneId };
}

export function bluffCues(value: BluffSnapshot, previous: BluffSnapshot): Cue | undefined {
  const result = value.results.at(-1);
  if (
    result &&
    !value.interrupted &&
    value.roundId === previous.roundId &&
    previous.phase === 'discussion' &&
    ['reveal', 'finished'].includes(value.phase) &&
    result.resultId !== previous.results.at(-1)?.resultId
  )
    return { cue: 'reveal', key: 'bluff:reveal:' + result.resultId };

  const voted = value.results.find(
    (entry) =>
      entry.ban?.voted &&
      previous.results.some((old) => old.resultId === entry.resultId && old.ban && !old.ban.voted),
  );
  if (voted) return { cue: 'confirm', key: 'bluff:vote:' + voted.resultId };
}

export function majorityCues(value: MajoritySnapshot, previous: MajoritySnapshot): Cue | undefined {
  if (previous.phase !== 'answering' || value.phase !== 'review' || value.round !== previous.round)
    return;
  return { cue: 'card-draw', key: 'majority:review:' + value.round + ':' + value.version };
}

export function giftDeliveryCue(value: GiftSnapshot, previous: GiftSnapshot): Cue | undefined {
  const delivery = value.delivery;
  if (!delivery || (previous.round === value.round && previous.delivery?.index === delivery.index))
    return;
  return {
    cue: delivery.recipientId === value.me ? 'turn' : 'card-draw',
    key: `gift-delivery:${value.version}:${delivery.index}`,
  };
}

export function useRoomEventSounds<T extends RoomSnapshot>(
  room: ReturnType<typeof useRoomStore>,
  state: ComputedRef<T | null>,
  select: (value: T, previous: T) => Cue | undefined,
) {
  const sounds = GameSounds?.create({ maxGapMs: 15000 });
  watch([() => room.connected, () => room.scope], () => sounds?.disconnect(), { flush: 'sync' });
  // Unchanged safety polls confirm the connection without replacing the snapshot.
  watch(
    () => room.lastReceivedAt,
    () => {
      const current = state.value;
      if (current && room.connected) sounds?.update(current, { connected: true });
    },
    { flush: 'sync' },
  );
  watch(
    state,
    (value, previous) => {
      if (!value || !room.connected) {
        sounds?.disconnect();
        return;
      }
      if (!sounds || !sounds.update(value, { connected: true }) || !previous) return;
      const event = select(value, previous);
      if (event) sounds.play(event.cue, event.key, { live: true });
    },
    { immediate: true, flush: 'sync' },
  );
  onScopeDispose(() => sounds?.destroy());
}
