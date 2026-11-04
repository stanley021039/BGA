'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { createAuth } = require('../src/auth');
const { GachaStore } = require('../src/gacha/store');
const { appFixture } = require('./helpers/app-fixture.cjs');
test('gacha HTTP authenticates, grants daily once, settles/replays ten pulls and refuses forged payloads', async (t) => {
  const { base } = await appFixture(t, {
    seed: async (db) => {
      const auth = createAuth(db);
      await auth.bootstrap('gacha_owner', 'test-password-123');
      const user = db.prepare('SELECT id FROM users WHERE username=?').get('gacha_owner');
      const store = new GachaStore(db);
      store.daily(user.id);
      require('../src/db').transaction(db, () =>
        store.ledger(
          'fixture:' + user.id,
          user.id,
          'match',
          1000,
          0,
          createHash('sha256').update('fixture').digest('hex'),
          new Date().toISOString(),
        ),
      );
    },
  });
  const raw = await fetch(base + '/api/gacha');
  assert.equal(raw.status, 401);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'gacha_owner', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  async function req(route, body) {
    const r = await fetch(base + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Cookie: cookie,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  }
  const state = await req('/api/gacha');
  assert.equal(state.status, 200);
  assert.equal(state.body.wallet.coins, 1100);
  assert.equal(state.body.pools.length, 7);
  assert.ok(state.body.items.length >= 115);
  const input = { requestId: randomUUID(), pool: 'all', count: 10 };
  const first = await req('/api/gacha/draw', input);
  assert.equal(first.status, 200);
  assert.equal(first.body.results.length, 10);
  assert.equal(first.body.wallet.coins, 100);
  assert.deepEqual(await req('/api/gacha/draw', input), first);
  const later = await req('/api/gacha');
  assert.equal(later.body.wallet.coins, 100);
  const owned = new Set(later.body.items.filter((i) => i.owned).map((i) => i.key));
  for (const item of first.body.results) assert.ok(owned.has(item.key));
  assert.equal(
    first.body.fragmentsGained,
    first.body.results.reduce((sum, i) => sum + i.fragments, 0),
  );
  const forged = await req('/api/gacha/draw', {
    requestId: randomUUID(),
    pool: 'all',
    count: 1,
    userId: randomUUID(),
    results: [{ rarity: 'legendary' }],
  });
  assert.equal(forged.status, 400);
  assert.equal((await req('/api/gacha')).body.wallet.coins, 100);
  assert.equal((await req('/api/gacha/draw', null)).status, 400);
  assert.equal((await req('/api/gacha/draw')).status, 405);
});
