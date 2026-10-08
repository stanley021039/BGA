const {legacyMarketSchema}=require('./helpers/market-legacy-schema.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { openDatabase, SCHEMA_VERSION } = require('../src/db');
const { validateData } = require('../src/data/validation');
const { run, canonical } = require('../src/data/transfer');

const png = fs.readFileSync(path.join(__dirname, '../public/assets/characters/traveler-neutral.png'));
const at = '2026-10-01T11:11:03.489Z';
const errorCode = code => error => error.code === code;
function json(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
async function fixture(t, extras = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afterhours-legacy-community-'));
  t.after(() => { assert.equal(path.dirname(root), os.tmpdir()); fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }); });
  const old = path.join(root, 'source'), source = { envId: 'legacy-test', dbFile: path.join(old, 'app.sqlite'), historyDir: path.join(old, 'history'), communityDir: path.join(old, 'community'), musicDir: path.join(old, 'music') };
  for (const dir of [source.historyDir, source.communityDir, source.musicDir]) fs.mkdirSync(dir, { recursive: true });
  const userId = crypto.randomUUID(), artworkId = crypto.randomUUID(), issueId = crypto.randomUUID();
  const db = openDatabase(source.dbFile);
  try {
    db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,disabled,created_at) VALUES(?,?,?,?,?,?,?)').run(userId, 'legacy_account', '舊站玩家', 'scrypt:' + 'a'.repeat(32) + ':' + 'b'.repeat(128), 'admin', 0, at);
    db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at,shared) VALUES(?,?,?,?,?,?,?)').run(artworkId, userId, '原始 BLOB', 'image/png', png, at, 0);
    db.prepare('INSERT INTO board_issues(id,title,body,name,game,status,at) VALUES(?,?,?,?,?,?,?)').run(issueId, '舊留言', '完整保留', '舊站玩家', 'general', 'open', at);
    legacyMarketSchema(db);db.exec('DROP TABLE character_sounds; DROP TABLE market_requests; DROP TABLE market_ledger; DROP TABLE market_settlements; DROP TABLE market_votes; DROP TABLE market_rounds; DROP TABLE draw_word_exclusions; PRAGMA user_version=12');
  } finally { db.close(); }
  const communityFile = path.join(source.communityDir, 'community.json');
  const community = { issues: [{ id: issueId, title: '舊留言', body: '完整保留', name: '舊站玩家', game: 'general', status: 'open', at, comments: [] }], questions: [] };
  const backfillFile = path.join(source.communityDir, 'github-backfill.json');
  const backfill = { [issueId]: { number: 2, url: 'https://github.com/stanley021039/BGA/issues/2', comments: {}, syncedAt: at } };
  const avatarDir = path.join(source.communityDir, 'avatars'), avatarId = crypto.randomUUID(), avatarFile = path.join(avatarDir, avatarId + '.png');
  if (extras) {
    community.avatars = [{ id: avatarId, name: '舊站圖片', url: '/uploads/avatars/' + avatarId + '.png', at }];
    fs.mkdirSync(avatarDir); fs.writeFileSync(avatarFile, png); json(backfillFile, backfill);
  }
  json(communityFile, community);
  const keyFile = path.join(root, 'backup.key'); await run({ action: 'keygen', keyFile });
  const bundleDir = path.join(root, 'bundle'), destinationDir = path.join(root, 'restored');
  return { root, source, userId, artworkId, issueId, community, communityFile, backfill, backfillFile, avatarDir, avatarId, avatarFile, keyFile, bundleDir, destinationDir,
    exportRequest: { action: 'export', sourceStopped: true, source, keyFile, outputDir: bundleDir } };
}
function signedManifest(f, change) {
  const file = path.join(f.bundleDir, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(file)); change(manifest); delete manifest.authentication;
  const secret = Buffer.from(crypto.hkdfSync('sha256', fs.readFileSync(f.keyFile), manifest.bundleId, 'afterhours-data-manifest-v1', 32));
  manifest.authentication = crypto.createHmac('sha256', secret).update(canonical(manifest)).digest('hex'); json(file, manifest);
}
function editPayload(f, logical, change) {
  const manifest = JSON.parse(fs.readFileSync(path.join(f.bundleDir, 'manifest.json'))), entry = manifest.files.find(file => file.logical === logical);
  const secret = Buffer.from(crypto.hkdfSync('sha256', fs.readFileSync(f.keyFile), manifest.bundleId, 'afterhours-data-encryption-v1', 32)), aad = Buffer.from(manifest.bundleId + '\0' + logical);
  const payload = path.join(f.bundleDir, entry.payload), decrypt = crypto.createDecipheriv('aes-256-gcm', secret, Buffer.from(entry.iv, 'hex'));
  decrypt.setAAD(aad); decrypt.setAuthTag(Buffer.from(entry.tag, 'hex'));
  const bytes = change(Buffer.concat([decrypt.update(fs.readFileSync(payload)), decrypt.final()]));
  const iv = crypto.randomBytes(12), encrypt = crypto.createCipheriv('aes-256-gcm', secret, iv); encrypt.setAAD(aad);
  const encrypted = Buffer.concat([encrypt.update(bytes), encrypt.final()]); fs.writeFileSync(payload, encrypted);
  signedManifest(f, m => {
    Object.assign(m.files.find(file => file.logical === logical), { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), cipherSha256: crypto.createHash('sha256').update(encrypted).digest('hex'), iv: iv.toString('hex'), tag: encrypt.getAuthTag().toString('hex') });
    m.totalBytes = m.files.reduce((total, file) => total + file.bytes, 0);
  });
}

