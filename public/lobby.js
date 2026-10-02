(()=>{
 const stage=document.querySelector('#lobbyStage'),layer=document.querySelector('#lobbyVisitors');
 if(!stage||!layer)return;
 const status=document.querySelector('#lobbyStatus'),count=document.querySelector('#lobbyCount');
 const arrows={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',W:'up',s:'down',S:'down',a:'left',A:'left',d:'right',D:'right'};
 const held=new Set(),visitors=new Map();
 let inFlight=false,ready=false;
 const interactive=target=>target instanceof Element&&!!target.closest('input,textarea,select,button,a,[contenteditable="true"]');
 function direction(){return {dx:Number(held.has('right'))-Number(held.has('left')),dy:Number(held.has('down'))-Number(held.has('up'))};}
 function render(data){
  if(!data||!Array.isArray(data.visitors))throw Error('大廳資料格式不正確');
  const active=new Set();
  for(const visitor of data.visitors){
   if(typeof visitor.id!=='string'||!Number.isFinite(visitor.x)||!Number.isFinite(visitor.y))continue;
   active.add(visitor.id);
   let node=visitors.get(visitor.id);
   if(!node){
    node=document.createElement('div');node.className='lobby-avatar';
    const image=document.createElement('img');image.alt='';image.draggable=false;image.src=visitor.image;
    const label=document.createElement('span');node.append(image,label);layer.append(node);visitors.set(visitor.id,node);
   }
   node.style.left=visitor.x+'%';node.style.top=visitor.y+'%';node.style.zIndex=String(Math.round(visitor.y));
   node.classList.toggle('is-self',visitor.id===data.selfId);
   node.classList.toggle('is-moving',!!visitor.moving);
   node.classList.toggle('facing-left',visitor.facing==='left');
   node.querySelector('span').textContent=visitor.name+(visitor.id===data.selfId?'（你）':'');
  }
  for(const [id,node] of visitors)if(!active.has(id)){node.remove();visitors.delete(id);}
  count.textContent=`${active.size} 位在大廳`;
  status.textContent='使用方向鍵、WASD 或下方按鈕移動你的角色';
  ready=true;
 }
 async function sync(move){
  if(inFlight||document.visibilityState==='hidden')return;
  inFlight=true;
  try{
   const response=await fetch(move?'/api/lobby/move':'/api/lobby',move?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(move)}:{});
   if(!response.ok)throw Error(response.status===401?'登入已失效，請重新登入':'大廳暫時無法連線');
   render(await response.json());
  }catch(error){status.textContent=error.message;ready=false;}
  finally{inFlight=false;}
 }
 function stopDirections(){held.clear();document.querySelectorAll('[data-lobby-direction]').forEach(button=>button.classList.remove('is-held'));}
 document.addEventListener('keydown',event=>{
  const dir=arrows[event.key];if(!dir||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
  if(interactive(event.target))return;
  held.add(dir);event.preventDefault();
 });
 document.addEventListener('keyup',event=>{const dir=arrows[event.key];if(dir){held.delete(dir);if(!interactive(event.target))event.preventDefault();}});
 document.addEventListener('focusin',event=>{if(interactive(event.target))stopDirections();});
 window.addEventListener('blur',stopDirections);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stopDirections();else sync();});
 stage.addEventListener('pointerdown',()=>stage.focus());
 document.querySelectorAll('[data-lobby-direction]').forEach(button=>{
  const dir=button.dataset.lobbyDirection;
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);held.add(dir);button.classList.add('is-held');});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{held.delete(dir);button.classList.remove('is-held');});
 });
 sync();
 setInterval(()=>{const move=direction();if(ready&&(move.dx||move.dy))sync(move);},100);
 setInterval(()=>{if(!inFlight)sync();},1800);
})();
