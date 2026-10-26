'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');
const { DatabaseSync } = require('node:sqlite');
test('authenticated tutorial HTTP is private, idempotent and isolated from formal rooms, voting and achievements', async (t) => {
  const f = await appFixture(t, {
    config: { marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('lesson_owner', 'synthetic-lesson-password'),
  });
  async function post(path, cookie, data, status = 200, extra = {}) {
    const r = await fetch(f.base + '/api/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: JSON.stringify(data),
    });
    const body = await r.json();
    assert.equal(r.status, status, JSON.stringify(body));
    return { body, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  const owner = (
    await post('auth/login', null, {
      username: 'lesson_owner',
      password: 'synthetic-lesson-password',
    })
  ).cookie;
  const invite = (await post('admin/invites', owner, {})).body.code;
  const other = (
    await post('auth/register', null, {
      username: 'lesson_peer',
      displayName: '同伴',
      password: 'synthetic-lesson-password',
      confirmPassword: 'synthetic-lesson-password',
      invite,
    })
  ).cookie;
  await post('tutorial/start', null, { type: 'poker' }, 401);
  const formal = (await post('create', owner, { type: 'poker' })).body;
  await post('join', other, { code: formal.code });
  const counts = () => {
    const db = new DatabaseSync(f.config.dbFile, { readOnly: true });
    try {
      return ['achievement_progress', 'processed_unit_events', 'market_votes'].map(
        (table) => db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n,
      );
    } finally {
      db.close();
    }
  };
  const before = counts();
  let lesson = (await post('tutorial/start', owner, { type: 'poker' })).body;
  const get = async (cookie, path) =>
    fetch(f.base + '/api/' + path, { headers: { Cookie: cookie } });
  assert.equal((await get(other, 'tutorial/state?id=' + lesson.id)).status, 404);
  await post('tutorial/start', owner, { type: 'poker' }, 400, { Origin: 'https://other.invalid' });
  const payload = { id: lesson.id, revision: lesson.revision, requestId: randomUUID() };
  const first = (await post('tutorial/step', owner, payload)).body;
  assert.equal((await post('tutorial/step', owner, payload)).body.revision, first.revision);
  await post(
    'tutorial/step',
    other,
    { ...payload, revision: first.revision, requestId: randomUUID() },
    404,
  );
  await post('tutorial/step', owner, { ...payload, requestId: randomUUID() }, 409);
  await post(
    'tutorial/action',
    owner,
    {
      id: lesson.id,
      revision: first.revision,
      requestId: randomUUID(),
      route: 'market/vote',
      body: { bucket: 'rise' },
    },
    400,
  );
  const listing = await get(owner, 'rooms');
  const rows = (await listing.json()).rooms;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, formal.code);
  assert.equal(rows[0].playerCount, 2);
  const regular = await get(owner, 'state?code=' + formal.code);
  assert.equal((await regular.json()).phase, 'waiting');
  assert.deepEqual(counts(), before);
  lesson = (await post('tutorial/start', owner, { type: 'musicquiz' })).body;
  const started = await post('tutorial/step', owner, {
    id: lesson.id,
    revision: lesson.revision,
    requestId: randomUUID(),
  });
  const clipUrl = started.body.snapshot.playback.url;
  const clip = await get(owner, clipUrl.slice('/api/'.length));
  assert.equal(clip.status, 200);
  assert.match(clip.headers.get('content-type'), /audio\/wav/);
  assert.equal(Buffer.from(await clip.arrayBuffer()).toString('ascii', 0, 4), 'RIFF');
  assert.equal((await get(other, clipUrl.slice('/api/'.length))).status, 404);
  await post('tutorial/close', owner, { id: lesson.id });
  assert.equal((await get(owner, 'tutorial/state?id=' + lesson.id)).status, 404);
  assert.deepEqual(counts(), before);
});
