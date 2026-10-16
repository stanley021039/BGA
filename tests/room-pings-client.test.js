'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {dom}=require('./helpers/widget-dom.cjs'),model=require('../public/shared/ping-model');
function setup(){
 const {document}=dom('<header data-site-header></header><input id="typing"><canvas id="drawCanvas"></canvas>'),listeners=new Map(),requests=[],sources=[],frames=new Map();let frameId=0,time=10000;
 class Clock extends Date{static now(){return time;}}
 class Source{constructor(url){this.url=url;this.listeners={};sources.push(this);}addEventListener(k,f){this.listeners[k]=f;}close(){this.closed=true;}emit(k,data){this.listeners[k]?.({data:JSON.stringify(data)});}}
 const window={PingModel:model,GameUI:{decorateButton(b,icon,{label}){b.setAttribute('aria-label',label);},icon:()=>''},AudioSettings:{playEffect(){window.played=(window.played||0)+1;}},addEventListener(k,f){const list=listeners.get(k)||[];list.push(f);listeners.set(k,list);}};
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);n.style.setProperty=(k,v)=>{n.style[k]=v;};n.getBoundingClientRect=()=>({left:0,top:0,width:100,height:30});n.getClientRects=()=>[n.getBoundingClientRect()];return n;};
 const context=vm.createContext({window,document,innerWidth:1000,innerHeight:800,Date:Clock,crypto:require('node:crypto'),EventSource:Source,requestAnimationFrame:f=>{frames.set(++frameId,f);return frameId;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>1,clearTimeout(){},getComputedStyle:()=>({overflowX:'visible',overflowY:'visible'}),fetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);return {ok:true,json:async()=>({event:{...body,id:'event-'+requests.length,playerId:'a',name:'A',at:time,expiresAt:time+5000},serverNow:time})};}});
 vm.runInContext(fs.readFileSync('public/shared/room-pings.js','utf8'),context);
 const state={code:'ABCDEF',type:'draw',me:'a',players:[{id:'a',name:'A'}],serverNow:time,pingContext:{roomInstanceId:'instance',scene:'scene-1'}};window.RoomPings.update(state);
 const fire=(name,patch={})=>{const e={target:document.body,code:'KeyP',key:'p',button:0,pointerId:1,clientX:300,clientY:300,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...patch};for(const f of listeners.get(name)||[])f(e);return e;};
 return {window,document,requests,sources,frames,state,fire,tick(n){time+=n;},frame(){const batch=[...frames.values()];frames.clear();for(const f of batch)f();}};
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
test('lobby uses an isolated stream and sends to its own scope without moving an avatar',async()=>{
 const f=setup();f.window.RoomPings.update({...f.state,code:'__LOBBY__',type:'lobby',pingContext:{roomInstanceId:'lobby-instance',scene:'lobby-scene'}});
 assert.equal(f.sources[0].closed,true);f.fire('keydown');assert.equal(f.fire('pointerdown').stopped,true);f.fire('pointerup');await flush();
 assert.equal(f.requests[0].code,'__LOBBY__');assert.equal(f.requests[0].roomInstanceId,'lobby-instance');assert.equal(f.fire('click').stopped,true);
});
test('P click and each drag send exactly one kind, at the press point, and suppress underlying input',async()=>{
 for(const [dx,dy,type]of [[0,0,'ping'],[0,-50,'attention'],[-50,0,'question'],[0,50,'help'],[50,0,'look']]){
  const f=setup();f.fire('keydown');const down=f.fire('pointerdown');assert.equal(down.stopped,true);if(dx||dy)f.fire('pointermove',{clientX:300+dx,clientY:300+dy});f.fire('pointerup',{clientX:300+dx,clientY:300+dy});await flush();assert.equal(f.requests.length,1);assert.equal(f.requests[0].type,type);assert.equal(f.requests[0].target.x,.3);assert.equal(f.requests[0].target.y,.375);assert.equal(f.fire('click').stopped,true);
 }
});
test('center return, right click, Escape, pointer cancellation and blur send nothing',async()=>{
 for(const stop of ['center','right','escape','pointercancel','blur']){const f=setup();f.fire('keydown');f.fire('pointerdown');f.fire('pointermove',{clientX:360});if(stop==='center')f.fire('pointermove',{clientX:300});else if(stop==='right')f.fire('pointerdown',{button:2});else if(stop==='escape')assert.equal(f.fire('keydown',{key:'Escape'}).stopped,true);else f.fire(stop);f.fire('pointerup');await flush();assert.equal(f.requests.length,0,stop);}
});
test('typing, IME, modifiers and an already-held drawing pointer cannot start a ping',async()=>{
 for(const patch of [{target:null},{isComposing:true},{ctrlKey:true},{altKey:true},{metaKey:true}]){const f=setup();const key=f.fire('keydown',{...patch,target:patch.target===null?f.document.querySelector('#typing'):f.document.body});assert.notEqual(key.prevented,true);assert.notEqual(f.fire('pointerdown').stopped,true);f.fire('pointerup');assert.equal(f.requests.length,0);}
 const f=setup();f.fire('pointerdown');f.fire('keydown');assert.notEqual(f.fire('pointermove',{clientX:350}).stopped,true);f.fire('pointerup');await flush();assert.equal(f.requests.length,0);
});
test('P tap opens keyboard selection without a permanent trigger; canvas targets keep scene coordinates',async()=>{
 const f=setup();assert.equal(f.document.querySelector('.room-ping-tools'),null);f.fire('keydown');f.fire('keyup');f.fire('keydown',{key:'ArrowDown'});f.fire('keydown',{key:'Enter'});const canvas=f.document.querySelector('#drawCanvas');canvas.getBoundingClientRect=()=>({left:100,top:100,width:400,height:400});f.fire('pointerdown',{target:canvas,clientX:200,clientY:300});await flush();assert.equal(f.requests[0].type,'help');assert.equal(f.requests[0].target.kind,'surface');assert.equal(f.requests[0].target.epoch,'scene-1');assert.equal(f.requests[0].target.x,.25);assert.equal(f.requests[0].target.y,.5);
});
test('live events are deduplicated; hidden, expired, other-room events do not display or sound',()=>{
 const f=setup(),source=f.sources[0],event={id:'one',roomInstanceId:'instance',scene:'scene-1',type:'question',name:'<script>bad</script>',target:{kind:'viewport',x:.5,y:.5},at:10000,expiresAt:15000};f.window.RoomPings.setPreferences({question:{sound:{effect:'ping-question'}}});
 source.emit('ping',{event,serverNow:10000});source.emit('ping',{event,serverNow:10000});assert.equal(f.document.querySelectorAll('.room-ping-mark').length,1);assert.equal(f.window.played,1);f.frame();assert.match(f.document.querySelector('.room-ping-mark').textContent,/<script>bad<\/script>/);
 for(const patch of [{id:'expired',expiresAt:9999},{id:'wrong',roomInstanceId:'another'}])source.emit('ping',{event:{...event,...patch},serverNow:10000});f.document.hidden=true;source.emit('ping',{event:{...event,id:'hidden'},serverNow:10000});assert.equal(f.window.played,1);assert.equal(f.document.querySelectorAll('.room-ping-mark').length,1);
 f.window.RoomPings.stop();assert.equal(source.closed,true);assert.equal(f.document.querySelectorAll('.room-ping-mark').length,0);
});
test('default markers are silent; selected personal media can be cleared and failed images fall back',()=>{
 const f=setup(),source=f.sources[0];let id=0;const receive=type=>source.emit('ping',{event:{id:'custom-'+(++id),roomInstanceId:'instance',scene:'scene-1',type,name:'A',target:{kind:'viewport',x:.5,y:.5},at:10000,expiresAt:15000},serverNow:10000});
 for(const type of Object.keys(model.types))receive(type);assert.equal(f.window.played,undefined);assert.equal(f.document.querySelectorAll('.room-ping-mark').length,5);assert.equal(f.document.querySelectorAll('.room-ping-settings button').length,1);
 f.window.RoomPings.setPreferences({ping:{imageUrl:'/assets/artworks/12345678-1234-1234-1234-123456789abc',sound:{effect:'ping-ping'}}});receive('ping');assert.equal(f.window.played,1);
 const img=f.document.querySelector('.room-ping-mark img');assert.ok(img);img.onerror();assert.equal(f.document.querySelector('.room-ping-mark img'),null);
 f.window.RoomPings.setPreferences();receive('ping');assert.equal(f.window.played,1);assert.equal(f.document.querySelector('.room-ping-mark img'),null);
});
