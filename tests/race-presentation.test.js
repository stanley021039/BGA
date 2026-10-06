const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const RacePaths=require('../public/shared/race-paths'),RaceMovement=require('../public/shared/race-movement');
const source=fs.readFileSync(require.resolve('../public/race.js'),'utf8'),diceSource=fs.readFileSync(require.resolve('../public/shared/race-dice-dialog.js'),'utf8'),soundSource=fs.readFileSync(require.resolve('../public/shared/game-sounds.js'),'utf8'),raceSoundSource=fs.readFileSync(require.resolve('../public/shared/race-game-sounds.js'),'utf8');

// Real presentation functions and both real controllers; these DOM stand-ins
// test sequencing and permissions, not browser geometry or rendering speed.
function harness({lesson=false,enabled=true,reduced=false,muted=false}={}){
 let clock=10000,timerId=0,generation=0,scope,svg=null,cueVisible=false;const timers=new Map(),microtasks=[],animations=[],network=[],effects=[],effectRecords=[],cues=[],cueRecords=[],sounds=[],soundRecords=[],spotlights=[],order=[],scrolls=[],hostUpdates=[],nodes=new Map(),layers=new Map(),subscriptions=new Set(),documentListeners=new Map(),windowListeners=new Map();let achievementChecks=0,lessonRenders=0,lessonMotions=0;
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.listeners=new Map();this.hidden=false;this.disabled=false;this.open=false;this.isConnected=false;this.textContent='';this.className='';this.style={setProperty(name,value){this[name]=value;}};this.classList={contains:()=>false};}
  append(...items){for(const item of items){item.parentElement=this;item.isConnected=this.isConnected;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(name,value){this.attrs[name]=String(value);}getAttribute(name){return this.attrs[name]??null;}removeAttribute(name){delete this.attrs[name];}
  addEventListener(type,callback){const callbacks=this.listeners.get(type)||[];callbacks.push(callback);this.listeners.set(type,callbacks);}
  fire(type,extra={}){return Promise.all((this.listeners.get(type)||[]).map(callback=>callback({target:this,preventDefault(){},stopPropagation(){},...extra})));}
  contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
  closest(){return null;}focus(){document.activeElement=this;}showModal(){this.open=true;this.modalShows=(this.modalShows||0)+1;order.push('modal');}close(){this.open=false;this.fire('close');}
  remove(){this.parentElement?.children.splice(this.parentElement.children.indexOf(this),1);this.isConnected=false;layers.delete(this.id);}
  querySelector(){return null;}querySelectorAll(){return [];}insertAdjacentHTML(position,markup){this.innerHTML=(this.innerHTML||'')+markup;}scrollTo(value){scrolls.push(value);}
 }
 const body=new Element('body'),head=new Element('head');body.isConnected=head.isConnected=true;
 const all=(element=body)=>[element,...element.children.flatMap(child=>all(child))];
 const byId=id=>[...all(head),...all(body)].find(element=>element.id===id)||null;
 const node=selector=>{
  if(selector==='#track svg')return svg;if(selector==='#raceRoutePreview')return layers.get('raceRoutePreview')||null;if(selector==='.race-command-options'||selector==='#controlPanel .command-spent')return null;
  if(!nodes.has(selector)){const element=new Element();element.id=selector.startsWith('#')?selector.slice(1):selector;body.append(element);nodes.set(selector,element);}return nodes.get(selector);
 };
 const document={body,head,hidden:false,activeElement:body,createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),getElementById:byId,querySelector:node,querySelectorAll:()=>[],addEventListener(type,callback){const list=documentListeners.get(type)||[];list.push(callback);documentListeners.set(type,list);},removeEventListener(type,callback){documentListeners.set(type,(documentListeners.get(type)||[]).filter(fn=>fn!==callback));}};
 const track=node('#track');track.contains=element=>element?.generation===generation;
 Object.defineProperty(track,'innerHTML',{get(){return this.markup||'';},set(markup){this.markup=markup;generation++;layers.clear();if(document.activeElement?.generation!==undefined)document.activeElement=body;
  const cars=[...markup.matchAll(/class="map-car[^"]*"[^>]*data-car="([^"]+)"/g)].map(match=>({dataset:{car:match[1]},querySelector:()=>({type:'car',id:match[1],generation})}));
  const air=[...markup.matchAll(/class="map-chopper"[^>]*data-player="([^"]+)"/g)].map(match=>({dataset:{player:match[1]},querySelector:()=>({type:'player',id:match[1],generation})}));
  svg={querySelectorAll:selector=>selector==='.map-car'?cars:selector==='.map-chopper'?air:[],querySelector:selector=>selector==='.race-world'?{type:'world',id:'road'}:null,insertBefore(layer){layers.set(layer.id,layer);}};
 }});
 const setTimeout=(callback,delay)=>{const id=++timerId;timers.set(id,{callback,at:clock+delay});return id;},clearTimeout=id=>timers.delete(id);
 const policy={get:()=>({enabled}),allowsMotion:()=>enabled&&!reduced&&!document.hidden,subscribe(callback){subscriptions.add(callback);callback();return()=>subscriptions.delete(callback);},animate(element,frames,options){if(!element||!policy.allowsMotion())return null;const animation={element,frames,options,createdAt:clock,currentTime:0,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};animations.push(animation);order.push('motion:'+element.id);return animation;}};
 const window={document,MotionPolicy:policy,matchMedia:()=>({matches:reduced}),setTimeout,clearTimeout,GameUI:{setStatus(){},setBusy(){}},addEventListener(type,callback){const list=windowListeners.get(type)||[];list.push(callback);windowListeners.set(type,list);},removeEventListener(type,callback){windowListeners.set(type,(windowListeners.get(type)||[]).filter(fn=>fn!==callback));},AudioSettings:{playEffect(cue,options){if(muted)return;const clip={cue,options};sounds.push(cue);soundRecords.push({cue,at:clock,dialogOpen:all().some(element=>element.tagName==='DIALOG'&&element.open)});order.push('sound:'+cue);return clip;},stopEffect(clip){clip.options?.onStop?.(clip);}}};
 if(lesson)window.RaceLesson={onRender(){lessonRenders++;},onMotion(){lessonMotions++;}};
 let initialized=false;scope={window,document,MotionPolicy:policy,Date:{now:()=>clock},setTimeout,clearTimeout,queueMicrotask:callback=>microtasks.push(callback),state:null,busy:false,polling:false,disconnected:false,lastVersion:-1,onlineSignature:'',session:{code:'AAAAAA'},selectedCar:null,selectedDie:null,command:'',commandDie:null,repairCar:null,$:node,esc:String,RacePaths,sizes:['輕型','中型','重型'],directions:['前左','前方','前右','後左','後方','後右'],knownAchievements:null,
  motionGate:{update(s,{connected=true}={}){const live=initialized&&connected&&!document.hidden;initialized=true;return live;}},
  RoomHost:{update(snapshot,callback){hostUpdates.push({snapshot,callback});},kicked(){}},RoomApi:{async request(route,data){network.push({route,data});return scope.request?await scope.request(route,data):scope.response||scope.state;}},GameShell:{stableMarkup(element,markup){element.innerHTML=markup;},update(){}},
  immersion:{allowsMotion:policy.allowsMotion,prepareFocus(){},startFocus(items){spotlights.push(items);},stopFocus(){},playSound(kind){sounds.push(kind);}},eventCues:{hide(){cueVisible=false;order.push('cue:hide');},show(events,cars,options){if(events.length)cueVisible=true;cues.push(Array.from(events,event=>event.id));cueRecords.push({events:Array.from(events),cars,options,at:clock});order.push('cue:'+events.map(event=>event.id).join(','));}},vehicleEffects:{reset(){},show(events){effects.push(Array.from(events,event=>event.id));effectRecords.push({events:Array.from(events),at:clock});}},checkRaceAchievements(){achievementChecks++;}};
 vm.createContext(scope);vm.runInContext(soundSource,scope);vm.runInContext(raceSoundSource,scope);scope.raceSounds=window.RaceGameSounds.create();vm.runInContext(diceSource,scope);scope.dice=Array.from({length:6},(_,i)=>window.RaceDiceDialog.faceMarkup(i+1));scope.diceDialog=window.RaceDiceDialog.mount({onRolling:cycle=>scope.raceSounds.rolling(cycle),onAction:(action,data)=>scope.run('action',{action,...data})});
 scope.raceMovement=RaceMovement.mount({document,policy,now:()=>clock,setTimeout,clearTimeout,onCue:cue=>scope.showRaceCheckpoint(cue),onMove:group=>scope.showRaceMotion(group),onSettled:result=>microtasks.push(()=>scope.finishRacePresentation(result))});
 vm.runInContext(source.slice(source.indexOf('let movementRoutes='),source.indexOf('const requestedRoom=')),scope);
 vm.runInContext(source.slice(source.indexOf('function toast(t)'),source.indexOf("$('#track').onclick=boardClick;")),scope);
 vm.runInContext(source.slice(source.indexOf('MotionPolicy.subscribe(()=>{if(!MotionPolicy.allowsMotion())stopPathMotion();});'),source.indexOf("$('#track').onkeydown")),scope);
 const dialog=all().find(element=>element.tagName==='DIALOG'),find=className=>all(dialog).find(element=>element.className.split(/\s+/).includes(className)),button=action=>all(dialog).find(element=>element.dataset.diceAction===action);
 const flush=()=>{while(microtasks.length)microtasks.shift()();},advance=ms=>{const end=clock+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].callback();flush();}clock=end;flush();};
 const cell=(x,y)=>({generation,dataset:{x:String(x),y:String(y)},closest:selector=>selector==='[data-x]'?cell(x,y):null});
 const target=(dataset,id)=>({dataset,id,value:'nitro',disabled:false,closest:()=>target(dataset,id)});
 return {scope,document,dialog,find,button,node,animations,network,effects,effectRecords,cues,cueRecords,sounds,soundRecords,spotlights,order,layers,scrolls,hostUpdates,cell,target,flush,advance,settle(){const animation=animations.at(-1);advance(Math.max(0,animation.options.duration-animation.currentTime-(clock-animation.createdAt)));animation.finish();flush();},dispatch(type,target){for(const callback of documentListeners.get(type)||[])callback({target});},hide(value){document.hidden=value;for(const callback of documentListeners.get('visibilitychange')||[])callback();},leave(){for(const callback of windowListeners.get('pagehide')||[])callback();},setEnabled(value){enabled=value;for(const callback of subscriptions)callback();},setMuted(value){muted=value;},get time(){return clock;},get trackGeneration(){return generation;},get cueVisible(){return cueVisible;},get achievementChecks(){return achievementChecks;},get lessonRenders(){return lessonRenders;},get lessonMotions(){return lessonMotions;}};
}
function state(version=1,extra={}){
 const players=[{id:'P',name:'甲車隊',color:'#ca9563',dice:[1,2,3,4].map(value=>({value,used:false})),commandUsed:false,online:true,chopper:null},{id:'Q',name:'乙車隊',color:'#63a184',dice:[],commandUsed:false,online:true,chopper:null}];
 return {type:'thunder',code:'AAAAAA',name:'測試',version,phase:'move',round:1,roadDie:2,host:true,me:'P',actor:'P',turn:0,players,cars:[{id:'A',owner:'P',size:0,x:2,y:1,damage:[],dead:false,moved:false},{id:'B',owner:'Q',size:2,x:2,y:4,damage:[],dead:false,moved:false}],tiles:[0,8,16].map(start=>({start,name:'Road',cells:Array.from({length:6},()=>Array.from({length:8},()=>({kind:'R'})))})),active:{car:'A',remaining:5},legalMoves:[{x:2,y:2}],targets:[],available:[],pending:null,diceCheck:null,finishAt:null,winner:null,events:[],motions:[],log:[],deadline:40000,...extra};
}
const movement={id:1,kind:'move',moves:[{car:'A',from:{x:2,y:1},to:{x:2,y:2}}]},collision=(id='CHECK',extra={})=>({id,kind:'collision',status:'awaiting',owner:'P',title:'碰撞判定',condition:'受推車與推進方向',participants:[{id:'P',name:'甲車隊'},{id:'Q',name:'乙車隊'}],dice:[{label:'受推車',faces:['進入車','原位車']},{label:'方向',faces:[1,2,3,4,5,6]}],...extra});
const moved=(base,extra={})=>({...base,version:base.version+1,cars:base.cars.map(car=>car.id==='A'?{...car,y:2}:car),motions:[movement],...extra});

