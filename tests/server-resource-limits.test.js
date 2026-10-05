const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {HistoryStore}=require('../src/history/store');
const {DrawGuessRoom}=require('../src/games/draw-guess'),{GiftRoom}=require('../src/games/gift'),{MajorityRoom}=require('../src/games/majority'),{Room}=require('../src/games/poker');
const {leavePlayer,expireEmptyRooms,endRoomHistory,ROOM_RECONNECT_MS}=require('../src/rooms/lifecycle'),{MAX_PLAYER_RECORDS,rejoinPlayer}=require('../src/rooms/membership');
const {startRoomScheduler}=require('../src/rooms/scheduler');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db/index'),{createAuth}=require('../src/auth/index');
const {settings}=require('../src/config');
function historyHarness(t,limits){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bga-resource-history-')),h=new HistoryStore(dir,limits);t.after(()=>{h.close();fs.rmSync(dir,{recursive:true,force:true});});return {h,dir};}
const limits={maxSessionBytes:96*1024,maxMatchBytes:256*1024,maxTotalBytes:512*1024,maxResultBytes:16*1024,maxTraceBytes:8*1024};
test('deployment history quota overrides are opt-in positive integers',()=>{
 assert.ok(!('historyLimits' in settings({})));
 assert.deepEqual(settings({HISTORY_MAX_TOTAL_BYTES:'4194304',HISTORY_MAX_ARCHIVES:'2',HISTORY_RETENTION_DAYS:'90'}).historyLimits,{maxTotalBytes:4194304,maxArchives:2,retentionDays:90});
 for(const value of ['0','-1','1.2','1e6','bad','9007199254740992'])assert.throws(()=>settings({HISTORY_MAX_TOTAL_BYTES:value}),/HISTORY_MAX_TOTAL_BYTES/);
});
for(const Engine of [DrawGuessRoom,GiftRoom,MajorityRoom])test(Engine.name+': 1000 waiting join/leave cycles bound players, snapshots and session storage',t=>{
 const {h,dir}=historyHarness(t,limits),r=new Engine('B0A123','churn');h.attach(r);
 const host=h.transact(r,{action:'create'},()=>r.add('host'));
 for(let i=0;i<1000;i++){
  const p=h.transact(r,{action:'join'},()=>r.add('guest'));
  h.transact(r,{action:'leave'},()=>leavePlayer(r,p.id));
  assert.equal(r.players.length,1);assert.equal(r.host,host.id);
  assert.ok(Buffer.byteLength(JSON.stringify(r.view(host.id)))<5000);
 }
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl'));assert.equal(files.length,1);
 const rows=h.readRows(files[0].slice(0,-6));assert.equal(rows[0].kind,'session');assert.ok(rows[0].continuationOf);assert.equal(rows[0].initial.players[0].id,host.id);
 assert.ok(fs.statSync(path.join(dir,files[0])).size<=limits.maxSessionBytes);
 assert.ok(h.totalBytes<=limits.maxTotalBytes);
 for(let i=0;i<(Engine===GiftRoom||Engine===MajorityRoom?2:1);i++)h.transact(r,{action:'join'},()=>r.add('ready'+i));
 h.transact(r,{action:'start'},()=>r.start());
 const m=h.list()[0],header=h.readRows(m.id)[0];assert.equal(header.schema,1);assert.equal(header.initial.players[0].id,host.id);assert.equal(header.setup[0].kind,'session');
 h.interrupt(r,'test end');assert.equal(fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).length,1);
});

test('in-progress departed identities are capped and voluntary rejoin preserves the same seat and score',()=>{
 const r=new DrawGuessRoom('A0A123','record cap'),host=r.add('host'),guest=r.add('guest');r.start();
 const former=[];
 for(let i=2;i<MAX_PLAYER_RECORDS;i++){const p=r.add('guest'+i);p.score=42;r.kick(host.id,p.id,true);former.push(p);}
 assert.equal(r.players.length,MAX_PLAYER_RECORDS);assert.throws(()=>r.add('overflow'),e=>e.status===429&&e.code==='ROOM_RECORD_LIMIT');
 const revived=rejoinPlayer(r,former[0].id,'guest0');assert.equal(revived.id,former[0].id);assert.equal(revived.score,42);assert.equal(revived.kicked,false);assert.equal(revived.waitingForNextRound,true);
 assert.equal(r.players.length,MAX_PLAYER_RECORDS);assert.ok(!r.pendingArtists.includes(revived.id));assert.equal(r.player(guest.id).kicked,false);
});

