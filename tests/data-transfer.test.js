const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { run, snapshot, canonical, safeError } = require('../src/data/transfer');
const { validateData } = require('../src/data/validation');
const { acquireDataLocks } = require('../src/data/locks');
const { openDatabase } = require('../src/db');
const { createAuth } = require('../src/auth');
const { createApp } = require('../src/app');
const { settings } = require('../src/config');
const { CommunityStore } = require('../src/community/store');
const { MusicStore } = require('../src/music/store');
const { HistoryStore } = require('../src/history/store');
const { Room } = require('../src/games/poker');
const { SubmissionService } = require('../src/integrations/github/submissions');
const { BoardStore } = require('../src/community/board');

const password = 'synthetic-test-password';
const mp3 = Buffer.concat([Buffer.from([255,251,144,100]), Buffer.alloc(830)]);
const png = fs.readFileSync(path.join(__dirname, '../public/assets/characters/traveler-neutral.png'));
const errorCode = code => error => error.code === code;
async function fixture(t, { playing = false, minimal = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afterhours-data-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const old = path.join(root, 'old'), source = { envId: 'test', dbFile: path.join(old,'app.sqlite'), historyDir: path.join(old,'history'), communityDir: path.join(old,'community'), musicDir: path.join(old,'music') };
  for (const dir of [source.historyDir, source.communityDir, source.musicDir]) fs.mkdirSync(dir, { recursive: true });
  const db = openDatabase(source.dbFile), auth = createAuth(db), adminId = await auth.bootstrap('transfer_admin', password), admin = db.prepare('SELECT * FROM users').get();
  const response = { cookie: null, setHeader(name,value) { if (name === 'Set-Cookie') this.cookie = value.split(';')[0]; } };
  const invitation = auth.createInvite(admin).code;
  const member = await auth.register({ username: 'transfer_member', displayName: '搬家玩家', password, confirmPassword: password, invite: invitation }, response);
  const oldCookie = response.cookie, newInvitation = auth.createInvite(admin).code, reset = auth.createReset(admin, member.id).token;
  let track, characterId, artworkId, historyId;
  if (!minimal) {
    const at = new Date().toISOString(); characterId = crypto.randomUUID(); artworkId = crypto.randomUUID();
    db.prepare('INSERT INTO player_characters(id,owner_id,name,created_at,shared) VALUES(?,?,?,?,0)').run(characterId,member.id,'私有角色',at);
    db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes,label) VALUES(?,?,?,?,?)').run(characterId,'neutral','image/png',png,'平常');
    db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at,shared) VALUES(?,?,?,?,?,?,0)').run(artworkId,member.id,'私有作品','image/png',png,at);
    db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'user:'+characterId,expression:'neutral',avatar:{kind:'artwork',artworkId}}),member.id);
    db.prepare('INSERT INTO community_gifts(id,author_id,author_name,title,title_key,category,image_mime,image_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),member.id,'搬家玩家','禮物','禮物','misc','image/png',png,at);
    db.prepare('INSERT INTO draw_words(id,author_id,author_name,title,title_key,aliases,difficulty,category,created_at,topic) VALUES(?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),member.id,'搬家玩家','搬家','搬家','[]','easy','test',at,'misc');
    db.prepare('INSERT INTO user_achievements(user_id,achievement_id,source_key,unlocked_at) VALUES(?,?,?,?)').run(member.id,'test-achievement','test-match',at);
    const issueId = crypto.randomUUID();
    db.prepare('INSERT INTO board_issues(id,author_id,title,body,name,game,status,at) VALUES(?,?,?,?,?,?,?,?)').run(issueId,member.id,'建議','保留內容','搬家玩家','general','open',at);
    db.prepare('INSERT INTO board_comments(id,issue_id,author_id,name,body,at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),issueId,adminId,'admin','回覆',at);
    for (const state of ['pending','sending','done','needs_review']) db.prepare('INSERT INTO submissions(id,user_id,kind,issue_id,payload,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),member.id,'issue',issueId,JSON.stringify({issueId,title:'待送內容',body:'保留',name:'搬家玩家',game:'general'}),state,at,at);
    track = new MusicStore(db,source.musicDir).add(member,{title:'搬家音樂',duration:60},mp3);
    new CommunityStore(source.communityDir).question({type:'two',prompt:'是否搬家？',options:['是','否']});
    const h = new HistoryStore(source.historyDir), room = new Room('ABC123','移轉對局'); h.attach(room);
    h.transact(room,{action:'create'},()=>room.add('A')); h.transact(room,{action:'join'},()=>room.add('B')); h.transact(room,{action:'start'},()=>room.start());
    if (!playing) h.transact(room,{action:'fold'},()=>room.act(room.players[room.turn].id,'fold'));
    historyId = h.list()[0].id; h.close();
    const blockedId = crypto.randomUUID(); db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,disabled,created_at) VALUES(?,?,?,?,?,?,?)').run(blockedId,'transfer_disabled','停用帳號',admin.password_hash,'member',1,at);
  }
  const expectedUsers = db.prepare('SELECT * FROM users ORDER BY id').all(); db.close();
  const keyFile = path.join(root,'private','backup.key'); await run({action:'keygen',keyFile});
  const bundleDir = path.join(root,'bundle'), destinationDir = path.join(root,'restored');
  const exportRequest = {action:'export',sourceStopped:true,source,keyFile,outputDir:bundleDir};
  return {root,source,keyFile,bundleDir,destinationDir,exportRequest,member,adminId,oldCookie,newInvitation,reset,expectedUsers,track,characterId,artworkId,historyId};
}
const restoreRequest = f => ({action:'restore',bundleDir:f.bundleDir,keyFile:f.keyFile,destinationDir:f.destinationDir});
function editManifest(f, change) {
  const file = path.join(f.bundleDir,'manifest.json'), m = JSON.parse(fs.readFileSync(file)); change(m); delete m.authentication;
  const secret = Buffer.from(crypto.hkdfSync('sha256',fs.readFileSync(f.keyFile),m.bundleId,'afterhours-data-manifest-v1',32));
  m.authentication = crypto.createHmac('sha256',secret).update(canonical(m)).digest('hex'); fs.writeFileSync(file,JSON.stringify(m));
}

test('encrypted full backup preserves accounts and assets; dry-run and real restore revoke tokens, hold outbox and remain bootable', async t => {
  const f = await fixture(t), initial = validateData(f.source).summary;
  const exported = await run(f.exportRequest);
  assert.equal(exported.summary.database.tableCounts.users,3); assert.equal(exported.summary.database.accountsSha256,initial.database.accountsSha256);
  assert.equal(exported.policy.accountCredentialsIncluded,true);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.bundleDir,'manifest.json')));
  for (const entry of manifest.files) {
    const bytes = fs.readFileSync(path.join(f.bundleDir,entry.payload));
    assert.equal(bytes.includes(Buffer.from('transfer_admin')),false); assert.equal(bytes.includes(Buffer.from('SQLite format 3')),false); assert.equal(bytes.includes(Buffer.from(f.expectedUsers[0].password_hash)),false);
  }
  const verified = await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile}); assert.equal(verified.bundleId,exported.bundleId);
  const dry = await run(restoreRequest(f)); assert.equal(dry.dryRun,true); assert.equal(fs.existsSync(f.destinationDir),false);
  const restored = await run({...restoreRequest(f),apply:true}); assert.equal(restored.dryRun,false); assert.equal(restored.changes.heldSubmissions,2); assert.equal(restored.config.EXTERNAL_SIDE_EFFECTS_ENABLED,'false');
  const target = settings(restored.config), check = openDatabase(target.dbFile);
  try {
    assert.deepEqual(check.prepare('SELECT * FROM users ORDER BY id').all(),f.expectedUsers);
    for (const table of ['sessions','invites','password_resets']) assert.equal(check.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
    assert.equal(check.prepare("SELECT COUNT(*) AS n FROM submissions WHERE state='needs_review'").get().n,3);
    assert.equal(check.prepare("SELECT COUNT(*) AS n FROM submissions WHERE state='done'").get().n,1);
    assert.deepEqual(Buffer.from(check.prepare('SELECT bytes FROM user_artworks WHERE id=?').get(f.artworkId).bytes),png);
  } finally { check.close(); }
  let remoteCalls = 0;
  const githubClient = {configured:true,async createIssue(){remoteCalls++;throw Error('Must never send');}};
  const app = createApp({...target,port:0,host:'127.0.0.1',githubClient});
  try {
    const {port} = await app.listen(), base = `http://127.0.0.1:${port}`;
    const post = async (route,data,cookie) => fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
    assert.equal((await fetch(base+'/api/profile/settings',{headers:{Cookie:f.oldCookie}})).status,401);
    const login = await post('auth/login',{username:'transfer_member',password}); assert.equal(login.status,200); assert.equal((await login.json()).id,f.member.id); const cookie=login.headers.get('set-cookie').split(';')[0];
    const adminLogin = await post('auth/login',{username:'transfer_admin',password}); assert.equal(adminLogin.status,200); assert.equal((await adminLogin.json()).role,'admin'); const adminCookie=adminLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('auth/login',{username:'transfer_disabled',password})).status,401);
    assert.equal((await post('auth/reset',{token:f.reset,password,confirmPassword:password})).status,400);
    assert.equal((await post('auth/register',{username:'wrong_invite',password,confirmPassword:password,invite:f.newInvitation})).status,400);
    assert.equal((await fetch(base+'/api/admin/users',{headers:{Cookie:cookie}})).status,403);
    const profile=await (await fetch(base+'/api/profile/settings',{headers:{Cookie:cookie}})).json(); assert.equal(profile.appearance.characterId,'user:'+f.characterId); assert.equal(profile.avatar.artworkId,f.artworkId);
    assert.deepEqual(Buffer.from(await (await fetch(base+'/assets/artworks/'+f.artworkId,{headers:{Cookie:cookie}})).arrayBuffer()),png);
    assert.equal((await fetch(base+'/assets/artworks/'+f.artworkId,{headers:{Cookie:adminCookie}})).status,404);
    const stream=await fetch(base+'/assets/music/'+f.track.id,{headers:{Cookie:cookie,Range:'bytes=2-5'}}); assert.equal(stream.status,206); assert.deepEqual(Buffer.from(await stream.arrayBuffer()),mp3.subarray(2,6));
    assert.equal((await fetch(base+'/assets/music/'+f.track.id,{method:'HEAD',headers:{Cookie:cookie}})).headers.get('content-length'),String(mp3.length));
    const history=await (await fetch(base+'/api/history/'+f.historyId,{headers:{Cookie:cookie}})).json(); assert.equal(history[0].kind,'header'); assert.equal(history.at(-1).after.phase,'showdown');
    const retryDb=new DatabaseSync(target.dbFile,{readOnly:true}); let pending;try{pending=retryDb.prepare("SELECT id FROM submissions WHERE state='needs_review'").get().id;}finally{retryDb.close();}
    const retry=await post('admin/submissions/retry',{id:pending},adminCookie); assert.equal(retry.status,503); assert.equal((await retry.json()).code,'EXTERNAL_WRITES_DISABLED'); assert.equal(remoteCalls,0);
  } finally { await app.close(); }
  await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('DESTINATION_EXISTS'));
  const original=new DatabaseSync(f.source.dbFile,{readOnly:true}); try {assert.equal(original.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);assert.equal(original.prepare("SELECT COUNT(*) AS n FROM submissions WHERE state='pending'").get().n,1);} finally{original.close();}
});

