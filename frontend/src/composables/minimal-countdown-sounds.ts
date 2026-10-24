import GameSounds from '../engines/game-sounds.js';
import { onScopeDispose, watch, type ComputedRef, type Ref } from 'vue';
import type { MinimalSnapshot } from '../contracts/minimal';
import type { GameSoundOwner } from '../contracts/sounds';
import type { useRoomStore } from '../stores/room';

// Observe the editor's existing clock; this owner never submits or changes deadlines.
export function useMinimalCountdownSounds(
  room: ReturnType<typeof useRoomStore>,
  state: ComputedRef<MinimalSnapshot | null>,
  now: Ref<number>,
) {
  const sounds: GameSoundOwner | undefined = GameSounds?.create();
  let previous: { context: string; deadline: number | null; seconds: number; at: number } | null =
    null;
  let snapshot: MinimalSnapshot | null = null;
  let awaitingSnapshot = false;
  let live = false;
  let suspendedSnapshot: MinimalSnapshot | null = null;
  function reset() {
    previous = null;
    live = false;
    snapshot = null;
    sounds?.disconnect();
  }
  function suspend() {
    awaitingSnapshot = true;
    suspendedSnapshot = state.value;
    reset();
  }
  function visibility() {
    // Both transitions fence the old sample. A fresh response must establish a baseline.
    suspend();
  }
  watch(
    [state, () => room.connected, () => room.scope, now],
    () => {
      const value = state.value;
      const at = Date.now();
      if (
        !value ||
        !room.connected ||
        document.hidden ||
        value.interrupted ||
        value.phase !== 'drawing' ||
        at < room.lastReceivedAt ||
        at - room.lastReceivedAt > 2500
      ) {
        reset();
        return;
      }
      if (awaitingSnapshot) {
        // pagehide/visibility can happen without a room connection transition.
        if (value === suspendedSnapshot) return;
        awaitingSnapshot = false;
      }
      const incoming = value !== snapshot;
      if (!incoming && !live) return;
      if (incoming) {
        snapshot = value;
        live = sounds?.update(value, { connected: true }) === true;
        if (!live) previous = null;
      }
      const context = `${room.scope}:${value.code}:${value.me}:${value.roundId}`;
      const seconds = value.deadline
        ? Math.ceil((value.deadline - (at - room.clockOffset)) / 1000)
        : 0;
      const lastArtist =
        value.me !== value.guesserId &&
        !value.submitted &&
        value.players.filter((p) => p.id !== value.guesserId && !value.readyIds.includes(p.id))
          .length === 1;
      const start =
        previous !== null &&
        previous.context === context &&
        previous.deadline === null &&
        value.deadline !== null &&
        seconds > 0 &&
        seconds <= 10;
      const step =
        previous !== null &&
        previous.context === context &&
        previous.deadline === value.deadline &&
        previous.seconds === seconds + 1 &&
        at >= previous.at &&
        at - previous.at <= 1500 &&
        seconds >= 1 &&
        seconds <= 5;
      if (live && lastArtist && (start || step)) {
        sounds?.play('countdown-warning', `minimal:${context}:${value.deadline}:${seconds}`, {
          live: true,
        });
      }
      if (!lastArtist || seconds <= 0) sounds?.stop();
      previous = { context, deadline: value.deadline, seconds, at };
    },
    { immediate: true, flush: 'sync' },
  );
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', suspend);
  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', suspend);
    window.removeEventListener('pageshow', suspend);
    sounds?.destroy();
  });
}
