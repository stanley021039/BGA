const {test}=require('node:test'),assert=require('node:assert/strict');
const {mount,STEP_MS,PAN_MS,EVENT_MS,ROAD_EVENT_MS}=require('../public/shared/race-movement');

function fixture(){
 let clock=0,enabled=true,timerId=0;const animations=[],settlements=[],cues=[],moves=[],timers=new Map(),listeners=new Map(),subscriptions=new Set();
 const document={hidden:false,addEventListener(type,callback){listeners.set(type,callback);},removeEventListener(type){listeners.delete(type);}};
 const policy={allowsMotion:()=>enabled&&!document.hidden,subscribe(callback){subscriptions.add(callback);callback();return()=>subscriptions.delete(callback);},animate(node,frames,options){
  if(!node||!policy.allowsMotion())return null;
  const animation={node,frames,options,currentTime:0,cancelled:false,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};animations.push(animation);return animation;
 }};
 const setTimeout=(callback,delay)=>{const id=++timerId;timers.set(id,{callback,at:clock+delay});return id;},clearTimeout=id=>timers.delete(id);
 const advanceTo=value=>{assert.ok(value>=clock,'test clock cannot move backwards');for(;;){const next=[...timers].filter(([,timer])=>timer.at<=value).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].callback();}clock=value;};
 const controller=mount({document,policy,now:()=>clock,setTimeout,clearTimeout,onSettled:result=>settlements.push(result),onCue:cue=>cues.push({...cue,at:clock}),onMove:group=>moves.push({...group,at:clock})});
 const body=(type,id)=>({type,id}),board=(cars=[],players=[])=>{
  const world=body('world','road'),carNodes=cars.map(id=>({dataset:{car:id},querySelector:()=>body('car',id)})),airNodes=players.map(id=>({dataset:{player:id},querySelector:()=>body('player',id)}));
  return {querySelectorAll:selector=>selector==='.map-car'?carNodes:selector==='.map-chopper'?airNodes:[],querySelector:selector=>selector==='.race-world'?world:null};
 };
 return {controller,animations,settlements,cues,moves,timers,document,board,time:advanceTo,enabled(value){enabled=value;for(const callback of subscriptions)callback();},hidden(value){document.hidden=value;for(const callback of subscriptions)callback();listeners.get('visibilitychange')?.();}};
}
const cell=(x,y)=>({x,y}),car=(id,x,y,extra={})=>({id,x,y,dead:false,...extra}),tile=start=>({start,name:'Road '+start});
const state=(cars,motions=[],extra={})=>({code:'AAAAAA',phase:'move',cars,players:[],tiles:[tile(0),tile(8),tile(16)],motions,...extra});
const group=(id,kind,moves)=>({id,kind,moves}),move=(id,from,to)=>({car:id,from,to});
const translate=frame=>{const match=frame.transform.match(/^translate\((-?[\d.]+)px,(-?[\d.]+)px\)$/);assert.ok(match,frame.transform);return [Number(match[1]),Number(match[2])];};
const animationFor=(f,id)=>f.animations.find(animation=>animation.node.id===id);

