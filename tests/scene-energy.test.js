const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const energy = require('../src/rooms/scene-energy');

test('energy counts actual fractional walking time, caps at 100, and never banks overflow', () => {
  const actor = { health: 1 };
  energy.walk(actor, 999);
  assert.equal(actor.energy, 0);
  energy.walk(actor, 1);
  assert.equal(actor.energy, 1);
  energy.walk(actor, 200000);
  assert.equal(actor.energy, 100);
  energy.spend(actor, 'r');
  energy.walk(actor, 999);
  assert.equal(actor.energy, 0);
  actor.health = 0;
  energy.walk(actor, 10000);
  assert.equal(actor.energy, 0);
});

test('ordinary hits give 10/5; multi hits only give the victim 5, and shields/invalid targets give none', () => {
  const combat = createSceneCombat(() => 0.5);
  const a = { id: 'a' },
    b = { id: 'b' };
  combat.advance(a, 0);
  combat.advance(b, 0);
  combat.hit(a, b, 100, 'barrage');
  assert.equal(a.energy, 10);
  assert.equal(b.energy, 5);
  combat.hit(a, b, 200, 'guanyin_barrage');
  assert.equal(a.energy, 10);
  assert.equal(b.energy, 10);
  combat.protect(a, 200);
  combat.hit(a, a, 300, 'barrage');
  assert.equal(a.energy, 10);
  b.health = 0;
  combat.hit(a, b, 400, 'barrage');
  assert.equal(a.energy, 10);
  assert.equal(b.energy, 10);
});

function fixture(kind) {
  let now = 1000;
  const users = ['a', 'b'].map((id) => ({ id, display_name: id, name: id }));
  const room = { players: users };
  const scene =
    kind === 'lobby'
      ? createLobby(
          () => now,
          undefined,
          () => 0.5,
        )
      : createRoomSpace(
          () => now,
          () => 0.5,
        );
  const view = (id = 'a') =>
    kind === 'lobby' ? scene.view(users.find((u) => u.id === id)) : scene.view(room, id);
  const move = (id, position) =>
    kind === 'lobby'
      ? scene.move(
          users.find((u) => u.id === id),
          position,
        )
      : scene.move(room, id, position);
  const attack = (slot, effect, requestId = 'energy-request-0001') =>
    kind === 'lobby'
      ? scene.attack(users[0], { slot, effect, requestId, aspectRatio: 1 })
      : scene.move(room, 'a', { action: 'attack', slot, requestId, aspectRatio: 1 }, effect);
  const tick = (ms) => {
    now += ms;
    view();
    view('b');
  };
  view();
  view('b');
  const actor = (id = 'a') => view().visitors.find((v) => v.id === id);
  function charge() {
    for (let i = 0; i < 25; i++) {
      move('a', { x: i % 2 ? 10 : 90, y: 50 });
      tick(6500);
    }
    move('a', { x: 40, y: 50 });
    move('b', { x: 45, y: 50 });
    tick(6500);
  }
  return { view, move, attack, tick, actor, charge, scene, room };
}

for (const kind of ['lobby', 'room']) {
  test(`${kind}: walking accrues only until arrival; idle, repeats and teleport add no energy`, () => {
    const f = fixture(kind);
    const before = f.actor();
    f.move('a', { x: before.x + 12, y: before.y });
    f.tick(1000);
    assert.equal(f.actor().energy, 1);
    f.tick(5000);
    assert.equal(f.actor().energy, 1);
    for (let i = 0; i < 10; i++) f.view();
    assert.equal(f.actor().energy, 1);
    if (kind === 'lobby') f.scene.teleport({ id: 'a', display_name: 'a' });
    else f.scene.move(f.room, 'a', { action: 'teleport' });
    f.tick(1000);
    assert.equal(f.actor().energy, 1);
  });
  test(`${kind}: rejects empty R, category bypass and forged energy; consumes once after a valid cast`, () => {
    const f = fixture(kind);
    assert.throws(() => f.attack('r', 'explosion'), { code: 'INSUFFICIENT_SCENE_ENERGY' });
    assert.throws(() => f.attack('q', 'explosion'), { code: 'INVALID_ATTACK_SLOT' });
    assert.throws(() => f.attack('r', 'beam'), { code: 'INVALID_ATTACK_SLOT' });
    if (kind === 'lobby')
      assert.throws(
        () =>
          f.scene.attack(
            { id: 'a', display_name: 'a' },
            {
              slot: 'r',
              effect: 'explosion',
              requestId: 'forged-energy-001',
              aspectRatio: 1,
              energy: 100,
            },
          ),
        { code: 'INVALID_ATTACK' },
      );
    else
      assert.throws(
        () =>
          f.scene.move(
            f.room,
            'a',
            {
              action: 'attack',
              slot: 'r',
              requestId: 'forged-energy-001',
              aspectRatio: 1,
              energy: 100,
            },
            'explosion',
          ),
        { code: 'INVALID_MOVEMENT' },
      );
    f.charge();
    assert.equal(f.actor().energy, 100);
    const before = f.actor('b').energy;
    f.attack('r', 'guanyin_barrage');
    assert.equal(f.actor().energy, 0);
    f.attack('r', 'guanyin_barrage');
    assert.equal(f.actor().energy, 0, 'same request succeeds without another charge');
    f.tick(4100);
    assert.equal(f.actor().energy, 0, 'multi caster does not refill on damage');
    assert.ok(f.actor('b').energy > before);
    assert.throws(() => f.attack('r', 'guanyin_barrage', 'energy-request-0002'), {
      code: 'INSUFFICIENT_SCENE_ENERGY',
    });
  });
  test(`${kind}: each ordinary impact credits the real caster and victim; polling and retries never duplicate energy`, () => {
    const f = fixture(kind);
    f.move('a', { x: 40, y: 50 });
    f.move('b', { x: 45, y: 50 });
    f.tick(6500);
    const before = f.actor().energy,
      received = f.actor('b').energy;
    f.attack('q', 'barrage');
    f.tick(1600);
    assert.equal(f.actor().energy, before + 30);
    assert.equal(f.actor('b').energy, received + 15);
    f.view();
    f.attack('q', 'barrage');
    assert.equal(f.actor().energy, before + 30);
  });
}
