const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const RacePaths=require('../public/shared/race-paths'),RaceMovement=require('../public/shared/race-movement');
const source=fs.readFileSync(require.resolve('../public/race.js'),'utf8'),diceSource=fs.readFileSync(require.resolve('../public/shared/race-dice-dialog.js'),'utf8');

// Real presentation functions and both real controllers; these DOM stand-ins
// test sequencing and permissions, not browser geometry or rendering speed.
function harness({lesson=false}={}){
 let clock=10000,timerId=0,generation=0,scope,svg=null;const timers=new Map(),microtasks=[],animations=[],network=[],effects=[],cues=[],sounds=[],spotlights=[],order=[],scrolls=[],nodes=new Map(),layers=new Map(),subscriptions=new Set(),documentListeners=new Map();let achievementChecks=0,lessonRenders=0,lessonMotions=0;
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.listeners=new Map();this.hidden=false;this.disabled=false;this.open=false;this.isConnected=false;this.textContent='';this.className='';this.style={setProperty(name,value){this[name]=value;}};this.classList={contains:()=>false};}
  append(...items){for(const item of items){item.parentElement=this;item.isConnected=this.isConnected;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(name,value){this.attrs[name]=String(value);}getAttribute(name){return this.attrs[name]??null;}removeAttribute(name){delete this.attrs[name];}
  addEventListener(type,callback){const callbacks=this.listeners.get(type)||[];callbacks.push(callback);this.listeners.set(type,callbacks);}
  fire(type,extra={}){for(const callback of this.listeners.get(type)||[])callback({target:this,preventDefault(){},stopPropagation(){},...extra});}
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
 const policy={get:()=>({enabled:true}),allowsMotion:()=>!document.hidden,subscribe(callback){subscriptions.add(callback);callback();return()=>subscriptions.delete(callback);},animate(element,frames,options){if(!element||document.hidden)return null;const animation={element,frames,options,currentTime:0,cancel(){this.cancelled=true;},finish(){this.onfinish?.();}};animations.push(animation);order.push('motion:'+element.id);return animation;}};
 const window={document,MotionPolicy:policy,matchMedia:()=>({matches:false}),setTimeout,clearTimeout,GameUI:{setStatus(){},setBusy(){}}};
 if(lesson)window.RaceLesson={onRender(){lessonRenders++;},onMotion(){lessonMotions++;}};
 let initialized=false;scope={window,document,Date:{now:()=>clock},setTimeout,clearTimeout,queueMicrotask:callback=>microtasks.push(callback),state:null,busy:false,polling:false,disconnected:false,lastVersion:-1,onlineSignature:'',session:{code:'AAAAAA'},selectedCar:null,selectedDie:null,command:'',commandDie:null,repairCar:null,$:node,esc:String,RacePaths,sizes:['輕型','中型','重型'],directions:['前左','前方','前右','後左','後方','後右'],knownAchievements:null,
  motionGate:{update(s,{connected=true}={}){const live=initialized&&connected&&!document.hidden;initialized=true;return live;}},
  RoomHost:{update(){},kicked(){}},RoomApi:{async request(route,data){network.push({route,data});return scope.response||scope.state;}},GameShell:{stableMarkup(element,markup){element.innerHTML=markup;},update(){}},
  immersion:{allowsMotion:policy.allowsMotion,prepareFocus(){},startFocus(items){spotlights.push(items);},stopFocus(){},playSound(kind){sounds.push(kind);}},eventCues:{hide(){},show(events){cues.push(Array.from(events,event=>event.id));}},vehicleEffects:{reset(){},show(events){effects.push(Array.from(events,event=>event.id));}},checkRaceAchievements(){achievementChecks++;}};
 vm.createContext(scope);vm.runInContext(diceSource,scope);scope.dice=Array.from({length:6},(_,i)=>window.RaceDiceDialog.faceMarkup(i+1));scope.diceDialog=window.RaceDiceDialog.mount({onAction:(action,data)=>scope.run('action',{action,...data})});
 scope.raceMovement=RaceMovement.mount({document,policy,now:()=>clock,onSettled:result=>microtasks.push(()=>scope.finishRacePresentation(result))});
 vm.runInContext(source.slice(source.indexOf('let movementRoutes='),source.indexOf('const requestedRoom=')),scope);
 vm.runInContext(source.slice(source.indexOf('function toast(t)'),source.indexOf("$('#track').onclick=boardClick;")),scope);
 const dialog=all().find(element=>element.tagName==='DIALOG'),find=className=>all(dialog).find(element=>element.className.split(/\s+/).includes(className));
 const flush=()=>{while(microtasks.length)microtasks.shift()();},advance=ms=>{const end=clock+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;clock=next[1].at;timers.delete(next[0]);next[1].callback();}clock=end;};
 const cell=(x,y)=>({generation,dataset:{x:String(x),y:String(y)},closest:selector=>selector==='[data-x]'?cell(x,y):null});
 const target=(dataset,id)=>({dataset,id,value:'nitro',disabled:false,closest:()=>target(dataset,id)});
 return {scope,document,dialog,find,node,animations,network,effects,cues,sounds,spotlights,order,layers,scrolls,cell,target,flush,advance,settle(){const animation=animations.at(-1);clock+=animation.options.duration-animation.currentTime;animation.finish();flush();},dispatch(type,target){for(const callback of documentListeners.get(type)||[])callback({target});},get achievementChecks(){return achievementChecks;},get lessonRenders(){return lessonRenders;},get lessonMotions(){return lessonMotions;}};
}
function state(version=1,extra={}){
 const players=[{id:'P',name:'甲車隊',color:'#ca9563',dice:[1,2,3,4].map(value=>({value,used:false})),commandUsed:false,online:true,chopper:null},{id:'Q',name:'乙車隊',color:'#63a184',dice:[],commandUsed:false,online:true,chopper:null}];
 return {type:'thunder',code:'AAAAAA',name:'測試',version,phase:'move',round:1,roadDie:2,host:true,me:'P',actor:'P',turn:0,players,cars:[{id:'A',owner:'P',size:0,x:2,y:1,damage:[],dead:false,moved:false},{id:'B',owner:'Q',size:2,x:2,y:4,damage:[],dead:false,moved:false}],tiles:[0,8,16].map(start=>({start,name:'Road',cells:Array.from({length:6},()=>Array.from({length:8},()=>({kind:'R'})))})),active:{car:'A',remaining:5},legalMoves:[{x:2,y:2}],targets:[],available:[],pending:null,diceCheck:null,finishAt:null,winner:null,events:[],motions:[],log:[],deadline:40000,...extra};
}
const movement={id:1,kind:'move',moves:[{car:'A',from:{x:2,y:1},to:{x:2,y:2}}]},collision=(id='CHECK',extra={})=>({id,kind:'collision',status:'awaiting',owner:'P',title:'碰撞判定',condition:'受推車與推進方向',participants:[{id:'P',name:'甲車隊'},{id:'Q',name:'乙車隊'}],dice:[{label:'受推車',faces:['進入車','原位車']},{label:'方向',faces:[1,2,3,4,5,6]}],...extra});
const moved=(base,extra={})=>({...base,version:base.version+1,cars:base.cars.map(car=>car.id==='A'?{...car,y:2}:car),motions:[movement],...extra});

