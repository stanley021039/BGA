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
   const avatar=row.querySelector('.room-player-avatar');if(!avatar)continue;frame(avatar,'portrait');
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
  for(const card of root.querySelectorAll('.game-tile'))frame(card,'game-card');
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
  let queued=false;
  function fitViewport(){
   queued=false;
   const top=root.getBoundingClientRect().top+window.scrollY;
   const height=Math.max(440,Math.floor(window.innerHeight-top-16));
   document.body.style.setProperty('--tpl-game-height',height+'px');
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(fitViewport);}}
  window.addEventListener('resize',schedule);
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class','data-room-phase']});
  if(typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(document.querySelector('.draw-shell>[data-site-header]'));
  schedule();
 }
 function measureBoard({board,frame,viewport,tools,gap}){
  if(!document.body.dataset.uiTemplate||document.body.classList.contains('ui-large-text')||!matchMedia('(min-width:1101px) and (min-height:680px)').matches)return null;
  return {width:board.clientWidth,available:viewport.clientHeight-(frame.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop)-(tools?tools.getBoundingClientRect().height+gap:0)};
 }
 ui.Template={objects:{element,button,frame,characterMarkup},compositions:{panel,disclosure},patterns:{grid,updateRoster,measureBoard},pages:{mountLobby,mountDrawing}};
 if(document.body.dataset.uiTemplate){if(document.body.dataset.gameKind==='draw')mountDrawing();else mountLobby();}
 window.addEventListener('pagehide',event=>{if(!event.persisted)gate?.dispose();});
})();
