const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {openDatabase}=require('../src/db'),{MarketStore}=require('../src/market/store');
const {MarketAutomationStore,validateMarketAutomationDatabase,dateAt,addDays,monthWindow,closeAfter}=require('../src/market/automation-store');
const {MarketAutomation,RETRY_MS}=require('../src/market/automation');
const R=require('../public/market-rules');
const DATE='2026-10-07',START=closeAfter(DATE),source='https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX';
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

test('Taipei daily query starts at 14:00, with no current-date request before it',async t=>{
 const f=fixture(t,{now:START-1}),runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,0);assert.equal(f.store.state().nextAttemptAt,new Date(START).toISOString());
 f.setTime(START);await runner.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].dates,[DATE]);assert.deepEqual(f.store.fetchState(DATE).scheduledSlots,[new Date(START).toISOString()]);await runner.stop();
});

test('25 inclusive five-minute slots are durable and never replayed across restarts',async t=>{
 const f=fixture(t);let runner=f.makeRunner();
 for(let slot=0;slot<25;slot++){
  f.setTime(START+slot*RETRY_MS);await runner.tick();await runner.tick();await runner.stop();runner=f.makeRunner();await runner.tick();
 }
 assert.equal(f.calls.length,25);const state=f.store.fetchState(DATE);assert.equal(state.automaticAttempts,25);assert.equal(state.scheduledSlots.length,25);assert.equal(state.scheduledSlots.at(-1),'2026-10-07T08:00:00.000Z');assert.equal(state.status,'exhausted');
 f.setTime(START+2*3600000+1);await runner.tick();assert.equal(f.calls.length,25);assert.equal(f.store.state().status,'manual-required');assert.equal(f.store.state().nextAttemptAt,null);assert.equal(validateMarketAutomationDatabase(f.db),true);await runner.stop();
});

test('late startup consumes only the present slot rather than a missed-slot burst',async t=>{
 const f=fixture(t,{now:START+17*60000}),runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.store.fetchState(DATE).scheduledSlots,['2026-10-07T06:15:00.000Z']);
 f.setTime(START+19*60000);await runner.tick();assert.equal(f.calls.length,1);f.setTime(START+20*60000);await runner.tick();assert.equal(f.calls.length,1);f.setTime(START+22*60000);await runner.tick();assert.equal(f.calls.length,2);await runner.stop();
});

test('post-cutoff startup never routes today through historical gap filling',async t=>{
 const f=fixture(t,{now:START+2*3600000+1}),runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,0);assert.equal(f.store.fetchState(DATE).status,'exhausted');
 f.setTime(START+24*3600000-60000);await runner.tick();assert.equal(f.calls.length,0);assert.equal(f.store.fetchState(DATE).automaticAttempts,0);await runner.stop();
});

test('valid daily close stops automatic network forever and retains first observed time',async t=>{
 const f=fixture(t);f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));let runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).firstValidObservedAt,new Date(START).toISOString());
 for(const delta of [RETRY_MS,3600000,2*3600000,6*3600000]){f.setTime(START+delta);await runner.tick();}
 await runner.stop();runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).status,'success');assert.equal(f.store.fetchState(DATE).automaticAttempts,1);assert.equal(f.calendarCalls.length,2,'calendar refresh continues after price success');assert.equal(validateMarketAutomationDatabase(f.db),true);await runner.stop();
});

test('a previously scheduled failed date cannot reopen through next-day history',async t=>{
 const f=fixture(t),runner=f.makeRunner();await runner.tick();f.setTime(START+24*3600000-60000);await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).status,'exhausted');await runner.stop();
});

test('success before settlement eligibility settles later from saved proof without network',async t=>{
 const f=fixture(t),id=round(f,DATE,{settlementAfter:START+10*60000});f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));const runner=f.makeRunner();await runner.tick();
 assert.equal(f.store.fetchState(DATE).status,'success');assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,0);
 f.setTime(START+10*60000);await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,1);await runner.stop();
});

