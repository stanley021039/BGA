const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {ThunderRoom}=require('../src/games/thunder'),RacePaths=require('../public/shared/race-paths');
const {settleDice,revealDice}=require('./helpers/race-dice');
function fixture({points=5,x=2,y=1,terrain='O'}={}){
 let seed=913;const rng=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const r=new ThunderRoom('PATH','路線',rng);r.add('你的車隊');r.add('其他車隊');r.start();settleDice(r);
 for(const t of r.tiles)for(const row of t.cells)for(const c of row){c.kind=terrain;delete c.hazard;}
 const p=r.players[r.turn],q=r.players[(r.turn+1)%2],car=r.available(p)[0];car.x=x;car.y=y;
 p.dice[0].value=points;r.act(p.id,'begin',{car:car.id,die:0});
 const move=(target,extra={})=>r.act(p.id,'movePath',{version:r.version,car:car.id,...target,...extra});
 const route=(target)=>RacePaths.routes(r.view(p.id)).get(RacePaths.key(target.x,target.y));
 return {r,p,q,car,move,route};
}

test('multi-cell movement charges each step and reaches the target without using extra dice or ending the turn early',()=>{
 const f=fixture(),target={x:2,y:4},route=f.route(target);assert.equal(route.path.length,3);assert.equal(route.cost,3);
 const dice=JSON.stringify(f.p.dice),turn=f.r.turn;f.move(target);
 assert.equal(f.car.x,2);assert.equal(f.car.y,4);assert.equal(f.r.active.remaining,2);assert.equal(f.r.turn,turn);assert.equal(f.r.phase,'move');assert.equal(JSON.stringify(f.p.dice),dice);
 const event=f.r.events.at(-1);assert.equal(event.kind,'movePath');assert.deepEqual(event.steps,route.path);assert.equal(event.cost,3);
 f.r.act(f.p.id,'move',{x:2,y:5});assert.equal(f.r.active.remaining,1);
});

test('planner prefers an obstacle-free route even when an equally short direct route runs into a vehicle',()=>{
 const f=fixture(),other=f.r.cars.find(c=>c.owner===f.q.id);Object.assign(other,{x:2,y:2});
 const target={x:2,y:4},route=f.route(target);assert.ok(route);assert.equal(route.path.some(v=>v.x===2&&v.y===2),false);
 f.move(target);assert.equal(f.r.diceCheck,null);assert.deepEqual({x:f.car.x,y:f.car.y},target);
});

test('known fatal terrain and stopping effects cannot be used as intermediate cells',()=>{
 for(const kind of ['X','G','V','J']){
  const f=fixture();f.r.terrain(2,2).kind=kind;const route=f.route({x:2,y:4});assert.ok(route);
  assert.equal(route.path.some(v=>v.x===2&&v.y===2),false);
  f.move({x:2,y:4});assert.equal(f.car.dead,false);assert.equal(f.r.diceCheck,null);
 }
});

test('route ranking avoids mud and unknown hazards when a safer route fits, and never uses hidden hazard contents',()=>{
 const f=fixture();f.r.terrain(2,2).hazard={face:false,kind:'road'};
 const first=f.route({x:2,y:4});f.r.terrain(2,2).hazard.kind='mine';assert.deepEqual(f.route({x:2,y:4}),first);
 assert.equal(first.path.some(v=>v.x===2&&v.y===2),false);
 delete f.r.terrain(2,2).hazard;f.r.terrain(2,2).kind='M';const mud=f.route({x:2,y:4});assert.equal(mud.path.some(v=>v.x===2&&v.y===2),false);
});

test('mud uses two points and the existing one-point final mud entry remains available',()=>{
 const f=fixture({points:3});for(let x=0;x<6;x++)f.r.terrain(x,2).kind='M';
 const target={x:2,y:2},route=f.route(target);assert.equal(route.cost,2);f.move(target);assert.equal(f.r.active.remaining,1);
 f.r.terrain(2,3).kind='M';assert.equal(f.route({x:2,y:3}).cost,1);f.move({x:2,y:3});assert.equal(f.car.y,3);assert.equal(f.r.phase,'assign');
});

