(()=>{
 const panel=document.createElement('aside');
 panel.className='shared-game-ui';
 panel.hidden=true;
 panel.innerHTML='<div class="shared-head"><span>AFTERHOURS / ROOM</span><button id="shared-toggle" type="button" aria-expanded="false">表情／彈幕</button><a href="/" aria-label="返回遊戲大廳">離開畫面 ↗</a></div><div id="shared-turn" class="shared-turn" role="status" aria-live="polite">等待開局</div><h2 class="shared-players-heading">這一桌的角色</h2><div id="shared-players" class="shared-players"></div><h2 class="shared-expressions-heading">使用角色表情</h2><div id="shared-expressions" class="shared-expressions" aria-label="我的角色表情"></div><h2 class="shared-barrage-heading">文字彈幕</h2><form id="shared-barrage"><input name="message" maxlength="40" placeholder="輸入彈幕（最多 40 字）" aria-label="文字彈幕" required><button type="submit">發送</button></form><p id="shared-error" role="status"></p>';
 const majorityAside=document.querySelector('.play-layout > aside');
 const pokerAside=document.querySelector('#game .table-sidebar');
 const raceCrews=document.querySelector('.race-main #crews');
 if(majorityAside){majorityAside.querySelector('#players').after(panel);panel.classList.add('integrated','majority-ui');}
 else if(pokerAside){pokerAside.querySelector('#hostControls').after(panel);panel.classList.add('integrated','poker-ui');}
 else if(raceCrews){raceCrews.after(panel);panel.classList.add('integrated','race-ui');}
 else document.body.append(panel);
 const arena=majorityAside?.previousElementSibling||document.querySelector('#game .play-area')||document.querySelector('.race-main')||document.body;
 const barrageLayer=document.createElement('div');barrageLayer.className='game-barrage-layer';barrageLayer.setAttribute('aria-hidden','true');
 arena.classList.add('game-barrage-host');arena.append(barrageLayer);
 const q=selector=>panel.querySelector(selector);
 let state,loaded=false,loading=false,nextLoad=0,lastPlayers='',sending=false,barrageRoom='',seenBarrages=new Set(),nextLane=0;
 function turnOf(s){
  if(['waiting','finished','showdown'].includes(s.phase))return s.phase==='waiting'?'等待房主開始':s.phase==='finished'?'本局結束':'本手結算中';
  if(s.type==='majority'){
   if(s.phase==='answering')return s.answeredIds?.includes(s.me)?'等待其他人作答':'輪到你作答！';
   if(s.phase==='review')return s.host?'輪到你確認答案！':'等待房主確認答案';
   const presenter=s.players.find(player=>player.id===s.presenterId);
   return s.presenterId===s.me?'輪到你出題！':`輪到 ${presenter?.name||'出題者'} 出題`;
  }
  const id=s.type==='thunder'?s.actor:s.players[s.turn]?.id;
  const actor=s.players.find(player=>player.id===id);
  return id===s.me?'輪到你操作！':`輪到 ${actor?.name||'其他玩家'} 操作`;
 }
 function element(tag,className,text){const node=document.createElement(tag);node.className=className;node.textContent=text;return node;}
 function update(s){
  if(window.RaceLesson)return;
  state=s;panel.hidden=false;if(!panel.classList.contains('integrated'))document.body.classList.add('has-game-shell');
  const current=s.type==='majority'?s.presenterId:s.type==='thunder'?s.actor:s.players[s.turn]?.id;
  const turn=q('#shared-turn');turn.textContent=turnOf(s);turn.classList.toggle('mine',turn.textContent.includes('輪到你'));
  const social=s.social||[],recent=new Map(),now=Date.now();
  for(const item of [...(s.expressions||[]),...social.filter(item=>item.kind==='expression')])if(now-item.at<5000)recent.set(item.playerId,item);
  const visible=s.players.filter(player=>!player.kicked);
  const playersKey=JSON.stringify(visible.map(player=>[player.id,player.name,player.avatar,player.id===current,player.id===s.me,recent.get(player.id)?.id]));
  if(playersKey!==lastPlayers){
   lastPlayers=playersKey;
   const players=q('#shared-players');players.replaceChildren();
   for(const player of visible){
    const row=element('div','shared-player','');row.classList.toggle('active',player.id===current);
    if(player.avatar){const img=document.createElement('img');img.src=player.avatar;img.alt='';row.append(img);}
    row.append(element('span','shared-player-name',player.name+(player.id===s.me?' · 你':'')));
    const expression=recent.get(player.id);
    if(expression){const badge=element('span','shared-emote-label',expression.label||expression.expression);badge.title=`${player.name} 使用了「${badge.textContent}」`;row.append(badge);}
    if(player.id===current)row.append(element('b','','◀ 操作中'));
    players.append(row);
   }
  }
  showBarrages(s,now);
  if(!loaded&&!loading&&Date.now()>=nextLoad)loadExpressions();
 }
 function showBarrages(s,now){
  if(barrageRoom!==s.code){barrageRoom=s.code;seenBarrages.clear();barrageLayer.replaceChildren();}
  for(const item of s.barrages||[]){
   if(seenBarrages.has(item.id)||now-item.at>=8000)continue;
   seenBarrages.add(item.id);
   const bubble=element('div','game-barrage','');bubble.style.top=`${12+(nextLane++%4)*18}%`;
   bubble.append(element('strong','',item.name+'：'),document.createTextNode(item.message));
   barrageLayer.append(bubble);
   bubble.style.setProperty('--barrage-travel',`-${barrageLayer.clientWidth+bubble.offsetWidth+24}px`);
   bubble.addEventListener('animationend',()=>bubble.remove(),{once:true});
  }
  if(seenBarrages.size>200)seenBarrages=new Set([...seenBarrages].slice(-100));
 }
 async function loadExpressions(){
  if(loading)return;
  loading=true;
  try{
   const [meResponse,optionsResponse]=await Promise.all([fetch('/api/auth/me'),fetch('/api/profile/options')]);
   const [me,options]=await Promise.all([meResponse.json(),optionsResponse.json()]);
   if(!meResponse.ok||!optionsResponse.ok)throw Error(me.error||options.error||'無法載入表情');
   const character=options.characters.find(item=>item.id===(me.appearance||options.defaults).characterId)||options.characters[0];
   const holder=q('#shared-expressions');holder.replaceChildren();
   for(const [key,url] of Object.entries(character.expressions)){
    const label=character.labels?.[key]||options.expressionLabels[key]||key;
    const button=document.createElement('button');button.type='button';button.title=`送出「${label}」`;button.setAttribute('aria-label',`送出「${label}」表情`);
    const img=document.createElement('img');img.src=url;img.alt='';button.append(img,element('span','',label));
    button.onclick=()=>send({kind:'expression',expression:key},`已送出「${label}」表情`);holder.append(button);
   }
   loaded=true;q('#shared-error').textContent='';
  }catch(error){nextLoad=Date.now()+5000;q('#shared-error').classList.remove('ok');q('#shared-error').textContent=error.message;}
  finally{loading=false;}
 }
 async function send(payload,confirmation){
  if(!state||sending)return false;
  sending=true;
  try{const response=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.code,...payload})});const result=await response.json();if(!response.ok)throw Error(result.error||'傳送失敗');update(result);q('#shared-error').classList.add('ok');q('#shared-error').textContent=confirmation;return true;}
  catch(error){q('#shared-error').classList.remove('ok');q('#shared-error').textContent=error.message;return false;}
  finally{sending=false;}
 }
 q('#shared-barrage').onsubmit=async event=>{event.preventDefault();const input=q('#shared-barrage input'),message=input.value.trim();if(!message)return;if([...message].length>40){q('#shared-error').classList.remove('ok');q('#shared-error').textContent='文字彈幕最多 40 字';return;}if(await send({kind:'barrage',message},'文字彈幕已送出'))input.value='';};
 q('#shared-toggle').onclick=()=>{const expanded=panel.classList.toggle('expanded');q('#shared-toggle').setAttribute('aria-expanded',String(expanded));q('#shared-toggle').textContent=expanded?'收合互動':'表情／彈幕';};
 window.addEventListener('focus',()=>{if(state){nextLoad=0;loadExpressions();}});
 function stableMarkup(target,markup){if(target._gameMarkup!==markup){target.innerHTML=markup;target._gameMarkup=markup;}}
 window.GameShell={update,stableMarkup};
})();
