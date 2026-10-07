'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rankLabels={great:'最想要 · +3',good:'想要 · +2',ok:'還可以 · +1',noWay:'最不想要 · −4',unranked:'沒標記 · −1'};
const storyRankLabels={great:'最想要',good:'想要',ok:'還可以',noWay:'最不想要',unranked:'沒標記'};
const rankKeys=['great','good','ok','noWay'];
const categoryGlyphs={日常:'☕',體驗:'✧',奇想:'✦',冒險:'◆',成人派對:'☾'};
const customPercentOptions=[['','依題庫比例'],['0','0% · 只抽內建'],['25','25% · 偶爾投稿'],['50','50% · 均衡'],['75','75% · 投稿優先'],['100','100% · 盡量投稿']];
const customPercentLabel=value=>value===null?'依題庫比例':value+'%';
const customPercentSelect=value=>customPercentOptions.map(([number,label])=>`<option value="${number}" ${(value===null?'':String(value))===number?'selected':''}>${label}</option>`).join('');
let code=(location.pathname.match(/\/gift\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'';
let session=null,state=null,busy=false,polling=false,disconnected=false,signature='',inviteBase=location.origin;
let draftGifts={},draftLikes=[],activeGiftRecipient=null,activeResultRecipient=null,activeChoicePanel="give";
let focusTimer=null,knownAchievements=null,stageAnimations=[];
const motionGate=MotionPolicy.createGate();
try{session=JSON.parse(localStorage.getItem(code?'ah-gift:'+code:'ah-gift')||'null');if(session&&!code)code=session.code;}catch{}


function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500);}
async function api(route,data){
 return RoomApi.request(route,data,{code,room:'gift',session,onKicked:()=>{RoomHost.kicked(session);session=null;}});
}
function save(result){session=result;code=result.code;localStorage.setItem('ah-gift',JSON.stringify(result));localStorage.setItem('ah-gift:'+code,JSON.stringify(result));history.replaceState(null,'','/gift/'+code);}
function player(id){return state?.players.find(item=>item.id===id);}
function giftThumb(gift,index){const fallback=`<span class="choice-placeholder" aria-hidden="true" ${gift.image?'hidden':''}>${categoryGlyphs[gift.category]||'✦'}<small>${index+1}</small></span>`;return gift.image?`<img src="${esc(gift.image)}" alt="" loading="lazy">${fallback}`:fallback;}
function giveChoice(gift,index,recipient){return `<button type="button" class="gift-choice" data-give-recipient="${esc(recipient.id)}" data-gift-id="${esc(gift.id)}" aria-label="送給 ${esc(recipient.name)}：${esc(gift.title)}" aria-pressed="false"><span class="choice-art">${giftThumb(gift,index)}</span><span class="choice-title">${esc(gift.title)}</span><span class="choice-badge"></span></button>`;}
function likeChoice(gift,index){return `<button type="button" class="gift-choice" data-like-gift="${esc(gift.id)}" aria-label="選擇喜好：${esc(gift.title)}" aria-pressed="false"><span class="choice-art">${giftThumb(gift,index)}</span><span class="choice-title">${esc(gift.title)}</span><span class="choice-badge"></span></button>`;}
function syncChoices(){
 if(!state||state.phase!=='choosing')return;
 GameShell.stableMarkup($('#players'),state.players.map(playerRow).join(''));
 for(const button of document.querySelectorAll('[data-give-recipient]')){
  const selected=draftGifts[button.dataset.giveRecipient]===button.dataset.giftId;
  button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  button.querySelector('.choice-badge').textContent=selected?'已選給這位朋友':'';
 }
 for(const tab of document.querySelectorAll('[data-recipient-tab]')){const item=player(tab.dataset.recipientTab),name=item?.name||'朋友',selected=!!draftGifts[tab.dataset.recipientTab];tab.textContent=name+(selected?' ✓':'');tab.setAttribute('aria-label',name+(selected?'，已選禮物':'，尚未選禮物'));tab.title=name;}
 const ranking=state.ownRanking?rankKeys.map(key=>state.ownRanking[key]):draftLikes;
 const wishSummary=$('#wishSummary');if(wishSummary)GameShell.stableMarkup(wishSummary,rankKeys.map((key,index)=>`<div class="${ranking[index]?'filled':''}"><dt>${index+1}. ${esc(rankLabels[key])}</dt><dd>${esc(state.gifts.find(gift=>gift.id===ranking[index])?.title||'尚未選擇')}</dd></div>`).join(''));
 const needed=state.players.length-1,giveCount=Object.keys(draftGifts).length,giveSubmit=$('#giveSubmit');
 if(giveSubmit)giveSubmit.disabled=busy||!!state.ownAssignments||giveCount!==needed;const giveTask=$("#giveTaskProgress");if(giveTask)giveTask.textContent=state.ownAssignments?"完成 ✓":`${giveCount} / ${needed}`;
 const giveStatus=$('#giveStatus');if(giveStatus)giveStatus.textContent=`已選 ${giveCount} / ${needed} 位朋友`;
 for(const button of document.querySelectorAll('[data-like-gift]')){
  const index=draftLikes.indexOf(button.dataset.likeGift),selected=index!==-1;
  button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  button.querySelector('.choice-badge').textContent=selected?`${index+1}. ${rankLabels[rankKeys[index]]}`:'';
  const gift=state.gifts.find(item=>item.id===button.dataset.likeGift);
  button.setAttribute('aria-label',`${gift?.title||'禮物'}${selected?`，目前第 ${index+1} 順位，點擊取消`:'，點擊加入下一個順位'}`);
 }
 const wishSubmit=$('#wishSubmit');if(wishSubmit)wishSubmit.disabled=busy||!!state.ownRanking||draftLikes.length!==4;const wishTask=$("#wishTaskProgress");if(wishTask)wishTask.textContent=state.ownRanking?"完成 ✓":`${draftLikes.length} / 4`;
 const next=$('#likeNext');if(next)next.textContent=draftLikes.length<4?`下一個：${rankLabels[rankKeys[draftLikes.length]]}（${draftLikes.length+1} / 4）`:'四件已選好；再點已選禮物可取消並重新排序。';
}
function playerRow(item){const giftId=(state.ownAssignments||draftGifts)[item.id],chosenGift=state.gifts.find(gift=>gift.id===giftId),privateGift=state.phase==='choosing'&&item.id!==state.me?'<span class="player-private-gift">你送：'+esc(chosenGift?.title||'尚未選擇')+'</span>':'';const task=state.phase==='choosing'?` · 送禮${state.gaveIds.includes(item.id)?'已鎖定':'未鎖定'} · 心願${state.wishedIds.includes(item.id)?'已鎖定':'未鎖定'}`:state.phase==='delivering'&&item.id===state.delivery.recipientId?' · 確認收禮中':'';return GameShell.playerRow(item,{me:state.me,status:(item.id===state.hostId?'房主 · ':'')+(item.online?'在線':'暫時離線')+task,metrics:[{value:item.giveScore,label:'送禮分數'},{value:item.getScore,label:'收禮分數'}]}).replace(/<small>(.*?)<\/small>/, '').replace(/<\/div>$/, '<small class="roster-player-status">'+esc((item.id===state.hostId?'房主 · ':'')+(item.online?'在線':'暫時離線')+task)+'</small>'+privateGift+'</div>');}
function actionFeedback(message,kind='info',settings=false){
 const node=$(settings?'#roomSettingsFeedback':'#gameActionFeedback')||$('#gameActionFeedback');if(!node)return;
 if(window.GameUI)GameUI.setStatus(node,message,{kind});else{node.textContent=message;node.dataset.kind=kind;}
}
function syncActionBusy(){
 const slot=$('[data-game-action-slot]');if(!slot)return;slot.setAttribute('aria-busy',String(busy));
 for(const button of [...slot.querySelectorAll('button'),...document.querySelectorAll('.room-settings-save')]){
  if(busy){if(!button.hasAttribute('data-idle-disabled'))button.dataset.idleDisabled=String(button.disabled);button.disabled=true;}
  else if(button.hasAttribute('data-idle-disabled')){button.disabled=button.dataset.idleDisabled==='true';delete button.dataset.idleDisabled;}
 }
}
function bindGamePopovers(container){
 for(const details of container.querySelectorAll('.setting-details,.end-answering')){
  if(details._gamePopoverBound)continue;let panel=details.querySelector('.game-popover-panel');
  if(!panel){panel=document.createElement('div');panel.className='game-popover-panel';for(const child of [...details.children])if(child.tagName!=='SUMMARY')panel.append(child);details.append(panel);}
  if(window.GameUI?.bindPopover){GameUI.bindPopover(details,panel,{width:320});details._gamePopoverBound=true;}
 }
}
function renderAction(){
 if(!state)return;const s=state;let html='';
 if(s.phase==='waiting')html='<h2>準備開桌</h2>'+(s.host?'<button class="button" data-do="start" '+(s.players.length<3?'disabled':'')+'>'+(s.players.length<3?'還差 '+(3-s.players.length)+' 位朋友':'開始送禮')+'</button>':'<p>等待房主開始</p>');
 else if(s.phase==='choosing')html='<h2>第 '+s.round+' 輪 · 目標 '+s.target+' 分</h2><div class="gift-task-progress"><div><span>送禮 <b id="giveTaskProgress"></b></span><button id="giveSubmit" class="button" type="submit" form="giveForm" '+(s.ownAssignments?'disabled':'')+'>'+(s.ownAssignments?'已鎖定 ✓':'鎖定送禮')+'</button></div><div><span>心願 <b id="wishTaskProgress"></b></span><button id="wishSubmit" class="button" type="submit" form="wishForm" '+(s.ownRanking?'disabled':'')+'>'+(s.ownRanking?'已鎖定 ✓':'鎖定心願')+'</button></div></div><p id="progress" class="small"></p>';
 else if(s.phase==='delivering'){const recipient=player(s.delivery.recipientId);html='<h2>收禮 '+(s.delivery.index+1)+' / '+s.delivery.total+'</h2>'+(s.me===s.delivery.recipientId?'<button class="button" data-do="accept">確認收禮</button>':'<p>等待 '+esc(recipient?.name||'朋友')+' 確認收禮</p>')+'<p class="small">所有人收完才公布分數</p>';}
 else html='<h2>'+(s.phase==='finished'?'本局完成':'本輪完成')+'</h2>'+(s.host?'<button class="button" data-do="'+(s.phase==='finished'?'start':'next')+'">'+(s.phase==='finished'?'再玩一局':'開始下一輪')+'</button>':'<p>等待房主'+(s.phase==='finished'?'開新局':'開始下一輪')+'</p>');
 GameShell.stableMarkup($('#gameActions'),html);syncActionBusy();
 for(const button of $('#gameActions').querySelectorAll('button')){const key=button.dataset.do==='settings'?'settings':button.dataset.do==='next'?'next':button.matches('#giveSubmit,#wishSubmit')?'lock':'check';window.GameUI?.decorateButton(button,key);}
}
function showChoicePanel(panel){
 activeChoicePanel=panel;
 for(const section of document.querySelectorAll('[data-choice-section]'))section.hidden=section.dataset.choiceSection!==panel;
 for(const button of document.querySelectorAll('[data-choice-panel]'))button.setAttribute('aria-pressed',String(button.dataset.choicePanel===panel));
}