test('collision approach remains visible on the map and a real dice modal opens only after the real movement controller settles',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision(),legalMoves:[],events:[{id:1,kind:'slam',car:'A',other:'B',x:2,y:2}]});h.scope.render(after);
 assert.equal(h.scope.raceMovement.locked(),true);assert.equal(h.dialog.open,false);assert.match(h.node('#controlPanel').innerHTML,/等待車輛抵達/);assert.equal(h.node('#winner').hidden,true);assert.equal(h.order.includes('modal'),false);
 h.settle();assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.open,true);assert.equal(h.dialog.dataset.stage,'awaiting');assert.ok(h.order.indexOf('motion:A')<h.order.indexOf('modal'));assert.equal(h.dialog.modalShows,1);assert.equal(h.network.length,0);
});

test('presence redraws preserve pending events and present only the latest check after movement, including a full cosmetic result second',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision('FIRST'),legalMoves:[],events:[{id:1,kind:'hazard',car:'A',hazard:'oil'}]});h.scope.render(after);
 h.advance(80);h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});assert.equal(h.dialog.open,false);
 const latest={...after,version:3,diceCheck:collision('LATEST',{title:'最新碰撞判定',status:'result',startedAt:1000,readyAt:2000,serverNow:3000,result:{faces:['LATEST_FACE',999],text:'LATEST_RESULT'}}),events:[...after.events,{id:2,kind:'damage',car:'A'}]};h.scope.render(latest);h.scope.render(base);assert.equal(h.dialog.open,false);
 h.settle();assert.equal(h.scope.state.version,3);assert.equal(h.dialog.modalShows,1);assert.equal(h.find('race-dice-header').children[0].textContent,'最新碰撞判定');assert.equal(h.dialog.dataset.stage,'rolling');assert.deepEqual(h.effects.flat(),[1,2]);
 h.advance(999);assert.equal(h.find('race-dice-result').textContent,'');h.advance(1);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.find('race-dice-result').textContent,'LATEST_RESULT');assert.equal(h.network.length,0);
});

test('event cues retain earlier movement events across an empty presence redraw until the latest map state settles',()=>{
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{events:[{id:1,kind:'hazard',car:'A',hazard:'glass'}]});h.scope.render(after);h.advance(80);
 h.scope.render({...after,players:after.players.map(player=>({...player,online:false}))});const latest={...after,version:3,events:[...after.events,{id:2,kind:'damage',car:'A'}]};h.scope.render(latest);h.scope.render(base);
 assert.deepEqual(h.cues.flat(),[]);h.settle();assert.deepEqual(h.cues.at(-1),[1,2]);assert.equal(h.scope.state.version,3);h.scope.finishRacePresentation();assert.equal(h.cues.filter(events=>events.length).length,1);
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
 const h=harness(),base=state();h.scope.render(base);const after=moved(base,{diceCheck:collision(),legalMoves:[],events:[{id:1,kind:'slam'}]});h.scope.render(after);h.scope.disconnected=true;
 const latest={...after,version:3,diceCheck:collision('RECONNECTED',{status:'result',result:{faces:['原位車',2],text:'恢復的結果'}})};h.scope.render(latest);assert.equal(h.scope.raceMovement.locked(),false);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.find('race-dice-result').textContent,'恢復的結果');h.flush();
 assert.equal(h.dialog.modalShows,1);assert.equal(h.dialog.dataset.stage,'result');assert.equal(h.spotlights.length,0);assert.equal(h.network.length,0);assert.deepEqual(h.effects.at(-1),[]);
});

test('the lesson receives an in-motion callback while result rendering waits for arrival',()=>{
 const h=harness({lesson:true}),base=state();h.scope.render(base);assert.equal(h.lessonRenders,1);h.scope.render(moved(base));assert.equal(h.lessonRenders,1);assert.equal(h.lessonMotions,1);h.settle();assert.equal(h.lessonRenders,2);assert.equal(h.network.length,0);
});
