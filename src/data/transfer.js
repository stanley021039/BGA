const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const sqlite = require('node:sqlite');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { execFileSync } = require('node:child_process');
const { openDatabase, SCHEMA_VERSION } = require('../db');
const { BoardStore } = require('../community/board');
const { dataPaths, acquireDataLocks, acquireLegacyHistoryLock, acquirePublishLock } = require('./locks');
const { fail, uuid, sha, absolute, noLinks, readJson, validateData } = require('./validation');

const repo = path.resolve(__dirname, '../..');
const FORMAT = 'afterhours-encrypted-data-v1';
const MAX_FILES = 20000, DEFAULT_MAX = 10 * 1024 ** 3;
const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
  return value;
}
function syncFile(file) { const fd = fs.openSync(file, 'r+'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function syncDir(dir) {
  // Windows does not expose directory fsync through Node; file fsync still applies.
  if (process.platform === 'win32') return;
  const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); syncFile(file); }
function limit(request) {
  const max = request.maxBytes ?? DEFAULT_MAX;
  if (!Number.isSafeInteger(max) || max < 1 || max > 1024 ** 4) fail('INVALID_REQUEST', 'maxBytes must be a positive integer up to 1 TiB');
  return max;
}
function key(file) {
  file = absolute(file, 'keyFile'); noLinks(file);
  if (!fs.statSync(file).isFile() || fs.statSync(file).size !== 32) fail('INVALID_KEY', 'keyFile must contain exactly 32 binary bytes');
  return fs.readFileSync(file);
}
function derive(master, id) {
  return { encryption: Buffer.from(crypto.hkdfSync('sha256', master, id, 'afterhours-data-encryption-v1', 32)),
    authentication: Buffer.from(crypto.hkdfSync('sha256', master, id, 'afterhours-data-manifest-v1', 32)) };
}
function hmac(manifest, secret) { return crypto.createHmac('sha256', secret).update(canonical(manifest)).digest('hex'); }
function fresh(file) { noLinks(file); if (fs.existsSync(file)) fail('DESTINATION_EXISTS', 'Destination already exists; select a new generation directory'); }
function inside(parent, file) { const rel = path.relative(parent, file); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
function sourcePaths(source) {
  if (!source || typeof source !== 'object') fail('INVALID_REQUEST', 'source is required');
  for (const name of ['dbFile', 'historyDir', 'communityDir']) absolute(source[name], 'source.' + name);
  if (source.musicDir !== undefined) absolute(source.musicDir, 'source.musicDir');
  const p = dataPaths(source); for (const file of Object.values(p)) noLinks(file);
  // Dedicated external directories must not contain each other or the SQLite file.
  const dirs = [p.historyDir, p.communityDir, p.musicDir];
  if (dirs.some(dir => inside(dir, p.dbFile)) || dirs.some((dir, i) => dirs.some((other, j) => i !== j && inside(dir, other)))) fail('UNSAFE_PATH', 'Source data directories must be separate');
  return p;
}
function separate(p, destination, keyFile) {
  const roots = [path.dirname(p.dbFile), p.historyDir, p.communityDir, p.musicDir];
  if (roots.some(root => inside(root, destination) || inside(destination, root)) || inside(destination, keyFile)) fail('UNSAFE_PATH', 'Destination must be separate from source data and keyFile');
}
function generationPaths(root) { return { dbFile: path.join(root, 'db', 'afterhours.sqlite'), historyDir: path.join(root, 'history'), communityDir: path.join(root, 'community'), musicDir: path.join(root, 'music') }; }
function initialize(root) { for (const name of ['db', 'history', 'community', 'music']) fs.mkdirSync(path.join(root, name), { mode: 0o700 }); }
function space(parent, bytes) {
  let cursor = parent; while (!fs.existsSync(cursor)) cursor = path.dirname(cursor);
  noLinks(cursor);
  const s = fs.statfsSync(cursor, { bigint: true });
  if (s.bavail * s.bsize < BigInt(bytes) + 16n * 1024n * 1024n) fail('INSUFFICIENT_SPACE', 'Not enough free disk space for staging and publication');
}
function temp(parent) { noLinks(parent); fs.mkdirSync(parent, { recursive: true, mode: 0o700 }); return fs.mkdtempSync(path.join(parent, '.afterhours-transfer-')); }
function cleanup(dir) { if (dir) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); }
function assetsFingerprint() {
  const root = path.join(repo, 'public/assets'), hash = crypto.createHash('sha256');
  function visit(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name); noLinks(file);
      if (fs.statSync(file).isDirectory()) visit(file);
      else if (fs.statSync(file).isFile()) hash.update(path.relative(root, file).split(path.sep).join('/') + '\0' + sha(fs.readFileSync(file)) + '\n');
      else fail('UNSAFE_PATH', 'Unexpected built-in asset file');
    }
  }
  visit(root); return hash.digest('hex');
}
function codeInfo() {
  let commit = null, dirty = null;
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  return { commit, dirty, assetsSha256: assetsFingerprint(), nodeVersion: process.version, maximumSchema: SCHEMA_VERSION };
}
function identity(p, source) {
  if (typeof source.envId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(source.envId)) fail('INVALID_REQUEST', 'source.envId must be an environment label');
  const file = path.join(path.dirname(p.dbFile), '.' + path.basename(p.dbFile) + '.data-instance.json');
  noLinks(file);
  let saved;
  if (fs.existsSync(file)) saved = readJson(file);
  else { saved = { version: 1, dataInstanceId: source.dataInstanceId || crypto.randomUUID() }; if (!uuid.test(saved.dataInstanceId)) fail('INVALID_REQUEST', 'source.dataInstanceId must be a UUID'); writeJson(file, saved); }
  if (saved.version !== 1 || !uuid.test(saved.dataInstanceId) || (source.dataInstanceId && source.dataInstanceId !== saved.dataInstanceId)) fail('ORIGIN_CONFLICT', 'Source data identity is invalid or disagrees with the saved identity');
  return { envId: source.envId, dataInstanceId: saved.dataInstanceId };
}
async function snapshot(file, output, forceVacuum = false) {
  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    if (typeof sqlite.backup === 'function' && !forceVacuum) { await sqlite.backup(db, output); return 'sqlite.backup'; }
    db.prepare('VACUUM INTO ?').run(output); return 'VACUUM INTO';
  } finally { db.close(); }
}
async function hashFile(file) {
  const hash = crypto.createHash('sha256'); let size = 0;
  for await (const chunk of fs.createReadStream(file)) { size += chunk.length; hash.update(chunk); }
  return { sha256: hash.digest('hex'), bytes: size };
}
async function encrypt(file, output, keys, bundleId, logical) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', keys.encryption, iv);
  cipher.setAAD(Buffer.from(bundleId + '\0' + logical));
  const plain = crypto.createHash('sha256'), encrypted = crypto.createHash('sha256'); let bytes = 0;
  const plainTap = new Transform({ transform(chunk, encoding, done) { bytes += chunk.length; plain.update(chunk); done(null, chunk); } });
  const cipherTap = new Transform({ transform(chunk, encoding, done) { encrypted.update(chunk); done(null, chunk); } });
  await pipeline(fs.createReadStream(file), plainTap, cipher, cipherTap, fs.createWriteStream(output, { flags: 'wx', mode: 0o600 }));
  syncFile(output);
  return { bytes, sha256: plain.digest('hex'), cipherSha256: encrypted.digest('hex'), iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}
