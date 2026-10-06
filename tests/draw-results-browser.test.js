const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const {rasterCanvas}=require('./helpers/raster-canvas.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/draw-results.js'),'utf8');
const run=(ui,code)=>vm.runInContext(code,ui.context),pause=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function result(number=1){
 const canvasEpoch='00000000-0000-4000-8000-'+String(number).padStart(12,'0');
 return {result:{resultId:'result-'+number,gameRunId:'game-a',canvasEpoch,round:number,answer:'答案 '+number,artist:{id:'artist',name:'原畫者 '+number},scores:[{id:'guest',name:'原猜者',score:85,roundPoints:85}]},canvas:{canvasEpoch,round:number,version:1,strokes:[{version:1,strokeId:'10000000-0000-4000-8000-000000000001',tool:'line',color:'#ff0000',size:5,filled:false,points:[[10,10],[20,20]]}]}};
}
function setupStore(options={}){
 const context=vm.createContext({window:{}});vm.runInContext(source,context);
 return context.window.DrawResults.createStore({loadResult:async id=>result(Number(id.split('-')[1])),saveResult:async snapshot=>({resultId:snapshot.result.resultId,canvasEpoch:snapshot.result.canvasEpoch}),...options});
}
function stateFor(results,code='ABC123'){return {code,gameRunId:'game-a',recentResults:results.map(item=>item.result)};}

test('result snapshots freeze author, answer, per-round score and strokes independently of later live state',async()=>{
 const original=result(),store=setupStore({loadResult:async()=>original}),state=stateFor([original]);store.update(state);await store.select();
 original.result.answer='換題';original.result.artist.name='改名';original.result.scores[0].score=999;original.canvas.strokes[0].points[0][0]=200;
 const saved=store.view().snapshot;assert.equal(saved.result.answer,'答案 1');assert.equal(saved.result.artist.name,'原畫者 1');assert.equal(saved.result.scores[0].roundPoints,85);assert.equal(saved.result.scores[0].score,85);assert.equal(saved.canvas.strokes[0].points[0][0],10);
 assert.ok(Object.isFrozen(saved.canvas.strokes[0].points[0]));
 store.update({...state,gameRunId:'game-b'});assert.equal(store.view().gameRunId,'game-b');assert.equal(store.view().snapshot,saved);
});

test('selecting another result ignores a delayed older selection and retains each independent image',async()=>{
 const a=deferred(),b=deferred(),store=setupStore({loadResult:id=>id==='result-1'?a.promise:b.promise});store.update(stateFor([result(2),result(1)]));
 const first=store.select('result-1'),second=store.select('result-2');b.resolve(result(2));await second;
 assert.equal(store.view().snapshot.result.resultId,'result-2');a.resolve(result(1));await first;
 assert.equal(store.view().selectedId,'result-2');assert.equal(store.view().snapshot.result.answer,'答案 2');assert.equal(store.view().loading,false);
 await store.select('result-1');assert.equal(store.view().snapshot.result.answer,'答案 1');
});

test('changing rooms ignores both pending old-room loads and collection acknowledgements',async()=>{
 const loading=deferred(),saving=deferred(),requested=[];
 const store=setupStore({loadResult:(id,room)=>{requested.push([id,room]);return id==='result-1'?loading.promise:Promise.resolve(result(2));},saveResult:(snapshot,options,room)=>{requested.push(['save',snapshot.result.resultId,room]);return saving.promise;}});
 store.update(stateFor([result(1)]));const oldLoad=store.select();store.update(stateFor([result(2)],'NEW456'));await store.select();loading.resolve(result(1));await oldLoad;
 assert.equal(store.view().room,'NEW456');assert.equal(store.view().snapshot.result.resultId,'result-2');
 const oldSave=store.save();store.update(stateFor([result(1)],'THIRD7'));saving.resolve({resultId:'result-2',canvasEpoch:result(2).result.canvasEpoch});await oldSave;
 assert.equal(store.view().room,'THIRD7');assert.equal(store.view().save,null);assert.equal(store.view().snapshot,null);assert.equal(store.view().savingId,null);
 assert.deepEqual(requested,[['result-1','ABC123'],['result-2','NEW456'],['save','result-2','NEW456']]);
});

