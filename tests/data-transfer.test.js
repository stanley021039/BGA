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
const { openDatabase, SCHEMA_VERSION } = require('../src/db');
const { DrawWordStore } = require('../src/games/draw-guess-store');
const { WORDS } = require('../src/games/draw-guess-words');
const { createAuth } = require('../src/auth');
const { createApp } = require('../src/app');
const { settings } = require('../src/config');
const { CommunityStore } = require('../src/community/store');
const { MusicStore } = require('../src/music/store');
const { HistoryStore } = require('../src/history/store');
const { Room } = require('../src/games/poker');
const { SubmissionService } = require('../src/integrations/github/submissions');
const { BoardStore } = require('../src/community/board');
const { MarketStore, validateMarketDatabase } = require('../src/market/store');

const password = 'synthetic-test-password';
const mp3 = Buffer.concat([Buffer.from([255,251,144,100]), Buffer.alloc(830)]);
const png = fs.readFileSync(path.join(__dirname, '../public/assets/characters/traveler-neutral.png'));
const errorCode = code => error => error.code === code;
function expressionWav(samples = 25) {
  const bytes = Buffer.alloc(44 + samples * 2, 0x2a);
  bytes.write('RIFF',0); bytes.writeUInt32LE(bytes.length-8,4); bytes.write('WAVEfmt ',8); bytes.writeUInt32LE(16,16);
  bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22); bytes.writeUInt32LE(24000,24); bytes.writeUInt32LE(48000,28);
  bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(samples*2,40);
  return bytes;
}
const wav = expressionWav();
const marketTables = ['market_rounds','market_votes','market_settlements','market_ledger','market_requests'];
const dropMarket = 'DROP TABLE market_requests; DROP TABLE market_ledger; DROP TABLE market_settlements; DROP TABLE market_votes; DROP TABLE market_rounds;';
function seedMarket(db,f) {
  let now=Date.parse('2027-01-04T12:00:00Z');
  const store=new MarketStore(db,()=>now),admin=db.prepare('SELECT * FROM users WHERE id=?').get(f.adminId);
  const id=store.create(admin,{requestId:crypto.randomUUID(),targetDate:'2027-01-06',confirmed:true}).roundId;
  store.vote(f.member,{requestId:crypto.randomUUID(),roundId:id,optionId:'rally',expectedRevision:0});
  now=Date.parse('2027-01-06T05:30:00Z');
  for (const [expectedRevision,returnPct] of [[0,2],[1,-2]]) store.settle(admin,{requestId:crypto.randomUUID(),roundId:id,returnPct,expectedRevision,reason:expectedRevision?'移轉前更正':'',confirmed:true});
}
async function fixture(t, { playing = false, minimal = false, sounds = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afterhours-data-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const old = path.join(root, 'old'), source = { envId: 'test', dbFile: path.join(old,'app.sqlite'), historyDir: path.join(old,'history'), communityDir: path.join(old,'community'), musicDir: path.join(old,'music') };
  for (const dir of [source.historyDir, source.communityDir, source.musicDir]) fs.mkdirSync(dir, { recursive: true });
  const db = openDatabase(source.dbFile), auth = createAuth(db), adminId = await auth.bootstrap('transfer_admin', password), admin = db.prepare('SELECT * FROM users').get();
  const response = { cookie: null, setHeader(name,value) { if (name === 'Set-Cookie') this.cookie = value.split(';')[0]; } };
  const invitation = auth.createInvite(admin).code;
  const member = await auth.register({ username: 'transfer_member', displayName: '搬家玩家', password, confirmPassword: password, invite: invitation }, response);
  const oldCookie = response.cookie, newInvitation = auth.createInvite(admin).code, reset = auth.createReset(admin, member.id).token;
  let track, characterId, artworkId, historyId, soundExpression;
  if (!minimal) {
    const at = new Date().toISOString(); characterId = crypto.randomUUID(); artworkId = crypto.randomUUID();
    db.prepare('INSERT INTO player_characters(id,owner_id,name,created_at,shared) VALUES(?,?,?,?,0)').run(characterId,member.id,'私有角色',at);
    db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes,label) VALUES(?,?,?,?,?)').run(characterId,'neutral','image/png',png,'平常');
    if (sounds) {
      soundExpression = 'emote-' + crypto.randomUUID();
      db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes,label) VALUES(?,?,?,?,?)').run(characterId,soundExpression,'image/png',png,'有聲表情');
      db.prepare('INSERT INTO character_sounds(character_id,expression,mime,bytes,duration_ms) VALUES(?,?,?,?,?)').run(characterId,soundExpression,'audio/wav',wav,2);
    }
    db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at,shared) VALUES(?,?,?,?,?,?,0)').run(artworkId,member.id,'私有作品','image/png',png,at);
    db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'user:'+characterId,expression:soundExpression || 'neutral',avatar:{kind:'artwork',artworkId}}),member.id);
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
  return {root,source,keyFile,bundleDir,destinationDir,exportRequest,member,adminId,oldCookie,newInvitation,reset,expectedUsers,track,characterId,artworkId,historyId,soundExpression};
}
async function legacyFixture(t, version) {
  const f = await fixture(t, { minimal: true }), db = new DatabaseSync(f.source.dbFile);
  try {
    db.exec('DROP TABLE character_sounds; DROP TABLE market_requests; DROP TABLE market_ledger; DROP TABLE market_settlements; DROP TABLE market_votes; DROP TABLE market_rounds');
    if (version < 13) db.exec('DROP TABLE draw_word_exclusions');
    if (version < 11) db.exec('DROP TABLE music_tracks');
    if (version < 9) db.exec('DROP TABLE draw_words');
    else if (version < 10) db.exec('ALTER TABLE draw_words DROP COLUMN topic');
    if (version < 8) db.exec('DROP TABLE user_artworks');
    else if (version < 12) db.exec('ALTER TABLE user_artworks DROP COLUMN shared');
    if (version < 7) db.exec('DROP INDEX player_characters_shared; ALTER TABLE player_characters DROP COLUMN shared');
    if (version < 6) db.exec('DROP TABLE user_achievements');
    if (version < 5) db.exec('DROP TABLE community_gifts');
    if (version < 4) db.exec('DROP INDEX character_images_label; ALTER TABLE character_images DROP COLUMN label');
    if (version < 3) db.exec('DROP TABLE character_images; DROP TABLE player_characters');
    if (version < 2) db.exec('DROP TABLE board_comments; DROP TABLE submissions; DROP TABLE board_issues');
    const at = new Date().toISOString();
    if (version >= 3) {
      f.characterId = crypto.randomUUID();
      db.prepare('INSERT INTO player_characters(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(f.characterId,f.member.id,'舊版私有角色',at);
      db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?)').run(f.characterId,'neutral','image/png',png);
      db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({characterId:'user:'+f.characterId,expression:'neutral'}),f.member.id);
    }
    if (version >= 5) {
      f.giftId = crypto.randomUUID();
      db.prepare('INSERT INTO community_gifts(id,author_id,author_name,title,title_key,category,image_mime,image_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(f.giftId,f.member.id,'搬家玩家','舊版禮物','舊版禮物','misc','image/png',png,at);
    }
    if (version >= 8) {
      f.artworkId = crypto.randomUUID();
      db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?)').run(f.artworkId,f.member.id,'舊版作品','image/png',png,at);
    }
    db.exec('PRAGMA user_version=' + version);
    f.expectedUsers = db.prepare('SELECT * FROM users ORDER BY id').all();
  } finally { db.close(); }
  return f;
}
const restoreRequest = f => ({action:'restore',bundleDir:f.bundleDir,keyFile:f.keyFile,destinationDir:f.destinationDir});
function editManifest(f, change) {
  const file = path.join(f.bundleDir,'manifest.json'), m = JSON.parse(fs.readFileSync(file)); change(m); delete m.authentication;
  const secret = Buffer.from(crypto.hkdfSync('sha256',fs.readFileSync(f.keyFile),m.bundleId,'afterhours-data-manifest-v1',32));
  m.authentication = crypto.createHmac('sha256',secret).update(canonical(m)).digest('hex'); fs.writeFileSync(file,JSON.stringify(m));
}
function editBundleDatabase(f, change) {
  const manifest = JSON.parse(fs.readFileSync(path.join(f.bundleDir,'manifest.json'))), entry = manifest.files.find(file => file.logical === 'db/afterhours.sqlite');
  const secret = Buffer.from(crypto.hkdfSync('sha256',fs.readFileSync(f.keyFile),manifest.bundleId,'afterhours-data-encryption-v1',32));
  const payload = path.join(f.bundleDir,entry.payload), aad = Buffer.from(manifest.bundleId+'\0'+entry.logical);
  const decipher = crypto.createDecipheriv('aes-256-gcm',secret,Buffer.from(entry.iv,'hex')); decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(entry.tag,'hex'));
  const file = path.join(f.root,'edited-bundle.sqlite');
  fs.writeFileSync(file,Buffer.concat([decipher.update(fs.readFileSync(payload)),decipher.final()]));
  const db = new DatabaseSync(file); try { change(db); } finally { db.close(); }
  const bytes = fs.readFileSync(file), iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm',secret,iv); cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(bytes),cipher.final()]); fs.writeFileSync(payload,encrypted); fs.unlinkSync(file);
  editManifest(f,m => {
    Object.assign(m.files.find(item => item.logical === entry.logical),{bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cipherSha256:crypto.createHash('sha256').update(encrypted).digest('hex'),iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex')});
    m.totalBytes = m.files.reduce((total,item) => total+item.bytes,0);
  });
}

test('encrypted full backup preserves accounts and assets; dry-run and real restore revoke tokens, hold outbox and remain bootable', async t => {
  const f = await fixture(t,{sounds:true}), initial = validateData(f.source).summary;
  const exported = await run(f.exportRequest);
  assert.equal(exported.summary.database.tableCounts.users,3); assert.equal(exported.summary.database.accountsSha256,initial.database.accountsSha256);
  assert.equal(exported.policy.accountCredentialsIncluded,true);
  assert.equal(exported.summary.database.tableCounts.character_sounds,1);
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
    const sound = check.prepare('SELECT * FROM character_sounds WHERE character_id=? AND expression=?').get(f.characterId,f.soundExpression);
    assert.equal(sound.mime,'audio/wav'); assert.equal(sound.duration_ms,2); assert.equal(sound.bytes.length,wav.length); assert.deepEqual(Buffer.from(sound.bytes),wav);
    assert.equal(check.prepare('PRAGMA foreign_key_check').all().length,0);
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
    const profile=await (await fetch(base+'/api/profile/settings',{headers:{Cookie:cookie}})).json(); assert.equal(profile.appearance.characterId,'user:'+f.characterId); assert.equal(profile.appearance.expression,f.soundExpression); assert.equal(profile.avatar.artworkId,f.artworkId);
    assert.deepEqual(Buffer.from(await (await fetch(base+'/assets/artworks/'+f.artworkId,{headers:{Cookie:cookie}})).arrayBuffer()),png);
    assert.equal((await fetch(base+'/assets/artworks/'+f.artworkId,{headers:{Cookie:adminCookie}})).status,404);
    const stream=await fetch(base+'/assets/music/'+f.track.id,{headers:{Cookie:cookie,Range:'bytes=2-5'}}); assert.equal(stream.status,206); assert.deepEqual(Buffer.from(await stream.arrayBuffer()),mp3.subarray(2,6));
    assert.equal((await fetch(base+'/assets/music/'+f.track.id,{method:'HEAD',headers:{Cookie:cookie}})).headers.get('content-length'),String(mp3.length));
    const history=await (await fetch(base+'/api/history/'+f.historyId,{headers:{Cookie:cookie}})).json(); assert.equal(history[0].kind,'header'); assert.equal(history.at(-1).after.phase,'showdown');
    const retryDb=new DatabaseSync(target.dbFile,{readOnly:true}); let pending;try{pending=retryDb.prepare("SELECT id FROM submissions WHERE state='needs_review'").get().id;}finally{retryDb.close();}
    const retry=await post('admin/submissions/retry',{id:pending},adminCookie); assert.equal(retry.status,503); assert.equal((await retry.json()).code,'EXTERNAL_WRITES_DISABLED'); assert.equal(remoteCalls,0);
  } finally { await app.close(); }
  await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('DESTINATION_EXISTS'));
  const original=new DatabaseSync(f.source.dbFile,{readOnly:true}); try {assert.equal(original.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,1);assert.equal(original.prepare("SELECT COUNT(*) AS n FROM submissions WHERE state='pending'").get().n,1);assert.deepEqual(Buffer.from(original.prepare('SELECT bytes FROM character_sounds').get().bytes),wav);} finally{original.close();}
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

test('restore pins the verified bundle identity across same-key replacements of a local bundle path', async t => {
  const f = await fixture(t,{minimal:true}), original = await run(f.exportRequest);
  const verified = await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile});
  assert.equal(verified.bundleId,original.bundleId);
  const pinned = {...restoreRequest(f),expectedBundleId:verified.bundleId};
  const preview = await run({...pinned,expectedBundleId:verified.bundleId.toUpperCase()});
  assert.equal(preview.dryRun,true); assert.equal(preview.bundleId,verified.bundleId); assert.equal(preview.restoredSummary.database.tableCounts.users,2);
  const source = openDatabase(f.source.dbFile);
  try { source.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),'replacement_user','Different backup',f.expectedUsers[0].password_hash,'member',new Date().toISOString()); }
  finally { source.close(); }
  const secondDir = path.join(f.root,'second-bundle'), savedOriginal = path.join(f.root,'original-bundle');
  const replacement = await run({...f.exportRequest,outputDir:secondDir});
  assert.notEqual(replacement.bundleId,verified.bundleId); assert.equal(replacement.summary.database.tableCounts.users,3);
  for (const directory of [f.bundleDir,secondDir,savedOriginal]) assert.equal(path.dirname(path.resolve(directory)),path.resolve(f.root));
  fs.renameSync(f.bundleDir,savedOriginal); fs.renameSync(secondDir,f.bundleDir);
  for (const apply of [false,true]) await assert.rejects(run({...pinned,apply}),error=>{
    assert.equal(error.code,'BUNDLE_CHANGED'); assert.equal(safeError(error).code,'BUNDLE_CHANGED'); return true;
  });
  assert.equal(fs.existsSync(f.destinationDir),false);
  assert.equal(fs.readdirSync(f.root).some(name=>name.startsWith('.afterhours-transfer-')),false);
  const cli = path.join(__dirname,'../tools/server-data.cjs');
  const rejected = spawnSync(process.execPath,[cli,'--request','-'],{input:JSON.stringify({...pinned,apply:true}),encoding:'utf8'});
  assert.equal(rejected.status,1); assert.equal(JSON.parse(rejected.stdout).error.code,'BUNDLE_CHANGED'); assert.equal(fs.existsSync(f.destinationDir),false);
  // Omitting the optional pin retains the existing explicit CLI restore contract.
  const legacy = spawnSync(process.execPath,[cli,'--request','-'],{input:JSON.stringify({...restoreRequest(f),apply:true}),encoding:'utf8'});
  assert.equal(legacy.status,0); const result = JSON.parse(legacy.stdout).result;
  assert.equal(result.bundleId,replacement.bundleId); assert.equal(result.restoredSummary.database.tableCounts.users,3);
});

