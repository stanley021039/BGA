const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID,createHash}=require('node:crypto'),{openDatabase}=require('../src/db'),{createApp}=require('../src/app'),{settings}=require('../src/config');
const route='/api/admin/market/recheck',today='2026-10-08';
const calendar={year:2026,coverageStart:'2026-01-01',coverageEnd:'2026-12-31',closedDates:[],openDates:[],sourceUrl:'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',sourceHash:'a'.repeat(64),fetchedAt:'2026-10-08T09:00:00.000Z'};
function officialClose(date=today,returnPct='2.00'){const fetchedAt='2026-10-08T09:00:00.000Z',sourceUrl='https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX',changeCents=Math.round(Number(returnPct)*10000);return {targetDate:date,closeCents:1000000+changeCents,changeCents,returnPct,sourceUrl,fetchedAt,evidence:[{url:sourceUrl,sha256:'b'.repeat(64),fetchedAt},{url:'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK',sha256:'c'.repeat(64),fetchedAt}]};}
async function fixture(t,{enabled=true,automationEnabled=true,hook,seed}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-recheck-http-')),file=path.join(root,'app.sqlite'),db=openDatabase(file),cookies=[],users=[];let now=Date.parse('2026-10-08T09:00:00.000Z');
 for(const role of ['admin','member']){const id=randomUUID(),raw=randomUUID();users.push(id);db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,'recheck_'+role,role,'test',role,new Date(now).toISOString());db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(raw).digest('hex'),id,'2030-01-01T00:00:00.000Z');cookies.push('ah-session='+raw);}seed?.(db,users);db.close();
 const calls=[];const provider={async fetchCalendar(){calls.push({kind:'calendar'});return calendar;},async fetchCloses(input){calls.push({kind:'close',from:input.from,to:input.to,dates:input.dates});return await hook?.(input)||{closes:[],failures:[]};}};
 const config={...settings({DB_FILE:file,HISTORY_DIR:path.join(root,'history'),COMMUNITY_DIR:path.join(root,'community'),MUSIC_DIR:path.join(root,'music'),EXTERNAL_SIDE_EFFECTS_ENABLED:String(enabled),MARKET_AUTOMATION_ENABLED:String(automationEnabled)}),host:'127.0.0.1',port:0,githubClient:{configured:false},marketClock:()=>now,marketProvider:provider};
 const app=createApp(config),base='http://127.0.0.1:'+(await app.listen()).port;
 // Flush the finite, immediate mock startup calendar/history promises. No live
 // official sources are contacted; all endpoint assertions use calls after boot.
 for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));calls.length=0;
 t.after(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 const request=({method='POST',body={targetDate:today,confirmed:true},cookie=cookies[0],headers={},raw}={})=>fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},...(!['GET','HEAD'].includes(method)?{body:raw??JSON.stringify(body)}:{})});
 return {file,base,cookies,users,calls,request,setTime(value){now=Date.parse(value);}};
}
async function assertError(response,status,code){assert.equal(response.status,status);assert.equal((await response.json()).code,code);}
async function eventually(predicate){const until=Date.now()+3000;while(!predicate()){if(Date.now()>until)throw Error('Mock request did not arrive');await new Promise(resolve=>setTimeout(resolve,2));}}

test('official recheck authenticates admins before reading body, rejects methods and cross-origin access before fetch',async t=>{
 const f=await fixture(t);await assertError(await f.request({cookie:null,raw:'invalid JSON'}),401,'LOGIN_REQUIRED');await assertError(await f.request({cookie:f.cookies[1],raw:'invalid JSON'}),403,'ADMIN_REQUIRED');
 for(const method of ['GET','PUT','DELETE','PATCH'])await assertError(await f.request({method}),405,'METHOD_NOT_ALLOWED');
 for(const headers of [{Origin:'https://untrusted.invalid'},{'Sec-Fetch-Site':'cross-site'},{Origin:'not a url'}])await assertError(await f.request({headers}),403,'CROSS_ORIGIN');assert.deepEqual(f.calls,[]);
});

