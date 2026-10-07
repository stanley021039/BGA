/* Shared positioning for occasional menus. Essential game information stays inline. */
((root)=>{
 const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)));
 function placement(anchor,size,viewport,{align='start',placement:preferred='bottom',gap=8,padding=8}={}){
  const left=viewport.left||0,top=viewport.top||0,right=left+viewport.width,bottom=top+viewport.height;
  const width=Math.min(size.width,Math.max(0,viewport.width-2*padding));
  const below=Math.max(0,bottom-padding-anchor.bottom-gap),above=Math.max(0,anchor.top-gap-top-padding);
  const side=preferred==='top'?(size.height<=above||above>=below?'top':'bottom'):(size.height<=below||below>=above?'bottom':'top');
  const height=Math.min(size.height,side==='bottom'?below:above);
  return {left:clamp(align==='end'?anchor.right-width:anchor.left,left+padding,right-padding-width),top:clamp(side==='bottom'?anchor.bottom+gap:anchor.top-gap-height,top+padding,bottom-padding-height),width,maxHeight:height,side};
 }
 if(typeof module==='object'&&module.exports)module.exports={placement};
 if(!root.document)return;
 const bindings=new WeakMap(),active=new Set(),all=new Set(),pointerStarts=new WeakMap();
 const containsTarget=(panel,target)=>target===panel||!!target?.nodeType&&panel.contains(target);
 function setStyles(style,values){for(const [key,value] of Object.entries(values))if(style[key]!==value)style[key]=value;}
 function bind(trigger,panel,options={}){
  if(!trigger||!panel)return null;if(bindings.has(panel))return bindings.get(panel);
  const original=panel.getAttribute('style'),originalPopover=panel.getAttribute('popover');
  let opened=false,frame=0,destroyed=false,resizeObserver;
  const isOpen=options.isOpen||(()=>!panel.hidden);
  const inline=()=>options.inlineBelow&&innerWidth<=options.inlineBelow;
  function reset(){
   if(frame){cancelAnimationFrame(frame);frame=0;}pointerStarts.delete(api);
   if(typeof panel.hidePopover==='function'&&panel.matches(':popover-open'))panel.hidePopover();
   if(originalPopover===null)panel.removeAttribute('popover');else panel.setAttribute('popover',originalPopover);
   if(original===null)panel.removeAttribute('style');else panel.setAttribute('style',original);
   panel.removeAttribute('data-popover-side');active.delete(api);opened=false;
  }
  function close(focus=false){options.onClose?.();sync();if(focus)trigger.focus();}
  function position(){
   frame=0;if(!opened||!isOpen())return;
   const view=root.visualViewport,viewport={left:view?.offsetLeft||0,top:view?.offsetTop||0,width:view?.width||innerWidth,height:view?.height||innerHeight};
   const anchor=trigger.getBoundingClientRect();
   if(!trigger.isConnected||!panel.isConnected||!anchor.width||!anchor.height||anchor.bottom<viewport.top||anchor.top>viewport.top+viewport.height||anchor.right<viewport.left||anchor.left>viewport.left+viewport.width){close();return;}
   const style=panel.style;
   setStyles(style,{position:'fixed',margin:'0',inset:'auto',transform:'none',boxSizing:'border-box',minWidth:'0',minHeight:'0',zIndex:'1000',overflow:'auto',maxWidth:Math.max(0,viewport.width-16)+'px'});
   if(options.width)setStyles(style,{width:(options.width==='trigger'?anchor.width:options.width)+'px'});
   // Read scrollHeight under the existing constraint. Temporarily expanding
   // maxHeight can clamp scrollTop while a user is dragging the scrollbar.
   const size=panel.getBoundingClientRect(),naturalHeight=Math.max(size.height,Math.min(panel.scrollHeight+size.height-panel.clientHeight,viewport.height-16));
   const result=placement(anchor,{width:size.width,height:naturalHeight},viewport,options);
   setStyles(style,{left:result.left+'px',top:result.top+'px',maxHeight:result.maxHeight+'px'});
   panel.dataset.popoverSide=result.side;
  }
  function schedule(){if(opened&&!frame)frame=requestAnimationFrame(position);}
  function sync(){
   if(destroyed)return;
   if(!isOpen()||inline()){if(opened)reset();return;}
   if(!opened){
    for(const other of [...active])if(other!==api)other.close();
    opened=true;active.add(api);
    if(typeof panel.showPopover==='function'){panel.setAttribute('popover','manual');panel.showPopover();}
   }
   position();
  }
  function destroy(){destroyed=true;hiddenObserver.disconnect();resizeObserver?.disconnect();if(frame)cancelAnimationFrame(frame);if(opened)reset();all.delete(api);bindings.delete(panel);}
  const api={sync,close,position:schedule,destroy,trigger,panel};bindings.set(panel,api);all.add(api);
  const hiddenObserver=new MutationObserver(sync);hiddenObserver.observe(panel,{attributes:true,attributeFilter:['hidden']});
  if(typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(panel);resizeObserver.observe(trigger);}
  sync();return api;
 }
 function bindDetails(details,panel,options={}){
  const trigger=details?.querySelector(':scope > summary');
  const api=bind(trigger,panel,{...options,isOpen:()=>details.open,onClose:()=>{details.open=false;}});
  details?.addEventListener('toggle',()=>api?.sync());return api;
 }
 function bindOverlay(panel,container){
  if(!panel||!container)return;const original=panel.getAttribute('style');let opened=false,frame=0;
  function position(){
   frame=0;if(panel.hidden)return;
   const view=root.visualViewport,left=view?.offsetLeft||0,top=view?.offsetTop||0,width=view?.width||innerWidth,height=view?.height||innerHeight,bounds=container.getBoundingClientRect();
   let minX=Math.max(left,bounds.left)+8,maxX=Math.min(left+width,bounds.right)-8,minY=Math.max(top,bounds.top)+8,maxY=Math.min(top+height,bounds.bottom)-8;
   // A thin sliver of the stage cannot hold readable text and a skip control.
   if(maxX-minX<160||maxY-minY<160){minX=left+8;maxX=left+width-8;minY=top+8;maxY=top+height-8;}
   Object.assign(panel.style,{position:'fixed',margin:'0',right:'auto',bottom:'auto',boxSizing:'border-box',overflow:'auto',minHeight:'0',minWidth:'0',maxWidth:Math.max(0,maxX-minX)+'px',maxHeight:Math.max(0,maxY-minY)+'px',zIndex:'1000'});
   // Preserve the skin's translate(-50%, -50%) entrance animation.
   panel.style.left=(minX+maxX)/2+'px';panel.style.top=(minY+maxY)/2+'px';
  }
  function sync(){
   if(panel.hidden){if(!opened)return;if(typeof panel.hidePopover==='function'&&panel.matches(':popover-open'))panel.hidePopover();panel.removeAttribute('popover');if(original===null)panel.removeAttribute('style');else panel.setAttribute('style',original);opened=false;return;}
   if(!opened){for(const api of [...active])api.close();opened=true;if(typeof panel.showPopover==='function'){panel.setAttribute('popover','manual');panel.showPopover();}}
   position();
  }
  const schedule=()=>{if(opened&&!frame)frame=requestAnimationFrame(position);};
  new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['hidden']});
  if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(schedule);observer.observe(panel);observer.observe(container);}
  root.addEventListener('resize',schedule);root.addEventListener('scroll',event=>{if(!containsTarget(panel,event.target))schedule();},true);root.visualViewport?.addEventListener('resize',schedule);root.visualViewport?.addEventListener('scroll',schedule);
  sync();return {sync,position:schedule};
 }
 root.UIPopover={bind,bindDetails,bindOverlay,placement};
 document.addEventListener('pointerdown',event=>{for(const api of active)pointerStarts.set(api,{id:event.pointerId,inside:containsTarget(api.panel,event.target)||containsTarget(api.trigger,event.target)});},true);
 document.addEventListener('pointercancel',event=>{for(const api of active)if(pointerStarts.get(api)?.id===event.pointerId)pointerStarts.delete(api);},true);
 document.addEventListener('click',event=>{for(const api of [...active]){const started=pointerStarts.get(api);pointerStarts.delete(api);if(!containsTarget(api.panel,event.target)&&!containsTarget(api.trigger,event.target)&&!(started?.inside&&event.detail!==0))api.close();}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))for(const api of [...active]){event.preventDefault();api.close(true);}});
 const reposition=event=>{for(const api of active)if(!containsTarget(api.panel,event?.target))api.position();},resize=()=>{for(const api of all)api.sync();};
 root.addEventListener('resize',resize);root.addEventListener('scroll',reposition,true);
 root.visualViewport?.addEventListener('resize',resize);root.visualViewport?.addEventListener('scroll',reposition);
 // Game renderers replace action panels. Release old bindings rather than retaining their DOM.
 new MutationObserver(records=>{if(records.some(record=>record.removedNodes.length))for(const api of [...all])if(!api.trigger.isConnected||!api.panel.isConnected)api.destroy();}).observe(document.body,{childList:true,subtree:true});
})(typeof window==='object'?window:globalThis);
