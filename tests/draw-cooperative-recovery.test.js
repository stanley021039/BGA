const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const fill=version=>({version,strokeId:'f0000000-0000-4000-8000-'+String(version).padStart(12,'0'),tool:'fill',color:version%2?'#ff0000':'#0000ff',size:5,filled:false,points:[[0,0]]});
const run=(ui,code)=>vm.runInContext(code,ui.context),pause=()=>new Promise(resolve=>setImmediate(resolve));
function gates(){const queue=[];return {yieldToMain:()=>new Promise(resolve=>queue.push(resolve)),async step(){assert.ok(queue.length);queue.shift()();await pause();},async drain(){let limit=200;while(queue.length&&limit--){queue.shift()();await pause();}assert.ok(limit>0);}};}
async function setup(t,me='guest'){const schedule=gates(),ui=browserHarness({realRenderer:true,events:true,rendererOptions:{yieldToMain:schedule.yieldToMain}});ui.receive(drawingState(me));await pause();t.after(()=>clearTimeout(run(ui,'toast.timer')));return {ui,schedule};}
function snapshot(ui,strokes,version=strokes.length){ui.context.recoverySnapshot={canvasEpoch:CANVAS_EPOCH,round:1,version,strokes};return run(ui,'applyCanvasSnapshot(recoverySnapshot)');}

test('cold snapshot accepts new SSE and active draft movement between recovery batches without replaying fills',async t=>{
 const {ui,schedule}=await setup(t,'artist');ui.element('#color').value='#000000';ui.listeners.get('#drawCanvas:pointerdown')({button:0,pointerId:2,point:[20,20],preventDefault(){}});
 const strokes=Array.from({length:6},(_,i)=>fill(i+1));snapshot(ui,strokes);assert.equal(run(ui,'canvasRecovering'),true);await schedule.step();
 ui.listeners.get('#drawCanvas:pointermove')({pointerId:2,point:[32,22],preventDefault(){}});ui.sources[0].emit('stroke',{canvasEpoch:CANVAS_EPOCH,round:1,version:7,stroke:fill(7)});
 await schedule.drain();await run(ui,'waitForCanvasRender()');assert.equal(run(ui,'canvasRecovering'),false);assert.equal(run(ui,'canvasRenderer.metrics().fillApplications'),7);assert.ok(run(ui,'canvasRenderer.metrics().cancelledRenders')>=1);
 assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);assert.deepEqual(ui.element('#drawCanvas').pixel(32,22),[0,0,0,255]);assert.equal(run(ui,'active.points.length'),2);
});

test('reset and a new round during yielded recovery keep late old work out of the new canvas',async t=>{
 const {ui,schedule}=await setup(t),strokes=Array.from({length:8},(_,i)=>fill(i+1));snapshot(ui,strokes);await schedule.step();
 ui.sources[0].emit('reset',{canvasEpoch:CANVAS_EPOCH,round:1,version:9,strokes:strokes.slice(0,3)});await schedule.drain();await run(ui,'waitForCanvasRender()');assert.equal(run(ui,'canvasVersion'),9);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,0,0,255]);
 snapshot(ui,strokes,10);await schedule.step();const next=drawingState('guest');next.round=2;next.canvasEpoch=CANVAS_EPOCH.replace(/1$/,'2');ui.setSnapshot({canvasEpoch:next.canvasEpoch,round:2,version:0,strokes:[]});ui.receive(next);await pause();await schedule.drain();await run(ui,'waitForCanvasRender()');
 assert.equal(run(ui,'canvasRound'),2);assert.equal(run(ui,'canvasVersion'),0);assert.equal(run(ui,'canvasRecovering'),false);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
});


