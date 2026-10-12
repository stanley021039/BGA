(()=>{
 'use strict';
 let state=null,panel=null,scheduled=false,leaving=false,leaveController=null,settingsSource=null;
 const native={start:null,bot:null},proxies={};
 const actions={start:{icon:'play',label:'開始遊戲'},bot:{icon:'users',label:'加入 AI 測試夥伴'},leave:{icon:'leave',label:'離房'}};
 const minimumPlayers={poker:2,thunder:2,draw:2,majority:3,gift:3,telephone:3,minimal:3,bluff:3,trpg:1,musicquiz:1};
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function decorate(button,kind){const action=actions[kind];button.classList.add('ui-room-action');button.dataset.roomAction=kind;window.GameUI?.decorateButton(button,action.icon,{iconOnly:kind!=='start',label:action.label});if(!window.GameUI){button.textContent=action.label;button.setAttribute('aria-label',action.label);}return button;}
 function rosterAction(button){
  const card=node('article','ui-room-roster-card ui-room-roster-add');card.setAttribute('role','listitem');button.classList.add('ui-room-roster-action-button');button.type='button';button.dataset.roomCommonAction='bot';button.setAttribute('aria-label',actions.bot.label);
  const avatar=node('span','ui-room-roster-avatar'),icon=node('span','ui-symbol');icon.setAttribute('aria-hidden','true');const symbol=window.GameUI?.symbol?.('add');if(symbol)icon.innerHTML=symbol;else icon.textContent='+';avatar.append(icon);
  const info=node('span','ui-room-roster-info');info.append(node('b','ui-room-roster-action-label',actions.bot.label),node('small','ui-room-roster-status','協助測試遊戲流程'));button.replaceChildren(avatar,info);card.append(button);return card;
 }
 function owner(){return state&&(state.host===true||state.host===state.me||state.hostId===state.me);}
 function hidden(n){for(let a=n;a;a=a.parentElement)if(a.hidden||getComputedStyle(a).display==='none'||getComputedStyle(a).visibility==='hidden')return true;return false;}
 function findAction(kind){
  if(kind==='start'&&state.type==='thunder'&&state.phase==='finished')return document.querySelector('#winner [data-action="restart"]');
  const selectors=kind==='start'?'#start,[data-do="start"]':'#bot,[data-do="bot"]';
  let found=[...document.querySelectorAll(selectors)].find(n=>!n.closest('[data-room-common]'));
  if(!found){const names=kind==='start'?/^(開始|再來一場|發牌)/:/^(加入腳本測試夥伴|加入測試 AI|加入測試AI|加入.*夥伴|＋.*電腦)/;
   found=[...document.querySelectorAll('#controls button,.action-panel button')].find(n=>!n.closest('[data-room-common]')&&names.test(n.getAttribute('aria-label')||n.textContent.trim()));}
  return found||null;
 }
 function normalizeFields(source){
  source.classList.add('ui-room-settings-source');if(source.tagName==='DETAILS')source.open=true;
  for(const grid of source.querySelectorAll('.fields,.settings,.room-settings'))grid.classList.add('ui-room-setting-grid');
  for(const label of source.querySelectorAll('label')){
   if(label.closest('.ui-room-setting-field'))continue;
   const input=label.htmlFor?document.getElementById(label.htmlFor):label.querySelector('input,select');
   if(!input||!source.contains(input))continue;
   if(input.parentElement===label){label.classList.add(['checkbox','radio'].includes(input.type)?'ui-room-setting-choice':'ui-room-setting-field');continue;}
   if(input.parentElement===label.parentElement){const wrapper=node('div','ui-room-setting-field');label.before(wrapper);wrapper.append(label,input);}
  }
 }
 function mount(){
  const type=state.type||'poker',host=['telephone','musicquiz','minimal','bluff','trpg'].includes(type)?document.getElementById('controls'):document.querySelector(type==='thunder'?'.race-controls':'.room-sidebar,.table-sidebar');
  if(!host)return;
  if(!panel){panel=node('section','ui-room-controls');panel.dataset.roomCommon='';panel.setAttribute('aria-label','房間設定與操作');
   const settings=node('section','ui-room-settings-card'),heading=node('h2','','房間設定'),slot=node('div','ui-room-settings-slot');settings.append(heading,slot);
   const row=node('div','ui-room-session-actions');row.setAttribute('aria-label','房間操作');
   for(const kind of ['start','bot','leave']){const button=decorate(node('button',''),kind);button.type='button';button.onclick=()=>kind==='leave'?leave(button):native[kind]?.click();proxies[kind]=button;row.append(button);}
   const status=node('p','ui-room-control-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(settings,row,status);host.append(panel);
  }
  if(panel.parentElement!==host)host.append(panel);
  panel.dataset.aiPlacement=state.type==='telephone'&&window.RoomWaiting?.setRosterAction?'roster':'inline';
  if(panel.hidden)panel.hidden=false;
 }
 function normalize(){
  scheduled=false;if(!state||window.RaceLesson)return;mount();if(!panel)return;
  for(const kind of ['start','bot']){
   const source=findAction(kind);native[kind]=source;if(source&&!source.hasAttribute('data-room-native-action')){source.setAttribute('data-room-native-action',kind);source.tabIndex=-1;source.setAttribute('aria-hidden','true');}
   const legacyRace=state.type==='thunder',rosterBot=state.type==='telephone'&&!!window.RoomWaiting?.setRosterAction,visible=kind==='bot'?!rosterBot&&owner()&&(legacyRace||state.botSupport?.supported!==false)&&(!!source||state.botSupport?.canAdd===false):!!source&&!hidden(source),button=proxies[kind];if(button.hidden===visible)button.hidden=!visible;
   const tooFew=kind==='start'&&(state.players||[]).filter(p=>!p.kicked).length<(minimumPlayers[state.type||'poker']||1);
   const disabled=!visible||!source||source.disabled||hidden(source)||button.getAttribute('aria-busy')==='true'||leaving||tooFew||kind==='bot'&&!legacyRace&&state.botSupport?.canAdd===false;if(button.disabled!==disabled)button.disabled=disabled;
  }
  const ownLeave=document.getElementById('leave'),legacyLinks=document.querySelectorAll('.room-leave,#back');
  if(ownLeave&&!ownLeave.hasAttribute('data-room-native-action')){ownLeave.setAttribute('data-room-native-action','leave');ownLeave.tabIndex=-1;ownLeave.setAttribute('aria-hidden','true');}
  for(const n of legacyLinks)if(!n.hasAttribute('data-room-native-action')){n.setAttribute('data-room-native-action','leave');n.tabIndex=-1;n.setAttribute('aria-hidden','true');}
  const leaveDisabled=leaving||!!ownLeave?.disabled;if(proxies.leave.disabled!==leaveDisabled)proxies.leave.disabled=leaveDisabled;if(proxies.leave.hidden)proxies.leave.hidden=false;
  const setup=state.phase==='waiting'||['draw','bluff','telephone'].includes(state.type)&&state.phase==='finished',card=panel.querySelector('.ui-room-settings-card');if(card.hidden===setup)card.hidden=!setup;
  if(setup){
   let source=[...document.querySelectorAll('.room-settings-panel')].find(n=>!n.closest('[data-room-common]'));
   if(!owner()&&!source&&!(settingsSource?.isConnected&&settingsSource.dataset.roomReadOnly==='true')){settingsSource=null;const slot=panel.querySelector('.ui-room-settings-slot');if(slot.textContent!=='由房主調整房間設定。')slot.replaceChildren(node('p','ui-room-settings-note','由房主調整房間設定。'));return;}
   if(!source&&owner()){
    const base=document.getElementById('controls')||document.getElementById('hostButtons');
    const fields=base?[...base.querySelectorAll('label,fieldset,.mode-note')].filter(n=>!n.closest('[data-room-common]')&&!n.closest('fieldset label')):[];
    if(fields.length){source=node('div','');source.dataset.roomSetting='';base.prepend(source);for(const n of fields)if(!fields.some(other=>other!==n&&other.contains(n))){source.append(n);if(n.tagName==='LABEL'&&n.htmlFor){const input=document.getElementById(n.htmlFor);if(input&&base.contains(input)&&!n.contains(input))source.append(input);}}}
   }
   const slot=panel.querySelector('.ui-room-settings-slot');
   if(source&&source!==settingsSource){settingsSource=source;source.dataset.roomReadOnly=String(!owner());if(!owner())for(const input of source.querySelectorAll('input,select,textarea,button'))input.disabled=true;normalizeFields(source);slot.replaceChildren(source);}
   else if(!settingsSource||!settingsSource.isConnected){settingsSource=null;const text=owner()?'本遊戲使用固定規則，無需調整。':'由房主調整房間設定。';if(slot.textContent!==text)slot.replaceChildren(node('p','ui-room-settings-note',text));}
  }
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(normalize);}
 const dialog=node('dialog','ui-dialog room-leave-dialog');dialog.setAttribute('aria-labelledby','unified-leave-title');
 dialog.innerHTML='<h2 id="unified-leave-title">確定離開這個房間？</h2><p class="ui-room-leave-effect"></p><div class="ui-control-row"><button type="button" class="ui-button primary" data-confirm>確認離開</button><button type="button" class="ui-button secondary" data-cancel>留在房間</button></div><p class="ui-room-leave-status" role="status" aria-live="polite"></p>';
 document.body.append(dialog);const confirm=dialog.querySelector('[data-confirm]'),cancel=dialog.querySelector('[data-cancel]');window.GameUI?.decorateButton(confirm,'leave',{label:'確認離開'});window.GameUI?.decorateButton(cancel,'close',{label:'留在房間'});
 cancel.onclick=()=>{if(!leaving)dialog.close();};dialog.addEventListener('cancel',event=>{if(leaving)event.preventDefault();});
 function leave(trigger){if(!state||window.RaceLesson||leaving||dialog.open)return;const type=state.type||'poker';dialog.querySelector('.ui-room-leave-effect').textContent=['telephone','trpg','musicquiz','minimal','bluff'].includes(type)&&!['waiting','finished'].includes(state.phase)?'離席會中止本場遊戲，保留已完成內容。離開後返回遊戲大廳。':type==='draw'&&!['waiting','finished'].includes(state.phase)?'畫者離席會揭曉本輪；人數不足時本場結束。離開後返回遊戲大廳。':'離開後返回遊戲大廳；房主離開時依遊戲規則移交房主或結束房間。';dialog.querySelector('.ui-room-leave-status').textContent='';if(window.GameUI?.openDialog)window.GameUI.openDialog(dialog,trigger);else dialog.showModal();}
 confirm.onclick=async()=>{
  if(!state||leaving)return;const captured=state,code=state.code;leaving=true;confirm.disabled=cancel.disabled=true;schedule();leaveController=new AbortController();const timer=setTimeout(()=>leaveController.abort(),10000);
  try{const r=await fetch('/api/leave',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:leaveController.signal});const result=await r.json();if(!r.ok&&!['ROOM_NOT_FOUND','NOT_SEATED','KICKED'].includes(result.code))throw Error(result.error||'無法離開房間');if(state?.code!==code||state?.me!==captured.me)return;window.RoomReconnect?.forget(code);window.GameShell?.stop();window.SharedChat?.clearRoom();location.replace('/?game='+(captured.type||'poker'));}
  catch(e){dialog.querySelector('.ui-room-leave-status').textContent=e.name==='AbortError'?'離房結果尚未確認，請重試。':e.message;}
  finally{clearTimeout(timer);leaveController=null;leaving=false;confirm.disabled=cancel.disabled=false;schedule();}
 };
 document.addEventListener('click',event=>{
  if(window.RaceLesson||!state||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const target=event.target.closest('#leave,#back,.room-leave,a[href]');if(!target||target.closest('dialog'))return;
  const href=target.tagName==='A'?new URL(target.href):null;
  if(!target.matches('#leave,#back,.room-leave')&&(!href||href.origin!==location.origin||href.pathname!=='/'))return;
  event.preventDefault();event.stopImmediatePropagation();leave(target);
 },true);
 const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden']});
 window.addEventListener('pagehide',()=>{leaveController?.abort();observer.disconnect();});window.addEventListener('pageshow',()=>{observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden']});schedule();});
 window.RoomControls={update(next){if(window.RaceLesson)return;if(state&&state.code===next.code&&next.version<state.version)return;if(state&&(state.code!==next.code||state.me!==next.me)){leaveController?.abort();if(dialog.open)dialog.close();}state=next;schedule();},decorate,rosterAction,stop(){state=null;leaveController?.abort();if(panel)panel.hidden=true;}};
})();
