'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const v8 = require('node:v8');
const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
const { CeoRoom } = require('../src/games/ceo-room');
const { SecondWindRoom } = require('../src/games/second-wind/room');

function create(Type, count = 3) {
  const room = new Type('AB1290', 'synthetic restart', (n) => n - 1);
  for (let i = 0; i < count; i++) room.add('Seat ' + i);
  return room;
}
function roundTrip(room) {
  const Type = room.type === 'ceo' ? CeoRoom : SecondWindRoom;
  const before = room.activePlayers().map((p) => room.view(p.id)),
    observer = room.observerGame();
  const saved = v8.deserialize(v8.serialize(captureRoom(room)));
  const restored = restoreRoom(saved, (s) => new Type(s.code, s.name)).room;
  assert.deepEqual(
    restored.activePlayers().map((p) => restored.view(p.id)),
    before,
  );
  assert.deepEqual(restored.observerGame(), observer);
  for (const view of [...before, observer]) {
    if (!view) continue;
    assert.doesNotMatch(
      JSON.stringify(view),
      /"(?:privateState|randomKey|randomIndex|twistDeck|deck|selections)":/,
    );
  }
  return restored;
}
function nextCommand(room, step = 0) {
  const g = room.view(room.host).game;
  if (!g || g.phase === 'finished') return null;
  let id,
    action,
    data = {};
  if (room.type === 'ceo') {
    id = g.turnId;
    const p = g.players.find((p) => p.id === id);
    const company = g.market.find((slot) => slot.card.assets + slot.extraCost <= p.cash);
    action = company ? 'acquire' : 'dividend';
    if (company) data.companyId = company.card.id;
  } else if (g.phase.endsWith('rolloff')) {
    id = g.players.find((id) => !Object.hasOwn(g.rolls, id));
    action = 'roll';
  } else if (g.phase === 'drafting') {
    id = g.turnId;
    action = 'draft';
    data.racerId = g.market[step % g.market.length];
  } else if (g.phase === 'choosing') {
    id = g.players.find((id) => !g.selectedIds.includes(id));
    action = 'select';
    data.racerId = g.teams[id][0];
  } else if (g.pending) {
    id = g.pending.playerId;
    action = 'choice';
    const p = room.view(id).game.pending;
    data.choiceId = p.id;
    data.value =
      p.options.find((o) => o.value === 'end')?.value ??
      p.options.find((o) => o.value === 'skip')?.value ??
      p.options[step % p.options.length].value;
  } else if (g.phase === 'racing') {
    id = g.turnId;
    action = 'roll';
  } else if (g.phase === 'race-result') {
    id = g.first;
    action = 'next-race';
  } else throw Error('Unexpected phase ' + g.phase);
  return {
    id,
    action,
    data: { ...data, requestId: randomUUID(), roundId: room.roundId, expectedRevision: g.revision },
  };
}

test('CEO keeps private deck, adjustments, all views and idempotent receipts through every legal turn', () => {
  let room = create(CeoRoom, 6);
  room = roundTrip(room);
  room.start();
  let steps = 0;
  while (room.phase !== 'finished' && steps++ < 600) {
    const command = nextCommand(room, steps);
    room.act(command.id, command.action, command.data);
    room = roundTrip(room);
    const before = room.view(command.id);
    room.act(command.id, command.action, command.data);
    assert.deepEqual(
      room.view(command.id),
      before,
      'a pre-restart receipt cannot pay or purchase twice',
    );
    assert.throws(
      () => room.act(command.id, command.action, { ...command.data, expectedRevision: -1 }),
      /內容不一致/,
    );
  }
  assert.equal(room.phase, 'finished');
  assert.ok(room.view(room.host).game.results);
  room = roundTrip(room);
  room.start();
  assert.equal(roundTrip(room).phase, 'playing');
});

test('all athlete packs resume draft RNG, secret choices, pending queues and all four races', () => {
  const phases = new Set();
  let pending = 0;
  for (const pack of ['base', 'second-wind', 'mixed']) {
    let room = create(SecondWindRoom);
    room.configure(room.host, { racerSet: pack });
    room = roundTrip(room);
    assert.equal(room.options.racerSet, pack);
    room.start();
    let steps = 0;
    while (room.phase !== 'finished' && steps++ < 2500) {
      const g = room.view(room.host).game;
      phases.add(g.phase);
      if (g.pending) pending++;
      const command = nextCommand(room, steps);
      room.act(command.id, command.action, command.data);
      room = roundTrip(room);
      const before = room.view(command.id);
      room.act(command.id, command.action, command.data);
      assert.deepEqual(room.view(command.id), before);
    }
    assert.equal(room.phase, 'finished', pack + ' completes after repeated restarts');
    assert.equal(room.view(room.host).game.results.length, 4);
  }
  for (const phase of [
    'draft-rolloff',
    'drafting',
    'race-rolloff',
    'choosing',
    'racing',
    'race-result',
  ])
    assert(phases.has(phase), phase);
  assert(pending > 0, 'exercise the real pending ability continuation');
});