test('restore rejects malformed expected bundle identities before unpacking or publishing', async t => {
  const f = await fixture(t,{minimal:true});
  for (const expectedBundleId of [null,'',42,{},'not-a-uuid']) await assert.rejects(run({...restoreRequest(f),expectedBundleId,apply:true}),errorCode('INVALID_REQUEST'));
  assert.equal(fs.existsSync(f.destinationDir),false);
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
  const fix=new DatabaseSync(f.source.dbFile); try{fix.exec('PRAGMA user_version='+SCHEMA_VERSION+'; PRAGMA foreign_keys=OFF');fix.prepare('UPDATE user_artworks SET owner_id=? WHERE id=?').run(crypto.randomUUID(),f.artworkId);}finally{fix.close();}
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

test('full backup preserves builtin and custom word bans with their majority audit after restore', async t => {
  const f=await fixture(t,{minimal:true}),db=openDatabase(f.source.dbFile);
  let custom,expected;
  try {
    const store=new DrawWordStore(db),author=db.prepare('SELECT * FROM users WHERE id=?').get(f.member.id);
    custom=store.add(author,{title:'不再抽到的測試題',aliases:[],difficulty:'easy',topic:'misc'});
    for(const word of [WORDS[0],custom]){
      const electorate=Array.from({length:4},()=>crypto.randomUUID());
      store.ban(word,{roomCode:'ABC123',resultId:crypto.randomUUID(),gameRunId:crypto.randomUUID(),electorate,votes:electorate.slice(0,3),required:3});
    }
    expected=db.prepare('SELECT * FROM draw_word_exclusions ORDER BY title_key').all();
    assert.equal(expected.length,2);
  } finally {db.close();}
  const exported=await run(f.exportRequest);assert.equal(exported.summary.database.tableCounts.draw_word_exclusions,2);
  const verified=await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile});assert.equal(verified.summary.database.tableCounts.draw_word_exclusions,2);
  const restored=await run({...restoreRequest(f),apply:true}),target=settings(restored.config),check=openDatabase(target.dbFile);
  try {
    assert.deepEqual(check.prepare('SELECT * FROM draw_word_exclusions ORDER BY title_key').all(),expected);
    const store=new DrawWordStore(check);
    assert.equal(store.builtin().some(word=>word.id===WORDS[0].id),false);
    assert.equal(store.list().some(word=>word.id===custom.id),false);
    assert.ok(check.prepare('SELECT id FROM draw_words WHERE id=?').get(custom.id));
    assert.throws(()=>store.add(check.prepare('SELECT * FROM users WHERE id=?').get(f.member.id),{title:custom.title,aliases:[],difficulty:'easy',topic:'misc'}),{code:'DRAW_WORD_BANNED'});
  } finally {check.close();}
  const app=createApp({...target,port:0,host:'127.0.0.1',githubClient:{configured:false}});
  try {
    const {port}=await app.listen(),base='http://127.0.0.1:'+port;
    const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'transfer_member',password})});
    assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
    const response=await fetch(base+'/api/draw/words',{headers:{Cookie:cookie}});assert.equal(response.status,200);
    const words=await response.json();assert.equal(words.builtin.some(word=>word.id===WORDS[0].id),false);assert.equal(words.custom.some(word=>word.id===custom.id),false);
  } finally {await app.close();}
  const original=new DatabaseSync(f.source.dbFile,{readOnly:true});
  try {assert.deepEqual(original.prepare('SELECT * FROM draw_word_exclusions ORDER BY title_key').all(),expected);} finally {original.close();}
});

