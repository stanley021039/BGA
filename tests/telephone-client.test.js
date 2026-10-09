'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const {TelephoneRoom}=require('../src/games/telephone');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function fixture({room,storage=new Map(),guess=false}={}){
 const r=room||new TelephoneRoom('ABCDEF','client',()=>0);if(!room){r.add('reader');r.add('peer');r.add('peer2');r.start();if(guess){for(const p of r.players)r.act(p.id,'skip',{stepId:r.stepId,requestId:randomUUID()});r.act(r.host,'advance',{stepId:r.stepId,requestId:randomUUID()});}}
 const p=r.players[0],ids=new Map(),events={},timers=new Set(),requests=[],navigations=[];
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.disabled=false;this.textContent='';}
  set id(value){this._id=value;ids.set('#'+value,this);}get id(){return this._id;}
  append(...items){this.children.push(...items);}setAttribute(){}setPointerCapture(){}getContext(){return {};}
  replaceChildren(...items){for(const c of this.children)this.removeIds(c);this.children=items;}
  removeIds(c){if(c.id)ids.delete('#'+c.id);for(const child of c.children)this.removeIds(child);}
  querySelectorAll(selector){return this.children.flatMap(c=>[...(selector.split(',').includes(c.tag)?[c]:[]),...c.querySelectorAll(selector)]);}
 }
 for(const id of ['feedback','retry','controls','advance','leave','connection','game','roomTag','phase','players','readiness','previous','books','book','guide']){const e=new Element();e.id=id;}
 let pending=null,failAfterSubmit=false,leaveError=false;
 const context={document:{hidden:false,querySelector:s=>ids.get(s)||null,createElement:tag=>new Element(tag),addEventListener:(type,fn)=>events[type]=fn},location:{pathname:'/telephone/ABCDEF',replace:url=>navigations.push(url)},crypto:{randomUUID},AbortController,
  sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v),removeItem:key=>storage.delete(key)},confirm:()=>true,
  RoomApi:{request:async(route,payload,options)=>{requests.push({route,payload,options});if(pending){const result=await pending;pending=null;return result;}if(route==='leave'&&leaveError){const error=Error('denied');error.status=403;throw error;}if(route==='action'){r.act(p.id,payload.action,payload);if(failAfterSubmit){failAfterSubmit=false;throw Error('lost reply');}}return r.view(p.id);}},RoomReconnect:{restore:async()=>({}),forget(){}},
  StrokeCanvas:{pointFrom:e=>[e.clientX,e.clientY],drawStroke(){},createRenderer:()=>({render(){},reset(){}})},setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)};
 context.window={addEventListener:(type,fn)=>events[type]=fn};vm.runInNewContext(fs.readFileSync(require.resolve('../public/telephone.js'),'utf8'),context);
 return {r,p,ids,storage,events,timers,requests,navigations,async poll(){for(const fn of timers)await fn();await flush();},defer:promise=>pending=promise,failAfterSubmit:()=>failAfterSubmit=true,denyLeave:()=>leaveError=true};
}
test('guess draft survives peer polling and reload; failed leave does not navigate',async()=>{
 const f=fixture({guess:true});await flush();const input=f.ids.get('#guess');input.value='尚未送出的猜詞';input.oninput();await f.poll();assert.equal(f.ids.get('#guess'),input);const again=fixture({room:f.r,storage:f.storage});await flush();assert.equal(again.ids.get('#guess').value,'尚未送出的猜詞');again.denyLeave();await again.ids.get('#leave').onclick();assert.equal(again.navigations.length,0);
});
test('private drawing draft is stable through polls; uncertain submit retries the same receipt once',async()=>{
 const f=fixture();await flush();const canvas=f.ids.get('#drawing'),event={button:0,pointerId:1,clientX:10,clientY:10,preventDefault(){}};canvas.onpointerdown(event);canvas.onpointermove({...event,clientX:20,clientY:20});canvas.onpointerup(event);await f.poll();assert.equal(f.ids.get('#drawing'),canvas);assert.ok([...f.storage.values()][0].includes('[20,20]'));
 f.failAfterSubmit();await f.ids.get('#submit').onclick();await flush();assert.equal(Object.keys(f.r.submissions).length,1);await f.ids.get('#retry').onclick();await flush();const writes=f.requests.filter(r=>r.route==='action');assert.equal(writes.length,2);assert.equal(writes[0].payload.requestId,writes[1].payload.requestId);assert.equal(Object.keys(f.r.submissions).length,1);assert.equal(f.storage.size,0);
});
test('pagehide aborts old reads; late state cannot rebuild UI; BFCache resumes only one poller',async()=>{
 const f=fixture({guess:true});await flush();const input=f.ids.get('#guess');let resolve;f.defer(new Promise(done=>resolve=done));const poll=f.poll();await flush();f.events.pagehide();assert.equal(f.timers.size,0);assert.equal(f.requests.at(-1).options.signal.aborted,true);resolve({...f.r.view(f.p.id),phase:'finished',version:999,books:[]});await poll;assert.equal(f.ids.get('#guess'),input);f.events.pageshow({persisted:true});await flush();assert.equal(f.timers.size,1);assert.equal(f.ids.get('#guess'),input);
});
test('telephone history hydrates page deltas without duplicates and resets between runs',()=>{
 const source=fs.readFileSync(require.resolve('../public/history.js'),'utf8'),context={};vm.runInNewContext(source.slice(source.indexOf('function hydrateTelephoneFrames'),source.indexOf('function telephone(s)')),context);
 const header={ownerName:'A',pages:[{kind:'text',text:'起始情境'}]},page={kind:'drawing',strokes:[]};const frames=[{state:{runId:'one',bookHeaders:[header],pageCommits:[{bookIndex:0,round:1,page}]}},{state:{runId:'one',bookHeaders:[header],pageCommits:[{bookIndex:0,round:1,page}]}},{state:{runId:'two',bookHeaders:[header],pageCommits:[]}}];context.hydrateTelephoneFrames(frames);assert.equal(frames[0].state.books[0].pages.length,2);assert.equal(frames[1].state.books[0].pages.length,2);assert.equal(frames[2].state.books[0].pages.length,1);
});
