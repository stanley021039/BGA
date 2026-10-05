const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { createTransferUi } = require('../src/data/ui');
const { run, FORMAT } = require('../src/data/transfer');
const { openDatabase } = require('../src/db');
const { createAuth } = require('../src/auth');
const { createApp } = require('../src/app');
const { settings } = require('../src/config');

async function localUi(t, options = {}) {
  const ui = createTransferUi({ port: 0, ...options }), { url } = await ui.listen();
  t.after(() => ui.close());
  const html = await (await fetch(url)).text(), token = html.match(/name="transfer-token" content="([0-9a-f]{64})"/)[1];
  const headers = { 'X-Transfer-Token': token, Origin: url };
  const request = (method, route, body, extra = {}) => fetch(url + route, { method, headers: { ...headers, ...(method === 'PUT' ? { 'Content-Type': 'application/octet-stream' } : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: method === 'PUT' ? body : JSON.stringify(body) }) });
  const start = async () => { const response = await request('POST','/api/import-upload/start',{}); assert.equal(response.status,200); return (await response.json()).result.uploadId; };
  const file = (id, name, bytes, extra) => request('PUT',`/api/import-upload/${id}/file`,bytes,{ 'X-Import-Path': name, ...extra });
  const key = (id, bytes) => request('PUT',`/api/import-upload/${id}/key`,bytes);
  const finish = id => request('POST',`/api/import-upload/${id}/finish`,{});
  const remove = id => request('DELETE',`/api/import-upload/${id}`);
  const state = async () => (await (await fetch(url+'/api/state',{headers})).json()).result;
  return { ui, url, headers, request, start, file, key, finish, remove, state };
}
async function bundleFixture(t) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent,'afterhours-upload-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)),parent); assert.ok(path.basename(root).startsWith('afterhours-upload-test-'));
    fs.rmSync(root,{recursive:true,force:true,maxRetries:5});
  });
  const source = { envId: 'upload-fixture', dbFile:path.join(root,'source','db','app.sqlite'),historyDir:path.join(root,'source','history'),communityDir:path.join(root,'source','community'),musicDir:path.join(root,'source','music') };
  for (const dir of [source.historyDir,source.communityDir,source.musicDir]) fs.mkdirSync(dir,{recursive:true});
  const db = openDatabase(source.dbFile), password = 'synthetic-upload-password', userId = await createAuth(db).bootstrap('upload_admin',password); db.close();
  const keyFile = path.join(root,'private','backup.key'), bundleDir = path.join(root,'backup');
  await run({action:'keygen',keyFile});
  const exported = await run({action:'export',sourceStopped:true,source,keyFile,outputDir:bundleDir});
  const manifestBytes = fs.readFileSync(path.join(bundleDir,'manifest.json')), manifest = JSON.parse(manifestBytes);
  return {root,source,password,userId,keyFile,bundleDir,exported,manifest,manifestBytes};
}
async function uploadBundle(ui, fixture, keyBytes = fs.readFileSync(fixture.keyFile)) {
  const id = await ui.start();
  assert.equal((await ui.file(id,'manifest.json',fixture.manifestBytes)).status,200);
  for (const entry of fixture.manifest.files) assert.equal((await ui.file(id,entry.payload,fs.readFileSync(path.join(fixture.bundleDir,entry.payload)))).status,200);
  assert.equal((await ui.key(id,keyBytes)).status,200);
  return id;
}
function smallManifest(bytes = 4) {
  return { format:FORMAT,bundleId:crypto.randomUUID(),totalBytes:bytes,files:[{logical:'db/afterhours.sqlite',payload:'payload/000001.bin',bytes}] };
}
async function expectError(response, code, status = 400) {
  assert.equal(response.status,status); const body = await response.json(); assert.equal(body.ok,false); assert.equal(body.error.code,code); return body;
}
function streamingPut(ui, id, name) {
  let req;
  const response = new Promise((resolve,reject) => {
    req = http.request(ui.url+`/api/import-upload/${id}/file`,{method:'PUT',headers:{...ui.headers,'Content-Type':'application/octet-stream','X-Import-Path':name}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error',reject);
  });
  return {req,response};
}
async function untilState(ui, predicate) {
  for (let attempt=0;attempt<50;attempt++) { const state = await ui.state(); if (predicate(state)) return state; await new Promise(resolve=>setTimeout(resolve,5)); }
  assert.fail('The UI did not reach the expected state');
}

test('a real browser-folder upload verifies GCM, survives refresh, restores original accounts and cleans only its temporary files', async t => {
  const fixture = await bundleFixture(t), ui = await localUi(t), id = await uploadBundle(ui,fixture);
  const finished = await ui.finish(id); assert.equal(finished.status,200);
  const uploaded = (await finished.json()).result;
  assert.equal(uploaded.verification.bundleId,fixture.exported.bundleId); assert.equal(uploaded.verification.summary.database.tableCounts.users,1);
  assert.equal(uploaded.files,fixture.manifest.files.length+1); assert.equal(uploaded.bytes,fixture.manifestBytes.length+fixture.manifest.totalBytes);
  assert.equal(path.dirname(uploaded.bundleDir),path.dirname(uploaded.keyFile));
  assert.equal(fs.readFileSync(uploaded.keyFile).length,32);
  if (process.platform !== 'win32') { assert.equal(fs.statSync(path.dirname(uploaded.bundleDir)).mode&0o777,0o700); assert.equal(fs.statSync(uploaded.keyFile).mode&0o777,0o600); }
  const state = await ui.state(); assert.equal(state.lastResponse,null); assert.equal(state.uploads.length,1); assert.equal(state.uploads[0].status,'verified'); assert.deepEqual(state.uploads[0].verification,uploaded.verification);
  assert.equal(JSON.stringify(state).includes(fs.readFileSync(fixture.keyFile).toString('hex')),false);
  assert.deepEqual((await (await ui.finish(id)).json()).result,uploaded);
  await expectError(await ui.file(id,'payload/000001.bin',Buffer.alloc(1)),'UPLOAD_CONFLICT',409);
  const restore = {action:'restore',bundleDir:uploaded.bundleDir,keyFile:uploaded.keyFile,destinationDir:path.join(fixture.root,'new-generation')};
  const dry = await (await ui.request('POST','/api/run',{request:restore})).json(); assert.equal(dry.result.dryRun,true); assert.equal(fs.existsSync(restore.destinationDir),false);
  await expectError(await ui.request('POST','/api/run',{request:{...restore,destinationDir:path.dirname(fixture.source.dbFile),apply:true},confirmations:{targetStopped:true}}),'DESTINATION_EXISTS');
  for (const request of [
    {...restore,destinationDir:path.join(path.dirname(uploaded.bundleDir),'must-survive')},
    {action:'keygen',keyFile:path.join(path.dirname(uploaded.bundleDir),'permanent.key')},
    {action:'export',source:fixture.source,sourceStopped:true,keyFile:fixture.keyFile,outputDir:path.join(path.dirname(uploaded.bundleDir),'permanent-backup')},
  ]) await expectError(await ui.request('POST','/api/run',{request,confirmations:{sourceStopped:true}}),'INVALID_REQUEST');
  const applied = await (await ui.request('POST','/api/run',{request:{...restore,apply:true},confirmations:{targetStopped:true}})).json(); assert.equal(applied.ok,true);
  const app = createApp({...settings(applied.result.config),port:0,host:'127.0.0.1',githubClient:{configured:false}});
  try {
    const {port}=await app.listen(), response=await fetch('http://127.0.0.1:'+port+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'upload_admin',password:fixture.password})});
    assert.equal(response.status,200); assert.equal((await response.json()).id,fixture.userId);
  } finally { await app.close(); }
  assert.equal((await ui.remove(id)).status,200); assert.equal(fs.existsSync(uploaded.bundleDir),false); assert.equal(fs.existsSync(uploaded.keyFile),false);
  assert.equal(fs.existsSync(applied.result.config.DB_FILE),true); assert.equal(fs.existsSync(fixture.source.dbFile),true); assert.equal((await ui.state()).uploads.length,0);
  await expectError(await ui.finish(id),'UPLOAD_NOT_FOUND',404);
});

