'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DrawGuessRoom } = require('../src/games/draw-guess');

test('three players seated before starting each get one turn for every possible starter', () => {
  for (let first = 0; first < 3; first++) {
    let now = 1000;
    const room = new DrawGuessRoom(
      'ABC123',
      '三人三輪',
      () => first,
      () => now,
    );
    const players = ['甲', '乙', '丙'].map((name) => room.add(name));
    room.start();
    const artists = [];
    for (let round = 1; round <= 3; round++) {
      assert.equal(room.phase, 'choosing');
      assert.equal(room.round, round);
      assert.equal(room.roundLimit, 3);
      assert.equal(room.presenterId, players[(first + round - 1) % 3].id);
      artists.push(room.presenterId);
      room.choose(room.presenterId, room.candidates[0].id);
      for (const player of players.filter((p) => p.id !== room.presenterId)) {
        now += 800;
        room.guess(player.id, room.question.title);
      }
      assert.equal(room.phase, 'reveal', 'correct guesses reveal before the next turn');
      room.next(room.host);
    }
    assert.equal(room.phase, 'finished');
    assert.equal(new Set(artists).size, 3);
    assert.equal(room.results.length, 3);
    assert.equal(room.matchSummary.rounds, 3);
  }
});

test('fixed questions keep the randomized artist rotation across timeout, reload and replay', () => {
  let now = 1000;
  const room = new DrawGuessRoom(
    'ABC123',
    '輪次回歸',
    () => 1,
    () => now,
  );
  const players = ['甲', '乙', '丙'].map((name) => room.add(name));
  room.configure(room.host, { seconds: 60, ending: { mode: 'rounds', value: 8 } });
  const touch = () =>
    players.forEach((p) => {
      p.lastSeen = now;
    });
  for (let match = 0; match < 2; match++) {
    room.start();
    for (let round = 1; round <= 8; round++) {
      touch();
      const artist = players[round % 3];
      assert.equal(room.round, round);
      assert.equal(room.presenterId, artist.id);
      assert.equal(room.phase, 'choosing');
      const before = room.view(artist.id);
      assert.equal(room.view(artist.id).round, before.round, 'reload is a read');
      assert.equal(room.roundLimit, 8);
      room.choose(artist.id, room.candidates[0].id);
      now = room.deadline;
      touch();
      assert.equal(room.auto(), true);
      assert.equal(room.phase, round === 8 ? 'finished' : 'reveal');
      assert.equal(room.auto(), false, 'same deadline does not advance twice');
      if (round < 8) {
        now = room.deadline;
        touch();
        assert.equal(room.auto(), true);
        assert.equal(room.auto(), false, 'new choosing deadline is respected');
      }
    }
    assert.equal(room.results.length, 8);
    assert.equal(room.matchSummary.rounds, 8);
  }
});
