'use strict';

const { fail } = require('../party-base');
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
function validateRacers(racers, finish) {
  if (
    !integer(finish, 1, 1000) ||
    !Array.isArray(racers) ||
    racers.some(
      (racer) =>
        !racer || typeof racer.id !== 'string' || !racer.id || !integer(racer.position, 0, finish),
    ) ||
    new Set(racers.map((racer) => racer.id)).size !== racers.length
  )
    fail('INVALID_MOTION_STATE', '賽道狀態不正確', 400);
}
/** One geometric operation, BEFORE track/power effects. Callers must resolve powers explicitly. */
function motion(racers, racerId, value, { kind = 'move', finish = 30, simultaneous = false } = {}) {
  validateRacers(racers, finish);
  const racer = racers.find((racer) => racer.id === racerId);
  if (!racer || racer.finished || racer.eliminated) fail('RACER_INACTIVE', '角色目前不在賽道上');
  if (
    !['move', 'warp'].includes(kind) ||
    typeof simultaneous !== 'boolean' ||
    !integer(value, kind === 'warp' ? 0 : -1000, kind === 'warp' ? finish - 1 : 1000)
  )
    fail('INVALID_MOVEMENT', '移動或傳送格式不正確', 400);
  const from = racer.position,
    to = kind === 'warp' ? value : Math.max(0, Math.min(finish, from + value));
  const changed = from !== to;
  const passed =
    kind === 'move' && changed
      ? racers
          .filter(
            (other) =>
              other.id !== racerId &&
              !other.finished &&
              !other.eliminated &&
              ((from < other.position && to > other.position) ||
                (from > other.position && to < other.position)),
          )
          .map((other) => other.id)
      : [];
  const finished = to === finish;
  return {
    racerId,
    kind,
    from,
    to,
    changed,
    passed,
    finished,
    // The finish boundary is not a space; move 0 is not a movement/arrival trigger.
    arrival: changed && !finished ? { space: to, sharedTriggers: !simultaneous } : null,
    racers: racers.map((other) =>
      other.id === racerId
        ? { ...other, position: to, ...(finished ? { finished: true } : {}) }
        : { ...other },
    ),
  };
}

/** Swap/collect effects must move the whole batch before any landing power inspects it. */
function simultaneousWarp(racers, destinations, finish = 30) {
  validateRacers(racers, finish);
  if (!destinations || typeof destinations !== 'object' || Array.isArray(destinations))
    fail('INVALID_MOVEMENT', '傳送格式不正確', 400);
  const operations = Object.entries(destinations).map(([id, to]) =>
    motion(racers, id, to, { kind: 'warp', finish, simultaneous: true }),
  );
  return {
    operations,
    racers: racers.map((racer) => {
      const operation = operations.find((operation) => operation.racerId === racer.id);
      return { ...racer, ...(operation ? { position: operation.to } : {}) };
    }),
  };
}

// One resolution chain remembers the effects already completed. This is not a turn-wide limit.
class ResolutionChain {
  #seen = new Set();
  #count = 0;
  constructor(limit = 256) {
    if (!integer(limit, 1, 4096)) fail('INVALID_RESOLUTION_LIMIT', '結算上限不正確', 400);
    this.limit = limit;
  }
  enter(effectKey) {
    if (typeof effectKey !== 'string' || !effectKey || effectKey.length > 512)
      fail('INVALID_EFFECT_KEY', '觸發識別不正確', 400);
    if (this.#seen.has(effectKey)) return { run: false, reason: 'loop-completed-once' };
    if (this.#count === this.limit)
      return { run: false, reason: 'resolution-budget', needsRuling: true };
    this.#seen.add(effectKey);
    this.#count++;
    return { run: true };
  }
}

function triggerOrder(seatIds, currentId) {
  if (
    !Array.isArray(seatIds) ||
    !seatIds.length ||
    !seatIds.includes(currentId) ||
    new Set(seatIds).size !== seatIds.length
  )
    fail('INVALID_TRIGGER_ORDER', '觸發順序不正確', 400);
  const at = seatIds.indexOf(currentId);
  return ['track', ...seatIds.slice(at), ...seatIds.slice(0, at)];
}
function mainMovePlan(racer, { penguin = false } = {}) {
  if (!racer || racer.finished || racer.eliminated) fail('RACER_INACTIVE', '角色目前不在賽道上');
  return {
    roll: !racer.tripped || penguin,
    multiplier: racer.tripped && penguin ? 2 : 1,
    recoverAfterMainMove: racer.tripped === true,
  };
}
module.exports = { motion, simultaneousWarp, ResolutionChain, triggerOrder, mainMovePlan };
