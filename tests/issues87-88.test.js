const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { DrawGuessRoom, readEnding } = require('../src/games/draw-guess');

function draw(ending, n = 3) {
  const r = new DrawGuessRoom('ABCDEF', 'ending', () => 0),
    p = Array.from({ length: n }, (_, i) => r.add('p' + i));
  r.options.ending = ending;
  r.start();
  return { r, p };
}
test('score target finishes only after full reveal, preserves final result and awards', () => {
  const { r, p } = draw({ mode: 'score', value: 30 });
  r.choose(r.presenterId, r.candidates[0].id);
  r.guess(p[1].id, r.question.title);
  assert.equal(r.phase, 'drawing');
  assert.ok(p[1].score >= 30);
  r.guess(p[2].id, r.question.title);
  assert.equal(r.phase, 'finished');
  assert.ok(r.result.resultId);
  assert.equal(r.results.length, 1);
  assert.match(r.winner.reason, /分數達標/);
});
test('fixed total questions rotate beyond one circle, stop exactly and retain only recent eight gallery entries', () => {
  const { r } = draw({ mode: 'rounds', value: 12 }, 2),
    artists = [];
  for (let i = 0; i < 12; i++) {
    artists.push(r.presenterId);
    r.choose(r.presenterId, r.candidates[0].id);
    r.reveal();
    if (i < 11) {
      assert.equal(r.phase, 'reveal');
      r.next(r.host);
    }
  }
  assert.equal(r.round, 12);
  assert.equal(r.phase, 'finished');
  assert.equal(artists[0], artists[2]);
  assert.equal(r.results.length, 8);
  assert.equal(r.publicResults.size, 8);
});
test('ending validation and legacy default keep old one-circle flow', () => {
  for (const value of [
    null,
    {},
    [],
    { mode: 'rounds', value: 0 },
    { mode: 'rounds', value: 65 },
    { mode: 'score', value: 9 },
    { mode: 'score', value: 1001 },
    { mode: 'score', value: NaN },
    { mode: 'rounds', value: 1.5 },
  ])
    assert.throws(
      () => readEnding(value),
      (e) => e.code === 'INVALID_DRAW_ENDING',
    );
  const { r } = draw({ mode: 'rounds', value: null }, 2);
  for (let i = 0; i < 2; i++) {
    r.choose(r.presenterId, r.candidates[0].id);
    r.reveal();
    assert.equal(r.phase, 'reveal');
    r.next(r.host);
  }
  assert.equal(r.phase, 'finished');
  assert.equal(r.round, 2);
});
test('score mode caps at 64 questions when nobody reaches target', () => {
  const { r } = draw({ mode: 'score', value: 1000 }, 2);
  for (let i = 0; i < 64; i++) {
    r.choose(r.presenterId, r.candidates[0].id);
    r.reveal();
    if (i < 63) r.next(r.host);
  }
  assert.equal(r.phase, 'finished');
  assert.match(r.winner.reason, /64/);
  assert.equal(r.results.length, 8);
});
