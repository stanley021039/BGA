const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rasterCanvas}=require('./helpers/raster-canvas.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8');
const pause=()=>new Promise(resolve=>setImmediate(resolve));
function gates(){const pending=[];return {yieldToMain:()=>new Promise(resolve=>pending.push(resolve)),async step(){assert.ok(pending.length);pending.shift()();await pause();},async drain(){let limit=300;while(pending.length&&limit--){pending.shift()();await pause();}assert.ok(limit>0);},get length(){return pending.length;}};}
function fixture(options={}){const window={};vm.runInNewContext(source,{window,Date,setTimeout});const canvas=rasterCanvas(64,32),schedule=gates(),surfaces=[],renderer=window.StrokeCanvas.createRenderer(canvas,{atomicPresentation:true,createCanvas:(w,h)=>{const layer=rasterCanvas(w,h);surfaces.push(layer);return layer;},yieldToMain:schedule.yieldToMain,...options});return {api:window.StrokeCanvas,canvas,renderer,schedule,surfaces};}
const fill=(version,color)=>({version,strokeId:'fill-'+version,tool:'fill',color,size:1,points:[[0,0]]});
const brush=(version,points=[[2+version%50,3+version%20]],size=3,color='#2244ee')=>({version,strokeId:'brush-'+version,tool:'brush',color,size,points});
const canonical=(f,strokes)=>{const canvas=rasterCanvas(64,32);f.api.redraw(canvas,strokes);return canvas.pixels();};

test('atomic replacement keeps a complete visible frame at every cooperative fill yield and presents once at completion',async()=>{
 const f=fixture(),old=[fill(100,'#22aa44')],next=Array.from({length:8},(_,i)=>fill(i+1,i%2?'#1122ee':'#ee2211'));f.renderer.render(old);const visible=f.canvas.pixels(),copies=f.canvas.getContext('2d').calls.copies,job=f.renderer.renderCooperatively(next);assert.deepEqual(f.canvas.pixels(),visible,'starting recovery cannot clear the visible scene');
 while(f.schedule.length){await f.schedule.step();if(f.renderer.metrics().rendering)assert.deepEqual(f.canvas.pixels(),visible,'a yielded fill batch must stay offscreen');}
 assert.equal(await job,true);await f.renderer.whenIdle();assert.deepEqual(f.canvas.pixels(),canonical(f,next));assert.equal(f.canvas.getContext('2d').calls.copies,copies+1);
});

test('atomic ACK settlement does not expose blank canvas or partial canonical brush replay after mutable mode switches',async()=>{
 const f=fixture({separateMutable:true}),history=Array.from({length:64},(_,i)=>brush(i+1)),tail=brush(65,[[5,5],[55,25]],7,'#ff0000'),strokes=[...history,tail];f.renderer.render(strokes,{mutableFrom:64});const visible=f.canvas.pixels();assert.ok(visible.some((value,i)=>i%4!==3&&value!==255));const job=f.renderer.renderCooperatively(strokes,{mutableFrom:Infinity});assert.equal(typeof job.then,'function');assert.deepEqual(f.canvas.pixels(),visible,'mode transition must keep the old complete stroke');
 while(f.schedule.length){await f.schedule.step();if(f.renderer.metrics().rendering)assert.deepEqual(f.canvas.pixels(),visible,'ACK replay cannot publish a partial history');}
 assert.equal(await job,true);assert.deepEqual(f.canvas.pixels(),canonical(f,strokes));assert.equal(f.renderer.metrics().mode,'canonical');
});

test('atomic mutable prefix and a long suffix retain the previous complete view until both surfaces finish',async()=>{
 const f=fixture({separateMutable:true}),old=[brush(1,[[4,4],[50,25]],9)],next=Array.from({length:80},(_,i)=>brush(i+1,[[2+i%50,3+i%20]],3));f.renderer.render(old,{mutableFrom:0});const visible=f.canvas.pixels(),job=f.renderer.renderCooperatively(next,{mutableFrom:32});
 while(f.schedule.length){assert.deepEqual(f.canvas.pixels(),visible);await f.schedule.step();}
 assert.equal(await job,true);await f.renderer.whenIdle();assert.deepEqual(f.canvas.pixels(),canonical(f,next));
});

