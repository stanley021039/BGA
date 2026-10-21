'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { MajorityRoom } = require('../src/games/majority');
const { QUESTIONS, TOPICS } = require('../src/games/majority-questions');
const { SCENARIOS, SCENARIO_BANKS } = require('../src/games/majority-scenarios');
function room(n = 3, mode = 'scenario', size = 8) {
  const r = new MajorityRoom('ABCDEF', 'tournament', () => 0);
  for (let i = 0; i < n; i++) r.add('P' + i);
  r.configure(r.host, { mode, theme: mode === 'music' ? 'all' : 'work', bracketSize: size });
  return r;
}
function vote(r, answers) {
  const questionId = r.question.id;
  answers.forEach((answer, i) => r.act(r.players[i].id, 'answer', { questionId, answer }));
}
test('scenario banks have original distinct options and no fabricated source votes', () => {
  assert.equal(SCENARIO_BANKS.length, 10);
  assert.equal(SCENARIOS.length, 416);
  assert.equal(new Set(SCENARIOS.map((x) => x.id)).size, 416);
  for (const b of SCENARIO_BANKS) {
    const rows = SCENARIOS.filter((x) => x.bank === b.id);
    assert.equal(rows.length, ['couples', 'relationship', 'powers'].includes(b.id) ? 64 : 32);
    assert.equal(
      new Set(rows.map((x) => x.label)).size,
      ['couples', 'relationship', 'powers'].includes(b.id) ? 64 : 32,
    );
  }
  for (const x of SCENARIOS) {
    assert.equal(x.sourceWinRate, null);
    assert.ok(x.label.length <= 60);
  }
});
test('normal builtins, provider, direct asking and queue cannot import special mode banks', () => {
  assert.ok(!TOPICS.some((x) => ['music', 'scenario', 'cruel'].includes(x.id)));
  assert.ok(QUESTIONS.every((x) => !['music', 'scenario', 'cruel'].includes(x.topic)));
  const r = new MajorityRoom('N', 'normal', () => 0);
  for (let i = 0; i < 3; i++) r.add('p' + i);
  r.start();
  r.questionProvider = () => [
    { id: 'cruel-two-001', topic: 'daily', type: 'two', prompt: 'x', options: ['a', 'b'] },
    { id: 'scenario-work-001', topic: 'daily', type: 'two', prompt: 'y', options: ['a', 'b'] },
    { id: 'hidden', topic: 'music', type: 'two', prompt: 'z', options: ['a', 'b'] },
  ];
  for (const topic of ['music', 'scenario', 'cruel']) {
    assert.throws(() => r.draw({ topic, type: 'two' }));
    assert.throws(() =>
      r.act(r.host, 'enqueue', { topic, type: 'two', prompt: 'x', options: ['a', 'b'] }),
    );
  }
  for (const questionId of ['cruel-two-001', 'scenario-work-001', 'hidden']) {
    assert.throws(() => r.ask({ questionId }));
    assert.throws(() => r.act(r.host, 'enqueue', { questionId }));
  }
  r.draw({ topic: 'daily', type: 'two' });
  assert.ok(r.candidates.every((x) => !x.id.startsWith('cruel-') && !x.id.startsWith('scenario-')));
});
test('configuration is host-only, atomic, validates available themes and 8/16/32 bracket sizes', () => {
  const available = require('../src/games/majority-tournament').pool('music', 'classical').length,
    tooLarge = [8, 16, 32, 64, 128, 256].find((n) => n > available);
  assert.ok(tooLarge);
  const r = room();
  for (const data of [
    { mode: 'scenario', theme: 'bad' },
    { mode: 'scenario', bracketSize: 7 },
    { mode: 'music', theme: 'classical', bracketSize: tooLarge },
  ]) {
    const old = JSON.stringify(r.options);
    assert.throws(() => r.configure(r.host, data));
    assert.equal(JSON.stringify(r.options), old);
  }
  assert.throws(() => r.configure(r.players[1].id, { mode: 'music' }));
  const two = room(2);
  assert.throws(() => two.start());
  r.start();
  assert.throws(() => r.configure(r.host, { mode: 'majority', rounds: 3 }));
});
test('secret votes earn majority +1 in EVERY match; champion and tied player champions both survive finish', () => {
  const r = room();
  r.start();
  const seen = new Set(),
    advancers = new Set();
  for (let i = 0; i < 7; i++) {
    assert.equal(r.phase, 'answering');
    assert.equal(r.question.entries.length, 2);
    seen.add(r.question.id);
    r.act(r.players[0].id, 'answer', { questionId: r.question.id, answer: 0 });
    const v = r.view(r.players[1].id);
    assert.equal(v.answers, undefined);
    assert.equal(v.result, null);
    assert.equal(v.ownAnswer, null);
    assert.equal(v.tournament.entryRanking.length, 0);
    assert.ok(!JSON.stringify(v).includes('eliminated'));
    for (const action of ['draw', 'ask', 'enqueue', 'unqueue', 'pass'])
      assert.throws(() => r.act(r.host, action, {}));
    r.act(r.players[1].id, 'answer', { questionId: r.question.id, answer: 0 });
    r.act(r.players[2].id, 'answer', { questionId: r.question.id, answer: 1 });
    assert.deepEqual(
      r.players.map((x) => x.score),
      [i + 1, i + 1, 0],
    );
    assert.deepEqual(Object.values(r.result.gains), [1, 1, 0]);
    assert.equal(r.result.tournament.decidedBy, 'votes');
    advancers.add(r.result.tournament.advanced.id);
    const oldScore = r.players[0].score;
    assert.throws(() => r.score());
    assert.equal(r.players[0].score, oldScore);
    r.act(r.host, 'next');
  }
  const v = r.view(r.host);
  assert.equal(r.phase, 'finished');
  assert.equal(seen.size, 7);
  assert.equal(r.results.length, 7);
  assert.equal(v.tournament.champion.id, r.result.tournament.advanced.id);
  assert.equal(v.tournament.entryRanking.length, 8);
  assert.deepEqual(
    v.tournament.entryRanking.map((x) => x.rank),
    [1, 2, 3, 3, 5, 5, 5, 5],
  );
  assert.deepEqual(
    v.winner.ids,
    r.players.slice(0, 2).map((x) => x.id),
  );
  assert.deepEqual(
    v.tournament.ranking.map((x) => x.rank),
    [1, 1, 3],
  );
  r.start();
  assert.equal(r.round, 1);
  assert.equal(r.tournamentState.eliminated.length, 0);
  assert.equal(r.tournamentState.champion, null);
  assert.ok(r.players.every((x) => x.score === 0));
});
test('ties advance by announced draw without giving points, timeout empty cannot manufacture champion', () => {
  const r = room(4);
  r.start();
  vote(r, [0, 1, 0, 1]);
  assert.ok(r.players.every((x) => x.score === 0));
  assert.equal(r.result.tournament.tied, true);
  assert.equal(r.result.tournament.decidedBy, 'draw');
  assert.deepEqual(r.result.tournament.counts, [2, 2]);
  r.act(r.host, 'next');
  const deadline = r.deadline;
  assert.throws(() => r.act(r.host, 'close'), /投票/);
  assert.equal(r.phase, 'answering');
  assert.equal(r.deadline, deadline);
  assert.equal(r.tournamentState.eliminated.length, 1);
  r.deadline = Date.now() - 1;
  r.auto();
  assert.equal(r.phase, 'answering');
  assert.ok(r.deadline > Date.now());
  assert.equal(r.tournamentState.eliminated.length, 1);
  r.act(r.players[0].id, 'answer', { questionId: r.question.id, answer: 1 });
  r.deadline = Date.now() - 1;
  r.auto();
  assert.equal(r.phase, 'reveal');
  assert.equal(r.result.missingIds.length, 3);
  assert.equal(r.players[0].score, 1);
});
test('stale votes are rejected, late joiners wait a question and regular mode restart clears bracket', () => {
  const r = room();
  r.start();
  const old = r.question.id;
  vote(r, [0, 0, 1]);
  r.act(r.host, 'next');
  assert.throws(() => r.act(r.players[0].id, 'answer', { questionId: old, answer: 0 }), /更新/);
  assert.equal(Object.keys(r.answers).length, 0);
  const p = r.add('late');
  assert.throws(() => r.act(p.id, 'answer', { questionId: r.question.id, answer: 0 }));
  vote(r, [0, 0, 1]);
  r.act(r.host, 'next');
  assert.ok(r.participantIds.includes(p.id));
  while (r.phase !== 'finished') {
    if (r.phase === 'answering')
      for (const id of r.participantIds)
        r.act(id, 'answer', { questionId: r.question.id, answer: 0 });
    if (r.phase === 'reveal') r.act(r.host, 'next');
  }
  r.configure(r.host, { mode: 'majority', rounds: 3 });
  r.start();
  assert.equal(r.phase, 'choosing');
  assert.equal(r.view(r.host).tournament, null);
  assert.equal(r.tournamentState, null);
});
test('16/32 brackets finish exactly N−1 matches and music themes reuse human catalog only', () => {
  for (const size of [16, 32]) {
    const r = room(3, 'scenario', size);
    r.start();
    for (let i = 0; i < size - 1; i++) {
      vote(r, [1, 0, 1]);
      r.act(r.host, 'next');
    }
    assert.equal(r.phase, 'finished');
    assert.equal(r.results.length, size - 1);
    assert.equal(r.view(r.host).tournament.entryRanking.length, size);
  }
  const r = room(3, 'music', 8);
  r.start();
  assert.ok(
    r.question.entries.every(
      (s) => s.videoId && s.detail && s.source.startsWith('https://www.youtube.com/'),
    ),
  );
  assert.ok(r.view(r.host).tournament.themes.some((x) => x.id === 'jp'));
});

test('large random brackets sample distinct candidates and complete exactly N minus one matches', () => {
  for (const size of [64, 128, 256]) {
    const r = room();
    r.configure(r.host, { mode: 'scenario', theme: 'daily-mix', bracketSize: size });
    r.start();
    assert.equal(new Set(r.tournamentState.level.map((e) => e.id)).size, size);
    assert.ok(r.tournamentState.level.every((e) => e.bank !== 'powers'));
    for (let i = 0; i < size - 1; i++) {
      vote(r, [0, 1, 0]);
      r.act(r.host, 'next');
    }
    assert.equal(r.phase, 'finished');
    assert.equal(r.results.length, size - 1);
    assert.equal(r.view(r.host).tournament.entryRanking.length, size);
    assert.deepEqual(
      r.players.map((p) => p.score),
      [size - 1, 0, size - 1],
    );
  }
});
