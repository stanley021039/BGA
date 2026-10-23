'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CATALOG } = require('../src/games/musicquiz-library'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  tournament = require('../src/games/majority-tournament');
const yuiTitles = [
  'CHE.R.RY',
  'Good-bye days',
  'Rolling star',
  'again',
  'SUMMER SONG',
  'HELLO ～Paradise Kiss～',
  'LIFE',
  'GLORIA',
  'Rain',
  'LOVE & TRUTH',
  'Laugh away',
  'to Mother',
  'My Generation',
  'TOKYO',
];
test('six song banks retain expansion coverage without duplicate clip positions or artist/title recordings', () => {
  assert.ok(CATALOG.length >= 308);
  const min = { zh: 45, jp: 91, en: 82, foreign: 16, kr: 53, viral: 15, classical: 18 };
  for (const [bank, count] of Object.entries(min))
    assert.ok(CATALOG.filter((s) => s.bank === bank).length >= count, bank);
  assert.equal(new Set(CATALOG.map((s) => s.videoId + ':' + s.introStart)).size, CATALOG.length);
  assert.equal(
    new Set(
      CATALOG.map((s) =>
        [s.artist, s.title].map((x) => x.normalize('NFKC').toLowerCase()).join('::'),
      ),
    ).size,
    CATALOG.length,
  );
  const additions = CATALOG.filter((s) => s.metadataChecked === '2026-10-18');
  assert.ok(
    additions.length + require('../src/games/musicquiz-intro-adjustments.json').songs.length >= 103,
  );
  for (const s of additions) {
    assert.equal(s.clipReviewed, false);
    assert.equal(s.playbackVerified, false);
    assert.equal(s.aiGenerated, false);
    assert.match(s.source, /^https:\/\/www.youtube.com\/watch\?v=[\w-]{11}$/);
    assert.ok(s.metadataAuthor && s.metadataTitle);
  }
});
test('YUI songs use her official channel, documented original release years, and existing genre filters', () => {
  for (const title of yuiTitles) {
    const s = CATALOG.find((s) => s.artist === 'YUI' && s.title === title);
    assert.ok(s, title);
    assert.equal(s.bank, s.genres.includes('動漫') ? 'anime' : 'jp');
    assert.equal(s.metadataAuthor, 'YUI OFFICIAL YouTube CHANNEL');
    assert.match(s.yearSource, /^https:\/\/www.sonymusic.co.jp\/artist\/Yui\/discography\//);
    assert.ok(s.year >= 2005 && s.year <= 2011);
  }
  const room = new MusicQuizRoom('ABCDEF', 'jp'),
    p = room.add('host');
  room.configure(p.id, { banks: ['jp'], genres: ['搖滾'] });
  const rock = room.pool();
  assert.ok(rock.some((s) => s.artist === 'YUI'));
  assert.ok(rock.some((s) => s.artist === 'ONE OK ROCK'));
  assert.ok(rock.some((s) => s.artist === 'back number'));
  assert.ok(rock.some((s) => !s.genres.includes('動漫')));
  assert.ok(rock.every((s) => s.bank === 'jp' && s.genres.includes('搖滾')));
  room.configure(p.id, { genres: ['流行'] });
  assert.ok(room.pool().some((s) => s.artist === 'YUI'));
  assert.ok(room.pool().some((s) => s.artist === '宇多田ヒカル'));
});
test('majority music shares the expanded eligible pool and classical supports sixteen entries without enabling obscure songs', () => {
  const eligible = CATALOG.filter((s) => s.aiGenerated === false && s.familiarity !== 'obscure');
  assert.equal(tournament.pool('music', 'all').length, eligible.length);
  for (const bank of ['zh', 'tw', 'jp', 'kr', 'yue', 'viral', 'classical', 'en', 'foreign'])
    assert.equal(
      tournament.pool('music', bank).length,
      eligible.filter((s) => s.bank === bank).length,
    );
  assert.ok(tournament.pool('music', 'jp').some((s) => s.detail === 'YUI'));
  assert.doesNotThrow(() => tournament.validate('music', 'classical', 16));
  assert.ok(
    tournament
      .pool('music', 'classical')
      .every((s) => CATALOG.find((x) => x.id === s.id).familiarity !== 'obscure'),
  );
  const dates = {
    土耳其進行曲: ['publication', 1784],
    月光: ['publication', 1905],
    '天鵝湖・場景': ['premiere', 1877],
  };
  for (const [title, [basis, year]] of Object.entries(dates)) {
    const s = CATALOG.find((s) => s.title === title);
    assert.equal(s.yearBasis, basis);
    assert.equal(s.year, year);
    assert.ok(s.yearSource && s.versionNote);
  }
});
