(function(){
 'use strict';
 const $=s=>document.querySelector(s),code=location.pathname.match(/\/telephone\/([a-f0-9]{6})\/?$/i)?.[1].toUpperCase();
 let state,busy=false,disposed=false,reading=false,lifetime,timer,key='',draftKey='',strokes=[],active=null,pointer=null,renderer=null,failed=null,countdownBar=null,countdownTimer,clockOffset=0,botControl=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function say(text){$('#feedback').textContent=text;}
 function save(){if(!draftKey)return;try{sessionStorage.setItem(draftKey,JSON.stringify({strokes,text:$('#guess')?.value||''}));}catch{say('草稿無法存入這個分頁，重新整理前請先送出。');}}
 function forget(){if(draftKey)sessionStorage.removeItem(draftKey);draftKey='';}
 async function api(route,data){return RoomApi.request(route,data,{code,room:'telephone',session:true,signal:lifetime.signal,onKicked:()=>{RoomReconnect.forget(code);location.replace('/?game=telephone');}});}
 function command(action,extra={}){return mutate('action',{action,stepId:state.stepId,requestId:crypto.randomUUID(),...extra});}
 async function mutate(route,data){
  if(busy||disposed)return;const scope=lifetime;finishStroke();busy=true;failed=null;$('#retry').hidden=true;lock();say('');
  try{const next=await api(route,data);if(scope!==lifetime||disposed)return false;render(next);return true;}
  catch(e){if(!disposed&&e.name!=='AbortError'){say(e.message+(e.status?'':'；結果尚未確認，可重試同一操作。'));if(!e.status){failed={route,data};$('#retry').hidden=false;}}return false;}
  finally{busy=false;if(!disposed){lock();await refresh();}}
 }
 function btn(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
 function lock(){if(botControl)botControl.disabled=busy;for(const n of $('#controls').querySelectorAll('button,input,select,textarea'))n.disabled=busy;$('#advance').disabled=busy||!state?.canAdvance;$('#leave').disabled=busy;$('#retry').disabled=busy;const submit=$('#submit');if(submit)submit.disabled=busy||!!state.task?.submitted||(state.task?.kind==='drawing'?!strokes.length:!$('#guess')?.value.trim());$('#drawing')?.setAttribute('aria-disabled',String(busy||!!state.task?.submitted));}
 function paint(canvas,items){const r=StrokeCanvas.createRenderer(canvas,{atomicPresentation:true,maxPoints:3000,maxStrokes:100});r.render(items);return r;}
 function finishStroke(){if(!active)return;active=null;pointer=null;renderer?.render(strokes);save();lock();}

 function board(box,title,editable){
  const area=el('div');area.className='telephone-board ui-drawing-board';
  const head=el('div');head.className='board-head';const heading=el('div');heading.className='board-heading';heading.append(el('h3',title));head.append(heading);
  const countdown=el('div');countdown.id='telephoneCountdown';countdown.className='draw-countdown';const caption=el('span',editable?'作畫剩餘':'猜詞剩餘');caption.className='draw-timer-caption';
  const time=el('b');time.id='telephoneTimer';time.className='draw-timer';time.setAttribute('role','timer');
  const track=el('div');track.id='telephoneTimerTrack';track.className='draw-timer-track ui-timebar ui-timebar-smooth';const progress=el('progress');progress.id='telephoneTimerProgress';progress.max=1;progress.value=1;progress.className='ui-sr-only';progress.setAttribute('aria-label','本頁剩餘時間');
  const fill=el('span');fill.className='ui-timebar-fill';fill.setAttribute('aria-hidden','true');track.append(progress,fill);countdown.append(caption,time,track);
  const frame=el('div');frame.className='canvas-frame';const canvas=el('canvas');canvas.id=editable?'drawing':'telephonePrevious';canvas.width=512;canvas.height=256;canvas.tabIndex=0;canvas.setAttribute('aria-label',editable?'本頁私人畫布；滑鼠、觸控或方向鍵加空白鍵作畫':'上一位玩家的畫作');frame.append(canvas);area.append(head,countdown,frame);box.append(area);
  countdownBar=window.CountdownBar?.create(fill,{reducedMotion:()=>window.matchMedia('(prefers-reduced-motion:reduce)').matches});tick();return {area,canvas};
 }
 function tick(){
  const label=$('#telephoneTimer'),progress=$('#telephoneTimerProgress');if(!label||!progress)return;
  const timed=state?.phase==='passing'&&Number.isFinite(state.deadline)&&!state.task?.submitted;$('#telephoneCountdown').hidden=!timed;
  if(!timed){countdownBar?.reset();return;}
  const remaining=Math.max(0,state.deadline-(Date.now()-clockOffset)),seconds=Math.ceil(remaining/1000),urgent=seconds<=10;
  label.textContent=seconds+' 秒';label.className='draw-timer'+(urgent?' urgent':'');$('#telephoneTimerTrack').className='draw-timer-track ui-timebar ui-timebar-smooth'+(urgent?' urgent':'');progress.value=Math.min(1,remaining/(state.options.seconds*1000));progress.setAttribute('aria-valuetext','剩餘 '+seconds+' 秒');
  countdownBar?.sync({key:state.stepId,deadline:state.deadline,duration:state.options.seconds*1000,offset:clockOffset,visible:!document.hidden});
 }
 function drawControls(box,saved){
  const {area,canvas}=board(box,state.task.previous.text,true),tools=el('div');tools.className='tools';const row=el('div');row.className='tool-row';row.setAttribute('role','group');row.setAttribute('aria-label','繪畫工具');let mode='brush',filled=false,cursor=[256,128];const buttons=[];
  const iconButton=(key,label,fn)=>{const b=btn(label,fn);b.className='ui-icon-button';b.innerHTML=StrokeCanvas.iconMarkup(key);b.setAttribute('aria-label',label);b.setAttribute('title',label);b.setAttribute('data-ui-hint','');return b;};
  for(const [value,fill,label]of [['brush',false,'畫筆'],['erase',false,'橡皮擦'],['line',false,'直線'],['rect',false,'空心矩形'],['ellipse',false,'空心橢圓'],['rect',true,'實心矩形'],['ellipse',true,'實心橢圓'],['fill',false,'油漆桶：填滿連續區域']]){
   const b=iconButton(value+(fill?'Filled':''),label,()=>{finishStroke();mode=value;filled=fill;for(const item of buttons)item.setAttribute('aria-pressed',String(item===b));});b.setAttribute('data-tool',value);b.setAttribute('aria-pressed',String(value==='brush'));buttons.push(b);row.append(b);
  }
  row.append(iconButton('undo','復原上一筆',()=>{finishStroke();strokes.pop();renderer.render(strokes);save();lock();}),iconButton('clear','清空畫布',()=>{if(!strokes.length||!confirm('清除這頁草稿？'))return;finishStroke();strokes=[];renderer.render(strokes);save();lock();}));
  const colorRow=el('div');colorRow.className='color-row';const colorPick=el('label');colorPick.className='color-pick';const color=el('input');color.type='color';color.id='color';color.value='#273942';color.setAttribute('aria-label','選擇顏色');colorPick.append(color);
  const menu=el('details');menu.className='color-menu';menu.id='telephoneColorMenu';const summary=el('summary','調色盤');const swatches=el('div');swatches.className='swatches';swatches.setAttribute('aria-label','常用顏色');
  for(const value of ['#273942','#ffffff','#e45757','#f3a844','#f4d264','#6bb879','#5197ca','#8058ad','#d979a7','#8b6348']){const b=btn('',()=>{color.value=value;menu.open=false;summary.focus();});b.style.background=value;b.setAttribute('aria-label','選擇 '+value);swatches.append(b);}menu.append(summary,swatches);
  const sizePick=el('label','筆刷');sizePick.className='size-pick';const size=el('input');size.type='range';size.id='size';size.min=1;size.max=40;size.value=6;size.setAttribute('aria-label','筆刷寬度');const sizeValue=el('output','6');size.oninput=()=>sizeValue.textContent=size.value;sizePick.append(size,sizeValue);colorRow.append(colorPick,menu,sizePick);tools.append(row,colorRow);area.append(tools);
  window.GameUI?.bindPopover?.(menu,swatches,{align:'start'});
  strokes=Array.isArray(saved?.strokes)?saved.strokes:[];try{renderer=paint(canvas,strokes);}catch{strokes=[];renderer=paint(canvas,strokes);say('草稿格式無法讀取，已建立空白畫布。');}
  const total=()=>strokes.reduce((n,s)=>n+s.points.length,0),allowed=()=>!busy&&!state.task.submitted;
  canvas.onpointerdown=e=>{if(!allowed()||active||e.button!==0)return;if(strokes.length>=100||total()>=3000){say('畫作已達本頁上限，請復原或送出。');return;}e.preventDefault();const p=StrokeCanvas.pointFrom(e,canvas,512,256);cursor=p;
   const stroke={tool:mode,color:color.value,size:Number(size.value),points:[p],filled};strokes.push(stroke);if(mode==='fill'){renderer.render(strokes);save();lock();return;}
   active=stroke;pointer=e.pointerId;canvas.setPointerCapture(pointer);renderer.render(strokes);lock();};
  canvas.onpointermove=e=>{if(!active||e.pointerId!==pointer)return;e.preventDefault();const p=StrokeCanvas.pointFrom(e,canvas,512,256),last=active.points.at(-1);if(p[0]===last[0]&&p[1]===last[1])return;
   if(['brush','erase'].includes(active.tool)){if(total()>=3000||active.points.length>=256){finishStroke();return;}active.points.push(p);}else{if(active.points.length===1&&total()>=3000){finishStroke();return;}active.points=[active.points[0],p];}cursor=p;renderer.render(strokes);};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(e.pointerId===pointer)finishStroke();};
  canvas.onkeydown=e=>{if(!allowed())return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(moves[e.key]){e.preventDefault();cursor=[Math.max(0,Math.min(511,cursor[0]+moves[e.key][0])),Math.max(0,Math.min(255,cursor[1]+moves[e.key][1]))];say('畫布位置 '+(cursor[0]+1)+'，'+(cursor[1]+1)+'；按空白鍵落筆。');}
   if(e.key===' '){e.preventDefault();if(strokes.length>=100||total()>=3000)return;strokes.push({tool:mode==='fill'?'fill':'brush',color:color.value,size:Number(size.value),points:[cursor.slice()]});renderer.render(strokes);save();lock();}};
 }
 function showBook(index){const book=state.books[index],box=$('#book');box.replaceChildren();if(!book)return;box.append(el('h3',book.ownerName+' 的傳遞簿'));for(const [i,p]of book.pages.entries()){const card=el('article');card.className='page-card ui-content-card';card.append(el('h4',(i?'第 '+i+' 頁':'起始情境')+' · '+p.authorName));if(p.kind==='text')card.append(el('p',p.text));else{if(p.skipped)card.append(el('p','本頁略過'));const canvas=el('canvas');canvas.width=512;canvas.height=256;canvas.setAttribute('aria-label',p.authorName+' 的畫作');card.append(canvas);paint(canvas,p.strokes);}box.append(card);}}
 function render(next){
  if(disposed||next.type!=='telephone'||state&&next.version<state.version)return;state=next;if(Number.isFinite(next.serverNow))clockOffset=Date.now()-next.serverNow;window.RoomWaiting?.update(next);$('#game').hidden=false;$('#connection').textContent='';$('#roomTag').textContent='房號 '+code;$('#leave').hidden=false;
  $('#phase').textContent=state.phase==='passing'?'第 '+state.round+'／'+state.roundLimit+' 頁 · '+(state.task.kind==='drawing'?'畫圖':'猜詞'):state.phase==='finished'?(state.interrupted?'傳遞中止，回看已送出的頁面':'全部揭曉！'):'等待入座';
  $('#players').replaceChildren(...state.players.map(p=>{const card=el('article');card.className='player-card';card.append(el('strong',p.name+(p.id===state.me?'（你）':'')),el('p',(p.bot?'腳本夥伴':p.offline?'離線':'在線')+(p.ready?' · 已送出':'')));return card;}));
  $('#readiness').textContent=state.phase==='passing'?(state.players.filter(p=>!p.ready).map(p=>p.name).join('、')||'全員已送出')+(state.canAdvance?'，房主可傳下一頁':''):'固定入座順序傳遞，不計個人分數。';$('#advance').hidden=state.phase!=='passing'||state.host!==state.me;
  const nextKey=JSON.stringify([state.phase,state.stepId,state.host,state.task?.submitted,state.options,state.players.length<8]);
  if(nextKey!==key){key=nextKey;window.RoomWaiting?.setRosterAction?.(null);botControl=null;finishStroke();const previousDraft=draftKey;const nextDraft=state.phase==='passing'&&!state.task.submitted?'telephone:'+code+':'+state.me+':'+state.stepId:'';if(previousDraft&&previousDraft!==nextDraft)forget();draftKey=nextDraft;strokes=[];renderer=null;countdownBar?.reset();countdownBar=null;$('#controls').replaceChildren();$('#previous').replaceChildren();$('#books').replaceChildren();$('#book').replaceChildren();const box=$('#controls');
   if(['waiting','finished'].includes(state.phase)){
    if(state.host===state.me){const label=el('label','獨立情境題庫');label.htmlFor='sources';const sources=el('select');sources.id='sources';for(const [value,text]of [['both','生活＋奇想'],['everyday','生活情境'],['silly','奇想情境']]){const o=el('option',text);o.value=value;sources.append(o);}sources.onchange=()=>mutate('settings',{sources:sources.value==='both'?['everyday','silly']:[sources.value]});sources.value=state.options.sources.length===2?'both':state.options.sources[0];const group=el('div');group.className='ui-control-group';const field=el('div');field.className='ui-field';const row=el('div');row.className='ui-control-row ui-field-actions';row.append(sources,btn(state.phase==='waiting'?'開始傳遞':'再來一場',()=>mutate('start',{})));field.append(label,row);group.append(field);if(state.players.length<8){botControl=btn('加入 AI 測試夥伴',()=>mutate('bot',{}));if(!window.RoomWaiting?.setRosterAction?.(botControl)){const actions=el('div');actions.className='ui-control-row ui-field-actions';actions.append(botControl);group.append(actions);}}box.append(group);}
    else box.append(el('p','等待房主開始。至少三人，可加入腳本夥伴試玩。'));
    if(state.phase==='finished'){const select=el('select');select.setAttribute('aria-label','選擇傳遞簿');for(const [i,b]of state.books.entries()){const o=el('option',b.ownerName+' 的故事');o.value=i;select.append(o);}select.onchange=()=>showBook(Number(select.value));$('#books').append(select);showBook(0);}
   }else{
    const p=state.task.previous;if(state.task.submitted&&p.kind==='text')$('#previous').append(el('h3',p.text));
    if(state.task.submitted)box.append(el('p','這頁已送出，等待全桌傳下一頁；其他頁面仍保密。'));
    else{let saved;try{saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');}catch{say('草稿無法讀取。');}
     if(state.task.kind==='drawing')drawControls(box,saved);
     else{const {canvas}=board(box,'只看這張圖，猜一句話',false);paint(canvas,p.strokes);if(p.skipped)box.append(el('p','上一頁略過，可自由猜或略過。'));const label=el('label','你覺得圖上是什麼？');label.htmlFor='guess';const input=el('input');input.id='guess';input.maxLength=80;input.value=saved?.text||'';input.oninput=()=>{save();lock();};box.append(label,input);}
     const warning=el('p','送出後不能修改，等全桌準備好才傳下一頁。');warning.id='submitWarning';
     const submit=btn('確認送出這一頁',()=>{finishStroke();return command('submit',state.task.kind==='drawing'?{strokes}:{text:$('#guess').value});});submit.id='submit';submit.setAttribute('aria-describedby','submitWarning');warning.className='telephone-status';const actions=el('div');actions.className='telephone-actions';actions.append(submit,btn('略過這頁',()=>{if(confirm('這頁會標記為略過，確定嗎？'))return command('skip');}));box.append(warning,actions);
    }
   }
  }lock();tick();
 }
 async function refresh(){if(disposed||reading)return;const scope=lifetime;reading=true;try{const next=await api('state');if(scope===lifetime&&!disposed)render(next);}catch(e){if(scope===lifetime&&!disposed&&e.name!=='AbortError')$('#connection').textContent='連線中斷：'+e.message+'；草稿不會自動送出。';}finally{reading=false;}}
 async function start(){disposed=false;const scope=lifetime=new AbortController();try{await RoomReconnect.restore(code,'telephone','#connection',{signal:scope.signal});if(disposed||scope!==lifetime)return;await refresh();if(!disposed&&scope===lifetime){timer=setInterval(()=>{if(!document.hidden)refresh();},2000);countdownTimer=setInterval(tick,250);}}catch(e){if(scope===lifetime&&e.name!=='AbortError')say(e.message);}}
 $('#advance').onclick=()=>command('advance');$('#retry').onclick=()=>{if(failed)mutate(failed.route,failed.data);};
 $('#leave').onclick=async()=>{if(busy||!confirm(state.phase==='passing'?'離席會中止全桌傳遞並揭曉已送出的頁面，確定離開？':'離開房間？'))return;if(await mutate('leave',{})){forget();RoomReconnect.forget(code);location.replace('/?game=telephone');}};
 if(!code){$('#guide').open=true;$('#connection').textContent='從大廳選擇傳情畫意，開房後就能玩。';return;}
 window.addEventListener('pagehide',()=>{finishStroke();save();disposed=true;clearInterval(timer);clearInterval(countdownTimer);countdownBar?.reset();lifetime?.abort();});window.addEventListener('pageshow',e=>{if(e.persisted){clearInterval(timer);clearInterval(countdownTimer);start();}});document.addEventListener('visibilitychange',()=>{if(document.hidden)countdownBar?.reset();else{tick();refresh();}});start();
})();
