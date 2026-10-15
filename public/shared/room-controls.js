(()=>{
 'use strict';
 let state=null,panel=null,scheduled=false,leaving=false,leaveController=null,settingsSource=null,readonlySource=null,readonlyKey='';
 const proxies={};let playPanels=null;
  const customHomes=new Map();
 function rememberCustom(n){if(!n||customHomes.has(n))return;const home=document.createComment('custom-room-control-home');n.before(home);customHomes.set(n,{home,tabIndex:n.getAttribute('tabindex'),ariaHidden:n.getAttribute('aria-hidden'),native:n.getAttribute('data-room-native-action')});}
 function restoreCustom({keepChatActions=false}={}){for(const [n,e]of customHomes){if(keepChatActions&&n.id==='managePlayers'&&n.closest('.ui-room-chat'))continue;if(e.home.parentNode)e.home.after(n);e.home.remove();for(const [attr,value]of [['tabindex',e.tabIndex],['aria-hidden',e.ariaHidden],['data-room-native-action',e.native]]){if(value===null)n.removeAttribute(attr);else n.setAttribute(attr,value);}customHomes.delete(n);}if(panel)panel.hidden=true;}
 const actions={start:{icon:'play',label:'開始遊戲'},bot:{icon:'bot',label:'加入 AI 測試夥伴'},invite:{icon:'invite',label:'邀請線上朋友'},manage:{icon:'settings',label:'管理玩家'},leave:{icon:'leave',label:'離房'}};
 // Explicit action adapters own game decisions; this module owns the buttons,
 // pending guard, roster placement and focus. Games declare their decisions explicitly.
 let actionBinding=null,actionPending=null,rosterButton=null;
 const boundActions=()=>actionBinding&&(state?.type||'poker')===actionBinding.type?actionBinding:null;
 const setupPhase=()=>boundActions()?.read().setup??['waiting','finished'].includes(state?.phase);
 const actionRoom=()=>state&&[state.type,state.code,state.me,state.roomInstanceId||''].join(':');
 function actionStatus(message){const slot=panel?.querySelector('.ui-room-control-status');if(slot&&slot.textContent!==message)slot.textContent=message;}
 async function invokeAction(kind,trigger){
  const binding=boundActions(),model=binding?.read();
  if(!binding||actionPending||leaving||!owner()||!setupPhase()||!model?.[kind]?.enabled)return;
  const operation={binding,room:actionRoom(),kind},step=kind==='start'?model.start.step:kind;
  actionPending=operation;actionStatus('');syncActions();
  try{await binding.run(step,trigger);}
  catch(error){if(actionPending===operation&&actionRoom()===operation.room)actionStatus(error.message||'無法完成房間操作');}
  finally{if(actionPending===operation){actionPending=null;syncActions();const active=document.activeElement;if(actionRoom()===operation.room&&trigger?.isConnected&&!trigger.disabled&&!document.querySelector('dialog[open]')&&(active===trigger||active===document.body))trigger.focus({preventScroll:true});}}
 }
 function syncActions(){
  const binding=boundActions();if(!binding||!panel)return;
  const model=binding.read(),setup=setupPhase(),pending=!!actionPending;
  for(const kind of ['start','bot']){
   const button=proxies[kind],action=model[kind],visible=setup&&(kind==='start'||owner()),label=action?.label||actions[kind].label;
   if(button.dataset.roomPrimaryLabel!==label){window.GameUI?.decorateButton(button,kind==='start'&&action?.step==='prepare'?'next':actions[kind].icon,{label,iconOnly:kind!=='start'});button.dataset.roomPrimaryLabel=label;}
   button.hidden=!visible;button.disabled=!visible||!owner()||!action?.enabled||pending||leaving;
   button.setAttribute('aria-busy',String(pending&&actionPending.kind===kind));
  }
  // The roster gets the actual owned button, never a proxy to a hidden button.
  if(!rosterButton){rosterButton=decorate(node('button',''),'bot');rosterButton.type='button';rosterButton.onclick=()=>invokeAction('bot',rosterButton);}
  rosterButton.disabled=!owner()||!model.bot?.enabled||pending||leaving;
  rosterButton.setAttribute('aria-busy',String(pending&&actionPending.kind==='bot'));
  if(state.phase==='waiting'&&owner()&&window.RoomWaiting?.setRosterAction){window.RoomWaiting.setRosterAction(rosterButton);proxies.bot.hidden=true;}
  else if(rosterButton.closest('.ui-room-roster-add'))window.RoomWaiting?.setRosterAction(null);
  const row=panel.querySelector('.ui-room-session-actions');
  for(const kind of ['start','bot']){const host=model.host||row;if(proxies[kind].parentElement!==host)host.insertBefore(proxies[kind],kind==='start'?host.firstChild:null);}
 }
 function bindActions(binding){
  if(actionBinding)throw Error('Room actions already bound');
  actionBinding=binding;schedule();
  return {refresh(){if(boundActions()){syncActions();schedule();}}};
 }
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function decorate(button,kind){const action=actions[kind];button.classList.add('ui-room-action');button.dataset.roomAction=kind;window.GameUI?.decorateButton(button,action.icon,{iconOnly:kind!=='start',label:action.label});if(!window.GameUI){button.textContent=action.label;button.setAttribute('aria-label',action.label);}return button;}
 function rosterAction(button,kind='bot'){
  const action=actions[kind];const card=node('article','ui-room-roster-card ui-room-roster-add');card.setAttribute('role','listitem');button.classList.add('ui-room-roster-action-button');button.type='button';button.dataset.roomCommonAction=kind;button.setAttribute('aria-label',action.label);
  const avatar=node('span','ui-room-roster-avatar'),icon=node('span','ui-symbol');icon.setAttribute('aria-hidden','true');const symbol=window.GameUI?.symbol?.(action.icon);if(symbol)icon.innerHTML=symbol;else icon.textContent='+';avatar.append(icon);
  const info=node('span','ui-room-roster-info');info.append(node('b','ui-room-roster-action-label',action.label),node('small','ui-room-roster-status',kind==='invite'?'選擇目前在線的玩家':'協助測試遊戲流程'));button.replaceChildren(avatar,info);card.append(button);return card;
 }
 function primaryAction(button,{step='start'}={}){if(!button)return button;button.dataset.roomNativeAction='start';button.tabIndex=-1;button.setAttribute('aria-hidden','true');if(step==='prepare')button.dataset.roomPrimaryAction='prepare';else if(step==='start')button.dataset.do='start';return button;}
 function owner(){return state&&(state.host===true||state.host===state.me||state.hostId===state.me);}
 function hidden(n){for(let a=n;a;a=a.parentElement)if(a.hidden||getComputedStyle(a).display==='none'||getComputedStyle(a).visibility==='hidden')return true;return false;}
 function normalizeFields(source){
  source.classList.add('ui-room-settings-source');if(source.tagName==='DETAILS')source.open=true;window.GameUI.frameFields(source);
  for(const grid of source.querySelectorAll('.fields,.settings,.room-settings'))grid.classList.add('ui-room-setting-grid');
  for(const label of source.querySelectorAll('label')){
   const field=label.closest('.ui-field,.ui-room-setting-field');if(field){field.classList.add('ui-room-setting-field');continue;}
   const input=label.htmlFor?document.getElementById(label.htmlFor):label.querySelector('input,select');
   if(!input||!source.contains(input))continue;
   if(input.parentElement===label){label.classList.add(['checkbox','radio'].includes(input.type)?'ui-room-setting-choice':'ui-room-setting-field');continue;}
   if(input.parentElement===label.parentElement){const wrapper=node('div','ui-room-setting-field');label.before(wrapper);wrapper.append(label,input);}
  }
 }
 function readonlySettings(){
  const options=state.options||{},key=JSON.stringify([state.type,options,state.roundLimit,state.target,state.customPercent,state.clipSeconds]);
  if(readonlySource?.isConnected&&readonlyKey===key)return readonlySource;
  readonlyKey=key;const source=node('div','');source.dataset.roomSetting='';source.dataset.roomSnapshot='true';
  const field=(id,label,value,choices)=>{const group=node('div','ui-room-setting-field'),caption=node('label','',label),control=node(choices?'select':'input','');control.id='readonly-setting-'+id;caption.htmlFor=control.id;control.disabled=true;
   if(choices){for(const [v,text]of choices){const option=node('option','',text);option.value=String(v);control.append(option);}control.value=String(value);}else{control.type='text';control.value=String(value);}
   group.append(caption,control);source.append(group);
  };
  const percent=value=>field('custom-percent','玩家投稿比例',value==null?'auto':value,[['auto','自動'],[0,'0%'],[25,'25%'],[50,'50%'],[75,'75%'],[100,'100%'],...(value!=null&&![0,25,50,75,100].includes(value)?[[value,value+'%']]:[])]);
  if(state.type==='telephone'){
   const sources=options.sources||['everyday','silly'];field('sources','獨立情境題庫',sources.length===2?'both':sources[0],[['both','生活＋奇想'],['everyday','生活情境'],['silly','奇想情境']]);
   if(options.seconds!=null)field('seconds','每頁時間',options.seconds+' 秒');
  }else if(state.type==='majority'){field('rounds','這局玩幾題？',state.roundLimit??options.rounds);percent(options.customPercent);}
  else if(state.type==='gift'){field('target','兩條分數的勝利目標',state.target);percent(state.customPercent);}
  else if(state.type==='musicquiz'){field('clip-seconds','音樂片段長度',(state.clipSeconds??6)+' 秒');}
  else if(state.type==='bluff'){
   const group=node('fieldset',''),legend=node('legend','','題目難度（至少選一種）');group.disabled=true;group.append(legend);
   for(const level of [1,2,3]){const label=node('label','ui-room-setting-choice'),input=node('input','');input.type='checkbox';input.checked=(options.levels||[]).includes(level);input.disabled=true;label.append(input,document.createTextNode(' '+level+' 級'));group.append(label);}source.append(group);field('role-seconds','看身分時間',(options.roleSeconds??30)+' 秒');
  }else if(state.type==='quacks'){field('witches','草藥女巫擴充',options.witches?'加入':'不加入');field('alchemists','煉金術士擴充',options.alchemists?'加入':'不加入');field('hidden-progress','隱藏他人大釜',options.hiddenProgress?'隱藏至爆炸／結算':'公開進度');}
  else source.append(node('p','ui-room-settings-note','本遊戲使用固定規則，無需調整。'));
  readonlySource=source;return source;
 }
 function alignNativePanel(outer){
  const slot=panel.querySelector('.ui-room-settings-slot');
  const controls='button:not([data-room-native-action]),input:not([data-room-native-action]),select:not([data-room-native-action]),textarea:not([data-room-native-action])';
  function scan(parent){
   for(const child of [...parent.children]){
    if(child===panel||child.id==="socialBar")continue;
    if(child.contains(panel)){if(!child.classList.contains('ui-room-panel-host'))child.classList.add('ui-room-panel-host');scan(child);continue;}
    // Preserve personal controls (for example TRPG role choice) within content.
    if(child.matches('.race-utility-panel'))continue;
    if(!child.hidden&&!hidden(child)&&!child.matches('.shared-game-ui,.room-action-dock')&&(child.matches(controls)||child.querySelector(controls))){slot.append(child);continue;}
    if(!child.classList.contains('ui-room-native-placeholder'))child.classList.add('ui-room-native-placeholder');
   }
  }
  scan(outer);
 }
 function restorePlayPanels(){
  if(!playPanels)return;
  for(const [n,home]of playPanels.homes){n.classList.remove('ui-game-operation-source');if(home.parentNode)home.after(n);home.remove();}
  for(const [n,entry]of playPanels.drawingActions){n.classList.remove('ui-operation-native-action');if(entry.tabIndex===null)n.removeAttribute('tabindex');else n.setAttribute('tabindex',entry.tabIndex);if(entry.ariaHidden===null)n.removeAttribute('aria-hidden');else n.setAttribute('aria-hidden',entry.ariaHidden);}
  playPanels.host.classList.remove('ui-room-play-tools');playPanels.frame.remove();playPanels=null;
 }
 function syncPlayPanels(){
  if(!playPanels)return;const r=playPanels;
  const move=n=>{if(!n||n===r.frame||n===r.content||n.contains(r.content)||n.closest('.shared-chat')||n.matches('.shared-chat,.shared-game-ui,.room-action-dock'))return;if(!r.homes.has(n)){const home=document.createComment('game-operation-home');n.before(home);r.homes.set(n,home);}n.classList.add('ui-game-operation-source');if(n.parentElement!==r.content)r.content.append(n);};
  for(const n of [...r.host.children])move(n);
  if(r.type==='poker')move(document.querySelector('.play-area > .action-panel'));
  if(r.type==='thunder')move(document.querySelector('.race-controls'));
  if(['minimal','telephone'].includes(r.type)){
   const answer=document.querySelector('#controls > .ui-drawing-task-answer'),buttons=[...(answer?.querySelectorAll('button')||[])].filter(n=>!n.hasAttribute('data-room-native-action'));
   const hint=answer?.querySelector('p')?.textContent||'在中央完成作畫或填答，再送出本輪內容。';if(r.hint.textContent!==hint)r.hint.textContent=hint;
   for(const [n,entry]of r.drawingActions)if(!buttons.includes(n)){entry.proxy.remove();r.drawingActions.delete(n);}
   for(const n of buttons){let entry=r.drawingActions.get(n);if(!entry){const proxy=node('button','ui-game-operation-action');proxy.type='button';proxy.onclick=()=>n.click();entry={proxy,tabIndex:n.getAttribute('tabindex'),ariaHidden:n.getAttribute('aria-hidden'),label:null};r.drawingActions.set(n,entry);n.classList.add('ui-operation-native-action');n.tabIndex=-1;n.setAttribute('aria-hidden','true');r.drawingRow.append(proxy);}
    const label=n.getAttribute('aria-label')||n.textContent.trim();if(label!==entry.label){entry.label=label;window.GameUI.decorateButton(entry.proxy,'check',{label});}if(entry.proxy.disabled!==n.disabled)entry.proxy.disabled=n.disabled;
   }
  }
 }
 function mountPlayPanels(host,type){
  if(!host){restorePlayPanels();return null;}if(playPanels&&playPanels.host!==host)restorePlayPanels();
  if(!playPanels){
   const frame=node('section','ui-game-operations'),title=node('h2','','遊戲操作'),header=node('div','ui-game-operations-header'),content=node('div','ui-game-operations-content'),footer=node('div','');title.id='gameOperationsTitle';frame.setAttribute('aria-labelledby',title.id);header.append(title);content.tabIndex=0;content.setAttribute('role','region');content.setAttribute('aria-label','遊戲操作選項');footer.hidden=true;window.GameUI.framePanel(frame,{header,content,footer});host.prepend(frame);host.classList.add('ui-room-play-tools');host.classList.remove('ui-game-chat-host');
   playPanels={host,type,frame,content,homes:new Map(),drawingActions:new Map()};
   if(['minimal','telephone'].includes(type)){playPanels.hint=node('p','');playPanels.drawingRow=node('div','ui-control-stack');content.append(playPanels.hint,playPanels.drawingRow);}
  }
  syncPlayPanels();return host;
 }
 function mount(){
  const type=state.type||'poker',sourceHost=type==='quacks'&&document.body.dataset.roomLayout==='custom'?document.getElementById('qWaitingControls'):['telephone','musicquiz','minimal','bluff','trpg','quacks'].includes(type)?document.getElementById('controls'):document.querySelector(type==='thunder'?'.race-controls':'.room-sidebar,.table-sidebar');
  const host=sourceHost===playPanels?.host?playPanels.content:sourceHost;
  if(!host)return;
  if(!panel){panel=node('section','ui-room-controls');panel.dataset.roomCommon='';panel.setAttribute('aria-label','房間設定與操作');
   const settings=node('section','ui-room-settings-card'),heading=node('h2','ui-room-settings-heading','房間設定'),slot=node('div','ui-room-settings-slot');settings.append(slot);proxies.heading=heading;
   const row=node('div','ui-room-session-actions');row.setAttribute('aria-label','房間操作');
   for(const kind of ['start','bot','leave']){const button=decorate(node('button',''),kind);button.type='button';button.onclick=()=>kind==='leave'?leave(button):invokeAction(kind,button);proxies[kind]=button;row.append(button);}
   const status=node('p','ui-room-control-status'),footer=node('footer','ui-room-settings-footer');status.setAttribute('role','status');status.setAttribute('aria-live','polite');footer.append(status,row);window.GameUI.framePanel(panel,{header:heading,content:settings,footer});host.append(panel);
  }
  const settingsHost=window.RoomLayout?.settingsHost?.(host,state)||host;
  if(panel.parentElement!==settingsHost)settingsHost.append(panel);
  panel.dataset.aiPlacement=window.RoomWaiting?.setRosterBusy||state.type==='telephone'&&window.RoomWaiting?.setRosterAction?'roster':'inline';
  const inPlay=!setupPhase();if(panel.hidden!==inPlay)panel.hidden=inPlay;
 }
 function chatActions(){
  const tools=document.querySelector('.ui-room-chat .chat-room-tools');if(!tools||!proxies.leave)return;
  const manage=document.getElementById('managePlayers');
  if(proxies.leave.parentElement!==tools)tools.append(proxies.leave);
  window.GameUI.decorateButton(proxies.leave,'leave',{iconOnly:true,label:'離開房間'});
  if(manage){if(state.type==='quacks')rememberCustom(manage);window.GameUI.decorateButton(manage,'users',{iconOnly:true,label:'房間管理'});if(manage.parentElement!==tools)tools.insertBefore(manage,proxies.leave);}
  proxies.leave.hidden=false;proxies.leave.disabled=leaving||!!actionPending;
 }
 function normalize(){
  scheduled=false;if(!state||window.RaceLesson)return;const customQuacks=state.type==='quacks'&&document.body.dataset.roomLayout==='custom';if(document.body.dataset.roomLayout==='custom'&&(!customQuacks||state.phase!=='waiting')){if(boundActions()){mount();syncActions();}if(customHomes.size)restoreCustom({keepChatActions:customQuacks});if(customQuacks)chatActions();window.RoomInvites?.updateRoom(state);return;}syncPlayPanels();mount();if(!panel)return;
  window.RoomInvites?.updateRoom(state);
  if(window.RoomInvites?.ready&&playPanels){if(!proxies.invite){proxies.invite=decorate(node('button',''),'invite');proxies.invite.onclick=()=>window.RoomInvites.open(proxies.invite);}const header=playPanels.frame.querySelector('.ui-game-operations-header');if(proxies.invite.parentElement!==header)header.append(proxies.invite);}
  const legacyInvite=document.getElementById('invite');if(legacyInvite&&legacyInvite.dataset.roomLinkLabel!=='true'){legacyInvite.dataset.roomLinkLabel='true';window.GameUI?.decorateButton(legacyInvite,'external',{label:'複製房間連結'});}
  syncActions();
  const manage=document.getElementById('managePlayers'),row=panel.querySelector('.ui-room-session-actions');
  const inPlay=!setupPhase(),chat=document.querySelector('.shared-chat'),tools=chat?.querySelector('.chat-room-tools'),commonChat=chat?.classList.contains('ui-room-chat'),actionHost=(inPlay||commonChat)&&tools?tools:row;
  if(proxies.leave.parentElement!==actionHost)actionHost.append(proxies.leave);
  if(manage){if(customQuacks)rememberCustom(manage);if(manage.dataset.roomAction!=='manage')decorate(manage,'manage');if(manage.parentElement!==actionHost||manage.nextElementSibling!==proxies.leave)actionHost.insertBefore(manage,proxies.leave);}
  if(chat){const value=String(state.phase!=='waiting');if(chat.dataset.gameChat!==value)chat.dataset.gameChat=value;chat.parentElement?.classList.remove('ui-game-chat-host');}

  const hasManage=String(!!manage);if(panel.dataset.hasManage!==hasManage)panel.dataset.hasManage=hasManage;
  const ownLeave=document.getElementById('leave'),legacyLinks=document.querySelectorAll('.room-leave,#back');if(customQuacks)rememberCustom(ownLeave);
  if(ownLeave&&!ownLeave.hasAttribute('data-room-native-action')){ownLeave.setAttribute('data-room-native-action','leave');ownLeave.tabIndex=-1;ownLeave.setAttribute('aria-hidden','true');}
  for(const n of legacyLinks)if(!n.hasAttribute('data-room-native-action')){n.setAttribute('data-room-native-action','leave');n.tabIndex=-1;n.setAttribute('aria-hidden','true');}
  const leaveDisabled=leaving||!!actionPending||!!ownLeave?.disabled;if(proxies.leave.disabled!==leaveDisabled)proxies.leave.disabled=leaveDisabled;if(proxies.leave.hidden)proxies.leave.hidden=false;
  const setup=state.phase==='waiting'||['draw','bluff','telephone','quacks'].includes(state.type)&&state.phase==='finished',card=panel.querySelector('.ui-room-settings-card');if(card.hidden===setup)card.hidden=!setup;const heading=proxies.heading;if(heading.hidden===setup)heading.hidden=!setup;for(const legacy of document.querySelectorAll('[data-room-settings-heading]'))if(!legacy.hidden)legacy.hidden=true;
  // Like chat, the header belongs inside the outer panel and above its content lines.
  if(heading.parentElement!==panel)panel.prepend(heading);
  const outer=panel.closest('.ui-room-waiting-controls'),frame=outer?.parentElement;
  if(frame?.classList.contains('ui-room-settings-frame')){frame.before(outer);frame.remove();}
  if(panel.dataset.titleExternal!=='false')panel.dataset.titleExternal='false';
  if(setup){
   let source=[...document.querySelectorAll('.room-settings-panel')].find(n=>!n.closest('[data-room-common]'));
   if(!owner()&&!source)source=settingsSource?.isConnected&&settingsSource.dataset.roomSnapshot!=='true'?settingsSource:readonlySettings();
   if(!source&&owner()){
    const base=document.getElementById('controls')||document.getElementById('hostButtons');
    const fields=base?[...base.querySelectorAll('label,fieldset,.mode-note')].filter(n=>!n.closest('[data-room-common]')&&!n.closest('fieldset label')):[];
    if(fields.length){source=node('div','');source.dataset.roomSetting='';base.prepend(source);for(const n of fields)if(!fields.some(other=>other!==n&&other.contains(n))){source.append(n);if(n.tagName==='LABEL'&&n.htmlFor){const input=document.getElementById(n.htmlFor);if(input&&base.contains(input)&&!n.contains(input))source.append(input);}}}
   }
   const slot=panel.querySelector('.ui-room-settings-slot');
   if(source){const changed=source!==settingsSource;settingsSource=source;source.dataset.roomReadOnly=String(!owner());if(!owner())for(const input of source.querySelectorAll('input,select,textarea,button'))if(!input.disabled)input.disabled=true;if(changed){normalizeFields(source);for(const previous of [...slot.children])if(previous!==source&&previous.classList.contains("ui-room-settings-source"))previous.remove();slot.prepend(source);}}
   else if(!settingsSource||!settingsSource.isConnected){settingsSource=null;const text=owner()?'本遊戲使用固定規則，無需調整。':'由房主調整房間設定。';if(slot.textContent!==text)slot.replaceChildren(node('p','ui-room-settings-note',text));}
  }
  if(state.phase==='waiting'&&outer){alignNativePanel(outer);if(customQuacks)window.QuacksStitch?.waitingRoom(state);window.GameUI?.Template?.patterns.refreshWaiting?.(outer.closest('.ui-room-waiting-layout'));}
  if(inPlay||commonChat)chatActions();document.dispatchEvent(new CustomEvent('room-controls-rendered'));
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(normalize);}
 const dialog=node('dialog','ui-dialog room-leave-dialog');dialog.setAttribute('aria-labelledby','unified-leave-title');
 dialog.innerHTML='<h2 id="unified-leave-title">確定離開這個房間？</h2><img class="ui-room-leave-thumbnail" src="/assets/room-leave-thumbnail.jpg" width="640" height="361" alt="離別場景，字幕：多麼虎頭蛇尾的結局"><p class="ui-room-leave-effect"></p><div class="ui-control-row"><button type="button" class="ui-button primary" data-confirm>確認離開</button><button type="button" class="ui-button secondary" data-cancel>留在房間</button></div><p class="ui-room-leave-status" role="status" aria-live="polite"></p>';
 window.GameUI?.frameDialog?.(dialog);
 document.body.append(dialog);const confirm=dialog.querySelector('[data-confirm]'),cancel=dialog.querySelector('[data-cancel]');window.GameUI?.decorateButton(confirm,'leave',{label:'確認離開'});window.GameUI?.decorateButton(cancel,'close',{label:'留在房間'});
 cancel.onclick=()=>{if(!leaving)dialog.close();};dialog.addEventListener('cancel',event=>{if(leaving)event.preventDefault();});
 function leave(trigger){if(!state||window.RaceLesson||leaving||actionPending||dialog.open)return;const type=state.type||'poker';dialog.querySelector('.ui-room-leave-effect').textContent=['telephone','trpg','musicquiz','minimal','bluff','quacks'].includes(type)&&!setupPhase()?'離席會中止本場遊戲，保留已完成內容。離開後返回遊戲大廳。':type==='draw'&&!setupPhase()?'畫者離席會揭曉本輪；人數不足時本場結束。離開後返回遊戲大廳。':'離開後返回遊戲大廳；房主離開時依遊戲規則移交房主或結束房間。';dialog.querySelector('.ui-room-leave-status').textContent='';if(window.GameUI?.openDialog)window.GameUI.openDialog(dialog,trigger);else dialog.showModal();}
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
 window.addEventListener('pagehide',()=>{leaveController?.abort();actionPending=null;});window.addEventListener('pageshow',schedule);
 window.addEventListener('room-invitations-ready',schedule);
 window.RoomControls={update(next){if(window.RaceLesson)return;if(state&&state.code===next.code&&next.version<state.version)return;if(state&&(state.code!==next.code||state.me!==next.me)){leaveController?.abort();actionPending=null;actionStatus('');if(dialog.open)dialog.close();}state=next;schedule();},bindActions,leave,decorate,rosterAction,primaryAction,mountPlayPanels,inviteContext:()=>state?{code:state.code,type:state.type}:null,stop(){state=null;actionPending=null;leaveController?.abort();restorePlayPanels();if(panel)panel.hidden=true;}};
})();
