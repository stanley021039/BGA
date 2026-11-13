const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { AchievementStore } = require('../src/achievements/store');
const { GachaStore } = require('../src/gacha/store');
const Packs = require('../src/achievements/code-packs');
const { catalog } = require('../src/gacha/catalog');
const { fitsSlot } = require('../src/rooms/scene-energy');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const users = [randomUUID(), randomUUID()];
  for (const [i, id] of users.entries())
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(id, 'pack' + i, '玩家', 'unused', 'member', new Date().toISOString());
  return {
    db,
    user: users[0],
    other: users[1],
    store: new AchievementStore(db),
    gacha: new GachaStore(db, { choose: () => 0 }),
  };
}
test('both codes grant exact ticket amounts and five separate categories, without changing achievements or full backgrounds', (t) => {
  const { db, user, other, store } = fixture(t);
  const author = store.redeem(user, ' 我愛作者 ').redemption;
  assert.equal(author.draws, 300);
  assert.equal(author.rewards.length, 5);
  assert.deepEqual(
    author.rewards.map((r) => r.key),
    ['sounds', 'frames', 'media', 'entrances', 'attacks'],
  );
  assert.ok(fitsSlot('r', author.rewards[4].items[0].id));
  const start = store.redeem(user, '新手大禮包').redemption;
  assert.equal(start.draws, 100);
  assert.equal(start.rewards.length, 5);
  assert.ok(fitsSlot('q', start.rewards[4].items[0].id));
  assert.equal(Packs.availableTickets(db, user), 400);
  assert.equal(Packs.availableTickets(db, other), 0);
  assert.deepEqual(store.redeem(user, '我愛作者').redemption.rewards, author.rewards);
  assert.equal(store.redeem(user, '我愛作者').redemption.alreadyRedeemed, true);
  assert.equal(Packs.availableTickets(db, user), 400);
  assert.equal(db.prepare('SELECT count(*) n FROM user_achievements').get().n, 0);
  assert.ok(require('../src/achievements/redemption').grants(db, user).other);
  assert.deepEqual(require('../src/gacha/ownership').ownedIds(db, user, 'backgrounds'), []);
  const saved = JSON.parse(
    db.prepare('SELECT appearance FROM users WHERE id=?').get(user).appearance,
  );
  assert.doesNotThrow(() => require('../src/profiles/appearance').selectedImage(db, user, saved));
  assert.equal(
    db.prepare("SELECT count(*) n FROM gacha_ledger WHERE event_id LIKE 'reward-code-v2:%'").get()
      .n,
    2,
  );
});
test('an alternate phoenix gift does not unlock its original and ordinary gifts never select an ultimate', (t) => {
  const { db, user, store } = fixture(t);
  const pool = catalog.filter((item) => item.kind === 'attacks' && fitsSlot('r', item.id));
  let calls = 0;
  const r = Packs.redeem(store, user, 'author', {
    choose: () => (calls++ === 4 ? pool.findIndex((i) => i.id === 'solar_phoenix_alt') : 0),
  });
  assert.equal(r.redemption.rewards[4].items[0].id, 'solar_phoenix_alt');
  const owned = require('../src/achievements/attack-rewards').ownedAttacks(db, user);
  assert.ok(owned.includes('solar_phoenix_alt'));
  assert.ok(!owned.includes('solar_phoenix'));
});
test('ticket draws debit only tickets, retain normal fiftieth bonuses, and retry without double use', (t) => {
  const { db, user, store, gacha } = fixture(t);
  store.redeem(user, '新手大禮包');
  const input = { requestId: randomUUID(), pool: 'all', count: 10, useTickets: true };
  const before = gacha.wallet(user),
    first = gacha.draw(user, input);
  assert.equal(first.cost, 0);
  assert.equal(first.ticketCost, 10);
  assert.equal(first.rewardTickets, 90);
  assert.equal(gacha.wallet(user).coins, before.coins);
  assert.deepEqual(gacha.draw(user, input), first);
  assert.equal(Packs.availableTickets(db, user), 90);
  assert.throws(() => gacha.draw(user, { ...input, count: 1 }), { code: 'GACHA_REQUEST_CONFLICT' });
  for (let i = 0; i < 9; i++) gacha.draw(user, { ...input, requestId: randomUUID() });
  assert.equal(Packs.availableTickets(db, user), 0);
  assert.equal(gacha.drawCounts(user).get('all'), 100);
  assert.throws(() => gacha.draw(user, { ...input, requestId: randomUUID() }), {
    code: 'GACHA_TICKETS_REQUIRED',
  });
  assert.throws(() => gacha.draw(user, { ...input, requestId: randomUUID(), thirdLogin: true }), {
    code: 'INVALID_GACHA_DRAW',
  });
  assert.doesNotThrow(() => require('../src/gacha/validation').validateGachaDatabase(db));
});
test('profile edits preserve authentic packs and ignore client-supplied reward metadata', (t) => {
  const { db, user, other, store } = fixture(t);
  store.redeem(user, '我愛作者');
  const S = require('../src/profiles/settings');
  const before = Packs.receipts(db, user);
  const profile = S.getProfileSettings(db, user);
  S.setProfileSettings(db, user, {
    ...profile,
    appearance: { ...profile.appearance, rewardCodePacks: { author: { draws: 999999 } } },
  });
  assert.deepEqual(Packs.receipts(db, user), before);
  const clean = S.getProfileSettings(db, other);
  S.setProfileSettings(db, other, {
    ...clean,
    appearance: { ...clean.appearance, rewardCodePacks: before },
  });
  assert.equal(Packs.availableTickets(db, other), 0);
  assert.equal(S.preserveAvatar(db, user, profile.appearance).rewardCodePacks.author.draws, 300);
});
test('a failed random selection rolls the whole code claim back; disabled accounts cannot claim', (t) => {
  const { db, user, store } = fixture(t);
  let calls = 0;
  assert.throws(() =>
    Packs.redeem(store, user, 'author', { choose: (n) => (++calls === 3 ? n : 0) }),
  );
  assert.equal(Packs.availableTickets(db, user), 0);
  assert.equal(db.prepare('SELECT count(*) n FROM gacha_ownership').get().n, 0);
  assert.equal(
    db.prepare("SELECT count(*) n FROM gacha_ledger WHERE event_id LIKE 'reward-code-v2:%'").get()
      .n,
    0,
  );
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(user);
  assert.throws(() => store.redeem(user, '我愛作者'), { code: 'REWARD_CODE_UNAVAILABLE' });
});
test('legacy claims remain once-only; tampered pack receipts and orphan grants are rejected on restore', (t) => {
  const { db, user, other, store } = fixture(t);
  const at = new Date().toISOString();
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ achievementRewardCodes: { other: at } }),
    user,
  );
  assert.equal(store.redeem(user, '我愛作者').redemption.alreadyRedeemed, true);
  assert.equal(Packs.availableTickets(db, user), 0);
  store.redeem(other, '新手大禮包');
  const saved = JSON.parse(
    db.prepare('SELECT appearance FROM users WHERE id=?').get(other).appearance,
  );
  saved.rewardCodePacks.starter.draws = 101;
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(saved), other);
  assert.throws(() => Packs.validate(db), /receipt/);
  delete saved.rewardCodePacks;
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(saved), other);
  assert.throws(() => Packs.validate(db), /ledger/);
});