const customGif='/assets/characters/user/12345678-1234-4234-8234-123456789abc/emote-22345678-1234-4234-8234-123456789abc?v='+ 'a'.repeat(64);
const neutralPlayers=players=>players.map(player=>({...player,avatar:'/characters/'+player.id}));
const expressionSnapshot=(base,serverNow,playerId='P')=>({...base,serverNow,players:base.players.map(player=>player.id===playerId?{...player,avatar:customGif}:player),expressions:[{id:'EXPRESSION',kind:'expression',playerId,expression:'emote-custom',label:'flip',image:customGif,at:serverNow}]});

test('same-version custom GIF expressions update both viewers immediately and restore neutral after five seconds without repainting the track',async t=>{
 for(const me of ['P','Q'])await t.test(me,()=>{
  const h=harness(),initial=state(1,{me,serverNow:h.time});initial.players=neutralPlayers(initial.players);h.scope.receive(initial);
  const generation=h.trackGeneration,animations=h.animations.length,sounds=h.sounds.length;
  assert.match(h.node('#crews').innerHTML,/src="\/characters\/P"/);
  assert.equal(h.hostUpdates.at(-1).callback,h.scope.receive,'social ACKs register the lightweight receiver');
  const expression=expressionSnapshot(initial,h.time+1);h.scope.receive(expression);
  assert.equal(h.scope.state.players.find(player=>player.id==='P').avatar,customGif);assert.ok(h.node('#crews').innerHTML.includes('src="'+customGif+'"'));
  assert.equal(h.trackGeneration,generation);assert.equal(h.animations.length,animations);assert.equal(h.sounds.length,sounds);
  h.advance(5000);h.scope.response={...initial,serverNow:h.time,expressions:[]};
  return h.scope.refresh().then(()=>{
   assert.equal(h.scope.state.version,initial.version);assert.equal(h.scope.state.players.find(player=>player.id==='P').avatar,'/characters/P');
   assert.match(h.node('#crews').innerHTML,/src="\/characters\/P"/);assert.ok(!h.node('#crews').innerHTML.includes(customGif));
   assert.equal(h.trackGeneration,generation);assert.equal(h.animations.length,animations);assert.equal(h.network.length,1);assert.equal(h.network[0].route,'state');
  });
 });
});