test('session rollover keeps before/after pairing, protects secrets, and embeds its independent baseline',t=>{
 const {h}=historyHarness(t,limits),r=new Room('A0A124','session');h.attach(r);const a=h.transact(r,{action:'create'},()=>r.add('a'));h.transact(r,{action:'join'},()=>r.add('b'));
 for(let i=0;i<150;i++)h.transact(r,{action:'configure'},()=>r.note('bounded '+i));
 h.transact(r,{action:'start'},()=>r.start());const header=h.readRows(h.list()[0].id)[0],setup=header.setup;
 assert.ok(setup[0].continuationOf);assert.equal(setup[0].schema,1);assert.ok(setup[0].initial);
 const intents=setup.filter(row=>row.kind==='intent');assert.ok(intents.length>0);
 for(const row of intents)assert.equal(setup.filter(result=>result.kind==='result'&&result.seq===row.seq).length,1);
 assert.ok(!JSON.stringify(header).includes(a.secret));
});

test('match capacity rejects before intent/state mutation and leaves another room usable',t=>{
 const {h}=historyHarness(t,limits),r=new Room('A0A125','quota');h.attach(r);r.add('a');r.add('b');h.transact(r,{action:'start'},()=>r.start());
 const id=h.list()[0].id,before=h.readRows(id),length=h.sizes.get(id+'.jsonl');
 h.limits.maxMatchBytes=length+h.limits.maxResultBytes;
 let calls=0;assert.throws(()=>h.transact(r,{action:'fold'},()=>{calls++;r.act(r.players[r.turn].id,'fold');}),e=>e.code==='HISTORY_QUOTA');
 assert.equal(calls,0);assert.deepEqual(h.readRows(id),before);assert.equal(r.phase,'preflop');
 const other=new Room('A0A126','healthy');h.attach(other);h.transact(other,{action:'create'},()=>other.add('c'));assert.equal(other.players.length,1);
});

test('total quota and archive count evict only finished records while retaining an active match',t=>{
 const {h}=historyHarness(t,{...limits,maxArchives:2}),active=new Room('A0A127','active');h.attach(active);active.add('a');active.add('b');h.transact(active,{action:'start'},()=>active.start());const protectedId=h.list()[0].id;
 const r=new Room('A0A128','rounds');h.attach(r);r.add('c');r.add('d');const old=[];
 for(let i=0;i<6;i++){h.transact(r,{action:'start'},()=>r.start());const id=h.list().find(m=>m.room===r.code&&m.status==='playing').id;old.push(id);h.transact(r,{action:'fold'},()=>r.act(r.players[r.turn].id,'fold'));}
 assert.equal(h.list().length,2);assert.equal(h.metas.get(protectedId).status,'playing');assert.ok(!h.metas.has(old[0]));assert.equal(h.metas.get(old.at(-1)).status,'finished');assert.ok(h.totalBytes<=limits.maxTotalBytes);
});

test('bounded debug traces explicitly mark truncation without dropping the authoritative result',t=>{
 const {h}=historyHarness(t,{...limits,maxTraceBytes:128}),r=new Room('A0A129','trace');h.attach(r);r.add('a');r.add('b');h.transact(r,{action:'start'},()=>r.start());
 const row=h.readRows(h.list()[0].id).at(-1);assert.equal(row.kind,'result');assert.equal(row.ok,true);assert.equal(row.traceTruncated,true);assert.equal(row.after.phase,'preflop');
 assert.ok(Buffer.byteLength(JSON.stringify(row.trace))<140);
});

test('actual result-write failure pauses further operations without pretending to have persisted them',t=>{
 const {h}=historyHarness(t),r=new Room('A0A130','write failure');h.attach(r);h.transact(r,{action:'create'},()=>r.add('a'));
 const original=h.appendText.bind(h);h.appendText=(id,text)=>{if(text.startsWith('{"kind":"result"')){const e=Error('simulated I/O');e.code='ENOSPC';throw e;}return original(id,text);};
 assert.throws(()=>h.transact(r,{action:'join'},()=>r.add('b')),/simulated I\/O/);let calls=0;
 assert.throws(()=>h.transact(r,{action:'join'},()=>{calls++;r.add('c');}),/暫停/);assert.equal(calls,0);
});

