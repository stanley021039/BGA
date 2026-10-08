const {legacyMarketSchema,upgradedMarketRows,useLegacyRoundSnapshot}=require('./helpers/market-legacy-schema.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { PNG } = require('pngjs');
const { openDatabase, SCHEMA_VERSION, MARKET_TABLES, MARKET_IMAGE_SQL } = require('../src/db');
const { validateDatabase, validateData, sha } = require('../src/data/validation');
const { run, canonical } = require('../src/data/transfer');
const { createAuth } = require('../src/auth');
const { MarketStore } = require('../src/market/store');
const { MarketImageStore, validateMarketImagesDatabase } = require('../src/market/images');

const created = '2026-10-06T04:00:00.000Z', reviewed = '2026-10-06T05:00:00.000Z';
const password = 'synthetic-image-backup-password', salt = Buffer.alloc(16, 0x19);
const passwordHash = `scrypt:${salt.toString('hex')}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const png = PNG.sync.write({ width: 2, height: 3, data: Buffer.from(Array.from({ length: 24 }, (_, i) => i % 4 === 3 ? 255 : i * 10)) }, { colorType: 6 });
const rejected = error => ['INVALID_DATABASE','INTEGRITY_FAILED','FOREIGN_KEY_FAILED','VALIDATION_FAILED'].includes(error.code);
const restoreRequest = f => ({ action: 'restore', bundleDir: f.bundleDir, keyFile: f.keyFile, destinationDir: f.destinationDir });
function rows(db, tables) { return Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-image-backup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const source = { envId: 'image-backup-test', dbFile: path.join(root, 'source', 'app.sqlite'), historyDir: path.join(root, 'source', 'history'), communityDir: path.join(root, 'source', 'community'), musicDir: path.join(root, 'source', 'music') };
  for (const dir of [source.historyDir, source.communityDir, source.musicDir]) fs.mkdirSync(dir, { recursive: true });
  const db = openDatabase(source.dbFile), adminId = crypto.randomUUID(), ownerId = crypto.randomUUID();
  const insert = db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)');
  insert.run(adminId, 'image_admin', '管理者', passwordHash, 'admin', created);
  insert.run(ownerId, 'image_author', '投稿時暱稱', passwordHash, 'member', created);
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run('synthetic-session', ownerId, '2027-01-01T00:00:00.000Z');
  db.prepare('INSERT INTO invites(token_hash,created_by,expires_at) VALUES(?,?,?)').run('synthetic-invite', adminId, '2027-01-01T00:00:00.000Z');
  db.prepare('INSERT INTO password_resets(token_hash,user_id,created_by,expires_at) VALUES(?,?,?,?)').run('synthetic-reset', ownerId, adminId, '2027-01-01T00:00:00.000Z');
  const artwork = crypto.randomUUID();
  db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?)').run(artwork, ownerId, '既有作品', 'image/png', png, created);
  const admin = db.prepare('SELECT * FROM users WHERE id=?').get(adminId), owner = db.prepare('SELECT * FROM users WHERE id=?').get(ownerId);
  db.close();
  const keyFile = path.join(root, 'backup.key'); fs.writeFileSync(keyFile, Buffer.alloc(32, 0x31));
  const bundleDir = path.join(root, 'bundle'), destinationDir = path.join(root, 'restored');
  return { root, source, keyFile, bundleDir, destinationDir, admin, owner, exportRequest: { action: 'export', source, sourceStopped: true, keyFile, outputDir: bundleDir } };
}
function record(f, changes = {}) {
  return { id: crypto.randomUUID(), author_id: f.owner.id, author_name: '投稿時暱稱', mime: 'image/png', bytes: png, width: 2, height: 3, buckets_json: '["crash","surge"]', weekdays_json: '[0,1,6]', version: 1, status: 'pending', created_at: created, approved_by: null, approved_at: null, ...changes };
}
function insertImage(db, f, changes = {}) {
  const image = record(f, changes), names = Object.keys(image);
  db.prepare(`INSERT INTO market_images(${names.join(',')}) VALUES(${names.map(() => '?').join(',')})`).run(...Object.values(image));
  return image;
}
function editManifest(f, change) {
  const file = path.join(f.bundleDir, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file));
  change(manifest); delete manifest.authentication;
  const secret = Buffer.from(crypto.hkdfSync('sha256', fs.readFileSync(f.keyFile), manifest.bundleId, 'afterhours-data-manifest-v1', 32));
  manifest.authentication = crypto.createHmac('sha256', secret).update(canonical(manifest)).digest('hex');
  fs.writeFileSync(file, JSON.stringify(manifest));
}
function editBundleDatabase(f, change) {
  const manifest = JSON.parse(fs.readFileSync(path.join(f.bundleDir, 'manifest.json'))), entry = manifest.files.find(file => file.logical === 'db/afterhours.sqlite');
  const secret = Buffer.from(crypto.hkdfSync('sha256', fs.readFileSync(f.keyFile), manifest.bundleId, 'afterhours-data-encryption-v1', 32));
  const payload = path.join(f.bundleDir, entry.payload), aad = Buffer.from(manifest.bundleId + '\0' + entry.logical);
  const decipher = crypto.createDecipheriv('aes-256-gcm', secret, Buffer.from(entry.iv, 'hex'));
  decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
  const file = path.join(f.root, 'altered.sqlite');
  fs.writeFileSync(file, Buffer.concat([decipher.update(fs.readFileSync(payload)), decipher.final()]));
  const db = new DatabaseSync(file); try { change(db); } finally { db.close(); }
  const bytes = fs.readFileSync(file), iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  cipher.setAAD(aad); const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  fs.writeFileSync(payload, encrypted); fs.unlinkSync(file);
  editManifest(f, m => {
    Object.assign(m.files.find(item => item.logical === entry.logical), { bytes: bytes.length, sha256: sha(bytes), cipherSha256: sha(encrypted), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') });
    m.totalBytes = m.files.reduce((total, item) => total + item.bytes, 0);
  });
}
function seedScoring(db, f) {
  let now = Date.parse('2027-01-04T12:00:00Z'); const market = new MarketStore(db, () => now);
  const roundId = market.create(f.admin, { requestId: crypto.randomUUID(), targetDate: '2027-01-06', confirmed: true }).roundId;
  useLegacyRoundSnapshot(db,roundId);
  market.vote(f.owner, { requestId: crypto.randomUUID(), roundId, optionId: 'rally', expectedRevision: 0 });
  now = Date.parse('2027-01-06T05:30:00Z');
  market.settle(f.admin, { requestId: crypto.randomUUID(), roundId, returnPct: 2, expectedRevision: 0, confirmed: true });
  market.settle(f.admin, { requestId: crypto.randomUUID(), roundId, returnPct: -2, expectedRevision: 1, reason: '更正歷史', confirmed: true });
}

test('current schema preserves the schema16 BLOB shape, explicit versions and owner/status indexes', t => {
  const f = fixture(t), db = openDatabase(f.source.dbFile);
  try {
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
    const columns = db.prepare('PRAGMA table_info(market_images)').all();
    assert.deepEqual(columns.map(c => [c.name,c.type,c.notnull,c.pk]), [
      ['id','TEXT',0,1],['author_id','TEXT',1,0],['author_name','TEXT',1,0],['mime','TEXT',1,0],['bytes','BLOB',1,0],['width','INTEGER',1,0],['height','INTEGER',1,0],['buckets_json','TEXT',1,0],['weekdays_json','TEXT',1,0],['version','INTEGER',1,0],['status','TEXT',1,0],['created_at','TEXT',1,0],['approved_by','TEXT',0,0],['approved_at','TEXT',0,0]
    ]);
    assert.ok(columns.every(c => c.dflt_value === null));
    const indexes = db.prepare('PRAGMA index_list(market_images)').all().map(i => i.name);
    assert.ok(indexes.includes('market_images_owner')); assert.ok(indexes.includes('market_images_status'));
    assert.equal(validateMarketImagesDatabase(db), true);
  } finally { db.close(); }
});

test('schema16 enforces dimensions, pixels, BLOB bounds, JSON arrays and review/version state', t => {
  const f = fixture(t), db = openDatabase(f.source.dbFile);
  try {
    for (const change of [
      {mime:'image/jpeg'},{bytes:Buffer.alloc(0)},{bytes:Buffer.alloc(4*1024*1024+1)},{bytes:'not a BLOB'},
      {width:0},{width:4097},{height:0},{height:4097},{width:1.5},{height:1.5},{width:4096,height:4096},
      {buckets_json:'[]'},{buckets_json:'{}'},{buckets_json:'invalid'},{buckets_json:JSON.stringify(Array(7).fill('crash'))},{buckets_json:JSON.stringify(['x'.repeat(256)])},
      {weekdays_json:'[]'},{weekdays_json:'{}'},{weekdays_json:JSON.stringify(Array(8).fill(1))},{weekdays_json:JSON.stringify(['x'.repeat(64)])},
      {status:'rejected'},{version:3},{version:1.5},{version:2},{approved_by:f.admin.id},{approved_at:reviewed},
      {status:'approved',version:2},{status:'approved',version:1,approved_by:f.admin.id,approved_at:reviewed}
    ]) assert.throws(() => insertImage(db,f,change), /constraint|malformed JSON/i, JSON.stringify({...change,bytes:undefined}));
    assert.throws(() => insertImage(db,f,{author_id:crypto.randomUUID()}), /FOREIGN KEY/);
    assert.throws(() => insertImage(db,f,{status:'approved',version:2,approved_by:crypto.randomUUID(),approved_at:reviewed}), /FOREIGN KEY/);
    const pending = insertImage(db,f), approved = insertImage(db,f,{status:'approved',version:2,approved_by:f.admin.id,approved_at:reviewed});
    assert.throws(() => insertImage(db,f,{id:pending.id}), /UNIQUE/);
    assert.equal(db.prepare('SELECT status FROM market_images WHERE id=?').get(approved.id).status,'approved');
  } finally { db.close(); }
});

test('genuine cold15 bundle upgrades only its copy to an empty gallery and preserves accounts, assets and score history', async t => {
  const f = fixture(t), db = openDatabase(f.source.dbFile), preserved = ['users','user_artworks',...MARKET_TABLES];
  let expected;
  try { seedScoring(db,f); legacyMarketSchema(db); db.exec('DROP TABLE market_images; PRAGMA user_version=15'); expected = Object.fromEntries(Object.entries(rows(db,preserved)).map(([table,items])=>[table,upgradedMarketRows(table,items)])); } finally { db.close(); }
  const before = validateData(f.source).summary.database, sourceBytes = fs.readFileSync(f.source.dbFile);
  assert.equal(before.schemaVersion,15); assert.equal(before.tableCounts.market_images,undefined); assert.equal(before.marketImagesSha256,undefined);
  await run(f.exportRequest);
  // Authenticate a legacy maximum-schema descriptor, as an actual v15 bundle has.
  editManifest(f, m => {m.code.maximumSchema=15;});
  const verified = await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile}); assert.equal(verified.code.maximumSchema,15);
  const dry = await run(restoreRequest(f)); assert.equal(dry.dryRun,true); assert.equal(fs.existsSync(f.destinationDir),false);
  assert.equal(dry.restoredSummary.database.schemaVersion,SCHEMA_VERSION); assert.equal(dry.restoredSummary.database.tableCounts.market_images,0);
  const restored = await run({...restoreRequest(f),apply:true}), copy = openDatabase(restored.config.DB_FILE);
  try {
    assert.deepEqual(rows(copy,preserved),expected);
    assert.equal(copy.prepare('SELECT COUNT(*) n FROM market_images').get().n,0);
    assert.equal(new MarketStore(copy).stats(f.owner.id).score,-1);
    for (const table of ['sessions','invites','password_resets']) assert.equal(copy.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
    assert.deepEqual(copy.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally { copy.close(); }
  assert.deepEqual(validateData(f.source).summary.database,before); assert.deepEqual(fs.readFileSync(f.source.dbFile),sourceBytes);
});

test('current schema export verify preview and restore preserve pending/approved PNGs, nickname snapshots, rules, review and receipts', async t => {
  const f = fixture(t), db = openDatabase(f.source.dbFile); let expected;
  try {
    seedScoring(db,f); const images = new MarketImageStore(db,()=>Date.parse(created));
    const upload = (buckets,weekdays) => images.upload(f.owner,{requestId:crypto.randomUUID(),mime:'image/png',base64:png.toString('base64'),buckets,weekdays});
    const approved = await upload(['rise','surge'],[1,3,5]); await upload(['crash'],[0,6]);
    images.approve(f.admin,{requestId:crypto.randomUUID(),confirmed:true,images:[{id:approved.image.id,version:1}]});
    db.prepare('UPDATE users SET display_name=? WHERE id=?').run('後來的新暱稱',f.owner.id);
    expected = rows(db,['users','user_artworks',...MARKET_TABLES,'market_images']);
  } finally { db.close(); }
  const before = validateData(f.source).summary.database, sourceBytes = fs.readFileSync(f.source.dbFile);
  assert.equal(before.tableCounts.market_images,2); assert.match(before.marketImagesSha256,/^[0-9a-f]{64}$/);
  const exported = await run(f.exportRequest), verified = await run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile}), dry = await run(restoreRequest(f));
  assert.deepEqual(exported.summary.database,before); assert.deepEqual(verified.summary.database,before); assert.deepEqual(dry.restoredSummary.database,{...before,tableCounts:{...before.tableCounts,sessions:0,invites:0,password_resets:0}});
  const restored = await run({...restoreRequest(f),expectedBundleId:verified.bundleId,apply:true}), copy = openDatabase(restored.config.DB_FILE);
  try {
    assert.deepEqual(rows(copy,Object.keys(expected)),expected); assert.equal(validateMarketImagesDatabase(copy),true);
    assert.deepEqual(copy.prepare('SELECT DISTINCT author_name FROM market_images').all().map(r=>r.author_name),['投稿時暱稱']);
    for (const table of ['sessions','invites','password_resets']) assert.equal(copy.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
    const user = await createAuth(copy).login({username:'image_author',password},{setHeader(){}}); assert.equal(user.id,f.owner.id);
  } finally { copy.close(); }
  assert.deepEqual(validateData(f.source).summary.database,before); assert.deepEqual(fs.readFileSync(f.source.dbFile),sourceBytes);
});

test('current schema missing image table is rejected by validation and boot without repair', async t => {
  const f=fixture(t), db=new DatabaseSync(f.source.dbFile); try {db.exec('DROP TABLE market_images');} finally {db.close();}
  const before=fs.readFileSync(f.source.dbFile);
  assert.throws(()=>validateDatabase(f.source.dbFile),rejected); await assert.rejects(run(f.exportRequest),rejected);
  assert.throws(()=>openDatabase(f.source.dbFile),new RegExp('Incomplete database schema '+SCHEMA_VERSION));
  assert.deepEqual(fs.readFileSync(f.source.dbFile),before); assert.equal(fs.existsSync(f.bundleDir),false);
});

const malformed = [
  ['extra column',sql=>sql.replace(' id TEXT PRIMARY KEY,',' extra TEXT, id TEXT PRIMARY KEY,')],
  ['primary key missing',sql=>sql.replace('id TEXT PRIMARY KEY','id TEXT')],
  ['owner FK missing',sql=>sql.replace('author_id TEXT NOT NULL REFERENCES users(id)','author_id TEXT NOT NULL')],
  ['reviewer FK missing',sql=>sql.replace('approved_by TEXT REFERENCES users(id)','approved_by TEXT')],
  ['nickname nullable',sql=>sql.replace('author_name TEXT NOT NULL','author_name TEXT')],
  ['wrong BLOB type',sql=>sql.replace('bytes BLOB NOT NULL','bytes TEXT NOT NULL')],
  ['unrequested version default',sql=>sql.replace('version INTEGER NOT NULL','version INTEGER NOT NULL DEFAULT 1')],
  ['MIME check missing',sql=>sql.replace(" CHECK(mime='image/png')",'')],
  ['BLOB bound missing',sql=>sql.replace(" CHECK(typeof(bytes)='blob' AND length(bytes) BETWEEN 1 AND 4194304)",'')],
  ['dimension check missing',sql=>sql.replace(" CHECK(typeof(width)='integer' AND width BETWEEN 1 AND 4096)",'')],
  ['pixel check missing',sql=>sql.replace(' CHECK(width*height<=8000000),','')],
  ['bucket JSON check missing',sql=>sql.replace(" CHECK(length(buckets_json)<=256 AND json_valid(buckets_json) AND json_type(buckets_json)='array' AND json_array_length(buckets_json) BETWEEN 1 AND 6)",'')],
  ['weekday JSON check missing',sql=>sql.replace(" CHECK(length(weekdays_json)<=64 AND json_valid(weekdays_json) AND json_type(weekdays_json)='array' AND json_array_length(weekdays_json) BETWEEN 1 AND 7)",'')],
  ['status check missing',sql=>sql.replace(" CHECK(status IN ('pending','approved'))",'')],
  ['review check weakened',sql=>sql.replace("status='approved' AND version=2 AND approved_by IS NOT NULL AND approved_at IS NOT NULL)","status='approved' AND version=2 AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR 1")],
  ['literal containing a space',sql=>sql.replace("mime='image/png'","mime='image/ png'")],
];
for (const [label, change] of malformed) test(`malformed empty image schema rejects ${label} before16 migration and schema16/current boot`, async t => {
  const altered=change(MARKET_IMAGE_SQL); assert.notEqual(altered,MARKET_IMAGE_SQL);
  for (const version of [15,16,SCHEMA_VERSION]) {
    const f=fixture(t),db=new DatabaseSync(f.source.dbFile); try {if(version<17)legacyMarketSchema(db);db.exec('DROP TABLE market_images;'+altered+`; PRAGMA user_version=${version}`);} finally {db.close();}
    const before=fs.readFileSync(f.source.dbFile);
    assert.throws(()=>validateDatabase(f.source.dbFile),rejected); await assert.rejects(run(f.exportRequest),rejected);
    assert.throws(()=>openDatabase(f.source.dbFile),/Invalid market_images/); assert.deepEqual(fs.readFileSync(f.source.dbFile),before);
  }
});

test('every historical version1..15 rejects a populated future image table without migration', t => {
  const f=fixture(t), seed=new DatabaseSync(f.source.dbFile); try {insertImage(seed,f);} finally {seed.close();}
  for (let version=1;version<=15;version++) {
    const db=new DatabaseSync(f.source.dbFile); try {legacyMarketSchema(db);db.exec(`PRAGMA user_version=${version}`);} finally {db.close();}
    const before=fs.readFileSync(f.source.dbFile); assert.throws(()=>validateDatabase(f.source.dbFile),rejected);
    assert.throws(()=>openDatabase(f.source.dbFile),/older schema cannot contain market images/); assert.deepEqual(fs.readFileSync(f.source.dbFile),before);
  }
});

const badCrc=Buffer.from(png),oversizedHeader=Buffer.from(png),pixelBomb=Buffer.from(png);
badCrc[29]^=1;oversizedHeader.writeUInt32BE(4097,16);pixelBomb.writeUInt32BE(4096,16);pixelBomb.writeUInt32BE(4096,20);
const invalidRecords = [
  ['truncated PNG',{bytes:png.subarray(0,png.length-5)}],['bad PNG signature',{bytes:Buffer.from('not a PNG')}],
  ['invalid PNG CRC',{bytes:badCrc}],['oversized PNG header before decode',{bytes:oversizedHeader}],['excessive PNG pixel header before decode',{bytes:pixelBomb}],
  ['mismatched width',{width:3}],['mismatched height',{height:4}],['invalid UUID',{id:'forged'}],['invalid creation time',{created_at:'yesterday'}],
  ['empty nickname',{author_name:''}],['nickname control',{author_name:'bad\nname'}],['oversized nickname',{author_name:'x'.repeat(65)}],
  ['unknown bucket',{buckets_json:'["tie"]'}],['duplicate buckets',{buckets_json:'["crash","crash"]'}],['unsorted buckets',{buckets_json:'["surge","crash"]'}],
  ['out of range weekday',{weekdays_json:'[7]'}],['noninteger weekday',{weekdays_json:'[1.5]'}],['duplicate weekdays',{weekdays_json:'[1,1]'}],['unsorted weekdays',{weekdays_json:'[6,1]'}],
  ['noncanonical JSON',{weekdays_json:'[ 1 ]'}],['invalid approval timestamp',{status:'approved',version:2,approved_by:'ADMIN',approved_at:'yesterday'}],
  ['review precedes upload',{status:'approved',version:2,approved_by:'ADMIN',approved_at:'2026-10-05T05:00:00.000Z'}],
];
for (const [label, changes] of invalidRecords) test(`cold export rejects ${label} even with valid SQLite shape`, async t => {
  const f=fixture(t), db=new DatabaseSync(f.source.dbFile), change={...changes}; if(change.approved_by==='ADMIN')change.approved_by=f.admin.id;
  try {insertImage(db,f,change);} finally {db.close();}
  await assert.rejects(run(f.exportRequest),rejected); assert.equal(fs.existsSync(f.bundleDir),false);
});

test('cold export rejects per-owner gallery quota overflow', async t => {
  const f=fixture(t), db=new DatabaseSync(f.source.dbFile); try {for(let n=0;n<101;n++)insertImage(db,f);} finally {db.close();}
  await assert.rejects(run(f.exportRequest),rejected); assert.equal(fs.existsSync(f.bundleDir),false);
});

test('verify and apply reject authenticated bundles containing bad image data or forged review records', async t => {
  for (const mutation of [
    db=>db.prepare('UPDATE market_images SET bytes=?').run(Buffer.from('bad PNG')),
    db=>db.prepare('UPDATE market_images SET buckets_json=?').run('["tie"]'),
    db=>db.exec("PRAGMA ignore_check_constraints=ON; UPDATE market_images SET status='approved',version=1"),
    db=>db.prepare('UPDATE market_images SET author_name=?').run(''),
    db=>db.exec('DROP TABLE market_images'),
  ]) {
    const f=fixture(t),db=new DatabaseSync(f.source.dbFile);try{insertImage(db,f);}finally{db.close();}
    await run(f.exportRequest); editBundleDatabase(f,mutation);
    await assert.rejects(run({action:'verify',bundleDir:f.bundleDir,keyFile:f.keyFile}),rejected);
    await assert.rejects(run({...restoreRequest(f),apply:true}),rejected); assert.equal(fs.existsSync(f.destinationDir),false);
  }
});

test('restore rejects introduced image contents and changes to frozen metadata even when PNG bytes remain exact', async t => {
  for (const legacy of [true,false]) {
    const f=fixture(t),db=new DatabaseSync(f.source.dbFile);
    try {if(legacy){legacyMarketSchema(db);db.exec('DROP TABLE market_images; PRAGMA user_version=15');}else insertImage(db,f);}finally{db.close();}
    const before=validateData(f.source).summary.database;await run(f.exportRequest);
    const exec=DatabaseSync.prototype.exec;let injected=false;
    DatabaseSync.prototype.exec=function(sql){const result=exec.call(this,sql);if(sql==='PRAGMA wal_checkpoint(TRUNCATE)'){
      if(legacy)insertImage(this,f);else this.prepare('UPDATE market_images SET author_name=?').run('合法但被改的暱稱');injected=true;
    }return result;};
    try {await assert.rejects(run({...restoreRequest(f),apply:true}),error=>error.code==='VALIDATION_FAILED');}finally{DatabaseSync.prototype.exec=exec;}
    assert.equal(injected,true);assert.equal(fs.existsSync(f.destinationDir),false);assert.deepEqual(validateData(f.source).summary.database,before);
  }
});


test('cold export rejects total gallery quota overflow across distinct owners', async t => {
  const f=fixture(t),db=new DatabaseSync(f.source.dbFile),owners=[f.owner.id];
  try {
    for(let n=0;n<10;n++){const id=crypto.randomUUID();db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,'quota_author_'+n,'作者',passwordHash,'member',created);owners.push(id);}
    db.exec('BEGIN');for(let n=0;n<1001;n++)insertImage(db,f,{author_id:owners[n%owners.length]});db.exec('COMMIT');
  } finally {db.close();}
  await assert.rejects(run(f.exportRequest),rejected);assert.equal(fs.existsSync(f.bundleDir),false);
});

test('historical long nickname snapshots and approval remain valid after reviewer role/disabled changes', async t => {
  const f=fixture(t),db=openDatabase(f.source.dbFile),longName='historical_author_name_24';
  try {
    db.prepare('UPDATE users SET display_name=? WHERE id=?').run(longName,f.owner.id);
    const store=new MarketImageStore(db,()=>Date.parse(created)),uploaded=await store.upload(f.owner,{requestId:crypto.randomUUID(),mime:'image/png',base64:png.toString('base64'),buckets:['crash'],weekdays:[1]});
    store.approve(f.admin,{requestId:crypto.randomUUID(),confirmed:true,images:[{id:uploaded.image.id,version:1}]});
    db.prepare("UPDATE users SET role='member',disabled=1 WHERE id=?").run(f.admin.id);
    db.prepare('UPDATE users SET display_name=? WHERE id=?').run('new_name',f.owner.id);
    assert.equal(validateMarketImagesDatabase(db),true);
  } finally {db.close();}
  await run(f.exportRequest);const restored=await run({...restoreRequest(f),apply:true}),copy=openDatabase(restored.config.DB_FILE);
  try {assert.equal(copy.prepare('SELECT author_name FROM market_images').get().author_name,longName);assert.equal(validateMarketImagesDatabase(copy),true);}finally{copy.close();}
});
