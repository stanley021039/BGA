const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=require('../public/market-rules'),{createClient,deferred}=require('./helpers/market-client.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/market.js'),'utf8');
function baseState(extra={}){return {me:{role:'admin'},serverNow:'2026-10-08T09:00:00.000Z',rules:R.snapshot(),stats:{score:5,hits:1,played:1},ledger:[],rounds:[],automation:{enabled:true,status:'manual-required',waitingDates:['2026-10-08'],manualRequiredDates:['2026-10-07','2026-10-08'],reviewDates:[],dailyFetch:{targetDate:'2026-10-08',status:'exhausted',automaticAttempts:25,manualAttempts:0}},...extra};}
async function fixture({state=baseState(),hook,gameUI}={}){
 let current=state;const events=[];
 const fetch=async(url,options={})=>{const event={url,method:options.method||'GET',input:options.body?JSON.parse(options.body):null};events.push(event);const response=await hook?.(event);if(response)return response;if(['/api/market','/api/admin/market'].includes(url))return Response.json(current);if(url==='/api/admin/market/images')return Response.json({images:[],limits:{}});if(url==='/api/admin/market/recheck')return Response.json({targetDate:event.input.targetDate,received:true,review:false,status:'success'});throw Error('Unexpected route '+url);};
 const client=await createClient({source,rules:R,fetch,hash:'#admin',gameUI});
 return {client,events,setState(value){current=value;},posts:()=>events.filter(event=>event.method==='POST')};
}
function form(client,values={}){const form=client.node('#officialRecheckForm');for(const [key,value]of Object.entries({targetDate:'2026-10-08',confirmed:true,...values}))form.elements[key][key==='confirmed'?'checked':'value']=value;return {form,submit:()=>form.onsubmit({preventDefault(){},target:form})};}

test('cutoff, durable exhausted dates, attempt counts and observation semantics stay visible across tabs',async()=>{
 const f=await fixture();assert.match(f.client.node('#automationStatus').textContent,/停止.*管理員/);assert.equal(f.client.node('#automationPanel').classes.has('attention'),true);assert.match(f.client.node('#automationDetails').textContent,/每 5 分鐘.*16:00.*自動 25 次.*人工 0 次/);assert.match(f.client.node('#automationDates').textContent,/2026-10-07.*2026-10-08.*不會自動補跑/);
 f.setState(baseState({automation:{enabled:true,status:'ok',dailyFetch:{targetDate:'2026-10-08',automaticAttempts:3,manualAttempts:1,firstValidObservedAt:'2026-10-08T06:02:17.000Z'}}}));await f.client.refresh();f.client.view('leaderboard');assert.match(f.client.node('#automationDetails').textContent,/自動 3 次.*人工 1 次.*首次觀測到有效資料.*非官方發布時間/);assert.equal(f.client.node('#automationPanel').classes.has('attention'),false);
});

test('manual recheck validates exact date and fresh confirmation before posting, including Taipei 14:00 boundary',async()=>{
 const f=await fixture();for(const values of [{targetDate:''},{targetDate:'2026-02-30'},{targetDate:'2026-10-09'},{confirmed:false}])await form(f.client,values).submit();assert.equal(f.posts().length,0);
 f.setState(baseState({serverNow:'2026-10-08T05:59:59.999Z'}));await f.client.refresh();await form(f.client).submit();assert.equal(f.posts().length,0);assert.match(f.client.node('#officialRecheckStatus').textContent,/14:00/);
 f.setState(baseState({serverNow:'2026-10-08T06:00:00.000Z'}));await f.client.refresh();const controls=form(f.client);await controls.submit();assert.deepEqual(f.posts()[0].input,{targetDate:'2026-10-08',confirmed:true});assert.equal(controls.form.elements.confirmed.checked,false);await controls.submit();assert.equal(f.posts().length,1);assert.match(f.client.node('#officialRecheckStatus').textContent,/勾選確認/);
});

test('a changed date clears the old confirmation and all automatic refreshes leave the typed date intact',async()=>{
 const f=await fixture(),controls=form(f.client,{targetDate:'2026-10-07'});controls.form.elements.targetDate.onchange();assert.equal(controls.form.elements.confirmed.checked,false);await f.client.refresh();f.client.tick(15000);assert.equal(controls.form.elements.targetDate.value,'2026-10-07');await controls.submit();assert.equal(f.posts().length,0);
});

