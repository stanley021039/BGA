const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DrawGuessRoom,MAX_POINT_TIME_MS}=require('../src/games/draw-guess');
const {snapshot:historySnapshot}=require('../src/history/store');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
function game(){let now=100000;const room=new DrawGuessRoom('ABC123','timing',()=>0,()=>now),host=room.add('Artist'),guest=room.add('Viewer');room.start();room.choose(host.id,room.candidates[0].id);return {room,host,guest,advance:ms=>now+=ms};}
function batch(room,extra={}){return {round:room.round,canvasEpoch:room.canvas.epoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:6,points:[[10,10],[20,20]],...extra};}
const canvasState=room=>JSON.stringify({...room.canvas,batchIds:[...room.canvas.batchIds]});

test('brush and white erase accept bounded nondecreasing optional milliseconds with unchanged geometry and quotas',()=>{
 const {room,host}=game();assert.equal(MAX_POINT_TIME_MS,120000);
 for(const [index,tool] of ['brush','erase'].entries()){
  const data=batch(room,{tool,pointTimes:index?[MAX_POINT_TIME_MS,MAX_POINT_TIME_MS]:[0,MAX_POINT_TIME_MS]}),result=room.addStroke(host.id,data);
  assert.deepEqual(result.stroke.pointTimes,data.pointTimes);assert.deepEqual(result.stroke.points,data.points);assert.deepEqual(result.quota,{usedFills:0,usedBatches:index+1,usedPoints:(index+1)*2});
 }
 const dot=room.addStroke(host.id,batch(room,{points:[[0,0]],pointTimes:[0]}));assert.deepEqual(dot.stroke.pointTimes,[0]);assert.deepEqual(dot.quota,{usedFills:0,usedBatches:3,usedPoints:5});
});
test('legacy chunks remain unchanged and timing remains optional across chunks of the same stroke',()=>{
 const {room,host}=game(),strokeId=randomUUID();
 const first=room.addStroke(host.id,batch(room,{strokeId,pointTimes:[0,40]}));
 const legacy=room.addStroke(host.id,batch(room,{strokeId,points:[[20,20],[30,30]]}));
 const timed=room.addStroke(host.id,batch(room,{strokeId,points:[[30,30],[40,40]],pointTimes:[40,95]}));
 assert.equal(Object.hasOwn(legacy.stroke,'pointTimes'),false);assert.deepEqual(first.stroke.pointTimes,[0,40]);assert.deepEqual(timed.stroke.pointTimes,[40,95]);
 for(const tool of ['line','rect','ellipse','fill']){const result=room.addStroke(host.id,batch(room,{tool,points:tool==='fill'?[[1,1]]:[[1,1],[5,5]]}));assert.equal(Object.hasOwn(result.stroke,'pointTimes'),false);}
});
test('malformed timing is rejected before any canvas, accepted-ID, rate or quota mutation',()=>{
 const {room,host}=game(),sparse=Array(2);sparse[0]=0;
 const invalid=[null,{},'0,1',[],[0],[0,1,2],[0,-1],[0,MAX_POINT_TIME_MS+1],[0,1.5],[0,NaN],[0,Infinity],[2,1],[0,Number.MAX_SAFE_INTEGER+1],sparse];
 for(const pointTimes of invalid){const before=canvasState(room);assert.throws(()=>room.addStroke(host.id,batch(room,{pointTimes})),/時間格式/);assert.equal(canvasState(room),before);}
 for(const tool of ['line','rect','ellipse','fill']){const before=canvasState(room);assert.throws(()=>room.addStroke(host.id,batch(room,{tool,points:tool==='fill'?[[1,1]]:[[1,1],[5,5]],pointTimes:tool==='fill'?[0]:[0,1]})),/時間格式/);assert.equal(canvasState(room),before);}
});
test('accepted timing and geometry cannot alias request, canvas snapshot or frozen public result arrays',()=>{
 const {room,host}=game(),data=batch(room,{pointTimes:[0,40]}),result=room.addStroke(host.id,data);
 assert.notEqual(result.stroke.pointTimes,data.pointTimes);assert.notEqual(result.stroke.points,data.points);assert.notEqual(result.stroke.points[0],data.points[0]);data.pointTimes[0]=20;data.points[0][0]=99;
 assert.deepEqual(result.stroke.pointTimes,[0,40]);assert.deepEqual(result.stroke.points,[[10,10],[20,20]]);const canvas=room.canvasSnapshot();canvas.strokes[0].pointTimes[1]=5;canvas.strokes[0].points[0][0]=98;assert.deepEqual(room.canvas.strokes[0].pointTimes,[0,40]);
 room.reveal();const id=room.result.resultId,publicResult=room.resultSnapshot(id);room.canvas.strokes[0].pointTimes[1]=30;publicResult.canvas.strokes[0].pointTimes[0]=25;assert.deepEqual(room.resultSnapshot(id).canvas.strokes[0].pointTimes,[0,40]);assert.equal(Object.isFrozen(room.publicResults.get(id).snapshot.canvas.strokes[0].pointTimes),true);
 assert.equal(JSON.stringify(room.view(host.id)).includes('pointTimes'),false);assert.equal(JSON.stringify(historySnapshot(room)).includes('pointTimes'),false);
});
test('timing leaves accepted batch deduplication and actor, round, epoch and deadline gates in their original order',()=>{
 const {room,host,guest,advance}=game(),data=batch(room,{pointTimes:[0,40]});room.addStroke(host.id,data);const before=canvasState(room);
 assert.equal(room.addStroke(host.id,{...data,pointTimes:null,points:[]}).duplicate,true);assert.equal(canvasState(room),before);
 assert.throws(()=>room.addStroke(guest.id,data),/畫者/);assert.throws(()=>room.addStroke(host.id,{...data,round:0}),/舊回合/);assert.throws(()=>room.addStroke(host.id,{...data,canvasEpoch:randomUUID()}),/畫布已更新/);assert.equal(canvasState(room),before);
 advance(100000);assert.throws(()=>room.addStroke(host.id,data),/時間已結束/);assert.equal(canvasState(room),before);
});
test('timed samples do not increase rate capacity or refund quotas through undo and clear',()=>{
 const {room,host}=game();for(let index=0;index<10;index++)room.addStroke(host.id,batch(room,{pointTimes:[index,index+1]}));assert.deepEqual(room.canvasQuota(),{usedFills:0,usedBatches:10,usedPoints:20});
 const before=canvasState(room);assert.throws(()=>room.addStroke(host.id,batch(room,{pointTimes:[0,1]})),{code:'DRAW_RATE_LIMIT'});assert.equal(canvasState(room),before);
 room.canvasCommand(host.id,{round:room.round,canvasEpoch:room.canvas.epoch,command:'undo'});room.canvasCommand(host.id,{round:room.round,canvasEpoch:room.canvas.epoch,command:'clear'});assert.deepEqual(room.canvasQuota(),{usedFills:0,usedBatches:10,usedPoints:20});assert.equal(room.canvasSnapshot().strokes.length,0);
});