test('schema 12 backup gains an empty ban ledger only in its restored copy', async t => {
  const f=await fixture(t,{minimal:true}),db=new DatabaseSync(f.source.dbFile);
  try {db.exec('DROP TABLE character_sounds; DROP TABLE market_requests; DROP TABLE market_ledger; DROP TABLE market_settlements; DROP TABLE market_votes; DROP TABLE market_rounds; DROP TABLE draw_word_exclusions; PRAGMA user_version=12');} finally {db.close();}
  const before=validateData(f.source).summary.database;assert.equal(before.schemaVersion,12);assert.equal(before.tableCounts.draw_word_exclusions,undefined);
  await run(f.exportRequest);const restored=await run({...restoreRequest(f),apply:true});
  assert.equal(restored.restoredSummary.database.schemaVersion,SCHEMA_VERSION);assert.equal(restored.restoredSummary.database.tableCounts.draw_word_exclusions,0);
  assert.equal(restored.restoredSummary.database.accountsSha256,before.accountsSha256);
  assert.deepEqual(validateData(f.source).summary.database,before);
});

test('schema 14 source missing the ban ledger is rejected before export', async t => {
  const f=await fixture(t,{minimal:true}),db=new DatabaseSync(f.source.dbFile);
  try {db.exec('DROP TABLE draw_word_exclusions; PRAGMA user_version=14');} finally {db.close();}
  await assert.rejects(run(f.exportRequest),errorCode('INVALID_DATABASE'));
});

