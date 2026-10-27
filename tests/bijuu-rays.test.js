const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { selectAttackTargets } = require('../src/rooms/attack-targets');
test('three frozen directions pierce six players, extend behind the first victim and settle each once', () => {
  const combat = createSceneCombat(() => 0.5),
    timeline = createAttackTimeline(combat),
    self = { id: 'self', x: 20, y: 50 };
  const people = [
    self,
    ...[
      ['east', 30, 50],
      ['east-far', 70, 50],
      ['north', 20, 35],
      ['north-far', 20, 0],
      ['south', 20, 65],
      ['south-far', 20, 95],
      ['outside', 60, 80],
      ['too-far', 86, 50],
    ].map(([id, x, y]) => ({ id, x, y })),
  ];
  people.forEach((a) => combat.advance(a, 0));
  const selected = selectAttackTargets(self, people, 'bijuu_beam', 1);
  assert.equal(selected.length, 6);
  const event = {
    id: 'rays',
    effect: 'bijuu_beam',
    at: 0,
    fromId: 'self',
    fromX: 20,
    fromY: 50,
    toId: 'east',
    toX: 30,
    toY: 50,
    aspectRatio: 1,
  };
  timeline.prepare(event, self, selected, people);
  assert.equal(event.rays.length, 3);
  assert.equal(event.hits.length, 6);
  assert.deepEqual(
    event.hits.filter((h) => h.toId.startsWith('east')).map((h) => [h.aimX, h.aimY]),
    [
      [30, 50],
      [30, 50],
    ],
  );
  timeline.advance([event], people, 2459, (a, t) => combat.advance(a, t));
  assert.ok(people.every((a) => a.health === 1200000));
  people.find((a) => a.id === 'east-far').y = 54;
  timeline.advance([event], people, 2460, (a, t) => combat.advance(a, t));
  assert.equal(event.hits.filter((h) => h.damage === 400000).length, 5);
  assert.equal(event.hits.find((h) => h.toId === 'east-far').missed, true);
  assert.equal(people.find((a) => a.id === 'outside').health, 1200000);
  assert.equal(people.find((a) => a.id === 'too-far').health, 1200000);
  const health = people.map((a) => a.health);
  timeline.advance([event], people, 2460, (a, t) => combat.advance(a, t));
  assert.deepEqual(
    people.map((a) => a.health),
    health,
  );
});
test('even one aimed direction renders three rays; many collinear victims still honour the 32-target cap', () => {
  const self = { id: 'self', x: 10, y: 50, health: 1200000 },
    people = [
      self,
      ...Array.from({ length: 80 }, (_, i) => ({
        id: 'target-' + i,
        x: 20 + i * 0.5,
        y: 50,
        health: 1200000,
      })),
    ];
  const selected = selectAttackTargets(self, people, 'bijuu_beam', 1);
  assert.equal(selected.length, 32);
  const event = { effect: 'bijuu_beam', at: 0, aspectRatio: 1 };
  createAttackTimeline(createSceneCombat(() => 0.5)).prepare(event, self, selected, people);
  assert.equal(event.rays.length, 3);
  assert.equal(event.hits.length, 32);
  assert.equal(new Set(event.hits.map((h) => h.toId)).size, 32);
});
