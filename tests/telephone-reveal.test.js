'use strict';
const { completeTelephoneTopics } = require('./helpers/telephone.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { TelephoneRoom } = require('../src/games/telephone');
function fixture(count = 3) {
  let now = 1000;
  const room = new TelephoneRoom(
    'ABCDEF',
    '逐頁揭曉',
    () => 0,
    () => now,
  );
  const players = Array.from({ length: count }, (_, i) => room.add('玩家' + i));
  room.start();
  completeTelephoneTopics(room);
  while (room.phase === 'passing') {
    now = room.deadline;
    room.auto();
  }
  const reveal = (player = players[0], data = {}) =>
    room.act(player.id, 'reveal', {
      stepId: room.stepId,
      requestId: randomUUID(),
      expectedIndex: room.revealIndex,
      ...data,
    });
  return { room, players, reveal };
}
for (const count of [3, 4, 5, 6, 7, 8])
  test(`${count} seats reveal one page per host command in book order`, () => {
    const { room, players, reveal } = fixture(count);
    const total = room.books.reduce((sum, book) => sum + book.pages.length, 0);
    assert.deepEqual(room.view(players[0].id).review, { index: -1, total });
    for (let index = 0; index < total; index++) {
      reveal();
      for (const player of players) assert.deepEqual(room.view(player.id).review, { index, total });
    }
    assert.throws(
      () => reveal(),
      (e) => e.code === 'REVIEW_COMPLETE',
    );
    const finalBooks = structuredClone(room.books);
    assert.deepEqual(room.view(players[1].id).books, finalBooks, 'archive data stays unchanged');
    room.start();
    completeTelephoneTopics(room);
    assert.equal(room.revealIndex, -1);
    assert.equal(room.view(players[0].id).review, null);
  });
test('reveal rejects visitors, stale positions, conflicting receipts and stale games', () => {
  const { room, players, reveal } = fixture();
  assert.throws(
    () => reveal(players[1]),
    (e) => e.code === 'HOST_ONLY',
  );
  const data = { stepId: room.stepId, requestId: randomUUID(), expectedIndex: -1 };
  room.act(players[0].id, 'reveal', data);
  room.act(players[0].id, 'reveal', data);
  assert.equal(room.revealIndex, 0, 'lost reply retry must not advance again');
  assert.throws(
    () => room.act(players[0].id, 'reveal', { ...data, expectedIndex: 0 }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  assert.throws(
    () => reveal(players[0], { expectedIndex: -1 }),
    (e) => e.code === 'STALE_REVIEW',
  );
  assert.throws(
    () => reveal(players[0], { expectedIndex: '0' }),
    (e) => e.code === 'STALE_REVIEW',
  );
  room.start();
  completeTelephoneTopics(room);
  assert.throws(
    () => room.act(players[0].id, 'reveal', data),
    (e) => e.code === 'STALE_STEP',
  );
  assert.throws(
    () => reveal(),
    (e) => e.code === 'INVALID_PHASE',
  );
});
test('interrupted books can be revealed and a new host continues the same position', () => {
  const room = new TelephoneRoom('ABCDEF', '中止', () => 0);
  const players = Array.from({ length: 3 }, (_, i) => room.add('玩家' + i));
  room.start();
  completeTelephoneTopics(room);
  room.kick(players[0].id, players[0].id, true);
  assert.equal(room.interrupted, true);
  assert.equal(room.host, players[1].id);
  const command = (player) =>
    room.act(player.id, 'reveal', {
      stepId: room.stepId,
      requestId: randomUUID(),
      expectedIndex: room.revealIndex,
    });
  command(players[1]);
  assert.equal(room.revealIndex, 0);
  room.kick(players[1].id, players[1].id, true);
  command(players[2]);
  assert.equal(room.revealIndex, 1);
});

test('HTTP seats share reveal progress across reconnect and reject a non-host advance', async (t) => {
  const { createAuth } = require('../src/auth');
  const { appFixture } = require('./helpers/app-fixture.cjs');
  const start = TelephoneRoom.prototype.start,
    auto = TelephoneRoom.prototype.auto;
  t.mock.method(TelephoneRoom.prototype, 'start', function () {
    start.call(this);
    this.deadline = Date.now() + 100;
  });
  t.mock.method(TelephoneRoom.prototype, 'auto', function () {
    const changed = auto.call(this);
    if (changed && this.phase === 'passing') this.deadline = Date.now() + 100;
    return changed;
  });
  const password = 'synthetic-reveal-password';
  const { base } = await appFixture(t, {
    config: { marketAutomationEnabled: false, achievementPurpose: 'test' },
    seed: async (db) => {
      const auth = createAuth(db);
      await auth.bootstrap('reveal_owner', password);
      const owner = db.prepare("SELECT * FROM users WHERE username='reveal_owner'").get();
      for (const username of ['reveal_peer1', 'reveal_peer2'])
        await auth.register(
          {
            username,
            displayName: username,
            password,
            confirmPassword: password,
            invite: auth.createInvite(owner, { days: 1 }).code,
          },
          { setHeader() {} },
        );
    },
  });
  const post = async (cookie, route, data, status = 200) => {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    const value = await response.json();
    assert.equal(response.status, status, JSON.stringify(value));
    return { value, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const cookies = [];
  for (const username of ['reveal_owner', 'reveal_peer1', 'reveal_peer2'])
    cookies.push((await post(null, 'auth/login', { username, password })).cookie);
  const { code } = (await post(cookies[0], 'create', { type: 'telephone' })).value;
  for (const cookie of cookies.slice(1)) await post(cookie, 'join', { code });
  await post(cookies[0], 'start', { code });
  const state = async (cookie) =>
    (await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })).json();
  let current;
  for (let tries = 0; tries < 50; tries++) {
    current = await state(cookies[0]);
    if (current.phase === 'finished') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(current.phase, 'finished');
  const payload = {
    code,
    action: 'reveal',
    stepId: current.stepId,
    requestId: randomUUID(),
    expectedIndex: -1,
  };
  await post(cookies[1], 'action', payload, 403);
  await post(cookies[0], 'action', payload);
  await post(cookies[0], 'action', payload);
  for (const cookie of cookies) assert.equal((await state(cookie)).review.index, 0);
  await post(cookies[2], 'reconnect', { code });
  assert.equal((await state(cookies[2])).review.index, 0);
  await post(cookies[0], 'action', { ...payload, requestId: randomUUID() }, 409);
  await post(cookies[0], 'leave', { code });
  const next = await state(cookies[1]);
  await post(cookies[1], 'action', {
    ...payload,
    stepId: next.stepId,
    requestId: randomUUID(),
    expectedIndex: 0,
  });
  assert.equal((await state(cookies[2])).review.index, 1);
});
