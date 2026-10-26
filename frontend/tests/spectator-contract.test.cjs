'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
const { spectatorView, games } = require('../../src/rooms/spectator');
const types = {
  poker: ['poker', 'Room'],
  thunder: ['thunder', 'ThunderRoom'],
  majority: ['majority', 'MajorityRoom'],
  gift: ['gift', 'GiftRoom'],
  draw: ['draw-guess', 'DrawGuessRoom'],
  trpg: ['trpg', 'TrpgRoom'],
  telephone: ['telephone', 'TelephoneRoom'],
  musicquiz: ['musicquiz', 'MusicQuizRoom'],
  minimal: ['minimal', 'MinimalRoom'],
  bluff: ['bluff', 'BluffRoom'],
  quacks: ['quacks', 'QuacksRoom'],
  ceo: ['ceo-room', 'CeoRoom'],
  'second-wind': ['second-wind/room', 'SecondWindRoom'],
  lounge: ['lounge', 'LoungeRoom'],
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  cache.set(file, mod.exports);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: mod,
      exports: mod.exports,
      require(id) {
        return id.startsWith('.')
          ? load(path.resolve(path.dirname(file), id + '.ts'))
          : require(id);
      },
    },
  );
  return mod.exports;
}
const { readSpectatorSnapshot } = load(path.resolve(__dirname, '../src/contracts/spectator.ts'));
test('spectator reader accepts real waiting and started projections for every room type', () => {
  assert.equal(Object.keys(types).length, Object.keys(games).length);
  for (const [type, [file, key]] of Object.entries(types)) {
    const Type = require('../../src/games/' + file)[key],
      r = new Type('ABCDEF', type);
    for (let i = 0; i < 3; i++) r.add('玩家' + i, true);
    for (const started of [false, true]) {
      if (started && type === 'lounge') continue;
      if (started) r.start();
      const v = readSpectatorSnapshot(spectatorView(r));
      assert.equal(v.type, type);
      assert.equal(v.players.length, 3);
      assert.equal(v.spectator, true);
    }
  }
});
test('spectator reader rejects malformed canvases, executable clip URLs, invalid cards and room identities', () => {
  const { Room } = require('../../src/games/poker'),
    r = new Room('ABCDEF', 'read-only');
  r.add('玩家');
  const v = spectatorView(r);
  for (const patch of [
    { code: 'other-room' },
    { spectator: false },
    { gameRevision: NaN },
    { cards: [100] },
    {
      drawing: {
        epoch: 'x',
        strokes: [{ tool: 'brush', color: 'url(javascript:x)', size: 2, points: [[1, 1]] }],
      },
    },
    {
      drawing: {
        epoch: 'x',
        strokes: [{ tool: 'brush', color: '#123456', size: 2, points: [[NaN, 1]] }],
      },
    },
    {
      clips: [
        {
          key: 'x',
          label: 'x',
          playback: {
            provider: 'audio',
            url: 'https://example.com/a.mp3',
            start: 0,
            seconds: 8,
            stage: 'intro',
          },
        },
      ],
    },
    {
      clips: [
        {
          key: 'x',
          label: 'x',
          playback: {
            provider: 'youtube',
            videoId: '" onload="x',
            start: 0,
            seconds: 8,
            stage: 'intro',
          },
        },
      ],
    },
  ])
    assert.throws(() => readSpectatorSnapshot({ ...v, ...patch }));
});
test('real engine/AI transitions keep every observed phase compatible with the spectator contract', () => {
  const { create, advance, phaseKey } = require('../../tools/qa/spectator-fixtures-296.cjs');
  for (const type of Object.keys(games)) {
    const r = create(type),
      seen = new Set();
    function check() {
      const key = phaseKey(r);
      if (seen.has(key)) return;
      const raw = spectatorView(r);
      let snapshot;
      try {
        snapshot = readSpectatorSnapshot(raw);
      } catch (error) {
        throw new Error(
          type +
            ':' +
            key +
            ' ' +
            error.message +
            ' invalid lines=' +
            JSON.stringify(
              raw.sections.filter((s) => s.lines.some((line) => typeof line !== 'string')),
            ),
        );
      }
      assert.equal(snapshot.type, type, key);
      seen.add(key);
    }
    check();
    if (type === 'lounge') continue;
    r.start();
    check();
    let stagnant = 0;
    for (let step = 1; step < 3500 && !['finished', 'showdown'].includes(r.phase); step++) {
      if (advance(r, step)) stagnant = 0;
      else stagnant++;
      check();
      assert.ok(stagnant < 5, type + ' must have a supported continuation');
    }
    assert.ok(['finished', 'showdown'].includes(r.phase), type + ' reached its ending');
  }
});
