'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuth}=require('../src/auth');
const {appFixture}=require('./helpers/app-fixture.cjs');

async function fixture(t){
 const {base}=await appFixture(t,{seed:db=>createAuth(db).bootstrap('lobby_owner','test-password-123')});
 async function request(route,{method='GET',cookie,body,raw,headers={}}={}){
  const response=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{}),...headers},...(method==='POST'?{body:raw??JSON.stringify(body??{})}:{})});
  return {status:response.status,body:method==='HEAD'?null:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 const owner=await request('/api/auth/login',{method:'POST',body:{username:'lobby_owner',password:'test-password-123'}});
 assert.equal(owner.status,200);
 const get=route=>request(route,{cookie:owner.cookie});
 const post=(route,body)=>request(route,{method:'POST',cookie:owner.cookie,body});
 return {request,owner,get,post,media:(route,cookie)=>fetch(base+route,{headers:cookie?{Cookie:cookie}:{}})};
}
const routes=[['/api/lobby','GET'],['/api/lobby/move','POST'],['/api/lobby/emotes','GET'],['/api/lobby/emote','POST']];

test('lobby HTTP keeps authentication, parsing, method fallthrough and exact paths',async t=>{
 const f=await fixture(t);
 for(const [route,method] of routes){
  const anonymous=await f.request(route,{method});
  assert.equal(anonymous.status,401);assert.equal(anonymous.body.code,'LOGIN_REQUIRED');
  for(const unsupported of ['PUT','DELETE']){
   const result=await f.request(route,{method:unsupported,cookie:f.owner.cookie});
   assert.deepEqual(result,{status:404,body:{code:'NOT_FOUND',error:'找不到請求路徑'},cookie:undefined});
  }
  const opposite=await f.request(route,{method:method==='GET'?'POST':'GET',cookie:f.owner.cookie});
  assert.equal(opposite.status,404);assert.equal(opposite.body.code,'NOT_FOUND');
  assert.equal((await f.request(route+'/',{method,cookie:f.owner.cookie})).status,404);
 }
 for(const cookie of [undefined,f.owner.cookie]){
  for(const route of ['/api/lobby/move','/api/lobby/emote']){
   const oversized=await f.request(route,{method:'POST',cookie,raw:JSON.stringify({padding:'x'.repeat(8192)})});
   assert.equal(oversized.status,413);assert.equal(oversized.body.code,'REQUEST_TOO_LARGE');
   const malformed=await f.request(route,{method:'POST',cookie,raw:'{'});
   assert.equal(malformed.status,400);assert.equal(malformed.body.code,'INVALID_REQUEST');
   const wrongType=await f.request(route,{method:'POST',cookie,headers:{'Content-Type':'text/plain'}});
   assert.equal(wrongType.status,400);assert.equal(wrongType.body.error,'需要 JSON');
   const crossOrigin=await f.request(route,{method:'POST',cookie,headers:{Origin:'http://elsewhere.invalid'}});
   assert.equal(crossOrigin.status,400);assert.equal(crossOrigin.body.error,'不允許跨站請求');
  }
 }
});

test('lobby HTTP preserves view, move, options, expression validation and cooldown payloads',async t=>{
 const f=await fixture(t),view=await f.get('/api/lobby');
 assert.equal(view.status,200);assert.equal(view.body.selfId,f.owner.body.id);
 assert.deepEqual(Object.keys(view.body).sort(),['selfId','serverNow','visitors']);
 assert.equal(view.body.visitors.length,1);assert.ok(Number.isSafeInteger(view.body.serverNow));
 const moved=await f.post('/api/lobby/move',{x:100,y:0});
 assert.equal(moved.status,200);assert.equal(moved.body.visitors[0].targetX,85);assert.equal(moved.body.visitors[0].targetY,32);assert.equal(moved.body.visitors[0].moveId,1);
 const invalidMove=await f.post('/api/lobby/move',{x:'30',y:50});
 assert.equal(invalidMove.status,400);assert.equal(invalidMove.body.code,'INVALID_MOVEMENT');
 const options=await f.get('/api/lobby/emotes');assert.equal(options.status,200);
 assert.deepEqual(Object.keys(options.body),['emotes']);assert.ok(options.body.emotes.length);
 assert.ok(options.body.emotes.every(option=>option.expression!=='neutral'));
 const happy=options.body.emotes.find(option=>option.expression==='happy');assert.equal(happy.label,'開心');
 for(const expression of ['neutral','missing','toString','__proto__',1,null]){
  const invalid=await f.post('/api/lobby/emote',{expression});
  assert.equal(invalid.status,400);assert.deepEqual(invalid.body,{code:'INVALID_EXPRESSION',error:'這個角色沒有該表情'});
 }
 const emitted=await f.post('/api/lobby/emote',{expression:'happy'});assert.equal(emitted.status,200);
 const emote=emitted.body.visitors[0].emote;assert.equal(emote.image,happy.image);assert.equal(emote.label,happy.label);assert.equal(emote.until-emote.at,5000);assert.match(emote.id,/^[a-f0-9]{16}$/);
 const throttled=await f.post('/api/lobby/emote',{expression:'happy'});assert.equal(throttled.status,429);assert.equal(throttled.body.code,'EMOTE_RATE_LIMIT');
});

