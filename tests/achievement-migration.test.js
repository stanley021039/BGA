const {legacyMarketSchema}=require('./helpers/market-legacy-schema.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID,createHash,hkdfSync,createHmac}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {openDatabase,SCHEMA_VERSION}=require('../src/db');
const {ACHIEVEMENT_TABLES,ACHIEVEMENT_SQL}=require('../src/achievements/schema');
const {AchievementStore}=require('../src/achievements/store');
const {normalizeUnit,fingerprintUnit}=require('../src/achievements/units');
const {validateData}=require('../src/data/validation');
const {run,canonical}=require('../src/data/transfer');
const {settings}=require('../src/config');

const tracked=['processed_unit_events','achievement_progress','user_achievements'];
const oldIds=['gift-first-gift','majority-first-vote','poker-first-hand','thunder-first-drive','all-first-table'];
function fixture(t){
 const parent=fs.realpathSync(os.tmpdir()),prefix='bga-achievement-migration-',root=fs.mkdtempSync(path.join(parent,prefix));
 t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(resolved,path.resolve(root));assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith(prefix));fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5});});
 const source={envId:'test',dbFile:path.join(root,'source','app.sqlite'),historyDir:path.join(root,'source','history'),communityDir:path.join(root,'source','community'),musicDir:path.join(root,'source','music')};
 for(const dir of [source.historyDir,source.communityDir,source.musicDir])fs.mkdirSync(dir,{recursive:true});
 const users=Array.from({length:3},()=>randomUUID()),db=openDatabase(source.dbFile);
 try{
  // Synthetic, correctly shaped credentials; these tests never log in or start a server.
  const hash='scrypt:'+Buffer.alloc(16,0x11).toString('hex')+':'+Buffer.alloc(64,0x22).toString('hex');
  for(const [index,id]of users.entries())db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,'migration_'+index,'相同名字',hash,index===0?'admin':'member','2024-01-01T00:00:00.000Z');
  for(const [index,id]of oldIds.entries())db.prepare('INSERT INTO user_achievements(user_id,achievement_id,source_key,unlocked_at) VALUES(?,?,?,?)').run(users[0],id,'legacy:'+index,'2024-01-0'+(index+1)+'T01:02:03.000Z');
 }finally{db.close();}
 return {root,source,users};
}
function withDatabase(file,callback,{readOnly=false}={}){const db=new DatabaseSync(file,{readOnly});try{return callback(db);}finally{db.close();}}
function tableRows(db,tables){return Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM "'+name+'" ORDER BY rowid').all()]));}
function tableNames(db){return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);}
function downgrade16(file){return withDatabase(file,db=>{legacyMarketSchema(db);db.exec('PRAGMA user_version=16');return tableRows(db,tableNames(db));});}
function unit(f,game,{round=1,at='2026-10-08T03:00:00.000Z'}={}){
 const participants=f.users.map((user_id,index)=>({user_id,seat_id:'seat-'+index,eligible:game==='gift'||index<2,...(game==='draw'?(index===0?{artist:true,strokeAccepted:true}:{guessAccepted:index===1,correctGuess:index===1}):{receivedTwinGifts:index===0,positiveWish:index===0})}));
 return {unit_event_id:randomUUID(),match_id:randomUUID(),game_type:game,unit:'round',round,status:'rules_completed',completed_at:at,participants,metrics:{participantCount:3},purpose:'production',source:'game_server',rule_version:1};
}
function committed(f){
 const events=[unit(f,'draw'),unit(f,'gift',{at:'2026-10-08T03:01:00.000Z'})],db=openDatabase(f.source.dbFile);
 try{const store=new AchievementStore(db);for(const event of events)store.processUnit(event);return {events,rows:tableRows(db,tracked),users:db.prepare('SELECT * FROM users ORDER BY id').all()};}finally{db.close();}
}
const invalidDatabase=error=>error.code==='INVALID_DATABASE';

