const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const characters = require('../src/profiles/appearance').builtinCharacters.map((c) => ({
  id: c.id,
  name: c.name,
  image: c.expressions.neutral,
}));
const alice = { id: 'human-alice', display_name: 'Alice' },
  bob = { id: 'human-bob', display_name: 'Bob' };
function fixture(options = {}) {
  let clock = 1000;
  return {
    lobby: createLobby(
      () => clock,
      () => '/test-avatar',
      () => 0.25,
      () => false,
      { botCharacters: characters, ...options },
    ),
    advance: (ms) => (clock += ms),
  };
}

test('lobby bots have a global limit, private ownership and validated character/loadout', () => {
  const { lobby, advance } = fixture();
  for (let i = 0; i < 5; i++) lobby.bots(alice, { action: 'add' });
  assert.throws(() => lobby.bots(bob, { action: 'add' }), { code: 'SCENE_BOTS_FULL' });
  const bot = lobby.bots(alice).bots[0];
  assert.throws(() => lobby.bots(bob, { action: 'remove', id: bot.id }), { code: 'BOT_NOT_OWNED' });
  assert.throws(() => lobby.bots(alice, { action: 'update', id: bot.id, q: 'guanyin_barrage' }), {
    code: 'INVALID_SCENE_BOT',
  });
  assert.throws(
    () => lobby.bots(alice, { action: 'update', id: bot.id, characterId: 'someone-elses-avatar' }),
    { code: 'INVALID_SCENE_BOT' },
  );
  lobby.bots(alice, { action: 'remove', id: bot.id });
  assert.equal(lobby.bots(bob, { action: 'add', characterId: characters[4].id }).bots.length, 5);
  advance(3000);
  assert.equal(lobby.view(bob).visitors.filter((v) => v.image === characters[4].image).length, 1);
});

test('idle bots walk without attacking even after hits; attack mode actively fires', () => {
  const { lobby, advance } = fixture();
  const bot = lobby.bots(alice, { action: 'add', mode: 'idle' }).bots[0];
  advance(3000);
  let snapshot = lobby.view(alice),
    start = snapshot.visitors.find((v) => v.id === bot.id);
  advance(4000);
  snapshot = lobby.view(alice);
  advance(400);
  snapshot = lobby.view(alice);
  advance(400);
  snapshot = lobby.view(alice);
  assert.notEqual(snapshot.visitors.find((v) => v.id === bot.id).x, start.x);
  assert.equal(snapshot.attacks.length, 0);
  lobby.attack(alice, {
    requestId: 'test-stationary-hit-0001',
    aspectRatio: 1.6,
    slot: 'q',
    effect: 'beam',
  });
  let dummyWasHit = false;
  for (let i = 0; i < 15; i++) {
    advance(400);
    snapshot = lobby.view(alice);
    if (snapshot.visitors.find((v) => v.id === bot.id).health < start.health) dummyWasHit = true;
    assert.ok(!snapshot.attacks.some((e) => e.fromId === bot.id));
  }
  assert.ok(dummyWasHit, 'idle bot must remain passive after a real hit');
  lobby.bots(alice, { action: 'update', id: bot.id, mode: 'attack' });
  lobby.attack(alice, {
    requestId: 'test-human-attack-0001',
    aspectRatio: 1.6,
    slot: 'q',
    effect: 'beam',
  });
  let retaliation = false;
  for (let i = 0; i < 30; i++) {
    advance(400);
    snapshot = lobby.view(alice);
    if (snapshot.attacks.some((e) => e.fromId === bot.id)) retaliation = true;
  }
  assert.ok(retaliation, 'bot must use the real attack engine to return fire');
});

