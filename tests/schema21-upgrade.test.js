'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase, SCHEMA_VERSION } = require('../src/db');
const { MATCH_EVENT_SQL_V22 } = require('../src/achievements/reward-schema');
const { dropEmptyGachaTables } = require('./helpers/pre-gacha-schema.cjs');

// Production databases at schema 21/22 carry the shorter schema 20-22 game list
// in achievement_match_events; the check before upgrading must accept it.
function legacyDatabase(t, version, matchEventSql = MATCH_EVENT_SQL_V22) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-schema21-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'app.sqlite');
  openDatabase(file).close();
  const db = new DatabaseSync(file);
  db.exec(`DROP TABLE achievement_match_events; ${matchEventSql};`);
  const insert = db.prepare('INSERT INTO achievement_match_events VALUES (?,?,?,?,?,?)');
  insert.run('event-1', 'quacks', '2026-10-20T00:00:00Z', 'production', 'a'.repeat(64), '{}');
  insert.run('event-2', 'bluff', '2026-10-21T00:00:00Z', 'production', 'b'.repeat(64), '{"x":1}');
  if (version < 22) dropEmptyGachaTables(db);
  db.exec(`PRAGMA user_version=${version}`);
  db.close();
  return file;
}

for (const version of [21, 22])
  test(`a schema ${version} database with its own match-event table upgrades and keeps records`, (t) => {
    const file = legacyDatabase(t, version);
    const db = openDatabase(file);
    try {
      assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
      assert.deepEqual(
        db
          .prepare('SELECT event_id, game_type FROM achievement_match_events ORDER BY event_id')
          .all()
          .map((r) => ({ ...r })),
        [
          { event_id: 'event-1', game_type: 'quacks' },
          { event_id: 'event-2', game_type: 'bluff' },
        ],
      );
      db.prepare('INSERT INTO achievement_match_events VALUES (?,?,?,?,?,?)').run(
        'event-3',
        'arena',
        '2026-11-10T00:00:00Z',
        'production',
        'c'.repeat(64),
        '{}',
      );
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    } finally {
      db.close();
    }
  });

test('an altered match-event table at schema 21 is still refused', (t) => {
  const file = legacyDatabase(t, 21, MATCH_EVENT_SQL_V22.replace("'trpg'", "'trpg','poker'"));
  assert.throws(() => openDatabase(file), /Invalid achievement_match_events constraints/);
  const db = new DatabaseSync(file);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 21, 'nothing was migrated');
  } finally {
    db.close();
  }
});
