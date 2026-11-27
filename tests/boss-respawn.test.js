const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createLobby } = require('../src/rooms/lobby');
const { bosses } = require('../src/rooms/scene-bosses');
const characters = require('../src/profiles/appearance').builtinCharacters.map((c) => ({
  id: c.id,
  name: c.name,
  image: c.expressions.neutral,
}));
test('every killed boss stays dead after the normal respawn deadline, including old pending timers', () => {
  for (const spec of bosses) {
    const combat = createSceneCombat(() => 0.99),
      boss = { id: 'boss', bossId: spec.id, x: 50, y: 50 },
      player = { id: 'player', x: 45, y: 50 };
    combat.reset(boss, 0);
    combat.reset(player, 0);
    boss.bossPhase = 3;
    boss.health = 1;
    combat.hit(player, boss, 1000, 'beam');
    const life = boss.lifeId;
    assert.equal(boss.health, 0, spec.id);
    assert.equal(boss.respawnAt, 0, spec.id + ' has no scheduled revival');
    boss.respawnAt = 4000; // A dead actor created before the policy change.
    combat.advance(boss, 6000);
    combat.advance(boss, 60000);
    assert.equal(boss.health, 0, spec.id);
    assert.equal(boss.lifeId, life);
    combat.reset(boss, 61000);
    assert.ok(boss.health > 0);
    assert.equal(boss.lifeId, life + 1);
  }
});
test('ordinary players and NPCs still respawn automatically', () => {
  const combat = createSceneCombat(() => 0.99);
  for (const id of ['player', 'scene-bot:test']) {
    const actor = { id, x: 50, y: 50 },
      from = { id: 'attacker', x: 45, y: 50 };
    combat.reset(actor, 0);
    combat.reset(from, 0);
    actor.health = 1;
    combat.hit(from, actor, 1000, 'beam');
    assert.equal(actor.respawnAt, 4000);
    combat.advance(actor, 3999);
    assert.equal(actor.health, 0);
    combat.advance(actor, 4000);
    assert.ok(actor.health > 0);
  }
});
for (const options of [{}, { training: true }, { expandedMap: true, requireReady: true }])
  test('killed boss remains defeated until owner reset: ' + JSON.stringify(options), () => {
    let time = 1000;
    const actors = new Map(),
      owner = { id: 'owner', display_name: 'Owner' };
    const lobby = createLobby(
      () => time,
      () => '/test',
      () => 0.25,
      (id, actor) => {
        actors.set(id, actor);
        return false;
      },
      { ...options, botCharacters: characters },
    );
    const boss = lobby.bosses(owner, { action: 'add', bossId: 'colossal' }).bosses[0];
    time = 7000;
    lobby.view(owner);
    const actor = actors.get(boss.id);
    assert.ok(actor);
    actor.bossPhase = 3;
    actor.bossPhaseLockUntil = 0;
    actor.health = 1;
    const life = actor.lifeId;
    lobby.attack(owner, {
      requestId: 'kill-boss-once',
      slot: 'q',
      effect: 'beam',
      aspectRatio: 1.6,
    });
    time = 8100;
    let view = lobby.view(owner);
    assert.equal(view.visitors.find((v) => v.id === boss.id).health, 0);
    assert.equal(view.barrages.filter((b) => b.message.includes('擊敗')).length, 1);
    assert.ok(view.visitors.find((v) => v.id === owner.id).bossBlessingMs > 0);
    for (let i = 0; i < 20; i++) {
      time += 2000;
      view = lobby.view(owner);
    }
    assert.equal(view.visitors.find((v) => v.id === boss.id).health, 0);
    assert.equal(actor.lifeId, life);
    if (options.expandedMap) {
      lobby.bots(owner, { action: 'add', team: 'blue' });
      lobby.arena(owner, { action: 'team', team: 'red' });
      lobby.arena(owner, { action: 'ready', ready: true });
      lobby.arena(owner, { action: 'start', mode: 'pk', matchId: null });
      view = lobby.view(owner);
      assert.equal(
        view.visitors.find((v) => v.id === boss.id).health,
        0,
        'a new arena round cannot revive a killed boss',
      );
    }
    assert.throws(() => lobby.bosses({ id: 'other' }, { action: 'reset', id: boss.id }), {
      code: 'BOSS_NOT_OWNED',
    });
    lobby.bosses(owner, { action: 'reset', id: boss.id });
    assert.ok(actor.health > 0);
    assert.equal(actor.lifeId, life + 1);
  });
