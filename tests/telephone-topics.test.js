'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const { TelephoneRoom } = require('../src/games/telephone');
function fixture(count = 3) {
  let now = 1000;
  const room = new TelephoneRoom(
    'ABCDEF',
    '先出題',
    () => 0,
    () => now,
  );
  const players = Array.from({ length: count }, (_, i) => room.add('玩家' + i));
  room.start();
  const command = (player, text, extra = {}) => {
    const data = { stepId: room.stepId, requestId: randomUUID(), text, ...extra };
    room.act(player.id, 'submit', data);
    return data;
  };
  return {
    room,
    players,
    command,
    setNow: (value) => {
      now = value;
    },
  };
}
for (const count of [3, 4, 5, 6, 7, 8])
  test(`${count} players write private topics before the next seat draws`, () => {
    const { room, players, command } = fixture(count);
    const initialStep = room.stepId;
    assert.equal(room.phase, 'prompting');
    assert.equal(room.round, 0);
    assert.equal(room.deadline, 91000);
    for (const player of players) {
      const state = room.view(player.id);
      assert.equal(state.task.kind, 'text');
      assert.deepEqual(state.books, []);
      assert.equal(state.task.previous.text, '想一個主題，交給下一位玩家作畫。');
    }
    for (const [index, player] of players.entries()) {
      command(player, '秘密主題' + index);
      if (index < count - 1) {
        assert.equal(room.phase, 'prompting');
        assert.ok(!JSON.stringify(room.view(players.at(-1).id)).includes('秘密主題'));
      }
    }
    assert.equal(room.phase, 'passing');
    assert.equal(room.round, 1);
    assert.notEqual(room.stepId, initialStep);
    assert.equal(room.deadline, 91000);
    for (const [index, player] of players.entries()) {
      const previous = room.view(player.id).task.previous;
      const author = (index + count - 1) % count;
      assert.equal(previous.text, '秘密主題' + author);
      assert.equal(previous.authorId, players[author].id);
    }
  });
test('deadline uses an accepted draft or selected-bank fallback and starts a fresh drawing timer', () => {
  const { room, players, command, setNow } = fixture();
  command(players[0], '手動主題');
  room.saveDraft(players[1].id, {
    stepId: room.stepId,
    requestId: randomUUID(),
    text: '已同步主題',
  });
  setNow(90999);
  assert.equal(room.auto(), false);
  setNow(91000);
  assert.equal(room.auto(), true);
  assert.equal(room.deadline, 181000);
  assert.equal(room.books[0].pages[0].text, '手動主題');
  assert.equal(room.books[1].pages[0].text, '已同步主題');
  assert.equal(room.books[1].pages[0].timedOut, true);
  assert.equal(room.books[2].pages[0].topicFallback, true);
  assert.equal(room.books[2].pages[0].authorName, '情境題庫');
  assert.notEqual(room.books[2].pages[0].text, '（尚未出題）');
  assert.equal(room.pageCommits.length, 3);
  assert.ok(room.pageCommits.every((commit) => commit.round === 0));
});
test('topics validate text, restore privately, deduplicate the final receipt and reject stale writes', () => {
  const { room, players, command } = fixture();
  assert.throws(
    () => command(players[0], '主題', { requestId: {} }),
    (e) => e.code === 'INVALID_REQUEST_ID',
  );
  for (const text of ['', 'x'.repeat(81), '換\n行'])
    assert.throws(
      () => command(players[0], text),
      (e) => e.code === 'INVALID_TEXT',
    );
  room.saveDraft(players[0].id, {
    stepId: room.stepId,
    requestId: randomUUID(),
    text: '私人的草稿',
  });
  assert.equal(room.view(players[0].id).task.draft.text, '私人的草稿');
  assert.ok(!JSON.stringify(room.view(players[1].id)).includes('私人的草稿'));
  command(players[0], '😀'.repeat(80));
  command(players[1], '第二主題');
  const last = command(players[2], '第三主題');
  const version = room.version;
  room.act(players[2].id, 'submit', last);
  assert.equal(room.version, version);
  assert.throws(
    () => room.act(players[2].id, 'submit', { ...last, text: '變更' }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  assert.throws(
    () => room.saveDraft(players[2].id, { ...last, requestId: randomUUID() }),
    (e) => e.code === 'STALE_STEP',
  );
  room.deadline = room.now();
  room.auto();
  assert.throws(
    () => room.act(players[2].id, 'submit', last),
    (e) => e.code === 'STALE_STEP',
  );
});
test('leaving during topic entry interrupts without inventing topics or duplicating page zero', () => {
  const { room, players, command } = fixture();
  command(players[0], '已送出的主題');
  room.kick(players[0].id, players[1].id);
  assert.equal(room.phase, 'finished');
  assert.equal(room.interrupted, true);
  assert.ok(room.books.every((book) => book.pages.length === 1));
  assert.equal(room.books[0].pages[0].text, '已送出的主題');
  assert.equal(room.books[2].pages[0].skipped, true);
});
test('blank opening topics use only the configured fallback source', () => {
  let now = 1000;
  const room = new TelephoneRoom(
    'ABCDEF',
    '備援',
    () => 0,
    () => now,
  );
  const players = Array.from({ length: 3 }, (_, i) => room.add('玩家' + i));
  room.configure(players[0].id, { sources: ['silly'] });
  room.start();
  now = room.deadline;
  room.auto();
  const { PROMPTS } = require('../src/games/telephone-prompts');
  for (const book of room.books) {
    const prompt = PROMPTS.find((row) => row.id === book.promptId);
    assert.equal(prompt.source, 'silly');
    assert.equal(book.pages[0].text, prompt.text);
    assert.equal(book.pages[0].topicFallback, true);
  }
});
