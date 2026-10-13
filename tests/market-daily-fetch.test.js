const {nightWindow,startFor}=require("../src/market/night-window");
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {openDatabase}=require('../src/db'),{MarketStore}=require('../src/market/store');
const {MarketAutomationStore,validateMarketAutomationDatabase,dateAt,addDays,monthWindow,closeAfter}=require('../src/market/automation-store');
const {MarketAutomation,RETRY_MS}=require('../src/market/automation');
const R=require('../public/market-rules');
const DATE='2026-10-07',START=startFor(DATE),source='https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX';
function calendar(now,{closedDates=[],openDates=[]}={}){return {year:2026,coverageStart:'2026-01-01',coverageEnd:'2026-12-31',closedDates,openDates,sourceUrl:'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',sourceHash:'a'.repeat(64),fetchedAt:new Date(now).toISOString()};}
function close(date,now,returnPct='2.00'){
 const changeCents=Math.round(Number(returnPct)*10000),fetchedAt=new Date(now).toISOString();
 return {targetDate:date,closeCents:1000000+changeCents,changeCents,returnPct,sourceUrl:source,fetchedAt,evidence:[{url:source,sha256:'b'.repeat(64),fetchedAt},{url:'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK',sha256:'c'.repeat(64),fetchedAt}]};
}
function fixture(t,{now=START,history=false,knownCalendar=true,enabled=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'market-daily-fetch-')),file=path.join(root,'app.sqlite'),db=openDatabase(file);let time=now;
 const clock=()=>time,market=new MarketStore(db,clock),store=new MarketAutomationStore(db,market,{clock,enabled});
 const closedDates=[];if(!history)for(let date=monthWindow(DATE).from;date<DATE;date=addDays(date,1))closedDates.push(date);
 const snapshot=calendar(now,{closedDates}),calls=[],calendarCalls=[];
 let response=()=>({closes:[],failures:[]}),calendarResponse=()=>snapshot;
 const provider={async fetchCalendar(args){calendarCalls.push(args);return calendarResponse(args);},async fetchCloses(args){calls.push(args);return response(args);}};
 if(knownCalendar)store.saveCalendar(snapshot);else calendarResponse=()=>{throw Object.assign(Error('unavailable'),{code:'UNKNOWN_CALENDAR_YEAR'});};
 t.after(()=>{db.close();fs.rmSync(root,{recursive:true,force:true});});
 const makeRunner=()=>new MarketAutomation(new MarketAutomationStore(db,market,{clock,enabled}),{clock,provider});
 return {db,clock,market,store,calls,calendarCalls,provider,snapshot,makeRunner,setTime:value=>{time=value;},respond:value=>{response=value;},respondCalendar:value=>{calendarResponse=value;}};
}
function round(f,date,{settlementAfter=closeAfter(date)}={}){
 const id=randomUUID();f.db.prepare("INSERT INTO market_rounds(id,target_date,cutoff_at,settlement_after,rules_json,created_by,created_at,actor_source) VALUES(?,?,?,?,?,NULL,?,'system')").run(id,date,R.cutoffFor(date),new Date(settlementAfter).toISOString(),JSON.stringify(R.snapshot()),new Date(f.clock()).toISOString());return id;
}