test('HTTP ACK, live SSE, snapshots and revealed results preserve timing while PNG and history formats stay unchanged',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bga-point-times-')),config={host:'127.0.0.1',port:0,dbFile:path.join(dir,'app.sqlite'),historyDir:path.join(dir,'history'),communityDir:path.join(dir,'community'),externalSideEffectsEnabled:false};
 const db=openDatabase(config.dbFile);try{await createAuth(db).bootstrap('times_host','point-times-password-123');const hash=db.prepare("SELECT password_hash FROM users WHERE username='times_host'").get().password_hash;db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),'times_guest','Viewer',hash,'member',new Date().toISOString());}finally{db.close();}
 const app=createApp(config),abort=new AbortController();t.after(async()=>{abort.abort();await app.close();assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true,force:true});});
 const {port}=await app.listen(),base='http://127.0.0.1:'+port,cookies={};
 async function request(route,who,data){const response=await fetch(base+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 for(const who of ['host','guest']){const response=await request('auth/login',null,{username:'times_'+who,password:'point-times-password-123'});assert.equal(response.status,200);cookies[who]=response.cookie;}
 const created=await request('create','host',{type:'draw'}),code=created.body.code;await request('join','guest',{code});await request('start','host',{code});const choosing=(await request('state?code='+code,'host')).body;assert.equal(choosing.presenterId,choosing.me);const word=choosing.candidates[0];await request('action','host',{code,action:'choose',questionId:word.id});
 const response=await fetch(base+'/api/draw/events?code='+code,{headers:{Cookie:cookies.guest},signal:abort.signal}),reader=response.body.getReader();assert.equal(response.status,200);let buffer='';
 async function event(){for(;;){const split=buffer.indexOf('\n\n');if(split>=0){const text=buffer.slice(0,split);buffer=buffer.slice(split+2);return {kind:text.match(/^event: (.+)/m)[1],data:JSON.parse(text.match(/^data: (.+)/m)[1])};}const value=await reader.read();assert.equal(value.done,false);buffer+=new TextDecoder().decode(value.value);}}
 assert.equal((await event()).kind,'ready');const data={code,round:choosing.round,canvasEpoch:choosing.canvasEpoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:6,points:[[10,10],[20,20]],pointTimes:[0,40]};
 const ack=await request('draw/stroke','host',data);assert.equal(ack.status,200);assert.deepEqual(ack.body.stroke.pointTimes,[0,40]);const streamed=await event();assert.equal(streamed.kind,'stroke');assert.deepEqual(streamed.data,ack.body);
 const duplicate=await request('draw/stroke','host',{...data,pointTimes:null});assert.equal(duplicate.status,200);assert.equal(duplicate.body.duplicate,true);
 const invalid=await request('draw/stroke','host',{...data,batchId:randomUUID(),pointTimes:[20,10]});assert.equal(invalid.status,400);const canvas=(await request('draw/canvas?code='+code,'guest')).body;assert.equal(canvas.strokes.length,1);assert.deepEqual(canvas.strokes[0].pointTimes,[0,40]);assert.deepEqual(canvas.quota,{usedFills:0,usedBatches:1,usedPoints:2});
 const next=await request('draw/stroke','host',{...data,batchId:randomUUID(),points:[[20,20],[30,30]],pointTimes:[40,95]});assert.equal(next.status,200);const nextEvent=await event();assert.equal(nextEvent.data.version,next.body.version);assert.deepEqual(nextEvent.data.stroke.pointTimes,[40,95]);abort.abort();
 await request('action','guest',{code,action:'guess',answer:word.title});const revealed=(await request('state?code='+code,'guest')).body,detail=await request('draw/result?code='+code+'&resultId='+revealed.result.resultId,'guest');assert.equal(detail.status,200);assert.deepEqual(detail.body.canvas.strokes.map(item=>item.pointTimes),[[0,40],[40,95]]);
 const png=fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png')),saved=await request('draw/result/save','guest',{code,resultId:revealed.result.resultId,base64:png.toString('base64')});assert.equal(saved.status,200);assert.equal(saved.body.artwork.mime,'image/png');
 const rows=fs.readdirSync(config.historyDir).filter(name=>name.endsWith('.jsonl')).flatMap(name=>fs.readFileSync(path.join(config.historyDir,name),'utf8').trim().split('\n').map(line=>JSON.parse(line))).filter(row=>['intent','result'].includes(row.kind));assert.equal(JSON.stringify(rows).includes(data.strokeId),false);assert.equal(JSON.stringify(rows).includes('pointTimes'),false);
});
