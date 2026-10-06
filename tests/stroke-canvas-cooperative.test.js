const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rasterCanvas}=require('./helpers/raster-canvas.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8');
const fill=version=>({version,strokeId:'fill-'+version,tool:'fill',color:version%2?'#ff0000':'#0000ff',size:1,points:[[0,0]]});
const keys=strokes=>strokes.map(stroke=>String(stroke.version));
const pause=()=>new Promise(resolve=>setImmediate(resolve));
function gates(){const queue=[];return {yieldToMain:()=>new Promise(resolve=>queue.push(resolve)),async step(){assert.ok(queue.length,'a recovery continuation is waiting');queue.shift()();await pause();},async drain(){let limit=200;while(queue.length&&limit--){queue.shift()();await pause();}assert.ok(limit>0,'bounded recovery finishes');},get length(){return queue.length;}};}
function library(extra={}){const window={};vm.runInNewContext(source,{window,Date,setTimeout,...extra});return window.StrokeCanvas;}

test('cold 48-fill recovery yields before paint and after each fill, then matches canonical pixels with bounded cache',async()=>{
 const {createRenderer,redraw}=library(),schedule=gates(),canvas=rasterCanvas(),renderer=createRenderer(canvas,{yieldToMain:schedule.yieldToMain}),strokes=Array.from({length:48},(_,i)=>fill(i+1));
 const job=renderer.renderCooperatively(strokes,{keys:keys(strokes)});assert.equal(typeof job.then,'function');assert.equal(renderer.metrics().fillApplications,0);assert.equal(renderer.metrics().rendering,true);
 let idle=false;const ready=renderer.whenIdle().then(()=>idle=true);await schedule.step();assert.equal(idle,false);assert.equal(renderer.metrics().fillApplications,1);assert.equal(renderer.metrics().strokes,1);
 await schedule.drain();assert.equal(await job,true);await ready;assert.equal(renderer.metrics().rendering,false);assert.equal(renderer.metrics().fillApplications,48);assert.equal(renderer.metrics().maxBatchFills,1);assert.ok(renderer.metrics().maxBatchStrokes<=16);assert.ok(renderer.metrics().checkpointBytes<=16*canvas.width*canvas.height*4);
 const canonical=rasterCanvas();redraw(canonical,strokes);assert.deepEqual(canvas.pixels(),canonical.pixels());const before=renderer.metrics().fillApplications;
 assert.equal(renderer.renderCooperatively(strokes,{keys:keys(strokes)}),false);assert.equal(renderer.metrics().fillApplications,before);
});

test('newer suffix cancels an awaiting job, reuses painted prefix, and whenIdle waits for the latest target',async()=>{
 const {createRenderer,redraw}=library(),schedule=gates(),canvas=rasterCanvas(),renderer=createRenderer(canvas,{yieldToMain:schedule.yieldToMain}),old=Array.from({length:8},(_,i)=>fill(i+1));
 const first=renderer.renderCooperatively(old,{keys:keys(old)});await schedule.step();await schedule.step();
 const next=[...old,{version:9,tool:'rect',color:'#00ff00',size:1,filled:true,points:[[3,3],[8,8]]}];
 const last=renderer.renderCooperatively(next,{keys:keys(next)});let idle=false;const waiting=renderer.whenIdle().then(()=>idle=true);
 await schedule.step();assert.equal(await first,false);assert.equal(idle,false);
 await schedule.drain();assert.equal(await last,true);await waiting;assert.equal(renderer.metrics().fillApplications,8);assert.equal(renderer.metrics().cancelledRenders,1);
 const canonical=rasterCanvas();redraw(canonical,next);assert.deepEqual(canvas.pixels(),canonical.pixels());
});

test('mutable draft inputs are frozen for recovery; a later revision redraws only its tail',async()=>{
 const {createRenderer,redraw}=library(),schedule=gates(),canvas=rasterCanvas(),renderer=createRenderer(canvas,{yieldToMain:schedule.yieldToMain}),strokes=Array.from({length:6},(_,i)=>fill(i+1));
 const draft={tool:'brush',color:'#000000',size:1,points:[[3,3],[4,3]]},original=JSON.parse(JSON.stringify(draft)),job=renderer.renderCooperatively([...strokes,draft],{keys:[...keys(strokes),'local:1'],mutableFrom:6});
 await schedule.step();draft.points.push([10,7]);await schedule.drain();await job;
 const first=rasterCanvas();redraw(first,[...strokes,original]);assert.deepEqual(canvas.pixels(),first.pixels());
 assert.equal(renderer.renderCooperatively([...strokes,draft],{keys:[...keys(strokes),'local:2'],mutableFrom:6}),true);assert.equal(renderer.metrics().fillApplications,6);
 const revised=rasterCanvas();redraw(revised,[...strokes,draft]);assert.deepEqual(canvas.pixels(),revised.pixels());
});

test('deep undo and reset cancel old replay so an old continuation cannot paint over a new round',async()=>{
 const {createRenderer,redraw}=library(),schedule=gates(),canvas=rasterCanvas(),renderer=createRenderer(canvas,{yieldToMain:schedule.yieldToMain}),strokes=Array.from({length:48},(_,i)=>fill(i+1));renderer.render(strokes,{keys:keys(strokes)});
 const shorter=strokes.slice(0,9),undo=renderer.renderCooperatively(shorter,{keys:keys(shorter)});await schedule.drain();assert.equal(await undo,true);
 const canonical=rasterCanvas();redraw(canonical,shorter);assert.deepEqual(canvas.pixels(),canonical.pixels());
 const pending=renderer.renderCooperatively(strokes,{keys:keys(strokes)});await schedule.step();renderer.reset();assert.equal(renderer.metrics().checkpointBytes,0);
 const fresh={...fill(100),color:'#00ff00'};assert.equal(renderer.renderCooperatively([fresh],{keys:['new-round']}),true);
 await schedule.drain();assert.equal(await pending,false);assert.deepEqual(canvas.pixel(20,10),[0,255,0,255]);assert.equal(renderer.metrics().strokes,1);
});

test('invalid recovery data is rejected without cancelling the valid pending canvas',async()=>{
 const {createRenderer}=library(),schedule=gates(),canvas=rasterCanvas(),renderer=createRenderer(canvas,{yieldToMain:schedule.yieldToMain}),strokes=Array.from({length:8},(_,i)=>fill(i+1));const valid=renderer.renderCooperatively(strokes);
 assert.throws(()=>renderer.renderCooperatively(Array.from({length:50},(_,i)=>fill(i+1))),/work limit/);assert.equal(renderer.metrics().rendering,true);await schedule.drain();assert.equal(await valid,true);assert.deepEqual(canvas.pixel(20,10),[0,0,255,255]);
});

test('default scheduling uses MessageChannel and progresses without rAF or timer access in a hidden page',async()=>{
 let posts=0;class MessageChannel{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>{posts++;setImmediate(()=>this.port1.onmessage());}};}}
 const {createRenderer}=library({MessageChannel,document:{visibilityState:'hidden'},requestAnimationFrame(){throw Error('rAF is suspended');},setTimeout(){throw Error('timers are throttled');}}),canvas=rasterCanvas(),renderer=createRenderer(canvas),strokes=Array.from({length:5},(_,i)=>fill(i+1));
 assert.equal(await renderer.renderCooperatively(strokes),true);assert.equal(posts,5);assert.equal(renderer.metrics().maxBatchFills,1);assert.deepEqual(canvas.pixel(20,10),[255,0,0,255]);
});
