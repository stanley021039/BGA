'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const drain=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

function reconnectFixture(fetch){
 const document={querySelector:()=>({textContent:''})},writes=[],redirects=[],timers=new Map();let id=0;
 const window={},scope={window,document,fetch,localStorage:{setItem:(...args)=>writes.push(args),removeItem:(...args)=>writes.push(args)},location:{replace:url=>redirects.push(url)},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/shared/room-reconnect.js'),'utf8'),scope);
 return {api:window.RoomReconnect,writes,redirects,timers};
}
test('optional reconnect cancellation blocks late redirects, saved sessions and retry timers',async()=>{
 for(const response of [{ok:true,result:{type:'thunder'}},{ok:false,status:401,result:{}},{ok:false,status:404,result:{code:'ROOM_NOT_FOUND'}}]){
  const result=deferred(),f=reconnectFixture(()=>result.promise),abort=new AbortController();const restore=f.api.restore('AAAAAA','thunder','#connection',{signal:abort.signal});abort.abort();result.resolve({...response,json:async()=>response.result});await assert.rejects(restore,{name:'AbortError'});assert.deepEqual(f.writes,[]);assert.deepEqual(f.redirects,[]);assert.equal(f.timers.size,0);
 }
 const f=reconnectFixture(async()=>{throw Error('offline');}),abort=new AbortController();const restore=f.api.restore('AAAAAA','thunder','#connection',{signal:abort.signal});await drain();assert.equal(f.timers.size,1);abort.abort();await assert.rejects(restore,{name:'AbortError'});assert.equal(f.timers.size,0);
});
test('reconnect callers without signal retain one fetch and both cache writes on success',async()=>{
 let calls=0;const result={type:'draw',code:'AAAAAA'},f=reconnectFixture(async()=>{calls++;return {ok:true,json:async()=>result};});assert.equal(await f.api.restore('AAAAAA','draw','#connection'),result);assert.equal(calls,1);assert.deepEqual(f.writes.map(([key])=>key),['ah-draw','ah-draw:AAAAAA']);assert.deepEqual(f.redirects,[]);
});
