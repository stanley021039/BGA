(function(){
 'use strict';
 const $=s=>document.querySelector(s),code=location.pathname.match(/\/trpg\/([A-Fa-f0-9]{6})\/?$/)?.[1].toUpperCase();
 let state=null,busy=false,disposed=false,timer=null,lifetime=null,controlKey='',journalKey='',failed=null,dirty=false;
 const phaseNames={waiting:'等待開局',planning:'一起準備',reveal:'檢定揭曉',finished:'冒險結束'};
 const outcomeNames={success:'成功',partial:'付出代價仍推進',failure:'受挫仍推進'};
 function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
 function button(text,handler,primary=false){const b=node('button',text,primary?'primary':'');b.type='button';b.onclick=handler;return b;}
 function say(text){$('#feedback').textContent=text;}
 async function request(route,payload){return RoomApi.request(route,payload,{code,room:'trpg',session:true,signal:lifetime.signal,onKicked:()=>{RoomReconnect.forget(code);location.replace('/?game=trpg');}});}
 function command(action,extra={}){return mutate('action',{action,sceneId:state.sceneId,requestId:crypto.randomUUID(),...extra});}
 async function mutate(route,payload){
  if(busy||disposed)return;busy=true;say('');failed=null;$('#retry').hidden=true;lock();
  try{const next=await request(route,payload);if(!disposed){if(payload?.action==='plan')dirty=false;render(next);}}
  catch(error){if(error.name!=='AbortError'&&!disposed){say(error.message+(error.status?'':'；尚未確認是否成功，請更新狀態或重試同一操作。'));if(!error.status){failed={route,payload};$('#retry').hidden=false;}}}
  finally{busy=false;if(!disposed){lock();await refresh();}}
 }
 function lock(){for(const b of $('#controls').querySelectorAll('button,select,textarea'))b.disabled=busy;$('#leave').disabled=busy;$('#retry').disabled=busy;const resolve=$('#resolve');if(resolve)resolve.disabled=busy||dirty||!state?.canResolve;}
 function resultNode(r){
  const box=node('article',undefined,'journal-entry');box.append(node('h3',r.round+'. '+r.title),node('p',r.leaderName+' · '+r.approach+' · '+outcomeNames[r.outcome]),node('p','骰 '+r.die+' + 專長 '+r.skill+' + 協助 '+r.support+' = '+r.total+'／難度 '+r.difficulty,'formula'),node('p',r.text),node('p','線索 +'+r.clues+' · 危機 +'+r.danger));
  for(const p of r.participants)box.append(node('p',p.name+'：'+(p.note||'用行動參與故事')+'（'+(p.skipped?'離線休息':p.charged?'協助，專注 −1':p.stance==='recover'?'整備，專注 +1／上限 3':'協助未扣專注')+'）','contribution'));
  return box;
 }
 function render(next){
  if(disposed||next.type!=='trpg'||state&&next.version<state.version)return;state=next;$('#connection').textContent='';$('#game').hidden=false;$('#roomTag').textContent='房號 '+code;$('#copyInvite').hidden=$('#leave').hidden=false;
  $('#phase').textContent=phaseNames[state.phase];$('#sceneLabel').textContent=state.round?'第 '+state.round+'／6 幕':'準備出發';
  $('#sceneTitle').textContent=state.winner?.title||state.scene?.title||'先選角色，再邀朋友入座';$('#sceneText').textContent=state.winner?.text||state.scene?.text||'每個角色都能選擇任何解法，專長提供 +2。所有人都能協助與整備；可獨自試玩，或加入腳本測試夥伴。';
  $('#resources').replaceChildren(...['線索 '+state.clues+'／5','危機 '+state.danger+'（目標 ≤7）','補給 '+state.supplies].map(t=>node('span',t)));
  document.querySelectorAll('.route-map span').forEach((n,i)=>n.classList.toggle('current',i===state.scene?.zone));
  const leader=state.players.find(p=>p.id===state.leaderId),me=state.players.find(p=>p.id===state.me);
  $('#readiness').textContent=state.phase==='planning'?'已準備 '+state.readyCount+'／'+state.players.length+'；'+state.players.filter(p=>!p.ready).map(p=>p.name).join('、')+(state.readyCount===state.players.length?'全員就緒':' 尚未準備'):'每幕輪流領隊，其他人也有自己的行動。';
  $('#turnHint').textContent=state.phase==='planning'?(state.me===state.leaderId?'你是本幕領隊。選一種解法，等隊友準備好後檢定。':'本幕領隊：'+leader?.name+'。協助或整備，說一句你打算做什麼。'):state.phase==='reveal'?'結果已保留；由 '+leader?.name+' 帶大家前往下一幕。':'不比個人分數，一起完成旅途。';
  $('#players').replaceChildren(...state.players.map(p=>{
   const card=node('article',undefined,'player-card'+(p.id===state.me?' is-me':''));card.append(node('strong',p.name+(p.id===state.me?'（你）':'')),node('p',p.roleName+' · 專注 '+p.focus+'/3'),node('p',(p.id===state.leaderId?'本幕領隊 · ':'')+(p.bot?'腳本測試夥伴':p.offline?'離線':'在線')+(p.ready?' · 已準備':'')));
   if(state.host===state.me&&p.offline&&!p.ready&&state.phase==='planning'&&p.id!==state.me){
    card.append(button(p.id===state.leaderId?'移除離線領隊並交棒':'本幕休息',()=>{if(busy)return;if(confirm(p.id===state.leaderId?'移除 '+p.name+'？本幕交給其他玩家，大家需重新準備。':'確認讓 '+p.name+' 本幕休息？不會代替其擲骰或消耗專注。'))p.id===state.leaderId?mutate('kick',{playerId:p.id,confirmed:true}):command('skip',{playerId:p.id,confirmed:true});}));
   }return card;
  }));
  // Keep in-progress typing/focus stable when another seat submits or a poll arrives.
  const key=JSON.stringify([state.phase,state.sceneId,state.leaderId,state.host,me?.role,me?.focus,state.myPlan]);
  if(key!==controlKey){controlKey=key;dirty=false;const controls=$('#controls');controls.replaceChildren();
   if(['waiting','finished'].includes(state.phase)){
    const label=node('label','你的角色');label.htmlFor='role';const roles=node('select');roles.id='role';for(const [id,r]of Object.entries(state.roles)){const o=node('option',r.name+' · '+r.description);o.value=id;roles.append(o);}roles.value=me.role;controls.append(label,roles,button('選擇角色',()=>commandRole(roles.value)));
    if(state.host===state.me){controls.append(button(state.phase==='finished'?'再來一場':'開始冒險',()=>mutate('start',{}),true));if(state.players.length<6)controls.append(button('加入測試夥伴',()=>mutate('bot',{})));}
    else controls.append(node('p','等待房主開始冒險。'));
   }else if(state.phase==='planning'){
    if(state.me===state.leaderId){
     const label=node('label','選擇解法');label.htmlFor='approach';const select=node('select');select.id='approach';for(const a of state.approaches){const o=node('option',a.name+' · 難度 '+a.difficulty+' · 補給 '+a.cost);o.value=a.id;o.disabled=a.cost>state.supplies;select.append(o);}select.value=state.myPlan?.approach||state.approaches.find(a=>a.cost<=state.supplies)?.id;
     const help=node('p',undefined,'approach-help');const describe=()=>{const a=state.approaches.find(a=>a.id===select.value);help.textContent=a.description+'。成功線索 +'+a.reward+'；受挫危機 +'+a.risk+'、補給 −1；差 1–2 為線索 +1、危機 +1。'+(state.roles[me.role].skill===a.skill?'你的專長 +2。':'此解法沒有角色加成。');};select.onchange=describe;describe();controls.append(label,select,help);
    }
    const label=node('label',state.me===state.leaderId?'你的準備':'隊友行動');label.htmlFor='stance';const stance=node('select');stance.id='stance';for(const [value,text]of [['assist',state.me===state.leaderId?'全心帶隊（不扣專注）':'協助領隊（最多兩人各花 1 專注 +1）'],['recover',state.me===state.leaderId?'整備（專注 +1，本幕不使用專長）':'整備（專注 +1，上限 3）']]){const o=node('option',text);o.value=value;o.disabled=value==='assist'&&state.me!==state.leaderId&&me.focus<1;stance.append(o);}stance.value=state.myPlan?.stance||(me.focus>0?'assist':'recover');
    const noteLabel=node('label','說一句角色行動（選填）');noteLabel.htmlFor='note';const note=node('textarea');note.id='note';note.maxLength=160;note.rows=3;note.placeholder='例如：我把繩索交給隊友，先確認下一段路。';note.value=state.myPlan?.note||'';
    for(const field of [stance,note])field.addEventListener('input',()=>{dirty=true;lock();});$('#approach')?.addEventListener('input',()=>{dirty=true;lock();});
    controls.append(label,stance,noteLabel,note,button(state.myPlan?'更新我的行動':'準備好了',()=>command('plan',{stance:stance.value,approach:$('#approach')?.value,note:note.value}),true));
    if(state.me===state.leaderId){const resolve=button('擲骰檢定',()=>command('resolve'),true);resolve.id='resolve';controls.append(resolve);}
   }else if(state.phase==='reveal'&&state.me===state.leaderId)controls.append(button('前往下一幕 →',()=>command('next'),true));
  }
  const resultKey=state.results.map(r=>r.sceneId).join(':');if(resultKey!==journalKey){journalKey=resultKey;$('#journal').replaceChildren(...state.results.map(resultNode));$('#latest').replaceChildren(...(state.results.length?[resultNode(state.results.at(-1))]:[]));}
  lock();
 }
 function commandRole(role){return mutate('action',{action:'role',role});}
 let reading=false;
 async function refresh(){if(disposed||reading||!lifetime)return;reading=true;try{const next=await request('state');if(!disposed)render(next);}catch(error){if(error.name!=='AbortError'&&!disposed)$('#connection').textContent='連線暫時中斷：'+error.message+'；正在重新讀取，操作不會自動重送。';}finally{reading=false;}}
 async function start(){disposed=false;lifetime=new AbortController();try{await RoomReconnect.restore(code,'trpg','#connection',{signal:lifetime.signal});if(disposed)return;await refresh();timer=setInterval(()=>{if(!document.hidden)refresh();},2000);}catch(error){if(error.name!=='AbortError')say(error.message);}}
 function stop(){disposed=true;clearInterval(timer);timer=null;lifetime?.abort();}
 $('#retry').onclick=()=>{if(failed)mutate(failed.route,failed.payload);};
 $('#copyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/?room='+code+'&game=trpg');say('邀請連結已複製。');}catch{say('邀請朋友到大廳輸入房號 '+code+'。');}};
 $('#leave').onclick=async()=>{if(busy||!confirm('離開冒險？已揭曉結果仍會保留，進行中不能重新入座。'))return;busy=true;lock();try{await request('leave',{});RoomReconnect.forget(code);location.replace('/?game=trpg');}catch(error){say(error.message);busy=false;lock();}};
 if(!code){$('#guide').open=true;$('#connection').textContent='從大廳選擇霧港跑團，建立房間後即可遊玩。';return;}
 window.addEventListener('pagehide',stop);window.addEventListener('pageshow',e=>{if(e.persisted)start();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});start();
})();
