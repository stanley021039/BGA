const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat, authorSpeed } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { driveBoss } = require('../src/rooms/scene-bosses');
const interactions = require('../src/rooms/boss-interactions');
const { createLobby } = require('../src/rooms/lobby');
const characters = require('../src/profiles/appearance').builtinCharacters.map((c) => ({
  id: c.id,
  name: c.name,
  image: c.expressions.neutral,
}));
function fixture(random = () => 0.99, policy = {}) {
  const combat = createSceneCombat(random, () => false, policy);
  const actor = (id) => ({ id, x: 30, y: 65, targetX: 30, targetY: 65, moveId: 0, teleportId: 0 });
  const player = actor('player'),
    boss = actor('boss');
  boss.bossId = 'mutalith';
  combat.reset(player, 1000);
  combat.reset(boss, 1000);
  boss.baseMaxHealth = boss.maxHealth = boss.health = 9000000;
  return { combat, player, boss };
}
test('devour caps a boss bite at half current HP and still cannot cross one health segment', () => {
  const { combat, player, boss } = fixture();
  boss.health = 1500000;
  boss.bossPhase = 3;
  assert.equal(combat.hit(player, boss, 2000, 'shaohua_devour').damage, 750000);
  combat.reset(boss, 3000);
  boss.baseMaxHealth = boss.maxHealth = boss.health = 9000000;
  assert.equal(combat.hit(player, boss, 4000, 'shaohua_devour').damage, 3000000);
  assert.equal(boss.bossPhase, 2);
  assert.equal(boss.bossPhaseLockUntil, 6000);
  const victim = { id: 'other' };
  combat.reset(victim, 5000);
  victim.health = 1000000;
  assert.equal(
    combat.hit(player, victim, 5000, 'shaohua_devour').damage,
    900000,
    'PvP bite unchanged',
  );
});
test('phase immunity blocks controls, not damage after the two-second health lock; stun resistance and protection expire', () => {
  const { combat, player, boss } = fixture();
  combat.hit(player, boss, 2000, 'beam', 1000);
  assert.equal(boss.bossControlImmuneUntil, 5000);
  assert.equal(combat.freeze(boss, 4100, 1000), 0);
  combat.applyEffect(player, boss, 4100, 'chains', player, 1, 'hit1', true);
  combat.applyEffect(player, boss, 4100, 'reaper_seal', player, 1, 'hit1', true);
  assert.equal(boss.slowUntil, 0);
  assert.equal(boss.sealedUntil, 0);
  const old = { x: boss.x, y: boss.y };
  combat.applyEffect(player, boss, 4100, 'singularity', player, 1, 'finish', true);
  assert.deepEqual({ x: boss.x, y: boss.y }, old);
  assert.ok(combat.hit(player, boss, 4100, 'beam').damage > 0);
  assert.equal(combat.freeze(boss, 5000, 1000), 700);
  assert.equal(combat.freeze(boss, 6000, 1000), 0);
  assert.equal(combat.freeze(boss, 8700, 1000), 700);
});
test('final cycle random ranges refresh immunity and bursts without refreshing health locks', () => {
  for (const random of [() => 0, () => 0.99]) {
    const { combat, boss } = fixture(random);
    boss.bossPhase = 3;
    boss.health = 2000000;
    boss.bossPhaseLockUntil = 3000;
    interactions.beginPhaseImmunity(boss, 1000, 3, random);
    const cycle = boss.bossFinalCycle;
    assert.ok(cycle.immuneUntil - 1000 >= 4000 && cycle.immuneUntil - 1000 <= 5000);
    assert.ok(
      cycle.burstUntil - cycle.immuneUntil >= 3000 && cycle.burstUntil - cycle.immuneUntil <= 5000,
    );
    assert.ok(cycle.until - cycle.burstUntil >= 9000 && cycle.until - cycle.burstUntil <= 11000);
    combat.advance(boss, cycle.immuneUntil);
    assert.equal(interactions.immune(boss, cycle.immuneUntil), false);
    assert.equal(interactions.cycleState(boss, cycle.immuneUntil).mode, 'dash');
    assert.ok(Math.abs(authorSpeed(boss, cycle.immuneUntil) - 2.6) < 1e-9);
    assert.ok(Math.abs(authorSpeed(boss, cycle.burstUntil) - 1.3) < 1e-9);
    combat.advance(boss, cycle.until);
    assert.equal(interactions.cycleState(boss, cycle.until).mode, 'immune');
    assert.equal(boss.bossFinalCycle.index, 1);
    assert.equal(boss.bossPhaseLockUntil, 3000);
    combat.reset(boss, cycle.until + 1);
    assert.equal(boss.bossFinalCycle, null);
  }
});
test('teleport burst keeps distance and has contact grace while drain delays only the next unannounced ultimate', () => {
  const { boss, player } = fixture(() => 0);
  boss.bossId = 'greeza';
  boss.bossPhase = 3;
  boss.health = 2000000;
  interactions.beginPhaseImmunity(boss, 1000, 3, () => 0);
  const state = {};
  driveBoss({ bossId: 'greeza' }, boss, player, 5000, state);
  assert.equal(boss.teleportId, 1);
  assert.ok(Math.hypot(boss.x - player.x, boss.y - player.y) >= 8);
  assert.equal(boss.bossBlinkSafeUntil, 5350);
  const f = fixture();
  f.boss.bossCharge = 100;
  assert.equal(interactions.drainBossCharge(f.boss, 10), 10);
  const waiting = { lifeId: f.boss.lifeId, step: 2, attackAt: 2000, moveAt: Infinity, rate: 1 };
  assert.equal(driveBoss({ bossId: 'mutalith' }, f.boss, f.player, 2000, waiting), null);
  assert.equal(waiting.attackAt, 2400);
  assert.equal(
    driveBoss({ bossId: 'mutalith' }, f.boss, f.player, 2400, waiting),
    'boss_mutalith_r',
  );
  assert.equal(interactions.drainBossCharge(f.boss, 10), 0, 'do not move announced hit times');
  f.boss.bossIntent = null;
  f.boss.bossCharge = 100;
  interactions.drainBossCharge(f.boss, 100);
  assert.equal(f.boss.bossRDelayMs, 1000);
});
test('equation and severing become non-stacking short boss vulnerabilities, while seal briefly delays casting', () => {
  const { combat, player, boss } = fixture();
  const base = combat.hit(player, boss, 2000, 'beam').damage;
  combat.trapEquation(boss, 'equation', 2100);
  assert.equal(boss.equation, null);
  assert.equal(combat.hit(player, boss, 2200, 'beam').damage, Math.round(base * 1.1));
  combat.applyEffect(player, boss, 2300, 'dimension_cleave', player, 1, 'finish', true);
  assert.equal(boss.fragment, null);
  assert.equal(boss.severed, false);
  assert.equal(combat.hit(player, boss, 2400, 'beam').damage, Math.round(base * 1.15));
  assert.equal(combat.hit(player, boss, 4000, 'beam').damage, base);
  combat.applyEffect(player, boss, 4100, 'reaper_seal', player, 1, 'hit1', true);
  assert.equal(boss.sealedUntil, 4900);
  const waiting = { lifeId: boss.lifeId, step: 0, attackAt: 4100, moveAt: Infinity, rate: 1 };
  assert.equal(driveBoss({ bossId: 'mutalith' }, boss, player, 4200, waiting), null);
  assert.equal(driveBoss({ bossId: 'mutalith' }, boss, player, 4900, waiting), 'boss_mutalith_q');
});
test('rainbow companion procs once, drains integer rolls on three authoritative seconds and clears on reset/leave', () => {
  let samples = [];
  const random = () => (samples.length ? samples.shift() : 0.99);
  let present = true;
  const { combat, player, boss } = fixture(random, { sourcePresent: () => present });
  boss.bossId = undefined;
  boss.energy = 100;
  const source = { ...player, energyActor: player, energyLifeId: player.lifeId };
  samples = [0.2, 0, 0.99, 0.5];
  assert.equal(combat.attachBear(source, boss, 2000, 3), true);
  combat.advance(boss, 2999);
  assert.equal(boss.energy, 100);
  combat.advance(boss, 3000);
  assert.equal(boss.energy, 99);
  combat.advance(boss, 4000);
  assert.equal(boss.energy, 89);
  combat.advance(boss, 5000);
  assert.equal(boss.energy, 83);
  assert.equal(boss.bearCompanion, null);
  samples = [0.5];
  assert.equal(combat.attachBear(source, boss, 6000, 1), false);
  samples = [0.1];
  combat.attachBear(source, boss, 6000, 1);
  present = false;
  combat.advance(boss, 7000);
  assert.equal(boss.bearCompanion, null);
});
test('all five rainbow actors are server-selectable once per cast', () => {
  for (let index = 0; index < 5; index++) {
    const { combat, player, boss } = fixture(() => index / 5),
      timeline = createAttackTimeline(combat);
    const event = {
      id: 'bear-' + index,
      effect: 'rainbow_bear',
      at: 2000,
      fromId: player.id,
      fromX: 30,
      fromY: 65,
      toId: boss.id,
      toX: 30,
      toY: 65,
      aspectRatio: 1,
    };
    timeline.prepare(event, player, [boss]);
    assert.equal(event.bearIndex, index);
  }
});
test('main lobby supports five bots plus five independently reserved bosses and rejects a sixth', () => {
  let now = 1000;
  const user = { id: 'owner', display_name: 'Owner' };
  const lobby = createLobby(
    () => now,
    () => '/avatar',
    () => 0.5,
    () => false,
    { botCharacters: characters },
  );
  for (let i = 0; i < 5; i++) lobby.bots(user, { action: 'add' });
  for (let i = 0; i < 5; i++) lobby.bosses(user, { action: 'add', bossId: 'mutalith' });
  assert.equal(lobby.bots(user).limit, 5);
  assert.equal(lobby.bosses(user).limit, 5);
  assert.throws(() => lobby.bots(user, { action: 'add' }), { code: 'SCENE_BOTS_FULL' });
  assert.throws(() => lobby.bosses(user, { action: 'add', bossId: 'mutalith' }), {
    code: 'BOSSES_FULL',
  });
  assert.equal(lobby.view(user).bossArrivals.length, 5);
  assert.equal(new Set(lobby.bosses(user).bosses.map((b) => b.spawnX)).size, 5);
  now = 6000;
  assert.equal(lobby.view(user).visitors.filter((v) => v.bossId).length, 5);
});