test('canonical motion journal shows approach then push-back even when the final car position has no snapshot difference',()=>{
 const f=fixture(),before=state([car('A',2,1)]),after=state([car('A',2,1)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'push',[move('A',cell(2,2),cell(2,1))])]);
 f.controller.prepare(after,[],[],{live:true,previous:before});assert.equal(f.controller.locked(),true);f.controller.attach(f.board(['A']),0);
 const animation=animationFor(f,'A');assert.equal(animation.options.duration,2*STEP_MS);assert.deepEqual(animation.frames.map(translate),[[0,0],[44,0],[0,0]]);assert.deepEqual(animation.frames.map(frame=>frame.offset),[0,.5,1]);
 f.time(2*STEP_MS);animation.finish();assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('different vehicle groups play in journal order and hold the second car until the first displacement ends',()=>{
 const f=fixture(),after=state([car('A',2,2),car('B',4,4)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'push',[move('B',cell(4,3),cell(4,4))])]);
 f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(['A','B']),0);
 const first=animationFor(f,'A'),second=animationFor(f,'B');assert.equal(first.options.duration,2*STEP_MS);assert.equal(second.options.duration,2*STEP_MS);
 assert.deepEqual(first.frames.map(frame=>[frame.offset,...translate(frame)]),[[0,-44,0],[.5,0,0],[1,0,0]]);
 assert.deepEqual(second.frames.map(frame=>[frame.offset,...translate(frame)]),[[0,-44,0],[.5,-44,0],[1,0,0]]);
 f.time(2*STEP_MS);first.finish();second.finish();assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('a quake group moves all six vehicles together instead of truncating the affected cars to three',()=>{
 const f=fixture(),cars=Array.from({length:6},(_,x)=>car('C'+x,x,2)),moves=cars.map(c=>move(c.id,cell(c.x,3),cell(c.x,2))),after=state(cars,[group(1,'quake',moves)]);
 f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(cars.map(c=>c.id)),0);assert.equal(f.animations.length,6);
 for(const animation of f.animations){assert.equal(animation.options.duration,STEP_MS);assert.equal(animation.currentTime,0);assert.deepEqual(animation.frames.map(translate),[[44,0],[0,0]]);}
 f.time(STEP_MS);for(const animation of f.animations)animation.finish();assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('an eliminated car remains a motion ghost until its recorded displacement leaves the board',()=>{
 const f=fixture(),after=state([car('A',0,3,{dead:true})],[group(1,'push',[move('A',cell(0,3),cell(-1,3))])]);
 f.controller.prepare(after,[],[],{live:true});const during=f.controller.view(after).cars[0];assert.equal(during.motionGhost,true);assert.equal(during.x,-1);assert.equal(during.y,3);
 f.controller.attach(f.board(['A']),0);assert.equal(f.animations.length,1);assert.deepEqual(f.animations[0].frames.map(translate),[[-22,44],[0,0]]);
 f.time(STEP_MS);f.animations[0].finish();assert.equal(f.controller.locked(),false);const settled=f.controller.view(after).cars[0];assert.equal(settled.dead,true);assert.equal(!!settled.motionGhost,false);
});

test('a finished winner reaches the recorded finish line and stays there after settling or hydrating the final result',()=>{
 const after=state([car('A',2,23)],[group(1,'move',[move('A',cell(2,23),cell(2,24))])],{phase:'finished'}),f=fixture();
 f.controller.prepare(after,[],[],{live:true});assert.equal(f.controller.view(after).cars[0].y,24);f.controller.attach(f.board(['A']),0);assert.deepEqual(f.animations[0].frames.map(translate),[[-44,0],[0,0]]);
 f.time(STEP_MS);f.animations[0].finish();assert.equal(f.controller.locked(),false);assert.equal(f.controller.view(after).cars[0].y,24,'settling must not teleport the winner back to the pre-finish authoritative cell');
 const hydrated=fixture();hydrated.controller.prepare(after,[],[],{live:false});assert.equal(hydrated.controller.locked(),false);assert.equal(hydrated.controller.view(after).cars[0].y,24);assert.equal(hydrated.animations.length,0);
 f.controller.prepare(state([car('A',2,1)],[]),[],[],{live:false});assert.equal(f.controller.view(state([car('A',2,1)])).cars[0].y,1);
});

test('jump and blast displacement tracks include a lifted midpoint before returning to the landing cell',()=>{
 for(const kind of ['jump','blast']){
  const f=fixture(),after=state([car('A',2,4)],[group(1,kind,[move('A',cell(2,1),cell(2,4))])]);f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(['A']),0);
  const animation=f.animations[0];assert.equal(animation.options.duration,3*STEP_MS);assert.deepEqual(animation.frames.map(frame=>[frame.offset,...translate(frame)]),[[0,-132,0],[.5,-66,-24],[1,0,0]]);
 }
});

test('a newly deployed chopper has its own player track and slides from the recorded off-road entry',()=>{
 const f=fixture(),after=state([],[group(1,'airplace',[{player:'P',from:cell(3,-1),to:cell(3,3)}])],{players:[{id:'P',chopper:{x:3,y:3,chopper:true}}]});
 f.controller.prepare(after,[],[],{live:true});const player=f.controller.view(after).players[0];assert.deepEqual(player.chopper,{x:3,y:3,chopper:true});f.controller.attach(f.board([],['P']),0);
 assert.equal(f.animations.length,1);assert.equal(f.animations[0].node.type,'player');assert.equal(f.animations[0].options.duration,4*STEP_MS);assert.deepEqual(f.animations[0].frames.map(translate),[[-176,0],[0,0]]);
});

test('road recycling keeps old tiles and the original world origin until movement and a smooth world pan both settle',()=>{
 const f=fixture(),before=state([car('A',2,23)]),after=state([car('A',2,24)],[group(1,'move',[move('A',cell(2,23),cell(2,24))])],{tiles:[tile(8),tile(16),tile(24)]});
 f.controller.prepare(after,[],[],{live:true,previous:before});const during=f.controller.view(after);assert.equal(during.min,0);assert.deepEqual(during.tiles.map(t=>t.start),[0,8,16,24]);
 f.controller.attach(f.board(['A']),during.min);const movement=animationFor(f,'A'),world=animationFor(f,'road');assert.equal(movement.options.duration,STEP_MS+PAN_MS);assert.equal(world.options.duration,STEP_MS+PAN_MS);
 const fraction=STEP_MS/(STEP_MS+PAN_MS);assert.deepEqual(world.frames.map(frame=>[frame.offset,...translate(frame)]),[[0,0,0],[fraction,0,0],[1,-352,0]]);
 assert.deepEqual(movement.frames.map(frame=>[frame.offset,...translate(frame)]),[[0,-44,0],[fraction,0,0],[1,0,0]]);
 f.time(STEP_MS);assert.equal(f.controller.locked(),true);f.time(STEP_MS+PAN_MS);world.finish();movement.finish();assert.deepEqual(f.settlements,[{cancelled:false}]);
 const settled=f.controller.view(after);assert.equal(settled.min,8);assert.deepEqual(settled.tiles.map(t=>t.start),[8,16,24]);
});

test('presence redraws retain elapsed time and do not requeue canonical journal groups',()=>{
 const f=fixture(),journal=Array.from({length:8},(_,index)=>group(index+1,'move',[move('A',cell(2,index),cell(2,index+1))])),after=state([car('A',2,8)],journal);
 f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(['A']),0);const initial=f.animations[0];f.time(550);f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(['A']),0);
 assert.equal(initial.cancelled,true);assert.equal(f.animations.length,2);assert.equal(f.animations[1].currentTime,550);assert.equal(f.animations[1].options.duration,8*STEP_MS);assert.equal(f.animations[1].frames.length,9);assert.equal(f.controller.locked(),true);assert.equal(f.settlements.length,0);
});

