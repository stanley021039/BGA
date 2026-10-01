'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const rankLabels={great:'最想要 · +3',good:'想要 · +2',ok:'還可以 · +1',noWay:'最不想要 · −4',unranked:'沒標記 · −1'};
let code=(location.pathname.match(/\/gift\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'';
let session=null,state=null,busy=false,polling=false,disconnected=false,signature='',inviteBase=location.origin;
let draftGifts={},draftRanking={};
try{session=JSON.parse(localStorage.getItem(code?'ah-gift:'+code:'ah-gift')||'null');if(session&&!code)code=session.code;}catch{}

function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500);}
async function api(route,data){
 return RoomApi.request(route,data,{code,room:'gift',session,onKicked:()=>{RoomHost.kicked(session);session=null;}});
}
function save(result){session=result;code=result.code;localStorage.setItem('ah-gift',JSON.stringify(result));localStorage.setItem('ah-gift:'+code,JSON.stringify(result));history.replaceState(null,'','/gift/'+code);}
function player(id){return state?.players.find(item=>item.id===id);}
function giftArt(gift){return gift.image?`<img src="${esc(gift.image)}" alt="" loading="lazy">`:'<span aria-hidden="true">✦</span>';}
function cards(){return `<div class="gift-grid">${state.gifts.map((gift,index)=>`<div class="gift-card"><span class="gift-number">${String(index+1).padStart(2,'0')}</span><div class="gift-art">${giftArt(gift)}</div><b>${esc(gift.title)}</b><small>${esc(gift.category)}</small></div>`).join('')}</div>`;}
function options(selected){return '<option value="">請選擇一件禮物</option>'+state.gifts.map((gift,index)=>`<option value="${esc(gift.id)}" ${selected===gift.id?'selected':''}>${index+1}. ${esc(gift.title)}</option>`).join('');}
function playerRow(item){return `<div class="player"><img src="${esc(item.avatar||'')}" alt=""><div class="player-name">${esc(item.name)}${item.id===state.me?' · 你':''}<small>${item.id===state.hostId?'房主 · ':''}${item.online?'在線':'暫時離線'}</small></div><div class="player-scores" title="送禮／收禮"><span>${item.giveScore}</span><span>${item.getScore}</span></div></div>`;}
function progress(){const label=$('#progress');if(label&&state)label.textContent=`${state.submittedIds.length} / ${state.players.length} 人已完成`;}

