const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {ACHIEVEMENT_TABLES,ACHIEVEMENT_SQL}=require('../achievements/schema');
const SCHEMA_VERSION=19;
const MARKET_CURVE_TABLES=['market_forecasts','market_curve_ledger'];
const MARKET_CURVE_SQL=[
 `CREATE TABLE IF NOT EXISTS market_forecasts(round_id TEXT NOT NULL REFERENCES market_rounds(id),user_id TEXT NOT NULL REFERENCES users(id),forecast_tick INTEGER NOT NULL CHECK(typeof(forecast_tick)='integer' AND forecast_tick BETWEEN -100 AND 100),revision INTEGER NOT NULL CHECK(revision>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(round_id,user_id))`,
 `CREATE TABLE IF NOT EXISTS market_curve_ledger(id TEXT PRIMARY KEY,round_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('award','reversal')),points_units INTEGER NOT NULL CHECK(typeof(points_units)='integer' AND points_units BETWEEN -100000000 AND 100000000),return_pct REAL NOT NULL,forecast_tick INTEGER NOT NULL CHECK(typeof(forecast_tick)='integer' AND forecast_tick BETWEEN -100 AND 100),reverses_revision INTEGER,FOREIGN KEY(round_id,revision) REFERENCES market_settlements(round_id,revision),UNIQUE(round_id,user_id,revision,kind),CHECK((kind='award' AND reverses_revision IS NULL) OR (kind='reversal' AND reverses_revision=revision-1)))`,
];
const MARKET_AUTOMATION_TABLES=['market_daily_closes','market_calendar_years','market_calendar_overrides','market_fetch_audit','market_automation_state'];
const MARKET_TABLES=['market_rounds','market_votes','market_settlements','market_ledger','market_requests'];
const MARKET_IMAGE_SQL=`CREATE TABLE IF NOT EXISTS market_images(
 id TEXT PRIMARY KEY,
 author_id TEXT NOT NULL REFERENCES users(id),
 author_name TEXT NOT NULL,
 mime TEXT NOT NULL CHECK(mime='image/png'),
 bytes BLOB NOT NULL CHECK(typeof(bytes)='blob' AND length(bytes) BETWEEN 1 AND 4194304),
 width INTEGER NOT NULL CHECK(typeof(width)='integer' AND width BETWEEN 1 AND 4096),
 height INTEGER NOT NULL CHECK(typeof(height)='integer' AND height BETWEEN 1 AND 4096),
 buckets_json TEXT NOT NULL CHECK(length(buckets_json)<=256 AND json_valid(buckets_json) AND json_type(buckets_json)='array' AND json_array_length(buckets_json) BETWEEN 1 AND 6),
 weekdays_json TEXT NOT NULL CHECK(length(weekdays_json)<=64 AND json_valid(weekdays_json) AND json_type(weekdays_json)='array' AND json_array_length(weekdays_json) BETWEEN 1 AND 7),
 version INTEGER NOT NULL CHECK(typeof(version)='integer' AND version IN (1,2)),
 status TEXT NOT NULL CHECK(status IN ('pending','approved')),
 created_at TEXT NOT NULL,
 approved_by TEXT REFERENCES users(id),
 approved_at TEXT,
 CHECK(width*height<=8000000),
 CHECK((status='pending' AND version=1 AND approved_by IS NULL AND approved_at IS NULL) OR (status='approved' AND version=2 AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
)`;
const SOUND_SQL=`CREATE TABLE IF NOT EXISTS character_sounds(
 character_id TEXT NOT NULL,expression TEXT NOT NULL,mime TEXT NOT NULL CHECK(mime='audio/wav'),bytes BLOB NOT NULL,
 duration_ms INTEGER NOT NULL CHECK(typeof(duration_ms)='integer' AND duration_ms BETWEEN 1 AND 10000),
 PRIMARY KEY(character_id,expression),
 FOREIGN KEY(character_id,expression) REFERENCES character_images(character_id,expression) ON DELETE CASCADE
)`;
const LEGACY_MARKET_SQL=[
 `CREATE TABLE IF NOT EXISTS market_rounds(id TEXT PRIMARY KEY,target_date TEXT NOT NULL UNIQUE,cutoff_at TEXT NOT NULL,settlement_after TEXT NOT NULL,rules_json TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,result_revision INTEGER NOT NULL DEFAULT 0 CHECK(result_revision>=0),return_pct REAL,result_bucket TEXT)`,
 `CREATE TABLE IF NOT EXISTS market_votes(round_id TEXT NOT NULL REFERENCES market_rounds(id),user_id TEXT NOT NULL REFERENCES users(id),option_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(round_id,user_id))`,
 `CREATE TABLE IF NOT EXISTS market_settlements(round_id TEXT NOT NULL REFERENCES market_rounds(id),revision INTEGER NOT NULL CHECK(revision>0),return_pct REAL NOT NULL,bucket TEXT NOT NULL,reason TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,PRIMARY KEY(round_id,revision))`,
 `CREATE TABLE IF NOT EXISTS market_ledger(id TEXT PRIMARY KEY,round_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('award','reversal')),points INTEGER NOT NULL,return_pct REAL NOT NULL,bucket TEXT NOT NULL,vote_option TEXT NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('hit','miss','tie')),reverses_revision INTEGER,FOREIGN KEY(round_id,revision) REFERENCES market_settlements(round_id,revision),UNIQUE(round_id,user_id,revision,kind),CHECK((kind='award' AND reverses_revision IS NULL) OR (kind='reversal' AND reverses_revision=revision-1)))`,
 `CREATE TABLE IF NOT EXISTS market_requests(user_id TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,operation TEXT NOT NULL,fingerprint TEXT NOT NULL,response_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,request_id))`,
];
const MARKET_SQL=LEGACY_MARKET_SQL.map(sql=>{
 if(sql.includes('CREATE TABLE IF NOT EXISTS market_rounds('))return sql
  .replace('created_by TEXT NOT NULL REFERENCES users(id)','created_by TEXT REFERENCES users(id)')
  .replace('result_bucket TEXT)',"result_bucket TEXT,actor_source TEXT NOT NULL DEFAULT 'user' CHECK(actor_source IN ('user','system')),void_reason TEXT,void_at TEXT,CHECK((actor_source='user' AND created_by IS NOT NULL) OR (actor_source='system' AND created_by IS NULL)),CHECK((void_reason IS NULL AND void_at IS NULL) OR (void_reason IS NOT NULL AND length(trim(void_reason)) BETWEEN 1 AND 240 AND void_at IS NOT NULL AND result_revision=0)))");
 if(sql.includes('CREATE TABLE IF NOT EXISTS market_settlements('))return sql
  .replace('created_by TEXT NOT NULL REFERENCES users(id)','created_by TEXT REFERENCES users(id)')
  .replace('PRIMARY KEY(round_id,revision))',"actor_source TEXT NOT NULL DEFAULT 'user' CHECK(actor_source IN ('user','system')),PRIMARY KEY(round_id,revision),CHECK((actor_source='user' AND created_by IS NOT NULL) OR (actor_source='system' AND created_by IS NULL)))");
 return sql;
});
const MARKET_AUTOMATION_SQL=[
 `CREATE TABLE IF NOT EXISTS market_daily_closes(target_date TEXT PRIMARY KEY,close_cents INTEGER NOT NULL CHECK(typeof(close_cents)='integer' AND close_cents>0),change_cents INTEGER NOT NULL CHECK(typeof(change_cents)='integer'),return_pct TEXT NOT NULL,evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json)),fingerprint TEXT NOT NULL,fetched_at TEXT NOT NULL,review_required INTEGER NOT NULL DEFAULT 0 CHECK(review_required IN (0,1)),revised_json TEXT CHECK(revised_json IS NULL OR json_valid(revised_json)))`,
 `CREATE TABLE IF NOT EXISTS market_calendar_years(year INTEGER PRIMARY KEY,calendar_json TEXT NOT NULL CHECK(json_valid(calendar_json)),fetched_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS market_calendar_overrides(target_date TEXT PRIMARY KEY,is_open INTEGER NOT NULL CHECK(is_open IN (0,1)),reason TEXT NOT NULL,source_url TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS market_fetch_audit(id INTEGER PRIMARY KEY,target_date TEXT,kind TEXT NOT NULL,status TEXT NOT NULL,source_url TEXT NOT NULL,source_hash TEXT,at TEXT NOT NULL,detail TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS market_automation_state(key TEXT PRIMARY KEY,value_json TEXT NOT NULL CHECK(json_valid(value_json)))`,
];
// Preserve string literals when normalizing schema definitions. In particular,
// weakened CHECK(... OR 1) clauses must not pass even for empty databases.
function schemaDefinition(db,name){
 return db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql
  .split(/('(?:''|[^'])*')/).map((part,index)=>index%2?part:part.toLowerCase().replace(/"([a-z_]+)"/g,'$1').replace(/\s+/g,'')).join('');
}
// Inspect actual columns and constraints, including empty tables. IF NOT EXISTS
// must never turn a malformed table into an apparently supported migration.
function tableShape(db,name){
 const q=value=>'"'+value.replaceAll('"','""')+'"';
 const columns=db.prepare(`PRAGMA table_info(${q(name)})`).all().map(({name,type,notnull,dflt_value,pk})=>({name,type:type.toUpperCase(),notnull,dflt_value,pk}));
 const groups=new Map();
 for(const fk of db.prepare(`PRAGMA foreign_key_list(${q(name)})`).all()){
  if(!groups.has(fk.id))groups.set(fk.id,[]);
  groups.get(fk.id).push(fk);
 }
 const foreignKeys=[...groups.values()].map(rows=>rows.sort((a,b)=>a.seq-b.seq).map(({seq,table,from,to,on_update,on_delete,match})=>({seq,table,from,to,on_update,on_delete,match}))).map(JSON.stringify).sort();
 const uniqueKeys=db.prepare(`PRAGMA index_list(${q(name)})`).all().filter(index=>index.unique).map(index=>({partial:index.partial,columns:db.prepare(`PRAGMA index_info(${q(index.name)})`).all().map(column=>column.name)})).map(JSON.stringify).sort();
 return JSON.stringify({columns,foreignKeys,uniqueKeys});
}
function validateFeatureSchema(db,version){
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 const hasBan=tables.has('draw_word_exclusions'),hasSound=tables.has('character_sounds'),hasImages=tables.has('market_images'),marketCount=MARKET_TABLES.filter(name=>tables.has(name)).length;
 const achievementCount=ACHIEVEMENT_TABLES.filter(name=>tables.has(name)).length;
 const automationCount=MARKET_AUTOMATION_TABLES.filter(name=>tables.has(name)).length,curveCount=MARKET_CURVE_TABLES.filter(name=>tables.has(name)).length;
 if(version>=18&&curveCount!==MARKET_CURVE_TABLES.length||version<18&&curveCount)throw Error(`Invalid curve schema ${version}`);
 if(marketCount>0&&marketCount<MARKET_TABLES.length||version===13&&!hasBan&&marketCount!==MARKET_TABLES.length)
  throw Error(`Incomplete legacy schema ${version}`);
 if(version===14&&(!hasBan||!hasSound&&marketCount!==MARKET_TABLES.length)||version>=15&&(!hasBan||!hasSound||marketCount!==MARKET_TABLES.length))
  throw Error(`Incomplete database schema ${version}`);
 if(version>=16&&!hasImages||version>=18&&automationCount!==MARKET_AUTOMATION_TABLES.length)throw Error(`Incomplete database schema ${version}`);
 if(version<17&&automationCount)throw Error('An older schema cannot contain market automation tables');
 if(achievementCount&&achievementCount!==ACHIEVEMENT_TABLES.length||version>=19&&achievementCount!==ACHIEVEMENT_TABLES.length)throw Error('Incomplete achievement schema');
 if(version===17&&!automationCount&&!achievementCount)throw Error('Incomplete historical schema 17');
 if(!hasSound&&!marketCount&&!hasImages&&!automationCount)return;
 const reference=new DatabaseSync(':memory:');
 try{
  reference.exec(SOUND_SQL+';'+(automationCount?MARKET_SQL:LEGACY_MARKET_SQL).join(';')+';'+MARKET_IMAGE_SQL+';'+MARKET_AUTOMATION_SQL.join(';')+';'+MARKET_CURVE_SQL.join(';')+';'+ACHIEVEMENT_SQL.join(';'));
  for(const name of [...(hasSound?['character_sounds']:[]),...(marketCount?MARKET_TABLES:[]),...(hasImages?['market_images']:[]),...(automationCount?MARKET_AUTOMATION_TABLES:[]),...(curveCount?MARKET_CURVE_TABLES:[]),...(achievementCount?ACHIEVEMENT_TABLES:[])]){
   if(tableShape(db,name)!==tableShape(reference,name))throw Error(`Invalid ${name} schema`);
   if(schemaDefinition(db,name)!==schemaDefinition(reference,name))throw Error(`Invalid ${name} constraints`);
  }
  if(version<14&&hasSound&&db.prepare('SELECT COUNT(*) n FROM character_sounds').get().n)throw Error('An older schema cannot contain expression sounds');
  if(version<16&&hasImages&&db.prepare('SELECT COUNT(*) n FROM market_images').get().n)throw Error('An older schema cannot contain market images');
  if(version<17&&achievementCount&&ACHIEVEMENT_TABLES.some(name=>db.prepare('SELECT COUNT(*) n FROM '+name).get().n))throw Error('An older schema cannot contain achievement unit records');
 }finally{reference.close();}
}