test('collection pins the selected result, deduplicates pending clicks and waits for the matching ACK',async()=>{
 const ack=deferred(),requests=[],store=setupStore({saveResult:(snapshot,options,room)=>{requests.push({snapshot,options,room});return ack.promise;}});
 store.update(stateFor([result(2),result(1)]));await store.select('result-1');const pending=store.save();assert.equal(store.save(),pending);
 assert.equal(store.view().save.status,'pending');await store.select('result-2');assert.equal(await store.save(),null);assert.equal(requests.length,1);
 assert.equal(requests[0].snapshot.result.answer,'答案 1');assert.equal(requests[0].room,'ABC123');ack.resolve({resultId:'result-1',canvasEpoch:CANVAS_EPOCH});await pending;
 assert.equal(store.view().selectedId,'result-2');assert.equal(store.view().save,null);await store.select('result-1');assert.equal(store.view().save.status,'saved');
 await store.save();assert.equal(requests.length,1);
});

test('load and receipt failures preserve metadata and expose retry; deleted collections require explicit recollect',async()=>{
 let loads=0,mode='deleted';const requests=[],store=setupStore({loadResult:async()=>{if(!loads++)throw Error('offline');return result();},saveResult:async(snapshot,options)=>{requests.push(options.recollect);if(mode==='deleted'){const error=Error('deleted');error.code='DRAW_SAVED_ARTWORK_DELETED';throw error;}if(mode==='mismatch')return {resultId:'result-2',canvasEpoch:CANVAS_EPOCH};return {resultId:'result-1',canvasEpoch:CANVAS_EPOCH};}});
 store.update(stateFor([result()]));assert.equal(await store.select(),null);assert.equal(store.view().summary.answer,'答案 1');assert.match(store.view().error.message,/offline/);await store.select();
 await store.save();assert.equal(store.view().save.error.code,'DRAW_SAVED_ARTWORK_DELETED');mode='mismatch';await store.save(undefined,{recollect:true});assert.equal(store.view().save.status,'error');assert.match(store.view().save.error.message,/不符/);
 mode='success';await store.save(undefined,{recollect:true});assert.equal(store.view().save.status,'saved');assert.deepEqual(requests,[false,true,true]);
});

test('the latest eight public results remain bounded while an already selected older image stays readable',async()=>{
 const store=setupStore();store.update(stateFor([result(1)]));await store.select();const selected=store.view().snapshot;
 store.update(stateFor(Array.from({length:12},(_,index)=>result(index+2))));assert.equal(store.view().results.length,8);assert.equal(store.view().snapshot,selected);assert.equal(store.view().summary.artist.name,'原畫者 1');
 const refreshed=setupStore();refreshed.update(stateFor(Array.from({length:8},(_,index)=>result(index+2))));await refreshed.select();assert.equal(refreshed.view().snapshot.result.resultId,'result-2');
});

