const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {openDatabase,SCHEMA_VERSION,MARKET_TABLES,MARKET_AUTOMATION_TABLES,validateFeatureSchema}=require('../src/db');
const {validateDatabase}=require('../src/data/validation');
const {MarketStore}=require('../src/market/store');
const {legacyMarketSchema,upgradedMarketRows}=require('./helpers/market-legacy-schema.cjs');
const R=require('../public/market-rules');
const at='2026-10-06T04:00:00.000Z',after='2027-01-06T05:30:00.000Z';
const hash='scrypt:'+Buffer.alloc(16,3).toString('hex')+':'+Buffer.alloc(64,7).toString('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'market-auto-schema-')),file=path.join(root,'source','app.sqlite'),db=openDatabase(file);
 t.after(()=>{try{db.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 const adminId=crypto.randomUUID(),memberId=crypto.randomUUID();
 const add=db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,disabled,created_at) VALUES(?,?,?,?,?,?,?)');
 add.run(adminId,'schema_admin','管理者',hash,'admin',0,at);add.run(memberId,'schema_member','保留帳號',hash,'member',1,at);
 const admin=db.prepare('SELECT * FROM users WHERE id=?').get(adminId),member=db.prepare('SELECT * FROM users WHERE id=?').get(memberId);
 db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run('session',adminId,'2027-12-31T00:00:00.000Z');
 db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),memberId,'原有作品','image/png',Buffer.from('original artwork bytes'),at);
 return {root,file,db,admin,member};
}
function createRound(db,actor,changes={}){
 const row={id:crypto.randomUUID(),target_date:'2027-01-06',cutoff_at:R.cutoffFor('2027-01-06'),settlement_after:R.settlementFor('2027-01-06'),rules_json:JSON.stringify(R.snapshot()),created_by:actor?.id??null,created_at:at,...changes};
 const names=Object.keys(row);db.prepare(`INSERT INTO market_rounds(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')})`).run(...Object.values(row));return row.id;
}
function snapshot(db){return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>({name,sql:db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name).sql,rows:db.prepare(`SELECT rowid,* FROM ${name} ORDER BY rowid`).all()}));}
function oldHistory(f){
 let now=Date.parse('2027-01-04T12:00:00.000Z');const store=new MarketStore(f.db,()=>now),id=store.create(f.admin,{requestId:crypto.randomUUID(),targetDate:'2027-01-06',confirmed:true}).roundId;
 store.vote(f.admin,{requestId:crypto.randomUUID(),roundId:id,optionId:'rally',expectedRevision:0});now=Date.parse(after);
 store.settle(f.admin,{requestId:crypto.randomUUID(),roundId:id,returnPct:2,expectedRevision:0,confirmed:true});
 store.settle(f.admin,{requestId:crypto.randomUUID(),roundId:id,returnPct:-2,expectedRevision:1,reason:'保留更正原因',confirmed:true});return id;
}

