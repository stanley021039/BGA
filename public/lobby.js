(()=>{
 const stage=document.querySelector('#lobbyStage'),layer=document.querySelector('#lobbyVisitors');
 if(!stage||!layer)return;
 const status=document.querySelector('#lobbyStatus'),count=document.querySelector('#lobbyCount');
 const marker=document.querySelector('#lobbyDestination'),toggle=document.querySelector('#lobbyEmoteToggle');
 const menu=document.querySelector('#lobbyEmoteMenu'),choices=document.querySelector('#lobbyEmoteChoices');
 const visitors=new Map();
 let inFlight=false,ready=false,queuedTarget=null,destination=null,emotesLoaded=false,positionReset=true;
 function closeMenu(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
 window.UIPopover?.bind(toggle,menu,{align:'end',onClose:closeMenu});
 function render(data){
  if(!data||!Array.isArray(data.visitors))throw Error('大廳資料格式不正確');
  const resetPositions=positionReset;positionReset=false;
  const active=new Set();
  for(const visitor of data.visitors){
   if(typeof visitor.id!=='string'||!Number.isFinite(visitor.x)||!Number.isFinite(visitor.y))continue;
   active.add(visitor.id);
   let node=visitors.get(visitor.id);
   const isNew=!node;
   if(!node){
    node=document.createElement('div');node.className='lobby-avatar';
    const bubble=document.createElement('div');bubble.className='lobby-speech';bubble.hidden=true;
    const image=document.createElement('img');image.alt='';image.draggable=false;
    const label=document.createElement('span');node.append(bubble,image,label);layer.append(node);visitors.set(visitor.id,node);
   }
   if(isNew||resetPositions){
    node.classList.add('is-placing');
    node.style.left=visitor.x+'%';node.style.top=visitor.y+'%';
    void node.offsetWidth;
   }
   if(isNew||resetPositions||node.dataset.moveId!==String(visitor.moveId)){
    // Even a short move should remain visible after network and polling delay.
    const duration=visitor.moveId===0?0:Math.max(350,Number(visitor.remainingMs)||0);
    node.style.setProperty('--lobby-move-duration',duration+'ms');
    node.classList.remove('is-placing');
    node.style.left=(visitor.moving?visitor.targetX:visitor.x)+'%';
    node.style.top=(visitor.moving?visitor.targetY:visitor.y)+'%';
    node.dataset.moveId=String(visitor.moveId);
   }
   node.style.zIndex=String(Math.round(visitor.y));
   node.classList.toggle('is-self',visitor.id===data.selfId);
   node.classList.toggle('is-moving',!!visitor.moving);
   node.classList.toggle('facing-left',visitor.facing==='left');
   const image=node.querySelector('img'),source=visitor.emote?.image||visitor.image;
   if(image.getAttribute('src')!==source)image.src=source;
   const bubble=node.querySelector('.lobby-speech');
   bubble.hidden=!visitor.emote;
   if(visitor.emote){
    bubble.textContent=visitor.emote.label;
    if(node.dataset.emoteAt!==String(visitor.emote.at)){
     node.dataset.emoteAt=String(visitor.emote.at);
     node.classList.remove('is-emoting');void node.offsetWidth;node.classList.add('is-emoting');
    }
   }else{node.classList.remove('is-emoting');delete node.dataset.emoteAt;}
   node.querySelector('span').textContent=visitor.name+(visitor.id===data.selfId?'（你）':'');
   if(visitor.id===data.selfId&&destination&&Math.hypot(visitor.x-destination.x,visitor.y-destination.y)<1){destination=null;marker.hidden=true;}
  }
  for(const [id,node] of visitors)if(!active.has(id)){node.remove();visitors.delete(id);}
  count.textContent=`${active.size} 位在大廳`;
  status.textContent='點擊場地，讓角色走到指定位置';
  ready=true;
 }
 async function sync(target){
  if(document.visibilityState==='hidden')return;
  if(inFlight){if(target)queuedTarget=target;return;}
  inFlight=true;
  try{
   const response=await fetch(target?'/api/lobby/move':'/api/lobby',target?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(target)}:{});
   if(!response.ok)throw Error(response.status===401?'登入已失效，請重新登入':'大廳暫時無法連線');
   render(await response.json());
  }catch(error){status.textContent=error.message;ready=false;}
  finally{inFlight=false;if(queuedTarget){const next=queuedTarget;queuedTarget=null;sync(next);}}
 }
 async function loadEmotes(){
  if(emotesLoaded)return;
  choices.textContent='載入中…';
  try{
   const response=await fetch('/api/lobby/emotes');if(!response.ok)throw Error('無法載入表情');
   const {emotes}=await response.json();
   choices.replaceChildren();
   if(!emotes.length){const empty=document.createElement('p');empty.textContent='這個角色尚無表情，可到「我的角色」新增。';choices.append(empty);}
   for(const emote of emotes){
    const button=document.createElement('button');button.type='button';button.className='lobby-emote-choice';button.setAttribute('aria-label',emote.label);
    const image=document.createElement('img');image.src=emote.image;image.alt='';
    const label=document.createElement('span');label.textContent=emote.label;
    button.append(image,label);
    button.addEventListener('click',()=>useEmote(emote.expression));choices.append(button);
   }
   emotesLoaded=true;
  }catch(error){choices.textContent=error.message;}
 }
 async function useEmote(expression){
  try{
   const response=await fetch('/api/lobby/emote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expression})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'無法使用表情');
   render(data);closeMenu();
  }catch(error){status.textContent=error.message;}
 }
 stage.addEventListener('click',event=>{
  if(!ready)return;
  const rect=stage.getBoundingClientRect();
  const target={x:Math.max(15,Math.min(85,(event.clientX-rect.left)/rect.width*100)),y:Math.max(32,Math.min(92,(event.clientY-rect.top)/rect.height*100))};
  destination=target;marker.style.left=target.x+'%';marker.style.top=target.y+'%';marker.hidden=false;
  closeMenu();stage.focus();sync(target);
 });
 toggle.addEventListener('click',()=>{
  if(!menu.hidden){closeMenu();return;}
  menu.hidden=false;toggle.setAttribute('aria-expanded','true');loadEmotes();
 });
 document.addEventListener('click',event=>{if(!event.target.closest('.lobby-emote-wrap'))closeMenu();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){positionReset=true;sync();}else closeMenu();});
 sync();setInterval(()=>sync(),500);
})();
