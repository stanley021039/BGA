'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { CATALOG, BANKS, primaryArtist } = require('../src/games/musicquiz-library');
const { MusicQuizRoom } = require('../src/games/musicquiz');
const root = path.resolve(__dirname, '..'),
  groups = new Map();
for (const song of CATALOG) {
  const a = primaryArtist(song.artist);
  if (!groups.has(a)) groups.set(a, []);
  groups.get(a).push(song);
}
const exceptions = new Set(['王靖雯', '王艷薇', '艾熱', '程響', '葉啟田', 'a-ha']);
const labels = new Map(BANKS.map((b) => [b.id, b.label]));
const counts = BANKS.filter((b) => b.id !== 'custom').map((b) => ({
  ...b,
  total: CATALOG.filter((s) => s.bank === b.id).length,
  eligible: CATALOG.filter(
    (s) => s.bank === b.id && s.familiarity !== 'obscure' && s.aiGenerated === false,
  ).length,
}));
const artists = [...groups]
  .sort(([a], [b]) => a.localeCompare(b, 'zh-Hant'))
  .map(([artist, songs]) => ({
    artist,
    count: songs.length,
    banks: [...new Set(songs.map((s) => s.bank))],
    exempt: exceptions.has(artist),
    songs: songs.map((s) => ({ id: s.id, title: s.title, year: s.year, source: s.source })),
  }));
const room = new MusicQuizRoom('REPORT', 'report'),
  host = room.add('report');
const eligible = CATALOG.filter(
  (s) => s.familiarity !== 'obscure' && s.aiGenerated === false,
).length;
const summary = {
  date: '2026-10-19',
  version: require('../package.json').version,
  total: CATALOG.length,
  primaryArtists: artists.length,
  eligible,
  defaultPool: room.pool().length,
  counts,
  exceptions: [...exceptions],
  belowTarget: artists
    .filter((a) => a.count < 5 && !a.exempt)
    .map((a) => ({ artist: a.artist, count: a.count })),
};
const md = [
  '# 歌曲題庫主署名統計（合作署名歸主歌手）',
  '',
  '2026-10-19本機未發布候選：' +
    summary.total +
    '首、' +
    artists.length +
    '個主署名。feat／合作署名按主歌手歸戶；Simon & Garfunkel保留完整團名，伍佰與China Blue合併計數。',
  '',
  '| 主歌手／演出單位 | 首數 | 題庫 | 備註 |',
  '| --- | ---: | --- | --- |',
  ...artists.map(
    (a) =>
      '| ' +
      a.artist +
      ' | ' +
      a.count +
      ' | ' +
      a.banks.map((b) => labels.get(b)).join('、') +
      ' | ' +
      (a.exempt ? '使用者指定不必補五首' : a.count < 5 ? '尚待補齊' : '') +
      ' |',
  ),
  '',
  '## 歌曲明細',
  '',
  ...artists.flatMap((a) => [
    '### ' + a.artist + '（' + a.count + '首）',
    '',
    ...a.songs.map((s) => '- [' + s.title.replace(/\]/g, '') + '](' + s.source + ') · ' + s.year),
    '',
  ]),
].join('\n');
fs.writeFileSync(path.join(root, 'docs/MUSIC-ARTISTS-20261018.md'), md + '\n');
const out = path.join(root, 'audio-exports');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, 'music-library-manifest.json'),
  JSON.stringify({ summary, songs: CATALOG }, null, 2),
);
fs.writeFileSync(
  path.join(out, 'audio-manifest.json'),
  JSON.stringify(
    {
      audioFileCount: 0,
      sourceType: 'youtube-links',
      updatedAt: '2026-10-19',
      songCount: CATALOG.length,
      songs: CATALOG.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        bank: s.bank,
        source: s.source,
        localAudio: null,
      })),
    },
    null,
    2,
  ),
);
fs.writeFileSync(path.join(out, 'artist-counts.json'), JSON.stringify(artists, null, 2));
fs.writeFileSync(
  path.join(out, 'README.txt'),
  '本包為歌曲來源與題庫中繼資料，沒有歌曲音檔。音檔播放改版在歌曲擴充之後另行處理。\n' +
    JSON.stringify(summary, null, 2) +
    '\n',
);
console.log(JSON.stringify(summary, null, 2));
