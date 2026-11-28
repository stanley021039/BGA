const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

test('a fresh account can claim the Boss code before saving any appearance and still reload its session', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('fresh_boss_http', 'test-password-123'),
  });
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'fresh_boss_http', password: 'test-password-123' }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const claim = await fetch(base + '/api/achievements/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ code: '野獸前輩' }),
  });
  assert.equal(claim.status, 200);
  for (const route of ['auth/me', 'profile/settings', 'lobby']) {
    const response = await fetch(base + '/api/' + route, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200, route + ': ' + (await response.text()));
  }
});
test('Boss code is one-time, protected from profile edits and independent of training and arena settings', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('boss_http', 'test-password-123'),
  });
  let cookie;
  const call = async (route, body, status = 200) => {
    const r = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (r.headers.has('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    const value = await r.json();
    assert.equal(r.status, status, JSON.stringify(value));
    return value;
  };
  await call('auth/login', { username: 'boss_http', password: 'test-password-123' });
  assert.equal((await call('lobby/self-boss')).unlocked, false);
  await call('lobby/self-boss', { action: 'select', bossId: 'colossal' }, 403);
  const profile = await call('profile/settings');
  await call('profile/settings', {
    ...profile,
    bossControlGrantedAt: new Date().toISOString(),
    controlledBossId: 'colossal',
  });
  assert.equal((await call('lobby/self-boss')).unlocked, false);
  const grants = await Promise.all([
    call('achievements/redeem', { code: '野獸前輩' }),
    call('achievements/redeem', { code: '野獸前輩' }),
  ]);
  assert.deepEqual(grants.map((x) => x.redemption.alreadyRedeemed).sort(), [false, true]);
  assert.equal(grants[0].redemption.redeemedAt, grants[1].redemption.redeemedAt);
  assert.equal((await call('gacha')).rewardTickets, 0);
  assert.equal((await call('lobby/self-boss')).catalog.length, 13);
  await call('lobby/self-boss', { action: 'select', bossId: 'colossal' });
  let snapshot = await call('lobby');
  let self = snapshot.visitors.find((v) => v.id === snapshot.selfId);
  assert.equal(self.controlledBoss, true);
  assert.equal(self.bossId, 'colossal');
  assert.equal(self.energyMaximum, 100);
  await call('profile/settings', profile);
  assert.equal(
    (await call('lobby/self-boss')).selected,
    'colossal',
    'normal profile updates preserve the grant and selected Boss',
  );
  await call('lobby/self-boss?training=1', { action: 'select', bossId: 'cthulhu' });
  assert.equal((await call('lobby/self-boss?training=1')).selected, 'cthulhu');
  assert.equal((await call('lobby/self-boss')).selected, 'colossal');
  await call('lobby/self-boss?arena=1', undefined, 403);
  await call('lobby/self-boss', { action: 'select', bossId: null });
  assert.equal((await call('lobby/self-boss')).selected, null);
  snapshot = await call('lobby');
  self = snapshot.visitors.find((v) => v.id === snapshot.selfId);
  assert.equal(self.bossId, undefined);
  await call('lobby/self-boss', { action: 'reset' }, 409);
});