test('player cards retain correct, pending, late-join and offline roles through reveal and finish',()=>{
 const ui=browserHarness({events:true}),s=drawingState('guest');s.players.push({id:'third',name:'阿橙',score:0,online:false},{id:'late',name:'新朋友',score:0,online:false,waitingForNextRound:true});s.participantIds.push('third');s.guessedIds=['guest'];ui.receive(s);
 assert.match(ui.element('#players').innerHTML,/data-player-id="guest".*已猜中/);assert.match(ui.element('#players').innerHTML,/data-player-id="third".*尚未猜中 · 暫時離線/);assert.match(ui.element('#players').innerHTML,/data-player-id="late".*下輪加入 · 暫時離線/);
 assert.match(run(ui,"playerStatus(state.players[2])"),/尚未猜中 · 暫時離線/);assert.match(run(ui,"playerStatus(state.players[3])"),/下輪加入 · 暫時離線/);assert.equal(run(ui,"playerStatus(state.players[0])"),'畫圖中');
 ui.sources[0].emit('error',{});assert.match(ui.element('#connection').textContent,/正在重連/);assert.match(run(ui,"playerStatus(state.players[1])"),/已猜中 · 正在重連/);
 ui.sources[0].emit('ready',{canvasEpoch:CANVAS_EPOCH,round:1,version:0});assert.equal(ui.element('#connection').textContent,'');
 const finished={...s,phase:'finished',winner:{ids:['guest']},players:s.players.map(p=>({...p,waitingForNextRound:false}))};ui.receive(finished);
 assert.equal(run(ui,"playerStatus(state.players[3])"),'本輪未參與 · 暫時離線');assert.equal(run(ui,"playerStatus(state.players[2])"),'尚未猜中 · 暫時離線');
 ui.receive({...s,phase:'choosing',guessedIds:[]});assert.match(ui.element('#players').innerHTML,/data-player-id="artist".*選題中/);assert.equal(run(ui,"playerStatus(state.players[0])"),'選題中');
});

test('the exceptional artist-offline notice does not duplicate normal guess status or survive reconnection',()=>{
 const ui=browserHarness(),s=drawingState('guest');s.guessedIds=['guest'];ui.receive(s);
 assert.equal(ui.element('#drawWaiting').hidden,true);
 assert.equal(ui.element('#drawWaitingTitle').textContent,'');assert.equal(ui.element('#drawWaitingNames').textContent,'');
 const offline={...s,version:3,players:s.players.map(player=>({...player,online:player.id!=='artist'}))};ui.receive(offline);
 assert.equal(ui.element('#drawWaiting').hidden,false);assert.match(ui.element('#drawWaitingTitle').textContent,/畫者/);assert.match(ui.element('#drawWaitingNames').textContent,/重新連線/);
 assert.equal(run(ui,'state.deadline'),s.deadline,'presence and notice updates do not pause the round');
 ui.receive({...s,version:4});assert.equal(ui.element('#drawWaiting').hidden,true);assert.equal(ui.element('#drawWaitingNames').textContent,'');
 ui.receive({...offline,version:5,phase:'finished',deadline:null,winner:{ids:['guest']}});assert.equal(ui.element('#drawWaiting').hidden,true);
 assert.match(ui.element('#players').innerHTML,/data-player-id="artist".*暫時離線/,'the player card still records offline presence after the game');
});

test('correct player cards keep a static SVG marker alongside offline text and clear it on the next round',()=>{
 const ui=browserHarness(),s=drawingState('guest');s.players[1].online=false;s.guessedIds=['guest'];ui.receive(s);
 const marked=run(ui,'playerRow(state.players[1])');assert.match(marked,/class="room-player player draw-player-correct"/);assert.match(marked,/draw-correct-mark[^>]*aria-hidden="true"><svg/);assert.match(marked,/已猜中 · 暫時離線/);
 assert.doesNotMatch(run(ui,'playerRow(state.players[0])'),/draw-player-correct/);
 const next={...s,version:3,round:2,canvasEpoch:result(2).canvas.canvasEpoch,guessedIds:[]};ui.receive(next);assert.doesNotMatch(ui.element('#players').innerHTML,/draw-player-correct|draw-correct-mark/);
 ui.receive({...next,version:4,guessedIds:['guest'],participantIds:[]});assert.doesNotMatch(ui.element('#players').innerHTML,/draw-player-correct|draw-correct-mark/);
});

