'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { createTutorials, types } = require('../src/tutorials/runtime');
function random(seed) {
  return (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
}
for (const type of types)
  test(`${type} isolated tutorial completes a real main loop through legal planned operations`, () => {
    for (const seed of [3, 123, 1011]) {
      const runtime = createTutorials({ rng: random(seed) });
      let state = runtime.start('owner', type),
        steps = 0;
      assert.equal(state.snapshot.code, 'FEED00');
      assert.equal(state.snapshot.players[0].name, '學員小明');
      while (!state.done && steps++ < 500) {
        const input = { id: state.id, revision: state.revision, requestId: randomUUID() };
        state = runtime.apply('owner', input);
        assert.equal(state.revision, steps);
      }
      assert.equal(
        state.done,
        true,
        `${type} stuck in ${state.snapshot.phase}/${state.snapshot.stage}`,
      );
      assert.ok(state.steps > 0);
      assert.equal(runtime.size(), 1);
      runtime.clear();
      assert.equal(runtime.size(), 0);
    }
  });
test('tutorial sessions are owner-bound, expire, replace per owner, and enforce capacity', () => {
  let now = 10000;
  const runtime = createTutorials({ now: () => now, maxSessions: 1, ttl: 1000 });
  const a = runtime.start('a', 'poker');
  assert.throws(() => runtime.state('b', a.id), { code: 'TUTORIAL_NOT_FOUND' });
  assert.throws(() => runtime.start('b', 'poker'), { code: 'TUTORIAL_BUSY' });
  const next = runtime.start('a', 'poker');
  assert.notEqual(next.id, a.id);
  assert.throws(() => runtime.state('a', a.id), { code: 'TUTORIAL_NOT_FOUND' });
  now += 1001;
  assert.equal(runtime.size(), 0);
  assert.throws(() => runtime.state('a', next.id), { code: 'TUTORIAL_NOT_FOUND' });
  assert.throws(() => runtime.start('a', '__proto__'), { code: 'INVALID_TUTORIAL' });
});
test('duplicate tutorial actions are applied once; old revisions and changed receipts reject', () => {
  const runtime = createTutorials(),
    s = runtime.start('a', 'poker'),
    data = { id: s.id, revision: 0, requestId: randomUUID() };
  const once = runtime.apply('a', data),
    duplicate = runtime.apply('a', data);
  assert.equal(duplicate.revision, once.revision);
  assert.equal(duplicate.steps, once.steps);
  assert.deepEqual(duplicate.snapshot.players, once.snapshot.players);
  assert.throws(() => runtime.apply('a', { ...data, body: { secret: 'different' } }), {
    code: 'REQUEST_CONFLICT',
  });
  assert.throws(() => runtime.apply('a', { ...data, requestId: randomUUID() }), {
    code: 'STALE_TUTORIAL',
  });
  const current = runtime.state('a', s.id);
  assert.throws(
    () =>
      runtime.apply(
        'a',
        { id: s.id, revision: current.revision, requestId: randomUUID(), body: {} },
        'delete',
      ),
    { code: 'TUTORIAL_ROUTE' },
  );
  assert.equal(runtime.state('a', s.id).revision, 1);
});
test('manual poker commands run for the learner, not a caller-selected other seat', () => {
  const runtime = createTutorials({ rng: random(3) });
  let s = runtime.start('a', 'poker');
  while (s.snapshot.players[s.snapshot.turn].id !== s.snapshot.me)
    s = runtime.apply('a', { id: s.id, revision: s.revision, requestId: randomUUID() });
  const me = s.snapshot.players.find((p) => p.id === s.snapshot.me),
    action = me.bet < s.snapshot.currentBet ? 'call' : 'check';
  const changed = runtime.apply(
    'a',
    { id: s.id, revision: s.revision, requestId: randomUUID(), body: { action, actor: 'forged' } },
    'action',
  );
  assert.equal(changed.events.at(-1).actor, '學員小明');
  assert.equal(changed.steps, s.steps + 1);
});
test('teaching audio is bounded, unique, owner-bound and valid only for the current song', () => {
  const { songs, clip } = require('../src/tutorials/audio');
  assert.equal(songs.length, 7);
  assert.equal(new Set(songs.map((_, i) => clip(i).toString('base64'))).size, 7);
  assert.equal(clip(0).readUInt32LE(40), 16000 * 8 * 2);
  assert.equal(clip(0, 30).readUInt32LE(40), 16000 * 30 * 2);
  assert.throws(() => clip(0, 3600));
  const runtime = createTutorials(),
    s = runtime.start('a', 'musicquiz');
  assert.ok(runtime.audio('a', s.id, s.snapshot.roundId).length);
  assert.throws(() => runtime.audio('b', s.id, s.snapshot.roundId), { code: 'TUTORIAL_NOT_FOUND' });
  assert.throws(() => runtime.audio('a', s.id, 'stale'), { code: 'TUTORIAL_AUDIO' });
});
test('teaching perspectives can change only within the owned sandbox and invalidate old actions', () => {
  const runtime = createTutorials(),
    s = runtime.start('owner', 'minimal'),
    peer = s.snapshot.players[1];
  assert.throws(
    () => runtime.perspective('other', { id: s.id, revision: s.revision, playerId: peer.id }),
    { code: 'TUTORIAL_NOT_FOUND' },
  );
  assert.throws(
    () =>
      runtime.perspective('owner', { id: s.id, revision: s.revision, playerId: 'real-room-seat' }),
    { code: 'TUTORIAL_PLAYER' },
  );
  const next = runtime.perspective('owner', { id: s.id, revision: s.revision, playerId: peer.id });
  assert.equal(next.snapshot.me, peer.id);
  assert.equal(next.revision, s.revision + 1);
  assert.throws(
    () => runtime.apply('owner', { id: s.id, revision: s.revision, requestId: randomUUID() }),
    { code: 'STALE_TUTORIAL' },
  );
});
