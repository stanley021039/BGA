/* Stitch page adapters. Reuse native controls and immutable result services. */
(()=>{
 'use strict';
 if(!document.body.dataset.uiTemplate)return;
 const $=s=>document.querySelector(s),ui=window.GameUI;
 let state=null,actions=null,mounted=false,queued=false,lastPhase='',lastEpoch='',hintDialog,closedDialog,toastTimer,finishedKey='';
 const finishRenderers=new Set();
 const el=(tag,cls='',text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 const text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=value;};
 function button(label,icon,handler,cls=''){const b=el('button','st-button '+cls,label);b.type='button';if(icon)ui.decorateButton(b,icon,{label});if(handler)b.addEventListener('click',handler);return b;}
 function iconButton(label,icon,handler){const b=button(label,icon,handler,'st-icon-button');ui.decorateButton(b,icon,{iconOnly:true,label});return b;}
 function move(node,host){if(node&&host&&node.parentElement!==host)host.append(node);}
 async function request(url,body){const r=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(value.error||'操作暫時無法完成');return value;}
 function notify(message){const status=$('#stUiStatus');if(status){clearTimeout(toastTimer);text(status,message);status.style.opacity='1';toastTimer=setTimeout(()=>{status.style.opacity='0';setTimeout(()=>text(status,''),300);},2200);}}
 function confirm({title,text:description,label='確認',danger=false,trigger}={}){
  return new Promise(resolve=>{
   const body=el('p','st-confirm-copy',description),footer=el('div','st-confirm-actions');let accepted=false;
   const dialog=ui.createDialog({title,className:'st-confirm-dialog',content:[body],actions:[footer]});
   const cancel=button('取消','close',()=>dialog.close()),ok=button(label,danger?'leave':'check',()=>{accepted=true;dialog.close();},danger?'st-danger':'st-primary');footer.append(cancel,ok);
   document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted);},{once:true});ui.openDialog(dialog,trigger);cancel.focus();
  });
 }
 function makeHeader(){
  const header=$('[data-site-header]');if(!header||header.dataset.stitchMounted)return;header.dataset.stitchMounted='true';
  const title=header.querySelector('.site-title'),identity=el('div','st-brand'),logo=el('span','st-brand-mark');logo.innerHTML=ui.symbol('brush');
  const copy=el('div','st-brand-copy'),subtitle=el('small','st-brand-subtitle',document.body.dataset.gameKind==='draw'?'你畫我猜':'桌遊交誼廳');copy.append(title,subtitle);identity.append(logo,copy);header.prepend(identity);
  const originalLinks=header.querySelector('.site-links');
  if(document.body.dataset.gameKind==='draw'){
   const room=el('div','st-header-room');move($('#roomTag'),room);move($('#count'),room);move($('#invite'),room);identity.after(room);
   const nav=el('nav','st-game-nav');nav.setAttribute('aria-label','畫猜頁面');const board=el('a','','對戰畫板');board.href='#';board.setAttribute('aria-current','page');board.onclick=e=>{e.preventDefault();if($('#drawResults')?.open)$('#drawResults').close();};
   nav.append(board);move($('.game-toolbar a[href="/draw-words"]'),nav);move($('#reviewResults'),nav);const gallery=button('最近畫作',null,()=>actions?.results?.open(undefined,gallery),'st-gallery-proxy');nav.append(gallery);header.querySelector('.site-account').before(nav);
  }
  if(originalLinks){const more=el('details','st-site-more'),summary=el('summary');summary.setAttribute('aria-label','更多網站功能');summary.innerHTML=ui.symbol('more')||'•••';more.append(summary,originalLinks);header.querySelector('.site-account').before(more);
   if(document.body.dataset.gameKind==='draw'){move($('#help'),originalLinks);originalLinks.append(button('最近畫作','save',event=>actions?.results?.open(undefined,event.currentTarget)),button('共編題庫','help',()=>{location.href='/draw-words';}),button('複製房間連結','share',()=>actions?.invite()));}
   window.UIPopover?.bindDetails(more,originalLinks,{align:'end'});}
 }
 function makePhaseBar(){
  if($('.st-phase-bar'))return;
  const bar=el('section','st-phase-bar'),context=el('div','st-phase-context'),privateTag=el('span','st-private-label','你的專屬秘密題目'),hint=button('題庫提示','help',openHint,'st-hint-button'),skip=button('跳過此題','flag',skipRound,'st-skip-button');
  privateTag.id='stPrivateLabel';context.append(privateTag);move($('#boardTitle'),context);const secretRule=el('span','st-secret-rule','禁止寫字／數字');context.append(secretRule);
  const round=el('span','st-round-counter');round.id='stRoundCounter';bar.append(context,round);const duration=el('span','st-match-duration');duration.id='stMatchDuration';duration.hidden=true;bar.append(duration);move($('#drawCountdown'),bar);bar.append(hint,skip);bar.setAttribute('data-game-focus-overlay','');$('.draw-layout').before(bar);
  const clock=el('span','st-countdown-icon');clock.setAttribute('aria-hidden','true');clock.innerHTML=ui.symbol('timer');$('#drawCountdown').prepend(clock);
  const status=el('p','st-ui-status');status.id='stUiStatus';status.setAttribute('role','status');status.setAttribute('data-game-focus-overlay','');document.body.append(status);
  const dot=el('span','st-brush-preview');dot.id='stBrushPreview';$('.tpl-palette')?.append(dot);
  const filledRect=$('#tools [data-tool=rect][data-filled=true]'),ellipse=$('#tools [data-tool=ellipse]:not([data-filled])');if(filledRect&&ellipse)ellipse.before(filledRect);
  $('#color')?.addEventListener('input',updateBrush);$('#size')?.addEventListener('input',updateBrush);$('#swatches')?.addEventListener('click',()=>requestAnimationFrame(updateBrush));
  const artistLog=el('details','st-artist-log'),summary=el('summary','','猜題紀錄');artistLog.append(summary);$('.draw-roster').append(artistLog);
  const footer=el('footer','st-board-footer','請發揮創意，讓朋友看圖猜答案。');$('#boardSection').append(footer);
 }
 function updateBrush(){const dot=$('#stBrushPreview');if(!dot)return;const size=Math.min(28,Math.max(4,Number($('#size')?.value||6))),color=$('#color')?.value||'#1b1c1c';dot.style.setProperty('--st-brush-size',size+'px');dot.style.setProperty('--st-brush-color',color);for(const b of document.querySelectorAll('#swatches button')){const selected=b.dataset.color===color;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}}
 function phaseControls(){
  if(!state)return;const drawing=state.phase==='drawing',mine=state.presenterId===state.me;
  wordUi();
  text($('#stPrivateLabel'),drawing?(mine?'你的專屬秘密題目':'畫者正在作畫'):{waiting:'房間等待室',choosing:'選題階段',reveal:'本輪題目揭曉',finished:'對局已結束'}[state.phase]||'你畫我猜');
  text($('#stRoundCounter'),state.round?'回合 '+String(state.round).padStart(2,'0')+' / '+String(state.roundLimit).padStart(2,'0'):'等待開桌');
  $('.st-secret-rule').hidden=!drawing||!mine;$('.st-hint-button').hidden=!drawing;$('.st-skip-button').hidden=!drawing||!mine&&!state.host;
  text($('.st-skip-button .ui-button-label'),mine?'跳過此題':'跳過此輪');
  const guess=$('#drawGuessPanel');if(drawing&&mine)move(guess,$('.st-artist-log'));else move(guess,$('.draw-layout>main'));
  if(lastPhase==='choosing'&&drawing&&mine&&state.question&&actions?.live&&window.MotionPolicy?.allowsMotion()){
   const card=el('div','st-word-lock'),icon=el('span','st-word-lock-icon');icon.innerHTML=ui.symbol('brush');card.setAttribute('data-game-focus-overlay','');card.append(icon,el('small','','題目已鎖定'),el('strong','',state.question.title),el('p','','正在為你展開畫板與調色盤…'));document.body.append(card);setTimeout(()=>card.remove(),1200);
  }
  if(drawing&&lastEpoch!==state.canvasEpoch)updateBrush();
  lastEpoch=state.canvasEpoch;lastPhase=state.phase;
  const phase=$('.st-phase-bar');phase.dataset.phase=state.phase;
  const gallery=$('.st-gallery-proxy');if(gallery)gallery.disabled=!actions?.results||!state.recentResults?.length;
  text($('.st-board-footer'),mine?'你正在作畫中。請發揮創意，禁止直接寫出答案。':'看畫作猜答案；房間閒聊不會送成猜題。');
  for(const row of document.querySelectorAll('.room-player[data-player-id],.ui-room-roster-card[data-player-id]')){
   const player=state.players.find(p=>p.id===row.dataset.playerId);if(!player)continue;row.dataset.artist=String(player.id===state.presenterId);row.dataset.ready=String(player.ready===true);
   if(!row.querySelector('.st-player-status'))row.append(el('small','st-player-status'));
   text(row.querySelector('.st-player-status'),state.phase==='waiting'?(player.id===state.hostId?'房主 · ':'')+(player.ready?'● 已就緒':'● 已入座'):player.online===false?'暫時離線':player.waitingForNextRound?'下輪加入':player.id===state.presenterId?(state.phase==='choosing'?'● 選題中':drawing?'● 作畫中':'● 本輪畫者'):state.guessedIds.includes(player.id)?'✓ 已猜中':drawing&&!state.participantIds.includes(player.id)?'本輪未參與':'思考猜測中…');
   const guess=[...(state.guesses||[])].reverse().find(g=>g.id===player.id&&!g.correct);
   if(!row.querySelector('.st-player-guess'))row.append(el('p','st-player-guess'));
   const node=row.querySelector('.st-player-guess');text(node,guess?'猜測：'+guess.answer:'');node.hidden=!guess||!drawing||state.guessedIds.includes(player.id);
  }
  const center=$('.tpl-waiting-center');
  if(center&&state.phase==='waiting')waitingUi(center);
  if(center&&!center.querySelector('.st-ready-button'))center.append(button('準備好了！點擊就緒','check',()=>actions.action('ready',{ready:!state.players.find(p=>p.id===state.me)?.ready}),'st-ready-button st-primary'));
  if(center){const ready=state.players.find(p=>p.id===state.me)?.ready===true,b=center.querySelector('.st-ready-button');b.hidden=state.host||state.phase!=='waiting';b.setAttribute('aria-pressed',String(ready));text(b.querySelector('.ui-button-label'),ready?'已就緒（點擊切換）':'準備好了！點擊就緒');}
  const result=$('.stage-reveal');if(result&&!result.querySelector('.st-art-share'))result.querySelector('.tpl-result-actions')?.prepend(button('分享畫作','share',shareArtwork,'st-art-share'));
  const replay=$('.stage-finished [data-do=template-replay]');if(replay&&!replay.dataset.stitchReplay){replay.dataset.stitchReplay='true';ui.decorateButton(replay,'replay',{label:'再來一局（同桌再戰）'});}
 }
 async function skipRound(){if(!state)return;const captured={round:state.round,canvasEpoch:state.canvasEpoch};if(await confirm({title:'跳過這一題？',text:'本輪會立即揭曉，已取得的分數與畫作會保留。',label:'跳過此題',trigger:$('.st-skip-button')}))actions.action('skip',captured);}
 function openHint(){
  if(!state?.hint)return;
  if(!hintDialog)hintDialog=ui.Template.compositions.dialogPanel({title:'題庫提示',titleId:'stHintTitle',className:'st-hint-dialog'});
  hintDialog.body.replaceChildren(el('strong','',state.hint.length+' 字 · '+state.hint.category),el('p','',state.hint.topicLabel||'綜合'));
  if(state.presenterId===state.me&&state.question){hintDialog.body.append(el('p','',state.question.title),el('small','','只有當輪畫者可見題目；請使用畫作表達。'));}else hintDialog.body.append(el('p','','可依字數與類別思考，或請畫者再加一筆。'),button('要求加筆','chat',()=>{window.SharedChat?.compose('🤔 求提示，請再加一筆！');hintDialog.close();}));
  hintDialog.open($('.st-hint-button'));
 }
 async function shareArtwork(){
  const id=state?.result?.resultId;if(!id)return;
  try{const snapshot=await actions.results.store.load(id),blob=await window.ArtworkExport.png(snapshot),file=new File([blob],window.ArtworkExport.name(snapshot),{type:'image/png'});
   if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'你畫我猜 · '+(snapshot.result.answer||'畫作')});else{window.ArtworkExport.download(blob,file.name);notify('畫作已下載，可以分享給朋友。');}
  }catch(error){if(error.name!=='AbortError')notify(error.message);}
 }
 function guestSettings(){
  const side=$('.st-waiting-guest-aside');if(!side||side.hidden||!state||state.phase!=='waiting'||state.host)return;
  let summary=side.querySelector('.st-guest-settings-summary');
  if(!summary){
   summary=el('section','st-guest-settings-summary');summary.setAttribute('aria-label','目前房間規則');
   const heading=el('div','st-guest-rules-heading');heading.append(el('h2','','本局房間規則'),el('small','st-settings-badge','房主設定'));
   const topics=el('div','st-guest-topics');topics.append(el('small','','題目類別'),el('div','st-guest-topic-chips'));
   const grid=el('div','st-guest-rule-metrics');for(const [key,label]of [['seconds','作畫時間'],['ending','結算條件']]){const card=el('div');card.dataset.guestRule=key;card.append(el('small','',label),el('strong'));grid.append(card);}
   summary.append(heading,topics,grid,el('p','st-guest-rules-note','只有房主可以調整設定與開始遊戲。'),button('查看全部設定','settings',openGuestSettings));side.prepend(summary);
  }
  const topics=(state.options.topics||[]).map(key=>$('.ui-room-controls [value="'+key+'"]')?.closest('label')?.textContent.replace('✓','').trim()||key),key=topics.join('|'),chips=summary.querySelector('.st-guest-topic-chips');
  if(chips.dataset.topics!==key){chips.dataset.topics=key;chips.replaceChildren(...topics.slice(0,3).map(label=>el('span','',label)));if(topics.length>3)chips.append(el('span','','＋ '+(topics.length-3)+' 類'));chips.title=topics.join('、');}
  text(summary.querySelector('[data-guest-rule=seconds] strong'),state.options.seconds+' 秒');
  text(summary.querySelector('[data-guest-rule=ending] strong'),state.options.ending?.mode==='score'?state.options.ending.value+' 分':(state.options.ending?.value??state.players.length)+' 題');
 }

 function openGuestSettings(){
  const component=ui.Template.compositions.dialogPanel({title:'目前房間設定',className:'st-guest-settings-dialog'}),topics=state.options.topics||[];
  component.body.append(el('p','','作畫時間：'+state.options.seconds+' 秒'),el('p','',state.options.ending?.mode==='score'?'分數達標：'+state.options.ending.value+' 分':'總題數：'+(state.options.ending?.value??state.players.length)+' 題'),el('p','','題目類別：'+topics.map(key=>$('.ui-room-controls [value="'+key+'"]')?.closest('label')?.textContent.replace('✓','').trim()||key).join('、')),el('small','','只有房主可修改房間設定。'));
  component.root.addEventListener('close',()=>component.root.remove(),{once:true});component.open($('.st-guest-settings-summary button'));
 }
 function chatControls(){
  const panel=$('.shared-chat');if(!panel||panel.dataset.stitchQuick)return;panel.dataset.stitchQuick='true';
  text(panel.querySelector('.chat-heading'),'房間彈幕閒聊');const safe=el('p','st-chat-notice','✓ 閒聊與答案分流');panel.querySelector('.ui-panel-header')?.after(safe);
  const quick=el('div','st-chat-quick');panel.querySelector('.chat-room-footer')?.prepend(quick);
 }
 function chatPhase(){
  const quick=$('.st-chat-quick'),panel=$('.shared-chat');if(!quick||!state)return;const finished=state.phase==='finished',mode=finished?'finished':'playing';
  text(panel.querySelector('.chat-heading'),finished?'結算慶祝聊天室':'房間彈幕閒聊');
  if(quick.dataset.mode!==mode){quick.dataset.mode=mode;quick.replaceChildren(...(finished?['GG! 🔥','再來一局! 🔄','笑死 🤣','畫猜高手 🎨']:['👏','🤣','🔥','🏍️','❓','💯']).map(value=>button(value,null,()=>window.SharedChat?.compose(value))));}
 }
 function finishedControls(){
  const roster=$('.draw-roster');if(!state||!roster)return;
  text(roster.querySelector(':scope>h2'),state.phase==='finished'?'賽局總結':'即時玩家榜');chatPhase();
  const duration=$('#stMatchDuration'),seconds=Math.floor(((state.matchSummary?.endedAt||0)-(state.matchSummary?.startedAt||0))/1000);duration.hidden=state.phase!=='finished'||!state.matchSummary?.startedAt;text(duration,'對局耗時 '+String(Math.max(0,Math.floor(seconds/60))).padStart(2,'0')+':'+String(Math.max(0,seconds%60)).padStart(2,'0'));
  if(state.phase!=='finished'){finishedKey='';for(const renderer of finishRenderers)renderer.reset();finishRenderers.clear();return;}
  const list=(state.recentResults||[]).filter(item=>item.gameRunId===state.gameRunId),summary=state.matchSummary,key=JSON.stringify([state.gameRunId,summary,list.map(item=>item.resultId)]);
  if(key===finishedKey)return;finishedKey=key;for(const renderer of finishRenderers)renderer.reset();finishRenderers.clear();
  let root=roster.querySelector('.st-finished-summary');if(!root){root=el('section','st-finished-summary');roster.append(root);}
  const grid=el('div','st-summary-grid'),best=summary?.bestArtwork,success=summary?.eligibleGuesses?((summary.correctGuesses/summary.eligibleGuesses)*100).toFixed(1)+'%':'—';
  for(const [label,value,detail,person]of [['MVP 畫作',best?.answer||'尚無完成畫作','最多人猜中的畫作；不另加分'],['猜題成功率',success,'猜中人次／可猜題人次'],['最快猜中',summary?.fastest?(summary.fastest.milliseconds/1000).toFixed(1)+' 秒':'—','從開始作畫到猜中答案',summary?.fastest?.name],['保留筆畫',summary?.strokeCount??'—','本局各輪完成畫作的筆畫總數']]){const box=el('div','st-summary-metric');box.title=detail;const valueNode=el('strong','',value);valueNode.title=String(value);box.append(el('small','',label),valueNode,el('small','st-metric-person',person||''));grid.append(box);}
  const highlights=el('section','st-finished-highlights');highlights.append(el('h3','','精彩名場面'),el('small','','目前保留本局最近 '+list.length+' 幅'));
  root.replaceChildren(grid,highlights);
  const items=[...list].sort((a,b)=>b.guessedIds.length-a.guessedIds.length||a.round-b.round).slice(0,3);
  for(const item of items){const card=button('查看第 '+item.round+' 輪畫作',null,()=>actions.results?.open(item.resultId,card),'st-highlight'),canvas=el('canvas'),copy=el('span');canvas.width=512;canvas.height=256;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','第 '+item.round+' 輪畫作縮圖');copy.append(el('strong','','R'+item.round+' · '+(item.answer||'未選定題目')),el('small','',(item.artist?.name||'畫者')+' · '+item.guessedIds.length+' 人猜中'));card.replaceChildren(canvas,copy);card.title='開啟最近畫作：'+(item.answer||'第 '+item.round+' 輪');highlights.append(card);
   actions.results?.store.load(item.resultId).then(async snapshot=>{if(finishedKey!==key||state.phase!=='finished'||!canvas.isConnected)return;const renderer=window.StrokeCanvas.createDrawingRenderer(canvas,{maxCheckpoints:2});finishRenderers.add(renderer);await renderer.renderCooperatively(snapshot.canvas.strokes);if(finishedKey!==key)renderer.reset();}).catch(()=>{canvas.setAttribute('aria-label','縮圖暫時無法載入，點擊回看畫作');});
  }
  const banner=panelBanner();if(banner)text(banner,'🏆 '+state.players.filter(player=>state.winner?.ids.includes(player.id)).map(player=>player.name).join('、')+' · 本局獲勝');
  const exportButton=$('[data-do=template-export]');if(exportButton)exportButton.title='匯出目前保留的本局最近 '+list.length+' 幅 PNG 畫作';
 }
 function panelBanner(){const panel=$('.shared-chat');if(!panel)return null;let banner=panel.querySelector('.st-finish-banner');if(!banner){banner=el('p','st-finish-banner');panel.querySelector('.ui-panel-header')?.after(banner);}return banner;}
 function hostControls(){
  const dialog=$('#hostPlayers');if(!dialog||dialog.dataset.stitchExtras)return;dialog.dataset.stitchExtras='true';const footer=el('footer','st-host-extras'),code=el('p','st-host-link');footer.append(code,button('複製連結','share',()=>actions?.invite()),button('解散房間','leave',dissolve,'st-danger'));dialog.append(footer);
  const list=$('#hostPlayerList');new MutationObserver(()=>{
   if(!state?.host)return;
   for(const row of list.children){const native=row.querySelector('[data-kick]');if(!native||row.querySelector('.st-transfer-host'))continue;const target=state.players.find(p=>p.id===native.dataset.kick);if(!target||target.bot)continue;
    row.querySelector('.host-player-actions')?.prepend(button('移交房主','crown',async event=>{if(await confirm({title:'移交房主給 '+target.name+'？',text:'對方將取得開始遊戲、設定和房間管理權限。',label:'移交房主',trigger:event.currentTarget}))actions.action('transfer-host',{playerId:target.id});},'st-transfer-host'));
   }
  }).observe(list,{childList:true,subtree:true});
 }
 async function dissolve(){if(!state?.host)return;const epoch=state.canvasEpoch;if(!await confirm({title:'確定要解散這桌？',text:'所有朋友會離開房間；已記錄的對局與私人收藏會保留。',label:'解散房間',danger:true,trigger:$('#hostPlayers .st-danger')}))return;
  try{await actions.api('draw/dissolve',{confirmed:true,canvasEpoch:epoch});location.href='/';}catch(error){notify(error.message);}
 }
 function roomError(error){if(!['ROOM_NOT_FOUND','NOT_SEATED'].includes(error?.code)||closedDialog)return;const missing=error.code==='ROOM_NOT_FOUND';closedDialog=ui.Template.compositions.dialogPanel({title:missing?'這桌朋友已經解散囉！':'你目前不在這桌',titleId:'stClosedTitle',className:'st-closed-dialog'});const a=el('a','st-button st-primary','返回大廳挑選遊戲');a.href='/';const join=el('a','st-button','輸入其他 6 碼代碼');join.href='/?join=1';closedDialog.body.append(el('p','',missing?'房間已關閉。回到大廳，可以再開一桌或加入朋友。':'座位連線已結束，請回到大廳重新加入朋友。'),a,join);closedDialog.open();}
 function inlineProfile(){
  const menu=$('#site-account-menu');if(!menu||menu.dataset.stitchProfile)return;menu.dataset.stitchProfile='true';
  const section=el('section','st-profile'),form=el('form','st-profile-name'),input=el('input'),save=button('儲存','save'),preview=el('img','st-profile-preview'),grid=el('div','st-profile-characters'),status=el('p','st-profile-status');input.name='displayName';input.maxLength=16;input.required=true;input.setAttribute('aria-label','玩家暱稱');save.type='submit';status.setAttribute('role','status');form.append(input,save);section.append(el('h3','','帳號與形象'),preview,form,grid,status);menu.prepend(section);
  let appearance=null,busy=false,loaded=false;
  async function load(){if(loaded||menu.hidden)return;loaded=true;try{const [me,settings,options]=await Promise.all([request('/api/auth/me'),request('/api/profile/settings'),request('/api/profile/options')]);input.value=me.displayName;appearance=settings.appearance;preview.src='/api/profile/avatar';preview.alt='目前角色形象';
    const current=options.characters.find(c=>c.id===appearance.characterId);if(current)preview.src=current.expressions[appearance.expression]||current.expressions.neutral;
    for(const c of options.characters){const b=button(c.name,null,async()=>{if(busy)return;busy=true;try{const next={...appearance,characterId:c.id,expression:'neutral'};await request('/api/profile/appearance',next);appearance=next;preview.src=c.expressions.neutral;window.dispatchEvent(new CustomEvent('profile-updated'));text(status,'已選用 '+c.name);for(const other of grid.children)other.setAttribute('aria-pressed',String(other===b));}catch(error){text(status,error.message);}finally{busy=false;}});b.title=c.name;b.setAttribute('aria-label','選用 '+c.name);b.setAttribute('aria-pressed',String(c.id===appearance.characterId));const img=el('img');img.src=c.expressions.neutral;img.alt='';b.replaceChildren(img);grid.append(b);}
   }catch(error){loaded=false;text(status,error.message);}}
  new MutationObserver(load).observe(menu,{attributes:true,attributeFilter:['hidden']});
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;save.disabled=true;try{const me=await request('/api/profile/name',{displayName:input.value.trim()});input.value=me.displayName;window.dispatchEvent(new CustomEvent('profile-updated'));text(status,'暱稱已儲存。');}catch(error){text(status,error.message);}finally{busy=false;save.disabled=false;}};
 }
 function lobbyControls(){
  const dialog=$('#createRoomDialog');if(!dialog||dialog.dataset.stitchCreate)return;dialog.dataset.stitchCreate='true';
  const pick=el('select','st-create-game');pick.setAttribute('aria-label','選擇遊戲');const cards=[...document.querySelectorAll('.game-tile[data-game]')];
  for(const card of cards){const option=el('option','',card.querySelector('h2')?.childNodes[0]?.textContent.trim()||card.dataset.game);option.value=card.dataset.game;pick.append(option);}
  const label=el('label','st-create-label','挑選遊戲');label.append(pick);const settings=el('section','st-create-options'),time=el('select'),rounds=el('input');time.id='stCreateSeconds';time.setAttribute('aria-label','預設每回合秒數');
  for(const value of [60,90,120]){const option=el('option','',value+' 秒');option.value=value;time.append(option);}time.value='60';
  rounds.id='stCreateRounds';rounds.type='number';rounds.min='1';rounds.max='64';rounds.value='8';rounds.setAttribute('aria-label','預設總題數');
  const a=el('label','','每回合秒數'),b=el('label','','預設總題數');a.append(time);b.append(rounds);settings.append(a,b);
  const nativeName=$('#roomName'),nameField=nativeName?.closest('.launch-input,.ui-field')||nativeName,error=el('p','st-lobby-error');error.id='stCreateError';error.setAttribute('role','status');nameField?.before(label);nameField?.after(settings,error);
  text(dialog.querySelector(':scope>p'),'填好房間名稱，邀請朋友一起入座。進入房間後可再調整遊戲設定。');
  const sync=card=>{pick.value=card?.dataset.game||'draw';settings.hidden=pick.value!=='draw';};sync(document.querySelector('.game-tile.selected'));
  pick.onchange=()=>cards.find(card=>card.dataset.game===pick.value)?.click();document.querySelector('[data-card-carousel]')?.addEventListener('game-card-selected',e=>sync(e.detail.card));
  const code=$('#code'),panel=$('.room-code-panel');if(code&&panel){code.maxLength=6;
   const label=panel.querySelector('label[for="code"]');if(label){const hint=el('span','st-code-hint',code.placeholder||'6 碼代碼');hint.id='stCodeHint';hint.setAttribute('aria-hidden','true');label.append(hint);code.setAttribute('aria-describedby',((code.getAttribute('aria-describedby')||'')+' '+hint.id).trim());}code.removeAttribute('placeholder');
   code.addEventListener('input',e=>{if(!e.isComposing)code.value=code.value.toUpperCase();});
   const entry=el('div','st-code-entry');code.before(entry);entry.append(code);const cells=[];for(let i=0;i<6;i++){const cell=el('span','st-code-slot');cell.setAttribute('aria-hidden','true');entry.append(cell);cells.push(cell);}
   function syncCode(){const value=code.value;cells.forEach((cell,i)=>{text(cell,value[i]||'');cell.dataset.active=String(document.activeElement===code&&i===Math.min(code.selectionStart??value.length,5));});}
   for(const event of ['input','focus','blur','click','keyup','select'])code.addEventListener(event,syncCode);syncCode();
   if(new URLSearchParams(location.search).get('join')==='1')code.focus();
   const status=el('p','st-lobby-error');status.id='stJoinError';status.setAttribute('role','status');panel.append(status,button('重新輸入','replay',()=>{code.value='';text(status,'');code.removeAttribute('aria-invalid');code.focus();syncCode();},'st-code-reset'));
  }
 }
 function createOptions(game){if(game!=='draw')return {};const seconds=Number($('#stCreateSeconds')?.value||60),rounds=Number($('#stCreateRounds')?.value||8);if(![60,90,120].includes(seconds)||!Number.isInteger(rounds)||rounds<1||rounds>64)throw Error('總題數需為 1–64 題');return {seconds,ending:{mode:'rounds',value:rounds}};}
 function lobbyError(message){const create=$('#createRoomDialog')?.open,status=$(create?'#stCreateError':'#stJoinError');text(status,message);if(!create)$('#code')?.setAttribute('aria-invalid','true');}
 /* Editable Figma exports supply visual objects; room state supplies all content. */
 function figmaIcon(host,file,{prepend=false,tone='ink'}={}){
  if(!host)return;
  if(host.dataset.stAssetUnavailable===file)return;
  if(host.querySelector('img.st-figma-icon')?.getAttribute('src')==='/assets/stitch/figma/'+file)return;
  const original=[...host.childNodes],image=el('img','st-figma-icon');image.src='/assets/stitch/figma/'+file;image.alt='';image.setAttribute('aria-hidden','true');image.dataset.tone=tone;
  image.onerror=()=>{host.dataset.stAssetUnavailable=file;image.remove();if(!prepend)host.replaceChildren(...original);};
  if(prepend){host.querySelector('img.st-figma-icon')?.remove();host.prepend(image);}else host.replaceChildren(image);
 }
 function exportedIcons(){
  const tag=$('#roomTag');if(tag&&!tag.closest('.st-room-code-chip')){const chip=el('div','st-room-code-chip'),copy=iconButton('複製房間代碼','save',async()=>{if(!state)return;try{await navigator.clipboard.writeText(state.code);notify('房間代碼已複製。');}catch{notify('暫時無法複製；房間代碼是 '+state.code);}});copy.classList.add('st-room-code-copy');tag.before(chip);chip.append(tag,copy);}
  const copyCode=$('.st-room-code-copy');if(copyCode){copyCode.hidden=!state;figmaIcon(copyCode.querySelector('.ui-button-icon'),'ux02-22.svg');}
  const invite=$('#invite');if(invite&&invite.getAttribute('aria-label')!=='邀請')ui.decorateButton(invite,'invite',{label:'邀請'});
  if(invite&&!invite.dataset.stInvite){invite.dataset.stInvite='true';invite.onclick=()=>window.RoomInvites?.ready?window.RoomInvites.open(invite):actions?.invite();}
  if(state){text($('#count'),state.players.length+'/8 人入座');figmaIcon($('#count'),'ux02-23.svg',{prepend:true,tone:'accent'});}
  figmaIcon($('.st-brand-mark'),'ux02-21.svg',{tone:'accent'});
  figmaIcon($('.site-settings-button .ui-button-icon'),'ux02-25.svg');
  figmaIcon($('#invite .ui-button-icon'),'ux02-24.svg',{tone:'accent'});
  figmaIcon($('.st-private-label'),'ux06-01.svg',{prepend:true,tone:'accent'});
  figmaIcon($('.st-countdown-icon'),'ux06-03.svg',{tone:'accent'});
  figmaIcon($('.st-hint-button .ui-button-icon'),'ux06-04.svg');
  figmaIcon($('.st-skip-button .ui-button-icon'),'ux06-05.svg',{tone:'accent'});
  for(const [selector,file]of [['[data-tool=brush]','ux06-14.svg'],['[data-tool=erase]','ux06-15.svg'],['[data-tool=line]','ux06-16.svg'],['[data-tool=rect]:not([data-filled])','ux06-17.svg'],['[data-tool=rect][data-filled=true]','ux06-18.svg'],['[data-tool=ellipse]:not([data-filled])','ux06-19.svg'],['[data-tool=ellipse][data-filled=true]','ux06-20.svg'],['[data-tool=fill]','ux06-21.svg'],['#undo','ux06-22.svg'],['#clear','ux06-23.svg']]){const button=$('#tools '+selector);figmaIcon(button?.querySelector('.ui-button-icon')||button,file,{tone:selector==='#clear'?'accent':'ink'});}
  updateBrush();
 }
 function chatDock(){
  const guess=$('#drawGuessPanel');if(guess){guess.setAttribute('aria-label','猜題作答專區');text(guess.querySelector('.guess-chat-head>strong'),'猜題作答專區');}
 }
 function wordUi(){
  if(!state||state.phase!=='drawing')return;
  const title=$('#boardTitle'),mine=state.presenterId===state.me,hint=state.hint;
  if(!title)return;
  const word=mine?(state.question?.title||'本輪畫布'):(hint?.length>6?'● × '+hint.length:'●'.repeat(hint?.length||2));
  const meta=hint?'（'+hint.length+' 字 · '+(hint.topicLabel||hint.category)+'）':'';
  const key=word+'|'+meta;
  if(title.dataset.stWordKey!==key||!title.querySelector('.st-word-name')){title.dataset.stWordKey=key;title.replaceChildren(el('span','st-word-name',word),el('small','st-word-meta',meta));}
  title.title=word+' '+meta;
 }
 function makeFooter(){
  let footer=$('.st-site-footer');
  if(!footer){footer=el('footer','st-site-footer');footer.append(el('span','','302 捉猶團 © 2025 · 歡樂休閒派對桌遊平台'));const connection=el('span','st-footer-connection');connection.append(el('span','st-connection-dot'),el('span','st-footer-status','房間連線中'));footer.append(connection);$('.draw-shell')?.append(footer);}
  text(footer.querySelector('.st-footer-status'),$('#connection')?.textContent.trim()||'房間連線中');
 }
 function waitingUi(center){
  if(!state||state.phase!=='waiting')return;
  const scene=ui.Template.patterns.waitingScene(center,state,{owner:state.host,hostId:state.hostId,capacity:8,title:'你畫我猜',english:'Draw & Guess',limit:'2–8 人一起畫',art:state.host?'/assets/stitch/figma/ux02-03.png':'/assets/stitch/waiting-guest.jpg',fallbackArt:'/assets/stitch/waiting-host.jpg',kicker:'朋友集結中，畫筆已備，等房主開畫。',description:'2–8 人一起玩。輪流挑題作畫，其他朋友一起猜出答案。邀請朋友入座，設定好就能開始。',readyCopy:'畫筆與題卡已備妥',facts:[['每輪輪替','全員輪流畫'],['計分機制','愈快猜愈高'],['繪圖工具','12 色＋粗細']],onCopy:()=>actions?.invite(),onChat:event=>window.RoomLayout?.openChat(event.currentTarget),onHelp:event=>ui.openDialog($('#rules'),event.currentTarget),onDissolve:dissolve,onLeave:event=>window.RoomControls?.leave(event.currentTarget),onInvite:event=>window.RoomInvites?.ready?window.RoomInvites.open(event.currentTarget):actions?.invite()});
  if(!scene)return;const {banner,list,rail,panel,row,manage}=scene;
  figmaIcon(banner.querySelector('.st-ready-mark'),'ux02-12.svg',{tone:'accent'});for(const n of list?.querySelectorAll('.st-empty-seat>span:first-child')||[])figmaIcon(n,'ux02-10.svg');figmaIcon(list?.querySelector('[data-room-common-action=bot] .ui-symbol'),'ux02-09.svg',{tone:'accent'});
  figmaIcon(rail.querySelector('.st-waiting-help .ui-button-icon'),'ux02-19.svg');figmaIcon(rail.querySelector('.st-waiting-dissolve .ui-button-icon'),'ux02-20.svg',{tone:'accent'});figmaIcon(row?.querySelector('[data-room-action=start] .ui-button-icon'),'ux02-15.svg',{tone:'accent'});figmaIcon(row?.querySelector('.st-waiting-invite .ui-button-icon'),'ux02-16.svg');figmaIcon(manage?.querySelector('.ui-button-icon'),'ux02-17.svg');
  const seconds=panel?.querySelector('input[name=seconds]')?.closest('fieldset');if(seconds){seconds.classList.add('st-seconds-options');for(const input of seconds.querySelectorAll('input[name=seconds]')){const label=input.nextElementSibling;if(label&&!label.querySelector('.st-duration-note'))label.append(el('small','st-duration-note',{60:'標準',90:'充裕',120:'悠閒'}[input.value]||''));}}
  const topics=panel?.querySelector('.topic-options');if(topics)topics.title=topics.querySelector('.topic-hint')?.textContent||'至少選擇一個題目類別';
 }

 function ensure(){queued=false;if(!mounted)return;makeHeader();inlineProfile();if(document.body.dataset.gameKind==='draw'){makePhaseBar();chatControls();chatDock();hostControls();makeFooter();exportedIcons();if(state){phaseControls();guestSettings();finishedControls();exportedIcons();text($('.st-host-link'),location.origin+'/draw/'+state.code);}}else lobbyControls();}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(ensure);}}
 function mount(){mounted=true;ensure();for(const name of ['room-controls-rendered','room-chat-ready','site-header-ready','room-invitations-ready','profile-updated'])window.addEventListener(name,schedule);const lobby=$('.club');if(document.body.dataset.gameKind!=='draw'&&lobby)new MutationObserver(schedule).observe(lobby,{childList:true,subtree:true});window.MotionPolicy?.subscribe(prefs=>{document.body.dataset.stitchMotion=String(prefs.enabled&&!prefs.reduced);});}
 window.StitchGameUI={confirm,roomError,createOptions,lobbyError,update(next,handlers){state=next;actions=handlers;if(mounted){phaseControls();guestSettings();finishedControls();}schedule();}};
 window.addEventListener('pagehide',()=>{for(const renderer of finishRenderers)renderer.reset();finishRenderers.clear();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
