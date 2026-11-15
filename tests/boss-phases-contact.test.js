const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat, authorSpeed } = require('../src/rooms/scene-combat');
const { createBotDriver } = require('../src/rooms/scene-bots');
const { createBossCombat, abilityFor } = require('../src/rooms/boss-combat');
const { bossPhase, phaseStats } = require('../src/rooms/boss-phases');
const { createLobby } = require('../src/rooms/lobby');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const actor = (id, x = 50) => ({
  id,
  name: id,
  x,
  y: 65,
  targetX: x,
  targetY: 65,
  health: 100,
  lifeId: 1,
  moveId: 0,
});

test('one cast cannot damage the next bar after the two-second lock, while a new cast can', () => {
  const combat = createSceneCombat(() => 0.99),
    boss = actor('boss'),
    player = actor('player');
  boss.bossId = 'thanos';
  combat.reset(boss, 1000);
  combat.reset(player, 1000);
  boss.baseMaxHealth = boss.maxHealth = boss.health = 900;
  const cast = {
    ...player,
    energyActor: player,
    energyLifeId: player.lifeId,
    bossBarBudget: new WeakMap(),
  };
  assert.equal(combat.hit(cast, boss, 2000, 'beam', 1000).damage, 300);
  assert.equal(boss.bossPhaseLockUntil, 4000);
  const next = { ...cast, bossBarBudget: new WeakMap() };
  assert.equal(combat.hit(next, boss, 3999, 'beam', 1000).damage, 0);
  assert.equal(combat.hit(cast, boss, 4000, 'beam', 1000).damage, 0);
  assert.equal(combat.hit(next, boss, 4000, 'beam', 1000).damage, 300);
  assert.equal(boss.bossPhaseLockUntil, 6000);
  combat.reset(boss, 7000);
  boss.baseMaxHealth = boss.maxHealth = boss.health = 900;
  assert.equal(boss.bossPhaseLockUntil, 0);
  assert.equal(
    combat.hit(cast, boss, 8000, 'beam', 1000).damage,
    0,
    'old cast cannot damage a new life',
  );
});

test('real attack timeline shares a bar budget between every segment and return', () => {
  for (const effect of ['beam', 'returning_moon', 'chain_lightning', 'flame_vortex']) {
    const combat = createSceneCombat(() => 0.99),
      timeline = createAttackTimeline(combat);
    const player = actor('player', 20),
      boss = actor('boss', 40);
    boss.bossId = 'thanos';
    combat.reset(player, 1000);
    combat.reset(boss, 1000);
    boss.baseMaxHealth = boss.maxHealth = boss.health = 900;
    const event = {
      id: effect,
      effect,
      at: 2000,
      fromId: player.id,
      fromX: 20,
      fromY: 65,
      toId: boss.id,
      toX: 40,
      toY: 65,
      aspectRatio: 1,
    };
    timeline.prepare(event, player, [boss], [player, boss]);
    for (let at = 2000; at <= 10000; at += 100)
      timeline.advance([event], [player, boss], at, () => {});
    assert.equal(boss.health, 600, effect);
  }
});
test('boss target priority is human, then bots, then bosses, after eligibility filtering', () => {
  for (const expected of ['human', 'bot', 'other']) {
    const driver = createBotDriver(() => 0.5),
      boss = actor('boss'),
      other = actor('other', 51),
      bot = actor('bot', 52),
      human = actor('human', 90);
    const positions = new Map([boss, other, bot, human].map((a) => [a.id, a]));
    const bots = [
      { id: 'boss', bossId: 'gatanozoa' },
      { id: 'other', bossId: 'cthulhu' },
      { id: 'bot', mode: 'idle' },
    ];
    const eligible = (from, to) => to.id !== 'human' || expected === 'human';
    if (expected === 'other') bot.health = 0;
    const targets = [];
    for (const time of [1000, 2200])
      driver.drive({
        time,
        bots,
        positions,
        events: [],
        canTarget: eligible,
        cast: () => {},
        castBoss: (b, e, target) => {
          if (b.id === 'boss') targets.push(target.id);
        },
      });
    assert.deepEqual(targets, [expected]);
  }
});
test('body contact is bounded to one hit per player per 800ms across bosses and respects landing, death and policy', () => {
  const driver = createBotDriver(() => 0.5),
    human = actor('human'),
    boss = actor('boss'),
    other = actor('other');
  boss.bossArrivalAt = other.bossArrivalAt = 6000;
  const positions = new Map([boss, other, human].map((a) => [a.id, a]));
  const bots = [
      { id: 'boss', bossId: 'gatanozoa' },
      { id: 'other', bossId: 'cthulhu' },
    ],
    hits = [];
  let eligible = true;
  const drive = (time) =>
    driver.drive({
      time,
      bots,
      positions,
      events: [],
      castBoss: () => {},
      canTarget: () => eligible,
      touchBoss: (b, p, at) => hits.push([p.id, at]),
    });
  drive(6000);
  drive(6400);
  assert.equal(hits.length, 0);
  drive(6800);
  drive(7200);
  assert.deepEqual(hits, [['human', 6800]]);
  drive(7600);
  assert.equal(hits.length, 2);
  eligible = false;
  drive(8400);
  assert.equal(hits.length, 2);
  eligible = true;
  human.health = 0;
  drive(9200);
  assert.equal(hits.length, 2);
  human.health = 100;
  human.lifeId++;
  boss.health = other.health = 0;
  drive(10000);
  assert.equal(hits.length, 2);
  boss.health = 100;
  driver.clear();
  drive(10400);
  assert.equal(hits.length, 3);
});
test('one damage event cannot cross a boss bar; healing and phase buffs never regress until reset', () => {
  const combat = createSceneCombat(
      () => 0.99,
      () => false,
      { isObjective: (a) => !!a.bossId },
    ),
    boss = actor('boss'),
    player = actor('player');
  boss.bossId = 'thanos';
  combat.reset(boss, 1000);
  combat.reset(player, 1000);
  boss.baseMaxHealth = boss.maxHealth = boss.health = 900;
  let time = 2000;
  for (const remaining of [600, 300, 0]) {
    const hit = combat.hit(player, boss, time, 'beam', 1000);
    assert.equal(hit.damage, 300);
    assert.equal(boss.health, remaining);
    assert.equal(bossPhase(boss), remaining === 600 ? 2 : 3);
    if (remaining) {
      combat.advance(boss, time + 10000);
      assert.equal(boss.health, remaining);
    }
    time += 12000;
  }
  assert.equal(player.kda.kills, 0, 'boss is not a PvP kill');
  combat.reset(boss, 20000);
  assert.equal(bossPhase(boss), 1);
  for (const [phase, multiplier] of [
    [1, 1],
    [2, 1.15],
    [3, 1.3],
  ]) {
    boss.bossPhase = phase;
    boss.health = (boss.maxHealth * (4 - phase)) / 3;
    assert.equal(phaseStats(boss).damage, multiplier);
    assert.ok(Math.abs(authorSpeed(boss) - multiplier) < 1e-9);
  }
});

