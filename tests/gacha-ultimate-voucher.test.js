'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { GachaStore } = require('../src/gacha/store');
const { validateGachaDatabase } = require('../src/gacha/validation');
const { fitsSlot } = require('../src/rooms/scene-energy');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const user = randomUUID();
  db.prepare(
    'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(user, 'ultimate', '測試', 'unused', 'member', '2026-10-01T00:00:00.000Z');
  return {
    db,
    user,
    store: new GachaStore(db, {
      clock: () => Date.parse('2026-11-23T00:00:00.000Z'),
      choose: () => 0,
    }),
  };
}
test('one recorded login unlocks a manually claimed ultimate voucher without charging currencies or changing pity', (t) => {
  const { db, user, store } = fixture(t);
  assert.equal(store.checkin(user).ultimate.status, 'locked');
  const input = { requestId: randomUUID(), pool: 'attacks', count: 1, ultimateVoucher: true };
  assert.throws(() => store.draw(user, input), { code: 'GACHA_ULTIMATE_VOUCHER_REQUIRED' });
  store.daily(user);
  assert.equal(store.checkin(user).ultimate.status, 'claimable');
  assert.equal(store.checkin(user).epicTen.status, 'locked');
  assert.equal(store.checkin(user).milestone.status, 'locked');
  assert.equal(store.claimCheckin(user, 'ultimate').ultimate.status, 'available');
  assert.equal(store.claimCheckin(user, 'ultimate').ultimate.status, 'available');
  const before = store.wallet(user);
  const result = store.draw(user, input);
  assert.equal(result.cost, 0);
  assert.equal(result.ultimateVoucher, true);
  assert.equal(result.drawCount, 0);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].kind, 'attacks');
  assert.ok(fitsSlot('r', result.results[0].id));
  assert.deepEqual(result.wallet, before);
  assert.deepEqual(store.draw(user, input), result);
  assert.equal(store.checkin(user).ultimate.status, 'used');
  assert.equal(store.claimCheckin(user, 'ultimate').ultimate.status, 'used');
  assert.equal(store.drawCounts(user).get('attacks') ?? 0, 0);
  assert.throws(() => store.draw(user, { ...input, requestId: randomUUID() }), {
    code: 'GACHA_ULTIMATE_VOUCHER_REQUIRED',
  });
  assert.doesNotThrow(() => validateGachaDatabase(db));
  // A missing claim cannot be accepted as a valid restored free-draw receipt.
  db.prepare('DELETE FROM gacha_ledger WHERE event_id=?').run('checkin-ultimate-claim:' + user);
  assert.throws(() => validateGachaDatabase(db), /ultimate voucher/);
});
for (const legacy of ['login', 'checkin'])
  test(legacy + ' history can backfill the new voucher once', (t) => {
    const { db, user, store } = fixture(t);
    for (let day = 1; day <= 8; day++) {
      const date = '2026-10-' + String(day).padStart(2, '0');
      const event = legacy + ':' + date + ':' + user;
      store.ledger(event, user, 'login', 0, 0, digest({ event }), date + 'T00:00:00.000Z');
    }
    assert.equal(store.checkin(user).visits, 8);
    assert.equal(store.checkin(user).ultimate.status, 'claimable');
    assert.equal(store.claimCheckin(user, 'ultimate').ultimate.status, 'available');
    assert.equal(new GachaStore(db).claimCheckin(user, 'ultimate').ultimate.status, 'available');
    assert.equal(
      db
        .prepare('SELECT count(*) n FROM gacha_ledger WHERE event_id=?')
        .get('checkin-ultimate-claim:' + user).n,
      1,
    );
  });
test('ultimate voucher rejects mixed payment, non-ultimate pools and ten draws without consuming the claim', (t) => {
  const { db, user, store } = fixture(t);
  store.claimCheckin(user, 'ultimate');
  const input = { requestId: randomUUID(), pool: 'attacks', count: 1, ultimateVoucher: true };
  for (const override of [
    { pool: 'all' },
    { pool: 'sounds' },
    { count: 10 },
    { voucher: true },
    { thirdLogin: true },
    { useTickets: true },
    { ultimateVoucher: false },
  ])
    assert.throws(() => store.draw(user, { ...input, ...override }), {
      code: 'INVALID_GACHA_DRAW',
    });
  assert.equal(store.checkin(user).ultimate.status, 'available');
  assert.equal(db.prepare('SELECT count(*) n FROM gacha_requests').get().n, 0);
  assert.doesNotThrow(() => validateGachaDatabase(db));
});
test('HTTP simultaneous claim and draw retries grant and consume exactly one ultimate voucher', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('ultimate_http', 'test-password-123'),
  });
  let cookie;
  const call = async (route, body) => {
    const res = await fetch(base + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.headers.has('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, body: await res.json() };
  };
  assert.equal(
    (await call('auth/login', { username: 'ultimate_http', password: 'test-password-123' })).status,
    200,
  );
  assert.equal((await call('gacha/check-in')).body.ultimate.status, 'claimable');
  const claims = await Promise.all([
    call('gacha/check-in', { kind: 'ultimate' }),
    call('gacha/check-in', { kind: 'ultimate' }),
  ]);
  assert.ok(claims.every((r) => r.status === 200 && r.body.ultimate.status === 'available'));
  const before = (await call('gacha')).body;
  const input = { requestId: randomUUID(), pool: 'attacks', count: 1, ultimateVoucher: true };
  const [a, b] = await Promise.all([call('gacha/draw', input), call('gacha/draw', input)]);
  assert.equal(a.status, 200);
  assert.deepEqual(a, b);
  assert.ok(fitsSlot('r', a.body.results[0].id));
  const after = (await call('gacha')).body;
  assert.equal(after.wallet.coins, before.wallet.coins);
  assert.equal(after.rewardTickets, before.rewardTickets);
  assert.equal(after.ultimateVoucherAvailable, false);
  assert.equal((await call('gacha/draw', { ...input, requestId: randomUUID() })).status, 409);
  assert.equal((await call('gacha/check-in', { kind: 'ultimate', days: 1 })).status, 400);
});
