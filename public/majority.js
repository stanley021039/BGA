'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={two:'二選一',three:'三選一',blank:'填空題'},colors=['#8d6ba8','#c07656','#4d8b82','#9b9048','#678bc0','#b96889'];
const customPercentOptions=[['','依題庫比例'],['0','0% · 只抽內建'],['25','25% · 偶爾投稿'],['50','50% · 均衡'],['75','75% · 投稿優先'],['100','100% · 盡量投稿']];
const customPercentLabel=value=>value===null?'依題庫比例':value+'%';
const customPercentSelect=value=>customPercentOptions.map(([number,label])=>`<option value="${number}" ${(value===null?'':String(value))===number?'selected':''}>${label}</option>`).join('');
let code=(location.pathname.match(/\/majority\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'',session=null,state=null,busy=false,polling=false,disconnected=false,signature='',topic='food',type='two',source='bank',choice=null,draft='',custom={prompt:'',options:['','','']},inviteBase=location.origin;
let focusTimer=null,gatherAnimations=[],knownAchievements=null,achievementNoticeRound=null,achievementNoticeNames='';
const motionGate=MotionPolicy.createGate();

try{session=JSON.parse(localStorage.getItem(code?'ah-majority:'+code:'ah-majority')||'null');if(session&&!code)code=session.code;}catch{}
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4500);}
async function api(route,data){return RoomApi.request(route,data,{code,room:'majority',session,onKicked:()=>{RoomHost.kicked(session);session=null;}});}
function save(s){session=s;code=s.code;localStorage.setItem('ah-majority',JSON.stringify(s));localStorage.setItem('ah-majority:'+code,JSON.stringify(s));history.replaceState(null,'','/majority/'+code);}
async function action(name,data={}){if(busy)return;busy=true;actionFeedback('送出中…');syncActionBusy();try{const result=await api('action',{action:name,...data});const live=receive(result);if(live&&name==='answer'&&['answering','review'].includes(result.phase))playSound('confirm');actionFeedback({answer:'答案已鎖定 ✓',withdraw:'已收回答案',merge:'答案組已合併',resetGroups:'已還原分組',score:'已計分'}[name]||'已完成','success');if(live)MotionPolicy.confirm($('#gameActionFeedback'));$('#connection').textContent='';}catch(e){actionFeedback(e.message,'error');}finally{busy=false;syncActionBusy();syncAnswerChoices();syncMerge();}}
async function roomAction(route,data={}){if(busy)return;const settings=route==='settings',restoreFocus=settings&&document.activeElement?.closest?.('.room-settings-save');busy=true;actionFeedback('送出中…','info',settings);syncActionBusy();try{receive(await api(route,data));actionFeedback(settings?'房間設定已儲存。':'已完成','success',settings);}catch(e){actionFeedback(e.message,'error',settings);}finally{busy=false;syncActionBusy();if(restoreFocus)$('#stage .room-settings-save')?.focus({preventScroll:true});}}
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
 const prepare=$('#prepareOpen');if(prepare)prepare.disabled=busy||state?.phase==='finished';
 window.MajoritySocial?.setBusy(busy);
}
function syncAnswerChoices(){
 for(const button of document.querySelectorAll('[data-choice]')){
  const selected=Number(button.dataset.choice)===choice;button.classList.toggle('chosen',selected);button.setAttribute('aria-pressed',String(selected));
  button.querySelector('span').textContent=String.fromCharCode(65+Number(button.dataset.choice))+(selected?' · 我的選擇 ✓':'');
 }
 const submit=$('#gameActions [data-do="answer"]');if(submit)submit.disabled=busy||choice===null;
}
function syncMerge(){
 const from=$('#mergeFrom'),to=$('#mergeTo'),button=$('#gameActions [data-do="merge"]');if(!from||!to||!button)return;
 button.disabled=busy||from.value===to.value;$('#mergeHint').textContent=from.value===to.value?'請選擇兩個不同的答案組':'';
}
function bindGamePopovers(container){
 for(const details of container.querySelectorAll('.setting-details,.end-answering')){
  if(details._gamePopoverBound)continue;let panel=details.querySelector('.game-popover-panel');
  if(!panel){panel=document.createElement('div');panel.className='game-popover-panel';for(const child of [...details.children])if(child.tagName!=='SUMMARY')panel.append(child);details.append(panel);}
  if(window.GameUI?.bindPopover){GameUI.bindPopover(details,panel,{width:320});details._gamePopoverBound=true;}
 }
}
function renderAction(){
 if(!state)return;const s=state;let html=['answering','review'].includes(s.phase)?'':'<h2>本輪操作</h2>';
 const button=(name,label,disabled=false)=>'<button class="button" data-do="'+name+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
 if(s.phase==='waiting')html+=s.host?button('start',s.players.length<3?'還差 '+(3-s.players.length)+' 位朋友':'開始同頻',s.players.length<3):'<p>等待房主開始</p>';
 else if(s.players.find(p=>p.id===s.me)?.waitingForNextRound&&['choosing','answering'].includes(s.phase))html+='<p>下一題會自動加入</p>';
 else if(s.phase==='choosing'){
  if(s.presenterId!==s.me)html+='<p>等待 '+esc(playerName(s.presenterId))+' 挑題</p>'+(s.host?button('pass','換下一位出題'):'');
  else html+=source==='bank'?button('draw',s.candidates.length?'再抽三題':'抽三題'):'<button class="button" type="submit" form="customForm">送出題目</button>';
 }else if(s.phase==='answering'){
  html+=s.ownAnswer!==null?'<p>答案已鎖定 ✓</p>'+button('withdraw','收回答案'):s.question.type==='blank'?'<button class="button" type="submit" form="blankForm">鎖定答案</button>':button('answer','鎖定答案',choice===null);
  html+='<div class="action-progress"><span id="progress"></span><span id="timer"></span></div>'+(s.host?'<details class="end-answering"><summary>提前結束</summary><p class="small">未交卷的朋友本題不計分。</p>'+button('close','結束作答')+'</details>':'');
 }else if(s.phase==='review'){
  if(s.host){
   if(s.groups.length>1)html+='<div class="merge-controls"><label>將這組<select id="mergeFrom">'+s.groups.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.label)+'</option>').join('')+'</select></label><label>合併到<select id="mergeTo">'+s.groups.map((g,i)=>'<option value="'+esc(g.id)+'" '+(i===1?'selected':'')+'>'+esc(g.label)+'</option>').join('')+'</select></label>'+button('merge','合併答案')+'<p id="mergeHint" class="small"></p></div>';
   html+='<div class="review-actions">'+button('resetGroups','還原分組')+button('score','確認計分')+'</div>';
  }else html+='<p>等待房主確認分組</p>';
 }else if(s.phase==='reveal')html+=s.host||s.presenterId===s.me?button('next',s.round>=s.roundLimit?'查看本局結果':'開始下一題'):'<p>等待開始下一題</p>';
 else if(s.phase==='finished')html+=(s.host?button('start','再玩一局'):'')+'<a href="/history">查看對局歷史</a>';
 GameShell.stableMarkup($('#gameActions'),html);bindGamePopovers($('#gameActions'));syncAnswerChoices();syncMerge();syncActionBusy();
 for(const control of $('#gameActions').querySelectorAll('button'))window.GameUI?.decorateButton(control,['draw','resetGroups'].includes(control.dataset.do)?'refresh':'check');
}

