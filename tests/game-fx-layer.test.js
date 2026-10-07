const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/game-fx-layer.js'),'utf8');
function fixture({unavailable=false,linkFailure=false,onActivity=null}={}){
 let time=0,enabled=true,reduced=false,nextFrame=1,nextObject=1;const frames=new Map(),notices=[],activities=[],calls=[],listeners=new Map(),subscriptions=new Set(),observers=[];
 const listen=(map,type,fn)=>{if(!map.has(type))map.set(type,new Set());map.get(type).add(fn);};
 const remove=(map,type,fn)=>map.get(type)?.delete(fn);
 const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,ARRAY_BUFFER:4,DYNAMIC_DRAW:5,FLOAT:6,ALIASED_POINT_SIZE_RANGE:7,DEPTH_TEST:8,BLEND:9,ONE:10,ONE_MINUS_SRC_ALPHA:11,COLOR_BUFFER_BIT:12,POINTS:13};
 for(const name of ['createProgram','createShader','createBuffer'])gl[name]=()=>({id:nextObject++});
 for(const name of ['shaderSource','compileShader','attachShader','bindAttribLocation','linkProgram','deleteShader','deleteProgram','deleteBuffer','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','disable','enable','blendFunc','viewport','clearColor','clear','bufferSubData','uniform2f','uniform1f','drawArrays'])gl[name]=(...args)=>{calls.push({name,args});};
 gl.getProgramParameter=()=>!linkFailure;gl.getAttribLocation=()=>1;gl.getUniformLocation=(p,name)=>name;gl.getParameter=()=>[1,64];gl.getExtension=()=>({loseContext(){calls.push({name:'loseContext',args:[]});}});
 const host={isConnected:true,children:[],appendChild(node){this.children.push(node);node.parentNode=this;},getBoundingClientRect:()=>({left:10,top:20,width:820,height:398})};
 function canvas(){const map=new Map();return {isConnected:true,width:0,height:0,style:{},attrs:{},listeners:map,classList:{add(){}},setAttribute(k,v){this.attrs[k]=v;},getBoundingClientRect:()=>host.getBoundingClientRect(),getContext(...args){calls.push({name:'getContext',args});return unavailable?null:gl;},addEventListener:(type,fn)=>listen(map,type,fn),removeEventListener:(type,fn)=>remove(map,type,fn),remove(){this.isConnected=false;host.children=host.children.filter(node=>node!==this);}};}
 const doc={hidden:false,createElement:canvas,addEventListener:(type,fn)=>listen(listeners,type,fn),removeEventListener:(type,fn)=>remove(listeners,type,fn)};
 const mediaListeners=new Map(),media={get matches(){return reduced;},addEventListener:(type,fn)=>listen(mediaListeners,type,fn),removeEventListener:(type,fn)=>remove(mediaListeners,type,fn)};
 const policy={allowsMotion:()=>enabled&&!reduced&&!doc.hidden,subscribe(fn){subscriptions.add(fn);fn();return()=>subscriptions.delete(fn);}};
 const rootListeners=new Map(),root={document:doc,devicePixelRatio:3,MotionPolicy:policy,performance:{now:()=>time},requestAnimationFrame(fn){const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>media,addEventListener:(type,fn)=>listen(rootListeners,type,fn),removeEventListener:(type,fn)=>remove(rootListeners,type,fn),ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}};
 vm.runInNewContext(source,{window:root});
 const layer=root.GameFxLayer.create(host,{onAvailability:value=>notices.push(value),onActivity(value){activities.push({active:value.active,kinds:[...value.kinds],drawCalls:calls.filter(call=>call.name==='drawArrays').length});onActivity?.(value);}});
 const dispatch=(map,type,event={})=>{for(const fn of map.get(type)||[])fn(event);};
 return {layer,root,host,doc,gl,frames,calls,notices,activities,subscriptions,listeners,mediaListeners,rootListeners,observers,canvas:host.children[0],tick(ms=16){time+=ms;const entries=[...frames];frames.clear();for(const [,fn]of entries)fn(time);},enable(value){enabled=value;for(const fn of subscriptions)fn();},reduce(value){reduced=value;dispatch(mediaListeners,'change');},hide(value){doc.hidden=value;dispatch(listeners,'visibilitychange');},event(type,event){dispatch(host.children[0]?.listeners||new Map(),type,event);},pagehide(){dispatch(rootListeners,'pagehide');},setBox(w,h){host.getBoundingClientRect=()=>({width:w,height:h});}};
}
const anchor={x:300,y:180};
test('dice and particle renderers reserve the same two context slots',()=>{
 const f=fixture(),budget=f.root.GameFxLayer,dice=f.doc.createElement('canvas'),other=f.doc.createElement('canvas');
 assert.equal(budget.acquireContext(null),false);assert.equal(budget.acquireContext(dice),true);assert.equal(budget.acquireContext(dice),true);
 assert.equal(f.layer.play('one','nitro',anchor),true);assert.equal(budget.acquireContext(other),false);
 budget.releaseContext(dice);assert.equal(budget.acquireContext(other),true);budget.releaseContext(other);budget.releaseContext(other);f.layer.destroy();
});
test('lazy one-host ownership preserves overlay semantics and allocates only on confirmed play',()=>{
 const f=fixture();assert.equal(f.calls.some(c=>c.name==='getContext'),false);assert.equal(f.frames.size,0);assert.equal(f.canvas.style.pointerEvents,'none');assert.equal(f.canvas.attrs['aria-hidden'],'true');assert.equal(f.host.children.length,1);assert.equal(f.root.GameFxLayer.create(f.host),f.layer);
 assert.equal(f.layer.play('confirmed:1','sparks',anchor),true);assert.equal(f.layer.getState().renderer,'webgl');assert.equal(f.calls.filter(c=>c.name==='getContext').length,1);assert.equal(f.frames.size,1);f.layer.destroy();
});
test('event dedupe and particle/frame budgets remain bounded across a burst',()=>{
 const f=fixture();assert.equal(f.layer.play(1,'nitro',anchor),true);assert.equal(f.layer.play(1,'nitro',anchor),false);
 for(let id=2;id<20;id++)f.layer.play(id,'sparks',anchor,{count:500,durationMs:10000});
 assert.ok(f.layer.getState().queuedParticles<=192);assert.ok(f.layer.getState().effects<=6);assert.equal(f.frames.size,1);f.tick(200);
 const draws=f.calls.filter(c=>c.name==='drawArrays');assert.equal(draws.length,1);assert.ok(draws[0].args[2]<=192);assert.ok(f.layer.getState().particles>0);
 f.tick(1900);assert.equal(f.layer.getState().effects,0);assert.equal(f.frames.size,0);assert.equal(f.layer.getState().particles,0);f.layer.destroy();
});
test('moving anchors are re-read only in active frames and expired/invalid anchors stop cleanly',()=>{
 const f=fixture();let x=50,reads=0,valid=true;f.layer.play('move','nitro',()=>{reads++;return valid?{x,y:80}:null;});f.tick(100);
 const first=f.calls.filter(c=>c.name==='bufferSubData').at(-1).args[2][0];x+=100;f.tick(0);const second=f.calls.filter(c=>c.name==='bufferSubData').at(-1).args[2][0];assert.ok(Math.abs(second-first-100)<0.0001,'Float32 positions follow the 100px anchor delta');assert.equal(reads,3);
 valid=false;f.tick();assert.equal(f.frames.size,0);assert.equal(f.layer.getState().effects,0);f.layer.destroy();
});
test('hidden, disabled, reduced motion and pagehide cancel without replaying old IDs',()=>{
 const f=fixture();f.layer.play('a','smoke',anchor);f.hide(true);assert.equal(f.frames.size,0);assert.equal(f.layer.play('hidden','sparks',anchor),false);f.hide(false);assert.equal(f.layer.play('hidden','sparks',anchor),false);
 f.layer.play('b','nitro',anchor);f.enable(false);assert.equal(f.frames.size,0);f.layer.play('disabled','nitro',anchor);f.enable(true);assert.equal(f.layer.play('disabled','nitro',anchor),false);
 f.layer.play('c','sparks',anchor);f.reduce(true);assert.equal(f.frames.size,0);f.reduce(false);assert.equal(f.frames.size,0);f.layer.play('d','sparks',anchor);f.pagehide();assert.equal(f.frames.size,0);f.layer.destroy();
});
test('clear retains dedupe while explicit room/lesson reset permits a new baseline',()=>{
 const f=fixture();f.layer.play('same','sparks',anchor);f.layer.clear();assert.equal(f.layer.play('same','sparks',anchor),false);f.layer.clear({resetSeen:true});assert.equal(f.layer.play('same','sparks',anchor),true);f.layer.destroy();
});
test('context loss exposes fallback, stops old effects, and restored GPU accepts only new events',()=>{
 const f=fixture();f.layer.play('old','nitro',anchor);let prevented=false;f.event('webglcontextlost',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.frames.size,0);assert.equal(f.layer.getState().reason,'context-lost');assert.equal(f.layer.getState().available,false);assert.equal(f.layer.play('during-loss','sparks',anchor),false);
 f.event('webglcontextrestored');assert.equal(f.layer.getState().available,true);assert.equal(f.frames.size,0);assert.equal(f.layer.play('old','nitro',anchor),false);assert.equal(f.layer.play('during-loss','sparks',anchor),false);assert.equal(f.layer.play('new','nitro',anchor),true);f.layer.destroy();
});
test('unavailable context and shader failure remain harmless and release partial resources',()=>{
 for(const opts of [{unavailable:true},{linkFailure:true}]){const f=fixture(opts);assert.equal(f.layer.play(1,'sparks',anchor),false);assert.equal(f.layer.getState().available,false);assert.equal(f.frames.size,0);assert.equal(f.layer.play(2,'sparks',anchor),false);assert.equal(f.calls.filter(c=>c.name==='getContext').length,1);if(opts.linkFailure){assert.equal(f.calls.filter(c=>c.name==='deleteShader').length,2);assert.equal(f.calls.filter(c=>c.name==='deleteProgram').length,1);}f.layer.destroy();}
});
test('resolution caps survive huge dimensions, and resize performs no network or permanent ticker',()=>{
 const f=fixture();f.setBox(4000,2000);f.layer.play(1,'smoke',anchor);assert.ok(f.canvas.width*f.canvas.height<=1500000);assert.ok(f.layer.getState().dpr<=1.5);f.layer.clear();f.setBox(800,400);f.layer.resize();assert.equal(f.canvas.width,1200);assert.equal(f.canvas.height,600);assert.equal(f.frames.size,0);f.layer.destroy();
});
test('expired timing, invalid IDs/kinds and broken anchors never allocate or schedule effects',()=>{
 const f=fixture();for(const [id,kind,at,settings]of [[null,'nitro',anchor,{}],['x','invalid',anchor,{}],['expired','nitro',anchor,{elapsedMs:2000}],['nan','nitro',{x:NaN,y:1},{}],['throws','sparks',()=>{throw Error('stale node');},{}]])assert.equal(f.layer.play(id,kind,at,settings),false);
 assert.equal(f.frames.size,0);assert.equal(f.calls.some(c=>c.name==='getContext'),false);f.layer.destroy();
});
test('destroy releases buffers/context/listeners and disconnected host cancels active work',()=>{
 const f=fixture();f.layer.play(1,'sparks',anchor);f.host.isConnected=false;f.tick();assert.equal(f.frames.size,0);f.layer.destroy();f.layer.destroy();assert.equal(f.host.children.length,0);assert.equal(f.subscriptions.size,0);for(const map of [f.listeners,f.mediaListeners,f.rootListeners,f.canvas.listeners])for(const values of map.values())assert.equal(values.size,0);assert.equal(f.observers[0].disconnected,true);assert.equal(f.calls.filter(c=>c.name==='deleteBuffer').length,1);assert.equal(f.calls.filter(c=>c.name==='loseContext').length,1);assert.equal(f.layer.play('dead','sparks',anchor),false);
});
test('a page cannot grow unbounded GPU contexts and released slots are reusable',()=>{
 const f=fixture(),make=()=>{const canvas=f.doc.createElement('canvas');f.host.appendChild(canvas);return f.root.GameFxLayer.create(canvas);};
 const second=make(),third=make();f.layer.play('one','nitro',anchor);second.play('two','nitro',anchor);assert.equal(third.play('three','nitro',anchor),false);assert.equal(third.getState().reason,'context-budget');second.destroy();assert.equal(third.play('fresh','nitro',anchor),true);third.destroy();f.layer.destroy();
});
test('renderer exceptions release partial GPU state and keep the fallback contract without a game exception',()=>{
 const f=fixture();f.layer.play('first','sparks',anchor);f.gl.drawArrays=()=>{throw Error('GPU failure');};assert.doesNotThrow(()=>f.tick(200));assert.equal(f.layer.getState().reason,'render-failed');assert.equal(f.layer.getState().available,false);assert.equal(f.frames.size,0);assert.equal(f.layer.play('second','smoke',anchor),false);assert.equal(f.calls.filter(c=>c.name==='deleteBuffer').length,1);f.layer.destroy();
});
test('hidden hydration does not allocate a context and dedupe storage cannot grow without limit',()=>{
 const f=fixture();f.hide(true);for(let id=0;id<1000;id++)f.layer.play(id,'nitro',anchor);assert.equal(f.layer.getState().seen,256);assert.equal(f.frames.size,0);assert.equal(f.calls.some(c=>c.name==='getContext'),false);f.hide(false);assert.equal(f.layer.play(999,'nitro',anchor),false);assert.equal(f.layer.play(1000,'nitro',anchor),true);f.layer.destroy();
});
test('activity describes successful particle draws, never readiness, queues or the empty first frame',()=>{
 const f=fixture();f.layer.play('pending','nitro',anchor);assert.equal(f.layer.getState().available,true);assert.equal(f.activities.length,0);f.tick(0);assert.equal(f.layer.getState().particles,0);assert.equal(f.activities.length,0);
 f.tick(200);assert.deepEqual(f.activities.map(value=>({active:value.active,kinds:value.kinds})),[{active:true,kinds:['nitro']}]);assert.equal(f.activities[0].drawCalls,1,'activity follows the successful draw');f.tick(10);assert.equal(f.activities.length,1,'same visible kind does not notify per frame');
 f.layer.play('smoke','smoke',anchor);f.tick(200);assert.deepEqual(f.activities.at(-1).kinds,['nitro','smoke']);assert.deepEqual([...f.layer.getState().activeKinds],['nitro','smoke']);f.tick(2000);assert.deepEqual(f.activities.at(-1).kinds,[]);assert.equal(f.activities.at(-1).active,false);assert.equal(f.frames.size,0);f.layer.destroy();
});
test('activity resets immediately for lifecycle cancellation, context loss, resize and a failed draw',()=>{
 for(const cancel of [f=>f.layer.clear(),f=>f.hide(true),f=>f.enable(false),f=>f.reduce(true),f=>f.pagehide(),f=>f.event('webglcontextlost',{preventDefault(){}}),f=>f.layer.destroy(),f=>{f.setBox(600,400);f.layer.resize();},f=>{f.gl.drawArrays=()=>{throw Error('lost device');};f.tick(10);}]){
  const f=fixture();f.layer.play('live','sparks',anchor);f.tick(200);assert.equal(f.activities.at(-1).active,true);cancel(f);assert.equal(f.activities.at(-1).active,false);assert.deepEqual([...f.layer.getState().activeKinds],[]);f.layer.destroy();
 }
});
test('activity observers cannot corrupt the active kinds, crash the game or add a rendering loop',()=>{
 const f=fixture({onActivity(value){value.kinds.push('malicious');throw Error('observer bug');}});f.layer.play('safe','sparks',anchor);assert.doesNotThrow(()=>f.tick(200));assert.deepEqual([...f.layer.getState().activeKinds],['sparks']);const exposed=f.layer.getState().activeKinds;exposed.length=0;assert.deepEqual([...f.layer.getState().activeKinds],['sparks']);assert.equal(f.frames.size,1);assert.doesNotThrow(()=>f.layer.clear());assert.equal(f.frames.size,0);assert.deepEqual([...f.layer.getState().activeKinds],[]);f.layer.destroy();
});
test('an observer that queues an effect cannot create a second frame or revive a destroyed layer',()=>{
 let f;f=fixture({onActivity(value){f.layer.play(value.active?'observer-play':'observer-empty','nitro',anchor);}});f.layer.play('source','sparks',anchor);f.tick(200);assert.equal(f.frames.size,1,'observer and renderer share the one pending frame');f.layer.destroy();assert.equal(f.frames.size,0);assert.equal(f.layer.getState().effects,0);assert.equal(f.layer.getState().destroyed,true);
});
