'use strict';
const { completeTelephoneTopics } = require('./helpers/telephone.cjs');
async function enterDrawing(state, submit, read) {
  if (state.phase === 'prompting') await submit(state);
  for (let i = 0; i < 100; i++) {
    state = await read();
    if (state.phase === 'passing') return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw Error('出題未進入作畫');
}

const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { createAuth } = require('../src/auth'),
  { appFixture } = require('./helpers/app-fixture.cjs');
test('telephone HTTP auth, privacy, sources, reconnect, whole-book history and interrupted status', async (t) => {
  const { TelephoneRoom } = require('../src/games/telephone'),
    start = TelephoneRoom.prototype.start;
  t.mock.method(TelephoneRoom.prototype, 'start', function () {
    start.call(this);
    this.options.seconds = 3;
    this.options.textSeconds = 3;
    this.options.drawingSeconds = 3;
    this.deadline = Date.now() + 3000;
  });
  const { base } = await appFixture(t, {
    config: { marketAutomationEnabled: false, achievementPurpose: 'test' },
    seed: (db) => createAuth(db).bootstrap('telephone_owner', 'synthetic-telephone-password'),
  });
  const post = async (route, data = {}, status = 200) => {
    const r = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(data),
      }),
      s = await r.json();
    assert.equal(r.status, status, JSON.stringify(s));
    return { s, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  };
  let cookie;
  await post('create', { type: 'telephone' }, 401);
  cookie = (
    await post('auth/login', {
      username: 'telephone_owner',
      password: 'synthetic-telephone-password',
    })
  ).cookie;
  const { code } = (await post('create', { type: 'telephone' })).s;
  const unauthWatch = await fetch(base + '/api/telephone/watch?code=' + code);
  assert.equal(unauthWatch.status, 401);
  const seatedWatch = await fetch(base + '/api/telephone/watch?code=' + code, {
    headers: { Cookie: cookie },
  });
  assert.equal(seatedWatch.status, 409);
  const invite = await post('admin/invites', { days: 1 });
  const observer = await fetch(base + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'telephone_observer',
      displayName: '觀戰朋友',
      password: 'telephone-observer-password',
      confirmPassword: 'telephone-observer-password',
      invite: invite.s.code,
    }),
  });
  assert.equal(observer.status, 200);
  const observerCookie = observer.headers.get('set-cookie').split(';')[0];
  const watch = await fetch(base + '/api/telephone/watch?code=' + code, {
    headers: { Cookie: observerCookie },
  });
  assert.equal(watch.status, 200);
  const watchedState = await watch.json();
  assert.equal(watchedState.spectator, true);
  assert.equal(watchedState.me, 'spectator');
  assert.equal(watchedState.host, false);
  assert.equal(watchedState.task, null);
  assert.deepEqual(watchedState.books, []);
  assert.ok(watchedState.players.every((player) => player.id.startsWith('observer-')));
  assert.ok(watchedState.players.every((player) => !player.id.startsWith('user-')));
  const methodWatch = await fetch(base + '/api/telephone/watch?code=' + code, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(methodWatch.status, 405);
  await post('start', { code }, 400);
  await post('bot', { code });
  await post('bot', { code });
  let configured = await post('settings', {
    code,
    sources: ['silly'],
    drawingSeconds: 60,
    textSeconds: 120,
  });
  assert.equal(configured.s.options.drawingSeconds, 60);
  assert.equal(configured.s.options.textSeconds, 120);
  await post('settings', { code, drawingSeconds: 90, textSeconds: 90 });
  let s = (await post('start', { code })).s;
  s = await enterDrawing(
    s,
    (value) =>
      post('action', {
        code,
        action: 'submit',
        stepId: value.stepId,
        requestId: randomUUID(),
        text: 'HTTP主題',
      }),
    async () =>
      (await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })).json(),
  );
  for (let round = 1; round <= 2; round++) {
    await post('reconnect', { code });
    await post('action', { code, action: 'skip', stepId: s.stepId, requestId: randomUUID() });
    await post(
      'action',
      { code, action: 'advance', stepId: s.stepId, requestId: randomUUID() },
      409,
    );
    const oldStep = s.stepId,
      deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const r = await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } });
      s = await r.json();
      if (s.stepId !== oldStep || s.phase === 'finished') break;
      await new Promise((done) => setTimeout(done, 100));
    }
    assert.equal(s.round, round === 1 ? 2 : 2);
    assert.equal(s.phase, round === 1 ? 'passing' : 'finished');
  }
  assert.equal(s.phase, 'finished');
  assert.equal(s.books.length, 3);
  assert.equal(s.books[0].pages.length, 3);
  let matches = await (await fetch(base + '/api/history', { headers: { Cookie: cookie } })).json();
  const match = matches.find((m) => m.type === 'telephone');
  assert.equal(match.status, 'finished');
  const rows = await (
    await fetch(base + '/api/history/' + match.id, { headers: { Cookie: cookie } })
  ).json();
  assert.match(rows[0].engine.telephonePrompts, /telephone-/);
  assert.equal(rows.filter((r) => r.kind === 'result').at(-1).after.pageCommits.length, 3);
  assert.equal(rows.filter((r) => r.kind === 'result').at(-1).after.books, undefined);
  s = (await post('start', { code })).s;
  await post('kick', { code, playerId: s.players.find((p) => p.bot).id, confirmed: true });
  matches = await (await fetch(base + '/api/history', { headers: { Cookie: cookie } })).json();
  assert.ok(matches.some((m) => m.type === 'telephone' && m.status === 'interrupted'));
  for (const path of ['/telephone/' + code, '/telephone?learn=1']) {
    const unauth = await fetch(base + path, { redirect: 'manual' });
    assert.equal(unauth.status, 302);
    // API-only app: pages come from the Vue build (#233).
    const page = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(page.status, 503);
  }
  for (const path of ['/shared/stroke-canvas.js', '/shared/countdown-bar.js'])
    assert.equal((await fetch(base + path)).status, 404);
  await post('leave', { code });
});
test('maximum eight-seat books stay within default history result bounds and reconstruct every page', async (t) => {
  const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path'),
    { HistoryStore } = require('../src/history/store'),
    { TelephoneRoom } = require('../src/games/telephone');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telephone-history-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new HistoryStore(dir),
    room = new TelephoneRoom('ABCDEF', 'max', () => 0),
    players = Array.from({ length: 8 }, (_, i) => room.add('p' + i));
  store.attach(room);
  store.transact(room, { action: 'start' }, () => room.start());
  completeTelephoneTopics(room, (p, data) =>
    store.transact(room, { action: 'submit', actor: p.id, input: data }, () =>
      room.act(p.id, 'submit', data),
    ),
  );
  const strokes = Array.from({ length: 100 }, () => ({
    tool: 'brush',
    color: '#123456',
    size: 4,
    points: Array.from({ length: 30 }, () => [511, 255]),
  }));
  for (let round = 1; round <= 8; round++) {
    for (const p of players) {
      const data = {
        stepId: room.stepId,
        requestId: randomUUID(),
        ...(round % 2 ? { strokes } : { text: '傳遞故事' }),
      };
      store.transact(room, { action: 'submit', input: data }, () => room.act(p.id, 'submit', data));
    }
    room.deadline = room.now();
    store.transact(room, { action: 'auto', source: 'timeout' }, () => room.auto());
  }
  assert.equal(room.phase, 'finished');
  assert.equal(room.books[0].pages.length, 9);
  assert.equal(store.list()[0].status, 'finished');
  const rows = store.read(store.list()[0].id);
  for (const row of rows.filter((r) => r.kind === 'result'))
    assert.ok(Buffer.byteLength(JSON.stringify(row)) < 512 * 1024);
  const committed = new Map();
  for (const row of rows.filter((r) => r.kind === 'result'))
    for (const c of row.after.pageCommits) committed.set(c.bookIndex + ':' + c.round, c.page);
  assert.equal(committed.size, 72);
});

