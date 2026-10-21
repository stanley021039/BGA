'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { findIntroStart } = require('../src/music/intro-onset'),
  { suggest } = require('../src/music/game-audio-full');
function signal(seconds, onset, channels = 1, click = false) {
  const b = Buffer.alloc(seconds * 4000 * channels * 4);
  for (let i = 0; i < seconds * 4000; i++) {
    const t = i / 4000,
      x = t >= onset || (click && t >= 1 && t < 1.04) ? Math.sin(i * Math.PI * 0.1) * 0.2 : 0;
    for (let c = 0; c < channels; c++) b.writeFloatLE(c % 2 ? -x : x, (i * channels + c) * 4);
  }
  return b;
}
test('long silent video openings and isolated clicks do not select a silent intro', () => {
  const pcm = signal(90, 45, 1, true);
  assert.equal(findIntroStart(pcm), 44.8);
  assert.equal(suggest(pcm).introStart, 44.8);
  assert.equal(findIntroStart(signal(40, 100, 1, true)), null);
});
test('stereo phase differences cannot cancel the onset and ordinary openings retain their lead-in', () => {
  assert.equal(findIntroStart(signal(60, 1, 2), { channels: 2 }), 0.8);
  assert.equal(suggest(signal(60, 1, 2), 2).introStart, 0.8);
  assert.equal(findIntroStart(signal(60, 0)), 0);
  assert.throws(() => findIntroStart(Buffer.from([0, 0, 0])), /取樣/);
});

test('custom songs accept audible fractional cue points but reject non-finite and out-of-range offsets', () => {
  const { MusicQuizRoom } = require('../src/games/musicquiz'),
    { CATALOG } = require('../src/games/musicquiz-library');
  const room = new MusicQuizRoom('ABCDEF', 'test'),
    host = room.add('host'),
    song = { ...CATALOG[0], introStart: 1.25, highlightStart: 30.5 };
  room.configure(host.id, { banks: ['custom'], customSongs: [song] });
  assert.equal(room.customSongs[0].introStart, 1.25);
  assert.equal(room.customSongs[0].highlightStart, 30.5);
  for (const introStart of [NaN, Infinity, -1, 21601, '1.25'])
    assert.throws(
      () => room.configure(host.id, { customSongs: [{ ...song, introStart }] }),
      /秒數/,
    );
  assert.equal(room.customSongs[0].introStart, 1.25);
});
