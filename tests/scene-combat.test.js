const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoomSpace } = require('../src/rooms/space');
const { createSceneCombat } = require('../src/rooms/scene-combat');

test('25 percent critical boundary applies equally to ordinary and author players with either shield state', () => {
  for (const id of ['ordinary', 'author'])
    for (const shielded of [false, true]) {
      for (const [roll, expected] of [
        [0.249999, true],
        [0.25, false],
      ]) {
        let values = [];
        const combat = createSceneCombat(
          () => values.shift() ?? 0.5,
          (userId) => userId === 'author',
        );
        const from = { id, x: 0, y: 0 },
          to = { id: 'target', x: 0, y: 0 };
        combat.advance(from, 0);
        combat.advance(to, 0);
        if (shielded) combat.protect(to, 0);
        values = [0.5, roll, 0.5];
        assert.equal(combat.hit(from, to, 100).critical, expected);
      }
    }
});

test('author redemption multiplies birth health, normal and critical damage, and regeneration', () => {
  let critical = false;
  const combat = createSceneCombat(
    () => (critical ? 0 : 0.5),
    (id) => id === 'author',
  );
  const author = { id: 'author', x: 10, y: 20 },
    ordinary = { id: 'ordinary', x: 20, y: 20 };
  combat.advance(author, 0);
  combat.advance(ordinary, 0);
  assert.equal(author.maxHealth, 1800000);
  assert.equal(ordinary.maxHealth, 1200000);
  assert.equal(combat.hit(author, ordinary, 1000).damage, 230000);
  assert.equal(combat.hit(ordinary, author, 1000).damage, 200000);
  combat.advance(author, 6000);
  combat.advance(ordinary, 6000);
  assert.equal(author.health, 1780000);
  assert.equal(ordinary.health, 1090000);
  critical = true;
  assert.deepEqual(combat.hit(author, ordinary, 6500), { damage: 310500, critical: true });
});

test('redeeming while present preserves health ratio and never stacks or bypasses death', () => {
  let eligible = false;
  const combat = createSceneCombat(
      () => 0.5,
      () => eligible,
    ),
    actor = { id: 'a', x: 10, y: 20 };
  combat.advance(actor, 0);
  combat.hit({ health: 1 }, actor, 1000);
  eligible = true;
  combat.advance(actor, 1000);
  assert.equal(actor.health, 1500000);
  assert.equal(actor.maxHealth, 1800000);
  combat.advance(actor, 2000);
  combat.advance(actor, 3000);
  assert.equal(actor.health, 1500000);
  assert.equal(actor.maxHealth, 1800000);
  actor.health = 1;
  combat.hit({ health: 1 }, actor, 3100);
  combat.advance(actor, 6099);
  assert.equal(actor.health, 0);
  combat.advance(actor, 6100);
  assert.equal(actor.health, 1800000);
});

test('lobby and shared room scenes both apply server-provided author eligibility', () => {
  const { createLobby } = require('../src/rooms/lobby');
  const author = (id) => id === 'author';
  const lobby = createLobby(
    () => 1000,
    undefined,
    () => 0.5,
    author,
  );
  const owner = { id: 'author', display_name: 'A' },
    ordinary = { id: 'normal', display_name: 'B' };
  assert.equal(lobby.view(owner).visitors.find((v) => v.id === owner.id).maxHealth, 1800000);
  assert.equal(lobby.view(ordinary).visitors.find((v) => v.id === ordinary.id).maxHealth, 1200000);
  const space = createRoomSpace(
    () => 1000,
    () => 0.5,
    author,
  );
  const room = {
    players: [
      { id: 'author', name: 'A' },
      { id: 'normal', name: 'B' },
    ],
  };
  const view = space.view(room, 'author');
  assert.equal(view.visitors[0].maxHealth, 1800000);
  assert.equal(view.visitors[1].maxHealth, 1200000);
});

test('damage keeps random unit digits, scales regeneration proportionally and reports full overkill', () => {
  const values = [0.5, 0.123456, 0.8, 0.999999, 0.8];
  const combat = createSceneCombat(() => values.shift() ?? 0.5),
    actor = { x: 0, y: 0 };
  combat.advance(actor, 0);
  const hit = combat.hit({ health: 1 }, actor, 1000);
  assert.equal(hit.damage, 184938);
  assert.notEqual(hit.damage % 10, 0);
  actor.health = 1;
  const overkill = combat.hit({ health: 1 }, actor, 1000);
  assert.equal(overkill.damage, 220000);
  assert.equal(actor.health, 0);
});