const playerName=id=>state?.players.find(p=>p.id===id)?.name||state?.departed?.find(p=>p.id===id)?.name||'玩家';
function allowsMotion(){return MotionPolicy.allowsMotion();}
function updateMotionButton(){const button=$('#motionToggle');if(button)button.hidden=true;}
function playSound(kind){window.AudioSettings.playEffect(kind);}
function stopSound(){window.AudioSettings.stopEffects();}
function stopFocus(){clearTimeout(focusTimer);focusTimer=null;const panel=$('#majoritySpotlight'),hadFocus=panel?.contains(document.activeElement);if(panel)panel.hidden=true;document.querySelectorAll('.result-group.is-focused').forEach(group=>group.classList.remove('is-focused'));if(hadFocus)$('#stage [data-do="replay-focus"]')?.focus();}
function stopGather(){for(const animation of gatherAnimations)animation.cancel();gatherAnimations=[];}
function gatherPlayers(){
 if(!allowsMotion()||document.hidden)return;
 const stage=$('#majorityAnswerStage');if(!stage)return;
 const stageRect=stage.getBoundingClientRect();
 const seats=[...document.querySelectorAll('#players .player')];
 for(const [index,chip] of [...stage.querySelectorAll('.group-player')].entries()){
  if(typeof chip.animate!=='function')break;
  const target=chip.getBoundingClientRect(),seat=seats[state.players.findIndex(player=>player.id===chip.dataset.playerId)]?.querySelector('.avatar');
  const source=seat?.getBoundingClientRect();
  const visible=source&&source.bottom>0&&source.top<innerHeight&&source.right>0&&source.left<innerWidth;
  const fromX=visible?source.left+source.width/2:stageRect.left+stageRect.width/2;
  const fromY=visible?source.top+source.height/2:stageRect.top+Math.min(72,stageRect.height/2);
  const dx=fromX-(target.left+target.width/2),dy=fromY-(target.top+target.height/2);
  const animation=MotionPolicy.animate(chip,[{opacity:.2,transform:`translate(${dx}px,${dy}px) scale(.78)`},{opacity:1,transform:'translate(0,0) scale(1)'}],{duration:420,delay:Math.min(index*35,280),easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
  if(!animation)continue;gatherAnimations.push(animation);
  animation.onfinish=()=>{gatherAnimations=gatherAnimations.filter(item=>item!==animation);};
 }
}
function startFocus(){
 if(!allowsMotion()||!state?.result||document.hidden)return;
 const panel=$('#majoritySpotlight'),content=$('#majorityFocusContent'),groups=[...state.groups].sort((a,b)=>b.count-a.count).slice(0,3);
 if(!panel||!content||!groups.length)return;
 stopFocus();panel.hidden=false;let step=0;
 const show=()=>{
  document.querySelectorAll('.result-group.is-focused').forEach(group=>group.classList.remove('is-focused'));
  if(step>=groups.length){stopFocus();return;}
  const group=groups[step],points=group.winner?state.result.points:0;
  content.innerHTML='<span class="eyebrow">答案分布 '+(step+1)+' / '+groups.length+'</span><strong>'+esc(group.label)+'</strong><span>'+group.count+' 人選擇'+(points?' · 每人 +'+points+' 分':' · 本組沒有加分')+'</span>';
  $('#stage [data-group-id="'+group.id+'"]').classList.add('is-focused');
  content.classList.remove('focus-enter');void content.offsetWidth;content.classList.add('focus-enter');
  step++;focusTimer=setTimeout(show,650);
 };show();
}
async function checkNewAchievement(){
 try{const response=await fetch('/api/achievements');if(!response.ok)return;const data=await response.json(),unlocked=new Set(data.achievements.filter(item=>item.unlockedAt).map(item=>item.id));
  const names=knownAchievements?[['majority-first-vote','第一次舉牌'],['all-first-table','第一桌']].filter(([id])=>!knownAchievements.has(id)&&unlocked.has(id)).map(([,name])=>name):[];
  if(names.length){achievementNoticeRound=state?.round;achievementNoticeNames=names.join('、');const notice=$('#majorityAchievementNotice');if(notice){notice.textContent='解鎖成就：'+achievementNoticeNames+'。';const link=document.createElement('a');link.href='/achievements';link.textContent='查看收藏冊 ↗';notice.append(link);notice.hidden=false;}}
  knownAchievements=unlocked;
 }catch{}
}
function restoreAchievementNotice(){if(achievementNoticeRound!==state?.round)return;const notice=$('#majorityAchievementNotice');if(!notice)return;notice.textContent='解鎖成就：'+achievementNoticeNames+'。';const link=document.createElement('a');link.href='/achievements';link.textContent='查看收藏冊 ↗';notice.append(link);notice.hidden=false;}
function resultMarkup(s,reviewing){
 const total=Math.max(1,s.participantIds.length),groups=[...s.groups].sort((a,b)=>b.count-a.count),winners=groups.filter(group=>group.winner);
 const groupRows=groups.map(group=>{
  const players=group.playerIds.map(id=>{const player=s.players.find(item=>item.id===id)||s.departed?.find(item=>item.id===id),index=s.players.findIndex(item=>item.id===id),name=playerName(id);return '<span class="group-player chip" data-player-id="'+esc(id)+'"><span class="group-player-avatar" style="--avatar:'+colors[Math.max(0,index)%colors.length]+'" aria-hidden="true">'+(player?.avatar?'<img src="'+esc(player.avatar)+'" alt="">':esc(name.slice(0,1)))+'</span><span>'+esc(name)+(reviewing&&s.answers&&s.question.type==='blank'?'：'+esc(s.answers[id]):'')+'</span></span>';}).join('');
  return '<section class="result-group '+(group.winner?'win':'')+'" data-group-id="'+esc(group.id)+'"><div class="result-title"><h3>'+esc(group.label)+'</h3><strong>'+group.count+(group.count>=2?' 人同頻':' 人選擇')+(!reviewing&&group.winner?' · 每人 +'+s.result.points+' 分':'')+'</strong></div><div class="vote-track" role="img" aria-label="'+esc(group.label)+'：'+group.count+' / '+total+' 票"><span style="width:'+Math.round(100*group.count/total)+'%"></span></div><div class="chips">'+players+'</div></section>';
 }).join('')||'<p>這題沒有人交卷。</p>';
 const scoreRows=reviewing?'':'<section class="round-scores" aria-label="本題個人得分"><h2>這題的得分</h2>'+s.participantIds.map(id=>{const gain=s.result.gains[id]||0,score=s.players.find(player=>player.id===id)?.score;return '<div class="round-score"><span>'+esc(playerName(id))+(s.result.missingIds.includes(id)?' · 未交卷':'')+'</span><b>'+(gain>0?'+':'')+gain+' 分</b>'+(score===undefined?'':'<small>目前 '+score+' 分</small>')+'</div>';}).join('')+'</section>';
 const banner=reviewing?'答案已公開，請大家一起確認。房主可合併同義答案；分數尚未計入。':(winners.length?'唯一最大答案組，每人 +'+s.result.points+' 分。':'最高票平手或沒有至少兩人一致，這題都不加分。')+(s.result.presenterPenalty?' 出題者扣 1 分：最大組未超過全體玩家 1/3。':'')+(s.result.missingIds.length?' 未交卷 '+s.result.missingIds.length+' 人，不計分。':'');
 return '<div class="card reveal-card"><div class="eyebrow">'+(reviewing?'先確認，再計分':'THE REVEAL')+'</div><h1>'+(reviewing?'有沒有其實是同一個答案？':winners.length?'原來大家都選這個！':'這題，各有各的想法。')+'</h1><p class="sub">'+esc(s.question.prompt)+'</p><section id="majorityAnswerStage" class="answer-stage" aria-label="答案與玩家分組"><div class="answer-stage-heading"><span class="eyebrow">同頻舞台</span><span>全桌 '+s.participantIds.length+' 人 · 已交卷 '+Object.keys(s.answers||{}).length+' 人</span></div><div class="answer-stage-groups">'+groupRows+'</div></section><div class="banner">'+banner+'</div>'+(!reviewing?'<button type="button" class="quiet spotlight-control" data-do="replay-focus" '+(allowsMotion()?'':'hidden')+'>重播答案焦點 ↻</button><div id="majoritySpotlight" class="majority-spotlight" hidden><div id="majorityFocusContent" aria-hidden="true"></div><button type="button" class="quiet" data-do="skip-focus">跳過演出</button></div>':'')+scoreRows+(!reviewing?'<p id="majorityAchievementNotice" class="achievement-notice" role="status" hidden></p>':'')+'</div>';
}
function entry(){state=null;$('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">◒ ◓</div><h1>你選的，<br>大家也會選嗎？</h1><p class="sub">一群朋友、一點直覺，和一些意想不到的默契。</p><div class="intro-options"><span>二選一</span><span>三選一</span><span>填空題</span></div><form id="enterForm" class="inline-entry"><label for="nickname">你的暱稱</label><input id="nickname" maxlength="16" required placeholder="朋友怎麼稱呼你？" value="${esc(localStorage.getItem('ah-name')||'')}">${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button">加入這一桌 →</button>`:'<button class="button wide">開一桌同頻俱樂部 →</button>'}</form></div>`;}
function playerMetrics(p,s){
 if(s.phase==='reveal'&&s.result){const gain=s.result.gains[p.id]||0;return [{value:(gain>0?'+':'')+gain+' / '+p.score,label:'本題分數 / 總分'}];}
 return [{value:p.score??0,label:'總分'}];
}
function playerStatus(p,s){
 const labels=[];if(p.id===s.hostId)labels.push('房主');if(p.id===s.presenterId)labels.push('出題人');labels.push(p.online?'在線':'暫時離線');
 if(p.waitingForNextRound)labels.push(s.phase==='finished'?'下一局入局':'下一題入局');else if(s.phase==='answering')labels.push(s.answeredIds.includes(p.id)?'已交卷 ✓':'思考中…');
 return labels.join(' · ');
}
function receive(s){if(!s||s.type!=='majority')throw Error('這不是同頻俱樂部房間');if(state&&(s.version<state.version||RoomHost.isStaleSnapshot?.(s,state)))return false;const live=motionGate.update(s,{connected:!disconnected});const shouldGather=state?.round===s.round&&state.phase==='answering'&&['review','reveal'].includes(s.phase)&&motionGate.take('gather:'+s.version,live);const shouldFocus=state?.round===s.round&&['answering','review'].includes(state?.phase)&&s.phase==='reveal'&&!!s.result&&motionGate.take('score:'+s.version,live);if(state&&(state.phase!==s.phase||state.round!==s.round))stopFocus();if(state?.round!==s.round||state?.question?.prompt!==s.question?.prompt){choice=null;draft='';}state=s;RoomHost.update(s,receive);$('#roomTag').textContent='房間 '+code;$('#invite').hidden=false;$('#roundTag').textContent=s.phase==='waiting'?'讓朋友們集合吧':`第 ${s.round} / ${s.roundLimit} 題`;$('#phaseTag').textContent={waiting:'等待入座',choosing:'挑一個好聊的問題',answering:'秘密作答中',review:'確認同義答案',reveal:'答案揭曉',finished:'今晚的同頻王'}[s.phase];$('#count').textContent=s.players.length+' / 12';$('#playerScoreLegend').textContent=s.phase==='reveal'?'本題分數 / 總分':'總分';$('#steps').querySelectorAll('span').forEach((e,i)=>e.classList.toggle('active',i===({choosing:0,answering:1,review:2,reveal:2,finished:2}[s.phase]??0)));GameShell.stableMarkup($('#players'),s.players.map(p=>GameShell.playerRow(p,{me:s.me,status:playerStatus(p,s),metrics:playerMetrics(p,s)})).join(''));const sig=JSON.stringify([s.phase,s.round,s.roundLimit,s.options.customPercent,s.presenterId,s.question,s.candidates,s.players.find(p=>p.id===s.me)?.waitingForNextRound,s.ownAnswer,s.groups,s.result,s.winner,s.phase==='waiting'?s.players.length:null]);if(sig!==signature){signature=sig;stopGather();render();restoreAchievementNotice();if(shouldGather)gatherPlayers();if(shouldFocus){startFocus();playSound('reveal');checkNewAchievement();}}progress();window.MajoritySocial?.receive(s);return live;}
function progress(){if(!state)return;const p=$('#progress');if(p)p.textContent=`${state.answeredIds.length} / ${state.participantIds.length} 人已交卷`;const t=$('#timer');if(t)t.textContent=state.deadline?'剩 '+Math.max(0,Math.ceil((state.deadline-Date.now())/1000))+' 秒':'';}
function render(){const s=state;let html='';if(s.phase==='waiting'){html=`<div class="card hero"><div class="eyebrow">THE MORE, THE MERRIER</div><h1>朋友到齊，<br>默契就位。</h1><p class="sub">3–12 人 · 每題大約 1–2 分鐘<br>輪流挑題，所有人都能回答。選擇題同頻 +1 分，填空題同頻 +2 分。</p><div class="banner">房間代碼 <b>${code}</b>　<button class="quiet" data-do="invite">複製邀請連結 ↗</button></div>${s.host?`<section class="room-settings-panel" aria-label="房間設定"><h2>房間設定</h2><div class="fields"><div><label for="rounds">這局玩幾題？（3–30 題）</label><input id="rounds" type="number" min="3" max="30" value="${s.roundLimit}"></div><div><label for="customPercent">玩家投稿候選題比例</label><select id="customPercent">${customPercentSelect(s.options.customPercent)}</select></div></div><details class="setting-details"><summary>投稿比例說明</summary><p class="small">比例依每次抽出的三張候選題取近似值；同分類、同題型的投稿不足或已抽過時用內建題補足。選 0% 則只抽內建。手動出題與預備題不受限制。</p></details>${GameShell.settingsActions()}</section>`:`<p>等房主開始，先聊聊今天過得怎麼樣。投稿候選題設定：${customPercentLabel(s.options.customPercent)}。</p>`}</div>`;}
else if(s.players.find(p=>p.id===s.me)?.waitingForNextRound&&['choosing','answering'].includes(s.phase)){html=`<div class="card hero"><div class="eyebrow">已加入這一桌</div><h1>下一題，一起同頻。</h1><p>這題已開始，你先觀看；下一題會自動加入，從 0 分開始。</p>${s.question?`<h2>${esc(s.question.prompt)}</h2><p>${s.question.options.map(esc).join(' ／ ')||'填空題'}</p>`:`<p>${esc(playerName(s.presenterId))} 正在挑題目。</p>`}<p class="small">等待時也能預備題目或送出表情。</p></div>`;}
else if(s.phase==='choosing'){if(s.presenterId!==s.me){html=`<div class="card hero"><div class="hero-mark">◒</div><h1>${esc(playerName(s.presenterId))}<br>正在挑題目。</h1><p>等一下，你也要給出自己的答案。</p>${s.host?'':''}</div>`;}else{html=`<div class="card"><div class="eyebrow">YOUR TURN TO ASK</div><h1>這一題，你來選。</h1><p class="sub">挑個大家有感的話題。你也會一起回答。</p><div class="tabs"><button data-source="bank" class="${source==='bank'?'on':''}">自動抽題</button><button data-source="custom" class="${source==='custom'?'on':''}">自己出題</button></div><div class="fields"><div><label for="questionType">題型</label><select id="questionType">${Object.entries(types).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v}</option>`).join('')}</select></div>${source==='bank'?`<div><label for="topic">今天聊什麼？</label><select id="topic">${s.topics.map(t=>`<option value="${t.id}" ${topic===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div>`:'<div><label>交卷後一起揭曉</label><p class="small">不需要設定「正確答案」。</p></div>'}</div>${source==='bank'?`<div class="actions"><span class="small">AI 整理的原創題庫 · 不需外部連線</span></div><div class="question-list">${s.candidates.filter(q=>q.type===type&&q.topic===topic).map(q=>`<button class="qcard" data-question="${q.id}"><small>${types[q.type]}${q.reused?' · 此分類已抽過，重新混題':''}</small><strong>${esc(q.prompt)}</strong><div class="qopts">${q.options.length?q.options.map(esc).join(' ／ '):'大家各自填一個答案'}</div><small>用這題 →</small></button>`).join('')}</div>`:`<form id="customForm"><label for="customPrompt">想問大家什麼？</label><textarea id="customPrompt" maxlength="160" required placeholder="例如：下班後只想放空，你會選…">${esc(custom.prompt)}</textarea>${type==='blank'?'<p class="small">填空請盡量問一個具體答案，例如「想到早餐店，第一個想到的食物是？」</p>':Array.from({length:type==='two'?2:3},(_,i)=>`<label for="option${i}">選項 ${String.fromCharCode(65+i)}</label><input id="option${i}" maxlength="60" required value="${esc(custom.options[i])}" placeholder="寫一個選項">`).join('')}</form>`}</div>`;}}
else if(s.phase==='answering'){const q=s.question;html=`<div class="card"><div class="eyebrow">${types[q.type]} · ${esc(playerName(s.presenterId))} 出題</div><h1>${esc(q.prompt)}</h1>${s.ownAnswer!==null?`<div class="locked answer-note"><span class="note-seal" aria-hidden="true">✓</span><div><strong>你的答案已交卷</strong><p>先蓋住答案，等朋友們交卷後一起揭曉。</p><p class="own-answer"><span>你的答案：</span><b>${esc(q.type==='blank'?s.ownAnswer:q.options[s.ownAnswer])}</b></p></div></div>`:q.type==='blank'?`<form id="blankForm"><label for="blankAnswer">你覺得最多人會想到什麼？</label><input id="blankAnswer" maxlength="60" required autocomplete="off" value="${esc(draft)}" placeholder="一個簡短、具體的答案"></form>`:`<div class="answer-grid ${q.type==='three'?'three':''}">${q.options.map((o,i)=>`<button class="answer ${choice===i?'chosen':''}" data-choice="${i}" aria-pressed="${choice===i}"><span>${String.fromCharCode(65+i)}${choice===i?' · 我的選擇':''}</span>${esc(o)}</button>`).join('')}</div>`}</div>`;}
else if(['review','reveal'].includes(s.phase)){html=resultMarkup(s,s.phase==='review');}
 else if(s.phase==='finished'){html=`<div class="card hero"><div class="hero-mark">♡</div><div class="eyebrow">TONIGHT’S BEST MATCH</div><h1>${s.winner.ids.map(id=>esc(playerName(id))).join('、')}<br>${s.winner.reason?'本局提前結束':'是今晚的同頻王！'}</h1><p>共 ${s.round} 題 · 最高 ${s.winner.score} 分</p>${[...s.players].sort((a,b)=>b.score-a.score).map(p=>`<div class="standing"><b>${esc(p.name)}</b><span>${p.score} 分</span></div>`).join('')}<div class="actions">${s.host?'':''}<a href="/history" class="button outline">回看這一局</a></div></div>`;}$('#stage').innerHTML=html;window.GameUI?.decorateButton($('#stage .room-settings-save'),'save');bindGamePopovers($('#stage'));renderAction();progress();}
$('#stage').addEventListener('input',e=>{if(e.target.id==='blankAnswer')draft=e.target.value;if(e.target.id==='customPrompt')custom.prompt=e.target.value;if(/^option\d$/.test(e.target.id))custom.options[Number(e.target.id.slice(-1))]=e.target.value;});
document.addEventListener('change',e=>{if(!e.target.closest('#stage,[data-game-action-slot]'))return;if(['mergeFrom','mergeTo'].includes(e.target.id)){syncMerge();return;}if(e.target.id==='questionType'){type=e.target.value;render();}if(e.target.id==='topic'){topic=e.target.value;render();}});
document.addEventListener('click',e=>{if(!e.target.closest('#stage,[data-game-action-slot]'))return;const b=e.target.closest('button');if(!b||b.disabled||busy)return;if(b.dataset.source){source=b.dataset.source;render();return;}if(b.dataset.question){action('ask',{questionId:b.dataset.question});return;}if(b.dataset.choice!==undefined){choice=Number(b.dataset.choice);syncAnswerChoices();return;}switch(b.dataset.do){case'invite':invite();break;case'replay-focus':startFocus();break;case'skip-focus':stopFocus();break;case'draw':action('draw',{topic,type});break;case'answer':if(choice!==null)action('answer',{answer:choice});break;case'settings':roomAction('settings',{rounds:Number($('#rounds').value),customPercent:$('#customPercent').value===''?null:Number($('#customPercent').value)});break;case'start':roomAction('start');break;case'merge':action('merge',{from:$('#mergeFrom').value,to:$('#mergeTo').value});break;case'withdraw':case'pass':case'close':case'score':case'next':case'resetGroups':action(b.dataset.do);break;}});
$('#stage').addEventListener('submit',async e=>{e.preventDefault();if(e.target.id==='blankForm')return action('answer',{answer:$('#blankAnswer').value});if(e.target.id==='customForm')return action('ask',{type,prompt:custom.prompt,options:type==='blank'?[]:custom.options.slice(0,type==='two'?2:3)});if(e.target.id==='enterForm'){if(busy)return;busy=true;try{const name=$('#nickname').value.trim(),s=await api(code?'join':'create',{name,type:'majority',code});if(s.type!=='majority')throw Error('這是其他遊戲的房間，請由大廳加入');save(s);localStorage.setItem('ah-name',name);receive(await api('state'));$('#connection').textContent='';}catch(err){toast(err.message);}finally{busy=false;syncActionBusy();}}});
async function invite(){const url=inviteBase+'/majority/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製給同一個 VPN 的朋友',url);}}
MotionPolicy.subscribe(()=>{updateMotionButton();if(!allowsMotion()){stopFocus();stopGather();}const replay=$('#stage [data-do="replay-focus"]');if(replay)replay.hidden=!allowsMotion();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFocus();stopGather();stopSound();}});

window.GameUI?.decorateButton($('#closeHelp'),'close',{iconOnly:true,label:'關閉遊戲規則'});
$('#invite').onclick=invite;$('#help').onclick=()=>window.GameUI?GameUI.openDialog($('#rules'),$('#help')):$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();
async function poll(){if(!session||busy||polling)return;polling=true;try{receive(await api('state'));$('#connection').textContent='';if(disconnected){toast('已重新連線，恢復原座位');disconnected=false;}}catch(e){disconnected=true;$('#connection').textContent='連線暫停：'+e.message+'。正在重試…';}finally{polling=false;}}
fetch('/api/info').then(r=>r.json()).then(s=>inviteBase=s.preferred||s.addresses.find(a=>a.includes('://26.'))||location.origin).catch(()=>{});
entry();updateMotionButton();checkNewAchievement();if(session)poll();else if(code)RoomReconnect.restore(code,'majority','#connection').then(restored=>{if(restored){save(restored);poll();}});setInterval(poll,900);setInterval(progress,500);if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();


fetch('/api/auth/me').then(r=>r.json()).then(me=>{const nickname=document.querySelector('#nickname');if(nickname){nickname.value=me.displayName;nickname.readOnly=true;}}).catch(()=>{});