test('same-version expression ACKs preserve an active movement and its pending collision dialog',()=>{
 const h=harness(),initial=state(1,{serverNow:h.time});initial.players=neutralPlayers(initial.players);h.scope.receive(initial);
 const after=moved(initial,{serverNow:h.time+1,diceCheck:collision(),legalMoves:[],events:[{id:1,kind:'slam',afterMotion:1,car:'A',other:'B',x:2,y:2}]});h.scope.receive(after);h.advance(80);
 const generation=h.trackGeneration,animation=h.animations.at(-1),count=h.animations.length,effects=h.effects.length,cues=h.cues.length;
 assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);
 h.scope.receive(expressionSnapshot(after,h.time,'Q'));
 assert.ok(h.node('#crews').innerHTML.includes(customGif));assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);
 assert.equal(h.trackGeneration,generation);assert.equal(h.animations.at(-1),animation);assert.equal(animation.cancelled,undefined);assert.equal(h.animations.length,count);
 assert.equal(h.effects.length,effects);assert.equal(h.cues.length,cues);assert.equal(h.network.length,0);
 h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.open,true);assert.equal(h.dialog.dataset.stage,'awaiting');assert.equal(h.dialog.modalShows,1);
 assert.ok(h.node('#crews').innerHTML.includes(customGif));assert.equal(h.network.length,0);
});

