'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { returnToWaiting } = require('../src/rooms/rematch');
const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
const games = [
  ['thunder', 'ThunderRoom'],
  ['majority', 'MajorityRoom'],
  ['gift', 'GiftRoom'],
  ['draw-guess', 'DrawGuessRoom'],
  ['trpg', 'TrpgRoom'],
  ['telephone', 'TelephoneRoom'],
  ['musicquiz', 'MusicQuizRoom'],
  ['minimal', 'MinimalRoom'],
  ['bluff', 'BluffRoom'],
  ['quacks', 'QuacksRoom'],
];
for (const [file, name] of games)
  test(
    file + ': rematch keeps room/seats/settings, clears game state, then starts normally',
    () => {
      const Type = require('../src/games/' + file)[name];
      let seed = 7;
      const rng = (n) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % n;
      };
      const r = new Type('ABCDEF', 'friends', rng);
      for (let i = 0; i < 3; i++) r.add('P' + i);
      const host = r.host,
        seats = r.players.map((p) => [p.id, p.secret]);
      r.players[0].avatar = '/portrait';
      const settings = structuredClone(r.options || r.settings || { target: r.target });
      r.start();
      assert.throws(() => returnToWaiting(r, host), { code: 'MATCH_NOT_FINISHED' });
      r.phase = 'finished';
      assert.throws(() => returnToWaiting(r, r.players[1].id), { code: 'HOST_ONLY' });
      // Seed stale optional state, including private buffers that polling omits.
      r.result = { secret: 'old' };
      r.deadline = 123;
      r.previousSelection = 'old';
      r.receipts?.set('old', 'old');
      if (r.canvas) {
        r.canvas.strokes.push({ old: true });
        r.canvas.points = 99;
      }
      const epoch = r.canvas?.epoch,
        version = r.version,
        originalRng = r.rng;
      returnToWaiting(r, host);
      assert.equal(r.phase, 'waiting');
      assert.equal(r.round, 0);
      assert.equal(r.host, host);
      assert.equal(r.rng, originalRng);
      assert.deepEqual(
        r.players.map((p) => [p.id, p.secret]),
        seats,
      );
      assert.equal(r.players[0].avatar, '/portrait');
      assert.equal(r.deadline == null, true);
      assert.equal(r.result == null, true);
      assert.equal(r.previousSelection, undefined);
      assert.equal(r.receipts?.size || 0, 0);
      assert.ok(r.version > version);
      if (r.canvas) {
        assert.notEqual(r.canvas.epoch, epoch);
        assert.equal(r.canvas.strokes.length, 0);
      }
      // Quacks chooses actual book variants on start, in addition to setup options.
      const after = r.options || r.settings || { target: r.target };
      for (const key of Object.keys(settings)) assert.deepEqual(after[key], settings[key]);
      const waitingVersion = r.version;
      returnToWaiting(r, host);
      assert.equal(r.version, waitingVersion, 'duplicate click is harmless');
      for (const p of r.players) assert.equal(r.view(p.id).phase, 'waiting');
      const restored = restoreRoom(
        structuredClone(captureRoom(r)),
        () => new Type(r.code, r.name, () => 0),
      ).room;
      assert.equal(restored.view(host).phase, 'waiting');
      r.start();
      assert.notEqual(r.phase, 'waiting');
      for (const p of r.players) r.view(p.id);
    },
  );

test('rematch permits remaining players below the start minimum and excludes departed seats', () => {
  const { MajorityRoom } = require('../src/games/majority');
  const r = new MajorityRoom('ABCDEF', 'friends', () => 0);
  const p = Array.from({ length: 3 }, (_, i) => r.add('P' + i));
  r.start();
  r.phase = 'finished';
  p[1].kicked = true;
  p[2].kicked = true;
  returnToWaiting(r, r.host);
  assert.deepEqual(
    r.players.map((p) => p.id),
    [p[0].id],
  );
  assert.equal(r.phase, 'waiting');
  assert.throws(() => r.start(), /3 至 12/);
});

