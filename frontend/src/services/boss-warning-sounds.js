import GameSounds from '../engines/game-sounds.js';

// One owner for this warning overlay; stopping it never interrupts another game's cues.
export function createBossWarningSounds() {
  const sounds = GameSounds.create();
  const seen = new Set();
  let activeId = null;
  const context = { code: 'boss-arrival-warning', version: 0 };
  sounds.update(context);
  return {
    update(arrivals, now, connected) {
      const live = sounds.update(context, { connected });
      const pending = connected ? arrivals.filter((a) => now < a.spawnAt) : [];
      if (!pending.some((a) => a.id === activeId)) {
        sounds.stop();
        activeId = null;
      }
      const fresh = pending.filter((a) => !seen.has(a.id));
      for (const arrival of fresh) seen.add(arrival.id);
      while (seen.size > 256) seen.delete(seen.values().next().value);
      if (!fresh.length) return;
      sounds.stop();
      activeId = fresh[0].id;
      sounds.play('boss-warning', activeId, { live });
    },
    destroy() {
      sounds.destroy();
      seen.clear();
    },
  };
}