test('unknown calendars do not disable the current date fetch or planning retries',async t=>{
 const f=fixture(t,{knownCalendar:false});f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));const runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].dates,[DATE]);assert.equal(f.store.hasClose(DATE),true);assert.equal(f.store.state().status,'calendar-unavailable');
 f.respondCalendar(()=>f.snapshot);f.setTime(START+RETRY_MS);await runner.tick();assert.equal(f.calendarCalls.length,2);assert.equal(f.calls.length,1);assert.ok(f.db.prepare("SELECT 1 FROM market_rounds WHERE target_date='2026-10-08'").get());await runner.stop();
});

test('rolling month initializes once, then requests only remaining gaps and never successful dates',async t=>{
 const f=fixture(t,{history:true,now:START-60000}),gap='2026-10-06';f.respond(({dates})=>({closes:dates.filter(date=>date!==gap).map(date=>close(date,f.clock())),failures:[]}));const runner=f.makeRunner();await runner.tick();
 const initial=f.calls[0];assert.equal(initial.from,'2026-09-07');assert.equal(initial.to,'2026-10-06');assert.ok(initial.dates.length>15);assert.ok(!initial.dates.includes(DATE));assert.ok(!initial.dates.includes('2026-10-04'));
 f.setTime(START);await runner.tick();assert.deepEqual(f.calls[1].dates,[DATE],'historical gap waits its own five minutes');
 f.setTime(START+4*60000);await runner.tick();assert.deepEqual(f.calls[2].dates,[gap]);assert.equal(f.store.fetchState(gap).automaticAttempts,2);await runner.stop();
});

test('initial rolling history and today share one request while history failures are bounded',async t=>{
 const f=fixture(t,{history:true}),runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.ok(f.calls[0].dates.includes(DATE));assert.ok(f.calls[0].dates.includes('2026-09-07'));
 for(let i=1;i<5;i++){f.setTime(START+i*RETRY_MS);await runner.tick();}
 assert.equal(f.store.fetchState('2026-09-07').status,'exhausted');assert.equal(f.store.fetchState('2026-09-07').automaticAttempts,5);assert.equal(f.store.fetchState(DATE).status,'waiting');
 f.setTime(START+5*RETRY_MS);await runner.tick();assert.deepEqual(f.calls.at(-1).dates,[DATE]);await runner.stop();
});

test('bounded older catchup rotates one pending month per batch without fetching known closes',async t=>{
 const f=fixture(t,{now:START-60000});round(f,'2026-07-06');round(f,'2026-08-06');round(f,'2026-08-07');f.store.recordClose(close('2026-08-07',f.clock()));
 const runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].dates,['2026-07-06']);
 f.setTime(START-30000);await runner.tick();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].dates,['2026-08-06']);assert.equal(f.store.state().catchupMonth,'2026-08');await runner.stop();
});

test('manual recheck targets exactly one date and observes corrections without resetting scores',async t=>{
 const f=fixture(t),id=round(f,DATE);f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));const runner=f.makeRunner();await runner.tick();
 f.setTime(START+3*3600000);f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock(),'-2.00')),failures:[]}));const result=await runner.manualRecheck(DATE);
 assert.deepEqual(f.calls.at(-1).dates,[DATE]);assert.equal(f.calls.at(-1).from,DATE);assert.equal(f.calls.at(-1).to,DATE);assert.equal(result.review,true);assert.equal(result.status,'success');assert.equal(f.store.fetchState(DATE).manualAttempts,1);assert.equal(f.store.fetchState(DATE).firstValidObservedAt,new Date(START).toISOString());assert.equal(f.db.prepare('SELECT return_pct FROM market_rounds WHERE id=?').get(id).return_pct,2);await runner.stop();
});

test('failed manual recheck preserves exhausted automatic stop and prior successful observations',async t=>{
 const f=fixture(t,{now:START+3*3600000}),runner=f.makeRunner();await runner.tick();let result=await runner.manualRecheck(DATE);assert.equal(result.failed,true);assert.equal(result.status,'exhausted');f.setTime(START+24*3600000-60000);await runner.tick();assert.equal(f.calls.length,1);
 f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));result=await runner.manualRecheck(DATE);assert.equal(result.status,'success');const observed=f.store.fetchState(DATE).firstValidObservedAt;
 f.respond(()=>{throw Error('network failed');});result=await runner.manualRecheck(DATE);assert.equal(result.failed,true);assert.equal(result.status,'success');assert.equal(f.store.fetchState(DATE).firstValidObservedAt,observed);await runner.stop();
});

