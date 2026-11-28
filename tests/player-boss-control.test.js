const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { bosses } = require('../src/rooms/scene-bosses');
const alice = { id: 'alice', display_name: 'Alice' },
  bob = { id: 'bob', display_name: 'Bob' };
function fixture(options = {}) {
  let clock = 1000;
  const saved = new Map([[alice.id, { unlocked: true, selected: null }]]);
  const lobby = createLobby(
    () => clock,
    () => '/test',
    () => 0.25,
    () => true,
    {
      playerBoss: {
        read: (id) => saved.get(id) || { unlocked: false, selected: null },
        write: (id, value) => {
          saved.get(id).selected = value;
        },
      },
      ...options,
    },
  );
  const view = (user = alice) => lobby.view(user),
    own = () => view().visitors.find((v) => v.id === alice.id);
  return { lobby, saved, view, own, advance: (ms) => (clock += ms) };
}
test('Boss control requires its own grant, validates choices and stays outside competitive arenas', () => {
  const f = fixture();
  assert.equal(f.lobby.controlBoss(bob).unlocked, false);
  assert.throws(() => f.lobby.controlBoss(bob, { action: 'select', bossId: 'colossal' }), {
    code: 'BOSS_CONTROL_LOCKED',
  });
  assert.throws(() => f.lobby.controlBoss(alice, { action: 'select', bossId: 'fake' }), {
    code: 'INVALID_CONTROLLED_BOSS',
  });
  const arena = fixture({ expandedMap: true });
  assert.throws(() => arena.lobby.controlBoss(alice, { action: 'select', bossId: 'colossal' }), {
    code: 'BOSS_CONTROL_SCOPE',
  });
  f.lobby.controlBoss(alice, { action: 'select', bossId: 'colossal' });
  assert.throws(() => f.lobby.arena(alice, { action: 'join' }), { code: 'BOSS_CONTROL_SCOPE' });
  assert.throws(() => f.lobby.teleport(alice), { code: 'BOSS_TELEPORT_UNAVAILABLE' });
});
for (const spec of bosses)
  test(`${spec.id} uses its actual model, Boss health and all three authoritative abilities`, () => {
    const f = fixture();
    f.view(bob);
    f.lobby.controlBoss(alice, { action: 'select', bossId: spec.id });
    const initial = f.own();
    assert.equal(initial.bossId, spec.id);
    assert.equal(initial.controlledBoss, true);
    assert.equal(initial.energyMaximum, 100);
    assert.equal(initial.bossPhase, 1);
    assert.ok(initial.maxHealth > 10000);
    assert.match(initial.image, new RegExp('boss-' + spec.id + '\\.webp\\?v='));
    assert.equal(f.saved.get(alice.id).selected, spec.id);
    assert.equal(f.own().health, initial.health, 'reading state cannot reset health');
    const position = { x: initial.x, y: initial.y };
    f.advance(900);
    f.view(bob);
    assert.equal(f.own().x, position.x, 'manual Boss must not acquire an AI movement target');
    for (const [i, slot] of ['q', 'e', 'r'].entries()) {
      f.view(bob);
      const request = { requestId: 'manual-boss-' + i, slot, aspectRatio: 1.6 };
      const snap = f.lobby.attack(alice, request);
      const event = snap.attacks.find(
        (e) => e.effect === spec.abilities.find((a) => a.slot === slot).id,
      );
      assert.ok(event, slot);
      assert.equal(event.slot, slot);
      assert.ok(snap.visitors.find((v) => v.id === alice.id).bossIntent);
      f.lobby.attack(alice, request);
      assert.equal(
        f.view().attacks.filter((e) => e.id === event.id).length,
        1,
        'same request cannot cast twice',
      );
      assert.throws(() => f.lobby.attack(alice, { ...request, requestId: 'early-request-' + i }), {
        code: 'ATTACK_COOLDOWN',
      });
      f.advance(12000);
      f.view(bob);
      const own = f.own();
      assert.equal(own.energy, slot === 'r' ? 0 : (i + 1) * 50);
    }
    f.lobby.controlBoss(alice, { action: 'select', bossId: null });
    const normal = f.own();
    assert.equal(normal.bossId, undefined);
    assert.equal(normal.controlledBoss, undefined);
    assert.ok(normal.maxHealth < initial.maxHealth);
  });
test('training selection stays independent and refill restores Boss charge', () => {
  const f = fixture({ training: true });
  f.lobby.controlBoss(alice, { action: 'select', bossId: 'cthulhu' });
  assert.equal(f.saved.get(alice.id).selected, null);
  const snap = f.lobby.training(alice, 'refill');
  assert.equal(snap.visitors.find((v) => v.id === alice.id).energy, 100);
  f.lobby.training(alice, 'reset');
  assert.equal(f.own().bossId, 'cthulhu');
});