test('repeated clicks, navigation and 15-second reads never duplicate an in-flight official POST',async()=>{
 const gate=deferred(),f=await fixture({hook:async event=>{if(event.method==='POST'){await gate.promise;return Response.json({received:true});}}}),controls=form(f.client),pending=controls.submit();await controls.submit();assert.equal(f.posts().length,1);assert.equal(f.client.inspect().busy,true);assert.equal(controls.form.elements.targetDate.disabled,true);assert.equal(f.client.node('#submitOfficialRecheck').disabled,true);
 f.client.view('daily');f.client.view('admin');f.client.tick(15000);await controls.submit();assert.equal(f.posts().length,1);gate.resolve();await pending;assert.equal(f.client.inspect().busy,false);assert.equal(f.client.node('#submitOfficialRecheck').disabled,false);assert.match(f.client.node('#officialRecheckStatus').textContent,/2026-10-08.*交叉核對/);assert.equal(controls.form.elements.confirmed.checked,false);
});

test('lost response refreshes only GET and requires a new confirmation before any explicit recheck',async()=>{
 let lose=true;const f=await fixture({hook:event=>{if(event.method==='POST'&&lose)throw Error('lost response');}}),controls=form(f.client);await controls.submit();assert.equal(f.posts().length,1);assert.equal(f.client.inspect().uncertain,false);assert.match(f.client.node('#officialRecheckStatus').textContent,/結果尚未確認.*重新讀取/);assert.equal(controls.form.elements.confirmed.checked,false);f.client.tick(15000);await controls.submit();assert.equal(f.posts().length,1);lose=false;controls.form.elements.confirmed.checked=true;await controls.submit();assert.equal(f.posts().length,2);
});

test('failed status refresh blocks another recheck until the user can obtain server state',async()=>{
 let failReads=false;const f=await fixture({hook:event=>{if(event.method==='POST'){failReads=true;return Response.json({received:true});}if(failReads&&event.url==='/api/admin/market')throw Error('offline');}}),controls=form(f.client);await controls.submit();assert.equal(f.posts().length,1);assert.equal(f.client.inspect().uncertain,true);assert.equal(f.client.node('#submitOfficialRecheck').disabled,true);assert.match(f.client.node('#officialRecheckStatus').textContent,/已完成.*更新失敗/);controls.form.elements.confirmed.checked=true;await controls.submit();assert.equal(f.posts().length,1);failReads=false;await f.client.refresh();assert.equal(f.client.inspect().uncertain,false);
});

test('manual review and server rate limiting are explicit without changing scores or retrying POSTs',async()=>{
 let rate=false;const f=await fixture({hook:event=>event.method==='POST'?(rate?Response.json({code:'RATE_LIMITED',error:'操作太頻繁，請稍後再試'},{status:429}):Response.json({received:true,review:true})):undefined});await form(f.client).submit();assert.match(f.client.node('#officialRecheckStatus').textContent,/人工複核.*原積分保持不變/);assert.equal(f.client.inspect().state.stats.score,5);rate=true;await form(f.client).submit();assert.match(f.client.node('#officialRecheckStatus').textContent,/太頻繁/);f.client.tick(15000);assert.equal(f.posts().length,2);
});

test('member and side-effect-disabled states cannot initiate a recheck even through the handler',async()=>{
 for(const state of [baseState({me:{role:'member'}}),baseState({automation:{enabled:false,status:'disabled'}})]){const f=await fixture({state});await form(f.client).submit();assert.equal(f.posts().length,0);if(state.me.role==='admin'){assert.equal(f.client.node('#submitOfficialRecheck').disabled,true);assert.match(f.client.node('#officialRecheckStatus').textContent,/已停用/);}else assert.equal(f.client.node('#admin').hidden,true);}
});

test('new control uses shared icon decoration, visible date and confirmation labels, and form validation',async()=>{
 const decorations=[],bindings=[],gameUI={decorateButton(button,icon,options){decorations.push({id:button.id,icon,...options});},bindForm(node){bindings.push(node.id);return {destroy(){}};}};await fixture({gameUI});assert.ok(decorations.some(item=>item.id==='#submitOfficialRecheck'&&item.icon==='refresh'&&item.iconOnly&&item.label==='重查指定日期官方資料'));assert.ok(bindings.includes('#officialRecheckForm'));
 const html=fs.readFileSync(path.join(__dirname,'../public/market.html'),'utf8');assert.match(html,/id="officialRecheckForm".*<label>要重查的交易日/);assert.match(html,/name="confirmed" type="checkbox" required>我已確認此日期，要求重新取得並核對官方收盤資料/);assert.match(html,/id="officialRecheckStatus".*role="status" aria-live="polite"/);assert.match(source,/setInterval\(\(\)=>\{if\(!busy&&!uncertain&&document.visibilityState==='visible'\)load\(true\).*15000\)/);
});


test('a failed recheck of a successful date does not suggest its verified result was lost',async()=>{
 const f=await fixture({hook:event=>event.method==='POST'?Response.json({received:false,status:'success'}):undefined});await form(f.client).submit();assert.match(f.client.node('#officialRecheckStatus').textContent,/本次未取得.*保留先前已核對結果與積分/);assert.doesNotMatch(f.client.node('#officialRecheckStatus').textContent,/待處理狀態/);
});
