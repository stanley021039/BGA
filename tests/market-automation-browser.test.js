const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../public/market-rules');
const {createClient,waitFor,deferred}=require('./helpers/market-client.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/market.js'),'utf8');
const makeRound=(targetDate,phase='open',extra={})=>({id:targetDate,targetDate,phase,cutoffAt:R.cutoffFor(targetDate),settlementAfter:R.settlementFor(targetDate),rules:R.snapshot(),vote:null,result:null,...extra});
const officialRow=(extra={})=>({targetDate:'2026-10-06',close:23123.45,change:123.45,returnPct:0.54,returnPctSource:'official-published',sourceUrl:'https://www.twse.com.tw/exchangeReport/MI_INDEX?date=20261006&type=IND',fetchedAt:'2026-10-06T06:05:00Z',reviewRequired:false,...extra});
function baseState(extra={}){return {me:{displayName:'我的暱稱',role:'member'},serverNow:'2026-10-07T08:00:00Z',rules:R.snapshot(),stats:{score:10,hits:3,played:8},ledger:[],rounds:[makeRound('2026-10-08'),makeRound('2026-10-07','closed')],automation:{enabled:true,status:'waiting',lastAttemptAt:'2026-10-07T06:00:00Z',lastSuccessAt:'2026-10-06T06:05:00Z',nextAttemptAt:'2026-10-07T08:15:00Z',nextTradingDate:'2026-10-08',calendarYears:[2026],waitingDates:['2026-10-07'],reviewDates:[]},marketHistory:{from:'2026-09-07',to:'2026-10-07',rows:[officialRow()],waitingDates:['2026-10-07']},leaderboard:{rows:[],totalParticipants:0,ownRank:null},...extra};}
async function fixture({state=baseState(),hash='',hook}={}){
 let current=state;const events=[];
 const fetch=async(url,options={})=>{const input=options.body?JSON.parse(options.body):null,event={url,method:options.method||'GET',input};events.push(event);if(hook){const response=await hook(event);if(response)return response;}if(['/api/market','/api/admin/market'].includes(url))return Response.json(current);if(url==='/api/market/images/draw')return Response.json({targetDate:input.targetDate,images:{}});if(url==='/api/admin/market/images'||url==='/api/market/images/mine')return Response.json({images:[],limits:{}});if(url==='/api/admin/market/calendar-override')return Response.json({ok:true});throw Error('Unexpected transport path: '+url);};
 const client=await createClient({source,rules:R,fetch,hash});await waitFor(()=>!client.inspect().draw.busy);
 return {client,events,get state(){return current;},setState(state){current=state;},posts:()=>events.filter(event=>event.method==='POST'&&event.url!=='/api/market/images/draw')};
}
function fillOverride(client,extra={}){const form=client.node('#calendarOverrideForm'),values={targetDate:'2026-10-08',isOpen:'false',reason:'證交所公告臨時休市',sourceUrl:'https://www.twse.com.tw/zh/news/newsDetail?id=123',confirmed:true,...extra};for(const [key,value] of Object.entries(values))form.elements[key][key==='confirmed'?'checked':'value']=value;return ()=>form.onsubmit({preventDefault(){},target:form});}

test('current prediction prominently shows date, weekday and previous calendar night final millisecond',async()=>{
 const {client}=await fixture();assert.equal(client.node('#currentPredictionDate').textContent,'2026-10-08（星期四）');assert.match(client.node('#currentPredictionCutoff').textContent,/2026-10-07 23:59:59\.999.*2026-10-08 00:00 起截止/);assert.equal(client.node('#roundSelect').value,'2026-10-08');assert.match(client.node('#automationDetails').textContent,/14:00（台北）.*同日正式收盤報表/);assert.match(client.node('#automationDates').textContent,/2026-10-07.*下一輪.*獨立開放/);
 client.round('2026-10-07');assert.equal(client.node('#goCurrentRound').hidden,false);assert.match(client.node('#currentPredictionDate').textContent,/2026-10-08/);assert.match(client.node('#phase').textContent,/等待官方結算/);assert.equal(client.node('#saveVote').disabled,true);
});