test('room cleanup proceeds after interruption I/O failure and timer callbacks do not throw',t=>{
 const error=Object.assign(Error('simulated full disk'),{code:'ENOSPC'}),errors=[],now=200000;
 const empty={code:'EMPTY1',players:[{id:'one',lastSeen:now-ROOM_RECONNECT_MS}]},rooms=new Map([[empty.code,empty]]),deleted=[];
 const history={interrupt(){throw error;},isPaused(){return false;}};
 expireEmptyRooms({rooms,history,now,onDelete:code=>deleted.push(code),onHistoryError:e=>errors.push(e.code)});
 assert.equal(rooms.size,0);assert.deepEqual(deleted,['EMPTY1']);assert.deepEqual(errors,['ENOSPC']);
 assert.equal(endRoomHistory(history,empty,'end',e=>errors.push(e.code)),false);
 const callbacks=[];t.mock.method(global,'setInterval',fn=>{callbacks.push(fn);return {unref(){}};});t.mock.method(global,'clearInterval',()=>{});t.mock.method(console,'error',()=>{});
 const old={code:'OLD001',phase:'waiting',players:[{lastSeen:Date.now()-86400001}]},scheduled=new Map([[old.code,old]]),stop=startRoomScheduler({rooms:scheduled,history});
 assert.doesNotThrow(()=>callbacks[1]());assert.equal(scheduled.size,0);stop();
 const expired={code:'OLD002',players:[{lastSeen:Date.now()-ROOM_RECONNECT_MS}]};scheduled.set(expired.code,expired);
 assert.doesNotThrow(()=>callbacks[0]());assert.equal(scheduled.size,0);
});

test('canvas fill and command cost budgets do not reset on undo/clear or duplicate requests',()=>{
 let now=1000000;const r=new DrawGuessRoom('A0A131','canvas',()=>0,()=>now),host=r.add('host');r.add('guest');r.start();r.choose(host.id,r.candidates[0].id);
 const fill=()=>({canvasEpoch:r.canvas.epoch,round:1,batchId:randomUUID(),strokeId:randomUUID(),tool:'fill',color:'#123456',size:4,points:[[5,5]]});
 const first=fill(),accepted=r.addStroke(host.id,first);assert.equal(accepted.quota.usedFills,1);assert.equal(r.addStroke(host.id,first).duplicate,true);assert.equal(r.canvasQuota().usedFills,1);
 r.addStroke(host.id,fill());assert.throws(()=>r.addStroke(host.id,fill()),e=>e.code==='DRAW_RATE_LIMIT');
 r.canvasCommand(host.id,{canvasEpoch:r.canvas.epoch,round:1,command:'undo'});r.canvasCommand(host.id,{canvasEpoch:r.canvas.epoch,round:1,command:'clear'});assert.throws(()=>r.canvasCommand(host.id,{canvasEpoch:r.canvas.epoch,round:1,command:'clear'}),e=>e.code==='DRAW_COMMAND_RATE_LIMIT');
 assert.equal(r.canvasQuota().usedFills,2);
 for(let i=2;i<48;i++){now+=1001;r.addStroke(host.id,fill());r.canvasCommand(host.id,{canvasEpoch:r.canvas.epoch,round:1,command:'clear'});}
 now+=1001;assert.throws(()=>r.addStroke(host.id,fill()),e=>e.code==='DRAW_WORK_LIMIT');assert.equal(r.canvas.strokes.length,0);assert.equal(r.canvasQuota().usedBatches,48);
 const brush=fill();brush.tool='brush';r.addStroke(host.id,brush);assert.equal(r.canvasSnapshot().limits.maxFills,48);
});

test('canvas total point and deduplication budgets survive clearing every batch',()=>{
 let now=1000000;const r=new DrawGuessRoom('A0A132','canvas',()=>0,()=>now),host=r.add('host');r.add('guest');r.start();r.choose(host.id,r.candidates[0].id);
 r.deadline=now+600000;
 const batch=()=>({canvasEpoch:r.canvas.epoch,round:1,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:4,points:Array.from({length:64},()=>[5,5])});
 for(let i=0;i<468;i++){now+=1001;r.addStroke(host.id,batch());r.canvasCommand(host.id,{canvasEpoch:r.canvas.epoch,round:1,command:'clear'});}
 now+=1001;assert.throws(()=>r.addStroke(host.id,batch()),e=>e.code==='DRAW_WORK_LIMIT');assert.equal(r.canvasQuota().usedPoints,29952);assert.equal(r.canvas.strokes.length,0);
});

