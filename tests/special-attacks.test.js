'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { selectAttackTargets } = require('../src/rooms/attack-targets');
function fixture(
  effect,
  {
    from = { x: 20, y: 50 },
    to = { x: 45, y: 50 },
    aspectRatio = 1,
    policy = {},
    walls = null,
  } = {},
) {
  const actors = [
    { id: 'a', ...from },
    { id: 'b', ...to },
    { id: 'c', x: 65, y: 70 },
  ];
  const combat = createSceneCombat(() => 0.5, undefined, policy),
    timeline = createAttackTimeline(combat, undefined, () => walls);
  actors.forEach((a) => combat.advance(a, 100));
  const event = {
    effect,
    id: 'one',
    at: 100,
    fromId: 'a',
    fromX: from.x,
    fromY: from.y,
    toId: 'b',
    toX: to.x,
    toY: to.y,
    aspectRatio,
  };
  combat.cast(actors[0], effect, 100);
  timeline.prepare(event, actors[0], selectAttackTargets(actors[0], actors, effect, aspectRatio));
  const advance = (t) => timeline.advance([event], actors, t, (a, time) => combat.advance(a, time));
  return { actors, combat, timeline, event, advance };
}
for (const suffix of ['', '_alt']) {
  test(
    'hero' +
      suffix +
      ' locks landing, hits actual entrants once, shields self and knocks up survivors',
    () => {
      const f = fixture('gate_of_heroes' + suffix),
        [a, b, c] = f.actors;
      assert.equal(a.shieldUntil, 2100);
      assert.throws(() => f.combat.canCast(a, 2000));
      assert.deepEqual(f.event.hits, []);
      b.x = 95;
      c.x = 46;
      c.y = 51;
      f.advance(2199);
      assert.equal(c.health, 1200000);
      f.advance(2200);
      assert.equal(a.x, 45);
      assert.equal(a.y, 50);
      assert.equal(a.heroFlightUntil, 0);
      assert.deepEqual(
        f.event.hits.map((h) => h.toId),
        ['c'],
      );
      assert.equal(c.health, 800000);
      assert.equal(c.immobileUntil, 3200);
      assert.equal(c.knockback.durationMs, 1000);
      f.advance(2200);
      assert.equal(c.health, 800000);
    },
  );
  test(
    'shaohua' +
      suffix +
      ' follows moving target and bites exactly 400ms after real contact, ignoring shields',
    () => {
      const f = fixture('shaohua_devour' + suffix, { to: { x: 40, y: 50 } }),
        [a, b] = f.actors;
      f.combat.protect(b, 100);
      f.advance(300);
      assert.equal(b.health, 1200000);
      assert.ok(f.event.head.x > 20);
      b.y = 54;
      f.advance(800);
      assert.ok(f.event.head.y > 50);
      let time = 800;
      while (!f.event.head.contactAt && time < 3100) f.advance((time += 50));
      const contact = f.event.head.contactAt,
        bite = f.event.head.biteAt;
      assert.equal(bite - contact, 400);
      f.advance(100 + bite - 1);
      assert.equal(b.health, 1200000);
      f.advance(100 + bite);
      assert.equal(b.health, 1);
      assert.equal(b.respawnAt, 0);
      assert.equal(a.kda.kills, 0);
      assert.equal(f.event.hits[0].damage, 1199999);
      f.advance(100 + bite);
      assert.equal(a.kda.kills, 0);
      assert.equal(f.event.hits[0].delayMs, bite);
    },
  );
  test(
    'reaper' +
      suffix +
      ' costs current hp, seals attack and teleport but allows walking, and expires',
    () => {
      const f = fixture('reaper_seal' + suffix),
        [a, b] = f.actors;
      assert.equal(a.health, 960000);
      f.advance(2699);
      assert.equal(b.health, 1200000);
      f.advance(2700);
      assert.equal(b.health, 800000);
      assert.equal(b.sealedUntil, 4700);
      assert.throws(() => f.combat.canCast(b, 4699), { code: 'SCENE_SEALED' });
      assert.doesNotThrow(() => f.combat.canMove(b, 2800));
      assert.doesNotThrow(() => f.combat.canCast(b, 4700));
    },
  );
}
test('hero cancels on death, new life or caster removal; homing retargets without expiring when a victim disappears', () => {
  for (const mode of ['dead', 'life', 'left']) {
    const f = fixture('gate_of_heroes'),
      a = f.actors[0],
      before = f.actors[1].health;
    if (mode === 'dead') a.health = 0;
    else if (mode === 'life') a.lifeId++;
    else f.actors.shift();
    f.advance(2200);
    assert.equal(f.event.cancelled, true);
    assert.equal(f.actors.find((x) => x.id === 'b').health, before);
  }
  for (const mode of ['left', 'life', 'range', 'dead']) {
    const f = fixture('shaohua_devour'),
      b = f.actors[1];
    if (mode === 'left') f.actors.splice(1, 1);
    else if (mode === 'life') b.lifeId++;
    else if (mode === 'range') b.x = 99;
    else b.health = 0;
    f.advance(200);
    assert.equal(f.event.head.cancelled, false);
    assert.equal(f.event.hits.length, 0);
  }
});

