'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { CATALOG } = require('../src/games/musicquiz-library'),
  tournament = require('../src/games/majority-tournament');
test('new requested English tracks and replacement Japanese source use original release years in both music modes', () => {
  for (const [id, title, year, bank] of [
    ['r6zIGXun57U', 'Legends Never Die', 2017, 'en'],
    ['C3GouGa0noM', 'GODS', 2023, 'en'],
    ['i1IKnWDecwA', 'Phoenix', 2019, 'en'],
    ['KvMY1uzSC1E', 'I Really Want to Stay at Your House', 2020, 'en'],
    ['qs4Q4cQxyU4', 'Wherever you are', 2010, 'jp'],
  ]) {
    const song = CATALOG.find((s) => s.id === id);
    assert.ok(song, id);
    assert.equal(song.title, title);
    assert.equal(song.year, year);
    assert.equal(song.bank, bank);
    assert.equal(song.clipReviewed, false);
    assert.ok(tournament.pool('music', bank).some((s) => s.id === id));
  }
  assert.equal(
    CATALOG.filter((s) => s.artist === 'ONE OK ROCK' && s.title === 'Wherever you are').length,
    1,
  );
  assert.equal(
    CATALOG.some((s) => s.id === 'eoQAnGx4Pss'),
    false,
  );
});

test('Vivy tracks and the requested HOME TAKE recording are included, existing Rainie is deduplicated and failed sources removed', () => {
  for (const id of [
    'oec9R5ypf-o',
    'JqN4_mufE2U',
    '2qcvp5nE4Lc',
    'rweQmBxc2lc',
    'K6k63SJQquo',
    'j1hft9Wjq9U',
  ])
    assert.equal(CATALOG.filter((s) => s.id === id).length, 1);
  for (const id of ['x8VYWazR5mE', '4fWyzwo1xg0', 'eoQAnGx4Pss'])
    assert.equal(
      CATALOG.some((s) => s.id === id),
      false,
    );
  const take = CATALOG.find((s) => s.id === 'j1hft9Wjq9U');
  assert.equal(take.year, 2020);
  assert.equal(take.yearBasis, 'video-release');
  assert.match(take.title, /HOME TAKE/);
});
