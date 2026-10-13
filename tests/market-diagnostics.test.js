const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const {appFixture}=require('./helpers/app-fixture.cjs');
const {MarketStore}=require('../src/market/store');
const {MarketAutomationStore}=require('../src/market/automation-store');
const {createOfficialProvider,SOURCE_URLS}=require('../src/market/official-provider');
const now=Date.parse('2026-10-13T08:05:00Z');
test('source diagnostics preserve HTTP and DNS evidence without messages or bodies and cannot change fetch results',async()=>{
 for(const scenario of ['http','dns']){
  const events=[];const provider=createOfficialProvider({clock:()=>now,onDiagnostic:e=>events.push(e),fetchImpl:async()=>{
   if(scenario==='dns'){const e=new Error('secret cookie and private hostname');e.cause={code:'ENOTFOUND',message:'secret'};throw e;}
   return new Response('private error body',{status:429,headers:{'content-type':'text/html'}});
  }});
  const result=await provider.fetchCloses({from:'2026-10-12',to:'2026-10-12'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(result.failures[0].code,scenario==='http'?'OFFICIAL_HTTP_STATUS':'OFFICIAL_SOURCE_UNAVAILABLE');assert.equal(events.length,3);
  for(const e of events){assert.equal(e.status,'error');assert.ok(Object.values(SOURCE_URLS).includes(e.sourceUrl));assert.equal(e.httpStatus,scenario==='http'?429:null);assert.equal(e.networkCode,scenario==='dns'?'ENOTFOUND':null);assert.ok(e.elapsedMs>=0);}
  assert.doesNotMatch(JSON.stringify(events),/secret|private|cookie/);
 }
 const provider=createOfficialProvider({clock:()=>now,onDiagnostic:()=>{throw Error('logger broken');},fetchImpl:async()=>new Response('',{status:503})});
 assert.equal((await provider.fetchCloses({from:'2026-10-12',to:'2026-10-12'})).failures[0].code,'OFFICIAL_HTTP_STATUS');
});
test('admin diagnostics and downloads are private, bounded, read-only and survive reopening the database',async t=>{
 let providerCalls=0;const cookies={};let rowsBefore;
 const f=await appFixture(t,{config:{marketClock:()=>now,marketProvider:{fetchCalendar(){providerCalls++;},fetchCloses(){providerCalls++;}}},seed:db=>{
  for(const role of ['admin','member']){const id=randomUUID(),token=randomUUID();db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,role,role,'scrypt:'+'0'.repeat(32)+':'+'0'.repeat(128),role,new Date(now).toISOString());db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,'2030-01-01T00:00:00.000Z');cookies[role]='ah-session='+token;}
  const store=new MarketAutomationStore(db,new MarketStore(db,()=>now),{clock:()=>now});
  store.writeFetchState('2026-10-12',{status:'exhausted',automaticAttempts:21,manualAttempts:0,scheduledSlots:[],lastAttemptAt:new Date(now).toISOString(),lastAttemptKind:'scheduled',lastError:'OFFICIAL_HTTP_STATUS'});
  for(let i=0;i<220;i++)store.recordSourceDiagnostic({sourceUrl:SOURCE_URLS.index,status:'error',code:'OFFICIAL_HTTP_STATUS',httpStatus:429,elapsedMs:20});
  store.audit({detail:'Bearer private-secret',sourceUrl:SOURCE_URLS.index+'?token=private-secret'});rowsBefore=store.db.prepare('SELECT COUNT(*) n FROM market_fetch_audit').get().n;
 }});
 const get=(suffix='',role='admin')=>fetch(f.base+'/api/admin/market/diagnostics'+suffix,{headers:{Cookie:cookies[role]||''}});
 assert.equal((await get('','member')).status,403);assert.equal((await get('','unknown')).status,401);
 assert.equal((await fetch(f.base+'/api/admin/market/diagnostics',{method:'POST',headers:{Cookie:cookies.admin,'Content-Type':'application/json'},body:'{}'})).status,405);
 const response=await get('?download=1');assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment.*market-diagnostics.json/);assert.equal(response.headers.get('cache-control'),'no-store');
 const report=await response.json();assert.equal(report.runtime.schedulerEnabled,false);assert.equal(report.audit.length,200);assert.equal(report.dates[0].lastError,'OFFICIAL_HTTP_STATUS');assert.equal(report.dates[0].status,'exhausted');assert.equal(report.audit[0].detail,'REDACTED');assert.match(report.audit[1].detail,/HTTP_429;MS_20/);assert.doesNotMatch(JSON.stringify(report),/private-secret|password_hash|token_hash|ah-session/);assert.equal(providerCalls,0);
 const {openDatabase}=require('../src/db');const db=openDatabase(f.config.dbFile);try{const store=new MarketAutomationStore(db,new MarketStore(db,()=>now),{clock:()=>now,enabled:false});assert.equal(db.prepare('SELECT COUNT(*) n FROM market_fetch_audit').get().n,rowsBefore);assert.equal(store.diagnostics().audit[1].detail,report.audit[1].detail);}finally{db.close();}
 const publicView=await(await fetch(f.base+'/api/market',{headers:{Cookie:cookies.member}})).json();assert.equal(publicView.audit,undefined);assert.equal(publicView.marketFetchAudit,undefined);
});
