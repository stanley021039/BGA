'use strict';
const Ownership = require('./ownership');
const completeKey = 'susanoo_blue_split_v1';
const retainedKey = (userId) => 'susanoo_blue_retained:' + userId;
// Snapshot existing entitlement once, before the app accepts future draws.
// Separate receipts avoid inventing a draw/exchange or changing wallet balances.
function retainExistingMadara(db, at) {
  if (!Ownership.enabled(db)) return;
  const existing = db.prepare('SELECT value FROM gacha_settings WHERE name=?').get(completeKey);
  if (existing) {
    if (!Ownership.validAt(existing.value)) throw Error('Invalid Susanoo split receipt');
    return;
  }
  db.exec('SAVEPOINT retain_madara');
  try {
    if (!db.prepare('SELECT 1 FROM gacha_settings WHERE name=?').get(completeKey)) {
      const save = db.prepare('INSERT OR IGNORE INTO gacha_settings(name,value) VALUES(?,?)');
      for (const user of db.prepare('SELECT id FROM users').iterate()) {
        if (Ownership.ownedIds(db, user.id, 'attacks').includes('susanoo_alt'))
          save.run(retainedKey(user.id), at);
      }
      save.run(completeKey, at);
    }
    db.exec('RELEASE retain_madara');
  } catch (error) {
    db.exec('ROLLBACK TO retain_madara; RELEASE retain_madara');
    throw error;
  }
}
module.exports = { retainExistingMadara, retainedKey };
