'use strict';
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const topicChoices=[['food','食物飲料'],['animals','動物生物'],['transport','交通工具'],['objects','生活物品'],['people','人物職業'],['nature','自然奇幻'],['places','場所娛樂'],['activities','運動音樂'],['meme','迷因 Meme'],['custom','自定義']];
let code=(location.pathname.match(/\/draw\/([a-f0-9]{6})/i)||[])[1]?.toUpperCase()||'';
let session=null,state=null,busy=false,signature='',clockOffset=0,inviteBase=location.origin;
const roomActions=window.RoomControls.bindActions({type:'draw',read:()=>({host:state?.phase==='finished'?document.querySelector('.tpl-result-actions'):null,setup:['waiting','finished'].includes(state?.phase),start:{step:'start',label:state?.phase==='finished'?'再玩一局':'開始遊戲',enabled:!busy&&!!state&&state.players.filter(p=>!p.kicked).length>=2},bot:{enabled:!busy&&!!state&&state.players.length<8&&state.botSupport?.canAdd!==false}}),run:action=>roomAction(action)});
let filled=false,tool='brush',active=null,pending=[],cursor=[256,128];
let strokeFlushTimer=null,pendingTimes=[];
const drawNow=()=>typeof performance==='object'&&typeof performance.now==='function'?performance.now():Date.now();
const canvas=$('#drawCanvas'),colors=document.body.dataset.uiTemplate?['#1b1c1c','#ffffff','#6b7280','#ba1a1a','#f97316','#f8c838','#16a34a','#0284c7','#4338ca','#7e22ce','#735947','#fedbc4']:['#273942','#ffffff','#e45757','#f3a844','#f4d264','#6bb879','#5197ca','#8058ad','#d979a7','#8b6348'];
const countdownBar=window.CountdownBar.create($('#timerFill'),{reducedMotion:()=>window.matchMedia('(prefers-reduced-motion:reduce)').matches});
const canvasSession=window.DrawCanvasSession.create({canvas,request:api,syncCanvas:()=>drawingController.syncCanvas(),cancelInput:cancelStrokeInput,cancelNetwork:options=>drawingController.cancel(options),now:drawNow,
 feedback:(message,kind,options)=>{if(!options?.onlyRecovering||$('#drawStatus').textContent==='正在回復畫布，仍可猜題與查看玩家。')drawFeedback(message,kind);},notify:toast,onRendered:updateStagePreview,onBusy:updateCanvasBusy,onQuota:updateFillAvailability});
const validCanvasSnapshot=window.DrawCanvasSession.validSnapshot;
// Measure the remaining grid row instead of subtracting a fixed header height.
function fitDrawingWidth({width,height,overhead,chatHeight,gap,toolHeight=0}){
 const available=height-overhead-chatHeight-gap;
 if(available<toolHeight||available<120||width<240)return null;
 return Math.min(width,2*available);
}
let drawingFitFrame=null;
function fitDrawingViewport(){
 drawingFitFrame=null;
 const board=$('#boardSection'),main=board.parentElement,frame=board.querySelector('.canvas-frame');
 if(document.body.classList.contains('ui-drawing-play-mode')||!frame||!window.matchMedia('(min-width:1200px) and (min-height:680px)').matches||document.body.classList.contains('ui-large-text')||!board.classList.contains('is-drawing')){board.style.removeProperty('--draw-canvas-width');if(document.body.classList.contains('draw-viewport-overflow'))document.body.classList.remove('draw-viewport-overflow');return;}
 const css=getComputedStyle(board),mainCss=getComputedStyle(main),chatCss=getComputedStyle($('#drawGuessPanel'));
 const number=value=>parseFloat(value)||0,tools=$('#tools'),toolHeight=tools.hidden?0:tools.getBoundingClientRect().height;
 const overhead=board.getBoundingClientRect().height-Math.max(frame.getBoundingClientRect().height,toolHeight);
 const width=main.clientWidth-number(css.paddingLeft)-number(css.paddingRight)-number(css.borderLeftWidth)-number(css.borderRightWidth)-(tools.hidden?0:tools.getBoundingClientRect().width+number(css.columnGap));
 // This budget stays stable even when an oversized board returns to natural flow.
 const height=window.innerHeight-(main.getBoundingClientRect().top+window.scrollY)-number(getComputedStyle($('.draw-shell')).paddingBottom);
 const gap=number(mainCss.rowGap),chatHeight=Math.max(number(chatCss.minHeight),Math.min(260,height*.25,height-overhead-gap-toolHeight));
 const fitted=fitDrawingWidth({width,height,overhead,chatHeight,gap,toolHeight});
 document.body.classList.toggle('draw-viewport-overflow',fitted===null);
 if(fitted===null){board.style.removeProperty('--draw-canvas-width');return;}
 const value=Math.floor(fitted)+'px';if(board.style.getPropertyValue('--draw-canvas-width')!==value)board.style.setProperty('--draw-canvas-width',value);
}
function scheduleDrawingFit(){if(drawingFitFrame===null)drawingFitFrame=requestAnimationFrame(fitDrawingViewport);}
if(typeof ResizeObserver==='function'){
 const observer=new ResizeObserver(scheduleDrawingFit);
 for(const node of [$('.draw-shell'),$('.draw-layout'),$('#boardSection').parentElement,$('.board-head'),$('#drawCountdown'),$('#tools'),$('#drawGuessPanel')])observer.observe(node);
 window.addEventListener('resize',scheduleDrawingFit);
 new MutationObserver(scheduleDrawingFit).observe(document.body,{attributes:true,attributeFilter:['class']});
}
const motionGate=window.MotionPolicy?.createGate();
const gameSounds=window.GameSounds?.create();
const resultsView=window.DrawResults?.mount({trigger:$('#reviewResults'),dialog:$('#drawResults'),validateCanvas:validCanvasSnapshot,onState:receive,onVoteChange:updateStageVote,onUnauthorized:()=>location.replace('/login?next='+encodeURIComponent('/draw/'+code))});
let stageResultPreview=null,streamDisconnected=false,canvasConnectionError='',lastLiveState=false,motionNeedsBaseline=false;
function updateCanvasBusy(){const view=canvasSession.view(),value=view.commandBusy||view.recovering;canvas.setAttribute('aria-busy',String(value));canvas.classList.toggle('canvas-busy',value);}
const redrawCanvas=()=>{cancelPreviewFrame();return canvasSession.redraw();};
const applyCanvasSnapshot=(snapshot,reset)=>canvasSession.applySnapshot(snapshot,reset);
const receiveCanvasStroke=data=>canvasSession.receiveStroke(data);
let feedEntries=[],lastReceivedAt=0,lastTimerSeconds=null,lastTimerRound=-1,lastTimerEpoch=null,lastTimerPhase=null,disconnected=false;
const drawingController=window.DrawController.create({
 context:()=>({room:code,session,busy,epoch:state?.canvasEpoch,round:state?.round,version:canvasSession.view().version}),
 restoreSession:(room,options)=>RoomReconnect.restore(room,'draw','#connection',options),onRestored:save,
 request:api,receive,applySnapshot:applyCanvasSnapshot,receiveStroke:receiveCanvasStroke,tick,
 onSyncSuccess:()=>{canvasConnectionError='';updateConnection();},
 onSyncError:error=>{canvasConnectionError='畫布正在重新同步：'+error.message;updateConnection();},
 onPollSuccess:updateConnection,
 onPollError:()=>{disconnected=true;gameSounds?.disconnect();updateConnection();},
 onStreamReady:()=>{streamDisconnected=false;updateConnection();},
 onStreamError:()=>{streamDisconnected=true;motionNeedsBaseline=true;gameSounds?.disconnect();updateConnection();},
 cancelWork:()=>{canvasSession.suspend();if(drawingFitFrame!==null)cancelAnimationFrame(drawingFitFrame);drawingFitFrame=null;}
});
try{session=JSON.parse(localStorage.getItem(code?'ah-draw:'+code:'ah-draw')||'null');if(session&&!code)code=session.code;}catch{}

