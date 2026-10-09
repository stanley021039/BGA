'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../public/shared/race-controller');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const drain=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function target(){const listeners=new Map();return {hidden:false,listeners,addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},dispatch(type){listeners.get(type)?.();}};}
function fixture({lesson=false,restore}={}){
 const document=target(),window=target(),intervals=new Map(),requests=[],renders=[],presences=[],statuses=[],suspensions=[];
 let id=0,session={code:'AAAAAA'},state=null,busy=false,disconnected=false;
 const controller=create({getSession:()=>session,getState:()=>state,isBusy:()=>busy,isDisconnected:()=>disconnected,isLesson:()=>lesson,
  isStaleSnapshot:(next,previous)=>next.serverNow<previous.serverNow,
  request(route,data,options){const result=deferred();requests.push({route,data,options,...result});return result.promise;},
  render(s){renders.push(s);state=s;},updatePresence(s){presences.push(s);state=s;},
  onConnected(){statuses.push(disconnected?'reconnected':'connected');disconnected=false;},onDisconnected(error){statuses.push(error.message);disconnected=true;},onClosed(owner){statuses.push('closed:'+owner.code);session=null;},
  onSuspend:reason=>suspensions.push(reason),restore,onRestored:value=>{session=value;},tick:()=>statuses.push('tick'),document,window,
  setInterval(fn,ms){intervals.set(++id,{fn,ms});return id;},clearInterval:key=>intervals.delete(key),AbortController});
 return {controller,document,window,intervals,requests,renders,presences,statuses,suspensions,setSession:value=>{session=value;},setBusy:value=>{busy=value;},get state(){return state;}};
}
const snapshot=(version=1,extra={})=>({code:'AAAAAA',version,serverNow:10,players:[{online:true}],...extra});

test('single live startup owns exactly two timers; pending polls and busy input never duplicate requests',async()=>{
 const f=fixture();f.controller.beginLive();f.controller.beginLive();assert.equal(f.intervals.size,2);assert.deepEqual([...f.intervals.values()].map(t=>t.ms),[700,250]);assert.equal(f.requests.length,1);
 await f.controller.refresh();assert.equal(f.requests.length,1);f.requests[0].resolve(snapshot());await drain();assert.equal(f.renders.length,1);
 f.setBusy(true);await f.controller.refresh();assert.equal(f.requests.length,1);f.setBusy(false);const poll=f.controller.refresh();assert.equal(f.requests.length,2);f.requests[1].resolve(snapshot());await poll;assert.equal(f.presences.length,1);
 f.controller.dispose();assert.equal(f.intervals.size,0);
});
test('freshness, presence and same-version expression updates select the original render path',()=>{
 const f=fixture();f.controller.receive(snapshot());f.controller.receive(snapshot(0));f.controller.receive(snapshot(1,{serverNow:9}));f.controller.receive(snapshot(2,{code:'BBBBBB'}));assert.equal(f.renders.length,1);
 f.controller.receive(snapshot(1,{serverNow:11,expression:'new'}));assert.equal(f.presences.length,1);assert.equal(f.state.expression,'new');
 f.controller.receive(snapshot(1,{serverNow:12,players:[{online:false}]}));f.controller.receive(snapshot(2,{serverNow:13}));assert.equal(f.renders.length,3);
});
test('failed poll hydrates once on reconnect and terminal errors use the captured session',async()=>{
 const f=fixture();f.controller.receive(snapshot());let poll=f.controller.refresh();f.requests[0].reject(Error('offline'));await poll;
 poll=f.controller.refresh();f.requests[1].resolve(snapshot());await poll;assert.equal(f.renders.length,2);assert.deepEqual(f.statuses,['offline','reconnected']);
 poll=f.controller.refresh();f.requests[2].reject(Error('找不到房間'));await poll;assert.deepEqual(f.statuses.slice(-2),['找不到房間','closed:AAAAAA']);await f.controller.refresh();assert.equal(f.requests.length,3);
});
test('hide aborts requests and late success/failure; visible return resumes one owner without an old finally clearing it',async()=>{
 const f=fixture();f.controller.beginLive();const old=f.requests[0],receiver=f.controller.receiver();
 f.document.hidden=true;f.document.dispatch('visibilitychange');assert.equal(old.options.signal.aborted,true);assert.equal(f.intervals.size,0);
 receiver(snapshot(8));f.controller.receive(snapshot(7));assert.equal(f.renders.length,0);
 f.document.hidden=false;f.document.dispatch('visibilitychange');f.document.dispatch('visibilitychange');assert.equal(f.intervals.size,2);assert.equal(f.requests.length,2);
 old.reject(Error('找不到房間'));await drain();await f.controller.refresh();assert.equal(f.requests.length,2);assert.deepEqual(f.statuses,[]);
 f.requests[1].resolve(snapshot(3));await drain();assert.equal(f.state.version,3);assert.equal(f.renders.length,1);
 receiver(snapshot(9));assert.equal(f.state.version,3);f.controller.dispose();
});
test('pagehide / pageshow and dispose prevent detached callbacks from changing a reentered session',async()=>{
 const f=fixture();f.controller.beginLive();const old=f.requests[0];f.window.dispatch('pagehide');assert.equal(old.options.signal.aborted,true);f.window.dispatch('pageshow');assert.equal(f.requests.length,2);
 old.resolve(snapshot(8));await drain();assert.equal(f.renders.length,0);f.requests[1].resolve(snapshot(2));await drain();
 const receiver=f.controller.receiver();f.setSession({code:'BBBBBB'});receiver(snapshot(9));assert.equal(f.state.version,2);
 f.controller.dispose();f.controller.dispose();assert.equal(f.intervals.size,0);assert.equal(f.window.listeners.size,0);assert.equal(f.document.listeners.size,0);f.controller.beginLive();assert.equal(f.requests.length,2);
});
test('lesson never polls or starts timers; reset cancels pending action and old ACK without retries',async()=>{
 const f=fixture({lesson:true});f.controller.beginLive();await f.controller.refresh();assert.equal(f.intervals.size,0);assert.equal(f.requests.length,0);
 const receiver=f.controller.receiver(),action=f.controller.request('action',{action:'rollDice'});f.controller.cancel();assert.equal(f.requests[0].options.signal.aborted,true);f.requests[0].resolve(snapshot(7));await assert.rejects(action,{name:'AbortError'});receiver(snapshot(8));assert.equal(f.renders.length,0);assert.equal(f.requests.length,1);
 const next=f.controller.request('action',{action:'move'});f.requests[1].resolve(snapshot(1));assert.equal((await next).version,1);assert.equal(f.requests.length,2);
});
test('recovery owns cancellation and restarts only on a visible return, without a duplicate restore',async()=>{
 const restores=[];const f=fixture({restore(options){const result=deferred();restores.push({...result,options});return result.promise;}});f.setSession(null);f.controller.beginLive();f.controller.beginLive();assert.equal(restores.length,1);assert.equal(f.intervals.size,0);
 f.window.dispatch('pagehide');assert.equal(restores[0].options.signal.aborted,true);f.window.dispatch('pageshow');assert.equal(restores.length,2);
 restores[0].resolve({code:'OLDOLD'});await drain();assert.equal(f.requests.length,0);restores[1].resolve({code:'AAAAAA'});await drain();assert.equal(f.requests.length,1);assert.equal(f.intervals.size,2);f.requests[0].resolve(snapshot());await drain();f.controller.dispose();
});
