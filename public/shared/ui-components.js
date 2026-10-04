(()=>{
 const paths={
  emoji:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8.5 8.5h.01M15.5 8.5h.01"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  send:'<path d="m3 3 18 9-18 9 4-9-4-9Z M7 12h14"/>',
  leave:'<path d="M9 5H4v14h5M9 12h12m-4-4 4 4-4 4"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z M12 5v15"/>',
  save:'<path d="M5 3h12l4 4v14H3V3h2Z M7 3v6h10V3M7 21v-8h10v8"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  next:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  replay:'<path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/>',
  sound:'<path d="M4 9h4l5-4v14l-5-4H4Z M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
  muted:'<path d="M4 9h4l5-4v14l-5-4H4Z M17 9l5 6M22 9l-5 6"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  undo:'<path d="M3 4v6h6M3 10a8 8 0 0 1 16 4v5"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M20 12a8 8 0 0 0-14-5M4 12a8 8 0 0 0 14 5"/>'
 };
 const pending=new WeakMap(),dialogs=new WeakMap();let dialogNumber=0;
 function icon(name){const path=paths[name];return path?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+path+'</svg>':'';}
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
 window.GameUI={icon,decorateButton,setBusy,setStatus,openDialog,bindPopover:(...args)=>window.UIPopover?.bindDetails(...args)};
 /* A healthy connection is background information; failures still need a visible notice. */
 for(const connection of document.querySelectorAll('#connection,#network')){const indicator=connection.closest('.connection')||connection;const syncConnection=()=>{const text=connection.textContent.trim();indicator.hidden=!text||/^(?:●\s*)?已連線(?:[。.]|\s*·.*)?$/.test(text);};syncConnection();if(typeof MutationObserver==='function')new MutationObserver(syncConnection).observe(connection,{childList:true,subtree:true,characterData:true});}
 /* Root text enlargement needs reflow even when the viewport has not changed. */
 if(typeof getComputedStyle==='function'&&document.documentElement&&document.body){
  const syncTextScale=()=>document.body.classList.toggle('ui-large-text',parseFloat(getComputedStyle(document.documentElement).fontSize)>20);
  syncTextScale();if(typeof MutationObserver==='function')new MutationObserver(syncTextScale).observe(document.documentElement,{attributes:true,attributeFilter:['style','class']});
  window.addEventListener('resize',syncTextScale);
 }
})();
