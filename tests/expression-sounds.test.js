const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=file=>fs.readFileSync(path.join(__dirname,'../public/shared',file),'utf8');
const uuid='12345678-1234-4234-8234-123456789abc',url=`/assets/characters/sounds/${uuid}/happy?v=${'a'.repeat(64)}`;
function fixture({blocked=false,deferredPlay=false,clockSkew=0}={}){
 let now=100000+clockSkew,nextTimer=0;const timers=new Map(),clips=[],listeners=new Map(),storage=new Map();
 const target=name=>({addEventListener(type,fn){const key=name+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);},removeEventListener(type,fn){listeners.get(name+type)?.delete(fn);}});
 const document={...target('document:'),hidden:false},window=target('window:');
 class Audio{constructor(src){this.src=src;this.originalSrc=src;this.paused=true;this.volume=1;this.currentTime=0;this.plays=0;this.loads=0;clips.push(this);}play(){this.plays++;if(blocked)return Promise.reject(Error('blocked'));if(deferredPlay)return new Promise(resolve=>{this.resolvePlay=()=>{this.paused=false;resolve();};});this.paused=false;this.onplaying?.();return Promise.resolve();}pause(){this.paused=true;}removeAttribute(key){delete this[key];}load(){this.loads++;}}
 const context={window,document,Audio,URL,location:{origin:'https://example.test'},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},Date:{now:()=>now},setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source('audio-settings.js'),context);vm.runInNewContext(source('expression-sounds.js'),context);
 const fire=(key,event={})=>{for(const fn of [...(listeners.get(key)||[])])fn(event);};
 const event=(id,at=now)=>({id,at,sound:{url,durationMs:1000}});
 return {window,document,clips,timers,listeners,event,fire,audio:window.AudioSettings,controller:window.ExpressionSounds.create(),update(controller,events,contextId='draw:ABC123:me',serverNow){controller.update({contextId,events,serverNow});},tick(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now&&timers.delete(id))timer.fn();},hide(value){document.hidden=value;fire('document:visibilitychange');}};
}
for(const skew of [-60000,-6000,-2000,2000,6000,60000])test(`server-clock event freshness plays once with client clock bias ${skew}ms`,()=>{
 const f=fixture({clockSkew:skew}),c=f.controller;f.audio.set('effects',{enabled:true});
 f.update(c,[f.event('baseline',100000)],undefined,100000);assert.equal(f.clips.length,0);
 f.tick(10);const fresh=f.event('fresh',100005);f.update(c,[fresh],undefined,100010);
 assert.equal(f.clips.length,1,'a fresh server event plays after baseline on either side of the server clock');
 f.update(c,[fresh,fresh],undefined,100010);assert.equal(f.clips.length,1,'clock correction does not bypass event deduplication');
});
for(const [skew,kind,at] of [[-6000,'stale',94000],[6000,'future',106000]])test(`server-clock rejects a ${kind} event even when it matches the client clock`,()=>{
 const f=fixture({clockSkew:skew}),c=f.controller;f.audio.set('effects',{enabled:true});f.update(c,[],undefined,100000);
 f.update(c,[f.event(kind,at)],undefined,100000);assert.equal(f.clips.length,0);
 f.update(c,[f.event(kind,100000)],undefined,100000);assert.equal(f.clips.length,0,'rejected event IDs remain consumed when later metadata would look fresh');
});
test('missing or invalid server timestamps retain bounded local-clock compatibility without accepting future events',()=>{
 for(const serverNow of [undefined,null,NaN,Infinity,-Infinity,'100000',{}]){
  const f=fixture(),c=f.controller;f.audio.set('effects',{enabled:true});f.update(c,[],undefined,serverNow);
  f.update(c,[f.event('fresh'),f.event('future',101001),f.event('expired',94999)],undefined,serverNow);
  assert.equal(f.clips.length,1);f.update(c,[f.event('future'),f.event('expired')],undefined,100000);assert.equal(f.clips.length,1);
 }
});
test('server-time freshness does not allow caught-up sounds after a locally observed polling gap',()=>{
 const f=fixture(),c=f.controller;f.audio.set('effects',{enabled:true});f.update(c,[],undefined,100000);
 f.tick(5001);f.update(c,[f.event('catch-up',105001)],undefined,105001);assert.equal(f.clips.length,0);
 f.tick(10);f.update(c,[f.event('new',105011)],undefined,105011);assert.equal(f.clips.length,1);
});
test('an authoritative clock does not bypass mute, hidden, reconnect baseline or per-event consumption on skewed clients',()=>{
 for(const skew of [-2000,6000]){
  const f=fixture({clockSkew:skew}),c=f.controller,update=events=>f.update(c,events,undefined,100000);
  update([]);update([f.event('muted',100000)]);f.audio.set('effects',{enabled:true});update([f.event('muted',100000)]);assert.equal(f.clips.length,0);
  update([f.event('live',100000)]);assert.equal(f.clips.length,1);
  f.hide(true);update([f.event('hidden',100000)]);assert.equal(f.clips.length,1);assert.equal(f.clips[0].paused,true);
  f.hide(false);update([f.event('return-baseline',100000)]);assert.equal(f.clips.length,1);update([f.event('return-baseline',100000),f.event('fresh',100000)]);assert.equal(f.clips.length,2);
  c.reset();update([f.event('reconnect',100000)]);assert.equal(f.clips.length,2);update([f.event('reconnect',100000),f.event('after-reconnect',100000)]);assert.equal(f.clips.length,3);
 }
});
test('first snapshot, same-version presence updates and duplicate social sources play each new event once',()=>{
 const f=fixture(),c=f.controller;f.audio.set('effects',{enabled:true});
 f.update(c,[f.event('old')]);assert.equal(f.clips.length,0);
 f.update(c,[f.event('old'),f.event('new'),f.event('new')]);assert.equal(f.clips.length,1);
 f.update(c,[f.event('new')]);assert.equal(f.clips.length,1);
 f.update(c,[f.event('next')]);assert.equal(f.clips.length,2);
});
test('muted and zero-volume event IDs are consumed and never replay after opt-in',()=>{
 const f=fixture(),c=f.controller;f.update(c,[]);f.update(c,[f.event(1)]);f.audio.set('effects',{enabled:true});f.update(c,[f.event(1)]);assert.equal(f.clips.length,0);
 f.update(c,[f.event(2)]);assert.equal(f.clips.length,1);f.audio.set('effects',{volume:0});assert.equal(f.clips[0].paused,true);
 f.update(c,[f.event(3)]);f.audio.set('effects',{volume:.5});f.update(c,[f.event(3)]);assert.equal(f.clips.length,1);
 f.update(c,[f.event(4)]);assert.equal(f.clips.length,2);
});
test('gap, reset, room or seat change and visibility return discard catch-up sounds',()=>{
 const f=fixture(),c=f.controller;f.audio.set('effects',{enabled:true});f.update(c,[]);f.update(c,[f.event(1)]);
 f.tick(5001);f.update(c,[f.event(2)]);assert.equal(f.clips.length,1);f.update(c,[f.event(3)]);assert.equal(f.clips.length,2);
 c.reset();assert.equal(f.clips.at(-1).paused,true);f.update(c,[f.event(4)]);assert.equal(f.clips.length,2);f.update(c,[f.event(5)]);assert.equal(f.clips.length,3);
 f.update(c,[f.event(6)],'draw:OTHER:me');assert.equal(f.clips.at(-1).paused,true);assert.equal(f.clips.length,3);f.update(c,[f.event(7)],'draw:OTHER:me');assert.equal(f.clips.length,4);
 f.hide(true);f.update(c,[f.event(8)],'draw:OTHER:me');f.hide(false);f.update(c,[f.event(9)],'draw:OTHER:me');assert.equal(f.clips.length,4);f.update(c,[f.event(10)],'draw:OTHER:me');assert.equal(f.clips.length,5);
 f.update(c,[f.event(11)],'draw:OTHER:new-seat');assert.equal(f.clips.length,5);
});
test('expired or future events are consumed; remembered events stay bounded and destruction releases listeners',()=>{
 const f=fixture(),c=f.controller;f.audio.set('effects',{enabled:true});f.update(c,[]);
 f.update(c,[f.event('old',1),f.event('future',999999)]);assert.equal(f.clips.length,0);
 f.update(c,[f.event('old'),f.event('future')]);assert.equal(f.clips.length,0);
 for(let start=0;start<600;start+=10){f.update(c,Array.from({length:10},(_,n)=>f.event(start+n)));f.tick(1000);}
 const before=f.clips.length;f.update(c,[f.event(599),f.event(344)]);assert.equal(f.clips.length,before);f.update(c,[f.event(343)]);assert.equal(f.clips.length,before+1);
 c.destroy();assert.equal(f.timers.size,0);assert.equal(f.listeners.get('document:visibilitychange').size,1);assert.equal(f.listeners.get('window:pagehide').size,1);f.update(c,[f.event('after')]);assert.equal(f.clips.length,before+1);
});
test('reset stops only the controller clips while common UI sounds and other controllers keep playing',()=>{
 const f=fixture(),other=f.window.ExpressionSounds.create();f.audio.set('effects',{enabled:true});f.update(f.controller,[]);f.update(other,[],'lobby:me');
 const ui=f.audio.playEffect('confirm');f.update(f.controller,[f.event(1)]);const expression=f.clips.at(-1);f.update(other,[f.event(2)],'lobby:me');const second=f.clips.at(-1);
 f.controller.reset();assert.equal(expression.paused,true);assert.equal(ui.paused,false);assert.equal(second.paused,false);f.audio.stopEffects();assert.equal(f.timers.size,0);
});
test('all effects share a four-clip cap, release on finish and enforce duration deadlines',()=>{
 const f=fixture();f.audio.set('effects',{enabled:true,volume:.3});const ui=f.audio.playEffect('confirm');
 for(let i=0;i<3;i++)assert.ok(f.audio.playExpression({url,durationMs:10000}));assert.equal(f.timers.size,4);assert.equal(f.audio.playExpression({url,durationMs:10000}),undefined);assert.equal(f.audio.playEffect('reveal'),undefined);
 const done=f.clips[1];done.onended();assert.equal(done.paused,true);assert.equal(done.src,undefined);assert.equal(f.timers.size,3);
 const short=f.audio.playExpression({url,durationMs:250});f.audio.set('effects',{volume:.6});assert.equal(short.volume,.6);assert.equal(ui.volume,.6);
 f.tick(249);assert.equal(short.paused,false);f.tick(1);assert.equal(short.paused,true);assert.equal(f.timers.size,3);f.tick(9750);assert.equal(f.timers.size,0);assert.ok(f.clips.every(clip=>clip.paused));
});
test('only canonical same-origin character sound URLs and bounded integer durations are accepted',()=>{
 const f=fixture();f.audio.set('effects',{enabled:true});
 for(const invalid of ['https://evil.test'+url,'//evil.test'+url,'blob:https://example.test/file','data:audio/wav;base64,AAAA','/assets/gift-sounds/a.wav',url+'#play',url+'&x=1',url.replace('happy','neutral'),url.replace(uuid,'not-a-uuid'),url.replace('a'.repeat(64),'x'.repeat(64))])assert.equal(f.audio.playExpression({url:invalid,durationMs:1000}),undefined,invalid);
 for(const durationMs of [0,-1,10001,1.5,'1000',NaN])assert.equal(f.audio.playExpression({url,durationMs}),undefined);
 assert.equal(f.clips.length,0);assert.ok(f.audio.playExpression({url:url.split('?')[0],durationMs:1}));assert.ok(f.audio.playExpression({url:'https://example.test'+url,durationMs:10000}));
});
test('rejected play and media errors free the shared pool and timers once, and images can continue',async()=>{
 const f=fixture({blocked:true});f.audio.set('effects',{enabled:true});let errors=0;
 const clip=f.audio.playExpression({url,durationMs:1000},{onError:()=>errors++});const mediaFailure=clip.onerror;mediaFailure();await Promise.resolve();await Promise.resolve();assert.equal(errors,1);assert.equal(f.timers.size,0);assert.equal(clip.paused,true);
 for(let n=0;n<5;n++){assert.ok(f.audio.playExpression({url,durationMs:1000}));await new Promise(resolve=>setImmediate(resolve));}assert.equal(f.timers.size,0);
});
test('sound deadline starts after delayed playback; pending loads have their own bounded deadline',async()=>{
 const f=fixture({deferredPlay:true});f.audio.set('effects',{enabled:true});const clip=f.audio.playExpression({url,durationMs:1000});f.tick(2000);assert.equal(clip.src,url);assert.equal(f.timers.size,1);
 clip.resolvePlay();await new Promise(resolve=>setImmediate(resolve));assert.equal(clip.paused,false);f.tick(999);assert.equal(clip.paused,false);f.tick(1);assert.equal(clip.paused,true);assert.equal(f.timers.size,0);
 const pending=f.audio.playExpression({url,durationMs:1000});f.tick(10000);assert.equal(pending.src,undefined);assert.equal(f.timers.size,0);pending.resolvePlay();await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.paused,true);assert.equal(f.timers.size,0);
});
test('late playback resolution after mute, hidden or controller reset cannot restart audio or timers',async()=>{
 for(const cancel of [f=>f.audio.set('effects',{enabled:false}),f=>f.hide(true),f=>f.controller.reset()]){
  const f=fixture({deferredPlay:true});f.audio.set('effects',{enabled:true});f.update(f.controller,[]);f.update(f.controller,[f.event(1)]);const clip=f.clips[0];cancel(f);assert.equal(f.timers.size,0);
  clip.resolvePlay();await new Promise(resolve=>setImmediate(resolve));assert.equal(clip.paused,true);assert.equal(f.timers.size,0);
 }
});
test('controller retains every pending clip until playback cleanup, including multiple loading events',async()=>{
 const f=fixture({deferredPlay:true});f.audio.set('effects',{enabled:true});f.update(f.controller,[]);f.update(f.controller,[f.event(1)]);f.update(f.controller,[f.event(1),f.event(2)]);assert.equal(f.timers.size,2);
 f.controller.reset();assert.equal(f.timers.size,0);for(const clip of f.clips)clip.resolvePlay();await new Promise(resolve=>setImmediate(resolve));assert.ok(f.clips.every(clip=>clip.paused));assert.equal(f.timers.size,0);
});
