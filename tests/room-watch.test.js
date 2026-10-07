const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {RoomWatch,RoomWatchRegistry,youtubeVideoId,MAX_REQUESTS,REQUEST_TTL_MS}=require('../src/watch/room');
const {createApp}=require('../src/app');
const {openDatabase}=require('../src/db');
const {createAuth}=require('../src/auth');

const VIDEO='M7lc1UVf-VE',OTHER='dQw4w9WgXcQ';
function fixture(count=3){
 let now=100000;
 const members=Array.from({length:count},(_,i)=>({id:randomUUID(),name:'玩家'+i,lastSeen:now}));
 const context={hostId:members[0].id,members},room=new RoomWatch(()=>now);
 const command=(player,action,extra={})=>({roomInstanceId:room.roomInstanceId,watchSessionId:room.watchSessionId,expectedRevision:room.revision,controllerEpoch:room.controllerEpoch,requestId:randomUUID(),action,...extra});
 const act=(player,action,extra={})=>room.act(members[player].id,command(player,action,extra),context);
 const advance=(ms,{touch=true}={})=>{now+=ms;if(touch)for(const member of members)member.lastSeen=now;};
 return {room,context,members,command,act,advance,now:()=>now};
}

test('YouTube parser accepts official URL forms, strips tracking and rejects impostor hosts, ports and malformed IDs',()=>{
 for(const url of [`https://www.youtube.com/watch?v=${VIDEO}&si=tracking#t=30`,`https://youtube.com/watch?v=${VIDEO}`,`https://m.youtube.com/shorts/${VIDEO}`,`https://www.youtube.com/embed/${VIDEO}`,`https://youtu.be/${VIDEO}?t=3`])assert.equal(youtubeVideoId(url),VIDEO);
 for(const url of [null,VIDEO,`http://youtube.com/watch?v=${VIDEO}`,`https://youtube.com.attacker.example/watch?v=${VIDEO}`,`https://attacker.example/youtube.com/watch?v=${VIDEO}`,`https://youtube.com:8443/watch?v=${VIDEO}`,`https://user:password@youtube.com/watch?v=${VIDEO}`,`https://www.youtu.be/${VIDEO}`,`https://youtu.be/${VIDEO}/extra`,`https://youtube.com/watch?v=${VIDEO}&v=${OTHER}`,`https://youtube.com/watch?v=bad`,`https://youtube.com/watch?v=${VIDEO}%0a`,`https://youtube.com/watch?v=${VIDEO}\n`,`https://youtube.com\\@attacker.example/watch?v=${VIDEO}`,`<iframe src="https://youtu.be/${VIDEO}"></iframe>`])assert.throws(()=>youtubeVideoId(url),{code:'WATCH_INVALID_URL'});
});

