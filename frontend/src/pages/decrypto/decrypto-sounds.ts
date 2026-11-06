import { onScopeDispose, watch, type ComputedRef } from 'vue';
import type { DecryptoSnapshot } from '../../contracts/decrypto';
import type { GameSoundOwner } from '../../contracts/sounds';
import GameSounds from '../../engines/game-sounds.js';
import type { useRoomStore } from '../../stores/room';

export function useDecryptoSounds(
  room: Pick<ReturnType<typeof useRoomStore>, 'connected' | 'scope' | 'lastReceivedAt'>,
  state: ComputedRef<DecryptoSnapshot | null>,
) {
  const sounds: GameSoundOwner | undefined = GameSounds?.create({ maxGapMs: 15000 });
  watch(
    [state, () => room.connected, () => room.scope, () => room.lastReceivedAt],
    ([next, connected, scope, received], [previous, , previousScope, previousReceived]) => {
      if (!next || !connected || next.interrupted || scope !== previousScope) sounds?.disconnect();
      if (
        !next ||
        !connected ||
        next.interrupted ||
        (next === previous && received === previousReceived)
      )
        return;
      const live = sounds?.update(next, { connected }) === true;
      if (
        !live ||
        !previous ||
        next === previous ||
        next.me !== previous.me ||
        next.roundId !== previous.roundId ||
        (next.version ?? 0) <= (previous.version ?? 0)
      )
        return;

      const team = next.myTeam;
      let cue: string;
      if (next.phase === 'finished' && previous.phase !== 'finished' && next.winner) {
        cue = 'quacks-settlement';
      } else if (next.phase === 'reveal' && next.results.length === previous.results.length + 1) {
        const result = next.results.at(-1)!;
        const succeeded = result.team === team ? result.decoded : result.intercepted;
        cue = succeeded ? 'quacks-ruby' : 'settlement';
      } else if (
        next.turn === previous.turn &&
        ((next.encryptors[team] === next.me && next.clueReady[team] && !previous.clueReady[team]) ||
          (next.decoders[team] === next.me &&
            ((next.phase === 'guessing' && next.myGuess && !previous.myGuess) ||
              (next.phase === 'tiebreak' && next.tieReady[team] && !previous.tieReady[team]))))
      ) {
        cue = 'quacks-buy';
      } else return;

      sounds?.stop();
      sounds?.play(cue, `decrypto:${next.roundId}:${next.turn}:${next.version}`, { live });
    },
    { immediate: true, flush: 'sync' },
  );
  onScopeDispose(() => sounds?.destroy());
}