test('cold export rejects a running application and locks every writer location, including the legacy history lock', async t => {
  const f=await fixture(t,{minimal:true});
  await assert.rejects(run({...f.exportRequest,sourceStopped:false}),errorCode('SOURCE_NOT_STOPPED'));
  const app=createApp({...f.source,port:0,host:'127.0.0.1'});
  try { await assert.rejects(run(f.exportRequest),errorCode('DATA_IN_USE')); assert.throws(()=>createApp({...f.source}),errorCode('DATA_IN_USE')); } finally {await app.close();}
  fs.writeFileSync(path.join(f.source.historyDir,'.lock'),String(process.pid));
  await assert.rejects(run(f.exportRequest),errorCode('DATA_IN_USE')); fs.unlinkSync(path.join(f.source.historyDir,'.lock'));
  const guard=acquireDataLocks(f.source,'test'); try{assert.throws(()=>createApp({...f.source}),errorCode('DATA_IN_USE'));}finally{guard.release();}
  assert.equal(fs.existsSync(path.join(f.source.communityDir,'.afterhours-data-lock')),false);
  await run(f.exportRequest);
});

test('SQLite snapshots include committed WAL writes with both backup API and VACUUM INTO fallback', async t => {
  const f=await fixture(t,{minimal:true}), writer=openDatabase(f.source.dbFile);
  try {
    writer.exec('PRAGMA wal_autocheckpoint=0'); writer.prepare('UPDATE users SET display_name=? WHERE id=?').run('WAL 未 checkpoint',f.adminId);
    assert.ok(fs.statSync(f.source.dbFile+'-wal').size>0);
    for(const force of [false,true]){
      const file=path.join(f.root,'snapshot-'+force+'.sqlite'); const method=await snapshot(f.source.dbFile,file,force);
      const db=new DatabaseSync(file,{readOnly:true}); try{assert.equal(db.prepare('SELECT display_name FROM users WHERE id=?').get(f.adminId).display_name,'WAL 未 checkpoint');}finally{db.close();}
      if(force)assert.equal(method,'VACUUM INTO');
    }
  } finally{writer.close();}
  const result=await run({...f.exportRequest,forceVacuum:true}); assert.equal(result.snapshotMethod,'VACUUM INTO');
});

