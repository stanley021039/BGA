const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {openDatabase}=require('../src/db'),{MarketStore,validateMarketDatabase}=require('../src/market/store');
const {MarketAutomationStore,validateMarketAutomationDatabase,monthWindow,dateAt}=require('../src/market/automation-store');
const {MarketAutomation,RETRY_MS}=require('../src/market/automation');
const {settings}=require('../src/config');
const start=Date.parse('2026-10-06T07:00:00Z'),after=Date.parse('2026-10-07T06:00:00Z');
const source='https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX';
function calendar(year=2026,extra={}){return {year,coverageStart:`${year}-01-01`,coverageEnd:`${year}-12-31`,closedDates:['2026-10-09','2026-10-26'].filter(date=>date.startsWith(String(year))),openDates:[],sourceUrl:'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',sourceHash:'a'.repeat(64),fetchedAt:new Date(start).toISOString(),...extra};}
function agreedCalendar(){const c=calendar();c.evidence=[{url:c.sourceUrl,sha256:c.sourceHash,fetchedAt:c.fetchedAt},{url:'https://www.twse.com.tw/rwd/zh/holidaySchedule/holidaySchedule?date=20260101&response=html',sha256:'f'.repeat(64),fetchedAt:c.fetchedAt}];return c;}
function close(targetDate='2026-10-07',returnPct='2.00',extra={}){const changeCents=Math.round(Number(returnPct)*10000),fetchedAt=new Date(after).toISOString();return {targetDate,closeCents:1000000+changeCents,changeCents,returnPct,sourceUrl:source,fetchedAt,evidence:[{url:source,sha256:'b'.repeat(64),fetchedAt},{url:'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK',sha256:'c'.repeat(64),fetchedAt}],...extra};}
function fixture(t,{enabled=true,now=start}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'market-automation-')),file=path.join(root,'app.sqlite'),db=openDatabase(file);let time=now;
 const users=['甲','乙','丙'].map((name,i)=>({id:randomUUID(),name,role:i?'member':'admin'}));
 for(const user of users)db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(user.id,'private_login_'+user.name,user.name,'test',user.role,new Date(start).toISOString());
 const clock=()=>time,market=new MarketStore(db,clock),store=new MarketAutomationStore(db,market,{clock,enabled});
 t.after(()=>{try{db.close();}catch{}fs.rmSync(root,{recursive:true,force:true});});
 return {root,file,db,users,clock,market,store,setTime:value=>{time=value;}};
}
function setup(f,date='2026-10-07'){f.store.saveCalendar(calendar());f.store.plan();return f.db.prepare('SELECT id FROM market_rounds WHERE target_date=?').get(date).id;}
function vote(f,id,user=f.users[0],optionId='rally'){return f.market.vote(user,{requestId:randomUUID(),roundId:id,optionId,expectedRevision:0});}

