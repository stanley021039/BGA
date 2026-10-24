'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
function fixture() {
  let time = 1000;
  const lobby = createLobby(() => time),
    a = { id: 'a', display_name: 'Alice' },
    b = { id: 'b', display_name: 'Bob' },
    c = { id: 'c', display_name: 'Carol' };
  const own = (user = a) => lobby.view(user).visitors.find((v) => v.id === user.id);
  const tick = (ms = 1000) => {
    time += ms;
  };
  function place(user, x, y) {
    lobby.move(user, { x, y });
    const present = lobby.view(user).visitors.map((v) => [a, b, c].find((u) => u.id === v.id));
    for (let i = 0; i < 10; i++) {
      tick(1000);
      for (const other of present) lobby.view(other);
    }
    return own(user);
  }
  return { lobby, a, b, c, own, tick, place };
}

test('lobby reach includes half the longer screen edge in landscape and portrait', () => {
  for (const aspectRatio of [16 / 9, 9 / 16]) {
    const f = fixture();
    const landscape = aspectRatio > 1;
    f.place(f.a, landscape ? 25 : 50, landscape ? 50 : 20);
    f.place(f.b, landscape ? 75 : 50, landscape ? 50 : 70);
    const input = { slot: 'q', effect: 'beam', aspectRatio, requestId: 'half-screen-lobby-001' };
    assert.equal(f.lobby.attack(f.a, input).attacks.at(-1).toId, f.b.id);
    f.place(f.b, landscape ? 76 : 50, landscape ? 50 : 71);
    assert.throws(() => f.lobby.attack(f.a, { ...input, requestId: 'half-screen-lobby-002' }), {
      code: 'NO_ATTACK_TARGET',
    });
  }
});
test('directional walking wraps all four edges, keeps the other coordinate and publishes the same position', () => {
  for (const [x, y, dx, dy, expectedX, expectedY] of [
    [94, 50, 1, 0, 4, 50],
    [6, 50, -1, 0, 96, 50],
    [50, 12, 0, -1, 50, 97],
    [50, 97, 0, 1, 50, 2],
  ]) {
    const f = fixture();
    f.place(f.a, x, y);
    let visitor;
    for (let i = 0; i < (dx ? 2 : dy < 0 ? 3 : 1); i++) {
      f.lobby.move(f.a, { dx, dy });
      f.tick();
      visitor = f.own();
    }
    assert.equal(visitor.x, expectedX);
    assert.equal(visitor.y, expectedY);
    assert.equal(visitor.wrapId, 1);
    assert.equal(visitor.teleportId, 0);
    const peer = f.lobby.view(f.b).visitors.find((v) => v.id === 'a');
    assert.deepEqual(peer, visitor);
    const teleported = f.lobby.teleport(f.a, 'sparks').visitors.find((v) => v.id === 'a');
    assert.equal(teleported.teleportId, 1);
    assert.equal(teleported.entrance, 'sparks');
  }
});
test('diagonal and repeated directional movement stays bounded, wraps repeatedly, and cannot accumulate speed', () => {
  const f = fixture();
  f.place(f.a, 94, 97);
  let before = f.own();
  for (let i = 0; i < 100; i++) f.lobby.move(f.a, { dx: 1, dy: 1 });
  assert.equal(f.own().x, before.x);
  assert.equal(f.own().targetX, before.x + 5);
  f.tick(100);
  let next = f.own();
  assert.ok(Math.hypot((next.x - before.x) / 12, (next.y - before.y) / 16) <= 0.10001);
  for (let i = 0; i < 60; i++) {
    f.lobby.move(f.a, { dx: 1, dy: 1 });
    f.tick();
    next = f.own();
    assert.ok(next.x >= 0 && next.x < 100 && next.y >= 0 && next.y < 100);
  }
  assert.ok(next.wrapId >= 3);
  assert.equal(next.teleportId, 0);
  for (const input of [
    { dx: 2, dy: 0 },
    { dx: NaN, dy: 1 },
    { dx: 1 },
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0, x: 50, y: 50 },
  ])
    assert.throws(
      () => f.lobby.move(f.a, input),
      (e) => e.code === 'INVALID_MOVEMENT',
    );
});
test('attack requires presence, finds nearest other visitor, has cooldown and idempotency, and expires for peers', () => {
  const f = fixture(),
    input = { requestId: 'request-0001', aspectRatio: 1 };
  assert.throws(
    () => f.lobby.attack(f.a, input),
    (e) => e.code === 'LOBBY_PRESENCE_REQUIRED',
  );
  f.own();
  assert.throws(
    () => f.lobby.attack(f.a, input),
    (e) => e.code === 'NO_ATTACK_TARGET',
  );
  f.own(f.b);
  f.own(f.c);
  f.lobby.move(f.a, { x: 50, y: 50 });
  f.lobby.move(f.c, { x: 55, y: 50 });
  f.tick(10000);
  f.own(f.c);
  const before = f.own(),
    first = f.lobby.attack(f.a, input),
    event = first.attacks[0];
  assert.equal(event.fromId, 'a');
  assert.equal(event.toId, 'c');
  assert.equal(event.until - event.at, 1800);
  assert.deepEqual(
    first.visitors.find((v) => v.id === 'a'),
    before,
  );
  assert.equal(f.lobby.view(f.b).attacks[0].id, event.id);
  assert.equal(f.lobby.attack(f.a, input).attacks.length, 1);
  assert.throws(
    () => f.lobby.attack(f.a, { ...input, aspectRatio: 2 }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  assert.throws(
    () => f.lobby.attack(f.a, { ...input, requestId: 'request-0002' }),
    (e) => e.code === 'ATTACK_COOLDOWN',
  );
  f.tick(1800);
  assert.equal(f.lobby.view(f.b).attacks.length, 0);
  f.tick(199);
  assert.throws(
    () => f.lobby.attack(f.a, { ...input, requestId: 'request-0002' }),
    (e) => e.code === 'ATTACK_COOLDOWN',
  );
  f.tick(1);
  assert.equal(f.lobby.attack(f.a, { ...input, requestId: 'request-0002' }).attacks.length, 1);
});
test('nearest attack uses viewport proportions, deterministic ties, validates targets and excludes expired visitors', () => {
  const f = fixture();
  f.place(f.a, 50, 50);
  f.place(f.b, 60, 50);
  f.place(f.c, 50, 65);
  f.own(f.a);
  f.own(f.b);
  const fire = (id, aspectRatio) =>
    f.lobby.attack(f.a, { requestId: 'request-' + id, aspectRatio }).attacks.at(-1);
  assert.equal(fire('narrow', 0.5).toId, 'b');
  f.tick(2000);
  assert.equal(fire('wide', 2).toId, 'c');
  for (const input of [
    { requestId: 'request-invalid', aspectRatio: 1, targetId: 'c' },
    { requestId: 'short', aspectRatio: 1 },
    { requestId: 'request-invalid', aspectRatio: Infinity },
    { requestId: 'request-invalid', aspectRatio: 0.1 },
  ])
    assert.throws(
      () => f.lobby.attack(f.a, input),
      (e) => e.code === 'INVALID_ATTACK',
    );
  f.tick(15001);
  f.own();
  assert.throws(
    () => fire('expired', 1),
    (e) => e.code === 'NO_ATTACK_TARGET',
  );
  const tie = fixture();
  tie.place(tie.a, 50, 50);
  tie.place(tie.b, 60, 50);
  tie.place(tie.c, 40, 50);
  tie.own(tie.a);
  tie.own(tie.b);
  assert.equal(
    tie.lobby.attack(tie.a, { requestId: 'request-tie', aspectRatio: 1 }).attacks[0].toId,
    'b',
  );
});
