'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');
test('new games integrate auth, media isolation, private roles, history and static assets', async (t) => {
  const { base } = await appFixture(t, {
    config: { achievementPurpose: 'test', marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('party_owner', 'synthetic-party-password'),
  });
  async function post(route, cookie, data = {}, status = 200) {
    const res = await fetch(base + '/api/' + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(data),
      }),
      s = await res.json();
    assert.equal(res.status, status, JSON.stringify(s));
    return { s, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const owner = (
      await post('auth/login', null, {
        username: 'party_owner',
        password: 'synthetic-party-password',
      })
    ).cookie,
    cookies = [owner];
  for (let i = 1; i <= 2; i++) {
    const invite = (await post('admin/invites', owner)).s.code;
    cookies.push(
      (
        await post('auth/register', null, {
          username: 'party_peer' + i,
          displayName: '玩家' + i,
          password: 'synthetic-party-password',
          confirmPassword: 'synthetic-party-password',
          invite,
        })
      ).cookie,
    );
  }
  const state = async (code, cookie) => {
    const res = await fetch(base + '/api/state?code=' + code, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    return res.json();
  };
  for (const type of ['musicquiz', 'minimal']) {
    await post('create', null, { type }, 401);
    const { code } = (await post('create', owner, { type })).s;
    for (const cookie of cookies.slice(1)) await post('join', cookie, { code });
    await post('start', cookies[1], { code }, 403);
    if (type === 'musicquiz')
      await post('action', owner, {
        code,
        action: 'configure',
        roundId: null,
        requestId: randomUUID(),
        banks: ['custom'],
        customSongs: require('../src/games/musicquiz-library')
          .CATALOG.filter((song) => song.bank === 'classical' && song.familiarity !== 'obscure')
          .slice(0, 7),
        target: 10,
      });
    let s = (await post('start', owner, { code })).s;
    const seats = new Map();
    for (const cookie of cookies) seats.set((await state(code, cookie)).me, cookie);
    for (let round = 1; round <= s.roundLimit; round++) {
      if (type === 'musicquiz') {
        s = (
          await post('action', seats.get(s.djId), {
            code,
            action: 'listen',
            roundId: s.roundId,
            requestId: randomUUID(),
          })
        ).s;
        assert.equal(s.song, null);
        assert.equal(s.playback.seconds, 8);
        for (const cookie of cookies)
          s = (
            await post('action', cookie, {
              code,
              action: 'guess',
              roundId: s.roundId,
              requestId: randomUUID(),
              text: '',
              pass: true,
            })
          ).s;
        assert.equal(s.phase, 'timeline');
        s = (
          await post('action', seats.get(s.djId), {
            code,
            action: 'place',
            slot: 0,
            roundId: s.roundId,
            requestId: randomUUID(),
          })
        ).s;
        for (const [id, cookie] of seats)
          if (id !== s.djId)
            s = (
              await post('action', cookie, {
                code,
                action: 'pass',
                roundId: s.roundId,
                requestId: randomUUID(),
              })
            ).s;
        assert.ok(s.song.title);
      } else {
        const guesserCookie = seats.get(s.guesserId);
        assert.equal((await state(code, guesserCookie)).prompt, null);
        let answer;
        for (const [id, cookie] of seats) {
          if (id === s.guesserId) continue;
          const artist = await state(code, cookie);
          answer = artist.prompt;
          await post('action', cookie, {
            code,
            action: 'submit',
            roundId: s.roundId,
            requestId: randomUUID(),
            shapes: [{ kind: 'circle', cx: 250, cy: 120, r: 40 }],
          });
        }
        s = (
          await post('action', guesserCookie, {
            code,
            action: 'guess',
            roundId: s.roundId,
            requestId: randomUUID(),
            text: answer,
          })
        ).s;
      }
      if (s.phase !== 'finished') {
        const old = s.roundId;
        s = (
          await post('action', owner, {
            code,
            action: 'next',
            roundId: s.roundId,
            requestId: randomUUID(),
          })
        ).s;
        await post(
          'action',
          owner,
          { code, action: 'guess', roundId: old, requestId: randomUUID(), text: 'old' },
          409,
        );
        await post('reconnect', owner, { code });
      }
    }
    assert.equal(s.phase, 'finished');
    const list = await (await fetch(base + '/api/history', { headers: { Cookie: owner } })).json(),
      m = list.find((m) => m.type === type);
    assert.equal(m.status, 'finished');
    const rows = await (
      await fetch(base + '/api/history/' + m.id, { headers: { Cookie: owner } })
    ).json();
    assert.match(rows[0].engine.partyBase, /class PartyRoom/);
    assert.ok(rows[0].engine.catalog);
    assert.equal(rows.filter((r) => r.kind === 'result').at(-1).after.results.length, s.roundLimit);
    for (const path of ['/' + type + '/' + code, '/' + type + '?learn=1']) {
      const noauth = await fetch(base + path, { redirect: 'manual' });
      assert.equal(noauth.status, 302);
      // API-only app: pages come from the Vue build (#233).
      assert.equal((await fetch(base + path, { headers: { Cookie: owner } })).status, 503);
    }
    for (const cookie of cookies) await post('leave', cookie, { code });
  }
  assert.equal((await fetch(base + '/shared/party-shapes.js')).status, 200);
});