test('manual work waits for automatic work, rejects a duplicate, and prevents overlap',async t=>{
 const f=fixture(t);let release,active=0,maxActive=0;f.respond(async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>{release=resolve;});active--;return {closes:[],failures:[]};});
 const runner=f.makeRunner(),automatic=runner.tick();await new Promise(resolve=>setImmediate(resolve));const manual=runner.manualRecheck(DATE);assert.equal(runner.tick(),manual);await assert.rejects(runner.manualRecheck(DATE),error=>error.status===409&&error.code==='MARKET_RECHECK_IN_PROGRESS');assert.equal(f.calls.length,1);
 release();await automatic;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,2);release();await manual;assert.equal(maxActive,1);await runner.stop();
});

test('stop aborts current work and prevents a queued manual request from starting',async t=>{
 const f=fixture(t);f.respond(({signal})=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve({closes:[close(DATE,f.clock())],failures:[]}),{once:true})));
 const runner=f.makeRunner(),automatic=runner.tick();await new Promise(resolve=>setImmediate(resolve));const manual=runner.manualRecheck(DATE),rejected=assert.rejects(manual,error=>error.status===503);await runner.stop();await Promise.all([automatic,rejected]);assert.equal(f.calls.length,1);assert.equal(f.store.hasClose(DATE),false);
});

test('manual input validation and disabled isolation happen before network or attempts',async t=>{
 const f=fixture(t,{now:START-1}),runner=f.makeRunner();for(const date of ['2026-02-30','2026-10-08',DATE])await assert.rejects(runner.manualRecheck(date),error=>error.status===400);assert.equal(f.calls.length,0);await runner.stop();
 const isolated=fixture(t,{enabled:false}),disabled=isolated.makeRunner();await assert.rejects(disabled.manualRecheck(DATE),error=>error.status===503);await disabled.tick();assert.equal(isolated.calls.length,0);assert.equal(isolated.db.prepare('SELECT COUNT(*) n FROM market_automation_state').get().n,0);await disabled.stop();
});

test('unexpected successful dates and duplicate close rows cannot silently populate history',async t=>{
 const f=fixture(t),runner=f.makeRunner();f.respond(()=>({closes:[close('2026-10-06',f.clock()),close(DATE,f.clock()),close(DATE,f.clock())],failures:[]}));await runner.tick();assert.equal(f.store.hasClose(DATE),false);assert.equal(f.store.hasClose('2026-10-06'),false);assert.equal(f.store.fetchState(DATE).lastError,'DUPLICATE_OFFICIAL_DATE');await runner.stop();
});

test('Taipei midnight resets daily scheduling without replaying the prior date',async t=>{
 const f=fixture(t);f.respond(({dates})=>({closes:dates.map(date=>close(date,f.clock())),failures:[]}));const runner=f.makeRunner();await runner.tick();f.setTime(Date.parse('2026-10-07T16:00:00Z'));assert.equal(dateAt(f.clock()),'2026-10-08');await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.state().nextAttemptAt,'2026-10-08T06:00:00.000Z');f.setTime(closeAfter('2026-10-08'));await runner.tick();assert.deepEqual(f.calls.at(-1).dates,['2026-10-08']);await runner.stop();
});

for(const failure of [{targetDate:DATE,code:'OFFICIAL_CLOSE_MISMATCH'},{code:'OFFICIAL_FETCH_FAILED'}])test('same-date or global provider failures block contradictory successful data '+failure.code,async t=>{
 const f=fixture(t),id=round(f,DATE),runner=f.makeRunner();f.respond(()=>({closes:[close(DATE,f.clock())],failures:[failure]}));await runner.tick();assert.equal(f.store.hasClose(DATE),false);assert.equal(f.store.fetchState(DATE).status,'waiting');assert.equal(f.store.fetchState(DATE).lastError,failure.code);assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,0);await runner.stop();
});


