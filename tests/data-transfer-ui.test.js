const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { createTransferUi } = require('../src/data/ui');
const { openDatabase } = require('../src/db');
const { createAuth } = require('../src/auth');
const { createApp } = require('../src/app');
const { settings } = require('../src/config');

async function localUi(t, options = {}) {
  const ui = createTransferUi({ port: 0, ...options }), { url } = await ui.listen();
  t.after(() => ui.close());
  const page = await fetch(url), html = await page.text(), token = html.match(/name="transfer-token" content="([0-9a-f]{64})"/)[1];
  const post = (request, confirmations = {}, extra = {}) => fetch(url + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Transfer-Token': token, Origin: url, ...extra }, body: JSON.stringify({ request, confirmations }) });
  const state = () => fetch(url + '/api/state', { headers: { 'X-Transfer-Token': token } });
  return { ui, url, token, page, html, post, state };
}

test('local management server binds only loopback and fences Host, Origin, token and non-JSON requests', async t => {
  let calls = 0; const f = await localUi(t, { executor: async () => { calls++; return {}; } });
  assert.equal(f.ui.server.address().address, '127.0.0.1');
  assert.throws(() => createTransferUi({ host: '0.0.0.0' }));
  assert.throws(() => createTransferUi({ host: '::' }));
  assert.match(f.page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(f.page.headers.get('cache-control'), 'no-store');
  const wrongHost = await new Promise((resolve,reject)=>{const req=http.get(f.url,{headers:{Host:'evil.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});
  assert.equal(wrongHost, 403);
  assert.equal((await fetch(f.url, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(f.url + '/api/state')).status, 403);
  assert.equal((await f.post({ action: 'keygen' }, {}, { 'X-Transfer-Token': '0'.repeat(64) })).status, 403);
  assert.equal((await f.post({ action: 'keygen' }, {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.post({ action: 'keygen' }, {}, { Origin: '' })).status, 403);
  assert.equal((await f.post({ action: 'keygen' }, {}, { 'Content-Type': 'text/plain' })).status, 400);
  const oversized = await fetch(f.url + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: f.url, 'X-Transfer-Token': f.token }, body: JSON.stringify({ filler: 'x'.repeat(70000) }) });
  assert.equal(oversized.status, 400); assert.equal((await oversized.json()).error.code, 'INVALID_REQUEST');
  assert.equal(calls, 0);
  const cli = spawnSync(process.execPath, [path.join(__dirname, '../tools/server-data-ui.cjs'), '--host', '0.0.0.0'], { encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.equal(cli.stdout, '');
});

test('UI requires explicit stopped-writer acknowledgements, serializes jobs and preserves state after a refresh', async t => {
  let finish, started, executions = 0;
  const hasStarted = new Promise(resolve => { started = resolve; });
  const pending = new Promise(resolve => { finish = resolve; });
  const f = await localUi(t, { executor: async request => { executions++; started(); return await pending; } });
  t.after(() => finish({ action: 'keygen' }));
  for (const action of ['inspect', 'export']) {
    const response = await f.post({ action, sourceStopped: true }); assert.equal(response.status, 400); assert.equal((await response.json()).error.code, 'PRECONDITION_REQUIRED');
  }
  const restore = await f.post({ action: 'restore', apply: true }); assert.equal(restore.status, 400); assert.equal((await restore.json()).error.code, 'PRECONDITION_REQUIRED');
  const first = f.post({ action: 'keygen' }); await hasStarted;
  try {
    const busy = await (await f.state()).json(); assert.equal(busy.result.busy, true); assert.equal(busy.result.action, 'keygen');
    const second = await f.post({ action: 'verify' }); assert.equal(second.status, 409); assert.equal((await second.json()).error.code, 'BUSY'); assert.equal(executions, 1);
  } finally { finish({ action: 'keygen', keyFile: '/private/key', fingerprint: 'fingerprint' }); }
  const output = await (await first).json(); assert.equal(output.ok, true);
  const finished = await (await f.state()).json(); assert.equal(finished.result.busy, false); assert.deepEqual(finished.result.lastResponse, output);
});

test('UI output redacts unexpected executor failures rather than exposing stack or credentials', async t => {
  const f = await localUi(t, { executor: async () => { throw Error('private-password-hash-or-token'); } });
  const response = await f.post({ action: 'verify' }), text = await response.text();
  assert.equal(response.status, 400); assert.equal(JSON.parse(text).error.code, 'TRANSFER_FAILED'); assert.equal(text.includes('private-password'), false);
  const state = await (await f.state()).text(); assert.equal(state.includes('private-password'), false);
});

test('management HTTP workflow reuses full encrypted transfer, defaults to dry-run and refuses live source data', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afterhours-data-ui-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const source = { envId: 'ui-test', dbFile: path.join(root,'old','app.sqlite'), historyDir:path.join(root,'old','history'), communityDir:path.join(root,'old','community'), musicDir:path.join(root,'old','music') };
  for (const dir of [source.historyDir,source.communityDir,source.musicDir]) fs.mkdirSync(dir,{recursive:true});
  const db = openDatabase(source.dbFile), password = 'synthetic-ui-password', id = await createAuth(db).bootstrap('ui_admin',password); db.close();
  const f = await localUi(t), keyFile = path.join(root,'private','backup.key'), bundleDir = path.join(root,'bundle'), destinationDir = path.join(root,'new-generation');
  assert.equal((await (await f.post({action:'keygen',keyFile})).json()).ok,true);
  const app = createApp({...source,port:0,host:'127.0.0.1'});
  try { const rejected = await (await f.post({action:'export',source,sourceStopped:true,keyFile,outputDir:bundleDir},{sourceStopped:true})).json(); assert.equal(rejected.error.code,'DATA_IN_USE'); assert.equal(fs.existsSync(bundleDir),false); }
  finally { await app.close(); }
  const inspected = await (await f.post({action:'inspect',source,sourceStopped:true},{sourceStopped:true})).json(); assert.equal(inspected.result.database.tableCounts.users,1);
  const exported = await (await f.post({action:'export',source,sourceStopped:true,keyFile,outputDir:bundleDir},{sourceStopped:true})).json(); assert.equal(exported.ok,true);
  const verified = await (await f.post({action:'verify',bundleDir,keyFile})).json(); assert.equal(verified.result.bundleId,exported.result.bundleId);
  const request = {action:'restore',bundleDir,keyFile,destinationDir};
  const dry = await (await f.post(request)).json(); assert.equal(dry.result.dryRun,true); assert.equal(fs.existsSync(destinationDir),false);
  const restored = await (await f.post({...request,apply:true},{targetStopped:true})).json(); assert.equal(restored.ok,true); assert.equal(restored.result.config.EXTERNAL_SIDE_EFFECTS_ENABLED,'false');
  const target = createApp({...settings(restored.result.config),port:0,host:'127.0.0.1'});
  try {
    const {port}=await target.listen(), response=await fetch('http://127.0.0.1:'+port+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ui_admin',password})});
    assert.equal(response.status,200); assert.equal((await response.json()).id,id);
  } finally { await target.close(); }
  const repeat = await (await f.post({...request,apply:true},{targetStopped:true})).json(); assert.equal(repeat.error.code,'DESTINATION_EXISTS');
});