test('legacy schema-12 community extras survive inspect, encrypted verify, dry run and restore without changing accounts or applying backfill', async t => {
  const f = await fixture(t), before = validateData(f.source).summary;
  const bytes = [f.communityFile, f.backfillFile, f.avatarFile].map(file => fs.readFileSync(file));
  const inspected = await run({ ...f.exportRequest, action: 'inspect' }); assert.deepEqual(inspected.legacyCommunity, { avatarFiles: 1, githubBackfillEntries: 1 });
  const exported = await run(f.exportRequest); assert.deepEqual(exported.summary, before);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.bundleDir, 'manifest.json')));
  assert.deepEqual(manifest.files.filter(file => file.logical.startsWith('community/')).map(file => file.logical).sort(), ['community/avatars/' + f.avatarId + '.png', 'community/community.json', 'community/github-backfill.json'].sort());
  for (const entry of manifest.files.filter(file => file.logical.startsWith('community/'))) {
    assert.equal(fs.readFileSync(path.join(f.bundleDir, entry.payload)).includes(Buffer.from('舊站玩家')), false);
  }
  assert.deepEqual((await run({ action: 'verify', bundleDir: f.bundleDir, keyFile: f.keyFile })).summary, before);
  const restore = { action: 'restore', bundleDir: f.bundleDir, keyFile: f.keyFile, destinationDir: f.destinationDir, expectedBundleId: exported.bundleId };
  const dry = await run(restore); assert.equal(dry.dryRun, true); assert.equal(fs.existsSync(f.destinationDir), false);
  const result = await run({ ...restore, apply: true }); assert.equal(result.config.EXTERNAL_SIDE_EFFECTS_ENABLED, 'false');
  assert.equal(result.restoredSummary.database.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.restoredSummary.database.accountsSha256, before.database.accountsSha256);
  for (const [table, digest] of Object.entries(before.database.blobDigests)) assert.equal(result.restoredSummary.database.blobDigests[table], digest);
  for (const [i, relative] of ['community.json', 'github-backfill.json', 'avatars/' + f.avatarId + '.png'].entries()) assert.deepEqual(fs.readFileSync(path.join(f.destinationDir, 'community', relative)), bytes[i]);
  const db = new DatabaseSync(path.join(f.destinationDir, 'db', 'afterhours.sqlite'), { readOnly: true });
  try {
    const issue = db.prepare('SELECT github_number,github_url FROM board_issues WHERE id=?').get(f.issueId);
    assert.equal(issue.github_number, null); assert.equal(issue.github_url, null);
    assert.deepEqual(Buffer.from(db.prepare('SELECT bytes FROM user_artworks WHERE id=?').get(f.artworkId).bytes), png);
  } finally { db.close(); }
  for (const [i, file] of [f.communityFile, f.backfillFile, f.avatarFile].entries()) assert.deepEqual(fs.readFileSync(file), bytes[i]);
});

