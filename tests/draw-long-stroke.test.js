'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { DrawGuessRoom, MAX_BATCH_POINTS } = require('../src/games/draw-guess');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/db');
const { createAuth } = require('../src/auth');

// #264: long or fast freehand strokes were cut off ("這一筆已達畫布上限") and, on slow
// links, the unsent tail vanished at reveal. Input is now thinned within a fixed error
// bound and each request may carry 256 points, while every round quota is unchanged.
const services = path.join(__dirname, '../frontend/src/services');
const ts = createRequire(path.join(__dirname, '../frontend/package.json'))('typescript');
function loadService(name, stubs = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(services, name + '.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Math,
    Number,
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (id) => clearTimeout(id),
    require: (id) => {
      const key = path.basename(id);
      if (key in stubs) return stubs[key];
      if (key === 'stroke-simplify') return loadService('stroke-simplify');
      throw Error('unexpected import ' + id);
    },
  });
  return module.exports;
}
const simplify = loadService('stroke-simplify');
// Values built inside the vm realm compare by content, not by prototype.
const plain = (value) => JSON.parse(JSON.stringify(value));

// Every grid cell crossed by a curve, as raw pointer input records it.
function rasterize(fn, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const [x, y] = fn(i / steps);
    const point = [
      Math.max(0, Math.min(511, Math.floor(x))),
      Math.max(0, Math.min(255, Math.floor(y))),
    ];
    const last = out.at(-1);
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  return out;
}
const spiral = (turns, steps) =>
  rasterize((t) => {
    const a = t * turns * 2 * Math.PI,
      r = 40 + 60 * Math.abs(Math.sin(t * 9));
    return [256 + r * 1.8 * Math.cos(a), 128 + r * Math.sin(a)];
  }, steps);
function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length))
    : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}
// Kept points are an ordered subset of the raw samples; return each sample's error.
function assertFaithful(raw, kept) {
  assert.deepEqual(kept[0], raw[0]);
  assert.deepEqual(kept.at(-1), raw.at(-1));
  let index = 0,
    worst = 0;
  for (let k = 1; k < kept.length; k++) {
    const start = index;
    while (raw[index][0] !== kept[k][0] || raw[index][1] !== kept[k][1]) index++;
    for (let i = start; i <= index; i++)
      worst = Math.max(worst, distanceToSegment(raw[i], kept[k - 1], kept[k]));
    assert.ok(
      Math.hypot(kept[k][0] - kept[k - 1][0], kept[k][1] - kept[k - 1][1]) <=
        simplify.SIMPLIFY_MAX_SEGMENT,
    );
  }
  return worst;
}

test('a dense stroke keeps its endpoints and every sample within the tolerance with far fewer points', () => {
  const raw = spiral(30, 40000),
    kept = plain(simplify.simplifyStroke(raw));
  assert.ok(raw.length > 7000);
  assert.ok(kept.length * 4 < raw.length, `${kept.length} of ${raw.length}`);
  assert.ok(assertFaithful(raw, kept) <= simplify.SIMPLIFY_TOLERANCE);
});

test('sharp corners stay sharp: each corner keeps a point within one grid unit', () => {
  const corners = [
      [60, 40],
      [460, 40],
      [460, 220],
      [60, 220],
    ],
    raw = rasterize((t) => {
      const s = (t * 8) % 4,
        q = Math.floor(s),
        a = corners[q],
        b = corners[(q + 1) % 4];
      return [a[0] + (b[0] - a[0]) * (s - q), a[1] + (b[1] - a[1]) * (s - q)];
    }, 20000),
    kept = plain(simplify.simplifyStroke(raw));
  assert.equal(assertFaithful(raw, kept), 0);
  for (const corner of corners)
    assert.ok(kept.some((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1]) <= 1));
  // After a corner the next segment is short, so the curve cannot round it off.
  for (let k = 2; k < kept.length; k++) {
    const [a, b, c] = [kept[k - 2], kept[k - 1], kept[k]];
    const ix = b[0] - a[0],
      iy = b[1] - a[1],
      ox = c[0] - b[0],
      oy = c[1] - b[1];
    const cos = (ix * ox + iy * oy) / (Math.hypot(ix, iy) * Math.hypot(ox, oy));
    if (Math.hypot(ix, iy) >= 3 && cos < 0.5)
      assert.ok(Math.hypot(ox, oy) <= simplify.SIMPLIFY_CORNER_SEGMENT);
  }
});

