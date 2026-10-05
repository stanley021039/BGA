let selected='thunder',busy=false;const $=s=>document.querySelector(s);const titles={thunder:'末路狂飆',poker:'德州撲克',majority:'同頻俱樂部',gift:'送禮達人',draw:'你畫我猜'};
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4000);}
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{selected=b.dataset.game;const guide=$('#gameGuide');if(guide){guide.href=selected==='majority'?'/majority?learn=1':selected==='thunder'?'/race?learn=1':selected==='gift'?'/gift?learn=1':selected==='draw'?'/draw?learn=1':'/rules?game=poker';guide.textContent=selected==='majority'?'同頻俱樂部玩法 ↗':selected==='thunder'?'雷霆之路教學 ↗':selected==='gift'?'送禮達人玩法 ↗':selected==='draw'?'你畫我猜玩法 ↗':'德州撲克說明 ↗';}document.querySelectorAll('[data-game]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));x.querySelector('.select-label').textContent=x===b?'已選擇 ✓':'選擇遊戲 ↗';});$('#create').textContent=`建立${titles[selected]}房間 ↗`;$('#roomName').placeholder=selected==='majority'?'今晚跟誰同頻？':selected==='thunder'?'末路狂飆好友局':selected==='gift'?'送禮達人好友局':selected==='draw'?'你畫我猜好友局':'深夜好友局';});
async function enter(join,requestedCode){if(busy)return;const name=$('#name').value.trim();const code=(requestedCode||$('#code').value.trim()).toUpperCase();if(join&&!/^[A-F0-9]{6}$/.test(code))return toast('請輸入正確的 6 碼房間代碼');busy=true;$('#create').disabled=$('#join').disabled=true;document.querySelectorAll('.room-action').forEach(button=>button.disabled=true);try{const res=await fetch('/api/'+(join?'join':'create'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code,type:selected,roomName:$('#roomName').value.trim()})});const s=await res.json();if(!res.ok)throw Error(s.error);localStorage.setItem(s.type==='majority'?'ah-majority':s.type==='thunder'?'ah-thunder':s.type==='gift'?'ah-gift':s.type==='draw'?'ah-draw':'ah-session',JSON.stringify(s));localStorage.setItem((s.type==='majority'?'ah-majority:':s.type==='thunder'?'ah-thunder:':s.type==='gift'?'ah-gift:':s.type==='draw'?'ah-draw:':'ah-session:')+s.code,JSON.stringify(s));localStorage.setItem('ah-name',name);location.href=(s.type==='majority'?'/majority/':s.type==='thunder'?'/race/':s.type==='gift'?'/gift/':s.type==='draw'?'/draw/':'/poker/')+s.code;}catch(e){toast(e.message);busy=false;$('#create').disabled=$('#join').disabled=false;loadRooms();}}
$('#create').onclick=()=>enter(false);$('#join').onclick=()=>enter(true);$('#name').value=localStorage.getItem('ah-name')||'';$('#code').value=new URLSearchParams(location.search).get('room')||'';const resumeTypes=[['ah-draw','draw','/draw','返回你畫我猜'],['ah-gift','gift','/gift','返回送禮達人'],['ah-majority','majority','/majority','返回同頻俱樂部'],['ah-thunder','thunder','/race','返回賽車房間'],['ah-session','poker','/poker','返回撲克房間']];
function renderResume(rooms){
 const links=[];
 for(const [key,type,url,label] of resumeTypes){
  let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{localStorage.removeItem(key);continue;}
  if(!saved?.code)continue;
  if(!rooms.some(room=>room.code===saved.code&&room.type===type&&room.seated)){
   localStorage.removeItem(key+':'+saved.code);localStorage.removeItem(key);continue;
  }
  const link=document.createElement('a');link.href=url+'/'+saved.code;link.textContent=label+' →';
  link.onclick=async event=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   try{const response=await fetch('/api/rooms');if(!response.ok)throw Error('無法確認房間，請稍後重試');const {rooms}=await response.json();renderResume(rooms);
    if(rooms.some(room=>room.code===saved.code&&room.type===type&&room.seated))location.href=link.href;
    else{toast('房間已結束或你已離開，請重新開桌或加入房間');loadRooms();}
   }catch(error){toast(error.message);}
  };
  links.push(link);
 }
 $('#resume').replaceChildren(...links);
}

