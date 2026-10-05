const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState,CANVAS_EPOCH}=require('./helpers/draw-browser.cjs');
const run=(ui,code)=>vm.runInContext(code,ui.context),pause=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function published(n=1){const canvasEpoch=CANVAS_EPOCH.replace(/1$/,String(n));return {result:{resultId:'result-'+n,gameRunId:'game-a',canvasEpoch,round:n,answer:'公開答案 '+n,artist:{id:'artist',name:'畫者'},scores:[{id:'guest',name:'猜者',score:50,roundPoints:50}]},canvas:{canvasEpoch,round:n,version:0,strokes:[]}};}
function vote(resultId='result-1',changes={}){return {resultId,votes:0,total:3,required:2,voted:false,canVote:true,banned:false,...changes};}
function revealed(results=[published(1)],votes=results.map(item=>vote(item.result.resultId))){const current=results[0];return {...drawingState('guest'),version:5,phase:'reveal',gameRunId:'game-a',round:current.result.round,canvasEpoch:current.result.canvasEpoch,result:current.result,recentResults:results.map(item=>item.result),resultVotes:votes};}
function json(value,ok=true,status=200){return {ok,status,json:async()=>value};}
function serve(ui,results,ban,save=async body=>json({resultId:body.resultId,canvasEpoch:results.find(item=>item.result.resultId===body.resultId).result.canvasEpoch})){
 ui.context.fetch=async(route,options)=>{if(route.startsWith('/api/draw/result?')){const id=new URL('http://localhost'+route).searchParams.get('resultId');return json(structuredClone(results.find(item=>item.result.resultId===id)));}const body=JSON.parse(options.body);if(route==='/api/draw/result/ban')return ban(body);assert.equal(route,'/api/draw/result/save');return save(body);};
}
function stageClick(ui){const id=run(ui,'state.result.resultId'),button=ui.element('#stageBan');button.dataset.do='ban';button.dataset.resultId=id;return ui.listeners.get('#canvasStage:click')({target:{closest:()=>button}});}

test('reveal offers the fixed result vote without opening review; duplicate clicks wait for server ACK and errors remain retryable',async()=>{
 const ui=browserHarness(),p=published(),state=revealed(),first=deferred(),requests=[];let failed=true;
 serve(ui,[p],body=>{requests.push(body);return failed?first.promise:Promise.resolve(json({...state,version:6,resultVotes:[vote('result-1',{votes:1,voted:true,canVote:false})]}));});ui.receive(state);await pause();
 assert.match(ui.element('#canvasStage').innerHTML,/id="stageBan"[^>]*data-result-id="result-1"/);assert.equal(ui.element('#stageBan').disabled,false);assert.match(ui.element('#stageBanSummary').textContent,/0 \/ 3 票，需 2 票.*全站/);assert.equal(ui.element('#drawResults').open,false);
 const pending=stageClick(ui),duplicate=run(ui,"resultsView.vote('result-1')");assert.equal(run(ui,"resultsView.vote('result-1')"),duplicate);await pause();assert.equal(requests.length,1);assert.deepEqual(requests[0],{code:'ABC123',resultId:'result-1'});assert.equal(ui.element('#stageBan').textContent,'送出投票…');assert.equal(ui.element('#stageBan').disabled,true);assert.equal(run(ui,'busy'),false);
 first.resolve(json({error:'題庫暫時無法寫入，請重試',code:'DRAW_BAN_UNAVAILABLE'},false,503));await pending;
 assert.equal(ui.element('#stageBan').disabled,false);assert.equal(ui.element('#stageBan').textContent,'重試禁止題目');assert.match(ui.element('#stageBanStatus').textContent,/請重試/);assert.match(ui.element('#stageBanSummary').textContent,/0 \/ 3/);
 failed=false;await stageClick(ui);assert.equal(requests.length,2);assert.equal(ui.element('#stageBan').textContent,'已投票');assert.equal(ui.element('#stageBan').disabled,true);assert.match(ui.element('#stageBanSummary').textContent,/1 \/ 3/);
 ui.receive({...state,version:7,resultVotes:[vote('result-1',{votes:2,voted:true,canVote:false,banned:true})]});assert.equal(ui.element('#stageBan').textContent,'已移除題庫');assert.match(ui.element('#stageBanSummary').textContent,/2 \/ 3.*全站已停止/);
});

