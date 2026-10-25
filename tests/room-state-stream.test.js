'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createStateStream, stateTag } = require('../src/rooms/state-stream');

const tick = () => new Promise((resolve) => setImmediate(resolve));
function connection() {
  const req = new EventEmitter(),
    res = {
      chunks: [],
      ended: false,
      headers: {},
      setHeader(key, value) {
        this.headers[key] = value;
      },
      flushHeaders() {},
      write(text) {
        this.chunks.push(text);
        return true;
      },
      end() {
        this.ended = true;
      },
    };
  const events = (kind) =>
    res.chunks
      .filter((chunk) => chunk.startsWith('event: ' + kind + '\n'))
      .map((chunk) => JSON.parse(chunk.split('\ndata: ')[1]));
  return { req, res, events };
}
function setup(options = {}) {
  const room = { code: 'ABC123', phase: 'waiting', seen: 0 };
  const stream = createStateStream({
    project: (r, playerId) => ({
      code: r.code,
      phase: r.phase,
      me: playerId,
      serverNow: Date.now(),
    }),
    sweepMs: 60000,
    heartbeatMs: 60000,
    ...options,
  });
  return { room, stream };
}

test('a subscriber receives its own view at once, tagged without the server clock', () => {
  const { room, stream } = setup(),
    a = connection();
  stream.subscribe(room, { ...a, user: { id: 'u1' }, playerId: 'p1' });
  const [first] = a.events('state');
  assert.equal(first.me, 'p1');
  assert.equal(a.res.headers['Content-Type'], 'text/event-stream; charset=utf-8');
  assert.equal(first.stateTag, stateTag({ ...first, stateTag: undefined, serverNow: 1 }));
  stream.close();
});

test('notify pushes only views that changed, and every seat at the table gets it', async () => {
  const { room, stream } = setup(),
    a = connection(),
    b = connection();
  stream.subscribe(room, { ...a, user: { id: 'u1' }, playerId: 'p1' });
  stream.subscribe(room, { ...b, user: { id: 'u2' }, playerId: 'p2' });
  stream.notify(room);
  await tick();
  assert.equal(a.events('state').length, 1, 'only the clock moved, so nothing is resent');
  room.phase = 'playing';
  stream.notify(room);
  stream.notify(room);
  await tick();
  assert.deepEqual(
    [a, b].map((c) => c.events('state').at(-1).phase),
    ['playing', 'playing'],
  );
  assert.equal(a.events('state').length, 2, 'notifications in one turn are coalesced');
  stream.close();
});

test('a seat that is no longer valid is closed instead of receiving the view', async () => {
  let allowed = true;
  const { room, stream } = setup({ valid: () => allowed }),
    a = connection();
  stream.subscribe(room, { ...a, user: { id: 'u1' }, playerId: 'p1' });
  allowed = false;
  room.phase = 'playing';
  stream.notify(room);
  await tick();
  assert.equal(a.res.ended, true);
  assert.equal(a.events('state').length, 1);
  assert.equal(stream.watched(room.code), false);
  stream.close();
});

test('the sweep keeps open seats present and re-checks views; hints reach the right people', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const alive = [],
    { room, stream } = setup({ sweepMs: 20, onAlive: (entry) => alive.push(entry.userId) }),
    a = connection(),
    b = connection();
  t.after(() => stream.close());
  stream.subscribe(room, { ...a, user: { id: 'u1' }, playerId: 'p1' });
  stream.subscribe(room, { ...b, user: { id: 'u2' }, playerId: 'p2' });
  room.phase = 'expired';
  t.mock.timers.tick(19);
  assert.equal(alive.length, 0, 'the sweep does not run before its interval');
  t.mock.timers.tick(1);
  // Sweeps queue delivery in the check phase; a wall-clock sleep can resolve
  // in the timers phase before that delivery when the test process is busy.
  await tick();
  assert.ok(alive.includes('u1') && alive.includes('u2'));
  assert.deepEqual(
    [a, b].map((client) => client.events('state').at(-1).phase),
    ['expired', 'expired'],
    'unannounced changes still arrive for both seats',
  );
  stream.hint(room.code, 'chat');
  stream.hintUser('u2', 'invitations');
  assert.equal(a.events('chat').length, 1);
  assert.equal(b.events('chat').length, 1);
  assert.equal(a.events('invitations').length, 0);
  assert.equal(b.events('invitations').length, 1);
  stream.close();
  assert.equal(a.res.ended && b.res.ended, true);
});

test('connection limits refuse extra streams per user and per room', () => {
  const { room, stream } = setup({ userLimit: 1, roomLimit: 2 });
  assert.ok(stream.subscribe(room, { ...connection(), user: { id: 'u1' }, playerId: 'p1' }));
  assert.equal(
    stream.subscribe(room, { ...connection(), user: { id: 'u1' }, playerId: 'p1' }),
    null,
  );
  assert.ok(stream.subscribe(room, { ...connection(), user: { id: 'u2' }, playerId: 'p2' }));
  assert.equal(
    stream.subscribe(room, { ...connection(), user: { id: 'u3' }, playerId: 'p3' }),
    null,
  );
  stream.close();
});

test('a closed browser connection leaves the room unwatched', () => {
  const { room, stream } = setup(),
    a = connection();
  stream.subscribe(room, { ...a, user: { id: 'u1' }, playerId: 'p1' });
  assert.equal(stream.watched(room.code), true);
  a.req.emit('close');
  assert.equal(stream.watched(room.code), false);
  stream.close();
});
