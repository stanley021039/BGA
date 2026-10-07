const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const run=(ui,source)=>vm.runInContext(source,ui.context),read=(ui,source)=>JSON.parse(JSON.stringify(run(ui,source)));
async function microtasks(){for(let i=0;i<12;i++)await Promise.resolve();}
function fakeClock(){
 let now=0,id=0;const timers=new Map();class Clock extends Date{static now(){return 1000000+now;}}
 return {Date:Clock,now:()=>now,setTimeout(fn,delay=0){const key=++id;timers.set(key,{fn,at:now+Math.max(0,delay)});return key;},clearTimeout:key=>timers.delete(key),timers,
 async advance(ms){const end=now+ms;let limit=10000;await microtasks();while(limit--){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await microtasks();}assert.ok(limit>0);now=end;await microtasks();}};
}
async function setup(t,{realRenderer=false}={}){const clock=fakeClock(),ui=browserHarness({clock,realRenderer,events:true});ui.receive({...drawingState('artist'),serverNow:1000000,deadline:1090000});await microtasks();t.after(()=>ui.listeners.get('window:pagehide')({persisted:false}));return {ui,clock};}
function pointer(ui,type,point,id=1,extra={}){ui.listeners.get('#drawCanvas:'+type)({point,pointerId:id,button:0,preventDefault(){},...extra});}
function accepted(ui,request){const version=run(ui,'canvasVersion')+1,prior=read(ui,'canvasQuota');return {canvasEpoch:request.data.canvasEpoch,round:request.data.round,version,stroke:{...request.data,version},quota:{usedFills:prior.usedFills+(request.data.tool==='fill'?1:0),usedBatches:prior.usedBatches+1,usedPoints:prior.usedPoints+request.data.points.length}};}
async function acknowledge(ui,request){request.resolve(accepted(ui,request));await microtasks();}
const pointsOf=ui=>ui.strokeRequests.flatMap((request,index)=>index?request.data.points.slice(1):request.data.points).map(point=>[...point]);

for(const count of [3,25])test(count+' held points flush at 140ms without another move or frame',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[0,20]);for(let i=1;i<count;i++)pointer(ui,'pointermove',[i,20]);
 assert.equal(ui.pendingFrames(),1);await clock.advance(139);assert.equal(ui.strokeRequests.length,0);await clock.advance(1);
 assert.equal(ui.strokeRequests.length,1);assert.equal(ui.strokeRequests[0].startedAt,140);assert.equal(ui.strokeRequests[0].data.points.length,count);
 await acknowledge(ui,ui.strokeRequests[0]);await clock.advance(500);assert.equal(ui.strokeRequests.length,1,'anchor alone never creates a new batch');
 pointer(ui,'pointerup',[count-1,20]);assert.equal(ui.pendingFrames(),0);
});

test('multiple moves and coalesced corners use one rect per event and one preview per frame',async t=>{
 const {ui}=await setup(t);const before=ui.frames.length;
 pointer(ui,'pointerdown',[1,1]);const reads=ui.rectReads();
 pointer(ui,'pointermove',[90,90],1,{getCoalescedEvents:()=>[{pointerId:1,point:[1.5,1.5]},{pointerId:1,point:[20,1]},{pointerId:2,point:[99,99]},{pointerId:1,point:[20,20]}]});
 pointer(ui,'pointermove',[21,20],1,{getCoalescedEvents:()=>[]});pointer(ui,'pointermove',[21,21],1,{getCoalescedEvents(){throw Error('unsupported');}});
 assert.equal(ui.rectReads()-reads,3);assert.equal(ui.frames.length,before);assert.equal(ui.pendingFrames(),1);ui.paintFrame();assert.equal(ui.frames.length,before+1);
 assert.deepEqual(read(ui,'active.points'),[[1,1],[20,1],[20,20],[21,20],[21,21]],'coalesced list replaces its summary parent and integer neighbours dedupe');
 pointer(ui,'pointermove',[40,40],2);pointer(ui,'pointerup',[45,45],2);assert.equal(ui.pendingFrames(),0);assert.equal(run(ui,'active.pointerId'),1);
 pointer(ui,'pointerup',[30,25]);assert.deepEqual(read(ui,'[...localStrokes.values()][0].points').at(-1),[30,25]);assert.equal(ui.pendingFrames(),0);assert.equal(ui.frames.length,before+2);
});