for(const cause of ['reconnect','hidden','off'])test(cause+' cancels the lock once and never replays consumed journal groups',()=>{
 const after=state([car('A',2,2)],[group(1,'move',[move('A',cell(2,1),cell(2,2))])]);
  const f=fixture();f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(['A']),0);assert.equal(f.controller.locked(),true);
  if(cause==='reconnect')f.controller.prepare(after,[],[],{live:false});else if(cause==='hidden')f.hidden(true);else f.enabled(false);
  assert.equal(f.controller.locked(),false,cause);assert.equal(f.animations[0].cancelled,true,cause);assert.deepEqual(f.settlements,[{cancelled:true}],cause);
  if(cause==='hidden')f.hidden(false);if(cause==='off')f.enabled(true);f.controller.prepare(after,[],[],{live:true});f.controller.attach(f.board(['A']),0);
  assert.equal(f.controller.locked(),false,cause);assert.equal(f.animations.length,1,cause);assert.equal(f.settlements.length,1,cause);
});

test('a stale animation finish callback cannot flush an extended timeline and final callbacks settle only once',()=>{
 const f=fixture(),first=state([car('A',2,2)],[group(1,'move',[move('A',cell(2,1),cell(2,2))])]);f.controller.prepare(first,[],[],{live:true});f.controller.attach(f.board(['A']),0);const stale=f.animations[0].onfinish;
 f.time(100);const extended=state([car('A',2,3)],[...first.motions,group(2,'move',[move('A',cell(2,2),cell(2,3))])]);f.controller.prepare(extended,[],[],{live:true});f.controller.attach(f.board(['A']),0);
 stale();assert.equal(f.controller.locked(),true);assert.equal(f.settlements.length,0);assert.equal(f.animations.at(-1).currentTime,100);assert.equal(f.animations.at(-1).options.duration,2*STEP_MS);
 const final=f.animations.at(-1).onfinish;f.time(2*STEP_MS);final();assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);stale();final();assert.equal(f.settlements.length,1);
});

