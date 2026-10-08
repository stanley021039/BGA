// Actual pre17 market definitions, independent of the current production SQL.
// Tests must reconstruct the historical columns instead of merely relabeling a
// current database and teaching the production validator to accept forged v16.
const LEGACY_SQL={
 market_rounds:`CREATE TABLE market_rounds(id TEXT PRIMARY KEY,target_date TEXT NOT NULL UNIQUE,cutoff_at TEXT NOT NULL,settlement_after TEXT NOT NULL,rules_json TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,result_revision INTEGER NOT NULL DEFAULT 0 CHECK(result_revision>=0),return_pct REAL,result_bucket TEXT)`,
 market_settlements:`CREATE TABLE market_settlements(round_id TEXT NOT NULL REFERENCES market_rounds(id),revision INTEGER NOT NULL CHECK(revision>0),return_pct REAL NOT NULL,bucket TEXT NOT NULL,reason TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,PRIMARY KEY(round_id,revision))`,
};
const CURVE_TABLES=['market_curve_ledger','market_forecasts'];
function dropEmptyCurveTables(db){
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 // Check every table before dropping any, so a failed fixture cannot lose data.
 for(const table of CURVE_TABLES)if(tables.has(table)&&db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n)throw Error('Legacy fixture must not discard curve records');
 for(const table of CURVE_TABLES)if(tables.has(table))db.exec(`DROP TABLE ${table}`);
}
// Explicit historical-round setup for old six-bucket behavior. Production round
// creation always uses the current numeric rules; never alter a populated round.
function useLegacyRoundSnapshot(db,roundId,rules=require('../../public/market-rules').snapshot()){
 const R=require('../../public/market-rules'),round=db.prepare('SELECT * FROM market_rounds WHERE id=?').get(roundId);
 if(!round||round.result_revision||![1,2].includes(rules.version))throw Error('Legacy fixture requires an empty round and historical rules');
 R.validate(rules);
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 for(const table of ['market_votes','market_settlements','market_ledger',...CURVE_TABLES])if(tables.has(table)&&db.prepare(`SELECT 1 FROM ${table} WHERE round_id=?`).get(roundId))throw Error('Legacy fixture must not rewrite populated round history');
 db.prepare('UPDATE market_rounds SET rules_json=?,cutoff_at=?,settlement_after=? WHERE id=?').run(JSON.stringify(rules),R.cutoffFor(round.target_date,rules),R.settlementFor(round.target_date,rules),roundId);
 return roundId;
}
const AUTOMATION_TABLES=['market_daily_closes','market_calendar_years','market_calendar_overrides','market_fetch_audit','market_automation_state'];
function legacyMarketSchema(db,{preserveAchievements=false}={}){
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 const foreignKeys=db.prepare('PRAGMA foreign_keys').get().foreign_keys;
 db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
 try{
  dropEmptyCurveTables(db);
  if(!preserveAchievements)for(const table of ['achievement_progress','processed_unit_events'])if(tables.has(table)){if(db.prepare('SELECT COUNT(*) n FROM '+table).get().n)throw Error('Legacy fixture must not discard achievement records');db.exec('DROP TABLE '+table);}
  for(const table of AUTOMATION_TABLES)if(tables.has(table)){
   if(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n)throw Error('Legacy fixture must not discard automation records');
   db.exec(`DROP TABLE ${table}`);
  }
  for(const [table,sql] of Object.entries(LEGACY_SQL)){
   if(!tables.has(table)||!db.prepare(`PRAGMA table_info(${table})`).all().some(column=>column.name==='actor_source'))continue;
   if(db.prepare(`SELECT 1 FROM ${table} WHERE actor_source!='user' OR created_by IS NULL${table==='market_rounds'?' OR void_reason IS NOT NULL OR void_at IS NOT NULL':''}`).get())throw Error('Legacy fixture cannot contain system actors or void rounds');
   const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(column=>column.name).filter(name=>!['actor_source','void_reason','void_at'].includes(name)).join(',');
   db.exec(sql.replace(`CREATE TABLE ${table}(`,`CREATE TABLE ${table}_legacy(`));
   db.exec(`INSERT INTO ${table}_legacy(rowid,${columns}) SELECT rowid,${columns} FROM ${table} ORDER BY rowid; DROP TABLE ${table}; ALTER TABLE ${table}_legacy RENAME TO ${table}`);
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 finally{db.exec(`PRAGMA foreign_keys=${foreignKeys}`);}
}
function upgradedMarketRows(table,rows){return rows.map(row=>Object.assign(Object.create(Object.getPrototypeOf(row)),row,table==='market_rounds'?{actor_source:'user',void_reason:null,void_at:null}:table==='market_settlements'?{actor_source:'user'}:{}));}
module.exports={legacyMarketSchema,upgradedMarketRows,useLegacyRoundSnapshot,dropEmptyCurveTables,LEGACY_SQL,AUTOMATION_TABLES,CURVE_TABLES};
