const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { DrawGuessRoom } = require('../src/games/draw-guess'),
  { GiftRoom } = require('../src/games/gift'),
  { MajorityRoom } = require('../src/games/majority');
const { leavePlayer } = require('../src/rooms/lifecycle'),
  { MAX_PLAYER_RECORDS, rejoinPlayer } = require('../src/rooms/membership');
const { createApp } = require('../src/app'),
  { openDatabase } = require('../src/db/index'),
  { createAuth } = require('../src/auth/index');
for (const Engine of [DrawGuessRoom, GiftRoom, MajorityRoom])
  test(
    Engine.name +
      ': 1000 in-memory waiting cycles bound players and snapshots and still allow start',
    () => {
      const r = new Engine('B0A123', 'churn'),
        host = r.add('host');
      for (let i = 0; i < 1000; i++) {
        const p = r.add('guest');
        leavePlayer(r, p.id);
        assert.equal(r.players.length, 1);
        assert.equal(r.host, host.id);
        assert.equal(
          r.players.some((player) => player.id === p.id),
          false,
        );
        assert.ok(Buffer.byteLength(JSON.stringify(r.view(host.id))) < 5000);
      }
      for (let i = 0; i < (Engine === GiftRoom || Engine === MajorityRoom ? 2 : 1); i++)
        r.add('ready' + i);
      r.start();
      assert.notEqual(r.phase, 'waiting');
    },
  );
test('in-progress departed identities are capped and voluntary rejoin preserves the same seat and score', () => {
  const r = new DrawGuessRoom('A0A123', 'record cap'),
    host = r.add('host'),
    guest = r.add('guest');
  r.start();
  const former = [];
  for (let i = 2; i < MAX_PLAYER_RECORDS; i++) {
    const p = r.add('guest' + i);
    p.score = 42;
    r.kick(host.id, p.id, true);
    former.push(p);
  }
  assert.equal(r.players.length, MAX_PLAYER_RECORDS);
  assert.throws(
    () => r.add('overflow'),
    (e) => e.status === 429 && e.code === 'ROOM_RECORD_LIMIT',
  );
  const revived = rejoinPlayer(r, former[0].id, 'guest0');
  assert.equal(revived.id, former[0].id);
  assert.equal(revived.score, 42);
  assert.equal(revived.kicked, false);
  assert.equal(revived.waitingForNextRound, true);
  assert.equal(r.players.length, MAX_PLAYER_RECORDS);
  assert.ok(!r.pendingArtists.includes(revived.id));
  assert.equal(r.player(guest.id).kicked, false);
});

test('canvas fill and command cost budgets do not reset on undo/clear or duplicate requests', () => {
  let now = 1000000;
  const r = new DrawGuessRoom(
      'A0A131',
      'canvas',
      () => 0,
      () => now,
    ),
    host = r.add('host');
  r.add('guest');
  r.start();
  r.choose(host.id, r.candidates[0].id);
  const fill = () => ({
    canvasEpoch: r.canvas.epoch,
    round: 1,
    batchId: randomUUID(),
    strokeId: randomUUID(),
    tool: 'fill',
    color: '#123456',
    size: 4,
    points: [[5, 5]],
  });
  const first = fill(),
    accepted = r.addStroke(host.id, first);
  assert.equal(accepted.quota.usedFills, 1);
  assert.equal(r.addStroke(host.id, first).duplicate, true);
  assert.equal(r.canvasQuota().usedFills, 1);
  r.addStroke(host.id, fill());
  assert.throws(
    () => r.addStroke(host.id, fill()),
    (e) => e.code === 'DRAW_RATE_LIMIT',
  );
  r.canvasCommand(host.id, { canvasEpoch: r.canvas.epoch, round: 1, command: 'undo' });
  r.canvasCommand(host.id, { canvasEpoch: r.canvas.epoch, round: 1, command: 'clear' });
  assert.throws(
    () => r.canvasCommand(host.id, { canvasEpoch: r.canvas.epoch, round: 1, command: 'clear' }),
    (e) => e.code === 'DRAW_COMMAND_RATE_LIMIT',
  );
  assert.equal(r.canvasQuota().usedFills, 2);
  for (let i = 2; i < 48; i++) {
    now += 1001;
    r.addStroke(host.id, fill());
    r.canvasCommand(host.id, { canvasEpoch: r.canvas.epoch, round: 1, command: 'clear' });
  }
  now += 1001;
  assert.throws(
    () => r.addStroke(host.id, fill()),
    (e) => e.code === 'DRAW_WORK_LIMIT',
  );
  assert.equal(r.canvas.strokes.length, 0);
  assert.equal(r.canvasQuota().usedBatches, 48);
  const brush = fill();
  brush.tool = 'brush';
  r.addStroke(host.id, brush);
  assert.equal(r.canvasSnapshot().limits.maxFills, 48);
});