test('wrong keys and modified manifest or ciphertext are rejected without publishing a generation', async t => {
  const f=await fixture(t,{minimal:true}); await run(f.exportRequest);
  const wrongKey=path.join(f.root,'wrong.key'); await run({action:'keygen',keyFile:wrongKey});
  await assert.rejects(run({...restoreRequest(f),keyFile:wrongKey,apply:true}),errorCode('AUTHENTICATION_FAILED'));
  const file=path.join(f.bundleDir,'manifest.json'), original=fs.readFileSync(file), m=JSON.parse(original); m.origin.envId='tampered'; fs.writeFileSync(file,JSON.stringify(m));
  await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('AUTHENTICATION_FAILED')); fs.writeFileSync(file,original);
  const payload=path.join(f.bundleDir,m.files[0].payload), bytes=fs.readFileSync(payload); bytes[0]^=1; fs.writeFileSync(payload,bytes);
  await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('CORRUPT_BUNDLE')); assert.equal(fs.existsSync(f.destinationDir),false);
});

test('authenticated path traversal, case collisions and unsupported application versions are still rejected', async t => {
  const f=await fixture(t,{minimal:true}); await run(f.exportRequest); const file=path.join(f.bundleDir,'manifest.json'), original=fs.readFileSync(file);
  for (const logical of ['../outside.sqlite','C:/outside.sqlite','history/../../outside.jsonl','db\\afterhours.sqlite']) {
    editManifest(f,m=>m.files[0].logical=logical); await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('UNSAFE_PATH')); fs.writeFileSync(file,original);
  }
  editManifest(f,m=>m.files.push({...m.files[0],logical:'DB/AFTERHOURS.SQLITE'})); await assert.rejects(run(restoreRequest(f)),errorCode('UNSAFE_PATH')); fs.writeFileSync(file,original);
  editManifest(f,m=>m.code.maximumSchema=999); await assert.rejects(run(restoreRequest(f)),errorCode('UNSUPPORTED_BUNDLE')); fs.writeFileSync(file,original);
  editManifest(f,m=>m.code.assetsSha256='0'.repeat(64)); await assert.rejects(run(restoreRequest(f)),errorCode('ASSET_VERSION_MISMATCH'));
  assert.equal(fs.existsSync(f.destinationDir),false);
});