test('a blocked contact does not consume another boss contact cooldown', () => {
  const driver = createBotDriver(() => 0.5),
    human = actor('human');
  const bots = [
    { id: 'wall-blocked', bossId: 'thanos' },
    { id: 'nearby', bossId: 'cthulhu' },
  ];
  const positions = new Map([human, ...bots.map((b) => actor(b.id))].map((a) => [a.id, a]));
  const attempts = [];
  driver.drive({
    time: 2000,
    bots,
    positions,
    events: [],
    castBoss() {},
    touchBoss(b) {
      attempts.push(b.id);
      return b.id !== 'wall-blocked';
    },
  });
  assert.deepEqual(attempts, ['wall-blocked', 'nearby']);
});
test('enraged authoritative windup and hit times use the rate fixed at cast creation', () => {
  const combat = createSceneCombat(() => 0.99),
    runtime = createBossCombat(combat),
    boss = actor('boss', 20),
    player = actor('human', 40);
  boss.bossId = 'gatanozoa';
  combat.reset(boss, 1000);
  combat.reset(player, 1000);
  boss.bossPhase = 2;
  const event = runtime.prepare({ bossId: 'gatanozoa' }, boss, 'boss_gatanozoa_q', player, 2000),
    spec = abilityFor(event.effect);
  assert.equal(event.bossAttackRate, 1.15);
  const positions = new Map([
    [boss.id, boss],
    [player.id, player],
  ]);
  const hitAt = 2000 + spec.windup / 1.15;
  runtime.advance([event], positions, hitAt - 0.01, () => {});
  assert.equal(event.hits.length, 0);
  boss.bossPhase = 3;
  runtime.advance([event], positions, hitAt, () => {});
  assert.equal(event.hits.length, 1);
  assert.equal(event.bossAttackRate, 1.15, 'phase change cannot move an already announced strike');
});
test('real lobby contact uses combat damage and a damage pulse before the boss first skill', () => {
  let time = 1000;
  const user = { id: 'human', display_name: 'Human' };
  const lobby = createLobby(
    () => time,
    () => '/avatar',
    () => 0.99,
  );
  lobby.move(user, { x: 25, y: 65 });
  lobby.bosses(user, { action: 'add', bossId: 'gatanozoa' });
  time = 6000;
  let s = lobby.view(user);
  const before = s.visitors.find((v) => v.id === user.id).health;
  time = 6400;
  s = lobby.view(user);
  assert.equal(s.visitors.find((v) => v.id === user.id).health, before);
  time = 6800;
  s = lobby.view(user);
  const me = s.visitors.find((v) => v.id === user.id);
  assert.ok(me.health < before);
  assert.match(me.dotPulse.id, /^boss-contact:/);
  assert.equal(s.attacks.length, 0);
});
test('environmental hits also stop at a bar, and rage damage uses the agreed non-stacking factors', () => {
  const combat = createSceneCombat(() => 0.99),
    boss = actor('boss'),
    player = actor('player');
  boss.bossId = 'thanos';
  combat.reset(boss, 1000);
  combat.reset(player, 1000);
  boss.baseMaxHealth = boss.maxHealth = boss.health = 900;
  combat.environmentDamage(boss, 1100, 1);
  assert.equal(boss.health, 600);
  assert.equal(boss.bossPhase, 2);
  const damage = [];
  for (const [phase, hp] of [
    [1, 900],
    [2, 600],
    [3, 300],
  ]) {
    boss.bossPhase = phase;
    boss.health = hp;
    combat.reset(player, 2000);
    damage.push(combat.hit(boss, player, 2100, 'boss_contact', 0.3).damage);
  }
  assert.equal(damage[1], Math.round(damage[0] * 1.15));
  assert.equal(damage[2], Math.round(damage[0] * 1.3));
});
