'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { openDatabase } = require('../src/db');
const { AchievementStore, definitions } = require('../src/achievements/store');
const { rewards } = require('../src/achievements/rewards');
function unlockPlaytestRewards(dbFile) {
  const work = fs.realpathSync(path.resolve(__dirname, '../work'));
  const file = fs.realpathSync(dbFile),
    relative = path.relative(work, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('僅允許獨立 work 試玩資料庫');
  const marker = JSON.parse(
    fs.readFileSync(path.join(path.dirname(file), '.bga-playtest.json'), 'utf8'),
  );
  if (marker.purpose !== 'isolated-playtest') throw Error('缺少獨立試玩資料標記');
  const db = openDatabase(file);
  try {
    const store = new AchievementStore(db),
      users = db.prepare('SELECT id FROM users WHERE disabled=0').all();
    // Preview all rewards without inserting fabricated gameplay achievements.
    for (const user of users)
      for (const item of require('../src/achievements/redemption').codes)
        store.redeem(user.id, item.code);
    return {
      players: users.length,
      achievementDefinitions: definitions.length,
      frames: rewards.length,
    };
  } finally {
    db.close();
  }
}
module.exports = { unlockPlaytestRewards };
if (require.main === module) {
  try {
    console.log(JSON.stringify(unlockPlaytestRewards(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