function toast(message,{immediate=false}={}){if(!immediate&&window.GameUI?.notify)return window.GameUI.notify(message,{durationMs:4000});$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000);}
async function api(route,data,options={}){return RoomApi.request(route,data,{code,room:'draw',session,...options,onKicked:()=>{drawingController.dispose();RoomHost.kicked(session);session=null;resultsView?.reset();gameSounds?.reset();},...(document.body.dataset.uiTemplate?{onClosed:error=>{drawingController.dispose();session=null;window.StitchGameUI?.roomError(error);}}:{})}).catch(error=>{window.StitchGameUI?.roomError(error);throw error;});}
function save(result){session=result;code=result.code;localStorage.setItem('ah-draw',JSON.stringify(result));localStorage.setItem('ah-draw:'+code,JSON.stringify(result));history.replaceState(null,'','/draw/'+code);}
function nameOf(id){return state?.players.find(player=>player.id===id)?.name||'朋友';}
function playerStatus(player,s=state){
 const didNotPlay=['reveal','finished'].includes(s.phase)&&player.id!==s.presenterId&&!s.participantIds?.includes(player.id);
 let role=didNotPlay?'本輪未參與':player.waitingForNextRound?'下輪加入':player.id===s.presenterId?(s.phase==='choosing'?'選題中':s.phase==='drawing'?'畫圖中':'本輪畫者'):s.guessedIds?.includes(player.id)?'已猜中':s.phase==='waiting'?'已入座':'尚未猜中';
 if(s.phase==='waiting'&&player.id===s.hostId)role='房主 · '+role;
 if(player.id===s.me&&(disconnected||streamDisconnected))role+=' · 正在重連';else if(player.online===false)role+=' · 暫時離線';
 return role;
}
function playerRow(player){
 const row=GameShell.playerRow(player,{me:state.me,status:playerStatus(player)}),correct=['drawing','reveal','finished'].includes(state.phase)&&state.participantIds?.includes(player.id)&&state.guessedIds?.includes(player.id)&&!player.waitingForNextRound;
 if(!correct)return row;
 const icon=window.GameUI?.icon('check')||'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6"/></svg>';
 return row.replace('class="room-player player"','class="room-player player draw-player-correct"').replace('<div class="room-player-avatar">','<div class="room-player-avatar"><span class="draw-correct-mark" aria-hidden="true">'+icon+'</span>');
}
function waitingSummary(s=state){
 if(!s)return {title:'',detail:''};
 const artist=s.players.find(player=>player.id===s.presenterId);
 if(['choosing','drawing'].includes(s.phase)&&artist?.online===false)return {title:'畫者暫時離線',detail:artist.name+' 正在重新連線；倒數仍照常進行。'};
 return {title:'',detail:''};
}
function updatePresence(){
 if(!state)return;
 GameShell.stableMarkup($('#players'),state.players.map(playerRow).join(''));
 window.GameUI?.Template?.patterns.updateRoster($('#players'),state);
 const waiting=waitingSummary();$('#drawWaiting').hidden=!waiting.title;$('#drawWaitingTitle').textContent=waiting.title;$('#drawWaitingNames').textContent=waiting.detail;
}
function updateConnection(){
 const message=disconnected?'你的連線暫停，正在重新連線；目前顯示最後同步的狀態。':streamDisconnected?'畫布連線正在重連，仍可猜題與查看玩家。':canvasConnectionError;
 $('#connection').textContent=message;updatePresence();
}
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
 const topics=[...document.querySelectorAll('#stage input[name="topics"]:checked,.ui-room-settings-slot input[name="topics"]:checked')].map(input=>input.value);
 if(!topics.length)throw Error('請至少選擇一個題目類別');
 return topics;
}
function endingSettings(settings){
 const ending=settings.ending||{mode:'rounds',value:null},legacy=ending.value==null,score=ending.mode==='score',selected=legacy?'legacy':score?'score':'rounds';
 const value=`<input id="drawEndValue" type="number" aria-label="${score?'目標分數':'固定總題數'}" min="${score?10:1}" max="${score?1000:64}" step="1" value="${legacy?'':ending.value}" ${legacy?'disabled':''}>`;
 const choice=(mode,label,defaultValue)=>`<label class="st-end-choice" data-ending-mode="${mode}"><input type="radio" name="endingChoice" data-ending-option="${mode}" value="${mode}" ${selected===mode?'checked':''}><span>${label}</span><span class="st-end-value-slot">${selected===mode?value+`<small>${score?'分':'題'}</small>`:`<small class="st-end-default">${defaultValue}</small>`}</span></label>`;
 return `<fieldset class="draw-ending-settings"><legend>結算條件</legend><select id="drawEndMode" aria-hidden="true" tabindex="-1" hidden>${legacy?'<option value="legacy" selected>每位玩家畫一次（目前設定）</option>':''}<option value="rounds" ${!legacy&&!score?'selected':''}>固定輪數（總題數）</option><option value="score" ${score?'selected':''}>分數達標</option></select><div class="st-end-modes">${choice('rounds','固定題數','8 題')}${choice('score','先達分數','100 分')}${legacy?choice('legacy','每位玩家畫一次','輪流') :''}</div><p id="drawEndHint">${legacy?'依入座順序，每位玩家畫一次。':score?'10–1000 分；當題揭曉後結算，最多 64 題。':'1–64 題；畫者依入座順序輪替。'}</p></fieldset>`;
}
function readRoomSettings(){
 const mode=$('#drawEndMode').value,data={seconds:Number($('#stage input[name="seconds"]:checked,.ui-room-settings-slot input[name="seconds"]:checked')?.value),topics:readTopics()};
 if(mode!=='legacy'){const value=Number($('#drawEndValue').value),min=mode==='score'?10:1,max=mode==='score'?1000:64;if(!Number.isInteger(value)||value<min||value>max)throw Error(mode==='score'?'目標分數需為10–1000的整數。':'固定總題數需為1–64的整數。');data.ending={mode,value};}
 return data;
}
function roomSettingsMarkup(s){return `<section class="card stage-controls room-settings-panel"><h2>房間設定</h2><div class="room-settings-body" role="group" aria-label="房間設定欄位">${s.host?'':'<p>只有房主能修改；以下為目前房間設定。</p>'}<div class="room-settings-scroll"><fieldset class="room-settings-fields" ${s.host?'':'disabled'}><div class="settings">${topicOptions('題目類別',selectedTopics(s.options))}${options('作畫時間',[['60','60 秒'],['90','90 秒'],['120','120 秒']],s.options.seconds,'seconds')}${endingSettings(s.options)}</div></fieldset></div>${s.host?GameShell.settingsActions():''}</div></section>`;}
function waitingActions(){return '';}
function decorateActions(){for(const button of $('#drawActions').querySelectorAll('button'))window.GameUI?.decorateButton(button,({start:state.phase==='finished'?'replay':'play',next:'next',save:'save',settings:'settings'})[button.dataset.do]);}
function entry(){
 $('#stage').innerHTML=`<div class="card hero"><div class="hero-mark">✎</div><span class="eyebrow">DRAW TOGETHER</span><h1>畫一筆，<br>讓朋友猜一猜。</h1><p id="identity">將以你的角色名稱入座</p><form id="enterForm">${code?`<p>加入房間 <b>${esc(code)}</b></p><button class="button wide">加入這一桌 →</button>`:`<p>題目類別、時間與結算條件可在建房後的房間設定調整。</p><button class="button wide">開一桌你畫我猜 →</button>`}</form></div>`;
}
function stageAvatar(player,extraClass=''){
 const avatar=player?.avatar||(document.body.dataset.uiTemplate?(player?.bot?'/assets/characters/sunny-neutral.png':'/assets/characters/traveler-neutral.png'):null);
 return avatar?`<img class="stage-avatar ${extraClass}" src="${esc(avatar)}" alt="">`:`<span class="stage-avatar stage-avatar-fallback ${extraClass}" aria-hidden="true">✎</span>`;
}
function stageVotePanel(s){return `<section class="draw-ban-panel" aria-label="這輪題目投票"><div class="draw-ban-control"><button id="stageBan" type="button" class="draw-ban-button" data-do="ban" data-result-id="${esc(s.result?.resultId||'')}" aria-describedby="stageBanSummary stageBanStatus" disabled>禁止題目</button><p id="stageBanSummary" class="draw-ban-summary" aria-live="polite"></p></div><p id="stageBanStatus" class="draw-ban-status" role="status" tabindex="-1"></p></section>`;}
function updateStageVote(){
 const button=$('#stageBan');if(!button||state?.phase!=='reveal'||!resultsView)return;
 window.DrawResults.renderVote(button,$('#stageBanSummary'),$('#stageBanStatus'),resultsView.votePresentation(state.result?.resultId||null));
}
function stageScene(s){
 const artist=s.players.find(player=>player.id===s.presenterId);
 if(s.phase==='waiting')return `<section class="stage-scene stage-waiting" aria-label="開畫準備"><div class="waiting-head"><h1>準備開畫</h1><span id="waitingCount">${s.players.length} / 8 位入座</span></div></section>`;
 if(s.phase==='choosing'){
  const mine=s.presenterId===s.me;
  const hiddenCard=`<span class="stage-pick-back${document.body.dataset.uiTemplate?' stage-pick':''} ui-center-content" role="img" aria-label="未公開的題目">${window.GameUI?.symbol?.('unknown')||'<span class="ui-symbol" aria-hidden="true">?</span>'}</span>`;
  const choices=mine&&document.body.dataset.uiTemplate?s.candidates.map(word=>`<button type="button" class="stage-pick" data-word="${esc(word.id)}"><small>${esc(word.topicLabel||'綜合')} · ${esc(word.category)}</small><strong>${esc(word.title)}</strong><span>${[...word.title].length} 字</span></button>`).join(''):hiddenCard.repeat(3);
  return `<div class="stage-scene stage-choosing"><div class="stage-lead">${stageAvatar(artist)}<span>${esc(artist?.name||'畫者')} 的回合</span></div><div class="stage-copy"><span class="ui-badge stage-ribbon">ROUND ${s.round} / ${s.roundLimit}</span><h1>${mine?'選一張題卡，準備開畫':'畫者正在挑題'}</h1><p>${mine?(document.body.dataset.uiTemplate?'只有你看得到題目，選好就開始。':'請在「遊戲操作」選一題，選好就能立即畫。'):'題目選好後，畫作會出現在同一塊畫布。'}</p>${!mine&&document.body.dataset.uiTemplate?'<img class="st-secret-art" src="/assets/stitch/secret-cards.jpg" alt="等待秘密題卡揭曉的插畫">':''}<div class="stage-picks">${choices}</div></div></div>`;
 }
 if(s.phase==='reveal'){
  const footer=document.body.dataset.uiTemplate?`<footer class="tpl-result-actions">${s.result?.resultId?`<button data-do="save" data-result-id="${esc(s.result.resultId)}">收藏這幅畫</button>`:''}${s.host?'<button class="tpl-replay" data-do="next">下一位畫者</button>':'<span>等待下一輪</span>'}</footer>`:'';
  return `<div class="stage-scene stage-reveal"><div class="stage-copy"><span class="ui-badge stage-ribbon">ROUND ${s.round} · 答案揭曉</span><h1 class="stage-answer">${esc(s.result?.answer||'這輪沒有選定題目')}</h1><p class="stage-reason">${esc(s.result?.reason||'')}</p><div class="stage-stat"><b>${s.result?.guessedIds?.length||0}</b> 位朋友猜中 <span>· 畫者每猜中一人 +15 分</span></div>${stageVotePanel(s)}</div><div class="stage-art"><canvas id="stagePreview" width="512" height="256" role="img" aria-label="本輪完成的畫作"></canvas><small id="stagePreviewStatus">正在讀取本輪畫作…</small></div>${footer}</div>`;
 }
 const rankings=[...s.players].sort((a,b)=>b.score-a.score);
 const winners=s.winner?.ids||[];
 const playerName=name=>window.GameUI?.playerName?.(name)||`<span class="ui-player-name" title="${esc(name)}">${esc(name)}</span>`;
 const podium=document.body.dataset.uiTemplate&&window.GameUI?.Template?.compositions.podium?window.GameUI.Template.compositions.podium({players:rankings,winners,correctCounts:s.matchSummary?.correctByPlayer}):`<ol class="stage-player-cards">${rankings.map((player,index)=>`<li class="stage-player-card${winners.includes(player.id)?' stage-winner':''}"><span class="stage-card-rank" aria-label="排名 ${index+1}">${index+1}</span>${stageAvatar(player)}<b>${playerName(player.name)}</b><strong>${player.score} 分</strong>${winners.includes(player.id)?'<span class="stage-card-win ui-symbol" role="img" aria-label="本局獲勝" title="本局獲勝">✦</span>':''}</li>`).join('')}</ol>`;
 const footer=document.body.dataset.uiTemplate?`<footer class="tpl-result-actions"><a class="tpl-return" href="/">返回大廳</a><button data-do="template-export">匯出畫作集</button>${s.result?.resultId?`<button data-do="save" data-result-id="${esc(s.result.resultId)}">收藏這幅畫</button>`:''}<button class="tpl-focus-settings ui-icon-button" data-do="template-settings" aria-label="下一局設定">${window.GameUI?.symbol?.('settings')||'設定'}</button>${s.host?'':'<span>等待房主再開一局</span>'}</footer>`:'';
 const lastArt=s.result?.resultId?`<section class="stage-art finished-art" aria-label="最後一輪畫作"><h2>最後一幅畫${s.result.answer?' · '+esc(s.result.answer):''}</h2><canvas id="stagePreview" width="512" height="256" role="img" aria-label="最後一輪完成的畫作"></canvas><small id="stagePreviewStatus">正在讀取畫作…</small></section>`:'';
 const artwork=document.body.dataset.uiTemplate&&lastArt?`<details class="tpl-finished-art"><summary>最後一幅畫 · ${esc(s.result.answer||'未選定題目')}</summary>${lastArt}</details>`:lastArt;
 return `<div class="stage-scene stage-finished"><div class="stage-copy finished-heading"><span class="ui-badge stage-ribbon">GAME OVER</span><h1>今晚的畫猜高手</h1><p>${esc(s.winner?.reason||'每位畫者都已完成。')}</p></div><section class="stage-podium" aria-label="本局排名">${podium}</section>${artwork}${footer}</div>`;
}
function render(live=false){
 const s=state,settingsOpen=$('#stage .stage-controls')?.open,voteFocus=document.activeElement?.id==='stageBan'?document.activeElement.dataset.resultId:null;let html='',actions='';
 document.body.dataset.drawPhase=s.phase;
 document.body.dataset.drawRole=s.presenterId===s.me?'artist':'guesser';
 document.body.dataset.drawHost=String(s.host===true);
 document.body.classList.toggle('drawing-active',s.phase==='drawing');
 if(s.phase==='waiting'){
  html=roomSettingsMarkup(s);
  actions=waitingActions(s);
 }else if(s.phase==='drawing'){
  const artist=s.presenterId===s.me,eligible=s.participantIds.includes(s.me);
  actions='';
   if(!eligible&&!artist)actions='<p>下一輪起可以猜題。</p>';
  }else if(s.phase==='choosing'){
   actions=document.body.dataset.uiTemplate?'':s.presenterId===s.me?`<p>選一題開始作畫，題目只有你看得到。</p><div class="ui-game-word-choices">${s.candidates.map(word=>`<button type="button" data-word="${esc(word.id)}"><small>${esc(word.topicLabel||'綜合')} · ${esc(word.category)} · ${[...word.title].length} 字</small><strong>${esc(word.title)}</strong></button>`).join('')}</div>`:`<p>等待 ${esc(nameOf(s.presenterId))} 選題。</p>`;
 }else if(s.phase==='reveal'){
   actions=`<p>本輪已揭曉。</p>${s.host?'<button data-do="next">下一位畫者</button>':'<p>等待房主開始下一輪。</p>'}${s.result?.resultId?'<button data-do="save" data-result-id="'+esc(s.result.resultId)+'">收藏這幅畫</button>':''}`;
  }else if(s.phase==='finished'){
   actions=`<p>本局完成。</p>${s.host?'':'<p>等待房主再開一局。</p>'}${s.result?.resultId?'<button data-do="save" data-result-id="'+esc(s.result.resultId)+'">收藏這幅畫</button>':''}`;
 }
 if(s.phase==='finished')html=roomSettingsMarkup(s);$('#stage').innerHTML=html;$('#stage').hidden=!html;if(settingsOpen&&['waiting','finished'].includes(s.phase)&&!window.RoomControls)$('#stage .stage-controls').open=true;window.GameUI?.decorateButton($('#stage .room-settings-save'),'save');
 if(['waiting','finished'].includes(s.phase)&&!window.RoomControls){const details=$('#stage .stage-controls');window.UIPopover?.bindDetails(details,details.querySelector('.room-settings-body'),{align:'start',width:720});}
  if(s.phase==='waiting')actions+='';
  GameShell.stableMarkup($('#drawActions'),actions);
 decorateActions();
 $('#canvasStage').innerHTML=s.phase==='drawing'?'':stageScene(s);
 const sceneKey=s.canvasEpoch+':'+s.phase;if($('#canvasStage').dataset.sceneKey!==sceneKey){$('#canvasStage').scrollTop=0;$('#canvasStage').scrollLeft=0;$('#canvasStage').dataset.sceneKey=sceneKey;}
 $('#canvasStage').hidden=s.phase==='drawing';
 $('#boardSection').hidden=false;$('#boardSection').classList.toggle('is-drawing',s.phase==='drawing');
 $('.draw-roster').hidden=false;
 canvas.tabIndex=s.phase==='drawing'&&s.presenterId===s.me?0:-1;
 canvas.setAttribute('aria-hidden',s.phase==='drawing'?'false':'true');
 $('#tools').hidden=!(s.phase==='drawing'&&s.presenterId===s.me);
 $('#guessChat').hidden=!['drawing','reveal','finished'].includes(s.phase);
 $('#drawGuessPanel').hidden=$('#guessChat').hidden;
 if(document.body.dataset.uiTemplate&&s.phase==='finished')$('#drawGuessPanel').hidden=true;
 $('#guessForm').hidden=!(s.phase==='drawing'&&s.participantIds.includes(s.me)&&!s.guessedIds.includes(s.me));
 $('#boardTitle').textContent=s.phase==='drawing'?(s.presenterId===s.me?s.question?.title||'本輪畫布':'猜猜畫者畫什麼？'):{waiting:'今晚的畫猜桌',choosing:'第 '+s.round+' 輪，'+nameOf(s.presenterId)+' 選題',reveal:'本輪答案與畫作',finished:'本局成績'}[s.phase];
 $('#boardHint').textContent=s.phase==='reveal'?'答案與畫作已揭曉':s.phase==='waiting'?'題目類別：'+topicChoices.filter(([value])=>selectedTopics(s.options).includes(value)).map(([,label])=>label).join('、'):'';
 $('#boardHint').hidden=!$('#boardHint').textContent;
 $('#drawCountdown').hidden=!Number.isFinite(s.deadline)||!['choosing','drawing','reveal'].includes(s.phase);
 $('#timerCaption').textContent={choosing:'選題剩餘',drawing:'作畫剩餘',reveal:'下一輪'}[s.phase]||'';
 updateStagePreview();
 updateStageVote();
 if(voteFocus&&voteFocus===s.result?.resultId){const button=$('#stageBan');(button?.disabled?$('#stageBanStatus'):button)?.focus({preventScroll:true});}
 updateFeed(live);
 if(typeof ResizeObserver==='function')scheduleDrawingFit();
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
   line.textContent=item.correct?`${item.name}：猜對了答案！ +${item.points} 分`:`${item.name}：${item.answer}`;
   feed.append(line);
   const fresh=motionGate?motionGate.take('feed:'+state.canvasEpoch+':'+JSON.stringify(item),live):live;
   if(fresh&&hadState&&index===guesses.length-1)animate(line,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
 }
 feedEntries=keys;feed.dataset.ready='true';
 if(stickToBottom)feed.scrollTop=feed.scrollHeight;
}
function motionAllowed(){return window.MotionPolicy?window.MotionPolicy.allowsMotion():!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
function animate(node,keyframes,options){if(window.MotionPolicy)return window.MotionPolicy.animate(node,keyframes,options);if(motionAllowed())return node?.animate?.(keyframes,options);return null;}
function updateStagePreview(){
 const id=['reveal','finished'].includes(state?.phase)?state.result?.resultId:null,preview=id?$('#stagePreview'):null;
 if(!id||!preview?.getContext||!resultsView){stageResultPreview?.renderer.reset();stageResultPreview=null;return;}
 if(stageResultPreview?.id===id&&stageResultPreview.node===preview)return;
 stageResultPreview?.renderer.reset();
 const job={id,node:preview,renderer:window.StrokeCanvas.createDrawingRenderer(preview,{maxCheckpoints:2})};stageResultPreview=job;
 preview.hidden=true;
 resultsView.store.load(id).then(snapshot=>{if(stageResultPreview!==job)return;return job.renderer.renderCooperatively(snapshot.canvas.strokes);}).then(()=>{if(stageResultPreview!==job)return;preview.hidden=false;$('#stagePreviewStatus').textContent='本輪畫作 · 可從最近畫作回看與收藏';}).catch(()=>{if(stageResultPreview===job)$('#stagePreviewStatus').textContent='畫作暫時無法載入，可從最近畫作重試。';});
}
function animatePhase(from,to){
 if(!from||from===to||!motionAllowed())return;
 const scene=$('#canvasStage .stage-scene');
 if(document.body.dataset.uiTemplate){animate(scene,[{opacity:0},{opacity:1}],{duration:150,easing:'ease-out'});return;}
 animate(scene,[{opacity:.4,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:360,easing:'cubic-bezier(.2,.75,.25,1)'});
 if(to==='choosing')$('#canvasStage').querySelectorAll('.stage-pick, .stage-pick-back').forEach((item,index)=>animate(item,[{opacity:0,transform:'translateY(15px) rotate(-3deg)'},{opacity:1,transform:'translateY(0) rotate(0)'}],{duration:400,delay:index*70,easing:'ease-out'}));
 if(to==='drawing')animate($('.canvas-frame'),[{boxShadow:'inset 0 0 0 8px #e7ad63'},{boxShadow:'inset 0 0 0 0 #e7ad6300'}],{duration:450,easing:'ease-out'});
 if(to==='reveal'){
  animate($('#canvasStage .stage-answer'),[{opacity:0,transform:'translateY(12px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:450,easing:'cubic-bezier(.2,.75,.25,1)'});
  animate($('#canvasStage .stage-art'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:470,easing:'ease-out'});
 }
 if(to==='finished')$('#canvasStage').querySelectorAll('.stage-winner').forEach((item,index)=>animate(item,[{opacity:0,transform:'translateY(18px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:380,delay:index*90,easing:'ease-out'}));
}
function showCorrectFeedback(previous,next,live){
 const oldCorrect=new Set((previous?.guesses||[]).filter(item=>item.correct).map(item=>item.id));
 for(const guess of (next.guesses||[]).filter(item=>item.correct).slice(-3)){
  const fresh=motionGate?motionGate.take('correct:'+next.canvasEpoch+':'+guess.id,live):live;
  if(!fresh||!motionAllowed()||previous?.canvasEpoch!==next.canvasEpoch||previous?.phase!=='drawing'||!['drawing','reveal'].includes(next.phase)||oldCorrect.has(guess.id)||next.serverNow-guess.at<0||next.serverNow-guess.at>=5000)continue;
  const row=[...$('#players').querySelectorAll('.player')].find(item=>item.dataset.playerId===guess.id);
  if(!row)continue;
  row.classList.add('just-correct');
  const badge=document.createElement('span');badge.className='correct-pop';badge.textContent='✓ +'+guess.points+' 分';row.append(badge);
  animate(badge,[{opacity:0,transform:'translateY(8px) scale(.8)'},{opacity:1,transform:'translateY(0) scale(1)'},{opacity:1,transform:'translateY(-2px)'},{opacity:0,transform:'translateY(-12px)'}],{duration:1700,easing:'ease-out'});
  setTimeout(()=>{badge.remove();row.classList.remove('just-correct');},1700);
 }
}
function playDrawSounds(previous,next,live){
 if(!gameSounds||typeof next.canvasEpoch!=='string'||!next.canvasEpoch)return;
 const epoch=gameSounds.epoch(),me=next.players.find(player=>player.id===next.me),active=!!me&&!me.kicked&&!me.waitingForNextRound;
 if(next.phase==='choosing'&&next.presenterId===next.me)gameSounds.play('turn',`draw:turn:${next.canvasEpoch}:${next.me}`,{live:live&&active&&!!previous&&previous.canvasEpoch!==next.canvasEpoch,epoch});
 const ownCorrect=(next.guesses||[]).find(guess=>guess.correct&&guess.id===next.me);
 if(!ownCorrect)return;
 const oldCorrect=new Set((previous?.guesses||[]).filter(guess=>guess.correct).map(guess=>guess.id)),age=next.serverNow-ownCorrect.at;
 const fresh=active&&previous?.canvasEpoch===next.canvasEpoch&&previous?.phase==='drawing'&&['drawing','reveal'].includes(next.phase)&&!oldCorrect.has(next.me)&&!previous.guessedIds?.includes(next.me)&&next.participantIds?.includes(next.me)&&next.guessedIds?.includes(next.me)&&Number.isFinite(next.serverNow)&&Number.isFinite(ownCorrect.at)&&age>=0&&age<=5000;
 gameSounds.play('correct',`draw:correct:${next.canvasEpoch}:${next.me}`,{live:live&&fresh,epoch});
}
function receive(next){
 if(!next||next.type!=='draw')throw Error('這不是你畫我猜房間');
 const previous=state,oldRound=state?.round,oldPhase=state?.phase;
 if(previous&&(next.version<previous.version||RoomHost.isStaleSnapshot?.(next,previous)))return;
 const soundLive=gameSounds?.update(next,{connected:!disconnected&&!streamDisconnected&&!motionNeedsBaseline})||false;
 const live=motionGate?motionGate.update(next,{connected:!disconnected&&!streamDisconnected&&!motionNeedsBaseline}):!!previous&&!disconnected&&!motionNeedsBaseline&&Date.now()-lastReceivedAt<5000&&document.visibilityState!=='hidden';
 motionNeedsBaseline=false;
 lastLiveState=live;
 state=next;lastReceivedAt=Date.now();disconnected=false;RoomHost.update(next,receive);
 if(previous?.canvasEpoch!==next.canvasEpoch)drawFeedback('');
 resultsView?.update(next);updateConnection();
 clockOffset=Date.now()-next.serverNow;
 $('#roomTag').textContent='房間 '+code;$('#invite').hidden=false;
 $('#roundTag').textContent=next.phase==='waiting'?'朋友到齊就開畫':'第 '+next.round+' / '+next.roundLimit+' 輪';
 $('#phaseTag').textContent={waiting:'等待玩家',choosing:'畫者選題',drawing:'畫圖與猜題',reveal:'答案揭曉',finished:'本局結束'}[next.phase];
 $('#count').textContent=next.players.length+' / 8';
 updatePresence();
 const key=JSON.stringify([next.canvasEpoch,next.phase,next.botSupport,next.round,next.options,next.host,next.phase==='waiting'?null:next.players.map(player=>player.id),next.candidates,next.question,next.guessedIds.includes(next.me),next.result,next.winner]);
 const changed=key!==signature;
 const freshPhase=motionGate?motionGate.take('phase:'+next.canvasEpoch+':'+next.phase,live):live;
 if(changed){signature=key;render(live);if(freshPhase)animatePhase(oldPhase,next.phase);}
 else{updateFeed(live);updateStagePreview();}
 if(next.phase==='waiting'){
  if(!changed&&previous?.players.length!==next.players.length){GameShell.stableMarkup($('#drawActions'),waitingActions(next)+(''));decorateActions();}
  const waitingCount=$('#waitingCount');if(waitingCount)waitingCount.textContent=next.players.length+' / 8 位入座';
 }
 showCorrectFeedback(previous,next,live);
 playDrawSounds(previous,next,soundLive);
 canvasSession.transition(next);
 window.StitchGameUI?.update(next,{action,roomAction,invite,get results(){return resultsView;},api,live});
 connectEvents();tick();
}
function tick(){
 const label=$('#timer'),progress=$('#timerProgress'),countdown=$('#drawCountdown');
 const timed=state&&['choosing','drawing','reveal'].includes(state.phase)&&Number.isFinite(state.deadline);
 countdown.hidden=!timed;
 if(!timed){countdownBar.reset();label.textContent='–';progress.value=1;progress.classList.remove('urgent');progress.removeAttribute?.('aria-valuetext');$('#drawWaitingTime').textContent='';label.classList.remove('urgent');lastTimerSeconds=null;return;}
 const remaining=Math.max(0,state.deadline-(Date.now()-clockOffset)),seconds=Math.ceil(remaining/1000);
 const configured=Number(state.options?.seconds),duration=state.phase==='choosing'?15000:state.phase==='reveal'?8000:(Number.isFinite(configured)&&configured>0?configured:90)*1000;
 const text=document.body.dataset.uiTemplate?seconds+'秒':seconds+' 秒';if(label.textContent!==text)label.textContent=text;
 const urgent=state.phase==='drawing'&&seconds<=10;
 label.classList.toggle('urgent',urgent);progress.classList.toggle('urgent',urgent);
 $('#timerTrack').classList.toggle('urgent',urgent);
 progress.value=Math.min(1,remaining/duration);progress.setAttribute('aria-valuetext','剩餘 '+seconds+' 秒');
 countdownBar.sync({key:state.canvasEpoch+':'+state.phase,deadline:state.deadline,duration,offset:clockOffset,visible:!document.hidden});
 if(state.phase==='drawing'&&lastTimerPhase==='drawing'&&lastTimerEpoch===state.canvasEpoch&&lastTimerSeconds>15&&seconds<=15&&remaining>0){
  gameSounds?.play('countdown-warning','draw-countdown:'+state.canvasEpoch+':15',{live:Date.now()-lastReceivedAt<=2500&&!disconnected&&!streamDisconnected});
 }
 if(state.phase==='drawing'&&lastTimerRound===state.round&&lastTimerSeconds>10&&seconds<=10&&motionAllowed()&&document.visibilityState!=='hidden'){
  if(!motionGate||motionGate.take('timeout:'+state.canvasEpoch,lastLiveState))animate($('.canvas-frame'),[{borderColor:'#a6b8a5'},{borderColor:'#b34b50'},{borderColor:'#a6b8a5'}],{duration:530,easing:'ease-out'});
 }
 lastTimerRound=state.round;lastTimerSeconds=seconds;lastTimerEpoch=state.canvasEpoch;lastTimerPhase=state.phase;
}
function syncCanvas(){return drawingController.syncCanvas();}
function cancelCanvasSync(){drawingController.cancelSync();}
function updateFillAvailability(){const button=$('#tools [data-tool="fill"]');if(!button)return;button.disabled=canvasSession.view().quota.usedFills>=48;button.title=button.disabled?'本輪填色額度已用完，可用畫筆或形狀繼續':'填滿連續區域';}
function connectEvents(){drawingController.connectEvents();}
function drawFeedback(message,kind='info',settings=false,guess=false){
 const node=$(settings?'#roomSettingsFeedback':guess?'#drawGuessStatus':'#drawStatus')||$('#drawStatus');
 node.textContent=message;node.dataset.kind=kind;window.GameUI?.setStatus(node,message,{kind});
 if(!message&&!settings){const other=$(guess?'#drawStatus':'#drawGuessStatus');other.textContent='';other.dataset.kind='info';window.GameUI?.setStatus(other,'',{kind:'info'});}
}
let pendingDrawButton=null;
function drawBusy(value){roomActions.refresh();$('#drawActionSlot').setAttribute('aria-busy',String(value));$('#drawGuessPanel').setAttribute('aria-busy',String(value));if(value){pendingDrawButton=document.activeElement?.closest?.('button');if(pendingDrawButton&&!pendingDrawButton.classList.contains('ui-room-roster-action-button'))window.GameUI?.setBusy(pendingDrawButton,true);}else{if(pendingDrawButton&&!pendingDrawButton.classList.contains('ui-room-roster-action-button'))window.GameUI?.setBusy(pendingDrawButton,false);pendingDrawButton=null;}window.RoomWaiting?.setRosterBusy(value);}
async function action(name,data={}){if(busy)return false;const epoch=state?.canvasEpoch,guess=name==='guess';busy=true;drawBusy(true);drawFeedback('正在送出…','info',false,guess);try{receive(await api('action',{action:name,...data}));updateConnection();if(state?.canvasEpoch!==epoch)return false;drawFeedback('','info',false,guess);return true;}catch(error){if(state?.canvasEpoch===epoch){drawFeedback(error.message,'error',false,guess);toast(error.message);}return false;}finally{busy=false;drawBusy(false);}}
async function roomAction(route,data={}){if(busy)return;if(route==='start'&&roomSettingsAutoSave){await roomSettingsAutoSave.flush();if(roomSettingsAutoSave.pending())return;const error=roomSettingsAutoSave.error?.();if(error)throw Error(error);}const settings=route==='settings',restoreFocus=settings&&document.activeElement?.closest?.('.room-settings-save');busy=true;drawBusy(true);drawFeedback('正在送出…','info',settings);try{receive(await api(route,data));updateConnection();drawFeedback(settings?'房間設定已儲存。':'',settings?'success':'info',settings);}catch(error){drawFeedback(error.message,'error',settings);toast(error.message);throw error;}finally{busy=false;drawBusy(false);if(restoreFocus)$('#stage .room-settings-save')?.focus({preventScroll:true});}}
async function invite(){const url=inviteBase+'/draw/'+code;try{await navigator.clipboard.writeText(url);toast('邀請連結已複製');}catch{window.prompt('複製邀請連結',url);}}
async function saveArtwork(resultId=state?.result?.resultId){
 if(!resultId||!resultsView){drawFeedback('這輪尚未公開畫作；請從最近畫作選擇已揭曉的一輪。','error');return null;}
 const snapshot=await resultsView.open(resultId,document.activeElement||$('#reviewResults'));
 if(!snapshot)return null;
 return resultsView.save(resultId);
}
async function voteForResult(resultId){
 if(!resultsView||!resultId)return null;
 const room=state?.code,info=resultsView.store.voteView(resultId).summary;
 const response=await resultsView.vote(resultId);
 if(!info||state?.code!==room||resultsView.store.view().room!==room||(state.phase==='reveal'&&state.result?.resultId===resultId))return response;
 const result=resultsView.store.voteView(resultId),prefix='第 '+info.round+' 輪：';
 if(result.vote?.banned)toast(prefix+'此題已移除題庫。');
 else if(result.vote?.voted)toast(prefix+'已記錄禁題投票，可從「最近畫作」查看。');
 else if(result.error)toast(prefix+'投票未完成，請從「最近畫作」重試。');
 return response;
}
function stageClick(event){
 const button=event.target.closest('button');if(!button||button.disabled)return;
 if(button.dataset.selectTopics){for(const input of button.closest('fieldset').querySelectorAll('input[name="topics"]'))input.checked=button.dataset.selectTopics==='all';return;}
 if(button.dataset.word)return action('choose',{questionId:button.dataset.word});
 switch(button.dataset.do){
  case 'bot':return roomAction('bot');case 'start':case 'template-replay':return roomAction('start');case 'next':return action('next');
  case 'template-settings':return window.RoomLayout?.openSettings?.(button);
  case 'template-export':return resultsView?.exportAll({currentRun:true});
  case 'template-gallery':return resultsView?.open(undefined,button);
   case 'settings':try{return roomAction('settings',readRoomSettings());}catch(error){drawFeedback(error.message,'error',true);toast(error.message);return;}
  case 'save':return saveArtwork(button.dataset.resultId);case 'ban':return voteForResult(button.dataset.resultId);case 'invite':return invite();
 }
}
document.addEventListener('change',event=>{
 const mode=event.target.id==='drawEndMode'?event.target.value:event.target.dataset.endingOption;
 if(!mode||!state?.host)return;
 const select=$('#drawEndMode'),score=mode==='score',value=$('#drawEndValue');select.value=mode;value.disabled=mode==='legacy';value.min=score?10:1;value.max=score?1000:64;value.value=mode==='legacy'?'':score?100:8;value.setAttribute('aria-label',score?'目標分數':'固定總題數');
 const group=select.closest('.draw-ending-settings');
 for(const option of group.querySelectorAll('[data-ending-option]'))option.checked=option.dataset.endingOption===mode;
 for(const choice of group.querySelectorAll('.st-end-choice')){const slot=choice.querySelector('.st-end-value-slot');if(choice.dataset.endingMode===mode){slot.replaceChildren(value);const unit=document.createElement('small');unit.textContent=score?'分':mode==='legacy'?'輪流':'題';slot.append(unit);}else{const label=document.createElement('small');label.className='st-end-default';label.textContent=choice.dataset.endingMode==='score'?'100 分':choice.dataset.endingMode==='rounds'?'8 題':'輪流';slot.replaceChildren(label);}}
 $('#drawEndHint').textContent=mode==='legacy'?'依入座順序，每位玩家畫一次。':score?'10–1000 分；當題揭曉後結算，最多 64 題。':'1–64 題；畫者依入座順序輪替。';
},true);
$('#stage').addEventListener('click',stageClick);
document.addEventListener('click',event=>{if(event.target.closest('.ui-room-settings-slot'))stageClick(event);});
$('#drawActions').addEventListener('click',stageClick);
document.addEventListener('click',event=>{if(event.target.closest('.ui-room-roster-add button[data-do=bot]'))stageClick(event);});
$('#canvasStage').addEventListener('click',stageClick);
$('#stage').addEventListener('submit',async event=>{
 if(event.target.id!=='enterForm')return;event.preventDefault();if(busy)return;busy=true;
  try{const result=await api(code?'join':'create',{type:'draw',code});if(result.type!=='draw')throw Error('這是其他遊戲房間');save(result);drawingController.start();receive(await api('state'));updateConnection();}
 catch(error){toast(error.message);}finally{busy=false;}
});
$('#guessForm').addEventListener('submit',async event=>{event.preventDefault();const input=$('#guessInput'),answer=input.value.trim();if(!answer)return;const accepted=await action('guess',{answer});if(accepted&&input.value.trim()===answer)input.value='';input.focus();});
$('#invite').onclick=invite;$('#help').onclick=()=>window.GameUI?.openDialog?GameUI.openDialog($('#rules'),$('#help')):$('#rules').showModal();$('#closeHelp').onclick=()=>$('#rules').close();
window.GameUI?.decorateButton($('#guessForm button'),'send',{iconOnly:true,label:'送出猜測'});
window.GameUI?.decorateButton($('#help'),'help',{iconOnly:true,label:'遊戲說明'});
window.GameUI?.decorateButton($('#closeHelp'),'close',{iconOnly:true,label:'關閉說明'});

for(const button of $('#tools').querySelectorAll('[data-tool],#undo,#clear')){const key=button.dataset.tool?button.dataset.tool+(button.dataset.filled==='true'?'Filled':''):button.id;button.innerHTML=StrokeCanvas.iconMarkup(key);if(button.dataset.tool)button.setAttribute('aria-pressed',String(button.classList.contains('selected')));}
const swatches=$('#swatches');for(const color of colors){const button=document.createElement('button');button.type='button';button.style.background=color;button.dataset.color=color;button.title='選擇 '+color;button.setAttribute('aria-label','選擇 '+color);button.onclick=()=>{$('#color').value=color;$('#colorMenu').open=false;if(!document.body.dataset.uiTemplate)$('#colorMenu').querySelector('summary')?.focus();};swatches.append(button);}
if(!document.body.dataset.uiTemplate)window.GameUI?.bindPopover?.($('#colorMenu'),swatches,{align:'start'});
$('#colorMenu').addEventListener('keydown',event=>{if(event.key==='Escape'){$('#colorMenu').open=false;$('#colorMenu').querySelector('summary')?.focus();event.preventDefault();}});
$('#size').oninput=event=>$('#sizeValue').textContent=event.target.value;
$('#tools').addEventListener('click',event=>{const button=event.target.closest('[data-tool]');if(!button)return;tool=button.dataset.tool;filled=button.dataset.filled==='true';for(const item of $('#tools').querySelectorAll('[data-tool]')){item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));}});
function command(name){return canvasSession.command(name);}
$('#undo').onclick=()=>command('undo');$('#clear').onclick=async()=>{
 if(!canDraw())return;
 const epoch=state.canvasEpoch,round=state.round;
 const accepted=window.StitchGameUI?await window.StitchGameUI.confirm({title:'清空這輪畫布？',text:'清空目前的筆跡，所有玩家會看到空白畫布。',label:'清空畫布',danger:true,trigger:$('#clear')}):confirm('清空這輪畫布？');
 if(accepted&&canDraw()&&state.canvasEpoch===epoch&&state.round===round)command('clear');
};
function canDraw(){return canvasSession.canDraw();}
function queueStroke(points,id,mode=tool,times){return canvasSession.enqueue(points,id,{tool:mode,color:$('#color').value,size:Number($('#size').value),filled},times);}
const localCanvasCapacity=extra=>canvasSession.hasCapacity(extra);
function flush(final=false){
 if(!active||!['brush','erase'].includes(active.tool))return;
 clearStrokeFlush();
  if(pending.length>1||!active.sent){
   const points=[...pending],times=[...pendingTimes],draft=active;if(points.length){queueStroke(points,draft.strokeId,draft.tool,times);if(active!==draft)return;draft.sent=true;pending=final?[]:[points.at(-1)];pendingTimes=final?[]:[times.at(-1)];}
  }
 if(final){pending=[];pendingTimes=[];}
}
function clearStrokeFlush(){if(strokeFlushTimer!==null)clearTimeout(strokeFlushTimer);strokeFlushTimer=null;}
function scheduleStrokeFlush(){
 if(strokeFlushTimer!==null||!active||!['brush','erase'].includes(active.tool))return;
 const draft=active,epoch=state.canvasEpoch;
 strokeFlushTimer=setTimeout(()=>{strokeFlushTimer=null;if(active===draft&&state?.canvasEpoch===epoch)flush();},80);
}
function cancelPreviewFrame(){canvasSession.cancelPreview();}
function scheduleCanvasPreview(){canvasSession.schedulePreview();}
function cancelStrokeInput(failed=false){clearStrokeFlush();cancelPreviewFrame();if(active)canvasSession.finishDraft(active.strokeId,failed);active=null;pending=[];pendingTimes=[];}
function cancelDrawingWork(options){drawingController.cancel(options);}
function pointerSamples(event){
 let samples;if(event.type==='pointermove')try{samples=event.getCoalescedEvents?.();}catch{}
 samples=(samples?.length?[...samples]:[event]).filter(sample=>sample.pointerId===event.pointerId);
 const rect=canvas.getBoundingClientRect();
 return samples.map(sample=>({point:[Math.max(0,Math.min(511,Math.floor((sample.clientX-rect.left)*512/rect.width))),Math.max(0,Math.min(255,Math.floor((sample.clientY-rect.top)*256/rect.height)))],stamp:Number.isFinite(sample.timeStamp)&&sample.timeStamp>=0?sample.timeStamp:null})).filter(sample=>sample.point.every(Number.isFinite));
}
function collectPointer(event){
 if(!active||canvasSession.view().commandBusy||event.pointerId!==active.pointerId)return false;
 const brush=['brush','erase'].includes(active.tool);let changed=false;
 for(const sample of pointerSamples(event)){
  const point=sample.point,time=Math.min(120000,Math.max(active.pointTimes.at(-1),Math.round(sample.stamp!==null&&active.startStamp!==null?sample.stamp-active.startStamp:drawNow()-active.startNow)));
  const last=active.points.at(-1);if(point[0]===last[0]&&point[1]===last[1])continue;
  if(active.points.length>=30000||!localCanvasCapacity(1)){drawFeedback('這一筆已達畫布上限，請放開後再操作。','error');break;}
  if(brush){active.points.push(point);active.pointTimes.push(time);pending.push(point);pendingTimes.push(time);}else{active.points=[active.points[0],point];pending=[active.points[0],point];}
  canvasSession.appendDraft(active.strokeId,point,!brush);cursor=point;changed=true;
 }
 if(changed&&brush){if(pending.length>=16)flush();else scheduleStrokeFlush();}
 return changed;
}
canvas.addEventListener('pointerdown',event=>{
 if(!canDraw()||active||event.button!==0)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);
 if(canvasSession.view().quota.usedBatches>=1000||canvasSession.view().quota.usedPoints>=30000||!localCanvasCapacity(1)){drawFeedback('本輪筆畫額度已用完或仍在同步，請稍候。','error');return;}
 const sample=pointerSamples(event).at(-1);if(!sample)return;const point=sample.point;cursor=point;
 if(tool==='fill'){queueStroke([point],StrokeCanvas.strokeId(),'fill');return;}
 active={strokeId:StrokeCanvas.strokeId(),pointerId:event.pointerId,tool,color:$('#color').value,size:Number($('#size').value),filled,points:[point],pointTimes:[0],...(tool==='brush'?{curve:'quadratic'}:{}),startStamp:sample.stamp,startNow:drawNow(),sent:false};
 canvasSession.beginDraft(active);pending=[point];pendingTimes=[0];scheduleStrokeFlush();scheduleCanvasPreview();
});
canvas.addEventListener('pointermove',event=>{
 if(collectPointer(event))scheduleCanvasPreview();
});
function finishPointer(event){
 if(!active||event.pointerId!==active.pointerId)return;event.preventDefault();
 if(event.type==='pointerup')collectPointer(event);clearStrokeFlush();cancelPreviewFrame();
 if(['brush','erase'].includes(active.tool))flush(true);
 else queueStroke([active.points[0],active.points.at(-1)],active.strokeId,active.tool);
 if(!active)return;
 canvasSession.finishDraft(active.strokeId);active=null;redrawCanvas();
}
canvas.addEventListener('pointerup',finishPointer);canvas.addEventListener('pointercancel',finishPointer);
canvas.addEventListener('lostpointercapture',finishPointer);
canvas.addEventListener('keydown',event=>{
 if(!canDraw())return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(moves[event.key]){event.preventDefault();cursor=[Math.max(0,Math.min(511,cursor[0]+moves[event.key][0])),Math.max(0,Math.min(255,cursor[1]+moves[event.key][1]))];toast('畫布位置 '+(cursor[0]+1)+'，'+(cursor[1]+1)+'；按空白鍵落筆',{immediate:true});}
 if(event.key===' '){event.preventDefault();queueStroke([cursor],StrokeCanvas.strokeId(),tool==='fill'?'fill':'brush');}
});
function poll(){return drawingController.poll();}
fetch('/api/info').then(response=>response.json()).then(info=>inviteBase=info.preferred||location.origin).catch(()=>{});
drawingController.start();
entry();if(session)poll();else if(code)drawingController.restore();
if(new URLSearchParams(location.search).has('learn'))$('#rules').showModal();
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(active)finishPointer({pointerId:active.pointerId,preventDefault(){}});cancelPreviewFrame();canvasSession.finishPlayback();countdownBar.reset();}else tick();});
window.addEventListener('pagehide',event=>{countdownBar.reset();drawingController.dispose();canvasSession.dispose();stageResultPreview?.renderer.reset();stageResultPreview=null;lastLiveState=false;motionNeedsBaseline=true;if(event.persisted)gameSounds?.reset();else{motionGate?.dispose();gameSounds?.destroy();}});
window.addEventListener('pageshow',event=>{if(event.persisted){drawingController.start();motionNeedsBaseline=true;if(state){resultsView?.update(state);redrawCanvas();syncCanvas();updateStagePreview();}if(session)poll();else drawingController.restore();}});
fetch('/api/auth/me').then(response=>response.json()).then(me=>{const identity=$('#identity');if(identity&&me.displayName)identity.textContent='以「'+me.displayName+'」入座';}).catch(()=>{});

const roomSettingsAutoSave=window.GameShell?.autoSaveSettings?.({read:readRoomSettings,save:data=>roomAction('settings',data),canSave:()=>!!state?.host&&['waiting','finished'].includes(state.phase),isBusy:()=>busy});