test('pointercancel preserves received points without drawing a synthetic cancellation corner',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointermove',[2,2]);pointer(ui,'pointercancel',[40,40]);await clock.advance(0);
 assert.deepEqual(Array.from(ui.strokeRequests[0].data.points,point=>[...point]),[[1,1],[2,2]]);assert.equal(ui.pendingFrames(),0);assert.equal(run(ui,'strokeFlushTimer'),null);
});

test('lost capture finishes once without collecting its coordinate; decoration settings do not block preview',async t=>{
 const {ui,clock}=await setup(t);run(ui,'window.MotionPolicy.set({enabled:false})');pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointermove',[2,2]);ui.paintFrame();
 assert.deepEqual(ui.frames.at(-1).strokes[0].points,[[1,1],[2,2]]);ui.listeners.get('#drawCanvas:lostpointercapture')({type:'lostpointercapture',pointerId:1,clientX:50,clientY:50,preventDefault(){}});pointer(ui,'pointerup',[60,60]);await clock.advance(0);
 assert.deepEqual(Array.from(ui.strokeRequests[0].data.points,point=>[...point]),[[1,1],[2,2]]);assert.equal(ui.strokeRequests.length,1);
});

test('an active-stroke command requests release first, and same-epoch reveal cancels unsent work',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointermove',[2,2]);await run(ui,'command("undo")');assert.equal(ui.commandRequests.length,0);assert.match(ui.element('#toast').textContent,/先完成/);assert.equal(run(ui,'canvasCommandBusy'),false);
 await clock.advance(140);const old=ui.strokeRequests[0];pointer(ui,'pointermove',[3,3]);await clock.advance(140);assert.equal(read(ui,'drawingTransport.metrics()').pendingEntries,1);
 ui.receive({...drawingState('artist'),phase:'reveal',version:3,serverNow:1000280});await microtasks();assert.equal(old.signal.aborted,true);assert.equal(run(ui,'strokeFlushTimer'),null);assert.equal(ui.pendingFrames(),0);await clock.advance(30000);assert.equal(ui.strokeRequests.length,1);
});

for(const latency of [20,200,400])test('single in-flight and complete anchored batches under '+latency+'ms ACK latency',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[0,10]);let settled=0;
 for(let i=1;i<=180;i++){
  pointer(ui,'pointermove',[i,10]);await clock.advance(5);
  const request=ui.strokeRequests[settled];if(request&&clock.now()-request.startedAt>=latency){await acknowledge(ui,request);settled++;}
  assert.ok(ui.strokeRequests.length-settled<=1);const metrics=read(ui,'drawingTransport.metrics()');assert.ok(metrics.pendingPoints<=30000);assert.ok(metrics.pendingEntries<=1);
 }
 pointer(ui,'pointerup',[181,10]);
 let limit=20;while(run(ui,'[...localStrokes.values()].some(draft=>draft.pendingBatches)')&&limit--){await clock.advance(latency+115);const request=ui.strokeRequests[settled];if(request){await acknowledge(ui,request);settled++;}}
 assert.ok(limit>0);assert.equal(run(ui,'localStrokes.size'),0);assert.deepEqual(pointsOf(ui),Array.from({length:182},(_,i)=>[i,10]));
 for(let i=0;i<ui.strokeRequests.length;i++){const request=ui.strokeRequests[i];assert.ok(request.data.points.length<=64);if(i){assert.ok(request.startedAt-ui.strokeRequests[i-1].startedAt>=115);assert.deepEqual([...request.data.points[0]],[...ui.strokeRequests[i-1].data.points.at(-1)]);}}
});