test('invalid, stale, unbounded, wrong-car and client-supplied routes are rejected before any movement',()=>{
 const f=fixture(),before=JSON.stringify(f.r.view(f.p.id));
 for(const extra of [{version:f.r.version-1},{version:String(f.r.version)},{car:f.r.cars.find(c=>c.owner===f.q.id).id},{x:'2'},{x:-1},{x:6},{y:Infinity},{y:1e9},{path:[{x:2,y:4}]},{route:[]}]){
  assert.throws(()=>f.move({x:2,y:4},extra));assert.equal(JSON.stringify(f.r.view(f.p.id)),before);
 }
 assert.throws(()=>f.r.act(f.q.id,'movePath',{version:f.r.version,car:f.car.id,x:2,y:4}));
 const command={version:f.r.version,car:f.car.id,x:2,y:4};f.r.act(f.p.id,'movePath',command);assert.throws(()=>f.r.act(f.p.id,'movePath',command));
});

test('revealing any unknown hazard discards the remainder instead of secretly continuing after an effect',()=>{
 const f=fixture();for(let x=0;x<6;x++)f.r.terrain(x,2).hazard={face:false,kind:'road'};
 const target={x:2,y:4},route=f.route(target);assert.ok(route);const firstHidden=route.path.find(v=>f.r.terrain(v.x,v.y).hazard);
 f.move(target);assert.deepEqual({x:f.car.x,y:f.car.y},firstHidden);assert.equal(f.r.active.remaining>0,true);
 assert.match(f.r.events.at(-1).reason,/揭露危險/);assert.equal(f.r.queue.length,0);
 const pos={x:f.car.x,y:f.car.y};settleDice(f.r);assert.deepEqual({x:f.car.x,y:f.car.y},pos);
});

test('collision waits for explicit dice and no saved route resumes when the collision is accepted',()=>{
 const f=fixture(),other=f.r.cars.find(c=>c.owner===f.q.id);Object.assign(other,{x:2,y:2});f.move({x:2,y:2});
 assert.equal(f.r.diceCheck.kind,'collision');assert.equal(f.r.diceCheck.status,'awaiting');assert.equal(f.r.active.remaining,0);assert.equal(f.r.queue.some(e=>e.type==='movePath'),false);
 assert.throws(()=>f.move({x:2,y:4}));revealDice(f.r);assert.equal(f.r.diceCheck.status,'result');settleDice(f.r);assert.equal(f.r.queue.some(e=>e.type==='movePath'),false);
 assert.equal(f.r.events.filter(e=>e.kind==='movePath').length,1);
});

test('oil and glass stop the selected route after explicit checks or unexpected forced movement',()=>{
 for(const hazard of ['oil','glass']){
  const f=fixture();f.r.terrain(2,2).hazard={face:true,kind:hazard};f.move({x:2,y:2});
  if(hazard==='oil'){assert.equal(f.r.diceCheck.kind,'oil');assert.equal(f.r.diceCheck.status,'awaiting');settleDice(f.r);}
  else{assert.equal(f.car.y,3);assert.match(f.r.events.at(-1).reason,/位置/);}
  assert.equal(f.r.events.filter(e=>e.kind==='movePath').length,1);assert.equal(f.r.queue.length,0);
 }
});

test('jump and mine use the original stop/damage rules and never keep a hidden continuation',()=>{
 const jump=fixture();jump.r.terrain(2,2).kind='J';jump.move({x:2,y:2});assert.equal(jump.r.diceCheck.kind,'jump');assert.equal(jump.r.diceCheck.status,'awaiting');assert.equal(jump.r.active.remaining,0);
 settleDice(jump.r);assert.equal(jump.r.events.filter(e=>e.kind==='movePath').length,1);assert.equal(jump.r.queue.length,0);
 const mine=fixture();for(let x=0;x<6;x++)mine.r.terrain(x,2).hazard={kind:'mine',face:false};mine.r.damageDeck=['dent'];mine.move({x:2,y:4});
 assert.equal(mine.car.y,2);assert.equal(mine.car.damage.length,1);assert.equal(mine.r.events.filter(e=>e.kind==='movePath').length,1);assert.equal(mine.r.queue.length,0);
});

