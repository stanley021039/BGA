/* One owner for room host placement. Skins receive refs and never reparent these hosts. */
(()=>{
 'use strict';
 const ui=window.GameUI;
 let layout,controls,chatSlot,layoutWaiting=false,stageHome;
 const homes=new Map();
 function node(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function element(tag,{className='',text,attrs={}}={}){const n=node(tag,className,text);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
 function button({label,icon,onClick}={}){const n=node('button','tpl-button',label);n.type='button';if(icon)ui.decorateButton(n,icon,{iconOnly:true,label});if(onClick)n.addEventListener('click',onClick);return n;}
 function dialogPanel({title,titleId,className='',closeLabel}={}){const root=ui.createDialog({title,titleId,className}),body=node('div','tpl-dialog-body');root.prepend(button({label:closeLabel,icon:'close',onClick:()=>root.close()}));root.append(body);document.body.append(root);return {root,body};}
 function move(n,target){if(!n||n.parentElement===target)return;if(!homes.has(n)){const mark=document.createComment('room-layout-home');n.before(mark);homes.set(n,mark);}target.append(n);}
 function restore(n){const mark=homes.get(n);if(mark?.parentNode)mark.after(n);}
 const rosterHosts={
  poker:'#game .game-layout',thunder:'.race-main',majority:'.play-layout',gift:'.gift-layout',draw:'.draw-layout',
  telephone:'#game',trpg:'#game',musicquiz:'#game',minimal:'#game',bluff:'#game',quacks:'#game'
 };
 function placeStage(phase){
  const stage=document.querySelector('#stage'),sidebar=document.querySelector('#gameSidebar,.draw-layout>aside');
  if(!stage||!sidebar)return;
  if(!stageHome){stageHome=document.createComment('play-stage');stage.before(stageHome);}
  if(phase==='waiting'){if(stage.parentElement!==sidebar)sidebar.prepend(stage);}
  else if(stage.parentElement!==stageHome.parentElement)stageHome.after(stage);
 }
 function update(s,refs){
  const {hero,roster}=refs,type=s.type||'poker',waiting=s.phase==='waiting';
  placeStage(s.phase);
  const customQuacks=type==='quacks'&&document.body.dataset.roomLayout==='custom';
  if(waiting)stageUpdate(s,true);
  const phase=document.body.dataset.roomPhase;if(!customQuacks&&(waiting||phase==='finished'))window.DrawingLayout?.update(type,phase);
  if(!layout){
   const host=document.querySelector(rosterHosts[type]);
   controls=document.querySelector(customQuacks?'#qWaitingControls':type==='thunder'?'.race-side-column':type==='poker'?'.table-sidebar':type==='trpg'?'.action-panel':['telephone','musicquiz','minimal','bluff','quacks'].includes(type)?'#controls':'.room-sidebar');
   if(!customQuacks&&['telephone','musicquiz','minimal','bluff','quacks'].includes(type))controls=controls?.closest('section');
   if(!host||!controls||!hero)return;
   layout=node('div','ui-room-waiting-layout');layout.setAttribute('aria-label','組隊房間');
   chatSlot=node('div','ui-room-chat-slot');layout.append(chatSlot);host.append(layout);
   host.dataset.waitingLayoutHost='';controls.classList.add('ui-room-waiting-controls');
   // Hide the original play containers while their controls live in the shared grid.
   for(const child of [...host.children])if(![layout,hero,controls,roster].includes(child)&&!child.dataset.waitingEssential&&!child.classList.contains('game-barrage-layer'))child.dataset.waitingLayoutHidden='';
  }
  layout.hidden=!waiting;if(customQuacks)controls.hidden=!waiting;
  if(waiting!==layoutWaiting){
   layoutWaiting=waiting;
   if(waiting){move(hero,layout);move(controls,layout);move(roster,layout);layout.append(chatSlot);}
   else{restore(hero);restore(controls);restore(roster);}
  }
  const guide=document.getElementById('guide'),info=hero.querySelector('.room-waiting-info');
  if(guide&&info&&!customQuacks){if(waiting)move(guide,info);else restore(guide);}
  const drawingChat=waiting||customQuacks?null:stageUpdate(s,false)||window.DrawingLayout?.update(type,phase);
  const chatHost=drawingChat||(waiting?chatSlot:customQuacks?document.querySelector('#qSocial'):type==='thunder'?controls.querySelector('.race-utility-panel'):controls);
  window.RoomControls?.mountPlayPanels?.(waiting||customQuacks?null:chatHost,type);
  window.SharedChat?.mountIn(chatHost,{inline:true});
  // Chat owns its viewport; operation content never determines its height.
  window.SharedChat?.matchRosterHeight?.(null);
  arrangeWaiting(layout,waiting,{hero,settings:controls,chat:chatSlot});
  return layout;
 }
 let waitingChat;
 let nextSettings;
 function settingsHost(host,state){
  if(!document.body.dataset.uiTemplate||state?.type!=='draw')return host;
  if(state.phase!=='finished'){if(nextSettings?.dialog.open)nextSettings.dialog.close();if(nextSettings&&!nextSettings.trigger.hidden)nextSettings.trigger.hidden=true;return host;}
  if(!nextSettings){
   const component=dialogPanel({title:'下一局設定',titleId:'tplNextSettingsTitle',className:'tpl-settings-dialog',closeLabel:'關閉下一局設定'});
   const dialog=component.root,body=component.body;body.classList.add('tpl-settings-dialog__body');
   const trigger=button({label:'下一局設定',icon:'settings',onClick:()=>ui.openDialog(dialog,trigger)});
   trigger.dataset.templateNextSettings='';
   (document.querySelector('.st-site-more .site-links')||document.querySelector('.game-toolbar nav'))?.append(trigger);nextSettings={dialog,body,trigger};
  }
  if(nextSettings.trigger.hidden)nextSettings.trigger.hidden=false;return nextSettings.body;
 }
 function openSettings(trigger){if(nextSettings)ui.openDialog(nextSettings.dialog,trigger);}
 function arrangeWaiting(layout,waiting,{hero,settings,chat}){
  if(!document.body.dataset.uiTemplate||!['draw','quacks'].includes(document.body.dataset.gameKind)||!layout)return;
  // Move the complete controller host; its internal settings slot belongs to RoomControls.
  const guestSide=layout.querySelector('.st-waiting-guest-aside');
  if(!waiting){if(waitingChat?.dialog.open)waitingChat.dialog.close();if(chat&&chat.parentElement!==layout)layout.append(chat);if(guestSide&&!guestSide.hidden)guestSide.hidden=true;return;}
  let center=layout.querySelector('.tpl-waiting-center');
  if(!center){center=element('div',{className:'tpl-waiting-center tpl-stack'});layout.append(center);}
  if(hero&&hero.parentElement!==center)center.append(hero);
  if(!waitingChat){
   const component=dialogPanel({title:'房間閒聊',titleId:'tplWaitingChatTitle',className:'tpl-chat-dialog',closeLabel:'關閉房間閒聊'});
   const dialog=component.root;
   const trigger=button({label:'房間閒聊與表情',icon:'chat',onClick:()=>ui.openDialog(dialog,trigger)});
   const footer=element('div',{className:'tpl-waiting-footer'});footer.append(trigger,element('span',{text:'房間閒聊與表情'}));center.append(footer);
   waitingChat={dialog,body:component.body,trigger};
  }
  if(document.body.dataset.drawHost==='false'){
   const side=guestSide||element('aside',{className:'st-waiting-guest-aside'});if(!guestSide)layout.append(side);if(side.hidden)side.hidden=false;
   if(settings&&settings.parentElement!==side)side.append(settings);if(chat&&chat.parentElement!==side)side.append(chat);
  }else{
   if(settings&&settings.parentElement!==layout)layout.append(settings);if(guestSide&&!guestSide.hidden)guestSide.hidden=true;
   if(chat&&chat.parentElement!==waitingChat.body)waitingChat.body.append(chat);
  }
 }
 let record=null;
 function moveStage(n,target){if(!n||n.parentElement===target)return;if(!record.homes.has(n)){const mark=document.createComment('room-stage-home');n.before(mark);record.homes.set(n,mark);}target.append(n);}
 function restoreStage(){for(const [n,mark]of record.homes)if(mark.parentNode)mark.after(n);}
 function stageUpdate(s,waiting){
  if(!['quacks','bluff'].includes(s.type))return null;
  const root=document.getElementById('game');if(!root)return null;
  if(waiting){if(record){restoreStage();record.layout.hidden=true;document.body.classList.remove('room-stage-active');}return null;}
  if(!record){const layout=node('div','room-stage-layout'),friends=node('aside','room-stage-friends'),work=node('div','room-stage-work'),chat=node('aside','room-stage-chat');
   friends.setAttribute('aria-label','這桌的朋友');friends.append(node('h2','','這桌的朋友'));const list=node('div','room-stage-roster');friends.append(list);
   chat.setAttribute('aria-label','聊天室');layout.append(friends,work,chat);root.append(layout);record={layout,friends,list,work,chat,homes:new Map(),type:s.type};
  }
  record.layout.hidden=false;document.body.classList.add('room-stage-active');const oldRoster=root.querySelector('.ui-room-roster');if(oldRoster)oldRoster.hidden=true;
  if(s.type==='quacks'){
   for(const selector of ['.game-heading','.round-top','#alchemy','#tableDice','.game-grid','#books']){const n=root.querySelector(selector);if(n)moveStage(selector==='#books'?n.closest('details'):n,record.work);}
   const key=JSON.stringify(s.recipes.map(p=>[p.id,p.name,p.score,p.potColor,p.exploded,p.stopped,p.chosen,p.alchemy]));
   if(record.rosterKey!==key){record.rosterKey=key;record.list.replaceChildren(...s.recipes.map(p=>{
    const item=node('article','room-stage-friend'),avatar=node('span','room-stage-avatar',p.name.slice(0,1)),info=node('div','room-stage-friend-info'),score=node('strong','',String(p.score));
    avatar.style.background=s.potColors?.[p.potColor]?.liquid[1]||'#35564f';info.append(node('strong','',p.name+(p.id===s.me?'（你）':'')),node('small','',p.exploded?'爆炸':p.stopped?'已停止':p.chosen?'已選擇':'準備選擇'));score.setAttribute('aria-label',p.score+' 分');item.append(avatar,info,score);return item;
   }));}
  }else{
   moveStage(document.getElementById('players'),record.list);
   for(const selector of ['#phase','#roleCountdown','.task-layout','#botStatements','#roundReveal']){const n=root.querySelector(selector);if(n)moveStage(['#phase','#botStatements','#roundReveal'].includes(selector)?n.closest('section'):n,record.work);}
  }
  return record.chat;
 }

 window.RoomLayout={update,settingsHost,openSettings,openChat(trigger){if(waitingChat)ui.openDialog(waitingChat.dialog,trigger);}};
})();