test('slow in-flight work coalesces unsent points while the prepared ID and body remain frozen',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[0,10]);for(let i=1;i<40;i++)pointer(ui,'pointermove',[i,10]);await clock.advance(0);
 const first=ui.strokeRequests[0],body=JSON.stringify(first.data);for(let i=40;i<=220;i++){pointer(ui,'pointermove',[i,10]);await clock.advance(4);}
 assert.equal(ui.strokeRequests.length,1);assert.equal(JSON.stringify(first.data),body);assert.ok(Object.isFrozen(first.data));assert.ok(Object.isFrozen(first.data.points[0]));
 const metrics=read(ui,'drawingTransport.metrics()');assert.equal(metrics.pendingEntries,1);assert.ok(metrics.pendingPoints>64);assert.ok(metrics.pendingBytes<30000*10+1000*512);assert.ok(metrics.oldestAgeMs>=700);
 pointer(ui,'pointerup',[221,10]);await acknowledge(ui,first);await clock.advance(0);assert.equal(ui.strokeRequests[1].data.points.length,64);
});

test('jitter and transient 429/500 retries keep one request and the exact prepared body',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointerup',[2,2]);await clock.advance(0);const original=JSON.stringify(ui.strokeRequests[0].data);
 pointer(ui,'pointerdown',[30,30],2);pointer(ui,'pointerup',[31,31],2);
 ui.strokeRequests[0].reject(Object.assign(Error('rate'),{status:429,code:'DRAW_RATE_LIMIT'}));await microtasks();await clock.advance(999);assert.equal(ui.strokeRequests.length,1);await clock.advance(1);assert.equal(JSON.stringify(ui.strokeRequests[1].data),original);
 ui.strokeRequests[1].reject(Object.assign(Error('server'),{status:500}));await microtasks();await clock.advance(1999);assert.equal(ui.strokeRequests.length,2);await clock.advance(1);assert.equal(JSON.stringify(ui.strokeRequests[2].data),original);
 await clock.advance(37);await acknowledge(ui,ui.strokeRequests[2]);await clock.advance(115);assert.equal(ui.strokeRequests.length,4);assert.notEqual(ui.strokeRequests[3].data.batchId,ui.strokeRequests[0].data.batchId);assert.equal(ui.strokeRequests[3].data.points[0][0],30);
});

test('work-limit and exhausted retries explicitly cancel unsent work and recover without replay',async t=>{
 for(const permanent of [true,false]){
  const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointerup',[2,2]);await clock.advance(0);pointer(ui,'pointerdown',[30,30],2);pointer(ui,'pointerup',[31,31],2);
  ui.strokeRequests[0].reject(Object.assign(Error('refused'),{status:permanent?429:500,code:permanent?'DRAW_WORK_LIMIT':'SERVER_ERROR'}));await microtasks();
  if(!permanent){await clock.advance(1000);ui.strokeRequests[1].reject(Object.assign(Error('refused'),{status:500}));await microtasks();await clock.advance(2000);ui.strokeRequests[2].reject(Object.assign(Error('refused'),{status:500}));await microtasks();}
  await run(ui,'sendQueue');assert.equal(ui.strokeRequests.length,permanent?1:3);assert.equal(run(ui,'localStrokes.size'),0);assert.equal(read(ui,'drawingTransport.metrics()').pendingPoints,0);assert.match(ui.element('#drawStatus').textContent,/尚未同步.*取消/);
 }
});

test('timeout aborts with a bounded same-body retry; new epoch discards timers, frames and late ACK',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointerup',[2,2]);await clock.advance(0);const old=ui.strokeRequests[0],body=JSON.stringify(old.data);
 await clock.advance(10000);assert.equal(old.signal.aborted,true);assert.equal(old.signal.reason.name,'TimeoutError');await clock.advance(1000);assert.equal(JSON.stringify(ui.strokeRequests[1].data),body);
 pointer(ui,'pointerdown',[30,30],2);pointer(ui,'pointermove',[31,31],2);const epoch=CANVAS_EPOCH.replace(/1$/,'2'),next={...drawingState('artist'),version:3,canvasEpoch:epoch,serverNow:1011000};ui.setSnapshot({canvasEpoch:epoch,round:1,version:0,strokes:[]});ui.receive(next);await microtasks();
 assert.equal(ui.pendingFrames(),0);assert.equal(run(ui,'strokeFlushTimer'),null);assert.equal(ui.strokeRequests[1].signal.aborted,true);old.resolve(accepted(ui,old));await clock.advance(30000);assert.equal(run(ui,'canvasVersion'),0);assert.equal(run(ui,'localStrokes.size'),0);assert.equal(ui.strokeRequests.length,2);
 pointer(ui,'pointerdown',[40,40],3);pointer(ui,'pointerup',[41,41],3);await clock.advance(0);assert.equal(ui.strokeRequests[2].data.canvasEpoch,epoch);
});