test('a revealed hidden mud surcharge is charged once and the next move is a fresh player choice',()=>{
 const f=fixture();for(let x=0;x<6;x++)f.r.terrain(x,2).hazard={kind:'mud',face:false};f.move({x:2,y:4});
 assert.equal(f.car.y,2);assert.equal(f.r.active.remaining,3);assert.equal(f.r.events.at(-1).cost,2);assert.equal(f.r.queue.length,0);
 f.r.act(f.p.id,'move',{x:f.car.x,y:3});assert.equal(f.r.active.remaining,2);assert.equal(f.car.y,3);
});

test('road recycling stops at the boundary and a finish ends the game through the original rules',()=>{
 const f=fixture({x:2,y:22});for(const c of f.r.cars){if(c!==f.car){c.x=4;c.y=20;}}
 f.move({x:2,y:24});assert.equal(f.r.boardMin(),8);assert.equal(f.car.y,24);assert.match(f.r.events.at(-1).reason,/道路/);
 assert.equal(f.r.queue.length,0);f.r.finishAt=f.r.boardMax();f.car.y=f.r.finishAt-2;f.r.active.remaining=5;
 f.move({x:2,y:f.r.finishAt});assert.equal(f.r.phase,'finished');assert.equal(f.r.winner.id,f.p.id);assert.equal(f.r.queue.length,0);
});

test('staging, nitro, road bonus and one-cell moves retain their original movement rules',()=>{
 const staging=fixture({x:null,y:-1,points:3});staging.move({x:2,y:2});assert.equal(staging.car.y,2);assert.equal(staging.r.phase,'assign');
 const f=fixture({points:1,terrain:'R'});f.move({x:2,y:2});assert.equal(f.r.phase,'bonus');f.r.act(f.p.id,'bonus',{use:true});const n=f.r.roadDie;f.move({x:2,y:2+n});assert.equal(f.r.phase,'assign');
 const nitro=fixture();nitro.r.phase='assign';nitro.car.moved=false;nitro.p.dice[0]={value:6,used:false};nitro.p.dice[1]={value:3,used:false};nitro.r.act(nitro.p.id,'begin',{car:nitro.car.id,die:0,command:'nitro',commandDie:1});
 assert.equal(nitro.r.active.remaining,9);nitro.move({x:2,y:10});assert.equal(nitro.car.y,10);assert.equal(nitro.p.dice.filter(d=>d.used).length,2);
});

test('planner work is bounded and frontend/server share the exact deterministic planner',()=>{
 const f=fixture({points:16}),state=f.r.view(f.p.id),source=fs.readFileSync(require.resolve('../public/shared/race-paths'),'utf8'),window={};vm.runInNewContext(source,{window});
 const a=[...RacePaths.routes(state)],b=[...window.RacePaths.routes(state)];assert.equal(JSON.stringify(a),JSON.stringify(b));assert.ok(a.length<=150);assert.ok(a.every(([,route])=>route.path.length<=16&&route.cost<=16));
 f.r.active.remaining=17;assert.equal(RacePaths.routes(f.r.view(f.p.id)).size,0);
});

