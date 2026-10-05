'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const topicChoices=[['food','食物飲料'],['animals','動物生物'],['transport','交通工具'],['objects','生活物品'],['people','人物職業'],['nature','自然奇幻'],['places','場所娛樂'],['activities','運動音樂'],['custom','自定義']];
let code=(location.pathname.match(/\/draw\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'';
let session=null,state=null,busy=false,polling=false,signature='',stream=null,canvasVersion=-1,canvasRound=-1,strokes=[],syncPromise=null,clockOffset=0,inviteBase=location.origin;
let filled=false,tool='brush',active=null,pending=[],lastSentAt=0,lastFillSentAt=0,sendQueue=Promise.resolve(),canvasCommandBusy=false,cursor=[256,128];
const localStrokes=new Map();
const canvas=$('#drawCanvas'),colors=['#273942','#ffffff','#e45757','#f3a844','#f4d264','#6bb879','#5197ca','#8058ad','#d979a7','#8b6348'];
const canvasRenderer=StrokeCanvas.createRenderer(canvas);
let feedEntries=[],lastReceivedAt=0,lastTimerSeconds=null,lastTimerRound=-1,disconnected=false;
let canvasQuota={usedFills:0,usedBatches:0,usedPoints:0};
let canvasTotals={points:0,fills:0};
try{session=JSON.parse(localStorage.getItem(code?'ah-draw:'+code:'ah-draw')||'null');if(session&&!code)code=session.code;}catch{}

function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000);}
async function api(route,data){return RoomApi.request(route,data,{code,room:'draw',session,onKicked:()=>{RoomHost.kicked(session);session=null;stream?.close();}});}
function save(result){session=result;code=result.code;localStorage.setItem('ah-draw',JSON.stringify(result));localStorage.setItem('ah-draw:'+code,JSON.stringify(result));history.replaceState(null,'','/draw/'+code);}
function nameOf(id){return state?.players.find(player=>player.id===id)?.name||'朋友';}
function playerRow(player){return GameShell.playerRow(player,{me:state.me,status:player.waitingForNextRound?'下輪加入':player.id===state.presenterId?'本輪畫者':state.guessedIds?.includes(player.id)?'已猜中':player.online?'在線':'暫時離線'});}
function waitingPlayerRow(player){return GameShell.playerRow(player,{me:state.me,status:[player.id===state.hostId?'房主':null,player.online?'已入座':'暫時離線'].filter(Boolean).join(' · '),metrics:[]});}
function options(group,choices,current,inputName){return `<fieldset><legend>${group}</legend><div class="option-row">${choices.map(([value,label])=>`<label><input type="radio" name="${inputName}" value="${value}" ${String(current??'')===value?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`;}
function selectedTopics(settings={}){
 if(Array.isArray(settings.topics))return settings.topics;
 const topics=topicChoices.filter(([value])=>value!=='custom'&&(!settings.topic||settings.topic==='all'||settings.topic===value)).map(([value])=>value);
 if(settings.customPercent!==0)topics.push('custom');
 return topics;
}
function topicOptions(group,current){
 return `<fieldset class="topic-options"><legend>${group}</legend><div class="topic-shortcuts"><span>可多選</span><button type="button" data-select-topics="all">全選</button><button type="button" data-select-topics="none">清除</button></div><div class="option-row">${topicChoices.map(([value,label])=>`<label><input type="checkbox" name="topics" value="${value}" ${current.includes(value)?'checked':''}><span><i aria-hidden="true">✓</i>${label}</span></label>`).join('')}</div><p class="topic-hint">自定義包含共編題庫的投稿題目；至少選擇一個類別。</p></fieldset>`;
}
function readTopics(){
 const topics=[...document.querySelectorAll('#stage input[name="topics"]:checked')].map(input=>input.value);
 if(!topics.length)throw Error('請至少選擇一個題目類別');
 return topics;
}
function waitingActions(s){return s.host?`<p>${s.players.length<2?'等朋友入座，至少需要兩人。':'朋友已入座，可以開始。'}</p><button data-do="start" ${s.players.length<2?'disabled':''}>開始遊戲</button>`:'<p>等待房主開始遊戲。</p>';}
function decorateActions(){for(const button of $('#drawActions').querySelectorAll('button'))window.GameUI?.decorateButton(button,({start:state.phase==='finished'?'replay':'play',next:'next',save:'save',settings:'settings'})[button.dataset.do]);}
function entry(){
 $('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">✎</div><span class="eyebrow">DRAW TOGETHER</span><h1>畫一筆，<br>讓朋友猜一猜。</h1><p id="identity">將以你的角色名稱入座</p><form id="enterForm">${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button wide">加入這一桌 →</button>`:`<div class="entry-topic">${topicOptions('這桌畫什麼？',selectedTopics())}</div><button class="button wide">開一桌你畫我猜 →</button>`}</form></div>`;
}
function stageAvatar(player,extraClass=''){
 return player?.avatar?`<img class="stage-avatar ${extraClass}" src="${esc(player.avatar)}" alt="">`:`<span class="stage-avatar stage-avatar-fallback ${extraClass}" aria-hidden="true">✎</span>`;
}
function stageScene(s){
 const artist=s.players.find(player=>player.id===s.presenterId);
 if(s.phase==='waiting')return `<section class="stage-scene stage-waiting" aria-label="房間內的玩家"><div class="waiting-head"><h1>這桌的朋友</h1><span id="waitingCount">${s.players.length} / 8 位</span></div><div id="waitingPlayers" class="waiting-players">${s.players.map(waitingPlayerRow).join('')}</div></section>`;
 if(s.phase==='choosing'){
  const mine=s.presenterId===s.me;
  return `<div class="stage-scene stage-choosing"><div class="stage-lead">${stageAvatar(artist)}<span>${esc(artist?.name||'畫者')} 的回合</span></div><div class="stage-copy"><span class="stage-ribbon">ROUND ${s.round} / ${s.roundLimit}</span><h1>${mine?'選一張題卡，準備開畫':'畫者正在挑題'}</h1><p>${mine?'只有你看得到題目，選好就能立即畫。':'題目選好後，畫作會出現在同一塊畫布。'}</p><div class="stage-picks">${mine?s.candidates.map(word=>`<button type="button" class="stage-pick" data-word="${esc(word.id)}"><small>${esc(word.topicLabel||'綜合')} · ${esc(word.category)} · ${[...word.title].length} 字</small><strong>${esc(word.title)}</strong><span>畫這題 ↗</span></button>`).join(''):'<span class="stage-pick-back">?</span><span class="stage-pick-back">?</span><span class="stage-pick-back">?</span>'}</div></div></div>`;
 }
 if(s.phase==='reveal')return `<div class="stage-scene stage-reveal"><div class="stage-copy"><span class="stage-ribbon">ROUND ${s.round} / REVEAL</span><h1>答案揭曉</h1><p class="stage-answer">${esc(s.result?.answer||'這輪沒有選定題目')}</p><p class="stage-reason">${esc(s.result?.reason||'')}</p><div class="stage-stat"><b>${s.result?.guessedIds?.length||0}</b> 位朋友猜中 <span>· 畫者每猜中一人 +15 分</span></div></div><div class="stage-art"><canvas id="stagePreview" width="512" height="256" role="img" aria-label="本輪完成的畫作"></canvas><small>本輪畫作</small></div></div>`;
 const rankings=[...s.players].sort((a,b)=>b.score-a.score);
 const winners=s.winner?.ids||[];
 return `<div class="stage-scene stage-finished"><div class="stage-copy"><span class="stage-ribbon">GAME OVER</span><h1>今晚的畫猜高手</h1><p>${esc(s.winner?.reason||'每位畫者都已完成。')}</p><div class="stage-winners">${rankings.filter(player=>winners.includes(player.id)).map(player=>`<div class="stage-winner">${stageAvatar(player)}<b>${esc(player.name)}</b><strong>${player.score} 分</strong><span aria-hidden="true">✦</span></div>`).join('')}</div></div><ol class="stage-ranking">${rankings.map((player,index)=>`<li><span>${index+1}. ${esc(player.name)}</span><b>${player.score} 分</b></li>`).join('')}</ol></div>`;
}
function render(live=false){
 const s=state,settingsOpen=$('#stage .stage-controls')?.open;let html='',actions='';
 document.body.dataset.drawPhase=s.phase;
 document.body.classList.toggle('drawing-active',s.phase==='drawing');
 if(s.phase==='waiting'){
  html=s.host?`<details class="card stage-controls room-settings-panel"><summary>房間設定</summary><div class="room-settings-body" role="group" aria-label="房間設定欄位"><div class="settings">${topicOptions('題目類別',selectedTopics(s.options))}${options('作畫時間',[['60','60 秒'],['90','90 秒'],['120','120 秒']],s.options.seconds,'seconds')}</div>${GameShell.settingsActions()}</div></details>`:'';
  actions=waitingActions(s);
 }else if(s.phase==='drawing'){
  const artist=s.presenterId===s.me,eligible=s.participantIds.includes(s.me),guessed=s.guessedIds.includes(s.me);
   if(!eligible&&!artist)actions='<p>下一輪起可以猜題。</p>';
   else if(guessed)actions='<p>你已猜中！等待本輪揭曉。</p>';
   else if(artist)actions='<p>輪到你畫圖，朋友正在猜題。</p>';
  }else if(s.phase==='choosing'){
   actions=`<p>${s.presenterId===s.me?'在舞台選一題開始作畫。':'等待 '+esc(nameOf(s.presenterId))+' 選題。'}</p>`;
 }else if(s.phase==='reveal'){
   actions=`<p>本輪已揭曉。</p>${s.host?'<button data-do="next">下一位畫者</button>':'<p>等待房主開始下一輪。</p>'}${s.result?.answer?'<button data-do="save">加入素材庫</button>':''}`;
  }else if(s.phase==='finished'){
   actions=`<p>本局完成。</p>${s.host?'<button data-do="start">再玩一局</button>':'<p>等待房主再開一局。</p>'}${s.result?.answer?'<button data-do="save">加入素材庫</button>':''}`;
 }
 $('#stage').innerHTML=html;$('#stage').hidden=!html;if(settingsOpen&&s.phase==='waiting'&&s.host)$('#stage .stage-controls').open=true;window.GameUI?.decorateButton($('#stage .room-settings-save'),'save');
 if(s.phase==='waiting'&&s.host){const details=$('#stage .stage-controls');window.UIPopover?.bindDetails(details,details.querySelector('.room-settings-body'),{align:'start',width:720});}
  GameShell.stableMarkup($('#drawActions'),actions);
 decorateActions();
 $('#canvasStage').innerHTML=s.phase==='drawing'?'':stageScene(s);
 $('#canvasStage').hidden=s.phase==='drawing';
 $('#boardSection').hidden=false;$('#boardSection').classList.toggle('is-drawing',s.phase==='drawing');
 $('.draw-roster').hidden=s.phase==='waiting';
 canvas.tabIndex=s.phase==='drawing'&&s.presenterId===s.me?0:-1;
 canvas.setAttribute('aria-hidden',s.phase==='drawing'?'false':'true');
 $('#tools').hidden=!(s.phase==='drawing'&&s.presenterId===s.me);
 $('#guessChat').hidden=!['drawing','reveal','finished'].includes(s.phase);
 $('#guessForm').hidden=!(s.phase==='drawing'&&s.participantIds.includes(s.me)&&!s.guessedIds.includes(s.me));
 $('#boardTitle').textContent=s.phase==='drawing'?(s.presenterId===s.me?s.question?.title||'本輪畫布':'猜猜畫者畫什麼？'):{waiting:'今晚的畫猜桌',choosing:'第 '+s.round+' 輪，'+nameOf(s.presenterId)+' 選題',reveal:'本輪答案與畫作',finished:'本局成績'}[s.phase];
 $('#boardHint').textContent=s.phase==='drawing'&&s.hint?'題材：'+s.hint.topicLabel+' · '+s.hint.category+' · '+s.hint.length+' 字':s.phase==='drawing'?'跟著畫布一起猜':s.phase==='reveal'?'答案與畫作已揭曉':s.phase==='waiting'?'題目類別：'+topicChoices.filter(([value])=>selectedTopics(s.options).includes(value)).map(([,label])=>label).join('、'):'';
 $('#timer').hidden=!s.deadline;
 updateStagePreview();
 updateFeed(live);
}
function updateFeed(live=false){
 if(!state)return;
 const feed=$('#guessFeed'),guesses=state.guesses||[],keys=guesses.map(item=>JSON.stringify(item));
 const appendOnly=keys.length>=feedEntries.length&&feedEntries.every((key,index)=>keys[index]===key);
 const hadState=feed.dataset.ready==='true';
 const stickToBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<36;
 if(!appendOnly){
  let retained=0;
  for(let count=Math.min(feedEntries.length,keys.length);count>0;count--){
   if(feedEntries.slice(-count).every((key,index)=>key===keys[index])){retained=count;break;}
  }
  if(retained){for(let index=0;index<feedEntries.length-retained;index++)feed.children[0]?.remove();feedEntries=feedEntries.slice(-retained);}
  else{feed.replaceChildren();feedEntries=[];}
 }
 if(!guesses.length){
  if(!feed.querySelector('.feed-empty')){const empty=document.createElement('p');empty.className='feed-empty';empty.textContent='還沒有猜測。第一個想法也可以送出！';feed.replaceChildren(empty);}
 }else{
  feed.querySelector('.feed-empty')?.remove();
  for(let index=feedEntries.length;index<guesses.length;index++){
   const item=guesses[index],line=document.createElement('p');
   line.className=item.correct?'correct':'wrong';
   line.textContent=item.correct?`${item.name} 猜對了！ +${item.points} 分`:`${item.name}：${item.answer}`;
   feed.append(line);
   if(live&&hadState&&index===guesses.length-1&&motionAllowed())line.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
 }
 feedEntries=keys;feed.dataset.ready='true';
 if(stickToBottom)feed.scrollTop=feed.scrollHeight;
}
function motionAllowed(){return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
function updateStagePreview(){
 if(state?.phase!=='reveal')return;
 const preview=$('#stagePreview');if(!preview?.getContext)return;
 const context=preview.getContext('2d');context?.drawImage(canvas,0,0,512,256);
}
function animatePhase(from,to){
 if(!from||from===to||!motionAllowed())return;
 const scene=$('#canvasStage .stage-scene');
 scene?.animate([{opacity:.4,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,easing:'cubic-bezier(.2,.75,.25,1)'});
 if(to==='choosing')$('#canvasStage').querySelectorAll('.stage-pick, .stage-pick-back').forEach((item,index)=>item.animate([{opacity:0,transform:'translateY(15px) rotate(-3deg)'},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:300,delay:index*70,easing:'ease-out'}));
 if(to==='drawing')$('.canvas-frame').animate([{boxShadow:'inset 0 0 0 8px #e7ad63'},{boxShadow:'inset 0 0 0 0 #e7ad6300'}],{duration:450,easing:'ease-out'});
 if(to==='reveal'){
  $('#canvasStage .stage-answer')?.animate([{opacity:0,transform:'translateY(12px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:450,easing:'cubic-bezier(.2,.75,.25,1)'});
  $('#canvasStage .stage-art')?.animate([{opacity:0,transform:'translateX(20px) rotate(8deg)'},{opacity:1,transform:'translateX(0) rotate(2deg)'}],{duration:470,easing:'ease-out'});
 }
 if(to==='finished')$('#canvasStage').querySelectorAll('.stage-winner').forEach((item,index)=>item.animate([{opacity:0,transform:'translateY(18px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:380,delay:index*90,easing:'ease-out'}));
}
function showCorrectFeedback(previous,next,live){
 if(!live||!motionAllowed()||previous?.round!==next.round||previous.phase!=='drawing'||!['drawing','reveal'].includes(next.phase))return;
 const oldCorrect=new Set((previous.guesses||[]).filter(item=>item.correct).map(item=>item.id));
 for(const guess of (next.guesses||[]).filter(item=>item.correct&&!oldCorrect.has(item.id)&&next.serverNow-item.at>=0&&next.serverNow-item.at<5000).slice(-3)){
  const row=[...$('#players').querySelectorAll('.player')].find(item=>item.dataset.playerId===guess.id);
  if(!row)continue;
  row.classList.add('just-correct');
  const badge=document.createElement('span');badge.className='correct-pop';badge.textContent='✓ +'+guess.points+' 分';row.append(badge);
  badge.animate([{opacity:0,transform:'translateY(8px) scale(.8)'},{opacity:1,transform:'translateY(0) scale(1)'},{opacity:1,transform:'translateY(-2px)'},{opacity:0,transform:'translateY(-12px)'}],{duration:1700,easing:'ease-out'});
  setTimeout(()=>{badge.remove();row.classList.remove('just-correct');},1700);
 }
}
function receive(next){
 if(!next||next.type!=='draw')throw Error('這不是你畫我猜房間');
 const previous=state,oldRound=state?.round,oldPhase=state?.phase;
 const live=!!previous&&!disconnected&&Date.now()-lastReceivedAt<5000&&document.visibilityState!=='hidden';
 state=next;lastReceivedAt=Date.now();disconnected=false;RoomHost.update(next,receive);
 clockOffset=Date.now()-next.serverNow;
 $('#roomTag').textContent='房間 '+code;$('#invite').hidden=false;
 $('#roundTag').textContent=next.phase==='waiting'?'朋友到齊就開畫':'第 '+next.round+' / '+next.roundLimit+' 輪';
 $('#phaseTag').textContent={waiting:'等待玩家',choosing:'畫者選題',drawing:'畫圖與猜題',reveal:'答案揭曉',finished:'本局結束'}[next.phase];
 $('#count').textContent=next.players.length+' / 8';
 GameShell.stableMarkup($('#players'),next.players.map(playerRow).join(''));
 const key=JSON.stringify([next.phase,next.round,next.options,next.host,next.phase==='waiting'?null:next.players.map(player=>player.id),next.candidates,next.question,next.guessedIds.includes(next.me),next.result,next.winner]);
 const changed=key!==signature;
 if(changed){signature=key;render(live);if(live)animatePhase(oldPhase,next.phase);}
 else updateFeed(live);
 if(next.phase==='waiting'){
  if(!changed&&previous?.players.length!==next.players.length){GameShell.stableMarkup($('#drawActions'),waitingActions(next));decorateActions();}
  const waitingPlayers=$('#waitingPlayers');if(waitingPlayers)GameShell.stableMarkup(waitingPlayers,next.players.map(waitingPlayerRow).join(''));
  const waitingCount=$('#waitingCount');if(waitingCount)waitingCount.textContent=next.players.length+' / 8 位';
 }
 showCorrectFeedback(previous,next,live);
 if(oldRound!==next.round){strokes=[];localStrokes.clear();active=null;pending=[];canvasQuota={usedFills:0,usedBatches:0,usedPoints:0};canvasTotals={points:0,fills:0};canvasRound=next.round;canvasVersion=-1;canvasRenderer.reset();updateFillAvailability();updateStagePreview();}
 if(next.strokeVersion>canvasVersion||canvasRound!==next.round)syncCanvas();
 connectEvents();tick();
}
function tick(){
 const label=$('#timer');if(!state?.deadline){label.textContent='–';label.classList.remove('urgent');lastTimerSeconds=null;return;}
 const seconds=Math.max(0,Math.ceil((state.deadline-(Date.now()-clockOffset))/1000));
 label.textContent=seconds+' 秒';label.classList.toggle('urgent',state.phase==='drawing'&&seconds<=10);
 if(state.phase==='drawing'&&lastTimerRound===state.round&&lastTimerSeconds>10&&seconds<=10&&motionAllowed()&&document.visibilityState!=='hidden'){
  $('.canvas-frame').animate([{borderColor:'#a6b8a5'},{borderColor:'#b34b50'},{borderColor:'#a6b8a5'}],{duration:530,easing:'ease-out'});
 }
 lastTimerRound=state.round;lastTimerSeconds=seconds;
}
function redrawCanvas(){
 const visible=[],keys=[],placed=new Set();let mutableFrom=Infinity;
 const key=stroke=>['fill','rect','ellipse','line'].includes(stroke.tool)?JSON.stringify([stroke.strokeId,stroke.tool,stroke.color,stroke.size,!!stroke.filled,stroke.points]):'server:'+stroke.version+':'+stroke.strokeId;
 function placeDraft(draft){
  if(placed.has(draft.strokeId))return;placed.add(draft.strokeId);
  if(draft.hiddenByReset)return;
  mutableFrom=Math.min(mutableFrom,visible.length);visible.push(draft);
  keys.push(['fill','rect','ellipse','line'].includes(draft.tool)?key(draft):'local:'+draft.strokeId+':'+draft.revision);
 }
 for(const stroke of strokes){const draft=localStrokes.get(stroke.strokeId);if(draft)placeDraft(draft);else{visible.push(stroke);keys.push(key(stroke));}}
 for(const draft of localStrokes.values())placeDraft(draft);
 if(canvasRenderer.render(visible,{keys,mutableFrom}))updateStagePreview();
}
function settleLocalStrokes(){
 let changed=false;
 for(const [id,draft] of localStrokes){
  if(draft.finished&&draft.pendingBatches===0&&(draft.failed||canvasVersion>=draft.ackVersion)){
   localStrokes.delete(id);changed=true;
  }
 }
 if(changed)redrawCanvas();
}
function syncCanvas(){
 if(!session)return Promise.resolve();
 if(syncPromise)return syncPromise;
 syncPromise=(async()=>{
  const requestedRound=state?.round;
  try{
   const snapshot=await api('draw/canvas');if(!state||snapshot.round!==state.round||requestedRound!==state.round)return;
   applyCanvasSnapshot(snapshot);
  }catch(error){$('#connection').textContent='畫布同步中：'+error.message;}
  finally{syncPromise=null;if(state&&requestedRound!==state.round)syncCanvas();}
 })();
 return syncPromise;
}
function validCanvasSnapshot(snapshot){
 if(!Number.isSafeInteger(snapshot?.round)||!Number.isSafeInteger(snapshot.version)||snapshot.version<0||!Array.isArray(snapshot.strokes)||snapshot.strokes.length>1000)return false;
 let points=0,fills=0,previous=0;
 for(const stroke of snapshot.strokes){
  if(!validCanvasStroke(stroke,previous,snapshot.version))return false;
  previous=stroke.version;points+=stroke.points.length;if(stroke.tool==='fill')fills++;
 }
 return points<=30000&&fills<=48;
}
function validCanvasStroke(stroke,previous,version){
 if(!Number.isSafeInteger(stroke?.version)||stroke.version<=previous||stroke.version>version||typeof stroke.strokeId!=='string'||!/^[a-f0-9-]{8,36}$/i.test(stroke.strokeId)||!['brush','erase','line','rect','ellipse','fill'].includes(stroke.tool)||!/^#[a-f0-9]{6}$/i.test(stroke.color)||!Number.isInteger(stroke.size)||stroke.size<1||stroke.size>40||!Array.isArray(stroke.points)||stroke.points.length<1||stroke.points.length>64)return false;
 if(stroke.points.some(point=>!Array.isArray(point)||point.length!==2||!Number.isInteger(point[0])||point[0]<0||point[0]>511||!Number.isInteger(point[1])||point[1]<0||point[1]>255))return false;
 return !(stroke.tool==='fill'?stroke.points.length!==1:!['brush','erase'].includes(stroke.tool)&&stroke.points.length!==2);
}
function updateFillAvailability(){
 const button=$('#tools [data-tool="fill"]');if(!button)return;
 button.disabled=canvasQuota.usedFills>=48;
 button.title=button.disabled?'本輪填色額度已用完，可用畫筆或形狀繼續':'填滿連續區域';
}
function updateCanvasQuota(snapshot){
 const quota=snapshot.quota;
 const fills=quota?.usedFills??strokes.filter(stroke=>stroke.tool==='fill').length,batches=quota?.usedBatches??strokes.length,points=quota?.usedPoints??strokes.reduce((sum,stroke)=>sum+stroke.points.length,0);
 if(Number.isInteger(fills)&&fills>=0&&fills<=48)canvasQuota.usedFills=Math.max(canvasQuota.usedFills,fills);
 if(Number.isInteger(batches)&&batches>=0&&batches<=1000)canvasQuota.usedBatches=Math.max(canvasQuota.usedBatches,batches);
 if(Number.isInteger(points)&&points>=0&&points<=30000)canvasQuota.usedPoints=Math.max(canvasQuota.usedPoints,points);
 updateFillAvailability();
}
function applyCanvasSnapshot(snapshot,reset=false){
 if(snapshot.round!==state?.round||snapshot.version<canvasVersion)return false;
 if(!validCanvasSnapshot(snapshot))throw Error('畫布資料超過同步上限');
 strokes=snapshot.strokes;canvasVersion=snapshot.version;canvasRound=snapshot.round;
 canvasTotals={points:strokes.reduce((sum,stroke)=>sum+stroke.points.length,0),fills:strokes.filter(stroke=>stroke.tool==='fill').length};
 updateCanvasQuota(snapshot);
 if(reset){
  for(const [id,draft] of localStrokes){
   if(draft.pendingBatches>0){draft.finished=true;draft.resetVersion=Math.max(draft.resetVersion||0,snapshot.version);draft.hiddenByReset=!strokes.some(stroke=>stroke.strokeId===id);}
   else localStrokes.delete(id);
  }
  active=null;pending=[];
 }
 settleLocalStrokes();redrawCanvas();return true;
}
function receiveCanvasStroke(data){
 if(data.round!==state?.round)return;
 if(data.quota)updateCanvasQuota(data);
 if(data.version<=canvasVersion)return;
 if(data.version!==canvasVersion+1){syncCanvas();return;}
 if(data.stroke?.version!==data.version||!validCanvasStroke(data.stroke,canvasVersion,data.version)||strokes.length>=1000||canvasTotals.points+data.stroke.points.length>30000||canvasTotals.fills+(data.stroke.tool==='fill'?1:0)>48){syncCanvas();return;}
 // Existing entries were validated when accepted; an event validates only its new batch.
 strokes.push(data.stroke);canvasVersion=data.version;canvasTotals.points+=data.stroke.points.length;if(data.stroke.tool==='fill')canvasTotals.fills++;
 updateCanvasQuota(data);
 settleLocalStrokes();redrawCanvas();
}
function connectEvents(){
 if(stream||!session||!window.EventSource)return;
 stream=new EventSource('/api/draw/events?code='+encodeURIComponent(code));
 stream.addEventListener('stroke',event=>{try{receiveCanvasStroke(JSON.parse(event.data));}catch{syncCanvas();}});
 stream.addEventListener('reset',event=>{try{const data=JSON.parse(event.data);if(data.version>canvasVersion)applyCanvasSnapshot(data,true);}catch{syncCanvas();}});
 stream.addEventListener('ready',()=>{if(state?.strokeVersion!==canvasVersion)syncCanvas();});
}
function drawFeedback(message,kind='info',settings=false){const node=$(settings?'#roomSettingsFeedback':'#drawStatus')||$('#drawStatus');node.textContent=message;node.dataset.kind=kind;window.GameUI?.setStatus(node,message,{kind});}
let pendingDrawButton=null;
function drawBusy(value){$('#drawActionSlot').setAttribute('aria-busy',String(value));if(value){pendingDrawButton=document.activeElement?.closest?.('button');if(pendingDrawButton)window.GameUI?.setBusy(pendingDrawButton,true);}else{if(pendingDrawButton)window.GameUI?.setBusy(pendingDrawButton,false);pendingDrawButton=null;}}
async function action(name,data={}){if(busy)return false;busy=true;drawBusy(true);drawFeedback('正在送出…');try{receive(await api('action',{action:name,...data}));$('#connection').textContent='';drawFeedback(name==='guess'?'猜測已送出。':'操作已完成。','success');return true;}catch(error){drawFeedback(error.message,'error');toast(error.message);return false;}finally{busy=false;drawBusy(false);}}
async function roomAction(route,data={}){if(busy)return;const settings=route==='settings',restoreFocus=settings&&document.activeElement?.closest?.('.room-settings-save');busy=true;drawBusy(true);drawFeedback('正在送出…','info',settings);try{receive(await api(route,data));$('#connection').textContent='';drawFeedback(settings?'房間設定已儲存。':'操作已完成。','success',settings);}catch(error){drawFeedback(error.message,'error',settings);toast(error.message);}finally{busy=false;drawBusy(false);if(restoreFocus)$('#stage .room-settings-save')?.focus({preventScroll:true});}}
async function invite(){const url=inviteBase+'/draw/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製邀請連結',url);}}
async function saveArtwork(){
 if(busy)return;busy=true;drawBusy(true);drawFeedback('正在儲存畫作…');
 try{
  await syncCanvas();
  const base64=canvas.toDataURL('image/png').split(',')[1],name='你畫我猜：'+(state.result?.answer||state.question?.title||'我的畫');
  const response=await fetch('/api/artworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,base64,mime:'image/png'})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'儲存失敗');
  toast('已存入我的繪畫圖庫');
  drawFeedback('已加入素材庫。','success');
 }catch(error){drawFeedback(error.message,'error');toast(error.message);}finally{busy=false;drawBusy(false);}
}
function stageClick(event){
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.selectTopics){for(const input of button.closest('fieldset').querySelectorAll('input[name="topics"]'))input.checked=button.dataset.selectTopics==='all';return;}
 if(button.dataset.word)return action('choose',{questionId:button.dataset.word});
 switch(button.dataset.do){
  case 'start':return roomAction('start');case 'next':return action('next');
   case 'settings':try{return roomAction('settings',{seconds:Number($('#stage input[name="seconds"]:checked')?.value),topics:readTopics()});}catch(error){drawFeedback(error.message,'error',true);toast(error.message);return;}
  case 'save':return saveArtwork();case 'invite':return invite();
 }
}
$('#stage').addEventListener('click',stageClick);
$('#drawActions').addEventListener('click',stageClick);
$('#canvasStage').addEventListener('click',stageClick);
$('#stage').addEventListener('submit',async event=>{
 if(event.target.id!=='enterForm')return;event.preventDefault();if(busy)return;busy=true;
  try{const result=await api(code?'join':'create',{type:'draw',code,...(!code?{topics:readTopics()}:{})});if(result.type!=='draw')throw Error('這是其他遊戲房間');save(result);receive(await api('state'));$('#connection').textContent='';}
 catch(error){toast(error.message);}finally{busy=false;}
});
$('#guessForm').addEventListener('submit',async event=>{event.preventDefault();const input=$('#guessInput'),answer=input.value.trim();if(!answer)return;const accepted=await action('guess',{answer});if(accepted&&input.value.trim()===answer)input.value='';input.focus();});
$('#invite').onclick=invite;$('#help').onclick=()=>window.GameUI?.openDialog?GameUI.openDialog($('#rules'),$('#help')):$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();
window.GameUI?.decorateButton($('#guessForm button'),'send',{iconOnly:true,label:'送出猜測'});
window.GameUI?.decorateButton($('#help'),'help',{iconOnly:true,label:'遊戲說明'});
window.GameUI?.decorateButton($('#closeHelp'),'close',{iconOnly:true,label:'關閉說明'});

for(const button of $('#tools').querySelectorAll('[data-tool],#undo,#clear')){const key=button.dataset.tool?button.dataset.tool+(button.dataset.filled==='true'?'Filled':''):button.id;button.innerHTML=StrokeCanvas.iconMarkup(key);if(button.dataset.tool)button.setAttribute('aria-pressed',String(button.classList.contains('selected')));}
const swatches=$('#swatches');for(const color of colors){const button=document.createElement('button');button.type='button';button.style.background=color;button.title='選擇 '+color;button.setAttribute('aria-label','選擇 '+color);button.onclick=()=>{$('#color').value=color;$('#colorMenu').open=false;$('#colorMenu').querySelector('summary')?.focus();};swatches.append(button);}
window.GameUI?.bindPopover?.($('#colorMenu'),swatches,{align:'start'});
$('#colorMenu').addEventListener('keydown',event=>{if(event.key==='Escape'){$('#colorMenu').open=false;$('#colorMenu').querySelector('summary')?.focus();event.preventDefault();}});
$('#size').oninput=event=>$('#sizeValue').textContent=event.target.value;
$('#tools').addEventListener('click',event=>{const button=event.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;filled=button.dataset.filled==='true';for(const item of $('#tools').querySelectorAll('[data-tool]')){item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));}});
async function command(name){
 if(active){toast('請先完成這一筆');return;}
 if(canvasCommandBusy)return;
 canvasCommandBusy=true;canvas.setAttribute('aria-busy','true');canvas.classList.add('canvas-busy');
 const round=state.round;
 try{
  await sendQueue;await syncCanvas();
  if(state?.round!==round)throw Error('這輪已結束，請依目前畫布操作');
  const snapshot=await api('draw/command',{round,command:name});
  applyCanvasSnapshot(snapshot,true);
 }catch(error){drawFeedback(error.message,'error');toast(error.message);}
 finally{canvasCommandBusy=false;canvas.setAttribute('aria-busy','false');canvas.classList.remove('canvas-busy');}
}
$('#undo').onclick=()=>command('undo');$('#clear').onclick=()=>{if(confirm('清空這輪畫布？'))command('clear');};
function canDraw(){return !canvasCommandBusy&&state?.phase==='drawing'&&state.presenterId===state.me;}
function queueStroke(points,strokeId,mode=tool){
 if(canvasQuota.usedBatches>=1000||canvasQuota.usedPoints+points.length>30000){const draft=localStrokes.get(strokeId);if(draft)draft.failed=true;drawFeedback('本輪筆畫額度已用完，請等待下一輪。','error');return sendQueue;}
 if(mode==='fill'&&canvasQuota.usedFills>=48){drawFeedback('本輪填色額度已用完，可用畫筆或形狀繼續。','error');return sendQueue;}
 if(mode==='fill'&&[...localStrokes.values()].some(draft=>draft.tool==='fill'&&!draft.failed)){drawFeedback('填色正在同步，請稍候再填下一區。');return sendQueue;}
 let draft=localStrokes.get(strokeId);
 if(!draft){
  if(!localCanvasCapacity(points.length)){drawFeedback('畫布同步中的筆畫已達上限，請稍候。','error');return sendQueue;}
  draft={strokeId,tool:mode,color:$('#color').value,size:Number($('#size').value),filled,points:[...points],revision:1,finished:true,pendingBatches:0,ackVersion:0,failed:false};
  localStrokes.set(strokeId,draft);redrawCanvas();
 }
 draft.pendingBatches++;
 const data={round:state.round,batchId:StrokeCanvas.strokeId(),strokeId,tool:mode,color:draft.color,size:draft.size,filled:draft.filled,points};
 sendQueue=sendQueue.then(async()=>{
  const delay=Math.max(0,115-(Date.now()-lastSentAt),mode==='fill'?500-(Date.now()-lastFillSentAt):0);if(delay)await new Promise(resolve=>setTimeout(resolve,delay));lastSentAt=Date.now();if(mode==='fill')lastFillSentAt=lastSentAt;
  try{
   const result=await api('draw/stroke',data);
   if(localStrokes.get(strokeId)===draft){updateCanvasQuota(result);draft.ackVersion=Math.max(draft.ackVersion,result.version);if(draft.ackVersion>(draft.resetVersion||0))draft.hiddenByReset=false;if(result.stroke)receiveCanvasStroke(result);if(result.version>canvasVersion)syncCanvas();}
  }catch(error){if(localStrokes.get(strokeId)===draft){draft.failed=true;drawFeedback(error.message,'error');toast(error.message);syncCanvas();}}
  finally{if(localStrokes.get(strokeId)===draft){draft.pendingBatches--;settleLocalStrokes();}}
 }).catch(error=>{toast(error.message);});
 return sendQueue;
}
function localCanvasCapacity(extraPoints=0){
 let count=localStrokes.size,points=extraPoints;
 for(const stroke of strokes)if(!localStrokes.has(stroke.strokeId)){count++;points+=stroke.points.length;}
 for(const draft of localStrokes.values())points+=draft.points.length;
 return count<1016&&points<=31024;
}
function flush(final=false){
 if(!active||!['brush','erase'].includes(active.tool))return;
  if(pending.length>1||!active.sent){
   const points=[...pending];if(points.length){queueStroke(points,active.strokeId,active.tool);active.sent=true;pending=final?[]:[points.at(-1)];}
  }
 if(final)pending=[];
}
canvas.addEventListener('pointerdown',event=>{
 if(!canDraw()||active||event.button!==0)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);
 if(canvasQuota.usedBatches>=1000||canvasQuota.usedPoints>=30000||!localCanvasCapacity(1)){drawFeedback('本輪筆畫額度已用完或仍在同步，請稍候。','error');return;}
 const point=StrokeCanvas.pointFrom(event,canvas,512,256);cursor=point;
 if(tool==='fill'){queueStroke([point],StrokeCanvas.strokeId(),'fill');return;}
 active={strokeId:StrokeCanvas.strokeId(),pointerId:event.pointerId,tool,color:$('#color').value,size:Number($('#size').value),filled,points:[point],revision:1,sent:false,finished:false,pendingBatches:0,ackVersion:0,failed:false};
 localStrokes.set(active.strokeId,active);pending=[point];redrawCanvas();
});
canvas.addEventListener('pointermove',event=>{
 if(!active||event.pointerId!==active.pointerId)return;const point=StrokeCanvas.pointFrom(event,canvas,512,256),last=active.points.at(-1);
 if(point[0]===last[0]&&point[1]===last[1])return;
 if(active.points.length>=30000||!localCanvasCapacity(1)){drawFeedback('這一筆已達畫布上限，請放開後再操作。','error');return;}
 if(['brush','erase'].includes(active.tool))active.points.push(point);else active.points=[active.points[0],point];
 active.revision++;if(['brush','erase'].includes(active.tool))pending.push(point);else pending=[active.points[0],point];cursor=point;
 if(['brush','erase'].includes(active.tool)&&pending.length>=40)flush();
 redrawCanvas();
});
function finishPointer(event){
 if(!active||event.pointerId!==active.pointerId)return;event.preventDefault();
 if(['brush','erase'].includes(active.tool))flush(true);
 else queueStroke([active.points[0],active.points.at(-1)],active.strokeId,active.tool);
 active.finished=true;active=null;settleLocalStrokes();redrawCanvas();
}
canvas.addEventListener('pointerup',finishPointer);canvas.addEventListener('pointercancel',finishPointer);
canvas.addEventListener('keydown',event=>{
 if(!canDraw())return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(moves[event.key]){event.preventDefault();cursor=[Math.max(0,Math.min(511,cursor[0]+moves[event.key][0])),Math.max(0,Math.min(255,cursor[1]+moves[event.key][1]))];toast('畫布位置 '+(cursor[0]+1)+'，'+(cursor[1]+1)+'；按空白鍵落筆');}
 if(event.key===' '){event.preventDefault();queueStroke([cursor],StrokeCanvas.strokeId(),tool==='fill'?'fill':'brush');}
});
async function poll(){if(!session||busy||polling)return;polling=true;try{receive(await api('state'));$('#connection').textContent='';}catch(error){disconnected=true;$('#connection').textContent='連線暫停，正在重試：'+error.message;}finally{polling=false;}}
fetch('/api/info').then(response=>response.json()).then(info=>inviteBase=info.preferred||location.origin).catch(()=>{});
entry();if(session)poll();else if(code)RoomReconnect.restore(code,'draw','#connection').then(restored=>{if(restored){save(restored);poll();}});
setInterval(poll,1000);setInterval(tick,250);if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();
fetch('/api/auth/me').then(response=>response.json()).then(me=>{const identity=$('#identity');if(identity&&me.displayName)identity.textContent='以「'+me.displayName+'」入座';}).catch(()=>{});
