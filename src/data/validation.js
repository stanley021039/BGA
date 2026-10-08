const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const { DatabaseSync } = require('node:sqlite');
const { SCHEMA_VERSION, MARKET_CURVE_TABLES, MARKET_AUTOMATION_TABLES, validateFeatureSchema } = require('../db');
const { validateQuestion } = require('../community/store');
const { audioType, MAX_BYTES } = require('../music/store');
const { inspectExpressionSound } = require('../profiles/sounds');
const { expressionLabels } = require('../profiles/appearance');
const { imageOf, MAX_BYTES: MAX_IMAGE_BYTES } = require('../profiles/uploads');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validBundleLogical(logical) {
  if (typeof logical !== 'string') return false;
  const avatar = logical.startsWith('community/avatars/') && logical.endsWith('.png') && uuid.test(logical.slice('community/avatars/'.length, -4));
  return logical === 'db/afterhours.sqlite' || /^music\/[0-9a-f-]{36}\.(mp3|ogg|m4a)$/i.test(logical) || logical === 'community/community.json' || logical === 'community/github-backfill.json' || avatar || /^history\/[0-9a-f-]{36}\.(jsonl|meta\.json)$/i.test(logical);
}
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fail(code, message) { const error = Error(message); error.code = code; throw error; }
function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail('INVALID_REQUEST', `${label} must be an absolute path`);
  return path.resolve(value);
}
// Check every ancestor too: a directory junction can otherwise escape a requested root.
function noLinks(file) {
  let cursor = path.resolve(file);
  for (;;) {
    let stat; try { stat = fs.lstatSync(cursor); } catch (error) { if (!['ENOENT','ENOTDIR'].includes(error.code)) throw error; }
    if (stat?.isSymbolicLink()) fail('UNSAFE_PATH', 'Symbolic links and junctions are not accepted');
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
}
function readJson(file, max = 32 * 1024 * 1024) {
  noLinks(file);
  if (!fs.statSync(file).isFile() || fs.statSync(file).size > max) fail('INVALID_DATA', 'Invalid or oversized JSON file');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail('INVALID_DATA', 'Invalid JSON data'); }
}
function quote(name) { return '"' + name.replaceAll('"', '""') + '"'; }
function* jsonlRows(file) {
  const fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(64 * 1024), decoder = new StringDecoder('utf8');
  let tail = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buffer, 0, buffer.length, null);
      tail += n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let end;
      while ((end = tail.indexOf('\n')) !== -1) {
        if (end > 16 * 1024 * 1024) fail('INVALID_HISTORY', 'A history row exceeds 16 MiB');
        let row; try { row = JSON.parse(tail.slice(0, end)); } catch { fail('INVALID_HISTORY', 'History JSONL is invalid'); }
        tail = tail.slice(end + 1); yield row;
      }
      if (tail.length > 16 * 1024 * 1024) fail('INVALID_HISTORY', 'A history row exceeds 16 MiB');
      if (!n) break;
    }
    if (tail) fail('INVALID_HISTORY', 'History log has an incomplete final row');
  } finally { fs.closeSync(fd); }
}
function validateDatabase(file) {
  noLinks(file);
  if (!fs.statSync(file).isFile()) fail('INVALID_DATABASE', 'SQLite source must be a regular file');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const schemaVersion = db.prepare('PRAGMA user_version').get().user_version;
    if (schemaVersion < 1 || schemaVersion > SCHEMA_VERSION) fail('UNSUPPORTED_SCHEMA', 'Database schema is not supported by this release');
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') fail('INTEGRITY_FAILED', 'SQLite integrity check failed');
    if (db.prepare('PRAGMA foreign_key_check').all().length) fail('FOREIGN_KEY_FAILED', 'SQLite contains broken foreign keys');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
    if (!tables.includes('users')) fail('INVALID_DATABASE', 'Account table is missing');
    const marketTables = ['market_rounds','market_votes','market_settlements','market_ledger','market_requests'];
    const required = { 1: ['users','sessions','invites','password_resets'], 2: ['board_issues','board_comments','submissions'], 3: ['player_characters','character_images'], 5: ['community_gifts'], 6: ['user_achievements'], 8: ['user_artworks'], 9: ['draw_words'], 11: ['music_tracks'], 15: ['draw_word_exclusions','character_sounds',...marketTables], 16: ['market_images'], 17: MARKET_AUTOMATION_TABLES, 18: MARKET_CURVE_TABLES };
    for (const [version, names] of Object.entries(required)) if (schemaVersion >= Number(version) && names.some(n => !tables.includes(n))) fail('INVALID_DATABASE', 'Database schema is missing a required table');
    // Both historical schema-13 layouts and schema-14 layouts are identified by
    // complete feature shapes. Partial or forged tables cannot be repaired away.
    try { validateFeatureSchema(db,schemaVersion); } catch { fail('INVALID_DATABASE', 'Database feature schema is incomplete or invalid'); }
    if (schemaVersion >= 13) {
      const present = marketTables.filter(name => tables.includes(name)).length;
      if (present && present !== marketTables.length || schemaVersion === 13 && !tables.includes('draw_word_exclusions') && present !== marketTables.length) fail('INVALID_DATABASE', 'Database schema is missing a required table');
      if (present) { try { require('../market/store').validateMarketDatabase(db); } catch { fail('INVALID_DATABASE', 'Market score history is invalid'); } }
    }
    if (MARKET_AUTOMATION_TABLES.some(name => tables.includes(name))) {
      try { require('../market/automation-store').validateMarketAutomationDatabase(db); } catch { fail('INVALID_DATABASE', 'Market automation history is invalid'); }
    }
    let marketImagesSha256;
    if (tables.includes('market_images')) {
      try { require('../market/images').validateMarketImagesDatabase(db); } catch { fail('INVALID_DATABASE', 'Market image assets or metadata are invalid'); }
      // Include every frozen rule, ownership and review field, as well as bytes.
      const imagesDigest = crypto.createHash('sha256');
      for (const row of db.prepare('SELECT * FROM market_images ORDER BY id').iterate()) imagesDigest.update(JSON.stringify({ ...row, bytes: sha(row.bytes) }) + '\n');
      marketImagesSha256 = imagesDigest.digest('hex');
    }
    const accountsDigest = crypto.createHash('sha256');
    for (const user of db.prepare('SELECT * FROM users ORDER BY id').iterate()) {
      if (!uuid.test(user.id) || !['member','admin'].includes(user.role) || ![0,1].includes(user.disabled) || !/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(user.password_hash)) fail('INVALID_ACCOUNTS', 'Account identity, permissions or credential format is invalid');
      accountsDigest.update(JSON.stringify(user) + '\n');
    }
    const tableCounts = {}, blobDigests = {};
    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all();
      tableCounts[table] = db.prepare(`SELECT COUNT(*) AS n FROM ${quote(table)}`).get().n;
      const blobs = columns.filter(c => c.type.toUpperCase() === 'BLOB');
      if (!blobs.length) continue;
      const keys = columns.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => c.name);
      if (!keys.length) fail('INVALID_DATABASE', 'A BLOB table has no stable primary key');
      const digest = crypto.createHash('sha256');
      for (const row of db.prepare(`SELECT ${[...keys, ...blobs.map(c => c.name)].map(quote).join(',')} FROM ${quote(table)} ORDER BY ${keys.map(quote).join(',')}`).iterate()) {
        digest.update(JSON.stringify(keys.map(k => row[k])) + '\n');
        for (const c of blobs) digest.update(JSON.stringify([c.name, row[c.name] === null ? null : sha(row[c.name])]) + '\n');
      }
      blobDigests[table] = digest.digest('hex');
    }
    if (tables.includes('character_sounds')) {
      if (schemaVersion < 14 && tableCounts.character_sounds !== 0) fail('INVALID_DATABASE', 'An older schema cannot contain expression sounds');
      const columns = db.prepare('PRAGMA table_info(character_sounds)').all();
      const types = { character_id: 'TEXT', expression: 'TEXT', mime: 'TEXT', bytes: 'BLOB', duration_ms: 'INTEGER' };
      const keys = columns.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => c.name);
      const foreignKeys = db.prepare('PRAGMA foreign_key_list(character_sounds)').all().sort((a, b) => a.seq - b.seq);
      if (Object.entries(types).some(([name, type]) => !columns.some(c => c.name === name && c.type.toUpperCase() === type && c.notnull)) ||
          keys.join(',') !== 'character_id,expression' || foreignKeys.length !== 2 || foreignKeys[0].id !== foreignKeys[1].id ||
          foreignKeys.some((fk, index) => fk.seq !== index || fk.table !== 'character_images' || fk.from !== keys[index] || fk.to !== keys[index] || fk.on_delete !== 'CASCADE')) fail('INVALID_DATABASE', 'Expression sound schema does not bind the exact character image');
      for (const row of db.prepare('SELECT character_id,expression,mime,bytes,duration_ms FROM character_sounds').iterate()) {
        const expression = row.expression;
        if (!uuid.test(row.character_id) || typeof expression !== 'string' || expression === 'neutral' ||
            !(Object.hasOwn(expressionLabels, expression) || (expression.startsWith('emote-') && uuid.test(expression.slice(6)))) ||
            !db.prepare('SELECT 1 FROM character_images WHERE character_id=? AND expression=?').get(row.character_id, expression)) fail('BROKEN_REFERENCE', 'An expression sound references an invalid or missing character expression');
        let sound; try { sound = inspectExpressionSound(row.bytes); } catch { fail('VALIDATION_FAILED', 'Expression sound bytes are not a canonical WAV of at most ten seconds'); }
        if (row.mime !== sound.mime || !Number.isInteger(row.duration_ms) || row.duration_ms !== sound.durationMs) fail('VALIDATION_FAILED', 'Expression sound metadata differs from its WAV samples');
      }
    }
    // These JSON references are not represented by SQLite foreign keys.
    const exists = (table, id) => tables.includes(table) && db.prepare(`SELECT 1 FROM ${quote(table)} WHERE id=?`).get(id);
    const character = selection => {
      if (!selection?.characterId?.startsWith('user:')) return;
      const id = selection.characterId.slice(5);
      if (!exists('player_characters', id) || !db.prepare('SELECT 1 FROM character_images WHERE character_id=? AND expression=?').get(id, selection.expression)) fail('BROKEN_REFERENCE', 'A profile references a missing character image');
    };
    for (const row of db.prepare('SELECT appearance FROM users WHERE appearance IS NOT NULL').iterate()) {
      let profile; try { profile = JSON.parse(row.appearance); } catch { fail('BROKEN_REFERENCE', 'Invalid account appearance JSON'); }
      character(profile); if (profile?.avatar?.kind === 'character') character(profile.avatar);
      if (profile?.avatar?.kind === 'artwork' && !exists('user_artworks', profile.avatar.artworkId)) fail('BROKEN_REFERENCE', 'A profile references missing artwork');
    }
    return { schemaVersion, sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get().version, tableCounts, blobDigests, accountsSha256: accountsDigest.digest('hex'), ...(marketImagesSha256 === undefined ? {} : { marketImagesSha256 }),
      music: tables.includes('music_tracks') ? db.prepare('SELECT id,size,mime,ext FROM music_tracks ORDER BY id').all() : [] };
  } finally { db.close(); }
}
function listFlat(dir, allowed, ignored = []) {
  noLinks(dir);
  if (!fs.statSync(dir).isDirectory()) fail('INVALID_DATA', 'Data path must be a directory');
  const names = fs.readdirSync(dir).sort();
  for (const name of names) {
    noLinks(path.join(dir, name));
    if (!fs.lstatSync(path.join(dir, name)).isFile()) fail('UNSAFE_PATH', 'Unexpected directory or special file in data');
    if (!ignored.includes(name) && !allowed(name)) fail('UNEXPECTED_FILE', 'Unexpected file in data; inspect it before transfer');
  }
  return names.filter(n => !ignored.includes(n));
}
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return record(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|'); }
function timestamp(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function communityFiles(dir) {
  noLinks(dir);
  if (!fs.statSync(dir).isDirectory()) fail('INVALID_DATA', 'Data path must be a directory');
  const names = fs.readdirSync(dir).sort();
  for (const name of names) {
    const file = path.join(dir, name); noLinks(file);
    if (name === 'avatars') {
      if (!fs.lstatSync(file).isDirectory()) fail('UNSAFE_PATH', 'Legacy avatar data must be a regular directory');
    } else {
      if (!fs.lstatSync(file).isFile()) fail('UNSAFE_PATH', 'Unexpected directory or special file in community data');
      if (!['community.json', 'github-backfill.json', '.afterhours-data-lock'].includes(name)) fail('UNEXPECTED_FILE', 'Unexpected community file; inspect it before transfer');
    }
  }
  return names.filter(name => name !== '.afterhours-data-lock');
}
function legacyCommunity(dir, names, data, files) {
  const avatars = data && Object.hasOwn(data, 'avatars') ? data.avatars : [];
  if (!Array.isArray(avatars) || avatars.length > 5000) fail('INVALID_COMMUNITY', 'Legacy avatar metadata is invalid');
  const avatarNames = names.includes('avatars') ? listFlat(path.join(dir, 'avatars'), name => name.endsWith('.png') && uuid.test(name.slice(0, -4))) : [];
  const expected = new Set(), ids = new Set();
  for (const avatar of avatars) {
    if (!exactKeys(avatar, ['id', 'name', 'url', 'at']) || !uuid.test(avatar.id) || ids.has(avatar.id.toLowerCase()) || typeof avatar.name !== 'string' || !avatar.name.trim() || avatar.name.length > 256 || !timestamp(avatar.at)) fail('INVALID_COMMUNITY', 'Legacy avatar metadata is invalid');
    const name = avatar.id + '.png', file = path.join(dir, 'avatars', name);
    if (avatar.url !== '/uploads/avatars/' + name) fail('BROKEN_REFERENCE', 'A legacy avatar references an unexpected image path');
    ids.add(avatar.id.toLowerCase()); expected.add(name);
    if (!avatarNames.includes(name)) fail('BROKEN_REFERENCE', 'A legacy avatar image is missing');
    const size = fs.statSync(file).size;
    if (size < 33 || size > MAX_IMAGE_BYTES) fail('INVALID_COMMUNITY', 'A legacy avatar image is empty or oversized');
    const bytes = fs.readFileSync(file);
    // Use the same image signature parser as uploads, with this legacy format
    // narrowed to PNG and a complete IHDR. Never decode or execute image data.
    let image; try { image = imageOf({ base64: bytes.toString('base64'), mime: 'image/png' }); } catch { fail('INVALID_COMMUNITY', 'A legacy avatar image has an invalid PNG signature'); }
    if (image.mime !== 'image/png' || bytes.readUInt32BE(8) !== 13) fail('INVALID_COMMUNITY', 'A legacy avatar image has an invalid PNG header');
    files.push({ logical: 'community/avatars/' + name, source: file });
  }
  if (avatarNames.some(name => !expected.has(name))) fail('UNEXPECTED_FILE', 'Legacy avatar directory contains an unlisted image');
  let backfillEntries = 0;
  if (names.includes('github-backfill.json')) {
    const file = path.join(dir, 'github-backfill.json'), backfill = readJson(file, 5 * 1024 * 1024);
    if (!record(backfill) || Object.keys(backfill).length > 1000) fail('INVALID_COMMUNITY', 'Legacy GitHub backfill data is invalid');
    const issues = new Set((data?.issues || []).map(issue => issue.id)), numbers = new Set();
    for (const [id, entry] of Object.entries(backfill)) {
      if (!uuid.test(id) || !issues.has(id)) fail('BROKEN_REFERENCE', 'Legacy GitHub backfill references a missing issue');
      // Only the observed legacy receipt contract is accepted. Unknown comment
      // receipt shapes need explicit support; they are never silently discarded.
      if (!exactKeys(entry, ['number', 'url', 'comments', 'syncedAt']) || !Number.isSafeInteger(entry.number) || entry.number < 1 || numbers.has(entry.number) || entry.url !== `https://github.com/stanley021039/BGA/issues/${entry.number}` || !record(entry.comments) || Object.keys(entry.comments).length || !timestamp(entry.syncedAt)) fail('INVALID_COMMUNITY', 'Legacy GitHub backfill receipt is invalid or unsupported');
      numbers.add(entry.number); backfillEntries++;
    }
    files.push({ logical: 'community/github-backfill.json', source: file });
  }
  // Omit the extension for old bundles without extra files, retaining their
  // authenticated summary shape exactly. Both extra formats remain raw bytes.
  return avatars.length || names.includes('github-backfill.json') ? { avatarFiles: avatars.length, githubBackfillEntries: backfillEntries } : undefined;
}
function validateData(p, { acknowledgeInterruptedMatches = false } = {}) {
  const database = validateDatabase(p.dbFile), files = [{ logical: 'db/afterhours.sqlite', source: p.dbFile }];
  const musicNames = listFlat(p.musicDir, n => /^[0-9a-f-]{36}\.(mp3|ogg|m4a)$/i.test(n), ['.afterhours-data-lock']);
  const expectedMusic = new Set();
  for (const track of database.music) {
    if (!uuid.test(track.id) || !['mp3', 'ogg', 'm4a'].includes(track.ext) || !Number.isSafeInteger(track.size) || track.size < 64 || track.size > MAX_BYTES) fail('INVALID_MUSIC', 'Invalid music metadata');
    const name = track.id + '.' + track.ext, file = path.join(p.musicDir, name); expectedMusic.add(name);
    if (!musicNames.includes(name) || fs.statSync(file).size !== track.size) fail('MISSING_MUSIC', 'Music file is missing or has an incorrect size');
    let type; try { type = audioType(fs.readFileSync(file)); } catch { fail('INVALID_MUSIC', 'Music file content is invalid'); }
    if (type.ext !== track.ext || type.mime !== track.mime) fail('INVALID_MUSIC', 'Music content does not match metadata');
  }
  // Orphans are preserved rather than silently discarding previously uploaded bytes.
  for (const name of musicNames) files.push({ logical: 'music/' + name, source: path.join(p.musicDir, name) });
  const communityNames = communityFiles(p.communityDir);
  let questionCount = 0, communityData;
  if (communityNames.includes('community.json')) {
    const file = path.join(p.communityDir, 'community.json'), data = communityData = readJson(file);
    if (!Array.isArray(data.issues) || !Array.isArray(data.questions)) fail('INVALID_COMMUNITY', 'Community collections are invalid');
    const ids = new Set();
    for (const issue of data.issues) {
      if (!issue || !uuid.test(issue.id) || ids.has(issue.id) || ['title','body','name','game','status','at'].some(k => typeof issue[k] !== 'string') || (issue.comments !== undefined && !Array.isArray(issue.comments))) fail('INVALID_COMMUNITY', 'Legacy issue data is invalid');
      ids.add(issue.id);
      for (const comment of issue.comments || []) if (!comment || !uuid.test(comment.id) || ['name','body','at'].some(k => typeof comment[k] !== 'string')) fail('INVALID_COMMUNITY', 'Legacy comment data is invalid');
    }
    for (const q of data.questions) { try { validateQuestion(q); } catch { fail('INVALID_COMMUNITY', 'A community question is invalid'); } }
    questionCount = data.questions.length; files.push({ logical: 'community/community.json', source: file });
  }
  if (!communityData && communityNames.length) fail('BROKEN_REFERENCE', 'Legacy community files require community.json metadata');
  const legacy = legacyCommunity(p.communityDir, communityNames, communityData, files);
  const historyNames = listFlat(p.historyDir, n => /^[0-9a-f-]{36}\.(jsonl|meta\.json)$/i.test(n), ['.lock', '.afterhours-data-lock']);
  const metas = new Map(), logs = new Set(), playing = [], interruptedStates = new Map();
  for (const name of historyNames.filter(n => n.endsWith('.meta.json'))) {
    const id = name.slice(0, -10), m = readJson(path.join(p.historyDir, name));
    if (!uuid.test(id) || m.id !== id || !['playing', 'finished', 'interrupted'].includes(m.status) || !Number.isSafeInteger(m.count) || m.count < 0) fail('INVALID_HISTORY', 'History metadata is invalid');
    metas.set(id, m); if (m.status === 'playing') playing.push(id);
  }
  for (const name of historyNames.filter(n => n.endsWith('.jsonl'))) {
    const id = name.slice(0, -6), file = path.join(p.historyDir, name);
    if (!uuid.test(id)) fail('INVALID_HISTORY', 'Invalid history filename');
    const rows = jsonlRows(file);
    try {
    const first = rows.next().value;
    if (!first || first.schema !== 1 || !['session', 'header'].includes(first.kind)) fail('INVALID_HISTORY', 'History header is invalid');
    if (first.kind === 'header') {
      if (!metas.has(id) || first.id !== id || typeof first.engine?.source !== 'string' || first.engine.sha256 !== sha(first.engine.source)) fail('INVALID_HISTORY', 'History engine hash or metadata is invalid');
    } else if (metas.has(id)) fail('INVALID_HISTORY', 'Session log unexpectedly has match metadata');
    // An intent without a durable result is a partially committed operation, not a valid backup.
    const pending = new Set(); let resultCount = 0, lastSeq = 0, lastState = first.initial;
    for (const row of rows) {
      if (row.kind === 'intent') { if (!Number.isSafeInteger(row.seq) || row.seq <= lastSeq || pending.size) fail('INVALID_HISTORY', 'Invalid history operation sequence'); pending.add(row.seq); lastSeq = row.seq; }
      else if (row.kind === 'result') { if (!pending.delete(row.seq)) fail('INVALID_HISTORY', 'History result is missing its intent'); resultCount++; lastState = row.after; }
      else if (row.kind !== 'interrupted') fail('INVALID_HISTORY', 'Unknown history row type');
    }
    if (pending.size) fail('INVALID_HISTORY', 'History contains an unfinished disk operation');
    if (first.kind === 'header' && resultCount !== metas.get(id).count) fail('INVALID_HISTORY', 'History result count does not match metadata');
    if (metas.get(id)?.status === 'playing') interruptedStates.set(id, lastState);
    logs.add(id);
    } finally { rows.return(); }
  }
  for (const id of metas.keys()) if (!logs.has(id)) fail('INVALID_HISTORY', 'History log is missing');
  if (playing.length && !acknowledgeInterruptedMatches) fail('UNFINISHED_MATCHES', 'Finish matches first or acknowledge that restore will mark them interrupted');
  for (const name of historyNames) files.push({ logical: 'history/' + name, source: path.join(p.historyDir, name) });
  const summary = { database: { schemaVersion: database.schemaVersion, sqliteVersion: database.sqliteVersion, tableCounts: database.tableCounts, blobDigests: database.blobDigests, accountsSha256: database.accountsSha256, ...(database.marketImagesSha256 === undefined ? {} : { marketImagesSha256: database.marketImagesSha256 }) },
    musicFiles: musicNames.length, orphanMusicFiles: musicNames.filter(n => !expectedMusic.has(n)).length, communityQuestions: questionCount,
    historyLogs: logs.size, historyMatches: metas.size, unfinishedMatches: playing.length };
  if (legacy) summary.legacyCommunity = legacy;
  return { files, summary, metas, interruptedStates, playing };
}
module.exports = { fail, uuid, sha, absolute, noLinks, readJson, validateDatabase, validateData, validBundleLogical };