function progress(){const label=$('#progress');if(label&&state?.phase==='choosing')label.textContent=`全桌：送禮 ${state.gaveIds.length}/${state.players.length} · 心願 ${state.wishedIds.length}/${state.players.length}`;}
function storyAvatar(item){return item?.avatar?`<img src="${esc(item.avatar)}" alt="" loading="eager"><span class="story-avatar-fallback" aria-hidden="true" hidden>✦</span>`:'<span class="story-avatar-fallback" aria-hidden="true">✦</span>';}
function giftStoryStage(s){
 if(!s.result)return '';
 return `<div class="gift-story" role="group" aria-label="禮物揭曉舞台"><div class="gift-story-rest">${s.phase==='finished'?winnerStage(s):'<span class="gift-story-seal" aria-hidden="true">✦ 🎁 ✦</span>'}<p>本輪 ${s.result.entries.length} 件禮物已揭曉；每份心意與分數都列在下方。</p></div><div id="giftSpotlight" class="gift-spotlight" hidden><div id="giftFocusContent" class="gift-focus-content" aria-live="off"></div><button type="button" class="quiet" data-do="skip-focus">跳過演出</button></div><button type="button" class="quiet spotlight-control" data-do="replay-focus" ${allowsMotion()?'':'hidden'}>重播焦點禮物 ↻</button></div>`;
}
function winnerStage(s){
 const winners=s.winner?.ids||[];
 if(!winners.length)return '';
 return `<div id="giftVictory" class="gift-victory" role="group" aria-label="本局得勝者">${winners.map(id=>{const item=s.players.find(player=>player.id===id);return `<div class="gift-victory-player">${storyAvatar(item)}<b>${esc(item?.name||'玩家')}</b><span aria-hidden="true">✦</span></div>`;}).join('')}</div>`;
}
function resultPanel(s){
 if(!s.result)return '';
 if(!s.players.some(item=>item.id===activeResultRecipient))activeResultRecipient=s.me;
 const gifts=new Map(s.gifts.map(gift=>[gift.id,gift]));
 const entries=s.result.entries.map((entry,index)=>({entry,index}));
 const scores=s.players.map(item=>`<div class="result-score"><b>${esc(item.name)}${item.id===s.me?' · 你':''}</b><span>🎁 送禮 <strong>${item.giveScore}</strong><meter min="0" max="${s.target}" value="${item.giveScore}" aria-label="${esc(item.name)}送禮分數"></meter></span><span>♡ 收禮 <strong>${item.getScore}</strong><meter min="0" max="${s.target}" value="${item.getScore}" aria-label="${esc(item.name)}收禮分數"></meter></span></div>`).join('');
 const groups=s.players.map(recipient=>{
  const received=entries.filter(({entry})=>entry.recipientId===recipient.id);
  return `<section class="reveal-group" data-result-recipient="${esc(recipient.id)}" ${recipient.id===activeResultRecipient?'':'hidden'} aria-label="${esc(recipient.name)}收到的禮物"><h3><span>${esc(recipient.name)} 收到</span><span class="small">${received.length} 件禮物</span></h3>${received.map(({entry,index})=>{
   const gift=gifts.get(entry.giftId);
   return `<div class="reveal-entry" data-reveal-entry="${index}"><span class="reveal-gift">${gift?.image?`<img src="${esc(gift.image)}" alt="" loading="lazy">`:''}<span><b>${esc(player(entry.giverId)?.name||'玩家')}</b> 送了「${esc(gift?.title||'禮物')}」<small> · ${esc(rankLabels[entry.rank]||entry.rank)}</small></span></span><b class="${entry.points>=0?'positive':'negative'}">${entry.points>0?'+':''}${entry.points}</b></div>`;
  }).join('')}</section>`;
 }).join('');
 return `<section class="card result-card" aria-label="第 ${s.result.round} 輪完整結果"><h2>送禮與收禮總分</h2><div class="result-totals" aria-label="送禮與收禮總分">${scores}</div><p id="giftAchievementNotice" class="achievement-notice" role="status" hidden></p><section class="result-details" aria-label="收到的完整禮物"><h3>收到的禮物</h3><div class="recipient-tabs result-tabs" role="group" aria-label="查看朋友收到的禮物">${s.players.map(item=>`<button type="button" data-result-tab="${esc(item.id)}" aria-pressed="${item.id===activeResultRecipient}">${esc(item.name)}</button>`).join('')}</div><div class="reveal-groups">${groups}</div></section></section>`;
}
async function checkNewAchievement(){
 try{
  const response=await fetch('/api/achievements');if(!response.ok)return;
  const data=await response.json(),unlocked=new Set(data.achievements.filter(item=>item.unlockedAt).map(item=>item.id));
  const names=knownAchievements?[['gift-first-gift','第一份心意'],['all-first-table','第一桌']].filter(([id])=>!knownAchievements.has(id)&&unlocked.has(id)).map(([,name])=>name):[];
  if(names.length){
   const notice=$('#giftAchievementNotice');
   if(notice){notice.textContent='解鎖成就：'+names.join('、')+'。';const link=document.createElement('a');link.href='/achievements';link.textContent='查看收藏冊 ↗';notice.append(link);notice.hidden=false;}
  }
  knownAchievements=unlocked;
 }catch{}
}
function allowsMotion(){return MotionPolicy.allowsMotion();}
function updateMotionButton(){const button=$('#motionToggle');if(button)button.hidden=true;document.body.classList.toggle('gift-motion-off',!allowsMotion());}
function playSound(kind){window.AudioSettings.playEffect(kind);}
function stopSound(){window.AudioSettings.stopEffects();}
function stopFocus(){clearTimeout(focusTimer);focusTimer=null;const panel=$('#giftSpotlight'),hadFocus=panel?.contains(document.activeElement);if(panel)panel.hidden=true;panel?.closest('.gift-story')?.classList.remove('is-playing');if(hadFocus)$('#stage [data-do="replay-focus"]')?.focus();}
function focusIndices(entries){return [...new Set([0,Math.floor((entries.length-1)/2),entries.length-1])].filter(index=>index>=0&&index<entries.length);}
function celebrateVictory(){if(allowsMotion()&&!document.hidden)$('#giftVictory')?.classList.add('celebrate');}
function startFocus(){
 if(!allowsMotion()||!state?.result||document.hidden)return;
 const entries=state.result.entries,indexes=focusIndices(entries),panel=$('#giftSpotlight'),content=$('#giftFocusContent');
 if(!indexes.length||!panel||!content)return;
 stopFocus();$('#giftVictory')?.classList.remove('celebrate');panel.hidden=false;panel.closest('.gift-story')?.classList.add('is-playing');
 let step=0;
 const show=()=>{
  if(step>=indexes.length){stopFocus();celebrateVictory();return;}
  const entry=entries[indexes[step]],gift=state.gifts.find(item=>item.id===entry.giftId),giver=player(entry.giverId),recipient=player(entry.recipientId);
  content.innerHTML=`<span class="eyebrow">FOCUS ${step+1} / ${indexes.length}</span><div class="gift-story-line"><div class="story-person story-giver">${storyAvatar(giver)}<small>送禮</small><b>${esc(giver?.name||'玩家')}</b></div><div class="story-flight"><div class="story-gift-card">${gift?.image?`<img src="${esc(gift.image)}" alt=""><span class="story-gift-fallback" aria-hidden="true" hidden>✦</span>`:'<span class="story-gift-fallback" aria-hidden="true">✦</span>'}<strong>${esc(gift?.title||'禮物')}</strong></div></div><div class="story-person story-recipient">${storyAvatar(recipient)}<small>收禮</small><b>${esc(recipient?.name||'玩家')}</b></div></div><div class="story-verdict"><span>${esc(storyRankLabels[entry.rank]||'沒標記')}</span><b class="${entry.points>=0?'positive':'negative'}">本件評分 ${entry.points>0?'+':''}${entry.points}</b></div>`;
  content.classList.remove('focus-enter');void content.offsetWidth;content.classList.add('focus-enter');
  step++;focusTimer=setTimeout(show,1400);
 };
 show();
}