test('same-version avatar changes neither reopen nor restart the ongoing dice rolling cycle',()=>{
 const h=harness(),initial=state(1,{serverNow:h.time});initial.players=neutralPlayers(initial.players);h.scope.receive(initial);
 const rolling={...initial,version:2,serverNow:h.time,diceCheck:collision('ROLLING',{status:'rolling',startedAt:h.time,readyAt:h.time+1000,serverNow:h.time})};h.scope.receive(rolling);
 const generation=h.trackGeneration,shows=h.dialog.modalShows,animations=h.animations.length;assert.equal(h.dialog.dataset.stage,'rolling');
 h.advance(400);h.scope.receive(expressionSnapshot(rolling,h.time));
 assert.equal(h.dialog.open,true);assert.equal(h.dialog.dataset.stage,'rolling');assert.equal(h.dialog.modalShows,shows);assert.equal(h.trackGeneration,generation);assert.equal(h.animations.length,animations);
 const result={...h.scope.state,version:3,serverNow:h.time,diceCheck:{...rolling.diceCheck,status:'result',serverNow:h.time,result:{faces:['原位車',2],text:'原來的擲骰完成'}}};h.scope.receive(result);
 h.advance(599);assert.equal(h.dialog.dataset.stage,'rolling');h.advance(1);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.find('race-dice-result').textContent,'原來的擲骰完成');
 assert.equal(h.dialog.modalShows,shows);assert.equal(h.network.length,0);
});

test('collision approach remains visible on the map and a real dice modal opens only after the real movement controller settles',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision(),legalMoves:[],events:[{id:1,kind:'slam',afterMotion:1,car:'A',other:'B',x:2,y:2}]});h.scope.render(after);
 assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);assert.match(h.node('#controlPanel').innerHTML,/等待車輛抵達/);assert.equal(h.node('#winner').hidden,true);assert.equal(h.order.includes('modal'),false);
 h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.open,true);assert.equal(h.dialog.dataset.stage,'awaiting');assert.ok(h.order.indexOf('motion:A')<h.order.indexOf('modal'));assert.equal(h.dialog.modalShows,1);assert.equal(h.network.length,0);
});

test('presence redraws preserve pending events and present only the latest check after movement, including a full cosmetic result second',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision('FIRST'),legalMoves:[],events:[{id:1,kind:'hazard',afterMotion:1,car:'A',hazard:'oil'}]});h.scope.render(after);
 h.advance(80);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});assert.equal(h.dialog.open,false);
 const latest={...after,version:3,diceCheck:collision('LATEST',{title:'最新碰撞判定',status:'result',startedAt:1000,readyAt:2000,serverNow:3000,result:{faces:['LATEST_FACE',999],text:'LATEST_RESULT'}}),events:[...after.events,{id:2,kind:'damage',afterMotion:1,car:'A'}]};h.scope.render(latest);h.scope.render(base);assert.equal(h.dialog.open,false);
 h.settle();assert.equal(h.scope.state.version,3);assert.equal(h.dialog.modalShows,1);assert.equal(h.find('race-dice-header').children[0].textContent,'最新碰撞判定');assert.equal(h.dialog.dataset.stage,'rolling');assert.deepEqual(h.effects.flat().filter(id=>typeof id==='number'),[1,2]);
 h.advance(999);assert.equal(h.find('race-dice-result').textContent,'');h.advance(1);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.find('race-dice-result').textContent,'LATEST_RESULT');assert.equal(h.network.length,0);
});

test('checkpoint cues remain pending across presence redraws, then display once at arrival instead of replaying at final settlement',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{events:[{id:1,kind:'hazard',afterMotion:1,car:'A',hazard:'glass'}]});h.scope.render(after);h.advance(80);
 h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});h.scope.render(base);
 assert.deepEqual(h.cues.flat(),[]);h.advance(RaceMovement.STEP_MS-80);assert.deepEqual(h.cues.at(-1),[1]);assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.cueRecords.at(-1).options.duration,RaceMovement.EVENT_MS);assert.equal(h.cueVisible,true);
 h.scope.render({...after,players:after.players.map(player=>({...player,online:true}))});assert.equal(h.cueVisible,true,'presence must not hide a card while its checkpoint reading time continues');h.settle();assert.equal(h.scope.state.version,after.version);h.scope.finishRacePresentation();assert.equal(h.cues.filter(events=>events.length).length,1);
});

test('a movement lock blocks run, board clicks, previews, selection, command changes and focus actions without stopping ordinary state refresh',async()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{legalMoves:[{x:2,y:3}]});h.scope.render(after);assert.equal(h.scope.raceMovement.locked(),true);
 assert.equal(await h.scope.run('action',{action:'move',x:2,y:3}),false);h.scope.boardClick({target:h.cell(2,3)});h.scope.moveToTarget(2,3);h.scope.previewMovement(h.cell(2,3));
 const selected=h.scope.selectedDie;h.dispatch('click',h.target({die:'3'}));h.dispatch('click',h.target({action:'bonusYes'}));h.dispatch('click',h.target({target:'B'}));h.dispatch('click',h.target({action:'focus'}));h.dispatch('change',h.target({},'command'));
 assert.equal(h.scope.selectedDie,selected);assert.equal(h.scope.command,'');assert.equal(h.network.length,0);assert.equal(h.layers.size,0);assert.equal(h.scrolls.length,0);
 h.scope.response={...after,version:3,name:'動畫期間仍同步'};await h.scope.refresh();assert.equal(h.network.length,1);assert.equal(h.network[0].route,'state');assert.equal(h.scope.state.name,'動畫期間仍同步');assert.equal(h.scope.raceMovement.locked(),true);
 h.settle();h.scope.response={...after,version:4};assert.equal(await h.scope.run('action',{action:'move',x:2,y:3}),true);assert.equal(h.network.length,2);assert.equal(h.network[1].route,'action');
});

test('winner focus and achievements wait for arrival and are delivered only once despite a presence redraw',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{phase:'finished',winner:{id:'P',name:'甲車隊',reason:'率先抵達'},events:[{id:1,kind:'win'}]});h.scope.render(after);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});
 assert.equal(h.spotlights.length,0);assert.equal(h.achievementChecks,0);assert.equal(h.node('#winner').hidden,true);h.settle();assert.equal(h.spotlights.length,1);assert.equal(h.achievementChecks,1);assert.equal(h.node('#winner').hidden,false);
 h.scope.finishRacePresentation();assert.equal(h.spotlights.length,1);assert.equal(h.achievementChecks,1);
});