test('joining a finished game loads and renders the last public artwork without requiring the reveal screen first',async()=>{
 const ui=browserHarness({realRenderer:true}),published=result();let loads=0;
 ui.context.fetch=async route=>{assert.match(route,/\/api\/draw\/result\?/);loads++;return {ok:true,json:async()=>published};};
 ui.receive({...drawingState('guest'),...stateFor([published]),phase:'finished',deadline:null,result:published.result,winner:{ids:['guest']}});
 await run(ui,'resultsView.store.load("result-1")');await pause();
 assert.equal(loads,1);assert.equal(ui.element('#stagePreview').hidden,false);
 assert.deepEqual(ui.element('#stagePreview').pixel(15,15),[255,0,0,255]);
 assert.equal(ui.element('#drawCanvas').getContext('2d').calls.paths,0,'the historical picture does not paint onto the live canvas');
});

test('a delayed reveal preview paints only the replacement finished preview node for the same public result',async()=>{
 const ui=browserHarness({realRenderer:true}),published=result(),pending=deferred();let loads=0;
 ui.context.fetch=async()=>{loads++;return {ok:true,json:async()=>pending.promise};};
 const first=ui.element('#stagePreview'),replacement=Object.assign(ui.element('finished-preview'),rasterCanvas(512,256));let preview=first;
 ui.context.document.querySelector=selector=>selector==='#stagePreview'?preview:ui.element(selector);
 const revealed={...drawingState('guest'),...stateFor([published]),phase:'reveal',result:published.result};ui.receive(revealed);
 preview=replacement;ui.receive({...revealed,version:3,phase:'finished',deadline:null,winner:{ids:['guest']}});
 pending.resolve(published);await run(ui,'resultsView.store.load("result-1")');await pause();
 assert.equal(loads,1,'the same frozen result uses the existing pending load');
 assert.equal(replacement.hidden,false);assert.deepEqual(replacement.pixel(15,15),[255,0,0,255]);
 assert.equal(first.getContext('2d').calls.paths,0,'the detached reveal node cannot receive the delayed painting');
});

test('a fast SSE reconnect still suppresses its first replayed feedback and then permits a new event',()=>{
 const ui=browserHarness({events:true}),before=drawingState('guest');ui.receive(before);const count=ui.animations.length;
 ui.sources[0].emit('error',{});ui.sources[0].emit('ready',{canvasEpoch:CANVAS_EPOCH,round:1,version:0});
 const first={...before,version:3,guesses:[{id:'guest',name:'猜者',answer:'離線期間',correct:false,at:Date.now()}]};ui.receive(first);
 assert.equal(run(ui,'lastLiveState'),false);assert.equal(ui.animations.length,count);
 ui.receive({...first,version:4,guesses:[...first.guesses,{id:'guest',name:'猜者',answer:'新猜測',correct:false,at:Date.now()+1}]});assert.equal(run(ui,'lastLiveState'),true);assert.ok(ui.animations.length>count);
});

test('the result dialog keeps collection pending until ACK, and reduced motion retains its success text',async()=>{
 const ui=browserHarness(),published=result(),ack=deferred();let posts=0;
 ui.context.fetch=async(route,options)=>{if(route.startsWith('/api/draw/result?'))return {ok:true,json:async()=>published};posts++;assert.equal(JSON.parse(options.body).resultId,published.result.resultId);return ack.promise;};
 ui.receive({...drawingState('guest'),...stateFor([published])});await run(ui,'resultsView.open()');await pause();
 const count=ui.animations.length,saving=run(ui,'resultsView.save()');await pause();
 assert.equal(posts,1);assert.equal(ui.element('#drawResultSave').textContent,'收藏中…');assert.equal(ui.element('#drawResultSave').disabled,true);assert.equal(ui.animations.length,count);
 ui.context.window.MotionPolicy.set({enabled:false});ack.resolve({ok:true,json:async()=>({resultId:'result-1',canvasEpoch:CANVAS_EPOCH})});await saving;
 assert.equal(ui.element('#drawResultSave').textContent,'✓ 已收藏');assert.match(ui.element('#drawResultSaveStatus').textContent,/已加入/);assert.equal(ui.animations.length,count);
 await run(ui,'resultsView.save()');assert.equal(posts,1);
});