test('old community bundles retain their authenticated summary shape with no legacy extension', async t => {
  const f = await fixture(t, false), original = validateData(f.source).summary;
  assert.equal(Object.hasOwn(original, 'legacyCommunity'), false);
  const exported = await run(f.exportRequest); assert.deepEqual(exported.summary, original);
  const verified = await run({ action: 'verify', bundleDir: f.bundleDir, keyFile: f.keyFile }); assert.deepEqual(verified.summary, original);
  const result = await run({ action: 'restore', bundleDir: f.bundleDir, keyFile: f.keyFile, destinationDir: f.destinationDir, apply: true });
  assert.equal(Object.hasOwn(result.restoredSummary, 'legacyCommunity'), false);
  assert.equal(fs.existsSync(path.join(f.destinationDir, 'community', 'avatars')), false);
});

for (const [label, code, change] of [
  ['missing image', 'BROKEN_REFERENCE', f => fs.unlinkSync(f.avatarFile)],
  ['unlisted image', 'UNEXPECTED_FILE', f => fs.writeFileSync(path.join(f.avatarDir, crypto.randomUUID() + '.png'), png)],
  ['nested avatar directory', 'UNSAFE_PATH', f => fs.mkdirSync(path.join(f.avatarDir, 'nested'))],
  ['unknown community file', 'UNEXPECTED_FILE', f => fs.writeFileSync(path.join(f.source.communityDir, 'unknown.json'), '{}')],
  ['PNG signature mismatch', 'INVALID_COMMUNITY', f => fs.writeFileSync(f.avatarFile, Buffer.alloc(png.length))],
  ['PNG header mismatch', 'INVALID_COMMUNITY', f => { const bytes = Buffer.from(png); bytes.writeUInt32BE(12, 8); fs.writeFileSync(f.avatarFile, bytes); }],
  ['oversized image', 'INVALID_COMMUNITY', f => fs.writeFileSync(f.avatarFile, Buffer.alloc(1024 * 1024 + 1))],
  ['duplicate avatar UUID', 'INVALID_COMMUNITY', f => { f.community.avatars.push({ ...f.community.avatars[0] }); json(f.communityFile, f.community); }],
  ['traversal avatar URL', 'BROKEN_REFERENCE', f => { f.community.avatars[0].url = '/uploads/avatars/../' + f.avatarId + '.png'; json(f.communityFile, f.community); }],
  ['invalid avatar UUID', 'INVALID_COMMUNITY', f => { f.community.avatars[0].id = '../escape'; json(f.communityFile, f.community); }],
  ['null avatar metadata', 'INVALID_COMMUNITY', f => { f.community.avatars = null; json(f.communityFile, f.community); }],
  ['unexpected avatar metadata fields', 'INVALID_COMMUNITY', f => { f.community.avatars[0].path = '../escape'; json(f.communityFile, f.community); }],
  ['missing community metadata', 'BROKEN_REFERENCE', f => fs.unlinkSync(f.communityFile)],
  ['backfill references missing issue', 'BROKEN_REFERENCE', f => { f.backfill[crypto.randomUUID()] = f.backfill[f.issueId]; json(f.backfillFile, f.backfill); }],
  ['backfill wrong remote URL', 'INVALID_COMMUNITY', f => { f.backfill[f.issueId].url = 'https://example.com/'; json(f.backfillFile, f.backfill); }],
  ['backfill unknown comment receipt shape', 'INVALID_COMMUNITY', f => { f.backfill[f.issueId].comments = { [crypto.randomUUID()]: 12 }; json(f.backfillFile, f.backfill); }],
  ['backfill unexpected fields', 'INVALID_COMMUNITY', f => { f.backfill[f.issueId].token = 'must-not-transfer'; json(f.backfillFile, f.backfill); }],
]) test('source rejects ' + label, async t => {
  const f = await fixture(t); change(f);
  assert.throws(() => validateData(f.source), errorCode(code));
  await assert.rejects(run(f.exportRequest), errorCode(code)); assert.equal(fs.existsSync(f.bundleDir), false);
});

