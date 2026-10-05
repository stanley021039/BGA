const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState}=require('./helpers/draw-browser.cjs');
const fill=version=>({version,strokeId:'f0000000-0000-4000-8000-'+String(version).padStart(12,'0'),tool:'fill',color:version%2?'#ff0000':'#0000ff',size:5,filled:false,points:[[0,0]]});
const run=(ui,code)=>vm.runInContext(code,ui.context),pause=()=>new Promise(resolve=>setImmediate(resolve));
function gates(){const queue=[];return {yieldToMain:()=>new Promise(resolve=>queue.push(resolve)),async step(){assert.ok(queue.length);queue.shift()();await pause();},async drain(){let limit=200;while(queue.length&&limit--){queue.shift()();await pause();}assert.ok(limit>0);}};}
async function setup(t,me='guest'){const schedule=gates(),ui=browserHarness({realRenderer:true,events:true,rendererOptions:{yieldToMain:schedule.yieldToMain}});ui.receive(drawingState(me));await pause();t.after(()=>clearTimeout(run(ui,'toast.timer')));return {ui,schedule};}
function snapshot(ui,strokes,version=strokes.length){ui.context.recoverySnapshot={round:1,version,strokes};return run(ui,'applyCanvasSnapshot(recoverySnapshot)');}

test('cold snapshot accepts new SSE and active draft movement between recovery batches without replaying fills',async t=>{
 const {ui,schedule}=await setup(t,'artist');ui.element('#color').value='#000000';ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:2,point:[20,20],preventDefault(){}});
 const strokes=Array.from({length:6},(_,i)=>fill(i+1));snapshot(ui,strokes);assert.equal(run(ui,'canvasRecovering'),true);await schedule.step();
 ui.listeners.get('#drawCanvas:pointermove')({pointerId:2,point:[32,22],preventDefault(){}});ui.sources[0].emit('stroke',{round:1,version:7,stroke:fill(7)});
 await schedule.drain();await run(ui,'waitForCanvasRender()');assert.equal(run(ui,'canvasRecovering'),false);assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),7);assert.ok(run(ui,'canvasRenderer.metrics().cancelledRenders')>=1);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);assert.deepEqual(ui.element('#drawCanvas').pixel(32,22),[0,0,0,255]);assert.equal(run(ui,'active.points.length'),2);
});

test('reset and a new round during yielded recovery keep late old work out of the new canvas',async t=>{
 const {ui,schedule}=await setup(t),strokes=Array.from({length:8},(_,i)=>fill(i+1));snapshot(ui,strokes);await schedule.step();
 ui.sources[0].emit('reset',{round:1,version:9,strokes:strokes.slice(0,3)});await schedule.drain();await run(ui,'waitForCanvasRender()');assert.equal(run(ui,'canvasVersion'),9);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);
 snapshot(ui,strokes,10);await schedule.step();const next=drawingState('guest');next.round=2;ui.setSnapshot({round:2,version:0,strokes:[]});ui.receive(next);await pause();await schedule.drain();await run(ui,'waitForCanvasRender()');
 assert.equal(run(ui,'canvasRound'),2);assert.equal(run(ui,'canvasVersion'),0);assert.equal(run(ui,'canvasRecovering'),false);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
});

test('reveal preview and artwork save wait for the latest completed image after SSE replaces an older recovery',async t=>{
 const {ui,schedule}=await setup(t),strokes=Array.from({length:6},(_,i)=>fill(i+1));snapshot(ui,strokes);let previewPixels=null,uploads=0,savedPixels=null;
 ui.element('#stagePreview').getContext=()=>({drawImage(){previewPixels=ui.element('#drawCanvas').pixels();}});
 const reveal={...drawingState('guest'),phase:'reveal',strokeVersion:6,result:{answer:'測試',reason:'完成',guessedIds:[]}};ui.receive(reveal);ui.setSnapshot({round:1,version:6,strokes});
 ui.element('#drawCanvas').toDataURL=()=>{savedPixels=ui.element('#drawCanvas').pixels();return 'data:image/png;base64,c3ludGhldGlj';};
 ui.context.fetch=async route=>{assert.equal(route,'/api/artworks');uploads++;return {ok:true,json:async()=>({})};};
 const save=run(ui,'saveArtwork()');await pause();assert.equal(uploads,0);await schedule.step();ui.sources[0].emit('stroke',{round:1,version:7,stroke:fill(7)});
 await schedule.drain();await save;assert.equal(uploads,1);assert.deepEqual(savedPixels,ui.element('#drawCanvas').pixels());assert.deepEqual(previewPixels,ui.element('#drawCanvas').pixels());assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);
});

test('failed latest render blocks artwork upload without an unhandled rejection or false success',async t=>{
 const {ui}=await setup(t,'artist');let uploads=0,encoded=0;ui.context.fetch=async()=>{uploads++;return {ok:true,json:async()=>({})};};ui.element('#drawCanvas').toDataURL=()=>{encoded++;return 'data:image/png;base64,c3ludGhldGlj';};
 ui.context.StrokeCanvasError=Error('canvas image unavailable');run(ui,'canvasRenderer.renderCooperatively=()=>Promise.reject(StrokeCanvasError);redrawCanvas()');await run(ui,'canvasRenderPromise');
 assert.equal(run(ui,'canDraw()'),false);await run(ui,'saveArtwork()');assert.equal(uploads,0);assert.equal(encoded,0);assert.match(ui.element('#drawStatus').textContent,/canvas image unavailable/);
});

test('changing round while artwork save waits cancels the old recovery and never uploads a blank new-round image',async t=>{
 const {ui,schedule}=await setup(t),strokes=Array.from({length:6},(_,i)=>fill(i+1));snapshot(ui,strokes);ui.setSnapshot({round:1,version:6,strokes});let uploads=0;
 ui.context.fetch=async()=>{uploads++;return {ok:true,json:async()=>({})};};ui.element('#drawCanvas').toDataURL=()=>{throw Error('must not encode a different round');};
 const saving=run(ui,'saveArtwork()');await pause();const next=drawingState('guest');next.round=2;ui.setSnapshot({round:2,version:0,strokes:[]});ui.receive(next);await pause();await schedule.drain();await saving;
 assert.equal(uploads,0);assert.match(ui.element('#drawStatus').textContent,/下一輪/);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
});