function entry(){
 $('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">✦ 🎁 ✦</div><span class="eyebrow">THE GIFT CLUB</span><h1>你真的知道，<br>朋友想要什麼嗎？</h1><p class="sub">挑一件禮物給每位朋友，再猜猜大家的心願。送得好，也要收得開心。</p><form id="enterForm"><label for="nickname">你的暱稱</label><input id="nickname" maxlength="16" required placeholder="朋友怎麼稱呼你？" value="${esc(localStorage.getItem('ah-name')||'')}">${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button wide">加入這一桌 →</button>`:'<button class="button wide">開一桌送禮達人 →</button>'}</form></div>`;
}
function receive(next){
 if(!next||next.type!=='gift')throw Error('這不是送禮達人房間');
 if(state?.round!==next.round){draftGifts={};draftRanking={};}
 state=next;RoomHost.update(next,receive);
 $('#roomTag').textContent='房間 '+code;$('#invite').hidden=false;
 $('#roundTag').textContent=next.phase==='waiting'?'朋友到齊就開始':`第 ${next.round} 輪 · 目標 ${next.target} 分`;
 $('#phaseTag').textContent={waiting:'等待入座',giving:'秘密挑禮物',wishing:'秘密標喜好',reveal:'禮物揭曉',finished:'送禮達人誕生'}[next.phase];
 $('#count').textContent=next.players.length+' / 8';
 $('#steps').querySelectorAll('span').forEach((element,index)=>element.classList.toggle('active',index===({giving:0,wishing:1,reveal:2,finished:2}[next.phase]??0)));
 GameShell.stableMarkup($('#players'),next.players.map(playerRow).join(''));
 const nextSignature=JSON.stringify([next.phase,next.round,next.target,next.gifts,next.players.map(item=>item.id),next.ownAssignments,next.ownRanking,next.result,next.winner]);
 if(nextSignature!==signature){signature=nextSignature;render();}
 progress();
}
function render(){
 const s=state;let html='';
 if(s.phase==='waiting'){
  html=`<div class="card hero"><div class="hero-mark">🎁</div><span class="eyebrow">MAKE A WISH</span><h1>禮物擺好，<br>朋友來了就開桌。</h1><p class="sub">3–8 人一起玩。每輪先秘密送禮，再秘密標記自己喜歡的禮物。</p><div class="banner">房間代碼 <b>${esc(s.code)}</b>　<button class="quiet" data-do="invite">複製邀請連結 ↗</button></div>${s.host?`<div class="field-row"><div><label for="target">兩條分數的目標（8–30）</label><input id="target" type="number" min="8" max="30" value="${s.target}"></div><button class="button outline" data-do="settings">儲存</button></div><button class="button wide" data-do="start" ${s.players.length<3?'disabled':''}>${s.players.length<3?'還差 '+(3-s.players.length)+' 位朋友':'開始挑禮物 →'}</button>`:'<p>等房主開始，就可以幫朋友挑禮物。</p>'}</div>`;
 }else if(s.phase==='giving'){
  html=`<div class="card"><span class="eyebrow">STEP 01 / GIVE</span><h1>幫每位朋友挑一件。</h1><p class="sub">每件禮物你只能送一次；你的選擇在大家送完前不會公開。</p>${cards()}${s.ownAssignments?'<div class="locked"><strong>禮物已鎖定 ✓</strong><p>等其他朋友選好禮物，再一起標記喜好。</p></div>':`<form id="giveForm" class="assignment-list">${s.players.filter(item=>item.id!==s.me).map(item=>`<label class="assignment"><span class="friend"><img src="${esc(item.avatar||'')}" alt="">送給 ${esc(item.name)}</span><select data-recipient="${esc(item.id)}" required>${options(draftGifts[item.id])}</select></label>`).join('')}<button class="button wide">禮物選好了，鎖定 →</button></form>`}<p id="progress" class="progress"></p></div>`;
 }else if(s.phase==='wishing'){
  html=`<div class="card"><span class="eyebrow">STEP 02 / GET</span><h1>你最想收到哪一件？</h1><p class="sub">四種評價要選四件不同的禮物；還沒選中的禮物會是 −1 分。喜好在全員送出前保密。</p>${cards()}${s.ownRanking?'<div class="locked"><strong>喜好已鎖定 ✓</strong><p>等大家選完，再一起拆禮物。</p></div>':`<form id="wishForm"><div class="rank-list">${Object.entries(rankLabels).filter(([key])=>key!=='unranked').map(([key,label])=>`<div class="rank-field ${key}"><label for="rank-${key}">${label}</label><select id="rank-${key}" data-rank="${key}" required>${options(draftRanking[key])}</select></div>`).join('')}</div><button class="button wide">這就是我的心願，鎖定 →</button></form>`}<p id="progress" class="progress"></p></div>`;
 }else if(s.phase==='reveal'){
  const giftName=id=>s.gifts.find(gift=>gift.id===id)?.title||'禮物';
  html=`<div class="card"><span class="eyebrow">STEP 03 / REVEAL</span><h1>拆禮物囉！</h1><p class="sub">每件禮物同時影響送禮者與收禮者。看看誰最懂朋友。</p>${s.players.map(recipient=>`<div class="reveal-group"><h3><span>${esc(recipient.name)} 收到</span><span class="small">♡ ${recipient.getScore} / ${s.target}</span></h3>${s.result.entries.filter(entry=>entry.recipientId===recipient.id).map(entry=>{const gift=s.gifts.find(item=>item.id===entry.giftId);return `<div class="reveal-entry"><span class="reveal-gift">${gift?.image?`<img src="${esc(gift.image)}" alt="">`:''}<span><b>${esc(player(entry.giverId)?.name||'玩家')}</b> 送了「${esc(giftName(entry.giftId))}」<small> · ${rankLabels[entry.rank]}</small></span></span><b class="${entry.points>=0?'positive':'negative'}">${entry.points>0?'+':''}${entry.points}</b></div>`;}).join('')}</div>`).join('')}<div class="actions">${s.host?'<button class="button" data-do="next">下一輪，換一批禮物 →</button>':'<p>等房主開始下一輪。</p>'}</div></div>`;
 }else if(s.phase==='finished'){
  html=`<div class="card hero"><div class="hero-mark">✦</div><span class="eyebrow">THE GIFTED</span><h1>${s.winner?.ids?.length?'今晚的送禮達人':'本局結束'}</h1><p class="winner-names">${s.winner?.ids?.map(id=>esc(player(id)?.name||'玩家')).join('、')||esc(s.winner?.reason||'')}</p><p class="sub">${s.round} 輪後，送禮與收禮都達到 ${s.target} 分。</p><div class="standings">${[...s.players].sort((a,b)=>Math.min(b.giveScore,b.getScore)-Math.min(a.giveScore,a.getScore)).map(item=>`<div class="standing"><b>${esc(item.name)}</b><span>🎁 ${item.giveScore}</span><span>♡ ${item.getScore}</span></div>`).join('')}</div>${s.host?'<button class="button wide" data-do="start">再玩一局 ↻</button>':''}</div>`;
 }
 $('#stage').innerHTML=html;progress();
}

$('#stage').addEventListener('change',event=>{if(event.target.dataset.recipient)draftGifts[event.target.dataset.recipient]=event.target.value;if(event.target.dataset.rank)draftRanking[event.target.dataset.rank]=event.target.value;});
$('#stage').addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;switch(button.dataset.do){case'invite':invite();break;case'settings':roomAction('settings',{target:Number($('#target').value)});break;case'start':roomAction('start');break;case'next':action('next');break;}});
$('#stage').addEventListener('submit',async event=>{
 event.preventDefault();
 if(event.target.id==='giveForm'){const assignments=Object.fromEntries([...event.target.querySelectorAll('[data-recipient]')].map(select=>[select.dataset.recipient,select.value]));if(new Set(Object.values(assignments)).size!==Object.values(assignments).length)return toast('同一件禮物不能送給兩位朋友');return action('give',{assignments});}
 if(event.target.id==='wishForm'){const ranking=Object.fromEntries([...event.target.querySelectorAll('[data-rank]')].map(select=>[select.dataset.rank,select.value]));if(new Set(Object.values(ranking)).size!==4)return toast('四種評價請選四件不同的禮物');return action('wish',{ranking});}
 if(event.target.id==='enterForm'){
  if(busy)return;busy=true;
  try{const name=$('#nickname').value.trim(),result=await api(code?'join':'create',{name,type:'gift',code});if(result.type!=='gift')throw Error('這是其他遊戲房間，請從大廳加入');save(result);localStorage.setItem('ah-name',name);receive(await api('state'));$('#connection').textContent='';}catch(error){toast(error.message);}finally{busy=false;}
 }
});
async function action(name,data={}){if(busy)return;busy=true;try{receive(await api('action',{action:name,...data}));$('#connection').textContent='';}catch(error){toast(error.message);}finally{busy=false;}}
async function roomAction(route,data={}){if(busy)return;busy=true;try{receive(await api(route,data));}catch(error){toast(error.message);}finally{busy=false;}}
async function invite(){const url=inviteBase+'/gift/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製給朋友',url);}}
$('#invite').onclick=invite;$('#help').onclick=()=>$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();
async function poll(){if(!session||busy||polling)return;polling=true;try{receive(await api('state'));$('#connection').textContent='';if(disconnected){toast('已重新連線，恢復原座位');disconnected=false;}}catch(error){disconnected=true;$('#connection').textContent='連線暫停：'+error.message+'。正在重試…';}finally{polling=false;}}
fetch('/api/info').then(response=>response.json()).then(info=>inviteBase=info.preferred||info.addresses.find(address=>address.includes('://26.'))||location.origin).catch(()=>{});
entry();if(session)poll();else if(code)RoomReconnect.restore(code,'gift','#connection').then(restored=>{if(restored){save(restored);poll();}});
setInterval(poll,1000);if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();
fetch('/api/auth/me').then(response=>response.json()).then(me=>{const nickname=$('#nickname');if(nickname){nickname.value=me.displayName;nickname.readOnly=true;}}).catch(()=>{});