test('schema 15 requires its expression sound table even when it contains no sounds', async t => {
  const f=await fixture(t,{minimal:true}),db=new DatabaseSync(f.source.dbFile);
  try {db.exec('DROP TABLE character_sounds');} finally {db.close();}
  await assert.rejects(run(f.exportRequest),errorCode('INVALID_DATABASE'));
  assert.equal(fs.existsSync(f.bundleDir),false);
});

for (const layout of ['sounds-and-ban','market-and-ban','sounds-market-and-ban']) test(`legacy schema 14 ${layout} validates, upgrades and cold-restores all existing data to schema 15`, async t => {
  const hasSounds=layout!=='market-and-ban',hasMarket=layout!=='sounds-and-ban';
  const f=await fixture(t,{sounds:hasSounds}),db=new DatabaseSync(f.source.dbFile);
  let rows;
  try {
    new DrawWordStore(db).ban(WORDS[0],{roomCode:'ABC123',resultId:crypto.randomUUID(),gameRunId:crypto.randomUUID(),electorate:[f.adminId,f.member.id],votes:[f.adminId,f.member.id],required:2});
    if (hasMarket) seedMarket(db,f); else db.exec(dropMarket);
    if (!hasSounds) db.exec('DROP TABLE character_sounds');
    db.exec('PRAGMA user_version=14');
    const existing=['users','draw_word_exclusions',...(hasSounds?['character_sounds']:[]),...(hasMarket?marketTables:[])];
    rows=Object.fromEntries(existing.map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  } finally {db.close();}
  const before=validateData(f.source).summary.database;
  assert.equal(before.schemaVersion,14);
  await run(f.exportRequest);await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile});
  const dry=await run(restoreRequest(f));assert.equal(dry.dryRun,true);assert.equal(fs.existsSync(f.destinationDir),false);
  assert.equal(dry.restoredSummary.database.schemaVersion,15);
  const restored=await run({...restoreRequest(f),apply:true});
  assert.deepEqual(validateData(f.source).summary.database,before,'cold restore leaves every source digest and table count unchanged');
  const check=database=>{
    assert.equal(database.prepare('PRAGMA user_version').get().user_version,15);
    for (const [table,expected] of Object.entries(rows)) assert.deepEqual(database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),expected);
    for (const table of ['character_sounds',...marketTables]) assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
    if (!hasSounds) assert.equal(database.prepare('SELECT COUNT(*) n FROM character_sounds').get().n,0);
    if (!hasMarket) for (const table of marketTables) assert.equal(database.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
    assert.equal(new DrawWordStore(database).isExcluded(WORDS[0]),true);
    assert.equal(validateMarketDatabase(database),true);
    assert.equal(new MarketStore(database).stats(f.member.id).score,hasMarket?-1:0);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);
  };
  const target=openDatabase(restored.config.DB_FILE);
  try {
    check(target);
    for (const table of ['sessions','invites','password_resets']) assert.equal(target.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
    const user=await createAuth(target).login({username:'transfer_member',password},{setHeader(){}});
    assert.equal(user.id,f.member.id);
  } finally {target.close();}
  for (const digest of Object.keys(before.blobDigests)) assert.equal(restored.restoredSummary.database.blobDigests[digest],before.blobDigests[digest]);
  const upgraded=openDatabase(f.source.dbFile);try {check(upgraded);} finally {upgraded.close();}
  const restarted=openDatabase(f.source.dbFile);try {check(restarted);} finally {restarted.close();}
});

