const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSceneCombat } = require('../src/rooms/scene-combat');
const { createLobby } = require('../src/rooms/lobby');

test('KDA awards one kill/death and unique recent assists, survives respawn without leaking the mutable record', () => {
  const combat = createSceneCombat(() => 0.5);
  const [killer, helper, expired, victim] = ['killer', 'helper', 'expired', 'victim'].map((id) => ({
    id,
    x: 10,
    y: 30,
  }));
  for (const actor of [killer, helper, expired, victim]) combat.advance(actor, 0);
  combat.hit(expired, victim, 100);
  combat.hit(helper, victim, 1000);
  combat.hit(helper, victim, 1100);
  combat.hit(killer, victim, 11100);
  // Inclusive 10-second window for the helper; expired attacker has no assist.
  victim.health = 1;
  combat.hit(killer, victim, 11100);
  assert.deepEqual(combat.view(killer).kda, { kills: 1, deaths: 0, assists: 0 });
  assert.deepEqual(combat.view(helper).kda, { kills: 0, deaths: 0, assists: 1 });
  assert.equal(combat.view(expired).kda.assists, 0);
  assert.equal(combat.view(victim).kda.deaths, 1);
  assert.equal(combat.hit(killer, victim, 11101).damage, 0);
  combat.view(killer).kda.kills = 1000;
  assert.equal(combat.view(killer).kda.kills, 1);
  combat.advance(victim, 14100);
  victim.health = 1;
  combat.hit(killer, victim, 14101);
  assert.equal(combat.view(killer).kda.kills, 2);
  assert.equal(combat.view(helper).kda.assists, 1, 'previous life contributions cleared');
  assert.equal(combat.view(victim).kda.deaths, 2);
});

test('lobby retry cannot increment KDA twice', () => {
  let now = 1000;
  const lobby = createLobby(
    () => now,
    undefined,
    () => 0.5,
  );
  const a = { id: 'a', display_name: 'A' },
    b = { id: 'b', display_name: 'B' };
  lobby.view(a);
  lobby.view(b);
  lobby.move(a, { x: 30, y: 40 });
  lobby.move(b, { x: 35, y: 40 });
  now += 10000;
  // Keep both actors present while walking into range.
  lobby.view(a);
  lobby.view(b);
  for (let i = 0; i < 6; i++) {
    now += 1600;
    const input = { requestId: 'kda-retry-' + i, aspectRatio: 1, slot: 'q', effect: 'beam' };
    lobby.attack(a, input);
    lobby.attack(a, input);
    lobby.view(b);
  }
  now += 1620;
  const state = lobby.view(a);
  assert.equal(state.visitors.find((v) => v.id === a.id).kda.kills, 1);
  assert.equal(state.visitors.find((v) => v.id === b.id).kda.deaths, 1);
});
