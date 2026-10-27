'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createAttackTimeline } = require('../src/rooms/attack-timeline');
const { createLobby } = require('../src/rooms/lobby');
const { createRoomSpace } = require('../src/rooms/space');
test('Babylon reference range already includes author damage, exact whole-cast integer partitions and independent critical/guard', () => {
  for (const author of [false, true])
    for (const [roll, reference] of [
      [0, 828000],
      [0.999999999, 1112000],
    ]) {
      let values = [];
      const combat = createSceneCombat(
        () => values.shift() ?? 0.9,
        (id) => author && id === 'a',
      );
      const a = { id: 'a', x: 20, y: 50 },
        b = { id: 'b', x: 40, y: 50 };
      combat.advance(a, 0);
      combat.advance(b, 0);
      b.health = b.maxHealth = 5000000;
      a.health = 500001;
      const max = a.maxHealth;
      combat.protect(a, 0);
      combat.cast(a, 'gate_of_babylon', 100);
      assert.equal(a.health, 350000, 'cost is current HP, rounded, not reduced by shields');
      assert.equal(a.maxHealth, max);
      const timeline = createAttackTimeline(combat),
        event = {
          id: 'cast',
          effect: 'gate_of_babylon',
          at: 100,
          fromId: 'a',
          fromX: 20,
          fromY: 50,
          toId: 'b',
          toX: 40,
          toY: 50,
          aspectRatio: 1,
        };
      values = [roll];
      timeline.prepare(event, a, [b]);
      assert.equal(b.health, 5000000);
      timeline.advance([event], [a, b], 3980, (actor, time) => combat.advance(actor, time));
      const total = event.hits.reduce((n, h) => n + h.damage, 0),
        weapons = event.hits.filter((h) => h.phase !== 'ea').reduce((n, h) => n + h.damage, 0),
        ea = event.hits.find((h) => h.phase === 'ea').damage;
      assert.equal(total, author ? reference : Math.round(reference / 1.15));
      assert.ok(Math.abs(ea - 2 * weapons) <= 1);
      const before = b.health;
      timeline.advance([event], [a, b], 3980, () => {});
      assert.equal(b.health, before);
      values = [0.1];
      const crit = combat.hit(
        { health: 1, authorBonus: author, comboDamage: total },
        b,
        4000,
        'gate_of_babylon',
        2,
        'ea',
      );
      assert.equal(crit.critical, true);
      assert.equal(crit.damage, Math.round(ea * 1.5));
      combat.protect(b, 4000);
      values = [0.9, 0];
      const shielded = combat.hit(
        { health: 1, authorBonus: author, comboDamage: total },
        b,
        4001,
        'gate_of_babylon',
        2,
        'ea',
      );
      assert.equal(shielded.damage, Math.round(ea * 0.7));
    }
});
test('Babylon cost cannot kill, alter max HP or award any KDA', () => {
  const combat = createSceneCombat(() => 0.5),
    a = { id: 'a', x: 20, y: 50 };
  combat.advance(a, 0);
  const max = a.maxHealth;
  a.health = 1;
  combat.cast(a, 'gate_of_babylon', 100);
  assert.equal(a.health, 1);
  assert.equal(a.maxHealth, max);
  assert.deepEqual(a.kda, { kills: 0, deaths: 0, assists: 0 });
  assert.equal(a.respawnAt, 0);
});
test('accepted lobby and room casts pay once; retry, cooldown rejection and missing target never pay again', () => {
  for (const roomMode of [false, true]) {
    let now = 1000;
    const a = { id: 'a', name: 'a', display_name: 'a' },
      b = { id: 'b', name: 'b', display_name: 'b' },
      room = { players: [a, b] };
    const scene = roomMode
      ? createRoomSpace(
          () => now,
          () => 0.5,
        )
      : createLobby(
          () => now,
          undefined,
          () => 0.5,
        );
    const view = () => (roomMode ? scene.view(room, 'a') : scene.view(a));
    const move = (user, x) =>
      roomMode ? scene.move(room, user.id, { x, y: 50 }) : scene.move(user, { x, y: 50 });
    if (roomMode) scene.view(room, 'a');
    else {
      scene.view(a);
      scene.view(b);
    }
    move(a, 20);
    move(b, 40);
    now += 10000;
    view();
    const input = { action: 'attack', slot: 'q', aspectRatio: 1, requestId: 'babylon-cost-once' };
    const cast = (data) => {
      if (roomMode) return scene.move(room, 'a', data, 'gate_of_babylon');
      const { action, ...payload } = data;
      return scene.attack(a, { ...payload, effect: 'gate_of_babylon' });
    };
    const getHP = () => view().visitors.find((v) => v.id === 'a').health;
    const before = getHP();
    cast(input);
    const after = getHP();
    assert.equal(after, Math.floor(before * 0.7));
    cast(input);
    assert.equal(getHP(), after);
    assert.throws(() => cast({ ...input, requestId: 'babylon-cost-reject' }), {
      code: 'ATTACK_COOLDOWN',
    });
    assert.equal(getHP(), after);
    const alone = roomMode
      ? createRoomSpace(
          () => now,
          () => 0.5,
        )
      : createLobby(
          () => now,
          undefined,
          () => 0.5,
        );
    const empty = { players: [a] };
    const aloneView = () => (roomMode ? alone.view(empty, 'a') : alone.view(a));
    const hp = aloneView().visitors[0].health;
    assert.throws(
      () =>
        roomMode
          ? alone.move(empty, 'a', input, 'gate_of_babylon')
          : alone.attack(a, {
              slot: 'q',
              aspectRatio: 1,
              requestId: 'babylon-no-target',
              effect: 'gate_of_babylon',
            }),
      { code: 'NO_ATTACK_TARGET' },
    );
    assert.equal(aloneView().visitors[0].health, hp);
  }
});