test('two live app instances isolate lobby presence, movement, emotes, sessions and rooms',async t=>{
 const [a,b]=await Promise.all([fixture(t),fixture(t)]);
 assert.notEqual(a.owner.body.id,b.owner.body.id);
 assert.equal((await b.request('/api/lobby',{cookie:a.owner.cookie})).status,401);
 await a.post('/api/lobby/move',{x:80,y:80});await a.post('/api/lobby/emote',{expression:'happy'});
 const bv=await b.get('/api/lobby');assert.deepEqual(bv.body.visitors.map(v=>v.id),[b.owner.body.id]);assert.equal(bv.body.visitors[0].moveId,0);assert.equal(bv.body.visitors[0].emote,null);
 assert.equal((await b.post('/api/lobby/emote',{expression:'happy'})).status,200);
 const room=await a.post('/api/create',{type:'poker'});assert.equal(room.status,200);
 assert.deepEqual((await b.get('/api/rooms')).body.rooms,[]);
 const av=await a.get('/api/lobby');assert.deepEqual(av.body.visitors.map(v=>v.id),[a.owner.body.id]);assert.equal(av.body.visitors[0].moveId,1);
});

test('lobby HTTP masks private character image and sound bytes from unrelated viewers',async t=>{
 const f=await fixture(t);
 async function member(username){
  const invite=await f.post('/api/admin/invites',{});
  const registered=await f.request('/api/auth/register',{method:'POST',body:{username,password:'test-password-123',confirmPassword:'test-password-123',invite:invite.body.code}});
  assert.equal(registered.status,200);return registered;
 }
 const peer=await member('lobby_peer'),outsider=await member('lobby_outsider');
 const png=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/assets/characters/traveler-neutral.png'));
 const created=await f.post('/api/profile/characters',{name:'Private lobby actor',base64:png.toString('base64')});assert.equal(created.status,200);
 const id=created.body.id,uuid=id.slice(5);
 const custom=await f.post(`/api/profile/characters/${uuid}/emotes`,{name:'歡呼',base64:png.toString('base64')});assert.equal(custom.status,200);
 const expression=custom.body.expression;
 const wav=Buffer.alloc(44+48000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(48000,40);
 assert.equal((await f.post(`/api/profile/characters/${uuid}/expressions/${expression}/sound`,{base64:wav.toString('base64')})).status,200);
 assert.equal((await f.post('/api/profile/appearance',{version:5,characterId:id,expression:'neutral'})).status,200);
 const options=await f.get('/api/lobby/emotes'),option=options.body.emotes.find(item=>item.expression===expression);
 assert.equal(option.label,'歡呼');assert.equal(option.sound.durationMs,1000);
 // Options are metadata, not audience membership or a private-byte grant.
 await f.get('/api/lobby');await f.request('/api/lobby',{cookie:peer.cookie});
 for(const route of [option.image,option.sound.url]){
  const response=await f.media(route);
  assert.equal((await f.media(route,peer.cookie)).status,404);
  assert.equal(response.status,401);
 }
 const sent=await f.post('/api/lobby/emote',{expression});assert.equal(sent.status,200);
 const observed=await f.request('/api/lobby',{cookie:peer.cookie}),event=observed.body.visitors.find(v=>v.id===f.owner.body.id).emote;
 assert.match(event.image,/\?v=[a-f0-9]{64}$/);assert.match(event.sound.url,/\?v=[a-f0-9]{64}$/);
 for(const route of [event.image,event.sound.url]){
  assert.equal((await f.media(route,peer.cookie)).status,200);
  assert.equal((await f.media(route,outsider.cookie)).status,404);
  assert.equal((await f.media(route)).status,401);
 }
});
