'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CATALOG, BANKS } = require('../src/games/musicquiz-library'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  tournament = require('../src/games/majority-tournament'),
  excluded = require('../src/games/musicquiz-intro-adjustments.json');
test('English and other foreign banks remain disjoint in both real music pools', () => {
  assert.equal(BANKS.find((b) => b.id === 'en').label, '英文');
  for (const [bank, count] of [
    ['en', 335],
    ['foreign', 27],
  ]) {
    const room = new MusicQuizRoom('ABCDEF', 'test'),
      host = room.add('host');
    room.configure(host.id, { banks: [bank] });
    const expected = CATALOG.filter((s) => s.bank === bank)
      .map((s) => s.id)
      .sort();
    assert.equal(expected.length, count);
    assert.deepEqual(
      room
        .pool()
        .map((s) => s.id)
        .sort(),
      expected,
    );
    assert.deepEqual(
      tournament
        .pool('music', bank)
        .map((s) => s.id)
        .sort(),
      expected,
    );
    assert.ok(
      room.pool().every((s) => (bank === 'en' ? s.language === 'en' : s.language !== 'en')),
    );
  }
});
test('formerly silent songs are restored with synchronized audible onsets in both games', () => {
  assert.equal(excluded.status, 'restored-with-adjusted-onsets');
  assert.equal(excluded.songs.length, 60);
  assert.equal(new Set(excluded.songs.map((s) => s.id)).size, 60);
  assert.equal(CATALOG.length, 1420);
  const room = new MusicQuizRoom('ABCDEF', 'test'),
    host = room.add('host');
  room.configure(host.id, { banks: BANKS.filter((b) => b.id !== 'custom').map((b) => b.id) });
  for (const record of excluded.songs) {
    const song = CATALOG.find((s) => s.id === record.id);
    assert.ok(song, record.id);
    assert.equal(song.introStart, record.introStart);
    assert.ok(record.introStart > record.previousStart, record.title);
    assert.ok(
      room.pool().some((s) => s.id === record.id),
      record.title,
    );
    assert.ok(
      tournament.pool('music', 'all').some((s) => s.id === record.id),
      record.title,
    );
  }
});
