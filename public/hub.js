let selected='thunder',busy=false;const $=s=>document.querySelector(s);const titles={thunder:'末路狂飆',poker:'德州撲克',majority:'同頻俱樂部'};
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4000);}
document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{selected=b.dataset.game;const guide=$('#gameGuide');if(guide){guide.href=selected==='majority'?'/majority?learn=1':selected==='thunder'?'/race?learn=1':'/rules?game=poker';guide.textContent=selected==='majority'?'同頻俱樂部玩法 ↗':selected==='thunder'?'雷霆之路教學 ↗':'德州撲克說明 ↗';}document.querySelectorAll('[data-game]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));x.querySelector('.select-label').textContent=x===b?'已選擇 ✓':'選擇遊戲 ↗';});$('#create').textContent=`建立${titles[selected]}房間 ↗`;$('#roomName').placeholder=selected==='majority'?'今晚跟誰同頻？':selected==='thunder'?'末路狂飆好友局':'深夜好友局';});
async function enter(join,requestedCode){if(busy)return;const name=$('#name').value.trim();const code=(requestedCode||$('#code').value.trim()).toUpperCase();if(join&&!/^[A-F0-9]{6}$/.test(code))return toast('請輸入正確的 6 碼房間代碼');busy=true;$('#create').disabled=$('#join').disabled=true;document.querySelectorAll('.room-action').forEach(button=>button.disabled=true);try{const res=await fetch('/api/'+(join?'join':'create'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code,type:selected,roomName:$('#roomName').value.trim()})});const s=await res.json();if(!res.ok)throw Error(s.error);localStorage.setItem(s.type==='majority'?'ah-majority':s.type==='thunder'?'ah-thunder':'ah-session',JSON.stringify(s));localStorage.setItem((s.type==='majority'?'ah-majority:':s.type==='thunder'?'ah-thunder:':'ah-session:')+s.code,JSON.stringify(s));localStorage.setItem('ah-name',name);location.href=(s.type==='majority'?'/majority/':s.type==='thunder'?'/race/':'/poker/')+s.code;}catch(e){toast(e.message);busy=false;$('#create').disabled=$('#join').disabled=false;loadRooms();}}
$('#create').onclick=()=>enter(false);$('#join').onclick=()=>enter(true);$('#name').value=localStorage.getItem('ah-name')||'';$('#code').value=new URLSearchParams(location.search).get('room')||'';for(const [key,url,label]of [['ah-majority','/majority','返回同頻俱樂部'],['ah-thunder','/race','返回賽車房間'],['ah-session','/poker','返回撲克房間']]){try{if(JSON.parse(localStorage.getItem(key)||'null')?.code){const a=document.createElement('a');a.href=url+'/'+JSON.parse(localStorage.getItem(key)).code;a.textContent=label+' →';$('#resume').append(a);}}catch{localStorage.removeItem(key);}}
let invite=location.origin;fetch('/api/info').then(r=>r.json()).then(d=>invite=d.preferred||d.addresses.find(a=>a.includes('://26.'))||location.origin).catch(()=>{});$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(invite);toast('已複製好友連線網址');}catch{window.prompt('複製好友連線網址',invite);}};

if(new URLSearchParams(location.search).get('game')==='poker')document.querySelector('[data-game="poker"]').click();

if(new URLSearchParams(location.search).get('game')==='majority')document.querySelector('[data-game="majority"]').click();



fetch('/api/auth/me').then(r=>{if(!r.ok)throw Error('需要登入');return r.json();}).then(me=>{const name=$('#name');name.value=me.displayName;name.readOnly=true;const nav=document.querySelector('.club-header');const profile=document.createElement('a');profile.href='/profile';profile.className='quiet account-link';profile.textContent='我的角色';nav.append(profile);if(me.role==='admin'){const admin=document.createElement('a');admin.href='/admin';admin.className='quiet account-link';admin.textContent='管理';nav.append(admin);}const logout=document.createElement('button');logout.className='quiet account-logout';logout.textContent=me.displayName+' · 登出';logout.onclick=async()=>{await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});for(const key of Object.keys(localStorage))if(/^ah-(session|thunder|majority)(:|$)/.test(key))localStorage.removeItem(key);location.href='/login';};nav.append(logout);}).catch(()=>location.href='/login');

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
  $('#roomsCount').textContent=`${rooms.length} 間房間`;
  if(!rooms.length){const empty=document.createElement('p');empty.className='rooms-message';empty.textContent='目前還沒有房間。選擇上方遊戲，開一桌邀請朋友吧！';$('#roomList').replaceChildren(empty);}
  else $('#roomList').replaceChildren(...rooms.map(roomElement));
 }catch(error){
  if(request!==roomsRequest)return;
  const message=document.createElement('p');message.className='rooms-message';message.textContent=error.message;$('#roomList').replaceChildren(message);
 }finally{if(request===roomsRequest)$('#refreshRooms').disabled=false;}
}
$('#refreshRooms').onclick=loadRooms;
loadRooms();
setInterval(()=>{if(document.visibilityState==='visible'&&!busy)loadRooms();},10000);
