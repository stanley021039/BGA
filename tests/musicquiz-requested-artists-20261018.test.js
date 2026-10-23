'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { CATALOG } = require('../src/games/musicquiz-library'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  tournament = require('../src/games/majority-tournament');
const requested = {
  jp: [
    'back number',
    'Official髭男dism',
    'MyGO!!!!!',
    'Ave Mujica',
    '桑田佳祐',
    '湘南乃風',
    '優里',
    'Aimer',
    '藍井エイル',
    'さユり',
    'TK from 凛として時雨',
  ],
  en: [
    'Benson Boone',
    'yung kai',
    'Adam Lambert',
    'Avril Lavigne',
    'Cigarettes After Sex',
    'Linkin Park',
  ],
  zh: [
    '林宥嘉',
    '八三夭',
    '劉聰',
    'GAI',
    '蛋堡',
    '光良',
    '四葉草',
    '芒果醬',
    '信',
    '美秀集團',
    '國蛋',
    '陶喆',
    '鄧福如',
    'TANK',
    '黃鴻升',
    '陳奕迅',
    '陳忻玥',
    '張宇',
  ],
};
test('all requested artists are available in their selected bank in both music modes', () => {
  for (const [bank, artists] of Object.entries(requested)) {
    const room = new MusicQuizRoom('ARTIST', 'artists'),
      host = room.add('host');
    room.configure(host.id, { banks: bank === 'jp' ? ['jp', 'anime'] : [bank] });
    const pool = room.pool(),
      shared =
        bank === 'jp'
          ? [...tournament.pool('music', 'jp'), ...tournament.pool('music', 'anime')]
          : tournament.pool('music', bank);
    for (const artist of artists) {
      const songs = pool.filter((s) => s.artist === artist);
      assert.ok(
        songs.length >=
          Math.max(
            1,
            3 -
              require('../src/games/musicquiz-intro-adjustments.json').songs.filter(
                (s) => s.artist === artist,
              ).length,
          ),
        artist,
      );
      for (const song of songs)
        assert.ok(
          shared.some((x) => x.id === song.id),
          artist + ' ' + song.title,
        );
    }
  }
  assert.ok(CATALOG.filter((s) => s.artist === '芒果醬').length >= 8);
  assert.ok(CATALOG.length >= 480);
});
test('all advertised genres can be selected together and include reggae, metal and non-anime Japanese rock', () => {
  const genres = [...new Set(CATALOG.flatMap((s) => s.genres))],
    room = new MusicQuizRoom('GENRES', 'genres'),
    host = room.add('host');
  assert.ok(genres.length <= 25, 'advertised genres must fit the configuration limit');
  assert.doesNotThrow(() =>
    room.configure(host.id, {
      banks: ['zh', 'tw', 'jp', 'anime', 'kr', 'yue', 'viral', 'classical', 'en', 'foreign'],
      genres,
    }),
  );
  assert.equal(
    room.pool().length,
    CATALOG.filter((s) => s.familiarity !== 'obscure' && s.aiGenerated === false).length,
  );
  room.configure(host.id, { banks: ['jp'], genres: ['雷鬼'] });
  assert.ok(room.pool().some((s) => s.artist === '湘南乃風'));
  room.configure(host.id, { banks: ['jp', 'anime'], genres: ['金屬'] });
  assert.ok(room.pool().some((s) => s.artist === 'Ave Mujica'));
  room.configure(host.id, { genres: ['搖滾'] });
  assert.ok(room.pool().some((s) => s.artist === '桑田佳祐' && !s.genres.includes('動漫')));
});
test('new-singer Linkin Park tracks and version-specific recordings preserve their documented identity and year', () => {
  for (const title of ['The Emptiness Machine', 'Heavy Is the Crown', 'Two Faced']) {
    const song = CATALOG.find((s) => s.artist === 'Linkin Park' && s.title === title);
    assert.ok(song);
    assert.equal(song.year, 2024);
    assert.match(song.versionNote, /Emily Armstrong/);
    assert.match(song.metadataAuthor, /Linkin Park|League of Legends/);
  }
  const tank = CATALOG.find((s) => s.artist === 'TANK' && s.title === '專屬天使');
  assert.equal(tank.year, 2006);
  assert.equal(tank.yearSource, 'https://www.him.com.tw/albumcon.php?cid=141');
  const female = CATALOG.find((s) => s.artist === '陳忻玥' && s.title === '炙愛 (女聲版)');
  assert.equal(female.year, 2020);
  assert.equal(female.yearBasis, 'version-release');
  assert.match(female.metadataTitle, /女聲版/);
  const source = CATALOG.find((s) => s.artist === 'GAI' && s.title === '空城計');
  assert.equal(source.year, 2016);
  assert.match(source.versionNote, /2026/);
  assert.equal(source.yearSource, 'https://music.apple.com/us/album/1823976606');
  const short = CATALOG.find((s) => s.artist === 'さユり' && s.title === '航海の唄');
  assert.match(short.versionNote, /短版/);
  assert.equal(short.clipReviewed, false);
  assert.equal(short.playbackVerified, false);
});
test('requested artist spellings and shortened song names remain searchable metadata after choice-mode migration', () => {
  const rows = [
    ['Benson Boone', 'Beautiful Things', 'Bense Boone'],
    ['MyGO!!!!!', '春日影 (MyGO!!!!! ver.)', 'my go'],
    ['藍井エイル', 'IGNITE', 'Eir Aoi'],
    ['芒果醬', '小紫aka給我錢', 'Mango Jump'],
    ['信', '告別的時代', '蘇見信'],
    ['陶喆', '就是愛你', 'David Tao'],
  ];
  for (const [artist, title, alias] of rows) {
    const song = CATALOG.find((s) => s.artist === artist && s.title === title);
    assert.ok(song);
    assert.ok(
      [song.artist, ...song.artistAliases].some(
        (x) =>
          require('../src/games/party-base').normalize(x) ===
          require('../src/games/party-base').normalize(alias),
      ),
      alias,
    );
  }
});

test('user-linked songs reach both music pools while removed GAI track stays absent and same-title artists remain distinct', () => {
  const ids = [
      'hFlJZKrG2Uw',
      'PfbxXf-K7MY',
      'Da6JN75_v1Q',
      'GfWkG4qedoE',
      'LM9uN7IlKSI',
      'mRma6NkHwWU',
      'W43F4TtPU2E',
    ],
    room = new MusicQuizRoom('LINKED', 'linked');
  room.add('host');
  const shared = tournament.pool('music', 'all');
  for (const id of ids) {
    const song = CATALOG.find((s) => s.id === id);
    assert.ok(song, id);
    assert.ok(room.pool().some((s) => s.id === id));
    assert.ok(shared.some((s) => s.id === id));
    assert.equal(song.clipReviewed, false);
    assert.equal(song.playbackVerified, false);
  }
  assert.ok(!CATALOG.some((s) => s.artist === 'GAI' && ['華夏', '华夏'].includes(s.title)));
  assert.ok(!shared.some((s) => s.id === 'E8W8SL8Gjp4'));
  assert.ok(CATALOG.some((s) => s.artist === '藍井エイル' && s.title === 'INNOCENCE'));
  assert.equal(CATALOG.find((s) => s.id === 'hFlJZKrG2Uw').artist, 'Avril Lavigne');
  const duet = CATALOG.find((s) => s.id === 'PfbxXf-K7MY');
  assert.equal(duet.year, 2025);
  assert.match(duet.requestedSource, /0pZCZCprZh4/);
  assert.ok(duet.artistAliases.includes('KEY.L'));
  assert.match(duet.metadataAuthor, /D-SHINE/);
});