test('draft randomness continues from the saved key/index, not a new constructor seed', () => {
  const room = create(SecondWindRoom);
  room.start();
  const restored = roundTrip(room);
  const command = nextCommand(room);
  room.act(command.id, command.action, command.data);
  restored.act(command.id, command.action, command.data);
  const original = room.view(room.host),
    after = restored.view(room.host);
  original.game.events = original.game.events.map(({ at, ...event }) => event);
  after.game.events = after.game.events.map(({ at, ...event }) => event);
  assert.deepEqual(after, original);
});

test('missing or unsupported private state ends only that match explicitly, keeps seats and permits restart', (t) => {
  t.mock.method(console, 'warn', () => {});
  for (const Type of [CeoRoom, SecondWindRoom]) {
    for (const change of [
      (s) => {
        delete s.privateState;
      },
      (s) => {
        s.privateState.version = 999;
      },
      (s) => {
        s.privateState.participants = [];
      },
      (s) => {
        s.privateState.game.state = {};
      },
    ]) {
      const room = create(Type);
      room.start();
      const saved = captureRoom(room);
      change(saved);
      const result = restoreRoom(saved, (s) => new Type(s.code, s.name));
      const after = result.room.view(room.host);
      assert.equal(result.privateStateFailed, true);
      assert.equal(after.phase, 'finished');
      assert.equal(after.interrupted, true);
      assert.equal(after.restoreFailed, true);
      assert.equal(after.game, null);
      assert.equal(after.winner, null);
      assert.deepEqual(after.results, []);
      assert.match(after.log[0], /伺服器重啟後無法安全還原/);
      assert.notEqual(after.roundId, room.roundId);
      assert.deepEqual(
        after.players.map((p) => p.id),
        room.players.map((p) => p.id),
      );
      assert.equal(roundTrip(result.room).view(room.host).restoreFailed, true);
      result.room.start();
      assert.equal(result.room.view(room.host).restoreFailed, false);
      assert.equal(result.room.phase, 'playing');
    }
  }
});

test('legacy waiting rooms and already interrupted rooms retain a safe restart path', (t) => {
  t.mock.method(console, 'warn', () => {});
  for (const Type of [CeoRoom, SecondWindRoom]) {
    const waiting = create(Type),
      saved = captureRoom(waiting);
    delete saved.privateState;
    assert.equal(restoreRoom(saved, (s) => new Type(s.code, s.name)).room.phase, 'waiting');
    let room = create(Type);
    room.start();
    room.kick(room.host, room.players[2].id);
    room = roundTrip(room);
    assert.equal(room.interrupted, true);
    assert.equal(room.view(room.host).game, null);
  }
});

