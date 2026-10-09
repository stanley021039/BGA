const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const run=(ui,source)=>vm.runInContext(source,ui.context),pause=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t){const ui=browserHarness({events:true});ui.receive(drawingState('artist'));await pause();t.after(()=>{ui.listeners.get('window:pagehide')({persisted:false});clearTimeout(run(ui,'toast.timer'));});return ui;}

test('canvas reads coalesce and cancellation cannot let an old completion release the replacement read',async t=>{
 const ui=await fixture(t),reads=[];
 ui.context.RoomApi.request=(_route,_data,options)=>new Promise(resolve=>reads.push({resolve,signal:options.signal}));
 const first=run(ui,'syncCanvas()');assert.equal(run(ui,'syncCanvas()'),first);assert.equal(reads.length,1);
 run(ui,'cancelCanvasSync()');assert.equal(reads[0].signal.aborted,true);
 const replacement=run(ui,'syncCanvas()');await first;assert.equal(reads.length,2);assert.equal(run(ui,'syncCanvas()'),replacement);
 reads[0].resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:999,strokes:[]});await pause();assert.equal(run(ui,'canvasVersion'),0);
 reads[1].resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:1,strokes:[]});await replacement;assert.equal(run(ui,'canvasVersion'),1);
});

test('repeated stream connection uses one source and malformed events share one recovery read',async t=>{
 const ui=await fixture(t);run(ui,'connectEvents();connectEvents()');assert.equal(ui.sources.length,1);
 let resolveRead,reads=0;ui.context.RoomApi.request=()=>{reads++;return new Promise(resolve=>resolveRead=resolve);};
 ui.sources[0].handlers.get('stroke')({data:'invalid'});ui.sources[0].handlers.get('reset')({data:'invalid'});assert.equal(reads,1);
 const pending=run(ui,'syncCanvas()');resolveRead({canvasEpoch:CANVAS_EPOCH,round:1,version:1,strokes:[]});await pending;assert.equal(run(ui,'canvasVersion'),1);
});

test('a busy page suppresses state polling and repeated poll calls coalesce until the response',async t=>{
 const ui=await fixture(t);let calls=0,resolveState;
 ui.context.RoomApi.request=route=>{assert.equal(route,'state');calls++;return new Promise(resolve=>resolveState=resolve);};
 run(ui,'busy=true');await run(ui,'poll()');assert.equal(calls,0);run(ui,'busy=false');
 const pending=run(ui,'poll()');await run(ui,'poll()');assert.equal(calls,1);
 resolveState({...drawingState('artist'),version:3});await pending;assert.equal(run(ui,'state.version'),3);
});

test('pagehide cancels pending state/canvas work and restored page ignores the closed stream',async t=>{
 const ui=await fixture(t),requests=[];
 ui.context.RoomApi.request=(route,_data,options)=>new Promise(resolve=>requests.push({route,resolve,signal:options.signal}));
 const oldPoll=run(ui,'poll()'),oldSync=run(ui,'syncCanvas()'),oldSource=ui.sources[0];
 ui.listeners.get('window:pagehide')({persisted:true});await Promise.all([oldPoll,oldSync]);assert.ok(requests.every(request=>request.signal.aborted));
 ui.listeners.get('window:pageshow')({persisted:true});assert.equal(requests.length,4);
 requests[0].resolve({...drawingState('artist'),version:999});requests[1].resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:999,strokes:[]});
 oldSource.emit('reset',{canvasEpoch:CANVAS_EPOCH,round:1,version:998,strokes:[]});oldSource.emit('error');await pause();
 assert.equal(run(ui,'state.version'),2);assert.equal(run(ui,'canvasVersion'),0);assert.equal(run(ui,'streamDisconnected'),false);
 requests.find((request,index)=>index>=2&&request.route==='draw/canvas').resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:1,strokes:[]});
 requests.find((request,index)=>index>=2&&request.route==='state').resolve({...drawingState('artist'),version:3,strokeVersion:1});await pause();
 assert.equal(run(ui,'state.version'),3);assert.equal(run(ui,'canvasVersion'),1);assert.equal(ui.sources.length,2);
 oldSource.emit('ready',{canvasEpoch:CANVAS_EPOCH,round:1,version:50});assert.equal(requests.length,4);
});
