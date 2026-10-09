(function(){
 'use strict';
 const $=s=>document.querySelector(s),code=location.pathname.match(/\/telephone\/([a-f0-9]{6})\/?$/i)?.[1].toUpperCase();
 let state,busy=false,disposed=false,reading=false,lifetime,timer,key='',draftKey='',strokes=[],active=null,pointer=null,renderer=null,failed=null;
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
 function lock(){for(const n of $('#controls').querySelectorAll('button,input,select,textarea'))n.disabled=busy;$('#advance').disabled=busy||!state?.canAdvance;$('#leave').disabled=busy;$('#retry').disabled=busy;const submit=$('#submit');if(submit)submit.disabled=busy||!!state.task?.submitted||(state.task?.kind==='drawing'?!strokes.length:!$('#guess')?.value.trim());$('#drawing')?.setAttribute('aria-disabled',String(busy||!!state.task?.submitted));}
 function paint(canvas,items){const r=StrokeCanvas.createRenderer(canvas,{atomicPresentation:true,maxPoints:3000,maxStrokes:100});r.render(items);return r;}
 function finishStroke(){if(!active)return;active=null;pointer=null;renderer?.render(strokes);save();lock();}
 function drawControls(box,saved){
  const tools=el('div');tools.className='drawing-tools';
  const tool=el('select');tool.id='tool';tool.setAttribute('aria-label','畫筆工具');for(const [value,label]of [['brush','畫筆'],['erase','橡皮擦']]){const o=el('option',label);o.value=value;tool.append(o);}tool.value='brush';
  const color=el('input');color.type='color';color.id='color';color.value='#222222';color.setAttribute('aria-label','畫筆顏色');
  const size=el('select');size.id='size';size.setAttribute('aria-label','筆寬');for(const n of [2,4,8,16]){const o=el('option',n+' px');o.value=n;size.append(o);}size.value=4;
  tools.append(tool,color,size,btn('復原',()=>{finishStroke();strokes.pop();renderer.render(strokes);save();lock();}),btn('清除',()=>{if(!strokes.length||!confirm('清除這頁草稿？'))return;finishStroke();strokes=[];renderer.render(strokes);save();lock();}));
  const canvas=el('canvas');canvas.id='drawing';canvas.width=512;canvas.height=256;canvas.setAttribute('aria-label','本頁私人畫布');box.append(tools,canvas,el('p','最多 100 筆／3,000 點。畫作送出前只在這個分頁；完成傳遞後才向全桌揭曉。'));strokes=Array.isArray(saved?.strokes)?saved.strokes:[];
  try{renderer=paint(canvas,strokes);}catch{strokes=[];renderer=paint(canvas,strokes);say('草稿格式無法讀取，已建立空白画布。');}
  const total=()=>strokes.reduce((n,s)=>n+s.points.length,0);
  canvas.onpointerdown=e=>{if(busy||state.task.submitted||active||e.button!==0)return;if(strokes.length>=100||total()>=3000){say('畫作已達本頁上限，請復原或送出。');return;}e.preventDefault();const p=StrokeCanvas.pointFrom(e,canvas,512,256);active={tool:tool.value,color:color.value,size:Number(size.value),points:[p]};strokes.push(active);pointer=e.pointerId;canvas.setPointerCapture(pointer);StrokeCanvas.drawStroke(canvas.getContext('2d'),active);lock();};
  canvas.onpointermove=e=>{if(!active||e.pointerId!==pointer)return;e.preventDefault();const p=StrokeCanvas.pointFrom(e,canvas,512,256),last=active.points.at(-1);if(p[0]===last[0]&&p[1]===last[1])return;if(total()>=3000||active.points.length>=256){finishStroke();return;}active.points.push(p);StrokeCanvas.drawStroke(canvas.getContext('2d'),{...active,points:[last,p]});};
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=e=>{if(e.pointerId===pointer)finishStroke();};
 }
 function showBook(index){const book=state.books[index],box=$('#book');box.replaceChildren();if(!book)return;box.append(el('h3',book.ownerName+' 的傳遞簿'));for(const [i,p]of book.pages.entries()){const card=el('article');card.className='page-card';card.append(el('h4',(i?'第 '+i+' 頁':'起始情境')+' · '+p.authorName));if(p.kind==='text')card.append(el('p',p.text));else{if(p.skipped)card.append(el('p','本頁略過'));const canvas=el('canvas');canvas.width=512;canvas.height=256;canvas.setAttribute('aria-label',p.authorName+' 的畫作');card.append(canvas);paint(canvas,p.strokes);}box.append(card);}}
 function render(next){
  if(disposed||next.type!=='telephone'||state&&next.version<state.version)return;state=next;$('#game').hidden=false;$('#connection').textContent='';$('#roomTag').textContent='房號 '+code;$('#leave').hidden=false;
  $('#phase').textContent=state.phase==='passing'?'第 '+state.round+'／'+state.roundLimit+' 頁 · '+(state.task.kind==='drawing'?'畫圖':'猜詞'):state.phase==='finished'?(state.interrupted?'傳遞中止，回看已送出的頁面':'全部揭曉！'):'等待入座';
  $('#players').replaceChildren(...state.players.map(p=>{const card=el('article');card.className='player-card';card.append(el('strong',p.name+(p.id===state.me?'（你）':'')),el('p',(p.bot?'腳本夥伴':p.offline?'離線':'在線')+(p.ready?' · 已送出':'')));return card;}));
  $('#readiness').textContent=state.phase==='passing'?(state.players.filter(p=>!p.ready).map(p=>p.name).join('、')||'全員已送出')+(state.canAdvance?'，房主可傳下一頁':''):'固定入座順序傳遞，不計個人分數。';$('#advance').hidden=state.phase!=='passing'||state.host!==state.me;
  const nextKey=JSON.stringify([state.phase,state.stepId,state.host,state.task?.submitted,state.options]);
  if(nextKey!==key){key=nextKey;finishStroke();const previousDraft=draftKey;const nextDraft=state.phase==='passing'&&!state.task.submitted?'telephone:'+code+':'+state.me+':'+state.stepId:'';if(previousDraft&&previousDraft!==nextDraft)forget();draftKey=nextDraft;strokes=[];renderer=null;$('#controls').replaceChildren();$('#previous').replaceChildren();$('#books').replaceChildren();$('#book').replaceChildren();const box=$('#controls');
   if(['waiting','finished'].includes(state.phase)){
    if(state.host===state.me){const label=el('label','獨立情境題庫');label.htmlFor='sources';const sources=el('select');sources.id='sources';for(const [value,text]of [['both','生活＋奇想'],['everyday','生活情境'],['silly','奇想情境']]){const o=el('option',text);o.value=value;sources.append(o);}sources.value=state.options.sources.length===2?'both':state.options.sources[0];box.append(label,sources,btn('套用題庫',()=>mutate('settings',{sources:sources.value==='both'?['everyday','silly']:[sources.value]})),btn(state.phase==='waiting'?'開始傳遞':'再來一場',()=>mutate('start',{})));if(state.players.length<8)box.append(btn('加入腳本測試夥伴',()=>mutate('bot',{})));}
    else box.append(el('p','等待房主開始。至少三人，可加入腳本夥伴試玩。'));
    if(state.phase==='finished'){const select=el('select');select.setAttribute('aria-label','選擇傳遞簿');for(const [i,b]of state.books.entries()){const o=el('option',b.ownerName+' 的故事');o.value=i;select.append(o);}select.onchange=()=>showBook(Number(select.value));$('#books').append(select);showBook(0);}
   }else{
    const p=state.task.previous;if(p.kind==='text')$('#previous').append(el('h3','把這句畫出來'),el('p',p.text));else{const canvas=el('canvas');canvas.width=512;canvas.height=256;canvas.setAttribute('aria-label','上一位玩家的畫作');$('#previous').append(el('h3','只看這張圖，猜一句話'),canvas);if(p.skipped)$('#previous').append(el('p','上一頁略過，可自由猜或略過。'));paint(canvas,p.strokes);}
    if(state.task.submitted)box.append(el('p','這頁已送出，等待全桌傳下一頁；其他頁面仍保密。'));
    else{let saved;try{saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');}catch{say('草稿無法讀取。');}
     if(state.task.kind==='drawing')drawControls(box,saved);
     else{const label=el('label','你覺得圖上是什麼？');label.htmlFor='guess';const input=el('input');input.id='guess';input.maxLength=80;input.value=saved?.text||'';input.oninput=()=>{save();lock();};box.append(label,input);}
     const warning=el('p','送出後不能修改，等全桌準備好才傳下一頁。');warning.id='submitWarning';
     const submit=btn('確認送出這一頁',()=>{finishStroke();return command('submit',state.task.kind==='drawing'?{strokes}:{text:$('#guess').value});});submit.id='submit';submit.setAttribute('aria-describedby','submitWarning');box.append(warning,submit,btn('略過這頁',()=>{if(confirm('這頁會標記為略過，確定嗎？'))return command('skip');}));
    }
   }
  }lock();
 }
 async function refresh(){if(disposed||reading)return;const scope=lifetime;reading=true;try{const next=await api('state');if(scope===lifetime&&!disposed)render(next);}catch(e){if(scope===lifetime&&!disposed&&e.name!=='AbortError')$('#connection').textContent='連線中斷：'+e.message+'；草稿不會自動送出。';}finally{reading=false;}}
 async function start(){disposed=false;const scope=lifetime=new AbortController();try{await RoomReconnect.restore(code,'telephone','#connection',{signal:scope.signal});if(disposed||scope!==lifetime)return;await refresh();if(!disposed&&scope===lifetime)timer=setInterval(()=>{if(!document.hidden)refresh();},2000);}catch(e){if(scope===lifetime&&e.name!=='AbortError')say(e.message);}}
 $('#advance').onclick=()=>command('advance');$('#retry').onclick=()=>{if(failed)mutate(failed.route,failed.data);};
 $('#leave').onclick=async()=>{if(busy||!confirm(state.phase==='passing'?'離席會中止全桌傳遞並揭曉已送出的頁面，確定離開？':'離開房間？'))return;if(await mutate('leave',{})){forget();RoomReconnect.forget(code);location.replace('/?game=telephone');}};
 if(!code){$('#guide').open=true;$('#connection').textContent='從大廳選擇傳情畫意，開房後就能玩。';return;}
 window.addEventListener('pagehide',()=>{finishStroke();save();disposed=true;clearInterval(timer);lifetime?.abort();});window.addEventListener('pageshow',e=>{if(e.persisted){clearInterval(timer);start();}});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});start();
})();
