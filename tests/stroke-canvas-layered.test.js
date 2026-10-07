const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rasterCanvas}=require('./helpers/raster-canvas.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8');
function library(extra={}){const window={};vm.runInNewContext(source,{window,Date,setTimeout,...extra});return window.StrokeCanvas;}
function fixture(options={},width=64,height=32,extra={}){const api=library(extra),canvas=rasterCanvas(width,height),layers=[],renderer=api.createRenderer(canvas,{separateMutable:true,...options,createCanvas:(w,h)=>{const base=rasterCanvas(w,h);layers.push(base);return base;}});return {api,canvas,renderer,base:layers[0]};}
const fill=(version,color=version%2?'#f01020':'#1020f0')=>({version,strokeId:'fill-'+version,tool:'fill',color,size:1,points:[[0,0]]});
const brush=(version,points=[[3,3]],size=5,color='#102030')=>({version,strokeId:'brush-'+version,tool:'brush',color,size,points});
const keys=strokes=>strokes.map(stroke=>JSON.stringify(stroke));
function samePixels(f,strokes){const canonical=rasterCanvas(f.canvas.width,f.canvas.height);f.api.redraw(canonical,strokes);assert.deepEqual(f.canvas.pixels(),canonical.pixels());const ink=canvas=>canvas.pixels().reduce((count,value,index,values)=>index%4===0&&(value!==255||values[index+1]!==255||values[index+2]!==255)?count+1:count,0);assert.equal(ink(f.canvas),ink(canonical));}
function gates(){const jobs=[];return {yieldToMain:()=>new Promise(resolve=>jobs.push(resolve)),async step(){assert.ok(jobs.length);jobs.shift()();await new Promise(resolve=>setImmediate(resolve));},async drain(){let left=300;while(jobs.length&&left--){jobs.shift()();await new Promise(resolve=>setImmediate(resolve));}assert.ok(left>0);}};}

