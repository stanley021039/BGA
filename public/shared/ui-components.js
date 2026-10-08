(()=>{
 const paths={
  emoji:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8.5 8.5h.01M15.5 8.5h.01"/>',
  frame:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6M17 15h.01"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  send:'<path d="m3 3 18 9-18 9 4-9-4-9Z M7 12h14"/>',
  leave:'<path d="M9 5H4v14h5M9 12h12m-4-4 4 4-4 4"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon:'<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>',
  book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z M12 5v15"/>',
  save:'<path d="M5 3h12l4 4v14H3V3h2Z M7 3v6h10V3M7 21v-8h10v8"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  previous:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  next:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  replay:'<path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/>',
  sound:'<path d="M4 9h4l5-4v14l-5-4H4Z M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
  muted:'<path d="M4 9h4l5-4v14l-5-4H4Z M17 9l5 6M22 9l-5 6"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  playLocal:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="m9 6 6 4-6 4Z M12 17v4M8 21h8"/>',
  video:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
  unknown:'<path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6"/><circle cx="12" cy="19" r=".6"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/>',
  gift:'<rect x="3" y="7" width="18" height="4" rx="1"/><path d="M5 11v10h14V11M12 7v14M12 7C8 7 6 6 6 4a2 2 0 0 1 4-1l2 4Zm0 0c4 0 6-1 6-3a2 2 0 0 0-4-1l-2 4Z"/>',
  cards:'<rect x="7" y="3" width="13" height="18" rx="2"/><path d="M7 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3m7-13 3 4-3 4-3-4 3-4Z"/>',
  car:'<path d="m5 8 2-5h10l2 5M3 15V9l2-1h14l2 1v6H3Zm2 0v4m14-4v4M6 11h2m8 0h2"/>',
  table:'<ellipse cx="12" cy="7" rx="9" ry="4"/><path d="M3 7v3c0 2 4 4 9 4s9-2 9-4V7M6 13v7m12-7v7"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  undo:'<path d="M3 4v6h6M3 10a8 8 0 0 1 16 4v5"/>',
  edit:'<path d="m15 4 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15Z M4 15l4 4"/>',
  resize:'<path d="M8 20H4v-4M4 20l7-7M16 4h4v4M20 4l-7 7"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M20 12a8 8 0 0 0-14-5M4 12a8 8 0 0 0 14 5"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
  add:'<path d="M12 4v16M4 12h16"/>',
  remove:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  dragHandle:'<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>',
  external:'<path d="M14 3h7v7M21 3l-10 10M10 5H4v15h15v-6"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  queue:'<path d="M8 5h13M8 12h13M8 19h13"/><circle cx="3" cy="5" r=".8"/><circle cx="3" cy="12" r=".8"/><circle cx="3" cy="19" r=".8"/>',
  music:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>'
 };
 paths.volumeOn=paths.sound;paths.volumeOff=paths.muted;paths.sync=paths.refresh;
 const pending=new WeakMap(),dialogs=new WeakMap();let dialogNumber=0;
 function icon(name){const path=paths[name];return path?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+path+'</svg>':'';}
 function symbol(name){const image=icon(name);return image?'<span class="ui-symbol" aria-hidden="true">'+image+'</span>':'';}
 function playerName(name){const text=String(name??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));return '<span class="ui-player-name" title="'+text+'"><span class="ui-player-name-text">'+text+'</span></span>';}
 function overflowText(value,{hoverOnly=true}={}){
  const html=playerName(value);
  return html.replace('class="ui-player-name"','class="ui-player-name ui-overflow-text"'+(hoverOnly?' data-name-activation="hover"':''));
 }
 function decorateButton(button,name,{iconOnly=false,label}={}){
  if(!button||!paths[name])return button;
  const text=label??button.getAttribute('aria-label')??button.textContent.trim();
  const image=document.createElement('span');image.className='ui-button-icon';image.setAttribute('aria-hidden','true');image.innerHTML=icon(name);
  const caption=document.createElement('span');caption.className=iconOnly?'ui-sr-only':'ui-button-label';caption.textContent=text;
  button.replaceChildren(image,caption);button.classList.add('ui-button');button.classList.toggle('ui-icon-button',iconOnly);button.dataset.uiIcon=name;
  if(iconOnly){button.setAttribute('aria-label',text);button.title=text;}
  return button;
 }
 function setBusy(button,busy){
  if(!button)return;
  if(busy){if(!pending.has(button)){pending.set(button,button.disabled);if(typeof getComputedStyle==='function')button.style?.setProperty?.('--ui-spinner-color',getComputedStyle(button).color);}button.disabled=true;button.setAttribute('aria-busy','true');button.classList.add('is-pending');}
  else{if(pending.has(button)){button.disabled=pending.get(button);pending.delete(button);}button.removeAttribute('aria-busy');button.classList.remove('is-pending');button.style?.removeProperty?.('--ui-spinner-color');}
 }
 function setStatus(node,message,{kind='info'}={}){
  if(!node)return;
  node.classList.add('ui-status');node.dataset.kind=kind;node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
  if(node.textContent!==message)node.textContent=message;
 }
 function openDialog(dialog,trigger=document.activeElement){
  if(!dialog)return;
  window.GameUI?.bindDialog?.(dialog,{trigger});
  window.TableWatch?.closeForDialog(dialog);
  if(!dialogs.has(dialog)){
   dialogs.set(dialog,{trigger:null});dialog.classList.add('ui-dialog');
   if(!dialog.hasAttribute('aria-label')&&!dialog.hasAttribute('aria-labelledby')){const title=dialog.querySelector('[data-dialog-title],h1,h2,h3,strong');if(title){if(!title.id)title.id='ui-dialog-title-'+(++dialogNumber);dialog.setAttribute('aria-labelledby',title.id);}}
   dialog.addEventListener('close',()=>{
    const trigger=dialogs.get(dialog).trigger;if(!trigger?.isConnected)return;
    let target=trigger;
    for(let ancestor=trigger.parentElement;ancestor;ancestor=ancestor.parentElement){
     if(ancestor.tagName==='DETAILS'&&!ancestor.open){const summary=ancestor.querySelector(':scope > summary');if(summary&&!summary.contains(target))target=summary;}
    }
    if(typeof target.focus==='function')target.focus();
   });
  }
  dialogs.get(dialog).trigger=trigger;if(!dialog.open)dialog.showModal();
 }
 window.GameUI={icon,symbol,playerName,overflowText,decorateButton,setBusy,setStatus,openDialog,bindPopover:(...args)=>window.UIPopover?.bindDetails(...args)};
 /* One hover/focus hint in the top layer, independent of clipped game panels. */
 let controlHint=null,hintOwner=null,hintObserver=null;
 function hideControlHint(){
  hintObserver?.disconnect();
  if(hintOwner){
   if(hintOwner.getAttribute('title')==='')hintOwner.setAttribute('title',hintOwner.getAttribute('aria-label')||'');
   const other=(hintOwner.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='ui-control-hint');
   if(other.length)hintOwner.setAttribute('aria-describedby',other.join(' '));else hintOwner.removeAttribute('aria-describedby');
  }
  hintOwner=null;
  if(controlHint){try{controlHint.hidePopover?.();}catch{}controlHint.hidden=true;}
 }
 function showControlHint(control){
  if(!control?.isConnected||document.hidden||!control.getBoundingClientRect||!control.getClientRects().length)return;
  const text=control.getAttribute('aria-label')||control.getAttribute('title');if(!text)return;
  if(hintOwner===control)return;
  hideControlHint();
  if(!controlHint){controlHint=document.createElement('div');controlHint.id='ui-control-hint';controlHint.className='ui-control-tooltip';controlHint.hidden=true;controlHint.setAttribute('role','tooltip');controlHint.setAttribute('popover','manual');document.body.append(controlHint);}
  // Keep native title as the fallback when top-layer popovers are unavailable.
  if(typeof controlHint.showPopover!=='function')return;
  controlHint.textContent=text;controlHint.hidden=false;
  try{controlHint.showPopover();}catch{controlHint.hidden=true;return;}
  hintOwner=control;control.setAttribute('title','');
  const descriptions=(control.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!descriptions.includes('ui-control-hint'))descriptions.push('ui-control-hint');control.setAttribute('aria-describedby',descriptions.join(' '));
  const anchor=control.getBoundingClientRect(),bounds=controlHint.getBoundingClientRect(),width=window.innerWidth||document.documentElement.clientWidth,height=window.innerHeight||document.documentElement.clientHeight;
  const left=Math.max(8,Math.min(width-bounds.width-8,anchor.left+(anchor.width-bounds.width)/2)),below=anchor.bottom+8,top=below+bounds.height<=height-8?below:Math.max(8,anchor.top-bounds.height-8);
  controlHint.style.setProperty('left',left+'px');controlHint.style.setProperty('top',top+'px');
  if(typeof MutationObserver==='function'){
   if(!hintObserver)hintObserver=new MutationObserver(()=>{if(hintOwner&&(!hintOwner.isConnected||!hintOwner.getClientRects().length))hideControlHint();else if(hintOwner){const value=hintOwner.getAttribute('aria-label')||'';if(controlHint.textContent!==value)controlHint.textContent=value;}});
   hintObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open','aria-label']});
  }
 }
 document.addEventListener('pointerover',event=>{const control=event.target?.closest?.('.ui-icon-button,[data-ui-hint]');if(control)showControlHint(control);});
 document.addEventListener('focusin',event=>{const control=event.target?.closest?.('.ui-icon-button,[data-ui-hint]');if(control)showControlHint(control);});
 document.addEventListener('pointerout',event=>{if(!hintOwner||hintOwner.contains(event.relatedTarget)||controlHint?.contains(event.relatedTarget))return;if((hintOwner.contains(event.target)||controlHint?.contains(event.target))&&!hintOwner.contains(document.activeElement))hideControlHint();});
 document.addEventListener('focusout',event=>{if(hintOwner?.contains(event.target)&&!hintOwner.matches(':hover'))hideControlHint();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&hintOwner)hideControlHint();});
 document.addEventListener('pointerdown',hideControlHint,true);document.addEventListener('scroll',hideControlHint,true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hideControlHint();});window.addEventListener('resize',hideControlHint);window.addEventListener('pagehide',hideControlHint);
 /* One text node per name. Observers only measure names affected by DOM or size changes. */
 function observePlayerNames(){
  const records=new Map(),owners=new WeakMap(),dirty=new Set(),media=window.matchMedia?.('(prefers-reduced-motion: reduce)');let frame=null,disposed=false,unsubscribe=null;
  const resized=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{for(const entry of entries){const slot=owners.get(entry.target);if(slot)queue(slot);}}):null;
  const setAttribute=(node,key,value)=>{if(node.getAttribute(key)!==value)node.setAttribute(key,value);};
  const allowed=()=>!document.hidden&&!media?.matches&&!document.documentElement?.classList.contains('motion-reduced')&&(window.MotionPolicy?.allowsMotion?.()??true);
  function setMotion(slot,moving){setAttribute(slot,'data-name-motion',moving?'on':'off');}
  function pause(){for(const slot of records.keys())setMotion(slot,false);}
  function all(){for(const slot of records.keys())queue(slot);}
  function bindPolicy(){if(!unsubscribe&&window.MotionPolicy?.subscribe)unsubscribe=window.MotionPolicy.subscribe(prefs=>{if(document.hidden||prefs.enabled===false||prefs.reduced)pause();else all();});}
  function queue(slot){if(disposed)return;dirty.add(slot);if(frame===null&&!document.hidden)frame=window.requestAnimationFrame(flush);}
  function forget(slot){const record=records.get(slot);if(!record)return;resized?.unobserve(slot);resized?.unobserve(record.text);records.delete(slot);dirty.delete(slot);setMotion(slot,false);}
  function add(slot){
   const text=slot.querySelector('.ui-player-name-text');if(!text)return;
   const previous=records.get(slot);if(previous?.text===text){queue(slot);return;}const tabindex=previous?previous.tabindex:slot.getAttribute('tabindex');if(previous)forget(slot);
   records.set(slot,{text,tabindex});owners.set(slot,slot);owners.set(text,slot);resized?.observe(slot);resized?.observe(text);queue(slot);
  }
  function collect(node){if(node?.matches?.('.ui-player-name'))add(node);for(const slot of node?.querySelectorAll?.('.ui-player-name')||[])add(slot);}
  function containing(node){return (node?.nodeType===3?node.parentElement:node)?.closest?.('.ui-player-name');}
  function flush(){
   frame=null;if(disposed)return;bindPolicy();const slots=[...dirty];dirty.clear();
   // Finish all layout reads before changing attributes or animation variables.
   const measured=slots.map(slot=>{const record=records.get(slot);if(!record||!slot.isConnected)return{slot,removed:true};const visible=slot.getClientRects().length&&record.text.getClientRects().length&&slot.clientWidth>0&&getComputedStyle(slot).visibility!=='hidden';return{slot,record,name:record.text.textContent||'',distance:visible?Math.max(0,record.text.scrollWidth-slot.clientWidth):0};});
   const moving=allowed();for(const item of measured){
    if(item.removed){forget(item.slot);continue;}const{slot,record,name,distance}=item,overflow=distance>1;
    setAttribute(slot,'title',name);setAttribute(slot,'data-name-overflow',overflow?'true':'false');setMotion(slot,overflow&&moving);
    if(overflow){setAttribute(slot,'tabindex','0');for(const[key,value]of [['--ui-player-name-shift',-Math.ceil(distance)+'px'],['--ui-player-name-duration',Math.max(4,Math.min(14,distance/24+3)).toFixed(2)+'s']])if(slot.style.getPropertyValue(key)!==value)slot.style.setProperty(key,value);}
    else{if(record.tabindex===null){if(slot.hasAttribute('tabindex'))slot.removeAttribute('tabindex');}else setAttribute(slot,'tabindex',record.tabindex);for(const key of ['--ui-player-name-shift','--ui-player-name-duration'])if(slot.style.getPropertyValue(key))slot.style.removeProperty(key);}
   }
  }
  const mutated=typeof MutationObserver==='function'?new MutationObserver(changes=>{
   for(const change of changes){
    if(change.type==='childList'){for(const node of change.addedNodes)collect(node);for(const slot of [...records.keys()])if(!slot.isConnected)forget(slot);const slot=containing(change.target);if(slot)add(slot);}
    else if(change.type==='characterData'){const slot=containing(change.target);if(slot)add(slot);}
    else{const slot=containing(change.target);if(slot)add(slot);collect(change.target);}
   }
  }):null;
  mutated?.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});collect(document.body);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(frame!==null){window.cancelAnimationFrame(frame);frame=null;}}else all();});
  media?.addEventListener?.('change',()=>{if(media.matches)pause();else all();});window.addEventListener('resize',all);
  document.fonts?.addEventListener?.('loadingdone',all);document.fonts?.ready?.then?.(all,()=>{});
  window.addEventListener('pagehide',event=>{pause();if(frame!==null){window.cancelAnimationFrame(frame);frame=null;}if(!event.persisted){disposed=true;resized?.disconnect();mutated?.disconnect();unsubscribe?.();dirty.clear();records.clear();}});
  window.addEventListener('pageshow',event=>{if(event.persisted)all();});
 }
 if(document.body)observePlayerNames();else document.addEventListener('DOMContentLoaded',observePlayerNames,{once:true});
 /* A healthy connection is background information; failures still need a visible notice. */
 for(const connection of document.querySelectorAll('#connection,#network')){const indicator=connection.closest('.connection')||connection;const syncConnection=()=>{const text=connection.textContent.trim();indicator.hidden=!text||/^(?:●\s*)?已連線(?:[。.]|\s*·.*)?$/.test(text);};syncConnection();if(typeof MutationObserver==='function')new MutationObserver(syncConnection).observe(connection,{childList:true,subtree:true,characterData:true});}
 /* Root text enlargement needs reflow even when the viewport has not changed. */
 if(typeof getComputedStyle==='function'&&document.documentElement&&document.body){
  const syncTextScale=()=>document.body.classList.toggle('ui-large-text',parseFloat(getComputedStyle(document.documentElement).fontSize)>20);
  syncTextScale();if(typeof MutationObserver==='function')new MutationObserver(syncTextScale).observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
  window.addEventListener('resize',syncTextScale);
 }
})();
