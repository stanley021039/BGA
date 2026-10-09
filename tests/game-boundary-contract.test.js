'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { createAuth } = require('../src/auth');
const { Room } = require('../src/games/poker');
const { ThunderRoom } = require('../src/games/thunder');
const { MajorityRoom } = require('../src/games/majority');
const { GiftRoom } = require('../src/games/gift');
const { DrawGuessRoom } = require('../src/games/draw-guess');
const { appFixture } = require('./helpers/app-fixture.cjs');

// Observe the real method, including its post-action human bookkeeping. Do not
// replace engine rules or reach into app-owned room/seat maps to prepare states.
function observeDispatch(t, Engine, method) {
  const original = Engine.prototype[method], calls = [];
  t.mock.method(Engine.prototype, method, function(id, action, input) {
    const result = original.call(this, id, action, input);
    const player = this.players.find(player => player.id === id);
    calls.push({ id, action, input, handDecision: player?.handDecision,
      humanActionThisTurn: player?.humanActionThisTurn });
    return result;
  });
  return calls;
}
function assertPrivate(view) {
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      assert.ok(!['secret', 'lastSeen', 'achievementUnits', 'achievementUnitStart', 'achievementUnitCompleted'].includes(key), key);
      visit(item);
    }
  }
  visit(view);
}
async function fixture(t, type) {
  const password = 'synthetic-contract-password';
  const { base } = await appFixture(t, {
    config: { achievementPurpose: 'test' },
    seed: db => createAuth(db).bootstrap('contract_owner', password),
  });
  async function post(route, cookie, data = {}, status = 200) {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    assert.equal(response.status, status, route + ': ' + JSON.stringify(body));
    return { body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const cookies = [(await post('auth/login', null, { username: 'contract_owner', password })).cookie];
  for (let index = 1; index < 3; index++) {
    const invite = (await post('admin/invites', cookies[0])).body.code;
    cookies.push((await post('auth/register', null, {
      username: 'contract_peer' + index, displayName: '同名玩家', password, confirmPassword: password, invite,
    })).cookie);
  }
  await post('profile/name', cookies[0], { displayName: '同名玩家' });
  const { code } = (await post('create', cookies[0], { type })).body;
  for (const cookie of cookies.slice(1)) await post('join', cookie, { code });
  async function state(index, forged = '') {
    const response = await fetch(base + '/api/state?code=' + code + forged, { headers: { Cookie: cookies[index] } });
    assert.equal(response.status, 200);
    const view = await response.json(); assertPrivate(view); return view;
  }
  const ids = await Promise.all(cookies.map(async (_, index) => (await state(index)).me));
  assert.equal(new Set(ids).size, 3);
  assert.deepEqual((await state(0)).players.map(player => player.name), Array(3).fill('同名玩家'));
  for (let index = 0; index < 2; index++) {
    // Client-supplied identity must not choose either the reconnect seat or viewer.
    await post('reconnect', cookies[index], { code, playerId: ids[1 - index], id: ids[1 - index] });
    assert.equal((await state(index, '&playerId=' + ids[1 - index])).me, ids[index]);
  }
  await post('start', cookies[0], { code });
  async function action(index, input, status = 200) {
    const forged = ids[(index + 1) % ids.length];
    const body = (await post('action', cookies[index], { code, playerId: forged, id: forged, actor: forged, ...input }, status)).body;
    if (status === 200) { assertPrivate(body); assert.equal(body.me, ids[index]); }
    return body;
  }
  return { ids, state, action };
}

const cases = [
  { type: 'poker', Engine: Room, method: 'humanAct', async check(f, calls) {
    for (let viewer = 0; viewer < 2; viewer++) {
      const state = await f.state(viewer);
      for (const player of state.players) {
        assert.equal(player.cards.length, 2);
        assert.ok(player.cards.every(card => player.id === f.ids[viewer] ? Number.isInteger(card) : card === null));
      }
    }
    const before = await f.state(0), actor = f.ids.indexOf(before.players[before.turn].id);
    await f.action((actor + 1) % 3, { action: 'raise', amount: 60 }, 400);
    const result = await f.action(actor, { action: 'raise', amount: 60 });
    assert.equal(result.currentBet, 60);
    assert.equal(result.players.find(player => player.id === f.ids[actor]).bet, 60);
    assert.equal(calls.at(-1).input, 60, 'poker receives the scalar amount');
    assert.equal(calls.at(-1).handDecision, true, 'humanAct records the real human decision');
    assert.equal(calls.at(-1).id, f.ids[actor]);
  } },
  { type: 'thunder', Engine: ThunderRoom, method: 'humanAct', async check(f, calls) {
    for (let viewer = 0; viewer < 2; viewer++) {
      const state = await f.state(viewer);
      assert.equal(state.diceCheck.kind, 'round');
      assert.equal(state.roadDie, null); assert.equal(state.turn, -1); assert.equal(state.first, -1);
      assert.ok(state.players.every(player => player.dice.length === 0));
      for (const cell of state.tiles.flatMap(tile => tile.cells.flat())) {
        if (cell.hazard && !cell.hazard.face) assert.deepEqual(cell.hazard, { face: false, kind: 'unknown' });
      }
    }
    // Wait for the real scheduler's dice reveal, without replacing clocks or rules.
    let state = await f.state(0);
    const limit = Date.now() + 10000;
    while (state.diceCheck.status === 'rolling' && Date.now() < limit) { await delay(50); state = await f.state(0); }
    assert.equal(state.diceCheck.status, 'result');
    const owner = f.ids.indexOf(state.actor);
    await f.action((owner + 1) % 3, { action: 'acceptDice', check: state.diceCheck.id }, 400);
    state = await f.action(owner, { action: 'acceptDice', check: state.diceCheck.id });
    assert.equal(calls.at(-1).humanActionThisTurn, false, 'round acceptance alone is not a qualifying human turn');
    assert.ok(state.players.every(player => player.dice.length === 4));
    const actor = f.ids.indexOf(state.actor), own = await f.state(actor), car = own.available[0];
    const result = await f.action(actor, { action: 'begin', car, die: 0 });
    assert.equal(result.active.car, car);
    assert.equal(result.players.find(player => player.id === f.ids[actor]).dice[0].used, true);
    assert.equal(calls.at(-1).input.car, car); assert.equal(calls.at(-1).input.die, 0);
    assert.equal(calls.at(-1).humanActionThisTurn, true);
    assert.equal(calls.at(-1).id, f.ids[actor]);
  } },
  { type: 'majority', Engine: MajorityRoom, method: 'act', async check(f, calls) {
    await f.action(0, { action: 'draw', type: 'blank' });
    assert.ok((await f.state(0)).candidates.length > 0);
    assert.deepEqual((await f.state(1)).candidates, []);
    await f.action(1, { action: 'ask', type: 'blank', prompt: '合成問題' }, 400);
    await f.action(0, { action: 'ask', type: 'blank', prompt: '合成問題' });
    for (let index = 0; index < 2; index++) {
      await f.action(index, { action: 'answer', answer: '私密答案' + index });
      assert.equal(calls.at(-1).id, f.ids[index]); assert.equal(calls.at(-1).input.answer, '私密答案' + index);
    }
    for (let viewer = 0; viewer < 2; viewer++) {
      const state = await f.state(viewer);
      assert.equal(state.phase, 'answering'); assert.equal(state.ownAnswer, '私密答案' + viewer);
      assert.equal(Object.hasOwn(state, 'answers'), false); assert.deepEqual(state.groups, []); assert.equal(state.result, null);
      assert.equal(JSON.stringify(state).includes('私密答案' + (1 - viewer)), false);
    }
  } },
  { type: 'gift', Engine: GiftRoom, method: 'act', async check(f, calls) {
    const gifts = (await f.state(0)).gifts.map(gift => gift.id), choices = [];
    for (let index = 0; index < 2; index++) {
      const assignments = Object.fromEntries(f.ids.filter(id => id !== f.ids[index]).map((id, offset) => [id, gifts[(index + offset) % gifts.length]]));
      const ranking = Object.fromEntries(['great', 'good', 'ok', 'noWay'].map((rank, offset) => [rank, gifts[(index + offset) % gifts.length]]));
      choices.push({ assignments, ranking });
      await f.action(index, { action: 'give', assignments });
      assert.equal(calls.at(-1).id, f.ids[index]); assert.deepEqual(calls.at(-1).input.assignments, assignments);
      await f.action(index, { action: 'wish', ranking });
      assert.equal(calls.at(-1).id, f.ids[index]); assert.deepEqual(calls.at(-1).input.ranking, ranking);
    }
    for (let viewer = 0; viewer < 2; viewer++) {
      const state = await f.state(viewer);
      assert.equal(state.phase, 'choosing'); assert.deepEqual(state.ownAssignments, choices[viewer].assignments);
      assert.deepEqual(state.ownRanking, choices[viewer].ranking); assert.equal(state.result, null); assert.equal(state.delivery, null);
      assert.equal(Object.hasOwn(state, 'assignments'), false); assert.equal(Object.hasOwn(state, 'rankings'), false);
      assert.deepEqual(new Set(state.submittedIds), new Set(f.ids.slice(0, 2)));
    }
  } },
  { type: 'draw', Engine: DrawGuessRoom, method: 'act', async check(f, calls) {
    const initial = await f.state(0), artist = f.ids.indexOf(initial.presenterId), viewer = (artist + 1) % 3;
    const candidate = (await f.state(artist)).candidates[0]; assert.ok(candidate);
    assert.deepEqual((await f.state(viewer)).candidates, []);
    await f.action(viewer, { action: 'choose', questionId: candidate.id }, 400);
    await f.action(artist, { action: 'choose', questionId: candidate.id });
    assert.equal(calls.at(-1).id, f.ids[artist]); assert.equal(calls.at(-1).input.questionId, candidate.id);
    assert.equal((await f.state(artist)).question.title, candidate.title);
    const hidden = await f.state(viewer); assert.equal(hidden.question, null); assert.deepEqual(hidden.candidates, []);
    await f.action(viewer, { action: 'guess', answer: '合成的不正確答案123456' });
    assert.equal(calls.at(-1).id, f.ids[viewer]); assert.equal(calls.at(-1).input.answer, '合成的不正確答案123456');
    const after = await f.state(viewer); assert.equal(after.question, null); assert.equal(after.phase, 'drawing');
    assert.equal(after.guesses.at(-1).id, f.ids[viewer]);
  } },
];
for (const entry of cases) test(entry.type + ' HTTP dispatch keeps its action signature and authenticated private viewer', async t => {
  const calls = observeDispatch(t, entry.Engine, entry.method);
  await entry.check(await fixture(t, entry.type), calls);
  assert.ok(calls.length > 0, 'the expected engine entry point handled the real HTTP action');
});