test('schema 14 market restoration rejects populated contents in the newly introduced sound table', async t => {
  const f=await fixture(t,{sounds:true}),db=new DatabaseSync(f.source.dbFile);
  try {db.exec('DROP TABLE character_sounds; PRAGMA user_version=14');} finally {db.close();}
  const before=validateData(f.source).summary.database;await run(f.exportRequest);
  const exec=DatabaseSync.prototype.exec;let injected=false;
  DatabaseSync.prototype.exec=function(sql) {
    const result=exec.call(this,sql);
    if (sql==='PRAGMA wal_checkpoint(TRUNCATE)') {
      this.prepare('INSERT INTO character_sounds(character_id,expression,mime,bytes,duration_ms) VALUES(?,?,?,?,?)').run(f.characterId,f.soundExpression,'audio/wav',wav,2);
      injected=true;
    }
    return result;
  };
  try {await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('VALIDATION_FAILED'));}
  finally {DatabaseSync.prototype.exec=exec;}
  assert.equal(injected,true);assert.equal(fs.existsSync(f.destinationDir),false);assert.deepEqual(validateData(f.source).summary.database,before);
});

test('legacy schema 14 rejects every partial market layout, missing feature families and malformed empty tables before migration', async t => {
  const malformed=[
    ...[...marketTables].map(table=>({name:'missing '+table,mutate(db){db.exec('DROP TABLE '+table);}})),
    {name:'no feature family',mutate(db){db.exec(dropMarket+'DROP TABLE character_sounds;');}},
    {name:'missing ban ledger',mutate(db){db.exec('DROP TABLE draw_word_exclusions;');}},
    {name:'sound FK missing',mutate(db){db.exec('DROP TABLE character_sounds; CREATE TABLE character_sounds(character_id TEXT NOT NULL,expression TEXT NOT NULL,mime TEXT NOT NULL CHECK(mime=\'audio/wav\'),bytes BLOB NOT NULL,duration_ms INTEGER NOT NULL CHECK(typeof(duration_ms)=\'integer\' AND duration_ms BETWEEN 1 AND 10000),PRIMARY KEY(character_id,expression))');}},
    {name:'market request FK missing',mutate(db){db.exec('DROP TABLE market_requests; CREATE TABLE market_requests(user_id TEXT NOT NULL,request_id TEXT NOT NULL,operation TEXT NOT NULL,fingerprint TEXT NOT NULL,response_json TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,request_id))');}},
    {name:'market ledger checks missing',mutate(db){const sql=db.prepare("SELECT sql FROM sqlite_master WHERE name='market_ledger'").get().sql;db.exec('DROP TABLE market_ledger;'+sql.replace("CHECK(kind IN ('award','reversal'))",''));}},
    {name:'market target uniqueness missing',mutate(db){const sql=db.prepare("SELECT sql FROM sqlite_master WHERE name='market_rounds'").get().sql;db.exec('DROP TABLE market_rounds;'+sql.replace('target_date TEXT NOT NULL UNIQUE','target_date TEXT NOT NULL'));}},
  ];
  for (const invalid of malformed) {
    const f=await fixture(t,{minimal:true}),db=new DatabaseSync(f.source.dbFile);
    try {invalid.mutate(db);db.exec('PRAGMA user_version=14');} finally {db.close();}
    const before=fs.readFileSync(f.source.dbFile);
    await assert.rejects(run(f.exportRequest),errorCode('INVALID_DATABASE'),invalid.name);
    assert.equal(fs.existsSync(f.bundleDir),false);
    assert.throws(()=>openDatabase(f.source.dbFile),/Incomplete|Invalid/,invalid.name);
    assert.deepEqual(fs.readFileSync(f.source.dbFile),before,invalid.name+' must not advance schema or repair a malformed table');
  }
});