test('source rejects a linked legacy avatar directory without reading the link target', async t => {
  const f = await fixture(t), outside = path.join(f.root, 'outside-avatars');
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, f.avatarId + '.png'), png);
  assert.equal(path.dirname(f.avatarDir), f.source.communityDir); fs.unlinkSync(f.avatarFile); fs.rmdirSync(f.avatarDir);
  fs.symlinkSync(outside, f.avatarDir, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => validateData(f.source), errorCode('UNSAFE_PATH'));
  assert.deepEqual(fs.readFileSync(path.join(outside, f.avatarId + '.png')), png);
});

for (const logical of ['community/avatars/../escape.png', 'community/avatars/' + 'a'.repeat(36) + '.png', 'community/avatars/00000000-0000-0000-0000-000000000000.svg', 'community/avatars/nested/00000000-0000-0000-0000-000000000000.png', 'community/unknown.json']) {
  test('authenticated manifest still rejects unexpected logical path ' + logical, async t => {
    const f = await fixture(t); await run(f.exportRequest);
    signedManifest(f, manifest => { manifest.files.find(file => file.logical.startsWith('community/avatars/')).logical = logical; });
    await assert.rejects(run({ action: 'verify', bundleDir: f.bundleDir, keyFile: f.keyFile }), errorCode('UNSAFE_PATH'));
    assert.equal(fs.existsSync(path.join(f.root, 'escape.png')), false);
  });
}

test('missing authenticated avatar payload and encrypted corruption fail before restore publication', async t => {
  const f = await fixture(t); await run(f.exportRequest);
  const manifest = JSON.parse(fs.readFileSync(path.join(f.bundleDir, 'manifest.json'))), entry = manifest.files.find(file => file.logical.startsWith('community/avatars/'));
  const file = path.join(f.bundleDir, entry.payload), saved = fs.readFileSync(file);
  fs.unlinkSync(file);
  await assert.rejects(run({ action: 'verify', bundleDir: f.bundleDir, keyFile: f.keyFile }), errorCode('CORRUPT_BUNDLE'));
  fs.writeFileSync(file, saved); const changed = Buffer.from(saved); changed[0] ^= 1; fs.writeFileSync(file, changed);
  await assert.rejects(run({ action: 'restore', bundleDir: f.bundleDir, keyFile: f.keyFile, destinationDir: f.destinationDir, apply: true }), errorCode('CORRUPT_BUNDLE'));
  assert.equal(fs.existsSync(f.destinationDir), false);
});

for (const [label, logical, code, change] of [
  ['corrupt PNG signature', f => 'community/avatars/' + f.avatarId + '.png', 'INVALID_COMMUNITY', bytes => { bytes[0] ^= 1; return bytes; }],
  ['missing avatar reference', () => 'community/community.json', 'BROKEN_REFERENCE', bytes => { const data = JSON.parse(bytes); data.avatars[0].id = crypto.randomUUID(); data.avatars[0].url = '/uploads/avatars/' + data.avatars[0].id + '.png'; return Buffer.from(JSON.stringify(data)); }],
  ['unknown backfill reference', () => 'community/github-backfill.json', 'BROKEN_REFERENCE', bytes => { const data = JSON.parse(bytes), item = Object.values(data)[0]; return Buffer.from(JSON.stringify({ [crypto.randomUUID()]: item })); }],
]) test('even valid authentication cannot bypass typed community validation: ' + label, async t => {
  const f = await fixture(t); await run(f.exportRequest); editPayload(f, logical(f), change);
  await assert.rejects(run({ action: 'restore', bundleDir: f.bundleDir, keyFile: f.keyFile, destinationDir: f.destinationDir, apply: true }), errorCode(code));
  assert.equal(fs.existsSync(f.destinationDir), false);
});
