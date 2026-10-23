'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CATALOG, BANKS, primaryArtist } = require('../src/games/musicquiz-library'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  tournament = require('../src/games/majority-tournament');
test('prior artist targets retain five distinct songs except explicit user exemptions, with collaboration credits grouped', () => {
  const counts = new Map(),
    except = new Set(['王靖雯', '王艷薇', '艾熱', '程響', '葉啟田', 'a-ha', 'Simon & Garfunkel']);
  for (const s of CATALOG) {
    const a = primaryArtist(s.artist);
    if (!counts.has(a)) counts.set(a, new Set());
    counts.get(a).add(s.title.normalize('NFKC').toLowerCase());
  }
  const short = [...counts]
    .filter(
      ([a, s]) =>
        require('./fixtures/musicquiz-five-song-artists-20261018.json').includes(a) &&
        !except.has(a) &&
        s.size < 5,
    )
    .map(([a, s]) => a + ':' + s.size);
  assert.deepEqual(short, []);
  assert.equal(primaryArtist('Lil Nas X ft. Billy Ray Cyrus'), 'Lil Nas X');
  assert.equal(primaryArtist('伍佰 & China Blue'), '伍佰');
  assert.equal(primaryArtist('Simon & Garfunkel'), 'Simon & Garfunkel');
});
test('Thai Scrubb songs remain selectable in the foreign pool in both music games', () => {
  const songs = CATALOG.filter((s) => primaryArtist(s.artist) === 'Scrubb');
  assert.ok(songs.length >= 5);
  for (const s of songs) {
    assert.equal(s.bank, 'foreign');
    assert.equal(s.language, 'th');
    assert.ok(s.seriesSource?.startsWith('https://www.universal-music.co.jp/scrubb/'));
    assert.equal(s.clipReviewed, false);
    assert.equal(s.playbackVerified, false);
  }
  const r = new MusicQuizRoom('ABCDEF', 'test'),
    p = r.add('host');
  r.configure(p.id, { banks: BANKS.map((b) => b.id) });
  r.configure(p.id, { banks: ['foreign'] });
  assert.equal(r.pool().length, CATALOG.filter((s) => s.bank === 'foreign').length);
  assert.equal(tournament.pool('music', 'foreign').length, r.pool().length);
  for (const s of songs) assert.ok(r.pool().some((x) => x.id === s.id));
  assert.ok(tournament.themes('music').some((t) => t.id === 'foreign'));
});
test('additional user video sources retain original release dates and source metadata', () => {
  for (const [id, title, artist, year] of [
    ['GPoTmtykcGY', '歡喜就好', '陳雷', 1994],
    ['6WPWpadfJfI', '周旋', '王以太、艾熱', 2026],
    ['c3H6RgfljME', '很久', '楊和蘇', 2020],
  ]) {
    const s = CATALOG.find((s) => s.id === id);
    assert.ok(s, id);
    assert.equal(s.title, title);
    assert.equal(s.artist, artist);
    assert.equal(s.year, year);
    assert.ok(s.metadataTitle && s.metadataAuthor);
  }
});
test('language labels and Taiwanese songs are shared across quiz and tournament', () => {
  assert.deepEqual(
    BANKS.filter((b) => b.id !== 'custom').map((b) => b.label),
    ['華語', '台語', '日語', '動漫', '韓語', '粵語', '抖音歌', '古典', '英文', '外文'],
  );
  const r = new MusicQuizRoom('ABCDEF', 'test'),
    p = r.add('host');
  assert.ok(r.settings.banks.includes('tw'));
  r.configure(p.id, { banks: ['tw'] });
  assert.ok(r.pool().length >= 16);
  assert.ok(r.pool().every((s) => s.bank === 'tw'));
  for (const title of ['世界第一等', '阿嬤的話'])
    assert.equal(CATALOG.find((s) => s.title === title).bank, 'tw');
  assert.equal(CATALOG.find((s) => s.title === '忘情水').bank, 'zh');
  assert.deepEqual(
    tournament
      .pool('music', 'tw')
      .map((s) => s.id)
      .sort(),
    r
      .pool()
      .map((s) => s.id)
      .sort(),
  );
  assert.ok(tournament.themes('music').some((t) => t.id === 'tw' && t.label === '台語'));
});