test('calendar month window clamps end-of-month and leap dates using Taipei date',()=>{
 for(const [to,from] of [['2026-03-31','2026-02-28'],['2028-03-31','2028-02-29'],['2026-01-31','2025-12-31'],['2026-10-07','2026-09-07']])assert.deepEqual(monthWindow(to),{from,to});
 assert.equal(dateAt(Date.parse('2026-10-07T16:00:00Z')),'2026-10-08');
});
test('system round uses official calendar, skips holiday/weekend, keeps unknown next year closed',t=>{
 const f=fixture(t);assert.equal(f.store.plan(),null);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_rounds').get().n,0);
 f.store.saveCalendar(calendar());assert.equal(f.store.plan(),'2026-10-07');assert.equal(f.store.plan(),'2026-10-07');
 const row=f.db.prepare('SELECT * FROM market_rounds').get();assert.equal(row.created_by,null);assert.equal(row.actor_source,'system');assert.equal(row.cutoff_at,'2026-10-06T16:00:00.000Z');
 f.setTime(Date.parse('2026-10-08T06:00:00Z'));assert.equal(f.store.plan(),'2026-10-12');
 f.setTime(Date.parse('2026-12-31T06:00:00Z'));assert.equal(f.store.plan(),null);f.store.saveCalendar(calendar(2027,{closedDates:['2027-01-01']}));assert.equal(f.store.plan(),'2027-01-04');
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM users').get().n,3);
});
test('exact valid daily close awards atomically only after14:00, persists across restart and never repeats',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);vote(f,id,f.users[1],'dip');f.setTime(after-1);
 assert.equal(f.store.recordClose(close()).code,'BEFORE_CLOSE_QUERY');assert.equal(f.market.stats(f.users[0].id).score,0);
 f.setTime(after);assert.equal(f.store.recordClose(close()).settled,true);assert.equal(f.market.stats(f.users[0].id).score,5);assert.equal(f.market.stats(f.users[1].id).score,-1);assert.equal(f.market.stats(f.users[2].id).score,0);
 const refreshed=close();refreshed.evidence[0].sha256='d'.repeat(64);assert.equal(f.store.recordClose(refreshed).alreadySettled,true);assert.equal(JSON.parse(f.db.prepare('SELECT evidence_json FROM market_daily_closes').get().evidence_json).evidence[0].sha256,'b'.repeat(64),'settlement evidence stays frozen');
 const again=new MarketAutomationStore(f.db,new MarketStore(f.db,f.clock),{clock:f.clock});assert.equal(again.recordClose(close()).alreadySettled,true);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_ledger').get().n,2);assert.equal(f.db.prepare('SELECT created_by,actor_source FROM market_settlements').get().created_by,null);
 assert.equal(validateMarketDatabase(f.db),true);assert.equal(validateMarketAutomationDatabase(f.db),true);
});
for(const [value,bucket] of [['-5.00','crash'],['-2.00','fall'],['-1.99','dip'],['0.00','tie'],['1.99','rise'],['2.00','rally'],['4.99','rally'],['5.00','surge']])test(`official decimal boundary ${value} stays ${bucket}`,t=>{
 const f=fixture(t),id=setup(f);vote(f,id,f.users[0],bucket==='tie'?'rise':bucket);f.setTime(after);f.store.recordClose(close('2026-10-07',value));assert.equal(f.db.prepare('SELECT result_bucket FROM market_rounds WHERE id=?').get(id).result_bucket,bucket);assert.equal(f.market.stats(f.users[0].id).score,bucket==='tie'?0:5);
});
test('malformed or inconsistent proof never stores closes or awards',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);
 for(const change of [{targetDate:'2026-02-30'},{closeCents:NaN},{closeCents:Number.MAX_SAFE_INTEGER,changeCents:-1},{returnPct:'1.9999'},{returnPct:'5.00'},{evidence:[]},{evidence:[close().evidence[0],close().evidence[0]]},{sourceUrl:'https://evil.example/'},{evidence:[...close().evidence.slice(0,1),{url:source,sha256:'invalid',fetchedAt:new Date(after).toISOString()}]}])assert.throws(()=>f.store.recordClose(close('2026-10-07','2.00',change)));
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_daily_closes').get().n,0);assert.equal(f.market.stats(f.users[0].id).score,0);
});
test('ledger failure rolls back source proof, audit and result along with points',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);vote(f,id,f.users[1]);f.setTime(after);const audit=f.db.prepare('SELECT COUNT(*) n FROM market_fetch_audit').get().n;
 f.db.exec("CREATE TRIGGER injected_market BEFORE INSERT ON market_ledger WHEN (SELECT COUNT(*) FROM market_ledger)>0 BEGIN SELECT RAISE(ABORT,'injected'); END");assert.throws(()=>f.store.recordClose(close()),/injected/);
 for(const table of ['market_daily_closes','market_settlements','market_ledger'])assert.equal(f.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_fetch_audit').get().n,audit);
 f.db.exec('DROP TRIGGER injected_market');assert.equal(f.store.recordClose(close()).settled,true);
});
test('official post-settlement correction flags review without touching points, original proof or revision',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);f.store.recordClose(close());const original=f.db.prepare('SELECT * FROM market_daily_closes').get();
 assert.equal(f.store.recordClose(close('2026-10-07','-2.00')).review,true);assert.equal(f.store.recordClose(close('2026-10-07','-2.00')).review,true);
 const saved=f.db.prepare('SELECT * FROM market_daily_closes').get();assert.equal(saved.fingerprint,original.fingerprint);assert.equal(saved.return_pct,'2.00');assert.equal(saved.review_required,1);assert.equal(JSON.parse(saved.revised_json).returnPct,'-2.00');assert.equal(f.market.stats(f.users[0].id).score,5);assert.equal(f.db.prepare('SELECT result_revision FROM market_rounds WHERE id=?').get(id).result_revision,1);assert.equal(validateMarketAutomationDatabase(f.db),true);
});
test('manual first settlement wins a race, automatic arrival cannot overwrite it',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);f.market.settle(f.users[0],{requestId:randomUUID(),roundId:id,returnPct:-2,expectedRevision:0,confirmed:true});
 assert.equal(f.store.recordClose(close()).alreadySettled,true);assert.equal(f.market.stats(f.users[0].id).score,-1);assert.equal(f.db.prepare('SELECT review_required FROM market_daily_closes').get().review_required,1);
});
test('temporary official closure override is authenticated, audited, voids without fake0% and blocks votes',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);const input={requestId:randomUUID(),targetDate:'2026-10-07',isOpen:false,reason:'颱風休市公告',sourceUrl:'https://www.twse.com.tw/staticFiles/news/closure.pdf',confirmed:true};
 assert.throws(()=>f.store.override(f.users[1],input),error=>error.code==='ADMIN_REQUIRED');assert.throws(()=>f.store.override(f.users[0],{...input,confirmed:false}));assert.throws(()=>f.store.override(f.users[0],{...input,sourceUrl:'https://twse.com.tw.evil.test/'}));
 assert.equal(f.store.override(f.users[0],input).ok,true);assert.equal(f.store.override(f.users[0],input).replayed,true);assert.equal(f.market.view(f.users[0]).rounds[0].phase,'void');assert.throws(()=>vote(f,id,f.users[1]),error=>error.code==='VOTING_CLOSED');
 f.setTime(after);f.store.recordClose(close());assert.equal(f.market.stats(f.users[0].id).score,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_settlements').get().n,0);
 assert.throws(()=>f.market.preview(f.users[0],{roundId:id,expectedRevision:0,returnPct:0}),error=>error.code==='ROUND_VOID');assert.equal(validateMarketDatabase(f.db),true);
});
test('leaderboard counts only market ledger, safe names, tied rank, and excludes disabled accounts',t=>{
 const f=fixture(t),id=setup(f);for(const user of f.users)vote(f,id,user);f.setTime(after);f.store.recordClose(close());
 let board=f.market.leaderboard(f.users[1].id);assert.deepEqual(board.rows.map(row=>row.rank),[1,1,1]);assert.equal(board.rows[0].score,5);assert.equal(board.ownRank.isMe,true);assert.equal(board.totalParticipants,3);assert.ok(!JSON.stringify(board).includes('private_login_'));for(const user of f.users)assert.ok(!JSON.stringify(board).includes(user.id));
 const first=board.rows.map(row=>row.displayName);assert.deepEqual(f.market.leaderboard(f.users[1].id).rows.map(row=>row.displayName),first);
 f.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f.users[0].id);board=f.market.leaderboard(f.users[1].id);assert.equal(board.totalParticipants,2);
});
test('history keeps rolling calendar bounds and explicit missing expected trading dates',t=>{
 const f=fixture(t,{now:after});f.store.saveCalendar(calendar());f.store.recordClose(close());const view=f.store.view();assert.deepEqual([view.marketHistory.from,view.marketHistory.to],['2026-09-07','2026-10-07']);assert.equal(view.marketHistory.rows[0].close,10200);assert.ok(view.marketHistory.waitingDates.includes('2026-10-06'));assert.ok(!view.marketHistory.waitingDates.includes('2026-10-04'));assert.ok(!view.marketHistory.waitingDates.includes('2026-10-07'));
});
test('side-effect isolation disables every automatic fetch and mutation, including startup and restart',async t=>{
 const f=fixture(t,{enabled:false,now:after});let fetched=0;const runner=new MarketAutomation(f.store,{clock:f.clock,provider:{fetchCalendar(){fetched++;},fetchCloses(){fetched++;}}});runner.start();await runner.tick();f.store.saveCalendar(calendar());assert.equal(f.store.plan(),null);assert.equal(f.store.recordClose(close()).disabled,true);f.store.updateState({status:'ok'});await runner.stop();assert.equal(fetched,0);
 for(const table of ['market_calendar_years','market_rounds','market_daily_closes','market_fetch_audit','market_automation_state'])assert.equal(f.db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
 assert.equal(f.store.view().automation.status,'disabled');assert.equal(settings({}).marketAutomationEnabled,true);assert.equal(settings({MARKET_AUTOMATION_ENABLED:'false'}).marketAutomationEnabled,false);assert.throws(()=>settings({MARKET_AUTOMATION_ENABLED:'yes'}));
});
test('delayed official data retries but never blocks next round; restart catches a pending award once',async t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);let ready=false,calls=0;const provider={async fetchCalendar(){return calendar();},async fetchCloses(){calls++;return ready?{closes:[close()],failures:[]}:{closes:[],failures:[{targetDate:'2026-10-07',code:'DATA_NOT_PUBLISHED'}]};}};
 let runner=new MarketAutomation(f.store,{clock:f.clock,provider});await runner.tick();assert.equal(f.market.stats(f.users[0].id).score,0);assert.ok(f.db.prepare("SELECT 1 FROM market_rounds WHERE target_date='2026-10-08'").get());assert.equal(f.store.view().automation.status,'waiting');await runner.tick();assert.equal(calls,1);await runner.stop();
 ready=true;f.setTime(after+RETRY_MS);runner=new MarketAutomation(f.store,{clock:f.clock,provider});await runner.tick();assert.equal(f.market.stats(f.users[0].id).score,5);f.setTime(after+2*RETRY_MS);await runner.tick();assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_ledger').get().n,1);await runner.stop();
});
test('single in-flight run and shutdown abort prevent late fetch completion from writing',async t=>{
 const f=fixture(t,{now:after});let finish,started=false;const provider={fetchCalendar({signal}){started=true;return new Promise(resolve=>{finish=()=>resolve(calendar());signal.addEventListener('abort',finish,{once:true});});},fetchCloses(){throw Error('must not run after shutdown');}};
 const runner=new MarketAutomation(f.store,{clock:f.clock,provider}),first=runner.tick(),second=runner.tick();assert.equal(first,second);assert.equal(started,true);await runner.stop();await first;finish();assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_calendar_years').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_rounds').get().n,0);
});
test('a poisoned proof cannot corrupt the backup validator silently',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);f.store.recordClose(close());f.db.prepare("UPDATE market_daily_closes SET return_pct='5.00'").run();assert.throws(()=>validateMarketAutomationDatabase(f.db));
});

