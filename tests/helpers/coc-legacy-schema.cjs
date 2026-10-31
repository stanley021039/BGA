const { COC_TABLES } = require('../../src/coc/schema');

// Historical fixtures must omit the new feature, rather than relabel schema 21.
// Check every table before removing any; never discard a populated adventure.
function dropEmptyCocTables(db) {
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_schema WHERE type='table'")
      .all()
      .map((row) => row.name),
  );
  for (const table of COC_TABLES)
    if (tables.has(table) && db.prepare('SELECT COUNT(*) n FROM ' + table).get().n)
      throw Error('Legacy fixture must not discard COC records');
  for (const table of [...COC_TABLES].reverse())
    if (tables.has(table)) db.exec('DROP TABLE ' + table);
}
module.exports = { dropEmptyCocTables };