// Drives the real input handler with a fake session that records what is sent.
function inputHarness() {
  const sent = [],
    feedback = [],
    draft = { points: [] },
    timers = [];
  let used = 0;
  const session = {
    view: () => ({ commandBusy: false, quota: { usedBatches: 0, usedPoints: 0 } }),
    canDraw: () => true,
    hasCapacity: (extra) => used + draft.points.length + extra <= 31024,
    beginDraft: (input) => {
      draft.points = input.points.map((p) => [...p]);
      return true;
    },
    appendDraft: (_id, point) => draft.points.push(point),
    replaceDraftTip: (_id, point) => (draft.points[draft.points.length - 1] = point),
    finishDraft: () => {},
    enqueue: (points, id, style, times) => {
      sent.push({ points: points.map((p) => [...p]), times: [...times] });
      return Promise.resolve();
    },
    schedulePreview: () => {},
    cancelPreview: () => {},
    redraw: () => {},
  };
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 512, height: 256 }),
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {},
  };
  const { createDrawingInput } = loadService('drawing-input');
  let clock = 0;
  const input = createDrawingInput({
    canvas,
    session,
    style: () => ({ tool: 'brush', color: '#123456', size: 4, filled: false }),
    epoch: () => 'epoch',
    strokeId: () => 'abcdef12',
    feedback: (message) => feedback.push(message),
    now: () => clock,
  });
  const event = (type, [x, y], time) => ({
    type,
    pointerId: 1,
    button: 0,
    clientX: x + 0.5,
    clientY: y + 0.5,
    timeStamp: time,
    preventDefault() {},
  });
  return { input, sent, feedback, draft, event, tick: (ms) => (clock += ms) };
}

test('a long freehand stroke is sent whole, with every flushed point immutable', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = inputHarness(),
    raw = spiral(60, 80000);
  // 4 ms per sample is a fast 250 Hz drag; 100+ seconds of continuous drawing.
  h.input.down(h.event('pointerdown', raw[0], 0));
  const snapshots = [];
  for (let i = 1; i < raw.length; i++) {
    h.input.move(h.event('pointermove', raw[i], i * 4));
    if (i % 20 === 0) {
      t.mock.timers.tick(80);
      snapshots.push(h.sent.length);
    }
  }
  h.input.finish(h.event('pointerup', raw.at(-1), raw.length * 4));
  assert.deepEqual(h.feedback, []);
  assert.ok(raw.length > 15000);
  // Batches join on a shared anchor point; the joined path is the local draft.
  const joined = [h.sent[0].points[0]];
  for (const batch of plain(h.sent)) {
    assert.deepEqual(batch.points[0], joined.at(-1));
    joined.push(...batch.points.slice(1));
    for (let i = 1; i < batch.times.length; i++) assert.ok(batch.times[i] >= batch.times[i - 1]);
  }
  assert.deepEqual(joined, plain(h.draft.points));
  assert.deepEqual(joined.at(-1), raw.at(-1));
  assert.ok(joined.length < 30000 / 3, `${joined.length} points`);
  assert.ok(assertFaithful(raw, joined) <= simplify.SIMPLIFY_TOLERANCE);
});

function game() {
  let now = 100000;
  const room = new DrawGuessRoom(
      'ABC264',
      'long',
      () => 0,
      () => now,
    ),
    host = room.add('Artist');
  room.add('Viewer');
  room.start();
  room.choose(host.id, room.candidates[0].id);
  room.deadline = now + 600000;
  return { room, host, advance: (ms) => (now += ms) };
}
const widest = (length) => ({
  tool: 'brush',
  color: '#123456',
  size: 40,
  curve: 'quadratic',
  points: Array.from({ length }, () => [511, 255]),
  pointTimes: Array.from({ length }, () => 119999),
});
const batch = (room, extra) => ({
  round: room.round,
  canvasEpoch: room.canvas.epoch,
  batchId: randomUUID(),
  strokeId: randomUUID(),
  ...widest(2),
  ...extra,
});