test('a reconnect cancels the map barrier and queued settlement cannot reopen or replay a hydrated result',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision(),legalMoves:[],events:[{id:1,kind:'slam',afterMotion:1}]});h.scope.render(after);h.scope.disconnected=true;
 const latest={...after,version:3,diceCheck:collision('RECONNECTED',{status:'result',result:{faces:['原位車',2],text:'恢復的結果'}})};h.scope.render(latest);assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.find('race-dice-result').textContent,'恢復的結果');h.flush();
 assert.equal(h.dialog.modalShows,1);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.spotlights.length,0);assert.equal(h.network.length,0);assert.deepEqual(h.effects.at(-1),[]);
});

test('the lesson receives an in-motion callback while result rendering waits for arrival',()=>{
 const h=harness({lesson:true}),base=state();h.scope.render(base);assert.equal(h.lessonRenders,1);h.scope.render(moved(base));assert.equal(h.lessonRenders,1);assert.equal(h.lessonMotions,1);h.settle();assert.equal(h.lessonRenders,2);assert.equal(h.network.length,0);
});

function engineHarness(){
 const {createScenario,act}=require('../src/games/tutorial'),s=createScenario(5),h=harness();
 for(const t of s.r.tiles)for(const row of t.cells)for(const cell of row){cell.kind='O';delete cell.hazard;}
 s.p.dice[0].value=6;act(s,'begin',{car:s.car.id,die:0});h.scope.session.code=s.r.code;
 const snapshot=()=>JSON.parse(JSON.stringify(s.r.view(s.p.id)));
 h.scope.request=async(route,data)=>{if(route==='action')s.r.act(s.r.actor(),data.action,data);else assert.equal(route,'state');return snapshot();};
 return {...s,h,snapshot};
}

test('real fire during a multi-cell move pauses the map and effects at the landing while the next step stays locked',async()=>{
 const {r,car,h,snapshot}=engineHarness();for(let x=0;x<6;x++)r.terrain(x,2).kind='F';h.scope.render(snapshot());
 assert.equal(await h.scope.run('action',{action:'movePath',version:r.version,car:car.id,x:2,y:4}),true);const fire=r.events.find(event=>event.kind==='fire');assert.ok(fire);assert.equal(car.y,4);
 assert.equal(h.scope.raceMovement.locked(),true);assert.deepEqual(h.cues.flat(),[]);assert.equal(h.dialog.open,false);assert.equal(h.effectRecords.some(record=>record.events.some(event=>event.id===fire.id)),false);assert.doesNotMatch(h.node('#track').innerHTML,/class="race-car-impact"/,'a future checkpoint must not start a legacy impact animation before arrival');
 h.advance(RaceMovement.STEP_MS);assert.deepEqual(h.cues.at(-1),[fire.id]);const cue=h.cueRecords.at(-1);assert.equal(cue.at,10000+RaceMovement.STEP_MS);assert.equal(cue.options.duration,RaceMovement.EVENT_MS);
 const motionEffects=()=>h.effectRecords.flatMap(record=>record.events.filter(event=>event.kind==='motion').map(event=>({event,at:record.at})));assert.equal(motionEffects().length,1);
 assert.equal(await h.scope.run('action',{action:'move',x:2,y:5}),false);h.scope.boardClick({target:h.cell(2,5)});assert.equal(h.network.length,1);
 h.advance(RaceMovement.EVENT_MS-1);assert.equal(motionEffects().length,1);assert.equal(h.scope.raceMovement.locked(),true);h.advance(1);assert.equal(motionEffects().length,2);assert.equal(motionEffects()[1].at,10000+RaceMovement.STEP_MS+RaceMovement.EVENT_MS);
 h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.cues.filter(events=>events.includes(fire.id)).length,1);assert.equal(h.network.length,1);
});

test('real oil roll and accepted forced landing process the next jump check before any further movement or action',async()=>{
 const {r,car,h,snapshot}=engineHarness();r.terrain(2,3).hazard={kind:'oil',face:false};r.terrain(2,4).kind='J';r.roll=faces=>typeof faces[0]==='number'?1:faces.includes('前方')?'前方':faces[0];h.scope.render(snapshot());
 assert.equal(await h.scope.run('action',{action:'movePath',version:r.version,car:car.id,x:2,y:3}),true);assert.equal(r.diceCheck.kind,'oil');const oilId=r.diceCheck.id;assert.equal(r.motions.length,2);assert.equal(car.y,3);assert.equal(h.dialog.open,false);
 h.advance(RaceMovement.STEP_MS);assert.equal(h.dialog.open,false);assert.equal(await h.scope.run('action',{action:'rollDice',check:oilId}),false);h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.dataset.stage,'awaiting');assert.equal(h.dialog.dataset.kind,'oil');assert.equal(h.button('rollDice').disabled,false);
 await h.button('rollDice').fire('click');assert.equal(r.diceCheck.status,'rolling');assert.equal(h.dialog.dataset.stage,'rolling');assert.equal(h.button('acceptDice').disabled,true);assert.equal(car.y,3);const preRollMotionCount=r.motions.length;
 r.advanceDice(r.diceCheck.readyAt);await h.scope.refresh();h.advance(999);assert.equal(h.dialog.dataset.stage,'rolling');assert.equal(h.button('acceptDice').disabled,true);assert.equal(r.motions.length,preRollMotionCount);h.advance(1);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.button('acceptDice').disabled,false);
 await h.button('acceptDice').fire('click');assert.equal(r.diceCheck.kind,'jump');const jumpId=r.diceCheck.id;assert.notEqual(jumpId,oilId);assert.equal(r.diceCheck.status,'awaiting');assert.equal(car.y,4);assert.equal(r.motions.at(-1).kind,'oil');assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);assert.equal(await h.scope.run('action',{action:'rollDice',check:jumpId}),false);
 h.advance(RaceMovement.STEP_MS-1);assert.equal(h.dialog.open,false);h.settle();assert.equal(h.dialog.dataset.kind,'jump');assert.equal(h.dialog.dataset.stage,'awaiting');assert.equal(h.button('rollDice').disabled,false);assert.equal(car.y,4);assert.equal(r.motions.length,3);
 await h.button('rollDice').fire('click');r.advanceDice(r.diceCheck.readyAt);await h.scope.refresh();h.advance(1000);await h.button('acceptDice').fire('click');assert.equal(car.y,5);assert.equal(r.motions.at(-1).kind,'jump');assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.open,false);assert.equal(r.diceCheck,null);
 assert.deepEqual(h.network.filter(call=>call.route==='action').map(call=>call.data.action),['movePath','rollDice','acceptDice','rollDice','acceptDice']);
});

