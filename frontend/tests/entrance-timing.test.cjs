const { test } = require('node:test');
const assert = require('node:assert/strict');
const { entrancePlaybackDuration } = require('./helpers/entrance-timing.cjs');
test('long entrances and their alternates use the same shortened complete choreography', () => {
  for (const [id, before, after] of [
    ['stitch-stand-time', 12120, 1500],
    ['stitch-gilgamesh', 7120, 1500],
    ['stitch-hyorinmaru', 6120, 1500],
  ]) {
    assert.equal(entrancePlaybackDuration(id, before), after);
    assert.equal(entrancePlaybackDuration(id + '-alt', before), after);
  }
  assert.equal(entrancePlaybackDuration('classic', 900), 900);
  assert.equal(entrancePlaybackDuration('arrival-coffin-dance', 3500), 1500);
  assert.equal(entrancePlaybackDuration('future-entrance', 8000), 1500);
});

test('every catalog entrance and alternate stays within 1.5 seconds without lengthening shorter ones', () => {
  const palette = require('../../public/shared/entrance-palette.json');
  const imported = require('../../public/shared/entrance-stitch.json');
  const durations = {
    classic: 900,
    smoke: 1000,
    sparks: 1200,
    ink: 1100,
    runes: 1300,
    rift: 1200,
    particles: 1500,
    ...Object.fromEntries(
      [...palette.starters, ...imported].filter((e) => e.duration).map((e) => [e.id, e.duration]),
    ),
  };
  const entries = [
    ...palette.starters,
    ...require('../../public/shared/entrance-requirements.json'),
    ...palette.variants,
  ];
  assert.equal(entries.length, 80);
  for (const entry of entries) {
    const authored = durations[entry.variantOf || entry.id];
    assert.ok(Number.isFinite(authored), entry.id);
    assert.equal(entrancePlaybackDuration(entry.id, authored), Math.min(authored, 1500), entry.id);
  }
});