function publicResult(strokes,round=1,epoch=CANVAS_EPOCH){
 const result={resultId:'10000000-0000-4000-8000-000000000001',gameRunId:'game-a',canvasEpoch:epoch,round,answer:'原來的答案',artist:{id:'artist',name:'原畫者'},guessedIds:[],scores:[{id:'artist',name:'原畫者',roundPoints:0,score:0}]};
 return {result,canvas:{canvasEpoch:epoch,round,version:strokes.length,strokes}};
}
function servePublic(ui,published,saveHandler){
 ui.context.fetch=async(route,options)=>{
  if(route.startsWith('/api/draw/result?'))return {ok:true,json:async()=>structuredClone(published)};
  assert.equal(route,'/api/draw/result/save');return saveHandler(JSON.parse(options.body));
 };
}
function reveal(ui,published){
 const state={...drawingState('guest'),phase:'reveal',result:published.result,recentResults:[published.result],gameRunId:published.result.gameRunId};ui.receive(state);return state;
}
test('reveal and collection render an immutable published image while the active canvas changes',async t=>{
 const {ui,schedule}=await setup(t),published=publicResult(Array.from({length:6},(_,i)=>fill(i+1)));let savedPixels,posted;
 const create=ui.context.document.createElement;
 ui.context.document.createElement=tag=>{const node=create(tag);if(tag==='canvas')node.toDataURL=()=>{savedPixels=node.pixels();return 'data:image/png;base64,c3ludGhldGlj';};return node;};
 servePublic(ui,published,async body=>{posted=body;return {ok:true,json:async()=>({resultId:body.resultId,canvasEpoch:CANVAS_EPOCH})};});
 ui.element('#drawCanvas').toDataURL=()=>{throw Error('the active canvas must never be encoded');};
 reveal(ui,published);const saving=run(ui,'saveArtwork()');await pause();
 const newer=drawingState('guest');newer.round=2;newer.canvasEpoch=CANVAS_EPOCH.replace(/1$/,'2');newer.recentResults=[published.result];newer.gameRunId='game-a';newer.version++;
 ui.setSnapshot({canvasEpoch:newer.canvasEpoch,round:2,version:0,strokes:[]});ui.receive(newer);await pause();await schedule.drain();await saving;
 assert.equal(posted.resultId,published.result.resultId);assert.equal(posted.name,undefined);
 assert.deepEqual([...savedPixels.slice(0,4)],[0,0,255,255]);assert.deepEqual(ui.element('#drawCanvas').pixel(400,200),[255,255,255,255]);
 assert.equal(run(ui,'busy'),false);assert.match(ui.element('#drawResultSaveStatus').textContent,/已加入/);
});
test('a failed result encoder preserves the snapshot and exposes retry without uploading partial pixels',async t=>{
 const {ui}=await setup(t),published=publicResult([fill(1)]);let posts=0;
 servePublic(ui,published,async body=>{posts++;return {ok:true,json:async()=>({resultId:body.resultId,canvasEpoch:CANVAS_EPOCH})};});
 reveal(ui,published);await run(ui,'resultsView.open(state.result.resultId)');
 const factory=ui.context.window.StrokeCanvas.createRenderer;
 ui.context.window.StrokeCanvas.createRenderer=(canvas,options)=>{const renderer=factory(canvas,options);renderer.renderCooperatively=()=>Promise.reject(Error('result image unavailable'));return renderer;};
 await run(ui,'resultsView.save(state.result.resultId)');assert.equal(posts,0);
 assert.match(ui.element('#drawResultSaveStatus').textContent,/result image unavailable/);assert.equal(ui.element('#drawResultSave').disabled,false);
 assert.equal(run(ui,'resultsView.store.view().snapshot.result.answer'),'原來的答案');
 ui.context.window.StrokeCanvas.createRenderer=factory;await run(ui,'resultsView.save(state.result.resultId)');
 assert.equal(posts,1);assert.match(ui.element('#drawResultSaveStatus').textContent,/已加入/);
});
test('a delayed result load survives a new game round one and saves only its captured public result',async t=>{
 const {ui}=await setup(t),published=publicResult([fill(1)]);let resolveResult,posted;
 ui.context.fetch=async(route,options)=>{
  if(route.startsWith('/api/draw/result?'))return new Promise(resolve=>resolveResult=()=>resolve({ok:true,json:async()=>published}));
  posted=JSON.parse(options.body);return {ok:true,json:async()=>({resultId:posted.resultId,canvasEpoch:CANVAS_EPOCH})};
 };
 reveal(ui,published);const saving=run(ui,'saveArtwork()');await pause();
 const next=drawingState('artist');next.version++;next.gameRunId='game-b';next.canvasEpoch=CANVAS_EPOCH.replace(/1$/,'3');next.recentResults=[published.result];ui.setSnapshot({canvasEpoch:next.canvasEpoch,round:1,version:0,strokes:[]});ui.receive(next);await pause();
 resolveResult();await saving;
 assert.equal(posted.resultId,published.result.resultId);assert.equal(posted.base64,'c3ludGhldGlj');
 assert.equal(run(ui,'state.gameRunId'),'game-b');assert.match(ui.element('#drawResultAuthor').textContent,/先前對局/);
});
test('pagehide cancels an encoder before POST and does not leave its cancelled render pending',async t=>{
 const {ui,schedule}=await setup(t),published=publicResult(Array.from({length:6},(_,i)=>fill(i+1)));let posts=0;
 servePublic(ui,published,async body=>{posts++;return {ok:true,json:async()=>({resultId:body.resultId,canvasEpoch:CANVAS_EPOCH})};});
 reveal(ui,published);await run(ui,'resultsView.open(state.result.resultId)');const saving=run(ui,'resultsView.save(state.result.resultId)');await pause();
 ui.listeners.get('window:pagehide')({persisted:false});await schedule.drain();await saving;
 assert.equal(posts,0);assert.equal(run(ui,'resultsView.store.view().savingId'),null);
});

test('returning from BFCache rebuilds the revealed immutable preview with the restored room context',async t=>{
 const {ui}=await setup(t),published=publicResult([fill(1)]),requested=[];
 ui.context.fetch=async route=>{requested.push(route);return {ok:true,json:async()=>structuredClone(published)};};
 const state=reveal(ui,published);await pause();assert.deepEqual(ui.element('#stagePreview').pixel(15,15),[255,0,0,255]);
 ui.listeners.get('window:pagehide')({persisted:true});assert.equal(run(ui,'stageResultPreview'),null);
 ui.context.RoomApi.request=async()=>state;ui.listeners.get('window:pageshow')({persisted:true});await pause();
 assert.deepEqual(ui.element('#stagePreview').pixel(15,15),[255,0,0,255]);assert.equal(ui.element('#stagePreview').hidden,false);
 assert.ok(requested.length>=2);assert.ok(requested.every(url=>url.includes('code=ABC123&')));
});
