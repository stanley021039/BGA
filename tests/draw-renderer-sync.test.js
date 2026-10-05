const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState}=require('./helpers/draw-browser.cjs');
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const run=(ui,code)=>vm.runInContext(code,ui.context);
const read=(ui,code)=>JSON.parse(JSON.stringify(run(ui,code)));
const fill=(version,color=version%2?'#ff0000':'#0000ff')=>({version,strokeId:'f0000000-0000-4000-8000-'+String(version).padStart(12,'0'),tool:'fill',color,size:5,filled:false,points:[[0,0]]});
const event=(stroke,quota={usedFills:stroke.version,usedBatches:stroke.version,usedPoints:stroke.version})=>({round:1,version:stroke.version,stroke,quota});
async function setup(t,me='artist'){
 const ui=browserHarness({realRenderer:true,events:true});ui.receive(drawingState(me));await pause();
 t.after(()=>clearTimeout(run(ui,'toast.timer')));return ui;
}
async function beginFill(ui,color='#ff0000'){
 ui.element('#color').value=color;run(ui,'tool="fill";lastSentAt=0;lastFillSentAt=0');
 ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:1,point:[0,0],preventDefault(){}});await pause();
 return ui.strokeRequests.at(-1);
}
function accepted(request,version=1,quota={usedFills:1,usedBatches:1,usedPoints:1}){
 return {round:1,version,stroke:{...request.data,version},quota};
}

test('SSE before HTTP acknowledgement keeps one pending fill and never paints it twice',async t=>{
 const ui=await setup(t),request=await beginFill(ui),result=accepted(request);
 assert.equal(ui.strokeRequests.length,1);assert.equal(run(ui,'localStrokes.size'),1);
 ui.sources[0].emit('stroke',result);
 assert.equal(run(ui,'localStrokes.size'),1,'pending request must remain tracked until HTTP settles');
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),1);
 request.resolve(result);await run(ui,'sendQueue');
 assert.equal(run(ui,'localStrokes.size'),0);assert.equal(run(ui,'canvasVersion'),1);
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),1);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);
});

test('HTTP acknowledgement before SSE applies the new batch once and preserves lifetime quota',async t=>{
 const ui=await setup(t),request=await beginFill(ui),result=accepted(request,1,{usedFills:48,usedBatches:75,usedPoints:600});
 request.resolve(result);await run(ui,'sendQueue');
 ui.sources[0].emit('stroke',result);ui.sources[0].emit('stroke',{...result,version:0});
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),1);
 assert.deepEqual(read(ui,'canvasQuota'),{usedFills:48,usedBatches:75,usedPoints:600});
 assert.equal(ui.element('#tools [data-tool="fill"]').disabled,true);
 await beginFill(ui,'#0000ff');assert.equal(ui.strokeRequests.length,1);
 assert.match(ui.element('#drawStatus').textContent,/填色額度已用完/);
});

test('48 SSE fills take linear work; undo and reconnect retain the consumed fill quota',async t=>{
 const ui=await setup(t,'guest'),strokes=[];
 for(let version=1;version<=48;version++){const stroke=fill(version);strokes.push(stroke);ui.sources[0].emit('stroke',event(stroke));}
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),48);
 assert.equal(run(ui,'canvasRenderer.metrics().filledPixels'),48*512*256);
 assert.ok(run(ui,'canvasRenderer.metrics().checkpointBytes')<=8*1024*1024);
 ui.sources[0].emit('reset',{round:1,version:49,strokes:strokes.slice(0,47),quota:{usedFills:48,usedBatches:48,usedPoints:48}});
 const state=drawingState('artist');state.strokeVersion=49;ui.receive(state);
 ui.setSnapshot({round:1,version:49,strokes:strokes.slice(0,47),quota:{usedFills:48,usedBatches:48,usedPoints:48}});
 await run(ui,'waitForCanvasRender()');
 const before=run(ui,'canvasRenderer.metrics().fillApplications');await run(ui,'syncCanvas()');
 await run(ui,'waitForCanvasRender()');
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),before,'identical reconnect does no pixel replay');
 await beginFill(ui);assert.equal(ui.strokeRequests.length,0);
 assert.equal(run(ui,'canvasQuota.usedFills'),48);assert.equal(run(ui,'strokes.length'),47);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);
});