test('fill-sensitive fallback matches complete canonical coarse dots, corners, crossings, erase, fill and shapes',()=>{
 const f=fixture(),history=[{version:1,tool:'rect',color:'#000000',size:2,filled:true,points:[[1,1],[50,26]]},{version:2,tool:'rect',color:'#fff',size:2,filled:true,points:[[3,3],[48,24]]},fill(3,'#00aa00')];
 f.renderer.render(history,{keys:keys(history)});
 const drafts=[brush(4,[[3,3]],13),brush(4,[[3,3],[25,3],[10,18],[30,3],[3,18]],13),{...brush(4,[[5,5],[25,5],[25,20],[5,20],[5,5]],7),tool:'erase'},fill(4,'#ff00ff'),{version:4,tool:'line',size:9,color:'#1122ff',points:[[4,5],[25,19]]},...['rect','ellipse'].flatMap(tool=>[false,true].map(filled=>({version:4,tool,filled,color:'#fa8811',size:7,points:[[5,5],[25,20]]})))];
 for(const draft of drafts){f.renderer.render([...history,draft],{keys:[...keys(history),JSON.stringify(draft)],mutableFrom:history.length});samePixels(f,[...history,draft]);}
 assert.equal(f.renderer.metrics().fallback,true);assert.equal(f.renderer.metrics().prefixFillApplications,0);assert.equal(f.renderer.metrics().fallbackFillApplications,2);assert.equal(f.canvas.getContext('2d').globalCompositeOperation,'source-over');assert.equal(f.canvas.getContext('2d').globalAlpha,1);
});
test('200 preview updates perform no prefix readback or replay and retain the total checkpoint budget',()=>{
 const f=fixture(),history=Array.from({length:48},(_,index)=>({version:index+1,tool:'rect',color:index%2?'#1020f0':'#f01020',size:1,filled:true,points:[[index%30,index%15],[30+index%30,15+index%15]]}));f.renderer.render(history,{keys:keys(history)});
 f.renderer.render([...history,brush(0)],{keys:[...keys(history),'local:0'],mutableFrom:history.length});
 const reads=f.base.getContext('2d').calls.reads,prefixApplications=f.renderer.metrics().prefixStrokeApplications;
 for(let revision=1;revision<=200;revision++){const draft=brush(revision,[[5,5],[5+revision%20,20]],11);f.renderer.render([...history,draft],{keys:[...keys(history),'local:'+revision],mutableFrom:history.length});}
 const metrics=f.renderer.metrics();assert.equal(f.base.getContext('2d').calls.reads,reads);assert.equal(metrics.prefixStrokeApplications,prefixApplications);assert.equal(metrics.prefixFillApplications,0);assert.equal(metrics.mutableStrokeApplications,201);assert.equal(metrics.baseCopies,201);assert.ok(metrics.cachedBytes<=16*f.canvas.width*f.canvas.height*4);assert.ok(metrics.checkpoints<=15);assert.equal(metrics.fallback,false);
 assert.equal(f.canvas.getContext('2d').calls.reads,1,'settled history may use original checkpoints before the draft starts');assert.equal(f.canvas.getContext('2d').calls.copies,metrics.baseCopies);
});
test('received immutable SSE chunks append on the original visible surface without entering the mutable layer',()=>{
 const f=fixture(),strokes=Array.from({length:100},(_,i)=>brush(i+1,[[i%50,5+i%20],[(i+1)%50,5+(i+1)%20]],8));
 for(let count=1;count<=strokes.length;count++)f.renderer.render(strokes.slice(0,count),{keys:keys(strokes.slice(0,count)),mutableFrom:Infinity});
 const metrics=f.renderer.metrics();assert.equal(metrics.mode,'canonical');assert.equal(metrics.strokeApplications,100);assert.equal(metrics.mutableStrokeApplications,0);assert.equal(metrics.prefixStrokeApplications,0);assert.equal(metrics.baseCopies,0);assert.equal(f.base.getContext('2d').calls.reads,0);samePixels(f,strokes);
});
test('a stable mutable key does no work while growing full paths keeps canonical lineTo semantics',()=>{
 const f=fixture();let latest;
 for(let n=1;n<=1000;n++){latest=brush(n,Array.from({length:n},(_,i)=>[i%50,5+i%20]),3);f.renderer.render([latest],{keys:['local:'+n],mutableFrom:0});}
 assert.equal(f.renderer.metrics().mutableLineTo,499501);assert.equal(f.canvas.getContext('2d').calls.lineTos,499501);
 const before=f.renderer.metrics();assert.equal(f.renderer.render([latest],{keys:['local:1000'],mutableFrom:0}),false);assert.equal(f.renderer.metrics().baseCopies,before.baseCopies);assert.equal(f.renderer.metrics().mutableLineTo,before.mutableLineTo);samePixels(f,[latest]);
});
test('eight exact same-epoch draft dots and both ACK/SSE settlement orders finish at canonical nonempty pixels',()=>{
 for(const order of ['SSE-before-ACK','ACK-before-SSE']){
  const f=fixture(),all=Array.from({length:8},(_,i)=>brush(i+1,[[4+i*6,8+i%2]],7,i%2?'#ee2233':'#2244ee'));
  let confirmed=0;const render=()=>f.renderer.render(all,{keys:all.map((stroke,i)=>i<confirmed?'server:'+stroke.version:'local:'+stroke.version),mutableFrom:confirmed});
  render();for(let i=0;i<8;i++){if(order==='ACK-before-SSE')render();confirmed++;render();if(order==='SSE-before-ACK')render();samePixels(f,all);}
  assert.ok(f.canvas.pixels().some((value,index)=>index%4!==3&&value!==255));assert.equal(f.renderer.metrics().prefixStrokeApplications,7);
 }
});
test('complete fills stay on one canonical surface and apply once for either ACK/SSE order',()=>{
 for(const order of ['SSE-before-ACK','ACK-before-SSE']){
  const f=fixture(),stroke=fill(1,'#dd0033'),settings={keys:['canonical-fill-1'],mutableFrom:0};
  f.renderer.render([stroke],settings);if(order==='ACK-before-SSE')f.renderer.render([stroke],settings);
  assert.equal(f.renderer.render([stroke],{...settings,mutableFrom:Infinity}),false);if(order==='SSE-before-ACK')f.renderer.render([stroke],{...settings,mutableFrom:1});
  assert.equal(f.renderer.metrics().fillApplications,1);assert.equal(f.renderer.metrics().fallback,true);assert.equal(f.renderer.metrics().baseCopies,0);assert.equal(f.base.getContext('2d').calls.copies,0);samePixels(f,[stroke]);
  f.renderer.render([stroke,brush(2,[[15,15]],7)],{keys:['canonical-fill-1','local:2'],mutableFrom:1});samePixels(f,[stroke,brush(2,[[15,15]],7)]);assert.equal(f.renderer.metrics().fillApplications,1);
  f.renderer.render([]);samePixels(f,[]);f.renderer.render([stroke]);samePixels(f,[stroke]);
 }
});
test('fills in a mutable suffix use the composed base and replay dependent strokes after draft corrections',()=>{
 const f=fixture(),border={version:1,tool:'rect',color:'#000000',size:2,filled:false,points:[[3,3],[40,24]]},draft=brush(2,[[20,3],[20,24]],2),region={...fill(3,'#aa00ff'),points:[[8,10]]},tail=brush(4,[[10,20]],4);
 for(const points of [[[20,3],[20,24]],[[25,3],[25,24]],[[30,3],[30,24]]]){draft.points=points;const strokes=[border,draft,region,tail];f.renderer.render(strokes,{keys:keys(strokes),mutableFrom:1});samePixels(f,strokes);}
 assert.equal(f.renderer.metrics().fallbackFillApplications,3);assert.equal(f.renderer.metrics().prefixStrokeApplications,0);assert.equal(f.renderer.metrics().fallback,true);
});
test('undo, replacement, clear, epoch reset and review rebuild keep canonical pixels and independent cache state',()=>{
 const f=fixture(),strokes=[fill(1),brush(2,[[4,4],[20,20]],7),{version:3,tool:'ellipse',filled:true,color:'#ffff00',size:1,points:[[20,4],[40,20]]},brush(4,[[45,25]],7)];
 f.renderer.render(strokes);for(let count=3;count>=0;count--){f.renderer.render(strokes.slice(0,count));samePixels(f,strokes.slice(0,count));}
 const replaced=[fill(9,'#004400'),brush(10,[[4,4],[20,20]],9)];f.renderer.render(replaced);samePixels(f,replaced);
 f.renderer.reset();samePixels(f,[]);assert.equal(f.renderer.metrics().checkpointBytes,0);f.renderer.render([brush(1,[[8,8]],9)]);samePixels(f,[brush(1,[[8,8]],9)]);
 const review=rasterCanvas();const plain=f.api.createRenderer(review,{maxCheckpoints:2});plain.render(replaced);const expected=rasterCanvas();f.api.redraw(expected,replaced);assert.deepEqual(review.pixels(),expected.pixels());assert.equal(plain.metrics().separateMutable,undefined);
});
test('prefix recovery freezes the tail, reuses pending identical inputs and whenIdle includes visible tail completion',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain}),history=Array.from({length:8},(_,i)=>fill(i+1)),draft=brush(9,[[4,4],[10,10]],5),original=JSON.parse(JSON.stringify(draft)),settings={keys:[...keys(history),'local:1'],mutableFrom:8};
 const first=f.renderer.renderCooperatively([...history,draft],settings);assert.equal(typeof first.then,'function');assert.equal(f.renderer.renderCooperatively([...history,draft],settings),first);let idle=false;const waiting=f.renderer.whenIdle().then(()=>idle=true);
 await schedule.step();assert.equal(idle,false);draft.points.push([50,24]);await schedule.drain();assert.equal(await first,true);await waiting;samePixels(f,[...history,original]);
 assert.equal(f.renderer.renderCooperatively([...history,draft],{...settings,keys:[...keys(history),'local:2']}),true);samePixels(f,[...history,draft]);assert.equal(f.renderer.metrics().fallbackFillApplications,8);
});
test('cooperative mutable suffix batches fills and dots, cancelling old tails without retaining old epoch inputs',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain}),old=Array.from({length:8},(_,i)=>fill(i+1));
 const pending=f.renderer.renderCooperatively(old,{keys:keys(old),mutableFrom:0});await schedule.step();assert.equal(f.renderer.metrics().fallbackFillApplications,1);
 f.renderer.reset();assert.equal(f.renderer.metrics().rendering,false);f.renderer.render([brush(1,[[8,8]],7)],{keys:['fresh'],mutableFrom:0});await schedule.drain();assert.equal(await pending,false);samePixels(f,[brush(1,[[8,8]],7)]);assert.equal(f.renderer.metrics().cancelledRenders,1);
 const dots=Array.from({length:40},(_,i)=>brush(i+2,[[2+i%50,2+i%25]],3));const job=f.renderer.renderCooperatively(dots,{keys:keys(dots),mutableFrom:0});await schedule.drain();assert.equal(await job,true);await f.renderer.whenIdle();samePixels(f,dots);assert.ok(f.renderer.metrics().maxBatchStrokes<=16);assert.ok(f.renderer.metrics().maxBatchFills<=1);
});
test('a newer mutable tail supersedes an awaiting prefix job and only the latest frozen view becomes visible',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain}),history=Array.from({length:8},(_,i)=>fill(i+1)),first=brush(9,[[3,3]],7),last=brush(10,[[30,20]],7);
 const old=f.renderer.renderCooperatively([...history,first],{keys:[...keys(history),'local:1'],mutableFrom:8});await schedule.step();
 const current=f.renderer.renderCooperatively([...history,last],{keys:[...keys(history),'local:2'],mutableFrom:8}),waiting=f.renderer.whenIdle();await schedule.drain();assert.equal(await old,false);assert.equal(await current,true);await waiting;samePixels(f,[...history,last]);assert.equal(f.renderer.metrics().fallbackFillApplications,8);
});
test('invalid layered recovery does not cancel a valid job and original quota ceilings remain enforced',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain}),history=Array.from({length:8},(_,i)=>fill(i+1)),job=f.renderer.renderCooperatively(history);
 for(const invalid of [Array.from({length:50},(_,i)=>fill(i+1)),Array.from({length:1017},(_,i)=>brush(i)),[brush(1,Array.from({length:31025},()=>[0,0]))]])assert.throws(()=>f.renderer.renderCooperatively(invalid),/limit/);
 assert.equal(f.renderer.metrics().rendering,true);await schedule.drain();assert.equal(await job,true);samePixels(f,history);
});
test('hidden-page layered recovery uses MessageChannel and never waits for a preview frame',async()=>{
 let posts=0;class MessageChannel{constructor(){this.port1={onmessage:null};this.port2={postMessage:()=>{posts++;setImmediate(()=>this.port1.onmessage());}};}}
 const f=fixture({},64,32,{MessageChannel,document:{hidden:true},requestAnimationFrame(){throw Error('hidden rAF');},setTimeout(){throw Error('hidden timer');}}),strokes=Array.from({length:5},(_,i)=>fill(i+1));
 assert.equal(await f.renderer.renderCooperatively(strokes),true);assert.equal(posts,5);samePixels(f,strokes);
});
test('no-fill prefix recovery and its tail remain frozen and whenIdle waits for both surfaces',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain}),history=Array.from({length:64},(_,i)=>brush(i+1,[[2+i%50,3+i%20]],3)),tail=brush(65,[[5,5],[20,20]],9),original=JSON.parse(JSON.stringify(tail));
 const pending=f.renderer.renderCooperatively([...history,tail],{keys:[...keys(history),'tail:1'],mutableFrom:64});assert.equal(f.renderer.metrics().fallback,false);
 let idle=false;const waiting=f.renderer.whenIdle().then(()=>idle=true);await schedule.step();assert.equal(idle,false);tail.points.push([50,25]);await schedule.drain();assert.equal(await pending,true);await waiting;samePixels(f,[...history,original]);assert.ok(f.renderer.metrics().cachedBytes<=16*f.canvas.width*f.canvas.height*4);
});
test('a fill cancels pending layers, releases their checkpoints and makes prior whenIdle follow single-surface recovery',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain,maxCheckpoints:2}),history=Array.from({length:65},(_,i)=>brush(i+1,[[2+i%50,3+i%20]],3));
 const old=f.renderer.renderCooperatively(history,{mutableFrom:64});await schedule.step();let idle=false;const waiting=f.renderer.whenIdle().then(()=>idle=true);
 const filled=[...history,fill(66,'#aa22cc')],current=f.renderer.renderCooperatively(filled);assert.equal(f.renderer.metrics().fallback,true);assert.equal(f.renderer.metrics().checkpoints,0);
 await schedule.drain();assert.equal(await old,false);assert.equal(await current,true);await waiting;assert.equal(idle,true);samePixels(f,filled);assert.equal(f.renderer.metrics().fallbackFillApplications,1);assert.ok(f.renderer.metrics().cachedBytes<=2*f.canvas.width*f.canvas.height*4);
 f.renderer.render(history);assert.equal(f.renderer.metrics().fallback,true,'undo must not switch an already fill-sensitive context back and forth');samePixels(f,history);
 f.renderer.reset();assert.equal(f.renderer.metrics().fallback,false);assert.equal(f.renderer.metrics().rendering,false);assert.equal(f.renderer.metrics().checkpointBytes,0);f.renderer.render([brush(1,[[8,8]],7)]);samePixels(f,[brush(1,[[8,8]],7)]);
});
test('fill-after-brush followed by white erase stays on the canonical single surface until the epoch resets',()=>{
 const f=fixture(),history=Array.from({length:8},(_,i)=>brush(i+1,[[3+i*6,3],[7+i*6,25]],3,'#cc2233'));
 f.renderer.render(history);assert.equal(f.renderer.metrics().fallback,false);
 const filled=[...history,fill(9,'#2244ee')];f.renderer.render(filled);assert.equal(f.renderer.metrics().fallback,true);
 const erase={...brush(10,[[4,4],[45,24],[50,5]],13),tool:'erase'};f.renderer.render([...filled,erase]);samePixels(f,[...filled,erase]);assert.equal(f.renderer.metrics().cachedBytes,f.renderer.metrics().checkpointBytes+f.renderer.metrics().layerBytes);
 f.renderer.reset();assert.equal(f.renderer.metrics().mode,'layered');assert.equal(f.renderer.metrics().checkpointBytes,0);assert.equal(f.renderer.metrics().fillApplications,1,'historical work counters remain cumulative across reset');
});
test('only an explicit finite draft boundary enables layering, and settlement completely replays the canonical scene',()=>{
 const f=fixture(),history=[brush(1,[[4,4],[20,20]],9)],draft=brush(2,[[40,20],[25,4]],13),strokes=[...history,draft];
 for(const mutableFrom of [undefined,Infinity,NaN,strokes.length,strokes.length+1]){f.renderer.render(strokes,{mutableFrom});assert.equal(f.renderer.metrics().mode,'canonical');assert.equal(f.renderer.metrics().baseCopies,0);}
 f.renderer.render(strokes,{mutableFrom:1});assert.equal(f.renderer.metrics().mode,'layered');assert.equal(f.renderer.metrics().checkpoints,0);const before=f.renderer.metrics();
 assert.equal(f.renderer.render(strokes,{mutableFrom:Infinity}),true,'completed scenes must replay even if their keys match the preview');
 const settled=f.renderer.metrics();assert.equal(settled.mode,'canonical');assert.equal(settled.fallbackStrokeApplications-before.fallbackStrokeApplications,strokes.length);assert.equal(settled.baseCopies,before.baseCopies);samePixels(f,strokes);
 assert.equal(f.renderer.render(strokes,{mutableFrom:strokes.length}),false);assert.equal(f.renderer.metrics().strokeApplications,settled.strokeApplications);
});
test('1000-point dense chunks render statically, progressively and after draft settlement on the canonical visible surface',()=>{
 const trace=Array.from({length:1000},(_,i)=>[2+i%50,2+Math.floor(i/50)%25]),chunks=[];let from=0;
 while(from<trace.length){const count=from?63:64;chunks.push({...brush(chunks.length+1,trace.slice(Math.max(0,from-1),from+count),3,'#273942'),strokeId:'dense'});from+=count;}
 assert.equal(chunks.length,16);assert.equal(chunks.reduce((count,item)=>count+item.points.length,0),1015);
 for(const mode of ['static','progressive','draft-then-settle']){
  const f=fixture();if(mode==='draft-then-settle'){f.renderer.render([{...chunks[0],points:trace}],{keys:['local-dense'],mutableFrom:0});assert.equal(f.renderer.metrics().mode,'layered');}
  if(mode==='progressive')for(let count=1;count<chunks.length;count++)f.renderer.render(chunks.slice(0,count),{mutableFrom:Infinity});
  f.renderer.render(chunks,{mutableFrom:Infinity});const metrics=f.renderer.metrics();assert.equal(metrics.mode,'canonical');assert.equal(metrics.fallbackStrokeApplications,16);assert.equal(metrics.prefixStrokeApplications,0);assert.equal(metrics.checkpoints,0);samePixels(f,chunks);assert.ok(f.canvas.pixels().some((value,index)=>index%4!==3&&value!==255));
 }
});
test('cooperative draft settlement clears base checkpoints, freezes its canonical target and waits for completion',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain,maxCheckpoints:2}),history=Array.from({length:64},(_,i)=>brush(i+1,[[2+i%50,3+i%20]],3)),tail=brush(65,[[5,5],[20,20]],9),strokes=[...history,tail],original=JSON.parse(JSON.stringify(strokes));
 f.renderer.render(strokes,{mutableFrom:64});assert.equal(f.renderer.metrics().mode,'layered');assert.ok(f.renderer.metrics().checkpointBytes>0);
 const settling=f.renderer.renderCooperatively(strokes,{mutableFrom:Infinity});assert.equal(typeof settling.then,'function');assert.equal(f.renderer.metrics().mode,'canonical');assert.equal(f.renderer.metrics().checkpoints,0);assert.equal(f.renderer.renderCooperatively(strokes,{mutableFrom:Infinity}),settling);
 let idle=false;const waiting=f.renderer.whenIdle().then(()=>idle=true);await schedule.step();assert.equal(idle,false);tail.points.push([50,25]);await schedule.drain();assert.equal(await settling,true);await waiting;samePixels(f,original);assert.ok(f.renderer.metrics().cachedBytes<=2*f.canvas.width*f.canvas.height*4);assert.equal(f.renderer.metrics().fallbackStrokeApplications,65);
});
test('whenIdle follows a cancelled classic recovery into a newer draft and reset releases both cache modes',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain,maxCheckpoints:2}),history=Array.from({length:64},(_,i)=>brush(i+1,[[2+i%50,3+i%20]],3)),tail=brush(65,[[5,5],[20,20]],9),strokes=[...history,tail];
 const old=f.renderer.renderCooperatively(strokes);await schedule.step();let idle=false;const waiting=f.renderer.whenIdle().then(()=>idle=true);
 const current=f.renderer.renderCooperatively(strokes,{mutableFrom:64});assert.equal(f.renderer.metrics().mode,'layered');assert.equal(f.renderer.metrics().checkpoints,0);await schedule.step();assert.equal(idle,false);await schedule.drain();assert.equal(await old,false);assert.equal(await current,true);await waiting;samePixels(f,strokes);assert.ok(f.renderer.metrics().cachedBytes<=2*f.canvas.width*f.canvas.height*4);
 f.renderer.reset();assert.equal(f.renderer.metrics().checkpoints,0);assert.equal(f.renderer.metrics().rendering,false);assert.equal(f.renderer.metrics().cancelledRenders,1);samePixels(f,[]);
});
test('a settled update cancels a pending layered prefix and prior whenIdle waits for the authoritative replay',async()=>{
 const schedule=gates(),f=fixture({yieldToMain:schedule.yieldToMain}),history=Array.from({length:64},(_,i)=>brush(i+1,[[2+i%50,3+i%20]],3)),tail=brush(65,[[5,5],[20,20]],9),strokes=[...history,tail];
 const old=f.renderer.renderCooperatively(strokes,{mutableFrom:64});await schedule.step();let idle=false;const waiting=f.renderer.whenIdle().then(()=>idle=true);
 const settled=f.renderer.renderCooperatively(strokes);await schedule.step();assert.equal(idle,false);await schedule.drain();assert.equal(await old,false);assert.equal(await settled,true);await waiting;assert.equal(f.renderer.metrics().mode,'canonical');samePixels(f,strokes);assert.equal(f.renderer.metrics().fallbackStrokeApplications,65);
});