test('schema17 creates complete automation tables and explicit user/system actor identities',t=>{
 const f=fixture(t);assert.equal(SCHEMA_VERSION,17);assert.equal(f.db.prepare('PRAGMA user_version').get().user_version,17);assert.equal(f.db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
 for(const name of MARKET_AUTOMATION_TABLES)assert.ok(f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
 for(const table of ['market_rounds','market_settlements']){
  const cols=f.db.prepare(`PRAGMA table_info(${table})`).all();assert.equal(cols.find(c=>c.name==='created_by').notnull,0);assert.equal(cols.find(c=>c.name==='actor_source').dflt_value,"'user'");
 }
 const users=f.db.prepare('SELECT * FROM users ORDER BY id').all();createRound(f.db,null,{actor_source:'system'});
 assert.deepEqual(f.db.prepare('SELECT * FROM users ORDER BY id').all(),users,'a system actor never fabricates an admin account');
 assert.doesNotThrow(()=>validateFeatureSchema(f.db,17));
});

test('schema17 enforces actor pairing, round void consistency, integer closes and JSON/boolean fields',t=>{
 const f=fixture(t);
 for(const change of [{created_by:null},{actor_source:'system'},{actor_source:'robot'},{void_reason:'closure'},{void_at:at},{void_reason:' ',void_at:at},{void_reason:'closure',void_at:at,result_revision:1}])assert.throws(()=>createRound(f.db,f.admin,change),/constraint/i);
 const id=createRound(f.db,null,{actor_source:'system',void_reason:'交易所休市',void_at:at});
 const settlement=f.db.prepare('INSERT INTO market_settlements(round_id,revision,return_pct,bucket,reason,created_by,created_at,actor_source) VALUES(?,?,?,?,?,?,?,?)');
 assert.throws(()=>settlement.run(id,1,2,'rally','',f.admin.id,after,'system'),/constraint/i);assert.throws(()=>settlement.run(id,1,2,'rally','',null,after,'user'),/constraint/i);
 const insert=f.db.prepare('INSERT INTO market_daily_closes VALUES(?,?,?,?,?,?,?,?,?)'),values=['2027-01-06',2500000,12500,'0.502512562814','{}','fingerprint',after,0,null];
 for(const [index,value] of [[1,0],[1,-1],[1,0.5],[2,1.5],[4,'invalid'],[7,2],[7,-1],[8,'invalid']]){const row=[...values];row[index]=value;assert.throws(()=>insert.run(...row),/constraint/i);}
 insert.run(...values);
 assert.throws(()=>f.db.prepare('INSERT INTO market_calendar_years VALUES(?,?,?)').run(2027,'invalid',at),/constraint/i);
 assert.throws(()=>f.db.prepare('INSERT INTO market_automation_state VALUES(?,?)').run('status','invalid'),/constraint/i);
 assert.throws(()=>f.db.prepare('INSERT INTO market_calendar_overrides VALUES(?,?,?,?,?,?)').run('2027-01-06',2,'reason','https://www.twse.com.tw/',f.admin.id,at),/constraint/i);
 assert.throws(()=>f.db.prepare('INSERT INTO market_calendar_overrides VALUES(?,?,?,?,?,?)').run('2027-01-06',0,'reason','https://www.twse.com.tw/',crypto.randomUUID(),at),/FOREIGN KEY/);
});

for(const version of [15,16])test(`genuine schema${version} migration preserves every account, asset, vote, receipt and correction field`,t=>{
 const f=fixture(t);oldHistory(f);legacyMarketSchema(f.db);if(version<16)f.db.exec('DROP TABLE market_images');f.db.exec(`PRAGMA user_version=${version}`);
 const before=snapshot(f.db),accounts=f.db.prepare('SELECT * FROM users ORDER BY id').all();f.db.close();
 for(let boot=0;boot<2;boot++){
  const db=openDatabase(f.file);try{
   assert.equal(db.prepare('PRAGMA user_version').get().user_version,17);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
   assert.deepEqual(db.prepare('SELECT * FROM users ORDER BY id').all(),accounts);
   for(const old of before){const rows=db.prepare(`SELECT rowid,* FROM ${old.name} ORDER BY rowid`).all();assert.deepEqual(rows,upgradedMarketRows(old.name,old.rows),old.name);}
   for(const name of MARKET_AUTOMATION_TABLES)assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${name}`).get().n,0);
  }finally{db.close();}
 }
});

for(const version of [15,16])test(`schema${version} upgrade failure rolls back every migration step and dependent record`,t=>{
 const f=fixture(t);oldHistory(f);legacyMarketSchema(f.db);if(version<16)f.db.exec('DROP TABLE market_images');f.db.exec(`PRAGMA user_version=${version}`);const before=snapshot(f.db);f.db.close();
 const exec=DatabaseSync.prototype.exec;let injected=false;
 DatabaseSync.prototype.exec=function(sql){if(sql.startsWith('CREATE TABLE market_settlements_v17(')){injected=true;throw Error('injected second parent rebuild failure');}return exec.call(this,sql);};
 try{assert.throws(()=>openDatabase(f.file),/injected second parent rebuild/);}finally{DatabaseSync.prototype.exec=exec;}
 assert.equal(injected,true);const old=new DatabaseSync(f.file);try{assert.equal(old.prepare('PRAGMA user_version').get().user_version,version);assert.deepEqual(snapshot(old),before);assert.deepEqual(old.prepare('PRAGMA foreign_key_check').all(),[]);}finally{old.close();}
 const recovered=openDatabase(f.file);recovered.close();
});

test('pre17 broken foreign keys are rejected before any migration changes existing data',t=>{
 const f=fixture(t);oldHistory(f);legacyMarketSchema(f.db);f.db.exec('DROP TABLE market_images; PRAGMA user_version=15; PRAGMA foreign_keys=OFF');f.db.prepare('UPDATE market_rounds SET created_by=?').run(crypto.randomUUID());const before=snapshot(f.db);f.db.close();
 assert.throws(()=>openDatabase(f.file),/broken foreign keys/);const old=new DatabaseSync(f.file);try{assert.equal(old.prepare('PRAGMA user_version').get().user_version,15);assert.deepEqual(snapshot(old),before);}finally{old.close();}
});

const malformed=[
 ['market_rounds','actor pairing weakened',sql=>sql.replace("(actor_source='system' AND created_by IS NULL))","(actor_source='system' AND created_by IS NULL) OR 1)")],
 ['market_rounds','void pairing removed',sql=>sql.replace(',CHECK((void_reason IS NULL AND void_at IS NULL) OR (void_reason IS NOT NULL AND length(trim(void_reason)) BETWEEN 1 AND 240 AND void_at IS NOT NULL AND result_revision=0))','')],
 ['market_settlements','creator not nullable',sql=>sql.replace('created_by TEXT REFERENCES','created_by TEXT NOT NULL REFERENCES')],
 ['market_settlements','actor default forged',sql=>sql.replace("DEFAULT 'user'","DEFAULT 'system'")],
 ['market_daily_closes','close bounds weakened',sql=>sql.replace('close_cents>0)','close_cents>0 OR 1)')],
 ['market_daily_closes','evidence JSON validation removed',sql=>sql.replace(' CHECK(json_valid(evidence_json))','')],
 ['market_daily_closes','revision JSON validation removed',sql=>sql.replace(' CHECK(revised_json IS NULL OR json_valid(revised_json))','')],
 ['market_calendar_years','calendar JSON validation removed',sql=>sql.replace(' CHECK(json_valid(calendar_json))','')],
 ['market_calendar_overrides','author reference missing',sql=>sql.replace(' REFERENCES users(id)','')],
 ['market_calendar_overrides','open state weakened',sql=>sql.replace('CHECK(is_open IN (0,1))','CHECK(is_open IN (0,1) OR 1)')],
 ['market_fetch_audit','audit detail nullable',sql=>sql.replace('detail TEXT NOT NULL','detail TEXT')],
 ['market_automation_state','state JSON validation removed',sql=>sql.replace(' CHECK(json_valid(value_json))','')],
 ['market_automation_state','extra column',sql=>sql.replace('value_json TEXT','extra TEXT,value_json TEXT')],
];
for(const [table,label,change] of malformed)test(`malformed empty schema17 rejects ${label} without repair`,t=>{
 const f=fixture(t),sql=f.db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table).sql,altered=change(sql);assert.notEqual(altered,sql);
 f.db.exec(`PRAGMA foreign_keys=OFF; DROP TABLE ${table};${altered}`);const before=snapshot(f.db);f.db.close();
 assert.throws(()=>validateDatabase(f.file),error=>error.code==='INVALID_DATABASE');assert.throws(()=>openDatabase(f.file),/Invalid .* (schema|constraints)/);
 const old=new DatabaseSync(f.file);try{assert.equal(old.prepare('PRAGMA user_version').get().user_version,17);assert.deepEqual(snapshot(old),before);}finally{old.close();}
});
for(const table of MARKET_AUTOMATION_TABLES)test(`schema17 missing ${table} is rejected by boot and backup validation`,t=>{
 const f=fixture(t);f.db.exec(`DROP TABLE ${table}`);f.db.close();assert.throws(()=>validateDatabase(f.file),error=>error.code==='INVALID_DATABASE');assert.throws(()=>openDatabase(f.file),/Incomplete database schema 17/);
});
test('schema16 label cannot smuggle current actor columns or future automation tables',t=>{
 const f=fixture(t);f.db.exec('PRAGMA user_version=16');f.db.close();assert.throws(()=>openDatabase(f.file),/older schema cannot contain market automation/);
 const db=new DatabaseSync(f.file);try{for(const table of MARKET_AUTOMATION_TABLES)db.exec(`DROP TABLE ${table}`);}finally{db.close();}assert.throws(()=>openDatabase(f.file),/Invalid market_rounds schema/);
});

function seedAutomation(f){
 const {MarketAutomationStore}=require('../src/market/automation-store');let now=Date.parse('2027-01-04T04:00:00.000Z');
 const market=new MarketStore(f.db,()=>now),automation=new MarketAutomationStore(f.db,market,{clock:()=>now}),sourceUrl='https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX';
 automation.saveCalendar({year:2027,coverageStart:'2027-01-01',coverageEnd:'2027-12-31',closedDates:['2027-01-01'],openDates:[],sourceUrl:'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',sourceHash:'a'.repeat(64),fetchedAt:new Date(now).toISOString()});
 assert.equal(automation.plan(),'2027-01-05');const round=f.db.prepare('SELECT * FROM market_rounds').get();
 market.vote(f.admin,{requestId:crypto.randomUUID(),roundId:round.id,optionId:'rally',expectedRevision:0});now=Date.parse('2027-01-05T06:05:00.000Z');
 const fetchedAt=new Date(now).toISOString(),close={targetDate:'2027-01-05',closeCents:1020000,changeCents:20000,returnPct:'2.00',sourceUrl,evidence:[{url:sourceUrl,sha256:'b'.repeat(64),fetchedAt},{url:'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK',sha256:'c'.repeat(64),fetchedAt}],fetchedAt};
 assert.equal(automation.recordClose(close).settled,true);assert.equal(automation.recordClose({...close,closeCents:1030000,changeCents:30000,returnPct:'3.00'}).review,true);
 assert.equal(automation.plan(),'2027-01-06');automation.override(f.admin,{requestId:crypto.randomUUID(),targetDate:'2027-01-06',isOpen:false,reason:'官方臨時休市覆核',sourceUrl:'https://www.twse.com.tw/',confirmed:true});
 automation.updateState({status:'ok',lastAttemptAt:fetchedAt,lastSuccessAt:fetchedAt});return automation;
}

test('full17 export verify preview and cold restore preserve calendar, override, proof, correction review, audits, state and system identities',async t=>{
 const {run}=require('../src/data/transfer'),f=fixture(t);seedAutomation(f);
 const expected=snapshot(f.db).filter(table=>!['sessions','invites','password_resets'].includes(table.name));
 assert.equal(f.db.prepare("SELECT COUNT(*) n FROM market_rounds WHERE actor_source='system' AND created_by IS NULL").get().n,2);
 assert.equal(f.db.prepare("SELECT COUNT(*) n FROM market_settlements WHERE actor_source='system' AND created_by IS NULL").get().n,1);
 assert.equal(f.db.prepare('SELECT review_required FROM market_daily_closes').get().review_required,1);f.db.close();
 const source={envId:'automation-schema-test',dbFile:f.file};for(const name of ['history','community','music']){source[name+'Dir']=path.join(f.root,name);fs.mkdirSync(source[name+'Dir']);}
 const before=validateDatabase(f.file),sourceBytes=fs.readFileSync(f.file),keyFile=path.join(f.root,'key'),bundleDir=path.join(f.root,'bundle'),destinationDir=path.join(f.root,'restored');fs.writeFileSync(keyFile,Buffer.alloc(32,9));
 const exported=await run({action:'export',source,sourceStopped:true,keyFile,outputDir:bundleDir});assert.deepEqual(exported.summary.database.tableCounts,before.tableCounts);
 for(const table of MARKET_AUTOMATION_TABLES)assert.ok(exported.summary.database.tableCounts[table]>0,table);
 const verified=await run({action:'verify',bundleDir,keyFile});assert.equal(verified.summary.database.schemaVersion,17);
 const request={action:'restore',bundleDir,keyFile,destinationDir,expectedBundleId:verified.bundleId};const dry=await run(request);assert.equal(dry.dryRun,true);assert.equal(fs.existsSync(destinationDir),false);
 const restored=await run({...request,apply:true}),copy=openDatabase(restored.config.DB_FILE);try{
  assert.deepEqual(snapshot(copy).filter(table=>!['sessions','invites','password_resets'].includes(table.name)),expected);
  assert.equal(copy.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);assert.deepEqual(copy.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{copy.close();}
 assert.deepEqual(validateDatabase(f.file),before);assert.deepEqual(fs.readFileSync(f.file),sourceBytes);
});

for(const [label,mutate] of [
 ['forged close fingerprint',db=>db.exec("UPDATE market_daily_closes SET fingerprint='forged'")],
 ['invalid official proof URL',db=>db.exec("UPDATE market_daily_closes SET evidence_json=json_set(evidence_json,'$.sourceUrl','https://example.com/fake')")],
 ['inconsistent correction date',db=>db.exec("UPDATE market_daily_closes SET revised_json=json_set(revised_json,'$.targetDate','2027-01-06')")],
 ['calendar year mismatch',db=>db.exec("UPDATE market_calendar_years SET calendar_json=json_set(calendar_json,'$.year',2028)")],
 ['invalid calendar override URL',db=>db.exec("UPDATE market_calendar_overrides SET source_url='https://example.com/fake'")],
 ['invalid audit timestamp',db=>db.exec("UPDATE market_fetch_audit SET at='yesterday'")],
 ['invalid state key',db=>db.exec("UPDATE market_automation_state SET key='unknown'")],
])test(`schema17 backup validation rejects semantically ${label} despite valid SQLite shape`,t=>{
 const f=fixture(t);seedAutomation(f);mutate(f.db);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(f.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');f.db.close();
 assert.throws(()=>validateDatabase(f.file),error=>error.code==='INVALID_DATABASE');
});