test('homing expires at three seconds, costs half current HP once, and never resumes', () => {
  const f = fixture('shaohua_devour');
  const [caster, target, other] = f.actors;
  target.x = 99;
  other.x = 97;
  f.advance(1100);
  assert.ok(f.event.head.x > 28.9 && f.event.head.x < 29.1);
  f.actors.splice(1);
  caster.health = 800000;
  caster.lastHitAt = 1100;
  f.advance(3099);
  assert.equal(f.event.head.cancelled, false);
  assert.equal(caster.health, 800000);
  f.advance(3100);
  assert.equal(f.event.until, 3950);
  assert.equal(f.event.head.cancelled, true);
  assert.equal(f.event.head.exploded, true);
  assert.equal(f.event.head.at, 3000);
  assert.equal(caster.health, 400000);
  f.advance(3200);
  assert.equal(caster.health, 400000);
  assert.equal(f.event.hits.length, 0);
});

test('a bite finishing exactly at three seconds counts as success', () => {
  const f = fixture('shaohua_devour', { to: { x: 46.25, y: 50 } });
  const [caster, target] = f.actors;
  f.advance(3100);
  assert.equal(f.event.head.finished, true);
  assert.equal(f.event.head.exploded, undefined);
  assert.equal(f.event.hits[0].delayMs, 3000);
  assert.equal(target.health, 1);
  assert.equal(caster.health, 1200000);
});

test('a recast replaces the previous homing entity and caster departure cancels it', () => {
  const f = fixture('shaohua_devour');
  const next = { ...f.event, id: 'replacement', at: 1700, head: undefined };
  f.timeline.prepare(next, f.actors[0], [f.actors[1]]);
  assert.equal(f.event.head.cancelled, true);
  assert.equal(f.actors[0].health, 600000);
  assert.equal(f.event.hits.length, 0);
  f.actors.shift();
  f.timeline.advance([f.event, next], f.actors, 1800, (actor, time) =>
    f.combat.advance(actor, time),
  );
  assert.equal(next.head.cancelled, true);
  assert.equal(next.head.exploded, undefined);
  assert.equal(next.hits.length, 0);
});

test('normal walking outruns the head in every direction and aspect until it expires', () => {
  const { sceneWalk } = require('../frontend/src/engines/scene-path.js');
  const { sceneDistance } = require('../src/rooms/scene-combat');
  for (const aspectRatio of [16 / 9, 9 / 16])
    for (const direction of ['horizontal', 'vertical', 'diagonal']) {
      const from =
        direction === 'horizontal'
          ? { x: 20, y: 45 }
          : direction === 'vertical'
            ? { x: 45, y: 20 }
            : { x: 20, y: 20 };
      const to = { x: 45, y: 45 };
      const goal =
        direction === 'horizontal'
          ? { x: 95, y: 45 }
          : direction === 'vertical'
            ? { x: 45, y: 95 }
            : { x: 95, y: 95 };
      const f = fixture('shaohua_devour', { from, to, aspectRatio }),
        victim = f.actors[1];
      const initialGap = sceneDistance(from, to, aspectRatio);
      for (let time = 150; time < 3100; time += 50) {
        const step = sceneWalk(victim, goal, 50);
        victim.x = step.x;
        victim.y = step.y;
        f.advance(time);
      }
      assert.equal(f.event.head.contactAt, 0, direction + ' ' + aspectRatio);
      assert.ok(
        sceneDistance(f.event.head, victim, aspectRatio) > initialGap,
        'running increases the gap',
      );
      const playerTravel = sceneDistance(to, victim, aspectRatio),
        headTravel = sceneDistance(from, f.event.head, aspectRatio);
      assert.ok(
        Math.abs(headTravel / playerTravel - 0.75) < 0.001,
        'head walks at 75% of the same character path',
      );
      f.advance(3100);
      assert.equal(f.event.head.cancelled, true);
      assert.equal(victim.health, 1200000);
      assert.equal(victim.respawnAt, 0);
      assert.equal(f.actors[0].kda.kills, 0);
    }
});

