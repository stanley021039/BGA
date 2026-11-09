const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const energy = require('../src/rooms/scene-energy');

test('hex shield has shorter residual protection; neither shield grants bonus in that phase', () => {
  const combat = createSceneCombat(() => 0.5);
  const attacker = { id: 'attacker' };
  const hex = { id: 'hex' };
  const sphere = { id: 'sphere' };
  for (const actor of [attacker, hex, sphere]) combat.advance(actor, 0);
  combat.protect(hex, 0, 'shield');
  combat.protect(sphere, 0, 'sphere');
  for (const actor of [hex, sphere]) {
    combat.advance(actor, 2000);
    combat.hit(attacker, actor, 2000, 'beam');
    assert.equal(actor.energy, 5);
    assert.equal(combat.view(actor, true).combatStatus.guardEnergy, 0);
  }
  for (const actor of [hex, sphere]) combat.advance(actor, 4000);
  assert.equal(combat.view(hex, true).combatStatus.shield, 'none');
  assert.equal(combat.view(sphere, true).combatStatus.shield, 'residual');
});

test('energy counts actual fractional walking time, caps at 100, and never banks overflow', () => {
  const actor = { health: 1 };
  energy.walk(actor, 999);
  assert.equal(actor.energy, 0);
  energy.walk(actor, 1);
  assert.equal(actor.energy, 2);
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

test('energy archetype boosts each gain, preserves tenths and respects the scene cap', () => {
  const actor = { archetype: 'energy', health: 1, energyMaximum: 150, ordinaryHitEnergy: 12 };
  const target = { health: 1 };
  energy.walk(actor, 1000);
  assert.equal(actor.energy, 2.4);
  energy.hit(actor, target, 'beam', 1);
  assert.equal(actor.energy, 16.4);
  energy.hit(target, actor, 'beam', 1);
  assert.equal(actor.energy, 22.4);
  energy.gain(actor, 25);
  assert.equal(actor.energy, 52.4);
  actor.energy = 149.8;
  assert.throws(() => energy.check(actor, 'r', 'explosion'), { code: 'INSUFFICIENT_SCENE_ENERGY' });
  energy.gain(actor, 2);
  assert.equal(actor.energy, 150);
  energy.check(actor, 'r', 'explosion');
  energy.spend(actor, 'r');
  assert.equal(actor.energy, 0);
});

test('author energy stacks with the chosen archetype without raising the cap', () => {
  const target = { health: 1 };
  for (const [archetype, perHit] of [
    [null, 13.2],
    ['energy', 15.4],
  ]) {
    const actor = {
      archetype,
      authorBonus: true,
      health: 1,
      energyMaximum: 150,
      ordinaryHitEnergy: 12,
    };
    energy.hit(actor, target, 'beam', 1);
    assert.equal(actor.energy, perHit);
    energy.gain(actor, 200);
    assert.equal(actor.energy, 150);
  }
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
  const attack = (slot, effect, requestId = 'energy-request-0001', id = 'a') =>
    kind === 'lobby'
      ? scene.attack(
          users.find((user) => user.id === id),
          { slot, effect, requestId, aspectRatio: 1 },
        )
      : scene.move(room, id, { action: 'attack', slot, requestId, aspectRatio: 1 }, effect);
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
  for (const shield of ['shield', 'sphere'])
    test(kind + ': ' + shield + ' grants bonus once and only during full protection', () => {
      const f = fixture(kind);
      f.move('a', { x: 40, y: 50 });
      f.move('b', { x: 45, y: 50 });
      f.tick(6500);
      const baseline = f.actor('b').energy;
      f.attack('q', shield, 'shield-request-001', 'b');
      f.attack('q', 'barrage');
      f.tick(1200);
      const b = f.view('b').visitors.find((v) => v.id === 'b');
      assert.equal(b.energy - baseline, 20);
      assert.equal(b.combatStatus.guardEnergy, 5);
      assert.equal(f.actor('b').combatStatus, undefined);
      f.attack('q', shield, 'shield-request-001', 'b');
      f.tick(800);
      f.attack('q', 'barrage', 'barrage-request-002');
      f.tick(1200);
      assert.equal(f.actor('b').energy - baseline, 35);
      assert.equal(f.view('b').visitors.find((v) => v.id === 'b').combatStatus.guardEnergy, 0);
    });
  test(kind + ': frost slows movement once and a blade hit speeds up the caster', () => {
    const f = fixture(kind);
    f.move('a', { x: 40, y: 50 });
    f.move('b', { x: 45, y: 50 });
    f.tick(6500);
    f.attack('q', 'frost_spikes');
    f.tick(400);
    assert.equal(f.actor('b').slowMs, 1000);
    f.move('b', { x: 80, y: 50 });
    f.tick(600);
    assert.equal(f.actor('b').slowMs, 400, 'later hits do not refresh the timer');
    assert.ok(Math.abs(f.actor('b').x - 50.76) < 1e-6);
    f.tick(900);
    assert.equal(f.actor('b').slowMs, 0);
    assert.ok(Math.abs(f.actor('b').x - 60.6) < 1e-6);
    f.attack('e', 'blade_aura_crimson', 'blade-request-001');
    f.tick(650);
    assert.equal(f.actor().hasteMs, 800);
    assert.equal(f.view('b').visitors.find((v) => v.id === 'a').hasteMs, 800);
    f.move('a', { x: 70, y: 50 });
    f.tick(1000);
    assert.equal(f.actor().hasteMs, 0);
    assert.ok(Math.abs(f.actor().x - 53.44) < 1e-6);
  });

  for (const effect of ['shaohua_devour', 'shaohua_devour_alt']) {
    test(`${kind}: ${effect} requires full R energy and never funds its own next cast`, () => {
      const f = fixture(kind);
      assert.throws(() => f.attack('q', effect), { code: 'INVALID_ATTACK_SLOT' });
      assert.throws(() => f.attack('r', effect), { code: 'INSUFFICIENT_SCENE_ENERGY' });
      f.charge();
      f.attack('r', effect);
      assert.equal(f.actor().energy, 0);
      f.attack('r', effect);
      assert.equal(f.actor().energy, 0);
      f.tick(1600);
      const event = f.view().attacks.find((event) => event.effect === effect);
      assert.ok(event?.head);
      assert.equal(event.hits.length, 1);
      assert.equal(f.actor().energy, 0);
      assert.throws(() => f.attack('r', effect, 'second-devour-001'), {
        code: 'INSUFFICIENT_SCENE_ENERGY',
      });
    });
  }
  for (const effect of ['gate_of_heroes', 'gate_of_heroes_alt', 'reaper_seal', 'reaper_seal_alt']) {
    test(`${kind}: ${effect} follows R energy, retry and flight/seal restrictions`, () => {
      const f = fixture(kind);
      const initialHp = f.actor().health;
      assert.throws(() => f.attack('q', effect), { code: 'INVALID_ATTACK_SLOT' });
      assert.throws(() => f.attack('r', effect), { code: 'INSUFFICIENT_SCENE_ENERGY' });
      assert.equal(f.actor().health, initialHp);
      f.charge();
      const before = f.actor().health;
      f.attack('r', effect);
      assert.equal(f.actor().energy, 0);
      const after = f.actor().health;
      if (effect.startsWith('reaper')) assert.equal(after, before - Math.ceil(before * 0.2));
      f.attack('r', effect);
      assert.equal(f.actor().energy, 0);
      assert.equal(f.actor().health, after, 'retry never repeats health cost');
      if (effect.startsWith('gate')) {
        assert.throws(() => f.attack('q', 'railgun', 'flight-blocked-001'), {
          code: 'SCENE_FLYING',
        });
        f.tick(2100);
      } else {
        f.tick(2600);
        const b = { id: 'b', display_name: 'b' };
        const teleport = () =>
          kind === 'lobby'
            ? f.scene.teleport(b)
            : f.scene.move(f.room, 'b', { action: 'teleport' });
        assert.throws(teleport, { code: 'SCENE_SEALED' });
        f.move('b', { x: 46, y: 50 });
      }
      assert.equal(f.actor().energy, 0, 'new R skills never recharge their caster on impact');
    });
  }
  test(`${kind}: walking accrues only until arrival; idle, repeats and teleport add no energy`, () => {
    const f = fixture(kind);
    const before = f.actor();
    f.move('a', { x: before.x + 12, y: before.y });
    f.tick(1000);
    assert.equal(f.actor().energy, before.energy + 2);
    f.tick(5000);
    assert.equal(f.actor().energy, before.energy + 2);
    for (let i = 0; i < 10; i++) f.view();
    assert.equal(f.actor().energy, before.energy + 2);
    if (kind === 'lobby') f.scene.teleport({ id: 'a', display_name: 'a' });
    else f.scene.move(f.room, 'a', { action: 'teleport' });
    f.tick(1000);
    assert.equal(f.actor().energy, before.energy + 2 - (kind === 'lobby' ? 20 : 0));
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
    assert.equal(f.actor().energy, kind === 'lobby' ? 150 : 100);
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
    assert.equal(f.actor().energy, before + (kind === 'lobby' ? 36 : 30));
    assert.equal(f.actor('b').energy, received + 15);
    f.view();
    f.attack('q', 'barrage');
    assert.equal(f.actor().energy, before + (kind === 'lobby' ? 36 : 30));
  });
}

test('new lobby visitors start at 20 and each successful teleport costs 20', () => {
  const f = fixture('lobby');
  const user = { id: 'a', display_name: 'a' };
  assert.equal(f.actor().energy, 20);
  f.scene.teleport(user);
  assert.equal(f.actor().energy, 0);
  const before = f.actor();
  assert.throws(() => f.scene.teleport(user), { code: 'INSUFFICIENT_SCENE_ENERGY' });
  const after = f.actor();
  assert.equal(after.energy, 0);
  assert.equal(after.teleportId, before.teleportId);
});
