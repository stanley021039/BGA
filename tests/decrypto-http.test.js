'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
test('Decrypto HTTP: create/join, identity, private state, first round, sealed second round, reconnect and spectator projection', async (t) => {
  const { base } = await appFixture(t, {
    config: { decryptoEnabled: true, marketAutomationEnabled: false },
    seed: (db) => createAuth(db).bootstrap('cipher_owner', 'synthetic-decrypto-password'),
  });
  async function post(route, cookie, data, status = 200) {
    const r = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(data),
    });
    const body = await r.json();
    assert.equal(r.status, status, JSON.stringify(body));
    return { body, cookie: r.headers.get('set-cookie')?.split(';')[0] };
  }
  async function get(route, cookie) {
    const r = await fetch(base + '/api/' + route, { headers: { Cookie: cookie } });
    assert.equal(r.status, 200);
    return r.json();
  }
  const owner = (
    await post('auth/login', null, {
      username: 'cipher_owner',
      password: 'synthetic-decrypto-password',
    })
  ).cookie;
  const cookies = [owner];
  for (let i = 1; i < 5; i++) {
    const invite = (await post('admin/invites', owner, {})).body.code;
    cookies.push(
      (
        await post('auth/register', null, {
          username: 'cipher_peer_' + i,
          displayName: '通訊員' + i,
          password: 'synthetic-decrypto-password',
          confirmPassword: 'synthetic-decrypto-password',
          invite,
        })
      ).cookie,
    );
  }
  const { code } = (await post('create', owner, { type: 'decrypto' })).body;
  for (const c of cookies.slice(1, 4)) await post('join', c, { code });
  const seats = new Map();
  for (const c of cookies.slice(0, 4)) {
    const v = await get('state?code=' + code, c);
    seats.set(v.me, c);
    assert.equal(v.type, 'decrypto');
    assert.deepEqual(
      v.teams.map((t) => t.members.length),
      [2, 2],
    );
  }
  const listed = (await get('rooms', owner)).rooms.find((r) => r.code === code);
  assert.equal(listed.maxPlayers, 8);
  assert.equal(listed.playerCount, 4);
  await post('start', cookies[1], { code }, 403);
  let v = (await post('start', owner, { code })).body;
  await post('join', cookies[4], { code }, 409);
  const outsider = await fetch(base + '/api/state?code=' + code, {
    headers: { Cookie: cookies[4] },
  });
  assert.equal(outsider.status, 403);
  const keys = [];
  for (const [id, c] of seats) {
    const p = await get('state?code=' + code, c);
    assert.equal(p.keywords[1 - p.myTeam].length, 0);
    assert.equal(!!p.secretCode, p.encryptors[p.myTeam] === id);
    keys.push(...p.keywords[p.myTeam]);
  }
  async function action(id, action, data = {}, status = 200) {
    const payload = {
      code,
      gameType: 'decrypto',
      gameRevision: 0,
      roundId: v.roundId,
      turn: v.turn,
      requestId: randomUUID(),
      action,
      ...data,
    };
    const out = await post('action', seats.get(id), payload, status);
    if (status === 200) v = out.body;
    return payload;
  }
  async function clues() {
    for (let team = 0; team < 2; team++)
      await action(v.encryptors[team], 'clues', {
        clues: [0, 1, 2].map((i) => `公開訊息第${v.round}輪隊${team}項${i}`),
      });
  }
  async function decode() {
    const e = await get('state?code=' + code, seats.get(v.encryptors[v.turn]));
    assert.equal(e.secretCode, null);
    await action(v.decoders[v.turn], 'decode', { digits: [1, 2, 3] });
  }
  await clues();
  assert.equal(v.clues[1], null);
  await action(v.decoders[1], 'intercept', { digits: [1, 2, 3] }, 409);
  await decode();
  await action(v.hostId || v.host, 'next');
  await decode();
  await action(v.hostId || v.host, 'next');
  assert.equal(v.round, 2);
  await clues();
  const enemy = v.decoders[1],
    own = v.decoders[0];
  const payload = await action(enemy, 'intercept', { digits: [2, 3, 4] });
  const withheld = await get('state?code=' + code, seats.get(own));
  assert.equal(withheld.myGuess, null);
  assert.equal(withheld.results.length, 2);
  assert.equal(withheld.guessReady.intercept, true);
  const again = (await post('action', seats.get(enemy), payload)).body;
  assert.equal(again.results.length, 2);
  await action(own, 'decode', { digits: [1, 2, 3] });
  assert.equal(v.results.length, 3);
  const restored = (await post('reconnect', seats.get(own), { code })).body;
  assert.equal(restored.type, 'decrypto');
  // A caller-provided actor never gives access to the encryptor's private code.
  const fake = await post(
    'action',
    seats.get(own),
    {
      code,
      roundId: v.roundId,
      turn: v.turn,
      requestId: randomUUID(),
      action: 'clues',
      playerId: v.encryptors[0],
      clues: ['甲', '乙', '丙'],
    },
    409,
  );
  assert.ok(fake.body.error);
});
