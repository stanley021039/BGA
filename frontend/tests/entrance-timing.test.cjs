const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entrancePlaybackDuration } = require('./helpers/entrance-timing.cjs');
test('long entrances and their alternates use the same shortened complete choreography', () => {
  for (const [id, before, after] of [
    ['stitch-stand-time', 12120, 4200],
    ['stitch-gilgamesh', 7120, 3800],
    ['stitch-hyorinmaru', 6120, 3600],
  ]) {
    assert.equal(entrancePlaybackDuration(id, before), after);
    assert.equal(entrancePlaybackDuration(id + '-alt', before), after);
  }
  assert.equal(entrancePlaybackDuration('classic', 900), 900);
  assert.equal(entrancePlaybackDuration('arrival-coffin-dance', 3500), 3500);
});