test('all 117 manual Boss phase/slot combinations preserve stage plans, single-bar floors and explicit revival', () => {
  const { createSceneCombat } = require('../src/rooms/scene-combat');
  const { createBossCombat } = require('../src/rooms/boss-combat');
  const { createPlayerBossControl } = require('../src/rooms/player-boss-control');
  for (const spec of bosses) {
    let time = 1000;
    const combat = createSceneCombat(() => 0.25),
      bossCombat = createBossCombat(combat),
      events = [],
      actor = { id: alice.id, name: 'Alice', x: 40, y: 70, targetX: 40, targetY: 70, moveId: 0 },
      target = { id: bob.id, name: 'Bob', x: 50, y: 70, targetX: 50, targetY: 70, moveId: 0 };
    const actors = new Map([
      [actor.id, actor],
      [target.id, target],
    ]);
    combat.advance(target, time);
    const control = createPlayerBossControl({
      now: () => time,
      enabled: true,
      training: true,
      settings: { read: () => ({ unlocked: true }) },
      combat,
      bossCombat,
      actors,
      events,
      receipts: new Map(),
      canTarget: () => true,
    });
    control.configure(alice, actor, { action: 'select', bossId: spec.id });
    for (const phase of [1, 2, 3]) {
      if (phase > 1) {
        time += 3000;
        combat.environmentDamage(actor, time, 1);
        assert.equal(
          actor.health,
          Math.ceil((actor.maxHealth * (4 - phase)) / 3),
          spec.id + ' phase floor',
        );
      }
      for (const slot of ['q', 'e', 'r']) {
        time += 10000;
        combat.advance(actor, time);
        control.advance(actor, time);
        control.attack(actor, { requestId: `stage-${phase}-${slot}`, slot, aspectRatio: 1.6 });
        const event = events.at(-1);
        assert.equal(event.bossPhase || 1, phase, spec.id + slot);
        assert.equal(event.effect, spec.abilities.find((a) => a.slot === slot).id);
        assert.ok(actor.bossIntent.until > time);
      }
    }
    time += 10000;
    combat.environmentDamage(actor, time, 1);
    assert.equal(actor.health, 0);
    time += 30000;
    combat.advance(actor, time);
    assert.equal(actor.health, 0, 'controlled Boss cannot auto-respawn');
    const oldLife = actor.lifeId;
    control.configure(alice, actor, { action: 'reset' });
    assert.ok(actor.health > 0);
    assert.ok(actor.lifeId > oldLife);
    assert.equal(actor.bossPhase, 1);
    assert.equal(actor.bossCharge, 0);
    bossCombat.advance(events, actors, time, () => {});
    assert.ok(
      events.every((e) => e.cancelled),
      'old-life casts never survive manual revival',
    );
  }
});

test('manual Boss contact uses the shared cooldown but never receives AI movement or casts', () => {
  const { createBotDriver } = require('../src/rooms/scene-bots');
  const driver = createBotDriver(() => 0.25),
    human = {
      id: 'manual',
      bossId: 'colossal',
      health: 100,
      lifeId: 1,
      x: 50,
      y: 65,
      targetX: 50,
      targetY: 65,
    },
    victim = { id: 'victim', health: 100, lifeId: 1, x: 51, y: 65 };
  const positions = new Map([
    [human.id, human],
    [victim.id, victim],
  ]);
  let contacts = 0,
    casts = 0;
  const run = (time) =>
    driver.drive({
      time,
      bots: [],
      manualBosses: [{ id: human.id, bossId: human.bossId, manual: true }],
      positions,
      events: [],
      touchBoss: () => {
        contacts++;
        return true;
      },
      cast: () => casts++,
      castBoss: () => casts++,
    });
  run(1000);
  run(1400);
  assert.equal(contacts, 1);
  run(10000);
  assert.equal(contacts, 2);
  assert.equal(casts, 0);
  assert.equal(human.targetX, 50);
  assert.equal(human.targetY, 65);
});

test('pending NPC arrivals reserve the five Boss slots before manual transformation', () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) f.lobby.bosses(alice, { action: 'add', bossId: 'colossal' });
  assert.throws(() => f.lobby.controlBoss(alice, { action: 'select', bossId: 'cthulhu' }), {
    code: 'BOSSES_FULL',
  });
  assert.equal(f.own().bossId, undefined);
});
