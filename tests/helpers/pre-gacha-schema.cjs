'use strict';
// Reconstruct the actual pre21 scaffold. Never discard actual currency or prizes.
function dropEmptyGachaTables(db) {
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name),
  );
  const names = [
    'gacha_requests',
    'gacha_ledger',
    'gacha_ownership',
    'gacha_wallets',
    'gacha_settings',
  ];
  for (const name of names.filter((n) => n !== 'gacha_settings'))
    if (tables.has(name) && db.prepare('SELECT COUNT(*) n FROM ' + name).get().n)
      throw Error('Legacy fixture must not discard gacha records');
  if (
    tables.has('gacha_settings') &&
    db.prepare("SELECT COUNT(*) n FROM gacha_settings WHERE name!='legacy_imported_at'").get().n
  )
    throw Error('Legacy fixture must not discard gacha settings');
  for (const name of names) if (tables.has(name)) db.exec('DROP TABLE ' + name);
}
function preGachaSchema(db) {
  dropEmptyGachaTables(db);
  db.exec('PRAGMA user_version=20');
  return db;
}
module.exports = { dropEmptyGachaTables, preGachaSchema };
