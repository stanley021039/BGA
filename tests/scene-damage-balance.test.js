const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const energy = require('../src/rooms/scene-energy');
const effects = require('../public/shared/attack-effects.json');
const timing = require('../public/shared/attack-timing.json');
const ordinary = effects.filter(
  (effect) => !effect.area && !['shield', 'sphere'].includes(effect.id),
);
function fixture() {
  const combat = createSceneCombat(() => 0.5),
    timeline = createAttackTimeline(combat);
  const actors = [
    { id: 'a', x: 20, y: 50 },
    { id: 'b', x: 40, y: 50 },
  ];
  actors.forEach((actor) => combat.advance(actor, 0));
  actors[1].health = actors[1].maxHealth = 100000000;
  let at = 0;
  function cast(effect) {
    const event = {
      id: `${effect}:${at}`,
      effect,
      at,
      fromId: 'a',
      fromX: 20,
      fromY: 50,
      toId: 'b',
      toX: 40,
      toY: 50,
      aspectRatio: 1,
    };
    timeline.prepare(event, actors[0], [actors[1]]);
    const finish = at + Math.max(...timing[effect].map(([delay]) => delay));
    timeline.advance([event], actors, finish, (actor, time) => combat.advance(actor, time));
    const damage = event.hits.reduce((sum, hit) => sum + hit.damage, 0);
    timeline.advance([event], actors, finish, (actor, time) => combat.advance(actor, time));
    assert.equal(
      event.hits.reduce((sum, hit) => sum + hit.damage, 0),
      damage,
    );
    at = finish + 1600;
    return damage;
  }
  return { actors, cast };
}
test('ordinary combos trade direct damage for per-impact energy, including delayed salvos', () => {
  const totals = { 1: 200000, 2: 180000, 3: 160000 };
  for (const effect of ordinary) {
    const f = fixture(),
      hits = timing[effect.id].length;
    assert.equal(f.cast(effect.id), totals[hits], effect.id);
    assert.equal(f.actors[0].energy, hits * 10, effect.id);
    assert.equal(f.actors[1].energy, hits * 5, effect.id);
  }
});
test('a complete ordinary-combo charge plus one standard R stays within 10 percent per cast across hit counts', () => {
  for (const effect of ordinary) {
    const f = fixture();
    let casts = 0,
      damage = 0;
    while (f.actors[0].energy < 100) {
      damage += f.cast(effect.id);
      casts++;
      assert.ok(casts <= 10, effect.id);
    }
    assert.equal(casts, { 1: 10, 2: 5, 3: 4 }[timing[effect.id].length], effect.id);
    energy.check(f.actors[0], 'r', 'bijuu_beam');
    energy.spend(f.actors[0], 'r');
    const ultimate = f.cast('bijuu_beam');
    assert.equal(ultimate, 400000);
    assert.equal(f.actors[0].energy, 0, 'R must not fund another R');
    assert.ok(Math.abs((damage + ultimate) / casts - 240000) <= 24000, effect.id);
  }
});
test('combo reduction composes with author, critical and shield multipliers exactly once', () => {
  for (const effect of ordinary) {
    let values = [];
    const combat = createSceneCombat(
      () => values.shift() ?? 0.5,
      (id) => id === 'a',
    );
    const a = { id: 'a' },
      b = { id: 'b' };
    combat.advance(a, 0);
    combat.advance(b, 0);
    combat.protect(b, 0);
    let damage = 0;
    for (const [, weight, phase] of timing[effect.id]) {
      values = [0.5, 0, 0.5];
      const hit = combat.hit(a, b, 100, effect.id, weight, phase);
      assert.equal(hit.critical, true);
      damage += hit.damage;
    }
    assert.ok(
      Math.abs(damage - { 1: 224250, 2: 201825, 3: 179400 }[timing[effect.id].length]) <= 2,
      effect.id,
    );
  }
});

test('single, two and three-hit builds have equal damage plus energy value when both opponents earn received-hit energy', () => {
  for (const left of ordinary)
    for (const right of ordinary) {
      const combat = createSceneCombat(() => 0.5),
        timeline = createAttackTimeline(combat);
      const actors = [
        { id: 'a', x: 20, y: 50 },
        { id: 'b', x: 40, y: 50 },
      ];
      actors.forEach((actor) => combat.advance(actor, 0));
      const events = [left, right].map((effect, i) => {
        const from = actors[i],
          to = actors[1 - i];
        const event = {
          id: String(i),
          effect: effect.id,
          at: 0,
          fromId: from.id,
          fromX: from.x,
          fromY: from.y,
          toId: to.id,
          toX: to.x,
          toY: to.y,
          aspectRatio: 1,
        };
        timeline.prepare(event, from, [to]);
        return event;
      });
      timeline.advance(events, actors, 2200, (actor, time) => combat.advance(actor, time));
      const budgets = events.map(
        (event, i) =>
          event.hits.reduce((n, hit) => n + hit.damage, 0) + (400000 * actors[i].energy) / 100,
      );
      assert.ok(Math.abs(budgets[0] - budgets[1]) <= 2, `${left.id} vs ${right.id}: ${budgets}`);
      assert.equal(actors[0].energy, timing[left.id].length * 10 + timing[right.id].length * 5);
      assert.equal(actors[1].energy, timing[right.id].length * 10 + timing[left.id].length * 5);
    }
});
