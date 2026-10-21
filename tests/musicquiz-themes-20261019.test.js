'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { CATALOG } = require('../src/games/musicquiz-library'),
  tournament = require('../src/games/majority-tournament');
test('JoJo has twelve openings and seven endings including SBR SPIN, excluding Yuki Chiba', () => {
  const rows = CATALOG.filter((s) => s.series?.startsWith('JOJO'));
  assert.equal(rows.length, 19);
  assert.equal(rows.filter((s) => s.themeRole.startsWith('OP')).length, 12);
  assert.equal(rows.filter((s) => s.themeRole.startsWith('ED')).length, 7);
  assert.ok(rows.some((s) => s.artist === 'Kroi' && s.title === 'SPIN' && s.year === 2026));
  assert.ok(!CATALOG.some((s) => /千葉雄喜|Yuki Chiba/i.test(s.artist)));
});
test('Jujutsu thirteen themes match the official playlist, including the distinct 2025 acoustic version', () => {
  const rows = CATALOG.filter((s) => s.series?.startsWith('咒術迴戰'));
  assert.equal(rows.length, 13);
  for (const title of [
    '廻廻奇譚',
    'VIVID VICE',
    'LOST IN PARADISE',
    'give it back',
    '一途',
    '逆夢',
    '青のすみか',
    '燈',
    'SPECIALZ',
    'more than words',
    '青のすみか (Acoustic ver.)',
    'AIZO',
    'よあけのうた',
  ])
    assert.ok(
      rows.some((s) => s.title === title),
      title,
    );
  for (const s of rows)
    assert.equal(s.seriesSource, 'https://jujutsukaisen.jp/news/20260320_01.php');
  const acoustic = rows.find((s) => s.title === '青のすみか (Acoustic ver.)');
  assert.equal(acoustic.year, 2025);
  assert.equal(acoustic.yearBasis, 'version-release');
});
test('Franchouchou animation themes use nine official sources and fit full clip descriptors', () => {
  const rows = CATALOG.filter((s) => s.artist === 'Franchouchou');
  assert.equal(rows.length, 9);
  assert.ok(rows.some((s) => s.themeRole === 'OP'));
  assert.ok(rows.some((s) => s.themeRole === 'ED'));
  for (const s of rows) {
    assert.match(s.metadataAuthor, /公式/);
    assert.ok(s.series.startsWith('佐賀偶像是傳奇'));
    assert.ok(s.sourceDuration >= s.highlightStart + 30);
    assert.ok(s.artistAliases.includes('フランシュシュ'));
    assert.equal(s.clipReviewed, false);
    assert.equal(s.playbackVerified, false);
    assert.ok(tournament.pool('music', 'all').some((x) => x.id === s.id));
  }
});
test('requested rock artists, old FIR and FMA2009 openings/endings are available without inflating duplicates', () => {
  assert.ok(CATALOG.filter((s) => s.artist === 'ONE OK ROCK').length >= 10);
  assert.ok(CATALOG.filter((s) => s.artist === 'SEKAI NO OWARI').length >= 5);
  const fir = CATALOG.filter((s) => s.artist === 'F.I.R.');
  assert.equal(fir.length, 10);
  assert.ok(fir.every((s) => s.year < 2018 && s.versionNote.includes('Faye')));
  const fma = CATALOG.filter((s) => s.series === '鋼之鍊金術師 FULLMETAL ALCHEMIST');
  assert.equal(fma.length, 10);
  assert.equal(fma.filter((s) => s.themeRole.startsWith('OP')).length, 5);
  assert.equal(fma.filter((s) => s.themeRole.startsWith('ED')).length, 5);
});
test('all eight recent user links are retained or explicitly replaced with original credited sources', () => {
  for (const id of [
    '4D13K0l8PoU',
    'iYYhKfRYh2c',
    'QlIUHMLSVkw',
    '4CFfSd3toUs',
    'T3bxbVGWy5k',
    'wp43OdtAAkM',
    'xy3AcmW0lrQ',
    '1_PWdjym25g',
  ])
    assert.ok(
      CATALOG.some((s) => s.videoId === id || s.requestedSource?.includes(id)),
      id,
    );
  const secret = CATALOG.find((s) => s.requestedSource?.includes('4CFfSd3toUs'));
  assert.equal(secret.videoId, 'B0GpxW8K0vY');
  assert.equal(secret.year, 2011);
  assert.equal(secret.yearBasis, 'version-release');
  const aimyon = CATALOG.filter((s) => s.artist === 'あいみょん');
  assert.ok(aimyon.length >= 5);
  assert.ok(
    aimyon.every((s) => s.artistAliases.includes('愛繆') && s.artistAliases.includes('愛謬')),
  );
});

test('anime songs keep their genre across languages while standalone Sekai pop is not labeled anime', () => {
  assert.ok(
    CATALOG.filter((s) => s.series?.startsWith('JOJO') || s.series?.startsWith('咒術迴戰')).every(
      (s) => s.genres.includes('動漫'),
    ),
  );
  assert.ok(
    CATALOG.filter((s) => s.artist === 'SEKAI NO OWARI' && !s.series).every(
      (s) => !s.genres.includes('動漫'),
    ),
  );
});
