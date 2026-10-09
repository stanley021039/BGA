const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {leavePlayer}=require('../src/rooms/lifecycle');
const {rejoinPlayer}=require('../src/rooms/membership');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const NEXT_EPOCH=CANVAS_EPOCH.replace(/1$/,'2'),run=(ui,code)=>vm.runInContext(code,ui.context),pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const quota=(usedFills=0,usedBatches=0,usedPoints=0)=>({usedFills,usedBatches,usedPoints});
const snapshot=(epoch,version=0,strokes=[],used=quota())=>({canvasEpoch:epoch,round:1,version,strokes,quota:used});
function result(request,version=1,used=quota(1,1,1)){return {canvasEpoch:request.data.canvasEpoch,round:request.data.round,version,stroke:{...request.data,version},quota:used};}
async function setup(t){const ui=browserHarness({realRenderer:true,events:true});ui.receive(drawingState('artist'));await pause();t.after(()=>clearTimeout(run(ui,'toast.timer')));return ui;}
async function fill(ui,color='#00ff00'){ui.element('#color').value=color;run(ui,'tool="fill";lastSentAt=0;lastFillSentAt=0');ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:1,point:[0,0],preventDefault(){}});ui.paintFrame();await pause();return ui.strokeRequests.at(-1);}
async function restart(ui){const next=drawingState('artist');next.version=3;next.canvasEpoch=NEXT_EPOCH;ui.setSnapshot(snapshot(NEXT_EPOCH));ui.receive(next);await pause();return next;}

test('exhausted canvas quotas reset after leave/rejoin and restarting round one, while stale POSTs fail before deduplication or mutation',async t=>{
 let now=1000000;const room=new DrawGuessRoom('ABC123','epoch',()=>0,()=>now),host=room.add('host'),guest=room.add('guest');room.start();room.choose(host.id,room.candidates[0].id);room.deadline=now+2000000;
 const oldEpoch=room.canvas.epoch;let first;
 for(let index=0;index<1000;index++){
  now+=1001;const data={canvasEpoch:oldEpoch,round:1,batchId:randomUUID(),strokeId:randomUUID(),tool:index<48?'fill':'brush',color:'#ff0000',size:1,points:Array.from({length:index<48?1:index<488?32:31},()=>[5,5])};
  if(!first)first=data;const accepted=room.addStroke(host.id,data);assert.equal(accepted.canvasEpoch,oldEpoch);
 }
 assert.deepEqual(room.canvasQuota(),quota(48,1000,30000));assert.equal(room.addStroke(host.id,first).duplicate,true);
 assert.throws(()=>room.addStroke(host.id,{...first,batchId:randomUUID(),tool:'brush'}),error=>error.code==='DRAW_WORK_LIMIT');
 room.canvasCommand(host.id,{canvasEpoch:oldEpoch,round:1,command:'undo'});room.canvasCommand(host.id,{canvasEpoch:oldEpoch,round:1,command:'clear'});
 assert.equal(room.canvas.epoch,oldEpoch);assert.deepEqual(room.canvasQuota(),quota(48,1000,30000));assert.equal(room.canvasSnapshot().strokes.length,0);
 const ui=browserHarness({realRenderer:true,events:true});t.after(()=>clearTimeout(run(ui,'toast.timer')));ui.setSnapshot(room.canvasSnapshot());ui.receive(room.view(host.id));await pause();
 assert.equal(ui.element('#tools [data-tool="fill"]').disabled,true);assert.equal(run(ui,'canvasQuota.usedBatches'),1000);
 assert.deepEqual(leavePlayer(room,guest.id),{deleted:false});assert.equal(room.phase,'finished');assert.equal(rejoinPlayer(room,guest.id,'guest').id,guest.id);ui.receive(room.view(host.id));
 room.start();room.choose(host.id,room.candidates[0].id);const freshEpoch=room.canvas.epoch;assert.notEqual(freshEpoch,oldEpoch);assert.equal(room.round,1);
 ui.setSnapshot(room.canvasSnapshot());ui.receive(room.view(host.id));await pause();assert.deepEqual(JSON.parse(JSON.stringify(run(ui,'canvasQuota'))),quota());assert.equal(ui.element('#tools [data-tool="fill"]').disabled,false);
 const request=await fill(ui);assert.ok(request);assert.equal(request.data.canvasEpoch,freshEpoch);request.resolve(room.addStroke(host.id,request.data));await run(ui,'sendQueue');assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[0,255,0,255]);
 const reused={...first,canvasEpoch:freshEpoch};const accepted=room.addStroke(host.id,reused);assert.equal(accepted.canvasEpoch,freshEpoch);assert.equal(room.addStroke(host.id,reused).canvasEpoch,freshEpoch);
 const before=room.canvasSnapshot();assert.throws(()=>room.addStroke(host.id,first),/畫布已更新/);assert.throws(()=>room.addStroke(host.id,{...reused,canvasEpoch:undefined}),/畫布已更新/);assert.throws(()=>room.canvasCommand(host.id,{canvasEpoch:oldEpoch,round:1,command:'clear'}),/畫布已更新/);assert.throws(()=>room.canvasCommand(host.id,{round:1,command:'undo'}),/畫布已更新/);
 assert.deepEqual(room.canvasSnapshot(),before);assert.equal(run(ui,'canvasQuota.usedFills'),1);
});

