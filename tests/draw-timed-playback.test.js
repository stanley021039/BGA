const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const run=(ui,code)=>vm.runInContext(code,ui.context),read=(ui,code)=>JSON.parse(JSON.stringify(run(ui,code)));
async function microtasks(){for(let i=0;i<20;i++)await Promise.resolve();}
function clock(){let time=0,id=0;const timers=new Map();return {now:()=>time,setTimeout(fn,delay){const key=++id;timers.set(key,{fn,at:time+delay});return key;},clearTimeout:key=>timers.delete(key),async advance(ms){const end=time+ms;await microtasks();for(let i=0;i<1000;i++){const entry=[...timers].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;const [key,job]=entry;time=job.at;timers.delete(key);job.fn();await microtasks();}time=end;await microtasks();}};}
async function setup(t,me='guest'){const time=clock(),ui=browserHarness({clock:time,events:true});ui.receive(drawingState(me));await microtasks();t.after(()=>ui.listeners.get('window:pagehide')({persisted:false}));return {ui,time};}
function batch(version,points,times,id='12345678-1234-4123-8123-123456789abc',tool='brush'){return {canvasEpoch:CANVAS_EPOCH,round:1,version,stroke:{version,strokeId:id,tool,color:'#000000',size:3,points,...(times?{pointTimes:times}:{})}};}
function pointer(ui,type,point,timeStamp,coalesced){ui.listeners.get('#drawCanvas:'+type)({point,timeStamp,pointerId:1,button:0,preventDefault(){},...(coalesced?{getCoalescedEvents:()=>coalesced.map(([x,y,t])=>({point:[x,y],timeStamp:t,pointerId:1}))}:{})});}

test('a received batch unfolds at the original sample intervals, independent of server version acceptance',async t=>{
 const {ui,time}=await setup(t);ui.sources[0].emit('stroke',batch(1,[[1,1],[10,10],[20,20]],[0,40,130]));
 assert.equal(run(ui,'canvasVersion'),1);assert.equal(run(ui,'strokes[0].points.length'),3);assert.equal(read(ui,'drawingPlayback.metrics()').pendingSamples,3);
 ui.paintFrame();assert.equal(ui.frames.at(-1).strokes.length,0);await time.advance(60);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes[0].points.length,1);
 await time.advance(39);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes[0].points.length,1);await time.advance(1);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes[0].points.length,2);
 await time.advance(90);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes[0].points.length,3);assert.equal(read(ui,'drawingPlayback.metrics()').scheduled,false);
});

test('continuous chunks retain their common time origin and erase stays ordered after brush',async t=>{
 const {ui,time}=await setup(t);const id='12345678-1234-4123-8123-123456789abc';ui.sources[0].emit('stroke',batch(1,[[1,1],[5,5]],[0,100],id));
 await time.advance(140);ui.sources[0].emit('stroke',batch(2,[[5,5],[10,10]],[100,180],id));ui.paintFrame();assert.equal(ui.frames.at(-1).strokes.length,1);
 await time.advance(20);ui.paintFrame();assert.deepEqual(ui.frames.at(-1).strokes.map(s=>s.points.length),[2,1]);await time.advance(80);ui.paintFrame();assert.deepEqual(ui.frames.at(-1).strokes.map(s=>s.points.length),[2,2]);
 ui.sources[0].emit('stroke',batch(3,[[1,1],[10,10]],[0,90],id.replace(/c$/,'d'),'erase'));ui.paintFrame();assert.equal(ui.frames.at(-1).strokes.length,2);await time.advance(150);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes[2].tool,'erase');
});

