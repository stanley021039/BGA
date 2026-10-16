/* Room-only public markers. No global hooks, private content or third-party art. */
(()=>{
 'use strict';
 const M=window.PingModel;if(!M)return;
 let state,context,stream,held=false,pUsed=false,gesture=null,armed=null,enabled=true,offset=0,raf=0,suppressUntil=0,noticeTimer,preferences=M.preferences();
 const seen=new Set(),marks=[],pointers=new Set();
 const layer=document.createElement('div');layer.className='room-ping-layer';layer.setAttribute('data-game-focus-overlay','');document.body.append(layer);
 const status=document.createElement('div');status.className='room-ping-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');layer.append(status);
 const wheel=document.createElement('div');wheel.className='room-ping-wheel';wheel.hidden=true;wheel.setAttribute('role','group');wheel.setAttribute('aria-label','快速標記：方向鍵選擇，Enter確認，Esc取消');layer.append(wheel);
 const control=(label,icon,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;window.GameUI?.decorateButton(b,icon,{iconOnly:true,label});b.onclick=fn;return b;};
 const visibility=control('接收標記：開啟','check',()=>{enabled=!enabled;visibility.setAttribute('aria-pressed',String(enabled));window.GameUI?.decorateButton(visibility,enabled?'check':'close',{iconOnly:true,label:'接收標記：'+(enabled?'開啟':'關閉')});if(!enabled)clearMarks();});
 function notify(text){status.textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{status.textContent='';},3500);}
 function syncLayer(){const host=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;if(layer.parentElement!==host)host.append(layer);}
 function open(x,y){syncLayer();wheel.hidden=false;wheel.style.left=Math.max(110,Math.min(innerWidth-110,x))+'px';wheel.style.top=Math.max(110,Math.min(innerHeight-110,y))+'px';highlight('ping');}
 function highlight(type){for(const b of wheel.querySelectorAll('[data-ping-type]'))b.classList.toggle('is-selected',b.dataset.pingType===type);}
 for(const [type,def]of Object.entries(M.types)){const b=control(def.label,def.icon,()=>{armed=type;wheel.hidden=true;notify('點選要標記的位置；Esc 取消');});b.dataset.pingType=type;b.classList.remove('ui-icon-button');b.removeAttribute('title');for(const [key,value]of Object.entries({background:'transparent',color:'var(--ping-color)',border:'0',borderRadius:'50%'}))b.style.setProperty(key==='borderRadius'?'border-radius':key,value,'important');const label=document.createElement('small');label.textContent=def.label;b.append(label);wheel.append(b);}
 const options=document.createElement('div');options.className='room-ping-settings';options.append(visibility);wheel.append(options);
 function renderIcon(node,type){node.innerHTML=window.GameUI?.icon(M.types[type].icon)||'';const url=preferences[type].imageUrl;if(!url)return;const img=document.createElement('img');img.src=url;img.alt='';img.onerror=()=>{node.innerHTML=window.GameUI?.icon(M.types[type].icon)||'';};node.replaceChildren(img);}
 // Integration seam for #142. Absent selections always mean built-in image + silence.
 function setPreferences(value){preferences=M.preferences(value);for(const b of wheel.querySelectorAll('[data-ping-type]')){const slot=b.querySelector('.ui-button-icon');if(slot)renderIcon(slot,b.dataset.pingType);}}
 function editing(node){return !!node?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],iframe');}
 function anchorEntries(){
  const pairs=[['header',document.querySelector('[data-site-header]'),'頁首'],['chat',document.querySelector('.ui-room-chat,#chat-content,.shared-chat,#shared-chat,.room-stage-chat'),'聊天室'],['players',document.querySelector('#waitingRoster,#shared-players,.room-stage-friends'),'玩家區']];
  if(state?.type==='lobby')pairs.push(['lobby-stage',document.querySelector('#lobbyStage'),'好友大廳'],['game-list',document.querySelector('.game-carousel-section'),'遊戲選單'],['room-list',document.querySelector('#roomList'),'房間列表']);
  for(const p of state?.players||[]){const candidates=[...document.querySelectorAll('[data-player-id]')].filter(n=>n.dataset.playerId===p.id&&n.matches('.ui-room-roster-card,.q-player-card,.player,.player-card,.ui-player-row,.waiting-player,.room-player,.shared-player,.ui-player,.room-waiting-player,.lobby-avatar'));const n=candidates.find(n=>n.getClientRects().length)||candidates[0];if(n)pairs.push(['player:'+p.id,n,p.name]);}
  return pairs.filter(([,n])=>n);
 }
 function canvas(){return state?.type==='draw'?document.querySelector('canvas#drawCanvas'):null;}
 function capture(node,x,y){
  if(node.closest?.('.chip-row,.q-player-tray,#hand,.hand,[data-private]'))return {kind:'viewport',x:x/innerWidth,y:y/innerHeight};
  const cell=state?.type==='thunder'&&node.closest?.('#track .cell-interactive[data-x][data-y]');if(cell)return {kind:'surface',key:'race-cell:'+cell.dataset.x+':'+cell.dataset.y,epoch:context.scene,...M.point(cell.getBoundingClientRect(),x,y)};
  const c=canvas();if(c&&(node===c||c.contains(node))){const r=c.getBoundingClientRect();if(!r.width||!r.height)return {kind:'viewport',x:x/innerWidth,y:y/innerHeight};return {kind:'surface',key:'draw-canvas',epoch:context.scene,...M.point(r,x,y)};}
  for(const [key,n]of anchorEntries().reverse())if(n.contains(node)){const r=n.getBoundingClientRect();if(r.width&&r.height)return {kind:'element',key,...M.point(r,x,y)};}
  return {kind:'viewport',x:Math.max(0,Math.min(1,x/innerWidth)),y:Math.max(0,Math.min(1,y/innerHeight))};
 }
 function resolve(target,event){
  if(event.scene!==context.scene)return {x:innerWidth/2,y:72,label:'畫面已更新'};
  if(target.kind==='viewport')return {...M.place({left:0,top:0,width:innerWidth,height:innerHeight},target,innerWidth,innerHeight),label:'畫面位置'};
  const race=/^race-cell:([0-5]):([0-9]{1,6})$/.exec(target.key||'');
  const raceCell=race&&state.type==='thunder'?document.querySelector('#track .cell-interactive[data-x="'+race[1]+'"][data-y="'+race[2]+'"]'):null;
  const found=race&&target.epoch===context.scene?(raceCell?[target.key,raceCell,'賽道第 '+(Number(race[2])+1)+' 段']:null):target.kind==='surface'?(target.epoch===context.scene&&canvas()?[target.key,canvas(),'畫布']:null):anchorEntries().find(([key])=>key===target.key);
  if(!found||!found[1].isConnected||!found[1].getClientRects().length)return {x:innerWidth/2,y:72,label:'目標目前不可見'};
  const r=found[1].getBoundingClientRect(),position=M.place(r,target,innerWidth,innerHeight);
  // Detect clipping by scroll containers as well as the viewport.
  let minX=0,minY=0,maxX=innerWidth,maxY=innerHeight;
  for(let p=found[1].parentElement;p&&p!==document.body;p=p.parentElement){const cs=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(cs.overflowX)){minX=Math.max(minX,b.left);maxX=Math.min(maxX,b.right);}if(/auto|scroll|hidden|clip/.test(cs.overflowY)){minY=Math.max(minY,b.top);maxY=Math.min(maxY,b.bottom);}}
  const rawX=r.left+r.width*target.x,rawY=r.top+r.height*target.y;
  position.edge ||=rawX<minX||rawX>maxX||rawY<minY||rawY>maxY;
  if(position.edge){if(Math.abs(position.dx)>Math.abs(position.dy))position.x=position.dx>0?innerWidth-32:32;else position.y=position.dy>0?innerHeight-48:48;}
  return {...position,label:found[2]};
 }
 function clearMarks(){for(const m of marks)m.node.remove();marks.length=0;cancelAnimationFrame(raf);raf=0;}
 function paint(){raf=0;const now=Date.now()-offset;for(let i=marks.length-1;i>=0;i--){const m=marks[i];if(m.event.expiresAt<=now){m.node.remove();marks.splice(i,1);continue;}const p=resolve(m.event.target,m.event);m.node.style.left=p.x+'px';m.node.style.top=p.y+'px';const label=m.event.name+'：'+M.types[m.event.type].label+(p.edge?' · '+(Math.abs(p.dx)>Math.abs(p.dy)?p.dx>0?'→':'←':p.dy>0?'↓':'↑')+' '+p.label:p.label==='畫面已更新'||p.label==='目標目前不可見'?' · '+p.label:'');if(m.caption.textContent!==label)m.caption.textContent=label;const half=m.caption.getBoundingClientRect().width/2;m.caption.style.transform='translateX('+(Math.max(half+8,Math.min(innerWidth-half-8,p.x))-p.x)+'px)';}if(marks.length)raf=requestAnimationFrame(paint);}
 function receive(event,serverNow){
  if(!context||event.roomInstanceId!==context.roomInstanceId||seen.has(event.id))return;seen.add(event.id);while(seen.size>256)seen.delete(seen.values().next().value);
  if(!M.types[event.type]||document.hidden||!enabled||event.expiresAt<=serverNow||serverNow-event.at>5000||serverNow<event.at-1000)return;
  offset=Date.now()-serverNow;const n=document.createElement('div');n.className='room-ping-mark';n.dataset.type=event.type;
  const icon=document.createElement('strong');renderIcon(icon,event.type);const caption=document.createElement('span');n.append(icon,caption);layer.append(n);marks.push({node:n,caption,event});while(marks.length>8)marks.shift().node.remove();
  notify(event.name+'：'+M.types[event.type].label);const sound=preferences[event.type].sound;if(sound?.effect)window.AudioSettings?.playEffect(sound.effect);else if(sound)window.AudioSettings?.playExpression(sound);if(!raf)raf=requestAnimationFrame(paint);
 }
 async function send(type,target){
  const current=context,code=state?.code;if(!current||!code)return;
  try{const res=await fetch('/api/pings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,type,target,requestId:crypto.randomUUID(),roomInstanceId:current.roomInstanceId,scene:current.scene})});const result=await res.json();if(context?.roomInstanceId!==current.roomInstanceId||context?.scene!==current.scene)return;if(!res.ok)throw Error(result.error||'標記傳送失敗');receive(result.event,result.serverNow??result.event.at);}catch(e){if(context?.roomInstanceId===current.roomInstanceId)notify(e.message);}
 }
 function cancel(){held=false;gesture=null;armed=null;wheel.hidden=true;status.textContent='';}
 function disconnect(){stream?.close();stream=null;cancel();clearMarks();}
 function connect(){
  if(!state?.code||!context||document.hidden||stream)return;const current=context,source=new EventSource('/api/pings/events?code='+encodeURIComponent(state.code));stream=source;
  source.addEventListener('ready',e=>{if(stream!==source)return;const value=JSON.parse(e.data);if(value.roomInstanceId!==current.roomInstanceId){disconnect();return;}offset=Date.now()-value.serverNow;});
  source.addEventListener('ping',e=>{if(stream!==source)return;const value=JSON.parse(e.data);receive(value.event,value.serverNow);});
  source.onerror=()=>{if(stream===source){cancel();clearMarks();}};
 }
 function update(s){
  if(!s.pingContext)return;const changed=context?.roomInstanceId!==s.pingContext.roomInstanceId||state?.me!==s.me;
  if(changed){disconnect();seen.clear();}state=s;context=s.pingContext;offset=Date.now()-s.serverNow;
  layer.classList.toggle('room-ping-still',window.MotionPolicy?.allowsMotion?.()===false);syncLayer();connect();if(marks.length&&!raf)raf=requestAnimationFrame(paint);
 }
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(gesture||armed||!wheel.hidden)){e.preventDefault();e.stopImmediatePropagation();cancel();return;}if(!wheel.hidden&&['ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter'){armed=wheel.querySelector('.is-selected')?.dataset.pingType||'ping';wheel.hidden=true;notify('點選要標記的位置；Esc 取消');}else highlight({ArrowUp:'attention',ArrowLeft:'question',ArrowDown:'help',ArrowRight:'look'}[e.key]);return;}if(e.code==='KeyP'&&!e.repeat&&!e.isComposing&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!pointers.size&&!editing(e.target)&&context){held=true;pUsed=false;e.preventDefault();}},true);
 window.addEventListener('keyup',e=>{if(e.code!=='KeyP')return;if(held&&!pUsed&&context){open(innerWidth/2,innerHeight/2);wheel.querySelector('button').focus();}held=false;},true);
 window.addEventListener('pointerdown',e=>{
  if(e.button===2&&(gesture||armed||!wheel.hidden)){e.preventDefault();e.stopImmediatePropagation();cancel();suppressUntil=Date.now()+400;return;}
  if(!context||e.button!==0||pointers.size||editing(e.target)||wheel.contains(e.target)){pointers.add(e.pointerId);return;}
  if(!held&&!armed){if(!wheel.hidden)cancel();pointers.add(e.pointerId);return;}
  pUsed=true;const target=capture(e.target,e.clientX,e.clientY);e.preventDefault();e.stopImmediatePropagation();
  if(armed){const type=armed;cancel();send(type,target);suppressUntil=Date.now()+400;return;}
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,target,type:'ping',moved:false};
 },true);
 window.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id)return;e.preventDefault();e.stopImmediatePropagation();gesture.type=M.pick(e.clientX-gesture.x,e.clientY-gesture.y);if(gesture.type!=='ping'){gesture.moved=true;if(wheel.hidden)open(gesture.x,gesture.y);}highlight(gesture.type);},true);
 window.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(!gesture||e.pointerId!==gesture.id)return;e.preventDefault();e.stopImmediatePropagation();const g=gesture,type=g.type;suppressUntil=Date.now()+400;cancel();if(type!=='ping'||!g.moved)send(type,g.target);},true);
 window.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('contextmenu',e=>{if(gesture||armed||!wheel.hidden||Date.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
 window.addEventListener('pointercancel',()=>{pointers.clear();cancel();},true);
 window.addEventListener('blur',()=>{pointers.clear();cancel();});window.addEventListener('pagehide',disconnect);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){disconnect();pointers.clear();}else connect();});
 if(window.MutationObserver)new window.MutationObserver(entries=>{if(entries.some(e=>e.target.tagName==='DIALOG'))syncLayer();}).observe(document.body,{attributes:true,attributeFilter:['open'],subtree:true});
 window.RoomPings={update,disconnect,setPreferences,stop(){disconnect();setPreferences();state=null;context=null;seen.clear();}};
})();
