'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DecryptoRoom, CODES } = require('../src/games/decrypto');
const { WORDS } = require('../src/games/decrypto-catalog');
const { spectatorView } = require('../src/rooms/spectator');
const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
const { returnToWaiting } = require('../src/rooms/rematch');
const { switchGame } = require('../src/rooms/game-switch');
const { rejoinPlayer } = require('../src/rooms/membership');
const { BluffRoom } = require('../src/games/bluff');
const { createTutorials } = require('../src/tutorials/runtime');
const ai = require('../src/ai');
function make(count = 4) {
  const r = new DecryptoRoom('ABCDEF', '生活截碼', (n) => 0);
  for (let i = 0; i < count; i++) r.add('玩家' + i);
  return r;
}
function act(r, id, action, data = {}) {
  const input = { roundId: r.roundId, turn: r.turn, requestId: randomUUID(), ...data };
  r.act(id, action, input);
  return input;
}
function submitClues(r) {
  for (let t = 0; t < 2; t++)
    act(r, r.encryptors[t], 'clues', {
      clues: [0, 1, 2].map((i) => `線索組${r.round}隊${t}條${i}`),
    });
}
const wrong = (c) => [c[1], c[0], c[2]];
function guessTurn(r, { decode = true, intercept = false } = {}) {
  const t = r.turn;
  if (r.round > 1)
    act(r, r.decoders[1 - t], 'intercept', { digits: intercept ? r.codes[t] : wrong(r.codes[t]) });
  act(r, r.decoders[t], 'decode', { digits: decode ? r.codes[t] : wrong(r.codes[t]) });
}
function round(r, values = [{}, {}]) {
  submitClues(r);
  guessTurn(r, values[0]);
  act(r, r.host, 'next');
  guessTurn(r, values[1]);
  act(r, r.host, 'next');
}
test('everyday original vocabulary is unique and contains familiar childhood objects; all 24 codes are valid', () => {
  assert.ok(WORDS.length >= 300);
  assert.equal(new Set(WORDS).size, WORDS.length);
  for (const word of [
    '紅白機',
    '卡帶',
    '錄影帶',
    '隨身聽',
    '彈珠',
    '尪仔標',
    '福利社',
    '泡麵',
    '珍珠奶茶',
  ])
    assert.ok(WORDS.includes(word), word);
  assert.equal(CODES.length, 24);
  assert.equal(new Set(CODES.map(JSON.stringify)).size, 24);
  for (const c of CODES) {
    assert.equal(new Set(c).size, 3);
    assert.ok(c.every((n) => n >= 1 && n <= 4));
  }
});
test('teams have 2–4 members, can switch only before play, and rejoining repairs membership', () => {
  const r = make();
  assert.deepEqual(
    r.teams.map((t) => t.members.length),
    [2, 2],
  );
  act(r, r.players[0].id, 'team', { team: 1 });
  assert.throws(() => r.start(), { code: 'NEED_TEAMS' });
  act(r, r.players[0].id, 'team', { team: 0 });
  r.start();
  assert.throws(() => act(r, r.host, 'team', { team: 1 }), { code: 'MATCH_STARTED' });
  r.kick(r.host, r.players[3].id);
  assert.equal(r.interrupted, true);
  assert.equal(r.winner, null);
  const p = r.add('新玩家');
  assert.equal(r.teamOf(p.id), 1);
  r.kick(r.host, p.id);
  const old = r.players[3];
  rejoinPlayer(r, old.id, old.name);
  assert.ok(r.teamOf(old.id) >= 0);
  const full = make(8);
  assert.throws(() => act(full, full.host, 'team', { team: 1 }), { code: 'TEAM_FULL' });
  assert.throws(() => full.add('overflow'), { code: 'ROOM_FULL' });
});
test('private keywords, encryptor codes and unannounced black clues never reach peers or observers', () => {
  const r = make();
  r.start();
  const [a, b] = r.encryptors,
    decoder = r.decoders[0];
  assert.deepEqual(r.view(a).secretCode, [1, 2, 3]);
  assert.equal(r.view(decoder).secretCode, null);
  assert.deepEqual(r.view(a).keywords[1], []);
  assert.deepEqual(r.view(b).keywords[0], []);
  act(r, b, 'clues', { clues: ['密封黑線甲', '密封黑線乙', '密封黑線丙'] });
  assert.equal(r.view(a).clues[1], null);
  assert.equal(r.view(r.decoders[1]).clues[1], null);
  act(r, a, 'clues', { clues: ['白線甲', '白線乙', '白線丙'] });
  assert.equal(r.view(a).clues[1], null);
  const outsider = JSON.stringify(spectatorView(r));
  for (const w of r.keywords.flat()) assert.ok(!outsider.includes(w));
  assert.ok(!outsider.includes('密封黑線'));
  const v = r.view(a);
  v.keywords[0][0] = 'corrupt';
  v.teams[0].members = [];
  assert.notEqual(r.keywords[0][0], 'corrupt');
  assert.equal(r.teams[0].members.length, 2);
  assert.throws(() => r.view('outsider'), { code: 'NOT_SEATED' });
});
test('invalid inputs/actors do not mutate state; duplicate and stale requests cannot advance another turn', () => {
  const r = make();
  r.start();
  const before = JSON.stringify(r.view(r.host));
  assert.throws(() => act(r, r.decoders[0], 'clues', { clues: ['甲', '乙', '丙'] }), {
    code: 'ENCRYPTOR_ONLY',
  });
  for (const clues of [
    ['', '', ''],
    ['甲', '甲', '丙'],
    ['甲\n乙', '丙', '丁'],
    [r.keywords[0][0], '甲', '乙'],
    ['甲', '乙'],
    [1, 2, 3],
  ])
    assert.throws(() => act(r, r.host, 'clues', { clues }));
  assert.equal(JSON.stringify(r.view(r.host)), before);
  submitClues(r);
  assert.throws(() => act(r, r.decoders[1], 'intercept', { digits: [1, 2, 3] }), {
    code: 'NO_FIRST_INTERCEPTION',
  });
  assert.throws(() => act(r, r.host, 'decode', { digits: [1, 2, 3] }), { code: 'DECODER_ONLY' });
  for (const code of [
    [1, 1, 2],
    [0, 2, 3],
    [1, 2],
    [1, 2, '3'],
  ])
    assert.throws(() => act(r, r.decoders[0], 'decode', { digits: code }), {
      code: 'INVALID_CODE',
    });
  guessTurn(r);
  const input = act(r, r.host, 'next');
  r.act(r.host, 'next', input);
  assert.equal(r.phase, 'guessing');
  assert.equal(r.turn, 1);
  guessTurn(r);
  assert.throws(() => act(r, r.host, 'next', { turn: 0 }), { code: 'STALE_TURN' });
  assert.equal(r.phase, 'reveal');
  act(r, r.host, 'next');
  assert.equal(r.round, 2);
  assert.deepEqual(r.codes[0], [1, 2, 3]); // draw-with-replacement
  assert.throws(() => r.act(r.host, 'next', input), { code: 'STALE_ROUND' });
});
test('first round has no interceptions; later guesses are sealed and each result is counted once', () => {
  const r = make();
  r.start();
  round(r);
  assert.equal(r.round, 2);
  assert.deepEqual(
    r.teams.map((t) => [t.interceptions, t.failures]),
    [
      [0, 0],
      [0, 0],
    ],
  );
  assert.equal(r.encryptors[0], r.players[2].id);
  submitClues(r);
  const input = act(r, r.decoders[1], 'intercept', { digits: r.codes[0] });
  assert.equal(r.phase, 'guessing');
  assert.equal(r.view(r.decoders[0]).myGuess, null);
  assert.equal(r.view(r.decoders[0]).results.length, 2);
  r.act(r.decoders[1], 'intercept', input);
  assert.throws(() => act(r, r.decoders[1], 'intercept', { digits: r.codes[0] }), {
    code: 'ALREADY_SUBMITTED',
  });
  act(r, r.decoders[0], 'decode', { digits: wrong(r.codes[0]) });
  assert.equal(r.teams[1].interceptions, 1);
  assert.equal(r.teams[0].failures, 1);
  r.act(r.decoders[1], 'intercept', input);
  assert.equal(r.teams[1].interceptions, 1);
  assert.equal(r.results.length, 3);
  assert.deepEqual(r.view(r.host).history[0][0], ['線索組1隊0條0', '線索組2隊0條0']);
});
test('two failures or interceptions finish only after both transmissions of that round', () => {
  const r = make();
  r.start();
  round(r, [{ decode: false }, {}]);
  submitClues(r);
  guessTurn(r, { decode: false });
  assert.equal(r.teams[0].failures, 2);
  assert.equal(r.phase, 'reveal');
  assert.equal(r.winner, null);
  act(r, r.host, 'next');
  guessTurn(r);
  act(r, r.host, 'next');
  assert.equal(r.phase, 'finished');
  assert.deepEqual(r.winner.teams, [1]);
  const q = make();
  q.start();
  round(q);
  round(q, [{ intercept: true }, {}]);
  round(q, [{ intercept: true }, {}]);
  assert.deepEqual(q.winner.teams, [1]);
});
test('eight rounds, net score tiebreak, keyword comparison without order/duplicates and shared wins', () => {
  const r = make();
  r.start();
  for (let i = 0; i < 8; i++) round(r);
  assert.equal(r.round, 8);
  assert.equal(r.phase, 'tiebreak');
  const guesses = [r.keywords[1][2], r.keywords[1][0], r.keywords[1][0], ''];
  act(r, r.decoders[0], 'keywords', { words: guesses });
  assert.deepEqual(r.view(r.decoders[1]).tieGuesses, {});
  assert.deepEqual(r.view(r.decoders[1]).keywords[0], []);
  act(r, r.decoders[1], 'keywords', { words: [r.keywords[0][0], '', '', ''] });
  assert.equal(r.phase, 'finished');
  assert.deepEqual(r.winner.teams, [0]);
  assert.deepEqual(r.winner.keywordHits, [2, 1]);
  assert.equal(r.view(r.host).keywords[1].length, 4);
  for (const [counters, expected] of [
    [
      [
        [2, 2],
        [1, 0],
      ],
      [1],
    ],
    [
      [
        [2, 0],
        [2, 1],
      ],
      [0],
    ],
    [
      [
        [0, 2],
        [0, 2],
      ],
      null,
    ],
  ]) {
    const q = make();
    q.start();
    q.teams.forEach((t, i) => {
      [t.interceptions, t.failures] = counters[i];
    });
    q.resolveRound();
    if (expected) assert.deepEqual(q.winner.teams, expected);
    else {
      assert.equal(q.phase, 'tiebreak');
      for (let t = 0; t < 2; t++) act(q, q.decoders[t], 'keywords', { words: ['', '', '', ''] });
      assert.deepEqual(q.winner.teams, [0, 1]);
    }
  }
});
test('published clues cannot be repeated, and a restart preserves private state plus receipts', () => {
  const r = make();
  r.start();
  round(r);
  assert.throws(
    () => act(r, r.encryptors[0], 'clues', { clues: ['線索組1隊0條0', '新甲', '新乙'] }),
    { code: 'INVALID_CLUES' },
  );
  submitClues(r);
  const input = act(r, r.decoders[1], 'intercept', { digits: [1, 2, 3] });
  const saved = require('node:v8').deserialize(require('node:v8').serialize(captureRoom(r)));
  const restored = restoreRoom(saved, (s) => new DecryptoRoom(s.code, s.name, (n) => 0)).room;
  assert.deepEqual(restored.view(restored.host), r.view(r.host));
  restored.act(restored.decoders[1], 'intercept', input);
  assert.equal(restored.results.length, 2);
});
test('rematch and game switch preserve seat identities and reset secrets/teams', () => {
  const r = make();
  r.start();
  r.kick(r.host, r.players[3].id);
  const ids = r.activePlayers().map((p) => p.id);
  returnToWaiting(r, r.host);
  assert.deepEqual(
    r.activePlayers().map((p) => p.id),
    ids,
  );
  assert.ok(r.activePlayers().every((p) => r.teamOf(p.id) >= 0));
  assert.deepEqual(r.keywords, [[], []]);
  const b = new BluffRoom('ABABAB', 'switch', (n) => 0);
  for (let i = 0; i < 4; i++) b.add('P' + i);
  const d = switchGame(b, b.host, 'decrypto', { decrypto: DecryptoRoom });
  assert.deepEqual(
    d.teams.map((t) => t.members.length),
    [2, 2],
  );
  assert.equal(d.host, b.host);
  d.start();
});
test('practice AI and independent tutorial complete both first-round decoding and second-round interception', () => {
  const t = createTutorials({ rng: (n) => 0 });
  let v = t.start('owner', 'decrypto');
  assert.equal(v.snapshot.players.length, 4);
  assert.throws(() => t.state('other', v.id));
  let observed = 0;
  for (let i = 0; i < 50 && !v.done; i++) {
    if (v.snapshot.round === 2 && v.snapshot.phase === 'guessing') observed++;
    v = t.apply('owner', { id: v.id, revision: v.revision, requestId: randomUUID() });
  }
  assert.equal(v.done, true);
  assert.ok(observed > 0);
  assert.equal(v.snapshot.round, 2);
  assert.equal(v.snapshot.results.length, 4);
  const r = make(8);
  r.start();
  assert.equal(ai.botSupport(r).supported, true);
});