test('known official closure skips all current-date automatic requests',async t=>{
 const f=fixture(t);f.snapshot.closedDates.push(DATE);f.store.saveCalendar(f.snapshot);const runner=f.makeRunner();await runner.tick();f.setTime(START+2*3600000+1);await runner.tick();assert.equal(f.calls.length,0);assert.equal(f.store.fetchState(DATE).automaticAttempts,0);assert.equal(f.store.fetchState(DATE).status,'pending');await runner.stop();
});

test('clock rollback never claims an earlier scheduled slot',async t=>{
 const f=fixture(t,{now:START+20*60000}),runner=f.makeRunner();await runner.tick();f.setTime(START+5*60000);await runner.tick();f.setTime(START+20*60000);await runner.tick();assert.equal(f.calls.length,1);f.setTime(START+25*60000);await runner.tick();assert.equal(f.calls.length,2);assert.equal(f.store.fetchState(DATE).scheduledSlots.length,2);await runner.stop();
});

test('unknown calendar historical dates are queried only for explicit pending rounds',async t=>{
 const f=fixture(t,{knownCalendar:false,now:START-1});round(f,'2026-10-06');const runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].dates,['2026-10-06']);await runner.stop();
});

test('a query started before cutoff may finish successfully after cutoff',async t=>{
 const f=fixture(t,{now:START+115*60000});f.respond(({dates})=>{f.setTime(START+121*60000);return {closes:dates.map(date=>close(date,f.clock())),failures:[]};});const runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).status,'success');assert.equal(f.store.fetchState(DATE).firstValidObservedAt,new Date(START+121*60000).toISOString());await runner.tick();assert.equal(f.calls.length,1);await runner.stop();
});


test('unknown-calendar daily failure expires after restart even with no historical round',async t=>{
 const f=fixture(t,{knownCalendar:false});let runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).status,'waiting');await runner.stop();
 f.setTime(START+24*3600000-60000);runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).status,'exhausted');assert.ok(f.store.view().automation.manualRequiredDates.includes(DATE));await runner.stop();
});

test('later confirmed closure clears actionable manual-needed display without deleting fetch audit',async t=>{
 const f=fixture(t),runner=f.makeRunner();await runner.tick();f.setTime(START+2*3600000+1);await runner.tick();assert.ok(f.store.view().automation.manualRequiredDates.includes(DATE));
 f.snapshot.closedDates.push(DATE);f.store.saveCalendar(f.snapshot);await runner.tick();assert.equal(f.store.fetchState(DATE).status,'exhausted');assert.ok(!f.store.view().automation.manualRequiredDates.includes(DATE));assert.equal(f.store.view().automation.status,'ok');await runner.stop();
});


test('late startup preserves five real minutes between automatic starts across slot boundaries',async t=>{
 const f=fixture(t,{now:START+4*60000});let runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.state().nextAttemptAt,new Date(START+9*60000).toISOString());await runner.stop();
 runner=f.makeRunner();f.setTime(START+5*60000);await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.state().nextAttemptAt,new Date(START+9*60000).toISOString());
 f.setTime(START+9*60000);await runner.tick();assert.equal(f.calls.length,2);assert.deepEqual(f.store.fetchState(DATE).scheduledSlots,['2026-10-07T06:00:00.000Z','2026-10-07T06:05:00.000Z']);assert.equal(f.store.state().nextAttemptAt,new Date(START+14*60000).toISOString());await runner.stop();
});

test('a final16:00 slot is skipped when its five-minute retry spacing is not due',async t=>{
 const f=fixture(t,{now:START+116*60000}),runner=f.makeRunner();await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.state().nextAttemptAt,null);f.setTime(START+120*60000);await runner.tick();assert.equal(f.calls.length,1);f.setTime(START+120*60000+1);await runner.tick();assert.equal(f.calls.length,1);assert.equal(f.store.fetchState(DATE).status,'exhausted');await runner.stop();
});
