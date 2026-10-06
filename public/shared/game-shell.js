(()=>{
 const panel=document.createElement('aside');
 panel.className='shared-game-ui';
 panel.hidden=true;
 panel.innerHTML='<div class="shared-head"><span>AFTERHOURS / ROOM</span><button id="shared-toggle" type="button" aria-expanded="false">表情／彈幕</button><a href="/" aria-label="返回遊戲大廳">離開房間 ↗</a></div><div id="shared-turn" class="shared-turn" role="status" aria-live="polite">等待開局</div><h2 class="shared-players-heading">這一桌的角色</h2><div id="shared-players" class="shared-players"></div><h2 class="shared-expressions-heading">使用角色表情</h2><div id="shared-expressions" class="shared-expressions" aria-label="我的角色表情"></div><h2 class="shared-barrage-heading">文字彈幕</h2><form id="shared-barrage"><input name="message" maxlength="40" placeholder="輸入彈幕（最多 40 字）" aria-label="文字彈幕" required><button type="submit">發送</button></form><p id="shared-error" role="status"></p>';
 const majorityAside=document.querySelector('.play-layout > aside');
 const giftAside=document.querySelector('.gift-layout > aside');
 const drawAside=document.querySelector('.draw-layout > aside');
 const pokerAside=document.querySelector('#game .table-sidebar');
 const staticRaceControls=document.querySelector('.race-controls');
 const raceCrews=document.querySelector('.race-main #crews')||staticRaceControls?.querySelector('#crews');
 const sidebar=majorityAside||giftAside||drawAside||pokerAside;
 document.body.classList.add('game-room');
 if(!document.body.dataset.gameKind)document.body.dataset.gameKind=majorityAside?'majority':giftAside?'gift':drawAside?'draw':pokerAside?'poker':raceCrews?'race':'room';
 document.body.classList.toggle('room-light',!!(majorityAside||giftAside||drawAside));
 if(sidebar){
  sidebar.classList.add('room-sidebar');sidebar.parentElement.classList.add('room-layout');
  const heading=sidebar.querySelector('.aside-head');
  if(heading){const count=heading.querySelector('#count');heading.replaceChildren();const title=document.createElement('h2');title.textContent='這桌的朋友';heading.append(title);if(count)heading.append(count);}
  const history=sidebar.querySelector('.history-link');if(history)history.textContent='對局歷史 ↗';
 }
 const dock=document.createElement('div');dock.className='room-action-dock';dock.setAttribute('aria-label','房間工具');
 const leaveLink=document.createElement('a');leaveLink.href='/';leaveLink.className='room-leave';leaveLink.textContent='離開房間';leaveLink.hidden=true;window.GameUI?.decorateButton(leaveLink,'leave',{label:'離開房間'});dock.append(leaveLink);
 const manage=document.querySelector('#managePlayers');if(manage){window.GameUI?.decorateButton(manage,'users',{label:'管理玩家'});dock.append(manage);}document.body.append(dock);
 for(const dialog of document.querySelectorAll('#hostPlayers,#kickWarning,#kickedNotice')){const title=dialog.querySelector('h2');if(title){if(!title.id)title.id=dialog.id+'-title';dialog.setAttribute('aria-labelledby',title.id);}dialog.classList.add('ui-dialog');}
 if(majorityAside){if(majorityAside.querySelector('[data-game-action-slot]'))majorityAside.append(panel);else majorityAside.querySelector('#players').after(panel);panel.classList.add('integrated','majority-ui');}
 else if(giftAside){if(giftAside.querySelector('[data-game-action-slot]'))giftAside.append(panel);else giftAside.querySelector('#players').after(panel);panel.classList.add('integrated','gift-ui');}
 else if(drawAside){if(drawAside.querySelector('[data-game-action-slot]'))drawAside.append(panel);else{drawAside.querySelector('#players').after(panel);const guesses=document.querySelector('#guessChat');if(guesses)drawAside.append(guesses);}panel.classList.add('integrated','draw-ui');}
 else if(pokerAside){
  const controls=pokerAside.querySelector('#hostControls');controls.after(panel);panel.classList.add('integrated','poker-ui');
  const info=document.createElement('section');info.className='room-game-info';info.setAttribute('aria-label','牌桌資訊');const summary=document.createElement('h2');summary.textContent='牌桌資訊';info.append(summary);
  for(const item of [...pokerAside.children]){if(item===controls)break;info.append(item);}
  panel.after(info);panel.querySelector('.shared-players-heading').textContent='這桌的朋友';
  panel.querySelector('#shared-turn').before(panel.querySelector('.shared-players-heading'),panel.querySelector('#shared-players'));
 }
 else if(raceCrews||staticRaceControls){
  const controls=staticRaceControls||document.createElement('aside');
  if(!staticRaceControls){controls.className='race-controls';document.querySelector('.race-main').append(controls);for(const item of [raceCrews,document.querySelector('.dashboard'),document.querySelector('.race-feed'),document.querySelector('.race-immersion-controls')])if(item)controls.append(item);}
  controls.append(panel);
  const feed=controls.querySelector('.race-feed');if(feed&&!feed.hasAttribute('data-persistent')&&feed.tagName!=='DETAILS'){const radio=document.createElement('details');radio.className='race-feed';const summary=document.createElement('summary');summary.textContent='賽道事件紀錄';const entries=feed.querySelector('#feed');if(entries){radio.append(summary,entries);feed.replaceWith(radio);}}
  const sound=controls.querySelector('.race-immersion-controls'),heading=document.querySelector('.race-heading');if(sound&&heading)heading.append(sound);
  panel.classList.add('integrated','race-ui');
 }

 else document.body.append(panel);
 if(sidebar){
  const toggle=panel.querySelector('#shared-toggle');toggle.className='room-interaction-toggle';toggle.textContent='表情／互動';panel.querySelector('#shared-turn').after(toggle);
  if(!sidebar.querySelector('.history-link')){const history=document.createElement('a');history.className='history-link';history.href='/history';history.textContent='對局歷史 ↗';panel.after(history);}
 }
 const toolsHost=sidebar||document.querySelector('.race-controls');if(toolsHost){dock.classList.add('in-sidebar');toolsHost.append(dock);const music=document.querySelector('.table-music');if(music){const slot=document.createElement('div');slot.className='room-music-slot';slot.append(music);dock.append(slot);}}
 const mediaWatchSlot=window.TableMusic?.getWatchSlot();if(mediaWatchSlot)window.TableWatch?.mount(mediaWatchSlot);
 const arena=majorityAside?.previousElementSibling||giftAside?.previousElementSibling||drawAside?.previousElementSibling||document.querySelector('#game .play-area')||document.querySelector('.race-main')||document.body;
 const barrageLayer=document.createElement('div');barrageLayer.className='game-barrage-layer';barrageLayer.setAttribute('aria-hidden','true');
 arena.classList.add('game-barrage-host');arena.append(barrageLayer);
 const q=selector=>panel.querySelector(selector)||dock.querySelector(selector);
 for(const [selector,container] of [['#raceSpotlight','.race-stage'],['#pokerSpotlight','.table-wrap']])window.UIPopover?.bindOverlay(document.querySelector(selector),document.querySelector(container));
 const expressionMenu=document.createElement('details');expressionMenu.className='shared-expression-menu';
 const expressionSummary=document.createElement('summary');expressionSummary.textContent='角色表情';window.GameUI?.decorateButton(expressionSummary,'users',{label:'角色表情'});
 const expressions=q('#shared-expressions');expressions.before(expressionMenu);expressionMenu.append(expressionSummary,expressions);
 if(toolsHost){expressionSummary.textContent='角色';expressionSummary.setAttribute('aria-label','選擇角色表情');expressionSummary.title='選擇角色表情';window.GameUI?.decorateButton(expressionSummary,'users',{label:'角色'});leaveLink.textContent='離房';leaveLink.setAttribute('aria-label','離房，離開房間');leaveLink.title='離開房間';window.GameUI?.decorateButton(leaveLink,'leave',{label:'離房'});if(manage){manage.textContent='管理';manage.setAttribute('aria-label','管理玩家');manage.title='管理玩家';window.GameUI?.decorateButton(manage,'settings',{label:'管理'});}dock.prepend(expressionMenu);}
 const feedback=(message,kind='info')=>{const node=q('#shared-error');node.classList.toggle('ok',kind==='success');if(window.GameUI)window.GameUI.setStatus(node,message,{kind});else{node.dataset.kind=kind;node.setAttribute('aria-live','polite');if(node.textContent!==message)node.textContent=message;}};
 feedback('');
 window.GameUI?.decorateButton(q('#shared-barrage button[type=submit]'),'send',{iconOnly:true,label:'發送文字彈幕'});
 const emojiPicker=document.createElement('div');emojiPicker.id='shared-emoji-picker';emojiPicker.className='shared-emoji-picker';emojiPicker.hidden=true;emojiPicker.setAttribute('role','group');emojiPicker.setAttribute('aria-label','emoji 彈幕選單');q('#shared-barrage').after(emojiPicker);
 const emoteButton=document.createElement('button');emoteButton.type='button';emoteButton.id='shared-emote-toggle';emoteButton.textContent='☺';emoteButton.setAttribute('aria-label','選擇 emoji 彈幕');emoteButton.setAttribute('aria-expanded','false');emoteButton.setAttribute('aria-controls','shared-emoji-picker');window.GameUI?.decorateButton(emoteButton,'emoji',{iconOnly:true,label:'選擇 emoji 彈幕'});q('#shared-barrage').append(emoteButton);
 function closeEmoji(restoreFocus=false){emojiPicker.hidden=true;emoteButton.setAttribute('aria-expanded','false');if(restoreFocus)emoteButton.focus();}
 window.UIPopover?.bindDetails(expressionMenu,expressions,{align:'start'});
 const emojiPopover=window.UIPopover?.bind(emoteButton,emojiPicker,{align:'end',onClose:()=>closeEmoji()});
 emoteButton.onclick=()=>{if(!emojiPicker.hidden){closeEmoji();return;}expressionMenu.open=false;emojiPicker.hidden=false;emoteButton.setAttribute('aria-expanded','true');emojiPopover?.sync();emojiPicker.querySelector('button:not(:disabled)')?.focus();};
 expressionMenu.addEventListener('toggle',()=>{if(expressionMenu.open)closeEmoji();});
 document.addEventListener('click',event=>{if(!emojiPicker.hidden&&!emojiPicker.contains(event.target)&&!emoteButton.contains(event.target))closeEmoji();if(expressionMenu.open&&!expressionMenu.contains(event.target))expressionMenu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;if(!emojiPicker.hidden){closeEmoji(true);event.preventDefault();}else if(expressionMenu.open){expressionMenu.open=false;expressionSummary.focus();event.preventDefault();}});
 fetch('/api/social/options').then(async response=>{if(!response.ok)throw Error('無法載入 emoji');return response.json();}).then(({emojis})=>{for(const emoji of emojis){const button=document.createElement('button');button.type='button';button.textContent=emoji;button.setAttribute('aria-label',`送出 ${emoji} emoji 彈幕`);button.onclick=async()=>{if(await send({kind:'emoji',emoji},`已送出 ${emoji} emoji 彈幕`,button))closeEmoji(true);};emojiPicker.append(button);}}).catch(error=>{emojiPicker.textContent=error.message;});
 let state,loaded=false,loading=false,nextLoad=0,lastPlayers='',sending=false;
 const barrages=MotionPolicy.createBarrageController((item,lane,{moving,finish})=>{
  const bubble=element('div','game-barrage','');bubble.style.top=`${12+lane*18}%`;
  bubble.append(element('strong','',item.name+'：'));
  if(item.kind==='emoji'){bubble.classList.add('game-emoji-barrage');bubble.append(element('span','game-emoji-glyph',item.emoji));}
  else bubble.append(document.createTextNode(item.message));
  if(!moving)bubble.classList.add('game-barrage-static');
  barrageLayer.append(bubble);
  if(moving)bubble.style.setProperty('--barrage-travel',`-${barrageLayer.clientWidth+bubble.offsetWidth+24}px`);
  bubble.addEventListener('animationend',finish,{once:true});return ()=>bubble.remove();
 });
 const expressionSounds=window.ExpressionSounds?.create();
 window.addEventListener('pagehide',event=>{if(event.persisted){barrages.disconnect();expressionSounds?.reset();}else{barrages.dispose();expressionSounds?.destroy();}});
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
  leaveLink.hidden=false;
  if(window.RaceLesson)return;
  state=s;panel.hidden=false;if(!panel.classList.contains('integrated'))document.body.classList.add('has-game-shell');
  const current=s.type==='majority'||s.type==='draw'?s.presenterId:s.type==='thunder'?s.actor:s.type==='gift'?null:s.players[s.turn]?.id;
  const turn=q('#shared-turn'),turnText=turnOf(s);if(turn.textContent!==turnText)turn.textContent=turnText;turn.classList.toggle('mine',turnText.includes('輪到你'));
  const social=s.social||[],recent=new Map(),now=Date.now();
  expressionSounds?.update({contextId:`${s.type}:${s.code}:${s.me}`,serverNow:s.serverNow,events:[...(s.expressions||[]),...social.filter(item=>item.kind==='expression')]});
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
    const name=element('span','shared-player-name','');name.innerHTML=window.GameUI?.playerName?.(player.name)||escape(player.name);
    if(player.id===s.me)name.append(element('span','shared-player-self',' · 你'));row.append(name);
    const expression=recent.get(player.id);
    if(expression){const badge=element('span','shared-emote-label',expression.label||expression.expression);badge.title=`${player.name} 使用了「${badge.textContent}」`;row.append(badge);}
    if(player.id===current)row.append(element('b','','◀ 操作中'));
    players.append(row);
   }
   }
  }
  barrages.update(s);
  if(!loaded&&!loading&&Date.now()>=nextLoad)loadExpressions();
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
    button.onclick=async()=>{if(await send({kind:'expression',expression:key},`已送出「${label}」表情`,button)){expressionMenu.open=false;expressionSummary.focus();}};holder.append(button);
   }
   loaded=true;if(!sending)feedback('');
  }catch(error){nextLoad=Date.now()+5000;feedback(error.message,'error');}
  finally{loading=false;}
 }
 async function send(payload,confirmation,trigger){
  if(!state||sending)return false;
  sending=true;feedback('傳送中…');const buttons=[...panel.querySelectorAll('button'),...expressions.querySelectorAll('button')],disabled=buttons.map(button=>button.disabled);for(const button of buttons)button.disabled=true;q('#shared-barrage').setAttribute('aria-busy','true');if(window.GameUI)window.GameUI.setBusy(trigger,true);else if(trigger){trigger.setAttribute('aria-busy','true');trigger.classList.add('is-pending');}
  try{const response=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.code,...payload})});const result=await response.json();if(!response.ok)throw Error(result.error||'傳送失敗');if(window.RoomHost?.acceptSnapshot)window.RoomHost.acceptSnapshot(result);else update(result);feedback(confirmation,'success');return true;}
  catch(error){feedback(error.message,'error');return false;}
  finally{sending=false;if(window.GameUI)window.GameUI.setBusy(trigger,false);else if(trigger){trigger.removeAttribute('aria-busy');trigger.classList.remove('is-pending');}buttons.forEach((button,index)=>button.disabled=disabled[index]);q('#shared-barrage').removeAttribute('aria-busy');}
 }
 q('#shared-barrage').onsubmit=async event=>{event.preventDefault();const input=q('#shared-barrage input'),message=input.value.trim();if(!message)return;if([...message].length>40){feedback('文字彈幕最多 40 字','error');return;}if(await send({kind:'barrage',message},'文字彈幕已送出',q('#shared-barrage button[type=submit]'))&&input.value.trim()===message)input.value='';};
 q('#shared-toggle').onclick=()=>{const expanded=panel.classList.toggle('expanded');q('#shared-toggle').setAttribute('aria-expanded',String(expanded));q('#shared-toggle').textContent=expanded?'收合互動':'表情／彈幕';};
 window.addEventListener('focus',()=>{if(state){nextLoad=0;loadExpressions();}});
 let leaving=false;
 document.addEventListener('click',async event=>{
  const link=event.target.closest('a[href]');if(!state||!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(link.href);if(url.origin!==location.origin||url.pathname!=='/'||link.closest('.game-library-dialog'))return;
  event.preventDefault();if(leaving)return;leaving=true;
  try{
   const response=await fetch('/api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.code})});
   const result=await response.json();if(!response.ok&&!['ROOM_NOT_FOUND','NOT_SEATED','KICKED'].includes(result.code))throw Error(result.error||'無法離開房間');
   window.RoomReconnect?.forget(state.code);location.href=link.href;
  }catch(error){feedback(error.message,'error');leaving=false;}
 });
 const library=document.createElement('dialog');library.className='game-library-dialog';library.setAttribute('aria-labelledby','game-library-title');library.innerHTML='<div class="library-dialog-head"><strong id="game-library-title">新增題庫素材</strong><button type="button" aria-label="關閉題庫">關閉</button></div><iframe title="新增題庫素材"></iframe><p class="ui-status" id="game-library-status" role="status"></p>';document.body.append(library);let libraryTrigger=null;
 window.GameUI?.decorateButton(library.querySelector('button'),'close',{iconOnly:true,label:'關閉題庫'});
 library.addEventListener('close',()=>{
  if(window.GameUI?.openDialog||!libraryTrigger?.isConnected)return;
  let target=libraryTrigger;
  for(let ancestor=libraryTrigger.parentElement;ancestor;ancestor=ancestor.parentElement){
   if(ancestor.tagName==='DETAILS'&&!ancestor.open){const summary=ancestor.querySelector(':scope > summary');if(summary&&!summary.contains(target))target=summary;}
  }
  target.focus();
 });
 library.querySelector('button').onclick=()=>library.close();
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const url=new URL(link.href);if(url.origin!==location.origin||!['/gifts','/draw-words','/community'].includes(url.pathname))return;event.preventDefault();libraryTrigger=link;url.searchParams.set('embed','1');library.querySelector('iframe').src=url.pathname+url.search;const status=library.querySelector('#game-library-status');if(window.GameUI)window.GameUI.setStatus(status,'載入素材庫…');else status.textContent='載入素材庫…';if(window.GameUI)window.GameUI.openDialog(library,link);else library.showModal();});
 library.querySelector('iframe').onload=()=>{const doc=library.querySelector('iframe').contentDocument;if(!doc)return;const status=library.querySelector('#game-library-status');if(window.GameUI)window.GameUI.setStatus(status,'');else status.textContent='';const style=doc.createElement('style');style.textContent='header{display:none!important}body{padding:0!important}main{margin-top:12px!important}.gift-shell,.draw-shell,.shell{padding:0 16px!important}';doc.head.append(style);doc.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&new URL(link.href).pathname==='/'){event.preventDefault();library.close();}});};
 if(majorityAside){const link=document.createElement('a');link.href='/community?tab=questions';link.className='quiet';link.textContent='新增題庫素材';document.querySelector('.shell header nav')?.append(link);}
 function stableMarkup(target,markup){if(target._gameMarkup!==markup){target.innerHTML=markup;target._gameMarkup=markup;}}
 function settingsActions(){return '<div class="room-settings-actions"><button type="button" class="button room-settings-save" data-do="settings">儲存房間設定</button><p id="roomSettingsFeedback" class="ui-status" role="status" aria-live="polite"></p></div>';}
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function playerRow(player,{me,status='',metrics=[{value:player.score??player.stack??0,label:'分數'}]}={}){
  const avatar=player.avatar?'<img src="'+escape(player.avatar)+'" alt="">':'<span class="room-avatar-fallback">'+escape(String(player.name||'？').slice(0,1))+'</span>';
  const name=typeof window!=='undefined'&&window.GameUI?.playerName?window.GameUI.playerName(player.name):'<span class="ui-player-name" title="'+escape(player.name)+'">'+escape(player.name)+'</span>';
  return '<div class="room-player player" data-player-id="'+escape(player.id)+'"><div class="room-player-avatar">'+avatar+'</div><div class="room-player-info"><b class="room-player-name">'+name+(player.id===me?'<span class="room-player-self"> · 你</span>':'')+'</b><small>'+escape(status)+'</small></div><div class="room-player-metrics">'+metrics.map(metric=>'<strong title="'+escape(metric.label)+'" aria-label="'+escape(metric.label)+'：'+escape(metric.value)+'">'+escape(metric.value)+'</strong>').join('')+'</div></div>';
 }
 let historyNotice;
 function showHistoryWarning(warning){
  if(!historyNotice&&!warning)return;
  if(!historyNotice){
   historyNotice=document.createElement('p');historyNotice.className='room-history-warning ui-status';historyNotice.setAttribute('role','status');historyNotice.setAttribute('aria-live','polite');
   const anchor=document.querySelector('.game-toolbar,.race-heading,.game-title');
   if(anchor)anchor.after(historyNotice);else panel.before(historyNotice);
  }
  const message=typeof warning?.message==='string'?warning.message:'';
  historyNotice.hidden=!message;
  if(window.GameUI)window.GameUI.setStatus(historyNotice,message,{kind:'error'});else if(historyNotice.textContent!==message)historyNotice.textContent=message;
 }
 window.GameShell={update(s){window.TableMusic?.update(s);window.TableWatch?.update(s);return update(s);},disconnected:()=>{barrages.disconnect();expressionSounds?.reset();window.TableWatch?.disconnected();},stop:()=>{barrages.disconnect();expressionSounds?.reset();},stableMarkup,playerRow,settingsActions,showHistoryWarning};
})();