test('vote-only polls update both surfaces without changing the selected immutable picture, including same-version global bans',async()=>{
 const ui=browserHarness(),p=published(),state=revealed();serve(ui,[p],()=>{throw Error('not voting');});ui.receive(state);await run(ui,"resultsView.open('result-1')");const snapshot=run(ui,'resultsView.store.view().snapshot'),stageMarkup=ui.element('#canvasStage').innerHTML;
 ui.receive({...state,resultVotes:[vote('result-1',{votes:1})]});assert.match(ui.element('#drawResultBanSummary').textContent,/1 \/ 3 票/);assert.match(ui.element('#stageBanSummary').textContent,/1 \/ 3 票/);assert.equal(run(ui,'resultsView.store.view().snapshot'),snapshot);assert.equal(ui.element('#canvasStage').innerHTML,stageMarkup);
 ui.receive({...state,resultVotes:[vote('result-1',{votes:1,banned:true,canVote:false})]});assert.equal(ui.element('#drawResultBan').textContent,'已移除題庫');
 ui.receive(state);assert.equal(ui.element('#drawResultBan').textContent,'已移除題庫');assert.equal(ui.element('#stageBan').disabled,true);assert.equal(run(ui,'resultsView.store.view().snapshot.result.answer'),'公開答案 1');
});

test('unselected questions and players joining after reveal cannot vote and see the reason',async()=>{
 const ui=browserHarness(),p=published(),state=revealed([p],[vote('result-1',{canVote:false})]);let posts=0;serve(ui,[p],()=>{posts++;throw Error('must not send');});ui.receive(state);await run(ui,'resultsView.open()');
 assert.equal(ui.element('#stageBan').disabled,true);assert.match(ui.element('#stageBanStatus').textContent,/揭曉後才加入/);assert.equal(ui.element('#drawResultBan').disabled,true);assert.match(ui.element('#drawResultBanStatus').textContent,/沒有投票權/);await run(ui,'resultsView.vote()');assert.equal(posts,0);
 const empty=published(2);empty.result.answer=null;ui.receive({...revealed([empty],[vote('result-2',{canVote:false})]),version:6});await run(ui,"resultsView.open('result-2')");assert.match(ui.element('#stageBanStatus').textContent,/未選題/);assert.match(ui.element('#drawResultBanStatus').textContent,/未選題/);await run(ui,'resultsView.vote()');assert.equal(posts,0);
});

test('changing the selected result and next round keeps a delayed vote tied to its original ID while collection can continue',async()=>{
 const ui=browserHarness(),a=published(1),b=published(2),initial=revealed([a,b]),pending=deferred(),bodies=[],saved=[];
 serve(ui,[a,b],body=>{bodies.push(body);return pending.promise;},async body=>{saved.push(body);return json({resultId:body.resultId,canvasEpoch:b.result.canvasEpoch});});ui.receive(initial);await run(ui,"resultsView.open('result-1')");const sending=run(ui,'resultsView.vote()');await pause();
 const next={...initial,version:8,phase:'drawing',round:3,canvasEpoch:CANVAS_EPOCH.replace(/1$/,'3'),result:null,recentResults:[b.result,a.result],resultVotes:[vote('result-2'),vote('result-1',{votes:1,voted:true,canVote:false})]};ui.receive(next);await run(ui,"resultsView.open('result-2')");await run(ui,'resultsView.save()');
 assert.equal(saved.length,1);assert.equal(saved[0].resultId,'result-2');assert.equal(ui.element('#drawResultBan').disabled,false);assert.match(ui.element('#drawResultBanSummary').textContent,/0 \/ 3/);
 pending.resolve(json({...initial,version:6,resultVotes:[vote('result-1',{votes:1,voted:true,canVote:false}),vote('result-2')]}));await sending;
 assert.equal(bodies[0].resultId,'result-1');assert.equal(run(ui,'state.version'),8);assert.equal(run(ui,'state.phase'),'drawing');assert.equal(run(ui,'resultsView.store.view().selectedId'),'result-2');assert.equal(ui.element('#drawResultBan').textContent,'禁止題目');assert.equal(ui.element('#drawResultBanStatus').dataset.kind,'info');
 await run(ui,"resultsView.open('result-1')");assert.equal(ui.element('#drawResultBan').textContent,'已投票');
});

test('a vote error belongs to its result and polling can resolve an unknown HTTP outcome',async()=>{
 const ui=browserHarness(),a=published(),b=published(2),state=revealed([a,b]),pending=deferred();serve(ui,[a,b],()=>pending.promise);ui.receive(state);await run(ui,"resultsView.open('result-1')");const sending=run(ui,'resultsView.vote()');await pause();await run(ui,"resultsView.open('result-2')");pending.reject(Error('connection lost'));await sending;
 assert.doesNotMatch(ui.element('#drawResultBanStatus').textContent,/connection lost/);await run(ui,"resultsView.open('result-1')");assert.match(ui.element('#drawResultBanStatus').textContent,/connection lost/);assert.equal(ui.element('#drawResultBan').disabled,false);
 ui.receive({...state,version:6,resultVotes:[vote('result-1',{votes:1,voted:true,canVote:false}),vote('result-2')]});assert.equal(ui.element('#drawResultBan').textContent,'已投票');assert.doesNotMatch(ui.element('#drawResultBanStatus').textContent,/connection lost/);
});

