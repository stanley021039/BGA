'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  { CATALOG, BANKS } = require('../src/games/musicquiz-library'),
  { titles } = require('../frontend/src/engines/song-title-zh.js').default;
test('current Japanese kana and Thai titles have a local Chinese reference gloss, not a network translation request', () => {
  for (const s of CATALOG.filter(
    (s) =>
      (s.bank === 'jp' || s.language === 'th') && /[\u3040-\u30ff\u0e00-\u0e7f]/u.test(s.title),
  ))
    assert.ok(titles[s.title], s.title);
  assert.match(titles['アイドル'], /偶像/);
  assert.match(titles['Haru Haru'], /一天/);
  assert.match(titles['AIZO'], /愛與恨/);
  assert.match(titles['เข้ากันดี'], /合拍/);
  assert.ok(!fs.readFileSync('public/shared/song-title-zh.js', 'utf8').includes('fetch('));
});
test('mainland Douyin theme contains curated Chinese songs, not western artist padding, with other sources preserved', () => {
  const songs = CATALOG.filter((s) => s.bank === 'viral');
  assert.equal(songs.length, 65);
  assert.ok(
    songs.every(
      (s) => s.douyinSelection === 'mainland-chinese-hits' && /\p{Script=Han}/u.test(s.title),
    ),
  );
  assert.ok(CATALOG.some((s) => s.title === 'Dance Monkey' && s.bank === 'en'));
  assert.ok(CATALOG.some((s) => s.title === 'Despacito' && s.bank === 'foreign'));
  assert.ok(CATALOG.some((s) => s.title === 'See Tình' && s.bank === 'foreign'));
  assert.equal(CATALOG.length, 1420);
  assert.ok(BANKS.some((b) => b.id === 'foreign'));
});