test('returning preserves pending achievement facts and room managers/providers', () => {
  const { MajorityRoom } = require('../src/games/majority');
  const { setRoomRole, roomRole } = require('../src/rooms/permissions');
  const r = new MajorityRoom('ABCDEF', 'friends', () => 0);
  const players = Array.from({ length: 3 }, (_, i) => r.add('P' + i));
  setRoomRole(
    r,
    r.host,
    players[1].id,
    'manager',
    players.map((p) => p.id),
  );
  const provider = () => [];
  Object.defineProperty(r, 'questionProvider', { value: provider });
  r.start();
  r.phase = 'finished';
  const pending = Object.freeze({ unit_event_id: 'pending', score: 2 });
  r.achievementUnits.pending.set('pending', pending);
  r.reactionSeq = 17;
  returnToWaiting(r, r.host);
  assert.equal(r.achievementUnits.pending.get('pending'), pending);
  assert.equal(r.questionProvider, provider);
  assert.equal(roomRole(r, players[1].id), 'manager');
  assert.equal(r.reactionSeq, 17, 'new reactions must not reuse IDs cached by connected clients');
});

test('cruel team rematch preserves the host-selected partners in waiting and the next match', () => {
  const { MajorityRoom } = require('../src/games/majority');
  const r = new MajorityRoom('ABCDEF', 'teams', () => 0);
  const players = Array.from({ length: 4 }, (_, i) => r.add('P' + i));
  r.configure(r.host, { mode: 'cruel', cruelRules: 'teams' });
  r.act(r.host, 'pair', { playerId: players[0].id, partnerId: players[2].id });
  const members = () => r.view(r.host).cruel.teams.map((team) => team.members);
  const expected = members();
  r.start();
  r.phase = 'finished';
  returnToWaiting(r, r.host);
  assert.deepEqual(members(), expected);
  r.start();
  assert.deepEqual(members(), expected);
});

test('majority normal presenter cycles from random first seat; reads and restore do not redraw', () => {
  const { MajorityRoom } = require('../src/games/majority');
  let draws = 0;
  const r = new MajorityRoom('ABCDEF', 'friends', (n) => {
    draws++;
    return n === 3 ? 1 : 0;
  });
  const p = Array.from({ length: 3 }, (_, i) => r.add('P' + i));
  r.configure(r.host, { rounds: 4 });
  r.start();
  const before = draws;
  for (const index of [1, 2, 0, 1]) {
    assert.equal(r.presenterId, p[index].id);
    for (const player of p) r.view(player.id);
    const restored = restoreRoom(
      structuredClone(captureRoom(r)),
      () =>
        new MajorityRoom(r.code, r.name, () => {
          throw Error('redraw');
        }),
    ).room;
    assert.equal(restored.presenterId, r.presenterId);
    r.act(r.presenterId, 'ask', { type: 'two', prompt: '選哪個', options: ['A', 'B'] });
    p.forEach((player) => r.act(player.id, 'answer', { answer: 0 }));
    r.act(r.host, 'next');
  }
  assert.equal(draws, before);
});

for (const mode of ['majority', 'cruel', 'scenario', 'music'])
  test(
    'majority ' +
      mode +
      ': completion IDs are public, secrets stay private and reset next question',
    () => {
      const { MajorityRoom } = require('../src/games/majority');
      const r = new MajorityRoom('ABCDEF', 'friends', () => 0);
      const p = Array.from({ length: 3 }, (_, i) => r.add('P' + i));
      r.configure(r.host, {
        mode,
        rounds: 3,
        cruelRules: 'individual',
        theme: mode === 'music' ? 'all' : 'daily-mix',
        bracketSize: 8,
      });
      r.start();
      if (mode === 'majority')
        r.act(r.presenterId, 'ask', { type: 'two', prompt: '選哪個', options: ['A', 'B'] });
      const token = { questionId: r.question.id };
      r.act(p[0].id, 'answer', { answer: 1, ...token });
      const view = r.view(p[1].id);
      assert.deepEqual(view.answeredIds, [p[0].id]);
      assert.equal(view.ownAnswer, null);
      assert.equal(view.answers, undefined);
      assert.deepEqual(view.groups, []);
      assert.equal(view.result, null);
      r.act(p[0].id, 'withdraw', token);
      assert.deepEqual(r.view(p[1].id).answeredIds, []);
      p.forEach((player) => r.act(player.id, 'answer', { answer: 0, ...token }));
      r.act(r.host, 'next', { round: r.round, ...token });
      assert.deepEqual(r.view(p[1].id).answeredIds, []);
    },
  );
