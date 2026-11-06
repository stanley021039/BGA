import GameSounds from '../engines/game-sounds.js';
import { onScopeDispose, watch } from 'vue';
import type { MinimalSnapshot } from '../contracts/minimal';
import type { TelephoneSnapshot } from '../contracts/telephone';
import type { useRoomStore } from '../stores/room';

type Snapshot = MinimalSnapshot | TelephoneSnapshot;

export function drawingPartyCue(value: Snapshot, previous: Snapshot) {
  if (value.type === 'minimal' && previous.type === 'minimal') {
    const round = value.roundId;
    if (!round || value.interrupted) return;
    if (value.phase === 'drawing' && round !== previous.roundId && value.me !== value.guesserId)
      return { cue: 'turn', key: `minimal:draw:${round}` };
    if (round !== previous.roundId) return;
    if (value.phase === 'guessing' && previous.phase === 'drawing' && value.me === value.guesserId)
      return { cue: 'turn', key: `minimal:guess:${round}` };
    if (['reveal', 'finished'].includes(value.phase) && value.phase !== previous.phase) {
      const attempt = value.attempts.at(-1);
      const correct =
        value.attempts.length > previous.attempts.length &&
        attempt?.correct &&
        (value.me === value.guesserId || value.me === attempt.artistId);
      return { cue: correct ? 'correct' : 'reveal', key: `minimal:result:${round}` };
    }
    if (previous.phase === 'drawing' && value.submitted && !previous.submitted)
      return { cue: 'confirm', key: `minimal:submit:${round}` };
  }
  if (value.type === 'telephone' && previous.type === 'telephone') {
    const step = value.stepId;
    if (!step) return;
    if (value.task && !value.task.submitted && step !== previous.stepId)
      return { cue: 'turn', key: `telephone:task:${step}` };
    if (value.phase === 'finished' && previous.phase !== 'finished' && !value.interrupted)
      return { cue: 'reveal', key: `telephone:finish:${step}` };
    if (value.review && previous.review && value.review.index > previous.review.index)
      return { cue: 'reveal', key: `telephone:page:${step}:${value.review.index}` };
    if (
      step === previous.stepId &&
      value.task?.submitted &&
      previous.task &&
      !previous.task.submitted
    )
      return { cue: 'confirm', key: `telephone:submit:${step}` };
  }
}

export function useDrawingPartySounds(room: ReturnType<typeof useRoomStore>) {
  const sounds = GameSounds?.create({ maxGapMs: 15000 });
  watch([() => room.connected, () => room.scope], () => sounds?.disconnect(), { flush: 'sync' });
  // Unchanged safety polls confirm the connection without replacing the snapshot.
  watch(
    () => room.lastReceivedAt,
    () => {
      const current = room.snapshot;
      if (current && room.connected) sounds?.update(current, { connected: true });
    },
    { flush: 'sync' },
  );
  watch(
    () => room.snapshot,
    (snapshot, prior) => {
      if (!snapshot || !prior || !room.connected) {
        sounds?.disconnect();
        if (snapshot && room.connected) sounds?.update(snapshot, { connected: true });
        return;
      }
      const live = sounds?.update(snapshot, { connected: true });
      if (!live || !snapshot.players.some((player) => player.id === snapshot.me && !player.kicked))
        return;
      const event = drawingPartyCue(snapshot as Snapshot, prior as Snapshot);
      if (event) sounds?.play(event.cue, event.key, { live });
    },
    { immediate: true, flush: 'sync' },
  );
  onScopeDispose(() => sounds?.destroy());
}
