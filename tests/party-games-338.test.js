'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { BrainwaveRoom, DramaBarRoom, brainwaveScoring } = require('../src/games/voice-party');
const { DrawGuessRoom } = require('../src/games/draw-guess');
const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
const { returnToWaiting } = require('../src/rooms/rematch');

function table(Type, count) {
  let now = 100;
  const room = new Type(
    'ABCDEF',
    '測試房間',
    () => 0,
    () => now,
  );
  const seats = Array.from({ length: count }, (_, index) => room.add('玩家' + index).id);
  const advance = () => {
    now = room.deadline;
    room.auto();
  };
  const action = (id, name, input = {}) =>
    room.act(id, name, {
      roundId: room.roundId || room.oracle?.roundId,
      requestId: randomUUID(),
      ...input,
    });
  return { room, seats, advance, action };
}

test('電波畫家私密作畫、換題、蓋牌排序、斷線恢復與計分', () => {
  const {
    room,
    seats: [lead, first, second],
    advance,
    action,
  } = table(BrainwaveRoom, 3);
  room.start();
  assert.equal(room.roundLimit, 12);
  assert.equal(room.view(first).question, null);
  assert.equal(room.view(lead).question.length, 5);
  action(lead, 'change-question');
  assert.throws(() => action(lead, 'change-question'), { code: 'INVALID_ACTION' });
  action(lead, 'ready');
  assert.equal(room.view(first).correct, null);
  assert.equal(room.view(lead).correct, 0);
  assert.throws(() => action(first, 'shape', { shape: { kind: 'unrestricted' } }), {
    code: 'INVALID_SHAPE',
  });
  action(lead, 'shape', { shape: { kind: 'triangle', x1: 0.2, y1: 0.1, x2: 0.7, y2: 0.8 } });
  assert.equal(room.view(lead).board.length, 1);
  assert.deepEqual(room.view(first).board, []);
  assert.equal(room.view(first).revealedBoards, null);
  const requestId = randomUUID();
  action(first, 'guess', { option: 0, requestId });
  action(first, 'guess', { option: 0, requestId });
  assert.equal(room.view(second).submissions, 1);
  assert.deepEqual(room.view(second).myGuesses, []);
  assert.throws(() => action(first, 'guess', { option: 0 }), { code: 'GUESS_UNAVAILABLE' });
  action(second, 'guess', { option: 1 });
  action(second, 'guess', { option: 0 });
  const saved = captureRoom(room);
  const { room: restored } = restoreRoom(saved, () => new BrainwaveRoom('ABCDEF', '測試房間'));
  assert.deepEqual(restored.view(second).myGuesses, [1, 0]);
  assert.equal(restored.view(first).revealedBoards, null);
  advance();
  assert.equal(room.phase, 'reveal');
  const reveal = room.view(first);
  assert.deepEqual(
    reveal.latest.guesses.map((guess) => guess.id),
    [second, second, first],
  );
  assert.deepEqual(reveal.latest.deltas, { [lead]: 1, [first]: 3, [second]: 1 });
  assert.equal(reveal.revealedBoards[lead].length, 1);
  const oldRound = room.roundId;
  action(lead, 'next');
  assert.throws(() => action(first, 'guess', { option: 0, roundId: oldRound }), {
    code: 'STALE_ROUND',
  });
});

test('電波畫家無人答對時照樣處理未出牌與骰子', () => {
  const seats = ['a', 'b', 'c'].map((id) => ({ id, score: 5 }));
  const guesses = [{ id: 'b', option: 2 }];
  assert.deepEqual(
    brainwaveScoring(seats, 'a', 0, guesses, () => 5),
    {
      deltas: { a: -2, b: 0, c: -2 },
      die: 5,
    },
  );
  assert.deepEqual(
    brainwaveScoring(seats, 'a', 0, guesses, () => 2),
    {
      deltas: { a: 0, b: 1, c: -2 },
      die: 2,
    },
  );
});

test('戲精酒吧只在交卷後揭曉，部分猜對、全錯與全對都能結算', () => {
  const {
    room,
    seats: [a, b, c],
    advance,
    action,
  } = table(DramaBarRoom, 3);
  room.start();
  assert.equal(room.view(b).correct, null);
  assert.equal(room.view(a).question.options.length, 6);
  assert.throws(() => action(b, 'guess', { option: 0 }), { code: 'CANNOT_GUESS' });
  action(a, 'performed');
  action(b, 'guess', { option: 0 });
  assert.equal(room.view(c).latest, null);
  action(c, 'guess', { option: 1 });
  assert.deepEqual(room.view(c).latest.penalized, [c]);
  action(a, 'next');
  action(b, 'performed');
  action(a, 'guess', { option: 1 });
  advance();
  assert.deepEqual(room.view(c).latest.penalized, [b]);
  action(a, 'next');
  action(c, 'performed');
  action(a, 'guess', { option: 0 });
  action(b, 'guess', { option: 0 });
  assert.equal(room.phase, 'finished');
  assert.deepEqual(room.view(c).latest.penalized, []);
  assert.deepEqual(room.winner.names, [room.player(a).name]);
  returnToWaiting(room, a);
  assert.equal(room.phase, 'waiting');
  assert.equal(room.view(a).question, null);
});

