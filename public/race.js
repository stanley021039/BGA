const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session;try{session=JSON.parse(localStorage.getItem('ah-thunder')||'null');}catch{}let state=null,busy=false,polling=false,disconnected=false,onlineSignature='',selectedCar=null,selectedDie=null,command='',commandDie=null,repairCar=null,lastVersion=-1,invite=location.origin;
let movementRoutes=new Map(),previewRoute=null,movementPointer=null,racePresentation=null;
function stopPathMotion(){raceMovement.cancel();finishRacePresentation({cancelled:true});}
function clearMovementPreview(){previewRoute=null;$('#raceRoutePreview')?.remove();const hint=$('#raceRouteHint');if(hint)hint.textContent='滑鼠停留或鍵盤選取亮框，可預覽路線。鄰格仍可逐格走。';}
function movementTarget(node){const car=node?.closest?.('[data-car]');if(car){const c=state?.cars.find(c=>c.id===car.dataset.car);return c?{x:c.x,y:c.y}:null;}const cell=node?.closest?.('[data-x]');return cell?{x:Number(cell.dataset.x),y:Number(cell.dataset.y)}:null;}
function previewMovement(node){
 const target=movementTarget(node),route=target&&movementRoutes.get(RacePaths.key(target.x,target.y));
 if(!route||busy||raceMovement.locked()||state.actor!==state.me||state.phase!=='move'||state.pending||state.diceCheck){clearMovementPreview();return;}
 const identity=RacePaths.key(route.x,route.y);if(previewRoute===identity)return;clearMovementPreview();previewRoute=identity;
 const car=state.cars.find(c=>c.id===state.active.car),min=state.tiles[0].start;
 const point=v=>({x:48+(v.y-min)*44+(v.x%2)*22,y:81+v.x*44});
 const origin=car.x===null?{x:route.path[0].x,y:-1}:car,points=[origin,...route.path].map(point);
 const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.id='raceRoutePreview';layer.setAttribute('pointer-events','none');layer.setAttribute('aria-hidden','true');
 layer.innerHTML=`<polyline class="race-route-line" points="${points.map(p=>p.x+','+p.y).join(' ')}"/>`+points.slice(1).map((p,i)=>`<circle class="race-route-dot" cx="${p.x}" cy="${p.y-17}" r="9"/><text class="race-route-number" x="${p.x}" y="${p.y-13}">${i+1}</text>`).join('');
 const svg=$('#track svg'),world=svg.querySelector('.race-world')||svg;world.insertBefore(layer,svg.querySelector('.map-car'));
 const hint=$('#raceRouteHint');if(hint)hint.textContent=`${route.path.length} 格 · 消耗 ${route.cost} 點。${route.warnings.length?route.warnings.join('；')+'。':'優先繞開已知障礙與危險。'}揭露危險、擲骰或道路更新時會停下重新選路。`;
}
function moveToTarget(x,y){
 if(busy||raceMovement.locked()||state?.actor!==state?.me||state?.phase!=='move'||state.pending||state.diceCheck||!movementRoutes.has(RacePaths.key(x,y)))return;
 if(state.legalMoves.some(v=>v.x===x&&v.y===y))run('action',{action:'move',x,y});
 else run('action',{action:'movePath',car:state.active.car,version:state.version,x,y});
}
function captureMovementFocus(){return $('#track')?.contains(document.activeElement)?movementTarget(document.activeElement):null;}
function restoreMovementPreview(focusedTarget=null){
 const track=$('#track');
 if(document.hidden||busy||raceMovement.locked()||state?.actor!==state?.me||state?.phase!=='move'||state.pending||state.diceCheck){clearMovementPreview();return;}
 if(movementPointer){
  const node=document.elementFromPoint?.(movementPointer.x,movementPointer.y);
  if(node&&track.contains(node)){previewMovement(node);return;}
  movementPointer=null;clearMovementPreview();return;
 }
 // Replacing the SVG drops native focus. Restore a still-reachable focused
 // cell after a presence-only redraw, without taking focus from a dialog.
 if(focusedTarget&&movementRoutes.has(RacePaths.key(focusedTarget.x,focusedTarget.y))&&(document.activeElement===document.body||track.contains(document.activeElement))){
  const node=track.querySelector(`[data-x="${focusedTarget.x}"][data-y="${focusedTarget.y}"]`);
  node?.focus({preventScroll:true});if(node)previewMovement(node);
 }
}
function bindMovementPreview(track){
 const pointer=e=>{if(e.pointerType==='touch'||e.buttons)return;movementPointer={x:e.clientX,y:e.clientY};previewMovement(e.target);};
 track.addEventListener('pointerover',pointer);track.addEventListener('pointermove',pointer);
 track.addEventListener('pointerleave',()=>{movementPointer=null;clearMovementPreview();});
 track.addEventListener('focusin',e=>{movementPointer=null;previewMovement(e.target);});
 track.addEventListener('focusout',()=>{clearMovementPreview();restoreMovementPreview();});
}
const requestedRoom=location.pathname?.match(/^\/race\/([A-Fa-f0-9]{6})\/?$/)?.[1].toUpperCase();
if(requestedRoom){try{session=JSON.parse(localStorage.getItem('ah-thunder:'+requestedRoom)||'null')||(session?.code===requestedRoom?session:null);}catch{session=null;}}
const immersion=GameImmersion.mount('race',{focusDuration:2200}),eventCues=RaceEventCues.mount(immersion),vehicleEffects=RaceVehicleEffects.mount(),diceDialog=RaceDiceDialog.mount({onAction:async(action,data)=>{if(await run('action',{action,...data})===false)throw Error($('#raceActionStatus').textContent||'操作未完成');}});const raceMovement=RaceMovement.mount({onCue:showRaceCheckpoint,onMove:showRaceMotion,onSettled:result=>queueMicrotask(()=>finishRacePresentation(result))});let motionGate=MotionPolicy.createGate();let knownAchievements=null;
MotionPolicy.subscribe(()=>{if(!MotionPolicy.allowsMotion())for(const node of document.querySelectorAll('.race-car-moving,.race-car-impact'))node.dataset.motion='false';});
$('.race-stage').append($('#raceSpotlight'));
window.GameUI?.bindPopover?.($('#rookieHelp'),$('.rookie-help-content'),{align:'end',width:360});
const sizes=['輕型','中型','重型'],dice=Array.from({length:6},(_,index)=>RaceDiceDialog.faceMarkup(index+1)),directions=['前左','前方','前右','後左','後方','後右'];
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(window.tt);window.tt=setTimeout(()=>$('#toast').style.display='none',4200);}
function vehicle(size,color,disabled=false){const w=[30,36,42][size],h=[16,20,25][size];return `<g ${disabled?'transform="rotate(180)"':''}><rect x="${-w/2+2}" y="${-h/2-4}" width="9" height="6" rx="2" fill="#111711"/><rect x="${w/2-11}" y="${-h/2-4}" width="9" height="6" rx="2" fill="#111711"/><rect x="${-w/2+2}" y="${h/2-2}" width="9" height="6" rx="2" fill="#111711"/><rect x="${w/2-11}" y="${h/2-2}" width="9" height="6" rx="2" fill="#111711"/><path d="M${-w/2},${-h/2+3} L${w/2-5},${-h/2} L${w/2},${-h/2+5} V${h/2-5} L${w/2-5},${h/2} L${-w/2},${h/2-3}Z" fill="${color}" stroke="#eff2d880" stroke-width="1"/><rect x="-4" y="${-h/2+3}" width="9" height="${h-6}" rx="2" fill="#17251f"/><path d="M9,-2H${w/2+4}M9,2H${w/2+4}" stroke="#262d24" stroke-width="2"/><path d="M${-w/2+3},0H-7" stroke="#f9eac6" stroke-width="2"/></g>`;}
function crewCard(s,p){
 if(!p)return '<div class="crew-pill empty-crew">等待車隊入座</div>';
 const cars=s.cars.filter(c=>c.owner===p.id),alive=cars.filter(c=>!c.dead&&c.damage.length<2).length;
 const status=p.out?'已出局':s.phase==='waiting'?'準備出發':`${alive} 輛可用${p.id===s.actor?' · 行動中':''}`;
 const carLabels=cars.length?cars.map(c=>{const label=c.dead?'淘汰':c.damage.length>=2?'停擺':c.damage.length?c.damage.length+'傷':c.moved?'已動':'可用';return `<span class="crew-car ${c.dead?'is-out':c.damage.length?'is-damaged':''}" title="${sizes[c.size]}：${label}${c.burning?'，著火':''}">${sizes[c.size][0]} ${label}${c.burning?' 🔥':''}</span>`;}).join(''):'<span class="crew-car">輕／中／重 · 待發</span>';
 return `<article class="crew-pill ${p.id===s.actor?'current':''}" style="--crew:${p.color}">${p.avatar?`<img class="crew-avatar" src="${esc(p.avatar)}" alt="">`:'<span class="crew-avatar crew-avatar-fallback" aria-hidden="true">♟</span>'}<div class="crew-identity"><div class="crew-name">${esc(p.name)}${p.id===s.me?' · 你':p.bot?' · AI':''}</div><div class="crew-detail">${status} · ${p.online?'在線':'離線'}</div></div><div class="crew-board"><div class="crew-cars" aria-label="各車輛狀態">${carLabels}</div><div class="crew-dice" aria-label="骰子${!p.dice.length?'，等待擲骰':p.dice.some(d=>!d.used)?'，尚有可用骰':'，本輪已用完'}">${p.dice.length?p.dice.map(d=>`<span class="mini-die ${d.used?'used':''}" aria-label="${d.value} 點，${d.used?'已用':'可用'}">${d.value}${d.used?'<i aria-hidden="true">×</i>':''}</span>`).join(''):'<span class="crew-dice-wait">等待擲骰</span>'}</div></div></article>`;
}
function heli(color){return `<g><ellipse rx="19" ry="8" fill="#0005" cy="8"/><path d="M-20,0H-5M-17,-6V6" stroke="${color}" stroke-width="4"/><ellipse rx="13" ry="8" fill="${color}" stroke="#e8e5c680"/><path d="M4,-5L11,-3V3L4,5Z" fill="#172720"/><path d="M-18,-17L18,17M-18,17L18,-17" stroke="#17221b" stroke-width="3"/></g>`;}
async function api(route,data){if(window.RaceLesson)return window.RaceLesson.api(route,data);return RoomApi.request(route,data,{code:session?.code,room:'race',session,onKicked:()=>{RoomHost.kicked(session);session=null;}});}
// The teaching engine mutates its event array before replacing it. Keep the last accepted snapshot independent.
function snapshotRaceState(s){return {...s,cars:s.cars.map(car=>({...car})),players:s.players.map(player=>({...player,chopper:player.chopper?{...player.chopper}:null})),tiles:s.tiles.map(tile=>({...tile,cells:tile.cells.map(row=>row.map(cell=>({...cell,...(cell.hazard?{hazard:{...cell.hazard}}:{})})))})),events:s.events.slice(),...(s.motions?{motions:s.motions.map(group=>({...group,moves:group.moves.map(move=>({...move,from:{...move.from},to:{...move.to}}))}))}:{})};}
function render(s){if(s.type!=='thunder'){toast('這個房間不是賽車遊戲');return;}if(state&&s.version<state.version)return;const previewFocus=captureMovementFocus();clearMovementPreview();window.hideTrackHover?.();const previous=state,canCue=motionGate.update(s,{connected:!disconnected}),latestId=previous?.events?.at(-1)?.id??-1,newEvents=canCue?s.events.filter(event=>event.id>latestId):[],oldCars=new Map(previous?.cars?.map(car=>[car.id,car])||[]),motionMoves=canCue&&immersion.allowsMotion()?s.cars.filter(car=>{const before=oldCars.get(car.id);return before&&before.x!==null&&car.x!==null&&(before.x!==car.x||before.y!==car.y);}).map(car=>({from:oldCars.get(car.id),to:car})):[],collision=canCue&&immersion.allowsMotion()?newEvents.find(event=>event.kind==='slam'):null,finishTransition=canCue&&previous.phase!=='finished'&&s.phase==='finished';state=snapshotRaceState(s);document.body.dataset.racePhase=s.phase;RoomHost.update(s,render);$('#connection').textContent='● 已連線';$('#roomTitle').textContent=s.name;$('#round').textContent=String(s.round||0).padStart(2,'0');$('#roadDie').textContent=s.roadDie?'+'+s.roadDie:'—';$('#roomCode').textContent=s.code;$('#waiting').hidden=s.phase!=='waiting';$('#racePlay').hidden=s.phase==='waiting';$('#hostButtons').hidden=!s.host;$('#start').disabled=s.players.length<2;$('#devilsRun').value=String(!!s.options?.devilsRun);$('#modeSummary').textContent=s.options?.devilsRun?'惡魔賽道 · 地形／危險試玩':'主遊戲 · 自製賽道';$('#bot').disabled=s.players.length>=4;$('#crewCount').textContent=s.players.length+'/4';$('#racePhase').textContent=({assign:'分配',move:'移動',bonus:'加速',shoot:'射擊',airplace:'部署',airshoot:'空襲',finished:'結算'})[s.phase]||'等待';$('#waitHint').textContent=s.host?'至少 2 支車隊即可開始；也能加入電腦練習。':'等待房主開始比賽';
 if(!canCue)racePresentation=null;
 GameShell.stableMarkup($('#crews'),Array.from({length:4},(_,i)=>crewCard(s,s.players[i])).join(''));
 $('#feed').innerHTML=s.log.map(t=>`<div>${esc(t)}</div>`).join('');
 if(s.phase==='waiting'){racePresentation=null;diceDialog.show(s,{live:canCue});eventCues.hide();vehicleEffects.reset();raceMovement.reset();return;}
 renderBoard(motionMoves,collision,newEvents,canCue,previous);
 vehicleEffects.show(newEvents.filter(event=>!raceMovement.claims(event.id)),s,{min:raceMovement.view(s).min});
 const pending=racePresentation||{previous,canCue,newEvents:[],finishTransition:false,previewFocus,deferred:false};
 pending.canCue=canCue;pending.newEvents=[...new Map([...pending.newEvents,...newEvents].map(event=>[event.id,event])).values()].slice(-64);pending.finishTransition||=finishTransition;pending.previewFocus=previewFocus;
 if(raceMovement.locked()){
  pending.deferred=true;racePresentation=pending;diceDialog.reset();if(!raceMovement.inCue())eventCues.hide();$('#winner').hidden=true;$('#racePhase').textContent=raceMovement.inCue()?'事件處理中':'移動中';renderDash();
  if(window.RaceLesson)window.RaceLesson.onMotion?.();
 }else{racePresentation=null;presentRaceState(s,pending);}
 tick();
}
function finishRacePresentation({cancelled=false}={}){
 const pending=racePresentation;if(!pending||!state)return;racePresentation=null;
 renderBoard([],null,[],false);
 if(cancelled){pending.canCue=false;pending.newEvents=[];pending.finishTransition=false;pending.deferred=false;}
 presentRaceState(state,pending);
}
function showRaceCheckpoint({events,duration}){
 if(!state||document.hidden||!MotionPolicy.allowsMotion())return;
 const visual=raceMovement.view(state);
 vehicleEffects.show(events,state,{min:visual.min});
 if(duration>0){$('#racePhase').textContent='事件處理中';eventCues.show(events,visual.cars,{duration,onSkip:()=>raceMovement.skipCue()});renderDash();}
 immersion.playSound('reveal');
}
function showRaceMotion(group){
 if(!state||document.hidden||!MotionPolicy.allowsMotion())return;
 eventCues.hide();$('#racePhase').textContent='移動中';renderDash();
 const events=(group.moves||[]).filter(move=>move.car).map(move=>({id:'motion:'+group.id+':'+move.car,kind:'motion',motion:group.kind,car:move.car}));
 vehicleEffects.show(events,state,{min:raceMovement.view(state).min});
}
function presentRaceState(s,{previous,canCue,newEvents,finishTransition,previewFocus,deferred}){
 newEvents=newEvents.filter(event=>!raceMovement.claims(event.id));
 diceDialog.show(s,{live:canCue,deferred});$('#racePhase').textContent=({assign:'分配',move:'移動',bonus:'加速',shoot:'射擊',airplace:'部署',airshoot:'空襲',finished:'結算'})[s.phase]||'等待';
 vehicleEffects.show([],s,{min:raceMovement.view(s).min});if(canCue&&!finishTransition&&!window.RaceLesson&&!s.diceCheck)eventCues.show(newEvents,s.cars);else eventCues.hide();renderDash();if(previous?.diceCheck&&!s.diceCheck){$('#instruction').tabIndex=-1;$('#instruction').focus({preventScroll:true});}$('#lastEvent').textContent=s.log[0]||'準備就緒';$('#roadStatus').textContent=s.finishAt!==null?'終點已出現 · 第一輛抵達的車獲勝':'道路分後、中、前三段 · 超過前段時接新路並移除後段';$('#winner').hidden=s.phase!=='finished';if(s.winner)$('#winner').innerHTML=`<h2>⚑ ${esc(s.winner.name)}${s.winner.id?' 獲勝！':''}</h2><p>${esc(s.winner.reason)}</p>${s.host?'<button data-action="restart" class="button orange">再比一場 ↗</button>':'等待房主開始下一場'}`;const focusItems=s.winner?[s.winner.name+' · '+s.winner.reason]:[];immersion.prepareFocus(focusItems);if(previous?.phase==='finished'&&s.phase!=='finished'){immersion.stopFocus();$('#raceAchievementNotice').hidden=true;}if(finishTransition){immersion.startFocus(focusItems);immersion.playSound('reveal');checkRaceAchievements();}else if(newEvents.some(event=>['slam','shot','damage','eliminated','hazard','trap','quake','jump','fire','fireDie','airstrike'].includes(event.kind)))immersion.playSound('reveal');tick();if(window.RaceLesson)window.RaceLesson.onRender();restoreMovementPreview(previewFocus);
}
function renderBoard(motionMoves=[],collision=null,newEvents=[],live=false,previous=null){const s=state;raceMovement.prepare(s,newEvents,motionMoves,{live,previous});const impacted=new Set();for(const event of newEvents){if(raceMovement.claims(event.id))continue;if(event.kind==='slam'){if(event.car)impacted.add(event.car);if(event.other)impacted.add(event.other);}else if(event.kind==='shot'&&event.hit&&event.target)impacted.add(event.target);else if(['damage','hazard','trap','fire','quake'].includes(event.kind)&&event.car)impacted.add(event.car);}const visual=raceMovement.view(s),min=visual.min,own=s.actor===s.me&&!raceMovement.locked();movementRoutes=own?RacePaths.routes(s):new Map();const pos=(x,y)=>({X:48+(y-min)*44+(x%2)*22,Y:81+x*44});let svg='<svg viewBox="0 0 1180 398" xmlns="http://www.w3.org/2000/svg" aria-label="賽道：向右前進，點擊亮起的格子移動"><defs><pattern id="grain" width="11" height="13" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".8" fill="#201b1240"/><circle cx="9" cy="11" r=".6" fill="#e7ca8130"/></pattern></defs><g class="race-world">';
 for(const [ti,t]of visual.tiles.entries()){svg+=`<text x="${44+ti*352}" y="24" class="map-label">${String(Math.floor(t.start/8)+1).padStart(2,'0')} / ${esc(t.name)}</text><text x="${44+ti*352}" y="43" class="map-index">${['後段','中段','前段'][ti]||'新路段'}</text>`;for(let x=0;x<6;x++)for(let j=0;j<8;j++){const y=t.start+j,c=t.cells[x][j],p=pos(x,y),haz=c.hazard,kind=haz?.face?({mud:'M',road:'R',oil:'R',glass:'V',ramp:'J',fire:'F',pit:'X'}[haz.kind]||c.kind):c.kind;const occupied=s.cars.some(v=>!v.dead&&v.x===x&&v.y===y),chop=s.players.some(v=>v.chopper?.x===x&&v.chopper?.y===y);const legal=own&&!s.pending&&(s.phase==='move'&&movementRoutes.has(RacePaths.key(x,y))||s.phase==='airplace'&&kind!=='X'&&!haz&&!occupied&&!chop);const color={R:'#777869',O:'#b59961',M:'#594431',X:'#675144',G:'#405f32',V:'#377883',J:'#985b32',F:'#a53f23',S:'#b6b6a0'}[kind];const name={R:'道路',O:'荒地',M:'泥地',X:'障礙',G:'毒液（停止）',V:'玻璃（沿方向滑一格）',J:'跳台（正後方進入）',F:'火焰（著火）',S:'鹽灘（公路加速資格）'}[kind];svg+=`<g transform="translate(${p.X},${p.Y})" data-x="${x}" data-y="${y}" ${legal?'tabindex="0" role="button"':''} class="cell-interactive" aria-label="${y+1}段 第${x+1}車道 ${name}${legal?' 可前往':''}${legal&&s.phase==='move'?'，預計消耗 '+movementRoutes.get(RacePaths.key(x,y)).cost+' 點':''}"><polygon class="hex ${legal?'legal':''} ${legal&&s.phase==='move'&&!s.legalMoves.some(v=>v.x===x&&v.y===y)?'multi-legal':''}" points="-22,-14 0,-28 22,-14 22,14 0,28 -22,14" fill="${color}"/><polygon points="-22,-14 0,-28 22,-14 22,14 0,28 -22,14" fill="url(#grain)" pointer-events="none"/>`;
 if(kind==='R')svg+='<path d="M-17,-18L-7,-22M8,22L17,18" stroke="#e4d2a750" stroke-width="1" pointer-events="none"/>';if(kind==='X')svg+='<path d="M-16,11L-12,-10L2,-19L17,-6L12,15L-5,20Z" fill="#493f35" stroke="#c0a25d" stroke-width="2" pointer-events="none"/><path d="M2,-19L0,5L12,15M0,5L-16,11" stroke="#88715a" fill="none" pointer-events="none"/>';if(kind==='M')svg+='<path d="M-14,-7Q0,-16 12,-3M-12,6Q0,17 13,6" stroke="#96704b70" stroke-width="3" fill="none" pointer-events="none"/>';
 if(['G','V','J','F','S'].includes(kind))svg+=`<text class="cell-symbol terrain-symbol" fill="#fff2ce" y="1">${{G:'☣',V:'◇',J:'↟',F:'♨',S:'✧'}[kind]}</text>`;
 if(haz){const symbol=haz.face?{road:'✓',mud:'≈',oil:'◉',mine:'✹',wreck:'▰',glass:'◇',ramp:'↟',fire:'♨',pit:'⊗',quake:'≋',worm:'〰'}[haz.kind]:'⚠';svg+=`<text class="cell-symbol" fill="${haz.face?'#edcb8b':'#ffcf77'}" y="1">${symbol}</text>`;}svg+='</g>';}}
 for(let ti=1;ti<visual.tiles.length;ti++){const bx=48+(visual.tiles[ti].start-min)*44-22;let d=`M ${bx} 53`;for(let lane=0;lane<6;lane++){const x=bx+(lane%2)*22,y=81+lane*44;d+=` L ${x} ${y-14} L ${x} ${y+14}`;}svg+=`<g class="road-boundary" pointer-events="none" aria-label="${ti===1?'後段與中段分界':'中段與前段分界'}"><path d="${d}" fill="none" stroke="#15221c" stroke-width="7"/><path d="${d}" fill="none" stroke="#ffe0a0" stroke-width="2.5" stroke-dasharray="8 5"/><path d="M ${bx+11} 46 V 52 M ${bx+11} 329 V 343" stroke="#ffe0a0" stroke-width="2.5"/></g>`;}
 if(s.finishAt!==null)svg+='<g transform="translate('+((48+(s.finishAt-min)*44+16)-1120)+',0)"><rect x="1120" y="55" width="33" height="280" fill="#d9cfb3"/><path d="M1120,55h16v16h17v16h-17v16h17v16h-17v16h17v16h-17v16h17v16h-17v16h17v16h-17v16h17v16h-17v16h17v16h-17v16h17v16h-17v16h17v16h-33Z" fill="#273225"/><text x="1136" y="360" text-anchor="middle" fill="#f9d58d" font-size="11">FINISH</text></g>';
 for(const v of [...movementRoutes.values()].filter(v=>v.y>=min+24&&own&&!s.pending)){const p=pos(v.x,v.y);svg+=`<g data-x="${v.x}" data-y="${v.y}" tabindex="0" role="button" aria-label="前進到${s.finishAt?'終點':'新路段'}"><rect x="${p.X-20}" y="${p.Y-20}" width="38" height="38" rx="5" fill="#776943" stroke="#ffe68c" stroke-width="3"/><text x="${p.X}" y="${p.Y+5}" text-anchor="middle" fill="#ffe68c">→</text></g>`;}
 for(const movement of motionMoves){const event=newEvents.find(e=>e.kind==='movePath'&&e.car===movement.to.id),points=[movement.from,...(event?.steps||[movement.to])].map(v=>pos(v.x,v.y));svg+='<polyline class="race-move-trail" fill="none" points="'+points.map(p=>p.X+','+p.Y).join(' ')+'"/>'; }if(collision&&Number.isInteger(collision.x)&&Number.isInteger(collision.y)){const point=pos(collision.x,collision.y);svg+='<circle class="race-collision-ring" cx="'+point.X+'" cy="'+point.Y+'" r="9"/>'; }
 for(const c of visual.cars){if(c.dead&&!c.motionGhost||c.x===null)continue;const p=pos(c.x,c.y),owner=s.players.find(v=>v.id===c.owner),active=c.id===s.active?.car,target=s.targets.includes(c.id);svg+=`<g transform="translate(${p.X},${p.Y})" class="map-car ${active?'active-car':''} ${target?'target':''} ${c.damage.length>=2?'disabled-car':''}" data-car="${c.id}" role="button" tabindex="0" aria-label="${esc(owner?.name||'殘骸')} ${sizes[c.size]} ${c.damage.length}損傷"><title>${esc(owner?.name||'殘骸')} · ${sizes[c.size]} · ${c.damage.length} 損傷</title><g class="race-car-motion">${active?'<circle r="23" stroke="#ffdd80" stroke-width="2" fill="none"/>':''}${target?'<circle r="23" stroke="#ff8066" stroke-width="2" stroke-dasharray="4 3" fill="none"/>':''}<g class="${impacted.has(c.id)?'race-car-impact':''}">${vehicle(c.size,owner?.color||'#605d52',c.damage.length>=2)}</g><text y="21" font-size="9" text-anchor="middle" fill="#fff0d0">${c.wreck?'':sizes[c.size][0]}${c.burning?' 🔥':''}${c.damage.length?' '+Array(c.damage.length).fill('×').join(''):''}</text></g></g>`;}
 for(const p of visual.players)if(p.chopper){const v=pos(p.chopper.x,p.chopper.y);svg+=`<g class="map-chopper" data-player="${p.id}" transform="translate(${v.X},${v.Y})"><g class="race-car-motion">${heli(p.color)}</g></g>`;}
 svg+='</g><text x="32" y="379" fill="#c1af82" font-size="11" letter-spacing="3">RUN. GUN. SURVIVE.</text><text x="1115" y="379" text-anchor="end" fill="#ae9e75" font-size="10">數位原創賽道 / 6 LANES</text></svg>';$('#track').innerHTML=svg;
 raceMovement.attach($('#track svg'),min);
}
function commandAccepts(kind,value){return kind==='nitro'?value>=1&&value<=3:kind==='drift'?value>=3&&value<=5:kind==='repair'?value===6:kind==='airstrike';}
const commandChoices=[['nitro','⚡ 氮氣加速 · 骰子 1–3'],['drift','↝ 甩尾穿越 · 骰子 3–5'],['repair','⚒ 維修 · 骰子 6'],['airstrike','✣ 直升機空襲 · 任意骰']];
function commandUnavailableReason(kind,player,cars,car){
 if(player.commandUsed)return '本輪已使用指令';
 if(!car)return '請先選擇可用車輛';
 if(car.moved)return '滑行不能使用指令';
 const unused=player.dice.filter(d=>!d.used);
 if(unused.length<2)return '需要兩顆未使用骰子';
 if(!unused.some(d=>commandAccepts(kind,d.value)))return '沒有符合點數的骰子';
 if(kind==='repair'&&!cars.some(c=>c.owner===player.id&&!c.dead&&c.damage.length))return '沒有可維修的車輛';
 return '';
}
function normalizeCommandSelection(player,cars,car,die,kind,otherDie){
 if(!player.dice[die]||player.dice[die].used)die=player.dice.findIndex(d=>!d.used);
 if(!kind||commandUnavailableReason(kind,player,cars,car))return {die,command:'',commandDie:null};
 if(otherDie===null||otherDie===die||!player.dice[otherDie]||player.dice[otherDie].used||!commandAccepts(kind,player.dice[otherDie].value)){
  otherDie=player.dice.findIndex((d,i)=>!d.used&&i!==die&&commandAccepts(kind,d.value));
  // Preserve valid dice combinations when the only matching die was picked for movement.
  if(otherDie<0){otherDie=die;die=player.dice.findIndex((d,i)=>!d.used&&i!==otherDie);}
 }
 return {die,command:kind,commandDie:otherDie};
}
function commandOptionsMarkup(player,cars,car,selected){
 return '<option value="">不使用指令</option>'+commandChoices.map(([kind,label])=>{
  const reason=commandUnavailableReason(kind,player,cars,car);
  return `<option value="${kind}" ${selected===kind?'selected':''} ${reason?'disabled':''}>${label}${reason?'（'+reason+'）':''}</option>`;
 }).join('');
}
const usedCommandHistory=new Map();
function usedCommandUI(){
 const used=usedCommandHistory.get(`${state.code}:${state.me}:${state.round}`),names={nitro:'⚡ 氮氣加速',drift:'↝ 甩尾穿越',repair:'⚒ 維修',airstrike:'✣ 直升機空襲'};
 return `<p class="command-spent">本輪指令已使用${used?'：'+esc(names[used.command])+' · 第 '+(used.die+1)+' 顆／'+used.value+' 點':''}</p>`;
}
function renderDash(){
 const focused=document.activeElement,focusId=focused?.id,focusCar=focused?.dataset?.selectCar,focusDie=focused?.dataset?.die,commandOpen=$('.race-command-options')?.open;
 const p=state.players.find(p=>p.id===state.me),key=`${state.code}:${state.me}:${state.round}`;
 if(!p.commandUsed)usedCommandHistory.delete(key);
 else if(command&&p.dice[commandDie]?.used&&!usedCommandHistory.has(key))usedCommandHistory.set(key,{command,die:commandDie,value:p.dice[commandDie].value});
 renderDashContent();
 $('#raceActionSlot').setAttribute('aria-busy',String(busy||raceMovement.locked()));
 if(raceMovement.locked())for(const control of $('#raceActionSlot').querySelectorAll('button,select'))control.disabled=true;
 for(const button of $('#controlPanel').querySelectorAll('button[data-action]'))window.GameUI?.decorateButton(button,({begin:'play',focus:'next',bonusYes:'next',bonusNo:'next',skipShot:'next',keep:'check',reroll:'refresh',restart:'replay'})[button.dataset.action]);
 if(p.commandUsed&&state.phase!=='finished'&&!$('#controlPanel .command-spent'))$('#controlPanel').insertAdjacentHTML('beforeend',usedCommandUI());
 const commandOptions=$('.race-command-options');if(commandOptions){window.GameUI?.bindPopover?.(commandOptions,commandOptions.querySelector('.command-wrap'),{align:'start',width:360});if(commandOpen)commandOptions.open=true;}
 const replacement=focusId?document.getElementById(focusId):focusCar?document.querySelector(`[data-select-car="${focusCar}"]`):focusDie!==undefined?document.querySelector(`[data-die="${focusDie}"]`):null;
 if(replacement&&replacement!==focused&&!replacement.disabled)replacement.focus({preventScroll:true});
}
function renderDashContent(){if(raceMovement.locked()){const cue=raceMovement.inCue?.();$('#instruction').textContent=cue?'事件處理中':'車輛移動中';$('#controlPanel').innerHTML=cue?'<p role="status">先處理目前事件，再繼續移動；可略過事件提示。</p>':'<p role="status">等待車輛抵達後繼續…</p>';return;}const tips={assign:'先點一輛還沒動過的可用車，再選骰子。指令是選用的，必須花另一顆骰子；確認後才會開始移動。',move:'亮框可選多格目標；滑鼠停留會預覽優先避障路線。也可照常逐格走。泥地要 2 點；未知危險、檢定或道路更新會停下重新選路，剩餘點數仍需完成。',bonus:'你取得公路加速資格。可以拒絕；若接受，就必須走完公路骰提供的點數，途中可以離開公路。',airplace:'先把直升機放到亮框空格。回合結束時，任何停在直升機同格的車都會淘汰，包含你的車。',airshoot:'選前方三格的一輛車，或略過射擊；之後才輪到你選的車移動。第一輪禁止射擊。',shoot:'可以點前方目標射擊，或略過。射擊骰必須符合目標車型才命中，重型車較容易被打中。',finished:'這場已結束。房主可以再比一場；想換遊戲就回大廳。'};$('#rookieTip').textContent=state.pending?'先看哪輛車被推、推往哪裡。較大車的車主可選擇保留，或把兩顆骰子一起重擲一次；重擲結果必須接受。':state.actor!==state.me?'現在輪到其他車隊。觀察它的選骰和路線；輪到你時，下方會出現操作按鈕。':tips[state.phase]||'等房主開始，再依提示操作。';const s=state,p=s.players.find(p=>p.id===s.me),own=s.actor===s.me,assign=own&&s.phase==='assign'&&!s.pending;const cars=s.cars.filter(c=>c.owner===s.me);if(!s.available.includes(selectedCar))selectedCar=s.available[0]||null;const selection=normalizeCommandSelection(p,cars,cars.find(c=>c.id===selectedCar),selectedDie,command,commandDie);selectedDie=selection.die;command=selection.command;commandDie=selection.commandDie;if(!repairCar||!cars.some(c=>c.id===repairCar&&!c.dead&&c.damage.length))repairCar=cars.find(c=>!c.dead&&c.damage.length)?.id||null;
 GameShell.stableMarkup($('#carDash'),cars.map(c=>`<button class="car-card ${c.id===selectedCar&&assign?'selected':''}" data-select-car="${c.id}" aria-label="${sizes[c.size]}戰車，${c.damage.length} 損傷" aria-pressed="${c.id===selectedCar&&assign}" ${!assign||!s.available.includes(c.id)?'disabled':''}><svg viewBox="-30 -23 60 46">${vehicle(c.size,p.color,c.damage.length>=2)}</svg><div><b>${sizes[c.size]}${c.burning?' 🔥':''}</b><small>${c.dead?'已淘汰':c.damage.length>=2?'需維修':c.x===null?'起跑區':c.moved?'已行動':'可行動'}</small></div><span class="damage-pips">${'●'.repeat(c.damage.length)}${'○'.repeat(2-c.damage.length)}</span></button>`).join(''));
 if(s.phase==='finished'){$('#instruction').textContent='比賽結束';$('#controlPanel').innerHTML='<p class="spectate">可以由房主開始下一場，或回到大廳換個遊戲。</p>';return;}
 if(s.diceCheck){$('#instruction').textContent=s.diceCheck.status==='rolling'?'擲骰中…':s.diceCheck.title;$('#controlPanel').innerHTML='<p class="track-instruction">請看擲骰視窗；結果確認後繼續。</p>';return;}if(s.pending){const who=s.players.find(p=>p.id===s.actor);$('#instruction').textContent=own?'碰撞：保留或重擲':`等待 ${who?.name} 決定碰撞`;$('#controlPanel').innerHTML=`<div class="slam-choice"><h3>⚡ ${s.pending.topMoves?'進入格子的車':'原本在格子的車'} → ${directions[s.pending.direction]}</h3><p>可保留結果，或重擲兩顆骰子一次。</p>${own?'<button class="button orange" data-action="keep">保留結果</button><button class="button outline" data-action="reroll">重擲骰子</button>':''}</div>`;return;}
 if(!own){$('#instruction').textContent=p.out?'你的車隊已出局，繼續觀戰':`${s.players[s.turn]?.name} 正在行動`;$('#controlPanel').innerHTML='<p class="spectate">其他玩家的車輛、骰子與碰撞結果會即時同步。</p>';return;}
 if(assign){const c=cars.find(c=>c.id===selectedCar),coast=c?.moved;if(coast)command='';$('#instruction').textContent=coast?'所有可用車已移動：選一輛滑行 1 格':'選擇車輛與移動骰';const choices=p.dice.map((d,i)=>`<button class="die-button ${i===selectedDie?'selected':''} ${command&&i===commandDie?'reserved':''}" data-die="${i}" ${d.used||(command&&i===commandDie)?'disabled':''} aria-label="移動骰 ${i+1}，${d.value} 點${command&&i===commandDie?'，已分配給指令':''}">${dice[d.value-1]}${command&&i===commandDie?'<small>指令用</small>':''}</button>`).join('');const commands=p.commandUsed?usedCommandUI():coast?'':`<div class="command-wrap"><div class="command-choice"><label for="command">本輪指令（選用）</label><select id="command">${commandOptionsMarkup(p,cars,c,command)}</select></div>${command?`<div class="command-die-slot"><label for="commandDie">指令使用另一顆骰子</label><select id="commandDie">${commandDie<0?'<option value="-1" selected disabled>請選擇指令骰</option>':''}${p.dice.map((d,i)=>!d.used?`<option value="${i}" ${i===commandDie?'selected':''} ${!commandAccepts(command,d.value)||(i===selectedDie&&!p.dice.some((other,j)=>j!==i&&!other.used))?'disabled':''}>第 ${i+1} 顆 · ${d.value} 點${!commandAccepts(command,d.value)?'（不符指令）':i===selectedDie?'（目前移動骰）':''}</option>`:'').join('')}</select></div>`:'<div class="command-die-slot"><label>指令使用另一顆骰子</label><select disabled aria-label="指令骰，請先選擇指令"><option>請先選擇指令</option></select></div>'}${command==='repair'?`<div><label>維修目標</label><select id="repairCar">${cars.filter(c=>!c.dead&&c.damage.length).map(c=>`<option value="${c.id}" ${c.id===repairCar?'selected':''}>${sizes[c.size]} · ${c.damage.length} 損傷</option>`).join('')}</select></div>`:''}</div>`;$('#controlPanel').innerHTML=`<div class="assign-controls"><div><label>${coast?'滑行骰':'移動骰'}</label><div class="dice-select">${choices}</div></div>${commands&&!p.commandUsed?`<details class="race-command-options"><summary>${command?esc(({nitro:"氮氣加速",drift:"甩尾穿越",repair:"維修",airstrike:"空襲"})[command]):"指令（選用）"}</summary>${commands}</details>`:commands}<button class="button orange" data-action="begin" ${!selectedCar||!p.dice[selectedDie]||p.dice[selectedDie].used||(command&&commandDie<0)?'disabled':''}>${coast?'滑行 1 格':'確認出發'}</button></div>`;return;}
 if(s.phase==='move'){$('#instruction').textContent=`移動中 · 剩餘 ${s.active.remaining} 點` ;$('#controlPanel').innerHTML='<div class="step-controls"><p id="raceRouteHint" class="track-instruction race-route-hint" role="status">滑鼠停留或鍵盤選取亮框，可預覽路線。鄰格仍可逐格走。</p><button class="button outline" data-action="focus">定位行動車</button></div>';}
 else if(s.phase==='bonus'){$('#instruction').textContent=s.active.saltBonus?'鹽灘加速機會':'公路加速機會';$('#controlPanel').innerHTML=`<div class="step-controls"><p>可選擇再走 <b>${s.roadDie}</b> 點；選擇後必須走完。</p><button class="button orange" data-action="bonusYes">加速 +${s.roadDie}</button><button class="button outline" data-action="bonusNo">略過加速</button></div>`;}
 else if(s.phase==='airplace'){$('#instruction').textContent='部署直升機';$('#controlPanel').innerHTML='<div class="step-controls"><p>點擊賽道上的亮框空格部署。直升機會朝前射擊，回合結束時消滅同格車輛。</p></div>';}
 else if(s.phase==='shoot'||s.phase==='airshoot'){$('#instruction').textContent=s.phase==='airshoot'?'直升機射擊':'選擇射擊目標';$('#controlPanel').innerHTML=`<div class="step-controls"><p>點擊前方目標，或略過射擊。</p>${s.targets.length?`<div class="shot-targets" aria-label="可射擊目標">${s.targets.map(id=>{const c=s.cars.find(c=>c.id===id),owner=s.players.find(p=>p.id===c.owner);return `<button class="button outline shot-target" data-target="${id}">${esc(owner?.name||'殘骸')} ${sizes[c.size]} ↗</button>`;}).join('')}</div>`:''}<button class="button outline" data-action="skipShot">略過射擊</button></div>`;}}
