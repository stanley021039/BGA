'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CATALOG, BANKS, normalizeBank } = require('../src/games/musicquiz-library'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  tournament = require('../src/games/majority-tournament');
test('eight named banks preserve future foreign languages and retain legacy language metadata', () => {
  assert.deepEqual(
    BANKS.filter((b) => b.id !== 'custom').map((b) => b.id),
    ['zh', 'tw', 'jp', 'kr', 'yue', 'viral', 'classical', 'en', 'foreign'],
  );
  for (const language of ['th', 'es', 'vi', 'fr', 'de', 'it', 'unknown-future-language'])
    assert.equal(normalizeBank(language), 'foreign');
  for (const id of BANKS.map((b) => b.id)) assert.equal(normalizeBank(id), id);
  assert.equal(CATALOG.filter((s) => s.bank === 'foreign').length, 27);
  assert.ok(CATALOG.some((s) => s.bank === 'foreign' && s.language === 'th'));
});
test('requested expansion adds exactly 100 Cantonese, 80 Taiwanese and 50 mainland Douyin songs to both games', () => {
  assert.equal(CATALOG.length, 1420);
  for (const [bank, count] of [
    ['zh', 321],
    ['tw', 103],
    ['yue', 100],
    ['viral', 65],
  ]) {
    const songs = CATALOG.filter((s) => s.bank === bank),
      r = new MusicQuizRoom('LANG20', 'test'),
      p = r.add('host');
    assert.equal(songs.length, count);
    r.configure(p.id, { banks: [bank] });
    assert.deepEqual(
      r
        .pool()
        .map((s) => s.id)
        .sort(),
      songs.map((s) => s.id).sort(),
    );
    assert.equal(tournament.pool('music', bank).length, count);
    assert.ok(tournament.themes('music').some((t) => t.id === bank));
  }
  assert.ok(CATALOG.some((s) => s.bank === 'tw' && s.artist === '江蕙'));
  assert.ok(CATALOG.some((s) => s.bank === 'tw' && s.artist === '滅火器'));
  assert.ok(!CATALOG.some((s) => s.bank === 'tw' && s.title === '白鴿'));
  const zh = new Set(
    CATALOG.filter((s) => s.bank === 'zh').flatMap((s) => [s.title, ...s.aliases]),
  );
  for (const s of CATALOG.filter((s) => s.bank === 'viral')) {
    assert.equal(s.douyinSelection, 'mainland-chinese-hits');
    assert.ok(![s.title, ...s.aliases].some((t) => zh.has(t)), s.title);
  }
  assert.equal(new Set(CATALOG.map((s) => s.videoId + ':' + s.introStart)).size, CATALOG.length);
});
test('legacy quiz selections coalesce without permitting unknown configuration values', () => {
  for (const alias of ['th', 'es', 'vi']) {
    assert.equal(tournament.normalizeTheme('music', alias), 'foreign');
    assert.equal(tournament.pool('music', alias).length, 27);
    assert.doesNotThrow(() => tournament.validate('music', alias, 16));
  }
  assert.throws(() => tournament.validate('music', 'invalid-bank', 16));
  const r = new MusicQuizRoom('LEGACY', 'test'),
    p = r.add('host');
  r.configure(p.id, { banks: ['en', 'th', 'es', 'vi'] });
  assert.deepEqual(r.settings.banks, ['en', 'foreign']);
  assert.equal(r.pool().length, 362);
  const previous = [...r.settings.banks];
  assert.throws(() => r.configure(p.id, { banks: ['foreign', 'invalid-bank'] }));
  assert.deepEqual(r.settings.banks, previous);
});