test('missing or unlisted files and symlinks cannot be used as a transfer source or bundle', async t => {
  const f=await fixture(t); const track=path.join(f.source.musicDir,f.track.id+'.mp3'), bytes=fs.readFileSync(track); fs.unlinkSync(track);
  await assert.rejects(run(f.exportRequest),errorCode('MISSING_MUSIC')); fs.writeFileSync(track,bytes);
  fs.writeFileSync(path.join(f.source.communityDir,'community.json.tmp'),'{}'); await assert.rejects(run(f.exportRequest),errorCode('UNEXPECTED_FILE')); fs.unlinkSync(path.join(f.source.communityDir,'community.json.tmp'));
  const linked=path.join(f.root,'link'); fs.symlinkSync(f.source.musicDir,linked,process.platform==='win32'?'junction':'dir');
  await assert.rejects(run({...f.exportRequest,source:{...f.source,musicDir:linked}}),errorCode('UNSAFE_PATH'));
  await run(f.exportRequest); const file=path.join(f.bundleDir,'manifest.json'), m=JSON.parse(fs.readFileSync(file));
  fs.writeFileSync(path.join(f.bundleDir,'payload','extra.bin'),'extra'); await assert.rejects(run(restoreRequest(f)),errorCode('CORRUPT_BUNDLE')); fs.unlinkSync(path.join(f.bundleDir,'payload','extra.bin'));
  fs.unlinkSync(path.join(f.bundleDir,m.files[0].payload)); await assert.rejects(run(restoreRequest(f)),errorCode('CORRUPT_BUNDLE'));
});

