/* Lucide hand icon, adapted as a stop gesture.
Source: https://lucide.dev/icons/hand
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*/
(()=>{
 const paths={
  chat:'<path d="M4 4h16v12H9l-5 4V4Z M8 8h8M8 12h5"/>',
  flag:'<path d="M5 22V3m0 1h8l2 3h5v10h-7l-2-3H5"/>',
  crown:'<path d="m3 6 4 5 5-8 5 8 4-5-2 14H5L3 6Z"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  brush:'<path d="m14 4 6 6M8 15 19 4a2.8 2.8 0 0 1 4 4L12 19M8 15c-4-1-5 2-5 6 4 0 7-1 7-4Z"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3M9 14l6 3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  timer:'<circle cx="12" cy="14" r="8"/><path d="M12 6V3M9 2h6M17 6l2-2M12 10v5"/>',
  hand:"<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\" /><path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\" /><path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\" /><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\" />",
  'draw-bag':'<path d="M7 10h10l3 9a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3l3-9Zm1-7h8l-2 7h-4L8 3Z M18 3v7m-3-4 3-3 3 3"/>',
  ingredient:'<path d="M3 13h16l-2 7H5l-2-7Zm3-2 8-8 4 4-6 6M5 22h12"/>',
  circle:'<circle cx="12" cy="12" r="8"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  coins:'<circle cx="9" cy="9" r="6"/><path d="M9 5v8m-2-6h4M15 9a6 6 0 1 1-6 6"/>',
  emoji:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8.5 8.5h.01M15.5 8.5h.01"/>',
  frame:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h6M17 15h.01"/>',
  clear:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  minimize:'<path d="M5 12h14"/>',
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
  notice:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  unknown:'<path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6"/><circle cx="12" cy="19" r=".6"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/>',
  invite:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M19 8v8M15 12h8"/>',
  bot:'<path d="M12 3v3M2 12v5M22 12v5"/><rect x="5" y="6" width="14" height="15" rx="3"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M9 17h6"/>',
  gift:'<rect x="3" y="7" width="18" height="4" rx="1"/><path d="M5 11v10h14V11M12 7v14M12 7C8 7 6 6 6 4a2 2 0 0 1 4-1l2 4Zm0 0c4 0 6-1 6-3a2 2 0 0 0-4-1l-2 4Z"/>',
  cards:'<rect x="7" y="3" width="13" height="18" rx="2"/><path d="M7 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3m7-13 3 4-3 4-3-4 3-4Z"/>',
  'car-light':'<path d="M7 9 9 5h6l2 4M5 16V10l2-1h10l2 1v6H5Zm2 0v3m10-3v3M8 12h1m6 0h1"/>',
  'car-medium':'<path d="m5 8 2-5h10l2 5M3 15V9l2-1h14l2 1v6H3Zm2 0v4m14-4v4M6 11h2m8 0h2"/>',
  'car-heavy':'<path d="M3 9V4h11v5m0-3h4l3 5v6H3V9h18M6 12h2m9 0h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
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
 /* One frame for static and dynamically mounted native dialogs. Keep nodes and handlers. */
 function frameDialog(dialog){
  if(!dialog||dialog.dataset.uiDialogFrame==='true')return dialog;
  // Floating media owns its drag header, resize handles and internal scroll regions.
  if(dialog.matches('.table-media-window')){dialog.classList.add('ui-dialog','ui-dialog-window');dialog.dataset.uiDialogFrame='true';return dialog;}
  const doc=dialog.ownerDocument||document;
  const titleId=dialog.getAttribute('aria-labelledby')?.split(/\s+/)[0];
  const title=(titleId&&dialog.querySelector('[id="'+titleId+'"]'))||dialog.querySelector('[data-dialog-title],h1,h2,h3,strong');
  const titleBlock=title&&[...dialog.children].find(n=>n!==title&&n.contains(title));
  const existingHeader=titleBlock?.matches('header,.game-dialog-header,.library-dialog-head,.image-preview-heading,.barrage-frame-header')?titleBlock:null;
  const header=existingHeader||doc.createElement('header');
  const footer=dialog.querySelector(':scope > footer')||doc.createElement('footer');
  const body=dialog.querySelector(':scope > .game-dialog-body,:scope > .race-dice-body');
  const content=body||doc.createElement('div');
  header.classList.add('ui-dialog-header');content.classList.add('ui-dialog-content');footer.classList.add('ui-dialog-footer');
  const windowFrame=dialog.matches('.table-media-window,.table-watch-dialog');
  const actionRows='.ui-control-row,[data-dialog-actions],.host-dialog-actions,.dialog-actions';
  const moveAction=node=>{const form=node.closest('form');if(form&&!node.hasAttribute('form')&&node.matches('button,input')){if(!form.id)form.id='ui-dialog-form-'+(++dialogNumber);node.setAttribute('form',form.id);}footer.append(node);};
  for(const child of [...dialog.childNodes]){
   if(child===header||child===footer||child===content)continue;
   if(child===title)header.append(child);
   else if(child.nodeType===1&&child.matches('.table-media-resize-edge'))continue;
   else if(child.nodeType===1&&(child.matches(actionRows)||child.matches('button,.host-return')))moveAction(child);
   else content.append(child);
  }
  // Header buttons are dialog actions; keep the original draggable header itself.
  for(const button of [...header.querySelectorAll('button')])moveAction(button);
  for(const row of [...content.querySelectorAll(actionRows)]){
   if(row.matches('.ui-control-row')&&row.querySelector('input:not([type=submit]),select,textarea'))continue;
   const form=row.closest('form');if(form){if(!row.matches('[data-dialog-actions],.dialog-actions'))continue;if(!form.id)form.id='ui-dialog-form-'+(++dialogNumber);for(const button of row.querySelectorAll('button,input[type=submit]'))if(!button.hasAttribute('form'))button.setAttribute('form',form.id);}
   if((row.parentElement===content||form)&&row.querySelector('button,input[type=submit],a'))moveAction(row);
  }
  // Submit remains attached to its original form after moving to the footer.
  const create=dialog.querySelector('#create');if(create&&dialog.id==='createRoomDialog')moveAction(create);
  if(title){if(!title.id)title.id='ui-dialog-title-'+(++dialogNumber);if(!dialog.hasAttribute('aria-label')&&!dialog.hasAttribute('aria-labelledby'))dialog.setAttribute('aria-labelledby',title.id);}
  // Closing the dialog belongs to the header; decision actions stay in the footer.
  for(const button of [...header.querySelectorAll('button'),...footer.querySelectorAll('button')]){
   const label=button.getAttribute('aria-label')||button.textContent.trim();
   if(button.matches('.close,.dialog-close,.host-cancel,[data-close-create],#mediaClose,#mediaPlaylistClose,#watchClose')||/^關閉/.test(label)){
    button.classList.add('ui-dialog-close');button.type='button';decorateButton(button,'close',{iconOnly:true,label:label==='×'?'關閉視窗':label});header.append(button);
   }
  }
  header.hidden=!header.childNodes.length;footer.hidden=!footer.childNodes.length;
  dialog.classList.add('ui-dialog','ui-dialog-layout');if(windowFrame)dialog.classList.add('ui-dialog-window');
  dialog.dataset.uiDialogFrame='true';dialog.append(header,content,footer);return dialog;
 }
 function mountDialogFrames(root){
  if(root?.nodeType!==1)return;
  if(root.matches('dialog'))frameDialog(root);
  for(const dialog of root.querySelectorAll('dialog'))frameDialog(dialog);
 }
 function observeDialogFrames(){
  mountDialogFrames(document.body);
  if(typeof MutationObserver==='function')new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)mountDialogFrames(node);}).observe(document.body,{childList:true,subtree:true});
 }
 if(document.body)observeDialogFrames();else document.addEventListener('DOMContentLoaded',observeDialogFrames,{once:true});
 /* A field keeps its native label, control and handlers; spacing is shared site-wide. */
 const fieldControls='input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]):not([type=image]),select,textarea';
 const inlineFields='[data-ui-field-layout="inline"],.ui-sr-only,.ui-control-row,.chat-compose,.table-media-local,.table-watch-volume,.table-watch-seek,.tool-row,.color-row,.size-pick';
 function frameField(label,control){
  if(!label||!control||!control.matches(fieldControls)||label.closest(inlineFields))return null;
  let field=label.closest('.ui-field,.ui-room-setting-field');
  if(field&&!field.contains(control))return null;
  if(!field){
   if(label.contains(control))field=label;
   else if(label.parentElement===control.parentElement&&label.nextElementSibling===control){field=label.ownerDocument.createElement('div');label.before(field);field.append(label,control);}
   else return null;
  }
  if(!field.classList.contains('ui-field'))field.classList.add('ui-field');
  if(!control.classList.contains('ui-field-control'))control.classList.add('ui-field-control');
  if(label!==field&&!label.classList.contains('ui-field-label'))label.classList.add('ui-field-label');
  const parent=field.parentElement;
  if(parent&&!parent.matches('label,button,.ui-field')&&!parent.closest(inlineFields)){
   const display=getComputedStyle(parent).display;
   if(!/flex|table|contents/.test(display)&&!parent.classList.contains('ui-field-group'))parent.classList.add('ui-field-group');
  }
  return field;
 }
 function frameFields(root){
  if(!root?.querySelectorAll)return;
  const labels=[...(root.matches?.('label')?[root]:[]),...root.querySelectorAll('label')];
  for(const label of labels){const control=label.htmlFor?label.ownerDocument.getElementById(label.htmlFor):label.querySelector(fieldControls);if(control)frameField(label,control);}
 }
 function createField({label='',control,help=null,className=''}={}){
  if(!control)return null;
  const doc=control.ownerDocument,field=doc.createElement('div'),caption=doc.createElement('label');field.className='ui-field '+className;
  if(!control.id)control.id='ui-field-control-'+(++dialogNumber);caption.htmlFor=control.id;caption.textContent=label;field.append(caption,control);
  if(help){if(!help.id)help.id='ui-field-help-'+(++dialogNumber);help.classList.add('ui-field-help');const ids=new Set((control.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(help.id);control.setAttribute('aria-describedby',[...ids].join(' '));field.append(help);}
  frameField(caption,control);return field;
 }
 function observeFields(){
  frameFields(document.body);
  if(typeof MutationObserver==='function')new MutationObserver(records=>{
   const roots=new Set();
   for(const record of records){
    if(record.target.nodeType===1&&record.target.matches('label'))roots.add(record.target);
    for(const node of record.addedNodes)if(node.nodeType===1){
     if(node.matches('label')||node.querySelector('label'))roots.add(node);
     if(node.matches(fieldControls)&&node.parentElement)roots.add(node.parentElement);
    }
   }
   for(const root of roots)if(root.isConnected)frameFields(root);
  }).observe(document.body,{subtree:true,childList:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeFields,{once:true});else observeFields();
 /* Reusable room/chat block: stable header, one scrolling content, bottom actions. */
 function framePanel(panel,{header,content,footer,body=null}={}){
  if(!panel||!header||!content||!footer)return panel;
  const main=body||panel.ownerDocument.createElement('div');
  panel.classList.add('ui-panel-frame');header.classList.add('ui-panel-header');
  main.classList.add('ui-panel-body');content.classList.add('ui-panel-content');footer.classList.add('ui-panel-footer');
  if(header.parentElement!==panel)panel.prepend(header);
  if(content.parentElement!==main)main.append(content);
  if(footer.parentElement!==main)main.append(footer);
  if(main.parentElement!==panel)panel.append(main);
  return panel;
 }
 function createDialog({title='',titleId='',className='',content=[],actions=[]}={}){
  const dialog=document.createElement('dialog'),heading=document.createElement('h2'),row=document.createElement('div');
  dialog.className=className;heading.textContent=title;if(titleId)heading.id=titleId;row.className='ui-control-row';
  row.append(...actions);dialog.append(heading,...content,row);return frameDialog(dialog);
 }
 function openDialog(dialog,trigger=document.activeElement){
  if(!dialog)return;
  frameDialog(dialog);
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
 window.GameUI={icon,symbol,playerName,overflowText,decorateButton,setBusy,setStatus,openDialog,frameDialog,createDialog,framePanel,frameField,frameFields,createField,bindPopover:(...args)=>window.UIPopover?.bindDetails(...args)};
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
 document.addEventListener('pointerout',event=>{if(!hintOwner||hintOwner.contains(event.relatedTarget)||controlHint?.contains(event.relatedTarget))return;const keyboardFocus=hintOwner.contains(document.activeElement)&&document.activeElement.matches(':focus-visible');if(!keyboardFocus&&(hintOwner.contains(event.target)||controlHint?.contains(event.target)))hideControlHint();});
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