test('fill click spam is bounded to one optimistic operation and rejection restores the confirmed canvas',async t=>{
 const ui=await setup(t),request=await beginFill(ui);
 for(let i=0;i<25;i++)await beginFill(ui,i%2?'#0000ff':'#ff0000');
 assert.equal(ui.strokeRequests.length,1);assert.equal(run(ui,'localStrokes.size'),1);
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),1);
 assert.match(ui.element('#drawStatus').textContent,/正在同步/);
 request.reject(Error('本輪填色額度已用完'));await run(ui,'sendQueue');await pause();
 assert.equal(run(ui,'localStrokes.size'),0);assert.match(ui.element('#drawStatus').textContent,/額度已用完/);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
});

test('a reset keeps an in-flight request tracked but a late old acknowledgement cannot resurrect it',async t=>{
 const ui=await setup(t),request=await beginFill(ui);
 ui.sources[0].emit('reset',{round:1,version:2,strokes:[],quota:{usedFills:1,usedBatches:1,usedPoints:1}});
 assert.equal(run(ui,'localStrokes.size'),1);assert.equal(run(ui,'[...localStrokes.values()][0].pendingBatches'),1);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
 request.resolve(accepted(request));await run(ui,'sendQueue');
 assert.equal(run(ui,'localStrokes.size'),0);assert.equal(run(ui,'canvasVersion'),2);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
 assert.equal(run(ui,'canvasQuota.usedFills'),1);
});

test('duplicate and out-of-order SSE plus a stale gap snapshot never roll the canvas backwards',async t=>{
 const ui=await setup(t,'guest');let resolveSnapshot;
 ui.context.RoomApi.request=async route=>{assert.equal(route,'draw/canvas');return new Promise(resolve=>resolveSnapshot=resolve);};
 ui.sources[0].emit('stroke',event(fill(2)));
 assert.equal(run(ui,'canvasVersion'),0);
 ui.sources[0].emit('stroke',event(fill(1)));ui.sources[0].emit('stroke',event(fill(2)));
 ui.sources[0].emit('stroke',event(fill(1)));ui.sources[0].emit('stroke',event(fill(2)));
 resolveSnapshot({round:1,version:1,strokes:[fill(1)]});await run(ui,'syncPromise');
 assert.equal(run(ui,'canvasVersion'),2);assert.equal(run(ui,'strokes.length'),2);
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),2);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[0,0,255,255]);
});

test('a delayed snapshot from the old round is discarded and the new round is fetched',async t=>{
 const ui=await setup(t,'guest'),requests=[];
 ui.context.RoomApi.request=async route=>{assert.equal(route,'draw/canvas');return new Promise(resolve=>requests.push(resolve));};
 run(ui,'syncCanvas()');const next=drawingState('guest');next.round=2;next.strokeVersion=0;ui.receive(next);
 requests[0]({round:1,version:1,strokes:[fill(1)]});await pause();
 assert.equal(requests.length,2);assert.equal(run(ui,'canvasVersion'),-1);
 requests[1]({round:2,version:0,strokes:[],quota:{usedFills:0,usedBatches:0,usedPoints:0}});await run(ui,'syncPromise');
 assert.equal(run(ui,'canvasRound'),2);assert.equal(run(ui,'canvasVersion'),0);
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),0);
});