test('newer schemas, missing FK owners, broken profile references and invalid engine logs prevent export', async t => {
  const f=await fixture(t), db=new DatabaseSync(f.source.dbFile);
  try{db.exec('PRAGMA user_version=999');}finally{db.close();}
  await assert.rejects(run(f.exportRequest),errorCode('UNSUPPORTED_SCHEMA'));
  const fix=new DatabaseSync(f.source.dbFile); try{fix.exec('PRAGMA user_version=12; PRAGMA foreign_keys=OFF');fix.prepare('UPDATE user_artworks SET owner_id=? WHERE id=?').run(crypto.randomUUID(),f.artworkId);}finally{fix.close();}
  await assert.rejects(run(f.exportRequest),errorCode('FOREIGN_KEY_FAILED'));
  const fix2=new DatabaseSync(f.source.dbFile); try{fix2.prepare('UPDATE user_artworks SET owner_id=? WHERE id=?').run(f.member.id,f.artworkId);fix2.prepare('DELETE FROM character_images WHERE character_id=?').run(f.characterId);}finally{fix2.close();}
  await assert.rejects(run(f.exportRequest),errorCode('BROKEN_REFERENCE'));
  const fix3=new DatabaseSync(f.source.dbFile);try{fix3.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?)').run(f.characterId,'neutral','image/png',png);}finally{fix3.close();}
  const file=path.join(f.source.historyDir,f.historyId+'.jsonl'), original=fs.readFileSync(file,'utf8'), rows=original.trim().split('\n').map(JSON.parse);rows[0].engine.source+='tampered';fs.writeFileSync(file,rows.map(JSON.stringify).join('\n')+'\n');
  await assert.rejects(run(f.exportRequest),errorCode('INVALID_HISTORY'));fs.writeFileSync(file,original.slice(0,-2));await assert.rejects(run(f.exportRequest),errorCode('INVALID_HISTORY'));
});