test('separate SQLite writers serialize duplicate system settlement and competing manual settlement',async t=>{
 const {Worker}=require('node:worker_threads'),f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);
 async function race(operations){const barrier=new SharedArrayBuffer(4),workers=operations.map(operation=>new Worker(path.join(__dirname,'helpers/market-auto-worker.cjs'),{workerData:{file:f.file,now:after,barrier,...operation}}));
  try{await Promise.all(workers.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);})));const results=workers.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));Atomics.store(new Int32Array(barrier),0,1);Atomics.notify(new Int32Array(barrier),0);return await Promise.all(results);}finally{await Promise.all(workers.map(worker=>worker.terminate()));}}
 const duplicate=await race([{input:close()},{input:close()}]);assert.ok(duplicate.every(result=>result.ok));assert.equal(duplicate.filter(result=>result.result.settled).length,1);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_ledger').get().n,1);
 const competing=await race([{input:close()},{manual:true,actor:f.users[0],input:{requestId:randomUUID(),roundId:id,returnPct:-2,expectedRevision:0,confirmed:true}}]);assert.equal(competing.filter(result=>!result.ok&&result.code==='STALE_RESULT').length,1);assert.equal(f.market.stats(f.users[0].id).score,5);
});

test('HTTP API publishes safe dashboard, protects overrides, and restarts with persisted automatic awards',async t=>{
 const {createApp}=require('../src/app'),{createHash}=require('node:crypto'),f=fixture(t),id=setup(f);vote(f,id);vote(f,id,f.users[1],'dip');f.setTime(after);
 const cookies=f.users.map(user=>{const raw=randomUUID();f.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(raw).digest('hex'),user.id,'2030-01-01T00:00:00.000Z');return 'ah-session='+raw;});
 const provider={async fetchCalendar(){return calendar();},async fetchCloses(){return {closes:[close()],failures:[]};}},config={...settings({DB_FILE:f.file,HISTORY_DIR:path.join(f.root,'history'),COMMUNITY_DIR:path.join(f.root,'community'),MUSIC_DIR:path.join(f.root,'music'),EXTERNAL_SIDE_EFFECTS_ENABLED:'true'}),host:'127.0.0.1',port:0,githubClient:{configured:false},marketClock:f.clock,marketProvider:provider};
 f.db.close();let app=createApp(config),base='http://127.0.0.1:'+(await app.listen()).port;
 const get=(route,cookie)=>fetch(base+route,{headers:cookie?{Cookie:cookie}:{}}),post=(route,input,cookie)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(input)});
 try{
  assert.equal((await get('/api/market')).status,401);const member=await(await get('/api/market',cookies[1])).json();assert.equal(member.stats.score,-1);assert.equal(member.automation.enabled,true);assert.equal(member.marketHistory.rows[0].targetDate,'2026-10-07');assert.equal(member.leaderboard.rows[0].displayName,'甲');assert.equal('marketFetchAudit' in member,false);assert.equal(JSON.stringify(member.leaderboard).includes(f.users[0].id),false);
  const input={requestId:randomUUID(),targetDate:'2026-10-08',isOpen:false,reason:'官方臨時休市',sourceUrl:'https://www.twse.com.tw/staticFiles/news/closure.pdf',confirmed:true};
  assert.equal((await post('/api/admin/market/calendar-override',input,cookies[1])).status,403);assert.equal((await get('/api/admin/market/calendar-override',cookies[0])).status,405);assert.equal((await post('/api/admin/market/calendar-override',input,cookies[0])).status,200);
  const admin=await(await get('/api/admin/market',cookies[0])).json();assert.ok(Array.isArray(admin.marketFetchAudit));assert.equal(admin.rounds.find(round=>round.targetDate==='2026-10-08').phase,'void');assert.equal(admin.rounds.find(round=>round.targetDate==='2026-10-07').settlementHistory[0].administrator,'系統');
  await app.close();app=createApp({...config,externalSideEffectsEnabled:false});base='http://127.0.0.1:'+(await app.listen()).port;const restarted=await(await get('/api/market',cookies[1])).json();assert.equal(restarted.stats.score,-1);assert.equal(restarted.automation.enabled,false);assert.equal(restarted.leaderboard.rows[0].score,5);
 }finally{await app.close();}
});