test('telephone HTTP accepts a bounded private page above 8KiB while rejecting bodies above 128KiB', async (t) => {
  const { base } = await appFixture(t, {
    config: { marketAutomationEnabled: false, achievementPurpose: 'test' },
    seed: (db) => createAuth(db).bootstrap('page_payload_owner', 'synthetic-page-payload-password'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'page_payload_owner',
      password: 'synthetic-page-payload-password',
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const post = async (route, data, status = 200) => {
    const r = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(data),
    });
    assert.equal(r.status, status, route);
    return r.json();
  };
  const { code } = await post('create', { type: 'telephone' });
  await post('bot', { code });
  await post('bot', { code });
  let state = await post('start', { code });
  state = await enterDrawing(
    state,
    (value) =>
      post('action', {
        code,
        action: 'submit',
        stepId: value.stepId,
        requestId: randomUUID(),
        text: '大畫作主題',
      }),
    async () =>
      (await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })).json(),
  );
  await post(
    'action',
    {
      code,
      action: 'submit',
      stepId: state.stepId,
      requestId: randomUUID(),
      text: 'x'.repeat(128 * 1024),
    },
    413,
  );
  const strokes = Array.from({ length: 10 }, () => ({
    tool: 'brush',
    color: '#123456',
    size: 6,
    filled: false,
    points: Array.from({ length: 256 }, () => [100, 100]),
  }));
  const body = { code, action: 'submit', stepId: state.stepId, requestId: randomUUID(), strokes };
  assert.ok(Buffer.byteLength(JSON.stringify(body)) > 8192);
  const unauthDraft = await fetch(base + '/api/telephone/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(unauthDraft.status, 401);
  const readDraft = await fetch(base + '/api/telephone/draft?code=' + code, {
    headers: { Cookie: cookie },
  });
  assert.equal(readDraft.status, 405);
  const draft = await post('telephone/draft', body);
  assert.equal(draft.task.draft.strokes.length, 10);
  assert.equal(draft.deadline, state.deadline);
  await post('telephone/draft', { ...body, text: 'x'.repeat(128 * 1024) }, 413);
  const result = await post('action', body);
  assert.equal(result.task.submitted, true);
  assert.deepEqual(result.books, []);
});