function tick(){if(window.RaceLesson)return;if(!state)return;$('#timer').textContent=['waiting','finished'].includes(state.phase)?'':`${Math.max(0,Math.ceil((state.deadline-Date.now())/1000))} 秒`;$('#timer').setAttribute('aria-label',`${state.actor===state.me?'你的操作時間':'等待操作'} ${$('#timer').textContent}`);}
function raceFeedback(message,kind='info'){const node=$('#raceActionStatus');node.textContent=message;node.dataset.kind=kind;window.GameUI?.setStatus(node,message,{kind});}
async function run(route,data={}){if(busy||raceMovement.locked())return false;clearMovementPreview();busy=true;const trigger=document.activeElement?.closest?.('button');if(trigger)window.GameUI?.setBusy(trigger,true);$('#raceActionSlot').setAttribute('aria-busy','true');raceFeedback('正在送出…');try{const before=state?.events?.at(-1)?.id??Infinity,s=await api(route,data);lastVersion=s.version;render(s);raceFeedback('操作已完成。','success');if(route==='action'&&s.phase!=='finished'&&!s.events.some(event=>event.id>before&&['slam','shot','damage','eliminated','hazard','trap','quake','jump','fire','fireDie','airstrike'].includes(event.kind)))immersion.playSound('confirm');return true;}catch(e){raceFeedback(e.message,'error');toast(e.message);return false;}finally{busy=false;$('#raceActionSlot').setAttribute('aria-busy',String(raceMovement.locked()));if(trigger)window.GameUI?.setBusy(trigger,false);}}
async function refresh(){if(!session||busy||polling)return;polling=true;try{const s=await api('state'),presence=s.players.map(player=>player.online).join(',');$('#connection').textContent='● 已連線';if(s.version>lastVersion||!state||presence!==onlineSignature||disconnected){lastVersion=s.version;onlineSignature=presence;render(s);}else{motionGate.update(s,{connected:!disconnected});GameShell.update(s);}if(disconnected){toast('已重新連線，恢復原座位');disconnected=false;}}catch(e){disconnected=true;$('#connection').textContent='重新連線中';if(/找不到房間|連線已失效/.test(e.message)){localStorage.removeItem('ah-thunder:'+session.code);localStorage.removeItem('ah-thunder');session=null;$('#waiting').innerHTML='<div class="garage-info"><h2>這個房間已結束</h2><p>伺服器重啟後，請重新建立房間。</p><a class="button orange" href="/">回到大廳</a></div>';$('#waiting').hidden=false;$('#racePlay').hidden=true;}}finally{polling=false;}}
document.addEventListener('change',e=>{if(e.target.disabled||busy||raceMovement.locked())return;if(e.target.id==='devilsRun'){run('settings',{devilsRun:e.target.value==='true'});return;}if(e.target.id==='command'){command=e.target.value;renderDash();}if(e.target.id==='commandDie'){const i=Number(e.target.value),p=state.players.find(p=>p.id===state.me);if(p.dice[i]&&!p.dice[i].used&&commandAccepts(command,p.dice[i].value)){if(i===selectedDie){const replacement=commandDie!==null&&commandDie!==i&&p.dice[commandDie]&&!p.dice[commandDie].used?commandDie:p.dice.findIndex((d,j)=>j!==i&&!d.used);if(replacement<0)return;selectedDie=replacement;}commandDie=i;renderDash();}}if(e.target.id==='repairCar')repairCar=e.target.value;});
document.addEventListener('click',e=>{const t=e.target.closest('[data-action],[data-die],[data-select-car],[data-target]');if(!t||t.disabled||busy||raceMovement.locked())return;if(t.dataset.die!==undefined){selectedDie=Number(t.dataset.die);renderDash();return;}if(t.dataset.selectCar){selectedCar=t.dataset.selectCar;renderDash();return;}if(t.dataset.target){run('action',{action:'shoot',target:t.dataset.target});return;}const a=t.dataset.action;if(a==='begin')run('action',{action:'begin',car:selectedCar,die:selectedDie,command,commandDie,repairCar});else if(a==='keep'||a==='reroll')run('action',{action:'slam',reroll:a==='reroll'});else if(a==='bonusYes'||a==='bonusNo')run('action',{action:'bonus',use:a==='bonusYes'});else if(a==='skipShot')run('action',{action:'shoot'});else if(a==='restart')run('start');else if(a==='focus'){const c=state.cars.find(c=>c.id===state.active?.car),x=c?.x===null?0:48+((c?.y||0)-state.tiles[0].start)*44;$('#boardScroll').scrollTo({left:Math.max(0,x-$('#boardScroll').clientWidth/2),behavior:'smooth'});}});
function boardClick(e){if(document.body.classList.contains('lesson-readonly'))return;if(!state||busy||raceMovement.locked()||state.actor!==state.me||state.pending||state.diceCheck)return;const car=e.target.closest('[data-car]');if(car){if(state.targets.includes(car.dataset.car)){run('action',{action:'shoot',target:car.dataset.car});return;}if(state.phase==='assign'&&state.available.includes(car.dataset.car)){selectedCar=car.dataset.car;renderDash();return;}if(state.phase==='move'){const c=state.cars.find(c=>c.id===car.dataset.car);moveToTarget(c.x,c.y);}return;}const cell=e.target.closest('[data-x]');if(!cell)return;const x=Number(cell.dataset.x),y=Number(cell.dataset.y);if(state.phase==='move')moveToTarget(x,y);else if(state.phase==='airplace')run('action',{action:'airplace',x,y});}
$('#track').onclick=boardClick;
bindMovementPreview($('#track'));
MotionPolicy.subscribe(()=>{if(!MotionPolicy.allowsMotion())stopPathMotion();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){movementPointer=null;stopPathMotion();clearMovementPreview();}});
window.addEventListener('pagehide',()=>{movementPointer=null;stopPathMotion();clearMovementPreview();});$('#track').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();boardClick(e);}};$('#start').onclick=()=>run('start');$('#bot').onclick=()=>run('bot');$('#invite').onclick=async()=>{if(!session)return;const text=`${invite}/race/${session.code}\n雷霆之路房間：${session.code}\n先連上相同的 Radmin VPN 網路。`;try{await navigator.clipboard.writeText(text);toast('已複製邀請');}catch{window.prompt('複製以下邀請資訊',text);}};if(!window.RaceLesson)fetch('/api/info').then(r=>r.json()).then(d=>invite=d.preferred||d.addresses.find(a=>a.includes('://26.'))||location.origin).catch(()=>{});function beginLive(){refresh();setInterval(refresh,700);setInterval(tick,250);}if(window.RaceLesson){window.RaceLesson.mount({render,isMoving:()=>raceMovement.locked(),resetSelection(){racePresentation=null;raceMovement.reset();motionGate.dispose();motionGate=MotionPolicy.createGate();state=null;vehicleEffects.reset();diceDialog.reset();selectedCar=null;selectedDie=null;command='';commandDie=null;repairCar=null;}});}else if(!session){if(requestedRoom)RoomReconnect.restore(requestedRoom,'thunder','#connection').then(restored=>{if(restored){session=restored;beginLive();}});else location.replace('/');}else beginLive();