test('canvas total point and deduplication budgets survive clearing every batch', () => {
  let now = 1000000;
  const r = new DrawGuessRoom(
      'A0A132',
      'canvas',
      () => 0,
      () => now,
    ),
    host = r.add('host');
  r.add('guest');
  r.start();
  r.choose(host.id, r.candidates[0].id);
  r.deadline = now + 600000;
  const batch = () => ({
    canvasEpoch: r.canvas.epoch,
    round: 1,
    batchId: randomUUID(),
    strokeId: randomUUID(),
    tool: 'brush',
    color: '#123456',
    size: 4,
    points: Array.from({ length: 64 }, () => [5, 5]),
  });
  for (let i = 0; i < 468; i++) {
    now += 1001;
    r.addStroke(host.id, batch());
    r.canvasCommand(host.id, { canvasEpoch: r.canvas.epoch, round: 1, command: 'clear' });
  }
  now += 1001;
  assert.throws(
    () => r.addStroke(host.id, batch()),
    (e) => e.code === 'DRAW_WORK_LIMIT',
  );
  assert.equal(r.canvasQuota().usedPoints, 29952);
  assert.equal(r.canvas.strokes.length, 0);
});

test('HTTP repeated membership changes are bounded; reconnect is idempotent and kicked users cannot reclaim a seat', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-resource-http-')),
    config = {
      port: 0,
      host: '127.0.0.1',
      communityDir: path.join(root, 'community'),
      dbFile: path.join(root, 'app.sqlite'),
    };
  const db = openDatabase(config.dbFile),
    auth = createAuth(db);
  await auth.bootstrap('resourceadmin', 'test-password-88888888');
  const admin = db.prepare("SELECT * FROM users WHERE username='resourceadmin'").get();
  for (const username of ['resourceguest', 'resourcethird'])
    await auth.register(
      {
        username,
        displayName: username,
        password: 'test-password-88888888',
        confirmPassword: 'test-password-88888888',
        invite: auth.createInvite(admin, { days: 1 }).code,
      },
      { setHeader() {} },
    );
  db.close();
  const app = createApp(config);
  t.after(async () => {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const { port } = await app.listen(),
    base = 'http://127.0.0.1:' + port;
  async function post(route, cookie, data) {
    const response = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  const host = (
      await post('auth/login', null, {
        username: 'resourceadmin',
        password: 'test-password-88888888',
      })
    ).cookie,
    guest = (
      await post('auth/login', null, {
        username: 'resourceguest',
        password: 'test-password-88888888',
      })
    ).cookie,
    third = (
      await post('auth/login', null, {
        username: 'resourcethird',
        password: 'test-password-88888888',
      })
    ).cookie;
  const { code } = (await post('create', host, { type: 'draw' })).body;
  const state = async (cookie) =>
    (await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })).json();
  assert.equal((await post('join', guest, { code })).status, 200);
  assert.equal((await post('join', third, { code })).status, 200);
  for (let i = 0; i < 50; i++) assert.equal((await post('join', guest, { code })).status, 200);
  assert.equal((await state(host)).players.length, 3);
  await post('start', host, { code });
  let guestId = (await state(guest)).me;
  assert.equal((await post('leave', guest, { code })).status, 200);
  assert.equal((await post('join', guest, { code })).status, 200);
  assert.equal((await state(guest)).me, guestId);
  assert.equal((await state(host)).players.length, 3);
  assert.equal(
    (await post('kick', host, { code, playerId: guestId, confirmed: true })).status,
    200,
  );
  assert.equal((await post('join', guest, { code })).body.code, 'KICKED');
  const gift = (await post('create', host, { type: 'gift' })).body.code;
  let rejected;
  for (let i = 0; i < 40; i++) {
    const join = await post('join', third, { code: gift });
    if (join.status === 429) {
      rejected = join;
      break;
    }
    assert.equal(join.status, 200);
    const leave = await post('leave', third, { code: gift });
    if (leave.status === 429) {
      rejected = leave;
      break;
    }
    assert.equal(leave.status, 200);
  }
  assert.equal(rejected?.body.code, 'RATE_LIMITED');
  assert.ok(
    (
      await fetch(base + '/api/state?code=' + gift, { headers: { Cookie: host } }).then((r) =>
        r.json(),
      )
    ).players.length <= 2,
  );
  const departed = await post('leave', host, { code });
  assert.equal(departed.status, 200);
  assert.equal(departed.body.deleted, false);
  const remaining = await state(third);
  assert.equal(remaining.host, true);
  assert.equal(remaining.players.length, 1);
  const last = await post('leave', third, { code });
  assert.equal(last.status, 200);
  assert.equal(last.body.deleted, true);
  assert.equal((await post('reconnect', third, { code })).status, 404);
  const healthy = await post('create', host, { type: 'draw' });
  assert.equal(healthy.status, 200);
});
