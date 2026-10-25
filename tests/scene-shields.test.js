const test = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');

test('active shields block inclusive 30–40% or author 40–50% on each incoming hit', () => {
  for (const author of [false, true])
    for (const [roll, percent] of [
      [0, author ? 40 : 30],
      [0.999999, author ? 50 : 40],
    ]) {
      let values = [];
      const combat = createSceneCombat(
        () => values.shift() ?? 0.5,
        (id) => author && id === 'target',
      );
      const caster = { id: 'caster', x: 10, y: 10 },
        target = { id: 'target', x: 20, y: 10 };
      combat.advance(caster, 0);
      combat.advance(target, 0);
      const before = target.health;
      assert.deepEqual(combat.protect(target, 100), { damage: 0, critical: false });
      assert.equal(target.health, before);
      values = [0.5, 0.5, roll];
      const hit = combat.hit(caster, target, 200);
      assert.equal(hit.damage, 200000 * (1 - percent / 100));
      assert.equal(target.health, before - hit.damage);
    }
});

test('each protected hit rolls again and mitigation follows critical and author attack scaling', () => {
  let values = [];
  const combat = createSceneCombat(
    () => values.shift() ?? 0.5,
    () => true,
  );
  const from = { id: 'from', x: 0, y: 0 },
    to = { id: 'to', x: 0, y: 0 };
  combat.advance(from, 0);
  combat.advance(to, 0);
  combat.protect(to, 0);
  values = [0.5, 0.5, 0];
  assert.equal(combat.hit(from, to, 100).damage, 138000);
  values = [0.5, 0.5, 0.999999];
  assert.equal(combat.hit(from, to, 200).damage, 115000);
  values = [0, 0, 0.5];
  assert.deepEqual(combat.hit(from, to, 300), { damage: 170775, critical: true });
});

test('recasting refreshes two seconds without stacking, expiry and death remove protection', () => {
  const combat = createSceneCombat(() => 0.5),
    from = { x: 0, y: 0 },
    to = { x: 0, y: 0 };
  combat.advance(from, 0);
  combat.advance(to, 0);
  combat.protect(to, 1000);
  combat.protect(to, 1500);
  assert.equal(to.shieldUntil, 3500);
  assert.equal(combat.hit(from, to, 3499).damage, 130000);
  assert.equal(combat.hit(from, to, 3500).damage, 200000);
  combat.protect(to, 3600);
  to.health = 1;
  combat.hit(from, to, 3700);
  assert.equal(to.shieldUntil, 0);
  assert.throws(() => combat.protect(to, 3800), { code: 'SCENE_RESPAWNING' });
  combat.advance(to, 6700);
  assert.equal(to.shieldUntil, 0);
  assert.equal(combat.hit(from, to, 6701).damage, 200000);
});

for (const effect of ['shield', 'sphere'])
  for (const author of [false, true]) {
    test(`${effect} grants the same mitigation in lobby and room scenes (author=${author})`, () => {
      let now = 1000;
      const eligible = (id) => author && id === 'b';
      const lobby = createLobby(
        () => now,
        undefined,
        () => 0.5,
        eligible,
      );
      const a = { id: 'a', display_name: 'A' },
        b = { id: 'b', display_name: 'B' };
      lobby.move(a, { x: 50, y: 50 });
      lobby.move(b, { x: 55, y: 50 });
      now += 10000;
      lobby.view(a);
      lobby.view(b);
      const defensive = { slot: 'q', effect, aspectRatio: 1.6, requestId: 'shield-cast-001' };
      lobby.attack(b, defensive);
      const offense = { slot: 'q', effect: 'beam', aspectRatio: 1.6, requestId: 'shield-hit-001' };
      const event = lobby.attack(a, offense).attacks.at(-1);
      assert.equal(event.damage, author ? 110000 : 130000);
      now += 2100;
      const expired = lobby.attack(a, { ...offense, requestId: 'shield-hit-002' }).attacks.at(-1);
      assert.equal(expired.damage, 200000);
      // Replaying the old cast must not grant another shield.
      lobby.attack(b, defensive);
      assert.equal(
        lobby.attack(a, { ...offense, slot: 'e', requestId: 'shield-hit-003' }).attacks.at(-1)
          .damage,
        200000,
      );

      const space = createRoomSpace(
          () => now,
          () => 0.5,
          eligible,
        ),
        room = {
          players: [
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ],
        };
      space.view(room, 'a');
      space.move(room, 'b', { x: 15, y: 38 });
      now += 10000;
      space.move(
        room,
        'b',
        { action: 'attack', slot: 'q', aspectRatio: 1.6, requestId: 'room-shield-001' },
        effect,
      );
      space.move(
        room,
        'a',
        { action: 'attack', slot: 'q', aspectRatio: 1.6, requestId: 'room-hit-001' },
        'beam',
      );
      assert.equal(space.view(room, 'a').attacks.at(-1).damage, author ? 110000 : 130000);
      now += 2100;
      space.move(
        room,
        'a',
        { action: 'attack', slot: 'q', aspectRatio: 1.6, requestId: 'room-hit-002' },
        'beam',
      );
      assert.equal(space.view(room, 'a').attacks.at(-1).damage, 200000);
    });
  }