test('next round becomes selectable while prior official settlement waits; explicit older browsing is preserved',async()=>{
 const start=baseState({serverNow:'2026-10-06T12:00:00Z',rounds:[makeRound('2026-10-07')]});const f=await fixture({state:start});assert.equal(f.client.node('#roundSelect').value,'2026-10-07');f.client.choose('rise');f.setState(baseState());await f.client.refresh();assert.equal(f.client.node('#roundSelect').value,'2026-10-08');assert.equal(f.client.inspect().draft.roundId,'2026-10-08');assert.equal(f.client.inspect().draft.optionId,null);assert.equal(f.state.rounds[1].result,null);
 f.client.round('2026-10-07');await f.client.refresh();assert.equal(f.client.node('#roundSelect').value,'2026-10-07');assert.match(f.client.node('#currentPredictionDate').textContent,/2026-10-08/);f.client.node('#goCurrentRound').onclick();assert.equal(f.client.node('#roundSelect').value,'2026-10-08');assert.equal(f.client.node('#goCurrentRound').hidden,true);assert.equal(f.posts().length,0);
});

test('client permits the last millisecond before target midnight and closes at exact cutoff',async()=>{
 const cutoff=Date.parse(R.cutoffFor('2026-10-08'));const f=await fixture({state:baseState({serverNow:new Date(cutoff-1).toISOString(),rounds:[makeRound('2026-10-08')]})});f.client.choose('rise');assert.equal(f.client.node('#saveVote').disabled,false);f.setState({...f.state,serverNow:new Date(cutoff).toISOString()});await f.client.refresh();f.client.choose('rise');assert.equal(f.client.node('#saveVote').disabled,true);assert.match(f.client.node('#currentPredictionDate').textContent,/等待下一個交易日/);assert.match(f.client.node('#phase').textContent,/已截止/);
});

test('official history shows server calendar-month window, waiting gaps, review and signed daily figures',async()=>{
 const f=await fixture({hash:'#marketHistory',state:baseState({marketHistory:{from:'2026-02-28',to:'2026-03-31',waitingDates:['2026-03-31'],rows:[officialRow({reviewRequired:true}),officialRow({targetDate:'2026-10-05',change:-12.2,returnPct:-0.05})]}})});const html=f.client.node('#marketHistoryRows').innerHTML;
 assert.equal(f.client.node('#marketHistory').hidden,false);assert.equal(f.client.node('#daily').hidden,true);assert.equal(f.client.node('#marketHistoryRange').textContent,'2026-02-28 ～ 2026-03-31（台北）');assert.match(html,/23,123\.45/);assert.match(html,/\+123\.45/);assert.match(html,/\+0\.54%/);assert.match(html,/-12\.20/);assert.match(html,/-0\.05%/);assert.match(html,/待複核/);assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/&amp;type=IND/);assert.match(f.client.node('#marketHistoryStatus').textContent,/2026-03-31.*缺少資料不等於休市/);assert.equal(f.posts().length,0);
});

test('history escapes date text and rejects script, nonofficial, credentials and deceptive official source URLs',async()=>{
 const invalid=['javascript:alert(1)','https://www.twse.com.tw.evil.test/','https://www.twse.com.tw@evil.test/','https://user:pass@www.twse.com.tw/','http://www.twse.com.tw/','https://www.twse.com.tw:444/'];const rows=invalid.map((sourceUrl,i)=>officialRow({targetDate:i?'2026-10-06':'<img src=x onerror=alert(1)>',sourceUrl}));const f=await fixture({state:baseState({marketHistory:{from:'2026-09-07',to:'2026-10-07',rows,waitingDates:[]}})});const html=f.client.node('#marketHistoryRows').innerHTML;
 assert.doesNotMatch(html,/<a |<img |javascript:|evil\.test|user:pass/);assert.match(html,/&lt;img/);assert.equal((html.match(/官方來源連結待確認/g)||[]).length,6);
});

