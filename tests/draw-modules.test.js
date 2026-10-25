'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('./helpers/browser-modules.cjs');
const path = require('node:path');
const vm = require('node:vm');
const { rasterCanvas } = require('./helpers/raster-canvas.cjs');

// Direct tests for the shared drawing modules the Vue draw page loads: transport,
// playback and the canvas session. They replace tests that drove these modules
// through the retired legacy draw page (#233).
const source = (name) => fs.readFileSync(path.join(__dirname, '../public/shared', name), 'utf8');
// Values built inside the vm realm compare by content, not by prototype.
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
// `globalWindow` makes the context itself the window, as in a browser, for modules
// that read other modules as bare globals.
function load(names, extra = {}, { globalWindow = false } = {}) {
  const window = {};
  const context = vm.createContext({
    window,
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (id) => clearTimeout(id),
    AbortController,
    crypto: globalThis.crypto,
    DOMException,
    Promise,
    performance: { now: () => Date.now() },
    ...extra,
  });
  if (globalWindow) context.window = context;
  for (const name of names) vm.runInContext(source(name), context);
  return context.window;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
// Mocked timers and clock move together, so module pacing reads the same time the timers use.
function clock(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  return async (ms = 0) => {
    await flush();
    t.mock.timers.tick(ms);
    await flush();
  };
}
const fail = (message, extra) => Object.assign(new Error(message), extra);

// ---- DrawTransport ----------------------------------------------------------------

function transport(t, { isCurrent = () => true, ...options } = {}) {
  const advance = clock(t);
  const sent = [],
    events = [],
    pace = { lastStart: -Infinity, lastFill: -Infinity };
  let ids = 0;
  const { DrawTransport } = load(['draw-transport.js']);
  const api = DrawTransport.create({
    send: (data, { signal }, attempt) => {
      const reply = deferred();
      sent.push({ data, signal, attempt, reply });
      return reply.promise;
    },
    createId: () => 'batch-' + ++ids,
    isCurrent,
    now: () => Date.now(),
    pacing: () => pace,
    onStart: (data, at) => {
      pace.lastStart = at;
      if (data.tool === 'fill') pace.lastFill = at;
    },
    onAccepted: (_result, data) => events.push(['accepted', data.batchId]),
    onError: (error) => events.push(['error', error.message]),
    onDiscard: (_token, reason) => events.push(['discard', reason]),
    ...options,
  });
  return { api, sent, events, advance };
}
const stroke = (points, extra = {}) => ({
  canvasEpoch: 'e1',
  round: 1,
  strokeId: 'aaaaaaaa-0001',
  tool: 'brush',
  color: '#000000',
  size: 4,
  points,
  ...extra,
});

test('transport merges unsent work of one stroke and freezes each prepared request', async (t) => {
  const h = transport(t),
    token = {};
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    token,
  );
  h.api.enqueue(
    stroke([
      [2, 2],
      [3, 3],
    ]),
    token,
  );
  await h.advance(0);
  assert.equal(h.sent.length, 1);
  const { data } = h.sent[0];
  assert.deepEqual(
    plain(data.points),
    [
      [1, 1],
      [2, 2],
      [3, 3],
    ],
    'the shared joint point is sent once',
  );
  assert.equal(data.batchId, 'batch-1');
  assert.ok(
    Object.isFrozen(data) && Object.isFrozen(data.points) && Object.isFrozen(data.points[0]),
  );
  // Work queued while a request is in flight merges among itself and waits its turn.
  h.api.enqueue(
    stroke([
      [3, 3],
      [4, 4],
    ]),
    token,
  );
  h.api.enqueue(
    stroke([
      [4, 4],
      [5, 5],
    ]),
    token,
  );
  h.sent[0].reply.resolve({});
  await h.advance(115);
  assert.equal(h.sent.length, 2);
  assert.deepEqual(plain(h.sent[1].data.points), [
    [3, 3],
    [4, 4],
    [5, 5],
  ]);
  assert.deepEqual(h.events, [['accepted', 'batch-1']]);
});