test('explicit cancel retains the consumed motion serial across preference changes and only a new journal group may move again',()=>{
 const f=fixture(),first=state([car('A',2,2)],[group(1,'move',[move('A',cell(2,1),cell(2,2))])]);f.controller.prepare(first,[],[],{live:true});f.controller.attach(f.board(['A']),0);f.time(100);
 f.controller.cancel();f.controller.cancel();assert.equal(f.controller.locked(),false);assert.equal(f.animations[0].cancelled,true);assert.deepEqual(f.settlements,[{cancelled:true}]);
 f.enabled(false);f.enabled(true);f.controller.prepare(first,[],[],{live:true});f.controller.attach(f.board(['A']),0);assert.equal(f.controller.locked(),false);assert.equal(f.animations.length,1);assert.equal(f.settlements.length,1);
 const next=state([car('A',2,3)],[...first.motions,group(2,'move',[move('A',cell(2,2),cell(2,3))])]);f.controller.prepare(next,[],[],{live:true});f.controller.attach(f.board(['A']),0);
 assert.equal(f.controller.locked(),true);assert.equal(f.animations.length,2);assert.equal(f.animations[1].options.duration,STEP_MS);assert.equal(f.animations[1].currentTime,0);assert.deepEqual(f.animations[1].frames.map(translate),[[-44,0],[0,0]]);
 f.time(100+STEP_MS);f.animations[1].finish();assert.deepEqual(f.settlements,[{cancelled:true},{cancelled:false}]);
});

const event=(id,kind,afterMotion,extra={})=>({id,kind,afterMotion,...extra});
const cueIds=f=>f.cues.map(cue=>cue.events.map(event=>event.id));
const moveTimes=f=>f.moves.map(group=>[group.id,group.at]);