test('HTTP repeated membership changes are bounded; reconnect is idempotent and kicked users cannot reclaim a seat',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-resource-http-')),config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile),auth=createAuth(db);await auth.bootstrap('resourceadmin','test-password-88888888');
 const admin=db.prepare("SELECT * FROM users WHERE username='resourceadmin'").get();
 for(const username of ['resourceguest','resourcethird'])await auth.register({username,displayName:username,password:'test-password-88888888',confirmPassword:'test-password-88888888',invite:auth.createInvite(admin,{days:1}).code},{setHeader(){}});
 db.close();const app=createApp(config);t.after(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true});});
 const {port}=await app.listen(),base='http://127.0.0.1:'+port;
 async function post(route,cookie,data){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const host=(await post('auth/login',null,{username:'resourceadmin',password:'test-password-88888888'})).cookie,guest=(await post('auth/login',null,{username:'resourceguest',password:'test-password-88888888'})).cookie,third=(await post('auth/login',null,{username:'resourcethird',password:'test-password-88888888'})).cookie;
 const {code}=(await post('create',host,{type:'draw'})).body;
 const state=async cookie=>(await fetch(base+'/api/state?code='+code,{headers:{Cookie:cookie}})).json();
 assert.equal((await post('join',guest,{code})).status,200);assert.equal((await post('join',third,{code})).status,200);
 for(let i=0;i<50;i++)assert.equal((await post('join',guest,{code})).status,200);
 assert.equal((await state(host)).players.length,3);
 await post('start',host,{code});let guestId=(await state(guest)).me;
 assert.equal((await post('leave',guest,{code})).status,200);assert.equal((await post('join',guest,{code})).status,200);assert.equal((await state(guest)).me,guestId);
 assert.equal((await state(host)).players.length,3);
 assert.equal((await post('kick',host,{code,playerId:guestId,confirmed:true})).status,200);assert.equal((await post('join',guest,{code})).body.code,'KICKED');
 const gift=(await post('create',host,{type:'gift'})).body.code;
 let rejected;
 for(let i=0;i<40;i++){const join=await post('join',third,{code:gift});if(join.status===429){rejected=join;break;}assert.equal(join.status,200);const leave=await post('leave',third,{code:gift});if(leave.status===429){rejected=leave;break;}assert.equal(leave.status,200);}
 assert.equal(rejected?.body.code,'RATE_LIMITED');assert.ok((await fetch(base+'/api/state?code='+gift,{headers:{Cookie:host}}).then(r=>r.json())).players.length<=2);
 const archiveFiles=fs.readdirSync(config.historyDir).filter(f=>f.endsWith('.jsonl'));const bytes=archiveFiles.reduce((sum,file)=>sum+fs.statSync(path.join(config.historyDir,file)).size,0);
 for(let i=0;i<10;i++)assert.equal((await post('join',third,{code:gift})).status,429);
 assert.equal(archiveFiles.reduce((sum,file)=>sum+fs.statSync(path.join(config.historyDir,file)).size,0),bytes);
 // A real I/O failure can occur before or after an action. Everyone still
 // gets to leave; remaining state explains that the history is incomplete.
 const write=t.mock.method(HistoryStore.prototype,'appendText',()=>{throw Object.assign(Error('simulated full disk'),{code:'ENOSPC'});});t.mock.method(console,'error',()=>{});
 const departed=await post('leave',host,{code});assert.equal(departed.status,200);assert.equal(departed.body.historyPersisted,false);assert.equal(departed.body.deleted,false);
 const paused=await state(third);assert.equal(paused.host,true);assert.equal(paused.historyWarning.code,'HISTORY_WRITE_FAILED');assert.equal(paused.players.length,1);
 const last=await post('leave',third,{code});assert.equal(last.status,200);assert.equal(last.body.deleted,true);assert.equal(last.body.historyPersisted,false);
 assert.equal((await post('reconnect',third,{code})).status,404);
 write.mock.restore();const healthy=await post('create',host,{type:'draw'});assert.equal(healthy.status,200);
});