function frontendHarness(f,{nested=false}={}){
 const source=fs.readFileSync(require.resolve('../public/race.js'),'utf8'),hint={textContent:''},calls=[],layers=new Map(),listeners=new Map(),body={dataset:{}},cells=new Map();
 let generation=0,scope;
 const document={body,activeElement:body,hidden:false,querySelectorAll:()=>[],createElementNS(){return {setAttribute(){},remove(){layers.delete(this.id);if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}};},elementFromPoint(){return scope.hitTarget?cell(scope.hitTarget.x,scope.hitTarget.y):body;}};
 const cell=(x,y)=>{
  const key=x+':'+y;if(!cells.has(key))cells.set(key,{generation,dataset:{x:String(x),y:String(y)},closest(selector){return selector==='[data-x]'?this:null;},focus(){document.activeElement=this;listeners.get('focusin')?.({target:this});}});return cells.get(key);
 };
 const track={contains:node=>node?.generation===generation,addEventListener(type,fn){listeners.set(type,fn);},querySelector(selector){const match=selector.match(/^\[data-x="(-?\d+)"\]\[data-y="(-?\d+)"\]$/);return match?cell(Number(match[1]),Number(match[2])):null;},set innerHTML(value){this.html=value;generation++;cells.clear();layers.clear();if(document.activeElement?.generation!==undefined)document.activeElement=body;}};
 // Match the native insertBefore parent requirement. A descendant returned by
 // svg.querySelector cannot be used as a direct child of the root SVG.
 function insertBefore(layer,reference){if(reference&&!this.children.includes(reference)){const error=Error('The reference node is not a child of this parent');error.name='NotFoundError';throw error;}layer.parentNode=this;this.children.splice(reference?this.children.indexOf(reference):this.children.length,0,layer);layers.set(layer.id,layer);}
 const mapCar={},world={children:[mapCar],insertBefore},svg={children:[],querySelector:selector=>selector==='.race-world'&&nested?world:selector==='.map-car'?mapCar:null,insertBefore};
 svg.children=nested?[world]:[mapCar];world.parentNode=svg;mapCar.parentNode=nested?world:svg;
 const nodes={'#raceRouteHint':hint,'#track svg':svg,'#track':track};
 scope={state:f.r.view(f.p.id),busy:false,RacePaths,run:(route,data)=>calls.push({route,data}),$:selector=>selector==='#raceRoutePreview'?layers.get('raceRoutePreview'):nodes[selector]||(nodes[selector]={}),document};
 vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('let movementRoutes='),source.indexOf('const requestedRoom=')),scope);
 scope.routes=RacePaths.routes(scope.state);vm.runInContext('movementRoutes=routes;',scope);
 scope.bindMovementPreview(track);
 Object.assign(scope,{window:{},esc:String,sizes:['輕型','中型','重型'],vehicle:()=>'',heli:()=>'',snapshotRaceState:s=>({...s,events:s.events.slice()}),motionGate:{update:()=>false},disconnected:false,immersion:{allowsMotion:()=>false,prepareFocus(){}},RoomHost:{update(){}},GameShell:{stableMarkup(){}},crewCard:()=>'',diceDialog:{show(s){if(s.diceCheck)document.activeElement={dialog:true};}},eventCues:{hide(){}},vehicleEffects:{reset(){},show(){}},raceMovement:{reset(){},prepare(){},attach(){},locked:()=>false,view:s=>({...s,min:s.tiles[0].start})},renderDash(){hint.textContent='預設提示';},tick(){},toast(){}});
 // Route preview tests isolate audio ownership; race-presentation tests execute
 // the real sound controllers and their event/motion presentation callbacks.
 scope.raceSounds={update:()=>({live:false,epoch:0,events:[],motions:[]}),events(){},motion(){},motions(){}};
 // Exercise the real render frame and board rebuild, with isolated shell/audio
 // dependencies; these VM nodes do not claim browser layout measurements.
 vm.runInContext(source.slice(source.indexOf('function render(s)'),source.indexOf('function commandAccepts(')),scope);
 return Object.assign(scope,{hint,calls,layers,listeners,cell,svg,world,mapCar});
}

test('route previews share the race-world parent with nested cars and remain valid after a presence redraw',()=>{
 const f=fixture(),ui=frontendHarness(f,{nested:true});assert.equal(ui.mapCar.parentNode,ui.world);assert.equal(ui.world.parentNode,ui.svg);
 assert.throws(()=>ui.svg.insertBefore({},ui.mapCar),{name:'NotFoundError'},'the harness must reject the root insertion that failed in Chrome');
 assert.doesNotThrow(()=>ui.previewMovement(ui.cell(2,4)));const layer=ui.layers.get('raceRoutePreview');assert.equal(layer.parentNode,ui.world);assert.equal(layer.parentNode,ui.mapCar.parentNode);assert.ok(ui.world.children.indexOf(layer)<ui.world.children.indexOf(ui.mapCar));assert.equal(ui.calls.length,0);
 ui.hitTarget={x:2,y:4};ui.listeners.get('pointermove')({target:ui.cell(2,4),pointerType:'mouse',buttons:0,clientX:110,clientY:210});ui.render({...ui.state,players:ui.state.players.map(player=>({...player,online:!player.online}))});
 const restored=ui.layers.get('raceRoutePreview');assert.notEqual(restored,layer);assert.equal(restored.parentNode,ui.world);assert.equal(restored.parentNode,ui.mapCar.parentNode);assert.match(ui.hint.textContent,/3 格 · 消耗 3 點/);assert.equal(ui.calls.length,0);
 ui.clearMovementPreview();assert.equal(ui.layers.size,0);assert.equal(ui.world.children.includes(restored),false);
});

