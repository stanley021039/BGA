'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { MusicQuizRoom } = require('../src/games/musicquiz'),
  { CATALOG } = require('../src/games/musicquiz-library');
const act = (r, p, action, data = {}) =>
  r.act(p.id, action, { roundId: r.roundId, requestId: randomUUID(), ...data });
function setup(n = 2) {
  let now = Date.parse('2026-10-16T10:00:00Z');
  const r = new MusicQuizRoom(
      'ABCDEF',
      'time',
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
function timeline(r, p, answers = false) {
  act(r, r.dj(), 'listen');
  for (const q of p) act(r, q, 'guess', answers ? { choiceId: r.correctChoiceId } : { pass: true });
  assert.equal(r.phase, 'timeline');
}
test('all published songs have human origin, metadata identity and playable descriptors, with eight selectable song banks', () => {
  assert.ok(CATALOG.length >= 100);
  assert.equal(new Set(CATALOG.map((s) => s.id)).size, CATALOG.length);
  for (const s of CATALOG) {
    assert.equal(s.aiGenerated, false);
    assert.match(s.videoId, /^[\w-]{11}$/);
    assert.ok(s.metadataTitle && s.metadataAuthor);
    assert.ok(Number.isInteger(s.year));
    assert.ok(s.genres.length);
    assert.ok(s.highlightStart >= 0);
  }
  assert.equal(new Set(CATALOG.map((s) => s.bank)).size, 10);
});
test('start creates private shuffled deck, revealed anchors and random DJ independent from room management', () => {
  const { r, p } = setup();
  assert.equal(r.phase, 'pick');
  const v = r.view(p[0].id);
  assert.equal(v.song, null);
  assert.equal(v.playback, null);
  assert.ok(!JSON.stringify(v).includes('sequence'));
  assert.ok(!JSON.stringify(v).includes('secret'));
  assert.ok(p.every((q) => q.timeline.length === 1 && q.tokens === 2));
  assert.equal(new Set(r.sequence.map((s) => s.id)).size, r.sequence.length);
  const other = new MusicQuizRoom('AAAAAA', 'random', (n) => n - 1);
  other.add('one');
  other.add('two');
  other.start();
  assert.equal(other.dj().name, 'two');
  assert.equal(other.host, other.players[0].id);
});
test('choice bonus stays secret until reveal; positions determine cards, not bonus points', () => {
  const { r, p } = setup();
  timeline(r, p, true);
  assert.equal(p[0].bonus, 0);
  assert.equal(r.view(p[1].id).song, null);
  assert.equal(r.view(p[1].id).myAnswer.text, r.current.title);
  const correct = Array.from({ length: r.dj().timeline.length + 1 }, (_, i) => i).find((i) =>
    r.correct(i),
  );
  act(r, r.dj(), 'place', { slot: correct });
  for (const q of p) if (q !== r.dj()) act(r, q, 'pass');
  assert.equal(r.phase, 'reveal');
  assert.equal(r.dj().score, 2);
  for (const q of p) {
    assert.equal(q.bonus, 1);
    assert.equal(q.tokens, 3);
  }
  assert.equal(r.results[0].answers[0].bonus, 1);
});
test('same-year songs accept both adjacent slots; invalid and unauthorized placements preserve state', () => {
  const { r, p } = setup();
  timeline(r, p);
  r.current = { ...r.current, year: r.dj().timeline[0].year };
  assert.equal(r.correct(0), true);
  assert.equal(r.correct(1), true);
  assert.throws(
    () => act(r, p[1], 'place', { slot: 0 }),
    (e) => e.code === 'DJ_ONLY',
  );
  assert.throws(
    () => act(r, p[0], 'place', { slot: NaN }),
    (e) => e.code === 'INVALID_SLOT',
  );
  assert.equal(r.phase, 'timeline');
});
test('challenge uses one token, first correct challenger wins only when DJ is wrong', () => {
  const { r, p } = setup(3);
  timeline(r, p);
  r.dj().timeline = [{ ...r.dj().timeline[0], year: 2000 }];
  r.current = { ...r.current, year: 1990 };
  act(r, p[0], 'place', { slot: 1 });
  const data = { roundId: r.roundId, requestId: randomUUID(), slot: 0 };
  r.act(p[1].id, 'challenge', data);
  r.act(p[1].id, 'challenge', data);
  assert.equal(p[1].tokens, 1);
  assert.throws(
    () => act(r, p[2], 'challenge', { slot: 0 }),
    (e) => e.code === 'INVALID_SLOT',
  );
  act(r, p[2], 'pass');
  assert.equal(r.results[0].receiverId, p[1].id);
  assert.equal(p[1].timeline.length, 2);
  assert.equal(p[0].timeline.length, 1);
});
test('deadline boundaries reject late input and scheduler auto advances without a connected host', () => {
  const { r, p, tick } = setup();
  act(r, p[0], 'listen');
  tick(30000);
  assert.throws(
    () => act(r, p[1], 'guess', { text: 'late' }),
    (e) => e.code === 'INVALID_PHASE',
  );
  assert.equal(r.auto(), true);
  assert.equal(r.phase, 'timeline');
  tick(60000);
  assert.equal(r.auto(), true);
  assert.equal(r.phase, 'challenge');
  tick(15000);
  assert.equal(r.auto(), true);
  assert.equal(r.phase, 'reveal');
  assert.equal(r.auto(), false);
});
test('cut/buy token costs and before-listening gate cannot be bypassed; ten-card victory remains distinct', () => {
  const { r, p } = setup();
  const old = r.roundId;
  act(r, p[0], 'skip');
  assert.equal(p[0].tokens, 1);
  assert.notEqual(r.roundId, old);
  p[1].tokens = 3;
  act(r, p[1], 'buy');
  assert.equal(p[1].tokens, 0);
  assert.equal(p[1].timeline.length, 2);
  act(r, p[0], 'listen');
  p[1].tokens = 3;
  assert.throws(
    () => act(r, p[1], 'buy'),
    (e) => e.code === 'INVALID_PHASE',
  );
  for (const q of p) act(r, q, 'guess', { pass: true });
  r.dj().timeline = Array.from({ length: 9 }, () => ({ ...r.dj().timeline[0], year: 1600 }));
  r.current = { ...r.current, year: 2000 };
  act(r, p[0], 'place', { slot: 9 });
  act(r, p[1], 'pass');
  assert.equal(r.phase, 'finished');
  assert.deepEqual(r.winner.names, [p[0].name]);
  assert.equal(r.winner.score, 10);
});
test('cold songs opt in and remain under 10%; AI songs, malformed sources and partial settings are rejected atomically', () => {
  const r = new MusicQuizRoom('ABCDEF', 'settings', () => 0);
  const p = r.add('host');
  assert.equal(r.settings.obscure, false);
  assert.ok(r.pool().every((s) => s.familiarity !== 'obscure'));
  const before = JSON.stringify(r.settings);
  assert.throws(() => r.configure(p.id, { banks: ['en'], target: 999 }));
  assert.equal(JSON.stringify(r.settings), before);
  for (const song of [
    { title: 'song', artist: 'artist', year: 2020, videoId: 'JGwWNGJdvx8', aiGenerated: true },
    {
      title: 'song',
      artist: 'artist',
      year: 2020,
      videoId: 'https://evil.test',
      aiGenerated: false,
    },
  ])
    assert.throws(
      () => r.configure(p.id, { customSongs: [song] }),
      (e) => e.code === 'INVALID_SONGS',
    );
  r.configure(p.id, { banks: ['classical', 'en'], obscure: true });
  r.start();
  const rare = r.sequence.filter((s) => s.familiarity === 'obscure');
  assert.ok(rare.length / r.sequence.length <= 0.1);
});
test('deck exhaustion ends match with collected cards, results survive, and departure interrupts cleanly', () => {
  const { r, p } = setup(1);
  r.sequence = r.sequence.slice(0, r.cursor);
  timeline(r, p);
  act(r, p[0], 'place', { slot: 0 });
  act(r, p[0], 'next');
  assert.equal(r.phase, 'finished');
  assert.equal(r.results.length, 1);
  r.start();
  r.kick(p[0].id, p[0].id, true);
  assert.equal(r.phase, 'finished');
  assert.equal(r.interrupted, true);
  assert.equal(r.winner, null);
});
test('custom songs copy input, require explicit human-origin confirmation and support first/second clip points', () => {
  const r = new MusicQuizRoom('ABCDEF', 'custom', () => 0),
    p = r.add('host'),
    songs = CATALOG.slice(0, 3).map((s) => ({ ...s, introStart: 7, highlightStart: 85 }));
  r.configure(p.id, { banks: ['custom'], customSongs: songs });
  songs[0].title = 'mutated';
  r.start();
  assert.notEqual(r.current.title, 'mutated');
  act(r, p, 'listen');
  assert.equal(r.view(p.id).playback.start, 7);
  act(r, p, 'guess', { pass: true });
  assert.equal(r.view(p.id).playback.start, 85);
  assert.equal(r.view(p.id).customSongs.length, 0);
});