test('shape/fill/style order and command barrier remain independent of frames in a hidden document',async t=>{
 const {ui,clock}=await setup(t);run(ui,'tool="line"');pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointermove',[3,3]);await clock.advance(1000);assert.equal(ui.strokeRequests.length,0);pointer(ui,'pointerup',[4,4]);await clock.advance(0);
 run(ui,'tool="fill"');pointer(ui,'pointerdown',[5,5],2);assert.equal(read(ui,'drawingTransport.metrics()').pendingEntries,1);
 run(ui,'tool="brush"');ui.element('#color').value='#ff0000';pointer(ui,'pointerdown',[6,6],3);pointer(ui,'pointermove',[7,7],3);
 ui.context.document.hidden=true;ui.context.document.visibilityState='hidden';ui.listeners.get('document:visibilitychange')();assert.equal(ui.pendingFrames(),0);assert.equal(run(ui,'active'),null);
 const command=run(ui,'command("undo")');await microtasks();assert.equal(ui.commandRequests.length,0);
 for(let i=0;i<3;i++){await acknowledge(ui,ui.strokeRequests[i]);await clock.advance(500);}
 await command;assert.deepEqual(ui.strokeRequests.map(request=>request.data.tool),['line','fill','brush']);assert.deepEqual(Array.from(ui.strokeRequests[0].data.points,point=>[...point]),[[1,1],[4,4]]);assert.equal(ui.commandRequests[0].command,'undo');
});

test('buffer capacity fails explicitly instead of creating an unbounded chain; pagehide cancels pacing',async t=>{
 const {ui,clock}=await setup(t);run(ui,'lastSentAt=drawNow();queueStroke([[1,1]],StrokeCanvas.strokeId(),"brush")');await clock.advance(0);assert.equal(ui.strokeRequests.length,0);ui.listeners.get('window:pagehide')({persisted:true});await clock.advance(200);assert.equal(ui.strokeRequests.length,0);assert.equal(ui.pendingFrames(),0);
 ui.context.jobs=[];run(ui,'small=window.DrawTransport.create({send:()=>new Promise(()=>{}),createId:()=>StrokeCanvas.strokeId(),isCurrent:()=>true,now:drawNow,maxPoints:4,maxEntries:2,onError:()=>{},onStart:()=>{}})');
 run(ui,'small.enqueue({canvasEpoch:state.canvasEpoch,round:1,strokeId:"a",tool:"brush",color:"#000000",size:1,points:[[1,1],[2,2]]},{});small.enqueue({canvasEpoch:state.canvasEpoch,round:1,strokeId:"b",tool:"brush",color:"#000000",size:1,points:[[3,3],[4,4]]},{})');
 assert.throws(()=>run(ui,'small.enqueue({canvasEpoch:state.canvasEpoch,round:1,strokeId:"c",tool:"brush",points:[[5,5]]},{})'),/尚未同步.*取消/);assert.equal(read(ui,'small.metrics()').pendingPoints,4);run(ui,'small.cancel()');
});

test('reset during retry backoff releases the barrier and never restarts the old request',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointerup',[2,2]);await clock.advance(0);ui.strokeRequests[0].reject(Object.assign(Error('rate'),{status:429,code:'DRAW_RATE_LIMIT'}));await microtasks();
 ui.sources[0].emit('reset',{canvasEpoch:CANVAS_EPOCH,round:1,version:1,strokes:[],quota:{usedFills:0,usedBatches:0,usedPoints:0}});await run(ui,'sendQueue');await clock.advance(5000);assert.equal(ui.strokeRequests.length,1);assert.equal(read(ui,'drawingTransport.metrics()').inFlightPoints,0);assert.equal(run(ui,'localStrokes.size'),0);
});

