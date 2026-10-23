'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto'),
  { MusicQuizRoom } = require('../src/games/musicquiz'),
  { normalize } = require('../src/games/party-base');
function setup(n = 2) {
  let now = 100000;
  const r = new MusicQuizRoom(
      'CHOICE',
      'test',
      () => 0,
      () => now,
    ),
    p = Array.from({ length: n }, (_, i) => r.add('p' + i));
  r.start();
  return {
    r,
    p,
    tick(ms) {
      now += ms;
    },
  };
}
const act = (r, p, a, data = {}) =>
  r.act(p.id, a, { roundId: r.roundId, requestId: randomUUID(), ...data });
function resolve(r, p) {
  if (r.phase === 'intro') {
    for (const q of p) if (!r.answers[q.id]) act(r, q, 'guess', { pass: true });
  }
  const slot = Array.from({ length: r.dj().timeline.length + 1 }, (_, i) => i).find((i) =>
    r.correct(i),
  );
  act(r, r.dj(), 'place', { slot });
  for (const q of p) if (q !== r.dj()) act(r, q, 'pass');
}
test('six unique opaque song-title options are stable, shared, and reveal neither artist nor correctness', () => {
  const { r, p } = setup();
  assert.deepEqual(r.view(p[0].id).introChoices, []);
  act(r, r.dj(), 'listen');
  const a = r.view(p[0].id),
    b = r.view(p[1].id);
  assert.equal(a.introChoices.length, 6);
  assert.equal(new Set(a.introChoices.map((x) => normalize(x.title))).size, 6);
  assert.deepEqual(a.introChoices, b.introChoices);
  assert.deepEqual(a.introChoices, r.view(p[0].id).introChoices);
  assert.equal(a.introChoices.filter((x) => x.title === r.current.title).length, 1);
  for (const x of a.introChoices) {
    assert.deepEqual(Object.keys(x).sort(), ['id', 'language', 'title']);
    assert.notEqual(x.id, r.current.id);
  }
  assert.equal(a.correctChoiceId, undefined);
  assert.equal(a.song, null);
});
test('correct choice scores once on reveal; wrong answer gets zero; player answers stay private', () => {
  const { r, p } = setup();
  act(r, r.dj(), 'listen');
  const wrong = r.introChoices.find((c) => c.id !== r.correctChoiceId).id;
  const data = { roundId: r.roundId, requestId: randomUUID(), choiceId: r.correctChoiceId };
  r.act(p[0].id, 'guess', data);
  r.act(p[0].id, 'guess', data);
  assert.equal(p[0].bonus, 0);
  assert.equal(r.view(p[1].id).myAnswer, null);
  assert.equal(r.view(p[1].id).answers, undefined);
  assert.throws(
    () => act(r, p[0], 'guess', { choiceId: wrong }),
    (e) => e.code === 'ALREADY_SUBMITTED',
  );
  act(r, p[1], 'guess', { choiceId: wrong });
  resolve(r, p);
  assert.equal(p[0].bonus, 1);
  assert.equal(p[0].tokens, 3);
  assert.equal(p[1].bonus, 0);
  assert.equal(p[1].tokens, 2);
  assert.equal(r.results[0].answers[0].bonus, 1);
  assert.equal(r.results[0].answers[1].bonus, 0);
});
test('free text, fabricated choice IDs and previous-round requests cannot earn points', () => {
  const { r, p } = setup();
  act(r, r.dj(), 'listen');
  for (const data of [
    { text: r.current.title, artist: r.current.artist },
    { choiceId: r.current.id },
    { choiceId: 'invented' },
  ])
    assert.throws(
      () => act(r, p[0], 'guess', data),
      (e) => e.code === 'INVALID_CHOICE',
    );
  assert.deepEqual(r.answers, {});
  const oldRound = r.roundId,
    oldChoice = r.correctChoiceId;
  for (const q of p) act(r, q, 'guess', { pass: true });
  resolve(r, p);
  act(r, r.dj(), 'next');
  act(r, r.dj(), 'listen');
  assert.throws(
    () =>
      r.act(p[0].id, 'guess', { roundId: oldRound, requestId: randomUUID(), choiceId: oldChoice }),
    (e) => e.code === 'STALE_ROUND',
  );
  assert.throws(
    () => act(r, p[0], 'guess', { choiceId: oldChoice }),
    (e) => e.code === 'INVALID_CHOICE',
  );
});
test('tiny custom pools still offer six choices, token cap and timeout preserve flow', () => {
  const { r } = setup(1);
  const custom = new MusicQuizRoom('CUSTOM', 'custom', () => 0),
    q = custom.add('p');
  custom.configure(q.id, {
    banks: ['custom'],
    customSongs: [0, 1, 2].map((i) => ({
      title: '自選' + i,
      artist: '自己',
      year: 2020,
      videoId: ['abcdefghijk', 'bcdefghijkl', 'cdefghijklm'][i],
      aiGenerated: false,
    })),
  });
  custom.start();
  act(custom, q, 'listen');
  assert.equal(custom.view(q.id).introChoices.length, 6);
  q.tokens = 5;
  act(custom, q, 'guess', { choiceId: custom.correctChoiceId });
  resolve(custom, [q]);
  assert.equal(q.tokens, 5);
  assert.equal(q.bonus, 1);
  const timed = setup();
  act(timed.r, timed.r.dj(), 'listen');
  timed.tick(30000);
  assert.equal(timed.r.auto(), true);
  resolve(timed.r, timed.p);
  assert.ok(timed.p.every((p) => p.bonus === 0));
  assert.deepEqual(r.view(r.players[0].id).introChoices, []);
});