test('first proposer gets control; snapshots keep anchors and revision unchanged as time advances without a watch ticker',()=>{
 const f=fixture(),original=f.room.snapshot(f.members[1].id,f.context);
 assert.equal(original.video,null);assert.equal(original.revision,0);assert.equal(original.canControl,false);
 const selected=f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`});
 assert.equal(selected.video.id,VIDEO);assert.equal(selected.controllerId,f.members[1].id);assert.equal(selected.selectedById,f.members[1].id);assert.equal(selected.canControl,true);assert.equal(selected.playback.state,'paused');assert.notEqual(selected.watchSessionId,original.watchSessionId);
 const playing=f.act(1,'play'),stored=JSON.stringify(f.room.playback);
 f.advance(5600);assert.equal(f.room.position(),5.6);
 for(let i=0;i<1000;i++){
  const state=f.room.snapshot(f.members[0].id,f.context);
  assert.equal(state.revision,playing.revision);assert.deepEqual(state.playback,playing.playback);assert.equal(state.serverNowMs,f.now());
 }
 assert.equal(JSON.stringify(f.room.playback),stored);assert.equal(f.room.requests.size,2);
 const paused=f.act(1,'pause');assert.equal(paused.playback.anchorPositionSec,5.6);assert.equal(paused.playback.state,'paused');
 f.advance(5000);assert.equal(f.room.position(),5.6);
 assert.equal(f.act(1,'seek',{positionSec:123.5}).playback.state,'paused');
 assert.deepEqual(f.act(1,'replay').playback,{state:'playing',anchorPositionSec:0,anchorServerMs:f.now(),rate:1});
 f.advance(90_000_000);assert.equal(f.room.position(),86400);assert.equal(f.room.playback.state,'playing');
});

test('only explicit controller actions change playback; host takeover freezes the anchor and revokes the old epoch',()=>{
 const f=fixture();f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`});f.act(1,'play');f.advance(3250);
 const old=f.command(1,'seek',{positionSec:20});
 for(const who of [0,2])for(const action of ['play','pause','seek','replay'])assert.throws(()=>f.act(who,action,{positionSec:4,userId:f.members[1].id,controllerId:f.members[1].id,isHost:true}),{code:'WATCH_CONTROLLER_ONLY'});
 for(const action of ['report','join','ended','buffering','close'])assert.throws(()=>f.act(1,action,{positionSec:9}),{code:'WATCH_INVALID_ACTION'});
 assert.throws(()=>f.act(1,'takeover'),{code:'HOST_ONLY'});
 const previousEpoch=f.room.controllerEpoch,taken=f.act(0,'takeover');assert.equal(taken.controllerId,f.members[0].id);assert.equal(taken.controllerEpoch,previousEpoch+1);assert.equal(taken.playback.anchorPositionSec,3.25);assert.equal(taken.playback.state,'paused');
 assert.throws(()=>f.room.act(f.members[1].id,old,f.context),error=>error.code==='WATCH_STALE'&&error.watchState.controllerId===f.members[0].id);
 assert.throws(()=>f.act(1,'pause'),{code:'WATCH_CONTROLLER_ONLY'});
 const transferred=f.act(0,'transfer',{playerId:f.members[2].id});assert.equal(transferred.controllerId,f.members[2].id);assert.equal(transferred.selectedById,f.members[1].id);
 assert.throws(()=>f.act(0,'transfer',{playerId:randomUUID()}),{code:'WATCH_INVALID_CONTROLLER'});
 const stop=f.act(0,'stop');assert.equal(stop.video,null);assert.equal(stop.controllerId,null);assert.equal(stop.proposals.length,0);
 assert.throws(()=>f.act(0,'takeover'),{code:'WATCH_NO_VIDEO'});
});

test('accepted retries are idempotent after later commands, altered payloads conflict, and losing a revision does not silently retry',()=>{
 const f=fixture();f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`});
 const seek=f.command(1,'seek',{positionSec:12}),winner=f.room.act(f.members[1].id,seek,f.context);
 assert.equal(winner.duplicate,false);assert.equal(f.room.act(f.members[1].id,{...seek},f.context).duplicate,true);
 assert.equal(f.room.revision,winner.revision);
 f.act(1,'seek',{positionSec:25});const current=f.room.revision;
 const duplicate=f.room.act(f.members[1].id,seek,f.context);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.playback.anchorPositionSec,25);assert.equal(f.room.revision,current);
 assert.throws(()=>f.room.act(f.members[1].id,{...seek,positionSec:50},f.context),{code:'WATCH_REQUEST_REUSED'});
 assert.throws(()=>f.room.act(f.members[1].id,{...seek,requestId:randomUUID()},f.context),error=>error.code==='WATCH_STALE'&&error.watchState.revision===current);
 assert.throws(()=>f.room.act(f.members[2].id,seek,f.context),{code:'WATCH_STALE'});
 assert.equal(f.room.playback.anchorPositionSec,25);
});

test('malformed commands and seek positions are rejected without consuming a revision or accepted request',()=>{
 const f=fixture();f.act(0,'propose',{url:`https://youtu.be/${VIDEO}`});const before=f.room.revision,requests=f.room.requests.size;
 for(const positionSec of [NaN,Infinity,-1,86400.001,'5',null,{},[5]])assert.throws(()=>f.act(0,'seek',{positionSec}),{code:'WATCH_INVALID_POSITION'});
 for(const data of [{requestId:'bad'},{requestId:[randomUUID()]},{expectedRevision:-1},{expectedRevision:'1'},{controllerEpoch:NaN},{controllerEpoch:1.1}])assert.throws(()=>f.act(0,'play',data),error=>['WATCH_INVALID_VERSION','WATCH_INVALID_REQUEST'].includes(error.code));
 for(const data of [{roomInstanceId:randomUUID()},{watchSessionId:randomUUID()},{expectedRevision:before+1},{controllerEpoch:99}])assert.throws(()=>f.act(0,'play',data),{code:'WATCH_STALE'});
 assert.equal(f.room.revision,before);assert.equal(f.room.requests.size,requests);assert.equal(f.act(0,'seek',{positionSec:86400}).playback.anchorPositionSec,86400);
});

