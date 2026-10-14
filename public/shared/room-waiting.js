(()=>{
 'use strict';
 const games={
  poker:['德州撲克','好牌已備，等你入座。','2–6 人一起玩。跟注、加注，或把這一手全部押上。'],
  majority:['同頻俱樂部','朋友到齊，默契就位。','3–12 人一起玩。輪流挑題，跟最多朋友想到一起就得分。'],
  gift:['送禮達人','禮物擺好，等你開桌。','3–8 人一起玩。選禮物、標喜好，再一起揭曉朋友的心願。'],
  draw:['你畫我猜','畫筆已備，等你開畫。','2–8 人一起玩。輪流畫圖，其他朋友一起猜出答案。'],
  telephone:['傳情畫意','故事已備，等你傳遞。','3–8 人一起玩。文字與圖畫接力，最後一起翻開傳遞簿。'],
  trpg:['霧港跑團','冒險已備，等你出發。','1–6 人一起玩。選擇角色，與朋友一起完成六幕冒險。'],
  musicquiz:['猜歌挑戰','旋律已備，等你聽題。','1–8 人一起玩。聽六秒旋律開頭，猜歌名後一起揭曉。'],
  minimal:['極簡猜圖','線條已備，等你作畫。','3–6 人一起玩。用直線與圓作畫，由少到多一起猜圖。'],
  quacks:['郎中闖江湖','藥袋已備，等你開釜。','2–4 人一起煮藥；草藥女巫支援 5 人，逐色投票搭配藥材書。'],
  bluff:['瞎掰王','角色已備，等你開場。','3–9 人一起玩。輪流解釋與質問，找出唯一的老實人。']
 };
 let hero,stageHome,roster,rosterList,rosterCount,rosterActionCard,actionHome,actionClasses,actionChildren,actionBusy=false,lastRoster='',layout,controls,layoutWaiting=false;
 const homes=new Map();
 function move(el,host){if(!el||el.parentElement===host)return;if(!homes.has(el)){const mark=document.createComment('waiting-home');el.before(mark);homes.set(el,mark);}host.append(el);}
 function restore(el){const mark=homes.get(el);if(mark?.parentNode)mark.after(el);}
 function arrange(type,waiting,s){
  if(waiting)window.RoomStage?.update(s,true);
  const phase=document.body.dataset.roomPhase;if(waiting||phase==='finished')window.GameUI?.layoutDrawingPlay?.(type,phase);
  if(!layout){
   const host=document.querySelector(rosterHosts[type]);
   controls=document.querySelector(type==='thunder'?'.race-side-column':type==='poker'?'.table-sidebar':type==='trpg'?'.action-panel':['telephone','musicquiz','minimal','bluff','quacks'].includes(type)?'#controls':'.room-sidebar');
   if(['telephone','musicquiz','minimal','bluff','quacks'].includes(type))controls=controls?.closest('section');
   if(!host||!controls||!hero)return;
   layout=node('div','ui-room-waiting-layout');layout.setAttribute('aria-label','組隊房間');
   const chatSlot=node('div','ui-room-chat-slot');layout.append(chatSlot);host.append(layout);
   host.dataset.waitingLayoutHost='';controls.classList.add('ui-room-waiting-controls');
   // Hide the original play containers while their controls live in the shared grid.
   for(const child of [...host.children])if(![layout,hero,controls,roster].includes(child)&&!child.dataset.waitingEssential&&!child.classList.contains('game-barrage-layer'))child.dataset.waitingLayoutHidden='';
  }
  layout.hidden=!waiting;
  if(waiting!==layoutWaiting){
   layoutWaiting=waiting;
   if(waiting){move(hero,layout);move(controls,layout);move(roster,layout);layout.append(layout.querySelector('.ui-room-chat-slot'));}
   else{restore(hero);restore(controls);restore(roster);}
  }
  const guide=document.getElementById('guide'),info=hero.querySelector('.room-waiting-info');
  if(guide&&info){if(waiting)move(guide,info);else restore(guide);}
  const drawingChat=waiting?null:window.RoomStage?.update(s,false)||window.GameUI?.layoutDrawingPlay?.(type,phase);
  const chatHost=drawingChat||(waiting?layout.querySelector('.ui-room-chat-slot'):type==='thunder'?controls.querySelector('.race-utility-panel'):controls);
  window.SharedChat?.mountIn(chatHost,{inline:true});
  const nativePeer=type==='draw'?document.querySelector('.draw-roster'):type==='thunder'?document.querySelector('.race-roster'):['majority','gift'].includes(type)?document.querySelector('.game-roster'):null;
  window.SharedChat?.matchRosterHeight?.(waiting||phase==='finished'||drawingChat?null:nativePeer||roster);
 }
 const rosterHosts={
  poker:'#game .game-layout',thunder:'.race-main',majority:'.play-layout',gift:'.gift-layout',draw:'.draw-layout',
  telephone:'#game',trpg:'#game',musicquiz:'#game',minimal:'#game',bluff:'#game',quacks:'#game'
 };
 function node(tag,className,text){
  const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;
 }
 function updateRoster(s,type){
  if(!['waiting','finished','showdown'].includes(s.phase)){if(roster)roster.hidden=true;return;}
  const selector=rosterHosts[type];if(!selector)return;const host=document.querySelector(selector);if(!host)return;
  if(!roster){
   roster=node('section','ui-room-roster');roster.setAttribute('aria-labelledby','waitingRosterTitle');
   const heading=node('div','ui-room-roster-heading'),title=node('h2','','這桌的朋友');title.id='waitingRosterTitle';
   rosterCount=node('span','ui-room-roster-count');heading.append(title,rosterCount);
   rosterList=node('div','ui-room-roster-list');rosterList.setAttribute('role','list');rosterList.setAttribute('aria-label','已入座玩家，可捲動查看');rosterList.tabIndex=0;
   roster.append(heading,rosterList);host.append(roster);
   const originals=type==='poker'?document.querySelectorAll('.poker-ui .shared-players-heading,.poker-ui #shared-players'):
    [type==='thunder'?document.querySelector('.race-roster'):type==='draw'?document.querySelector('.draw-roster'):['gift','majority'].includes(type)?document.querySelector('.game-roster'):document.querySelector('#players')?.closest('section')];
   for(const original of originals)if(original)original.dataset.waitingNativeRoster='';
  }
  roster.hidden=false;
  const players=(s.players||[]).filter(p=>!p.kicked),hostId=typeof s.host==='string'?s.host:s.hostId||(s.host?s.me:null);
  rosterCount.textContent=players.length+' 位已入座 · 捲動查看';
  const key=JSON.stringify([s.me,hostId,players.map(p=>[p.id,p.name,p.avatar,p.bot,p.online,p.offline,p.roleName])]);
  if(key===lastRoster)return;lastRoster=key;
  const scrollTop=rosterList.scrollTop;
  rosterList.replaceChildren(...players.map(player=>{
   const card=node('article','ui-room-roster-card');card.setAttribute('role','listitem');card.dataset.playerId=player.id;card.dataset.self=String(player.id===s.me);
   const avatar=node('div','ui-room-roster-avatar'),fallback=node('span','ui-room-roster-fallback',String(player.name||'？').slice(0,1));fallback.setAttribute('aria-hidden','true');
   const img=node('img','');img.alt='';img.src=player.avatar||(player.bot?'/assets/characters/sunny-neutral.png':'/assets/characters/traveler-neutral.png');
   img.onerror=()=>{img.hidden=true;};avatar.append(fallback,img);
   const info=node('div','ui-room-roster-info'),name=node('div','ui-room-roster-name'),label=node('b','ui-room-roster-name-text ui-player-name');label.title=player.name||'玩家';label.append(node('span','ui-player-name-text',player.name||'玩家'));
   name.append(label);
   const status=[player.id===hostId?'房主':'',player.roleName||'',player.online===false||player.offline?'暫時離線':'已入座'].filter(Boolean).join(' · ');
   info.append(name,node('small','ui-room-roster-status',status));card.append(avatar,info);return card;
  }));
  if(rosterActionCard)rosterList.append(rosterActionCard);
  rosterList.scrollTop=scrollTop;
 }

 // Teaching belongs to the waiting room and standalone introductions.
 function updateTeaching(phase){
  const visible=phase==='waiting';
  for(const teaching of document.querySelectorAll('[data-room-teaching]'))teaching.hidden=!visible;
  if(!visible)for(const dialog of document.querySelectorAll('dialog[data-room-teaching-dialog][open]'))dialog.close();
 }
 const roomPath=/^\/(poker|majority|gift|draw|telephone|trpg|musicquiz|minimal|bluff|quacks|race)\/[a-f0-9]{6}\/?$/i.test(location.pathname);
 updateTeaching(roomPath&&!window.RaceLesson?'connecting':'waiting');
 function update(s){
  if(window.RaceLesson)return;updateTeaching(s.phase);window.RoomControls?.update(s);
  document.body.dataset.roomPhase=s.phase;window.SharedChat?.updateRoom(s);const type=s.type||'poker';document.body.dataset.roomType=type;updateRoster(s,type);if(type==='thunder'){hero=document.querySelector('#waiting');arrange(type,s.phase==='waiting',s);return;}const game=games[type];if(!game)return;
  document.body.dataset.roomPhase=s.phase;
  const stage=document.querySelector('#stage'),sidebar=document.querySelector('#gameSidebar,.draw-layout>aside');
  if(stage&&sidebar){if(!stageHome){stageHome=document.createComment('play-stage');stage.before(stageHome);}if(s.phase==='waiting'){if(stage.parentElement!==sidebar)sidebar.prepend(stage);}else if(stage.parentElement!==stageHome.parentElement)stageHome.after(stage);}
  if(!hero){
   const host=document.querySelector('.play-layout>main,.gift-layout>main,.draw-layout>main,#game .play-area,#game .task-layout,#game .adventure-layout')||(['telephone','quacks'].includes(type)?document.querySelector('#game'):null);
   if(!host)return;
   hero=document.createElement('section');hero.className='room-waiting-template';hero.setAttribute('aria-label','組隊房間介紹');
   const art=document.createElement('div');art.className='room-waiting-art';const image=document.createElement('img');image.src='/assets/playful/game-'+type+'.svg';image.alt=game[0]+'遊戲插畫';art.append(image);
   const info=document.createElement('div');info.className='room-waiting-info';const kicker=document.createElement('div');kicker.className='kicker';kicker.textContent='朋友集結中';const title=document.createElement('h2');title.textContent=game[1];const copy=document.createElement('p');copy.textContent=game[2];const hint=document.createElement('p');hint.className='room-waiting-hint';hint.setAttribute('role','status');info.append(kicker,title,copy,hint);hero.append(art,info);host.prepend(hero);
  }
  hero.hidden=s.phase!=='waiting';
  arrange(type,s.phase==='waiting',s);
  const host=s.host===true||s.host===s.me;
  hero.querySelector('.room-waiting-hint').textContent=host?'邀請朋友入座，設定好就能開始。':'等待房主開始遊戲。';
 }
 // Keep the original native button/handler; the roster only supplies its card layout.
 function setRosterAction(button){
  if(button&&rosterActionCard?.querySelector('button')===button&&!roster.hidden)return true;
  if(rosterActionCard){
   const previous=rosterActionCard.querySelector('button');
   if(previous){previous.className=actionClasses;previous.replaceChildren(...actionChildren);if(actionHome?.parentNode)actionHome.after(previous);}
   actionHome?.remove();rosterActionCard.remove();rosterActionCard=null;
  }
  if(!button||window.RaceLesson||!rosterList||roster.hidden)return false;
  actionHome=document.createComment('roster-action-home');button.before(actionHome);
  actionClasses=button.className;actionChildren=[...button.childNodes];
  for(const name of ['button','ui-button','ui-icon-button','primary','secondary','outline'])button.classList.remove(name);
  const shared=window.RoomControls?.rosterAction?.(button);if(shared){shared.dataset.gameActionSlot='';rosterList.append(shared);rosterActionCard=shared;setRosterBusy(actionBusy);return true;}
  const card=node('article','ui-room-roster-card ui-room-roster-add');card.setAttribute('role','listitem');card.dataset.gameActionSlot='';
  button.classList.add('ui-room-roster-action-button');button.type='button';button.setAttribute('aria-label','加入 AI 測試夥伴');button.title='加入 AI 測試夥伴';
  const avatar=node('span','ui-room-roster-avatar'),icon=node('span','ui-symbol');icon.setAttribute('aria-hidden','true');
  const symbol=window.GameUI?.symbol?.('add');if(symbol)icon.innerHTML=symbol;else icon.textContent='+';
  avatar.append(icon);const info=node('span','ui-room-roster-info');
  info.append(node('b','ui-room-roster-action-label','加入 AI 測試夥伴'),node('small','ui-room-roster-status','協助測試遊戲流程'));
  button.replaceChildren(avatar,info);card.append(button);rosterList.append(card);rosterActionCard=card;setRosterBusy(actionBusy);return true;
 }
 function setRosterBusy(value){
  actionBusy=!!value;rosterActionCard?.setAttribute('aria-busy',String(actionBusy));const button=rosterActionCard?.querySelector('button');if(!button)return;
  if(actionBusy){if(button.dataset.idleDisabled===undefined)button.dataset.idleDisabled=String(button.disabled);button.disabled=true;}
  else if(button.dataset.idleDisabled!==undefined){button.disabled=button.dataset.idleDisabled==='true';delete button.dataset.idleDisabled;}
 }
 // Settings use their existing API handlers; a single change commits a valid selection.
 function bindSettings({container,read,save,canSave,isBusy,onError}){
  let pending=null,running=false,timer;
  async function flush(){
   clearTimeout(timer);if(running)return;
   if(!canSave()){pending=null;return;}
   if(!pending)return;
   if(isBusy()){timer=setTimeout(flush,100);return;}
   const data=pending;pending=null;running=true;
   try{await save(data);}catch(e){onError(e.message);}
   finally{running=false;if(pending)void flush();}
  }
  document.addEventListener('change',e=>{
   if(!e.target.closest(container)||!canSave())return;
   try{pending=read();clearTimeout(timer);timer=setTimeout(flush,0);}catch(e){pending=null;onError(e.message);}
  });
  window.addEventListener('pagehide',()=>{clearTimeout(timer);pending=null;});
  return {flush};
 }
 window.RoomWaiting={update,bindSettings,setRosterAction,setRosterBusy};
})();
