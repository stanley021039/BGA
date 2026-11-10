const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { attackKind } = require('../src/rooms/attack-kind');
const { fitsSlot } = require('../src/rooms/scene-energy');
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
  random = () => 0.5,
) {
  const combat = createSceneCombat(random),
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
  return { points, event, advance, fastUpdates: (t) => timeline.needsFastUpdates([event], t) };
}
test('every current offensive attack has a bounded authoritative arrival, no eager damage, and no duplicate settlement', () => {
  for (const definition of definitions.filter(
    (e) =>
      e.damageMultiplier !== 0 &&
      !['gate_of_heroes', 'shaohua_devour', 'susanoo'].includes(e.variantOf || e.id),
  )) {
    const f = fixture(definition.id);
    const first = Math.min(
      ...f.event.hits.filter((h) => h.phase !== 'stasis').map((h) => h.delayMs),
    );
    assert.ok(first > 0 && first <= 4100, definition.id);
    f.advance(first - 1);
    assert.equal(f.points[1].health, 1200000, definition.id);
    f.advance(first);
    assert.ok(f.points[1].health < 1200000, definition.id);
    const health = f.points[1].health;
    f.advance(first);
    assert.equal(f.points[1].health, health);
  }
  assert.deepEqual(
    Object.keys(timing).sort(),
    definitions
      .filter((e) => !('paletteHue' in e) && !e.rewardOf)
      .map((e) => e.id)
      .sort(),
  );
});
test('Susanoo follows the caster for five seconds, rechecking nearby opponents for every sweep', () => {
  const combat = createSceneCombat(() => 0.5);
  const timeline = createAttackTimeline(combat);
  const [caster, near, entering, far] = [20, 30, 58, 96].map((x, index) => ({
    id: String(index),
    x,
    y: 50,
  }));
  const actors = [caster, near, entering, far];
  actors.forEach((actor) => combat.advance(actor, 0));
  const effect = 'susanoo_alt';
  assert.deepEqual(selectAttackTargets(caster, [caster], effect, 1), [caster]);
  const event = {
    effect,
    at: 0,
    fromId: caster.id,
    fromX: caster.x,
    fromY: caster.y,
    toId: caster.id,
    toX: caster.x,
    toY: caster.y,
    aspectRatio: 1,
  };
  timeline.prepare(event, caster, [caster]);
  const advance = (at) => timeline.advance([event], actors, at, combat.advance);
  assert.equal(event.until, 5000);
  assert.equal(combat.view(caster).summon.effect, effect);
  advance(1000);
  assert.deepEqual(
    event.hits.map((h) => h.toId),
    [near.id],
  );
  caster.x = 64;
  advance(2450);
  advance(3900);
  assert.deepEqual(
    event.hits.map((h) => h.toId),
    [near.id, entering.id, entering.id],
  );
  assert.equal(event.hits[1].aimX, 64);
  assert.equal(caster.health, 1200000);
  advance(4999);
  assert.equal(combat.view(caster).summon.remainingMs, 1);
  advance(5000);
  assert.equal(combat.view(caster).summon, undefined);
});
test('black coffin blacks out only each hit player’s own view for two seconds and keeps controls enabled', () => {
  const combat = createSceneCombat(() => 0.5);
  const timeline = createAttackTimeline(combat);
  const [caster, a, b] = [20, 32, 44].map((x, index) => ({ id: String(index), x, y: 50 }));
  const actors = [caster, a, b];
  actors.forEach((actor) => combat.advance(actor, 0));
  const event = {
    effect: 'black_coffin_alt',
    at: 0,
    fromId: caster.id,
    fromX: caster.x,
    fromY: caster.y,
    toId: a.id,
    toX: a.x,
    toY: a.y,
    aspectRatio: 1,
  };
  timeline.prepare(event, caster, [a, b]);
  const advance = (at) => timeline.advance([event], actors, at, combat.advance);
  advance(1660);
  for (const target of [a, b]) {
    assert.equal(combat.view(target, true).blackoutUntil, 3660);
    assert.equal(combat.view(target).blackoutUntil, undefined);
    combat.canMove(target, 1660);
    combat.canCast(target, 1660);
  }
  assert.equal(combat.view(caster, true).blackoutUntil, undefined);
  advance(2790);
  assert.equal(combat.view(a, true).blackoutUntil, 3660);
  advance(3660);
  assert.equal(combat.view(a, true).blackoutUntil, undefined);
});
test('crystal blocks eligible stages and returns multiple stages only to the first attacker', () => {
  const combat = createSceneCombat(() => 0.5);
  const timeline = createAttackTimeline(combat);
  const actors = [
    { id: 'a', x: 20, y: 50 },
    { id: 'b', x: 40, y: 50 },
    { id: 'c', x: 60, y: 50 },
  ];
  const [a, b, c] = actors;
  actors.forEach((actor) => combat.advance(actor, 0));
  const makeEvent = (effect, from, to, at) => ({
    effect,
    at,
    fromId: from.id,
    toId: to.id,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    aspectRatio: 1,
    until: at + 1800,
  });
  const cast = makeEvent('tidal_blades_alt', a, b, 0);
  const other = makeEvent('returning_moon', c, b, 0);
  const guardB = makeEvent('crystal_reflection_alt', b, b, 0);
  timeline.prepare(cast, a, [b]);
  timeline.prepare(other, c, [b]);
  timeline.armReflection(guardB, b);
  const events = [cast, guardB, other];
  const advance = (at) => timeline.advance(events, actors, at, combat.advance);
  advance(799);
  assert.equal(guardB.hits[0].pending, true);
  assert.equal(guardB.hits[0].delayMs, 1930);
  assert.equal(guardB.hits[0].reflectedEffect, 'tidal_blades_alt');
  assert.equal(guardB.hits[0].reflectedPhase, 'hit1');
  assert.equal(a.health, 1200000);
  assert.equal(b.health, 1200000);
  assert.deepEqual(
    guardB.hits.map(({ toId, reflectionIndex, delayMs }) => [toId, reflectionIndex, delayMs]),
    [
      ['a', 0, 1930],
      ['a', 1, 2290],
    ],
  );
  assert.equal(other.hits[0].pending, false);
  assert.equal(other.hits[0].damage, 0);
  assert.deepEqual(
    cast.hits.map((hit) => [hit.pending, hit.damage]),
    [
      [false, 0],
      [false, 0],
    ],
  );
  advance(1500);
  a.x = 90;
  const guardA = makeEvent('crystal_reflection', a, a, 1500);
  timeline.armReflection(guardA, a);
  events.push(guardA);
  advance(1929);
  assert.equal(a.health, 1200000);
  assert.equal(guardB.hits[0].toX, 90);
  advance(1930);
  assert.equal(guardA.hits.length, 0);
  assert.equal(guardB.hits[0].toX, 90);
  assert.equal(a.health, 1110000);
  assert.equal(b.health, 1200000);
  advance(2290);
  assert.equal(guardA.hits.length, 0);
  assert.equal(a.health, 1020000);
  assert.equal(c.health, 1200000);
  advance(2290);
  assert.equal(a.health, 1020000);

  // A late poll should settle an already-due return in chronological order.
  a.x = 20;
  const expired = makeEvent('crystal_reflection', a, a, 2500);
  const straightBeam = makeEvent('beam', b, a, 2600);
  const lateProjectile = makeEvent('barrage', b, a, 2850);
  const armedAgain = makeEvent('crystal_reflection', b, b, 2500);
  const earlyProjectile = makeEvent('barrage', a, b, 2550);
  timeline.armReflection(expired, a);
  timeline.armReflection(armedAgain, b);
  timeline.prepare(straightBeam, b, [a]);
  timeline.prepare(lateProjectile, b, [a]);
  timeline.prepare(earlyProjectile, a, [b]);
  events.push(expired, straightBeam, lateProjectile, armedAgain, earlyProjectile);
  advance(4500);
  assert.ok(straightBeam.hits[0].damage > 0);
  assert.ok(lateProjectile.hits[0].damage > 0, 'a hit at the exact expiry is outside the guard');
  assert.equal(expired.hits.length, 0);
  assert.equal(armedAgain.hits[0].pending, false);
  assert.ok(armedAgain.hits[0].damage > 0);
});
test('Babylon/Ea has a double-strength second stage; the two dragoon salvos share the balanced combo total', () => {
  for (const [effect, first, last, total] of [
    ['gate_of_babylon', 2400, 3880, 843478],
    ['funnel', 1320, 2120, 180000],
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
test('time stop locks nearby opponents until one shared release without damaging the caster', () => {
  const combat = createSceneCombat(() => 0.5);
  const timeline = createAttackTimeline(combat);
  const [a, b, c, far] = [20, 30, 40, 90].map((x, index) => ({ id: String(index), x, y: 50 }));
  const actors = [a, b, c, far];
  actors.forEach((actor) => combat.advance(actor, 0));
  const event = {
    effect: 'world_stasis_alt',
    at: 0,
    fromId: a.id,
    fromX: a.x,
    fromY: a.y,
    toId: b.id,
    toX: b.x,
    toY: b.y,
    aspectRatio: 1,
  };
  timeline.prepare(event, a, selectAttackTargets(a, actors, event.effect, 1));
  const advance = (at) => timeline.advance([event], actors, at, combat.advance);
  advance(850);
  for (const target of [b, c]) {
    assert.equal(target.health, 1200000);
    assert.throws(() => combat.canMove(target, 849 + 1), { code: 'SCENE_IMMOBILIZED' });
    assert.throws(() => combat.canCast(target, 2249), { code: 'SCENE_SEALED' });
  }
  for (const target of [a, far]) combat.canMove(target, 850);
  advance(2250);
  for (const target of [b, c]) {
    combat.canCast(target, 2250);
    assert.equal(target.health, 800000);
  }
  assert.equal(far.health, 1200000);
});
test('malice detonates at its current caster location and includes a nearby late entrant', () => {
  const combat = createSceneCombat(() => 0.5);
  const timeline = createAttackTimeline(combat);
  const [a, original, entrant, far] = [10, 24, 88, 12].map((x, index) => ({
    id: String(index),
    x,
    y: index === 3 ? 95 : 50,
  }));
  const actors = [a, original, entrant, far];
  actors.forEach((actor) => combat.advance(actor, 0));
  const event = {
    effect: 'human_malice',
    at: 0,
    fromId: a.id,
    fromX: a.x,
    fromY: a.y,
    toId: original.id,
    toX: original.x,
    toY: original.y,
    aspectRatio: 1,
  };
  timeline.prepare(event, a, selectAttackTargets(a, actors, event.effect, 1));
  timeline.advance([event], actors, 1569, combat.advance);
  assert.equal(original.health, 1200000);
  timeline.advance([event], actors, 1570, combat.advance);
  assert.deepEqual(
    event.hits.filter((hit) => hit.toId === original.id && hit.damage > 0).map((hit) => hit.phase),
    ['salvo'],
  );
  assert.equal(original.health, 980000);
  a.x = 80;
  timeline.advance([event], actors, 3310, combat.advance);
  assert.equal(entrant.health, 1020000);
  assert.equal(a.health, 1200000);
  assert.equal(original.health, 980000);
  assert.equal(event.hits.find((hit) => hit.phase === 'detonation').aimX, 80);
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

test('new attack palettes use identical slots, targets, timing and settlement as their originals', () => {
  const actors = [
    { id: 'a', x: 20, y: 50, health: 1 },
    { id: 'b', x: 40, y: 50, health: 1 },
  ];
  const snapshot = ({ effect, ...event }) => event;
  const gameplay = ({ summon, ...actor }) => ({ ...actor, summon: summon?.until });
  const random = () => 0.1;
  for (const { id, variantOf } of definitions.filter((e) => 'paletteHue' in e || e.rewardOf)) {
    assert.equal(attackKind(id), variantOf);
    for (const slot of ['q', 'e', 'r'])
      assert.equal(fitsSlot(slot, id), fitsSlot(slot, variantOf), id);
    assert.deepEqual(
      selectAttackTargets(actors[0], actors, id, 1),
      selectAttackTargets(actors[0], actors, variantOf, 1),
      id,
    );
    if (['shield', 'sphere'].includes(variantOf)) continue;
    const original = fixture(variantOf, undefined, random),
      alternate = fixture(id, undefined, random);
    assert.deepEqual(snapshot(alternate.event), snapshot(original.event), id);
    for (const time of [600, 1300, 2400, 4400, 7400]) {
      original.advance(time);
      alternate.advance(time);
      assert.deepEqual(snapshot(alternate.event), snapshot(original.event), id);
      assert.deepEqual(alternate.points.map(gameplay), original.points.map(gameplay), id);
      if (original.points[0].summon) assert.equal(alternate.points[0].summon?.effect, id);
      assert.equal(alternate.fastUpdates(time), original.fastUpdates(time), id);
    }
  }
});

test('black hole pulls only on a landed final hit and leaves ongoing movement available', () => {
  const hit = fixture('singularity');
  const victim = hit.points[1];
  victim.targetX = 48;
  victim.targetY = 50;
  hit.advance(850);
  assert.equal(victim.x, 40);
  hit.advance(1250);
  assert.equal(victim.x, 35);
  assert.equal(victim.targetX, 48);
  assert.equal(victim.immobileUntil, 0);
  hit.advance(1250);
  assert.equal(victim.x, 35);

  const dodged = fixture('singularity');
  dodged.advance(850);
  dodged.points[1].x = 80;
  dodged.advance(1250);
  assert.equal(dodged.event.hits.at(-1).missed, true);
  assert.equal(dodged.points[1].x, 80);
});

test('missile casts cap attacker energy after three real hits, including an earlier miss', () => {
  for (const effect of ['micro_missiles', 'micro_missiles_alt']) {
    const full = fixture(effect);
    full.advance(1600);
    assert.equal(full.points[0].energy, 30);
    assert.equal(full.points[1].energy, 20);

    const partial = fixture(effect);
    partial.points[1].x = 80;
    partial.advance(850);
    partial.points[1].x = 40;
    partial.advance(1600);
    assert.equal(partial.event.hits[0].missed, true);
    assert.equal(partial.points[0].energy, 30);
    assert.equal(partial.points[1].energy, 15);
  }
});

test('both whip palettes settle two strikes on the original target', () => {
  for (const effect of ['venom_thorn', 'venom_thorn_alt']) {
    const f = fixture(effect);
    const [, target, neighbor] = f.points;
    f.advance(649);
    assert.equal(target.health, 1200000);
    f.advance(650);
    const afterFirst = target.health;
    assert.ok(afterFirst < 1200000);
    neighbor.x = 26;
    f.advance(929);
    assert.equal(target.health, afterFirst);
    f.advance(930);
    assert.ok(target.health < afterFirst);
    assert.equal(neighbor.health, 1200000);
    assert.deepEqual(
      f.event.hits.map(({ phase, toId }) => [phase, toId]),
      [
        ['hit1', 'b'],
        ['hit2', 'b'],
      ],
    );
  }
});

test('sakura waves track the original target in range and never jump to a nearer opponent', () => {
  for (const effect of ['sakura_swarm', 'sakura_swarm_alt']) {
    const f = fixture(effect);
    const [, target, neighbor] = f.points;
    f.advance(539);
    assert.equal(target.health, 1200000);
    target.x = 46;
    neighbor.x = 26;
    f.advance(540);
    assert.equal(f.event.hits[0].toX, 46);
    target.x = 90;
    f.advance(760);
    assert.equal(f.event.hits[1].missed, true);
    target.x = 36;
    f.advance(1030);
    assert.equal(f.event.hits[2].toX, 36);
    assert.deepEqual(
      f.event.hits.map((hit) => hit.toId),
      ['b', 'b', 'b'],
    );
    assert.equal(neighbor.health, 1200000);
  }
});
test('Starburst locks one life for sixteen strikes and halves the target energy once', () => {
  const f = fixture('starburst_stream');
  const [, target, neighbor] = f.points;
  target.energy = 75;
  f.advance(759);
  assert.equal(target.energy, 75);
  f.advance(760);
  assert.equal(target.energy, 37);
  target.x = 99;
  f.advance(2330);
  assert.equal(f.event.hits.length, 16);
  assert.deepEqual(
    f.event.hits.map((hit) => hit.phase),
    Array.from({ length: 16 }, (_, i) => 'slash' + (i + 1)),
  );
  assert.ok(f.event.hits.every((hit) => hit.toId === target.id && hit.damage > 0));
  assert.equal(target.energy, 37);
  assert.equal(neighbor.health, 1200000);
});

test('Rainbow Bear holds one target for three seconds and reduces its outgoing damage during the mark', () => {
  const f = fixture('rainbow_bear');
  const [caster, target, neighbor] = f.points;
  const combat = createSceneCombat(() => 0.5);
  const hugAt = timing.rainbow_bear[0][0];
  const expires = hugAt + 3000;
  f.advance(hugAt - 1);
  assert.equal(target.health, 1200000);
  f.advance(hugAt);
  assert.equal(target.kissedUntil, expires);
  target.x = 98;
  const reduced = combat.hit(target, caster, hugAt + 50, 'beam').damage;
  const normal = combat.hit(target, caster, expires, 'beam').damage;
  assert.equal(reduced, Math.round(normal * 0.7));
  f.advance(expires);
  assert.ok(f.event.hits.every((hit) => hit.toId === target.id && hit.damage > 0));
  assert.equal(neighbor.health, 1200000);
  assert.equal(combat.view(target).kissedUntil, undefined);
});

test('Zero Equation is nonlethal, accepts only the current correct answer, and hides it from others', () => {
  const f = fixture('zero_equation');
  const [caster, target, neighbor] = f.points;
  const combat = createSceneCombat(() => 0.5);
  const timeline = createAttackTimeline(combat);
  const second = { ...f.event, id: 'second', fromId: neighbor.id, fromX: neighbor.x, at: 10 };
  timeline.prepare(second, neighbor, [target]);
  target.health = 10;
  const hitAt = timing.zero_equation[0][0];
  f.advance(hitAt - 1);
  assert.equal(target.health, 10);
  assert.equal(combat.view(target, true).equation, undefined);
  f.advance(hitAt);
  assert.equal(target.health, 1);
  assert.equal(combat.view(target).equation, undefined);
  const question = combat.view(target, true).equation;
  assert.equal(question.id, 'cast');
  assert.equal(question.prompt, '5 × (10 − 5) + 25 ÷ 5');
  assert.equal(new Set(question.options).size, 5);
  assert.ok(question.options.includes(30));
  assert.equal(combat.view(target).equationLocked, true);
  assert.throws(() => combat.canMove(target, hitAt), { code: 'SCENE_EQUATION_LOCKED' });
  assert.throws(() => combat.canTeleport(target, hitAt), { code: 'SCENE_EQUATION_LOCKED' });
  timeline.advance([second], f.points, hitAt + 10, (actor, time) => combat.advance(actor, time));
  assert.equal(second.hits[0].missed, true);
  assert.throws(() => combat.solveEquation(target, 'second', 30), {
    code: 'SCENE_EQUATION_EXPIRED',
  });
  assert.throws(() => combat.solveEquation(target, 'cast', 29, hitAt + 10), {
    code: 'SCENE_EQUATION_WRONG',
  });
  assert.equal(target.health, 1);
  combat.solveEquation(target, 'cast', 30);
  combat.canMove(target, hitAt + 20);
  assert.equal(combat.view(target, true).equation, undefined);
  assert.equal(combat.view(target).equationLocked, undefined);
  assert.equal(caster.health, 1200000);
});

test('Zero Equation uses multiplication and division precedence and reduced impact damage', () => {
  const combat = createSceneCombat(() => 0.25);
  const attacker = { id: 'caster' },
    target = { id: 'target' };
  combat.advance(attacker, 0);
  combat.advance(target, 0);
  combat.trapEquation(target, 'precedence');
  const { prompt, options } = combat.view(target, true).equation;
  assert.equal(prompt, '3 + 3 × 3 − 9 ÷ 3');
  assert.equal(new Set(options).size, 5);
  assert.ok(options.includes(9));
  combat.solveEquation(target, 'precedence', 9, 0);
  assert.equal(combat.hit(attacker, target, 0, 'zero_equation').damage, 304000);
});