test('proposal queue is bounded, switches control to the proposer, and rejects offline or removed proposals',()=>{
 const f=fixture(6);f.act(0,'propose',{url:`https://youtu.be/${VIDEO}`});
 let n=0;const next=()=>String(++n).padStart(11,'a');
 for(let player=1;player<=4;player++)for(let i=0;i<2;i++)f.act(player,'propose',{url:'https://youtu.be/'+next()});
 assert.equal(f.room.proposals.length,8);
 assert.throws(()=>f.act(5,'propose',{url:'https://youtu.be/'+next()}),{code:'WATCH_PROPOSAL_LIMIT'});
 assert.throws(()=>f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`}),{code:'WATCH_ALREADY_PROPOSED'});
 const proposal=f.room.proposals[0];assert.throws(()=>f.act(2,'select',{proposalId:proposal.id}),{code:'WATCH_CONTROLLER_ONLY'});
 f.members[1].lastSeen=f.now()-30001;assert.throws(()=>f.act(0,'select',{proposalId:proposal.id}),{code:'WATCH_PROPOSER_OFFLINE'});f.members[1].lastSeen=f.now();
 const previous=f.room.watchSessionId,chosen=f.act(0,'select',{proposalId:proposal.id});assert.equal(chosen.controllerId,f.members[1].id);assert.equal(chosen.selectedById,f.members[1].id);assert.notEqual(chosen.watchSessionId,previous);assert.equal(chosen.video.id,proposal.videoId);assert.equal(chosen.proposals.length,7);assert.equal(chosen.playback.state,'paused');
 assert.throws(()=>f.act(1,'select',{proposalId:proposal.id}),{code:'WATCH_PROPOSAL_NOT_FOUND'});
 f.context.members=f.members.filter(member=>member.id!==f.members[2].id);f.room.reconcile(f.context);assert.equal(f.room.proposals.filter(item=>item.proposerId===f.members[2].id).length,0);
});

test('each seat has at most two queued proposals even while room has capacity',()=>{
 const f=fixture();f.act(0,'propose',{url:`https://youtu.be/${VIDEO}`});f.act(1,'propose',{url:`https://youtu.be/${OTHER}`});f.act(1,'propose',{url:'https://youtu.be/aaaaaaaaaaa'});
 const revision=f.room.revision;assert.throws(()=>f.act(1,'propose',{url:'https://youtu.be/bbbbbbbbbbb'}),{code:'WATCH_PROPOSAL_LIMIT'});assert.equal(f.room.revision,revision);
});

test('controller offline grace is reconciled by ordinary requests once, preserving paused time and explicit host ownership',()=>{
 const f=fixture();f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`});f.act(1,'play');
 f.advance(29999,{touch:false});f.members[0].lastSeen=f.now();f.room.reconcile(f.context);assert.equal(f.room.controllerId,f.members[1].id);
 f.advance(1,{touch:false});f.members[0].lastSeen=f.now();const oldRevision=f.room.revision,oldEpoch=f.room.controllerEpoch;
 f.room.reconcile(f.context);assert.equal(f.room.controllerId,f.members[0].id);assert.equal(f.room.playback.anchorPositionSec,30);assert.equal(f.room.playback.state,'paused');assert.equal(f.room.revision,oldRevision+1);assert.equal(f.room.controllerEpoch,oldEpoch+1);
 f.room.reconcile(f.context);assert.equal(f.room.revision,oldRevision+1);
 f.members[1].lastSeen=f.now();assert.throws(()=>f.act(1,'play'),{code:'WATCH_CONTROLLER_ONLY'});
 f.context.hostId=f.members[2].id;f.members[2].lastSeen=f.now();f.room.reconcile(f.context);assert.equal(f.room.controllerId,f.members[0].id);assert.equal(f.room.revision,oldRevision+2);
 assert.equal(f.room.snapshot(f.members[2].id,f.context).isHost,true);
});

test('departed or replaced seats immediately lose authority; first returning seat recovers control while playback stays paused',()=>{
 const f=fixture();f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`});f.act(1,'play');f.advance(2000);
 const old=f.command(1,'seek',{positionSec:12});f.context.members=f.members.filter(member=>member.id!==f.members[1].id);f.room.reconcile(f.context);
 assert.equal(f.room.controllerId,f.members[0].id);assert.equal(f.room.playback.anchorPositionSec,2);
 assert.throws(()=>f.room.act(f.members[1].id,old,f.context),{code:'NOT_SEATED'});
 f.advance(30000,{touch:false});f.room.reconcile(f.context);assert.equal(f.room.controllerId,null);assert.equal(f.room.playback.state,'paused');const revision=f.room.revision;
 f.members[2].lastSeen=f.now();f.room.reconcile(f.context);assert.equal(f.room.controllerId,f.members[2].id);assert.equal(f.room.revision,revision+1);assert.equal(f.room.playback.state,'paused');
 f.members[0].lastSeen=f.now();f.room.reconcile(f.context);assert.equal(f.room.controllerId,f.members[2].id);assert.equal(f.room.revision,revision+1);
 assert.equal(f.act(0,'takeover').controllerId,f.members[0].id);
 const replacement={...f.members[0],id:randomUUID()};f.context.members=[replacement];f.context.hostId=replacement.id;f.room.reconcile(f.context);
 assert.equal(f.room.controllerId,replacement.id);assert.throws(()=>f.act(0,'play'),{code:'NOT_SEATED'});
});

