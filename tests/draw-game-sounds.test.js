const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {drawingState}=require('./helpers/draw-browser.cjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
const drawSource=read('draw.js'),soundSource=read('shared/game-sounds.js'),motionSource=read('shared/motion-policy.js');
const epoch=number=>`00000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
function fixture({motion=true,reduced=false,enabled=true}={}){
 let now=1000000,timerId=0,actionState=null,pollState=null,pollFailure=false;const nodes=new Map(),listeners=new Map(),timers=new Map(),sources=[],played=[],clips=[],requests=[],media={matches:reduced,addEventListener(){}};
 const eventTarget=name=>({addEventListener(type,fn){const key=name+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);},removeEventListener(type,fn){listeners.get(name+type)?.delete(fn);}});
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:false,open:false,value:selector==='#size'?'5':selector==='#color'?'#273942':'',dataset:{},style:{},children:[],scrollHeight:0,scrollTop:0,scrollLeft:0,clientHeight:0,innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},querySelector(){return null;},querySelectorAll(){return [];},animate(){return {cancel(){}};},showModal(){this.open=true;},focus(){},remove(){}});return nodes.get(selector);};
 const document={...eventTarget('document:'),hidden:false,visibilityState:'visible',body:node('body'),documentElement:node('html'),querySelector:node,querySelectorAll:()=>[],createElement:tag=>node('created:'+tag+':'+nodes.size)};
 const window={...eventTarget('window:'),document,matchMedia:()=>media,AudioSettings:{playEffect(cue,{onStop}={}){if(!enabled||document.hidden)return;played.push(cue);const clip={cue,paused:false,onStop};clips.push(clip);return clip;},stopEffect(clip){if(!clip||clip.paused)return;clip.paused=true;clip.onStop?.(clip);}}};
 class Clock extends Date{static now(){return now;}}
 class EventSource{constructor(){this.handlers=new Map();sources.push(this);}addEventListener(type,fn){this.handlers.set(type,fn);}close(){}emit(type,data={}){this.handlers.get(type)?.({data:JSON.stringify(data)});}}
 window.EventSource=EventSource;
 const context=vm.createContext({window,document,EventSource,Date:Clock,URLSearchParams,location:{pathname:'/draw/ABC123',origin:'https://example.test',search:''},history:{replaceState(){}},localStorage:{getItem:()=>null,setItem(){}},navigator:{clipboard:{writeText:async()=>{}}},fetch:async()=>({json:async()=>({})}),setInterval(){},clearInterval(){},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),RoomHost:{update(){},kicked(){}},RoomReconnect:{restore:async()=>null},GameShell:{playerRow:(player,{status=''})=>`<div class="player" data-player-id="${player.id}">${status}</div>`,stableMarkup(node,html){node.innerHTML=html;},settingsActions:()=>''},StrokeCanvas:{createRenderer:()=>({reset(){},render(){return true;}}),redraw(){},strokeId:()=>epoch(90),pointFrom:event=>event.point},RoomApi:{async request(route,data,options){requests.push({route,data,options});if(route==='draw/canvas')return vm.runInContext('({canvasEpoch:state.canvasEpoch,round:state.round,version:state.strokeVersion,strokes:[]})',context);if(route==='action')return structuredClone(actionState);if(route==='state'){if(pollFailure)throw Error('offline');return structuredClone(pollState);}throw Error('unexpected route '+route);}}});
 vm.runInContext(motionSource,context);window.MotionPolicy.set({enabled:motion});vm.runInContext(soundSource,context);vm.runInContext(drawSource,context);
 const fire=(key,event={})=>{for(const fn of [...(listeners.get(key)||[])])fn(event);};
 const state=(overrides={})=>({...drawingState(overrides.me||'guest'),serverNow:now,deadline:now+90000,canvasEpoch:epoch(1),...overrides});
 const correct=(id='guest',at=now)=>({id,name:id,correct:true,points:100,at});
 const receive=next=>{context.injectedState=structuredClone(next);vm.runInContext('session={code:"ABC123"};receive(injectedState)',context);};
 return {context,window,document,played,clips,sources,requests,state,correct,receive,fire,node,run:source=>vm.runInContext(source,context),tick(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now&&timers.delete(id))timer.fn();},hide(value){document.hidden=value;document.visibilityState=value?'hidden':'visible';fire('document:visibilitychange');},setEnabled(value){enabled=value;},setAction(next){actionState=next;},setPoll(next,{fail=false}={}){pollState=next;pollFailure=fail;}};
}
test('own confirmed correct guess plays once for state and ACK; other players and wrong guesses stay silent',async()=>{
 const f=fixture();f.receive(f.state());f.receive(f.state({version:3,guesses:[f.correct('other')],guessedIds:['other']}));assert.deepEqual(f.played,[]);
 f.receive(f.state({version:4,guesses:[{id:'guest',correct:false,answer:'wrong',at:1000000},f.correct('other')],guessedIds:['other']}));assert.deepEqual(f.played,[]);
 const success=f.state({version:5,guesses:[f.correct('other'),f.correct()],guessedIds:['other','guest']});f.setAction(success);await f.run('action("guess",{answer:"a private answer"})');assert.deepEqual(f.played,['correct']);
 f.receive(success);f.receive({...success,version:6,players:success.players.map(player=>({...player,online:false}))});assert.deepEqual(f.played,['correct']);
 assert.equal(success.question,null,'guesser state keeps the answer hidden');
});
test('first load with correct history or own choosing is silent; new canvas choosing cues only the active artist once',()=>{
 const hydrated=fixture();hydrated.receive(hydrated.state({guesses:[hydrated.correct()],guessedIds:['guest']}));hydrated.receive(hydrated.state({version:3,guesses:[hydrated.correct()],guessedIds:['guest']}));assert.deepEqual(hydrated.played,[]);
 const f=fixture();f.receive(f.state({me:'artist',phase:'choosing',candidates:[{id:'secret',title:'secret',category:'secret'}]}));assert.deepEqual(f.played,[]);
 f.receive(f.state({me:'artist',phase:'choosing',version:3}));assert.deepEqual(f.played,[]);
 const next=f.state({me:'artist',phase:'choosing',version:4,round:2,canvasEpoch:epoch(2),candidates:[{id:'a',title:'never affects cue'}]});f.receive(next);f.receive({...next,version:5});f.receive({...next,version:6,phase:'drawing'});assert.deepEqual(f.played,['turn']);
 f.receive({...next,version:7,canvasEpoch:epoch(3),presenterId:'guest'});assert.deepEqual(f.played,['turn']);
 f.receive({...next,version:8,canvasEpoch:epoch(4),players:next.players.map(player=>({...player,waitingForNextRound:player.id==='artist'}))});assert.deepEqual(f.played,['turn']);
});
test('correct sounds require same canvas, a new own correct record and a nonfuture server timestamp within five seconds',()=>{
 for(const offset of [-1,5001]){const f=fixture();f.receive(f.state());f.receive(f.state({version:3,guesses:[f.correct('guest',1000000-offset)],guessedIds:['guest']}));assert.deepEqual(f.played,[]);}
 for(const extra of [{canvasEpoch:epoch(2)},{guessedIds:[]},{participantIds:[]},{guesses:[{id:'guest',correct:true,points:100}]},{serverNow:NaN}]){const f=fixture();f.receive(f.state());f.receive(f.state({version:3,guesses:[f.correct()],guessedIds:['guest'],...extra}));assert.deepEqual(f.played,[]);}
 const boundary=fixture();boundary.receive(boundary.state());boundary.receive(boundary.state({version:3,guesses:[boundary.correct('guest',995000)],guessedIds:['guest'],phase:'reveal'}));assert.deepEqual(boundary.played,['correct']);
 const alreadyGuessed=fixture();alreadyGuessed.receive(alreadyGuessed.state({guessedIds:['guest']}));alreadyGuessed.receive(alreadyGuessed.state({version:3,guesses:[alreadyGuessed.correct()],guessedIds:['guest']}));assert.deepEqual(alreadyGuessed.played,[]);
});
test('a later canvas can cue another own success while an older delayed snapshot cannot replay a former round',()=>{
 const f=fixture();f.receive(f.state());const first=f.state({version:3,guesses:[f.correct()],guessedIds:['guest']});f.receive(first);
 const second=f.state({version:4,round:2,canvasEpoch:epoch(2)});f.receive(second);f.receive({...second,version:5,guesses:[f.correct()],guessedIds:['guest']});assert.deepEqual(f.played,['correct','correct']);
 f.receive({...first,version:3,guesses:[f.correct()],guessedIds:['guest']});assert.deepEqual(f.played,['correct','correct']);assert.equal(f.run('state.canvasEpoch'),epoch(2));
});
test('SSE and poll reconnects suppress caught-up correct guesses and new artist rounds',async()=>{
 const f=fixture();f.receive(f.state());f.sources[0].emit('error');f.sources[0].emit('ready',{canvasEpoch:epoch(1),round:1,version:0});f.receive(f.state({version:3,guesses:[f.correct()],guessedIds:['guest']}));f.receive(f.state({version:4,guesses:[f.correct()],guessedIds:['guest']}));assert.deepEqual(f.played,[]);
 const fresh=f.state({version:5,canvasEpoch:epoch(2),round:2});f.receive(fresh);f.receive({...fresh,version:6,guesses:[f.correct()],guessedIds:['guest']});assert.deepEqual(f.played,['correct']);
 const polling=fixture();polling.receive(polling.state({me:'artist'}));polling.setPoll(null,{fail:true});await polling.run('poll()');assert.equal(polling.run('disconnected'),true);
 const choosing=polling.state({me:'artist',version:3,phase:'choosing',canvasEpoch:epoch(2),round:2});polling.setPoll(choosing);await polling.run('poll()');polling.receive({...choosing,version:4});assert.deepEqual(polling.played,[]);
 polling.receive({...choosing,version:5,canvasEpoch:epoch(3),round:3});assert.deepEqual(polling.played,['turn']);
});
test('hidden, long-gap and BFCache snapshots remain silent; fresh later rounds still play',()=>{
 for(const interrupt of [f=>{f.hide(true);f.hide(false);},f=>f.tick(5001),f=>{f.fire('window:pagehide',{persisted:true});f.fire('window:pageshow',{persisted:true});}]){
  const f=fixture();f.receive(f.state());interrupt(f);f.receive(f.state({version:3,guesses:[f.correct()],guessedIds:['guest']}));assert.deepEqual(f.played,[]);
  const next=f.state({version:4,canvasEpoch:epoch(2),round:2});f.receive(next);f.receive({...next,version:5,guesses:[f.correct()],guessedIds:['guest']});assert.deepEqual(f.played,['correct']);
 }
 const hidden=fixture();hidden.receive(hidden.state());hidden.hide(true);hidden.receive(hidden.state({version:3,guesses:[hidden.correct()],guessedIds:['guest']}));assert.deepEqual(hidden.played,[]);
});
test('motion disabled and OS reduced motion preserve cues; effects mute consumes events without later replay',()=>{
 for(const settings of [{motion:false},{reduced:true}]){const f=fixture(settings);f.receive(f.state());f.receive(f.state({version:3,guesses:[f.correct()],guessedIds:['guest']}));assert.deepEqual(f.played,['correct']);}
 const f=fixture({enabled:false});f.receive(f.state());const success=f.state({version:3,guesses:[f.correct()],guessedIds:['guest']});f.receive(success);f.setEnabled(true);f.receive({...success,version:4});assert.deepEqual(f.played,[]);
 const next=f.state({version:5,round:2,canvasEpoch:epoch(2)});f.receive(next);f.receive({...next,version:6,guesses:[f.correct()],guessedIds:['guest']});assert.deepEqual(f.played,['correct']);
});
test('disconnect, hidden and final navigation stop active game clips and destroy future playback',async()=>{
 const f=fixture();f.receive(f.state());f.receive(f.state({version:3,guesses:[f.correct()],guessedIds:['guest']}));const first=f.clips[0];f.sources[0].emit('error');assert.equal(first.paused,true);
 const second=f.state({version:4,canvasEpoch:epoch(2),round:2});f.sources[0].emit('ready');f.receive(second);f.receive({...second,version:5});f.receive({...second,version:6,guesses:[f.correct()],guessedIds:['guest']});const clip=f.clips.at(-1);assert.equal(clip.paused,false);
 f.hide(true);assert.equal(clip.paused,true);f.hide(false);f.fire('window:pagehide',{persisted:false});f.receive(f.state({me:'artist',phase:'choosing',version:10,canvasEpoch:epoch(10)}));assert.equal(f.played.length,2);
});
test('a kicked connection resets sound state and cannot replay its latest correct guess',()=>{
 const f=fixture();f.receive(f.state());const success=f.state({version:3,guesses:[f.correct()],guessedIds:['guest']});f.receive(success);assert.equal(f.clips[0].paused,false);
 f.requests.find(request=>request.route==='draw/canvas').options.onKicked();assert.equal(f.clips[0].paused,true);assert.equal(f.run('session'),null);f.receive({...success,version:4});assert.deepEqual(f.played,['correct']);
});