test('no price fetch at 14:00 or before23:59; starts at23:59',async t=>{
 const f=fixture(t,{now:closeAfter(DATE)}),r=f.makeRunner();await r.tick();assert.equal(f.calls.length,0);assert.equal(f.store.state().nextAttemptAt,new Date(START).toISOString());f.setTime(START-1);await r.tick();assert.equal(f.calls.length,0);f.setTime(START);await r.tick();assert.deepEqual(f.calls[0].dates,[DATE]);await r.stop();
});
test('seven five-minute claims persist over midnight and restarts, then stop until next night',async t=>{
 const f=fixture(t);let r=f.makeRunner();for(let i=0;i<=6;i++){f.setTime(START+i*RETRY_MS);await r.tick();await r.tick();await r.stop();r=f.makeRunner();await r.tick();}
 assert.equal(f.calls.length,7);assert.ok(f.calls.every(c=>c.dates.length===1&&c.dates[0]===DATE));assert.equal(f.store.state().nightWindow.slots.length,7);assert.equal(f.store.state().nightWindow.slots.at(-1),'2026-10-07T16:29:00.000Z');assert.equal(f.store.fetchState(DATE).automaticAttempts,7);f.setTime(START+30*60000+1);await r.tick();assert.equal(f.calls.length,7);assert.equal(f.store.state().nextAttemptAt,new Date(START+86400000).toISOString());assert.equal(validateMarketAutomationDatabase(f.db),true);await r.stop();
});
test('late start preserves real five-minute spacing and does not replay missed slots',async t=>{
 const f=fixture(t,{now:START+4*60000}),r=f.makeRunner();await r.tick();f.setTime(START+5*60000);await r.tick();assert.equal(f.calls.length,1);assert.equal(f.store.state().nextAttemptAt,new Date(START+9*60000).toISOString());f.setTime(START+9*60000);await r.tick();assert.equal(f.calls.length,2);await r.stop();
});
test('after-window startup waits until next23:59 and never fetches next date early',async t=>{
 const f=fixture(t,{now:START+31*60000}),r=f.makeRunner();await r.tick();assert.equal(f.calls.length,0);f.setTime(START+86400000-1);await r.tick();assert.equal(f.calls.length,0);f.setTime(START+86400000);await r.tick();assert.ok(f.calls[0].dates.includes(DATE));assert.ok(f.calls[0].dates.includes('2026-10-08'));await r.stop();
});
test('old exhausted dates recover next night without reawarding successful dates',async t=>{
 const f=fixture(t),id=round(f,DATE);f.store.writeFetchState(DATE,{status:'exhausted',automaticAttempts:25,manualAttempts:0,scheduledSlots:[],lastError:'DATA_NOT_PUBLISHED'});f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));let r=f.makeRunner();await r.tick();assert.equal(f.store.fetchState(DATE).status,'success');assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,1);await r.stop();r=f.makeRunner();await r.tick();assert.equal(f.calls.length,1);f.setTime(START+86400000);await r.tick();assert.ok(!f.calls.at(-1).dates.includes(DATE));assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,1);await r.stop();
});
test('valid proof saved before eligibility settles during night without fetching it',async t=>{
 const f=fixture(t,{now:closeAfter(DATE)}),id=round(f,DATE,{settlementAfter:START+10*60000});f.store.recordClose(close(DATE,f.clock()));const r=f.makeRunner();await r.tick();assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,0);f.setTime(START+10*60000);await r.tick();assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,1);assert.equal(f.calls.length,0);await r.stop();
});
test('unknown calendars still allow only night target and explicit pending historical dates',async t=>{
 const f=fixture(t,{knownCalendar:false}),r=f.makeRunner();round(f,'2026-10-06');await r.tick();assert.deepEqual(f.calls[0].dates,['2026-10-06',DATE]);await r.stop();
});
test('initial rolling history is batched and only missing dates retry inside window',async t=>{
 const f=fixture(t,{history:true}),gap='2026-10-06';f.respond(({dates})=>({closes:dates.filter(d=>d!==gap).map(d=>close(d,f.clock())),failures:[]}));const r=f.makeRunner();await r.tick();assert.ok(f.calls[0].dates.length>15);assert.ok(!f.calls[0].dates.includes('2026-10-04'));f.setTime(START+RETRY_MS);await r.tick();assert.deepEqual(f.calls[1].dates,[gap]);assert.equal(f.store.fetchState(gap).automaticAttempts,2);await r.stop();
});
test('older pending months rotate and closed dates are not requested',async t=>{
 const f=fixture(t);round(f,'2026-07-06');round(f,'2026-08-06');f.snapshot.closedDates.push(DATE);f.store.saveCalendar(f.snapshot);const r=f.makeRunner();await r.tick();assert.deepEqual(f.calls[0].dates,['2026-07-06']);f.setTime(START+RETRY_MS);await r.tick();assert.deepEqual(f.calls[1].dates,['2026-08-06']);await r.stop();
});
test('manual recheck remains available after14:00 and targets exactly one date',async t=>{
 const f=fixture(t,{now:closeAfter(DATE)}),id=round(f,DATE),r=f.makeRunner();f.respond(({dates})=>({closes:dates.map(d=>close(d,f.clock())),failures:[]}));const result=await r.manualRecheck(DATE);assert.equal(result.received,true);assert.deepEqual(f.calls[0].dates,[DATE]);assert.equal(f.store.fetchState(DATE).manualAttempts,1);assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,1);await r.stop();
});
test('invalid manual dates and disabled isolation do not claim a slot or call sources',async t=>{
 const f=fixture(t,{now:closeAfter(DATE)-1}),r=f.makeRunner();for(const d of ['2026-02-30','2026-10-08',DATE])await assert.rejects(r.manualRecheck(d),e=>e.status===400);assert.equal(f.calls.length,0);await r.stop();const isolated=fixture(t,{enabled:false}),r2=isolated.makeRunner();await r2.tick();await assert.rejects(r2.manualRecheck(DATE),e=>e.status===503);assert.equal(isolated.calls.length,0);assert.equal(isolated.db.prepare('SELECT COUNT(*) n FROM market_automation_state').get().n,0);await r2.stop();
});
test('stop aborts automatic and rejects queued manual work without storing late close',async t=>{
 const f=fixture(t);f.respond(({signal})=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve({closes:[close(DATE,f.clock())],failures:[]}))));const r=f.makeRunner(),work=r.tick();await new Promise(resolve=>setImmediate(resolve));const manual=r.manualRecheck(DATE),rejected=assert.rejects(manual,e=>e.status===503);await r.stop();await Promise.all([work,rejected]);assert.equal(f.store.hasClose(DATE),false);assert.equal(f.calls.length,1);
});
for(const failure of [{targetDate:DATE,code:'OFFICIAL_CLOSE_MISMATCH'},{code:'OFFICIAL_FETCH_FAILED'}])test('contradictory close stays rejected: '+failure.code,async t=>{
 const f=fixture(t),id=round(f,DATE),r=f.makeRunner();f.respond(()=>({closes:[close(DATE,f.clock())],failures:[failure]}));await r.tick();assert.equal(f.store.hasClose(DATE),false);assert.equal(f.store.fetchState(DATE).lastError,failure.code);assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,0);await r.stop();
});
test('duplicate or unexpected dates cannot populate close history',async t=>{
 const f=fixture(t),r=f.makeRunner();f.respond(()=>({closes:[close('2026-10-06',f.clock()),close(DATE,f.clock()),close(DATE,f.clock())],failures:[]}));await r.tick();assert.equal(f.store.hasClose('2026-10-06'),false);assert.equal(f.store.hasClose(DATE),false);assert.equal(f.store.fetchState(DATE).lastError,'DUPLICATE_OFFICIAL_DATE');await r.stop();
});
test('clock rollback cannot reclaim slots or reopen earlier night budget',async t=>{
 const f=fixture(t,{now:START+20*60000}),r=f.makeRunner();await r.tick();f.setTime(START+5*60000);await r.tick();f.setTime(START+20*60000);await r.tick();assert.equal(f.calls.length,1);f.setTime(START+25*60000);await r.tick();assert.equal(f.calls.length,2);f.setTime(START-86400000);await r.tick();assert.equal(f.calls.length,2);await r.stop();
});
test('final00:29 slot is skipped if real retry spacing is not due',async t=>{
 const f=fixture(t,{now:START+26*60000}),r=f.makeRunner();await r.tick();f.setTime(START+30*60000);await r.tick();assert.equal(f.calls.length,1);assert.equal(f.store.state().nextAttemptAt,new Date(START+86400000).toISOString());await r.stop();
});
test('night target remains prior date across month and year boundaries',()=>{
 for(const date of ['2026-10-31','2026-12-31','2028-02-29']){const start=startFor(date);assert.equal(nightWindow(start+60000).targetDate,date);assert.equal(nightWindow(start+30*60000).targetDate,date);assert.equal(nightWindow(start+30*60000+1).targetDate,addDays(date,1));}
});
test('persisted nightly claims reject tampering in backup validation',async t=>{
 const f=fixture(t),r=f.makeRunner();await r.tick();assert.equal(validateMarketAutomationDatabase(f.db),true);f.store.updateState({nightWindow:{targetDate:DATE,slots:[new Date(START-1).toISOString()],lastAttemptAt:new Date(START).toISOString()}});assert.throws(()=>validateMarketAutomationDatabase(f.db));await r.stop();
});
test('a request begun inside the window may finish with valid late data after00:29',async t=>{
 const f=fixture(t,{now:START+29*60000}),r=f.makeRunner();let finish;f.respond(()=>new Promise(resolve=>{finish=()=>resolve({closes:[close(DATE,f.clock())],failures:[]});}));const work=r.tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,1);f.setTime(START+31*60000);finish();await work;assert.equal(f.store.hasClose(DATE),true);assert.equal(f.store.state().nextAttemptAt,new Date(START+86400000).toISOString());assert.equal(validateMarketAutomationDatabase(f.db),true);await r.stop();
});
test('two scheduler instances cannot claim the same night slot',async t=>{
 const f=fixture(t),a=f.makeRunner(),b=f.makeRunner();await Promise.all([a.tick(),b.tick()]);assert.equal(f.calls.length,1);assert.equal(f.store.state().nightWindow.slots.length,1);await Promise.all([a.stop(),b.stop()]);
});