test('different strokes, tools and styles stay separate requests in their original order', async (t) => {
  const h = transport(t),
    token = {};
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    token,
  );
  h.api.enqueue(
    stroke(
      [
        [2, 2],
        [3, 3],
      ],
      { color: '#ff0000' },
    ),
    token,
  );
  h.api.enqueue(
    stroke(
      [
        [0, 0],
        [9, 9],
      ],
      { tool: 'line', strokeId: 'aaaaaaaa-0002' },
    ),
    token,
  );
  assert.equal(h.api.metrics().pendingEntries, 3);
  for (let i = 0; i < 3; i++) {
    await h.advance(115);
    h.sent.at(-1).reply.resolve({});
  }
  assert.deepEqual(
    h.sent.map(({ data }) => [data.tool, data.color]),
    [
      ['brush', '#000000'],
      ['brush', '#ff0000'],
      ['line', '#000000'],
    ],
  );
});

test('long strokes are sent in 256-point chunks that overlap by one point', async (t) => {
  const h = transport(t),
    points = Array.from({ length: 600 }, (_, i) => [i % 512, 1]);
  h.api.enqueue(stroke(points), {});
  const lengths = [];
  for (let i = 0; i < 3; i++) {
    await h.advance(115);
    const { data, reply } = h.sent.at(-1);
    lengths.push([data.points.length, data.points[0][0]]);
    reply.resolve({});
  }
  assert.deepEqual(lengths, [
    [256, 0],
    [256, 255],
    [90, 510],
  ]);
  await h.advance(115);
  assert.equal(h.sent.length, 3);
});

test('transient failures retry the same prepared request at most three times, then drop unsent work', async (t) => {
  const h = transport(t),
    token = {};
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    token,
  );
  await h.advance(0);
  const first = h.sent[0].data;
  h.sent[0].reply.reject(fail('busy', { status: 500 }));
  await h.advance(999);
  assert.equal(h.sent.length, 1, 'waits a second before retrying');
  await h.advance(1);
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[1].data, first, 'the exact prepared body is resent');
  assert.equal(h.sent[1].attempt, 2);
  h.api.enqueue(
    stroke(
      [
        [7, 7],
        [8, 8],
      ],
      { strokeId: 'bbbbbbbb-0002' },
    ),
    token,
  );
  h.sent[1].reply.reject(fail('slow down', { status: 429, code: 'DRAW_RATE_LIMIT' }));
  await h.advance(2000);
  assert.equal(h.sent.length, 3);
  assert.equal(h.sent[2].data.batchId, first.batchId);
  h.sent[2].reply.reject(fail('still down', { status: 503 }));
  await h.advance(5000);
  assert.equal(h.sent.length, 3, 'no fourth attempt');
  assert.deepEqual(h.events, [
    ['discard', 'error'],
    ['error', 'still down'],
  ]);
  assert.equal(h.api.metrics().pendingEntries, 0);
});

test('a rejected request is not retried and reports once', async (t) => {
  const h = transport(t);
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    {},
  );
  await h.advance(0);
  h.sent[0].reply.reject(fail('bad stroke', { status: 400 }));
  await h.advance(5000);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.events, [['error', 'bad stroke']]);
});

test('a request that hangs for ten seconds is aborted and retried with the same body', async (t) => {
  const h = transport(t);
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    {},
  );
  await h.advance(0);
  await h.advance(10000);
  assert.equal(h.sent[0].signal.aborted, true);
  assert.equal(h.sent[0].signal.reason.name, 'TimeoutError');
  await h.advance(1000);
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[1].data, h.sent[0].data);
});

test('cancel drops unsent work, aborts the request in flight and ignores its late reply', async (t) => {
  const h = transport(t),
    token = {};
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    token,
  );
  await h.advance(0);
  h.api.enqueue(
    stroke(
      [
        [5, 5],
        [6, 6],
      ],
      { strokeId: 'bbbbbbbb-0002' },
    ),
    token,
  );
  h.api.cancel();
  assert.equal(h.sent[0].signal.aborted, true);
  h.sent[0].reply.resolve({});
  await h.advance(5000);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.events, [['discard', 'cancel']]);
  await h.api.whenIdle();
});

test('cancel can keep the request in flight so its acknowledgement still applies', async (t) => {
  const h = transport(t);
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    {},
  );
  await h.advance(0);
  h.api.cancel({ retainInFlight: true });
  assert.equal(h.sent[0].signal.aborted, false);
  h.sent[0].reply.resolve({});
  await h.advance(0);
  assert.deepEqual(h.events, [['accepted', 'batch-1']]);
});

test('work that stopped being current before sending is discarded without a request', async (t) => {
  let current = true;
  const h = transport(t, { isCurrent: () => current });
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    {},
  );
  current = false;
  await h.advance(1000);
  assert.equal(h.sent.length, 0);
  assert.equal(h.api.metrics().pendingEntries, 0);
  await h.api.whenIdle();
});