test('shot and damage are presented before a skid effect, whose motion callback waits until its checkpoint completes',()=>{
 const h=harness(),base=state();h.scope.render(base);const events=[{id:1,kind:'shot',afterMotion:0,target:'B',source:'A',hit:true},{id:2,kind:'damage',afterMotion:0,car:'B',damage:'skid1'}],after={...base,version:2,cars:base.cars.map(car=>car.id==='B'?{...car,y:5}:car),motions:[{id:1,kind:'skid',moves:[{car:'B',from:{x:2,y:4},to:{x:2,y:5}}]}],events};
 h.scope.render(after);assert.deepEqual(h.cues.at(-1),[1,2]);assert.equal(h.cueVisible,true,'a checkpoint at time zero must remain visible after render');assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.effectRecords.flatMap(record=>record.events).some(event=>event.kind==='motion'),false);assert.deepEqual(h.sounds,['shot']);
 h.advance(RaceMovement.EVENT_MS-1);assert.equal(h.effectRecords.flatMap(record=>record.events).some(event=>event.kind==='motion'),false);h.advance(1);
 const motion=h.effectRecords.flatMap(record=>record.events.map(event=>({event,at:record.at}))).find(record=>record.event.kind==='motion');assert.ok(motion);assert.equal(motion.event.motion,'skid');assert.equal(motion.event.car,'B');assert.equal(motion.at,10000+RaceMovement.EVENT_MS);assert.deepEqual(h.sounds,['shot','skid']);assert.equal(h.soundRecords.at(-1).at,motion.at);h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.cues.filter(ids=>ids.length).length,1);assert.deepEqual(h.sounds,['shot','skid'],'settlement must not add the old reveal or replay either action');
});

test('slam sound waits for contact and deferred dice sound waits for its visible dialog, then each has one owner',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision('CONTACT',{status:'result',startedAt:1000,readyAt:2000,serverNow:3000,result:{faces:['原位車',3],text:'公開結果'}}),events:[{id:1,kind:'slam',afterMotion:1,car:'A',other:'B'}]});h.scope.render(after);
 assert.deepEqual(h.sounds,[]);h.advance(RaceMovement.STEP_MS-1);assert.deepEqual(h.sounds,[]);h.advance(1);assert.deepEqual(h.sounds,['slam']);assert.equal(h.soundRecords[0].at,10000+RaceMovement.STEP_MS);assert.equal(h.dialog.open,false);
 h.settle();assert.equal(h.dialog.dataset.stage,'rolling');assert.deepEqual(h.sounds,['slam','dice-roll']);assert.equal(h.soundRecords[1].dialogOpen,true);
 h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});h.advance(1000);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.find('race-dice-result').textContent,'公開結果');h.scope.render(after);assert.deepEqual(h.sounds,['slam','dice-roll']);
});

test('rolling and reroll sound use one result-independent cue per server cycle, never a tick or ACK confirmation',async()=>{
 for(const faces of [['命中秘密',1],['未命中秘密',6]]){
  const h=harness(),awaiting=state(1,{diceCheck:collision()});h.scope.render(awaiting);
  const rolling={...awaiting,version:2,diceCheck:collision('CHECK',{status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000})};h.scope.response=rolling;assert.equal(await h.scope.run('action',{action:'rollDice',check:'CHECK'}),true);
  assert.deepEqual(h.sounds,['dice-roll']);assert.equal(h.soundRecords[0].dialogOpen,true);
  const result={...rolling,version:3,diceCheck:{...rolling.diceCheck,status:'result',rerollAllowed:true,result:{faces,text:'完整結果'},serverNow:2000}};h.scope.render(result);h.advance(999);assert.equal(h.find('race-dice-result').textContent,'');assert.deepEqual(h.sounds,['dice-roll']);h.advance(1);assert.equal(h.dialog.dataset.stage,'result');
  const reroll={...result,version:4,diceCheck:{...result.diceCheck,status:'rolling',startedAt:5000,readyAt:6000,serverNow:5000,result:null}};h.scope.response=reroll;await h.scope.run('action',{action:'rerollDice',check:'CHECK'});h.scope.render(reroll);h.advance(1000);assert.deepEqual(h.sounds,['dice-roll','dice-roll']);
 }
});