test('a cancelled old atomic render cannot copy over a newer complete frame or clear its current promise',async()=>{
 const f=fixture({separateMutable:true}),old=Array.from({length:65},(_,i)=>brush(i+1)),current=[fill(100,'#00aa00'),brush(101,[[8,8],[50,22]],5)];const job=f.renderer.renderCooperatively(old);await f.schedule.step();assert.equal(f.renderer.render(current),true);const visible=f.canvas.pixels();await f.schedule.drain();assert.equal(await job,false);assert.deepEqual(f.canvas.pixels(),visible);assert.deepEqual(visible,canonical(f,current));assert.equal(f.renderer.metrics().rendering,false);
 const next=Array.from({length:8},(_,i)=>fill(i+1,'#2233aa')),pending=f.renderer.renderCooperatively(next);await f.schedule.step();f.renderer.reset();const blank=canonical(f,[]);await f.schedule.drain();assert.equal(await pending,false);assert.deepEqual(f.canvas.pixels(),blank);assert.equal(f.renderer.metrics().checkpointBytes,0);
 const abandoned=f.renderer.renderCooperatively(old);await f.schedule.step();const newest=[...old,brush(70,[[3,25],[50,4]],7,'#cc0033')],latest=f.renderer.renderCooperatively(newest),waiting=f.renderer.whenIdle();await f.schedule.step();assert.equal(await abandoned,false);assert.equal(f.renderer.metrics().rendering,true);assert.deepEqual(f.canvas.pixels(),blank);await f.schedule.drain();assert.equal(await latest,true);await waiting;assert.deepEqual(f.canvas.pixels(),canonical(f,newest));
});

test('atomic snapshot freezes mutable targets, preserves erase/fill pixels and accounts for its extra surface within the cache budget',async()=>{
 for(const separateMutable of [false,true])for(const maxCheckpoints of [2,16]){
  const f=fixture({separateMutable,maxCheckpoints,checkpointEvery:1}),strokes=Array.from({length:8},(_,i)=>fill(i+1,i%2?'#772255':'#224477'));strokes.push({...brush(9,[[4,4],[52,24]],13),tool:'erase'});const expected=canonical(f,strokes),job=f.renderer.renderCooperatively(strokes,{mutableFrom:8});strokes[8].points.push([12,28]);await f.schedule.drain();assert.equal(await job,true);assert.deepEqual(f.canvas.pixels(),expected);const stats=f.renderer.metrics();assert.equal(stats.presentationBytes,64*32*4);assert.ok(stats.cachedBytes<=maxCheckpoints*64*32*4);assert.ok(f.surfaces.length<=(separateMutable?2:1));
 }
});

test('atomic staging preserves omitted context creation hints instead of turning reported defaults into explicit false',()=>{
 for(const requested of [undefined,{alpha:false,willReadFrequently:false}]){
  const window={};vm.runInNewContext(source,{window,Date,setTimeout});const canvas=rasterCanvas(64,32),creation=[];canvas.getContext('2d').getContextAttributes=()=>({alpha:true,willReadFrequently:false});window.StrokeCanvas.createRenderer(canvas,{atomicPresentation:true,separateMutable:true,contextAttributes:requested,createCanvas:(width,height)=>{const layer=rasterCanvas(width,height),get=layer.getContext;layer.getContext=(type,attributes)=>{creation.push(attributes);return get(type);};return layer;}});assert.equal(creation[0],requested);
 }
});