test('the unsent buffer is bounded and refuses work instead of growing', async (t) => {
  const h = transport(t, { maxPoints: 100, maxEntries: 2 });
  const many = Array.from({ length: 101 }, (_, i) => [i, 0]);
  assert.throws(() => h.api.enqueue(stroke(many), {}), /上限/);
  h.api.enqueue(stroke([[1, 1]], { strokeId: 'aaaaaaaa-0003' }), {});
  h.api.enqueue(stroke([[1, 1]], { strokeId: 'aaaaaaaa-0004' }), {});
  assert.throws(() => h.api.enqueue(stroke([[1, 1]], { strokeId: 'aaaaaaaa-0005' }), {}), /上限/);
});

test('fills start at least 500ms apart while other work keeps the 115ms pacing', async (t) => {
  const h = transport(t),
    fill = (id) => stroke([[1, 1]], { tool: 'fill', strokeId: id });
  h.api.enqueue(fill('cccccccc-0001'), {});
  await h.advance(0);
  h.sent[0].reply.resolve({});
  h.api.enqueue(fill('cccccccc-0002'), {});
  await h.advance(200);
  assert.equal(h.sent.length, 1);
  await h.advance(299);
  assert.equal(h.sent.length, 1);
  await h.advance(1);
  assert.equal(h.sent.length, 2);
  h.sent[1].reply.resolve({});
  h.api.enqueue(
    stroke([
      [1, 1],
      [2, 2],
    ]),
    {},
  );
  await h.advance(114);
  assert.equal(h.sent.length, 2);
  await h.advance(1);
  assert.equal(h.sent.length, 3);
});

// ---- DrawPlayback -----------------------------------------------------------------

function playback(options = {}) {
  let now = 1000,
    id = 0,
    drawn = 0;
  const frames = new Map();
  const { DrawPlayback } = load(['draw-playback.js']);
  const api = DrawPlayback.create({
    now: () => now,
    requestFrame: (fn) => (frames.set(++id, fn), id),
    cancelFrame: (key) => frames.delete(key),
    onFrame: () => drawn++,
    ...options,
  });
  return {
    api,
    frames,
    set: (value) => (now = value),
    frame() {
      const [[key, fn]] = frames;
      frames.delete(key);
      fn();
    },
    drawn: () => drawn,
  };
}
const timed = (version, points, pointTimes, strokeId = 's1') => ({
  version,
  strokeId,
  tool: 'brush',
  points,
  pointTimes,
});