test('the exact ten-second canonical expression sound round-trips without changing its bytes or duration', async t => {
  const f=await fixture(t,{sounds:true}),maximum=expressionWav(240000),db=new DatabaseSync(f.source.dbFile);
  try {db.prepare('UPDATE character_sounds SET bytes=?,duration_ms=10000').run(maximum);} finally {db.close();}
  const before=validateData(f.source).summary.database; assert.equal(maximum.length,480044);
  await run(f.exportRequest);await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile});
  const restored=await run({...restoreRequest(f),apply:true}),check=new DatabaseSync(restored.config.DB_FILE,{readOnly:true});
  try {
    const sound=check.prepare('SELECT * FROM character_sounds').get();assert.equal(sound.duration_ms,10000);assert.equal(sound.bytes.length,480044);assert.deepEqual(Buffer.from(sound.bytes),maximum);
    assert.deepEqual(check.prepare('SELECT * FROM users ORDER BY id').all(),f.expectedUsers);
  } finally {check.close();}
  assert.deepEqual(restored.restoredSummary.database.blobDigests,before.blobDigests);
  assert.deepEqual(validateData(f.source).summary.database,before);
});

const invalidSounds = [
  {name:'non-canonical audio',code:'VALIDATION_FAILED',mutate(db) {const bytes=Buffer.from(wav);bytes.writeUInt32LE(44100,24);db.prepare('UPDATE character_sounds SET bytes=?').run(bytes);}},
  {name:'audio longer than ten seconds',code:'VALIDATION_FAILED',mutate(db) {db.prepare('UPDATE character_sounds SET bytes=?,duration_ms=10000').run(expressionWav(240001));}},
  {name:'duration inconsistent with WAV samples',code:'VALIDATION_FAILED',mutate(db) {db.exec('UPDATE character_sounds SET duration_ms=1');}},
  {name:'neutral expression audio',code:'BROKEN_REFERENCE',mutate(db) {db.exec("UPDATE character_sounds SET expression='neutral'");}},
  {name:'missing composite expression reference',code:'FOREIGN_KEY_FAILED',mutate(db) {db.exec('PRAGMA foreign_keys=OFF');db.prepare('UPDATE character_sounds SET expression=?').run('emote-'+crypto.randomUUID());}},
  {name:'a forged table without the composite image FK',code:'INVALID_DATABASE',mutate(db) {db.exec('CREATE TABLE forged_sounds(character_id TEXT NOT NULL,expression TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,duration_ms INTEGER NOT NULL,PRIMARY KEY(character_id,expression)); INSERT INTO forged_sounds SELECT * FROM character_sounds; DROP TABLE character_sounds; ALTER TABLE forged_sounds RENAME TO character_sounds');}},
  {name:'forged constraints allowing a MIME inconsistent with canonical audio',code:'INVALID_DATABASE',mutate(db) {db.exec("CREATE TABLE forged_sounds(character_id TEXT NOT NULL,expression TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,duration_ms INTEGER NOT NULL,PRIMARY KEY(character_id,expression),FOREIGN KEY(character_id,expression) REFERENCES character_images(character_id,expression) ON DELETE CASCADE); INSERT INTO forged_sounds SELECT * FROM character_sounds; DROP TABLE character_sounds; ALTER TABLE forged_sounds RENAME TO character_sounds; UPDATE character_sounds SET mime='audio/mpeg'");}},
];
for (const invalid of invalidSounds) test(`inspect, export, verify and restore reject expression sounds with ${invalid.name}`, async t => {
  const f=await fixture(t,{sounds:true});await run(f.exportRequest);
  const db=new DatabaseSync(f.source.dbFile);try {invalid.mutate(db);} finally {db.close();}
  const outputDir=path.join(f.root,'rejected-bundle');
  await assert.rejects(run({action:'inspect',sourceStopped:true,source:f.source}),errorCode(invalid.code));
  await assert.rejects(run({...f.exportRequest,outputDir}),errorCode(invalid.code));assert.equal(fs.existsSync(outputDir),false);
  editBundleDatabase(f,invalid.mutate);
  await assert.rejects(run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile}),errorCode(invalid.code));
  for (const apply of [false,true]) await assert.rejects(run({...restoreRequest(f),apply}),errorCode(invalid.code));
  assert.equal(fs.existsSync(f.destinationDir),false);assert.equal(fs.readdirSync(f.root).some(name=>name.startsWith('.afterhours-transfer-')),false);
});

