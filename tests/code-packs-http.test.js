const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
test('simultaneous code claims and ticket retries issue rewards and spend tickets exactly once over HTTP', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('pack_http', 'test-password-123'),
  });
  let cookie;
  const call = async (route, body) => {
    const r = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.headers.has('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    const value = await r.json();
    assert.equal(r.status, 200, JSON.stringify(value));
    return value;
  };
  await call('auth/login', { username: 'pack_http', password: 'test-password-123' });
  const results = await Promise.all([
    call('achievements/redeem', { code: '我愛作者' }),
    call('achievements/redeem', { code: '我愛作者' }),
  ]);
  assert.deepEqual(results.map((r) => r.redemption.alreadyRedeemed).sort(), [false, true]);
  assert.deepEqual(results[0].redemption.rewards, results[1].redemption.rewards);
  const state = await call('gacha');
  assert.equal(state.rewardTickets, 300);
  const input = { requestId: randomUUID(), pool: 'arrival', count: 10, useTickets: true };
  const [a, b] = await Promise.all([call('gacha/draw', input), call('gacha/draw', input)]);
  assert.deepEqual(a, b);
  assert.equal(a.cost, 0);
  assert.equal(a.ticketCost, 10);
  const after = await call('gacha');
  assert.equal(after.rewardTickets, 290);
  assert.equal(after.wallet.coins, state.wallet.coins);
  await call('achievements/redeem', { code: '新手大禮包' });
  assert.equal((await call('gacha')).rewardTickets, 390);
});