test('unfinished matches require explicit acknowledgement and restore appends an interruption rather than fabricated scores', async t => {
  const f=await fixture(t,{playing:true}); await assert.rejects(run(f.exportRequest),errorCode('UNFINISHED_MATCHES'));
  await run({...f.exportRequest,acknowledgeInterruptedMatches:true}); await assert.rejects(run(restoreRequest(f)),errorCode('UNFINISHED_MATCHES'));
  const result=await run({...restoreRequest(f),apply:true,acknowledgeInterruptedMatches:true});assert.equal(result.changes.interruptedMatches,1);
  const meta=JSON.parse(fs.readFileSync(path.join(f.destinationDir,'history',f.historyId+'.meta.json')));assert.equal(meta.status,'interrupted');assert.equal(meta.result,undefined);
  const rows=fs.readFileSync(path.join(f.destinationDir,'history',f.historyId+'.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.equal(rows.at(-1).kind,'interrupted');assert.equal(rows.at(-1).reason,'server-data-restore');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.source.historyDir,f.historyId+'.meta.json'))).status,'playing');
});

test('old supported schema migrates only the restored copy and preserves account hashes', async t => {
  const f=await fixture(t,{minimal:true}), db=new DatabaseSync(f.source.dbFile);
  try{db.exec('DROP TABLE music_tracks; ALTER TABLE user_artworks DROP COLUMN shared; PRAGMA user_version=10');}finally{db.close();}
  await run(f.exportRequest); const result=await run({...restoreRequest(f),apply:true});assert.equal(result.restoredSummary.database.schemaVersion,12);
  const old=new DatabaseSync(f.source.dbFile,{readOnly:true});try{assert.equal(old.prepare('PRAGMA user_version').get().user_version,10);assert.equal(old.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='music_tracks'").get().n,0);}finally{old.close();}
});

test('existing destinations, nested source/output and configured size limits fail without touching old data', async t => {
  const f=await fixture(t,{minimal:true}); await run(f.exportRequest);
  fs.mkdirSync(f.destinationDir);fs.writeFileSync(path.join(f.destinationDir,'keep'),'original');
  await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('DESTINATION_EXISTS'));assert.equal(fs.readFileSync(path.join(f.destinationDir,'keep'),'utf8'),'original');
  await assert.rejects(run({...f.exportRequest,outputDir:path.join(f.source.musicDir,'bundle')}),errorCode('UNSAFE_PATH'));
  await assert.rejects(run({...f.exportRequest,outputDir:path.join(f.root,'too-small'),maxBytes:1}),errorCode('BUNDLE_LIMIT'));
  await assert.rejects(run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile,maxBytes:1}),errorCode('BUNDLE_LIMIT'));
});

test('partial publication keeps a blocking marker; disk-space failure cleans staging and leaves the source intact', async t => {
  const f=await fixture(t,{minimal:true});await run(f.exportRequest);
  const rename=fs.renameSync;
  fs.renameSync=(a,b)=>{if(b===path.join(f.destinationDir,'history')){const e=Error('injected write failure');e.code='ENOSPC';throw e;}return rename(a,b);};
  try{await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('PARTIAL_RESTORE'));}finally{fs.renameSync=rename;}
  assert.equal(fs.existsSync(path.join(f.destinationDir,'.afterhours-restore-in-progress')),true);
  assert.throws(()=>createApp({...settings({DB_FILE:path.join(f.destinationDir,'db','afterhours.sqlite'),HISTORY_DIR:path.join(f.destinationDir,'history'),COMMUNITY_DIR:path.join(f.destinationDir,'community')}),port:0}),errorCode('RESTORE_IN_PROGRESS'));
  const statfs=fs.statfsSync;fs.statfsSync=()=>({bavail:0n,bsize:4096n});
  try{await assert.rejects(run({...f.exportRequest,outputDir:path.join(f.root,'disk-full')}),errorCode('INSUFFICIENT_SPACE'));}finally{fs.statfsSync=statfs;}
  assert.equal(fs.existsSync(path.join(f.root,'disk-full')),false);assert.equal(fs.readdirSync(f.root).some(n=>n.startsWith('.afterhours-transfer-')),false);
});

test('a new server cannot start during the gap before the restore marker is installed', async t => {
  const f=await fixture(t,{minimal:true});await run(f.exportRequest);
  const mkdir=fs.mkdirSync;let blocked=false;
  fs.mkdirSync=(dir,options)=>{
    if(dir===f.destinationDir){
      assert.throws(()=>createApp({...settings({DB_FILE:path.join(f.destinationDir,'db','afterhours.sqlite'),HISTORY_DIR:path.join(f.destinationDir,'history'),COMMUNITY_DIR:path.join(f.destinationDir,'community')}),port:0}),errorCode('RESTORE_IN_PROGRESS'));blocked=true;
    }
    return mkdir(dir,options);
  };
  try{await run({...restoreRequest(f),apply:true});}finally{fs.mkdirSync=mkdir;}
  assert.equal(blocked,true);assert.equal(fs.existsSync(path.join(f.root,'.restored.afterhours-publish-lock')),false);
});

test('history validation handles Unicode across read boundaries and does not accumulate all event rows', async t => {
  const f=await fixture(t,{minimal:true}), id=crypto.randomUUID(), file=path.join(f.source.historyDir,id+'.jsonl');
  const fd=fs.openSync(file,'w');try{
    fs.writeSync(fd,JSON.stringify({kind:'session',schema:1,at:new Date().toISOString(),type:'poker',room:'ABC123'})+'\n');
    for(let seq=1;seq<=400;seq++){
      fs.writeSync(fd,JSON.stringify({kind:'intent',seq,operation:{name:'中文界線'.repeat(100)},before:{}})+'\n');
      fs.writeSync(fd,JSON.stringify({kind:'result',seq,ok:true,after:{name:'搬家玩家'},trace:[]})+'\n');
    }
  }finally{fs.closeSync(fd);}
  const result=validateData(f.source);assert.equal(result.summary.historyLogs,1);assert.equal(result.interruptedStates.size,0);
  await run(f.exportRequest);await run({...restoreRequest(f),apply:true});assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'history',id+'.jsonl')),fs.readFileSync(file));
});

