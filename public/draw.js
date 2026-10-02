'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const percentChoices=[['','依題庫比例'],['0','0%'],['25','25%'],['50','50%'],['75','75%'],['100','100%']];
const topicChoices=[['all','所有類別'],['food','食物飲料'],['animals','動物生物'],['transport','交通工具'],['objects','生活物品'],['people','人物職業'],['nature','自然奇幻'],['places','場所娛樂'],['activities','運動音樂']];
let code=(location.pathname.match(/\/draw\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'';
let session=null,state=null,busy=false,polling=false,signature='',stream=null,canvasVersion=-1,canvasRound=-1,strokes=[],syncPromise=null,clockOffset=0,inviteBase=location.origin;
let filled=false,tool='brush',active=null,pending=[],lastSentAt=0,sendQueue=Promise.resolve(),canvasCommandBusy=false,cursor=[256,128];
const localStrokes=new Map();
const canvas=$('#drawCanvas'),colors=['#273942','#ffffff','#e45757','#f3a844','#f4d264','#6bb879','#5197ca','#8058ad','#d979a7','#8b6348'];
let feedEntries=[],lastReceivedAt=0,lastTimerSeconds=null,lastTimerRound=-1,disconnected=false;
try{session=JSON.parse(localStorage.getItem(code?'ah-draw:'+code:'ah-draw')||'null');if(session&&!code)code=session.code;}catch{}

function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000);}
async function api(route,data){return RoomApi.request(route,data,{code,room:'draw',session,onKicked:()=>{RoomHost.kicked(session);session=null;stream?.close();}});}
function save(result){session=result;code=result.code;localStorage.setItem('ah-draw',JSON.stringify(result));localStorage.setItem('ah-draw:'+code,JSON.stringify(result));history.replaceState(null,'','/draw/'+code);}
function nameOf(id){return state?.players.find(player=>player.id===id)?.name||'朋友';}
function playerRow(player){return GameShell.playerRow(player,{me:state.me,status:(player.id===state.presenterId?'本輪畫者 · ':'')+(player.waitingForNextRound?'下輪加入 · ':'')+(player.online?'在線':'暫時離線')});}
function options(group,choices,current,inputName){return `<fieldset><legend>${group}</legend><div class="option-row">${choices.map(([value,label])=>`<label><input type="radio" name="${inputName}" value="${value}" ${String(current??'')===value?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset>`;}
function entry(){
 $('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">✎</div><span class="eyebrow">DRAW TOGETHER</span><h1>畫一筆，<br>讓朋友猜一猜。</h1><p id="identity">將以你的角色名稱入座</p><form id="enterForm">${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button wide">加入這一桌 →</button>`:`<div class="entry-topic">${options('這桌畫什麼？',topicChoices,'all','topic')}</div><button class="button wide">開一桌你畫我猜 →</button>`}</form></div>`;
}
function stageAvatar(player,extraClass=''){
 return player?.avatar?`<img class="stage-avatar ${extraClass}" src="${esc(player.avatar)}" alt="">`:`<span class="stage-avatar stage-avatar-fallback ${extraClass}" aria-hidden="true">✎</span>`;
}
function stageScene(s){
 const artist=s.players.find(player=>player.id===s.presenterId);
 if(s.phase==='waiting')return `<div class="stage-scene stage-waiting"><div class="stage-illustration" aria-hidden="true"><span class="stage-pencil">✎</span><span class="stage-spark">✦</span></div><div class="stage-copy"><span class="stage-ribbon">THE ART TABLE</span><h1>今晚輪流當畫家</h1><p>朋友入座後，由房主開始遊戲。</p><div class="stage-cast">${s.players.slice(0,5).map(player=>stageAvatar(player)).join('')}<span>${s.players.length} / 8 位朋友</span></div></div></div>`;
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
 const s=state;let html='';
 document.body.classList.toggle('drawing-active',s.phase==='drawing');
 if(s.phase==='waiting'){
  html=`<div class="card stage-controls"><p>房間代碼 <b>${esc(s.code)}</b>　<button class="quiet" data-do="invite">複製邀請連結 ↗</button></p>${s.host?`<div class="settings">${options('題目類別',topicChoices,s.options.topic||'all','topic')}${options('作畫時間',[['60','60 秒'],['90','90 秒'],['120','120 秒']],s.options.seconds,'seconds')}${options('玩家投稿比例',percentChoices,s.options.customPercent,'percent')}</div><button data-do="settings">儲存設定</button><button data-do="start" ${s.players.length<2?'disabled':''}>開始遊戲 →</button>`:`<p>本桌題目：${esc(topicChoices.find(([id])=>id===s.options.topic)?.[1]||'所有類別')}。等房主開始；你可以先到共編題庫看看題目。</p>`}</div>`;
 }else if(s.phase==='drawing'){
  const artist=s.presenterId===s.me,eligible=s.participantIds.includes(s.me),guessed=s.guessedIds.includes(s.me);
  if(!eligible&&!artist)html='<div class="card stage-controls"><p>你是中途加入的朋友，下一輪起可以猜題。</p></div>';
  else if(guessed)html='<div class="card stage-controls"><p>你已猜中！等其他朋友完成或時間到。</p></div>';
 }else if(s.phase==='reveal'){
  html=`<div class="card stage-controls"><p>本輪畫作與猜測紀錄可在上方回看。</p>${s.host?'<button data-do="next">下一位畫者 →</button>':''}${s.result?.answer?'<button data-do="save">加入我的素材庫</button>':''}</div>`;
 }else{
  html=`<div class="card stage-controls"><p>本局完成，名次與分數已列在上方。</p>${s.host?'<button data-do="start">再玩一局 ↻</button>':''}${s.result?.answer?'<button data-do="save">加入我的素材庫</button>':''}</div>`;
 }
 $('#stage').innerHTML=html;$('#stage').hidden=!html;
 $('#canvasStage').innerHTML=s.phase==='drawing'?'':stageScene(s);
 $('#canvasStage').hidden=s.phase==='drawing';
 $('#boardSection').hidden=false;$('#boardSection').classList.toggle('is-drawing',s.phase==='drawing');
 canvas.tabIndex=s.phase==='drawing'&&s.presenterId===s.me?0:-1;
 canvas.setAttribute('aria-hidden',s.phase==='drawing'?'false':'true');
 $('#tools').hidden=!(s.phase==='drawing'&&s.presenterId===s.me);
 $('#guessChat').hidden=!['drawing','reveal','finished'].includes(s.phase);
 $('#guessForm').hidden=!(s.phase==='drawing'&&s.participantIds.includes(s.me)&&!s.guessedIds.includes(s.me));
 $('#boardTitle').textContent=s.phase==='drawing'?(s.presenterId===s.me?s.question?.title||'本輪畫布':'猜猜畫者畫什麼？'):{waiting:'今晚的畫猜桌',choosing:'第 '+s.round+' 輪，'+nameOf(s.presenterId)+' 選題',reveal:'本輪答案與畫作',finished:'本局成績'}[s.phase];
 $('#boardHint').textContent=s.phase==='drawing'&&s.hint?'題材：'+s.hint.topicLabel+' · '+s.hint.category+' · '+s.hint.length+' 字':s.phase==='drawing'?'跟著畫布一起猜':s.phase==='reveal'?'答案與畫作已揭曉':'';
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
 const key=JSON.stringify([next.phase,next.round,next.options,next.players.map(player=>player.id),next.candidates,next.question,next.guessedIds.includes(next.me),next.result,next.winner]);
 if(key!==signature){signature=key;render(live);if(live)animatePhase(oldPhase,next.phase);}
 else updateFeed(live);
 showCorrectFeedback(previous,next,live);
 if(oldRound!==next.round){strokes=[];localStrokes.clear();active=null;pending=[];canvasRound=next.round;canvasVersion=-1;redrawCanvas();}
 if(next.strokeVersion!==canvasVersion||canvasRound!==next.round)syncCanvas();
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
 const confirmed=strokes.filter(stroke=>!localStrokes.has(stroke.strokeId));
 StrokeCanvas.redraw(canvas,[...confirmed,...localStrokes.values()]);
 updateStagePreview();
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
  try{
   const snapshot=await api('draw/canvas');if(!state||snapshot.round!==state.round)return;
   if(snapshot.version>=canvasVersion){strokes=snapshot.strokes;canvasVersion=snapshot.version;canvasRound=snapshot.round;settleLocalStrokes();redrawCanvas();}
  }catch(error){$('#connection').textContent='畫布同步中：'+error.message;}
  finally{syncPromise=null;}
 })();
 return syncPromise;
}
function connectEvents(){
 if(stream||!session||!window.EventSource)return;
 stream=new EventSource('/api/draw/events?code='+encodeURIComponent(code));
 stream.addEventListener('stroke',event=>{try{const data=JSON.parse(event.data);if(data.round!==state?.round)return;if(data.version===canvasVersion+1){strokes.push(data.stroke);canvasVersion=data.version;settleLocalStrokes();redrawCanvas();}else if(data.version>canvasVersion)syncCanvas();}catch{syncCanvas();}});
 stream.addEventListener('reset',event=>{try{const data=JSON.parse(event.data);if(data.round===state?.round&&data.version>=canvasVersion){strokes=data.strokes;canvasVersion=data.version;localStrokes.clear();active=null;pending=[];redrawCanvas();}}catch{syncCanvas();}});
 stream.addEventListener('ready',()=>{if(state?.strokeVersion!==canvasVersion)syncCanvas();});
}
async function action(name,data={}){if(busy)return false;busy=true;try{receive(await api('action',{action:name,...data}));$('#connection').textContent='';return true;}catch(error){toast(error.message);return false;}finally{busy=false;}}
async function roomAction(route,data={}){if(busy)return;busy=true;try{receive(await api(route,data));$('#connection').textContent='';}catch(error){toast(error.message);}finally{busy=false;}}
async function invite(){const url=inviteBase+'/draw/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製邀請連結',url);}}
async function saveArtwork(){
 try{
  await syncCanvas();
  const base64=canvas.toDataURL('image/png').split(',')[1],name='你畫我猜：'+(state.result?.answer||state.question?.title||'我的畫');
  const response=await fetch('/api/artworks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,base64,mime:'image/png'})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'儲存失敗');
  toast('已存入我的繪畫圖庫');
 }catch(error){toast(error.message);}
}
function stageClick(event){
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.word)return action('choose',{questionId:button.dataset.word});
 switch(button.dataset.do){
  case 'start':return roomAction('start');case 'next':return action('next');
   case 'settings':return roomAction('settings',{seconds:Number($('#stage input[name="seconds"]:checked')?.value),customPercent:$('#stage input[name="percent"]:checked')?.value===''?null:Number($('#stage input[name="percent"]:checked')?.value),topic:$('#stage input[name="topic"]:checked')?.value||'all'});
  case 'save':return saveArtwork();case 'invite':return invite();
 }
}
$('#stage').addEventListener('click',stageClick);
$('#canvasStage').addEventListener('click',stageClick);
$('#stage').addEventListener('submit',async event=>{
 if(event.target.id!=='enterForm')return;event.preventDefault();if(busy)return;busy=true;
  try{const result=await api(code?'join':'create',{type:'draw',code,...(!code?{topic:$('#stage input[name="topic"]:checked')?.value||'all'}:{})});if(result.type!=='draw')throw Error('這是其他遊戲房間');save(result);receive(await api('state'));$('#connection').textContent='';}
 catch(error){toast(error.message);}finally{busy=false;}
});
$('#guessForm').addEventListener('submit',async event=>{event.preventDefault();const input=$('#guessInput'),answer=input.value.trim();if(!answer)return;const accepted=await action('guess',{answer});if(accepted&&input.value.trim()===answer)input.value='';input.focus();});
$('#invite').onclick=invite;$('#help').onclick=()=>$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();

for(const button of $('#tools').querySelectorAll('[data-tool],#undo,#clear')){const key=button.dataset.tool?button.dataset.tool+(button.dataset.filled==='true'?'Filled':''):button.id;button.innerHTML=StrokeCanvas.iconMarkup(key);}
const swatches=$('#swatches');for(const color of colors){const button=document.createElement('button');button.type='button';button.style.background=color;button.title='選擇 '+color;button.setAttribute('aria-label','選擇 '+color);button.onclick=()=>$('#color').value=color;swatches.append(button);}
$('#size').oninput=event=>$('#sizeValue').textContent=event.target.value;
$('#tools').addEventListener('click',event=>{const button=event.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;filled=button.dataset.filled==='true';for(const item of $('#tools').querySelectorAll('[data-tool]'))item.classList.toggle('selected',item===button);});
async function command(name){
 if(active){toast('請先完成這一筆');return;}
 if(canvasCommandBusy)return;
 canvasCommandBusy=true;canvas.setAttribute('aria-busy','true');canvas.classList.add('canvas-busy');
 try{
  await sendQueue;await syncCanvas();
  const snapshot=await api('draw/command',{round:state.round,command:name});
  strokes=snapshot.strokes;canvasVersion=snapshot.version;localStrokes.clear();redrawCanvas();
 }catch(error){toast(error.message);}
 finally{canvasCommandBusy=false;canvas.setAttribute('aria-busy','false');canvas.classList.remove('canvas-busy');}
}
$('#undo').onclick=()=>command('undo');$('#clear').onclick=()=>{if(confirm('清空這輪畫布？'))command('clear');};
function canDraw(){return !canvasCommandBusy&&state?.phase==='drawing'&&state.presenterId===state.me;}
function queueStroke(points,strokeId,mode=tool){
 let draft=localStrokes.get(strokeId);
 if(!draft){
  draft={strokeId,tool:mode,color:$('#color').value,size:Number($('#size').value),filled,points:[...points],finished:true,pendingBatches:0,ackVersion:0,failed:false};
  localStrokes.set(strokeId,draft);redrawCanvas();
 }
 draft.pendingBatches++;
 const data={round:state.round,batchId:StrokeCanvas.strokeId(),strokeId,tool:mode,color:draft.color,size:draft.size,filled:draft.filled,points};
 sendQueue=sendQueue.then(async()=>{
  const delay=Math.max(0,115-(Date.now()-lastSentAt));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));lastSentAt=Date.now();
  try{
   const result=await api('draw/stroke',data);
   if(localStrokes.get(strokeId)===draft){draft.ackVersion=Math.max(draft.ackVersion,result.version);if(result.version>canvasVersion)syncCanvas();}
  }catch(error){if(localStrokes.get(strokeId)===draft){draft.failed=true;toast(error.message);syncCanvas();}}
  finally{if(localStrokes.get(strokeId)===draft){draft.pendingBatches--;settleLocalStrokes();}}
 }).catch(error=>{toast(error.message);});
 return sendQueue;
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
 const point=StrokeCanvas.pointFrom(event,canvas,512,256);cursor=point;
 if(tool==='fill'){queueStroke([point],StrokeCanvas.strokeId(),'fill');return;}
 active={strokeId:StrokeCanvas.strokeId(),pointerId:event.pointerId,tool,color:$('#color').value,size:Number($('#size').value),filled,points:[point],sent:false,finished:false,pendingBatches:0,ackVersion:0,failed:false};
 localStrokes.set(active.strokeId,active);pending=[point];redrawCanvas();
});
canvas.addEventListener('pointermove',event=>{
 if(!active||event.pointerId!==active.pointerId)return;const point=StrokeCanvas.pointFrom(event,canvas,512,256),last=active.points.at(-1);
 if(point[0]===last[0]&&point[1]===last[1])return;
 active.points.push(point);pending.push(point);cursor=point;
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
entry();StrokeCanvas.redraw(canvas,[]);if(session)poll();else if(code)RoomReconnect.restore(code,'draw','#connection').then(restored=>{if(restored){save(restored);poll();}});
setInterval(poll,1000);setInterval(tick,250);if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();
fetch('/api/auth/me').then(response=>response.json()).then(me=>{const identity=$('#identity');if(identity&&me.displayName)identity.textContent='以「'+me.displayName+'」入座';}).catch(()=>{});
