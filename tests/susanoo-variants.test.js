const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createSceneCombat, authorSpeed } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
function fixture(effect, x = 30) {
  const actors = [
      { id: 'caster', x: 20, y: 50 },
      { id: 'target', x, y: 50 },
    ],
    present = new Set(actors);
  const combat = createSceneCombat(
    () => 0.99,
    () => false,
    { sourcePresent: (actor) => present.has(actor) },
  );
  for (const actor of actors) {
    combat.reset(actor, 0);
    actor.baseMaxHealth = actor.maxHealth = actor.health = 10000000;
  }
  const timeline = createAttackTimeline(combat),
    event = {
      id: 'cast',
      effect,
      at: 0,
      fromId: 'caster',
      fromX: 20,
      fromY: 50,
      toX: 20,
      toY: 50,
      aspectRatio: 1.6,
      slot: 'r',
    };
  timeline.prepare(event, actors[0], [actors[0]], actors);
  return {
    actors,
    present,
    combat,
    event,
    advance: (at) =>
      timeline.advance([event], actors, at, (actor, time) => combat.advance(actor, time)),
  };
}
test('Sasuke applies two energy-neutral burn ticks once per victim per cast', () => {
  const f = fixture('susanoo'),
    [caster, target] = f.actors;
  f.advance(1000);
  assert.equal(target.amaterasuDot.remaining, 2);
  const energy = caster.energy,
    health = target.health;
  f.advance(1999);
  assert.equal(target.health, health);
  f.advance(2000);
  assert.ok(target.dotPulse.damage > 0);
  assert.equal(caster.energy, energy);
  f.advance(3000);
  assert.equal(target.amaterasuDot, null);
  f.advance(3900);
  assert.equal(target.amaterasuDot, null, 'later sweeps cannot restart this cast burn');
});
test('burn cancels when its source leaves or changes life', () => {
  for (const leave of [true, false]) {
    const f = fixture('susanoo'),
      [caster, target] = f.actors;
    f.advance(1000);
    if (leave) {
      f.present.delete(caster);
      f.actors.shift();
    } else f.combat.reset(caster, 1500);
    f.advance(2000);
    assert.equal(target.amaterasuDot, null);
  }
});
test('Itachi guards only while summoned and seals on the last sweep', () => {
  const guarded = fixture('susanoo_orange'),
    plain = fixture('susanoo_alt');
  const hit = (f) => f.combat.hit(f.actors[1], f.actors[0], 500, 'beam').damage;
  assert.equal(hit(guarded), Math.round(hit(plain) * 0.8));
  const endHit = guarded.combat.hit(guarded.actors[1], guarded.actors[0], 5000, 'beam').damage;
  assert.equal(endHit, plain.combat.hit(plain.actors[1], plain.actors[0], 5000, 'beam').damage);
  const f = fixture('susanoo_orange');
  f.advance(2450);
  assert.equal(f.actors[1].sealedUntil, 0);
  f.advance(3900);
  assert.equal(f.actors[1].sealedUntil, 4700);
  assert.throws(() => f.combat.canCast(f.actors[1], 4699), { code: 'SCENE_SEALED' });
  assert.doesNotThrow(() => f.combat.canMove(f.actors[1], 4000));
});
test('Shisui refreshes a nonstacking twenty-percent slow', () => {
  const f = fixture('susanoo_alt');
  f.advance(1000);
  f.advance(1500);
  assert.equal(f.combat.view(f.actors[1]).slowMultiplier, 0.8);
  f.advance(2200);
  assert.equal(f.combat.view(f.actors[1]).slowMs, 0);
  f.advance(2450);
  assert.equal(f.actors[1].slowUntil, 3650);
});
test('Kakashi pierces shield reduction on the third hit, without removing the shield', () => {
  const a = fixture('susanoo_cyan'),
    b = fixture('susanoo_alt');
  for (const f of [a, b]) f.actors[1].shieldUntil = f.actors[1].shieldResidualUntil = 10000;
  a.advance(3900);
  b.advance(3900);
  assert.deepEqual(
    a.event.hits.slice(0, 2).map((h) => h.damage),
    b.event.hits.slice(0, 2).map((h) => h.damage),
  );
  assert.ok(a.event.hits[2].damage > b.event.hits[2].damage);
  assert.equal(a.actors[1].shieldUntil, 10000);
});
test('Madara has the largest range, strongest direct damage, and final knockback', () => {
  const far = fixture('susanoo_blue', 47),
    normal = fixture('susanoo_alt', 47);
  far.advance(3900);
  normal.advance(3900);
  assert.equal(far.event.hits.length, 3);
  assert.equal(normal.event.hits.length, 0);
  assert.ok(far.actors[1].x > 47);
  assert.ok(far.actors[1].knockback);
  const sum = (f) => f.event.hits.reduce((n, h) => n + h.damage, 0);
  const madara = fixture('susanoo_blue');
  madara.advance(3900);
  for (const effect of ['susanoo', 'susanoo_orange', 'susanoo_alt', 'susanoo_cyan']) {
    const f = fixture(effect);
    f.advance(3900);
    assert.ok(sum(madara) > sum(f), effect);
  }
});
test('boss immunity blocks Susanoo control and a cast cannot damage across a boss health stage', () => {
  const f = fixture('susanoo_alt'),
    target = f.actors[1];
  target.bossId = 'mutalith';
  target.bossControlImmuneUntil = 10000;
  f.advance(1000);
  assert.equal(target.slowUntil, 0);
  const g = fixture('susanoo_blue'),
    boss = g.actors[1];
  boss.bossId = 'mutalith';
  boss.health = Math.ceil((boss.maxHealth * 2) / 3) + 1;
  g.advance(3900);
  assert.equal(boss.health, Math.ceil((boss.maxHealth * 2) / 3));
});
