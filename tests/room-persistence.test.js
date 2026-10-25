'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/db');
const { createAuth } = require('../src/auth');

class Tracker {
  constructor(room) {
    this.room = room;
    this.count = 0;
  }
  bump() {
    this.count++;
  }
}
class Sample {
  constructor(code, name) {
    Object.assign(this, { code, name, type: 'sample', phase: 'waiting', players: [] });
    Object.defineProperty(this, 'receipts', { value: new Map(), enumerable: false });
    Object.defineProperty(this, 'tracker', { value: new Tracker(this), enumerable: false });
    this.rng = () => 4;
  }
  view() {
    return { phase: this.phase };
  }
}
const build = (saved) => {
  const room = new Sample(saved.code, saved.name);
  // Stand-in for history/achievement wrappers attached per instance.
  Object.defineProperty(room, 'view', { value: () => ({ wrapped: true, phase: room.phase }) });
  return room;
};

test('a captured room restores its data onto a freshly built room', () => {
  const room = build({ code: 'ABC123', name: 'table' });
  room.phase = 'playing';
  room.players.push({ id: 'p1', name: 'A', hand: new Set([1, 2]) });
  room.receipts.set('r1', { at: 5 });
  room.tracker.bump();
  room.self = { room };
  const saved = captureRoom(room, { seats: new Map([['u1', 'p1']]), owner: room });
  const { room: next, extra } = restoreRoom(structuredClone(saved), build);
  assert.notEqual(next, room);
  assert.equal(next.phase, 'playing');
  assert.deepEqual(next.players[0].hand, new Set([1, 2]));
  assert.deepEqual(next.receipts.get('r1'), { at: 5 }, 'non-enumerable maps are refilled in place');
  assert.equal(Object.keys(next).includes('receipts'), false);
  assert.ok(next.tracker instanceof Tracker, 'class instances keep their prototype');
  assert.equal(next.tracker.count, 1);
  assert.equal(next.tracker.room, next, 'references to the room point at the new room');
  assert.equal(next.self.room, next);
  assert.equal(next.rng(), 4, 'functions come from the fresh room');
  assert.equal(next.view().wrapped, true, 'per-instance wrappers are not overwritten');
  assert.equal(extra.owner, next);
  assert.equal(extra.seats.get('u1'), 'p1');
});

test('callbacks inside game state are reported; room methods and hidden wiring are not', () => {
  const room = build({ code: 'ABC123', name: 'table' });
  room.pending = { kind: 'dice', resolve: () => 1, steps: [{ apply() {} }] };
  Object.defineProperty(room, 'tracker2', { value: { finish() {} }, enumerable: false });
  const saved = captureRoom(room);
  assert.deepEqual([...saved.callbacks].sort(), ['pending.resolve', 'pending.steps[0].apply']);
  delete room.pending;
  assert.deepEqual(captureRoom(room).callbacks, []);
});

test('a snapshot from before callbacks were checked skips a thunder room with an open dice roll', async (t) => {
  const v8 = require('node:v8');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-room-legacy-'));
  const config = {
    dbFile: path.join(root, 'app.sqlite'),
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    host: '127.0.0.1',
    port: 0,
    externalSideEffectsEnabled: false,
    githubClient: { configured: false },
  };
  const room = (code, diceRoll) => ({
    type: 'thunder',
    code,
    name: code,
    data: new Map([
      ['players', { value: [], enumerable: true }],
      ['_diceRoll', { value: diceRoll, enumerable: true }],
    ]),
    extra: { seats: new Map() },
  });
  fs.writeFileSync(
    config.dbFile + '.rooms',
    v8.serialize({
      schema: 1,
      savedAt: Date.now(),
      rooms: [room('AAAAAA', { faces: [[1]], rerolls: 0 }), room('BBBBBB', null)],
      grace: [],
    }),
  );
  const warnings = [];
  t.mock.method(console, 'warn', (message) => warnings.push(String(message)));
  const app = createApp(config);
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  await app.listen();
  assert.ok(
    warnings.some((message) => message.includes('AAAAAA') && message.includes('dice roll')),
  );
  assert.ok(!warnings.some((message) => message.includes('BBBBBB')));
});

