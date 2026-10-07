(()=>{
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const box=document.createElement('div');
 box.innerHTML=`<button id="managePlayers" type="button" class="host-manage" aria-haspopup="dialog" aria-controls="hostPlayers" hidden>管理玩家</button>
 <dialog id="hostPlayers" aria-labelledby="hostPlayers-title" aria-describedby="hostPlayersHelp"><button id="closeHostPlayers" type="button" class="host-cancel" aria-label="關閉玩家管理">關閉 ×</button><h2 id="hostPlayers-title">房間管理</h2><p id="hostPlayersHelp"></p><div id="hostPlayerList"></div><p id="hostError" role="status" aria-live="polite"></p></dialog>
 <dialog id="kickWarning" aria-labelledby="kickWarning-title" aria-describedby="kickEffect"><h2 id="kickWarning-title">確認踢出玩家？</h2><p id="kickPlayerName"></p><p id="kickEffect"></p><p>對方會收到被踢出通知，原本的連線將失效。</p><div class="host-dialog-actions"><button id="cancelKick" type="button" autofocus>取消</button><button id="confirmKick" type="button" class="host-danger">確認踢出</button></div><p id="kickError" role="status" aria-live="polite"></p></dialog>
 <dialog id="kickedNotice" aria-labelledby="kickedNotice-title"><h2 id="kickedNotice-title">你已被踢出房間</h2><p>原本的連線已結束。請返回大廳。</p><a class="host-return" href="/">返回大廳</a></dialog>`;
 document.body.append(box);
 const q=selector=>document.querySelector(selector);
 let current=null,render=null,target=null,pending=null,generation=0;

 function isStaleSnapshot(next,previous){
  if(!previous)return false;
  if(next.version<previous.version)return true;
  return next.code===previous.code&&next.me===previous.me&&(next.type||'poker')===(previous.type||'poker')&&next.version===previous.version&&Number.isFinite(next.serverNow)&&Number.isFinite(previous.serverNow)&&next.serverNow<previous.serverNow;
 }
 function sameRoom(a,b){
  if(!a||!b||a.code!==b.code||a.me!==b.me||(a.type||'poker')!==(b.type||'poker'))return false;
  // Legacy watch and unified media have separate instance namespaces. Compare
  // corresponding markers, never a watch UUID with a newly supplied media UUID.
  return [state=>state.roomInstanceId,state=>state.media?.roomInstanceId,state=>state.watch?.roomInstanceId].every(read=>!read(a)||!read(b)||read(a)===read(b));
 }
 function myRole(){return current?.permissions?current.permissions.role:current?.host?'host':'member';}
 function canManage(){return !!current&&!window.RaceLesson&&['host','manager'].includes(myRole())&&(!current.permissions||current.permissions.canManagePlayers===true);}
 function canPromote(){return myRole()==='host'&&(!current?.permissions||current.permissions.canPromote===true);}
 function playerRole(player){
  if(player.bot)return null;
  if(['host','manager','member'].includes(player.roomRole))return player.roomRole;
  return player.id===current.hostId||player.id===current.me&&current.host?'host':'member';
 }
 function mayKick(player){
  if(!canManage()||!player||player.kicked||player.id===current.me||playerRole(player)==='host')return false;
  return myRole()==='host'||!player.bot&&playerRole(player)==='member';
 }
 function maySetRole(player){return canManage()&&canPromote()&&!!player&&!player.kicked&&!player.bot&&player.id!==current.me&&playerRole(player)!=='host';}
 function status(selector,message,kind='info'){
  const node=q(selector);
  if(window.GameUI?.setStatus)window.GameUI.setStatus(node,message,{kind});
  else{node.textContent=message;node.dataset.kind=kind;}
 }
 function open(dialog,trigger){if(dialog.open)return;if(window.GameUI?.openDialog)window.GameUI.openDialog(dialog,trigger);else dialog.showModal();}
 function focusManage(){if(!q('#managePlayers').hidden)q('#managePlayers').focus();}
 function list(){
  const focused=document.activeElement;
  const focusAction=focused?.dataset?.kick?{kind:'kick',id:focused.dataset.kick}:focused?.dataset?.rolePlayer?{kind:'rolePlayer',id:focused.dataset.rolePlayer}:null;
  const markup=(current?.players||[]).filter(player=>!player.kicked).map(player=>{
   const role=playerRole(player),label=player.bot?'電腦':role==='host'?'房主':role==='manager'?'管理者':'一般玩家';
   const disabled=pending?' disabled':'';
   const roleAction=maySetRole(player)?`<button type="button" data-role-player="${escape(player.id)}" data-room-role="${role==='manager'?'member':'manager'}" aria-label="${role==='manager'?'改為一般玩家':'設為管理者'}：${escape(player.name)}"${disabled}>${role==='manager'?'改為一般玩家':'設為管理者'}</button>`:'';
   const kickAction=mayKick(player)?`<button type="button" data-kick="${escape(player.id)}" aria-label="踢出：${escape(player.name)}"${disabled}>踢出</button>`:'';
   return `<div class="host-player"><div class="host-player-info"><span class="host-player-name">${escape(player.name)}${player.id===current.me?' · 你':''}</span><span class="host-player-role">${label}${player.online===false?' · 暫時離線':''}</span></div><div class="host-player-actions">${roleAction}${kickAction}</div></div>`;
  }).join('')||'<p>沒有其他玩家。</p>';
  const container=q('#hostPlayerList');
  if(container._hostMarkup===markup)return;
  container.innerHTML=markup;container._hostMarkup=markup;
  if(focusAction){
   const button=[...container.querySelectorAll('button')].find(node=>node.dataset[focusAction.kind]===focusAction.id&&!node.disabled);
   if(button)button.focus();else if(q('#hostPlayers').open)q('#closeHostPlayers').focus();
  }
 }
 function controls(){
  q('#confirmKick').disabled=q('#cancelKick').disabled=!!pending;
  q('#hostPlayers').setAttribute('aria-busy',String(!!pending));
  list();
 }
 function cancelPending(){generation++;pending?.controller?.abort();pending=null;target=null;controls();}
 function requestHeaders(state){
  const headers={'Content-Type':'application/json'};
  const key=state.type==='majority'?'ah-majority':state.type==='thunder'?'ah-thunder':state.type==='gift'?'ah-gift':state.type==='draw'?'ah-draw':'ah-session';
  try{const session=JSON.parse(localStorage.getItem(key+':'+state.code)||localStorage.getItem(key)||'null');if(session?.token)headers.Authorization='Bearer '+session.token;}catch{}
  return headers;
 }
 async function command(route,data,errorSelector,success){
  if(pending||!canManage())return false;
  const operation={generation,state:current,controller:typeof AbortController==='function'?new AbortController():null};
  pending=operation;controls();status(errorSelector,'處理中…');
  try{
   const response=await fetch('/api/'+route,{method:'POST',credentials:'same-origin',headers:requestHeaders(operation.state),signal:operation.controller?.signal,body:JSON.stringify({code:operation.state.code,...data})});
   const snapshot=await response.json();
   if(pending!==operation||operation.generation!==generation||!sameRoom(operation.state,current))return false;
   if(!response.ok)throw Error(snapshot.error||'無法完成房間管理操作');
   const accepted=window.RoomHost.acceptSnapshot(snapshot);
   if(pending!==operation)return accepted;
   status(errorSelector,accepted?success:'操作已送出，等待最新房間狀態。',accepted?'success':'info');
   return accepted;
  }catch(error){
   if(pending===operation&&operation.generation===generation&&sameRoom(operation.state,current))status(errorSelector,error.message||'無法完成房間管理操作','error');
   return false;
  }finally{
   if(pending===operation){pending=null;controls();}
  }
 }
 q('#managePlayers').onclick=()=>{if(!canManage())return;list();open(q('#hostPlayers'),q('#managePlayers'));};
 q('#closeHostPlayers').onclick=()=>{q('#hostPlayers').close();focusManage();};
 q('#hostPlayers').addEventListener('close',focusManage);
 q('#hostPlayerList').onclick=async event=>{
  if(pending)return;
  const roleButton=event.target.closest('[data-role-player]');
  if(roleButton){
   if(roleButton.disabled)return;
   const player=current?.players?.find(seat=>seat.id===roleButton.dataset.rolePlayer),role=roleButton.dataset.roomRole;
   if(!maySetRole(player)||!['manager','member'].includes(role))return;
   await command('room-role',{playerId:player.id,role},'#hostError',role==='manager'?'已設為管理者。':'已改為一般玩家。');return;
  }
  const kickButton=event.target.closest('[data-kick]');
  if(!kickButton||kickButton.disabled)return;
  const player=current?.players?.find(seat=>seat.id===kickButton.dataset.kick);
  if(!mayKick(player))return;
  target=player;
  q('#kickPlayerName').textContent='即將踢出：'+player.name;
  const type=current.type||'poker';
  q('#kickEffect').textContent=current.phase==='waiting'?'玩家將從等待室移除。':type==='majority'?'尚未結算的答案與預備題目將移除；人數不足時會提前結束本局。':type==='gift'?'玩家的未揭曉禮物與喜好將移除；人數不足時本局提前結束。':type==='draw'?'畫者離開會揭曉本輪；人數不足時本局提前結束。':type==='poker'&&current.phase==='showdown'?'玩家將從牌桌移除。':'對局中的車隊或牌手將由電腦接手，其他玩家繼續遊戲。';
  status('#kickError','');q('#hostPlayers').close();open(q('#kickWarning'),q('#managePlayers'));
 };
 q('#cancelKick').onclick=()=>{if(pending)return;target=null;q('#kickWarning').close();if(canManage())open(q('#hostPlayers'),q('#managePlayers'));};
 q('#kickWarning').addEventListener('cancel',event=>{if(pending)event.preventDefault();else target=null;});
 q('#kickWarning').addEventListener('close',focusManage);
 q('#confirmKick').onclick=async()=>{
  if(pending||!mayKick(target))return;
  const id=target.id;
  if(await command('kick',{playerId:id,confirmed:true},'#kickError','已踢出玩家。')){target=null;q('#kickWarning').close();}
 };
 q('#kickedNotice').addEventListener('cancel',event=>event.preventDefault());
 window.RoomHost={
  isStaleSnapshot,
  update(snapshot,callback){
   const changed=current&&!sameRoom(snapshot,current);
   current=snapshot;render=callback;
   if(changed){cancelPending();status('#hostError','');status('#kickError','');q('#hostPlayers').close();q('#kickWarning').close();}
   const allowed=canManage();q('#managePlayers').hidden=!allowed;
   q('#hostPlayersHelp').textContent=canPromote()?'房主可設定房間管理者，並踢出其他玩家。房間角色不影響網站帳戶權限。':'管理者可踢出一般玩家；房主與其他管理者的角色由房主設定。';
   if(!allowed){if(pending)cancelPending();q('#hostPlayers').close();q('#kickWarning').close();}
   else if(target&&!mayKick(current.players.find(player=>player.id===target.id))){target=null;q('#kickWarning').close();}
   if(q('#hostPlayers').open)list();
   window.GameShell?.update(snapshot);
  },
  acceptSnapshot(snapshot){
   if(!snapshot||!current||typeof render!=='function'||!sameRoom(snapshot,current)||isStaleSnapshot(snapshot,current))return false;
   render(snapshot);return true;
  },
  kicked(session){
   cancelPending();current=null;render=null;
   for(const key of ['ah-majority','ah-thunder','ah-gift','ah-draw','ah-session']){localStorage.removeItem(key+':'+session.code);try{if(JSON.parse(localStorage.getItem(key)||'null')?.code===session.code)localStorage.removeItem(key);}catch{}}
   for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
   q('#managePlayers').hidden=true;q('#kickedNotice').showModal();
  }
 };
})();