test('devour cannot finish a 1 HP player, even with author bonuses and shields; regeneration still resumes', () => {
  const f = fixture('shaohua_devour'),
    [caster, victim] = f.actors;
  caster.authorBonus = true;
  victim.health = 1;
  f.combat.protect(victim, 100);
  const result = f.combat.hit(caster, victim, 200, 'shaohua_devour_alt');
  assert.equal(result.damage, 0);
  assert.equal(result.critical, false);
  assert.equal(victim.health, 1);
  assert.equal(victim.respawnAt, 0);
  assert.equal(caster.kda.kills, 0);
  f.combat.advance(victim, 2199);
  assert.equal(victim.health, 1);
  f.combat.advance(victim, 3200);
  assert.ok(victim.health > 1);
});
test('tech single-target phases follow the ordinary combo budget with no status effects', () => {
  for (const kind of ['railgun', 'plasma_pulse', 'micro_missiles', 'photon_sniper'])
    for (const suffix of ['', '_alt']) {
      const f = fixture(kind + suffix),
        b = f.actors[1];
      f.advance(1700);
      const damage = {
        railgun: 210000,
        plasma_pulse: 180000,
        micro_missiles: 140000,
        photon_sniper: 210000,
      }[kind];
      assert.equal(b.health, 1200000 - damage, kind + suffix);
      assert.equal(b.sealedUntil, 0);
      assert.equal(b.immobileUntil, 0);
      assert.equal(
        f.event.hits.reduce((n, h) => n + h.damage, 0),
        damage,
      );
      assert.equal(f.actors[2].health, 1200000);
    }
});

test('reaper publishes and settles separate seals for all selected victims', () => {
  const f = fixture('reaper_seal');
  f.actors[2].x = 55;
  f.actors[2].y = 55;
  f.timeline.prepare(
    f.event,
    f.actors[0],
    selectAttackTargets(f.actors[0], f.actors, 'reaper_seal', 1),
  );
  assert.deepEqual(
    f.event.hits.map((h) => h.toId),
    ['b', 'c'],
  );
  assert.ok(f.event.hits.every((h) => h.pending && h.damage === 0));
  f.advance(2700);
  assert.deepEqual(
    f.event.hits.map((h) => h.toId),
    ['b', 'c'],
  );
  assert.ok(f.event.hits.every((h) => !h.pending && h.damage > 0));
  assert.ok(f.actors.slice(1).every((a) => a.sealedUntil === 4700));
});

test('hero excludes protected actors before the target cap and cannot land after the cast scope closes', () => {
  const policy = {
    canHit: (_, target) => target.id === 'b',
    canContinueCast: (_, __, time) => time < 3000,
  };
  const active = fixture('gate_of_heroes', { policy });
  active.actors[2].x = 45;
  active.actors[2].y = 50;
  active.advance(2200);
  assert.deepEqual(
    active.event.hits.map((hit) => hit.toId),
    ['b'],
  );
  assert.equal(active.actors[2].immobileUntil, 0);

  const expired = fixture('gate_of_heroes', {
    policy: { ...policy, canContinueCast: () => false },
  });
  expired.advance(2200);
  assert.equal(expired.actors[0].x, 20);
  assert.equal(expired.event.cancelled, true);
  assert.deepEqual(expired.event.hits, []);
});

test('arena devour follows wall corners and bites only after a clear approach', () => {
  const { createWalls } = require('../src/rooms/walls');
  const walls = createWalls(1);
  const from = { x: 20, y: 81 };
  const to = { x: 20, y: 92 };
  assert.equal(walls.clear(from, to), false);
  const f = fixture('shaohua_devour_alt', { from, to, walls });
  let previous = from;
  let roundedCorner = false;
  for (let t = 150; t <= 4100 && !f.event.head.finished; t += 50) {
    f.advance(t);
    const head = f.event.head;
    assert.ok(walls.clear(previous, head));
    if (Math.abs(head.x - from.x) > 3) roundedCorner = true;
    previous = { x: head.x, y: head.y };
  }
  assert.ok(roundedCorner);
  assert.equal(f.event.hits[0]?.toId, 'b');
});
