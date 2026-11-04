'use strict';
// Called inside schema migration, before the server accepts any new achievements.
// No require('../db') here: the migration transaction is already open.
function snapshotLegacyRewards(db, at = new Date().toISOString()) {
  if (db.prepare("SELECT 1 FROM gacha_settings WHERE name='legacy_imported_at'").get()) return;
  const { catalog } = require('./catalog');
  const insert = db.prepare(
    "INSERT OR IGNORE INTO gacha_ownership(user_id,kind,reward_id,source,acquired_at) VALUES(?,?,?,'legacy',?)",
  );
  for (const user of db.prepare('SELECT id FROM users').all()) {
    const earned = new Set(
      db
        .prepare('SELECT achievement_id FROM user_achievements WHERE user_id=?')
        .all(user.id)
        .map((r) => r.achievement_id),
    );
    const claimed = new Set(
      db
        .prepare('SELECT frame_id FROM user_cosmetic_rewards WHERE user_id=?')
        .all(user.id)
        .map((r) => r.frame_id),
    );
    for (const item of catalog)
      if (
        item.legacy &&
        (item.achievementIds.some((id) => earned.has(id)) ||
          (['frames', 'media'].includes(item.kind) && claimed.has(item.id)))
      )
        insert.run(user.id, item.kind, item.id, at);
    if (earned.has('all-three-games')) insert.run(user.id, 'openings', 'soul-world', at);
  }
  db.prepare('INSERT INTO gacha_settings(name,value) VALUES(?,?)').run('legacy_imported_at', at);
}
module.exports = { snapshotLegacyRewards };
