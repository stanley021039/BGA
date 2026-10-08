/* Adds a presentation controller around the existing hub's game handlers.
   Room creation/joining, profile, lobby movement and transport remain unchanged. */
(()=>{
 const root=document.querySelector('[data-card-carousel]');if(!root)return;
 const cards=[...root.querySelectorAll('.game-tile')],previous=document.querySelector('#carouselPrevious'),next=document.querySelector('#carouselNext'),counter=document.querySelector('#carouselCounter');
 const opener=document.querySelector('#openCreateRoom'),market=document.querySelector('#marketLaunch'),dialog=document.querySelector('#createRoomDialog');
 let index=Math.max(0,cards.findIndex(card=>card.classList.contains('selected'))),gesture=null,suppressUntil=0,activationCard=null;
 function title(card){return card.querySelector('h2')?.childNodes[0]?.textContent.trim()||'遊戲';}
 function select(value,activate=false,focus=false){
  index=Math.max(0,Math.min(cards.length-1,value));
  const chosen=cards[index],isMarket=!chosen.dataset.game;
  cards.forEach((card,i)=>{const offset=i-index;card.style.setProperty('--slot',offset);card.style.setProperty('--rotation',offset*8+'deg');card.style.setProperty('--dip',Math.abs(offset)*22+'px');card.style.setProperty('--scale',offset===0?1:.9);card.style.setProperty('--card-z',10-Math.abs(offset));card.style.setProperty('--card-opacity',Math.abs(offset)>1?0:1);card.style.visibility=Math.abs(offset)>1?'hidden':'visible';card.tabIndex=i===index?0:-1;if(card.dataset.game)card.setAttribute('aria-pressed',String(i===index));else card.setAttribute('aria-current',i===index?'true':'false');});
  previous.disabled=index===0;next.disabled=index===cards.length-1;
  counter.textContent=String(index+1).padStart(2,'0')+' / '+String(cards.length).padStart(2,'0');
  counter.setAttribute('aria-label',title(chosen)+'，第 '+(index+1)+' 款，共 '+cards.length+' 款');
  opener.hidden=isMarket;market.hidden=!isMarket;
  opener.textContent='開一桌'+title(chosen)+' ↗';
  const heading=dialog.querySelector('h2');heading.textContent='開一桌'+title(chosen);
  if(activate&&chosen.dataset.game){activationCard=chosen;try{chosen.click();}finally{activationCard=null;}}
  if(focus)chosen.focus({preventScroll:true});
 }
 cards.forEach((card,i)=>card.addEventListener('click',event=>{
  if(card!==activationCard&&performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();return;}
  select(i);
 },true));
 previous.onclick=()=>select(index-1,true);next.onclick=()=>select(index+1,true);
 root.addEventListener('keydown',event=>{const positions={ArrowLeft:index-1,ArrowRight:index+1,Home:0,End:cards.length-1};if(Object.hasOwn(positions,event.key)){event.preventDefault();select(positions[event.key],true,true);}});
 root.addEventListener('pointerdown',event=>{if(event.button===0&&event.isPrimary!==false)gesture={id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};});
 root.addEventListener('pointermove',event=>{if(!gesture||event.pointerId!==gesture.id)return;const x=event.clientX-gesture.x,y=event.clientY-gesture.y;if(!gesture.horizontal&&Math.abs(x)>12&&Math.abs(x)>Math.abs(y)*1.3){gesture.horizontal=true;root.setPointerCapture(event.pointerId);root.classList.add('dragging');}if(gesture.horizontal){event.preventDefault();root.style.setProperty('--drag',x*.22+'px');}});
 function end(event,cancel=false){if(!gesture||event.pointerId!==gesture.id)return;const x=event.clientX-gesture.x;if(gesture.horizontal){suppressUntil=performance.now()+350;if(!cancel&&Math.abs(x)>65){const destination=Math.max(0,Math.min(cards.length-1,index+(x<0?1:-1)));select(destination,true);}}root.style.removeProperty('--drag');root.classList.remove('dragging');if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);gesture=null;}
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
 window.addEventListener('pagehide',event=>{resetGesture();if(!event.persisted){unsubscribe?.();media.removeEventListener?.('change',syncMotion);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetGesture();syncMotion();});
 select(index);syncMotion();
})();