test('nitro uses the confirmed command event once and ordinary motion remains silent',async()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{events:[{id:1,kind:'command',command:'nitro',car:'A',afterMotion:0}]});h.scope.response=after;
 await h.scope.run('action',{action:'begin',car:'A',command:'nitro'});assert.deepEqual(h.sounds,['nitro']);assert.equal(h.scope.raceMovement.locked(),true);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});h.settle();assert.deepEqual(h.sounds,['nitro']);
 const plain={...after,version:3,cars:after.cars.map(car=>car.id==='A'?{...car,y:3}:car),motions:[movement,{id:2,kind:'move',moves:[{car:'A',from:{x:2,y:2},to:{x:2,y:3}}]}]};h.scope.render(plain);h.settle();assert.deepEqual(h.sounds,['nitro']);
});

test('continuous confirmed sliding groups share one short sound, even when presence rebuilds the moving map',()=>{
 const h=harness(),base=state();h.scope.render(base);const first={id:1,kind:'skid',moves:[{car:'A',from:{x:2,y:1},to:{x:2,y:2}}]},second={id:2,kind:'skid',moves:[{car:'A',from:{x:2,y:2},to:{x:2,y:3}}]},after={...base,version:2,motions:[first,second],cars:base.cars.map(car=>car.id==='A'?{...car,y:3}:car)};
 h.scope.render(after);assert.deepEqual(h.sounds,['skid']);h.advance(100);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});h.settle();assert.deepEqual(h.sounds,['skid']);
});

test('a garage nitro command waits for the first confirmed entry and never replays its sound on later steps',async()=>{
 for(const enabled of [true,false]){
  const h=harness({enabled}),base=state(1,{cars:state().cars.map(car=>car.id==='A'?{...car,x:null,y:-1}:car)});h.scope.render(base);const command={...base,version:2,events:[{id:1,kind:'command',command:'nitro',car:'A',x:null,y:-1,afterMotion:0}]};h.scope.response=command;await h.scope.run('action',{action:'begin',command:'nitro'});assert.deepEqual(h.sounds,[]);
  const entry={id:1,kind:'move',moves:[{car:'A',from:{x:null,y:-1},to:{x:2,y:0}}]},entered={...command,version:3,cars:base.cars.map(car=>car.id==='A'?{...car,x:2,y:0}:car),motions:[entry]};h.scope.render(entered);assert.deepEqual(h.sounds,['nitro']);if(enabled)h.settle();
  const next={...entered,version:4,cars:entered.cars.map(car=>car.id==='A'?{...car,y:1}:car),motions:[entry,{id:2,kind:'move',moves:[{car:'A',from:{x:2,y:0},to:{x:2,y:1}}]}]};h.scope.render(next);if(enabled)h.settle();assert.deepEqual(h.sounds,['nitro']);
 }
});

test('disabled and reduced motion keep one nitro, actual oil displacement and rolling cue without cosmetic animation',()=>{
 for(const options of [{enabled:false},{reduced:true}]){
  const h=harness(options),base=state();h.scope.render(base);const nitro={...base,version:2,events:[{id:1,kind:'command',command:'nitro',car:'A',afterMotion:0}]};h.scope.render(nitro);assert.deepEqual(h.sounds,['nitro']);assert.equal(h.scope.raceMovement.locked(),false);
  h.advance(300);const oil={...nitro,version:3,cars:base.cars.map(car=>car.id==='A'?{...car,y:2}:car),motions:[{id:1,kind:'oil',moves:movement.moves}]};h.scope.render(oil);assert.deepEqual(h.sounds,['nitro','skid']);assert.equal(h.animations.length,0);
  const rolling={...oil,version:4,diceCheck:collision('NO-MOTION',{status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000})};h.scope.render(rolling);h.scope.render(rolling);assert.deepEqual(h.sounds,['nitro','skid','dice-roll']);assert.equal(h.dialog.dataset.motion,'false');h.advance(1000);assert.deepEqual(h.sounds,['nitro','skid','dice-roll']);
 }
});

test('an oil hazard and stationary skid journal do not invent a sliding sound',()=>{
 const h=harness({enabled:false}),base=state();h.scope.render(base);h.scope.render({...base,version:2,events:[{id:1,kind:'hazard',hazard:'oil',car:'A',afterMotion:0}],motions:[{id:1,kind:'skid',moves:[{car:'A',from:{x:2,y:1},to:{x:2,y:1}}]}]});assert.deepEqual(h.sounds,['reveal']);
});

test('muted sound attempts consume event and dice cycles, so enabling audio cannot replay their presence redraws',()=>{
 const h=harness({muted:true,enabled:false}),base=state();h.scope.render(base);const after={...base,version:2,events:[{id:1,kind:'command',command:'nitro',car:'A',afterMotion:0}],diceCheck:collision('MUTED',{status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000})};h.scope.render(after);assert.deepEqual(h.sounds,[]);
 h.setMuted(false);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});h.advance(1000);assert.deepEqual(h.sounds,[]);h.scope.render({...after,version:3,diceCheck:collision('NEW',{status:'rolling',startedAt:3000,readyAt:4000,serverNow:3000})});assert.deepEqual(h.sounds,['dice-roll']);
});