test('real uploaded bundles reject a wrong key and modified ciphertext without exposing either key or publishing a generation', async t => {
  const fixture = await bundleFixture(t), ui = await localUi(t), wrong = crypto.randomBytes(32), id = await uploadBundle(ui,fixture,wrong);
  const error = await expectError(await ui.finish(id),'AUTHENTICATION_FAILED'); assert.equal(JSON.stringify(error).includes(wrong.toString('hex')),false);
  const failed = (await ui.state()).uploads[0]; assert.equal(failed.status,'failed'); assert.equal(failed.keyReceived,true); assert.equal(failed.keyFile,undefined); assert.equal(failed.bundleDir,undefined);
  assert.equal((await ui.remove(id)).status,200);
  const altered = await ui.start(); assert.equal((await ui.file(altered,'manifest.json',fixture.manifestBytes)).status,200);
  for (const entry of fixture.manifest.files) { const bytes = fs.readFileSync(path.join(fixture.bundleDir,entry.payload)); if (entry===fixture.manifest.files[0]) bytes[0]^=1; assert.equal((await ui.file(altered,entry.payload,bytes)).status,200); }
  assert.equal((await ui.key(altered,fs.readFileSync(fixture.keyFile))).status,200);
  await expectError(await ui.finish(altered),'CORRUPT_BUNDLE'); assert.equal((await ui.state()).uploads[0].status,'failed');
});