test('old ACK, queued POST, SSE, reset and state cannot restore exhausted quota or overwrite a new round-one draft',async t=>{
 const ui=await setup(t),oldRequest=await fill(ui,'#ff0000');run(ui,'queueStroke([[30,30]],StrokeCanvas.strokeId(),"brush")');const oldQueue=run(ui,'sendQueue');
 ui.sources[0].emit('reset',snapshot(CANVAS_EPOCH,10,[],quota(48,1000,30000)));await restart(ui);assert.equal(run(ui,'canvasQuota.usedFills'),0);
 const fresh=await fill(ui),newResult=result(fresh);assert.equal(ui.strokeRequests.length,2,'new game does not wait for the old ACK');ui.sources[0].emit('stroke',newResult);
 const stale=result(oldRequest,999,quota(48,1000,30000));ui.sources[0].emit('stroke',stale);ui.sources[0].emit('stroke',{...stale,version:0});ui.sources[0].emit('reset',snapshot(CANVAS_EPOCH,1000,[stale.stroke],quota(48,1000,30000)));
 const missing={...stale};delete missing.canvasEpoch;ui.sources[0].emit('stroke',missing);ui.receive({...drawingState('artist'),phase:'finished',version:2});
 oldRequest.resolve(stale);await oldQueue;assert.equal(ui.strokeRequests.length,2,'the old queued brush is discarded before POST');assert.equal(run(ui,'state.canvasEpoch'),NEXT_EPOCH);assert.equal(run(ui,'localStrokes.size'),1,'old finally cannot settle the new draft');assert.equal(run(ui,'canvasQuota.usedFills'),1);
 fresh.resolve(newResult);await run(ui,'sendQueue');assert.equal(run(ui,'localStrokes.size'),0);assert.equal(run(ui,'canvasVersion'),1);assert.equal(ui.element('#tools [data-tool="fill"]').disabled,false);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[0,255,0,255]);
});