test('schema 16 migration adds empty achievement tables and keeps all prior rows, account fields and badge dates exactly',t=>{
 const f=fixture(t),before=downgrade16(f.source.dbFile),beforeSummary=validateData(f.source).summary.database;
 assert.equal(beforeSummary.schemaVersion,16);assert.equal(Object.hasOwn(before,'processed_unit_events'),false);
 const db=openDatabase(f.source.dbFile);
 try{
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  assert.deepEqual(tableRows(db,Object.keys(before)),before);
  for(const table of ACHIEVEMENT_TABLES)assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
 const after=validateData(f.source).summary.database;assert.equal(after.achievementsSha256,beforeSummary.achievementsSha256);
 const again=openDatabase(f.source.dbFile);try{assert.deepEqual(tableRows(again,Object.keys(before)),before);for(const table of ACHIEVEMENT_TABLES)assert.equal(again.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);}finally{again.close();}
});

for(const version of [16,17])for(const missing of ['achievement_progress','processed_unit_events','both']){
 if(version===16&&missing==='both')continue; // Covered by the genuine schema-16 migration test.
 test('schema '+version+' refuses '+missing+' missing from a declared or partial achievement schema without repairing it',t=>{
  const f=fixture(t);
  withDatabase(f.source.dbFile,db=>{legacyMarketSchema(db,{preserveAchievements:true});if(missing==='both')db.exec('DROP TABLE achievement_progress; DROP TABLE processed_unit_events');else db.exec('DROP TABLE '+missing);db.exec('PRAGMA user_version='+version);});
  const before=withDatabase(f.source.dbFile,db=>({version:db.prepare('PRAGMA user_version').get().user_version,tables:tableNames(db),awards:tableRows(db,['user_achievements'])}));
  assert.throws(()=>openDatabase(f.source.dbFile),/Incomplete (achievement|historical) schema/);assert.throws(()=>validateData(f.source),invalidDatabase);
  assert.deepEqual(withDatabase(f.source.dbFile,db=>({version:db.prepare('PRAGMA user_version').get().user_version,tables:tableNames(db),awards:tableRows(db,['user_achievements'])})),before);
 });
}

for(const table of ACHIEVEMENT_TABLES){
 test('an empty schema 17 '+table+' with weakened CHECK constraints is rejected before migration or transfer',t=>{
  const f=fixture(t),index=ACHIEVEMENT_TABLES.indexOf(table);
  withDatabase(f.source.dbFile,db=>{db.exec('PRAGMA foreign_keys=OFF; DROP TABLE '+table);db.exec(ACHIEVEMENT_SQL[index].replace("CHECK(typeof(rule_version)='integer' AND rule_version=1)","CHECK((typeof(rule_version)='integer' AND rule_version=1) OR 1=1)"));});
  const definition=withDatabase(f.source.dbFile,db=>db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(table).sql);
  assert.match(definition,/OR 1=1/);assert.throws(()=>openDatabase(f.source.dbFile),/constraints/);assert.throws(()=>validateData(f.source),invalidDatabase);
  assert.equal(withDatabase(f.source.dbFile,db=>db.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(table).sql),definition);
 });
}

test('committed events preserve old badge dates and carry canonical facts, verified fingerprints and two-game progress',t=>{
 const f=fixture(t),before=withDatabase(f.source.dbFile,db=>tableRows(db,['user_achievements'])),saved=committed(f);
 assert.equal(saved.rows.processed_unit_events.length,2);assert.equal(saved.rows.achievement_progress.filter(row=>row.user_id===f.users[0]).length,2);
 for(const old of before.user_achievements)assert.deepEqual(saved.rows.user_achievements.find(row=>row.user_id===old.user_id&&row.achievement_id===old.achievement_id),old);
 for(const event of saved.events){const row=saved.rows.processed_unit_events.find(row=>row.unit_event_id===event.unit_event_id),facts=normalizeUnit(event);assert.equal(row.facts_json,JSON.stringify(facts));assert.equal(row.fingerprint,fingerprintUnit(facts));assert.equal(row.fingerprint,createHash('sha256').update(row.facts_json).digest('hex'));}
 const summary=validateData(f.source).summary.database;assert.match(summary.achievementsSha256,/^[0-9a-f]{64}$/);
});

test('real history tracing and public room views never serialize the canonical account mapping or private unit facts',t=>{
 const f=fixture(t),{MajorityRoom}=require('../src/games/majority'),{HistoryStore}=require('../src/history/store');
 const db=openDatabase(f.source.dbFile),store=new AchievementStore(db),history=new HistoryStore(f.source.historyDir),room=new MajorityRoom('MIGR01','私有接線',()=>0),events=[];
 try{
  history.attach(room);
  const players=Array.from({length:3},(_,index)=>history.transact(room,{action:index?'join':'create',source:'player'},()=>room.add('同名玩家'))),mapping=new Map(players.map((player,index)=>[player.id,f.users[index]]));
  Object.defineProperties(room,{
   achievementUnitStart:{value:context=>context.participantSeatIds.map(seat_id=>({seat_id,user_id:mapping.get(seat_id)}))},
   achievementUnitCompleted:{value:event=>{events.push(event);store.processUnit(event);room.acknowledgeAchievementUnit(event.unit_event_id);}}
  });
  history.transact(room,{action:'start',source:'player'},()=>room.start());
  history.transact(room,{action:'ask',source:'player'},()=>room.act(room.presenterId,'ask',{type:'two',prompt:'公開問題',options:['甲','乙']}));
  for(const player of players)history.transact(room,{action:'answer',source:'player',actor:player.id},()=>room.act(player.id,'answer',{answer:0}));
  assert.equal(events.length,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM processed_unit_events').get().n,1);assert.equal(room.pendingAchievementUnits().length,0);
  const raw=fs.readdirSync(f.source.historyDir).filter(name=>name.endsWith('.jsonl')||name.endsWith('.meta.json')).map(name=>fs.readFileSync(path.join(f.source.historyDir,name),'utf8')).join('\n');
  const publicViews=JSON.stringify(players.map(player=>room.view(player.id)));
  for(const userId of f.users){assert.ok(!raw.includes(userId),'history excludes canonical account IDs');assert.ok(!publicViews.includes(userId),'public room views exclude canonical account IDs');}
  assert.ok(!publicViews.includes('unit_event_id'));assert.ok(!publicViews.includes('achievementParticipants'));
  const self=store.list(f.users[0]);assert.ok(self.achievements.some(item=>item.id==='majority-first-vote'&&item.unlockedAt));assert.ok(!JSON.stringify(self).includes('seat_id'));assert.ok(!JSON.stringify(self).includes('participants'));
 }finally{history.close();db.close();}
});

for(const corruption of ['fingerprint','unit-column','progress-date','progress-qualification']){
 test('transfer validation rejects '+corruption+' corruption even when SQLite constraints and foreign keys remain valid',t=>{
  const f=fixture(t),saved=committed(f);
  withDatabase(f.source.dbFile,db=>{
   if(corruption==='fingerprint')db.prepare('UPDATE processed_unit_events SET fingerprint=? WHERE unit_event_id=?').run('0'.repeat(64),saved.events[0].unit_event_id);
   if(corruption==='unit-column')db.prepare('UPDATE processed_unit_events SET completed_at=? WHERE unit_event_id=?').run('2026-10-08T04:00:00.000Z',saved.events[0].unit_event_id);
   if(corruption==='progress-date')db.prepare('UPDATE achievement_progress SET first_completed_at=? WHERE user_id=? AND game_type=?').run('2026-10-08T04:00:00.000Z',f.users[0],'draw');
   if(corruption==='progress-qualification')db.prepare("INSERT INTO achievement_progress(user_id,achievement_id,rule_version,game_type,first_unit_event_id,first_completed_at) VALUES(?,'all-two-tables',1,'draw',?,?)").run(f.users[2],saved.events[0].unit_event_id,saved.events[0].completed_at);
   assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);assert.equal(Object.values(db.prepare('PRAGMA integrity_check').get())[0],'ok');
  });
  assert.throws(()=>validateData(f.source),invalidDatabase);
 });
}

test('encrypted schema 17 export and restore preserve the entire achievements digest, receipt facts, progress and old dates',async t=>{
 const f=fixture(t),saved=committed(f),before=validateData(f.source).summary.database,keyFile=path.join(f.root,'private','backup.key'),bundleDir=path.join(f.root,'bundle'),destinationDir=path.join(f.root,'restored');
 await run({action:'keygen',keyFile});
 const exported=await run({action:'export',sourceStopped:true,source:f.source,keyFile,outputDir:bundleDir});assert.equal(exported.summary.database.achievementsSha256,before.achievementsSha256);
 const verified=await run({action:'verify',bundleDir,keyFile});assert.equal(verified.summary.database.achievementsSha256,before.achievementsSha256);
 const preview=await run({action:'restore',bundleDir,keyFile,destinationDir,expectedBundleId:exported.bundleId});assert.equal(preview.restoredSummary.database.achievementsSha256,before.achievementsSha256);assert.equal(fs.existsSync(destinationDir),false);
 const restored=await run({action:'restore',bundleDir,keyFile,destinationDir,expectedBundleId:exported.bundleId,apply:true});assert.equal(restored.restoredSummary.database.achievementsSha256,before.achievementsSha256);assert.equal(restored.restoredSummary.database.accountsSha256,before.accountsSha256);
 const file=settings(restored.config).dbFile,db=openDatabase(file);
 try{
  assert.deepEqual(tableRows(db,tracked),saved.rows);assert.deepEqual(db.prepare('SELECT * FROM users ORDER BY id').all(),saved.users);
  const store=new AchievementStore(db);for(const event of saved.events)assert.equal(store.processUnit(event).duplicate,true);
  assert.throws(()=>store.processUnit({...saved.events[0],completed_at:'2026-10-08T04:00:00.000Z'}),error=>error.code==='UNIT_EVENT_CONFLICT');assert.deepEqual(tableRows(db,tracked),saved.rows);
 }finally{db.close();}
 assert.equal(validateData(settings(restored.config)).summary.database.achievementsSha256,before.achievementsSha256);
});

test('encrypted schema 16 restore introduces only empty unit/progress tables and preserves the preexisting achievement digest',async t=>{
 const f=fixture(t),oldRows=downgrade16(f.source.dbFile),before=validateData(f.source).summary.database,keyFile=path.join(f.root,'private','backup.key'),bundleDir=path.join(f.root,'bundle'),destinationDir=path.join(f.root,'restored');
 await run({action:'keygen',keyFile});const exported=await run({action:'export',sourceStopped:true,source:f.source,keyFile,outputDir:bundleDir});assert.equal(exported.summary.database.schemaVersion,16);
 const restored=await run({action:'restore',bundleDir,keyFile,destinationDir,apply:true,expectedBundleId:exported.bundleId});assert.equal(restored.restoredSummary.database.schemaVersion,SCHEMA_VERSION);assert.equal(restored.restoredSummary.database.achievementsSha256,before.achievementsSha256);
 withDatabase(settings(restored.config).dbFile,db=>{assert.deepEqual(tableRows(db,['users','user_achievements']),{users:oldRows.users,user_achievements:oldRows.user_achievements});for(const table of ACHIEVEMENT_TABLES)assert.equal(db.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);},{readOnly:true});
});

for(const [version,maximum]of [[16,16],[16,17],[17,17]]){
 test('an authenticated schema '+version+' bundle from maximumSchema '+maximum+' '+(maximum<17?'remains restorable without the newly added digest':'cannot omit its required achievement digest'),async t=>{
  const f=fixture(t);if(version===16)downgrade16(f.source.dbFile);else committed(f);
  const before=validateData(f.source).summary.database,keyFile=path.join(f.root,'private','backup.key'),bundleDir=path.join(f.root,'bundle'),destinationDir=path.join(f.root,'restored');
  await run({action:'keygen',keyFile});await run({action:'export',sourceStopped:true,source:f.source,keyFile,outputDir:bundleDir});
  // Reproduce the authenticated metadata shape emitted by the pre-schema-17
  // release. Payload bytes and their encryption/authentication remain exact.
  const file=path.join(bundleDir,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  delete manifest.summary.database.achievementsSha256;manifest.code.maximumSchema=maximum;delete manifest.authentication;
  const secret=Buffer.from(hkdfSync('sha256',fs.readFileSync(keyFile),manifest.bundleId,'afterhours-data-manifest-v1',32));
  manifest.authentication=createHmac('sha256',secret).update(canonical(manifest)).digest('hex');fs.writeFileSync(file,JSON.stringify(manifest));
  if(maximum>=17){await assert.rejects(run({action:'verify',bundleDir,keyFile}),error=>error.code==='VALIDATION_FAILED');assert.equal(fs.existsSync(destinationDir),false);return;}
  const verified=await run({action:'verify',bundleDir,keyFile});assert.equal(verified.summary.database.schemaVersion,16);
  const restored=await run({action:'restore',bundleDir,keyFile,destinationDir,apply:true,expectedBundleId:manifest.bundleId});
  assert.equal(restored.restoredSummary.database.schemaVersion,SCHEMA_VERSION);assert.equal(restored.restoredSummary.database.achievementsSha256,before.achievementsSha256);assert.equal(restored.restoredSummary.database.accountsSha256,before.accountsSha256);
 });
}