test('known lifetime quota stops an active time-flush and preserves accepted history',async t=>{
 const {ui,clock}=await setup(t);pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointermove',[2,2]);run(ui,'canvasQuota.usedBatches=1000');await clock.advance(140);
 assert.equal(run(ui,'active'),null);assert.equal(ui.pendingFrames(),0);assert.equal(run(ui,'strokeFlushTimer'),null);assert.equal(ui.strokeRequests.length,0);assert.match(ui.element('#drawStatus').textContent,/額度.*尚未同步.*取消/);assert.equal(run(ui,'canvasQuota.usedBatches'),1000);
 pointer(ui,'pointermove',[20,20]);await clock.advance(500);assert.equal(ui.strokeRequests.length,0);
});

test('snapshot timeout releases ACK drain, and superseded old finally cannot clear the new GET',async t=>{
 const {ui,clock}=await setup(t),original=ui.context.RoomApi.request,requests=[];
 ui.context.RoomApi.request=(route,data,options)=>route==='draw/canvas'?new Promise(resolve=>requests.push({resolve,signal:options.signal})):original(route,data,options);
 pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointerup',[2,2]);await clock.advance(0);ui.strokeRequests[0].resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:1});await microtasks();assert.equal(requests.length,1);
 await clock.advance(10000);await run(ui,'sendQueue');assert.equal(requests[0].signal.reason.name,'TimeoutError');assert.match(ui.element('#connection').textContent,/同步逾時/);
 const oldSync=run(ui,'syncCanvas()');assert.equal(requests.length,2);const nextEpoch=CANVAS_EPOCH.replace(/1$/,'2');ui.receive({...drawingState('artist'),version:3,canvasEpoch:nextEpoch,serverNow:1010000});assert.equal(requests.length,3,'new epoch starts its own GET without waiting ten seconds');const latest=run(ui,'syncPromise');await oldSync;assert.equal(run(ui,'syncPromise'),latest);
 requests[1].resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:5,strokes:[]});await microtasks();assert.equal(run(ui,'syncPromise'),latest);assert.equal(run(ui,'canvasVersion'),-1);
 requests[2].resolve({canvasEpoch:nextEpoch,round:1,version:0,strokes:[]});await latest;assert.equal(run(ui,'canvasVersion'),0);assert.equal(run(ui,'syncPromise'),null);assert.doesNotMatch(ui.element('#connection').textContent,/同步逾時/);
});

test('a quota-exhausting SSE before a lost ACK still permits exact-ID deduplication retry',async t=>{
 const {ui,clock}=await setup(t);run(ui,'canvasQuota.usedPoints=29998;canvasQuota.usedBatches=999');pointer(ui,'pointerdown',[1,1]);pointer(ui,'pointerup',[2,2]);await clock.advance(0);const first=ui.strokeRequests[0],result=accepted(ui,first),body=JSON.stringify(first.data);ui.sources[0].emit('stroke',result);
 assert.equal(run(ui,'canvasQuota.usedPoints'),30000);first.reject(new TypeError('network interrupted'));await microtasks();await clock.advance(1000);assert.equal(ui.strokeRequests.length,2);assert.equal(JSON.stringify(ui.strokeRequests[1].data),body);ui.strokeRequests[1].resolve({...result,duplicate:true});await run(ui,'sendQueue');assert.equal(run(ui,'canvasQuota.usedBatches'),1000);assert.equal(run(ui,'strokes.length'),1);assert.equal(run(ui,'localStrokes.size'),0);
});

test('consecutive fills respect the 500ms start interval independently of flush/frame pacing',async t=>{
 const {ui,clock}=await setup(t);run(ui,'tool="fill"');pointer(ui,'pointerdown',[1,1]);await clock.advance(0);await acknowledge(ui,ui.strokeRequests[0]);pointer(ui,'pointerdown',[2,2],2);await clock.advance(499);assert.equal(ui.strokeRequests.length,1);await clock.advance(1);assert.equal(ui.strokeRequests.length,2);assert.equal(ui.strokeRequests[1].startedAt-ui.strokeRequests[0].startedAt,500);
});
