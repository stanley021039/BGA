'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const {TrpgRoom}=require('../src/games/trpg');
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function fixture(){
 const ids=new Map(),events={},timers=new Set(),requests=[],r=new TrpgRoom('ABCDEF','client',()=>5),p=r.add('reader');r.start();
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.classList={toggle(){}};}
  set id(value){this._id=value;ids.set('#'+value,this);}get id(){return this._id;}
  append(...items){this.children.push(...items);}replaceChildren(...items){for(const c of this.children)this.removeIds(c);this.children=items;}
  removeIds(c){if(c.id)ids.delete('#'+c.id);for(const child of c.children)this.removeIds(child);}
  querySelectorAll(selector){return this.children.flatMap(c=>[...(selector.split(',').includes(c.tag)?[c]:[]),...c.querySelectorAll(selector)]);}
  addEventListener(type,fn){(this.handlers[type]||=[]).push(fn);}
  input(value){this.value=value;for(const fn of this.handlers.input||[])fn({target:this});}
 }
 for(const id of ['feedback','retry','controls','leave','connection','game','roomTag','copyInvite','phase','sceneLabel','sceneTitle','sceneText','resources','players','readiness','turnHint','journal','latest','guide']){const e=new Element();e.id=id;}
 const document={hidden:false,querySelector:s=>ids.get(s)||null,querySelectorAll:()=>[],createElement:tag=>new Element(tag),addEventListener:(type,fn)=>events[type]=fn};
 let pending=null;
 const RoomApi={request:async(route,payload,options)=>{requests.push({route,payload,options});if(pending){const result=await pending;pending=null;return result;}if(route==='action')r.act(p.id,payload.action,payload);return r.view(p.id);}};
 const context={document,location:{pathname:'/trpg/ABCDEF',origin:'http://fixture',replace(){}},crypto:{randomUUID},AbortController,RoomApi,RoomReconnect:{restore:async()=>({}),forget(){}},navigator:{clipboard:{writeText:async()=>{}}},confirm:()=>true,setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)};
 context.window={addEventListener:(type,fn)=>events[type]=fn};vm.runInNewContext(fs.readFileSync(require.resolve('../public/trpg.js'),'utf8'),context);
 return {ids,r,p,requests,events,timers,async poll(){for(const fn of timers)await fn();await flush();},defer(promise){pending=promise;}};
}
test('TRPG drafts survive polling; edited submitted choices cannot resolve until saved',async()=>{
 const f=fixture();await flush();const note=f.ids.get('#note');note.input('尚未提交的角色行動');await f.poll();assert.equal(f.ids.get('#note'),note);assert.equal(note.value,'尚未提交的角色行動');
 await f.ids.get('#controls').querySelectorAll('button')[0].onclick();await flush();assert.equal(f.ids.get('#resolve').disabled,false);
 f.ids.get('#approach').input('connect');assert.equal(f.ids.get('#resolve').disabled,true);await f.poll();assert.equal(f.ids.get('#resolve').disabled,true);
 await f.ids.get('#controls').querySelectorAll('button')[0].onclick();await flush();assert.equal(f.r.plans[f.p.id].approach,'connect');assert.equal(f.ids.get('#resolve').disabled,false);
});
test('pagehide cancels the lifetime and late state cannot rebuild UI; BFCache resumes one poller',async()=>{
 const f=fixture();await flush();let resolve;f.defer(new Promise(done=>resolve=done));const note=f.ids.get('#note');const poll=f.poll();await flush();f.events.pagehide();assert.equal(f.timers.size,0);assert.equal(f.requests.at(-1).options.signal.aborted,true);
 resolve({...f.r.view(f.p.id),phase:'finished',version:999,winner:{title:'late',text:'late'}});await poll;assert.equal(f.ids.get('#note'),note);
 f.events.pageshow({persisted:true});await flush();assert.equal(f.timers.size,1);
});
