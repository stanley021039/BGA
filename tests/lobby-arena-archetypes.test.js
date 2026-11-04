const { test } = require('node:test');
test('formal archetype rules and delayed attacks', () => {
  const assert = require('node:assert/strict');
  const { createSceneCombat } = require('../src/rooms/scene-combat');
  const { createLobby } = require('../src/rooms/lobby');
  function actor(type) {
    const a = { id: 'a-' + type, archetype: type, x: 8, y: 20 };
    createSceneCombat(() => 0.5).advance(a, 1000);
    return a;
  }
  const neutral = actor(null);
  assert.equal(actor('health').maxHealth, Math.round(neutral.maxHealth * 1.3));
  function hit(sourceType, targetType) {
    const c = createSceneCombat(() => 0.5),
      from = actor(sourceType),
      to = actor(targetType);
    to.id = 'target';
    return c.hit(from, to, 1000, 'beam').damage;
  }
  assert.equal(hit('attack', null), Math.round(hit(null, null) * 1.2));
  assert.equal(hit(null, 'defense'), Math.round(hit(null, null) * 0.8));
  const defense = actor('defense'),
    combat = createSceneCombat(() => 0.5);
  const hp = defense.health;
  combat.environmentDamage(defense, 1000, 0.05);
  assert.equal(hp - defense.health, Math.round(defense.maxHealth * 0.05 * 0.8));
  function walk(type) {
    let time = 1000;
    const lobby = createLobby(
        () => time,
        () => '',
        () => 0.5,
      ),
      user = { id: 'test', display_name: 'test' },
      other = { id: 'other', display_name: 'other' };
    lobby.view(user);
    lobby.view(other);
    lobby.arena(user, { action: 'team', team: 'red' });
    lobby.arena(other, { action: 'team', team: 'blue' });
    if (type) lobby.arena(user, { action: 'archetype', archetype: type });
    lobby.arena(user, { action: 'start', mode: 'pk', matchId: null });
    const start = lobby.view(user).visitors.find((p) => p.id === user.id).x;
    lobby.move(user, { dx: 1, dy: 0 });
    time += 200;
    return lobby.view(user).visitors.find((p) => p.id === user.id).x - start;
  }

  assert(Math.abs(walk('speed') / walk(null) - 1.2) < 0.001);
  const health = actor('health');
  combat.environmentDamage(health, 1000, 2);
  combat.advance(health, health.respawnAt);
  assert.equal(
    health.maxHealth,
    Math.round(neutral.maxHealth * 1.3),
    'health profile persists through respawn',
  );
  console.log(
    'PASS attack +20%, speed +20%, defense -20% including traps, health +30% and respawn persistence',
  );

  function projectile(type) {
    const c = createSceneCombat(() => 0.5),
      timeline = require('../src/rooms/attack-timeline').createAttackTimeline(c),
      from = actor(type),
      to = actor(null);
    to.id = 'enemy';
    const before = to.health,
      event = { id: 'cast', effect: 'beam', at: 1000, fromX: 8, fromY: 20, aspectRatio: 1 };
    timeline.prepare(event, from, [to]);
    timeline.advance([event], [from, to], 2000, (a, t) => c.advance(a, t));
    return before - to.health;
  }
  assert(projectile(null) > 0);
  assert.equal(
    projectile('attack'),
    Math.round(projectile(null) * 1.2),
    'delayed projectile retains attack profile',
  );
  console.log('PASS delayed attack timeline retains archetype bonus');
});
