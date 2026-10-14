/* Shared hierarchy: objects -> compositions -> patterns -> page adapters.
   Native game nodes stay owned by their existing controllers. */
(()=>{
 'use strict';
 if(!window.GameUI)return;
 const ui=window.GameUI;
 const mounted=new WeakSet();
 function element(tag,{className='',text,attrs={}}={}){
  const node=document.createElement(tag);node.className=className;
  if(text!==undefined)node.textContent=text;
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
 }
 function button({label,icon,primary=false,onClick}={}){
  const node=element('button',{text:label,attrs:{type:'button'},className:'tpl-button'+(primary?' tpl-button--primary':'')});
  if(icon)ui.decorateButton(node,icon,{iconOnly:true,label});
  if(onClick)node.addEventListener('click',onClick);return node;
 }
 function characterMarkup(player){
  const image=element('img',{attrs:{src:player.avatar||(player.bot?'/assets/characters/sunny-neutral.png':'/assets/characters/traveler-neutral.png'),alt:''}});
  return image.outerHTML;
 }
 function panel({title,content=[],actions=[]}={}){
  const root=element('section',{className:'tpl-panel tpl-stack'});
  const header=element('header',{className:'tpl-panel__header'}),body=element('div',{className:'tpl-panel__body'}),footer=element('footer',{className:'tpl-panel__footer'});
  header.append(element('h2',{text:title}));body.append(...content);footer.append(...actions);
  root.append(header,body,footer);return {root,header,body,footer};
 }
 function disclosure({label,icon='settings',content=[],open=false}={}){
  const root=element('details',{className:'tpl-disclosure'}),summary=element('summary'),body=element('div',{className:'tpl-disclosure__content'});
  const glyph=element('span',{className:'ui-symbol',attrs:{'aria-hidden':'true'}});glyph.innerHTML=ui.symbol(icon);summary.append(glyph,element('span',{text:label}));body.append(...content);root.append(summary,body);root.open=open;
  ui.bindPopover?.(root,body,{align:'start'});return root;
 }
 function dialogPanel({title,titleId,className='',closeLabel='關閉'}={}){
  const root=ui.createDialog({title,titleId,className});
  const close=button({label:closeLabel,icon:'close',onClick:()=>root.close()});
  const body=element('div',{className:'tpl-dialog-body'});root.prepend(close);root.append(body);document.body.append(root);
  return {root,body,open:trigger=>ui.openDialog(root,trigger),close:()=>{if(root.open)root.close();}};
 }
 function frame(node,kind){if(node)node.classList.add('tpl-'+kind);return node;}
 const gate=window.MotionPolicy?.createGate(),events=new Map();let context='';
 function updateRoster(container,state){
  if(!container||!state)return;
  const key=state.type+':'+state.code+':'+state.me;
  if(key!==context){context=key;events.clear();}
  const live=gate?.update(state)??false,now=Number(state.serverNow)||Date.now(),recent=new Map();
  for(const event of [...(state.expressions||[]),...(state.social||[]).filter(e=>e.kind==='expression')])if(now-event.at>=0&&now-event.at<5000)recent.set(event.playerId,event);
  for(const row of container.querySelectorAll('[data-player-id]')){
   frame(row,'player');row.dataset.self=String(row.dataset.playerId===state.me);
   const avatar=row.querySelector('.room-player-avatar,.ui-room-roster-avatar');if(!avatar)continue;frame(avatar,'portrait');
   const reaction=recent.get(row.dataset.playerId);let bubble=avatar.querySelector('.tpl-reaction');
   if(!reaction){bubble?.remove();continue;}
   if(!bubble){bubble=element('span',{className:'tpl-reaction'});avatar.append(bubble);}
   bubble.textContent=reaction.label||reaction.expression; // plain text, no remote HTML
   if(events.get(row.dataset.playerId)!==reaction.id){
    events.set(row.dataset.playerId,reaction.id);
    if(live)window.MotionPolicy?.animate(avatar,[{transform:'translateY(0)'},{transform:'translateY(-5px)'},{transform:'translateY(0)'}],{duration:280});
   }
  }
 }
 function grid(root,{roster,stage,chat}={}){
  frame(root,'game-grid');frame(roster,'roster');frame(stage,'stage');frame(chat,'chat');
  return root;
 }
 function mountLobby(){
  const root=document.querySelector('.club');if(!root)return;
  if(mounted.has(root))return;mounted.add(root);
  frame(root,'page');frame(root.querySelector('main'),'lobby-grid');
  frame(root.querySelector('.lobby-section'),'panel');frame(root.querySelector('.rooms-section'),'panel');
  const heading=root.querySelector('.library-heading'),carousel=root.querySelector('.game-carousel-section');
  if(heading&&carousel)carousel.prepend(heading);
  const rooms=root.querySelector('.rooms-section'),join=rooms?.querySelector('.room-code-panel');
  if(join)rooms.prepend(join);
  for(const card of root.querySelectorAll('.game-tile'))frame(card,'game-card');
  const footer=root.querySelector('.carousel-footer'),deck=root.querySelector('[data-card-carousel]');
  if(footer&&deck){
   const summary=element('div',{className:'tpl-game-summary'}),title=element('strong'),description=element('p');summary.append(title,description);footer.querySelector('.carousel-actions')?.before(summary);
   const update=card=>{if(!card)return;title.textContent=card.querySelector('h2')?.childNodes[0]?.textContent.trim()||'';description.textContent=card.querySelector('.tile-body p')?.textContent.trim()||'';};
   deck.addEventListener('game-card-selected',event=>update(event.detail.card));update(deck.querySelector('.selected'));
  }
  const top=root.querySelector('.lobby-top');
  if(top&&!top.querySelector('[data-template-emotes]')){
   const emotes=button({label:'選擇我的大廳表情',icon:'emoji',onClick:()=>{
    const self=root.querySelector('button.lobby-avatar');if(self)self.click();else window.GameUI?.notify?.('角色正在載入，請稍後再試');
   }});emotes.dataset.templateEmotes='';top.append(emotes);
  }
 }
 function mountDrawing(){
  const root=document.querySelector('.draw-layout');if(!root)return;
  if(mounted.has(root))return;mounted.add(root);
  const toolbar=document.querySelector('.draw-shell>.game-toolbar');
  if(toolbar&&!document.getElementById('drawingPlayTitle')){
   const title=element('h1',{text:'你畫我猜',attrs:{id:'drawingPlayTitle'}});title.hidden=true;toolbar.prepend(title);
  }
  frame(document.querySelector('.draw-shell'),'page');
  grid(root,{roster:root.querySelector('.draw-roster'),stage:root.querySelector('main'),chat:root.querySelector('aside')});
  frame(document.querySelector('#tools'),'toolbar');
  const board=document.getElementById('boardSection'),palette=document.querySelector('#tools>.color-row');
  if(board&&palette){
   palette.classList.add('tpl-palette');board.append(palette);
   const menu=palette.querySelector('#colorMenu'),swatches=menu?.querySelector('#swatches');
   if(swatches){menu.after(swatches);menu.hidden=true;}
  }
  let queued=false;
  function fitViewport(){
   queued=false;
   const top=root.getBoundingClientRect().top+window.scrollY;
   const footer=document.querySelector('.st-site-footer');
   const bottom=(footer?footer.getBoundingClientRect().height:46)+(document.body.dataset.drawPhase==='waiting'?24:16);
   const height=Math.max(440,Math.floor(window.innerHeight-top-bottom));
   if(document.body.style.getPropertyValue('--tpl-game-height')!==height+'px')document.body.style.setProperty('--tpl-game-height',height+'px');
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(fitViewport);}}
  window.addEventListener('resize',schedule);
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class','data-room-phase']});
  if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(document.querySelector('.draw-shell>[data-site-header]'));
  schedule();
 }
 function measureBoard({board,frame,viewport,tools,gap}){
  if(!document.body.dataset.uiTemplate||document.body.classList.contains('ui-large-text')||!matchMedia('(min-width:1101px) and (min-height:680px)').matches)return null;
  const below=tools&&matchMedia('(max-height:800px)').matches;
  const css=getComputedStyle(board),paddingX=parseFloat(css.paddingLeft)+parseFloat(css.paddingRight),paddingBottom=parseFloat(css.paddingBottom);
  const row=Number(getComputedStyle(frame).gridRowStart)-1,rowHeight=css.gridTemplateRows.split(/\s+/).map(parseFloat)[row];
  const available=Number.isFinite(rowHeight)&&rowHeight>0?rowHeight:viewport.clientHeight-paddingBottom-(frame.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop)-(below?tools.getBoundingClientRect().height+gap:0);
  const paperInset=document.body.dataset.drawRole==='artist'&&document.body.dataset.drawPhase==='drawing'?16:0;
  return {width:board.clientWidth-paddingX-(!below&&tools?tools.getBoundingClientRect().width+gap:0)-paperInset,available:available-paperInset};
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
   document.querySelector('.game-toolbar nav')?.append(trigger);nextSettings={dialog,body,trigger};
  }
  if(nextSettings.trigger.hidden)nextSettings.trigger.hidden=false;return nextSettings.body;
 }
 function openSettings(trigger){if(nextSettings)ui.openDialog(nextSettings.dialog,trigger);}
 function arrangeWaiting(layout,waiting=true){
  if(!document.body.dataset.uiTemplate||document.body.dataset.gameKind!=='draw'||!layout)return;
  const chat=layout.querySelector('.ui-room-chat-slot')||waitingChat?.dialog.querySelector('.ui-room-chat-slot');
  // Move the complete controller host; its internal settings slot belongs to RoomControls.
  const settings=layout.querySelector('.ui-room-waiting-controls'),guestSide=layout.querySelector('.st-waiting-guest-aside');
  if(!waiting){if(waitingChat?.dialog.open)waitingChat.dialog.close();if(chat&&chat.parentElement!==layout)layout.append(chat);if(settings&&settings.parentElement!==layout)layout.append(settings);if(guestSide&&!guestSide.hidden)guestSide.hidden=true;return;}
  let center=layout.querySelector('.tpl-waiting-center');
  if(!center){center=element('div',{className:'tpl-waiting-center tpl-stack'});layout.append(center);}
  const hero=layout.querySelector(':scope>.room-waiting-template');if(hero)center.append(hero);
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
 function podium({players,winners=[],correctCounts={}}){
  const root=element('div',{className:'tpl-podium'}),top=element('ol',{className:'stage-player-cards st-podium-cards'}),rest=element('ol',{className:'st-ranking-list'});let rank=0,previous=null;
  players.forEach((player,index)=>{if(player.score!==previous)rank=index+1;previous=player.score;
   const card=element('li',{className:index<3?'stage-player-card st-podium-cell':'st-ranking-row'});card.dataset.rank=rank;card.dataset.podium=index+1;card.dataset.winner=String(winners.includes(player.id));
   if(winners.includes(player.id))card.classList.add('stage-winner');
   const image=element('img',{className:'stage-avatar',attrs:{src:player.avatar||(player.bot?'/assets/characters/sunny-neutral.png':'/assets/characters/traveler-neutral.png'),alt:''}}),name=element('b');name.innerHTML=ui.playerName(player.name);const score=element('strong',{text:player.score+' 分'});
   card.append(image,name,score);
   if(index<3){const base=element('div',{className:'st-podium-base'});base.append(element('span',{className:'stage-card-rank',text:rank,attrs:{'aria-label':'排名 '+rank}}),element('span',{className:'st-podium-medal',text:winners.includes(player.id)?winners.length>1?'共同優勝':'CHAMPION':index===1?'SILVER':'BRONZE'}));card.append(base);top.append(card);}
   else{card.prepend(element('span',{text:'#'+rank}));card.append(element('small',{text:'猜中 '+(correctCounts[player.id]||0)+' 次'}));rest.append(card);}
  });root.append(top);if(players.length>3){root.append(element('h3',{text:'完整排名席次'}),rest);}return root.outerHTML;
 }
 ui.Template={objects:{element,button,frame,characterMarkup},compositions:{panel,disclosure,dialogPanel,podium},patterns:{grid,updateRoster,measureBoard,arrangeWaiting,settingsHost,openSettings},pages:{mountLobby,mountDrawing}};
 if(document.body.dataset.uiTemplate){if(document.body.dataset.gameKind==='draw')mountDrawing();else mountLobby();}
 window.addEventListener('pagehide',event=>{if(!event.persisted)gate?.dispose();});
})();
