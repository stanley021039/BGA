'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { openDatabase } = require('../src/db'),
  { AchievementStore } = require('../src/achievements/store');
const { unlockPlaytestRewards } = require('../tools/playtest-rewards.cjs');
test('isolated playtests unlock only rewards and preserve real achievement progress and reward dates', (t) => {
  fs.mkdirSync(path.resolve(__dirname, '../work'), { recursive: true });
  const work = fs.realpathSync(path.resolve(__dirname, '../work')),
    root = fs.mkdtempSync(path.join(work, 'test-unlocked-rewards-')),
    file = path.join(root, 'test.sqlite');
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), work);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const db = openDatabase(file),
    id = randomUUID();
  db.prepare(
    'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
  ).run(
    id,
    'all_rewards_test',
    '測試',
    'synthetic-disabled-password',
    'member',
    new Date().toISOString(),
  );
  db.close();
  assert.throws(() => unlockPlaytestRewards(file), /bga-playtest/);
  fs.writeFileSync(
    path.join(root, '.bga-playtest.json'),
    JSON.stringify({ purpose: 'isolated-playtest' }),
  );
  const result = unlockPlaytestRewards(file);
  assert.equal(result.achievementDefinitions, 70);
  assert.equal(result.frames, 24);
  const check = openDatabase(file),
    store = new AchievementStore(check),
    first = store.list(id);
  assert.ok(first.achievements.every((achievement) => !achievement.unlockedAt));
  assert.ok(first.rewards.every((reward) => reward.claimedAt));
  assert.equal(first.bonusRewards.entrances.length, 24);
  assert.equal(first.bonusRewards.backgrounds.length, 10);
  assert.deepEqual(first.bonusRewards.openings, ['home-family', 'soul-world']);
  store.insert.run(id, 'all-first-table', 'fixture-real-game', new Date().toISOString());
  check.close();
  unlockPlaytestRewards(file);
  const reopened = openDatabase(file);
  const again = new AchievementStore(reopened).list(id);
  assert.deepEqual(
    again.achievements.filter((a) => a.unlockedAt).map((a) => a.id),
    ['all-first-table'],
  );
  assert.deepEqual(
    again.rewards.map((a) => a.claimedAt),
    first.rewards.map((a) => a.claimedAt),
  );
  reopened.close();
});
