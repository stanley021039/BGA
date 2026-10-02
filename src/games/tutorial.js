/* Scenario controller shared by the browser lesson and its integration checks. */
(()=>{
const {ThunderRoom,neighbor,SHOT_DIE}=typeof module==='object'?require('./thunder'):TutorialEngine;
const missions=[
 {title:'看地形，繞過岩壁',goal:'用輕型車的 3 點移動，停在旗幟格。車輛必須存活。',why:'直走會撞上岩壁；上方泥地多花 1 點。觀察亮框，找出點數足夠的繞行路線。',hint:'選輕型車與 3 點骰。往畫面下方繞：前右 → 正前方 → 前左。',flag:{x:2,y:3},dice:[3,1,2,6]},
 {title:'公路能多跑多遠？',goal:'用 2 點移動，全程走公路，再使用 +2 公路骰，停在旗幟格。',why:'公路骰在原本移動結束後才選用。只要途中離開公路，就失去這次加速資格。',hint:'沿車輛同一條車道直走兩格，接受公路加速，再直走兩格。',flag:{x:2,y:5},dice:[2,1,4,6]},
 {title:'前面堵車，撞得開嗎？',goal:'用重型車撞上前方的輕型車，完成碰撞裁決。',why:'撞車會立刻失去剩餘移動。大車有一次重擲機會，但不是一定把小車撞走。',hint:'选重型車、3 點骰，直走進入敵車所在格；看清骰面，再決定保留或重擲。',dice:[3,1,2,6]},
 {title:'先走到射界，再開火',goal:'把輕型車移到敵方重型車後方，完成一次命中。',why:'射界是前方相鄰三格，不是畫面上所有車。移動的位置決定你能射誰。',hint:'選 1 點骰，正前方移動一格，再點紅框重型車。此關是第二輪，示範射擊固定為 L。',dice:[1,3,2,6]},
 {title:'救回失能隊友',goal:'用 6 點指令骰修復有兩個損傷的重型車，再完成輕型車的移動。',why:'不能直接選失能車移動；先讓另一輛可用車行動，利用它的指令步驟維修隊友。',hint:'選輕型車、2 點移動骰，再選「維修」與另一顆 6 點骰。確認後觀察重型車少一個損傷，再走兩格。',dice:[2,6,1,3]},
 {title:'把指令用在需要的時候',goal:'用 3 點移動骰加上 2 點氮氣指令，在荒地上停到五格外的旗幟。',why:'荒地不給公路加速。氮氣在移動前增加點數，但會用掉本輪唯一一次指令。',hint:'選輕型車、3 點移動骰；選氮氣與另一顆 2 點骰，再直走五格。',flag:{x:2,y:6},dice:[3,2,1,6]}
];
function createScenario(index){
 let seed=1701;const rng=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const r=new ThunderRoom('LESSON','新手練習',rng),p=r.add('你的車隊'),q=r.add('對手');r.start();
 for(const t of r.tiles)for(const row of t.cells)for(const cell of row){cell.kind='O';delete cell.hazard;}
 for(const c of r.cars){c.dead=true;c.damage=[];c.pendingDamage=0;c.moved=false;c.coasts=0;c.burning=false;}
 const own=r.cars.filter(c=>c.owner===p.id),enemy=r.cars.filter(c=>c.owner===q.id);
 const car=index===2?own[2]:own[0],target=index===2?enemy[0]:enemy[2],ally=own[2];
 Object.assign(car,{dead:false,x:2,y:1});Object.assign(target,{dead:false,x:2,y:index===2?2:index===3?3:7});
 r.turn=0;r.first=0;r.round=index===3?2:1;r.phase='assign';r.active=null;r.queue=[];r.pending=null;r.finishAt=null;r.winner=null;r.log=[];r.events=[];r.damageDeck=Array(20).fill('dent');r.roadDie=2;
 for(const player of r.players){player.out=false;player.turns=0;player.commandUsed=false;player.chopper=null;}
 p.dice=missions[index].dice.map(value=>({value,used:false}));
 if(index===0){r.terrain(2,2).kind='X';r.terrain(1,1).kind='M';r.terrain(1,2).kind='M';}
 if(index===1)for(let y=1;y<=6;y++)r.terrain(2,y).kind='R';
 if(index===4)Object.assign(ally,{dead:false,x:4,y:2,damage:['dent','dent']});
 if(index===2){const rolls=[5,1,5,2];let at=0;r.rng=n=>rolls[at++%rolls.length]%n;}
 if(index===3){const originalRoll=r.roll.bind(r);r.roll=faces=>faces===SHOT_DIE?'L':originalRoll(faces);}
 return {r,p,q,car,target,ally,index,bonus:false,command:'',result:null};
}
function outcome(s){
 const {r,car,target,ally,index}=s,flag=missions[index].flag,atFlag=flag&&car.x===flag.x&&car.y===flag.y;
 if(car.dead)return {ok:false,text:'車撞上障礙或離開道路，已淘汰。看看最後落點，重試這一關。'};
 if(r.pending)return null;
 const ended=s.p.turns>0||r.phase==='finished';
 if(index===2&&r.events.some(e=>e.kind==='slam'))return {ok:true,text:'碰撞已結算。即使原本有 3 點，撞車後也不會繼續正常移動；較大車的優勢是能選擇重擲。'};
 if(index===3&&target.damage.length)return {ok:true,text:'你先駛入射界，再擲出 L 命中重型車。傷害已顯示在敵車上；第一輪則不能射擊。'};
 if(ended){
  const ok=index===0?atFlag&&s.moveValue===3&&s.command==='':index===1?atFlag&&s.bonus&&s.moveValue===2:index===4?ally.damage.length===1:index===5?atFlag&&s.command==='nitro'&&s.moveValue===3&&s.commandValue===2:false;
  return {ok,text:ok?['你避開岩壁，使用 3 點繞行到旗幟。不同地形確實改變可走的路線。','公路加速幫你用 2 點骰走了 4 格。若途中離開公路，就拿不到這次獎勵。','','','重型車從兩個損傷變成一個，恢復可用；輕型車也完成了本回合。','3 點移動 + 2 點氮氣，足夠抵達五格外。你也用掉了本輪的指令機會。'][index]:'回合已結束，但尚未達成目標。比較車輛落點、花掉的點數和目標，再重試一次。'};
 }
 return null;
}
function act(s,action,data={}){s.r.act(s.r.actor(),action,data);if(action==='bonus'&&data.use)s.bonus=true;if(action==='begin'){s.command=data.command||'';s.moveValue=s.p.dice[data.die].value;s.commandValue=s.p.dice[data.commandDie]?.value;}s.result=outcome(s);return s.result;}
if(typeof module==='object'){module.exports={missions,createScenario,outcome,act};return;}
const el=id=>document.getElementById(id),esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let index=0,s=createScenario(0),selected=null,die=null,command='',commandDie=null,feedback='',hint=false;
const names=['輕型','中型','重型'];
function reset(i){index=i;s=createScenario(i);selected=null;die=null;command='';commandDie=null;feedback='';hint=false;render();}
function drawBoard(){const r=s.r,view=r.view(s.p.id),moves=!s.result&&r.phase==='move'&&!r.pending?r.legalMoves():[],targets=!s.result?view.targets:[],pos=(x,y)=>({x:42+y*62+(x%2)*31,y:54+x*42});
 let svg='<svg viewBox="0 0 560 314" role="group" aria-label="教學棋盤，向右前進"><text x="15" y="20" fill="#efd28f" font-size="12">你的車隊：橘色　對手：青色　前方 →</text>';
 for(let x=0;x<6;x++)for(let y=0;y<8;y++){const v=pos(x,y),kind=r.terrain(x,y).kind,legal=moves.some(m=>m.x===x&&m.y===y),flag=missions[index].flag?.x===x&&missions[index].flag?.y===y;
 const label=`第 ${x+1} 車道／第 ${y+1} 格，${{R:'公路',O:'荒地',M:'泥地，花兩點',X:'岩壁，淘汰'}[kind]}${flag?'，目標旗幟':''}${legal?'，可移動':''}`;
 svg+=`<g transform="translate(${v.x},${v.y})" data-cell="${x},${y}" role="button" tabindex="0" aria-label="${label}"><polygon points="-31,-12 0,-27 31,-12 31,12 0,27 -31,12" fill="${{R:'#768175',O:'#726749',M:'#4e352b',X:'#363d38'}[kind]}" stroke="${legal?'#ffe489':flag?'#eff5c2':'#b6b58a44'}" stroke-width="${legal?3:1}"/>${kind==='X'?'<text text-anchor="middle" y="5" fill="#ffb183">▲</text>':kind==='M'?'<text text-anchor="middle" y="5" fill="#ebc28a">≈ 2</text>':''}${flag?'<text text-anchor="middle" y="5" fill="#fff5c7">⚑</text>':''}</g>`;
 }
 for(const c of r.cars.filter(c=>!c.dead)){const v=pos(c.x,c.y),own=c.owner===s.p.id,target=targets.includes(c.id),sel=c.id===selected;
 svg+=`<g transform="translate(${v.x},${v.y})" data-lesson-car="${c.id}" role="button" tabindex="0" aria-label="${own?'己方':'敵方'}${names[c.size]}車，${c.damage.length} 個損傷${target?'，可射擊':''}"><rect x="-24" y="-17" width="48" height="34" rx="9" fill="${own?'#eda94f':'#4cc8c3'}" stroke="${target?'#ff695b':sel?'#fff3aa':'#111c18'}" stroke-width="${target||sel?3:1}" opacity="${c.damage.length>=2?.5:1}"/><path d="M-10,-8H5L13,0L5,8H-10Z" fill="#203125"/><text y="29" text-anchor="middle" font-size="11" fill="#fff1c8">${names[c.size][0]}${' ×'.repeat(c.damage.length)}</text></g>`;
 }return svg+'</svg>';}
function render(){const r=s.r,m=missions[index],ended=!!s.result,assign=r.phase==='assign'&&!ended;
 el('learnProgress').innerHTML=missions.map((m,i)=>`<button data-lesson="chapter" data-index="${i}" class="${index===i?'current':''}" aria-current="${index===i?'step':'false'}">${i+1}. ${m.title}</button>`).join('');
 let controls='';
 if(!ended&&r.pending)controls='<p>碰撞結果：<b>'+(r.pending.topMoves?'進入格子的車':'原本在格子的車')+'</b>往'+['前左','前方','前右','後左','後方','後右'][r.pending.direction]+'推一格。</p><button class="button orange" data-lesson="keep">保留結果</button> <button class="button outline" data-lesson="reroll">重擲兩顆骰子</button>';
 else if(assign)controls=`<p><b>① 點棋盤上的己方可用車 → ② 選移動骰 → ③ 確認</b></p><div class="scenario-dice">${s.p.dice.map((d,i)=>`<button data-lesson="die" data-index="${i}" class="learn-choice ${die===i?'selected':''}" aria-pressed="${die===i}">骰 ${i+1} · ${d.value} 點</button>`).join('')}</div><label>本輪指令 <select id="lessonCommand"><option value="">不使用</option><option value="nitro" ${command==='nitro'?'selected':''}>氮氣加速（1–3）</option><option value="repair" ${command==='repair'?'selected':''}>維修（6）</option></select></label>${command?`<label>指令骰 <select id="lessonCommandDie"><option value="">請選另一顆骰子</option>${s.p.dice.map((d,i)=>i!==die?`<option value="${i}" ${commandDie===i?'selected':''}>骰 ${i+1} · ${d.value} 點</option>`:'').join('')}</select></label>`:''}<button class="button orange" data-lesson="begin" ${selected===null||die===null?'disabled':''}>確認分配</button>`;
 else if(!ended&&r.phase==='move')controls=`<p><b>剩餘 ${r.active.remaining} 點。</b>直接點棋盤亮框移動，也可以點格子上的車發動碰撞。</p>`;
 else if(!ended&&r.phase==='bonus')controls='<p>全程公路，還能再走 2 點。是否使用？</p><button class="button orange" data-lesson="bonus">使用公路骰 +2</button> <button class="button outline" data-lesson="noBonus">不用加速</button>';
 else if(!ended&&r.phase==='shoot')controls='<p>紅框是射界內的目標，直接點車射擊。</p><button class="button outline" data-lesson="skip">略過射擊</button>';
 el('learnBody').innerHTML=`<h3 id="learnStepTitle">${m.title}</h3><div class="scenario-goal"><b>任務</b> ${m.goal}</div><p>${m.why}</p><div class="scenario-board">${drawBoard()}</div><div class="scenario-legend">亮框：可走　⚑：目標　▲：岩壁（淘汰）　≈ 2：泥地　×：損傷</div><div class="scenario-controls">${controls}</div><div class="learn-feedback ${s.result?.ok?'success':''}" role="status">${esc(s.result?.text||feedback||'先看棋局和任務，再選擇你的行動。')}</div><details ${hint?'open':''} id="lessonHint"><summary>卡住了？看路線提示</summary><p>${m.hint}</p></details><details><summary>這一關的棋局紀錄</summary><ol>${r.log.slice(0,8).map(t=>'<li>'+esc(t)+'</li>').join('')||'<li>尚未行動。</li>'}</ol></details>`;
 el('learnPrev').disabled=index===0;el('learnNext').disabled=!s.result?.ok;el('learnNext').hidden=false;el('learnNext').textContent=index===missions.length-1?'完成教學 →':'下一個棋局 →';el('learnCount').textContent=(index+1)+' / '+missions.length;
}
function perform(action,data){try{const kind=action==='move'?s.r.terrain(data.x,data.y)?.kind:null;act(s,action,data);feedback=s.r.log[0]||'繼續觀察棋盤。';if(action==='move'&&s.r.phase==='move'&&!s.r.pending)feedback=`進入${{R:'公路',O:'荒地',M:'泥地',X:'岩壁'}[kind]}，花費 ${kind==='M'?2:1} 點。剩餘 ${s.r.active.remaining} 點。${kind==='M'?'泥地讓同樣點數只能走更短的距離。':index===1&&kind!=='R'?'離開公路，這次已無法取得公路加速。':''}`;}catch(e){feedback=e.message;}render();}
function click(e){const c=e.target.closest('[data-cell],[data-lesson-car],[data-lesson]');if(!c)return;hint=!!el('lessonHint')?.open;
 if(c.dataset.lesson==='chapter'){reset(Number(c.dataset.index));return;}
 if(s.result)return;
 if(c.dataset.lessonCar){const car=s.r.car(c.dataset.lessonCar);
  if(s.r.phase==='assign'){if(s.r.available(s.p).includes(car)){selected=car.id;feedback='已選'+names[car.size]+'車，接著選移動骰。';}else feedback=car.owner===s.p.id?'這輛車失能了，不能分配移動骰。選另一輛可用車，利用指令維修。':'這是對手的車，不能分配你的骰子。';render();return;}
  if(s.r.phase==='shoot'){if(s.r.targets(s.r.car(s.r.active.car)).includes(car))perform('shoot',{target:car.id});else{feedback='這輛車不在前方相鄰三格的射界。';render();}return;}
  if(s.r.phase==='move'){perform('move',{x:car.x,y:car.y});return;}
 }
 if(c.dataset.cell){if(s.r.phase!=='move'||s.r.pending){feedback='先完成下方的選車、分配或碰撞操作。';render();return;}const [x,y]=c.dataset.cell.split(',').map(Number);perform('move',{x,y});return;}
 switch(c.dataset.lesson){case 'die':die=Number(c.dataset.index);if(commandDie===die)commandDie=null;render();break;case 'begin':perform('begin',{car:selected,die,command,commandDie,repairCar:s.ally.id});break;case 'keep':case 'reroll':perform('slam',{reroll:c.dataset.lesson==='reroll'});break;case 'bonus':case 'noBonus':perform('bonus',{use:c.dataset.lesson==='bonus'});break;case 'skip':perform('shoot',{});break;}
}
el('learn').addEventListener('click',click);
el('learnBody').addEventListener('change',e=>{if(e.target.id==='lessonCommand'){command=e.target.value;commandDie=null;render();}if(e.target.id==='lessonCommandDie')commandDie=e.target.value===''?null:Number(e.target.value);});
el('learnBody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-cell],[data-lesson-car]')){e.preventDefault();click(e);}});
el('learnNext').onclick=()=>{if(!s.result?.ok)return;if(index<missions.length-1)reset(index+1);else{el('learnBody').innerHTML='<h3>你已處理過六種真實棋局。</h3><p>現在回大廳，加入一位電腦練習。正式對局的骰面會隨機、對手也會行動；新手教學使用固定場景，讓你能比較不同選擇。</p><a class="button orange" href="#guideStrategy">最後看看簡單策略 ↓</a>';el('learnNext').hidden=true;}};
el('learnPrev').onclick=()=>{if(index>0)reset(index-1);};el('learnReset').onclick=()=>reset(index);render();
})();
