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
  const { lobby } = fixture();
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
  assert.equal(lobby.view(bob).visitors.filter((v) => v.image === characters[4].image).length, 1);
});

test('idle bots walk without attacking even after hits; attack mode actively fires', () => {
  const { lobby, advance } = fixture();
  const bot = lobby.bots(alice, { action: 'add', mode: 'idle' }).bots[0];
  let snapshot = lobby.view(alice),
    start = snapshot.visitors.find((v) => v.id === bot.id);
  advance(4000);
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
  const boss = lobby.bosses(alice, { action: 'add', bossId: 'thanos' }).bosses[0];
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

for (const mode of ['pk', 'team', 'brawl'])
  test(`${mode} countdown keeps bot position, movement goal and interpolation stationary until start`, () => {
    const { lobby, advance } = fixture({
      requireReady: true,
      expandedMap: true,
      startDelayMs: 5000,
    });
    lobby.arena(alice, { action: 'team', team: 'red' });
    const bot = lobby.bots(alice, { action: 'add', team: 'blue' }).bots[0];
    advance(2000);
    lobby.view(alice);
    lobby.arena(alice, { action: 'ready', ready: true });
    const started = lobby.arena(alice, {
      action: 'start',
      mode,
      matchId: null,
      durationSeconds: 60,
      mapId: 1,
    });
    const read = (scene) => {
      const b = scene.visitors.find((v) => v.id === bot.id);
      return {
        x: b.x,
        y: b.y,
        targetX: b.targetX,
        targetY: b.targetY,
        moveId: b.moveId,
        remainingMs: b.remainingMs,
      };
    };
    const initial = read(started);
    assert.equal(initial.x, initial.targetX);
    assert.equal(initial.y, initial.targetY);
    assert.equal(initial.remainingMs, 0);
    for (let i = 0; i < 19; i++) {
      advance(250);
      const state = lobby.view(alice);
      assert.deepEqual(read(state), initial);
      assert.ok(!state.attacks.some((e) => e.fromId === bot.id && e.at >= started.serverNow));
    }
    advance(249);
    assert.deepEqual(read(lobby.view(alice)), initial);
    let resumed = false;
    for (let i = 0; i < 10; i++) {
      advance(400);
      const state = lobby.view(alice);
      resumed ||=
        read(state).moveId !== initial.moveId ||
        state.attacks.some((e) => e.fromId === bot.id && e.at >= started.arena.match.startedAt);
    }
    assert.ok(resumed, 'AI resumes after the full countdown');
  });