test('eight maximum private drafts auto-pass every page without overflowing the history result budget', async (t) => {
  const fs = require('node:fs'),
    os = require('node:os'),
    path = require('node:path'),
    { HistoryStore } = require('../src/history/store'),
    { TelephoneRoom } = require('../src/games/telephone');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telephone-timed-history-'));
  const store = new HistoryStore(dir);
  t.after(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const room = new TelephoneRoom('ABCDEF', 'max drafts', () => 0),
    players = Array.from({ length: 8 }, (_, i) => room.add('p' + i));
  store.attach(room);
  store.transact(room, { action: 'start' }, () => room.start());
  completeTelephoneTopics(room, (p, data) =>
    store.transact(room, { action: 'submit', actor: p.id, input: data }, () =>
      room.act(p.id, 'submit', data),
    ),
  );
  const strokes = Array.from({ length: 100 }, () => ({
    tool: 'brush',
    color: '#123456',
    size: 4,
    points: Array.from({ length: 30 }, () => [511, 255]),
  }));
  for (let round = 1; round <= 8; round++) {
    for (const p of players)
      room.saveDraft(p.id, {
        stepId: room.stepId,
        requestId: randomUUID(),
        ...(round % 2 ? { strokes } : { text: '傳遞草稿' }),
      });
    room.deadline = room.now();
    store.transact(room, { action: 'auto', source: 'timeout' }, () => room.auto());
    assert.equal(room.pageCommits.length, 8);
  }
  assert.equal(room.phase, 'finished');
  assert.equal(store.list()[0].status, 'finished');
  assert.ok(room.books.every((b) => b.pages.length === 9));
  const rows = store.read(store.list()[0].id),
    committed = new Map();
  for (const row of rows.filter((r) => r.kind === 'result')) {
    assert.ok(Buffer.byteLength(JSON.stringify(row)) < store.limits.maxResultBytes);
    for (const c of row.after.pageCommits) committed.set(c.bookIndex + ':' + c.round, c.page);
  }
  assert.equal(committed.size, 72);
  assert.ok(
    [...committed.entries()].filter(([key]) => !key.endsWith(':0')).every(([, p]) => p.timedOut),
  );
  assert.equal([...committed.keys()].filter((key) => key.endsWith(':0')).length, 8);
  assert.equal(committed.get('0:1').strokes.length, 100);
});