test('AI CLI accepts stdin/file JSON, emits one redacted response and exits nonzero on errors', async t => {
  const f=await fixture(t,{minimal:true}), cli=path.join(__dirname,'../tools/server-data.cjs');
  const malformed=spawnSync(process.execPath,[cli,'--request','-'],{input:'{"password":"should-not-leak"',encoding:'utf8'});assert.equal(malformed.status,1);assert.equal(JSON.parse(malformed.stdout).error.code,'INVALID_REQUEST');assert.equal(malformed.stdout.includes('should-not-leak'),false);
  const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.equal(JSON.parse(help.stdout).result.version,1);
  const requestFile=path.join(f.root,'request.json');fs.writeFileSync(requestFile,JSON.stringify({action:'inspect',sourceStopped:true,source:f.source}));
  const inspected=spawnSync(process.execPath,[cli,'--request',requestFile],{encoding:'utf8'});assert.equal(inspected.status,0);assert.equal(JSON.parse(inspected.stdout).result.database.tableCounts.users,2);
  assert.equal(inspected.stdout.includes(f.expectedUsers[0].password_hash),false);assert.deepEqual(safeError(Error('secret-token')), {code:'TRANSFER_FAILED',message:'Transfer failed; inspect filesystem permissions, SQLite compatibility and stopped-writer state without publishing secrets'});
});

test('external side effects stay disabled even with pending submissions and a configured remote client', async t => {
  const f=await fixture(t), db=openDatabase(f.source.dbFile);let calls=0;
  const service=new SubmissionService(db,new BoardStore(db),{configured:true,createIssue(){calls++;}}, {enabled:false});
  try{
    const id=db.prepare("SELECT id FROM submissions WHERE state='pending'").get().id, user=db.prepare('SELECT * FROM users WHERE id=?').get(f.adminId);
    service.recover();await assert.rejects(service.processOne(id),errorCode('EXTERNAL_WRITES_DISABLED'));await assert.rejects(service.submit('issue',{submissionId:crypto.randomUUID()},user),errorCode('EXTERNAL_WRITES_DISABLED'));
    assert.equal(service.inFlight.size,0);assert.equal(calls,0);assert.equal(db.prepare('SELECT state FROM submissions WHERE id=?').get(id).state,'pending');
  }finally{db.close();}
  assert.equal(settings({}).externalSideEffectsEnabled,true);assert.equal(settings({EXTERNAL_SIDE_EFFECTS_ENABLED:'false'}).externalSideEffectsEnabled,false);assert.throws(()=>settings({EXTERNAL_SIDE_EFFECTS_ENABLED:'0'}));
});

test('legacy community issues and comments are imported on the restored copy; administrator CLI shares transfer locks', async t => {
  const f=await fixture(t,{minimal:true}), issue={id:crypto.randomUUID(),title:'舊留言',body:'搬家保留',name:'舊玩家',game:'general',status:'open',at:new Date().toISOString(),comments:[{id:crypto.randomUUID(),name:'回覆者',body:'一起保留',at:new Date().toISOString()}]};
  fs.writeFileSync(path.join(f.source.communityDir,'community.json'),JSON.stringify({issues:[issue],questions:[]}));
  await run(f.exportRequest);const result=await run({...restoreRequest(f),apply:true});assert.equal(result.restoredSummary.database.tableCounts.board_issues,1);assert.equal(result.restoredSummary.database.tableCounts.board_comments,1);
  const original=new DatabaseSync(f.source.dbFile,{readOnly:true});try{assert.equal(original.prepare('SELECT COUNT(*) AS n FROM board_issues').get().n,0);}finally{original.close();}
  const guard=acquireDataLocks(f.source,'test');
  try{const child=spawnSync(process.execPath,[path.join(__dirname,'../admin.js'),'init','another_admin'],{encoding:'utf8',env:{...process.env,DB_FILE:f.source.dbFile,HISTORY_DIR:f.source.historyDir,COMMUNITY_DIR:f.source.communityDir,MUSIC_DIR:f.source.musicDir}});assert.equal(child.status,1);assert.match(child.stderr,/already in use/);}finally{guard.release();}
});