test('a real multi-cell fire crossing stops its visual path at the event checkpoint before continuing',()=>{
 const {createScenario,act}=require('../src/games/tutorial'),s=createScenario(5);
 for(const t of s.r.tiles)for(const row of t.cells)for(const cell of row){cell.kind='O';delete cell.hazard;}
 for(let x=0;x<6;x++)s.r.terrain(x,2).kind='F';s.p.dice[0].value=6;act(s,'begin',{car:s.car.id,die:0});
 const before=JSON.parse(JSON.stringify(s.r.view(s.p.id))),prior=before.events.at(-1)?.id??-Infinity;
 act(s,'movePath',{car:s.car.id,version:s.r.version,x:2,y:4});
 const after=JSON.parse(JSON.stringify(s.r.view(s.p.id))),fresh=after.events.filter(e=>e.id>prior),fire=fresh.find(e=>e.kind==='fire'),f=fixture();
 assert.ok(fire);assert.equal(fire.afterMotion,after.motions[0].id);assert.equal(after.motions.length,3);assert.equal(after.diceCheck,null);
 f.controller.prepare(after,fresh,[],{live:true,previous:before});f.controller.attach(f.board([s.car.id]),0);
 const animation=animationFor(f,s.car.id),total=3*STEP_MS+EVENT_MS;
 assert.equal(animation.options.duration,total);assert.deepEqual(animation.frames.map(translate),[[-132,0],[-88,0],[-88,0],[-44,0],[0,0]]);
 assert.deepEqual(animation.frames.map(frame=>frame.offset),[0,STEP_MS/total,(STEP_MS+EVENT_MS)/total,(2*STEP_MS+EVENT_MS)/total,1]);
 assert.deepEqual(cueIds(f),[]);assert.deepEqual(moveTimes(f),[[after.motions[0].id,0]]);
 f.time(STEP_MS);assert.deepEqual(cueIds(f),[[fire.id]]);assert.equal(f.cues[0].duration,EVENT_MS);assert.equal(f.controller.claims(fire.id),true);assert.equal(f.controller.locked(),true);
 f.time(STEP_MS+EVENT_MS-1);assert.equal(f.moves.length,1);assert.equal(f.controller.locked(),true);
 f.time(STEP_MS+EVENT_MS);assert.deepEqual(moveTimes(f),[[after.motions[0].id,0],[after.motions[1].id,STEP_MS+EVENT_MS]]);
 f.time(total);animation.finish();assert.deepEqual(moveTimes(f).at(-1),[after.motions[2].id,2*STEP_MS+EVENT_MS]);assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('each glass landing is a separate checkpoint, with no forced sliding before its own event has been shown',()=>{
 const f=fixture(),journal=[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'glass',[move('A',cell(2,2),cell(2,3))]),group(3,'glass',[move('A',cell(2,3),cell(2,4))])],events=[event(1,'glass',1,{car:'A'}),event(2,'glass',2,{car:'A'})],after=state([car('A',2,4)],journal,{events});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);const animation=f.animations[0],total=3*STEP_MS+2*EVENT_MS;
 assert.equal(animation.options.duration,total);assert.deepEqual(animation.frames.map(translate),[[-132,0],[-88,0],[-88,0],[-44,0],[-44,0],[0,0]]);
 f.time(STEP_MS);assert.deepEqual(cueIds(f),[[1]]);f.time(STEP_MS+EVENT_MS);assert.deepEqual(moveTimes(f),[[1,0],[2,STEP_MS+EVENT_MS]]);
 f.time(2*STEP_MS+EVENT_MS);assert.deepEqual(cueIds(f),[[1],[2]]);assert.equal(f.moves.length,2);f.time(total);animation.finish();assert.deepEqual(moveTimes(f),[[1,0],[2,STEP_MS+EVENT_MS],[3,2*STEP_MS+2*EVENT_MS]]);assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('a shot and its damage checkpoint precede target skid motion, and onMove triggers the effect only when sliding starts',()=>{
 const f=fixture(),events=[event(1,'shot',0,{target:'B',hit:true}),event(2,'damage',0,{car:'B',damage:'skid1'})],after=state([car('B',2,4)],[group(1,'skid',[move('B',cell(2,3),cell(2,4))])],{events});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['B']),0);const animation=f.animations[0],total=EVENT_MS+STEP_MS;
 assert.deepEqual(cueIds(f),[[1,2]]);assert.equal(f.cues[0].duration,EVENT_MS);assert.deepEqual(moveTimes(f),[]);assert.equal(animation.options.duration,total);assert.deepEqual(animation.frames.map(translate),[[-44,0],[-44,0],[0,0]]);
 f.time(EVENT_MS-1);assert.equal(f.moves.length,0);assert.equal(f.controller.locked(),true);f.time(EVENT_MS);assert.deepEqual(moveTimes(f),[[1,EVENT_MS]]);f.time(total);animation.finish();assert.equal(f.controller.locked(),false);
});

test('a tail dice check replaces only its own automatic-event hold while preceding intermediate event checkpoints remain intact',()=>{
 const f=fixture(),events=[event(1,'fire',1,{car:'A'}),event(2,'hazard',2,{car:'A',hazard:'oil'})],after=state([car('A',2,3)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'move',[move('A',cell(2,2),cell(2,3))])],{events,diceCheck:{id:'OIL',kind:'oil',status:'awaiting'}});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);const animation=f.animations[0],total=2*STEP_MS+EVENT_MS;
 assert.equal(animation.options.duration,total);f.time(STEP_MS);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.cues[0].duration,EVENT_MS);
 f.time(total);animation.finish();assert.deepEqual(cueIds(f),[[1],[2]]);assert.equal(f.cues[1].duration,0);assert.equal(f.controller.locked(),false);
});

test('manual jump and collision result events do not add a second automatic pause before their confirmed displacement',()=>{
 for(const kind of ['jump','slam','quake']){
  const f=fixture(),events=[event(1,kind,0,{car:'A'})],after=state([car('A',2,2)],[group(1,kind,[move('A',cell(2,1),cell(2,2))])],{events});
  f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.equal(f.animations[0].options.duration,STEP_MS);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.cues[0].duration,0);assert.deepEqual(moveTimes(f),[[1,0]]);
 }
});

