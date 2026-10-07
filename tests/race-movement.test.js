const {test}=require('node:test'),assert=require('node:assert/strict');
const {mount,STEP_MS}=require('../public/shared/race-movement');
function fixture(){
 let time=0,enabled=true;const animations=[],listeners=new Map(),pref=[];
 const document={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 const policy={allowsMotion:()=>enabled&&!document.hidden,subscribe(fn){pref.push(fn);fn();return()=>{};},animate(node,frames,options){const a={node,frames,options,currentTime:0,cancelled:false,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};animations.push(a);return a;}};
 const controller=mount({document,policy,now:()=>time});
 const state=(y=8)=>({code:'AAAAAA',phase:'move',cars:[{id:'car',x:2,y,dead:false}]}),event=(id=1,from=0,end=8)=>({id,kind:'movePath',car:'car',from:{x:2,y:from},to:{x:2,y:end},steps:Array.from({length:end-from},(_,i)=>({x:2,y:from+i+1})),target:{x:2,y:20}});
 const board=()=>({querySelectorAll:()=>[{dataset:{car:'car'},querySelector:()=>({name:'new body'})}]});
 return {controller,animations,state,event,board,document,listeners,time(value){time=value;},enabled(value){enabled=value;pref.forEach(fn=>fn());}};
}
test('a long multi-cell move visits every cell at a fixed duration without a total 900ms cap',()=>{
 const f=fixture();f.controller.prepare(f.state(),[f.event()],[],{live:true});f.controller.attach(f.board(),0);
 const a=f.animations[0];assert.equal(a.options.duration,8*STEP_MS);assert.ok(a.options.duration>900);assert.equal(a.frames.length,9);
 assert.deepEqual(a.frames.map(frame=>frame.transform),Array.from({length:9},(_,i)=>'translate('+((i-8)*44)+'px,0px)'));
 assert.deepEqual(a.frames.map(frame=>frame.offset),Array.from({length:9},(_,i)=>i/8));assert.ok(a.frames.every(frame=>frame.easing==='ease-in-out'));
});
test('presence redraw restores elapsed time rather than cancelling movement or restarting from the first cell',()=>{
 const f=fixture();f.controller.prepare(f.state(),[f.event()],[],{live:true});f.controller.attach(f.board(),0);const original=f.animations[0];
 f.time(550);f.controller.prepare(f.state(),[],[],{live:true});f.controller.attach(f.board(),0);
 assert.equal(original.cancelled,true);assert.equal(f.animations.length,2);assert.equal(f.animations[1].currentTime,550);assert.equal(f.animations[1].options.duration,8*STEP_MS);
 f.time(8*STEP_MS+1);f.controller.prepare(f.state(),[],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations.length,2);
});
test('a second action continues the existing path in order without moving the displayed car to the first action endpoint',()=>{
 const f=fixture();f.controller.prepare(f.state(3),[f.event(1,0,3)],[],{live:true});f.controller.attach(f.board(),0);
 f.time(120);f.controller.prepare(f.state(6),[f.event(2,3,6)],[],{live:true});f.controller.attach(f.board(),0);
 const a=f.animations.at(-1);assert.equal(a.currentTime,120);assert.equal(a.options.duration,6*STEP_MS);assert.equal(a.frames.length,7);assert.equal(a.frames[0].transform,'translate(-264px,0px)');
});
test('an interrupted route ends at the confirmed cell and a garage entry slides through the first cell',()=>{
 const f=fixture();f.controller.prepare(f.state(2),[f.event(1,0,2)],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations[0].frames.length,3);assert.equal(f.animations[0].options.duration,2*STEP_MS);
 f.controller.reset();const event=f.event(2,0,4);event.from={x:null,y:null};f.controller.prepare(f.state(4),[event],[],{live:true});f.controller.attach(f.board(),0);
 assert.equal(f.animations.at(-1).frames.length,5);assert.equal(f.animations.at(-1).options.duration,4*STEP_MS);
});
test('hydration, duplicate events, hidden pages and disabled motion never replay old routes',()=>{
 const f=fixture();f.controller.prepare(f.state(),[f.event()],[],{live:false});f.controller.attach(f.board(),0);assert.equal(f.animations.length,0);
 f.controller.prepare(f.state(),[f.event()],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations.length,0);
 f.controller.prepare(f.state(),[f.event(2)],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations.length,1);
 f.document.hidden=true;f.listeners.get('visibilitychange')();assert.equal(f.animations[0].cancelled,true);f.document.hidden=false;
 f.controller.prepare(f.state(),[f.event(2)],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations.length,1);
 f.controller.prepare(f.state(),[f.event(3)],[],{live:true});f.controller.attach(f.board(),0);f.enabled(false);assert.equal(f.animations.at(-1).cancelled,true);
 f.enabled(true);f.controller.prepare(f.state(),[],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations.length,2);
});
test('room changes and conflicting authoritative car positions discard obsolete paths',()=>{
 const f=fixture();f.controller.prepare(f.state(),[f.event()],[],{live:true});f.controller.attach(f.board(),0);
 f.time(200);f.controller.prepare(f.state(9),[],[],{live:true});f.controller.attach(f.board(),0);assert.equal(f.animations.length,1);assert.equal(f.animations[0].cancelled,true);
 f.controller.prepare(f.state(),[f.event(2)],[],{live:true});f.controller.attach(f.board(),0);f.controller.prepare({...f.state(),code:'BBBBBB'},[],[],{live:false});assert.equal(f.animations[1].cancelled,true);
});
