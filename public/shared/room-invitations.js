(()=>{
 'use strict';if(window.RoomInvites)return;
 let active=true,scope=new AbortController(),timer,ready=false,badge,sender,inbox,senderList,inboxList,senderStatus,inboxStatus,context=null,candidatesKey='',inboxKey='',items=[];
 const sending=new Set(),titles={poker:'德州撲克',thunder:'雷霆之路',majority:'同頻俱樂部',gift:'送禮達人',draw:'你畫我猜',telephone:'傳情畫意',trpg:'霧港跑團',musicquiz:'猜歌挑戰',minimal:'極簡猜圖',bluff:'瞎掰王',quacks:'郎中闖江湖'};
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const action=(label,icon,run)=>{const b=el('button');b.type='button';GameUI.decorateButton(b,icon,{label});b.onclick=run;return b;};
 async function request(path,data){const r=await fetch('/api/room-invitations'+path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:scope.signal,...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});const body=await r.json();if(!r.ok){const e=Error(body.error||'暫時無法取得邀請');e.status=r.status;throw e;}return body;}
 function init(){
  if(badge)return;const account=document.querySelector('[data-site-header] .site-account');if(!account)return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/room-invitations.css';document.head.append(css);
  badge=action('房間邀請','invite',()=>openInbox(badge));badge.id='room-invitations-button';badge.className+=' room-invitations-button';account.insertBefore(badge,account.querySelector('#site-account-button'));
  senderList=el('div');senderList.className='room-invite-list';senderList.setAttribute('aria-label','可以邀請的線上朋友');senderStatus=el('p');senderStatus.className='ui-status';senderStatus.setAttribute('role','status');
  sender=GameUI.createDialog({title:'邀請線上朋友',titleId:'room-invite-title',className:'room-invite-dialog',content:[senderStatus,senderList],actions:[action('重新整理','replay',loadCandidates),action('完成','close',()=>sender.close())]});sender.id='room-invite-dialog';document.body.append(sender);
  inboxList=el('div');inboxList.className='room-invite-list';inboxList.setAttribute('aria-label','收到的房間邀請');inboxStatus=el('p');inboxStatus.className='ui-status';inboxStatus.setAttribute('role','status');
  inbox=GameUI.createDialog({title:'收到的房間邀請',titleId:'room-inbox-title',className:'room-invite-dialog',content:[inboxStatus,inboxList],actions:[action('關閉','close',()=>inbox.close())]});inbox.id='room-invitations-inbox';document.body.append(inbox);
 }
 function updateBadge(){if(!badge)return;const count=items.length;if(badge.dataset.count===String(count))return;badge.dataset.count=String(count);GameUI.decorateButton(badge,'invite',{iconOnly:true,label:'房間邀請'+(count?'（'+count+'）':'')});if(count){const counter=el('span',String(count));counter.className='room-invitation-count';counter.setAttribute('aria-hidden','true');badge.append(counter);}}
 async function respond(invite,kind,b){
  b.disabled=true;inboxStatus.textContent=kind==='accept'?'正在加入房間…':'正在婉拒…';
  try{const result=await request('/respond',{id:invite.id,action:kind});if(!active)return;
   if(kind==='accept'){const key=result.type==='poker'?'ah-session':'ah-'+result.type;try{localStorage.setItem(key,JSON.stringify(result));localStorage.setItem(key+':'+result.code,JSON.stringify(result));}catch{}location.assign('/'+(result.type==='thunder'?'race':result.type)+'/'+result.code);return;}
   inboxStatus.textContent='已婉拒邀請。';await poll();
  }catch(e){if(e.name!=='AbortError'){inboxStatus.textContent=e.message;await poll();}}finally{if(b.isConnected)b.disabled=false;}
 }
 function renderInbox(){
  const key=JSON.stringify(items);if(key===inboxKey)return;inboxKey=key;
  inboxList.replaceChildren(...items.map(i=>{const card=el('article'),heading=el('h3',i.fromName+' 邀請你一起玩'),room=el('p',(titles[i.type]||'遊戲')+' · '+i.roomName+' · 房號 '+i.code),row=el('div');card.className='room-invite-card';row.className='ui-control-row';const accept=action('加入房間','check',()=>respond(i,'accept',accept)),decline=action('婉拒','close',()=>respond(i,'decline',decline));accept.disabled=!i.canJoin;row.append(accept,decline);card.append(heading,room);if(!i.canJoin)card.append(el('p','房間已滿或目前無法加入。'));card.append(row);return card;}));
  if(!items.length)inboxList.append(el('p','目前沒有房間邀請。'));
 }
 async function loadCandidates(){
  if(!sender?.open||!context)return;const code=context.code;
  try{const data=await request('/online?code='+encodeURIComponent(code));if(!active||context?.code!==code||!sender.open)return;
   senderStatus.textContent=data.reason||(!data.users.length?'目前沒有可邀請的線上朋友。':'選擇朋友送出邀請；對方確認後才會入座。');
   const key=JSON.stringify([code,data.users]);if(key===candidatesKey)return;candidatesKey=key;
   senderList.replaceChildren(...data.users.map(p=>{const card=el('article'),avatar=el('img'),name=el('strong',p.name),invite=action(p.pending?'已邀請':'邀請','invite',async()=>{if(sending.has(p.id))return;sending.add(p.id);invite.disabled=true;senderStatus.textContent='正在送出邀請…';let notice='';try{await request('',{code,targetId:p.id});notice='已邀請 '+p.name+'，等待對方確認。';}catch(e){if(e.name!=='AbortError')notice=e.message;}finally{sending.delete(p.id);await loadCandidates();if(active&&sender.open&&context?.code===code&&notice)senderStatus.textContent=notice;}});card.className='room-invite-person';card.dataset.inviteUser=p.id;avatar.src=p.avatar;avatar.alt='';avatar.onerror=()=>avatar.hidden=true;invite.disabled=p.pending||sending.has(p.id);card.append(avatar,name,invite);return card;}));
  }catch(e){if(e.name!=='AbortError'&&sender.open)senderStatus.textContent=e.message;}
 }
 function open(trigger){if(!ready)return;const next=window.RoomControls?.inviteContext?.();if(!next?.code)return;context=next;candidatesKey='';senderStatus.textContent='正在取得線上朋友…';senderList.replaceChildren();GameUI.openDialog(sender,trigger);void loadCandidates();}
 function openInbox(trigger){if(!ready)return;renderInbox();GameUI.openDialog(inbox,trigger);void poll();}
 async function poll(){
  clearTimeout(timer);if(!active)return;
  try{const data=await request('');if(!active)return;items=data.invitations;
   if(!ready){init();if(badge)badge.hidden=false;ready=true;window.dispatchEvent(new Event('room-invitations-ready'));}
   updateBadge();if(inbox?.open)renderInbox();if(sender?.open)await loadCandidates();
  }catch(e){if(e.status===401){ready=false;items=[];updateBadge();sender?.close();inbox?.close();if(badge)badge.hidden=true;return;}if(e.status===404)return;}
  if(active)timer=setTimeout(poll,document.hidden?30000:5000);
 }
 window.RoomInvites={get ready(){return ready;},open,updateRoom(next){if(!next?.code)return;const changed=context?.code&&context.code!==next.code;context={code:next.code,type:next.type};if(changed&&sender?.open)sender.close();}};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});window.addEventListener('pagehide',()=>{active=false;clearTimeout(timer);scope.abort();});window.addEventListener('pageshow',e=>{if(e.persisted){active=true;scope=new AbortController();void poll();}});void poll();
})();
