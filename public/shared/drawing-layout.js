/* Drawing layout owns board geometry and responsive placement, never game state. */
(()=>{
 'use strict';
 let mountedRoot=null;
 const element=(tag,{text,attrs={}}={})=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;for(const [key,value]of Object.entries(attrs))n.setAttribute(key,value);return n;};
 const frame=(node,kind)=>{if(node)node.classList.add('tpl-'+kind);return node;};
 function measureBoard({board,frame,viewport,tools,gap}){
  if(!document.body.dataset.uiTemplate||document.body.classList.contains('ui-large-text')||!matchMedia('(min-width:1101px) and (min-height:680px)').matches)return null;
  const below=tools&&matchMedia('(max-height:800px)').matches;
  const css=getComputedStyle(board),paddingX=parseFloat(css.paddingLeft)+parseFloat(css.paddingRight),paddingBottom=parseFloat(css.paddingBottom);
  const row=Number(getComputedStyle(frame).gridRowStart)-1,rowHeight=css.gridTemplateRows.split(/\s+/).map(parseFloat)[row];
  const available=Number.isFinite(rowHeight)&&rowHeight>0?rowHeight:viewport.clientHeight-paddingBottom-(frame.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop)-(below?tools.getBoundingClientRect().height+gap:0);
  const paperInset=document.body.dataset.drawRole==='artist'&&document.body.dataset.drawPhase==='drawing'?16:0;
  return {width:board.clientWidth-paddingX-(!below&&tools?tools.getBoundingClientRect().width+gap:0)-paperInset,available:available-paperInset};
 }
 /* Drawing games share the telephone flow: left players, middle drawing/answer, right room chat. */
 let drawingPlay=null,drawingFitFrame=null;
 function scheduleDrawingBoardFit(){
  if(drawingFitFrame!==null)return;
  drawingFitFrame=requestAnimationFrame(()=>{
   drawingFitFrame=null;if(!drawingPlay)return;
   for(const board of drawingPlay.work.querySelectorAll('.ui-drawing-board')){
    const frame=board.querySelector(':scope > .canvas-frame'),scene=frame?.querySelector('#canvasStage');
    if(!frame||window.matchMedia('(max-width:760px)').matches||scene&&!scene.hidden){board.style.removeProperty('--ui-drawing-canvas-width');continue;}
    const viewport=board.closest('.ui-drawing-task-board,#source')||board,tools=board.querySelector(':scope > .tools:not([hidden])'),css=getComputedStyle(board),gap=parseFloat(css.columnGap)||0;
    const measurements=measureBoard({board,frame,viewport,tools,gap});
    const width=measurements?.width??board.clientWidth-(tools?tools.getBoundingClientRect().width+gap:0),offset=frame.getBoundingClientRect().top-viewport.getBoundingClientRect().top+viewport.scrollTop,available=measurements?.available??viewport.clientHeight-offset;
    if(available<(measurements?64:120)){board.style.removeProperty('--ui-drawing-canvas-width');continue;}
    const value=Math.floor(Math.min(width,2*Math.max(0,available-2)))+'px';
    if(board.style.getPropertyValue('--ui-drawing-canvas-width')!==value)board.style.setProperty('--ui-drawing-canvas-width',value);
   }
  });
 }

 function createDrawingBoard({title='',canvas,countdown=null,tools=null}={}){
  const doc=canvas?.ownerDocument||document,area=doc.createElement('div'),head=doc.createElement('div'),heading=doc.createElement('div'),caption=doc.createElement('h3'),frame=doc.createElement('div');
  area.className='ui-drawing-board';head.className='board-head';heading.className='board-heading';caption.textContent=title;heading.append(caption);head.append(heading);frame.className='canvas-frame';if(canvas)frame.append(canvas);area.append(head);if(countdown)area.append(countdown);area.append(frame);if(tools){tools.classList.add('tools');area.append(tools);}return area;
 }
 function frameDrawingTask(controls){
  if(!controls)return;
  let board=controls.querySelector(':scope > .ui-drawing-task-board'),answer=controls.querySelector(':scope > .ui-drawing-task-answer');
  if(!board||!answer){
   const children=[...controls.children];board=document.createElement('div');answer=document.createElement('div');board.className='ui-drawing-task-board';answer.className='ui-drawing-task-answer';controls.append(board,answer);
   for(const child of children)(child.matches('.ui-drawing-board')?board:answer).append(child);
  }
  controls.classList.add('ui-drawing-task-controls');board.hidden=!board.childElementCount;scheduleDrawingBoardFit();
 }
 function layoutDrawingPlay(type,phase){
  if(!['draw','minimal','telephone'].includes(type))return null;
  const active=phase!=='waiting'&&(phase!=='finished'||type==='draw'&&!!document.body.dataset.uiTemplate);
  if(!active){
   if(drawingPlay){
    const record=drawingPlay;record.fitObserver?.disconnect();for(const board of record.work.querySelectorAll('.ui-drawing-board'))board.style.removeProperty('--ui-drawing-canvas-width');record.root.classList.remove('ui-drawing-play-layout');record.roster.classList.remove('ui-drawing-play-roster');record.work.classList.remove('ui-drawing-play-work');record.chat.classList.remove('ui-drawing-play-chat');record.results?.classList.remove('ui-drawing-play-results');record.title?.classList.remove('ui-drawing-play-title');if(record.createdTitle)record.title.hidden=true;
    for(const [node,home]of record.homes){if(home.parentNode)home.after(node);home.remove();}record.homes.clear();
    if(record.createdWork)record.work.remove();if(record.createdChat)record.chat.remove();drawingPlay=null;
   }
   document.body.classList.remove('ui-drawing-play-mode');return null;
  }
  if(!drawingPlay){
   const root=document.querySelector(type==='draw'?'.draw-layout':'#game');
   const roster=type==='draw'?document.querySelector('.draw-roster'):document.querySelector('#players')?.closest('section');
   const controls=type==='draw'?null:document.querySelector('#controls')?.closest('section');
   if(!root||!roster||type!=='draw'&&!controls)return null;
   const homes=new Map(),move=(node,to)=>{const home=document.createComment('drawing-play-home');node.before(home);homes.set(node,home);to.append(node);};
   let work=type==='draw'?root.querySelector(':scope > main'):controls,createdWork=false;
   if(type==='minimal'){const source=document.querySelector('#source');if(source.parentElement===controls.parentElement)work=source.parentElement;else{work=document.createElement('section');work.className='panel';source.before(work);move(source,work);move(controls,work);createdWork=true;}}
   let chat=type==='draw'?root.querySelector(':scope > aside'):document.createElement('aside'),createdChat=type!=='draw';
   if(createdChat){chat.className='panel room-sidebar';chat.setAttribute('aria-label','聊天室與房間操作');root.append(chat);}
   const results=type==='draw'?null:document.querySelector(type==='minimal'?'#results':'#books')?.closest('section');
   const title=type==='draw'?document.querySelector('#drawingPlayTitle'):document.querySelector('.telephone-shell > h1');let createdTitle=type==='draw',heading=title;
   if(type==='draw'&&!heading){heading=document.createElement('h1');heading.id='drawingPlayTitle';heading.textContent='你畫我猜';const toolbar=document.querySelector('.draw-shell > .game-toolbar');(toolbar||root).before(heading);createdTitle=true;}
   if(type==='draw'){const phaseHead=root.querySelector(':scope > .stage-head');if(phaseHead)move(phaseHead,roster);}
   drawingPlay={root,roster,work,chat,results,title:heading,homes,createdWork,createdChat,createdTitle};
   if(typeof ResizeObserver==='function'){drawingPlay.fitObserver=new ResizeObserver(scheduleDrawingBoardFit);drawingPlay.fitObserver.observe(work);}
  }
  const record=drawingPlay;document.body.classList.add('ui-drawing-play-mode');record.root.classList.add('ui-drawing-play-layout');record.roster.classList.add('ui-drawing-play-roster');record.work.classList.add('ui-drawing-play-work');record.chat.classList.add('ui-drawing-play-chat');record.results?.classList.add('ui-drawing-play-results');record.title?.classList.add('ui-drawing-play-title');if(record.createdTitle)record.title.hidden=false;scheduleDrawingBoardFit();return record.chat;
 }
 function mountDrawing(){
  const root=document.querySelector('.draw-layout');if(!root)return;
  if(mountedRoot===root)return;mountedRoot=root;
  const toolbar=document.querySelector('.draw-shell>.game-toolbar');
  if(toolbar&&!document.getElementById('drawingPlayTitle')){
   const title=element('h1',{text:'你畫我猜',attrs:{id:'drawingPlayTitle'}});title.hidden=true;toolbar.prepend(title);
  }
  frame(document.querySelector('.draw-shell'),'page');
  frame(root,'game-grid');frame(root.querySelector('.draw-roster'),'roster');frame(root.querySelector('main'),'stage');frame(root.querySelector('aside'),'chat');
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
  const header=document.querySelector('.draw-shell>[data-site-header]');if(header&&typeof ResizeObserver==='function')new ResizeObserver(schedule).observe(header);
  schedule();
 }

 window.DrawingLayout={createBoard:createDrawingBoard,frameTask:frameDrawingTask,update:layoutDrawingPlay,mount:mountDrawing};
 // Compatibility names point down to the layout module; primitives never call a page pattern.
 Object.assign(window.GameUI,{createDrawingBoard,frameDrawingTask,layoutDrawingPlay});
 if(document.body.dataset.uiTemplate&&document.body.dataset.gameKind==='draw')mountDrawing();
})();
