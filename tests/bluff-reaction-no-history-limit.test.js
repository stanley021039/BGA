'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth'),
  { BluffRoom } = require('../src/games/bluff');

// Regression for #267: the removed match-history recorder used to reject long
// discussions with HISTORY_QUOTA (429) once enough 「哦是哦」 reactions piled up.
test('bluff 「哦是哦」 reactions are unbounded by any history quota and the room keeps playing', async (t) => {
  let room;
  const start = BluffRoom.prototype.start;
  t.mock.method(BluffRoom.prototype, 'start', function (...args) {
    room = this;
    return start.apply(this, args);
  });
  const { base } = await appFixture(t, {
    config: { achievementPurpose: 'test', marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('reaction_owner', 'synthetic-reaction-password'),
  });
  async function call(route, cookie, data = {}) {
    const res = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(data),
      }),
      text = await res.text();
    return {
      status: res.status,
      text,
      s: JSON.parse(text),
      cookie: res.headers.get('set-cookie')?.split(';')[0],
    };
  }
  async function post(route, cookie, data = {}, status = 200) {
    const r = await call(route, cookie, data);
    assert.equal(r.status, status, r.text);
    assert.equal(r.text.includes('historyWarning'), false);
    return r;
  }
  const owner = (
      await post('auth/login', null, {
        username: 'reaction_owner',
        password: 'synthetic-reaction-password',
      })
    ).cookie,
    cookies = [owner];
  for (let i = 1; i < 3; i++) {
    const invite = (await post('admin/invites', owner)).s.code;
    cookies.push(
      (
        await post('auth/register', null, {
          username: 'reaction_peer' + i,
          password: 'synthetic-reaction-password',
          confirmPassword: 'synthetic-reaction-password',
          invite,
        })
      ).cookie,
    );
  }
  const { code } = (await post('create', owner, { type: 'bluff' })).s;
  for (const c of cookies.slice(1)) await post('join', c, { code });
  await post('start', owner, { code });
  assert.ok(room, 'captured the live bluff room');
  // Own the room clock so the 5 s per-player reaction cooldown can elapse instantly.
  let clock = Date.now();
  room.now = () => clock;
  const state = async (c) =>
    await (await fetch(base + '/api/state?code=' + code, { headers: { Cookie: c } })).json();
  let views = await Promise.all(cookies.map(state));
  const thinker = views.find((v) => v.me === v.thinkerId);
  await post('action', cookies[views.indexOf(thinker)], {
    code,
    action: 'choose',
    questionId: thinker.choices[0].id,
    roundId: thinker.roundId,
    requestId: randomUUID(),
  });
  for (const c of cookies)
    await post('action', c, {
      code,
      action: 'ready',
      roundId: room.roundId,
      requestId: randomUUID(),
    });
  views = await Promise.all(cookies.map(state));
  assert.ok(
    views.every((v) => v.phase === 'discussion'),
    '輪流解釋與質問 phase reached',
  );
  const roundId = room.roundId,
    total = 2000,
    // The HTTP mutation limiter allows 120 requests per player per minute; leave headroom
    // for the follow-up action and send the rest straight through the room's action.
    perPlayerHttp = 110;
  let sent = 0;
  for (let i = 0; i < perPlayerHttp; i++)
    for (const c of cookies) {
      clock += 5001;
      const r = await call('action', c, {
        code,
        action: 'reaction',
        roundId,
        requestId: randomUUID(),
      });
      assert.equal(r.status, 200, r.text);
      assert.notEqual(r.s.code, 'HISTORY_QUOTA');
      assert.equal(r.text.includes('historyWarning'), false);
      assert.equal(r.s.phase, 'discussion');
      sent++;
    }
  const playerIds = views.map((v) => v.me);
  for (let i = 0; sent < total; i++, sent++) {
    clock += 5001;
    room.act(playerIds[i % playerIds.length], 'reaction', { roundId, requestId: randomUUID() });
  }
  assert.equal(sent, total);
  assert.equal(room.phase, 'discussion');
  assert.equal(room.reactions.length, 12, 'only the newest reactions are retained');
  const latest = await state(owner);
  assert.equal(latest.reactions.at(-1).text, '質疑你');
  const speaker = views.findIndex((v) => v.me !== v.thinkerId);
  await post('action', cookies[speaker], {
    code,
    action: 'spoken',
    roundId,
    requestId: randomUUID(),
  });
  assert.equal(room.spokenIds.includes(views[speaker].me), true);
  for (const path of ['/api/history', '/api/history/' + randomUUID()])
    assert.equal((await fetch(base + path, { headers: { Cookie: owner } })).status, 404);
});