test('the server takes 256-point batches but still enforces every round quota', () => {
  const { room, host, advance } = game();
  assert.equal(MAX_BATCH_POINTS, 256);
  const before = JSON.stringify(room.canvasQuota());
  assert.throws(() => room.addStroke(host.id, batch(room, widest(257))), /筆畫格式不正確/);
  assert.equal(JSON.stringify(room.canvasQuota()), before);
  for (let i = 0; i < 117; i++) {
    advance(101);
    room.addStroke(host.id, batch(room, widest(256)));
  }
  assert.equal(room.canvasQuota().usedPoints, 29952);
  advance(101);
  assert.throws(
    () => room.addStroke(host.id, batch(room, widest(256))),
    (error) => error.code === 'DRAW_WORK_LIMIT',
  );
  // The request rate limit is unchanged: ten batches per second.
  const { room: fast, host: artist } = game();
  for (let i = 0; i < 10; i++) fast.addStroke(artist.id, batch(fast, widest(256)));
  assert.throws(
    () => fast.addStroke(artist.id, batch(fast, widest(256))),
    (error) => error.code === 'DRAW_RATE_LIMIT',
  );
});

test('HTTP accepts the largest legal batch and still refuses an oversized body', async (t) => {
  require('./helpers/fixed-starter.cjs')(t, DrawGuessRoom);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-long-stroke-')),
    config = {
      host: '127.0.0.1',
      port: 0,
      dbFile: path.join(dir, 'app.sqlite'),
      communityDir: path.join(dir, 'community'),
      externalSideEffectsEnabled: false,
    };
  const db = openDatabase(config.dbFile);
  try {
    await createAuth(db).bootstrap('long_host', 'long-stroke-password-123');
    const hash = db
      .prepare("SELECT password_hash FROM users WHERE username='long_host'")
      .get().password_hash;
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(randomUUID(), 'long_guest', 'Viewer', hash, 'member', new Date().toISOString());
  } finally {
    db.close();
  }
  const app = createApp(config);
  t.after(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const { port } = await app.listen(),
    base = 'http://127.0.0.1:' + port,
    cookies = {};
  async function request(route, who, data, raw) {
    const response = await fetch(base + '/api/' + route, {
      method: data === undefined && raw === undefined ? 'GET' : 'POST',
      headers: {
        ...(cookies[who] ? { Cookie: cookies[who] } : {}),
        'Content-Type': 'application/json',
      },
      ...(raw !== undefined
        ? { body: raw }
        : data === undefined
          ? {}
          : { body: JSON.stringify(data) }),
    });
    return {
      status: response.status,
      body: await response.json().catch(() => null),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  }
  for (const who of ['host', 'guest'])
    cookies[who] = (
      await request('auth/login', null, {
        username: 'long_' + who,
        password: 'long-stroke-password-123',
      })
    ).cookie;
  const code = (await request('create', 'host', { type: 'draw' })).body.code;
  await request('join', 'guest', { code });
  await request('start', 'host', { code });
  const state = (await request('state?code=' + code, 'host')).body;
  await request('action', 'host', { code, action: 'choose', questionId: state.candidates[0].id });
  const canvas = (await request('draw/canvas?code=' + code, 'host')).body;
  const largest = {
    code,
    round: canvas.round,
    canvasEpoch: canvas.canvasEpoch,
    batchId: randomUUID(),
    strokeId: randomUUID(),
    color: '#123456',
    filled: false,
    ...widest(256),
  };
  assert.ok(JSON.stringify(largest).length < 8192);
  const accepted = await request('draw/stroke', 'host', largest);
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.stroke.points.length, 256);
  const huge = JSON.stringify({ ...largest, batchId: randomUUID(), ...widest(600) });
  assert.ok(huge.length > 8192);
  const refused = await request('draw/stroke', 'host', undefined, huge);
  assert.equal(refused.status, 413);
  const after = (await request('draw/canvas?code=' + code, 'host')).body;
  assert.equal(after.strokes.length, 1);
  assert.equal(after.quota.usedPoints, 256);
});
