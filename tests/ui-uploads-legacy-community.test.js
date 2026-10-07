const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createTransferUi } = require('../src/data/ui');
const { run, FORMAT } = require('../src/data/transfer');
const { openDatabase } = require('../src/db');

async function uiFixture(t) {
  const ui = createTransferUi({ port: 0 }), { url } = await ui.listen(); t.after(() => ui.close());
  const html = await (await fetch(url)).text(), token = html.match(/name="transfer-token" content="([0-9a-f]{64})"/)[1];
  const headers = { 'X-Transfer-Token': token, Origin: url };
  const request = (method, route, body, extra = {}) => fetch(url + route, { method, headers: { ...headers, 'Content-Type': method === 'PUT' ? 'application/octet-stream' : 'application/json', ...extra }, ...(body === undefined ? {} : { body: method === 'PUT' ? body : JSON.stringify(body) }) });
  const start = async () => { const response = await request('POST', '/api/import-upload/start', {}); assert.equal(response.status, 200); return (await response.json()).result.uploadId; };
  const file = (id, name, bytes) => request('PUT', `/api/import-upload/${id}/file`, bytes, { 'X-Import-Path': name });
  return { request, start, file };
}
async function bundleFixture(t) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'afterhours-ui-legacy-community-'));
  t.after(() => { assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('afterhours-ui-legacy-community-')); fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }); });
  const source = { envId: 'ui-legacy-test', dbFile: path.join(root, 'source', 'db', 'app.sqlite'), historyDir: path.join(root, 'source', 'history'), communityDir: path.join(root, 'source', 'community'), musicDir: path.join(root, 'source', 'music') };
  for (const dir of [source.historyDir, source.communityDir, source.musicDir]) fs.mkdirSync(dir, { recursive: true });
  const db = openDatabase(source.dbFile), userId = crypto.randomUUID();
  try { db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,disabled,created_at) VALUES(?,?,?,?,?,?,?)').run(userId, 'legacy_ui', '舊站玩家', 'scrypt:' + 'a'.repeat(32) + ':' + 'b'.repeat(128), 'admin', 0, '2026-10-01T11:11:03.489Z'); } finally { db.close(); }
  const png = fs.readFileSync(path.join(__dirname, '../public/assets/characters/traveler-neutral.png')), avatarId = crypto.randomUUID(), at = '2026-10-01T11:11:03.489Z';
  const avatarDir = path.join(source.communityDir, 'avatars'); fs.mkdirSync(avatarDir); fs.writeFileSync(path.join(avatarDir, avatarId + '.png'), png);
  const communityBytes = Buffer.from(JSON.stringify({ issues: [], questions: [], avatars: [{ id: avatarId, name: '舊頭像', url: '/uploads/avatars/' + avatarId + '.png', at }] }, null, 2) + '\n');
  fs.writeFileSync(path.join(source.communityDir, 'community.json'), communityBytes); fs.writeFileSync(path.join(source.communityDir, 'github-backfill.json'), '{}\n');
  const keyFile = path.join(root, 'backup.key'), bundleDir = path.join(root, 'bundle'); await run({ action: 'keygen', keyFile });
  const exported = await run({ action: 'export', sourceStopped: true, source, keyFile, outputDir: bundleDir }), manifest = JSON.parse(fs.readFileSync(path.join(bundleDir, 'manifest.json')));
  return { root, keyFile, bundleDir, manifest, exported, avatarId, png, communityBytes };
}

test('manager HTTP folder upload accepts the same typed legacy extras as CLI and restores their exact bytes', async t => {
  const f = await bundleFixture(t), ui = await uiFixture(t), id = await ui.start();
  assert.equal((await ui.file(id, 'manifest.json', fs.readFileSync(path.join(f.bundleDir, 'manifest.json')))).status, 200);
  for (const entry of f.manifest.files) assert.equal((await ui.file(id, entry.payload, fs.readFileSync(path.join(f.bundleDir, entry.payload)))).status, 200);
  assert.equal((await ui.request('PUT', `/api/import-upload/${id}/key`, fs.readFileSync(f.keyFile))).status, 200);
  const response = await ui.request('POST', `/api/import-upload/${id}/finish`, {}); assert.equal(response.status, 200);
  const uploaded = (await response.json()).result; assert.equal(uploaded.verification.bundleId, f.exported.bundleId);
  assert.deepEqual(uploaded.verification.summary.legacyCommunity, { avatarFiles: 1, githubBackfillEntries: 0 });
  const destinationDir = path.join(f.root, 'restored'), request = { action: 'restore', bundleDir: uploaded.bundleDir, keyFile: uploaded.keyFile, destinationDir, expectedBundleId: f.exported.bundleId, apply: true };
  const restored = await ui.request('POST', '/api/run', { request, confirmations: { targetStopped: true } }); assert.equal(restored.status, 200);
  const result = (await restored.json()).result; assert.equal(result.config.EXTERNAL_SIDE_EFFECTS_ENABLED, 'false');
  assert.deepEqual(fs.readFileSync(path.join(destinationDir, 'community', 'community.json')), f.communityBytes);
  assert.deepEqual(fs.readFileSync(path.join(destinationDir, 'community', 'avatars', f.avatarId + '.png')), f.png);
  assert.deepEqual(fs.readFileSync(path.join(destinationDir, 'community', 'github-backfill.json')), Buffer.from('{}\n'));
});

for (const logical of ['community/avatars/../escape.png', 'community/avatars/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png', 'community/avatars/00000000-0000-0000-0000-000000000000.svg', 'community/avatars/nested/00000000-0000-0000-0000-000000000000.png', 'community/github-backfill.json/extra', 'community/unknown.json']) test('manager upload rejects unknown or unsafe legacy logical path ' + logical, async t => {
  const ui = await uiFixture(t), id = await ui.start();
  const manifest = { format: FORMAT, bundleId: crypto.randomUUID(), totalBytes: 2, files: [{ logical: 'db/afterhours.sqlite', payload: 'payload/000001.bin', bytes: 1 }, { logical, payload: 'payload/000002.bin', bytes: 1 }] };
  const response = await ui.file(id, 'manifest.json', Buffer.from(JSON.stringify(manifest))); assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_UPLOAD');
});