test('real HTTP restarts keep private projections, spectators, identities and old receipts; bad state interrupts only its own room', async (t) => {
  const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path');
  const { createApp } = require('../src/app'),
    { openDatabase } = require('../src/db'),
    { createAuth } = require('../src/auth');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-private-restart-'));
  const config = {
    host: '127.0.0.1',
    port: 0,
    dbFile: path.join(root, 'app.sqlite'),
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    ceoEnabled: true,
    secondWindEnabled: true,
    marketAutomationEnabled: false,
    externalSideEffectsEnabled: false,
    githubClient: { configured: false },
  };
  let app, base;
  t.after(async () => {
    await app?.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const db = openDatabase(config.dbFile);
  try {
    await createAuth(db).bootstrap('restore_owner', 'synthetic-restore-password');
    const hash = db
      .prepare('SELECT password_hash FROM users WHERE username=?')
      .get('restore_owner').password_hash;
    for (let n = 1; n <= 3; n++)
      db.prepare(
        'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      ).run(
        randomUUID(),
        'restore_peer_' + n,
        'Peer ' + n,
        hash,
        'member',
        new Date().toISOString(),
      );
  } finally {
    db.close();
  }
  async function boot() {
    app = createApp(config);
    base = 'http://127.0.0.1:' + (await app.listen()).port;
  }
  async function request(route, cookie, data, expected = 200) {
    const response = await fetch(base + '/api/' + route, {
      method: data ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await response.json();
    assert.equal(response.status, expected, JSON.stringify(body));
    return { body, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  await boot();
  const cookies = [];
  for (const username of ['restore_owner', 'restore_peer_1', 'restore_peer_2', 'restore_peer_3'])
    cookies.push(
      (await request('auth/login', null, { username, password: 'synthetic-restore-password' }))
        .cookie,
    );
  const rooms = [];
  for (const type of ['ceo', 'second-wind']) {
    const { code } = (await request('create', cookies[0], { type })).body;
    for (const cookie of cookies.slice(1, 3)) await request('join', cookie, { code });
    rooms.push({ type, code });
  }
  async function states(code) {
    return Promise.all(
      cookies.slice(0, 3).map(async (c) => (await request('state?code=' + code, c)).body),
    );
  }
  async function checkpoint(last = null) {
    const before = await Promise.all(
      rooms.map(async (r) => ({
        views: await states(r.code),
        watch: (await request('watch?code=' + r.code, cookies[3])).body,
      })),
    );
    await app.close();
    const saved = v8.deserialize(fs.readFileSync(config.dbFile + '.rooms'));
    assert.equal(saved.rooms.length, 2);
    assert(saved.rooms.every((r) => r.privateState && r.extra.seats instanceof Map));
    if (process.platform !== 'win32')
      assert.equal(fs.statSync(config.dbFile + '.rooms').mode & 0o777, 0o600);
    await boot();
    for (let i = 0; i < rooms.length; i++) {
      const after = await states(rooms[i].code);
      for (let seat = 0; seat < 3; seat++) {
        for (const key of [
          'code',
          'me',
          'roundId',
          'phase',
          'interrupted',
          'game',
          'options',
          'results',
          'winner',
        ])
          assert.deepEqual(
            after[seat][key],
            before[i].views[seat][key],
            rooms[i].type + ' keeps ' + key,
          );
        assert.equal(after[seat].roomInstanceId, before[i].views[seat].roomInstanceId);
        assert.equal(after[seat].media.roomInstanceId, before[i].views[seat].media.roomInstanceId);
        assert.doesNotMatch(
          JSON.stringify(after[seat]),
          /"(?:privateState|randomKey|randomIndex|twistDeck|deck|selections)":/,
        );
      }
      const watch = (await request('watch?code=' + rooms[i].code, cookies[3])).body;
      assert.deepEqual(watch.sections, before[i].watch.sections);
      assert.doesNotMatch(
        JSON.stringify(watch),
        /"(?:privateState|randomKey|randomIndex|twistDeck|deck|selections)":/,
      );
    }
    if (last) {
      const before = (await request('state?code=' + last.data.code, last.cookie)).body;
      const repeated = (await request('action', last.cookie, last.data)).body;
      assert.deepEqual(repeated.game, before.game);
      assert.equal(repeated.version, before.version);
      const conflict = await request(
        'action',
        last.cookie,
        { ...last.data, expectedRevision: -1 },
        409,
      );
      assert.equal(conflict.body.code, 'REQUEST_CONFLICT');
    }
  }
  await checkpoint();
  for (const room of rooms) await request('start', cookies[0], { code: room.code });
  const ceo = rooms[0],
    athlete = rooms[1];
  let views = await states(ceo.code);
  const command = nextCommand({
    type: 'ceo',
    host: views[0].me,
    roundId: views[0].roundId,
    view: (id) => views.find((v) => v.me === id),
  });
  const purchase = {
    cookie: cookies[views.findIndex((v) => v.me === command.id)],
    data: { code: ceo.code, action: command.action, ...command.data },
  };
  await request('action', purchase.cookie, purchase.data);
  await checkpoint(purchase);
  const seen = new Set();
  let last = null;
  for (let step = 0; step < 200; step++) {
    views = await states(athlete.code);
    const g = views[0].game;
    const stage = g.phase + (g.phase === 'choosing' ? ':' + g.selectedIds.length : '');
    if (!seen.has(stage) && (g.phase !== 'choosing' || g.selectedIds.length <= 1)) {
      seen.add(stage);
      await checkpoint(last);
    }
    if (g.phase === 'racing') break;
    const next = nextCommand(
      {
        type: 'second-wind',
        host: views[0].me,
        roundId: views[0].roundId,
        view: (id) => views.find((v) => v.me === id),
      },
      step,
    );
    last = {
      cookie: cookies[views.findIndex((v) => v.me === next.id)],
      data: { code: athlete.code, action: next.action, ...next.data },
    };
    await request('action', last.cookie, last.data);
  }
  for (const phase of [
    'draft-rolloff',
    'drafting',
    'race-rolloff',
    'choosing:0',
    'choosing:1',
    'racing',
  ])
    assert(seen.has(phase), phase);
  await app.close();
  const saved = v8.deserialize(fs.readFileSync(config.dbFile + '.rooms'));
  saved.rooms.find((r) => r.type === 'ceo').privateState.game.version = 999;
  fs.writeFileSync(config.dbFile + '.rooms', v8.serialize(saved));
  const warnings = [];
  t.mock.method(console, 'warn', (x) => warnings.push(String(x)));
  await boot();
  const broken = (await request('state?code=' + ceo.code, cookies[0])).body;
  assert.equal(broken.restoreFailed, true);
  assert.equal(broken.interrupted, true);
  assert.equal(broken.game, null);
  assert.match(broken.log[0], /伺服器重啟後/);
  assert.equal((await request('state?code=' + athlete.code, cookies[0])).body.game.phase, 'racing');
  assert.equal(warnings.length, 1);
  const fresh = (await request('start', cookies[0], { code: ceo.code })).body;
  assert.equal(fresh.restoreFailed, false);
  assert.equal(fresh.phase, 'playing');
});