// Every game, with bots, and the non-game lounge survive a restart on the same data.
const GAMES = [
  'poker',
  'thunder',
  'majority',
  'gift',
  'trpg',
  'quacks',
  'bluff',
  'telephone',
  'musicquiz',
  'minimal',
  'draw',
  'lounge',
];
test('open rooms of every game survive an app restart and keep playing', async (t) => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-room-persist-'));
  let server = null;
  // Close the running app before removing its data directory.
  t.after(async () => {
    await server?.app.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const config = {
    dbFile: path.join(root, 'app.sqlite'),
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    host: '127.0.0.1',
    port: 0,
    externalSideEffectsEnabled: false,
    githubClient: { configured: false },
  };
  const db = openDatabase(config.dbFile);
  try {
    await createAuth(db).bootstrap('persist_owner', 'persist-test-password');
  } finally {
    db.close();
  }
  async function boot() {
    const app = createApp(config);
    const { port } = await app.listen();
    const base = 'http://127.0.0.1:' + port;
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'persist_owner', password: 'persist-test-password' }),
    });
    assert.equal(login.status, 200);
    const headers = {
      Cookie: login.headers.get('set-cookie').split(';')[0],
      'Content-Type': 'application/json',
    };
    const call = async (route, body) => {
      const response = await fetch(base + '/api/' + route, {
        method: body ? 'POST' : 'GET',
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    };
    return { app, call };
  }

  server = await boot();
  const before = new Map();
  for (const type of GAMES) {
    const created = await server.call('create', { type, roomName: 'persist ' + type });
    assert.equal(created.status, 200, type + ' create');
    const { code } = created.body;
    if (type !== 'lounge') {
      for (let i = 0; i < 3; i++) await server.call('bot', { code });
      await server.call('start', { code });
    }
    const state = await server.call('state?code=' + code);
    assert.equal(state.status, 200, type + ' state');
    before.set(type, { code, state: state.body });
  }
  await server.app.close();
  assert.ok(fs.existsSync(config.dbFile + '.rooms'), 'rooms are saved on close');

  server = await boot();
  assert.equal(fs.existsSync(config.dbFile + '.rooms'), false, 'the saved file is consumed');
  for (const [type, { code, state }] of before) {
    const after = await server.call('state?code=' + code);
    if (state.diceCheck) {
      // An open dice roll waits on a callback that cannot be saved, so that
      // room is not kept; it ends as it did before rooms were kept.
      assert.equal(after.status, 404, type + ' with an open dice roll is not restored');
      continue;
    }
    assert.equal(after.status, 200, type + ' is still open after restart');
    for (const key of ['code', 'type', 'me', 'phase', 'round', 'name'])
      assert.deepEqual(after.body[key], state[key], type + ' keeps ' + key);
    assert.deepEqual(
      after.body.players.map((p) => p.id),
      state.players.map((p) => p.id),
      type + ' keeps its players',
    );
    assert.notEqual(after.body.interrupted, true, type + ' is not interrupted');
    // Pages compare these ids to tell a restored room from a replaced one.
    assert.deepEqual(
      [
        after.body.roomInstanceId,
        after.body.media?.roomInstanceId,
        after.body.watch?.roomInstanceId,
      ],
      [state.roomInstanceId, state.media?.roomInstanceId, state.watch?.roomInstanceId],
      type + ' keeps its instance ids',
    );
  }
  // Bots keep playing after the restart, through the restored scheduler.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  let advanced = 0;
  for (const [type, { code, state }] of before) {
    if (state.diceCheck) continue;
    const after = await server.call('state?code=' + code);
    assert.equal(after.status, 200, type + ' still readable');
    if (after.body.stateTag !== state.stateTag) advanced++;
  }
  assert.ok(advanced > 0, 'restored games continue changing');
});

test('a closing server turns away new requests, so reconnecting streams cannot hold it open', async (t) => {
  const { appFixture } = require('./helpers/app-fixture.cjs');
  const f = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('closing_owner', 'persist-test-password'),
  });
  const login = await fetch(f.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'closing_owner', password: 'persist-test-password' }),
  });
  const headers = {
    Cookie: login.headers.get('set-cookie').split(';')[0],
    'Content-Type': 'application/json',
  };
  const { code } = await (
    await fetch(f.base + '/api/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'majority' }),
    })
  ).json();
  const stream = await fetch(f.base + '/api/pings/events?code=' + code, { headers });
  assert.equal(stream.status, 200);
  const started = Date.now(),
    closing = f.app.close();
  // A browser reconnects at once, possibly over a socket that is still open.
  const again = await fetch(f.base + '/api/pings/events?code=' + code, { headers }).catch(
    () => null,
  );
  if (again) assert.equal(again.status, 503);
  await closing;
  assert.ok(Date.now() - started < 5000, 'close finishes promptly');
  await stream.body?.cancel().catch(() => {});
});

test('a server that fails to start leaves the saved rooms for the next attempt', async (t) => {
  const net = require('node:net');
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bga-room-owner-'));
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    blocker.close();
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const config = {
    dbFile: path.join(root, 'app.sqlite'),
    communityDir: path.join(root, 'community'),
    musicDir: path.join(root, 'music'),
    host: '127.0.0.1',
    port: blocker.address().port,
    externalSideEffectsEnabled: false,
    githubClient: { configured: false },
  };
  fs.writeFileSync(config.dbFile + '.rooms', 'saved by the previous server');
  const app = createApp(config);
  await assert.rejects(app.listen(), /EADDRINUSE/);
  assert.equal(fs.readFileSync(config.dbFile + '.rooms', 'utf8'), 'saved by the previous server');
});
