(()=>{
const $=s=>document.querySelector(s);
const exitHref=new URLSearchParams(location.search).get('from')==='game'?('/race'+(/^[A-Fa-f0-9]{6}$/.test(new URLSearchParams(location.search).get('room')||'')?'/'+new URLSearchParams(location.search).get('room').toUpperCase():'')):'/';
const steps=[
 ['配件 · 車子：敵我辨識','#crews',['橘色是你的車隊；青色是對手。','棋盤車輛、上方車隊列與儀表板，使用相同的隊伍顏色。'],'own'],
 ['配件 · 車子：輕、中、重型','#carDash',['每隊各有輕型、中型、重型車一輛；車身大小與「輕／中／重」文字可辨識車型。','車型不決定移動距離，移動骰才決定。','碰撞較小的車時，較大型車的玩家可選擇重擲碰撞骰；大型車仍可能撞輸。'],'size'],
 ['配件 · 車子：血量與損傷','#carDash',['三種車型都有兩個損傷槽，重型車不會比較耐打。','○ 是空槽；● 是已受損。圖中輕型車無損傷，中型車有一個損傷。','重型車已累積兩個損傷而失能，不能選來移動；隊友維修後可恢復。','失能與淘汰不同：淘汰的車會離開棋盤，不能維修救回。'],'damage'],
 ['配件 · 道路：後、中、前段','.race-stage',['道路由左到右分成後、中、前三段。','領先車超過前段時，接上新段、移除後段，並淘汰仍在後段的車。'],'road'],
 ['配件 · 道路：地形','#track',['灰綠公路、土黃荒地：進入一格花 1 點移動。','深褐泥地：進入一格花 2 點移動。','岩壁：進入就淘汰，不能拿損傷槽抵擋。','⚠ 未知危險：進入才揭露並結算效果。','亮框代表可以選擇的落點，不保證安全。'],'terrain'],
 ['配件 · 骰子','.dice-select',['每輪每隊擲四顆移動骰。選一顆分配給車，點數就是這回合的移動量；暗色代表已使用。','每輪最多使用一次指令：在移動前花另一顆骰子。氮氣用 1–3、甩尾用 3–5、維修用 6、空襲用任意點數。','上方的 ROAD BONUS 是大家共用的公路骰。起點及路線全在公路，可選擇額外移動；接受後必須走完。','碰撞骰與射擊骰在事件發生時才擲，稍後用實際棋局練習。'],'dice'],
 ['配件 · 直升機','#track',['圖上的橘色直升機屬於你，青色直升機則屬於對手。','用空襲指令部署；空襲結算後，仍要移動本回合選的車。','車可以經過直升機下方；但回合結束停在任何直升機下方就淘汰，自己的直升機也一樣。','直升機不佔用車輛損傷槽，也不能成為車輛射擊的目標。'],'heli'],
 ['遊戲目標','.race-stage',['讓你的一輛車先衝過終點，或成為最後還有可用車的車隊。','不必讓三輛車都抵達；同時留意落後車，避免被移除的道路帶走。','這個示範局面已顯示右側終點線，方便辨識。'],'goal'],
 ['流程 · 每輪順序','#controlPanel',['輪開始：擲四顆移動骰，更新共用公路骰。','由本輪起始車隊開始輪流行動，每隊各完成三個回合，再開始下一輪。','你的回合：選車與移動骰 → 指令（可選）→ 移動及途中事件 → 射擊。第一輪禁止射擊。','每輛可用車每輪先移動一次；都動過後，剩餘回合可讓車滑行 1 格。滑行不能用指令或公路骰。'],'round'],
 ['流程 · 終點與結束條件','.race-stage',['任何車隊沒有可用車（全數失能或淘汰），就退出比賽，並在目前道路前緣出現終點。','雙人局即使尚無車隊退出，鋪到第 5 段道路也會出現終點。','終點出現後，不再接新道路；仍在比賽中的車隊有車越過終點，立即獲勝。','若只剩一隊有可用車，該隊直接獲勝；兩隊都失去行動能力則無人獲勝。'],'end'],
 ['實作 1 · 地形與路線','#track',['選輕型車與 3 點骰。','繞過岩壁，停到標示的練習目標；比較泥地與荒地的點數消耗。'],'practice',0],
 ['實作 2 · 公路加速','#roadDie',['選輕型車與 2 點骰，沿公路走兩格。','接受 +2 公路骰，再走到標示目標。離開公路會失去加速資格。'],'practice',1],
 ['實作 3 · 碰撞重擲','#controlPanel',['選重型車與 3 點骰，直走撞上前方輕型車。','看清碰撞結果，再選保留或重擲，並留意剩餘移動。'],'practice',2],
 ['實作 4 · 移動後射擊','#track',['這是第二輪。選輕型車與 1 點骰，靠近敵方重型車。','移動後點射界內目標射擊；此關固定擲出 L，示範命中與損傷。'],'practice',3],
 ['實作 5 · 維修隊友','#carDash',['選輕型車與 2 點移動骰，再用另一顆 6 點骰維修失能重型車。','觀察重型車恢復可用，再走完輕型車的移動。'],'practice',4],
 ['實作 6 · 氮氣與距離','#controlPanel',['選輕型車，點下方的 3 點移動骰。','在「本輪指令」選「氮氣加速」，才會出現「指令使用另一顆骰子」選單。','在新選單選「第 2 顆 · 2 點」。那顆骰子會標示「指令用」並鎖定；要改派，請用指令骰選單。','按「確認分配，出發」，可移動 3 + 2 = 5 格。沿同一車道向右逐格走到練習目標。'],'practice',5],
 ['最後 · 簡單策略','.race-stage',['先看落點是否安全，再挑骰子；別只顧領先車而忘了後段隊友。','公路加速可以拒絕；重型車能重擲也不保證撞贏。','留一顆 6 點骰維修，有時比搶快更值得。'],'strategy']
];
let step=0,scene,bridge,feedback='',hint=false;
function annotations(){
 const svg=$('#track svg');if(!svg)return;svg.querySelectorAll('.lesson-callouts').forEach(e=>e.remove());
 document.querySelectorAll('.lesson-inline-note').forEach(e=>e.remove());
 const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('class','lesson-callouts');group.setAttribute('pointer-events','none');
 const pos=(x,y)=>[48+y*44+(x%2)*22,81+x*44];
 function mark(x,y,lx,ly,label,color='#ffe0a1'){const [px,py]=pos(x,y),width=label.length*21+24;group.innerHTML+=`<circle cx="${px}" cy="${py}" r="24" fill="none" stroke="${color}" stroke-width="2.5"/><path d="M${px},${py-24} L${lx},${ly+19}" fill="none" stroke="${color}" stroke-width="1.5"/><rect x="${lx-width/2}" y="${ly-18}" width="${width}" height="38" rx="6" fill="#15231e" stroke="${color}"/><text x="${lx}" y="${ly+8}" text-anchor="middle" fill="${color}" font-size="23" font-weight="600">${label}</text>`;}
 function note(selector,text){const target=$(selector);if(target){const el=document.createElement('span');el.className='lesson-inline-note';el.textContent=text;target.append(el);}}
 const key=steps[step][3];
 const own=scene.r.cars.filter(c=>c.owner===scene.p.id),enemy=scene.r.cars.find(c=>c.owner!==scene.p.id&&!c.dead);
 if(key==='own'){mark(own[0].x,own[0].y,180,43,'你的車隊','#ffc06c');mark(enemy.x,enemy.y,750,43,'對手車隊','#6be2df');}
 if(key==='road'){for(const [x,label] of [[195,'後段：新路接上時移除'],[560,'中段 → 後段'],[940,'前段 → 中段']])group.innerHTML+=`<rect x="${x-145}" y="12" width="290" height="38" rx="6" fill="#15231e" stroke="#f4ce82"/><text x="${x}" y="38" text-anchor="middle" fill="#ffe0a1" font-size="22">${label}</text>`;}
 if(key==='size'||key==='damage'){own.forEach(c=>mark(c.x,c.y,310,65+c.size*92,key==='size'?['輕型車','中型車','重型車'][c.size]:`${c.damage.length} 損傷 · ${c.damage.length>=2?'失能':'可用'}`));if(key==='damage')['○ ○ 無損傷','● ○ 仍可用','● ● 已失能'].forEach((text,i)=>note(`#carDash .car-card:nth-child(${i+1})`,text));}
 if(key==='dice'){note('.dice-select','移動骰：點數 = 移動量');note('.command-wrap','指令要花另一顆骰子');note('.race-stats','ROAD BONUS：共用公路骰');}
 if(key==='terrain'){mark(0,4,230,40,'岩壁 · 淘汰');mark(0,5,455,98,'泥地 · 2 點');mark(2,6,530,174,'公路 · 1 點');mark(4,5,365,316,'未知危險 · 進入揭露');mark(5,16,870,345,'荒地 · 1 點');}
 if(key==='heli')mark(3,10,765,175,'直升機：不要停在下方');
 if(key==='round')note('.race-stats','每隊 3 回合 → 下一輪');
 if(key==='goal'||key==='end'){mark(own[0].x,own[0].y,890,40,'向右衝過終點','#ffc06c');}
 if(key==='practice'&&!scene.result){const c=scene.car;if(scene.r.phase==='assign')mark(c.x,c.y,Math.max(135,pos(c.x,c.y)[0]),35,'操作這輛車');if(steps[step][4]===3){const c=scene.target;mark(c.x,c.y,340,110,'靠近後才能射擊','#6be2df');}}
 svg.append(group);
}
function setup(){scene=LessonScenarios.createScenario(steps[step][4]??0);const {r,p,q}=scene;
 // Preserve all six vehicles and all three dashboards in the actual game view.
 for(const c of r.cars)if(c.dead){Object.assign(c,{dead:false,x:c.size*2,y:c.owner===p.id?11:18,damage:[]});}
 if(steps[step][4]===undefined){for(const c of r.cars){c.x=c.size*2;c.y=c.owner===p.id?2:13;c.damage=[];}r.terrain(0,4).kind='X';r.terrain(0,5).kind='M';r.terrain(2,6).kind='R';r.terrain(4,5).hazard={kind:'mine',face:false};
  if(steps[step][3]==='damage'){r.cars.find(c=>c.owner===p.id&&c.size===1).damage=['dent'];r.cars.find(c=>c.owner===p.id&&c.size===2).damage=['dent','dent'];}p.chopper={x:3,y:10,chopper:true};r.finishAt=['goal','end'].includes(steps[step][3])?24:null;if(r.finishAt){scene.car.y=21;r.tileCount=5;}
 }
 r.name='雷霆之路 · 新手教學桌';r.code='練習';r.tiles.forEach((t,i)=>t.name=['教學後段','教學中段','教學前段'][i]);feedback='';hint=false;
}
function publish(){bridge.resetSelection();bridge.render(scene.r.view(scene.p.id));}
function refreshCoach(){document.querySelectorAll('.lesson-highlight').forEach(e=>e.classList.remove('lesson-highlight'));const target=$(steps[step][1]);if(target)target.classList.add('lesson-highlight');
 const practice=steps[step][4]!==undefined,done=scene.result?.ok;
 document.body.classList.toggle('lesson-readonly',!practice||!!scene.result);
 $('#lessonCoach').innerHTML=`<div class="lesson-copy"><h2>${steps[step][0]}</h2><ul class="lesson-points">${steps[step][2].map(text=>`<li>${text}</li>`).join('')}</ul>${practice&&(scene.result||feedback)?`<div class="lesson-feedback" role="status">${scene.result?.text||feedback}</div>`:''}${practice?`<details ${hint?'open':''} id="lessonRoute"><summary>需要提示？</summary><p>${LessonScenarios.missions[steps[step][4]].hint}</p></details>`:''}</div><div class="lesson-footer"><div class="lesson-retry-slot">${practice?'<button id="lessonRetry" class="button outline">重試本關</button>':''}</div><div class="lesson-nav"><button id="lessonBack" class="button outline" ${step===0?'disabled':''}>← 上一步</button><button id="lessonNext" class="button orange" ${practice&&!done?'disabled':''}>${step===steps.length-1?'完成教學':'下一步 →'}</button></div><label class="lesson-jump">章節 <select id="lessonChapter">${steps.map((v,i)=>`<option value="${i}" ${i===step?'selected':''}>${i+1}. ${v[0]}</option>`).join('')}</select></label></div>`;
 $('#lessonBack').onclick=()=>go(step-1);$('#lessonNext').onclick=()=>{if(step===steps.length-1){location.href=exitHref;return;}go(step+1);};$('#lessonChapter').onchange=e=>go(Number(e.target.value));if($('#lessonRetry'))$('#lessonRetry').onclick=()=>go(step);
 $('#timer').textContent='教學暫停計時';$('#connection').textContent='● 獨立教學桌';$('#rookieHelp').hidden=true;$('#winner').hidden=true;
 document.body.dataset.lessonStep=String(step);annotations();
 const flag=LessonScenarios.missions[steps[step][4]]?.flag,svg=$('#track svg');if(practice&&flag&&svg){const tag=document.createElementNS('http://www.w3.org/2000/svg','g');tag.setAttribute('pointer-events','none');tag.innerHTML=`<circle cx="${48+flag.y*44+(flag.x%2)*22}" cy="${81+flag.x*44}" r="25" fill="none" stroke="#fff0a0" stroke-width="3" stroke-dasharray="4 3"/><text x="${48+flag.y*44+(flag.x%2)*22}" y="${81+flag.x*44-31}" text-anchor="middle" fill="#fff0a0" font-size="12">練習目標</text>`;svg.append(tag);}
}
function go(i){if(i<0||i>=steps.length)return;step=i;setup();publish();}
// Keep copyable lesson text from initiating native text drag-and-drop.
document.addEventListener('dragstart',e=>{
 const el=e.target.nodeType===3?e.target.parentElement:e.target;
 if(el?.closest?.('#lessonCoach .lesson-copy'))e.preventDefault();
});
// Clear only this panel's selection when a navigation control is pressed.
// Do not cancel the pointer event: native button focus and select menus still work.
document.addEventListener('pointerdown',e=>{
 if(!e.target.closest?.('#lessonCoach button, #lessonCoach select'))return;
 const selection=window.getSelection?.(),coach=$('#lessonCoach');
 if(selection&&!selection.isCollapsed&&(coach.contains(selection.anchorNode)||coach.contains(selection.focusNode)))selection.removeAllRanges();
});
window.RaceLesson={mount(b){bridge=b;document.body.classList.add('lesson-mode');const main=$('.race-main'),wrap=document.createElement('div');wrap.className='lesson-workspace';main.before(wrap);wrap.append(main);const coach=document.createElement('aside');coach.id='lessonCoach';wrap.append(coach);$('#invite').hidden=true;$('.race-room .quiet').textContent=exitHref.startsWith('/race')?'離開教學，返回遊戲':'離開教學';$('.race-room .quiet').href=exitHref;$('.race-room .quiet').removeAttribute('target');$('.build-note').textContent='雷霆之路專屬教學桌 · 與正式遊戲共用棋盤、儀表板、控制與規則';setup();publish();},onRender:refreshCoach,
 async api(route,data){if(route!=='action'||steps[step][4]===undefined||scene.result)throw Error('目前是教學導覽。請使用教學面板前往操作練習。');hint=!!$('#lessonRoute')?.open;LessonScenarios.act(scene,data.action,data);feedback=scene.r.log[0]||'請看車輛位置與剩餘移動點數。';return scene.r.view(scene.p.id);}
};
})();


