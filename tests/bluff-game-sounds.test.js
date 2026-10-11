'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
async function fixture({enabled=true,volume=.4,blocked=false,roleSeconds=10,remaining=roleSeconds}={}){
 let now=1000000,id=0,offline=false;const nodes=new Map(),handlers=new Map(),intervals=new Map(),timeouts=new Map(),clips=[],store=new Map();
 const target=name=>({addEventListener(type,fn){const key=name+type;if(!handlers.has(key))handlers.set(key,new Set());handlers.get(key).add(fn);},removeEventListener(type,fn){handlers.get(name+type)?.delete(fn);}});
 const node=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,dataset:{},children:[],textContent:'',append(...v){this.children.push(...v);},replaceChildren(...v){this.children=v;},querySelectorAll(){return [];},remove(){this.removed=true;}});return nodes.get(key);};
 const document={...target('document:'),hidden:false,querySelector:node,createElement:tag=>node('created:'+tag+':'+nodes.size),createTextNode:text=>({textContent:text})};
 const window={...target('window:'),document,MotionPolicy:{allowsMotion:()=>false}};
 class Audio{constructor(src){this.originalSrc=src;this.startedAt=now;this.remaining=Number(node('#roleCountdownSeconds').textContent);this.paused=true;clips.push(this);}play(){if(blocked)return Promise.reject(Error('blocked'));this.paused=false;this.onplaying?.();return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}}
 const state=(extra={})=>({type:'bluff',code:'ABC123',version:1,phase:'preparing',round:1,roundLimit:3,roundId:'round-1',me:'A',host:'A',thinkerId:'B',players:['A','B','C'].map(id=>({id,name:id,score:3})),options:{levels:[1,2,3],roleSeconds},readyIds:[],spokenIds:[],challenges:[],botStatements:{},results:[],myRole:'bluffer',prompt:{title:'測試題',level:1,hints:['動物']},serverNow:now,deadline:now+remaining*1000,...extra});
 let next=state();store.set('ah-audio-settings',JSON.stringify({effects:{enabled,volume}}));
 const context=vm.createContext({window,document,Audio,URL,AbortController,crypto:require('node:crypto').webcrypto,Date:{now:()=>now},performance:{now:()=>now},location:{pathname:'/bluff/ABC123',origin:'http://example.test',replace(){}},localStorage:{getItem:key=>store.get(key)??null,setItem:(key,v)=>store.set(key,v)},setTimeout(fn,ms){const key=++id;timeouts.set(key,{fn,at:now+ms});return key;},clearTimeout:key=>timeouts.delete(key),setInterval(fn,ms){const key=++id;intervals.set(key,{fn,ms});return key;},clearInterval:key=>intervals.delete(key),confirm:()=>true,GameUI:{decorateButton(){}},RoomReconnect:{restore:async()=>null,forget(){}},RoomApi:{request:async()=>{if(offline)throw Error('offline');return structuredClone({...next,serverNow:now});}}});
 for(const file of ['shared/audio-settings.js','shared/game-sounds.js','bluff.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),context);
 await flush();
 const fire=(key,event={})=>{for(const fn of [...(handlers.get(key)||[])])fn(event);};
 const countdown=()=>{for(const t of intervals.values())if(t.ms===250)t.fn();};
 const poll=async()=>{for(const t of intervals.values())if(t.ms===1500)t.fn();await flush();};
 return {clips,node,window,state,fire,countdown,poll,async feed(extra){next=state({...next,...extra});await poll();},async advance(ms,{polling=true}={}){now+=ms;for(const [key,t]of [...timeouts])if(t.at<=now&&timeouts.delete(key))t.fn();if(polling)await poll();countdown();await flush();},hide(value){document.hidden=value;fire('document:visibilitychange');},offline(value){offline=value;}};
}
test('last five seconds sound exactly once per second despite polling and 250ms ticks; expiry stays silent',async()=>{
 const f=await fixture();await f.poll();
 await f.advance(4000);assert.equal(f.clips.length,0);
 for(let second=5;second>=1;second--){
  await f.advance(1000);assert.equal(Number(f.node('#roleCountdownSeconds').textContent),second);
  assert.equal(f.clips.length,6-second);for(let i=0;i<4;i++)f.countdown();await f.poll();assert.equal(f.clips.length,6-second);
 }
 assert.ok(f.clips.every(c=>c.originalSrc==='/assets/game-sounds/turn.wav'&&c.volume===.4));
 await f.advance(1000);assert.equal(f.clips.length,5);assert.ok(f.clips.every(c=>c.paused));
 assert.equal(Number(f.node('#roleCountdownSeconds').textContent),0);
});
test('initial loading at five seconds establishes a silent baseline; next second can sound',async()=>{
 const f=await fixture({remaining:5});await f.poll();f.countdown();assert.equal(f.clips.length,0);
 await f.advance(1000);assert.equal(f.clips.length,1);
});
test('muting or zero volume consumes ticks, enabling does not replay them, and motion-off still sounds',async()=>{
 for(const options of [{enabled:false},{volume:0}]){
  const f=await fixture(options);await f.poll();await f.advance(5000);assert.equal(f.clips.length,0);
  f.window.AudioSettings.set('effects',{enabled:true,volume:.3});await f.poll();f.countdown();assert.equal(f.clips.length,0);
  await f.advance(1000);assert.equal(f.clips.length,1);assert.equal(f.clips[0].volume,.3);
  f.window.AudioSettings.set('effects',{enabled:false});assert.equal(f.clips[0].paused,true);
 }
});
test('early ready, interruption and next-round changes stop clips and use fresh round keys',async()=>{
 for(const extra of [{phase:'discussion',deadline:null},{phase:'finished',interrupted:true}]){
  const f=await fixture();await f.poll();await f.advance(5000);assert.equal(f.clips.at(-1).paused,false);
  await f.feed(extra);assert.equal(f.clips.at(-1).paused,true);f.countdown();assert.equal(f.clips.length,1);
  await f.feed({...f.state(),roundId:'round-2',round:2,interrupted:false});await f.advance(5000);assert.equal(f.clips.length,2);
 }
});
test('background, lost connection and stale snapshots do not replay missed countdown sounds',async()=>{
 const f=await fixture();await f.poll();await f.advance(5000);f.hide(true);assert.equal(f.clips[0].paused,true);
 await f.advance(1000);f.hide(false);await f.poll();assert.equal(f.clips.length,1);
 await f.advance(1000);assert.equal(f.clips.length,2);
 f.offline(true);await f.poll();assert.equal(f.clips.at(-1).paused,true);
 await f.advance(1000);assert.equal(f.clips.length,2);
 f.offline(false);await f.poll();assert.equal(f.clips.length,2);
 await f.advance(1000);assert.equal(f.clips.length,3);
 const stale=await fixture();await stale.poll();await stale.advance(6000,{polling:false});assert.equal(stale.clips.length,0);
});
test('page navigation stops sound and BFCache restoration keeps current tick silent; autoplay rejection does not block timer',async()=>{
 const f=await fixture();await f.poll();await f.advance(5000);
 f.fire('window:pagehide',{persisted:true});assert.equal(f.clips[0].paused,true);
 f.fire('window:pageshow',{persisted:true});await flush();await f.poll();assert.equal(f.clips.length,1);
 await f.advance(1000);assert.equal(f.clips.length,2);
 const blocked=await fixture({blocked:true});await blocked.poll();await blocked.advance(5000);
 assert.equal(Number(blocked.node('#roleCountdownSeconds').textContent),5);assert.equal(blocked.clips[0].paused,true);
 assert.equal(blocked.node('#connection').textContent,'');
});

for(const seconds of [10,30,60]){
 test(seconds+'s full countdown: player requests only at 5,4,3,2,1; no overlap, duplicate or expiry cue',async()=>{
  const f=await fixture({roleSeconds:seconds});
  for(let i=1;i<=seconds*4+6;i++)await f.advance(250,{polling:i%6===0});
  assert.deepEqual(f.clips.map(c=>c.remaining),[5,4,3,2,1]);
  assert.deepEqual(f.clips.map(c=>c.startedAt),[5,4,3,2,1].map(n=>1000000+(seconds-n)*1000));
  assert.ok(f.clips.every(c=>c.paused));assert.equal(Number(f.node('#roleCountdownSeconds').textContent),0);
  await f.feed({phase:'discussion',deadline:null});const base=f.clips.length;
  await f.feed({phase:'preparing',roundId:'round-next',round:2,deadline:1000000+(seconds*2+1.5)*1000});
  for(let i=1;i<=seconds*4+6;i++)await f.advance(250,{polling:i%6===0});
  assert.deepEqual(f.clips.slice(base).map(c=>c.remaining),[5,4,3,2,1]);
 });
 test(seconds+'s countdown: muted/zero-volume stays silent, early ready cancels subsequent ticks',async()=>{
  for(const settings of [{enabled:false},{volume:0}]){
   const f=await fixture({roleSeconds:seconds,...settings});
   for(let i=1;i<=seconds*4+6;i++)await f.advance(250,{polling:i%6===0});
   assert.equal(f.clips.length,0);
  }
  const f=await fixture({roleSeconds:seconds});
  for(let i=1;i<=(seconds-5)*4;i++)await f.advance(250,{polling:i%6===0});
  assert.equal(f.clips.length,1);assert.equal(f.clips[0].remaining,5);
  await f.feed({phase:'discussion',deadline:null});assert.equal(f.clips[0].paused,true);
  for(let i=1;i<=24;i++)await f.advance(250,{polling:i%6===0});
  assert.equal(f.clips.length,1);
 });
}