test('a road-change checkpoint retains its longer reading period alongside the existing smooth pan',()=>{
 const f=fixture(),before=state([car('A',2,23)]),events=[event(1,'road',1)],after=state([car('A',2,24)],[group(1,'move',[move('A',cell(2,23),cell(2,24))])],{events,tiles:[tile(8),tile(16),tile(24)]});
 f.controller.prepare(after,events,[],{live:true,previous:before});f.controller.attach(f.board(['A']),0);assert.equal(animationFor(f,'A').options.duration,STEP_MS+ROAD_EVENT_MS+PAN_MS);
 f.time(STEP_MS+PAN_MS);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.cues[0].duration,ROAD_EVENT_MS);assert.equal(f.controller.locked(),true);
 f.time(STEP_MS+PAN_MS+ROAD_EVENT_MS);f.animations.at(-1).finish();assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('presence redraw during an event hold keeps the original checkpoint deadline and never replays the cue or the first move',()=>{
 const f=fixture(),events=[event(1,'fire',1,{car:'A'})],after=state([car('A',2,3)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'move',[move('A',cell(2,2),cell(2,3))])],{events});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);f.time(STEP_MS+300);
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.deepEqual(cueIds(f),[[1]]);assert.deepEqual(moveTimes(f),[[1,0]]);assert.equal(f.animations.at(-1).currentTime,STEP_MS+300);assert.equal(f.animations.at(-1).options.duration,2*STEP_MS+EVENT_MS);
 f.time(STEP_MS+EVENT_MS);assert.deepEqual(moveTimes(f),[[1,0],[2,STEP_MS+EVENT_MS]]);assert.deepEqual(cueIds(f),[[1]]);f.time(2*STEP_MS+EVENT_MS);f.animations.at(-1).finish();assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('skipping advances the current cue hold without skipping either movement segment or replaying the event on presence',()=>{
 const f=fixture(),events=[event(1,'fire',1,{car:'A'})],after=state([car('A',2,3)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'move',[move('A',cell(2,2),cell(2,3))])],{events});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.equal(f.controller.skipCue(),false,'a movement may not be skipped with the event control');f.time(STEP_MS+100);
 assert.equal(f.controller.skipCue(),true);assert.deepEqual(moveTimes(f),[[1,0],[2,STEP_MS+100]]);assert.equal(f.controller.locked(),true);assert.equal(f.controller.skipCue(),false);
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.animations.at(-1).options.duration,2*STEP_MS+100);
 f.time(2*STEP_MS+100);f.animations.at(-1).finish();assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('cancel clears checkpoint timers and stale callbacks cannot emit later cues or resume queued movement',()=>{
 const f=fixture(),events=[event(1,'fire',1,{car:'A'})],after=state([car('A',2,3)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'move',[move('A',cell(2,2),cell(2,3))])],{events});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);f.time(STEP_MS);const stale=[...f.timers.values()].map(timer=>timer.callback);assert.ok(stale.length);
 f.controller.cancel();assert.equal(f.timers.size,0);assert.deepEqual(f.settlements,[{cancelled:true}]);f.time(5000);for(const callback of stale)callback();assert.deepEqual(cueIds(f),[[1]]);assert.deepEqual(moveTimes(f),[[1,0]]);assert.deepEqual(f.settlements,[{cancelled:true}]);
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.equal(f.controller.locked(),false);assert.deepEqual(cueIds(f),[[1]]);assert.deepEqual(moveTimes(f),[[1,0]]);
});

