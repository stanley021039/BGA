const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { AchievementStore } = require('../src/achievements/store');
const { GachaStore } = require('../src/gacha/store');
const starter = require('../src/achievements/starter-rewards');
const Packs = require('../src/achievements/code-packs');
const { catalog } = require('../src/gacha/catalog');
const Settings = require('../src/profiles/settings');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const user = randomUUID();
  db.prepare(
    'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(user, 'starter', '新手', 'unused', 'member', new Date().toISOString());
  return { db, user, store: new AchievementStore(db) };
}
test('new starter gives one usable item per category and 100 deferred draws, without author buffs or fake achievements', (t) => {
  const { db, user, store } = fixture(t),
    result = store.redeem(user, '新手大禮包');
  const pack = Packs.receipts(db, user).starter;
  assert.equal(pack.draws, 100);
  assert.equal(pack.rewards.length, 5);
  assert.ok(pack.rewards.every((r) => r.items.length === 1));
  const frame = pack.rewards.find((r) => r.key === 'frames').items[0].id;
  assert.doesNotThrow(() => store.assertFrame(user, frame));
  const other = catalog.find((r) => r.kind === 'frames' && r.id !== frame);
  assert.throws(() => store.assertFrame(user, other.id), { code: 'FRAME_LOCKED' });
  const attack = pack.rewards.find((r) => r.key === 'attacks').items[0].id;
  assert.equal(Settings.setAttackSettings(db, user, { q: attack, e: 'beam', r: '' }).q, attack);
  const profile = Settings.getProfileSettings(db, user);
  Settings.setProfileSettings(db, user, profile);
  assert.deepEqual(Packs.receipts(db, user).starter, pack);
  assert.deepEqual(
    Settings.preserveAvatar(db, user, profile.appearance).rewardCodePacks.starter,
    pack,
  );
  assert.deepEqual(require('../src/achievements/redemption').grants(db, user), {});
  assert.equal(result.achievements.filter((a) => a.unlockedAt).length, 0);
  assert.equal(store.redeem(user, '新手大禮包').redemption.alreadyRedeemed, true);
});
test('exhausted categories still grant one receipt item each and convert repeats into fragments', (t) => {
  const { db, user, store } = fixture(t);
  for (const item of catalog)
    db.prepare("INSERT INTO gacha_ownership VALUES(?,?,?,'draw',?)").run(
      user,
      item.kind,
      item.id,
      new Date().toISOString(),
    );
  const result = store.redeem(user, '新手大禮包').redemption;
  assert.ok(result.rewards.every((row) => row.items.length === 1 && row.items[0].duplicate));
  assert.equal(
    new GachaStore(db).wallet(user).fragments,
    result.rewards.reduce((n, r) => n + r.items[0].fragments, 0),
  );
  assert.equal(Packs.availableTickets(db, user), 100);
});
test('legacy starter receipts stay capped and preserved rather than receiving the new pack again', (t) => {
  const { db, user, store } = fixture(t),
    pools = starter.catalog(),
    grants = {};
  for (const [key, limit] of Object.entries(starter.limits))
    grants[key] = pools[key].slice(0, limit).map((e) => e.id);
  const profile = Settings.getProfileSettings(db, user);
  const legacy = { version: 1, redeemedAt: new Date().toISOString(), grants };
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ ...profile.appearance, starterRewardPack: legacy }),
    user,
  );
  assert.deepEqual(starter.receipt(db, user), legacy);
  assert.equal(store.redeem(user, '新手大禮包').redemption.alreadyRedeemed, true);
  assert.equal(Packs.availableTickets(db, user), 0);
  Settings.setProfileSettings(db, user, Settings.getProfileSettings(db, user));
  assert.deepEqual(starter.receipt(db, user), legacy);
  assert.throws(() => store.redeem(user, '新手大禮包2'), { code: 'INVALID_REWARD_CODE' });
});