test('hover preview draws a local path and readable cost without issuing a command; moving to a neighbor preserves one-cell API',()=>{
 const f=fixture(),ui=frontendHarness(f);ui.previewMovement(ui.cell(2,4));
 assert.match(ui.hint.textContent,/3 格 · 消耗 3 點/);assert.match(ui.layers.get('raceRoutePreview').innerHTML,/polyline/);assert.equal(ui.calls.length,0);
 ui.previewMovement(ui.cell(2,4));assert.equal(ui.layers.size,1);assert.equal(ui.calls.length,0);
 ui.moveToTarget(2,2);assert.equal(ui.calls[0].data.action,'move');assert.equal(Object.hasOwn(ui.calls[0].data,'version'),false);
 ui.moveToTarget(2,4);assert.equal(ui.calls[1].data.action,'movePath');assert.equal(ui.calls[1].data.version,f.r.version);assert.equal(ui.calls[1].data.car,f.car.id);
 ui.clearMovementPreview();assert.equal(ui.layers.size,0);
});

test('preview ignores unreachable cells and busy controls; no command can be sent for a nonreachable target',()=>{
 const f=fixture({points:2}),ui=frontendHarness(f);ui.previewMovement(ui.cell(2,15));assert.equal(ui.layers.size,0);
 ui.moveToTarget(2,15);assert.equal(ui.calls.length,0);
 ui.busy=true;ui.previewMovement(ui.cell(2,2));ui.moveToTarget(2,2);assert.equal(ui.layers.size,0);assert.equal(ui.calls.length,0);
});

test('pointer preview survives an equivalent-state presence redraw and actual pointerleave keeps it dismissed',()=>{
 const f=fixture(),ui=frontendHarness(f);ui.hitTarget={x:2,y:4};
 ui.listeners.get('pointerover')({target:ui.cell(2,4),pointerType:'mouse',buttons:0,clientX:110,clientY:210});assert.equal(ui.layers.size,1);
 ui.render({...ui.state,players:ui.state.players.map(p=>({...p,online:!p.online}))});
 assert.match(ui.hint.textContent,/3 格 · 消耗 3 點/);assert.equal(ui.layers.size,1);assert.equal(ui.calls.length,0);
 ui.listeners.get('focusout')({});assert.equal(ui.layers.size,1);
 ui.listeners.get('pointerleave')({});assert.equal(ui.layers.size,0);ui.render({...ui.state});assert.equal(ui.layers.size,0);assert.equal(ui.calls.length,0);
});

test('native focused-cell preview and focus survive a board rebuild, while an active dice dialog clears the preview',()=>{
 const f=fixture(),ui=frontendHarness(f),oldCell=ui.cell(2,4);oldCell.focus();assert.equal(ui.layers.size,1);
 ui.render({...ui.state});assert.equal(ui.layers.size,1);assert.notEqual(ui.document.activeElement,oldCell);assert.deepEqual(ui.document.activeElement.dataset,{x:'2',y:'4'});
 ui.render({...ui.state,diceCheck:{kind:'collision',status:'awaiting'}});assert.equal(ui.layers.size,0);assert.equal(ui.document.activeElement.dialog,true);assert.equal(ui.calls.length,0);
});

test('a stale render cannot clear a current preview, and moving within the track updates the actual pointer target',()=>{
 const f=fixture(),ui=frontendHarness(f);ui.hitTarget={x:2,y:4};ui.listeners.get('pointermove')({target:ui.cell(2,4),pointerType:'mouse',buttons:0,clientX:110,clientY:210});
 const previous=ui.layers.get('raceRoutePreview');ui.render({...ui.state,version:ui.state.version-1});assert.equal(ui.layers.get('raceRoutePreview'),previous);
 ui.hitTarget={x:2,y:3};ui.listeners.get('pointermove')({target:ui.cell(2,3),pointerType:'mouse',buttons:0,clientX:90,clientY:210});assert.match(ui.hint.textContent,/2 格 · 消耗 2 點/);
 assert.equal(ui.calls.length,0);
});