async function decrypt(entry, bundle, output, keys, bundleId) {
  const file = path.join(bundle, entry.payload);
  const encrypted = await hashFile(file);
  if (encrypted.bytes !== entry.bytes || encrypted.sha256 !== entry.cipherSha256) fail('CORRUPT_BUNDLE', 'Encrypted payload hash or size differs from manifest');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keys.encryption, Buffer.from(entry.iv, 'hex'));
  decipher.setAAD(Buffer.from(bundleId + '\0' + entry.logical)); decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
  try { await pipeline(fs.createReadStream(file), decipher, fs.createWriteStream(output, { flags: 'wx', mode: 0o600 })); }
  catch { fail('AUTHENTICATION_FAILED', 'Payload authentication failed'); }
  const plain = await hashFile(output);
  if (plain.bytes !== entry.bytes || plain.sha256 !== entry.sha256) fail('CORRUPT_BUNDLE', 'Decrypted payload hash differs from manifest');
  syncFile(output);
}
function authenticate(request) {
  const bundle = absolute(request.bundleDir, 'bundleDir'); noLinks(bundle);
  const manifest = readJson(path.join(bundle, 'manifest.json'), 5 * 1024 * 1024);
  if (manifest.format !== FORMAT || !uuid.test(manifest.bundleId)) fail('UNSUPPORTED_BUNDLE', 'Bundle format is not supported');
  const keys = derive(key(request.keyFile), manifest.bundleId), { authentication, ...body } = manifest;
  const expected = hmac(body, keys.authentication);
  if (typeof authentication !== 'string' || !/^[0-9a-f]{64}$/.test(authentication) || !crypto.timingSafeEqual(Buffer.from(authentication, 'hex'), Buffer.from(expected, 'hex'))) fail('AUTHENTICATION_FAILED', 'Wrong key or altered manifest');
  if (!uuid.test(manifest.origin?.dataInstanceId) || typeof manifest.origin?.envId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(manifest.origin.envId) || !Number.isInteger(manifest.code?.maximumSchema) || manifest.code.maximumSchema < 1 || !/^[0-9a-f]{64}$/.test(manifest.code.assetsSha256)) fail('UNSUPPORTED_BUNDLE', 'Bundle origin or application descriptor is invalid');
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > MAX_FILES || manifest.code?.maximumSchema > SCHEMA_VERSION) fail('UNSUPPORTED_BUNDLE', 'Bundle contents or schema are not supported');
  const logicals = new Set(), payloads = new Set(); let bytes = 0;
  for (const entry of manifest.files) {
    const validLogical = entry.logical === 'db/afterhours.sqlite' || /^music\/[0-9a-f-]{36}\.(mp3|ogg|m4a)$/i.test(entry.logical) || entry.logical === 'community/community.json' || /^history\/[0-9a-f-]{36}\.(jsonl|meta\.json)$/i.test(entry.logical);
    if (!validLogical || !/^payload\/[0-9]{6}\.bin$/.test(entry.payload) || logicals.has(entry.logical.toLowerCase()) || payloads.has(entry.payload)) fail('UNSAFE_PATH', 'Invalid or duplicate bundle path');
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[0-9a-f]{64}$/.test(entry.sha256) || !/^[0-9a-f]{64}$/.test(entry.cipherSha256) || !/^[0-9a-f]{24}$/.test(entry.iv) || !/^[0-9a-f]{32}$/.test(entry.tag)) fail('CORRUPT_BUNDLE', 'Invalid payload descriptor');
    logicals.add(entry.logical.toLowerCase()); payloads.add(entry.payload); bytes += entry.bytes;
    noLinks(path.join(bundle, entry.payload));
    if (!fs.existsSync(path.join(bundle, entry.payload)) || !fs.statSync(path.join(bundle, entry.payload)).isFile()) fail('CORRUPT_BUNDLE', 'Bundle payload is missing');
  }
  if (!logicals.has('db/afterhours.sqlite') || bytes !== manifest.totalBytes || bytes > limit(request)) fail('BUNDLE_LIMIT', 'Invalid bundle size or configured limit exceeded');
  if (fs.readdirSync(bundle).sort().join('|') !== 'manifest.json|payload') fail('UNEXPECTED_FILE', 'Bundle contains unlisted files');
  noLinks(path.join(bundle, 'payload'));
  const actual = fs.readdirSync(path.join(bundle, 'payload')).map(n => 'payload/' + n).sort();
  if (canonical(actual) !== canonical([...payloads].sort())) fail('CORRUPT_BUNDLE', 'Bundle contains missing or unlisted payloads');
  return { bundle, manifest, keys };
}
async function unpack(request, parent) {
  const auth = authenticate(request);
  if (auth.manifest.code.assetsSha256 !== assetsFingerprint()) fail('ASSET_VERSION_MISMATCH', 'Use the matching application assets before restoring this bundle');
  space(parent, auth.manifest.totalBytes * 2);
  const stage = temp(parent); initialize(stage);
  try {
    for (const entry of auth.manifest.files) await decrypt(entry, auth.bundle, path.join(stage, ...entry.logical.split('/')), auth.keys, auth.manifest.bundleId);
    const validated = validateData(generationPaths(stage), { acknowledgeInterruptedMatches: true });
    const portableSummary = s => ({ ...s, database: { ...s.database, sqliteVersion: undefined } });
    if (canonical(portableSummary(validated.summary)) !== canonical(portableSummary(auth.manifest.summary))) fail('VALIDATION_FAILED', 'Restored inventory differs from authenticated manifest');
    return { ...auth, stage, validated };
  } catch (error) { cleanup(stage); throw error; }
}
function publicManifest(m) { return { bundleId: m.bundleId, snapshotAt: m.snapshotAt, origin: m.origin, code: m.code, totalBytes: m.totalBytes, files: m.files.length, summary: m.summary, policy: m.policy }; }
function bootConfig(destination) {
  const p = generationPaths(destination);
  return { DB_FILE: p.dbFile, HISTORY_DIR: p.historyDir, COMMUNITY_DIR: p.communityDir, MUSIC_DIR: p.musicDir, EXTERNAL_SIDE_EFFECTS_ENABLED: 'false' };
}
function policies() { return { accountCredentialsIncluded: true, deploymentSecretsIncluded: false, activeRoomsIncluded: false, sessionsOnRestore: 'revoke', pendingSubmissionsOnRestore: 'needs_review', externalSideEffectsOnFirstBoot: 'disabled', restoreMode: 'new-generation-only' }; }
async function withStoppedSource(request, run) {
  if (request.sourceStopped !== true) fail('SOURCE_NOT_STOPPED', 'Stop every source writer and set sourceStopped=true');
  const p = sourcePaths(request.source);
  if (!fs.existsSync(p.dbFile) || [p.historyDir, p.communityDir, p.musicDir].some(dir => !fs.existsSync(dir))) fail('MISSING_SOURCE', 'Source database and dedicated data directories must exist');
  const guard = acquireDataLocks(p, 'data-transfer'); let legacy;
  try { legacy = acquireLegacyHistoryLock(p.historyDir); return await run(p); }
  finally { if (legacy) legacy(); guard.release(); }
}
async function exportBundle(request) {
  const output = absolute(request.outputDir, 'outputDir'), keyFile = absolute(request.keyFile, 'keyFile'), master = key(keyFile);
  fresh(output);
  return withStoppedSource(request, async p => {
    separate(p, output, keyFile);
    const initial = validateData(p, request), total = initial.files.reduce((n, f) => n + fs.statSync(f.source).size, 0);
    if (total > limit(request) || initial.files.length > MAX_FILES) fail('BUNDLE_LIMIT', 'Source exceeds transfer limits');
    const wal = p.dbFile + '-wal', walBytes = fs.existsSync(wal) ? fs.statSync(wal).size : 0;
    noLinks(wal); noLinks(p.dbFile + '-shm');
    space(path.dirname(output), (total + walBytes) * 4);
    const origin = identity(p, request.source), stage = temp(path.dirname(output)); let claimed = false;
    try {
      const dbCopy = path.join(stage, 'snapshot.sqlite'), snapshotMethod = await snapshot(p.dbFile, dbCopy, request.forceVacuum === true);
      const snapshotTotal = total - fs.statSync(p.dbFile).size + fs.statSync(dbCopy).size;
      if (snapshotTotal > limit(request)) fail('BUNDLE_LIMIT', 'Consistent snapshot exceeds transfer limits');
      const bundleId = crypto.randomUUID(), keys = derive(master, bundleId), files = [];
      fs.mkdirSync(path.join(stage, 'payload'), { mode: 0o700 });
      for (const [index, f] of initial.files.entries()) {
        const payload = 'payload/' + String(index + 1).padStart(6, '0') + '.bin';
        files.push({ logical: f.logical, payload, ...await encrypt(f.logical.startsWith('db/') ? dbCopy : f.source, path.join(stage, payload), keys, bundleId, f.logical) });
      }
      const body = { format: FORMAT, bundleId, snapshotAt: new Date().toISOString(), origin, code: codeInfo(), snapshotMethod, summary: initial.summary, policy: policies(), totalBytes: files.reduce((n, f) => n + f.bytes, 0), files };
      writeJson(path.join(stage, 'manifest.json'), { ...body, authentication: hmac(body, keys.authentication) });
      fs.unlinkSync(dbCopy);
      // Verify the snapshot and every encrypted file before publishing the bundle.
      const check = await unpack({ ...request, bundleDir: stage }, path.dirname(output)); cleanup(check.stage);
      fs.mkdirSync(output, { mode: 0o700 }); claimed = true;
      fs.renameSync(path.join(stage, 'payload'), path.join(output, 'payload'));
      fs.renameSync(path.join(stage, 'manifest.json'), path.join(output, 'manifest.json'));
      syncDir(path.join(output, 'payload')); syncDir(output); syncDir(path.dirname(output));
      return { action: 'export', bundleDir: output, ...publicManifest(body), snapshotMethod };
    } catch (error) { if (claimed) cleanup(output); throw error; }
    finally { cleanup(stage); }
  });
}
function restorePolicy(stage, validated) {
  const p = generationPaths(stage), db = openDatabase(p.dbFile), revoked = {};
  let heldSubmissions;
  try {
    const communityFile = path.join(p.communityDir, 'community.json');
    new BoardStore(db, fs.existsSync(communityFile) ? readJson(communityFile).issues : []);
    db.exec('BEGIN IMMEDIATE');
    for (const table of ['sessions', 'invites', 'password_resets']) { revoked[table] = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n; db.exec(`DELETE FROM ${table}`); }
    heldSubmissions = db.prepare("UPDATE submissions SET state='needs_review',error='Restored backup: administrator must reconcile remote result before retry',updated_at=? WHERE state IN ('pending','sending')").run(new Date().toISOString()).changes;
    db.exec('COMMIT'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally { db.close(); }
  for (const id of validated.playing) {
    const m = validated.metas.get(id);
    const at = new Date().toISOString(), reason = 'server-data-restore';
    fs.appendFileSync(path.join(p.historyDir, id + '.jsonl'), JSON.stringify({ kind: 'interrupted', at, reason, state: validated.interruptedStates.get(id) }) + '\n');
    fs.writeFileSync(path.join(p.historyDir, id + '.meta.json'), JSON.stringify({ ...m, status: 'interrupted', endedAt: at, reason }), { mode: 0o600 });
    syncFile(path.join(p.historyDir, id + '.meta.json')); syncFile(path.join(p.historyDir, id + '.jsonl'));
  }
  return { revoked, heldSubmissions, interruptedMatches: validated.playing.length };
}
function binaryAssetsPreserved(before, after) {
  // Migrations 3, 5 and 8 introduce empty BLOB tables; existing assets must remain exact.
  const introduced = { character_images: 3, community_gifts: 5, user_artworks: 8 }, emptyDigest = sha('');
  for (const [table, digest] of Object.entries(before.blobDigests)) {
    if (after.blobDigests[table] !== digest) return false;
  }
  for (const [table, digest] of Object.entries(after.blobDigests)) {
    if (Object.hasOwn(before.blobDigests, table)) continue;
    if (!Object.hasOwn(introduced, table) || before.schemaVersion >= introduced[table] || Object.hasOwn(before.tableCounts, table) || after.tableCounts[table] !== 0 || digest !== emptyDigest) return false;
  }
  return true;
}
async function restore(request) {
  const expectedBundleId = request.expectedBundleId;
  if (expectedBundleId !== undefined && (typeof expectedBundleId !== 'string' || !uuid.test(expectedBundleId))) fail('INVALID_REQUEST', 'expectedBundleId must be a UUID from verification or a restore preview');
  const destination = absolute(request.destinationDir, 'destinationDir'); fresh(destination);
  const bundle = absolute(request.bundleDir, 'bundleDir'), keyFile = absolute(request.keyFile, 'keyFile');
  if (inside(destination, bundle) || inside(bundle, destination) || inside(destination, keyFile)) fail('UNSAFE_PATH', 'Restore destination must be separate from bundle and keyFile');
  const checked = await unpack(request, path.dirname(destination)); let claimed = false, published = false, releasePublication;
  try {
    if (expectedBundleId !== undefined && checked.manifest.bundleId.toLowerCase() !== expectedBundleId.toLowerCase()) fail('BUNDLE_CHANGED', 'The backup changed since verification or preview; verify and preview the selected backup again');
    if (checked.validated.playing.length && request.acknowledgeInterruptedMatches !== true) fail('UNFINISHED_MATCHES', 'Set acknowledgeInterruptedMatches=true to mark unfinished matches interrupted');
    const changes = restorePolicy(checked.stage, checked.validated), after = validateData(generationPaths(checked.stage));
    // Account UUIDs and credential hashes must survive the migration and restore policy exactly.
    const beforeDatabase = checked.manifest.summary.database, afterDatabase = after.summary.database;
    if (afterDatabase.tableCounts.users !== beforeDatabase.tableCounts.users || afterDatabase.accountsSha256 !== beforeDatabase.accountsSha256 || !binaryAssetsPreserved(beforeDatabase, afterDatabase)) fail('VALIDATION_FAILED', 'Accounts or binary assets changed unexpectedly');
    const result = { action: 'restore', dryRun: request.apply !== true, destinationDir: destination, ...publicManifest(checked.manifest), changes, restoredSummary: after.summary, config: bootConfig(destination),
      nextSteps: ['Start this generation on an isolated port with the returned configuration', 'Verify login, permissions, music, history and assets', 'Stop the old writer before switching traffic; retain the old code and data for rollback', 'Reconcile held remote submissions before explicitly enabling external side effects'] };
    if (request.apply !== true) return result;
    // Reserve a new directory atomically. The application refuses this generation until the marker is removed.
    releasePublication = acquirePublishLock(destination);
    fs.mkdirSync(destination, { mode: 0o700 }); claimed = true;
    writeJson(path.join(destination, '.afterhours-restore-in-progress'), { bundleId: checked.manifest.bundleId });
    syncDir(destination); syncDir(path.dirname(destination));
    for (const name of ['db', 'history', 'community', 'music']) fs.renameSync(path.join(checked.stage, name), path.join(destination, name));
    writeJson(path.join(destination, 'restore-receipt.json'), { version: 1, restoredAt: new Date().toISOString(), ...result });
    writeJson(path.join(destination, 'db', '.afterhours.sqlite.data-instance.json'), { version: 1, dataInstanceId: checked.manifest.origin.dataInstanceId });
    for (const name of ['db', 'history', 'community', 'music']) syncDir(path.join(destination, name));
    syncDir(destination);
    fs.unlinkSync(path.join(destination, '.afterhours-restore-in-progress'));
    syncDir(destination);
    published = true;
    return result;
  } catch (error) { if (claimed) { error.code = 'PARTIAL_RESTORE'; error.message = 'Restore publication failed; the new destination is blocked by its publication lock or marker. Keep using the previous generation and inspect this new directory'; } throw error; }
  // Keep the publication fence on any failure after reservation, including failure to write the marker itself.
  finally { if (releasePublication && (!claimed || published)) releasePublication(); cleanup(checked.stage); }
}
async function run(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) fail('INVALID_REQUEST', 'Request must be a JSON object');
  switch (request.action) {
    case 'keygen': {
      const file = absolute(request.keyFile, 'keyFile'); fresh(file); fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const secret = crypto.randomBytes(32); fs.writeFileSync(file, secret, { flag: 'wx', mode: 0o600 });
      syncFile(file);
      return { action: 'keygen', keyFile: file, fingerprint: sha(secret), note: 'Store this binary key separately from the bundle; losing it makes recovery impossible' };
    }
    case 'inspect': return withStoppedSource(request, async p => ({ action: 'inspect', paths: p, ...validateData(p, request).summary, policy: policies() }));
    case 'export': return exportBundle(request);
    case 'verify': {
      const checked = await unpack(request, absolute(request.tempDir || os.tmpdir(), 'tempDir'));
      try { return { action: 'verify', ...publicManifest(checked.manifest) }; } finally { cleanup(checked.stage); }
    }
    case 'restore': return restore(request);
    default: fail('INVALID_REQUEST', 'Unknown action; use --help for the JSON contract');
  }
}
// Never include SQLite errors, JSON contents, credentials, crypto internals or stack traces in the machine response.
function safeError(error) {
  const messages = {
    ENOENT: 'Required file or directory is missing', EACCES: 'Access denied', EPERM: 'Operation is not permitted', ENOSPC: 'Disk is full',
    EEXIST: 'Destination or lock already exists', DATA_IN_USE: 'Data is in use; stop all writers first', RESTORE_IN_PROGRESS: 'Restore generation is incomplete',
  };
  const known = new Set(['INVALID_REQUEST','INVALID_KEY','UNSAFE_PATH','INVALID_DATA','INVALID_DATABASE','INVALID_ACCOUNTS','UNSUPPORTED_SCHEMA','INTEGRITY_FAILED','FOREIGN_KEY_FAILED','BROKEN_REFERENCE','UNEXPECTED_FILE','INVALID_MUSIC','MISSING_MUSIC','INVALID_COMMUNITY','INVALID_HISTORY','UNFINISHED_MATCHES','DESTINATION_EXISTS','INSUFFICIENT_SPACE','ORIGIN_CONFLICT','CORRUPT_BUNDLE','AUTHENTICATION_FAILED','UNSUPPORTED_BUNDLE','BUNDLE_LIMIT','BUNDLE_CHANGED','ASSET_VERSION_MISMATCH','VALIDATION_FAILED','SOURCE_NOT_STOPPED','MISSING_SOURCE','PARTIAL_RESTORE']);
  if (messages[error.code]) return { code: error.code, message: messages[error.code] };
  if (known.has(error.code)) return { code: error.code, message: error.message };
  return { code: 'TRANSFER_FAILED', message: 'Transfer failed; inspect filesystem permissions, SQLite compatibility and stopped-writer state without publishing secrets' };
}
module.exports = { run, safeError, snapshot, canonical, FORMAT };