test('official recheck requires explicit confirmation, valid exact date and Taipei 14:00 eligibility before fetch',async t=>{
 const f=await fixture(t);for(const confirmed of [undefined,false,'true',1])await assertError(await f.request({body:{targetDate:today,confirmed}}),400,'MARKET_RECHECK_CONFIRMATION_REQUIRED');
 for(const targetDate of [undefined,null,'2026-02-30','1999-12-31','2200-01-01','2026-10-09','2026-10-08T00:00:00Z'])await assertError(await f.request({body:{targetDate,confirmed:true}}),400,'INVALID_MARKET_RECHECK_DATE');
 f.setTime('2026-10-08T05:59:59.999Z');await assertError(await f.request(),400,'INVALID_MARKET_RECHECK_DATE');assert.deepEqual(f.calls,[]);
 f.setTime('2026-10-08T06:00:00.000Z');assert.equal((await f.request()).status,200);assert.deepEqual(f.calls,[{kind:'close',from:today,to:today,dates:[today]}]);
});

test('both side-effect and market-specific disable flags reject manual official rechecks without any network',async t=>{
 for(const options of [{enabled:false},{automationEnabled:false}]){const f=await fixture(t,options);await assertError(await f.request(),503,'AUTOMATION_DISABLED');assert.deepEqual(f.calls,[]);}
});

test('manual exact-date success persists observation and a repeat recheck adds only one manual attempt per request',async t=>{
 const f=await fixture(t,{hook:input=>input.dates?.length===1&&input.dates[0]===today?{closes:[officialClose()],failures:[]}:null});
 for(let i=0;i<2;i++){const response=await f.request();assert.equal(response.status,200);const value=await response.json();assert.equal(value.targetDate,today);assert.equal(value.received,true);assert.equal(value.status,'success');}
 assert.deepEqual(f.calls,Array.from({length:2},()=>({kind:'close',from:today,to:today,dates:[today]})));
 const response=await fetch(f.base+'/api/admin/market',{headers:{Cookie:f.cookies[0]}}),value=await response.json();assert.equal(value.automation.dailyFetch.manualAttempts,2);assert.equal(value.automation.dailyFetch.firstValidObservedAt,'2026-10-08T09:00:00.000Z');assert.equal(value.marketHistory.rows.filter(row=>row.targetDate===today).length,1);
});

test('simultaneous manual HTTP rechecks cannot overlap and rate limit caps explicit repeat requests',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const f=await fixture(t,{hook:async input=>{if(input.dates?.length===1&&input.dates[0]===today){await gate;return {closes:[officialClose()],failures:[]};}}});
 const pending=f.request();await eventually(()=>f.calls.some(call=>call.dates?.length===1&&call.dates[0]===today));await assertError(await f.request(),409,'MARKET_RECHECK_IN_PROGRESS');assert.equal(f.calls.length,1);release();assert.equal((await pending).status,200);
 // The concurrent rejected request also consumes rate capacity; no hidden retry.
 for(let i=0;i<4;i++)assert.equal((await f.request()).status,200);await assertError(await f.request(),429,'RATE_LIMITED');assert.equal(f.calls.length,5);
});


test('HTTP rechecking a settled date preserves one award and sends official corrections to manual review',async t=>{
 let result='2.00';const f=await fixture(t,{seed(db,users){const {MarketStore}=require('../src/market/store'),market=new MarketStore(db,()=>Date.parse('2026-10-07T04:00:00.000Z')),actor={id:users[0]},created=market.create(actor,{requestId:randomUUID(),targetDate:today,confirmed:true});market.vote(actor,{requestId:randomUUID(),roundId:created.roundId,forecastTick:20,expectedRevision:0});},hook:input=>input.dates?.length===1&&input.dates[0]===today?{closes:[officialClose(today,result)],failures:[]}:null});
 const dashboard=async()=>await(await fetch(f.base+'/api/admin/market',{headers:{Cookie:f.cookies[0]}})).json();
 assert.equal((await f.request()).status,200);const settled=await dashboard(),original=settled.rounds.find(round=>round.targetDate===today);assert.equal(original.result.revision,1);assert.equal(original.result.returnPct,2);assert.equal(settled.ledger.length,1);
 assert.equal((await f.request()).status,200);const duplicate=await dashboard();assert.equal(duplicate.stats.score,settled.stats.score);assert.equal(duplicate.ledger.length,1);
 result='-2.00';const response=await f.request();assert.equal(response.status,200);assert.equal((await response.json()).review,true);const reviewed=await dashboard();assert.equal(reviewed.stats.score,settled.stats.score);assert.equal(reviewed.ledger.length,1);assert.equal(reviewed.rounds.find(round=>round.targetDate===today).result.returnPct,2);assert.deepEqual(reviewed.automation.reviewDates,[today]);
});