test('upload endpoints preserve Host, Origin and token checks and never accept client-selected staging paths', async t => {
  let executions = 0; const ui = await localUi(t,{executor:async()=>{executions++;return {};}});
  const wrongHost = await new Promise((resolve,reject)=>{
    const req=http.request(ui.url+'/api/import-upload/start',{method:'POST',headers:{...ui.headers,Host:'evil.example','Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end('{}');
  });
  assert.equal(wrongHost,403);
  for (const headers of [{Origin:'https://evil.example'},{Origin:''},{'X-Transfer-Token':'0'.repeat(64)}]) await expectError(await ui.request('POST','/api/import-upload/start',{},headers),'FORBIDDEN',403);
  await expectError(await ui.request('POST','/api/import-upload/start',{directory:'C:/client-path'}),'INVALID_REQUEST');
  await expectError(await ui.request('POST','/api/import-upload/start',{}, {'Content-Type':'text/plain'}),'INVALID_REQUEST');
  const id = await ui.start();
  for (const [method,route,body] of [['PUT',`/${id}/key`,Buffer.alloc(32)],['POST',`/${id}/finish`,{}],['DELETE',`/${id}`,undefined]]) {
    await expectError(await ui.request(method,'/api/import-upload'+route,body,{Origin:''}),'FORBIDDEN',403);
    await expectError(await ui.request(method,'/api/import-upload'+route,body,{'X-Transfer-Token':'0'.repeat(64)}),'FORBIDDEN',403);
  }
  await expectError(await ui.file(id,'manifest.json',Buffer.from('{}'),{Origin:'https://evil.example'}),'FORBIDDEN',403);
  for (const name of ['../manifest.json','/manifest.json','C:/manifest.json','payload\\000001.bin','payload/../backup.key','payload/000001.bin/extra']) await expectError(await ui.file(id,name,Buffer.alloc(1)),'INVALID_UPLOAD');
  assert.equal((await ui.state()).uploads[0].files,0); assert.equal(executions,0);
});

test('the manifest determines exact file names and sizes, blocks duplicates and requires all payloads plus an exact key', async t => {
  let executions=0; const ui = await localUi(t,{executor:async()=>{executions++;return {action:'verify'};}}), id = await ui.start();
  await expectError(await ui.file(id,'payload/000001.bin',Buffer.from('abcd')),'INVALID_UPLOAD');
  await expectError(await ui.finish(id),'UPLOAD_INCOMPLETE');
  assert.equal((await ui.file(id,'manifest.json',Buffer.from(JSON.stringify(smallManifest())))).status,200);
  await expectError(await ui.file(id,'manifest.json',Buffer.from('{}')),'UPLOAD_CONFLICT',409);
  await expectError(await ui.file(id,'payload/000002.bin',Buffer.from('abcd')),'INVALID_UPLOAD');
  await expectError(await ui.finish(id),'UPLOAD_INCOMPLETE');
  assert.equal((await ui.file(id,'payload/000001.bin',Buffer.from('abcd'))).status,200);
  await expectError(await ui.file(id,'payload/000001.bin',Buffer.from('zzzz')),'UPLOAD_CONFLICT',409);
  await expectError(await ui.finish(id),'UPLOAD_INCOMPLETE');
  assert.equal((await ui.key(id,Buffer.alloc(32))).status,200);
  await expectError(await ui.key(id,Buffer.alloc(32)),'UPLOAD_CONFLICT',409);
  assert.equal((await ui.finish(id)).status,200); assert.equal(executions,1);
  for (const size of [31,33]) { const other = await ui.start(); await expectError(await ui.key(other,Buffer.alloc(size)),'UPLOAD_LIMIT',413); assert.equal((await ui.remove(other)).status,200); }
});

test('invalid and over-limit manifests are rejected before payloads, with discoverable failed uploads for cleanup', async t => {
  const ui = await localUi(t,{uploadLimits:{maxBytes:16,maxFiles:1,maxManifestBytes:1024,maxUploads:1}});
  for (const manifest of [
    '{broken',
    JSON.stringify({...smallManifest(),files:[{logical:'../outside',payload:'payload/000001.bin',bytes:4}]}),
    JSON.stringify({...smallManifest(),files:[{logical:'db/afterhours.sqlite',payload:'../outside.bin',bytes:4}]}),
    JSON.stringify({...smallManifest(),totalBytes:3}),
    JSON.stringify({...smallManifest(),format:'another-product'}),
  ]) {
    const id = await ui.start(); await expectError(await ui.file(id,'manifest.json',Buffer.from(manifest)),'INVALID_UPLOAD');
    const state = await ui.state(); assert.equal(state.uploads[0].uploadId,id); assert.equal(state.uploads[0].status,'failed'); assert.equal((await ui.remove(id)).status,200);
  }
  for (const manifest of [JSON.stringify(smallManifest(17)),JSON.stringify({...smallManifest(),files:[...smallManifest().files,...smallManifest().files]}),'x'.repeat(1025)]) {
    const id = await ui.start(); await expectError(await ui.file(id,'manifest.json',Buffer.from(manifest)),'UPLOAD_LIMIT',413); assert.equal((await ui.remove(id)).status,200);
  }
  const id = await ui.start(); await expectError(await ui.request('POST','/api/import-upload/start',{}),'UPLOAD_LIMIT',413);
  const refreshed = await ui.state(); assert.equal(refreshed.uploads[0].uploadId,id); assert.equal((await ui.remove(refreshed.uploads[0].uploadId)).status,200); assert.equal((await ui.state()).uploads.length,0);
});

test('streamed payload byte limits do not rely on Content-Length and remove partial files', async t => {
  const ui = await localUi(t);
  for (const [tail,status,code] of [['cde',413,'UPLOAD_LIMIT'],['c',400,'UPLOAD_INCOMPLETE']]) {
    const id = await ui.start(); assert.equal((await ui.file(id,'manifest.json',Buffer.from(JSON.stringify(smallManifest())))).status,200);
    const {req,response} = streamingPut(ui,id,'payload/000001.bin'); req.write('ab'); req.end(tail);
    const result = await response; assert.equal(result.status,status); assert.equal(result.body.error.code,code);
    const state = await ui.state(); assert.equal(state.uploads[0].status,'failed'); assert.equal(state.uploads[0].files,1);
    assert.equal((await ui.remove(id)).status,200);
  }
});

test('temporary byte quotas cover all uploads and deleting a failed batch releases its space', async t => {
  const ui = await localUi(t,{uploadLimits:{maxBytes:8,maxFiles:1,maxManifestBytes:512,maxUploads:2},executor:async()=>({action:'verify'})});
  const manifest = {...smallManifest(8),padding:''};manifest.padding='x'.repeat(512-Buffer.byteLength(JSON.stringify(manifest)));
  const bytes=Buffer.from(JSON.stringify(manifest));assert.equal(bytes.length,512);
  const first=await ui.start();assert.equal((await ui.file(first,'manifest.json',bytes)).status,200);assert.equal((await ui.file(first,'payload/000001.bin',Buffer.alloc(8))).status,200);assert.equal((await ui.key(first,Buffer.alloc(32))).status,200);
  const ready=(await (await ui.finish(first)).json()).result;
  const second=await ui.start();assert.equal((await ui.file(second,'manifest.json',bytes)).status,200);assert.equal((await ui.file(second,'payload/000001.bin',Buffer.alloc(8))).status,200);
  await expectError(await ui.key(second,Buffer.alloc(32)),'UPLOAD_LIMIT',413);
  assert.equal((await ui.remove(second)).status,200);assert.equal(fs.existsSync(ready.keyFile),true);
  const replacement=await ui.start();assert.equal((await ui.file(replacement,'manifest.json',bytes)).status,200);
  assert.equal((await ui.remove(first)).status,200);
  assert.equal((await ui.file(replacement,'payload/000001.bin',Buffer.alloc(8))).status,200);assert.equal((await ui.key(replacement,Buffer.alloc(32))).status,200);assert.equal((await ui.finish(replacement)).status,200);
});

test('concurrent uploads and transfer jobs cannot overwrite or delete files while a streamed upload is active', async t => {
  let executions=0; const ui = await localUi(t,{executor:async()=>{executions++;return {action:'verify'};}}), id = await ui.start();
  assert.equal((await ui.file(id,'manifest.json',Buffer.from(JSON.stringify(smallManifest())))).status,200);
  const {req,response} = streamingPut(ui,id,'payload/000001.bin'); req.write('ab');
  await untilState(ui,state=>state.busy);
  try {
    await expectError(await ui.file(id,'payload/000001.bin',Buffer.from('zzzz')),'BUSY',409);
    await expectError(await ui.remove(id),'BUSY',409);
    await expectError(await ui.finish(id),'BUSY',409);
    await expectError(await ui.request('POST','/api/run',{request:{action:'verify'}}),'BUSY',409);
    assert.equal(executions,0);
  } finally { req.end('cd'); }
  assert.equal((await response).status,200);
  assert.equal((await ui.key(id,Buffer.alloc(32))).status,200); const uploaded = (await (await ui.finish(id)).json()).result;
  assert.equal(fs.readFileSync(path.join(uploaded.bundleDir,'payload/000001.bin'),'utf8'),'abcd');
});

test('close waits for verification before deleting temporary bundles and keys', async t => {
  let release, observed, verificationStarted;
  const verifying = new Promise(resolve=>{verificationStarted=resolve;});
  const pending = new Promise(resolve=>{release=resolve;});
  const ui = await localUi(t,{executor:async request=>{observed=request;verificationStarted();await pending;return {action:request.action};}}), id = await ui.start();
  assert.equal((await ui.file(id,'manifest.json',Buffer.from(JSON.stringify(smallManifest())))).status,200);
  assert.equal((await ui.file(id,'payload/000001.bin',Buffer.from('abcd'))).status,200); assert.equal((await ui.key(id,Buffer.alloc(32))).status,200);
  const finishing=ui.finish(id); let closing;
  try {
    await verifying;
    const current=await ui.state(); assert.equal(current.busy,true); assert.equal(current.uploads[0].status,'verifying');
    await expectError(await ui.remove(id),'BUSY',409);
    let closed=false; closing=ui.ui.close().then(()=>{closed=true;});
    await new Promise(resolve=>setImmediate(resolve)); assert.equal(closed,false); assert.equal(fs.existsSync(observed.bundleDir),true); assert.equal(fs.existsSync(observed.keyFile),true);
  }
  finally { release(); }
  assert.equal((await finishing).status,200); await closing;
  assert.equal(fs.existsSync(observed.bundleDir),false); assert.equal(fs.existsSync(observed.keyFile),false);
});

test('uploaded files cannot be deleted during a restore, and close waits for the restore result', async t => {
  let release, started;
  const active = new Promise(resolve=>{started=resolve;}), pending = new Promise(resolve=>{release=resolve;});
  const ui = await localUi(t,{executor:async request=>{
    if (request.action==='restore') { started(); await pending; }
    return {action:request.action};
  }}), id = await ui.start();
  assert.equal((await ui.file(id,'manifest.json',Buffer.from(JSON.stringify(smallManifest())))).status,200);
  assert.equal((await ui.file(id,'payload/000001.bin',Buffer.from('abcd'))).status,200); assert.equal((await ui.key(id,Buffer.alloc(32))).status,200);
  const uploaded = (await (await ui.finish(id)).json()).result;
  const restoring = ui.request('POST','/api/run',{request:{action:'restore',bundleDir:uploaded.bundleDir,keyFile:uploaded.keyFile,destinationDir:path.join(os.tmpdir(),'synthetic-never-created'),apply:true},confirmations:{targetStopped:true}});
  let closing;
  try {
    await active; await expectError(await ui.remove(id),'BUSY',409);
    let closed=false;closing=ui.ui.close().then(()=>{closed=true;});
    await new Promise(resolve=>setImmediate(resolve));assert.equal(closed,false);assert.equal(fs.existsSync(uploaded.keyFile),true);
  } finally { release(); }
  const response=await restoring;assert.equal(response.status,200);assert.equal((await response.json()).result.action,'restore');
  await closing; assert.equal(fs.existsSync(uploaded.bundleDir),false);assert.equal(fs.existsSync(uploaded.keyFile),false);
});