test('leaving the result store before a vote starts cancels its POST; a previous-room ACK cannot update a new room',async()=>{
 const ui=browserHarness(),p=published(),initial=revealed(),pending=deferred();let posts=0;serve(ui,[p],()=>{posts++;return pending.promise;});ui.receive(initial);
 const cancelled=run(ui,"resultsView.vote('result-1')");run(ui,'resultsView.reset()');await cancelled;assert.equal(posts,0);
 ui.receive({...initial,version:6});const sending=run(ui,"resultsView.vote('result-1')");await pause();assert.equal(posts,1);
 ui.receive({...initial,code:'NEW456',version:10,resultVotes:[vote('result-1',{canVote:false})]});pending.resolve(json({...initial,version:100,resultVotes:[vote('result-1',{votes:1,voted:true,canVote:false})]}));await sending;
 assert.equal(run(ui,'state.code'),'NEW456');assert.equal(run(ui,'state.version'),10);assert.match(ui.element('#stageBanStatus').textContent,/沒有投票權/);assert.equal(run(ui,"resultsView.store.voteView('result-1').pending"),false);
});

test('same-result stage redraw restores vote focus without switching a pending operation to a new round',async()=>{
 const ui=browserHarness(),p=published(),initial=revealed();serve(ui,[p],()=>{throw Error('not voting');});ui.receive(initial);const button=ui.element('#stageBan');button.dataset.resultId='result-1';button.focus();
 ui.receive({...initial,version:6,players:[...initial.players,{id:'late',name:'新朋友',score:0,online:true,waitingForNextRound:true}]});assert.equal(ui.context.document.activeElement,ui.element('#stageBan'));assert.equal(ui.element('#stageBan').disabled,false);
});

test('an icon click delegated from reveal markup stays on the original result when the next round starts before its POST',async t=>{
 const ui=browserHarness(),a=published(),b=published(2),initial=revealed([a,b]),ack=deferred();let posted;
 t.after(()=>clearTimeout(run(ui,'toast.timer')));serve(ui,[a,b],body=>{posted=body;return ack.promise;});ui.receive(initial);
 const markup=ui.element('#canvasStage').innerHTML,tag=markup.match(/<button[^>]+id="stageBan"[^>]*>/)[0],button={disabled:ui.element('#stageBan').disabled,dataset:{do:tag.match(/data-do="([^"]+)"/)[1],resultId:tag.match(/data-result-id="([^"]+)"/)[1]}};
 const icon={closest:selector=>{assert.equal(selector,'button');return button;}};
 const sending=ui.listeners.get('#canvasStage:click')({target:icon});
 ui.element('#canvasStage').scrollTop=120;ui.element('#canvasStage').scrollLeft=35;
 const next={...initial,version:8,phase:'drawing',round:2,canvasEpoch:b.result.canvasEpoch,result:null};ui.receive(next);await pause();
 assert.equal(ui.element('#canvasStage').scrollTop,0);assert.equal(ui.element('#canvasStage').scrollLeft,0);assert.equal(posted.resultId,'result-1');assert.equal(ui.element('#toast').textContent,'');
 ack.resolve(json({...next,version:9,resultVotes:[vote('result-1',{votes:1,voted:true,canVote:false}),vote('result-2')]}));await sending;
 assert.equal(run(ui,'state.round'),2);assert.match(ui.element('#toast').textContent,/第 1 輪：已記錄禁題投票/);
});

test('a stage vote failing after the reveal closes reports its old round and retains retry in review',async t=>{
 const ui=browserHarness(),p=published(),initial=revealed(),ack=deferred();t.after(()=>clearTimeout(run(ui,'toast.timer')));serve(ui,[p],()=>ack.promise);ui.receive(initial);const sending=stageClick(ui);await pause();
 ui.receive({...initial,version:8,phase:'drawing',round:2,canvasEpoch:CANVAS_EPOCH.replace(/1$/,'2'),result:null});ack.reject(Error('connection lost'));await sending;
 assert.match(ui.element('#toast').textContent,/第 1 輪：投票未完成/);await run(ui,"resultsView.open('result-1')");assert.equal(ui.element('#drawResultBan').disabled,false);assert.equal(ui.element('#drawResultBan').textContent,'重試禁止題目');
});