let invite=location.origin;fetch('/api/info').then(r=>r.json()).then(d=>invite=d.preferred||d.addresses.find(a=>a.includes('://26.'))||location.origin).catch(()=>{});$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(invite);toast('已複製好友連線網址');}catch{window.prompt('複製好友連線網址',invite);}};
if(new URLSearchParams(location.search).get('game')==='draw')document.querySelector('[data-game="draw"]').click();
if(new URLSearchParams(location.search).get('game')==='poker')document.querySelector('[data-game="poker"]').click();

if(new URLSearchParams(location.search).get('game')==='majority')document.querySelector('[data-game="majority"]').click();
if(new URLSearchParams(location.search).get('game')==='gift')document.querySelector('[data-game="gift"]').click();




fetch('/api/auth/me').then(r=>{if(!r.ok)throw Error('需要登入');return r.json();}).then(me=>{const name=$('#name');name.value=me.displayName;name.readOnly=true;}).catch(()=>location.href='/login');

function roomElement(room){
 const card=document.createElement('article');card.className='room-card';
 const details=document.createElement('div');details.className='room-details';
 const game=document.createElement('div');game.className='room-game';game.textContent=titles[room.type]||room.type;
 const name=document.createElement('h3');name.textContent=room.name;
 const meta=document.createElement('p');meta.textContent=`房號 ${room.code}　·　${room.playerCount}/${room.maxPlayers} 席`;
 details.append(game,name,meta);
 const side=document.createElement('div');side.className='room-side';
 const status=document.createElement('span');status.className='room-status'+(room.joinable?' is-open':'');
 status.textContent=room.seated?'已入座':room.kicked?'無法加入':room.phase==='waiting'?'等待玩家':room.phase==='showdown'?'本局結束':room.phase==='finished'?'遊戲結束':'遊戲進行中';
 const button=document.createElement('button');button.type='button';button.className='button '+(room.joinable?'orange':'outline')+' room-action';
 button.textContent=room.seated?'返回房間 →':room.joinable?'加入房間 →':room.kicked?'無法加入':room.playerCount>=room.maxPlayers?'人數已滿':'已開始';
 button.disabled=!room.joinable||busy;
 if(room.joinable)button.onclick=()=>enter(true,room.code);
 side.append(status,button);card.append(details,side);return card;
}

let roomsRequest=0;
async function loadRooms(){
 const request=++roomsRequest;$('#refreshRooms').disabled=true;
 try{
  const response=await fetch('/api/rooms');
  if(!response.ok)throw Error('無法取得房間，請稍後重試');
  const {rooms}=await response.json();if(request!==roomsRequest)return;
  renderResume(rooms);
  $('#roomsCount').textContent=`${rooms.length} 間房間`;
  if(!rooms.length){const empty=document.createElement('p');empty.className='rooms-message';empty.textContent='目前還沒有房間。選擇上方遊戲，開一桌邀請朋友吧！';$('#roomList').replaceChildren(empty);}
  else $('#roomList').replaceChildren(...rooms.map(roomElement));
 }catch(error){
  if(request!==roomsRequest)return;
  const message=document.createElement('p');message.className='rooms-message';message.textContent=error.message;$('#roomList').replaceChildren(message);
 }finally{if(request===roomsRequest)$('#refreshRooms').disabled=false;}
}
if(new URLSearchParams(location.search).has('closedRoom'))toast('房間已結束或你已離開，請重新開桌或加入房間');
$('#refreshRooms').onclick=loadRooms;
loadRooms();
setInterval(()=>{if(document.visibilityState==='visible'&&!busy)loadRooms();},10000);