test('accepted command ledger has bounded fixed-size digests and TTL; evicted requests cannot replay a stale command',()=>{
 const f=fixture();f.act(0,'propose',{url:`https://youtu.be/${VIDEO}`});const first=f.command(0,'play');f.room.act(f.members[0].id,first,f.context);
 for(let i=0;i<MAX_REQUESTS+5;i++)f.act(0,i%2?'play':'pause');
 assert.equal(f.room.requests.size,MAX_REQUESTS);assert.ok([...f.room.requests.values()].every(entry=>entry.fingerprint.length===64));
 assert.throws(()=>f.room.act(f.members[0].id,first,f.context),{code:'WATCH_STALE'});
 const last=f.command(0,'seek',{positionSec:42});f.room.act(f.members[0].id,last,f.context);f.advance(REQUEST_TTL_MS);
 assert.throws(()=>f.room.act(f.members[0].id,last,f.context),{code:'WATCH_STALE'});assert.equal(f.room.requests.size,0);assert.equal(f.room.playback.anchorPositionSec,42);
});

test('summary contains only a small revision marker, and state copies cannot mutate server authority',()=>{
 const f=fixture();f.act(1,'propose',{url:`https://youtu.be/${VIDEO}`});f.act(2,'propose',{url:`https://youtu.be/${OTHER}`});
 const marker=f.room.summary(f.context);assert.deepEqual(Object.keys(marker),['roomInstanceId','revision','hasVideo','controllerId','controllerName']);assert.equal(JSON.stringify(marker).includes(VIDEO),false);assert.equal(JSON.stringify(marker).includes(OTHER),false);assert.ok(Buffer.byteLength(JSON.stringify(marker))<240);
 const snapshot=f.room.snapshot(f.members[1].id,f.context);snapshot.video.id='changed';snapshot.playback.state='playing';snapshot.proposals[0].videoId='changed';
 assert.equal(f.room.video.id,VIDEO);assert.equal(f.room.playback.state,'paused');assert.equal(f.room.proposals[0].videoId,OTHER);
});

