const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openDatabase}=require('../src/db');
const {MarketStore}=require('../src/market/store');
const {MarketAutomationStore,validateMarketAutomationDatabase}=require('../src/market/automation-store');
const day='2026-10-08',start=Date.parse(day+'T14:00:00+08:00');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'market-fetch-state-')),file=path.join(dir,'test.sqlite');let db=openDatabase(file),now=start;const clock=()=>now;const make=()=>new MarketAutomationStore(db,new MarketStore(db,clock),{clock});t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});return {get db(){return db;},file,clock,make,set:value=>now=value,reopen(){db.close();db=openDatabase(file);return make();}};}
function close(){const at=new Date(start).toISOString(),url='https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX';return {targetDate:day,closeCents:1020000,changeCents:20000,returnPct:'2.00',sourceUrl:url,fetchedAt:at,evidence:[{url,sha256:'a'.repeat(64),fetchedAt:at},{url:'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK',sha256:'b'.repeat(64),fetchedAt:at}]};}
test('daily fetch claims survive database reopen, reject duplicate/backwards slots and stop after successful proof',t=>{
 const f=fixture(t);let store=f.make();const claim={kind:'scheduled',slot:new Date(start).toISOString(),at:new Date(start).toISOString()};
 assert.equal(store.recordFetchAttempt(day,claim),true);assert.equal(store.recordFetchAttempt(day,claim),false);
 store=f.reopen();assert.equal(store.recordFetchAttempt(day,claim),false);assert.equal(store.fetchState(day).automaticAttempts,1);
 assert.equal(store.recordClose(close()).stored,true);const observed=store.fetchState(day).firstValidObservedAt;assert.equal(observed,new Date(start).toISOString());
 f.set(start+300000);assert.equal(store.recordFetchAttempt(day,{...claim,slot:new Date(f.clock()).toISOString(),at:new Date(f.clock()).toISOString()}),false);
 assert.equal(store.recordFetchAttempt(day,{kind:'manual',at:new Date(f.clock()).toISOString()}),true);store.finishFetch(day,{status:'waiting',error:'OFFICIAL_FETCH_FAILED'});
 assert.equal(store.fetchState(day).status,'success');assert.equal(store.fetchState(day).firstValidObservedAt,observed);assert.equal(store.fetchState(day).manualAttempts,1);
 assert.equal(validateMarketAutomationDatabase(f.db),true);
});
test('historical catchup claims are durable, spaced, bounded and exhausted remains manual-only',t=>{
 const f=fixture(t),store=f.make(),date='2026-10-07';
 for(let i=0;i<5;i++){f.set(start+i*300000);assert.equal(store.recordFetchAttempt(date,{kind:'history'}),true);assert.equal(store.recordFetchAttempt(date,{kind:'catchup'}),false);}
 f.set(start+1500000);assert.equal(store.recordFetchAttempt(date,{kind:'catchup'}),false);store.finishFetch(date,{status:'exhausted'});
 const reopened=f.reopen();assert.equal(reopened.recordFetchAttempt(date,{kind:'catchup'}),false);assert.equal(reopened.recordFetchAttempt(date,{kind:'manual'}),true);
});
test('fetch metadata validator rejects impossible success, slots, timestamps, keys and counts',t=>{
 const f=fixture(t),store=f.make(),key='fetch:'+day,valid={status:'waiting',scheduledSlots:[],automaticAttempts:0,manualAttempts:0};
 const save=value=>f.db.prepare('INSERT OR REPLACE INTO market_automation_state VALUES(?,?)').run(key,JSON.stringify(value));
 for(const change of [{status:'success'},{scheduledSlots:[new Date(start-300000).toISOString()],automaticAttempts:1},{scheduledSlots:[new Date(start).toISOString(),new Date(start).toISOString()],automaticAttempts:2},{automaticAttempts:-1},{manualAttempts:1.5},{lastAttemptAt:'tomorrow'},{firstValidObservedAt:new Date(start).toISOString()},{extra:true}]){save({...valid,...change});assert.throws(()=>validateMarketAutomationDatabase(f.db));}
 save(valid);assert.equal(validateMarketAutomationDatabase(f.db),true);
});