test('closure after a manual settlement is visibly reviewable without official close data and override receipts retain reasons',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);f.market.settle(f.users[0],{requestId:randomUUID(),roundId:id,returnPct:2,expectedRevision:0,confirmed:true});
 const input={requestId:randomUUID(),targetDate:'2026-10-07',isOpen:false,reason:'官方宣布臨時休市，待核對人工結果',sourceUrl:'https://www.twse.com.tw/staticFiles/news/closure.pdf',confirmed:true};f.store.override(f.users[0],input);
 assert.ok(f.store.view().automation.reviewDates.includes('2026-10-07'));assert.equal(f.market.stats(f.users[0].id).score,5);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_daily_closes').get().n,0);
 const receipt=JSON.parse(f.db.prepare('SELECT response_json FROM market_requests WHERE request_id=?').get(input.requestId).response_json);assert.equal(receipt.reason,input.reason);assert.equal(receipt.sourceUrl,input.sourceUrl);assert.equal(receipt.administrator,'甲');
});

test('fresh conflicting calendars invalidate cached coverage until a consistent refresh',async t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);const error=Object.assign(Error('calendar disagreement'),{code:'CALENDAR_SOURCE_MISMATCH',years:[2026]});let fixed=false;
 const provider={async fetchCalendar(){if(!fixed)throw error;return [agreedCalendar()];},async fetchCloses(){return {closes:[close()],failures:[]};}},runner=new MarketAutomation(f.store,{clock:f.clock,provider});
 await runner.tick();assert.equal(f.store.isTradingDay('2026-10-08'),null);assert.equal(f.store.view().automation.nextTradingDate,null);assert.equal(f.store.view().automation.status,'calendar-unavailable');assert.equal(f.market.stats(f.users[0].id).score,0);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM market_calendar_years WHERE year=2026").get().n,1,'last valid snapshot remains auditable');
 fixed=true;f.setTime(after+RETRY_MS);await runner.tick();assert.equal(f.store.isTradingDay('2026-10-08'),true);assert.equal(f.market.stats(f.users[0].id).score,5);assert.deepEqual(f.store.state().calendarBlockedYears,[]);assert.equal(validateMarketAutomationDatabase(f.db),true);await runner.stop();
});

