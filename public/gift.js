'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rankLabels={great:'最想要 · +3',good:'想要 · +2',ok:'還可以 · +1',noWay:'最不想要 · −4',unranked:'沒標記 · −1'};
const rankKeys=['great','good','ok','noWay'];
const categoryGlyphs={日常:'☕',體驗:'✧',奇想:'✦',冒險:'◆'};
const customPercentOptions=[['','依題庫比例'],['0','0% · 只抽內建'],['25','25% · 偶爾投稿'],['50','50% · 均衡'],['75','75% · 投稿優先'],['100','100% · 盡量投稿']];
const customPercentLabel=value=>value===null?'依題庫比例':value+'%';
const customPercentSelect=value=>customPercentOptions.map(([number,label])=>`<option value="${number}" ${(value===null?'':String(value))===number?'selected':''}>${label}</option>`).join('');
let code=(location.pathname.match(/\/gift\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'';
let session=null,state=null,busy=false,polling=false,disconnected=false,signature='',inviteBase=location.origin;
let draftGifts={},draftLikes=[];
let focusTimer=null,motionEnabled=true,soundEnabled=false,soundVolume=0.25,knownAchievements=null;
const soundFiles={confirm:'/assets/gift-sounds/confirmation_001.wav',reveal:'/assets/gift-sounds/open_001.wav'};
const playingSounds=new Set();
try{session=JSON.parse(localStorage.getItem(code?'ah-gift:'+code:'ah-gift')||'null');if(session&&!code)code=session.code;}catch{}
try{motionEnabled=localStorage.getItem('ah-gift-motion')!=='off';}catch{}
try{const storedVolume=localStorage.getItem('ah-gift-volume'),savedVolume=Number(storedVolume);if(storedVolume!==null&&Number.isFinite(savedVolume)&&savedVolume>=0&&savedVolume<=1)soundVolume=savedVolume;}catch{}

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
 for(const button of document.querySelectorAll('[data-give-recipient]')){
  const selected=draftGifts[button.dataset.giveRecipient]===button.dataset.giftId;
  button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  button.querySelector('.choice-badge').textContent=selected?'已選給這位朋友':'';
 }
 const needed=state.players.length-1,giveCount=Object.keys(draftGifts).length,giveSubmit=$('#giveSubmit');
 if(giveSubmit)giveSubmit.disabled=giveCount!==needed;
 const giveStatus=$('#giveStatus');if(giveStatus)giveStatus.textContent=`已選 ${giveCount} / ${needed} 位朋友`;
 for(const button of document.querySelectorAll('[data-like-gift]')){
  const index=draftLikes.indexOf(button.dataset.likeGift),selected=index!==-1;
  button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
  button.querySelector('.choice-badge').textContent=selected?`${index+1}. ${rankLabels[rankKeys[index]]}`:'';
  const gift=state.gifts.find(item=>item.id===button.dataset.likeGift);
  button.setAttribute('aria-label',`${gift?.title||'禮物'}${selected?`，目前第 ${index+1} 順位，點擊取消`:'，點擊加入下一個順位'}`);
 }
 const wishSubmit=$('#wishSubmit');if(wishSubmit)wishSubmit.disabled=draftLikes.length!==4;
 const next=$('#likeNext');if(next)next.textContent=draftLikes.length<4?`下一個：${rankLabels[rankKeys[draftLikes.length]]}（${draftLikes.length+1} / 4）`:'四件已選好；再點已選禮物可取消並重新排序。';
 const order=$('#likeOrder');if(order)order.innerHTML=rankKeys.map((key,index)=>`<span class="like-slot ${draftLikes[index]?'filled':''}"><b>${index+1}. ${esc(rankLabels[key])}</b><small>${esc(state.gifts.find(gift=>gift.id===draftLikes[index])?.title||'尚未選擇')}</small></span>`).join('');
}
function playerRow(item){return GameShell.playerRow(item,{me:state.me,status:(item.id===state.hostId?'房主 · ':'')+(item.online?'在線':'暫時離線'),metrics:[{value:item.giveScore,label:'送禮分數'},{value:item.getScore,label:'收禮分數'}]});}
function progress(){const label=$('#progress');if(label&&state?.phase==='choosing')label.textContent=`全桌進度：送禮 ${state.gaveIds.length} / ${state.players.length} 人 · 喜好 ${state.wishedIds.length} / ${state.players.length} 人已鎖定。兩項都完成才會揭曉。`;}
function resultPanel(s){
 if(!s.result)return '';
 const gifts=new Map(s.gifts.map(gift=>[gift.id,gift]));
 const entries=s.result.entries.map((entry,index)=>({entry,index}));
 const scores=s.players.map(item=>`<div class="result-score"><b>${esc(item.name)}${item.id===s.me?' · 你':''}</b><span>🎁 送禮 <strong>${item.giveScore}</strong></span><span>♡ 收禮 <strong>${item.getScore}</strong></span></div>`).join('');
 const groups=s.players.map(recipient=>{
  const received=entries.filter(({entry})=>entry.recipientId===recipient.id);
  return `<section class="reveal-group" aria-label="${esc(recipient.name)}收到的禮物"><h3><span>${esc(recipient.name)} 收到</span><span class="small">${received.length} 件禮物</span></h3>${received.map(({entry,index})=>{
   const gift=gifts.get(entry.giftId);
   return `<div class="reveal-entry" data-reveal-entry="${index}"><span class="reveal-gift">${gift?.image?`<img src="${esc(gift.image)}" alt="" loading="lazy">`:''}<span><b>${esc(player(entry.giverId)?.name||'玩家')}</b> 送了「${esc(gift?.title||'禮物')}」<small> · ${esc(rankLabels[entry.rank]||entry.rank)}</small></span></span><b class="${entry.points>=0?'positive':'negative'}">${entry.points>0?'+':''}${entry.points}</b></div>`;
  }).join('')}</section>`;
 }).join('');
 return `<section class="card result-card" aria-label="第 ${s.result.round} 輪完整結果"><span class="eyebrow">ROUND ${s.result.round} / FULL RESULT</span><h2>這輪的完整結果</h2><p class="sub">所有禮物和分數已公開，可以直接往下閱讀。</p><button type="button" class="quiet spotlight-control" data-do="replay-focus" ${allowsMotion()?'':'hidden'}>重播 3 件焦點禮物 ↻</button><div id="giftSpotlight" class="gift-spotlight" hidden><div id="giftFocusContent" aria-hidden="true"></div><button type="button" class="quiet" data-do="skip-focus">跳過演出</button></div><div class="result-totals" aria-label="送禮與收禮總分">${scores}</div><p id="giftAchievementNotice" class="achievement-notice" role="status" hidden></p><div class="reveal-groups">${groups}</div></section>`;
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
function allowsMotion(){return motionEnabled&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
function updateMotionButton(){const button=$('#motionToggle');button.textContent=allowsMotion()?'關閉演出':motionEnabled?'系統已減少動態':'開啟演出';button.setAttribute('aria-pressed',String(allowsMotion()));}
function playSound(kind){
 if(!soundEnabled||!soundVolume||document.hidden||!soundFiles[kind])return;
 try{const clip=new Audio(soundFiles[kind]);clip.volume=soundVolume;playingSounds.add(clip);clip.onended=()=>playingSounds.delete(clip);clip.onerror=()=>playingSounds.delete(clip);clip.play().catch(()=>playingSounds.delete(clip));}catch{}
}
function stopSound(){for(const clip of playingSounds)clip.pause();playingSounds.clear();}
function updateSoundButton(){const button=$('#soundToggle');button.textContent=soundEnabled?'關閉音效':'開啟音效';button.setAttribute('aria-pressed',String(soundEnabled));$('#soundControl').hidden=!soundEnabled;$('#soundVolume').value=String(Math.round(soundVolume*100));}
function stopFocus(){clearTimeout(focusTimer);focusTimer=null;const panel=$('#giftSpotlight'),hadFocus=panel?.contains(document.activeElement);if(panel)panel.hidden=true;if(hadFocus)$('#stage [data-do="replay-focus"]')?.focus();}
function focusIndices(entries){return [...new Set([0,Math.floor((entries.length-1)/2),entries.length-1])].filter(index=>index>=0&&index<entries.length);}
function startFocus(){
 if(!allowsMotion()||!state?.result||document.hidden)return;
 const entries=state.result.entries,indexes=focusIndices(entries),panel=$('#giftSpotlight'),content=$('#giftFocusContent');
 if(!indexes.length||!panel||!content)return;
 stopFocus();panel.hidden=false;
 let step=0;
 const show=()=>{
  if(step>=indexes.length){stopFocus();return;}
  const entry=entries[indexes[step]],gift=state.gifts.find(item=>item.id===entry.giftId);
  content.innerHTML=`<span class="eyebrow">FOCUS ${step+1} / ${indexes.length}</span><div class="focus-gift">${gift?.image?`<img src="${esc(gift.image)}" alt="">`:'<span aria-hidden="true">✦</span>'}<div><strong>${esc(gift?.title||'禮物')}</strong><p>${esc(player(entry.giverId)?.name||'玩家')} 送給 ${esc(player(entry.recipientId)?.name||'玩家')}</p><b>${esc(rankLabels[entry.rank]||entry.rank)}　${entry.points>0?'+':''}${entry.points}</b></div></div>`;
  content.classList.remove('focus-enter');void content.offsetWidth;content.classList.add('focus-enter');
  step++;focusTimer=setTimeout(show,850);
 };
 show();
}

function entry(){
 $('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">✦ 🎁 ✦</div><span class="eyebrow">THE GIFT CLUB</span><h1>你真的知道，<br>朋友想要什麼嗎？</h1><p class="sub">挑一件禮物給每位朋友，再猜猜大家的心願。送得好，也要收得開心。</p><form id="enterForm"><p id="entryIdentity" class="entry-identity">將以你的角色名稱入座</p>${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button wide">加入這一桌 →</button>`:'<button class="button wide">開一桌送禮達人 →</button>'}</form></div>`;
}
function receive(next){
 if(!next||next.type!=='gift')throw Error('這不是送禮達人房間');
 const shouldFocus=state?.phase==='choosing'&&['reveal','finished'].includes(next.phase)&&next.result?.round===next.round&&state.round===next.round&&!disconnected&&!document.hidden;
 if(state?.round!==next.round){draftGifts={};draftLikes=[];}
 state=next;RoomHost.update(next,receive);
 $('#roomTag').textContent='房間 '+code;$('#invite').hidden=false;
 $('#roundTag').textContent=next.phase==='waiting'?'朋友到齊就開始':`第 ${next.round} 輪 · 目標 ${next.target} 分`;
 $('#phaseTag').textContent={waiting:'等待入座',choosing:'選禮與標喜好',reveal:'禮物揭曉',finished:'送禮達人誕生'}[next.phase];
 $('#count').textContent=next.players.length+' / 8';
 $('#steps').querySelectorAll('span').forEach((element,index)=>element.classList.toggle('active',next.phase==='choosing'?index<2:index===({reveal:2,finished:2}[next.phase]??0)));
 GameShell.stableMarkup($('#players'),next.players.map(playerRow).join(''));
 const nextSignature=JSON.stringify([next.phase,next.round,next.target,next.customPercent,next.gifts,next.players.map(item=>item.id),next.ownAssignments,next.ownRanking,next.result,next.winner]);
 if(nextSignature!==signature){signature=nextSignature;render();if(shouldFocus){startFocus();playSound('reveal');checkNewAchievement();}}
 progress();
}
function render(){
 const s=state;let html='';
 stopFocus();
 if(s.phase==='waiting'){
  html=`<div class="card hero"><div class="hero-mark">🎁</div><span class="eyebrow">MAKE A WISH</span><h1>禮物擺好，<br>朋友來了就開桌。</h1><p class="sub">3–8 人一起玩。每輪可以自由安排先送禮或先標喜好，大家兩項都完成後一起揭曉。</p><div class="banner">房間代碼 <b>${esc(s.code)}</b>　<button class="quiet" data-do="invite">複製邀請連結 ↗</button></div>${s.host?`<div class="room-settings"><div><label for="target">兩條分數的目標（8–30）</label><input id="target" type="number" min="8" max="30" value="${s.target}"></div><div><label for="customPercent">玩家投稿禮物比例</label><select id="customPercent">${customPercentSelect(s.customPercent)}</select></div><button class="button outline" data-do="settings">儲存房間設定</button></div><p class="small">比例依每輪禮物數取近似值；投稿不足或尚未輪到重複抽取時，會用內建禮物補足。選 0% 則只抽內建。</p><button class="button wide" data-do="start" ${s.players.length<3?'disabled':''}>${s.players.length<3?'還差 '+(3-s.players.length)+' 位朋友':'開始挑禮物 →'}</button>`:`<p>等房主開始，先看看這桌的禮物吧。投稿禮物設定：${customPercentLabel(s.customPercent)}。</p>`}</div>`;
 }else if(s.phase==='choosing'){
  const recipients=s.players.filter(item=>item.id!==s.me);
  const assignments=s.ownAssignments?recipients.map(item=>`<li>${esc(item.name)}：${esc(s.gifts.find(gift=>gift.id===s.ownAssignments[item.id])?.title||'禮物')}</li>`).join(''):'';
  const ranking=s.ownRanking?rankKeys.map(key=>`<li>${esc(rankLabels[key])}：${esc(s.gifts.find(gift=>gift.id===s.ownRanking[key])?.title||'禮物')}</li>`).join(''):'';
  html=`<div class="card choosing-intro"><span class="eyebrow">CHOOSE TOGETHER</span><h1>送禮與心願，同時開始。</h1><p class="sub">先做哪一項都可以；兩項各自鎖定，所有人完成後才公開答案。三人局有四件禮物，更多人會有「玩家數＋1」件。本房投稿禮物設定：${customPercentLabel(s.customPercent)}。</p></div>`+
   `<section class="card choice-section" aria-labelledby="giveHeading"><span class="eyebrow">01 / GIVE</span><h2 id="giveHeading">送給誰？直接點禮物</h2><p class="sub">每位朋友選一件，同一件不能送兩人；再點已選禮物可取消。</p>${s.ownAssignments?`<div class="locked"><strong>送禮已鎖定 ✓</strong><ul>${assignments}</ul></div>`:`<form id="giveForm"><div class="assignment-list">${recipients.map(item=>`<div class="assignment-row"><div class="assignment-person"><img src="${esc(item.avatar||'')}" alt=""><strong>送給 ${esc(item.name)}</strong></div><div class="choice-grid" role="group" aria-label="送給 ${esc(item.name)} 的禮物">${s.gifts.map((gift,index)=>giveChoice(gift,index,item)).join('')}</div></div>`).join('')}</div><p id="giveStatus" class="choice-status" role="status"></p><button id="giveSubmit" class="button wide" disabled>鎖定送禮選擇 →</button></form>`}</section>`+
   `<section class="card choice-section" aria-labelledby="wishHeading"><span class="eyebrow">02 / WISH</span><h2 id="wishHeading">你的心願排序</h2><p class="sub">依順序點四件：最想要、想要、還可以、最不想要。再點已選禮物會取消，後面的順位自動往前補；沒選中的禮物是 −1 分。</p>${s.ownRanking?`<div class="locked"><strong>喜好已鎖定 ✓</strong><ol>${ranking}</ol></div>`:`<form id="wishForm"><p id="likeNext" class="choice-status" role="status"></p><div class="choice-grid like-grid" role="group" aria-label="依喜好順序點選禮物">${s.gifts.map(likeChoice).join('')}</div><div id="likeOrder" class="like-order" aria-label="目前喜好順序"></div><button id="wishSubmit" class="button wide" disabled>鎖定喜好順序 →</button></form>`}</section><p id="progress" class="progress"></p>`;
 }else if(s.phase==='reveal'){
  html=`<div class="card reveal-intro"><span class="eyebrow">STEP 03 / REVEAL</span><h1>拆禮物囉！</h1><p class="sub">每件禮物同時影響送禮者與收禮者；這輪的所有結果都已公開。</p>${s.host?'<button class="button" data-do="next">下一輪，換一批禮物 →</button>':'<p>等房主開始下一輪。</p>'}</div>${resultPanel(s)}`;
 }else if(s.phase==='finished'){
  const hasWinner=!!s.winner?.ids?.length;
  html=`<div class="card hero"><div class="hero-mark">✦</div><span class="eyebrow">THE GIFTED</span><h1>${hasWinner?'今晚的送禮達人':'本局結束'}</h1><p class="winner-names">${s.winner?.ids?.map(id=>esc(player(id)?.name||'玩家')).join('、')||esc(s.winner?.reason||'')}</p>${hasWinner?`<p class="sub">${s.round} 輪後，送禮與收禮都達到 ${s.target} 分。</p>`:''}<div class="standings">${[...s.players].sort((a,b)=>Math.min(b.giveScore,b.getScore)-Math.min(a.giveScore,a.getScore)).map(item=>`<div class="standing"><b>${esc(item.name)}</b><span>🎁 ${item.giveScore}</span><span>♡ ${item.getScore}</span></div>`).join('')}</div>${s.host?'<button class="button wide" data-do="start">再玩一局 ↻</button>':''}</div>${resultPanel(s)}`;
 }
 $('#stage').innerHTML=html;syncChoices();progress();
}

$('#stage').addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled)return;
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
 switch(button.dataset.do){case'invite':invite();break;case'settings':roomAction('settings',{target:Number($('#target').value),customPercent:$('#customPercent').value===''?null:Number($('#customPercent').value)});break;case'start':roomAction('start');break;case'next':action('next');break;case'replay-focus':startFocus();break;case'skip-focus':stopFocus();break;}
});
$('#stage').addEventListener('error',event=>{if(event.target.matches('.choice-art img')){event.target.hidden=true;event.target.nextElementSibling.hidden=false;}},true);
$('#stage').addEventListener('submit',async event=>{
 event.preventDefault();
 if(event.target.id==='giveForm'){const assignments={...draftGifts};if(Object.keys(assignments).length!==state.players.length-1)return toast('請先為每位朋友選一件禮物');return action('give',{assignments});}
 if(event.target.id==='wishForm'){if(draftLikes.length!==4)return toast('請依序選好四件不同的禮物');const ranking=Object.fromEntries(rankKeys.map((key,index)=>[key,draftLikes[index]]));return action('wish',{ranking});}
 if(event.target.id==='enterForm'){
  if(busy)return;busy=true;
  try{const result=await api(code?'join':'create',{type:'gift',code});if(result.type!=='gift')throw Error('這是其他遊戲房間，請從大廳加入');save(result);receive(await api('state'));$('#connection').textContent='';}catch(error){toast(error.message);}finally{busy=false;}
 }
});
async function action(name,data={}){if(busy)return;busy=true;try{const result=await api('action',{action:name,...data});receive(result);if(['give','wish'].includes(name)&&!['reveal','finished'].includes(result.phase))playSound('confirm');$('#connection').textContent='';}catch(error){toast(error.message);}finally{busy=false;}}
async function roomAction(route,data={}){if(busy)return;busy=true;try{receive(await api(route,data));}catch(error){toast(error.message);}finally{busy=false;}}
async function invite(){const url=inviteBase+'/gift/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製給朋友',url);}}
$('#invite').onclick=invite;$('#help').onclick=()=>$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();
$('#motionToggle').onclick=()=>{motionEnabled=!motionEnabled;try{localStorage.setItem('ah-gift-motion',motionEnabled?'on':'off');}catch{}updateMotionButton();if(!allowsMotion())stopFocus();if(state?.result)render();};
$('#soundToggle').onclick=()=>{soundEnabled=!soundEnabled;updateSoundButton();if(soundEnabled)playSound('confirm');else stopSound();};
$('#soundVolume').oninput=event=>{soundVolume=Number(event.target.value)/100;try{localStorage.setItem('ah-gift-volume',String(soundVolume));}catch{}for(const clip of playingSounds)clip.volume=soundVolume;};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFocus();stopSound();}});
async function poll(){if(!session||busy||polling)return;polling=true;try{receive(await api('state'));$('#connection').textContent='';if(disconnected){toast('已重新連線，恢復原座位');disconnected=false;}}catch(error){disconnected=true;$('#connection').textContent='連線暫停：'+error.message+'。正在重試…';}finally{polling=false;}}
fetch('/api/info').then(response=>response.json()).then(info=>inviteBase=info.preferred||info.addresses.find(address=>address.includes('://26.'))||location.origin).catch(()=>{});
entry();if(session)poll();else if(code)RoomReconnect.restore(code,'gift','#connection').then(restored=>{if(restored){save(restored);poll();}});
updateMotionButton();updateSoundButton();
checkNewAchievement();
setInterval(poll,1000);if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();
fetch('/api/auth/me').then(response=>response.json()).then(me=>{const identity=$('#entryIdentity');if(identity&&me.displayName)identity.textContent=`以「${me.displayName}」入座`;}).catch(()=>{});