test('fill, reset, visibility loss and published reveal finish or cancel replay without stale frames',async t=>{
 const {ui,time}=await setup(t);const timed=batch(1,[[1,1],[10,10]],[0,200]);ui.sources[0].emit('stroke',timed);
 ui.sources[0].emit('stroke',batch(2,[[0,0]],null,'12345678-1234-4123-8123-123456789abd','fill'));assert.deepEqual(ui.frames.at(-1).strokes.map(s=>s.points.length),[2,1]);assert.equal(read(ui,'drawingPlayback.metrics()').pendingSamples,0);
 ui.sources[0].emit('stroke',batch(3,[[30,30],[40,40]],[0,200]));ui.sources[0].emit('reset',{canvasEpoch:CANVAS_EPOCH,round:1,version:4,strokes:[]});await time.advance(500);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes.length,0);
 ui.sources[0].emit('stroke',batch(5,[[1,1],[20,20]],[0,200]));ui.context.document.hidden=true;ui.listeners.get('document:visibilitychange')();assert.equal(ui.frames.at(-1).strokes[0].points.length,2);assert.equal(read(ui,'drawingPlayback.metrics()').pendingSamples,0);
 ui.context.document.hidden=false;ui.sources[0].emit('stroke',batch(6,[[30,30],[40,40]],[0,200]));ui.receive({...drawingState('guest'),phase:'reveal',strokeVersion:6});assert.equal(read(ui,'drawingPlayback.metrics()').pendingSamples,0);assert.equal(ui.frames.at(-1).strokes.at(-1).points.length,2);
});

test('coalesced sample timestamps survive deduplication, chunk anchors, merging, splitting and immutable retry',async t=>{
 const {ui,time}=await setup(t,'artist');pointer(ui,'pointerdown',[0,0],1000);pointer(ui,'pointermove',[99,99],1140,[[0,0,1010],[1,1,1020],[2,2,1100]]);pointer(ui,'pointerup',[3,3],1140);
 await time.advance(0);const first=ui.strokeRequests[0];assert.deepEqual(Array.from(first.data.pointTimes),[0,20,100,140]);first.reject(new TypeError('lost ACK'));await microtasks();await time.advance(1000);assert.equal(JSON.stringify(ui.strokeRequests[1].data),JSON.stringify(first.data));
 ui.strokeRequests[1].resolve({...batch(1,first.data.points,first.data.pointTimes,first.data.strokeId),quota:{usedPoints:4,usedBatches:1,usedFills:0}});await microtasks();assert.equal(read(ui,'drawingPlayback.metrics()').pendingSamples,0,'artist ACK never triggers observer playback');
 run(ui,'transportChecks=[];const token={};timingTransport=window.DrawTransport.create({send:async data=>{transportChecks.push(data);return{};},createId:()=>StrokeCanvas.strokeId(),isCurrent:()=>true,now:drawNow});for(let chunk=0;chunk<2;chunk++){const start=chunk*63;timingTransport.enqueue({canvasEpoch:state.canvasEpoch,round:1,strokeId:"12345678",tool:"brush",color:"#000000",size:1,points:Array.from({length:64},(_,i)=>[start+i,0]),pointTimes:Array.from({length:64},(_,i)=>(start+i)*2)},token);}');await time.advance(0);await run(ui,'timingTransport.whenIdle()');
 const chunks=read(ui,'transportChecks');assert.deepEqual(chunks.map(c=>c.points.length),[64,64]);assert.deepEqual(chunks.map(c=>c.pointTimes),[Array.from({length:64},(_,i)=>i*2),Array.from({length:64},(_,i)=>(63+i)*2)]);
});

test('long packet gaps have bounded replay latency, invalid timing resyncs, and snapshots remain immediate',async t=>{
 const {ui,time}=await setup(t);ui.sources[0].emit('stroke',batch(1,[[1,1],[5,5],[10,10]],[0,60000,120000]));assert.ok(read(ui,'drawingPlayback.metrics()').leadMs<=900);await time.advance(900);ui.paintFrame();assert.equal(ui.frames.at(-1).strokes[0].points.length,3);
 const invalid=batch(2,[[20,20],[30,30]],[50,10]);assert.equal(run(ui,'validCanvasStroke('+JSON.stringify(invalid.stroke)+',1,2)'),false);
 ui.context.snapshot={canvasEpoch:CANVAS_EPOCH,round:1,version:2,strokes:[batch(2,[[20,20],[30,30]],[0,100]).stroke]};run(ui,'applyCanvasSnapshot(snapshot)');assert.equal(ui.frames.at(-1).strokes[0].points.length,2);assert.equal(read(ui,'drawingPlayback.metrics()').scheduled,false);
});