test('clear at the first recovery yield presents white even when staging already equals the empty target',async()=>{
 for(const mode of ['classic','canonical','layered'])for(const method of ['render','renderCooperatively']){
  const f=fixture({separateMutable:mode!=='classic'}),settings=mode==='layered'?{mutableFrom:0}:{},old=[brush(100,[[4,4],[50,25]],9,'#cc0033')],next=Array.from({length:64},(_,i)=>brush(i+1));
  f.renderer.render(old,settings);const visible=f.canvas.pixels(),copies=f.renderer.metrics().presentationCopies,recovery=f.renderer.renderCooperatively(next,settings),waiting=f.renderer.whenIdle();
  assert.equal(typeof recovery.then,'function');assert.deepEqual(f.canvas.pixels(),visible,'the pending replacement must not expose staging white');assert.ok(f.schedule.length);
  const cleared=f.renderer[method]([],settings);await f.schedule.drain();
  assert.equal(await recovery,false);await waiting;await f.renderer.whenIdle();
  assert.equal(Buffer.compare(Buffer.from(f.canvas.pixels()),Buffer.from(canonical(f,[]))),0,`${mode}/${method}: clear must commit the already-empty staging surface`);
  assert.equal(await cleared,true,'a newly committed visible frame counts as a changed atomic render');assert.equal(f.renderer.metrics().presentationCopies,copies+1);assert.equal(f.renderer.metrics().rendering,false);
 }
});

test('undo to the painted staging prefix commits that canonical prefix after cancelling a longer recovery',async()=>{
 for(const mode of ['classic','canonical','layered'])for(const method of ['render','renderCooperatively']){
  const f=fixture({separateMutable:mode!=='classic'}),settings=mode==='layered'?{mutableFrom:0}:{},old=[brush(100,[[4,4],[50,25]],9,'#cc0033')],next=Array.from({length:64},(_,i)=>brush(i+1));
  f.renderer.render(old,settings);const visible=f.canvas.pixels(),copies=f.renderer.metrics().presentationCopies,recovery=f.renderer.renderCooperatively(next,settings),waiting=f.renderer.whenIdle();
  await f.schedule.step();const count=f.renderer.metrics().strokes;assert.ok(count>0&&count<next.length);assert.deepEqual(f.canvas.pixels(),visible,'one completed offscreen batch must retain the previous visible frame');
  const prefix=next.slice(0,count),undone=f.renderer[method](prefix,settings);await f.schedule.drain();
  assert.equal(await recovery,false);await waiting;await f.renderer.whenIdle();
  assert.equal(Buffer.compare(Buffer.from(f.canvas.pixels()),Buffer.from(canonical(f,prefix))),0,`${mode}/${method}: undo must commit the painted prefix rather than leaving the prior scene`);
  assert.equal(await undone,true);assert.equal(f.renderer.metrics().presentationCopies,copies+1);assert.equal(f.renderer.metrics().strokes,prefix.length);assert.equal(f.renderer.metrics().rendering,false);
 }
});

test('cancelling an unpainted append to the already-visible prefix remains a true no-op',async()=>{
 for(const separateMutable of [false,true])for(const method of ['render','renderCooperatively']){
  const f=fixture({separateMutable}),old=[brush(1),brush(2)],next=[...old,...Array.from({length:64},(_,i)=>brush(i+3))];f.renderer.render(old);
  const visible=f.canvas.pixels(),before=f.renderer.metrics(),job=f.renderer.renderCooperatively(next),cancelled=f.renderer[method](old);await f.schedule.drain();
  assert.equal(await cancelled,false);assert.equal(await job,false);await f.renderer.whenIdle();assert.deepEqual(f.canvas.pixels(),visible);assert.equal(f.renderer.metrics().presentationCopies,before.presentationCopies);assert.equal(f.renderer.metrics().strokeApplications,before.strokeApplications);
 }
});

test('settled identical atomic targets do no stroke work or presentation copies in every drawing mode',()=>{
 for(const mode of ['classic','canonical','layered']){
  const f=fixture({separateMutable:mode!=='classic'}),settings=mode==='layered'?{mutableFrom:0}:{},strokes=[brush(1),brush(2)];f.renderer.render(strokes,settings);const before=f.renderer.metrics(),visible=f.canvas.pixels();
  for(let i=0;i<100;i++){assert.equal(f.renderer.render(strokes,settings),false);assert.equal(f.renderer.renderCooperatively(strokes,settings),false);}
  assert.deepEqual(f.canvas.pixels(),visible);assert.equal(f.renderer.metrics().presentationCopies,before.presentationCopies);assert.equal(f.renderer.metrics().strokeApplications,before.strokeApplications);
 }
});
