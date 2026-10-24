import AudioSettings from './audio-settings.js';
let GameResultSounds;
(function (root) {
  'use strict';
  function outcomes(previous, next) {
    if (
      !previous ||
      previous.code !== next.code ||
      previous.me !== next.me ||
      next.version < previous.version
    )
      return [];
    if (next.type === 'musicquiz') {
      const result = [];
      const personal = next.myAnswer;
      const hasFeedback = personal?.choiceId && typeof personal.titleCorrect === 'boolean';
      if (
        !['reveal', 'finished'].includes(next.phase) &&
        previous.round === next.round &&
        hasFeedback &&
        typeof previous.myAnswer?.titleCorrect !== 'boolean'
      )
        result.push(personal.titleCorrect ? 'correct' : 'incorrect');
      if (next.results.length !== previous.results.length + 1) return result;
      const r = next.results.at(-1);
      if (r.round !== next.round) return [];
      if (r.djId === next.me) result.push(r.djCorrect ? 'correct' : 'incorrect');
      else if (Object.hasOwn(r.challenges || {}, next.me))
        result.push(r.receiverId === next.me ? 'correct' : 'incorrect');
      return result;
    }
    if (
      next.type === 'majority' &&
      previous.round === next.round &&
      ['answering', 'review'].includes(previous.phase) &&
      next.phase === 'reveal'
    ) {
      const r = next.result;
      if (!r || r.missingIds?.includes(next.me) || !Object.hasOwn(next.answers || {}, next.me))
        return [];
      // Team, solo and minority-scoring rules are preference games, not majority correctness.
      if (
        next.cruel &&
        (next.cruel.solo || next.cruel.rules === 'teams' || next.cruel.scoring === 'minority')
      )
        return [];
      const gains = r.gains || {};
      if (!Object.values(gains).some((n) => n > 0)) return [];
      return [gains[next.me] > 0 ? 'correct' : 'incorrect'];
    }
    return [];
  }
  function create({ audio = AudioSettings } = {}) {
    let previous = null,
      epoch = 0,
      lastEpoch = 0,
      timers = [],
      releaseMusic = null,
      activeClip = null,
      sequence = 0;
    const clear = () => {
      sequence++;
      for (const id of timers) clearTimeout(id);
      timers = [];
      if (activeClip) audio?.stopEffect?.(activeClip);
      activeClip = null;
      releaseMusic?.();
      releaseMusic = null;
    };
    const hidden = () => {
      epoch++;
      if (document.hidden) clear();
    };
    document.addEventListener('visibilitychange', hidden);
    const update = (next) => {
      const before = previous,
        live = before && epoch === lastEpoch && !document.hidden;
      previous = next;
      lastEpoch = epoch;
      if (
        before &&
        (before.round !== next.round || before.code !== next.code || before.me !== next.me)
      )
        clear();
      const cues = live ? outcomes(before, next) : [],
        settings = audio?.get?.();
      const audible = !settings || (settings.effects?.enabled && settings.effects.volume > 0);
      if (cues.length && audible) {
        clear();
        releaseMusic = audio?.suspendMusic?.();
        const token = sequence;
        const playNext = (index) => {
          if (token !== sequence || document.hidden) return;
          if (index === cues.length) {
            activeClip = null;
            releaseMusic?.();
            releaseMusic = null;
            return;
          }
          let stopped = false;
          const onStop = () => {
            if (stopped) return;
            stopped = true;
            if (token === sequence) timers.push(setTimeout(() => playNext(index + 1), 80));
          };
          activeClip = audio?.playEffect(cues[index], { onStop });
          if (!activeClip) onStop();
        };
        playNext(0);
      }
    };
    const leave = () => {
      epoch++;
      clear();
    };
    root.addEventListener?.('pagehide', leave);
    const dispose = () => {
      clear();
      root.removeEventListener?.('pagehide', leave);
      previous = null;
      document.removeEventListener('visibilitychange', hidden);
    };
    return { update, dispose };
  }
  const api = { outcomes, create };

  GameResultSounds = api;
})(typeof window === 'object' ? window : globalThis);

export default GameResultSounds;
