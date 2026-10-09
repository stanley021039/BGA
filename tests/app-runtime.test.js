'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app');
const {MarketAutomation}=require('../src/market/automation');
const {MarketImageStore}=require('../src/market/images');
const {HistoryStore}=require('../src/history/store');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-runtime-'));
 const config={host:'127.0.0.1',port:0,dbFile:path.join(root,'db.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),musicDir:path.join(root,'music'),externalSideEffectsEnabled:false};
 const apps=[];t.after(async()=>{for(const app of apps)await app.close().catch(()=>{});fs.rmSync(root,{recursive:true,force:true});});
 return {root,config,create:()=>{const app=createApp(config);apps.push(app);return app;}};
}
test('concurrent close callers wait for the same cleanup and data lock release',async t=>{
 const f=fixture(t),app=f.create();await app.listen();
 let release;const gate=new Promise(resolve=>{release=resolve;}),original=MarketAutomation.prototype.stop;
 t.mock.method(MarketAutomation.prototype,'stop',async function(){await gate;return original.call(this);});
 const first=app.close(),second=app.close();let finished=false;second.then(()=>{finished=true;});
 await new Promise(resolve=>setImmediate(resolve));
 try{assert.equal(finished,false,'second close must wait for pending cleanup');}finally{release();await Promise.all([first,second]);}
 assert.strictEqual(first,second);const next=f.create();await next.listen();
});
test('close racing listen does not start workers after shutdown and permits reopening data',async t=>{
 const f=fixture(t),app=f.create();let starts=0;
 const original=MarketAutomation.prototype.start;t.mock.method(MarketAutomation.prototype,'start',function(){starts++;return original.call(this);});
 const starting=app.listen(),closing=app.close();const outcome=await Promise.allSettled([starting,closing]);
 // Baseline cleanup also closes a leaked listener so characterization cannot leave a live socket.
 if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));
 assert.equal(outcome[0].status,'rejected');assert.equal(outcome[1].status,'fulfilled');assert.equal(starts,0);
 assert.equal(app.server.listening,false);const next=f.create();await next.listen();
});
test('a worker startup failure closes the listener, history and data locks',async t=>{
 const f=fixture(t),app=f.create();
 const mock=t.mock.method(MarketImageStore.prototype,'startThumbnails',()=>{throw Error('injected thumbnail startup failure');});
 await assert.rejects(app.listen(),/injected thumbnail startup failure/);
 try{assert.equal(app.server.listening,false);assert.equal(fs.existsSync(path.join(f.config.historyDir,'.lock')),false);}finally{await app.close();mock.mock.restore();}
 const next=f.create();await next.listen();
});
test('a failed stop still releases subsequent resources and all close callers see the failure',async t=>{
 const f=fixture(t),app=f.create();await app.listen();
 const original=MarketAutomation.prototype.stop;
 const mock=t.mock.method(MarketAutomation.prototype,'stop',async function(){await original.call(this);throw Error('injected stop failure');});
 const a=app.close(),b=app.close();const results=await Promise.allSettled([a,b]);
 // Do not leave the baseline server alive when characterizing the failure.
 if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));
 assert.ok(results.every(result=>result.status==='rejected'));assert.strictEqual(a,b);
 assert.equal(fs.existsSync(path.join(f.config.historyDir,'.lock')),false);mock.mock.restore();const next=f.create();await next.listen();
});
test('concurrent listen calls bind once and return the same startup promise',async t=>{
 const f=fixture(t),app=f.create();let starts=0;const original=MarketAutomation.prototype.start;
 t.mock.method(MarketAutomation.prototype,'start',function(){starts++;return original.call(this);});
 const a=app.listen(),b=app.listen();assert.strictEqual(a,b);const [one,two]=await Promise.all([a,b]);
 assert.deepEqual(one,two);assert.equal(starts,1);await app.close();await assert.rejects(app.listen(),/closed/);
});
test('listen bind failure releases data and history locks without explicit close',async t=>{
 const f=fixture(t),blocker=fixture(t).create(),address=await blocker.listen();f.config.port=address.port;
 const app=f.create();await assert.rejects(app.listen(),{code:'EADDRINUSE'});
 assert.equal(app.server.listening,false);assert.equal(fs.existsSync(path.join(f.config.historyDir,'.lock')),false);
 f.config.port=0;const next=f.create();await next.listen();
});
test('late initialization failure releases acquired database, history and data locks',async t=>{
 const f=fixture(t),http=require('node:http'),original=http.createServer;let fail=true;
 t.mock.method(http,'createServer',(...args)=>{if(fail)throw Error('late initialization failure');return original(...args);});
 let cleared=0;f.config.youtubeTitleResolver={clear(){cleared++;}};
 assert.throws(()=>f.create(),/late initialization failure/);assert.equal(cleared,1);
 assert.equal(fs.existsSync(path.join(f.config.historyDir,'.lock')),false);fail=false;const next=f.create();await next.listen();
});
test('history cleanup failure still closes the database and releases data locks',async t=>{
 const f=fixture(t),app=f.create();await app.listen();const original=HistoryStore.prototype.close;
 const mock=t.mock.method(HistoryStore.prototype,'close',function(){original.call(this);throw Error('injected history close failure');});
 await assert.rejects(app.close(),/injected history close failure/);mock.mock.restore();const next=f.create();await next.listen();
});
test('real draw and music SSE connections drain on close with no remaining app intervals',async t=>{
 const {appFixture}=require('./helpers/app-fixture.cjs'),{createAuth}=require('../src/auth');
 const live=new Set(),set=global.setInterval,clear=global.clearInterval;
 t.mock.method(global,'setInterval',(...args)=>{const timer=set(...args);live.add(timer);return timer;});
 t.mock.method(global,'clearInterval',timer=>{live.delete(timer);return clear(timer);});
 t.after(()=>{for(const timer of live)clear(timer);});
 const f=await appFixture(t,{seed:db=>createAuth(db).bootstrap('runtime_owner','runtime-test-password')});
 const login=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'runtime_owner',password:'runtime-test-password'})});
 assert.equal(login.status,200);const headers={Cookie:login.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'};
 const created=await fetch(f.base+'/api/create',{method:'POST',headers,body:JSON.stringify({type:'draw',name:'runtime draw'})});assert.equal(created.status,200);const {code}=await created.json();
 const readers=[];
 for(const route of ['/api/draw/events','/api/room-music/events']){
  const response=await fetch(f.base+route+'?code='+code,{headers});assert.equal(response.status,200);
  const reader=response.body.getReader();readers.push(reader);assert.equal((await reader.read()).done,false);
 }
 assert.equal(live.size,4,'two scheduler intervals and two SSE intervals; external automation is disabled');
 await f.app.close();assert.equal(live.size,0);assert.equal(f.app.server.listening,false);
 for(const reader of readers)assert.equal((await reader.read()).done,true);
});
test('close waits for an in-flight request before clearing its room state and database',async t=>{
 const {appFixture}=require('./helpers/app-fixture.cjs'),{createAuth}=require('../src/auth'),http=require('node:http');
 const f=await appFixture(t,{seed:db=>createAuth(db).bootstrap('drain_owner','runtime-test-password')});
 const login=await fetch(f.base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'drain_owner',password:'runtime-test-password'})});
 const cookie=login.headers.get('set-cookie').split(';')[0],body=JSON.stringify({type:'poker',name:'in-flight room'});
 let accepted;const requestAccepted=new Promise(resolve=>{accepted=resolve;});f.app.server.once('request',accepted);
 const response=new Promise((resolve,reject)=>{
  const request=http.request(f.base+'/api/create',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',chunk=>{data+=chunk;});res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));});
  request.on('error',reject);request.write(body.slice(0,5));requestAccepted.then(async()=>{
   const closing=f.app.close();let finished=false;closing.then(()=>{finished=true;});
   await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);request.end(body.slice(5));await closing;
  }).catch(reject);
 });
 const result=await response;assert.equal(result.status,200);assert.match(result.body.code,/^[A-F0-9]{6}$/);await f.app.close();
});