function entry(){
 $('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">✦ 🎁 ✦</div><span class="eyebrow">THE GIFT CLUB</span><h1>你真的知道，<br>朋友想要什麼嗎？</h1><p class="sub">挑一件禮物給每位朋友，再猜猜大家的心願。送得好，也要收得開心。</p><form id="enterForm"><p id="entryIdentity" class="entry-identity">將以你的角色名稱入座</p>${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button wide">加入這一桌 →</button>`:'<button class="button wide">開一桌送禮達人 →</button>'}</form></div>`;
}
function receive(next){
 if(!next||next.type!=='gift')throw Error('這不是送禮達人房間');
 if(state&&(next.version<state.version||RoomHost.isStaleSnapshot?.(next,state)))return false;
 const previous=state,live=motionGate.update(next,{connected:!disconnected});
 const newDelivery=next.phase==='delivering'&&(previous?.phase!=='delivering'||previous.round!==next.round||previous.delivery?.recipientId!==next.delivery.recipientId);
 const arrival=newDelivery&&motionGate.take('delivery:'+next.version+':'+next.delivery.recipientId,live);
 const shouldFocus=previous?.phase==='delivering'&&['reveal','finished'].includes(next.phase)&&next.result?.round===next.round&&previous.round===next.round&&motionGate.take('score:'+next.version,live);
 if(state?.round!==next.round){draftGifts={};draftLikes=[];activeGiftRecipient=null;activeResultRecipient=null;}
 state=next;document.body.dataset.giftPhase=next.phase;document.body.classList.toggle('gift-many-players',next.players.length>4);RoomHost.update(next,receive);
 $('#roomTag').textContent='房間 '+code;$('#invite').hidden=false;
 $('#roundTag').textContent=next.phase==='waiting'?'朋友到齊就開始':`第 ${next.round} 輪 · 目標 ${next.target} 分`;
 $('#phaseTag').textContent={waiting:'等待入座',choosing:'選禮與標喜好',delivering:'一起送禮',reveal:'禮物揭曉',finished:'送禮達人誕生'}[next.phase];
 $('#count').textContent=next.players.length+' / 8';
 $('#steps').querySelectorAll('span').forEach((element,index)=>element.classList.toggle('active',next.phase==='choosing'?index<2:index===({delivering:2,reveal:2,finished:2}[next.phase]??0)));
 GameShell.stableMarkup($('#players'),next.players.map(playerRow).join(''));
 const nextSignature=JSON.stringify([next.phase,next.round,next.host,next.me,next.target,next.customPercent,next.includeAdult,next.gifts,next.players.map(item=>item.id),next.ownAssignments,next.ownRanking,next.delivery,next.result,next.winner]);
 if(nextSignature!==signature){signature=nextSignature;render({arrival,score:shouldFocus});if(shouldFocus){celebrateVictory();playSound('reveal');checkNewAchievement();}}
 progress();return live;
}
function render({arrival=false,score=false}={}){
 const s=state;let html='';
 for(const animation of stageAnimations)animation.cancel();stageAnimations=[];stopFocus();
 if(s.phase==='waiting'){
  html=`<div class="card hero"><div class="hero-mark">🎁</div><span class="eyebrow">MAKE A WISH</span><h1>禮物擺好，<br>朋友來了就開桌。</h1><p class="sub">3–8 人一起玩。每輪可以自由安排先送禮或先標喜好，大家兩項都完成後一起揭曉。</p><div class="banner">房間代碼 <b>${esc(s.code)}</b>　<button class="quiet" data-do="invite">複製邀請連結 ↗</button></div>${s.host?`<section class="room-settings-panel" aria-label="房間設定"><h2>房間設定</h2><div class="room-settings"><div><label for="target">兩條分數的目標（8–30）</label><input id="target" type="number" min="8" max="30" value="${s.target}"></div><div><label for="customPercent">玩家投稿禮物比例</label><select id="customPercent">${customPercentSelect(s.customPercent)}</select></div></div><label class="adult-gift-option"><input id="includeAdult" type="checkbox" ${s.includeAdult?'checked':''}><span>加入成人派對禮物</span></label><p class="small">曖昧惡搞、約會與夜生活；開啟後內建及投稿成人分類都可能抽到。</p><details class="setting-details"><summary>投稿比例說明</summary><p class="small">比例依每輪禮物數取近似值；投稿不足或尚未輪到重複抽取時，會用內建禮物補足。選 0% 則只抽內建。</p></details>${GameShell.settingsActions()}</section>`:`<p>等房主開始，先看看這桌的禮物吧。投稿禮物設定：${customPercentLabel(s.customPercent)}。成人派對${s.includeAdult?'開啟':'關閉'}。</p>`}</div>`;
 }else if(s.phase==='choosing'){
  const recipients=s.players.filter(item=>item.id!==s.me);
  if(!recipients.some(item=>item.id===activeGiftRecipient))activeGiftRecipient=recipients[0]?.id;
  const assignments=s.ownAssignments?recipients.map(item=>`<li>${esc(item.name)}：${esc(s.gifts.find(gift=>gift.id===s.ownAssignments[item.id])?.title||'禮物')}</li>`).join(''):'';
  const ranking=s.ownRanking?rankKeys.map(key=>`<li>${esc(rankLabels[key])}：${esc(s.gifts.find(gift=>gift.id===s.ownRanking[key])?.title||'禮物')}</li>`).join(''):'';
  html=`<section class="choice-summaries" aria-label="本輪送禮分配與四個心願順位"><div><h3>心願順位${s.ownRanking?' · 已鎖定 ✓':''}</h3><dl id="wishSummary" class="wish-summary"></dl></div></section>`+'<div class="choice-panel-tabs" role="group" aria-label="選擇本輪任務"><button type="button" data-choice-panel="give" aria-pressed="'+(activeChoicePanel==='give')+'">送禮給朋友</button><button type="button" data-choice-panel="wish" aria-pressed="'+(activeChoicePanel==='wish')+'">我的心願</button></div>'+
   `<section class="card choice-section" data-choice-section="give" aria-labelledby="giveHeading"><span class="eyebrow">01 / GIVE</span><h2 id="giveHeading">送給誰？直接點禮物</h2><p class="sub">每位朋友選一件；再點已選禮物可取消。</p>${s.ownAssignments?`<div class="locked"><strong>送禮已鎖定 ✓</strong><ul>${assignments}</ul></div>`:`<form id="giveForm"><div class="recipient-tabs" role="group" aria-label="選擇收禮朋友">${recipients.map(item=>`<button type="button" data-recipient-tab="${esc(item.id)}" aria-pressed="${item.id===activeGiftRecipient}">${esc(item.name)}</button>`).join('')}</div><div class="assignment-list">${recipients.map(item=>`<div class="assignment-row" data-assignment-row="${esc(item.id)}" ${item.id===activeGiftRecipient?'':'hidden'}><div class="assignment-person"><img src="${esc(item.avatar||'')}" alt=""><strong>送給 ${esc(item.name)}</strong></div><div class="choice-grid" role="group" aria-label="送給 ${esc(item.name)} 的禮物">${s.gifts.map((gift,index)=>giveChoice(gift,index,item)).join('')}</div></div>`).join('')}</div><p id="giveStatus" class="choice-status" role="status"></p></form>`}</section>`+
   `<section class="card choice-section" data-choice-section="wish" aria-labelledby="wishHeading"><span class="eyebrow">02 / WISH</span><h2 id="wishHeading">你的心願排序</h2><p class="sub">依順序選四件，點已選禮物可取消。沒選到的禮物 −1 分。</p>${s.ownRanking?`<div class="locked"><strong>喜好已鎖定 ✓</strong><ol>${ranking}</ol></div>`:`<form id="wishForm"><p id="likeNext" class="choice-status" role="status"></p><div class="choice-grid like-grid" role="group" aria-label="依喜好順序點選禮物">${s.gifts.map(likeChoice).join('')}</div></form>`}</section>`;
  }else if(s.phase==='delivering'){
  const recipient=s.players.find(item=>item.id===s.delivery.recipientId);
  html=`<section class="card delivery-stage"><span class="eyebrow">RECEIVE ${s.delivery.index+1} / ${s.delivery.total}</span><h1>大家一起送禮物給 ${esc(recipient?.name||'朋友')}</h1><div class="delivery-recipient">${storyAvatar(recipient)}<b>${esc(recipient?.name||'朋友')}</b></div><div class="delivery-gifts">${s.delivery.entries.map(entry=>{const gift=s.gifts.find(item=>item.id===entry.giftId);return `<div class="delivery-gift"><div class="delivery-giver">${storyAvatar(player(entry.giverId))}<b title="${esc(player(entry.giverId)?.name||'朋友')}">${esc(player(entry.giverId)?.name||'朋友')}</b></div><span aria-hidden="true">↓ 🎁</span>${gift?.image?`<img src="${esc(gift.image)}" alt="">`:'<span class="delivery-placeholder">✦</span>'}<strong>${esc(gift?.title||'禮物')}</strong><small>${esc(storyRankLabels[entry.rank])}</small></div>`;}).join('')}</div></section>`;
 }else if(s.phase==='reveal'||s.phase==='finished'){
  const finished=s.phase==='finished',hasWinner=!!s.winner?.ids?.length;
  html=`<div class="card result-heading"><div><span class="eyebrow">${finished?'THE GIFTED':'ROUND COMPLETE'}</span><h1>${finished?(hasWinner?'今晚的送禮達人':'本局結束'):'大家都收到禮物了！'}</h1>${finished?`<p class="winner-names">${s.winner?.ids?.map(id=>esc(player(id)?.name||'玩家')).join('、')||esc(s.winner?.reason||'')}</p>`:''}</div>${s.host?(finished?'':''):(finished?'':'<p>等房主開始下一輪。</p>')}</div>${resultPanel(s)}`;
 }
 $('#stage').innerHTML=html;window.GameUI?.decorateButton($('#stage .room-settings-save'),'save');bindGamePopovers($('#stage'));$('#stage').classList.toggle('many-gifts',s.gifts.length>6);renderAction();showChoicePanel(activeChoicePanel);syncChoices();progress();
 if(arrival)for(const card of document.querySelectorAll('.delivery-gift')){const animation=MotionPolicy.animate(card,[{transform:'translateY(-24px) scale(.97)',opacity:.25},{transform:'translateY(0) scale(1)',opacity:1}],{duration:700,easing:'ease-out'});if(animation)stageAnimations.push(animation);}
 if(score){const animation=MotionPolicy.animate($('.result-totals'),[{transform:'translateY(8px)',opacity:.6},{transform:'translateY(0)',opacity:1}],{duration:240,easing:'ease-out'});if(animation)stageAnimations.push(animation);}
}

document.addEventListener('click',event=>{
 if(!event.target.closest('#stage,[data-game-action-slot]'))return;
 if(event.target.closest('[data-choice-panel]')){showChoicePanel(event.target.closest('[data-choice-panel]').dataset.choicePanel);return;}
 const button=event.target.closest('button');if(!button||button.disabled||busy)return;
 if(button.dataset.recipientTab){activeGiftRecipient=button.dataset.recipientTab;for(const row of document.querySelectorAll('[data-assignment-row]'))row.hidden=row.dataset.assignmentRow!==activeGiftRecipient;for(const tab of document.querySelectorAll('[data-recipient-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.recipientTab===activeGiftRecipient));return;}
 if(button.dataset.resultTab){activeResultRecipient=button.dataset.resultTab;for(const group of document.querySelectorAll('[data-result-recipient]'))group.hidden=group.dataset.resultRecipient!==activeResultRecipient;for(const tab of document.querySelectorAll('[data-result-tab]'))tab.setAttribute('aria-pressed',String(tab.dataset.resultTab===activeResultRecipient));return;}
 if(button.dataset.giveRecipient){
  const recipient=button.dataset.giveRecipient,giftId=button.dataset.giftId;
  if(draftGifts[recipient]===giftId)delete draftGifts[recipient];
  else{for(const [other,chosen] of Object.entries(draftGifts))if(chosen===giftId)delete draftGifts[other];draftGifts[recipient]=giftId;}
  syncChoices();return;
 }
 if(button.dataset.likeGift){
  const giftId=button.dataset.likeGift,index=draftLikes.indexOf(giftId);
  if(index!==-1)draftLikes.splice(index,1);
  else if(draftLikes.length<4)draftLikes.push(giftId);
  else return toast('已選四件；先點一件已選禮物取消，再挑新的。');
  syncChoices();return;
 }
 switch(button.dataset.do){case'invite':invite();break;case'settings':roomAction('settings',{target:Number($('#target').value),customPercent:$('#customPercent').value===''?null:Number($('#customPercent').value),includeAdult:$('#includeAdult').checked});break;case'start':roomAction('start');break;case'next':action('next');break;case'accept':action('accept',{recipientId:state.delivery.recipientId});break;case'replay-focus':startFocus();break;case'skip-focus':stopFocus();break;}
});
$('#stage').addEventListener('error',event=>{if(event.target.matches('.choice-art img,.story-gift-card img,.story-person img,.gift-victory-player img')){event.target.hidden=true;event.target.nextElementSibling.hidden=false;}},true);
$('#stage').addEventListener('submit',async event=>{
 event.preventDefault();
 if(event.target.id==='giveForm'){const assignments={...draftGifts};if(Object.keys(assignments).length!==state.players.length-1)return toast('請先為每位朋友選一件禮物');return action('give',{assignments});}
 if(event.target.id==='wishForm'){if(draftLikes.length!==4)return toast('請依序選好四件不同的禮物');const ranking=Object.fromEntries(rankKeys.map((key,index)=>[key,draftLikes[index]]));return action('wish',{ranking});}
 if(event.target.id==='enterForm'){
  if(busy)return;busy=true;
  try{const result=await api(code?'join':'create',{type:'gift',code});if(result.type!=='gift')throw Error('這是其他遊戲房間，請從大廳加入');save(result);receive(await api('state'));$('#connection').textContent='';}catch(error){toast(error.message);}finally{busy=false;syncActionBusy();}
 }
});
async function action(name,data={}){if(busy)return;busy=true;actionFeedback('送出中…');syncActionBusy();try{const result=await api('action',{action:name,...data});const live=receive(result);if(live&&['give','wish'].includes(name)&&!['reveal','finished'].includes(result.phase))playSound('confirm');actionFeedback(name==='give'?'送禮已鎖定 ✓':name==='wish'?'心願已鎖定 ✓':name==='accept'?'已確認收禮':'已完成','success');if(live)MotionPolicy.confirm($('#gameActionFeedback'));$('#connection').textContent='';}catch(error){actionFeedback(error.message,'error');}finally{busy=false;syncActionBusy();syncChoices();}}
async function roomAction(route,data={}){if(busy)return;const settings=route==='settings',restoreFocus=settings&&document.activeElement?.closest?.('.room-settings-save');busy=true;actionFeedback('送出中…','info',settings);syncActionBusy();try{receive(await api(route,data));actionFeedback(settings?'房間設定已儲存。':'已完成','success',settings);}catch(error){actionFeedback(error.message,'error',settings);}finally{busy=false;syncActionBusy();syncChoices();if(restoreFocus)$('#stage .room-settings-save')?.focus({preventScroll:true});}}
async function invite(){const url=inviteBase+'/gift/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製給朋友',url);}}
window.GameUI?.decorateButton($('#closeHelp'),'close',{iconOnly:true,label:'關閉遊戲規則'});
$('#invite').onclick=invite;$('#help').onclick=()=>window.GameUI?GameUI.openDialog($('#rules'),$('#help')):$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();
MotionPolicy.subscribe(()=>{updateMotionButton();if(!allowsMotion()){stopFocus();$('#giftVictory')?.classList.remove('celebrate');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFocus();stopSound();}});
async function poll(){if(!session||busy||polling)return;polling=true;try{receive(await api('state'));$('#connection').textContent='';if(disconnected){toast('已重新連線，恢復原座位');disconnected=false;}}catch(error){disconnected=true;$('#connection').textContent='連線暫停：'+error.message+'。正在重試…';}finally{polling=false;}}
fetch('/api/info').then(response=>response.json()).then(info=>inviteBase=info.preferred||info.addresses.find(address=>address.includes('://26.'))||location.origin).catch(()=>{});
entry();if(session)poll();else if(code)RoomReconnect.restore(code,'gift','#connection').then(restored=>{if(restored){save(restored);poll();}});
updateMotionButton();
checkNewAchievement();
setInterval(poll,1000);if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();
fetch('/api/auth/me').then(response=>response.json()).then(me=>{const identity=$('#entryIdentity');if(identity&&me.displayName)identity.textContent=`以「${me.displayName}」入座`;}).catch(()=>{});
