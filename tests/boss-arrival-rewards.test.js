const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createLobby } = require('../src/rooms/lobby');
const { createBossRewards } = require('../src/rooms/boss-rewards');
const { createSceneCombat, authorSpeed } = require('../src/rooms/scene-combat');
const { BUILTIN_FRAME_OPTIONS } = require('../src/barrage/builtins');
const chars = require('../src/profiles/appearance').builtinCharacters.map((c) => ({
  id: c.id,
  name: c.name,
  image: c.expressions.neutral,
}));
const user = { id: 'owner', display_name: 'Owner' },
  guest = { id: 'guest', display_name: 'Guest' };
function fixture(options = {}) {
  let t = 1000;
  return {
    lobby: createLobby(
      () => t,
      () => '/test',
      () => 0.25,
      () => false,
      { botCharacters: chars, ...options },
    ),
    step: (ms) => (t += ms),
  };
}

test('boss reward announcement uses the killer frame and a short blessing message', () => {
  const frame = BUILTIN_FRAME_OPTIONS.find((entry) => entry.id !== 'default').id;
  const killer = {
    id: 'killer',
    name: '玩家',
    health: 50,
    maxHealth: 100,
    lifeId: 'life',
    barrageFrameId: frame,
  };
  const events = [];
  const reward = createBossRewards(
    new Map([[killer.id, killer]]),
    new Map([['boss', { bossId: 'mutalith' }]]),
    (event) => events.push(event),
  );
  reward({ id: killer.id, energyLifeId: 'life' }, { id: 'boss', name: '漩渦獸' }, 1000);
  assert.equal(events[0].frame.id, frame);
  assert.equal(events[0].message, '擊敗 漩渦獸｜獵王祝福 15 秒');
  assert.equal(killer.bossBlessingUntil, 16000);
});

