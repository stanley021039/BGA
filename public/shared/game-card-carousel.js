/* Adds a presentation controller around the existing hub's game handlers.
   Room creation/joining, profile, lobby movement and transport remain unchanged. */
(()=>{
 const root=document.querySelector('[data-card-carousel]');if(!root)return;
 const cards=[...root.querySelectorAll('.game-tile')],previous=document.querySelector('#carouselPrevious'),next=document.querySelector('#carouselNext'),counter=document.querySelector('#carouselCounter');
 const opener=document.querySelector('#openCreateRoom'),market=document.querySelector('#marketLaunch'),dialog=document.querySelector('#createRoomDialog');
 let index=Math.max(0,cards.findIndex(card=>card.classList.contains('selected'))),gesture=null,suppressUntil=0,controllerCard=null;
 function title(card){return card.querySelector('h2')?.childNodes[0]?.textContent.trim()||'遊戲';}
 function select(value,activate=false,focus=false){
  index=((value%cards.length)+cards.length)%cards.length;
  const chosen=cards[index],isMarket=!chosen.dataset.game;
  const visibleCount=Math.min(cards.length,root.clientWidth>=1000?6:root.clientWidth>=700?5:root.clientWidth>=340?3:1),radius=Math.floor(visibleCount/2);
  const outerScale=Math.max(.48,1-radius*.18);
  const step=radius?Math.min(260,Math.max(50,(root.clientWidth/2-cards[0].offsetWidth*outerScale/2-40)/radius)):0;
  root.style.setProperty('--card-step',step+'px');
  cards.forEach((card,i)=>{const half=Math.floor(cards.length/2),offset=((i-index+half+cards.length)%cards.length)-half,distance=Math.abs(offset),visible=offset>=-radius&&offset<=visibleCount-radius-1;card.style.setProperty('--slot',offset);card.style.setProperty('--rotation',offset*6+'deg');card.style.setProperty('--dip',distance*18+'px');card.style.setProperty('--scale',Math.max(.48,1-distance*.18));card.style.setProperty('--card-z',10-distance);card.style.setProperty('--card-opacity',visible?1:0);card.style.visibility=visible?'visible':'hidden';card.tabIndex=i===index?0:-1;if(card.dataset.game)card.setAttribute('aria-pressed',String(i===index));else card.setAttribute('aria-current',i===index?'true':'false');});
  previous.disabled=next.disabled=cards.length<2;
  counter.textContent=String(index+1).padStart(2,'0')+' / '+String(cards.length).padStart(2,'0');
  counter.setAttribute('aria-label',title(chosen)+'，第 '+(index+1)+' 款，共 '+cards.length+' 款');
  opener.hidden=isMarket;market.hidden=!isMarket;
  opener.textContent='開一桌'+title(chosen)+' ↗';
  const heading=dialog.querySelector('h2');heading.textContent='開一桌'+title(chosen);
  if(activate&&chosen.dataset.game){controllerCard=chosen;try{chosen.click();}finally{controllerCard=null;}}
  if(focus)chosen.focus({preventScroll:true});
 }
 cards.forEach((card,i)=>card.addEventListener('click',event=>{
  if(performance.now()<suppressUntil&&controllerCard!==card){event.preventDefault();event.stopImmediatePropagation();return;}
  select(i);
 },true));
 previous.onclick=()=>select(index-1,true);next.onclick=()=>select(index+1,true);
 root.addEventListener('keydown',event=>{const positions={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:cards.length-1};if(Object.hasOwn(positions,event.key)){event.preventDefault();select(positions[event.key],true,true);}});
 root.addEventListener('pointerdown',event=>{if(event.button===0&&event.isPrimary!==false)gesture={id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};});
 root.addEventListener('pointermove',event=>{if(!gesture||event.pointerId!==gesture.id)return;const x=event.clientX-gesture.x,y=event.clientY-gesture.y;if(!gesture.horizontal&&Math.abs(x)>12&&Math.abs(x)>Math.abs(y)*1.3){gesture.horizontal=true;root.setPointerCapture(event.pointerId);root.classList.add('dragging');}if(gesture.horizontal){event.preventDefault();root.style.setProperty('--drag',x*.22+'px');}});
 function end(event,cancel=false){if(!gesture||event.pointerId!==gesture.id)return;const x=event.clientX-gesture.x;if(gesture.horizontal){suppressUntil=performance.now()+350;if(!cancel&&Math.abs(x)>65){const destination=index+(x<0?1:-1);/* Invoke the existing handler before suppressing the browser's trailing click. */suppressUntil=0;select(destination,true);suppressUntil=performance.now()+350;}}root.style.removeProperty('--drag');root.classList.remove('dragging');if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);gesture=null;}
 root.addEventListener('pointerup',event=>end(event));root.addEventListener('pointercancel',event=>end(event,true));root.addEventListener('dragstart',event=>event.preventDefault());
 opener.onclick=()=>{window.GameUI?.openDialog?GameUI.openDialog(dialog,opener):dialog.showModal();};
 dialog.querySelector('[data-close-create]').onclick=()=>window.GameUI?.closeDialog?GameUI.closeDialog(dialog):dialog.close();
 window.GameUI?.decorateButton?.(previous,'previous',{iconOnly:true,label:'上一款遊戲'});
 window.GameUI?.decorateButton?.(next,'next',{iconOnly:true,label:'下一款遊戲'});
 window.GameUI?.decorateButton?.(dialog.querySelector('[data-close-create]'),'close',{iconOnly:true,label:'關閉建立房間'});
 const media=window.matchMedia('(prefers-reduced-motion: reduce)');
 const syncMotion=()=>root.classList.toggle('carousel-reduced',media.matches||(window.MotionPolicy&&!MotionPolicy.allowsMotion()));
 media.addEventListener?.('change',syncMotion);const unsubscribe=window.MotionPolicy?.subscribe(syncMotion);
 const resetGesture=()=>{if(gesture&&root.hasPointerCapture(gesture.id))root.releasePointerCapture(gesture.id);root.style.removeProperty('--drag');root.classList.remove('dragging');gesture=null;};
 const resize=new ResizeObserver(()=>select(index));resize.observe(root);
 window.addEventListener('pagehide',event=>{resetGesture();if(!event.persisted){resize.disconnect();unsubscribe?.();media.removeEventListener?.('change',syncMotion);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetGesture();syncMotion();});
 select(index);syncMotion();
})();