test('leaderboard preserves competition ties and server ordering, renders only nickname/rank/score plus self',async()=>{
 const rows=[{rank:1,displayName:'甲',score:12,played:20,isMe:false,id:'private-id',username:'private-account'},{rank:1,displayName:'<img onerror=evil>',score:12,played:19,isMe:true},{rank:3,displayName:'乙',score:-1,played:7,isMe:false}];const f=await fixture({hash:'#leaderboard',state:baseState({leaderboard:{rows,totalParticipants:3,ownRank:rows[1]}})});const html=f.client.node('#leaderboardRows').innerHTML;
 assert.equal(f.client.node('#leaderboard').hidden,false);assert.match(html,/甲.*&lt;img onerror=evil&gt;.*乙/);assert.equal((html.match(/rank-number">1</g)||[]).length,2);assert.match(html,/rank-number">3</);assert.match(html,/class="self-tag">你/);assert.match(html,/>-1</);assert.doesNotMatch(html,/<img |private-id|private-account|>20<|>19</);assert.equal(f.client.node('#ownRank').hidden,true);assert.equal(f.client.node('#leaderboardCount').textContent,'共 3 位玩家');
});

test('leaderboard bounds visible list at 100 and keeps own rank outside list with literal text',async()=>{
 const rows=Array.from({length:101},(_,i)=>({rank:i+1,displayName:'玩家'+i,score:100-i,played:1,isMe:false}));const own={rank:203,displayName:'<script>我的暱稱</script>',score:-8,played:2,isMe:true};const f=await fixture({state:baseState({leaderboard:{rows,totalParticipants:203,ownRank:own}})});assert.equal((f.client.node('#leaderboardRows').innerHTML.match(/<tr/g)||[]).length,100);assert.equal(f.client.node('#ownRank').hidden,false);assert.match(f.client.node('#ownRank').textContent,/第 203 名.*<script>我的暱稱<\/script>.*-8 分/);
});

test('missing or empty new fields have explicit waiting/empty states without fabricating holiday data',async()=>{
 const state=baseState({rounds:[],automation:undefined,marketHistory:undefined,leaderboard:undefined});const f=await fixture({state});assert.match(f.client.node('#automationStatus').textContent,/尚未提供/);assert.match(f.client.node('#marketHistoryStatus').textContent,/尚未載入/);assert.match(f.client.node('#leaderboardStatus').textContent,/尚未載入/);assert.equal(f.client.node('#saveVote').disabled,true);
 f.setState(baseState({rounds:[],marketHistory:{from:'2026-09-07',to:'2026-10-07',rows:[],waitingDates:['2026-10-07']}}));await f.client.refresh();assert.match(f.client.node('#marketHistoryStatus').textContent,/尚無已驗證.*等待資料/);assert.match(f.client.node('#leaderboardStatus').textContent,/尚無已結算/);assert.equal(f.client.node('#ownRank').hidden,true);
});

test('calendar unavailable, disabled, fetch error and manual-review conditions remain visible on every tab',async()=>{
 const f=await fixture();for(const [status,text] of [['calendar-unavailable','交易日曆尚未確認'],['disabled','自動結算已停用'],['error','自動查核暫時失敗']]){f.setState({...f.state,automation:{...f.state.automation,status,reviewDates:['2026-10-06']}});await f.client.refresh();f.client.view('leaderboard');assert.match(f.client.node('#automationStatus').textContent,new RegExp(text));assert.equal(f.client.node('#automationPanel').classes.has('attention'),true);assert.match(f.client.node('#automationDates').textContent,/需管理員複核.*2026-10-06/);}
});

test('void rounds cannot vote or settle and their reason remains escaped in records',async()=>{
 const r=makeRound('2026-10-08','void',{voidReason:'公告 <img src=x>',voteCount:2,settlementHistory:[]});const f=await fixture({state:baseState({me:{role:'admin'},rounds:[r]})});f.client.choose('rise');assert.equal(f.client.node('#saveVote').disabled,true);assert.ok(f.client.node('#options').inputs.every(input=>input.disabled));assert.match(f.client.node('#voteStatus').textContent,/本輪已取消，不計分。公告 <img src=x>/);assert.match(f.client.node('#history').innerHTML,/&lt;img src=x&gt;/);f.client.node('#adminRound').value=r.id;f.client.node('#adminRound').onchange();assert.equal(f.client.node('#previewButton').disabled,true);assert.match(f.client.node('#settleStatus').textContent,/不能結算/);f.client.submit();assert.equal(f.posts().length,0);
});

test('calendar override requires official source and explicit confirmation, posts exact typed open/close once while busy',async()=>{
 const gate=deferred(),state=baseState({me:{role:'admin'},rounds:[makeRound('2026-10-08','open',{voteCount:0,settlementHistory:[]})]});const f=await fixture({state,hook:async event=>{if(event.url==='/api/admin/market/calendar-override'){await gate.promise;return Response.json({ok:true});}}});
 fillOverride(f.client,{confirmed:false})();assert.equal(f.posts().length,0);fillOverride(f.client,{sourceUrl:'https://www.twse.com.tw.evil.test/'})();assert.equal(f.posts().length,0);assert.match(f.client.node('#message').textContent,/勾選確認/);
 const submit=fillOverride(f.client);submit();submit();assert.equal(f.posts().length,1);const payload=f.posts()[0].input;assert.equal(payload.targetDate,'2026-10-08');assert.equal(payload.isOpen,false);assert.equal(payload.confirmed,true);assert.equal(payload.reason,'證交所公告臨時休市');assert.match(payload.requestId,/^[0-9a-f]{32}$/);assert.equal(f.client.inspect().busy,true);gate.resolve();await waitFor(()=>!f.client.inspect().busy);assert.match(f.client.node('#message').textContent,/修正已保存/);
 fillOverride(f.client,{isOpen:'true'})();await waitFor(()=>!f.client.inspect().busy);assert.equal(f.posts()[1].input.isOpen,true);
});

test('member cannot use the override handler or open management through navigation',async()=>{
 const f=await fixture();f.client.view('admin');assert.equal(f.client.node('#admin').hidden,true);fillOverride(f.client)();assert.equal(f.posts().length,0);f.client.view('marketHistory');f.client.view('leaderboard');f.client.view('daily');assert.equal(f.client.node('#daily').hidden,false);assert.equal(f.client.node('#leaderboard').hidden,true);assert.equal(f.posts().length,0);
});

test('refresh failure keeps last verified history/rank and an explicit retry message',async()=>{
 let fail=false;const f=await fixture({hook:event=>{if(fail&&event.url==='/api/market')return Response.json({error:'網路暫時不可用'},{status:503});}});const before=f.client.node('#marketHistoryRows').innerHTML;fail=true;await f.client.refresh();assert.equal(f.client.node('#marketHistoryRows').innerHTML,before);assert.match(f.client.node('#message').textContent,/網路暫時不可用/);assert.equal(f.client.node('#message').classes.has('error'),true);assert.equal(f.client.node('#refresh').disabled,false);
});

test('page provides visible labels, accessible tables, shared icon actions and responsive overflow regions',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/market.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../public/market.css'),'utf8');assert.match(html,/id="currentPredictionDate"/);assert.match(html,/id="marketHistory" hidden aria-labelledby="marketHistoryTitle"/);assert.match(html,/role="region" aria-label="官方每日收盤行情，可左右捲動"/);assert.match(html,/<th scope="col"/);assert.match(html,/id="calendarOverrideForm"/);assert.match(html,/name="confirmed" type="checkbox" required>我已核對/);assert.match(html,/並非固定 30 天/);assert.match(source,/GameUI\.decorateButton\(button,icon,\{iconOnly:true,label\}\)/);assert.match(css,/overflow-x:auto/);assert.match(css,/@media\(max-width:600px\)/);assert.match(css,/\[hidden\]\{display:none!important\}/);assert.doesNotMatch(html,/管理員手動更新 · 台北時間/);
});

test('initial API failure has explicit data errors and leaves voting unavailable until a verified reload',async()=>{
 let fail=true;const client=await createClient({source,rules:R,allowFailure:true,fetch:async(url,options={})=>fail?Response.json({error:'資料暫時不可用'},{status:503}):url==='/api/market/images/draw'?Response.json({targetDate:JSON.parse(options.body).targetDate,images:{}}):Response.json(baseState())});assert.equal(client.inspect().uncertain,true);assert.equal(client.node('#saveVote').disabled,true);assert.match(client.node('#marketHistoryStatus').textContent,/載入失敗.*重試/);assert.match(client.node('#leaderboardStatus').textContent,/載入失敗.*重試/);assert.match(client.node('#currentPredictionDate').textContent,/尚未載入/);fail=false;await client.refresh();assert.equal(client.inspect().uncertain,false);assert.match(client.node('#currentPredictionDate').textContent,/2026-10-08/);assert.match(client.node('#marketHistoryRows').innerHTML,/23,123/);
});

test('shared GameUI decorations preserve Chinese accessible action names without replacing visible dates and statuses',async()=>{
 const decorations=[];const gameUI={decorateButton(button,icon,options){decorations.push({id:button.id,icon,...options});button.setAttribute('aria-label',options.label);button.dataset.uiIcon=icon;}};const client=await createClient({source,rules:R,gameUI,fetch:async(url,options={})=>url==='/api/market/images/draw'?Response.json({targetDate:JSON.parse(options.body).targetDate,images:{}}):Response.json(baseState())});await waitFor(()=>!client.inspect().draw.busy);
 for(const [id,icon,label] of [['#refresh','refresh','更新行情與預測'],['#goCurrentRound','next','返回目前預測'],['#saveCalendarOverride','check','套用交易日曆修正'],['#saveVote','send','送出預測']])assert.ok(decorations.some(item=>item.id===id&&item.icon===icon&&item.label===label&&item.iconOnly));assert.match(client.node('#currentPredictionDate').textContent,/2026-10-08/);assert.match(client.node('#automationStatus').textContent,/等待官方/);assert.match(client.node('#voteStatus').textContent,/尚未投票/);
});

test('late poll cannot replace newly refreshed current date, history, leaderboard or waiting state',async()=>{
 const gate=deferred();let intercept=false,held=false;const f=await fixture({hook:async event=>{if(intercept&&!held&&event.url==='/api/market'){held=true;const old=structuredClone(f.state);await gate.promise;return Response.json(old);}}});intercept=true;f.client.tick(15000);await waitFor(()=>held);const next=baseState({serverNow:'2026-10-08T08:00:00Z',rounds:[makeRound('2026-10-09'),makeRound('2026-10-08','closed')],marketHistory:{from:'2026-09-08',to:'2026-10-08',rows:[officialRow({targetDate:'2026-10-08',close:23456})],waitingDates:[]},leaderboard:{rows:[{rank:1,displayName:'新榜首',score:99,played:5,isMe:false}],totalParticipants:1,ownRank:null},automation:{enabled:true,status:'ok',calendarYears:[2026],waitingDates:[],reviewDates:[]}});f.setState(next);await f.client.refresh();gate.resolve();await new Promise(resolve=>setImmediate(resolve));assert.match(f.client.node('#currentPredictionDate').textContent,/2026-10-09/);assert.match(f.client.node('#marketHistoryRows').innerHTML,/23,456/);assert.match(f.client.node('#leaderboardRows').innerHTML,/新榜首/);assert.equal(f.client.node('#automationStatus').textContent,'自動結算正常');assert.equal(f.client.node('#automationDates').textContent,'');
});


test('computed historical percentages have visible provenance and formula while published and unrecognized source strings stay safe',async()=>{
 const rows=[officialRow({targetDate:'2026-10-06',returnPctSource:'computed-from-official-close-change'}),officialRow({targetDate:'2026-10-05'}),officialRow({targetDate:'2026-10-02',returnPctSource:'<img src=x onerror=alert(1)>'})];const f=await fixture({hash:'#marketHistory',state:baseState({marketHistory:{from:'2026-09-07',to:'2026-10-07',rows,waitingDates:[]}})});const html=f.client.node('#marketHistoryRows').innerHTML;
 assert.equal((html.match(/class="computed-return">計算值<\/small>/g)||[]).length,1);assert.match(html,/2026-10-06.*\+0\.54%<small class="computed-return">計算值/);assert.doesNotMatch(html,/<img|onerror|alert\(/);assert.match(f.client.node('#marketHistoryStatus').textContent,/同一交易日.*官方收盤指數與漲跌點數.*漲跌點數 ÷（收盤指數 − 漲跌點數）× 100.*四捨五入至小數點後 2 位/);assert.match(f.client.node('#marketHistoryStatus').textContent,/不是交易所直接發布的百分比/);
 f.setState(baseState());await f.client.refresh();assert.doesNotMatch(f.client.node('#marketHistoryRows').innerHTML,/computed-return/);assert.doesNotMatch(f.client.node('#marketHistoryStatus').textContent,/「計算值」/);
});