test('a deleted collection exposes a separate explicit recollect action before retrying',async()=>{
 const ui=browserHarness(),published=result(),requests=[];
 ui.context.fetch=async(route,options)=>{if(route.startsWith('/api/draw/result?'))return {ok:true,json:async()=>published};const body=JSON.parse(options.body);requests.push(body);return body.recollect?{ok:true,json:async()=>({resultId:'result-1',canvasEpoch:CANVAS_EPOCH})}:{ok:false,status:409,json:async()=>({error:'deleted',code:'DRAW_SAVED_ARTWORK_DELETED'})};};
 ui.receive({...drawingState('guest'),...stateFor([published])});await run(ui,'resultsView.open()');await run(ui,'resultsView.save()');
 assert.equal(ui.element('#drawResultSave').disabled,true);assert.equal(ui.element('#drawResultRecollect').hidden,false);assert.match(ui.element('#drawResultSaveStatus').textContent,/之前收藏.*刪除/);assert.equal(requests.length,1);assert.equal(requests[0].recollect,undefined);
 await ui.listeners.get('#drawResultRecollect:click')();assert.equal(requests.length,2);assert.equal(requests[1].recollect,true);assert.match(ui.element('#drawResultSave').textContent,/已收藏/);assert.equal(ui.element('#drawResultRecollect').hidden,true);assert.ok(ui.animations.includes('#drawResultSave'));
});

test('BFCache return takes a static baseline then permits the next new live feedback',async t=>{
 const ui=browserHarness(),before=drawingState('guest');ui.receive(before);await pause();t.after(()=>clearTimeout(run(ui,'toast.timer')));
 const pending=deferred();ui.context.RoomApi.request=route=>route==='state'?pending.promise:Promise.resolve({canvasEpoch:CANVAS_EPOCH,round:1,version:0,strokes:[]});
 ui.listeners.get('window:pagehide')({persisted:true});ui.listeners.get('window:pageshow')({persisted:true});const count=ui.animations.length;
 const first={...before,version:3,guesses:[{id:'guest',name:'猜者',answer:'先前猜測',correct:false,at:Date.now()}]};pending.resolve(first);await pause();
 assert.equal(run(ui,'lastLiveState'),false);assert.equal(ui.animations.length,count);
 const at=Date.now(),second={...first,version:4,serverNow:at,guessedIds:['guest'],guesses:[...first.guesses,{id:'guest',name:'猜者',correct:true,points:80,at}]};ui.receive(second);
 assert.equal(run(ui,'lastLiveState'),true);assert.ok(ui.animations.length>count);assert.equal(ui.element('#players').playerRows.find(row=>row.dataset.playerId==='guest').children.at(-1).textContent,'✓ +80 分');
});

test('a guess acknowledgement arriving after the round changes cannot replace new-round feedback or erase a draft',async t=>{
 const ui=browserHarness(),before=drawingState('guest');ui.receive(before);await pause();t.after(()=>clearTimeout(run(ui,'toast.timer')));
 const pending=deferred();let writes=0;ui.context.RoomApi.request=route=>{if(route==='action'){writes++;return pending.promise;}return Promise.resolve({canvasEpoch:result(2).canvas.canvasEpoch,round:2,version:0,strokes:[]});};
 ui.element('#guessInput').value='上一輪';const submitting=ui.listeners.get('#guessForm:submit')({preventDefault(){}});
 const newer={...before,canvasEpoch:result(2).canvas.canvasEpoch,round:2,version:10};ui.receive(newer);ui.element('#guessInput').value='新一輪草稿';assert.equal(ui.element('#drawGuessStatus').textContent,'');assert.equal(ui.element('#drawStatus').textContent,'');
 assert.equal(writes,1);pending.resolve({...before,version:4});await submitting;
 assert.equal(ui.element('#guessInput').value,'新一輪草稿');assert.equal(ui.element('#drawGuessStatus').textContent,'');assert.equal(ui.element('#drawStatus').textContent,'');assert.equal(run(ui,'state.canvasEpoch'),newer.canvasEpoch);
});