test('lobby bot arrival is authoritative, cancellable and uses the latest selected entrance after three seconds', () => {
  const { lobby, advance } = fixture();
  const bot = lobby.bots(alice, { action: 'add', entrance: 'classic' }).bots[0];
  let scene = lobby.view(alice);
  assert.equal(scene.botArrivals[0].spawnAt - scene.botArrivals[0].at, 3000);
  assert.ok(!scene.visitors.some((v) => v.id === bot.id));
  assert.throws(() => lobby.bots(alice, { action: 'replay', id: bot.id }), {
    code: 'BOT_ARRIVING',
  });
  lobby.bots(alice, { action: 'update', id: bot.id, entrance: 'classic', mode: 'attack' });
  advance(2999);
  assert.ok(!lobby.view(alice).visitors.some((v) => v.id === bot.id));
  advance(1);
  scene = lobby.view(alice);
  assert.equal(scene.visitors.find((v) => v.id === bot.id).entrance, 'classic');
  assert.equal(scene.botArrivals.length, 0);
  assert.ok(
    !scene.attacks.some((a) => a.fromId === bot.id),
    'no attack before or during materialisation',
  );
  advance(1499);
  assert.ok(!lobby.view(alice).attacks.some((a) => a.fromId === bot.id));
  const cancelled = lobby.bots(alice, { action: 'add' }).bots.at(-1);
  lobby.bots(alice, { action: 'remove', id: cancelled.id });
  advance(3000);
  assert.ok(!lobby.view(alice).visitors.some((v) => v.id === cancelled.id));
});

test('only walk and attack modes are accepted, with idle as the default', () => {
  const { lobby } = fixture();
  for (const mode of ['stationary', 'retaliate', 'unknown'])
    assert.throws(() => lobby.bots(alice, { action: 'add', mode }), { code: 'INVALID_SCENE_BOT' });
  assert.equal(lobby.bots(alice, { action: 'add' }).bots[0].mode, 'idle');
});

test('active bots still damage bosses while bosses prioritise the human player', () => {
  const { lobby, advance } = fixture();
  lobby.move(alice, { x: 95, y: 15 });
  advance(10000);
  lobby.view(alice);
  const bot = lobby.bots(alice, { action: 'add', mode: 'attack', q: 'beam', e: 'beam' }).bots[0];
  const boss = lobby.bosses(alice, { action: 'add', bossId: 'arkveld' }).bosses[0];
  let botHit = false,
    bossHit = false;
  for (let i = 0; i < 100; i++) {
    advance(400);
    const scene = lobby.view(alice);
    botHit ||= scene.attacks.some(
      (e) => e.fromId === bot.id && e.hits?.some((h) => h.toId === boss.id && h.damage > 0),
    );
    bossHit ||= scene.attacks.some((e) => e.fromId === boss.id && e.toId === alice.id);
    assert.ok(!scene.attacks.some((e) => e.fromId === boss.id && e.toId !== alice.id));
    if (botHit && bossHit) break;
  }
  assert.ok(botHit, 'bot damages boss');
  assert.ok(bossHit, 'boss chooses the human rather than a nearby bot');
});

test('expired owners remove their bots and training resets do not exist in the public lobby', () => {
  const { lobby, advance } = fixture();
  lobby.bots(alice, { action: 'add' });
  advance(16000);
  assert.equal(lobby.bots(bob).bots.length, 0);
  assert.throws(() => lobby.training(bob, 'refill', 'classic'), { code: 'TRAINING_ONLY' });
});

test('arena bots join a selected team ready, and cannot be changed during the match', () => {
  const { lobby } = fixture({ requireReady: true, expandedMap: true, startDelayMs: 5000 });
  lobby.arena(alice, { action: 'team', team: 'red' });
  const bot = lobby.bots(alice, { action: 'add', team: 'blue' }).bots[0];
  lobby.arena(alice, { action: 'ready', ready: true });
  const snapshot = lobby.arena(alice, {
    action: 'start',
    mode: 'pk',
    matchId: null,
    durationSeconds: 60,
    mapId: 1,
  });
  assert.equal(snapshot.arena.match.players.length, 2);
  assert.throws(() => lobby.bots(alice, { action: 'remove', id: bot.id }), {
    code: 'ARENA_LOCKED',
  });
});