test('schema 13 cannot smuggle a populated sound table through migration compatibility', async t => {
  const f=await fixture(t,{sounds:true});await run(f.exportRequest);
  const db=new DatabaseSync(f.source.dbFile);try {db.exec('PRAGMA user_version=13');} finally {db.close();}
  await assert.rejects(run({...f.exportRequest,outputDir:path.join(f.root,'rejected-bundle')}),errorCode('INVALID_DATABASE'));
  editBundleDatabase(f,db=>db.exec('PRAGMA user_version=13'));
  await assert.rejects(run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile}),errorCode('INVALID_DATABASE'));
  await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('INVALID_DATABASE'));assert.equal(fs.existsSync(f.destinationDir),false);
});

test('old supported schema migrates only the restored copy and preserves account hashes', async t => {
  const f=await fixture(t,{minimal:true}), db=new DatabaseSync(f.source.dbFile);
  try{db.exec('DROP TABLE character_sounds; DROP TABLE draw_word_exclusions; DROP TABLE market_requests; DROP TABLE market_ledger; DROP TABLE market_settlements; DROP TABLE market_votes; DROP TABLE market_rounds; DROP TABLE music_tracks; ALTER TABLE user_artworks DROP COLUMN shared; PRAGMA user_version=10');}finally{db.close();}
  await run(f.exportRequest); const result=await run({...restoreRequest(f),apply:true});assert.equal(result.restoredSummary.database.schemaVersion,SCHEMA_VERSION);
  const old=new DatabaseSync(f.source.dbFile,{readOnly:true});try{assert.equal(old.prepare('PRAGMA user_version').get().user_version,10);assert.equal(old.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='music_tracks'").get().n,0);}finally{old.close();}
});

for (const version of Array.from({length:13},(_,index)=>index+1)) test(`schema ${version} backup restores through BLOB-table migrations without changing accounts or existing assets`, async t => {
  const f = await legacyFixture(t, version), initial = validateData(f.source).summary.database;
  await run(f.exportRequest);
  const dry = await run(restoreRequest(f));
  assert.equal(dry.dryRun,true); assert.equal(fs.existsSync(f.destinationDir),false);
  const restored = await run({...restoreRequest(f),apply:true}), after = restored.restoredSummary.database;
  assert.equal(after.schemaVersion,SCHEMA_VERSION); assert.equal(after.accountsSha256,initial.accountsSha256);
  for (const [table,digest] of Object.entries(initial.blobDigests)) assert.equal(after.blobDigests[table],digest);
  for (const [table,introduced] of Object.entries({character_images:3,community_gifts:5,user_artworks:8,character_sounds:15})) {
    if (version < introduced) {
      assert.equal(initial.blobDigests[table],undefined); assert.equal(after.tableCounts[table],0);
      assert.equal(after.blobDigests[table],crypto.createHash('sha256').update('').digest('hex'));
    }
  }
  const target = settings(restored.config), check = openDatabase(target.dbFile);
  try {
    assert.deepEqual(check.prepare('SELECT * FROM users ORDER BY id').all(),f.expectedUsers);
    for (const table of ['sessions','invites','password_resets']) assert.equal(check.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0);
    if (f.characterId) assert.deepEqual(Buffer.from(check.prepare('SELECT bytes FROM character_images WHERE character_id=?').get(f.characterId).bytes),png);
    if (f.giftId) assert.deepEqual(Buffer.from(check.prepare('SELECT image_bytes FROM community_gifts WHERE id=?').get(f.giftId).image_bytes),png);
    if (f.artworkId) assert.deepEqual(Buffer.from(check.prepare('SELECT bytes FROM user_artworks WHERE id=?').get(f.artworkId).bytes),png);
  } finally { check.close(); }
  const app = createApp({...target,port:0,host:'127.0.0.1',githubClient:{configured:false}});
  try {
    const {port} = await app.listen(), base = 'http://127.0.0.1:' + port;
    assert.equal((await fetch(base+'/api/profile/settings',{headers:{Cookie:f.oldCookie}})).status,401);
    for (const username of ['transfer_admin','transfer_member']) {
      const login = await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
      assert.equal(login.status,200);
      const user = await login.json(), expected = f.expectedUsers.find(item=>item.username===username);
      assert.equal(user.id,expected.id); assert.equal(user.role,expected.role);
    }
  } finally { await app.close(); }
  const original = validateData(f.source).summary.database;
  assert.deepEqual(original,initial);
  const source = new DatabaseSync(f.source.dbFile,{readOnly:true});
  try { assert.deepEqual(source.prepare('SELECT * FROM users ORDER BY id').all(),f.expectedUsers); }
  finally { source.close(); }
});

test('migration allowances still reject changed accounts, changed existing BLOBs and unexpected new BLOB contents', async t => {
  const f = await legacyFixture(t,5); await run(f.exportRequest);
  const initial = validateData(f.source).summary.database;
  const mutations = [
    db => db.prepare('UPDATE users SET display_name=? WHERE id=?').run('Unexpected change',f.member.id),
    db => db.prepare('UPDATE character_images SET bytes=? WHERE character_id=?').run(Buffer.from('changed'),f.characterId),
    db => db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),f.member.id,'Unexpected asset','image/png',png,new Date().toISOString()),
    db => db.exec('CREATE TABLE unexpected_assets(id TEXT PRIMARY KEY,bytes BLOB)'),
  ];
  for (const mutate of mutations) {
    const exec = DatabaseSync.prototype.exec; let injected = false;
    DatabaseSync.prototype.exec = function(sql) {
      const result = exec.call(this,sql);
      if (sql === 'PRAGMA wal_checkpoint(TRUNCATE)') { mutate(this); injected = true; }
      return result;
    };
    try { await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('VALIDATION_FAILED')); }
    finally { DatabaseSync.prototype.exec = exec; }
    assert.equal(injected,true); assert.equal(fs.existsSync(f.destinationDir),false);
    assert.deepEqual(validateData(f.source).summary.database,initial);
  }
});