test('primary audit hashes always belong to their recorded URL through first, repeated and review fetches',t=>{
 const f=fixture(t),id=setup(f);vote(f,id);f.setTime(after);
 const historyClose=close();historyClose.sourceUrl=historyClose.evidence[1].url;
 assert.throws(()=>f.store.recordClose({...historyClose,sourceUrl:'https://www.twse.com.tw/unrepresented-report'}),/Missing primary source evidence/);
 f.store.recordClose(historyClose);let audit=f.db.prepare("SELECT * FROM market_fetch_audit WHERE kind='close' ORDER BY id DESC LIMIT 1").get();assert.equal(audit.source_url,historyClose.sourceUrl);assert.equal(audit.source_hash,'c'.repeat(64));
 historyClose.evidence[1].sha256='e'.repeat(64);f.store.recordClose(historyClose);audit=f.db.prepare("SELECT * FROM market_fetch_audit WHERE kind='close' ORDER BY id DESC LIMIT 1").get();assert.equal(audit.source_hash,'e'.repeat(64));
 const correction=close('2026-10-07','-2.00');correction.sourceUrl=correction.evidence[1].url;correction.evidence[1].sha256='f'.repeat(64);f.store.recordClose(correction);
 audit=f.db.prepare("SELECT * FROM market_fetch_audit WHERE kind='close' ORDER BY id DESC LIMIT 1").get();assert.equal(audit.source_url,correction.sourceUrl);assert.equal(audit.source_hash,'f'.repeat(64));
 correction.evidence[1].sha256='a'.repeat(64);f.store.recordClose(correction);audit=f.db.prepare("SELECT * FROM market_fetch_audit WHERE kind='close' ORDER BY id DESC LIMIT 1").get();assert.equal(audit.source_hash,'a'.repeat(64));assert.equal(f.market.stats(f.users[0].id).score,5);
});

test('explicit admin open override resolves only that date inside a conflicted year for planning and settlement',t=>{
 const f=fixture(t);f.store.saveCalendar(calendar());f.store.blockCalendarYears([2026]);
 f.store.override(f.users[0],{requestId:randomUUID(),targetDate:'2026-10-07',isOpen:true,reason:'管理員逐日核對官方交易公告',sourceUrl:'https://www.twse.com.tw/staticFiles/news/open.pdf',confirmed:true});
 assert.equal(f.store.plan(),'2026-10-07');const id=f.db.prepare("SELECT id FROM market_rounds WHERE target_date='2026-10-07'").get().id;vote(f,id);f.setTime(after);assert.equal(f.store.recordClose(close()).settled,true);assert.equal(f.market.stats(f.users[0].id).score,5);
 assert.deepEqual(f.store.state().calendarBlockedYears,[2026]);assert.equal(f.store.isTradingDay('2026-10-08'),null);assert.equal(f.store.plan(),null);
});
