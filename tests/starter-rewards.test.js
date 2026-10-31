'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { AchievementStore } = require('../src/achievements/store');
const starter = require('../src/achievements/starter-rewards');
const {
  getProfileSettings,
  setProfileSettings,
  preserveAvatar,
  setAttackSettings,
} = require('../src/profiles/settings');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const users = [randomUUID(), randomUUID()];
  users.forEach((id, i) =>
    db
      .prepare(
        'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
      )
      .run(id, 'starter' + i, '新手', 'unused', 'member', new Date().toISOString()),
  );
  return { db, users, store: new AchievementStore(db) };
}
test('starter awards 5 entrances/attacks, 3 per other available category, without achievements or author buffs; replay and account isolation', (t) => {
  const {
    db,
    users: [a, b],
    store,
  } = fixture(t);
  const first = store.redeem(a, ' 新手大禮包 ');
  const pack = starter.receipt(db, a);
  const appearance = JSON.parse(
    db.prepare('SELECT appearance FROM users WHERE id=?').get(a).appearance,
  );
  assert.doesNotThrow(
    () => require('../src/profiles/appearance').selectedImage(db, a, appearance),
    'first redemption retains a valid character for /api/auth/me and the lobby',
  );
  for (const [key, count] of Object.entries(starter.limits)) {
    assert.equal(pack.grants[key].length, key === 'pingIcons' ? 0 : count, key);
    assert.equal(new Set(pack.grants[key]).size, pack.grants[key].length);
  }
  assert.equal(first.redemption.alreadyRedeemed, false);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM user_achievements').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM user_cosmetic_rewards').get().n, 0);
  assert.deepEqual(require('../src/achievements/redemption').grants(db, a), {});
  assert.equal(require('../src/achievements/redemption').redeemedAt(db, a, 'other'), null);
  assert.equal(starter.receipt(db, b), null);
  assert.equal(store.list(b).bonusRewards.attacks.length, 2);
  const replay = new AchievementStore(db).redeem(a, '新手大禮包');
  assert.deepEqual(replay.redemption.rewards, first.redemption.rewards);
  assert.equal(replay.redemption.redeemedAt, first.redemption.redeemedAt);
  assert.equal(replay.redemption.alreadyRedeemed, true);
  assert.deepEqual(starter.receipt(db, a), pack);
  for (const key of ['entrances', 'attacks', 'sounds', 'backgrounds'])
    for (const id of pack.grants[key])
      assert.ok(first.bonusRewards[key].includes(id), key + ':' + id);
  assert.deepEqual(
    require('../src/achievements/bonus-rewards').ownedSounds(db, a).sort(),
    pack.grants.sounds.slice().sort(),
  );
  for (const id of pack.grants.frames) store.assertFrame(a, id);
  const unownedFrame = starter.catalog().frames.find((r) => !pack.grants.frames.includes(r.id));
  assert.throws(() => store.assertFrame(a, unownedFrame.id), { code: 'FRAME_LOCKED' });
  assert.equal(first.rewards.filter((r) => r.claimedAt).length, 3);
  assert.equal(first.rewards.filter((r) => r.mediaClaimedAt).length, 3);
  const { fitsSlot } = require('../src/rooms/scene-energy');
  const loadoutFor = (id) =>
    fitsSlot('r', id) ? { q: 'barrage', e: 'beam', r: id } : { q: id, e: 'beam', r: '' };
  for (const id of pack.grants.attacks) {
    const loadout = loadoutFor(id);
    assert.deepEqual(setAttackSettings(db, a, loadout), loadout);
  }
  const unownedAttack = starter.catalog().attacks.find((r) => !pack.grants.attacks.includes(r.id));
  assert.throws(() => setAttackSettings(db, a, loadoutFor(unownedAttack.id)), {
    code: 'ATTACK_REWARD_LOCKED',
  });
  const profile = getProfileSettings(db, a);
  setProfileSettings(db, a, {
    ...profile,
    starterRewardPack: { version: 1, grants: { attacks: ['all'] } },
  });
  assert.deepEqual(starter.receipt(db, a), pack);
  assert.deepEqual(preserveAvatar(db, a, profile.appearance).starterRewardPack, pack);
  assert.equal(require('../src/achievements/reward-store').validateRewardsDatabase(db), true);
});
test('starter excludes previously earned rewards, handles exhausted pools and never replaces old code grants', (t) => {
  const {
    db,
    users: [a, b],
    store,
  } = fixture(t);
  for (const code of ['我愛少華', '我愛其學', '我愛士憲', '我愛作者']) store.redeem(a, code);
  const before = require('../src/achievements/redemption').grants(db, a);
  const full = store.redeem(a, '新手大禮包');
  assert.ok(full.redemption.rewards.every((r) => r.items.length === 0));
  assert.deepEqual(require('../src/achievements/redemption').grants(db, a), before);
  const earned = 'gift-first-gift';
  store.insert.run(b, earned, 'quacks:test', new Date().toISOString());
  const ownedBefore = store.list(b).bonusRewards;
  store.redeem(b, '新手大禮包');
  const pack = starter.receipt(db, b);
  for (const key of ['entrances', 'attacks', 'sounds', 'backgrounds'])
    assert.ok(pack.grants[key].every((id) => !ownedBefore[key].includes(id)));
  assert.equal(store.list(b).achievements.filter((r) => r.unlockedAt).length, 1);
  const snapshot = starter.receipt(db, b);
  store.redeem(b, '我愛作者');
  assert.deepEqual(starter.receipt(db, b), snapshot);
});
test('starter handles fewer than five remaining attacks and rejects unavailable accounts / forged profile metadata', (t) => {
  const {
    db,
    users: [a, b],
    store,
  } = fixture(t);
  const effects = starter.catalog().attacks;
  for (const id of new Set(effects.slice(0, -1).map((r) => r.achievementId)))
    store.insert.run(a, id, 'quacks:test', new Date().toISOString());
  const missing = effects.filter((r) => !store.list(a).bonusRewards.attacks.includes(r.id));
  store.redeem(a, '新手大禮包');
  assert.deepEqual(
    starter.receipt(db, a).grants.attacks,
    missing.map((r) => r.id),
  );
  const profile = getProfileSettings(db, b);
  setProfileSettings(db, b, {
    ...profile,
    appearance: { ...profile.appearance, starterRewardPack: starter.receipt(db, a) },
    starterRewardPack: starter.receipt(db, a),
  });
  assert.equal(starter.receipt(db, b), null);
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(b);
  assert.throws(() => store.redeem(b, '新手大禮包'), { code: 'REWARD_CODE_UNAVAILABLE' });
  assert.throws(() => store.redeem(a, '新手大禮包2'), { code: 'INVALID_REWARD_CODE' });
});