// Delayed terrain help uses only the public room view (never hidden hazard faces).
(()=>{
 const track=$('#track'),tip=document.createElement('div');tip.id='trackTooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
 let timer,leaveTimer,anchor=null;
 const terrain={R:['公路','進入花 1 點移動。全程行駛公路，可取得公路加速資格。'],O:['荒地','進入花 1 點移動。'],M:['泥地','進入花 2 點移動。'],X:['岩壁','進入就淘汰，不能用損傷槽抵擋。'],G:['毒液','進入花 1 點移動，並停止移動。'],V:['玻璃','進入花 1 點移動，再沿原方向滑行一格。'],J:['跳台','進入花 1 點移動。只能從正後方進入；其他方向進入會淘汰。'],F:['火焰','進入花 1 點移動，車輛會著火。'],S:['鹽灘','進入花 1 點移動，可取得公路骰加速資格（滑行除外）。']};
 function hide(){clearTimeout(timer);clearTimeout(leaveTimer);if(anchor)anchor.removeAttribute('aria-describedby');anchor=null;tip.hidden=true;}
 function withinTip(e){const r=tip.getBoundingClientRect();return !tip.hidden&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
 window.hideTrackHover=hide;
 function cellAt(el){const car=el.dataset.car&&state?.cars.find(c=>c.id===el.dataset.car);return car?{x:car.x,y:car.y}:{x:Number(el.dataset.x),y:Number(el.dataset.y)};}
 function show(el){
  if(anchor!==el||!el.isConnected||!state)return;
  const {x,y}=cellAt(el),index=state.tiles.findIndex(t=>y>=t.start&&y<t.start+8),tile=state.tiles[index],cell=tile?.cells[x]?.[y-tile.start];if(!cell)return;
  const h=cell.hazard,kind=h?.face?({mud:'M',road:'R',oil:'R',glass:'V',ramp:'J',fire:'F',pit:'X'}[h.kind]||cell.kind):cell.kind;
  const [name,effect]=h?.face&&h.kind==='pit'?['陷阱','進入時擲射擊骰；命中車型就淘汰。']:terrain[kind]||['地形','依本格效果結算。'];
  const hidden=h&&!h.face;
  tip.innerHTML=`<small>${['後段','中段','前段'][index]} · 第 ${x+1} 車道</small><strong>${esc(name)}${hidden?' · ⚠ 未知危險':''}</strong><p>${esc(effect)}</p>${hidden?'<p class="terrain-warning">進入才揭露危險，實際消耗與效果可能改變。</p>':''}`;
  if(h?.face)tip.innerHTML+=`<p class="terrain-warning">已揭露：${esc(({road:'公路',mud:'泥地',oil:'漏油',mine:'地雷',wreck:'殘骸',glass:'玻璃',ramp:'跳台',fire:'火焰',pit:'陷阱',quake:'地震',worm:'沙蟲'})[h.kind]||'危險')}。</p>`;
  tip.hidden=false;el.setAttribute('aria-describedby',tip.id);
  const view=window.visualViewport,left=view?.offsetLeft||0,top=view?.offsetTop||0,width=view?.width||window.innerWidth,height=view?.height||window.innerHeight;
  tip.style.maxHeight=Math.max(0,height-16)+'px';
  const r=el.getBoundingClientRect(),w=tip.offsetWidth,hgt=tip.offsetHeight,preferred=r.right+12+w<=left+width-8?r.right+12:r.left-w-12;
  tip.style.left=Math.max(left+8,Math.min(preferred,left+width-w-8))+'px';
  const positionTop=Math.max(top+8,Math.min(r.top,top+height-hgt-8));tip.style.top=positionTop+'px';
  tip.style.maxHeight=Math.max(0,top+height-8-positionTop)+'px';
 }
 function enter(e){clearTimeout(leaveTimer);if(e.pointerType==='touch'||e.buttons||withinTip(e))return;const el=e.target.closest?.('[data-x],[data-car]');if(el===anchor)return;hide();if(!el||!track.contains(el))return;anchor=el;timer=setTimeout(()=>show(el),500);}
 track.addEventListener('pointerover',enter);
 track.addEventListener('pointerout',e=>{if(anchor&&!anchor.contains(e.relatedTarget)&&!withinTip(e))leaveTimer=setTimeout(hide,180);});
 track.addEventListener('pointerdown',hide);
 document.addEventListener('pointermove',e=>{if(withinTip(e))clearTimeout(leaveTimer);else if(!tip.hidden&&!anchor?.contains(e.target)){clearTimeout(leaveTimer);leaveTimer=setTimeout(hide,180);}});
 // The tooltip is transparent to clicks. Coordinate-based scrolling keeps long
 // help readable without placing an interactive overlay over the next track cell.
 document.addEventListener('wheel',e=>{if(!withinTip(e)||tip.scrollHeight<=tip.clientHeight)return;const delta=e.deltaY*(e.deltaMode===1?24:e.deltaMode===2?tip.clientHeight:1),next=Math.max(0,Math.min(tip.scrollHeight-tip.clientHeight,tip.scrollTop+delta));if(next===tip.scrollTop)return;tip.scrollTop=next;clearTimeout(leaveTimer);e.preventDefault();},{passive:false});
 track.addEventListener('focusin',enter);track.addEventListener('focusout',hide);
 document.addEventListener('scroll',e=>{if(e.target!==tip)hide();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();else if(!tip.hidden&&anchor?.contains(document.activeElement)&&['PageUp','PageDown'].includes(e.key)&&tip.scrollHeight>tip.clientHeight){tip.scrollTop+=tip.clientHeight*(e.key==='PageDown'?1:-1);e.preventDefault();}});
 window.addEventListener?.('blur',hide);
 window.addEventListener?.('resize',hide);
})();



if(!window.RaceLesson&&session){document.querySelectorAll('a[href*="learn=1"]').forEach(a=>a.href='/race?learn=1&from=game&room='+session.code);if(location.pathname==='/race')window.history?.replaceState(null,'','/race/'+session.code);}


async function checkRaceAchievements(){try{const response=await fetch('/api/achievements');if(!response.ok)return;const data=await response.json(),unlocked=new Set(data.achievements.filter(item=>item.unlockedAt).map(item=>item.id));if(knownAchievements){const names=[['thunder-first-drive','公路初航'],['all-first-table','第一桌']].filter(([id])=>!knownAchievements.has(id)&&unlocked.has(id)).map(([,name])=>name);if(names.length){const notice=$('#raceAchievementNotice');notice.textContent='解鎖成就：'+names.join('、')+'。';const link=document.createElement('a');link.href='/achievements';link.textContent='查看收藏冊 ↗';notice.append(link);notice.hidden=false;}}knownAchievements=unlocked;}catch{}}
checkRaceAchievements();
