'use strict';

const { randomBytes, createHash, createHmac } = require('node:crypto');
const { racerSet } = require('./catalog');
const { fail } = require('../party-base');
const clone = (value) => structuredClone(value);

function random(state, size) {
  const value = createHmac('sha256', state.randomKey)
    .update(String(state.randomIndex++))
    .digest()
    .readUInt32BE();
  // Rejection sampling prevents bias from modulo reduction.
  const ceiling = Math.floor(0x100000000 / size) * size;
  return value >= ceiling ? random(state, size) : value % size;
}
function shuffled(state, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(state, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function clockwise(players, first) {
  const at = players.indexOf(first);
  return [...players.slice(at), ...players.slice(0, at)];
}
function event(state, type, details = {}) {
  state.events.push({ id: state.events.length ? state.events.at(-1).id + 1 : 1, type, ...details });
  state.events = state.events.slice(-80);
}
// A tied value cannot win a roll-off. Try the next lower distinct value.
// If no unique value exists everyone rolls again; the policy is recorded in #227.
function rolloffWinner(players, rolls) {
  for (let value = 6; value >= 1; value--) {
    const matches = players.filter((id) => rolls[id] === value);
    if (matches.length === 1) return matches[0];
  }
  return null;
}
function beginDraft(state) {
  const firstIndex =
    (state.players.indexOf(state.draftFirst) + state.draftRound - 1) % state.players.length;
  const order = clockwise(state.players, state.players[firstIndex]);
  state.draftOrder = [...order, ...order.toReversed()];
  state.draftIndex = 0;
  state.market = state.deck.splice(0, state.players.length * 2);
  state.phase = 'drafting';
  event(state, 'draft-opened', {
    round: state.draftRound,
    firstId: order[0],
    market: [...state.market],
  });
}

/** Recruiting + secret race selection only. It does not silently run racers without powers. */
class SecondWindDraft {
  #state;

  constructor({ playerIds, seed = null, racerSet: set = 'second-wind' }) {
    this.catalog = racerSet(set);
    if (
      !Array.isArray(playerIds) ||
      playerIds.length < 3 ||
      playerIds.length > 6 ||
      playerIds.some(
        (id) => typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id),
      ) ||
      new Set(playerIds).size !== playerIds.length
    )
      fail('INVALID_PLAYERS', 'Second Wind 首版需要 3–6 位不同玩家', 400);
    if (seed !== null && (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff))
      fail('INVALID_SEED', '測試種子必須為 32 位元非負整數', 400);
    const state = {
      revision: 0,
      phase: 'draft-rolloff',
      players: [...playerIds],
      randomKey:
        seed === null
          ? randomBytes(32).toString('hex')
          : createHash('sha256').update(`SecondWindTestSeed:${seed}`).digest('hex'),
      randomIndex: 0,
      deck: [],
      market: [],
      draftFirst: null,
      draftRound: 1,
      draftOrder: [],
      draftIndex: 0,
      teams: Object.fromEntries(playerIds.map((id) => [id, []])),
      rolls: {},
      rolloffAttempt: 1,
      raceFirst: null,
      selections: {},
      lineup: null,
      events: [],
    };
    state.deck = shuffled(
      state,
      this.catalog.map((racer) => racer.id),
    );
    this.#state = state;
  }

  act(playerId, action, expectedRevision) {
    const current = this.#state;
    if (!current.players.includes(playerId)) fail('NOT_SEATED', '尚未入座', 403);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== current.revision)
      fail('STALE_REVISION', '狀態已更新，請重讀後操作');
    if (!action || typeof action !== 'object' || Array.isArray(action))
      fail('INVALID_ACTION', '操作格式不正確', 400);
    const state = clone(current);
    if (action.type === 'roll') {
      if (!['draft-rolloff', 'race-rolloff'].includes(state.phase))
        fail('INVALID_PHASE', '目前不是決定先手的擲骰階段');
      if (Object.hasOwn(state.rolls, playerId)) fail('ALREADY_ROLLED', '你已擲骰，等待其他玩家');
      const value = random(state, 6) + 1;
      state.rolls[playerId] = value;
      event(state, 'rolloff-die', { playerId, value, attempt: state.rolloffAttempt });
      if (Object.keys(state.rolls).length === state.players.length) {
        const first = rolloffWinner(state.players, state.rolls);
        if (!first) {
          event(state, 'rolloff-repeat', { rolls: { ...state.rolls } });
          state.rolls = {};
          state.rolloffAttempt++;
        } else if (state.phase === 'draft-rolloff') {
          state.draftFirst = first;
          beginDraft(state);
        } else {
          state.raceFirst = first;
          state.phase = 'choosing';
          event(state, 'race-first', { playerId: first });
        }
      }
    } else if (action.type === 'draft') {
      if (state.phase !== 'drafting') fail('INVALID_PHASE', '目前不能選秀');
      if (state.draftOrder[state.draftIndex] !== playerId) fail('NOT_YOUR_TURN', '尚未輪到你選秀');
      const at = state.market.indexOf(action.racerId);
      if (at < 0) fail('RACER_UNAVAILABLE', '這名角色不在目前候選列', 400);
      const [racerId] = state.market.splice(at, 1);
      state.teams[playerId].push(racerId);
      event(state, 'draft-picked', { playerId, racerId, round: state.draftRound });
      state.draftIndex++;
      if (state.draftIndex === state.draftOrder.length) {
        if (state.draftRound === 1) {
          state.draftRound = 2;
          beginDraft(state);
        } else {
          state.phase = 'race-rolloff';
          state.rolls = {};
          state.rolloffAttempt = 1;
          event(state, 'recruiting-complete');
        }
      }
    } else if (action.type === 'select') {
      if (state.phase !== 'choosing') fail('INVALID_PHASE', '目前不能秘密選角');
      if (Object.hasOwn(state.selections, playerId)) fail('SELECTION_LOCKED', '選擇已鎖定');
      if (!state.teams[playerId].includes(action.racerId))
        fail('RACER_NOT_OWNED', '只能選擇自己隊伍的角色', 400);
      state.selections[playerId] = action.racerId;
      // Never put the secret choice in a public event before all players lock.
      event(state, 'selection-locked', { playerId });
      if (Object.keys(state.selections).length === state.players.length) {
        state.lineup = clockwise(state.players, state.raceFirst).map((id) => ({
          playerId: id,
          racerId: state.selections[id],
        }));
        state.phase = 'race-ready';
        event(state, 'lineup-revealed', { lineup: clone(state.lineup) });
      }
    } else fail('INVALID_ACTION', '不支援此操作', 400);
    state.revision++;
    this.#state = state;
    return this.view(playerId);
  }

  view(playerId) {
    const state = this.#state;
    if (!state.players.includes(playerId)) fail('NOT_SEATED', '尚未入座', 403);
    return clone({
      type: 'second-wind',
      stage: 'recruiting-core',
      revision: state.revision,
      phase: state.phase,
      players: state.players,
      teams: state.teams,
      draftRound: state.draftRound,
      draftFirst: state.draftFirst,
      draftOrder: state.phase === 'drafting' ? state.draftOrder : [],
      turnId: state.phase === 'drafting' ? state.draftOrder[state.draftIndex] : null,
      market: state.market,
      rolls: state.rolls,
      rolloffAttempt: state.rolloffAttempt,
      raceFirst: state.raceFirst,
      selectedIds: Object.keys(state.selections),
      ownSelection: state.selections[playerId] || null,
      lineup: state.lineup,
      remainingRacers: state.deck.length,
      events: state.events,
      notice: '僅完成招募與秘密選角核心；完整能力競速尚未接入。',
    });
  }
}

module.exports = { SecondWindDraft, rolloffWinner };