for(const cause of ['reconnect','hidden','off'])test(cause+' during an event checkpoint clears the hold and consumes its queued movement without catch-up',()=>{
 const f=fixture(),events=[event(1,'fire',1,{car:'A'})],after=state([car('A',2,3)],[group(1,'move',[move('A',cell(2,1),cell(2,2))]),group(2,'move',[move('A',cell(2,2),cell(2,3))])],{events});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);f.time(STEP_MS+100);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.controller.locked(),true);
 if(cause==='reconnect')f.controller.prepare(after,events,[],{live:false});else if(cause==='hidden')f.hidden(true);else f.enabled(false);
 assert.equal(f.controller.locked(),false);assert.equal(f.timers.size,0);assert.deepEqual(f.settlements,[{cancelled:true}]);if(cause==='hidden')f.hidden(false);if(cause==='off')f.enabled(true);
 f.time(5000);f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.deepEqual(cueIds(f),[[1]]);assert.deepEqual(moveTimes(f),[[1,0]]);assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:true}]);
});

test('a final automatic event holds at the final car position until its reading period ends, without adding another move',()=>{
 const f=fixture(),events=[event(1,'damage',1,{car:'A'})],after=state([car('A',2,2)],[group(1,'move',[move('A',cell(2,1),cell(2,2))])],{events,phase:'assign',active:null});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);const animation=f.animations[0],total=STEP_MS+EVENT_MS;
 assert.equal(animation.options.duration,total);assert.deepEqual(animation.frames.map(translate),[[-44,0],[0,0],[0,0]]);f.time(STEP_MS);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.controller.locked(),true);f.time(total-1);assert.equal(f.controller.locked(),true);assert.equal(f.moves.length,1);f.time(total);animation.finish();assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);
});

test('an event without new displacement holds a stationary world, survives presence and can be skipped without inventing movement',()=>{
 const f=fixture(),events=[event(1,'damage',0,{car:'A'})],after=state([car('A',2,1)],[],{events,phase:'assign',active:null});
 f.controller.prepare(after,events,[],{live:true});assert.equal(f.controller.locked(),true);f.controller.attach(f.board(['A']),0);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.controller.inCue(),true);assert.equal(f.animations.length,1);assert.equal(f.animations[0].node.id,'road');assert.equal(f.animations[0].options.duration,EVENT_MS);assert.deepEqual(f.animations[0].frames.map(translate),[[0,0],[0,0]]);assert.deepEqual(moveTimes(f),[]);
 f.time(80);f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.deepEqual(cueIds(f),[[1]]);assert.equal(f.animations.at(-1).currentTime,80);assert.equal(f.animations.at(-1).options.duration,EVENT_MS);assert.equal(f.controller.skipCue(),true);assert.equal(f.controller.inCue(),false);assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);assert.equal(f.controller.skipCue(),false);
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.deepEqual(cueIds(f),[[1]]);assert.deepEqual(moveTimes(f),[]);assert.equal(f.controller.locked(),false);
});

test('an event without displacement still honours its full reading period and a stale world finish callback cannot survive cancellation',()=>{
 const events=[event(1,'fire',0,{car:'A'})],after=state([car('A',2,1)],[],{events}),f=fixture();f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);
 f.time(EVENT_MS-1);assert.equal(f.controller.locked(),true);assert.equal(f.settlements.length,0);f.time(EVENT_MS);f.animations[0].finish();assert.equal(f.controller.locked(),false);assert.deepEqual(f.settlements,[{cancelled:false}]);
 const cancelled=fixture();cancelled.controller.prepare(after,events,[],{live:true});cancelled.controller.attach(cancelled.board(['A']),0);const stale=cancelled.animations[0].onfinish;cancelled.controller.cancel();assert.equal(cancelled.timers.size,0);cancelled.time(5000);stale();assert.deepEqual(cancelled.settlements,[{cancelled:true}]);assert.deepEqual(cueIds(cancelled),[[1]]);assert.deepEqual(moveTimes(cancelled),[]);
});

test('a check with only manual result events and no displacement leaves the dice presentation in charge of the next step',()=>{
 const f=fixture(),events=[event(1,'fireDie',0,{car:'A'})],after=state([car('A',2,1)],[],{events,diceCheck:{id:'NEXT',kind:'jump',status:'awaiting'}});
 f.controller.prepare(after,events,[],{live:true});f.controller.attach(f.board(['A']),0);assert.equal(f.controller.locked(),false);assert.equal(f.controller.claims(1),false);assert.equal(f.animations.length,0);assert.deepEqual(cueIds(f),[]);assert.deepEqual(moveTimes(f),[]);
});