test('戲精酒吧同一句在新局重新抽六個情境，恢復房間時保留原選項和答案', () => {
  const {
    room,
    seats: [host, guest],
    advance,
    action,
  } = table(DramaBarRoom, 3);
  const { dramaQuestions } = require('../src/games/voice-party-questions');
  assert.equal(dramaQuestions.length, 32);
  assert.ok(
    dramaQuestions.every(({ options }) => options.length === 9 && new Set(options).size === 9),
  );
  room.start();
  const first = room.view(host);
  assert.equal(new Set(first.question.options).size, 6);
  assert.deepEqual(room.view(guest).question, first.question);
  assert.equal(room.view(guest).correct, null);
  const { room: restored } = restoreRoom(
    captureRoom(room),
    () => new DramaBarRoom('ABCDEF', '測試房間'),
  );
  assert.deepEqual(restored.view(host).question, first.question);
  assert.equal(restored.view(host).correct, first.correct);

  while (room.phase !== 'finished') {
    if (room.phase === 'reveal') action(host, 'next');
    else advance();
  }
  returnToWaiting(room, host);
  room.rng = (size) => (size >= 4 && size <= 9 ? size - 1 : 0);
  room.start();
  const second = room.view(host);
  assert.equal(second.question.phrase, first.question.phrase);
  assert.equal(new Set(second.question.options).size, 6);
  assert.notDeepEqual(second.question.options.toSorted(), first.question.options.toSorted());
});

for (const count of [2, 3, 4, 8]) {
  test('塗鴉神諭 ' + count + ' 人正確發題、鎖畫與輪流淘汰', () => {
    const { room, seats, action } = table(DrawGuessRoom, count);
    room.configure(seats[0], { playMode: 'oracle', oracleDifficulty: 'easy' });
    room.start();
    const artists = new Map(seats.map((id) => [id, room.view(id).oracle.words]));
    const own = room.view(seats[0]).oracle;
    const perSeat = count <= 3 ? 2 : 1;
    assert.equal(own.words.length, perSeat);
    assert.deepEqual(own.terms, []);
    assert.deepEqual(own.boards, {});
    assert.throws(
      () => action(seats[0], 'oracle-trace', { trace: [{ index: 1000, from: 0, to: 50 }] }),
      { code: 'INVALID_TRACE' },
    );
    action(seats[0], 'oracle-trace', { trace: [{ index: 0, from: 15, to: 70 }] });
    assert.equal(room.view(seats[0]).oracle.board.marks[0][0].from, 15);
    assert.deepEqual(room.view(seats[1]).oracle.board.marks, []);
    action(seats[0], 'oracle-submit');
    assert.throws(() => action(seats[0], 'oracle-undo'), { code: 'ORACLE_BOARD_LOCKED' });
    for (const id of seats.slice(1)) action(id, 'oracle-submit');
    const options = room.view(seats[0]).oracle.terms;
    assert.equal(options.length, count * perSeat * 2);
    assert(options.every((term) => !Object.hasOwn(term, 'artist')));
    assert.throws(() => action(seats[1], 'oracle-eliminate', { termId: options[0].id }), {
      code: 'ORACLE_NOT_TURN',
    });
    const real = new Set([...artists.values()].flat());
    const decoys = options.filter((term) => !real.has(term.word));
    for (let i = 0; i < decoys.length; i++)
      action(seats[i % count], 'oracle-eliminate', { termId: decoys[i].id });
    assert.equal(room.phase, 'oracle-reveal');
    assert.equal(room.view(seats[0]).oracle.errors, 0);
    assert.equal(
      room.view(seats[0]).oracle.terms.filter((term) => term.artist).length,
      count * perSeat,
    );
    action(seats[0], 'oracle-next');
    assert.equal(room.round, 2);
  });
}

test('塗鴉神諭可完成四輪，截止時可由伺服器自動換階段', () => {
  const {
    room,
    seats: [a, b],
    advance,
    action,
  } = table(DrawGuessRoom, 2);
  room.configure(a, { playMode: 'oracle' });
  room.start();
  for (let round = 1; round <= 4; round++) {
    const answers = new Set([a, b].flatMap((id) => room.view(id).oracle.words));
    advance();
    const decoys = room.view(a).oracle.terms.filter((term) => !answers.has(term.word));
    for (const term of decoys)
      action(room.view(a).oracle.turnId, 'oracle-eliminate', { termId: term.id });
    if (round < 4) action(a, 'oracle-next');
  }
  assert.equal(room.phase, 'finished');
  assert.deepEqual(room.winner.ids, [a, b]);
  returnToWaiting(room, a);
  assert.equal(room.options.playMode, 'oracle');
  assert.equal(room.view(a).oracle, null);
});