function openDatabase(file){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=new DatabaseSync(file,{timeout:5000});
 db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if(version>SCHEMA_VERSION){db.close();throw Error(`Unsupported database version ${version}`);}
 try{validateFeatureSchema(db,version);if(version>0&&version<17&&db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database migration contains broken foreign keys');}catch(error){db.close();throw error;}
 // Every supported historical step is part of one upgrade. A late failure
 // restores the exact original schema and rows, including pre16 databases.
 const migrating=version<SCHEMA_VERSION;
 if(migrating){try{db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');}catch(error){db.close();throw error;}}
 if(version<1){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('member','admin')),disabled INTEGER NOT NULL DEFAULT 0,appearance TEXT,created_at TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,revoked_at TEXT);
    CREATE TABLE invites(token_hash TEXT PRIMARY KEY,created_by TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_by TEXT UNIQUE REFERENCES users(id),revoked_at TEXT);
    CREATE TABLE password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),created_by TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_at TEXT);
    CREATE INDEX sessions_user ON sessions(user_id);
    CREATE INDEX invites_created_by ON invites(created_by);
    PRAGMA user_version=1;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<2){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE board_issues(id TEXT PRIMARY KEY,author_id TEXT REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,name TEXT NOT NULL,game TEXT NOT NULL,status TEXT NOT NULL,at TEXT NOT NULL,github_number INTEGER UNIQUE,github_url TEXT);
    CREATE TABLE board_comments(id TEXT PRIMARY KEY,issue_id TEXT NOT NULL REFERENCES board_issues(id),author_id TEXT REFERENCES users(id),name TEXT NOT NULL,body TEXT NOT NULL,at TEXT NOT NULL,github_id INTEGER);
    CREATE TABLE submissions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,issue_id TEXT,payload TEXT NOT NULL,state TEXT NOT NULL,remote_id TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX board_comments_issue ON board_comments(issue_id);
    CREATE INDEX submissions_user ON submissions(user_id);
    PRAGMA user_version=2;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<3){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE player_characters(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE character_images(character_id TEXT NOT NULL REFERENCES player_characters(id) ON DELETE CASCADE,expression TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(character_id,expression));
    CREATE INDEX player_characters_owner ON player_characters(owner_id);
    PRAGMA user_version=3;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<4){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    ALTER TABLE character_images ADD COLUMN label TEXT;
    CREATE UNIQUE INDEX character_images_label ON character_images(character_id,label) WHERE label IS NOT NULL;
    PRAGMA user_version=4;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<5){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE community_gifts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id),author_name TEXT NOT NULL,title TEXT NOT NULL,title_key TEXT NOT NULL UNIQUE,category TEXT NOT NULL,image_mime TEXT,image_bytes BLOB,created_at TEXT NOT NULL, CHECK((image_mime IS NULL AND image_bytes IS NULL) OR (image_mime IS NOT NULL AND image_bytes IS NOT NULL)));
    CREATE INDEX community_gifts_author ON community_gifts(author_id);
    PRAGMA user_version=5;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<6){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE user_achievements(user_id TEXT NOT NULL REFERENCES users(id),achievement_id TEXT NOT NULL,source_key TEXT NOT NULL,unlocked_at TEXT NOT NULL,PRIMARY KEY(user_id,achievement_id));
    CREATE INDEX user_achievements_unlocked ON user_achievements(user_id,unlocked_at);
    PRAGMA user_version=6;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<7){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    ALTER TABLE player_characters ADD COLUMN shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1));
    CREATE INDEX player_characters_shared ON player_characters(shared,created_at);
    PRAGMA user_version=7;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<8){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE user_artworks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX user_artworks_owner ON user_artworks(owner_id,created_at);
    PRAGMA user_version=8;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<9){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE IF NOT EXISTS draw_words(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id),author_name TEXT NOT NULL,title TEXT NOT NULL,title_key TEXT NOT NULL UNIQUE,aliases TEXT NOT NULL,difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard')),category TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS draw_words_author ON draw_words(author_id,created_at);
    PRAGMA user_version=9;
   `);
   db.exec('RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<10){
  db.exec('SAVEPOINT schema_step');
  try{
   if(!db.prepare('PRAGMA table_info(draw_words)').all().some(column=>column.name==='topic'))
    db.exec("ALTER TABLE draw_words ADD COLUMN topic TEXT NOT NULL DEFAULT 'misc'");
   db.exec('PRAGMA user_version=10; RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<11||!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='music_tracks'").get()){
  db.exec('SAVEPOINT schema_step');
  try{db.exec(`CREATE TABLE IF NOT EXISTS music_tracks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,duration REAL NOT NULL,size INTEGER NOT NULL,mime TEXT NOT NULL,ext TEXT NOT NULL,created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS music_owner ON music_tracks(owner_id); PRAGMA user_version=${Math.max(version,11)}; RELEASE schema_step`);}catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<12){
  db.exec('SAVEPOINT schema_step');
  try{if(!db.prepare('PRAGMA table_info(user_artworks)').all().some(column=>column.name==='shared'))db.exec('ALTER TABLE user_artworks ADD COLUMN shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1))');db.exec('PRAGMA user_version=12; RELEASE schema_step');}catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 // PR #38's earlier schema 13 had market tables but no ban ledger.
 if(version<13||version===13&&!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='draw_word_exclusions'").get()){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(`
    CREATE TABLE IF NOT EXISTS draw_word_exclusions(
     title_key TEXT PRIMARY KEY CHECK(length(title_key) BETWEEN 1 AND 512),
     word_id TEXT NOT NULL UNIQUE CHECK(length(word_id) BETWEEN 1 AND 64),
     title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 24),
     room_code TEXT NOT NULL CHECK(length(room_code)=6),
     result_id TEXT NOT NULL UNIQUE CHECK(length(result_id)=36),
     game_run_id TEXT NOT NULL CHECK(length(game_run_id)=36),
     electorate_json TEXT NOT NULL CHECK(length(electorate_json)<=400 AND json_valid(electorate_json) AND json_type(electorate_json)='array' AND json_array_length(electorate_json) BETWEEN 1 AND 8),
     votes_json TEXT NOT NULL CHECK(length(votes_json)<=400 AND json_valid(votes_json) AND json_type(votes_json)='array' AND json_array_length(votes_json) BETWEEN 1 AND 8),
     required INTEGER NOT NULL CHECK(required=CAST(json_array_length(electorate_json)/2 AS INTEGER)+1),
     created_at TEXT NOT NULL,
     CHECK(json_array_length(votes_json)>=required AND json_array_length(votes_json)<=json_array_length(electorate_json))
    );
    PRAGMA user_version=13;
    RELEASE schema_step;
   `);
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<15){
  db.exec('SAVEPOINT schema_step');
  try{
   // Schema 14 was independently used by sound+ban and market+ban releases.
   // Only the complete, checked legacy layouts may acquire the other feature.
   db.exec(SOUND_SQL+';'+LEGACY_MARKET_SQL.join(';')+'; CREATE INDEX IF NOT EXISTS market_ledger_user ON market_ledger(user_id); PRAGMA user_version=15; RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<16){
  db.exec('SAVEPOINT schema_step');
  try{
   db.exec(MARKET_IMAGE_SQL+'; CREATE INDEX IF NOT EXISTS market_images_owner ON market_images(author_id,created_at); CREATE INDEX IF NOT EXISTS market_images_status ON market_images(status,created_at); PRAGMA user_version=16; RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 }
 if(version<17||version===17&&!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='market_automation_state'").get()){
  // Do not rename the old parent tables: SQLite would rewrite references in
  // votes and the immutable ledger. Rebuild both in one transaction with FK
  // enforcement temporarily disabled, then check every reference before commit.
  db.exec('SAVEPOINT schema_step');
  try{
   for(const name of ['market_rounds','market_settlements']){
    const sql=MARKET_SQL.find(statement=>statement.startsWith(`CREATE TABLE IF NOT EXISTS ${name}(`));
    const columns=db.prepare(`PRAGMA table_info(${name})`).all().map(column=>column.name).join(',');
    db.exec(sql.replace('CREATE TABLE IF NOT EXISTS','CREATE TABLE').replace(`TABLE ${name}(`,`TABLE ${name}_v17(`));
    db.exec(`INSERT INTO ${name}_v17(rowid,${columns}) SELECT rowid,${columns} FROM ${name} ORDER BY rowid; DROP TABLE ${name}; ALTER TABLE ${name}_v17 RENAME TO ${name}`);
   }
   db.exec(MARKET_AUTOMATION_SQL.join(';'));
   if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database migration contains broken foreign keys');
   validateFeatureSchema(db,17);
   db.exec('PRAGMA user_version=17; RELEASE schema_step');
  }catch(error){db.exec('ROLLBACK; PRAGMA foreign_keys=ON');db.close();throw error;}
 }
 if(version<18){
  try{db.exec(MARKET_CURVE_SQL.join(';')+'; CREATE INDEX IF NOT EXISTS market_curve_ledger_user ON market_curve_ledger(user_id); PRAGMA user_version=18');validateFeatureSchema(db,18);}
  catch(error){db.exec('ROLLBACK; PRAGMA foreign_keys=ON');db.close();throw error;}
 }
 if(version<19){
  try{db.exec(ACHIEVEMENT_SQL.join(';')+'; PRAGMA user_version=19');validateFeatureSchema(db,19);}
  catch(error){db.exec('ROLLBACK; PRAGMA foreign_keys=ON');db.close();throw error;}
 }
 if(migrating){
  try{if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database migration contains broken foreign keys');db.exec('COMMIT; PRAGMA foreign_keys=ON');}
  catch(error){try{db.exec('ROLLBACK; PRAGMA foreign_keys=ON');}finally{db.close();}throw error;}
 }
 return db;
}

function transaction(db,run){
 db.exec('BEGIN IMMEDIATE');
 try{const result=run();db.exec('COMMIT');return result;}
 catch(error){db.exec('ROLLBACK');throw error;}
}

module.exports={openDatabase,transaction,SCHEMA_VERSION,MARKET_CURVE_TABLES,MARKET_CURVE_SQL,MARKET_TABLES,MARKET_IMAGE_SQL,MARKET_AUTOMATION_TABLES,MARKET_AUTOMATION_SQL,MARKET_SQL,LEGACY_MARKET_SQL,validateFeatureSchema};