test('hydration, a data gap, hidden recovery and reconnect discard earlier game cues and dice without catch-up',()=>{
 const h=harness({enabled:false}),rolling=collision('OLD',{status:'rolling',startedAt:1000,readyAt:2000,serverNow:1000}),base=state(1,{events:[{id:1,kind:'shot',afterMotion:0}],diceCheck:rolling});h.scope.render(base);assert.deepEqual(h.sounds,[]);h.advance(1000);h.scope.render(base);assert.deepEqual(h.sounds,[]);
 h.advance(5001);const gap={...base,version:2,events:[...base.events,{id:2,kind:'slam',afterMotion:0}],diceCheck:{...rolling,id:'GAP',startedAt:7000}};h.scope.render(gap);assert.deepEqual(h.sounds,[]);
 h.hide(true);const hidden={...gap,version:3,events:[...gap.events,{id:3,kind:'command',command:'nitro',car:'A',afterMotion:0}],diceCheck:{...rolling,id:'HIDDEN',startedAt:8000}};h.scope.render(hidden);h.hide(false);h.scope.render(hidden);h.advance(1000);assert.deepEqual(h.sounds,[]);
 h.scope.disconnected=true;const reconnect={...hidden,version:4,events:[...hidden.events,{id:4,kind:'shot',afterMotion:0}],diceCheck:{...rolling,id:'RECONNECTED',startedAt:9000}};h.scope.render(reconnect);h.scope.disconnected=false;h.scope.render(reconnect);assert.deepEqual(h.sounds,[]);
 h.scope.render({...reconnect,version:5,events:[...reconnect.events,{id:5,kind:'shot',afterMotion:0}],diceCheck:null});assert.deepEqual(h.sounds,['shot']);
});

test('turning motion off midway neither duplicates an already presented shot nor plays a queued future skid',()=>{
 const h=harness(),base=state();h.scope.render(base);const events=[{id:1,kind:'shot',afterMotion:0,target:'B',source:'A',hit:true},{id:2,kind:'damage',afterMotion:0,car:'B',damage:'skid'}],after={...base,version:2,cars:base.cars.map(car=>car.id==='B'?{...car,y:5}:car),motions:[{id:1,kind:'skid',moves:[{car:'B',from:{x:2,y:4},to:{x:2,y:5}}]}],events};h.scope.render(after);assert.deepEqual(h.sounds,['shot']);h.advance(100);h.setEnabled(false);h.flush();h.scope.render(after);h.advance(2000);assert.deepEqual(h.sounds,['shot']);assert.equal(h.scope.raceMovement.locked(),false);
});

test('a failed refresh and leave cancel queued sound presentation; stale callbacks cannot replay after reconnect',async()=>{
 const h=harness(),base=state();h.scope.render(base);const event={id:1,kind:'slam',afterMotion:1,car:'A',other:'B'},after=moved(base,{events:[event],diceCheck:collision('DEFERRED',{status:'result',startedAt:1000,result:{faces:['原位車',3],text:'同步'}})});h.scope.render(after);assert.deepEqual(h.sounds,[]);
 h.scope.request=async()=>{throw Error('connection lost');};await h.scope.refresh();h.advance(2000);assert.deepEqual(h.sounds,[]);assert.equal(h.dialog.open,false);h.scope.request=async()=>after;await h.scope.refresh();h.scope.showRaceCheckpoint({events:[event],duration:0});h.flush();assert.deepEqual(h.sounds,[]);
 h.leave();assert.equal(h.dialog.open,false);h.scope.render({...after,version:3,diceCheck:collision('AFTER-LEAVE',{status:'rolling',startedAt:5000,readyAt:6000,serverNow:5000})});assert.deepEqual(h.sounds,[]);
});

test('the visible event skip callback resumes the remaining path and never bypasses the next move animation',()=>{
 const h=harness(),base=state();h.scope.render(base);const after={...base,version:2,cars:base.cars.map(car=>car.id==='A'?{...car,y:3}:car),motions:[movement,{id:2,kind:'move',moves:[{car:'A',from:{x:2,y:2},to:{x:2,y:3}}]}],events:[{id:1,kind:'fire',afterMotion:1,car:'A'}]};
 h.scope.render(after);h.advance(RaceMovement.STEP_MS+100);const cue=h.cueRecords.at(-1);assert.equal(typeof cue.options.onSkip,'function');cue.options.onSkip();assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);
 h.advance(RaceMovement.STEP_MS-1);assert.equal(h.scope.raceMovement.locked(),true);h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.cues.filter(ids=>ids.includes(1)).length,1);assert.equal(h.network.length,0);
});

test('an automatic event without new motion keeps next-turn controls hidden until its reading period finishes',async()=>{
 const h=harness(),base=state(1,{phase:'assign',active:null,available:['A']});h.scope.render(base);const after={...base,version:2,events:[{id:1,kind:'damage',afterMotion:0,car:'A'}]};
 h.scope.render(after);assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.scope.raceMovement.inCue(),true);assert.equal(h.cueVisible,true);assert.equal(h.node('#instruction').textContent,'事件處理中');assert.doesNotMatch(h.node('#controlPanel').innerHTML,/data-action="begin"/);assert.equal(await h.scope.run('action',{action:'begin',car:'A',die:0}),false);assert.equal(h.network.length,0);
 h.advance(300);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});assert.equal(h.cueVisible,true);assert.equal(h.cues.filter(ids=>ids.includes(1)).length,1);h.advance(RaceMovement.EVENT_MS-301);assert.equal(h.scope.raceMovement.locked(),true);h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.match(h.node('#controlPanel').innerHTML,/data-action="begin"/);assert.equal(h.network.length,0);
});

test('skipping a standalone event immediately restores the next controls without a request or replay',()=>{
 const h=harness(),base=state(1,{phase:'assign',active:null,available:['A']});h.scope.render(base);const after={...base,version:2,events:[{id:1,kind:'damage',afterMotion:0,car:'A'}]};h.scope.render(after);h.advance(200);const cue=h.cueRecords.at(-1);h.scope.eventCues.hide();cue.options.onSkip();h.flush();
 assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.cueVisible,false);assert.match(h.node('#controlPanel').innerHTML,/data-action="begin"/);assert.equal(h.network.length,0);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.cues.filter(ids=>ids.includes(1)).length,1);
});
