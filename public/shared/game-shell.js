(()=>{
 const panel=document.createElement('aside');
 panel.className='shared-game-ui';
 panel.hidden=true;
 panel.innerHTML='<div class="shared-head"><span>AFTERHOURS / ROOM</span><button id="shared-toggle" type="button" aria-expanded="false">表情／彈幕</button><a href="/" aria-label="返回遊戲大廳">離開畫面 ↗</a></div><div id="shared-turn" class="shared-turn" role="status" aria-live="polite">等待開局</div><h2 class="shared-players-heading">這一桌的角色</h2><div id="shared-players" class="shared-players"></div><h2 class="shared-expressions-heading">使用角色表情</h2><div id="shared-expressions" class="shared-expressions" aria-label="我的角色表情"></div><h2 class="shared-barrage-heading">文字彈幕</h2><form id="shared-barrage"><input name="message" maxlength="40" placeholder="輸入彈幕（最多 40 字）" aria-label="文字彈幕" required><button type="submit">發送</button></form><p id="shared-error" role="status"></p>';
 const majorityAside=document.querySelector('.play-layout > aside');
 const giftAside=document.querySelector('.gift-layout > aside');
 const drawAside=document.querySelector('.draw-layout > aside');
 const pokerAside=document.querySelector('#game .table-sidebar');
 const raceCrews=document.querySelector('.race-main #crews');
 const sidebar=majorityAside||giftAside||drawAside||pokerAside;
 document.body.classList.add('game-room');
 document.body.classList.toggle('room-light',!!(majorityAside||giftAside||drawAside));
 if(sidebar){
  sidebar.classList.add('room-sidebar');sidebar.parentElement.classList.add('room-layout');
  const heading=sidebar.querySelector('.aside-head');
  if(heading){const count=heading.querySelector('#count');heading.replaceChildren();const title=document.createElement('h2');title.textContent='這桌的朋友';heading.append(title);if(count)heading.append(count);}
  const history=sidebar.querySelector('.history-link');if(history)history.textContent='對局歷史 ↗';
 }
 const dock=document.createElement('div');dock.className='room-action-dock';dock.setAttribute('aria-label','房間工具');
 const manage=document.querySelector('#managePlayers');if(manage)dock.append(manage);document.body.append(dock);
 if(majorityAside){majorityAside.querySelector('#players').after(panel);panel.classList.add('integrated','majority-ui');}
 else if(giftAside){giftAside.querySelector('#players').after(panel);panel.classList.add('integrated','gift-ui');}
 else if(drawAside){drawAside.querySelector('#players').after(panel);panel.classList.add('integrated','draw-ui');drawAside.append(document.querySelector('#guessChat'));}
 else if(pokerAside){
  const controls=pokerAside.querySelector('#hostControls');controls.after(panel);panel.classList.add('integrated','poker-ui');
  const info=document.createElement('details');info.className='room-game-info';const summary=document.createElement('summary');summary.textContent='牌桌資訊';info.append(summary);
  for(const item of [...pokerAside.children]){if(item===controls)break;info.append(item);}
  panel.after(info);panel.querySelector('.shared-players-heading').textContent='這桌的朋友';
  panel.querySelector('#shared-turn').before(panel.querySelector('.shared-players-heading'),panel.querySelector('#shared-players'));
 }
 else if(raceCrews){
  const controls=document.createElement('aside');controls.className='race-controls';document.querySelector('.race-main').append(controls);
  controls.append(raceCrews,document.querySelector('.dashboard'),panel,document.querySelector('.race-feed'),document.querySelector('.race-immersion-controls'));
  const radio=document.createElement('details');radio.className='race-feed';const summary=document.createElement('summary');summary.textContent='賽道電台 · 事件紀錄';radio.append(summary,controls.querySelector('#feed'));controls.querySelector('.race-feed').replaceWith(radio);
  document.querySelector('.race-heading').append(controls.querySelector('.race-immersion-controls'));
  panel.classList.add('integrated','race-ui');
 }

 else document.body.append(panel);
 if(sidebar){
  const toggle=panel.querySelector('#shared-toggle');toggle.className='room-interaction-toggle';toggle.textContent='表情／互動';panel.querySelector('#shared-turn').after(toggle);
  if(!sidebar.querySelector('.history-link')){const history=document.createElement('a');history.className='history-link';history.href='/history';history.textContent='對局歷史 ↗';panel.after(history);}
 }
 const arena=majorityAside?.previousElementSibling||giftAside?.previousElementSibling||drawAside?.previousElementSibling||document.querySelector('#game .play-area')||document.querySelector('.race-main')||document.body;
 const barrageLayer=document.createElement('div');barrageLayer.className='game-barrage-layer';barrageLayer.setAttribute('aria-hidden','true');
 arena.classList.add('game-barrage-host');arena.append(barrageLayer);
 const q=selector=>panel.querySelector(selector);
 const emojiPicker=document.createElement('div');emojiPicker.id='shared-emoji-picker';emojiPicker.className='shared-emoji-picker';emojiPicker.hidden=true;emojiPicker.setAttribute('role','group');emojiPicker.setAttribute('aria-label','emoji 彈幕選單');q('#shared-barrage').after(emojiPicker);
 const emoteButton=document.createElement('button');emoteButton.type='button';emoteButton.id='shared-emote-toggle';emoteButton.textContent='☺';emoteButton.setAttribute('aria-label','選擇 emoji 彈幕');emoteButton.setAttribute('aria-expanded','false');emoteButton.setAttribute('aria-controls','shared-emoji-picker');q('#shared-barrage').append(emoteButton);
 emoteButton.onclick=()=>{const expanded=emojiPicker.hidden;emojiPicker.hidden=!expanded;emoteButton.setAttribute('aria-expanded',String(expanded));};
 document.addEventListener('click',event=>{if(!emojiPicker.hidden&&!emojiPicker.contains(event.target)&&!emoteButton.contains(event.target)){emojiPicker.hidden=true;emoteButton.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!emojiPicker.hidden){emojiPicker.hidden=true;emoteButton.setAttribute('aria-expanded','false');emoteButton.focus();}});
 fetch('/api/social/options').then(async response=>{if(!response.ok)throw Error('無法載入 emoji');return response.json();}).then(({emojis})=>{for(const emoji of emojis){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label',`送出 ${emoji} emoji 彈幕`);button.onclick=async()=>{if(await send({kind:'emoji',emoji},`已送出 ${emoji} emoji 彈幕`)){emojiPicker.hidden=true;emoteButton.setAttribute('aria-expanded','false');}};emojiPicker.append(button);}}).catch(error=>{emojiPicker.textContent=error.message;});
 let state,loaded=false,loading=false,nextLoad=0,lastPlayers='',sending=false,barrageRoom='',seenBarrages=new Set(),nextLane=0;
 function turnOf(s){
  if(['waiting','finished','showdown'].includes(s.phase))return s.phase==='waiting'?'等待房主開始':s.phase==='finished'?'本局結束':'本手結算中';
  if(s.type==='gift'){
   if(s.phase==='delivering'){const recipient=s.players.find(player=>player.id===s.delivery.recipientId);return s.me===s.delivery.recipientId?'輪到你確認收到禮物！':'等待 '+(recipient?.name||'朋友')+' 確認收禮';}
   if(s.phase!=='choosing')return '這輪禮物已揭曉';
   const gave=!!s.ownAssignments,wished=!!s.ownRanking;
   return gave&&wished?'兩項已鎖定，等待朋友完成':gave?'送禮已鎖定，輪到你標喜好！':wished?'喜好已鎖定，輪到你選禮物！':'輪到你選禮物與標喜好！';
  }
  if(s.type==='draw'){
   const artist=s.players.find(player=>player.id===s.presenterId);
   if(s.phase==='choosing')return s.presenterId===s.me?'輪到你選題！':'等待 '+(artist?.name||'畫者')+' 選題';
   if(s.phase==='drawing')return s.presenterId===s.me?'輪到你畫圖！':s.participantIds.includes(s.me)?s.guessedIds.includes(s.me)?'已猜中，等朋友完成':'輪到你猜題！':'下一輪開始猜題';
   return '本輪答案已揭曉';
  }
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
  const current=s.type==='majority'||s.type==='draw'?s.presenterId:s.type==='thunder'?s.actor:s.type==='gift'?null:s.players[s.turn]?.id;
  const turn=q('#shared-turn');turn.textContent=turnOf(s);turn.classList.toggle('mine',turn.textContent.includes('輪到你'));
  const social=s.social||[],recent=new Map(),now=Date.now();
  for(const item of [...(s.expressions||[]),...social.filter(item=>item.kind==='expression')])if(now-item.at<5000)recent.set(item.playerId,item);
  const visible=s.players.filter(player=>!player.kicked);
  const playersKey=JSON.stringify(visible.map(player=>[player.id,player.name,player.avatar,player.stack,player.online,player.folded,player.action,player.id===current,player.id===s.me,recent.get(player.id)?.id]));
  if(playersKey!==lastPlayers){
   lastPlayers=playersKey;
   const players=q('#shared-players');players.replaceChildren();
   if(pokerAside){players.innerHTML=visible.map(player=>playerRow(player,{me:s.me,status:player.bot?'練習電腦':s.phase==='waiting'?(player.online===false?'暫時離線':'已入座'):player.folded?'已棄牌':player.id===current?'操作中':player.online===false?'暫時離線':'已入座',metrics:[{value:Number(player.stack||0).toLocaleString('zh-TW'),label:'籌碼'}]})).join('');}
   else{
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
   bubble.append(element('strong','',item.name+'：'));
   if(item.kind==='emoji'){bubble.classList.add('game-emoji-barrage');bubble.append(element('span','game-emoji-glyph',item.emoji));}
   else bubble.append(document.createTextNode(item.message));
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
 const library=document.createElement('dialog');library.className='game-library-dialog';library.innerHTML='<div class="library-dialog-head"><strong>新增題庫素材</strong><button type="button" aria-label="關閉題庫">關閉 ×</button></div><iframe title="新增題庫素材"></iframe>';document.body.append(library);
 library.querySelector('button').onclick=()=>library.close();
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href);if(url.origin!==location.origin||!['/gifts','/draw-words','/community'].includes(url.pathname))return;event.preventDefault();url.searchParams.set('embed','1');library.querySelector('iframe').src=url.pathname+url.search;library.showModal();});
 library.querySelector('iframe').onload=()=>{const doc=library.querySelector('iframe').contentDocument;if(!doc)return;const style=doc.createElement('style');style.textContent='header{display:none!important}body{padding:0!important}main{margin-top:12px!important}.gift-shell,.draw-shell,.shell{padding:0 16px!important}';doc.head.append(style);doc.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&new URL(link.href).pathname==='/'){event.preventDefault();library.close();}});};
 if(majorityAside){const link=document.createElement('a');link.href='/community?tab=questions';link.className='quiet';link.textContent='新增題庫素材';document.querySelector('.shell header nav')?.append(link);}
 function stableMarkup(target,markup){if(target._gameMarkup!==markup){target.innerHTML=markup;target._gameMarkup=markup;}}
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function playerRow(player,{me,status='',metrics=[{value:player.score??player.stack??0,label:'分數'}]}={}){
  const avatar=player.avatar?'<img src="'+escape(player.avatar)+'" alt="">':'<span class="room-avatar-fallback">'+escape(String(player.name||'？').slice(0,1))+'</span>';
  return '<div class="room-player player" data-player-id="'+escape(player.id)+'"><div class="room-player-avatar">'+avatar+'</div><div class="room-player-info"><b>'+escape(player.name)+(player.id===me?' · 你':'')+'</b><small>'+escape(status)+'</small></div><div class="room-player-metrics">'+metrics.map(metric=>'<strong title="'+escape(metric.label)+'" aria-label="'+escape(metric.label)+'：'+escape(metric.value)+'">'+escape(metric.value)+'</strong>').join('')+'</div></div>';
 }
 window.GameShell={update(s){window.TableMusic?.update(s);return update(s);},stableMarkup,playerRow};
})();