test('an excessive fill snapshot or SSE batch is rejected before changing accepted history',async t=>{
 const ui=await setup(t,'guest'),strokes=Array.from({length:48},(_,index)=>fill(index+1));
 ui.context.injected={round:1,version:48,strokes,quota:{usedFills:48,usedBatches:48,usedPoints:48}};
 run(ui,'applyCanvasSnapshot(injected)');await run(ui,'waitForCanvasRender()');const before=run(ui,'canvasRenderer.metrics().fillApplications');
 ui.sources[0].emit('stroke',event(fill(49)));await pause();
 assert.equal(run(ui,'canvasVersion'),48);assert.equal(run(ui,'strokes.length'),48);
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),before);
 ui.context.injected={round:1,version:49,strokes:[...strokes,fill(49)]};
 assert.throws(()=>run(ui,'applyCanvasSnapshot(injected)'),/同步上限/);
 assert.equal(run(ui,'canvasVersion'),48);
});

test('undo quota blocks more fills while ordinary brush remains available',async t=>{
 const ui=await setup(t);ui.sources[0].emit('reset',{round:1,version:1,strokes:[],quota:{usedFills:48,usedBatches:80,usedPoints:800}});
 await beginFill(ui);assert.equal(ui.strokeRequests.length,0);
 run(ui,'tool="brush";lastSentAt=0');ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:2,point:[20,20],preventDefault(){}});
 ui.listeners.get('#drawCanvas:pointerup')({pointerId:2,preventDefault(){}});await pause();
 assert.equal(ui.strokeRequests.length,1);assert.equal(ui.strokeRequests[0].data.tool,'brush');
 const request=ui.strokeRequests[0];request.resolve(accepted(request,2,{usedFills:48,usedBatches:81,usedPoints:801}));await run(ui,'sendQueue');
 assert.equal(run(ui,'localStrokes.size'),0);
});

test('confirmed partial brush batches preserve the active optimistic tail without replaying prior fills',async t=>{
 const ui=await setup(t);ui.sources[0].emit('stroke',event(fill(1)));
 run(ui,'tool="brush";lastSentAt=0');ui.element('#color').value='#000000';
 ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:2,point:[20,20],preventDefault(){}});
 for(let i=1;i<40;i++)ui.listeners.get('#drawCanvas:pointermove')({pointerId:2,point:[20+i,20],preventDefault(){}});
 await pause();const first=ui.strokeRequests[0],firstResult=accepted(first,2,{usedFills:1,usedBatches:2,usedPoints:41});
 ui.sources[0].emit('stroke',firstResult);first.resolve(firstResult);await run(ui,'sendQueue');
 assert.equal(run(ui,'localStrokes.size'),1);assert.equal(run(ui,'active.finished'),false);
 ui.listeners.get('#drawCanvas:pointermove')({pointerId:2,point:[65,25],preventDefault(){}});
 ui.listeners.get('#drawCanvas:pointerup')({pointerId:2,preventDefault(){}});
 await new Promise(resolve=>setTimeout(resolve,130));const second=ui.strokeRequests[1];assert.ok(second);
 assert.deepEqual(ui.element('#drawCanvas').pixel(65,25),[0,0,0,255]);
 second.resolve(accepted(second,3,{usedFills:1,usedBatches:3,usedPoints:43}));await run(ui,'sendQueue');
 assert.equal(run(ui,'localStrokes.size'),0);assert.equal(run(ui,'strokes.length'),3);
 assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),1);
 assert.deepEqual(ui.element('#drawCanvas').pixel(65,25),[0,0,0,255]);
});

test('an SSE batch exceeding the aggregate point budget is rejected before painting',async t=>{
 const ui=await setup(t,'guest');
 const strokes=Array.from({length:469},(_,index)=>({...fill(index+1),tool:'brush',points:Array.from({length:index===468?48:64},()=>[10,10])}));
 ui.context.injected={round:1,version:469,strokes};run(ui,'applyCanvasSnapshot(injected)');await run(ui,'waitForCanvasRender()');
 const before=run(ui,'canvasRenderer.metrics().strokeApplications');
 ui.sources[0].emit('stroke',event({...fill(470),tool:'brush',points:[[11,11]]},{usedFills:0,usedBatches:470,usedPoints:30000}));await pause();
 assert.equal(run(ui,'canvasVersion'),469);assert.equal(run(ui,'canvasTotals.points'),30000);
 assert.equal(run(ui,'canvasRenderer.metrics().strokeApplications'),before);
});