test('playback reveals samples on their own clock and interpolates between them', () => {
  const p = playback(),
    s = timed(
      7,
      [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      [0, 100, 300],
    );
  assert.equal(p.api.add(s), true);
  assert.equal(p.api.view(s), null, 'nothing is shown before the first sample is due');
  p.set(1060);
  p.frame();
  assert.deepEqual(plain(p.api.view(s).points), [[0, 0]]);
  p.set(1110);
  p.frame();
  const half = p.api.view(s);
  assert.deepEqual(plain(half.points), [
    [0, 0],
    [50, 0],
  ]);
  assert.equal(half.playbackCount, 1.5);
  p.set(1360);
  p.frame();
  assert.equal(p.api.view(s), s, 'a finished stroke is shown exactly as accepted');
  assert.equal(p.frames.size, 0);
  assert.ok(p.drawn() >= 3);
});

test('a late batch keeps the stroke clock instead of restarting at receive time', () => {
  const p = playback();
  p.api.add(
    timed(
      1,
      [
        [0, 0],
        [10, 0],
      ],
      [0, 100],
    ),
  );
  p.set(1500);
  p.api.add(
    timed(
      2,
      [
        [10, 0],
        [20, 0],
      ],
      [200, 300],
    ),
  );
  assert.equal(p.api.metrics().leadMs, 0, 'already due, so no extra delay is added');
  p.frame();
  assert.equal(p.api.metrics().pendingSamples, 0);
});

test('a large backlog is compressed to catch up while every sample is kept', () => {
  const p = playback({ maxLead: 450, catchupLead: 180 });
  const points = Array.from({ length: 20 }, (_, i) => [i, 0]),
    times = points.map((_, i) => i * 200);
  p.api.add(timed(1, points, times));
  assert.ok(p.api.metrics().leadMs <= 180 + 1);
  assert.equal(p.api.metrics().pendingSamples, 20);
});

test('reset cancels the scheduled frame and non-freehand strokes end playback', () => {
  const p = playback(),
    s = timed(
      1,
      [
        [0, 0],
        [10, 0],
      ],
      [0, 100],
    );
  p.api.add(s);
  assert.equal(p.frames.size, 1);
  p.api.reset();
  assert.equal(p.frames.size, 0);
  assert.equal(p.api.view(s), s, 'after reset the accepted stroke is shown in full');
  p.api.add(s);
  assert.equal(p.api.add({ version: 2, strokeId: 's2', tool: 'fill', points: [[1, 1]] }), false);
  assert.equal(p.api.metrics().pendingEntries, 0);
});

// ---- DrawCanvasSession ------------------------------------------------------------

const EPOCH = 'e1';
function canvasSession(t) {
  const advance = clock(t);
  const requests = [],
    feedback = [];
  let syncs = 0,
    frameId = 0;
  const frames = new Map();
  const document = { hidden: false, createElement: () => rasterCanvas(512, 256) };
  const window = load(
    ['stroke-canvas.js', 'draw-playback.js', 'draw-transport.js', 'draw-canvas-session.js'],
    {
      document,
      requestAnimationFrame: (fn) => (frames.set(++frameId, fn), frameId),
      cancelAnimationFrame: (key) => frames.delete(key),
    },
    { globalWindow: true },
  );
  const api = window.DrawCanvasSession.create({
    canvas: rasterCanvas(512, 256),
    request: (route, data, options) => {
      const reply = deferred();
      requests.push({ route, data, options, reply });
      return reply.promise;
    },
    syncCanvas: () => {
      syncs++;
      return Promise.resolve();
    },
    cancelInput: () => {},
    cancelNetwork: () => {},
    feedback: (message) => feedback.push(message),
    notify: () => {},
    now: () => Date.now(),
  });
  const state = {
    canvasEpoch: EPOCH,
    round: 1,
    phase: 'drawing',
    presenterId: 'p1',
    me: 'p1',
    strokeVersion: 0,
  };
  api.transition(state);
  api.applySnapshot({ canvasEpoch: EPOCH, round: 1, version: 0, strokes: [] });
  return { api, requests, feedback, syncs: () => syncs, advance, state };
}
const accepted = (version, strokeId, extra = {}) => ({
  version,
  strokeId,
  tool: 'brush',
  color: '#112233',
  size: 4,
  points: [
    [1, 1],
    [5, 5],
  ],
  ...extra,
});
const event = (stroke, extra = {}) => ({
  canvasEpoch: EPOCH,
  round: 1,
  version: stroke.version,
  stroke,
  ...extra,
});

test('canvas session applies each stroke event once and resyncs on a gap or foreign canvas', async (t) => {
  const s = canvasSession(t),
    before = s.syncs();
  s.api.receiveStroke(event(accepted(1, 'aaaaaaaa-0001')));
  s.api.receiveStroke(event(accepted(1, 'aaaaaaaa-0001')));
  assert.deepEqual([s.api.view().version, s.api.view().strokeCount], [1, 1]);
  s.api.receiveStroke(event(accepted(3, 'aaaaaaaa-0003')));
  assert.equal(s.api.view().strokeCount, 1, 'a missing version is not painted');
  assert.equal(s.syncs(), before + 1, 'a gap asks for a fresh snapshot');
  s.api.receiveStroke(event(accepted(2, 'aaaaaaaa-0002'), { canvasEpoch: 'other' }));
  assert.equal(s.api.view().strokeCount, 1);
  await s.advance(0);
});

test('snapshots accept 256-point batches and refuse longer ones (#264)', async (t) => {
  const s = canvasSession(t),
    batch = (length) => ({
      version: 1,
      strokeId: 'dddddddd-0001',
      tool: 'brush',
      color: '#000000',
      size: 4,
      points: Array.from({ length }, (_, i) => [i % 512, 1]),
    });
  assert.equal(
    s.api.applySnapshot({ canvasEpoch: EPOCH, round: 1, version: 1, strokes: [batch(256)] }),
    true,
  );
  assert.throws(
    () => s.api.applySnapshot({ canvasEpoch: EPOCH, round: 1, version: 2, strokes: [batch(257)] }),
    /上限/,
  );
  assert.equal(s.api.view().pointCount, 256);
  await s.advance(0);
});

test('an acknowledgement before the stroke event paints the stroke once', async (t) => {
  const s = canvasSession(t);
  s.api.enqueue(
    [
      [1, 1],
      [2, 2],
    ],
    'bbbbbbbb-0001',
    { tool: 'brush', color: '#000000', size: 4 },
  );
  await s.advance(0);
  const [post] = s.requests;
  assert.equal(post.route, 'draw/stroke');
  assert.equal(post.data.canvasEpoch, EPOCH);
  const stroke = accepted(1, 'bbbbbbbb-0001', {
    color: '#000000',
    points: [
      [1, 1],
      [2, 2],
    ],
    curve: 'quadratic',
  });
  post.reply.resolve(event(stroke));
  await s.advance(0);
  s.api.receiveStroke(event(stroke));
  assert.deepEqual(
    [s.api.view().version, s.api.view().strokeCount, s.api.view().pendingBatches],
    [1, 1, 0],
  );
  await s.api.whenIdle();
});

test('unsent strokes from an old canvas are discarded when the round or canvas changes', async (t) => {
  const s = canvasSession(t);
  s.api.enqueue(
    [
      [1, 1],
      [2, 2],
    ],
    'bbbbbbbb-0001',
    { tool: 'brush', color: '#000000', size: 4 },
  );
  s.api.transition({ ...s.state, canvasEpoch: 'e2', round: 1 });
  await s.advance(1000);
  assert.equal(s.requests.filter((r) => r.route === 'draw/stroke').length, 0);
  assert.equal(s.api.view().draftCount, 0);
});

test('snapshots from another round, older versions or over the limits are refused', async (t) => {
  const s = canvasSession(t);
  assert.equal(
    s.api.applySnapshot({ canvasEpoch: EPOCH, round: 2, version: 5, strokes: [] }),
    false,
  );
  s.api.receiveStroke(event(accepted(1, 'aaaaaaaa-0001')));
  assert.equal(
    s.api.applySnapshot({ canvasEpoch: EPOCH, round: 1, version: 0, strokes: [] }),
    false,
  );
  const fills = Array.from({ length: 49 }, (_, i) => ({
    version: i + 1,
    strokeId: 'cccccccc-' + String(i).padStart(4, '0'),
    tool: 'fill',
    color: '#000000',
    size: 1,
    points: [[1, 1]],
  }));
  assert.throws(
    () => s.api.applySnapshot({ canvasEpoch: EPOCH, round: 1, version: 49, strokes: fills }),
    /上限/,
  );
  assert.equal(s.api.view().strokeCount, 1);
  await s.advance(0);
});

test('a canvas command waits for queued strokes before it is sent', async (t) => {
  const s = canvasSession(t);
  s.api.enqueue(
    [
      [1, 1],
      [2, 2],
    ],
    'bbbbbbbb-0001',
    { tool: 'brush', color: '#000000', size: 4 },
  );
  await s.advance(0);
  const done = s.api.command('undo');
  await s.advance(0);
  assert.deepEqual(
    s.requests.map((r) => r.route),
    ['draw/stroke'],
  );
  const stroke = accepted(1, 'bbbbbbbb-0001', {
    color: '#000000',
    points: [
      [1, 1],
      [2, 2],
    ],
    curve: 'quadratic',
  });
  s.requests[0].reply.resolve(event(stroke));
  await s.advance(0);
  assert.deepEqual(
    s.requests.map((r) => r.route),
    ['draw/stroke', 'draw/command'],
  );
  assert.equal(s.api.view().commandBusy, true);
  s.requests[1].reply.resolve({ canvasEpoch: EPOCH, round: 1, version: 2, strokes: [] });
  await s.advance(0);
  await done;
  assert.deepEqual(
    [s.api.view().version, s.api.view().strokeCount, s.api.view().commandBusy],
    [2, 0, false],
  );
});

test('a used-up fill quota refuses another fill without sending it', async (t) => {
  const s = canvasSession(t);
  s.api.applySnapshot({
    canvasEpoch: EPOCH,
    round: 1,
    version: 1,
    strokes: [],
    quota: { usedFills: 48, usedBatches: 0, usedPoints: 0 },
  });
  await s.api.enqueue([[3, 3]], 'dddddddd-0001', { tool: 'fill', color: '#ff0000', size: 1 });
  await s.advance(1000);
  assert.equal(s.requests.filter((r) => r.route === 'draw/stroke').length, 0);
  assert.match(s.feedback.join('\n'), /填色額度已用完/);
});
