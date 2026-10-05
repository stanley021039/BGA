const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const RacePaths=require('../public/shared/race-paths'),RaceMovement=require('../public/shared/race-movement');
const source=fs.readFileSync(require.resolve('../public/race.js'),'utf8'),diceSource=fs.readFileSync(require.resolve('../public/shared/race-dice-dialog.js'),'utf8');

// Real presentation functions and both real controllers; these DOM stand-ins
// test sequencing and permissions, not browser geometry or rendering speed.
function harness({lesson=false}={}){
 let clock=10000,timerId=0,generation=0,scope,svg=null,cueVisible=false;const timers=new Map(),microtasks=[],animations=[],network=[],effects=[],effectRecords=[],cues=[],cueRecords=[],sounds=[],spotlights=[],order=[],scrolls=[],nodes=new Map(),layers=new Map(),subscriptions=new Set(),documentListeners=new Map();let achievementChecks=0,lessonRenders=0,lessonMotions=0;
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
 const policy={get:()=>({enabled:true}),allowsMotion:()=>!document.hidden,subscribe(callback){subscriptions.add(callback);callback();return()=>subscriptions.delete(callback);},animate(element,frames,options){if(!element||document.hidden)return null;const animation={element,frames,options,createdAt:clock,currentTime:0,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};animations.push(animation);order.push('motion:'+element.id);return animation;}};
 const window={document,MotionPolicy:policy,matchMedia:()=>({matches:false}),setTimeout,clearTimeout,GameUI:{setStatus(){},setBusy(){}}};
 if(lesson)window.RaceLesson={onRender(){lessonRenders++;},onMotion(){lessonMotions++;}};
 let initialized=false;scope={window,document,MotionPolicy:policy,Date:{now:()=>clock},setTimeout,clearTimeout,queueMicrotask:callback=>microtasks.push(callback),state:null,busy:false,polling:false,disconnected:false,lastVersion:-1,onlineSignature:'',session:{code:'AAAAAA'},selectedCar:null,selectedDie:null,command:'',commandDie:null,repairCar:null,$:node,esc:String,RacePaths,sizes:['輕型','中型','重型'],directions:['前左','前方','前右','後左','後方','後右'],knownAchievements:null,
  motionGate:{update(s,{connected=true}={}){const live=initialized&&connected&&!document.hidden;initialized=true;return live;}},
  RoomHost:{update(){},kicked(){}},RoomApi:{async request(route,data){network.push({route,data});return scope.request?await scope.request(route,data):scope.response||scope.state;}},GameShell:{stableMarkup(element,markup){element.innerHTML=markup;},update(){}},
  immersion:{allowsMotion:policy.allowsMotion,prepareFocus(){},startFocus(items){spotlights.push(items);},stopFocus(){},playSound(kind){sounds.push(kind);}},eventCues:{hide(){cueVisible=false;order.push('cue:hide');},show(events,cars,options){if(events.length)cueVisible=true;cues.push(Array.from(events,event=>event.id));cueRecords.push({events:Array.from(events),cars,options,at:clock});order.push('cue:'+events.map(event=>event.id).join(','));}},vehicleEffects:{reset(){},show(events){effects.push(Array.from(events,event=>event.id));effectRecords.push({events:Array.from(events),at:clock});}},checkRaceAchievements(){achievementChecks++;}};
 vm.createContext(scope);vm.runInContext(diceSource,scope);scope.dice=Array.from({length:6},(_,i)=>window.RaceDiceDialog.faceMarkup(i+1));scope.diceDialog=window.RaceDiceDialog.mount({onAction:(action,data)=>scope.run('action',{action,...data})});
 scope.raceMovement=RaceMovement.mount({document,policy,now:()=>clock,setTimeout,clearTimeout,onCue:cue=>scope.showRaceCheckpoint(cue),onMove:group=>scope.showRaceMotion(group),onSettled:result=>microtasks.push(()=>scope.finishRacePresentation(result))});
 vm.runInContext(source.slice(source.indexOf('let movementRoutes='),source.indexOf('const requestedRoom=')),scope);
 vm.runInContext(source.slice(source.indexOf('function toast(t)'),source.indexOf("$('#track').onclick=boardClick;")),scope);
 const dialog=all().find(element=>element.tagName==='DIALOG'),find=className=>all(dialog).find(element=>element.className.split(/\s+/).includes(className)),button=action=>all(dialog).find(element=>element.dataset.diceAction===action);
 const flush=()=>{while(microtasks.length)microtasks.shift()();},advance=ms=>{const end=clock+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].callback();flush();}clock=end;flush();};
 const cell=(x,y)=>({generation,dataset:{x:String(x),y:String(y)},closest:selector=>selector==='[data-x]'?cell(x,y):null});
 const target=(dataset,id)=>({dataset,id,value:'nitro',disabled:false,closest:()=>target(dataset,id)});
 return {scope,document,dialog,find,button,node,animations,network,effects,effectRecords,cues,cueRecords,sounds,spotlights,order,layers,scrolls,cell,target,flush,advance,settle(){const animation=animations.at(-1);advance(Math.max(0,animation.options.duration-animation.currentTime-(clock-animation.createdAt)));animation.finish();flush();},dispatch(type,target){for(const callback of documentListeners.get(type)||[])callback({target});},get time(){return clock;},get cueVisible(){return cueVisible;},get achievementChecks(){return achievementChecks;},get lessonRenders(){return lessonRenders;},get lessonMotions(){return lessonMotions;}};
}
function state(version=1,extra={}){
 const players=[{id:'P',name:'甲車隊',color:'#ca9563',dice:[1,2,3,4].map(value=>({value,used:false})),commandUsed:false,online:true,chopper:null},{id:'Q',name:'乙車隊',color:'#63a184',dice:[],commandUsed:false,online:true,chopper:null}];
 return {type:'thunder',code:'AAAAAA',name:'測試',version,phase:'move',round:1,roadDie:2,host:true,me:'P',actor:'P',turn:0,players,cars:[{id:'A',owner:'P',size:0,x:2,y:1,damage:[],dead:false,moved:false},{id:'B',owner:'Q',size:2,x:2,y:4,damage:[],dead:false,moved:false}],tiles:[0,8,16].map(start=>({start,name:'Road',cells:Array.from({length:6},()=>Array.from({length:8},()=>({kind:'R'})))})),active:{car:'A',remaining:5},legalMoves:[{x:2,y:2}],targets:[],available:[],pending:null,diceCheck:null,finishAt:null,winner:null,events:[],motions:[],log:[],deadline:40000,...extra};
}
const movement={id:1,kind:'move',moves:[{car:'A',from:{x:2,y:1},to:{x:2,y:2}}]},collision=(id='CHECK',extra={})=>({id,kind:'collision',status:'awaiting',owner:'P',title:'碰撞判定',condition:'受推車與推進方向',participants:[{id:'P',name:'甲車隊'},{id:'Q',name:'乙車隊'}],dice:[{label:'受推車',faces:['進入車','原位車']},{label:'方向',faces:[1,2,3,4,5,6]}],...extra});
const moved=(base,extra={})=>({...base,version:base.version+1,cars:base.cars.map(car=>car.id==='A'?{...car,y:2}:car),motions:[movement],...extra});

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
 h.scope.render(after);assert.deepEqual(h.cues.at(-1),[1,2]);assert.equal(h.cueVisible,true,'a checkpoint at time zero must remain visible after render');assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.effectRecords.flatMap(record=>record.events).some(event=>event.kind==='motion'),false);
 h.advance(RaceMovement.EVENT_MS-1);assert.equal(h.effectRecords.flatMap(record=>record.events).some(event=>event.kind==='motion'),false);h.advance(1);
 const motion=h.effectRecords.flatMap(record=>record.events.map(event=>({event,at:record.at}))).find(record=>record.event.kind==='motion');assert.ok(motion);assert.equal(motion.event.motion,'skid');assert.equal(motion.event.car,'B');assert.equal(motion.at,10000+RaceMovement.EVENT_MS);h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.cues.filter(ids=>ids.length).length,1);
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