test('player same-slot cooldown rejects 1199ms and accepts 1200ms', () => {
  const { lobby, step } = fixture({ training: true });
  lobby.view(user);
  lobby.view(guest);
  lobby.bots(user, { action: 'add', mode: 'idle' });
  lobby.attack(user, { requestId: 'first-attack', slot: 'q', aspectRatio: 1.6 });
  step(1199);
  assert.throws(
    () => lobby.attack(user, { requestId: 'early-attack', slot: 'q', aspectRatio: 1.6 }),
    (error) => error.code === 'ATTACK_COOLDOWN',
  );
  step(1);
  assert.doesNotThrow(() =>
    lobby.attack(user, { requestId: 'ready-attack', slot: 'q', aspectRatio: 1.6 }),
  );
});
test('boss reserves capacity, warns for five seconds, falls before attacking, and can be cancelled', () => {
  const { lobby, step } = fixture();
  const b = lobby.bosses(user, { action: 'add', bossId: 'colossal' }).bosses[0];
  let s = lobby.view(user);
  assert.equal(s.bossArrivals[0].spawnAt, 6000);
  assert.ok(!s.visitors.some((v) => v.id === b.id));
  step(4999);
  assert.ok(!lobby.view(user).visitors.some((v) => v.id === b.id));
  step(1);
  s = lobby.view(user);
  assert.equal(s.visitors.find((v) => v.id === b.id).bossArrivalAt, 6000);
  assert.ok(!s.attacks.some((a) => a.fromId === b.id));
  step(699);
  assert.ok(!lobby.view(user).attacks.some((a) => a.fromId === b.id));
  lobby.bosses(user, { action: 'remove', id: b.id });
  const c = lobby.bosses(user, { action: 'add', bossId: 'gyo' }).bosses[0];
  lobby.bosses(user, { action: 'remove', id: c.id });
  step(6000);
  s = lobby.view(user);
  assert.ok(!s.visitors.some((v) => v.id === c.id));
  assert.equal((s.bossArrivals || []).length, 0);
});
test('arena has one neutral boss, forces bot attack mode, and respects match membership', () => {
  const { lobby, step } = fixture({ expandedMap: true, requireReady: true });
  lobby.arena(user, { action: 'team', team: 'red' });
  const bot = lobby.bots(user, { action: 'add', team: 'blue', mode: 'idle' }).bots[0];
  assert.equal(bot.mode, 'attack');
  const boss = lobby.bosses(user, { action: 'add', bossId: 'colossal' }).bosses[0];
  assert.equal(lobby.bosses(user).limit, 1);
  assert.throws(() => lobby.bosses(user, { action: 'add', bossId: 'gyo' }), {
    code: 'BOSSES_FULL',
  });
  lobby.arena(user, { action: 'ready', ready: true });
  const started = lobby.arena(user, {
    action: 'start',
    mode: 'pk',
    matchId: null,
    durationSeconds: 60,
    mapId: 1,
  });
  assert.equal(started.arena.match.players.length, 2);
  assert.ok(!started.arena.match.players.some((p) => p.id === boss.id));
  let npcHit = false;
  for (let i = 0; i < 100; i++) {
    step(400);
    const s = lobby.view(user);
    lobby.view(guest);
    npcHit ||= s.attacks.some((a) => a.fromId === boss.id && a.hits?.some((h) => h.damage > 0));
  }
  assert.ok(npcHit, 'boss can damage a running-match participant');
  assert.ok(
    !lobby
      .view(guest)
      .attacks.some(
        (a) => a.fromId === boss.id && a.hits?.some((h) => h.toId === guest.id && h.damage > 0),
      ),
    'bench viewer is protected',
  );
});
test('last damaging player receives one announcement and a capped heal; blessing refreshes and expires', () => {
  const killer = { id: 'player', name: 'Player', x: 30, y: 60 },
    boss = { id: 'boss', name: 'Boss', x: 35, y: 60 };
  const visitors = new Map([
      [killer.id, killer],
      [boss.id, boss],
    ]),
    bots = new Map([[boss.id, { bossId: 'colossal' }]]),
    messages = [];
  const combat = createSceneCombat(
    () => 0.99,
    () => false,
    {
      isObjective: (a) => !!bots.get(a.id)?.bossId,
      onKill: createBossRewards(visitors, bots, (e) => messages.push(e)),
    },
  );
  combat.reset(killer, 0);
  combat.reset(boss, 0);
  killer.maxHealth = 100;
  killer.health = 50;
  boss.health = 1;
  combat.hit(killer, boss, 1000, 'beam');
  assert.equal(killer.health, 60);
  assert.equal(killer.bossBlessingUntil, 16000);
  assert.equal(messages.length, 1);
  combat.hit(killer, boss, 1100, 'beam');
  assert.equal(messages.length, 1);
  assert.equal(killer.kda.kills, 0);
  assert.equal(authorSpeed(killer, 1000), 1.08);
  assert.equal(authorSpeed(killer, 16000), 1);
  assert.equal(combat.teleportCost(killer, 1000), 10);
  assert.equal(combat.teleportCost(killer, 16000), 20);
  combat.reset(boss, 2000);
  boss.health = 1;
  combat.hit(killer, boss, 2000, 'beam');
  assert.equal(killer.bossBlessingUntil, 17000);
  assert.equal(messages.length, 2);
  killer.health = killer.maxHealth;
  combat.reset(boss, 3000);
  boss.health = 1;
  combat.hit(killer, boss, 3000, 'beam');
  assert.equal(killer.health, 100);
  combat.reset(killer, 4000);
  assert.equal(killer.bossBlessingUntil, 0);
  assert.equal(combat.teleportCost(killer, 4000), 20);
});
test('blessing increases real damage by ten percent and is removed on death; NPCs cannot claim it', () => {
  const messages = [],
    a = { id: 'a', name: 'A' },
    b = { id: 'b', name: 'Boss' },
    v = new Map([
      ['a', a],
      ['b', b],
    ]),
    bots = new Map([['b', { bossId: 'colossal' }]]);
  const combat = createSceneCombat(
    () => 0.99,
    () => false,
    {
      isObjective: (a) => !!bots.get(a.id)?.bossId,
      onKill: createBossRewards(v, bots, (e) => messages.push(e)),
    },
  );
  combat.reset(a, 0);
  combat.reset(b, 0);
  const plain = combat.hit(a, b, 1000, 'beam').damage;
  a.bossBlessingUntil = 16000;
  const boosted = combat.hit(a, b, 1100, 'beam').damage;
  assert.equal(boosted, Math.round(plain * 1.1));
  b.health = 1;
  bots.set('a', {});
  combat.hit(a, b, 1200, 'beam');
  assert.equal(a.bossBlessingUntil, 16000, 'NPC receives no new blessing');
  combat.reset(b, 2000);
  a.health = 1;
  combat.hit(b, a, 2000, 'beam');
  assert.equal(a.bossBlessingUntil, 0);
});
test('arena boss HTTP uses the selected room and keeps the main lobby independent', async (t) => {
  const { appFixture } = require('./helpers/app-fixture.cjs'),
    { createAuth } = require('../src/auth');
  const f = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('arrival_http', 'test-password-123'),
  });
  const login = await fetch(f.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'arrival_http', password: 'test-password-123' }),
  });
  const headers = {
    Cookie: login.headers.get('set-cookie').split(';')[0],
    'Content-Type': 'application/json',
  };
  const request = async (route, body) => {
    const r = await fetch(f.base + route, {
      headers,
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  };
  assert.equal(
    (await request('/api/lobby/bosses?arena=1', { action: 'add', bossId: 'colossal' })).status,
    409,
  );
  assert.equal(
    (await request('/api/lobby/arena-room', { action: 'create', roomName: 'Boss測試' })).status,
    200,
  );
  const added = await request('/api/lobby/bosses?arena=1', { action: 'add', bossId: 'colossal' });
  assert.equal(added.status, 200);
  assert.equal(added.body.limit, 1);
  assert.equal(added.body.bosses[0].arrived, false);
  assert.equal(
    (await request('/api/lobby/bosses?arena=1', { action: 'add', bossId: 'gyo' })).status,
    409,
  );
  const scene = await request('/api/lobby?arena=1');
  assert.equal(scene.body.bossArrivals.length, 1);
  assert.ok(!scene.body.visitors.some((v) => v.bossId));
  assert.equal((await request('/api/lobby/bosses')).body.bosses.length, 0);
});
test('pending bosses reserve scene capacity without leaving an orphan bot after a rejected add', () => {
  const { lobby, step } = fixture();
  lobby.bosses(user, { action: 'add', bossId: 'colossal' });
  lobby.bosses(user, { action: 'add', bossId: 'gyo' });
  for (let i = 0; i < 76; i++) lobby.view({ id: 'peer-' + i, display_name: 'Peer' });
  lobby.bots(user, { action: 'add', mode: 'idle' });
  assert.throws(() => lobby.bots(user, { action: 'add', mode: 'idle' }), {
    code: 'SCENE_BOTS_FULL',
  });
  assert.equal(lobby.bots(user).bots.length, 1);
  step(5000);
  assert.equal(lobby.view(user).visitors.length, 80);
});