test('a new-generation ready and stroke arriving before state are recovered by the later snapshot, without accepting a delayed old snapshot',async t=>{
 const ui=await setup(t),requests=[],original=ui.context.RoomApi.request;ui.context.RoomApi.request=async(route,data)=>route==='draw/canvas'?new Promise(resolve=>requests.push(resolve)):original(route,data);
 run(ui,'syncCanvas()');const newStroke={version:1,strokeId:randomUUID(),tool:'fill',color:'#00ff00',size:1,points:[[0,0]]};
 ui.sources[0].emit('ready',{canvasEpoch:NEXT_EPOCH,round:1,version:1});ui.sources[0].emit('stroke',{canvasEpoch:NEXT_EPOCH,round:1,version:1,stroke:newStroke,quota:quota(1,1,1)});
 assert.equal(requests.length,1);assert.equal(run(ui,'canvasQuota.usedFills'),0);assert.equal(run(ui,'canvasVersion'),0);
 const next=drawingState('artist');next.version=3;next.canvasEpoch=NEXT_EPOCH;next.strokeVersion=1;ui.receive(next);
 requests[0](snapshot(CANVAS_EPOCH,1000,[],quota(48,1000,30000)));await pause();assert.equal(requests.length,2);assert.equal(run(ui,'canvasQuota.usedFills'),0);
 requests[1](snapshot(NEXT_EPOCH,1,[newStroke],quota(1,1,1)));await run(ui,'drawingController.pendingSync');await run(ui,'waitForCanvasRender()');assert.equal(run(ui,'canvasVersion'),1);assert.equal(run(ui,'canDraw()'),true);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[0,255,0,255]);
 const fresh=await fill(ui,'#0000ff');fresh.resolve(result(fresh,2,quota(2,2,2)));await run(ui,'sendQueue');assert.equal(run(ui,'canvasQuota.usedFills'),2);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[0,0,255,255]);
});

test('a delayed old command response and finally cannot reset the new image or unlock a newer command',async t=>{
 const ui=await setup(t),commands=[],original=ui.context.RoomApi.request;ui.context.RoomApi.request=async(route,data)=>route==='draw/command'?new Promise(resolve=>commands.push({data,resolve})):original(route,data);
 const old=run(ui,'command("clear")');await pause();assert.equal(commands[0].data.canvasEpoch,CANVAS_EPOCH);await restart(ui);
 const current=run(ui,'command("undo")');await pause();assert.equal(commands[1].data.canvasEpoch,NEXT_EPOCH);assert.equal(run(ui,'canvasCommandBusy'),true);
 commands[0].resolve(snapshot(CANVAS_EPOCH,1000,[],quota(48,1000,30000)));await old;assert.equal(run(ui,'canvasCommandBusy'),true);assert.equal(run(ui,'canvasQuota.usedFills'),0);assert.equal(run(ui,'canvasVersion'),0);
 commands[1].resolve(snapshot(NEXT_EPOCH,1));await current;assert.equal(run(ui,'canvasCommandBusy'),false);assert.equal(run(ui,'canvasVersion'),1);assert.equal(run(ui,'canDraw()'),true);
});

test('a stroke delayed by the local pacing timer is discarded when its epoch changes before POST',async t=>{
 const ui=await setup(t);run(ui,'lastSentAt=drawNow();queueStroke([[20,20]],StrokeCanvas.strokeId(),"brush")');const old=run(ui,'sendQueue');await pause();assert.equal(ui.strokeRequests.length,0);await restart(ui);await old;assert.equal(ui.strokeRequests.length,0);
 const fresh=await fill(ui);assert.ok(fresh);fresh.resolve(result(fresh));await run(ui,'sendQueue');assert.equal(ui.strokeRequests.length,1);assert.equal(run(ui,'canvasQuota.usedBatches'),1);
});

test('an old stroke rejection cannot show a new-game error, fetch its canvas, or settle the new draft',async t=>{
 const ui=await setup(t),oldRequest=await fill(ui,'#ff0000'),oldQueue=run(ui,'sendQueue'),original=ui.context.RoomApi.request;let reads=0;
 ui.context.RoomApi.request=async(route,data)=>{if(route==='draw/canvas')reads++;return original(route,data);};await restart(ui);const fresh=await fill(ui),before=reads,status=ui.element('#drawStatus').textContent;
 oldRequest.reject(Error('old canvas epoch rejected'));await oldQueue;assert.equal(reads,before);assert.equal(ui.element('#drawStatus').textContent,status);assert.equal(run(ui,'localStrokes.size'),1);assert.equal(run(ui,'canvasQuota.usedFills'),0);
 fresh.resolve(result(fresh));await run(ui,'sendQueue');assert.equal(run(ui,'canvasQuota.usedFills'),1);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[0,255,0,255]);
});