test('watch registry is lazy, isolates room instances with reused codes, and releases all references on room cleanup',()=>{
 const registry=new RoomWatchRegistry(),a={code:'A12345'},b={code:'B12345'};
 assert.equal(registry.get(a),null);assert.equal(registry.rooms.size,0);
 const first=registry.get(a,{create:true}),second=registry.get(b,{create:true});assert.equal(registry.get(a),first);assert.notEqual(first.roomInstanceId,second.roomInstanceId);
 const replacement={code:a.code};assert.equal(registry.get(replacement),null);assert.equal(registry.rooms.size,1);
 const next=registry.get(replacement,{create:true});assert.notEqual(next.roomInstanceId,first.roomInstanceId);assert.equal(next.revision,0);assert.equal(next.requests.size,0);
 registry.delete(a.code);assert.equal(registry.get(replacement),null);registry.clear();assert.equal(registry.rooms.size,0);
});

async function httpFixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-room-watch-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false};
 const db=openDatabase(config.dbFile),auth=createAuth(db);
 try{
  const host=await auth.bootstrap('watch_host','watch-test-password');const hash=db.prepare('SELECT password_hash FROM users WHERE id=?').get(host).password_hash;
  for(const who of ['guest','third','outsider'])db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),'watch_'+who,who,hash,'member',new Date().toISOString());
 }finally{db.close();}
 let app=createApp(config),base;const cookies={};
 t.after(async()=>{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 async function listen(){base='http://127.0.0.1:'+(await app.listen()).port;}await listen();
 const request=async(route,who,{method='GET',data,headers={}}={})=>{
  const response=await fetch(base+'/api/'+route,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 const post=(route,who,data,headers)=>request(route,who,{method:'POST',data,headers});
 for(const who of ['host','guest','third','outsider']){const login=await post('auth/login',null,{username:'watch_'+who,password:'watch-test-password'});assert.equal(login.status,200);cookies[who]=login.cookie;}
 const game=(code,who='host')=>request('state?code='+code,who),watch=(code,who='host')=>request('room-watch?code='+code,who);
 const create=async(type='draw')=>{const response=await post('create','host',{type});assert.equal(response.status,200);const code=response.body.code;for(const who of ['guest','third'])assert.equal((await post('join',who,{code})).status,200);return code;};
 const command=(code,state,action,extra={})=>({code,roomInstanceId:state.roomInstanceId,watchSessionId:state.watchSessionId,expectedRevision:state.revision,controllerEpoch:state.controllerEpoch,requestId:randomUUID(),action,...extra});
 const promote=async(code,who)=>{const playerId=(await game(code,who)).body.me;assert.equal((await post('room-role','host',{code,playerId,role:'manager'})).status,200);};
 return {config,post,request,create,game,watch,command,promote,restart:async()=>{await app.close();app=createApp(config);await listen();}};
}

test('HTTP authenticates valid seats, rejects spoofed authority and stale tuples, and piggybacks only a revision marker',async t=>{
 const f=await httpFixture(t),code=await f.create();const gameBefore=(await f.game(code)).body;assert.equal(gameBefore.watch,null);
 assert.equal((await f.watch(code,null)).status,401);assert.equal((await f.watch(code,'outsider')).body.code,'NOT_SEATED');assert.equal((await f.game(code)).body.watch,null);
 const initial=(await f.watch(code,'guest')).body;assert.equal(initial.revision,0);assert.equal(initial.isHost,false);
 const body=f.command(code,initial,'propose',{url:`https://youtu.be/${VIDEO}`}),first=await f.post('room-watch','guest',body);assert.equal(first.status,200);assert.equal(first.body.video.id,VIDEO);
 const gameAfter=(await f.game(code)).body;assert.equal(gameAfter.version,gameBefore.version);assert.equal(gameAfter.watch.revision,1);assert.equal(gameAfter.watch.hasVideo,true);assert.equal(gameAfter.watch.controllerId,(await f.game(code,'guest')).body.me);assert.equal(Object.hasOwn(gameAfter.watch,'video'),false);
 assert.equal((await f.post('room-watch','host',f.command(code,first.body,'play',{controllerId:gameAfter.watch.controllerId,isHost:true}))).status,403);
 const duplicate=await f.post('room-watch','guest',body);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.revision,first.body.revision);
 const stale=await f.post('room-watch','guest',{...body,requestId:randomUUID()});assert.equal(stale.status,409);assert.equal(stale.body.code,'WATCH_STALE');assert.equal(stale.body.state.revision,1);
 const altered=await f.post('room-watch','guest',{...body,url:`https://youtu.be/${OTHER}`});assert.equal(altered.status,409);assert.equal(altered.body.code,'WATCH_REQUEST_REUSED');
 const wrongRoom=await f.create('gift');assert.equal((await f.post('room-watch','guest',{...body,code:wrongRoom})).body.code,'WATCH_STALE');
 assert.equal((await f.request('room-watch?code='+code,'host',{method:'PUT'})).status,405);
 assert.equal((await f.request('room-watch/events?code='+code,'host')).status,404);
 assert.equal((await f.post('room-watch','guest',body,{Origin:'https://example.invalid'})).status,400);
 assert.equal((await f.post('room-watch','guest',{...body,extra:'x'.repeat(9000)})).status,413);
});

test('HTTP leaves and kicks immediately pause and revoke authorized manager controllers; last-player deletion and restart discard watch state',async t=>{
 const f=await httpFixture(t),code=await f.create();await f.promote(code,'guest');const initial=(await f.watch(code,'guest')).body;
 const proposed=(await f.post('room-watch','guest',f.command(code,initial,'propose',{url:`https://youtu.be/${VIDEO}`}))).body;
 const playing=(await f.post('room-watch','guest',f.command(code,proposed,'play'))).body;assert.equal(playing.playback.state,'playing');
 assert.equal((await f.post('leave','guest',{code})).status,200);assert.equal((await f.watch(code,'guest')).body.code,'NOT_SEATED');
 const host=(await f.watch(code)).body;assert.equal(host.controllerId,(await f.game(code)).body.me);assert.equal(host.playback.state,'paused');assert.equal(host.controllerEpoch,playing.controllerEpoch+1);
 assert.equal((await f.post('join','guest',{code})).status,200);assert.equal((await f.post('room-watch','guest',f.command(code,host,'play'))).body.code,'MEDIA_MANAGER_ONLY');
 const third=(await f.game(code,'third')).body.me,transferred=(await f.post('room-watch','host',f.command(code,host,'transfer',{playerId:third}))).body;
 assert.equal(transferred.controllerId,third);assert.equal((await f.post('kick','host',{code,playerId:third,confirmed:true})).status,200);
 assert.equal((await f.watch(code,'third')).body.code,'KICKED');assert.equal((await f.watch(code)).body.controllerEpoch,transferred.controllerEpoch+1);
 assert.equal((await f.post('leave','guest',{code})).body.deleted,false);assert.equal((await f.post('leave','host',{code})).body.deleted,true);assert.equal((await f.watch(code)).body.code,'ROOM_NOT_FOUND');
 const newCode=await f.create(),fresh=(await f.watch(newCode)).body;assert.equal(fresh.video,null);assert.equal(fresh.revision,0);assert.notEqual(fresh.roomInstanceId,host.roomInstanceId);
 await f.restart();assert.equal((await f.watch(newCode)).body.code,'ROOM_NOT_FOUND');
 const afterRestart=await f.create(),empty=(await f.watch(afterRestart)).body;assert.equal(empty.video,null);assert.equal(empty.revision,0);
 const db=openDatabase(f.config.dbFile);try{assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE '%watch%'").get().n,0);}finally{db.close();}
});

test('HTTP watch GET reconciles refreshed presence so a returning manager can recover an ownerless video',async t=>{
 const realNow=Date.now;
 let now=realNow();Date.now=()=>now;
 try{
  const f=await httpFixture(t),code=await f.create();
  await f.promote(code,'guest');await f.promote(code,'third');
  const initial=(await f.watch(code,'guest')).body;
  const proposed=await f.post('room-watch','guest',f.command(code,initial,'propose',{url:`https://youtu.be/${VIDEO}`}));assert.equal(proposed.status,200);
  const playing=await f.post('room-watch','guest',f.command(code,proposed.body,'play'));assert.equal(playing.status,200);
  now+=35000;
  const resumed=await f.watch(code,'third');assert.equal(resumed.status,200);
  const third=(await f.game(code,'third')).body;
  assert.equal(resumed.body.controllerId,third.me);assert.equal(resumed.body.canControl,true);assert.equal(resumed.body.isHost,false);
  assert.equal(resumed.body.playback.state,'paused');assert.equal(resumed.body.playback.anchorPositionSec,35);
  assert.equal(resumed.body.controllerEpoch,playing.body.controllerEpoch+2);assert.equal(resumed.body.revision,playing.body.revision+2);
  assert.equal(third.watch.revision,resumed.body.revision);
  const returnedHost=(await f.watch(code)).body;
  assert.equal(returnedHost.isHost,true);assert.equal(returnedHost.canControl,false);assert.equal(returnedHost.controllerId,third.me);assert.equal(returnedHost.revision,resumed.body.revision);
  const replay=await f.post('room-watch','third',f.command(code,resumed.body,'play'));assert.equal(replay.status,200);assert.equal(replay.body.playback.state,'playing');
 }finally{Date.now=realNow;}
});

test('HTTP host departure changes the watch marker even when the online controller stays the same',async t=>{
 const f=await httpFixture(t),code=await f.create(),initial=(await f.watch(code,'guest')).body;
 await f.promote(code,'guest');
 const proposed=await f.post('room-watch','guest',f.command(code,initial,'propose',{url:`https://youtu.be/${VIDEO}`}));assert.equal(proposed.status,200);
 const playing=await f.post('room-watch','guest',f.command(code,proposed.body,'play'));assert.equal(playing.status,200);assert.equal(playing.body.isHost,false);
 const before=(await f.game(code,'guest')).body;
 assert.equal((await f.post('leave','host',{code})).status,200);
 const after=(await f.game(code,'guest')).body;
 assert.equal(after.watch.controllerId,before.watch.controllerId);assert.equal(after.watch.revision,before.watch.revision+1);
 const updated=(await f.watch(code,'guest')).body;
 assert.equal(updated.isHost,true);assert.equal(updated.canControl,true);assert.equal(updated.controllerEpoch,playing.body.controllerEpoch);assert.equal(updated.playback.state,'playing');
 assert.equal(updated.revision,after.watch.revision);
 assert.equal((await f.game(code,'third')).body.watch.revision,after.watch.revision);
});

test('all five games use the same lazy watch protocol and commands do not change game versions',async t=>{
 const f=await httpFixture(t),instances=new Set();
 for(const type of ['poker','thunder','majority','gift','draw']){
  const code=await f.create(type),before=(await f.game(code)).body;assert.equal(before.watch,null);
  const initial=(await f.watch(code)).body;instances.add(initial.roomInstanceId);
  const proposed=await f.post('room-watch','host',f.command(code,initial,'propose',{url:`https://www.youtube.com/watch?v=${VIDEO}`}));assert.equal(proposed.status,200);
  const after=(await f.game(code,'guest')).body;assert.equal(after.watch.revision,1);assert.equal(after.watch.hasVideo,true);assert.equal(after.version,before.version);
 }
 assert.equal(instances.size,5);
});

test('HTTP bounds read and explicit-command frequency including accepted duplicate retries',async t=>{
 const f=await httpFixture(t),code=await f.create(),initial=(await f.watch(code)).body,body=f.command(code,initial,'propose',{url:`https://youtu.be/${VIDEO}`});
 for(let i=0;i<60;i++){const response=await f.post('room-watch','host',body);assert.equal(response.status,200);assert.equal(response.body.revision,1);}
 assert.equal((await f.post('room-watch','host',body)).status,429);
 for(let i=0;i<120;i++)assert.equal((await f.watch(code,'guest')).status,200);
 assert.equal((await f.watch(code,'guest')).status,429);assert.equal((await f.game(code,'guest')).status,200);assert.equal((await f.game(code)).body.watch.revision,1);
});