test('schema 13 restoration rejects injected contents in the newly introduced sound table', async t => {
  const f=await fixture(t,{sounds:true}),db=new DatabaseSync(f.source.dbFile);
  try {db.exec('DROP TABLE character_sounds; PRAGMA user_version=13');} finally {db.close();}
  const before=validateData(f.source).summary.database;await run(f.exportRequest);
  const exec=DatabaseSync.prototype.exec;let injected=false;
  DatabaseSync.prototype.exec=function(sql) {
    const result=exec.call(this,sql);
    if (sql === 'PRAGMA wal_checkpoint(TRUNCATE)') {
      this.prepare('INSERT INTO character_sounds(character_id,expression,mime,bytes,duration_ms) VALUES(?,?,?,?,?)').run(f.characterId,f.soundExpression,'audio/wav',wav,2);
      injected=true;
    }
    return result;
  };
  try {await assert.rejects(run({...restoreRequest(f),apply:true}),errorCode('VALIDATION_FAILED'));}
  finally {DatabaseSync.prototype.exec=exec;}
  assert.equal(injected,true);assert.equal(fs.existsSync(f.destinationDir),false);assert.deepEqual(validateData(f.source).summary.database,before);
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
  const beforeMarker=path.join(f.root,'before-marker'),write=fs.writeFileSync;
  fs.writeFileSync=(file,...args)=>{if(file===path.join(beforeMarker,'.afterhours-restore-in-progress')){const e=Error('injected marker failure');e.code='ENOSPC';throw e;}return write(file,...args);};
  try{await assert.rejects(run({...restoreRequest(f),destinationDir:beforeMarker,apply:true}),errorCode('PARTIAL_RESTORE'));}finally{fs.writeFileSync=write;}
  assert.equal(fs.existsSync(path.join(beforeMarker,'.afterhours-restore-in-progress')),false);
  assert.equal(fs.existsSync(path.join(f.root,'.before-marker.afterhours-publish-lock')),true);
  assert.throws(()=>createApp({...settings({DB_FILE:path.join(beforeMarker,'db','afterhours.sqlite'),HISTORY_DIR:path.join(beforeMarker,'history'),COMMUNITY_DIR:path.join(beforeMarker,'community')}),port:0}),errorCode('RESTORE_IN_PROGRESS'));
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
