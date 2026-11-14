const { HttpError } = require('../http/errors');
const { fitsSlot } = require('./scene-energy');
const attacks = new Set(require('../../public/shared/attack-effects.json').map((e) => e.id));
const palette = require('../../public/shared/entrance-palette.json');
const { driveBoss } = require('./scene-bosses');
const entrances = new Set(
  [
    ...palette.starters,
    ...palette.variants,
    ...require('../../public/shared/entrance-requirements.json'),
  ].map((e) => e.id),
);

function botSettings(input, characters) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (k) =>
        !['action', 'id', 'characterId', 'entrance', 'q', 'e', 'r', 'mode', 'team'].includes(k),
    )
  )
    throw new HttpError(400, 'INVALID_SCENE_BOT', '機器人設定不正確');
  const characterId = input.characterId ?? characters[0]?.id;
  const entrance = input.entrance ?? 'classic';
  const mode = input.mode ?? 'idle';
  const team = input.team ?? 'blue';
  const loadout = {
    q: input.q ?? 'barrage',
    e: input.e ?? 'beam',
    r: input.r ?? 'guanyin_barrage',
  };
  if (
    !characters.some((c) => c.id === characterId) ||
    !entrances.has(entrance) ||
    !['idle', 'attack'].includes(mode) ||
    !['red', 'blue'].includes(team) ||
    Object.entries(loadout).some(([slot, id]) => !attacks.has(id) || !fitsSlot(slot, id))
  )
    throw new HttpError(400, 'INVALID_SCENE_BOT', '請選擇有效角色、招式與行為');
  return { characterId, entrance, mode, team, ...loadout };
}

// Uses the existing scene projection clock; no extra timers or per-bot loops.
function createBotDriver(random = Math.random) {
  const states = new Map();
  let driving = false,
    lastTick = -Infinity;
  function drive({
    time,
    bots,
    positions,
    events,
    cast,
    castBoss = () => {},
    canTarget = () => true,
  }) {
    if (driving || time - lastTick < 400) return;
    lastTick = time;
    driving = true;
    const ids = new Set(bots.map((b) => b.id));
    for (const id of states.keys()) if (!ids.has(id)) states.delete(id);
    let casts = 0;
    try {
      for (const bot of bots) {
        const actor = positions.get(bot.id);
        if (!actor?.health) continue;
        let state = states.get(bot.id);
        if (!state) states.set(bot.id, (state = { moveAt: time + 400, attackAt: time + 1200 }));
        const candidates = [...positions.values()].filter(
          (p) => p.id !== actor.id && p.health > 0 && canTarget(actor, p),
        );
        const target = candidates.sort(
          (a, b) =>
            Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y),
        )[0];
        if (bot.bossId) {
          if (casts >= 1) continue;
          const effect = driveBoss(bot, actor, target, time, state);
          if (effect) {
            try {
              castBoss(bot, effect, target, time);
              casts++;
            } catch (error) {
              if (!(error instanceof HttpError)) throw error;
            }
          }
          continue;
        }
        const attacking = bot.mode === 'attack';
        if (time >= state.moveAt) {
          const chase = attacking && target;
          actor.targetX = Math.max(
            6,
            Math.min(
              94,
              chase ? target.x + (actor.x < target.x ? -7 : 7) : actor.x + (random() - 0.5) * 8,
            ),
          );
          actor.targetY = Math.max(
            15,
            Math.min(95, chase ? target.y + (random() - 0.5) * 5 : actor.y + (random() - 0.5) * 5),
          );
          actor.facing = actor.targetX < actor.x ? 'left' : 'right';
          actor.moveId++;
          state.moveAt = time + 2200 + random() * 1800;
        }
        if (!attacking || !target || time < state.attackAt || casts >= 1) continue;
        state.attackAt = time + 3200 + random() * 1600;
        const slot =
          actor.energy >= (actor.energyMaximum || 150) && bot.r ? 'r' : random() < 0.5 ? 'q' : 'e';
        try {
          cast(bot, slot);
          casts++;
        } catch (error) {
          if (!(error instanceof HttpError)) throw error;
        }
      }
    } finally {
      driving = false;
    }
  }
  return {
    drive,
    clear: () => {
      states.clear();
      lastTick = -Infinity;
    },
  };
}
module.exports = { botSettings, createBotDriver };
