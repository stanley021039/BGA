const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
const { selectAttackTargets } = require('../src/rooms/attack-targets');

function actors() {
  const combat = createSceneCombat(() => 0.5);
  const a = { id: 'a', name: 'A', x: 20, y: 50 },
    b = { id: 'b', name: 'B', x: 40, y: 50 };
  for (const actor of [a, b]) combat.advance(actor, 0);
  return { combat, a, b };
}
test('explosion multiplies standard area damage by 1.5 and Ea stage weighs twice the weapon volley', () => {
  const { combat, a, b } = actors();
  assert.equal(combat.hit(a, b, 0, 'guanyin_barrage').damage, 400000);
  b.health = b.maxHealth;
  assert.equal(combat.hit(a, b, 0, 'explosion').damage, 600000);
  b.health = 5000000;
  assert.equal(combat.hit(a, b, 0, 'gate_of_babylon', 2).damage, 562319);
});
test('bijuu freezes three distinct narrow target paths, excludes a fourth and misses someone who dodges', () => {
  const { combat, a, b } = actors();
  const c = { id: 'c', x: 20, y: 80 },
    d = { id: 'd', x: 60, y: 20 },
    e = { id: 'e', x: 80, y: 80 };
  const people = [a, b, c, d, e];
  people.forEach((p) => combat.advance(p, 0));
  const targets = selectAttackTargets(a, people, 'bijuu_beam', 1);
  assert.deepEqual(
    targets.map((p) => p.id),
    ['b', 'c', 'd'],
  );
  const event = {
    id: 'rays',
    effect: 'bijuu_beam',
    fromId: a.id,
    fromX: a.x,
    fromY: a.y,
    toId: b.id,
    toX: b.x,
    toY: b.y,
    aspectRatio: 1,
    at: 0,
  };
  const timeline = createAttackTimeline(combat);
  timeline.prepare(event, a, targets);
  assert.deepEqual(
    event.hits.map((h) => [h.aimX, h.aimY]),
    [
      [40, 50],
      [20, 80],
      [60, 20],
    ],
  );
  b.y += 4;
  timeline.advance([event], people, 2900, (p, t) => combat.advance(p, t));
  assert.equal(b.health, 1200000);
  assert.equal(event.hits[0].missed, true);
  assert.equal(c.health, 800000);
  assert.equal(d.health, 800000);
  assert.equal(e.health, 1200000);
});
test('detached lower body has half max health, can be picked up without healing, and cannot be targeted by its owner', () => {
  const { combat, a, b } = actors();
  combat.hit(a, b, 0, 'dimension_cleave');
  combat.applyEffect(a, b, 0, 'dimension_cleave', a);
  const fragment = b.fragment;
  assert.equal(fragment.health, 600000);
  assert.equal(fragment.maxHealth, 600000);
  assert.equal(b.health, 800000);
  assert.equal(b.severed, true);
  assert.equal(selectAttackTargets(b, combat.targets([b]), 'beam', 1).length, 0);
  assert.equal(combat.hit(b, fragment, 1, 'beam').damage, 0);
  combat.applyEffect(a, b, 1, 'dimension_cleave', a);
  assert.equal(b.fragment, fragment);
  b.x = fragment.x;
  b.y = fragment.y;
  combat.collect(b);
  assert.equal(b.fragment, null);
  assert.equal(b.severed, false);
  assert.equal(b.health, 800000);
  assert.equal(combat.hit(a, fragment, 2, 'beam').damage, 0);
});
test('destroying the lower body halves current health once, preserves max health and does not award a kill', () => {
  const { combat, a, b } = actors();
  combat.hit(a, b, 0, 'dimension_cleave');
  combat.applyEffect(a, b, 0, 'dimension_cleave', a);
  const fragment = b.fragment;
  for (let i = 0; i < 3; i++) combat.hit(a, fragment, 100 + i, 'beam');
  assert.equal(b.fragment, null);
  assert.equal(b.health, 400000);
  assert.equal(b.maxHealth, 1200000);
  combat.hit(a, fragment, 105, 'beam');
  assert.equal(b.health, 400000);
  assert.equal(a.kda.kills, 0);
  assert.equal(b.kda.deaths, 0);
  combat.applyEffect(a, b, 106, 'dimension_cleave', a);
  assert.equal(b.fragment, null, 'one lower body per life until recovered');
  b.health = 1;
  combat.hit(a, b, 107, 'beam');
  combat.advance(b, 3107);
  assert.equal(b.severed, false);
  assert.equal(b.fragment, null);
  assert.equal(b.health, b.maxHealth);
});
test('drill knocks a survivor away, then applies three bounded one-second ticks with no repeat damage or post-respawn tick', () => {
  const { combat, a, b } = actors();
  combat.hit(a, b, 0, 'giga_drill');
  combat.applyEffect(a, b, 0, 'giga_drill', a);
  assert.equal(b.x, 52);
  assert.equal(b.targetX, 52);
  assert.equal(b.knockback.fromX, 40);
  assert.equal(b.health, 800000);
  combat.advance(b, 999);
  assert.equal(b.health, 800000);
  combat.advance(b, 1000);
  assert.equal(b.health, 760000);
  combat.advance(b, 1000);
  assert.equal(b.health, 760000);
  combat.advance(b, 3000);
  assert.equal(b.health, 680000);
  assert.equal(b.drillDot, null);
  combat.advance(b, 3999);
  assert.equal(b.health, 680000);
  combat.applyEffect(a, b, 4000, 'giga_drill', a);
  b.health = 1;
  combat.advance(b, 5000);
  assert.equal(b.health, 0);
  assert.equal(b.drillDot, null);
  combat.advance(b, 8000);
  const reborn = b.health;
  combat.advance(b, 9000);
  assert.equal(b.health, reborn);
});
for (const kind of ['lobby', 'room'])
  test(`${kind}: explosion and giant cat immobilize exactly one second and block teleport too`, () => {
    let time = 0;
    const users = ['a', 'b'].map((id) => ({ id, display_name: id, name: id }));
    const lobby = createLobby(
        () => time,
        undefined,
        () => 0.5,
      ),
      space = createRoomSpace(
        () => time,
        () => 0.5,
      ),
      room = { players: users };
    let cast, view, move, teleport;
    if (kind === 'lobby') {
      users.forEach((u, i) => lobby.move(u, { x: 20 + i * 20, y: 50 }));
      view = () => {
        users.forEach((u) => lobby.view(u));
        return lobby.view(users[0]);
      };
      move = (id) => lobby.move(users[id], { x: 70, y: 50 });
      teleport = (id) => lobby.teleport(users[id]);
      cast = (effect, id) =>
        lobby.attack(users[0], { effect, slot: 'q', aspectRatio: 1, requestId: id });
    } else {
      space.view(room, 'a');
      users.forEach((u, i) => space.move(room, u.id, { x: 20 + i * 20, y: 50 }));
      view = () => space.view(room, 'a');
      move = (id) => space.move(room, users[id].id, { x: 70, y: 50 });
      teleport = (id) => space.move(room, users[id].id, { action: 'teleport' });
      cast = (effect, id) =>
        space.move(
          room,
          'a',
          { action: 'attack', slot: 'q', aspectRatio: 1, requestId: id },
          effect,
        );
    }
    time = 10000;
    view();
    cast('explosion', 'explosion-cast-001');
    time = 10999;
    assert.doesNotThrow(() => move(0));
    time = 15099;
    assert.throws(() => move(0), { code: 'SCENE_IMMOBILIZED' });
    assert.throws(() => teleport(0), { code: 'SCENE_IMMOBILIZED' });
    time = 15100;
    assert.doesNotThrow(() => move(0));
    // Keep the caster still before the next, independently aimed cast.
    time = 18000;
    view();
    cast('giant_orange_cat', 'cat-cast-000001');
    time = 20570;
    const hit = view().visitors.find((p) => p.id === 'b');
    assert.equal(hit.immobileUntil, 21570);
    time = 21569;
    assert.throws(() => move(1), { code: 'SCENE_IMMOBILIZED' });
    time = 21570;
    assert.doesNotThrow(() => move(1));
  });
