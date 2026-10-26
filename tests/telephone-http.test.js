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
test('telephone HTTP auth, privacy, sources, reconnect, whole-book results and interrupted status', async (t) => {
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
  assert.ok(s.books.every((book) => book.pages.length === 3));
  assert.equal(s.interrupted, false);
  const readObserver = async () => {
    const response = await fetch(base + '/api/telephone/watch?code=' + code, {
      headers: { Cookie: observerCookie },
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  assert.equal((await readObserver()).books.length, 3);
  s = (await post('rematch', { code })).s;
  assert.equal(s.phase, 'waiting');
  const waitingObserver = await readObserver();
  assert.equal(waitingObserver.phase, 'waiting');
  assert.equal(waitingObserver.task, null);
  assert.deepEqual(waitingObserver.books, []);
  assert.equal(waitingObserver.players.length, 3);
  s = (await post('start', { code })).s;
  await post('kick', { code, playerId: s.players.find((p) => p.bot).id, confirmed: true });
  s = await (await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } })).json();
  assert.equal(s.phase, 'finished');
  assert.equal(s.interrupted, true);
  for (const path of ['/telephone/' + code, '/telephone?learn=1']) {
    const unauth = await fetch(base + path, { redirect: 'manual' });
    assert.equal(unauth.status, 302);
    // API-only app: pages come from the Vue build (#233).
    const page = await fetch(base + path, { headers: { Cookie: cookie } });
    assert.equal(page.status, 503);
  }
  for (const path of ['/shared/stroke-canvas.js', '/shared/countdown-bar.js'])
    assert.equal((await fetch(base + path)).status, 404);
  await post('rematch', { code });
  const switched = (
    await post('change-game', {
      code,
      gameType: 'telephone',
      gameRevision: 0,
      targetType: 'draw',
    })
  ).s;
  const unavailable = await fetch(base + '/api/telephone/watch?code=' + code, {
    headers: { Cookie: observerCookie },
  });
  assert.equal(unavailable.status, 404);
  assert.equal((await unavailable.json()).code, 'WATCH_UNAVAILABLE');
  await post('change-game', {
    code,
    gameType: 'draw',
    gameRevision: switched.gameRevision,
    targetType: 'telephone',
  });
  const restoredObserver = await readObserver();
  assert.equal(restoredObserver.phase, 'waiting');
  assert.equal(restoredObserver.task, null);
  assert.deepEqual(restoredObserver.books, []);
  await post('leave', { code });
});
test('maximum eight-seat books commit and reconstruct every page', () => {
  const { TelephoneRoom } = require('../src/games/telephone');
  const room = new TelephoneRoom('ABCDEF', 'max', () => 0),
    players = Array.from({ length: 8 }, (_, i) => room.add('p' + i)),
    committed = new Map(),
    record = () => {
      for (const c of room.pageCommits) committed.set(c.bookIndex + ':' + c.round, c.page);
    };
  room.start();
  completeTelephoneTopics(room, (p, data) => {
    room.act(p.id, 'submit', data);
    record();
  });
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
      room.act(p.id, 'submit', data);
      record();
    }
    room.deadline = room.now();
    room.auto();
    record();
  }
  assert.equal(room.phase, 'finished');
  assert.ok(room.books.every((b) => b.pages.length === 9));
  assert.equal(committed.size, 72);
  for (const [key, page] of committed) {
    const [bookIndex, round] = key.split(':').map(Number);
    assert.deepEqual(room.books[bookIndex].pages[round], page);
  }
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

test('eight maximum private drafts auto-pass every page', () => {
  const { TelephoneRoom } = require('../src/games/telephone');
  const room = new TelephoneRoom('ABCDEF', 'max drafts', () => 0),
    players = Array.from({ length: 8 }, (_, i) => room.add('p' + i)),
    committed = new Map(),
    record = () => {
      for (const c of room.pageCommits) committed.set(c.bookIndex + ':' + c.round, c.page);
    };
  room.start();
  completeTelephoneTopics(room, (p, data) => {
    room.act(p.id, 'submit', data);
    record();
  });
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
    room.auto();
    assert.equal(room.pageCommits.length, 8);
    record();
  }
  assert.equal(room.phase, 'finished');
  assert.ok(room.books.every((b) => b.pages.length === 9));
  assert.equal(committed.size, 72);
  assert.ok(
    [...committed.entries()].filter(([key]) => !key.endsWith(':0')).every(([, p]) => p.timedOut),
  );
  assert.equal([...committed.keys()].filter((key) => key.endsWith(':0')).length, 8);
  assert.equal(committed.get('0:1').strokes.length, 100);
});
