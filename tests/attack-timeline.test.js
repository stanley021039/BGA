const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { selectAttackTargets } = require('../src/rooms/attack-targets');
const definitions = require('../public/shared/attack-effects.json');
const timing = require('../public/shared/attack-timing.json');
function fixture(
  effect,
  points = [
    { id: 'a', x: 20, y: 50 },
    { id: 'b', x: 40, y: 50 },
    { id: 'c', x: 50, y: 50 },
  ],
) {
  const combat = createSceneCombat(() => 0.5),
    timeline = createAttackTimeline(combat);
  points.forEach((a) => combat.advance(a, 0));
  const event = {
    id: 'cast',
    effect,
    at: 0,
    fromId: 'a',
    fromX: 20,
    fromY: 50,
    toId: 'b',
    toX: 40,
    toY: 50,
    aspectRatio: 1,
  };
  const targets = selectAttackTargets(points[0], points, effect, 1);
  timeline.prepare(event, points[0], targets);
  const advance = (t) =>
    timeline.advance([event], points, t, (actor, time) => combat.advance(actor, time));
  return { points, event, advance };
}
test('every current offensive attack has a bounded authoritative arrival, no eager damage, and no duplicate settlement', () => {
  for (const definition of definitions.filter((e) => !['shield', 'sphere'].includes(e.id))) {
    const f = fixture(definition.id);
    const first = Math.min(...f.event.hits.map((h) => h.delayMs));
    assert.ok(first > 0 && first <= 4100, definition.id);
    f.advance(first - 1);
    assert.equal(f.points[1].health, 1200000, definition.id);
    f.advance(first);
    assert.ok(f.points[1].health < 1200000, definition.id);
    const health = f.points[1].health;
    f.advance(first);
    assert.equal(f.points[1].health, health);
  }
  assert.deepEqual(Object.keys(timing).sort(), definitions.map((e) => e.id).sort());
});
test('Babylon/Ea has a double-strength second stage; the two dragoon salvos share the normal total', () => {
  for (const [effect, first, last, total] of [
    ['gate_of_babylon', 2400, 3880, 843478],
    ['funnel', 1320, 2120, 200000],
  ]) {
    const f = fixture(effect);
    f.advance(first);
    const initial = f.points[1].health;
    assert.ok(initial < 1200000 && initial > 1200000 - total);
    f.advance(last - 1);
    assert.equal(f.points[1].health, effect === 'gate_of_babylon' ? 918841 : initial);
    f.advance(last);
    assert.equal(f.points[1].health, 1200000 - total);
    f.advance(last);
    assert.equal(f.points[1].health, 1200000 - total);
  }
});
test('bijuu selects three different players on their own paths, and Excalibur reaches both screen edges', () => {
  const source = { id: 'a', x: 50, y: 50, health: 1 };
  const targets = [
    source,
    { id: 'left', x: 0, y: 50, health: 1 },
    { id: 'right', x: 100, y: 50, health: 1 },
    { id: 'off', x: 100, y: 90, health: 1 },
  ];
  assert.deepEqual(
    selectAttackTargets(source, targets, 'excalibur', 1)
      .map((a) => a.id)
      .sort(),
    ['left', 'right'],
  );
  const rays = [
    source,
    ...[-0.32, 0, 0.32].map((a, i) => ({
      id: String(i),
      x: 50 + (i === 1 ? 20 : 40) * Math.cos(a),
      y: 50 + (i === 1 ? 20 : 40) * Math.sin(a),
      health: 1,
    })),
  ];
  assert.equal(selectAttackTargets(source, rays, 'bijuu_beam', 1).length, 3);
});
test('phoenix scorches only actors on its passed ground, including a newly entering actor, and stops after its lifetime', () => {
  const f = fixture('solar_phoenix', [
    { id: 'a', x: 20, y: 50 },
    { id: 'b', x: 40, y: 50 },
    { id: 'c', x: 45, y: 80 },
  ]);
  f.advance(2900);
  const base = f.points[1].health;
  f.advance(3000);
  assert.equal(f.points[1].health, base - 40000);
  assert.equal(f.points[2].health, 1200000);
  f.points[2].y = 50;
  f.advance(3900);
  assert.equal(f.points[2].health, 1160000);
  const unchanged = f.points[2].health;
  f.advance(3999);
  assert.equal(f.points[2].health, unchanged);
  assert.equal(f.event.hits.filter((h) => h.toId === 'c').length, 1);
});
test('leaving the frozen ray before impact misses, and an old second stage cannot hit a respawned life', () => {
  const f = fixture('bijuu_beam');
  f.points[1].y = 100;
  f.advance(2900);
  assert.equal(f.points[1].health, 1200000);
  assert.equal(f.event.hits.find((h) => h.toId === 'b').missed, true);
  const g = fixture('gate_of_babylon');
  g.points[1].health = 1;
  g.advance(3120);
  assert.equal(g.points[1].health, 0);
  g.points[1].lifeId++;
  g.points[1].health = 1200000;
  g.points[1].respawnAt = 0;
  g.advance(3880);
  assert.equal(g.points[1].health, 1200000);
});
