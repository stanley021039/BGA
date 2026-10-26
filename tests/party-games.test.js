'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { MinimalRoom, shapes } = require('../src/games/minimal'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  { SONGS } = require('../src/games/musicquiz-catalog');
const line = { kind: 'line', x1: 20, y1: 20, x2: 120, y2: 120 },
  circle = { kind: 'circle', cx: 250, cy: 120, r: 40 };
const act = (r, p, action, data = {}) =>
  r.act(typeof p === 'string' ? p : p.id, action, {
    roundId: r.roundId,
    requestId: randomUUID(),
    ...data,
  });
const minimal = (n) => {
  const r = new MinimalRoom('ABCDEF', 'test', () => 0),
    p = Array.from({ length: n }, (_, i) => r.add('p' + i));
  r.start();
  return { r, p };
};
for (const n of [3, 4, 5, 6, 7, 8])
  test('minimal ' + n + ' seats rotate guessers, score +2/+1 and finish expected rounds', () => {
    const { r, p } = minimal(n),
      rounds = n <= 4 ? n * 2 : n,
      guessers = [];
    for (let i = 0; i < rounds; i++) {
      guessers.push(r.guesserId);
      for (const a of r.artists()) act(r, a, 'submit', { shapes: [line] });
      const author = r.player(r.order[0]),
        g = r.player(r.guesserId),
        before = [author.score, g.score];
      act(r, g, 'guess', { text: r.question.title });
      assert.deepEqual([author.score, g.score], [before[0] + 2, before[1] + 1]);
      if (i < rounds - 1) act(r, p[0], 'next');
    }
    assert.equal(r.phase, 'finished');
    assert.equal(r.results.length, rounds);
    assert.equal(new Set(guessers).size, n);
    assert.ok(r.winner.names.length);
  });
test('minimal accepts only bounded straight lines and complete circles, copies data', () => {
  for (const s of [
    { kind: 'brush' },
    { ...line, x1: 1.2 },
    { ...line, x2: 20, y2: 20 },
    { ...circle, r: 129 },
    { ...circle, r: 0 },
    { ...circle, cx: 5 },
    { ...circle, cx: 40 },
    { ...circle, cy: 40 },
  ])
    assert.throws(
      () => shapes([s]),
      (e) => e.code === 'INVALID_SHAPES',
    );
  assert.throws(() => shapes(Array(41).fill(line)));
  const input = { ...line },
    copy = shapes([input]);
  input.x1 = 99;
  assert.equal(copy[0].x1, 20);
  assert.equal(shapes([{ ...circle, color: 'red', points: [[0, 0]] }])[0].color, undefined);
});
test('minimal view hides current word and other drafts from guesser, keeps artists private', () => {
  const { r, p } = minimal(3);
  act(r, p[1], 'draft', { shapes: [circle] });
  assert.equal(r.view(p[0].id).prompt, null);
  assert.ok(!JSON.stringify(r.view(p[0].id)).includes(r.question.title));
  assert.deepEqual(r.view(p[2].id).myShapes, []);
  assert.deepEqual(r.view(p[1].id).myShapes, [circle]);
  assert.equal(r.view(p[0].id).currentDrawing, null);
  assert.ok(!JSON.stringify(r.view(p[1].id)).includes('secret'));
  assert.throws(
    () => act(r, p[0], 'draft', { shapes: [line] }),
    (e) => e.code === 'ARTIST_ONLY',
  );
});
test('minimal ascending count, rotating equal-count priority, one guess per image and alias acceptance', () => {
  const { r, p } = minimal(4);
  act(r, p[1], 'submit', { shapes: [line, circle] });
  act(r, p[2], 'submit', { shapes: [line] });
  act(r, p[3], 'submit', { shapes: [circle] });
  assert.deepEqual(r.order, [p[2].id, p[3].id, p[1].id]);
  assert.throws(
    () => act(r, p[1], 'guess', { text: '蘋果' }),
    (e) => e.code === 'GUESSER_ONLY',
  );
  act(r, p[0], 'guess', { text: '錯誤' });
  assert.equal(r.shown, 1);
  act(r, p[0], 'guess', { text: r.question.title });
  assert.equal(p[3].score, 2);
  act(r, p[0], 'next');
  for (const a of r.artists()) act(r, a, 'submit', { shapes: [line] });
  assert.equal(r.order[0], p[2].id);
});
test('minimal last artist deadline preserves only server-accepted draft and rejects late writes', () => {
  let now = 1000;
  const r = new MinimalRoom(
      'ABCDEF',
      'deadline',
      () => 0,
      () => now,
    ),
    p = Array.from({ length: 4 }, (_, i) => r.add('p' + i));
  r.start();
  act(r, p[3], 'draft', { shapes: [circle, line] });
  act(r, p[1], 'submit', { shapes: [line] });
  assert.equal(r.deadline, null);
  act(r, p[2], 'submit', { shapes: [line] });
  assert.equal(r.deadline, 11000);
  now = 10999;
  r.auto();
  assert.equal(r.phase, 'drawing');
  now = 11000;
  assert.throws(
    () => act(r, p[3], 'draft', { shapes: [] }),
    (e) => e.code === 'DRAWING_CLOSED',
  );
  r.auto();
  assert.equal(r.phase, 'guessing');
  assert.equal(r.drafts[p[3].id].length, 2);
});
test('minimal all-empty skips reveal neutral result; stale epochs, duplicates and departure are safe', () => {
  const { r, p } = minimal(3),
    data = { roundId: r.roundId, requestId: randomUUID(), shapes: [] };
  r.act(p[1].id, 'submit', data);
  const version = r.version;
  r.act(p[1].id, 'submit', data);
  assert.equal(r.version, version);
  assert.throws(
    () => r.act(p[1].id, 'submit', { ...data, shapes: [line] }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  act(r, p[2], 'submit', { shapes: [] });
  assert.equal(r.phase, 'reveal');
  assert.equal(p[0].score, 0);
  act(r, p[0], 'next');
  assert.throws(
    () => r.act(p[1].id, 'submit', data),
    (e) => e.code === 'STALE_ROUND',
  );
  r.kick(p[0].id, p[0].id, true);
  assert.equal(r.phase, 'finished');
  assert.equal(r.interrupted, true);
  assert.equal(r.host, p[1].id);
  assert.equal(r.winner, null);
});
test('legacy synthesized catalogue remains available for historical recordings', () => {
  const { clip } = require('../src/games/musicquiz-catalog');
  for (let i = 0; i < 3; i++) {
    const bytes = clip(i);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.length, 192044);
    assert.ok(bytes.subarray(44).some((x) => x));
  }
});
