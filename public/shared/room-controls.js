(()=>{
 'use strict';
 let state=null,panel=null,scheduled=false,leaving=false,leaveController=null,settingsSource=null,readonlySource=null,readonlyKey='';
 const native={start:null,bot:null},proxies={};
 const actions={start:{icon:'play',label:'開始遊戲'},bot:{icon:'users',label:'加入 AI 測試夥伴'},manage:{icon:'settings',label:'管理玩家'},leave:{icon:'leave',label:'離房'}};
 const minimumPlayers={poker:2,thunder:2,draw:2,majority:3,gift:3,telephone:3,minimal:3,bluff:3,trpg:1,musicquiz:1,quacks:2};
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
  const original=n=>!n.closest('[data-room-common]')||n.dataset.roomNativeAction===kind;
  let found=[...document.querySelectorAll(selectors)].find(original);
  if(!found){const names=kind==='start'?/^(開始|再來一場|發牌)/:/^(加入腳本測試夥伴|加入測試 AI|加入測試AI|加入.*夥伴|＋.*電腦)/;
   found=[...document.querySelectorAll('#controls button,.action-panel button')].find(n=>original(n)&&names.test(n.getAttribute('aria-label')||n.textContent.trim()));}
  return found||null;
 }
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
  }else if(state.type==='quacks'){field('witches','草藥女巫擴充',options.witches?'加入':'不加入');field('hidden-progress','隱藏他人大釜',options.hiddenProgress?'隱藏至爆炸／結算':'公開進度');}
  else source.append(node('p','ui-room-settings-note','本遊戲使用固定規則，無需調整。'));
  readonlySource=source;return source;
 }
 function alignNativePanel(outer){
  const slot=panel.querySelector('.ui-room-settings-slot');
  const controls='button:not([data-room-native-action]),input:not([data-room-native-action]),select:not([data-room-native-action]),textarea:not([data-room-native-action])';
  function scan(parent){
   for(const child of [...parent.children]){
    if(child===panel)continue;
    if(child.contains(panel)){if(!child.classList.contains('ui-room-panel-host'))child.classList.add('ui-room-panel-host');scan(child);continue;}
    // Preserve personal controls (for example TRPG role choice) within content.
    if(!child.hidden&&!hidden(child)&&!child.matches('.shared-game-ui,.room-action-dock')&&(child.matches(controls)||child.querySelector(controls))){slot.append(child);continue;}
    if(!child.classList.contains('ui-room-native-placeholder'))child.classList.add('ui-room-native-placeholder');
   }
  }
  scan(outer);
 }
 function mount(){
  const type=state.type||'poker',host=['telephone','musicquiz','minimal','bluff','trpg','quacks'].includes(type)?document.getElementById('controls'):document.querySelector(type==='thunder'?'.race-controls':'.room-sidebar,.table-sidebar');
  if(!host)return;
  if(!panel){panel=node('section','ui-room-controls');panel.dataset.roomCommon='';panel.setAttribute('aria-label','房間設定與操作');
   const settings=node('section','ui-room-settings-card'),heading=node('h2','ui-room-settings-heading','房間設定'),slot=node('div','ui-room-settings-slot');settings.append(slot);proxies.heading=heading;
   const row=node('div','ui-room-session-actions');row.setAttribute('aria-label','房間操作');
   for(const kind of ['start','bot','leave']){const button=decorate(node('button',''),kind);button.type='button';button.onclick=()=>kind==='leave'?leave(button):native[kind]?.click();proxies[kind]=button;row.append(button);}
   const status=node('p','ui-room-control-status'),footer=node('footer','ui-room-settings-footer');status.setAttribute('role','status');status.setAttribute('aria-live','polite');footer.append(status,row);window.GameUI.framePanel(panel,{header:heading,content:settings,footer});host.append(panel);
  }
  if(panel.parentElement!==host)host.append(panel);
  panel.dataset.aiPlacement=window.RoomWaiting?.setRosterBusy||state.type==='telephone'&&window.RoomWaiting?.setRosterAction?'roster':'inline';
  const inPlay=!['waiting','finished'].includes(state.phase);if(panel.hidden!==inPlay)panel.hidden=inPlay;
 }
 function normalize(){
  scheduled=false;if(!state||window.RaceLesson)return;mount();if(!panel)return;
  for(const kind of ['start','bot']){
   if(kind==='bot'&&window.RoomWaiting?.setRosterBusy){native.bot=null;if(!proxies.bot.hidden)proxies.bot.hidden=true;if(!proxies.bot.disabled)proxies.bot.disabled=true;continue;}
   const source=findAction(kind);native[kind]=source;if(source&&!source.hasAttribute('data-room-native-action')){source.setAttribute('data-room-native-action',kind);source.tabIndex=-1;source.setAttribute('aria-hidden','true');}
   const legacyRace=state.type==='thunder',rosterBot=state.type==='telephone'&&!!window.RoomWaiting?.setRosterAction,visible=kind==='bot'?state.phase==='waiting'&&!rosterBot&&owner()&&(legacyRace||state.botSupport?.supported!==false)&&(!!source||state.botSupport?.canAdd===false):['waiting','finished'].includes(state.phase),button=proxies[kind];if(button.hidden===visible)button.hidden=!visible;
   const tooFew=kind==='start'&&(state.players||[]).filter(p=>!p.kicked).length<(minimumPlayers[state.type||'poker']||1);
   const disabled=!visible||!source||source.disabled||hidden(source)||button.getAttribute('aria-busy')==='true'||leaving||tooFew||kind==='start'&&!owner()||kind==='bot'&&!legacyRace&&state.botSupport?.canAdd===false;if(button.disabled!==disabled)button.disabled=disabled;
  }
  const manage=document.getElementById('managePlayers'),row=panel.querySelector('.ui-room-session-actions');
  const inPlay=!['waiting','finished'].includes(state.phase),chat=document.querySelector('.shared-chat'),tools=chat?.querySelector('.chat-room-tools'),actionHost=inPlay&&tools?tools:row;
  if(proxies.leave.parentElement!==actionHost)actionHost.append(proxies.leave);
  if(manage){if(manage.dataset.roomAction!=='manage')decorate(manage,'manage');if(manage.parentElement!==actionHost||manage.nextElementSibling!==proxies.leave)actionHost.insertBefore(manage,proxies.leave);}
  if(chat){const value=String(inPlay);if(chat.dataset.gameChat!==value)chat.dataset.gameChat=value;const host=chat.parentElement;if(host&&!host.classList.contains('ui-room-chat-slot'))host.classList.toggle('ui-game-chat-host',inPlay);}

  const hasManage=String(!!manage);if(panel.dataset.hasManage!==hasManage)panel.dataset.hasManage=hasManage;
  const ownLeave=document.getElementById('leave'),legacyLinks=document.querySelectorAll('.room-leave,#back');
  if(ownLeave&&!ownLeave.hasAttribute('data-room-native-action')){ownLeave.setAttribute('data-room-native-action','leave');ownLeave.tabIndex=-1;ownLeave.setAttribute('aria-hidden','true');}
  for(const n of legacyLinks)if(!n.hasAttribute('data-room-native-action')){n.setAttribute('data-room-native-action','leave');n.tabIndex=-1;n.setAttribute('aria-hidden','true');}
  const leaveDisabled=leaving||!!ownLeave?.disabled;if(proxies.leave.disabled!==leaveDisabled)proxies.leave.disabled=leaveDisabled;if(proxies.leave.hidden)proxies.leave.hidden=false;
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
   if(source){const changed=source!==settingsSource;settingsSource=source;source.dataset.roomReadOnly=String(!owner());if(!owner())for(const input of source.querySelectorAll('input,select,textarea,button'))if(!input.disabled)input.disabled=true;if(changed){normalizeFields(source);slot.replaceChildren(source);}}
   else if(!settingsSource||!settingsSource.isConnected){settingsSource=null;const text=owner()?'本遊戲使用固定規則，無需調整。':'由房主調整房間設定。';if(slot.textContent!==text)slot.replaceChildren(node('p','ui-room-settings-note',text));}
  }
  if(state.phase==='waiting'&&outer)alignNativePanel(outer);
 }
 function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(normalize);}
 const dialog=node('dialog','ui-dialog room-leave-dialog');dialog.setAttribute('aria-labelledby','unified-leave-title');
 dialog.innerHTML='<h2 id="unified-leave-title">確定離開這個房間？</h2><p class="ui-room-leave-effect"></p><div class="ui-control-row"><button type="button" class="ui-button primary" data-confirm>確認離開</button><button type="button" class="ui-button secondary" data-cancel>留在房間</button></div><p class="ui-room-leave-status" role="status" aria-live="polite"></p>';
 window.GameUI?.frameDialog?.(dialog);
 document.body.append(dialog);const confirm=dialog.querySelector('[data-confirm]'),cancel=dialog.querySelector('[data-cancel]');window.GameUI?.decorateButton(confirm,'leave',{label:'確認離開'});window.GameUI?.decorateButton(cancel,'close',{label:'留在房間'});
 cancel.onclick=()=>{if(!leaving)dialog.close();};dialog.addEventListener('cancel',event=>{if(leaving)event.preventDefault();});
 function leave(trigger){if(!state||window.RaceLesson||leaving||dialog.open)return;const type=state.type||'poker';dialog.querySelector('.ui-room-leave-effect').textContent=['telephone','trpg','musicquiz','minimal','bluff','quacks'].includes(type)&&!['waiting','finished'].includes(state.phase)?'離席會中止本場遊戲，保留已完成內容。離開後返回遊戲大廳。':type==='draw'&&!['waiting','finished'].includes(state.phase)?'畫者離席會揭曉本輪；人數不足時本場結束。離開後返回遊戲大廳。':'離開後返回遊戲大廳；房主離開時依遊戲規則移交房主或結束房間。';dialog.querySelector('.ui-room-leave-status').textContent='';if(window.GameUI?.openDialog)window.GameUI.openDialog(dialog,trigger);else dialog.showModal();}
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
