const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {rasterCanvas}=require('./helpers/raster-canvas.cjs');
const {browserHarness,drawingState}=require('./helpers/draw-browser.cjs');
function player(){let clock=0,next=0,paint=0,jobs=new Map();const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/shared/draw-playback.js'),'utf8'),{window});const playback=window.DrawPlayback.create({now:()=>clock,requestFrame:cb=>{jobs.set(++next,cb);return next;},cancelFrame:id=>jobs.delete(id),onFrame:()=>paint++});return {playback,tick(t){clock=t;const current=[...jobs.values()];jobs.clear();current.forEach(cb=>cb());},now(t){clock=t;},paints:()=>paint};}
function stroke(version,points,times,id='same-stroke'){return {version,strokeId:id,tool:'brush',curve:'quadratic',color:'#000000',size:2,points,pointTimes:times};}

test('dt interpolates between received samples on every frame without changing accepted points or times',()=>{
 const p=player(),s=stroke(1,[[0,0],[100,0]],[0,100]),original=JSON.stringify(s);p.playback.add(s);p.tick(60);assert.equal(p.playback.view(s).points.length,1);
 p.tick(85);assert.deepEqual(Array.from(p.playback.view(s).points.at(-1)),[25,0]);const paints=p.paints();p.tick(110);assert.equal(p.paints(),paints+1);assert.deepEqual(Array.from(p.playback.view(s).points.at(-1)),[50,0]);
 assert.equal(JSON.stringify(s),original);p.tick(160);assert.equal(p.playback.view(s),s);assert.equal(p.playback.metrics().pendingSamples,0);assert.equal(p.playback.metrics().scheduled,false);
});
test('late continuous batches keep the first dt origin instead of restarting at receive time',()=>{
 const p=player(),a=stroke(1,[[0,0],[100,0]],[0,100]),b=stroke(2,[[100,0],[200,0]],[100,200]);p.playback.add(a);p.tick(160);p.now(240);p.playback.add(b);p.tick(250);
 assert.deepEqual(Array.from(p.playback.view(b).points.at(-1)),[190,0]);p.tick(260);assert.equal(p.playback.view(b),b);assert.equal(p.playback.metrics().pendingSamples,0);
});
test('backlog catch-up compresses remaining time while keeping all samples, order and completed prefixes',()=>{
 const p=player(),a=stroke(1,[[0,0],[10,0]],[0,50]),b=stroke(2,Array.from({length:64},(_,i)=>[10+i,0]),Array.from({length:64},(_,i)=>50+i*30));p.playback.add(a);p.tick(80);const count=p.playback.view(a).playbackCount;p.playback.add(b);
 assert.ok(p.playback.metrics().leadMs<=180.001);p.tick(90);assert.ok(p.playback.view(a).playbackCount>=count||p.playback.view(a)===a);
 p.tick(260);assert.equal(p.playback.view(a),a);assert.equal(p.playback.view(b),b);assert.equal(p.playback.metrics().pendingSamples,0);assert.equal(b.points.length,64);
});
test('reset cancels an interpolated tail and the old frame cannot restore it',()=>{
 const p=player(),s=stroke(1,[[0,0],[100,0]],[0,100]);p.playback.add(s);p.tick(80);p.playback.reset();const paints=p.paints();p.tick(400);assert.equal(p.paints(),paints);assert.equal(p.playback.view(s),s);assert.equal(p.playback.metrics().pendingEntries,0);
});

const canvasWindow={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8'),{window:canvasWindow});const geometry=canvasWindow.StrokeCanvas;
test('marked curve chunks reproduce the unsplit curve through static, incremental, atomic and draft settlement paths',async()=>{
 const points=[[2,12],[6,2],[13,12],[20,2],[27,12]],full=stroke(1,points,[0,10,20,30,40]),chunks=[stroke(1,points.slice(0,3),[0,10,20]),stroke(2,points.slice(2),[20,30,40])];
 const reference=rasterCanvas();geometry.redraw(reference,[full]);
 for(const options of [{},{separateMutable:true},{atomicPresentation:true}]){
  const canvas=rasterCanvas(),renderer=geometry.createRenderer(canvas,{...options,createCanvas:(w,h)=>rasterCanvas(w,h)});
  await renderer.renderCooperatively([chunks[0]],{keys:['first']});await renderer.renderCooperatively(chunks,{keys:['first','second']});await renderer.whenIdle();assert.deepEqual(canvas.pixels(),reference.pixels());
  await renderer.renderCooperatively([full],{keys:['draft'],mutableFrom:0});await renderer.renderCooperatively(chunks,{keys:['first','second']});await renderer.whenIdle();assert.deepEqual(canvas.pixels(),reference.pixels());renderer.reset();
 }
 const copied=rasterCanvas();geometry.redraw(copied,chunks);assert.deepEqual(copied.pixels(),reference.pixels());
 const legacy=rasterCanvas();geometry.redraw(legacy,[{...full,curve:undefined}]);assert.notDeepEqual(legacy.pixels(),reference.pixels(),'legacy pieces retain their original straight geometry');
});
test('tool/style/anchor barriers prevent curve merging and original input budgets remain enforced',()=>{
 const a=stroke(1,[[2,12],[8,2],[14,12]],[0,10,20]),b=stroke(2,[[14,12],[20,2],[27,12]],[20,30,40]);
 for(const suffix of [{...b,strokeId:'different'},{...b,color:'#ff0000'},{...b,size:3},{...b,points:[[15,12],...b.points.slice(1)]}]){
  const expected=rasterCanvas(),actual=rasterCanvas();expected.getContext('2d').fillStyle='#fff';expected.getContext('2d').fillRect(0,0,32,16);geometry.drawStroke(expected.getContext('2d'),a);geometry.drawStroke(expected.getContext('2d'),suffix);geometry.redraw(actual,[a,suffix]);assert.deepEqual(actual.pixels(),expected.pixels());
 }
 const renderer=geometry.createRenderer(rasterCanvas(),{maxStrokes:1,maxPoints:4});assert.throws(()=>renderer.render([a,b]),/stroke limit/);assert.throws(()=>renderer.render([{...a,points:Array(5).fill([1,1])}]),/work limit/);
});
test('curve metadata survives accepted/snapshot/result paths; invalid curves cannot consume IDs, rate or quota',()=>{
 let now=100000;const room=new DrawGuessRoom('ABC123','curve',()=>0,()=>now),host=room.add('Artist');room.add('Viewer');room.start();room.choose(host.id,room.candidates[0].id);
 const data={round:room.round,canvasEpoch:room.canvas.epoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:3,curve:'quadratic',points:[[1,1],[5,10]],pointTimes:[0,40]};
 for(const curve of [null,{},true,1,'cubic']){const before=JSON.stringify(room.canvasSnapshot());assert.throws(()=>room.addStroke(host.id,{...data,curve}),/曲線格式/);assert.equal(JSON.stringify(room.canvasSnapshot()),before);}
 for(const tool of ['erase','line','rect','ellipse','fill'])assert.throws(()=>room.addStroke(host.id,{...data,tool,points:tool==='fill'?[[1,1]]:data.points,pointTimes:undefined}),/曲線格式/);
 const accepted=room.addStroke(host.id,data);assert.equal(accepted.stroke.curve,'quadratic');assert.equal(room.canvasSnapshot().strokes[0].curve,'quadratic');assert.equal(room.addStroke(host.id,{...data,curve:null}).duplicate,true);assert.deepEqual(room.canvasQuota(),{usedFills:0,usedBatches:1,usedPoints:2});room.reveal();assert.equal(room.resultSnapshot(room.result.resultId).canvas.strokes[0].curve,'quadratic');
});
test('sixteen input points trigger an early flush and retain the curve/timing contract',async t=>{
 let clock=0,id=0;const timers=new Map(),time={now:()=>clock,setTimeout(fn,delay=0){timers.set(++id,{fn,due:clock+delay});return id;},clearTimeout:id=>timers.delete(id)};
 const ui=browserHarness({clock:time});ui.receive(drawingState('artist'));for(let i=0;i<12;i++)await Promise.resolve();t.after(()=>ui.listeners.get('window:pagehide')({persisted:false}));
 const pointer=(type,i)=>ui.listeners.get('#drawCanvas:'+type)({point:[i,i],pointerId:1,button:0,timeStamp:1000+i,preventDefault(){}});
 pointer('pointerdown',0);for(let i=1;i<16;i++)pointer('pointermove',i);
 for(const [key,job]of [...timers])if(job.due<=clock){timers.delete(key);job.fn();}for(let i=0;i<12;i++)await Promise.resolve();
 assert.equal(ui.strokeRequests.length,1);const data=ui.strokeRequests[0].data;assert.equal(data.points.length,16);assert.equal(data.curve,'quadratic');assert.deepEqual(Array.from(data.pointTimes),Array.from({length:16},(_,i)=>i));
});