test('room targeting reaches half the longer screen dimension on landscape and portrait screens', () => {
  for (const [aspectRatio, x, y] of [
    [16 / 9, 62, 38],
    [9 / 16, 12, 88],
  ]) {
    let now = 1000;
    const space = createRoomSpace(
        () => now,
        () => 0.5,
      ),
      room = {
        players: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      };
    space.view(room, 'a');
    space.move(room, 'b', { x, y });
    now += 10000;
    const input = { action: 'attack', slot: 'q', aspectRatio, requestId: 'half-screen-range-001' };
    assert.doesNotThrow(() => space.move(room, 'a', input, 'beam'));
    now += 450;
    assert.equal(space.view(room, 'a').visitors.find((v) => v.id === 'b').health, 1000000);
    space.move(room, 'b', { x: aspectRatio > 1 ? 63 : 12, y: aspectRatio > 1 ? 38 : 89 });
    now += 10000;
    assert.throws(
      () => space.move(room, 'a', { ...input, requestId: 'half-screen-range-002' }, 'beam'),
      { code: 'NO_ATTACK_TARGET' },
    );
  }
});
test('regeneration waits for two quiet seconds, is polling-independent and caps at maximum', () => {
  const combat = createSceneCombat(() => 0.5),
    actor = { x: 50, y: 50 };
  combat.advance(actor, 0);
  combat.hit({ health: 100 }, actor, 1000);
  combat.advance(actor, 3999);
  assert.equal(actor.health, 1000000);
  combat.advance(actor, 4000);
  assert.equal(actor.health, 1040000);
  combat.advance(actor, 4000);
  assert.equal(actor.health, 1040000);
  combat.hit({ health: 100 }, actor, 6500);
  combat.advance(actor, 8500);
  assert.equal(actor.health, 840000);
  combat.advance(actor, 20000);
  assert.equal(actor.health, 1200000);
});
test('death freezes movement, respawns after three seconds elsewhere with fresh health', () => {
  const combat = createSceneCombat(() => 0.5),
    actor = { x: 50, y: 50, targetX: 80, targetY: 80 };
  combat.advance(actor, 0);
  assert.equal(actor.health, 1200000);
  for (let i = 0; i < 6; i++) combat.hit({ health: 100 }, actor, 1000);
  assert.equal(actor.health, 0);
  assert.equal(actor.respawnAt, 4000);
  assert.equal(actor.targetX, 50);
  assert.throws(() => combat.alive(actor), { code: 'SCENE_RESPAWNING' });
  combat.advance(actor, 3999);
  assert.equal(actor.health, 0);
  combat.advance(actor, 4000);
  assert.equal(actor.health, 1200000);
  assert.notEqual(actor.x, 50);
  assert.equal(actor.teleportId, 1);
});
test('room attacks obey range, cooldown and retry, while shields do not damage self', () => {
  let now = 1000;
  const space = createRoomSpace(
      () => now,
      () => 0.5,
    ),
    room = {
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    };
  const attack = { action: 'attack', slot: 'q', aspectRatio: 1, requestId: 'scene-attack-001' };
  space.view(room, 'a');
  assert.throws(() => space.move(room, 'a', attack, 'beam'), { code: 'NO_ATTACK_TARGET' });
  space.move(room, 'b', { x: 15, y: 38 });
  now += 10000;
  space.move(room, 'a', attack, 'beam');
  now += 450;
  let snapshot = space.view(room, 'a');
  assert.equal(snapshot.visitors[1].health, 1000000);
  space.move(room, 'a', attack, 'beam');
  assert.equal(space.view(room, 'a').visitors[1].health, 1000000);
  assert.throws(() => space.move(room, 'a', { ...attack, requestId: 'scene-attack-002' }, 'beam'), {
    code: 'ATTACK_COOLDOWN',
  });
  space.move(room, 'a', { ...attack, slot: 'e', requestId: 'scene-shield-001' }, 'shield');
  assert.equal(space.view(room, 'a').visitors[0].health, 1200000);
  space.move(room, 'a', { action: 'teleport' }, undefined, 'runes');
  snapshot = space.view(room, 'a');
  assert.equal(snapshot.visitors[0].teleportId, 1);
  assert.equal(snapshot.visitors[0].entrance, 'runes');
});

test('critical hits and birth-health variation use six-figure damage without changing hits to defeat', () => {
  const sequence = [0.5, 0, 0];
  const combat = createSceneCombat(() => sequence.shift() ?? 0.5),
    actor = { x: 0, y: 0 };
  combat.advance(actor, 0);
  const hit = combat.hit({ health: 1200000 }, actor, 1000);
  assert.deepEqual(hit, { damage: 270000, critical: true });
  assert.equal(actor.health, 930000);
});
