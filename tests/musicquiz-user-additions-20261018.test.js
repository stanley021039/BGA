'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CATALOG } = require('../src/games/musicquiz-library');
const { MusicQuizRoom } = require('../src/games/musicquiz');
const tournament = require('../src/games/majority-tournament');
const requested = [
  ['QJie7dTvbjQ', 'majiko', '心做し [LIVE]', 'jp'],
  ['p13tH7Etlzc', '王艷薇', '離開我的依賴', 'zh'],
  ['xdr5ojVDC48', 'en', '最後一頁', 'viral'],
  ['Sdh16YlinNE', '任然', '飛鳥和蟬', 'viral'],
  ['DVE3pu7pY2c', '任然', '無人之島', 'viral'],
  ['bDZ2pcn_V4c', '蕭煌奇', '末班車', 'zh'],
  ['yarOcdANK50', '五月天', '人生海海', 'zh'],
  ['iN8lxL1gvOE', '艾熱', '星球墜落 (FALLING)', 'zh'],
  ['b8R-3QfLEdY', 'Gummy B', 'LIGHTS IN YOUR EYES', 'zh'],
  ['MHMjzUfYeFs', '頑童MJ116', '2030', 'zh'],
  ['NpuV0QjhZ5E', '瘦子E.SO', '太陽', 'zh'],
  ['kU0oHbP4ZDk', '菲道爾', '阿拉斯加海灣', 'viral'],
  ['wlSvIL-H1GQ', '菲道爾', '在加納共和國離婚', 'viral'],
  ['CKG1AxTYW0c', '伍佰 & China Blue', '你是我的花朵', 'zh'],
  ['Fkc4mgo1p6A', '蔡健雅', '達爾文', 'zh'],
  ['K27Y_f6BXVs', '蔡健雅', '空白格', 'zh'],
  ['qs4Q4cQxyU4', 'ONE OK ROCK', 'Wherever you are', 'jp'],
  ['IpFX2vq8HKw', 'yung kai', 'blue', 'en'],
];
test('new user-requested songs are in both game pools, including the mandatory majiko live recording', () => {
  assert.ok(
    CATALOG.filter((song) => song.bank === 'zh').length >
      CATALOG.filter((song) => song.bank === 'jp').length,
    'Mandarin bank stays ahead of Japanese',
  );
  const room = new MusicQuizRoom('ADDITIONS', 'check'),
    host = room.add('host');
  const shared = tournament.pool('music', 'all');
  for (const [id, artist, title, bank] of requested) {
    const song = CATALOG.find((s) => s.id === id);
    assert.ok(song, id);
    assert.equal(song.artist, artist);
    assert.equal(song.title, title);
    assert.equal(song.bank, bank);
    assert.equal(song.aiGenerated, false);
    assert.equal(song.familiarity, 'familiar');
    assert.ok(room.pool().some((s) => s.id === id));
    assert.ok(shared.some((s) => s.id === id));
  }
  const mandatory = CATALOG.find((s) => s.id === 'QJie7dTvbjQ');
  assert.equal(mandatory.metadataAuthor, 'majiko / まじ娘 OFFICIAL CHANNEL');
  assert.equal(new Set(CATALOG.map((s) => s.videoId + ':' + s.introStart)).size, CATALOG.length);
});
