'use strict';
const { completeTelephoneTopics } = require('./helpers/telephone.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { TelephoneRoom, drawing } = require('../src/games/telephone');
const stroke = {
  tool: 'brush',
  color: '#123456',
  size: 4,
  points: [
    [10, 10],
    [30, 30],
  ],
};
function fixture(n = 3) {
  const r = new TelephoneRoom('ABCDEF', '傳情', () => 0),
    players = Array.from({ length: n }, (_, i) => r.add('玩家' + i));
  r.start();
  completeTelephoneTopics(r);
  return { r, players };
}
const cmd = (r, p, action, data = {}) =>
  r.act(p.id, action, { stepId: r.stepId, requestId: randomUUID(), ...data });
const expire = (r) => {
  r.deadline = r.now();
  assert.equal(r.auto(), true);
};
for (const n of [3, 4, 5, 6, 7, 8])
  test(n + ' seats simultaneously alternate drawing/guessing and end with a guess', () => {
    const { r, players } = fixture(n),
      limit = n % 2 ? n - 1 : n;
    for (let round = 1; round <= limit; round++) {
      const seen = new Set();
      for (const p of players) {
        const s = r.view(p.id);
        seen.add(r.bookFor(p.id).ownerId);
        assert.equal(s.task.previous.kind, round % 2 ? 'text' : 'drawing');
        cmd(r, p, 'submit', round % 2 ? { strokes: [stroke] } : { text: '第' + round + '頁' });
      }
      assert.equal(seen.size, n);
      assert.ok(r.view(players[0].id).players.every((p) => p.ready));
      assert.equal(r.auto(), false);
      expire(r);
    }
    assert.equal(r.phase, 'finished');
    for (const b of r.view(players[0].id).books) {
      assert.equal(b.pages.length, limit + 1);
      assert.equal(b.pages.at(-1).kind, 'text');
      assert.equal(new Set(b.pages.slice(1).map((p) => p.authorId)).size, limit);
    }
  });
test('passing view only reveals the assigned previous page, never other drafts or full books', () => {
  const { r, players: p } = fixture(4);
  cmd(r, p[0], 'submit', { strokes: [stroke] });
  assert.deepEqual(r.view(p[1].id).books, []);
  assert.ok(!JSON.stringify(r.view(p[1].id)).includes('#123456'));
  assert.ok(!JSON.stringify(r.view(p[0].id)).includes('secret'));
  assert.equal(r.view(p[0].id).task.submitted, true);
  assert.equal(r.view(p[1].id).task.submitted, false);
});
test('same receipt is idempotent, changed receipt conflicts, stale page/restart cannot write', () => {
  const { r, players: p } = fixture(),
    data = { stepId: r.stepId, requestId: randomUUID(), strokes: [stroke] };
  r.act(p[0].id, 'submit', data);
  const version = r.version;
  r.act(p[0].id, 'submit', data);
  assert.equal(r.version, version);
  assert.throws(
    () => r.act(p[0].id, 'submit', { ...data, strokes: [{ ...stroke, color: '#ffffff' }] }),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  cmd(r, p[1], 'skip');
  cmd(r, p[2], 'skip');
  expire(r);
  assert.throws(
    () => r.act(p[0].id, 'submit', data),
    (e) => e.code === 'STALE_STEP',
  );
  for (const q of p) cmd(r, q, 'skip');
  expire(r);
  r.start();
  assert.throws(
    () => r.act(p[0].id, 'submit', data),
    (e) => e.code === 'STALE_STEP',
  );
});
test('manual passing is unavailable; single submission and text validation precede writes', () => {
  const { r, players: p } = fixture();
  assert.throws(
    () => cmd(r, p[1], 'advance'),
    (e) => e.code === 'TIMED_PASSING',
  );
  assert.throws(
    () => cmd(r, p[0], 'advance'),
    (e) => e.code === 'TIMED_PASSING',
  );
  assert.throws(
    () => cmd(r, p[0], 'unknown'),
    (e) => e.code === 'INVALID_ACTION',
  );
  for (const q of p) cmd(r, q, 'skip');
  assert.throws(
    () => cmd(r, p[0], 'skip'),
    (e) => e.code === 'ALREADY_SUBMITTED',
  );
  expire(r);
  const version = r.version;
  for (const text of ['', 'x'.repeat(81), 'a\nb', null])
    assert.throws(
      () => cmd(r, p[0], 'submit', { text }),
      (e) => e.code === 'INVALID_TEXT',
    );
  assert.equal(r.version, version);
  cmd(r, p[0], 'submit', { text: '<script>文字</script>' });
  assert.equal(r.submissions[p[0].id].text, '<script>文字</script>');
});
test('drawings are bounded, validated and copied; invalid coordinates/colour/tool/size rejected', () => {
  for (const s of [
    { ...stroke, tool: 'unknown' },
    { ...stroke, color: 'red' },
    { ...stroke, size: 100 },
    { ...stroke, points: [[512, 0]] },
    { ...stroke, points: [[0, -1]] },
    { ...stroke, points: [[1.5, 2]] },
    { ...stroke, points: Array(257).fill([0, 0]) },
  ])
    assert.throws(
      () => drawing([s]),
      (e) => e.code === 'INVALID_DRAWING',
    );
  assert.throws(() => drawing([]));
  assert.throws(() => drawing(Array(101).fill(stroke)));
  assert.throws(
    () => drawing(Array(12).fill({ ...stroke, points: Array(256).fill([0, 0]) })),
    (e) => e.code === 'DRAWING_LIMIT',
  );
  const s = JSON.parse(JSON.stringify(stroke)),
    saved = drawing([s]);
  s.points[0][0] = 99;
  assert.equal(saved[0].points[0][0], 10);
});
test('departure preserves submitted pages, marks interruption and transfers host; no new seats mid-game', () => {
  const { r, players: p } = fixture();
  assert.throws(
    () => r.add('晚到'),
    (e) => e.code === 'MATCH_STARTED',
  );
  cmd(r, p[0], 'submit', { strokes: [stroke] });
  r.kick(p[0].id, p[0].id, true);
  assert.equal(r.phase, 'finished');
  assert.equal(r.interrupted, true);
  assert.equal(r.host, p[1].id);
  assert.equal(r.view(p[1].id).books.at(-1).pages[1].strokes[0].color, '#123456');
  r.add('新玩家');
  r.start();
  assert.equal(r.interrupted, false);
});
test('independent source settings, capacity and invalid RNG leave start atomic', () => {
  const r = new TelephoneRoom('ABCDEF', 'test', () => 999),
    p = Array.from({ length: 8 }, (_, i) => r.add(String(i)));
  assert.throws(() => r.add('9'));
  assert.throws(
    () => r.configure(p[1].id, { sources: ['silly'] }),
    (e) => e.code === 'HOST_ONLY',
  );
  for (const sources of [[], ['custom'], ['silly', 'silly']])
    assert.throws(() => r.configure(p[0].id, { sources }));
  r.configure(p[0].id, { sources: ['silly'] });
  assert.throws(() => r.start());
  assert.equal(r.phase, 'waiting');
  assert.equal(r.books.length, 0);
  r.rng = () => 0;
  r.start();
  assert.ok(r.books.every((b) => b.promptId.startsWith('telephone-silly-')));
  assert.equal(new Set(r.books.map((b) => b.promptId)).size, 8);
});
test('script bots submit topics before drawings and deadline still controls passing', () => {
  const { runTestAIStep } = require('../src/ai'),
    r = new TelephoneRoom('ABCDEF', 'bots', () => 0),
    host = r.add('host');
  r.add('bot1', true);
  r.add('bot2', true);
  r.start();
  const history = { transact: (room, op, run) => run() };
  for (let i = 0; i < 5; i++) runTestAIStep(r, { history, now: i * 1500 });
  assert.equal(r.phase, 'prompting');
  assert.equal(Object.keys(r.submissions).length, 2);
  cmd(r, host, 'submit', { text: '房主的主題' });
  assert.equal(r.round, 1);
  for (let i = 5; i < 10; i++) runTestAIStep(r, { history, now: i * 1500 });
  assert.equal(Object.keys(r.submissions).length, 2);
  assert.equal(r.auto(), false);
  cmd(r, host, 'skip');
  expire(r);
  for (let i = 10; i < 15; i++) runTestAIStep(r, { history, now: i * 1500 });
  assert.equal(Object.keys(r.submissions).length, 2);
});
test('telephone accepts shared drawing tools, filled shapes and 1–40px brushes without leaking drafts', () => {
  const { r, players } = fixture();
  const shapes = ['brush', 'erase', 'line', 'rect', 'ellipse', 'fill'].map((tool) => ({
    ...stroke,
    tool,
    size: 6,
    filled: tool === 'rect',
  }));
  const result = drawing(shapes);
  assert.deepEqual(
    result.map((s) => s.tool),
    shapes.map((s) => s.tool),
  );
  assert.equal(result[3].filled, true);
  for (const size of [0, 41, 1.5])
    assert.throws(
      () => drawing([{ ...stroke, size }]),
      (e) => e.code === 'INVALID_DRAWING',
    );
  assert.throws(
    () => drawing([{ ...stroke, filled: 'yes' }]),
    (e) => e.code === 'INVALID_DRAWING',
  );
  cmd(r, players[0], 'submit', { strokes: shapes });
  assert.equal(r.view(players[1].id).books.length, 0);
});
test('telephone pages expose a server deadline and reset it only on advancing to a new page', () => {
  const { r, players } = fixture(),
    deadline = r.deadline;
  assert.equal(r.options.seconds, 90);
  assert.ok(deadline > Date.now());
  assert.equal(r.view(players[0].id).deadline, deadline);
  assert.ok(Number.isFinite(r.view(players[0].id).serverNow));
  for (const p of players) cmd(r, p, 'skip');
  assert.equal(r.deadline, deadline);
  expire(r);
  assert.ok(r.deadline >= deadline);
  r.kick(players[0].id, players[0].id, true);
  assert.equal(r.deadline, null);
});

test('telephone independently configures drawing and text deadlines before each matching phase', () => {
  let now = 100000;
  const r = new TelephoneRoom(
      'ABCDEF',
      'split timers',
      () => 0,
      () => now,
    ),
    players = Array.from({ length: 3 }, (_, i) => r.add('p' + i));
  r.configure(players[0].id, { sources: ['everyday'], drawingSeconds: 120, textSeconds: 60 });
  assert.deepEqual([r.options.drawingSeconds, r.options.textSeconds], [120, 60]);
  assert.throws(
    () => r.configure(players[0].id, { drawingSeconds: 30 }),
    (error) => error.code === 'INVALID_SECONDS',
  );
  assert.throws(
    () => r.configure(players[1].id, { drawingSeconds: 60 }),
    (error) => error.code === 'HOST_ONLY',
  );
  r.start();
  assert.equal(r.deadline, now + 60_000);
  assert.equal(r.view(players[1].id).options.textSeconds, 60);
  now = r.deadline;
  r.auto();
  assert.equal(r.phase, 'passing');
  assert.equal(r.round, 1);
  assert.equal(r.deadline, now + 120_000);
  now = r.deadline;
  r.auto();
  assert.equal(r.round, 2);
  assert.equal(r.deadline, now + 60_000);
});

test('spectator projection hides all private pages and drafts until the match finishes', () => {
  const r = new TelephoneRoom('ABCDEF', 'spectator', () => 0),
    players = Array.from({ length: 3 }, (_, i) => r.add('玩家' + i));
  r.start();
  const secret = '不可提前看到的主題';
  cmd(r, players[0], 'submit', { text: secret });
  let view = r.observerView();
  assert.equal(view.spectator, true);
  assert.equal(view.me, 'spectator');
  assert.equal(view.task, null);
  assert.deepEqual(view.books, []);
  assert.equal(JSON.stringify(view).includes(secret), false);
  assert.equal(JSON.stringify(view).includes(players[0].id), false);
  assert.throws(
    () => r.act('spectator', 'submit', { stepId: r.stepId, requestId: 'spectator-request-01' }),
    (error) => error.code === 'NOT_SEATED',
  );
  cmd(r, players[1], 'skip');
  cmd(r, players[2], 'skip');
  assert.equal(r.phase, 'passing');
  r.deadline = r.now();
  r.auto();
  r.saveDraft(players[1].id, {
    stepId: r.stepId,
    requestId: 'spectator-draft-01',
    text: '私人同步草稿',
  });
  view = r.observerView();
  assert.deepEqual(view.books, []);
  assert.equal(JSON.stringify(view).includes(secret), false);
  assert.equal(JSON.stringify(view).includes('私人同步草稿'), false);
  r.deadline = r.now();
  r.auto();
  r.deadline = r.now();
  r.auto();
  assert.equal(r.phase, 'finished');
  view = r.observerView();
  assert.equal(view.books.length, 3);
  assert.equal(JSON.stringify(view).includes('observer-1'), true);
  assert.equal(JSON.stringify(view).includes(players[0].id), false);
  assert.equal(JSON.stringify(view).includes(secret), true);
});

test('persisted rooms from before split timers keep finite 90-second deadlines after restart', () => {
  const { captureRoom, restoreRoom } = require('../src/rooms/persistence');
  let now = 100000;
  const old = new TelephoneRoom(
      'ABCDEF',
      'legacy timer',
      () => 0,
      () => now,
    ),
    players = Array.from({ length: 3 }, (_, i) => old.add('玩家' + i));
  old.options = { sources: ['everyday'], seconds: 90 };
  const restored = restoreRoom(
    captureRoom(old),
    () =>
      new TelephoneRoom(
        'ABCDEF',
        'legacy timer',
        () => 0,
        () => now,
      ),
  ).room;
  assert.equal(restored.view(players[0].id).options.drawingSeconds, 90);
  assert.equal(restored.observerView().options.textSeconds, 90);
  restored.start();
  assert.equal(restored.deadline, now + 90000);
  now = restored.deadline;
  restored.auto();
  assert.equal(restored.round, 1);
  assert.equal(restored.deadline, now + 90000);
  now = restored.deadline;
  restored.auto();
  assert.equal(restored.round, 2);
  assert.equal(restored.deadline, now + 90000);
});

test('deadline is authoritative for all-ready, partial, empty and final pages', () => {
  let now = 100000;
  const r = new TelephoneRoom(
      'ABCDEF',
      'timed',
      () => 0,
      () => now,
    ),
    p = Array.from({ length: 3 }, (_, i) => r.add('p' + i));
  r.start();
  completeTelephoneTopics(r);
  const deadline = r.deadline,
    step = r.stepId;
  r.saveDraft(p[0].id, { stepId: step, requestId: randomUUID(), strokes: [stroke] });
  cmd(r, p[1], 'submit', { strokes: [stroke] });
  assert.equal(r.view(p[0].id).task.draft.strokes.length, 1);
  assert.equal(r.view(p[1].id).task.draft, null);
  assert.equal(JSON.stringify(r.historyState()).includes('drafts'), false);
  now = deadline - 1;
  assert.equal(r.auto(), false);
  assert.equal(r.round, 1);
  assert.equal(r.deadline, deadline);
  now = deadline;
  assert.throws(
    () => cmd(r, p[0], 'submit', { strokes: [stroke] }),
    (e) => e.code === 'PAGE_CLOSED',
  );
  assert.equal(r.auto(), true);
  assert.equal(r.round, 2);
  assert.notEqual(r.stepId, step);
  assert.equal(r.deadline, now + 90000);
  assert.equal(r.auto(), false);
  assert.equal(r.pageCommits.length, 3);
  assert.equal(r.pageCommits.find((c) => c.page.authorId === p[0].id).page.timedOut, true);
  assert.equal(r.pageCommits.find((c) => c.page.authorId === p[2].id).page.skipped, true);
  assert.throws(
    () => r.saveDraft(p[0].id, { stepId: step, requestId: randomUUID(), strokes: [] }),
    (e) => e.code === 'STALE_STEP',
  );
  r.saveDraft(p[0].id, { stepId: r.stepId, requestId: randomUUID(), text: '已同步的猜詞' });
  cmd(r, p[1], 'submit', { text: '手動送出' });
  r.saveDraft(p[2].id, { stepId: r.stepId, requestId: randomUUID(), text: '   ' });
  now = r.deadline;
  assert.equal(r.auto(), true);
  assert.equal(r.phase, 'finished');
  assert.equal(r.deadline, null);
  assert.equal(r.auto(), false);
  assert.equal(
    r.books.flatMap((b) => b.pages).filter((page) => page.text === '已同步的猜詞').length,
    1,
  );
  assert.ok(r.books.every((b) => b.pages.length === 3));
  r.start();
  assert.deepEqual(r.drafts, {});
  assert.equal(r.round, 0);
  assert.equal(r.phase, 'prompting');
});
test('private draft saves copy valid input, keep the deadline and cannot overwrite submitted pages', () => {
  const { r, players: p } = fixture(),
    deadline = r.deadline,
    data = {
      stepId: r.stepId,
      requestId: randomUUID(),
      strokes: JSON.parse(JSON.stringify([stroke])),
    };
  r.saveDraft(p[0].id, data);
  data.strokes[0].points[0][0] = 99;
  assert.equal(r.drafts[p[0].id].strokes[0].points[0][0], 10);
  assert.throws(
    () => r.saveDraft(p[0].id, data),
    (e) => e.code === 'REQUEST_CONFLICT',
  );
  data.strokes[0].points[0][0] = 10;
  r.saveDraft(p[0].id, data);
  assert.equal(r.deadline, deadline);
  assert.ok(!JSON.stringify(r.view(p[1].id)).includes('#123456'));
  assert.throws(() =>
    r.saveDraft(p[0].id, { ...data, requestId: randomUUID(), strokes: Array(101).fill(stroke) }),
  );
  cmd(r, p[0], 'submit', { strokes: [stroke] });
  assert.equal(r.drafts[p[0].id], undefined);
  assert.throws(
    () => r.saveDraft(p[0].id, { ...data, requestId: randomUUID() }),
    (e) => e.code === 'ALREADY_SUBMITTED',
  );
  for (const q of p.slice(1)) cmd(r, q, 'skip');
  assert.equal(r.auto(), false);
  assert.equal(r.round, 1);
});
