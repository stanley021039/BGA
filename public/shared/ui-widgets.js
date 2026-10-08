/* Original DOM widgets: shared interaction contracts, independent of a framework. */
(()=>{'use strict';
 const ui=window.GameUI||(window.GameUI={}),tabBindings=new WeakMap(),formBindings=new WeakMap(),dialogBindings=new WeakMap();let serial=0;
 const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);return ()=>node.removeEventListener(type,fn,options);};
 const available=node=>!!node&&!node.disabled&&node.getAttribute('aria-disabled')!=='true'&&!node.closest('[hidden]');
 const attr=(node,name,value)=>{if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);};
 function mountTabs(tablist,options={}){
  if(!tablist)return null;if(tabBindings.has(tablist))return tabBindings.get(tablist);
  const selector=options.selector||'[data-ui-tab],[role="tab"]',records=new Map(),originalRole=tablist.getAttribute('role'),originalOrientation=tablist.getAttribute('aria-orientation');
  let selected=null,focused=null,destroyed=false;
  tablist.setAttribute('role','tablist');tablist.setAttribute('aria-orientation',options.orientation||'horizontal');tablist.classList.add('ui-tablist');
  function entries(){
   return [...tablist.querySelectorAll(selector)].map(tab=>{
    if(!records.has(tab)){
     const key=tab.dataset.uiTab||tab.dataset.view||tab.id,panel=tab.ownerDocument.getElementById(tab.getAttribute('aria-controls')||tab.dataset.uiPanel||'');
     if(!key||!panel)throw Error('A tab needs a stable key and an existing aria-controls panel');
     const attributes=Object.fromEntries(['id','role','tabindex','aria-selected'].map(name=>[name,tab.getAttribute(name)])),panelAttributes=Object.fromEntries(['role','aria-labelledby','tabindex'].map(name=>[name,panel.getAttribute(name)]));
     if(!tab.id)tab.id='ui-tab-'+(++serial);tab.setAttribute('role','tab');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);if(!panel.hasAttribute('tabindex'))panel.setAttribute('tabindex','0');
     records.set(tab,{tab,key,panel,attributes,panelAttributes,panelHidden:panel.hidden});
    }
    return records.get(tab);
   });
  }
  function paint(list){for(const item of list){item.tab.setAttribute('aria-selected',String(item.key===selected));item.tab.setAttribute('tabindex',item.key===focused&&available(item.tab)?'0':'-1');item.panel.hidden=item.key!==selected;}}
  function select(key,{focus=false,notify=true,reason='programmatic'}={}){
   if(destroyed)return false;const list=entries(),eligible=list.filter(item=>available(item.tab)),next=eligible.find(item=>item.key===key);if(!next)return false;
   const previous=selected;selected=next.key;if(previous!==selected||focus||!eligible.some(item=>item.key===focused))focused=next.key;paint(list);if(focus)next.tab.focus({preventScroll:true});
   if(notify&&previous!==selected)options.onChange?.(selected,{previous,reason});return true;
  }
  function refresh({notify=true}={}){
   if(destroyed)return;const list=entries(),eligible=list.filter(item=>available(item.tab)),previous=selected,current=eligible.find(item=>item.key===selected)||eligible[0];
   selected=current?.key||null;if(!eligible.some(item=>item.key===focused))focused=selected;paint(list);
   const active=tablist.ownerDocument.activeElement;if(active&&records.has(active)&&!available(active)&&current)current.tab.focus({preventScroll:true});
   if(notify&&previous!==selected)options.onChange?.(selected,{previous,reason:'availability'});
  }
  function target(event){const tab=event.target?.closest?.(selector);return tab&&tablist.contains(tab)&&available(tab)?records.get(tab)||entries().find(item=>item.tab===tab):null;}
  const cleanups=[listen(tablist,'click',event=>{const item=target(event);if(!item)return;event.preventDefault();select(item.key,{focus:true,reason:'click'});}),listen(tablist,'keydown',event=>{
   const item=target(event);if(!item||event.altKey||event.ctrlKey||event.metaKey)return;
   const vertical=tablist.getAttribute('aria-orientation')==='vertical',forward=vertical?'ArrowDown':'ArrowRight',backward=vertical?'ArrowUp':'ArrowLeft',list=entries().filter(entry=>available(entry.tab));
   if(['Enter',' ','Spacebar'].includes(event.key)){event.preventDefault();select(item.key,{focus:true,reason:'keyboard'});return;}
   if(![forward,backward,'Home','End'].includes(event.key))return;event.preventDefault();const index=list.findIndex(entry=>entry.tab===item.tab),next=event.key==='Home'?list[0]:event.key==='End'?list.at(-1):list[(index+(event.key===forward?1:-1)+list.length)%list.length];
   focused=next.key;paint(entries());next.tab.focus({preventScroll:true});if(options.activation==='automatic')select(next.key,{reason:'keyboard'});
  }),listen(tablist,'focusin',event=>{const item=target(event);if(item){focused=item.key;paint(entries());}})];
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>refresh()):null;observer?.observe(tablist,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','disabled','aria-disabled']});
  const api={select,refresh,get value(){return selected;},destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();for(const cleanup of cleanups)cleanup();for(const item of records.values()){for(const [name,value]of Object.entries(item.attributes))attr(item.tab,name,value);for(const [name,value]of Object.entries(item.panelAttributes))attr(item.panel,name,value);item.panel.hidden=item.panelHidden;}attr(tablist,'role',originalRole);attr(tablist,'aria-orientation',originalOrientation);tablist.classList.remove('ui-tablist');records.clear();tabBindings.delete(tablist);}};
  tabBindings.set(tablist,api);entries();if(!select(options.initial||entries().find(item=>item.tab.getAttribute('aria-selected')==='true')?.key,{notify:false}))refresh({notify:false});return api;
 }
 function bindForm(form,options={}){
  if(!form)return null;if(formBindings.has(form))return formBindings.get(form);
  const errors=new Map();let destroyed=false,validationDepth=0,invalidFocusJob=null;
  function cancelInvalidFocus(){invalidFocusJob=null;}
  const controls=()=>[...form.elements].filter(control=>control.willValidate&&!control.disabled);
  function firstInvalid(){return controls().find(control=>control.validity?.valid===false&&!control.closest('[hidden]')&&(!control.getClientRects||control.getClientRects().length));}
  function queueInvalidFocus(){
   if(validationDepth||invalidFocusJob||options.nativeMessages===true)return;const job={};invalidFocusJob=job;
   // Native submission fires invalid once per field, with no submit event.
   // Locate the first field after that batch; explicit validate controls its own focus.
   Promise.resolve().then(()=>{if(destroyed||invalidFocusJob!==job)return;invalidFocusJob=null;if(form.isConnected)firstInvalid()?.focus({preventScroll:false});});
  }
  function clearField(control){const record=errors.get(control);if(!record)return;
   const described=(control.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==record.error.id);attr(control,'aria-describedby',described.length?described.join(' '):null);
   if(control.getAttribute('aria-invalid')==='true')attr(control,'aria-invalid',record.invalid);record.error.remove();errors.delete(control);
  }
  function showField(control){
   if(!control?.willValidate||control.disabled||control.validity?.valid){clearField(control);return;}
   let record=errors.get(control);if(!record){const error=form.ownerDocument.createElement('span');error.id='ui-field-error-'+(++serial);error.className='ui-field-error';error.setAttribute('aria-live','polite');error.setAttribute('data-ui-field-error','');
    const host=control.closest('label')||control;host.insertAdjacentElement('afterend',error);record={error,invalid:control.getAttribute('aria-invalid')};errors.set(control,record);
   }
   record.error.textContent=control.validationMessage||'請確認此欄位。';control.setAttribute('aria-invalid','true');const described=(control.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!described.includes(record.error.id))described.push(record.error.id);control.setAttribute('aria-describedby',described.join(' '));
  }
  function clear(){cancelInvalidFocus();for(const control of [...errors.keys()])clearField(control);}
  function validate({focus=true,report=false}={}){
   if(destroyed)return false;cancelInvalidFocus();let valid;validationDepth++;try{valid=typeof form.checkValidity==='function'?form.checkValidity():true;}finally{validationDepth--;}
   for(const control of controls())showField(control);if(!valid){if(focus)firstInvalid()?.focus({preventScroll:false});if(report){validationDepth++;try{form.reportValidity?.();}finally{validationDepth--;}}}return valid;
  }
  const cleanups=[listen(form,'invalid',event=>{if(options.nativeMessages!==true)event.preventDefault();showField(event.target);queueInvalidFocus();},true),listen(form,'input',event=>{if(errors.has(event.target))showField(event.target);}),listen(form,'change',event=>{if(errors.has(event.target))showField(event.target);}),listen(form,'reset',()=>{cancelInvalidFocus();Promise.resolve().then(()=>{if(!destroyed)clear();});})];
  const api={validate,clear,destroy(){if(destroyed)return;destroyed=true;for(const cleanup of cleanups)cleanup();clear();formBindings.delete(form);}};formBindings.set(form,api);form.classList.add('ui-form');return api;
 }
 function validateForm(form,options){return bindForm(form)?.validate(options)??true;}
 function bindDialog(dialog,options={}){
  if(!dialog)return null;const existing=dialogBindings.get(dialog);if(existing){existing.update(options);return existing;}
  let settings={...options},trigger=options.trigger||dialog.ownerDocument.activeElement,destroyed=false;
  dialog.classList.add('ui-dialog');if(!dialog.getAttribute('aria-label')&&!dialog.getAttribute('aria-labelledby')){const title=dialog.querySelector('[data-dialog-title],h1,h2,h3');if(title){if(!title.id)title.id='ui-dialog-title-'+(++serial);dialog.setAttribute('aria-labelledby',title.id);}else dialog.setAttribute('aria-label',settings.label||'對話框');}
  const canClose=()=>settings.canClose?.()!==false;
  function requestClose(reason,event){if(event.defaultPrevented)return;if(!canClose()){event.preventDefault();return;}if(settings.onRequestClose){event.preventDefault();settings.onRequestClose({reason,event,dialog});}else if(reason==='button'){event.preventDefault();dialog.close();}}
  const cleanups=[listen(dialog,'cancel',event=>requestClose('escape',event)),listen(dialog,'click',event=>{const button=event.target?.closest?.('[data-ui-close]');if(button&&dialog.contains(button)&&!button.disabled)requestClose('button',event);}),listen(dialog,'close',()=>{
   if(settings.returnFocus===false||!trigger?.isConnected||trigger.disabled||trigger.closest('[hidden]'))return;let target=trigger;
   for(let ancestor=trigger.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS'&&!ancestor.open){const summary=ancestor.querySelector(':scope > summary');if(summary&&!summary.contains(target))target=summary;}
   target.focus?.({preventScroll:true});
  })];
  const api={update(value={}){settings={...settings,...value};if(value.trigger)trigger=value.trigger;},open(from=dialog.ownerDocument.activeElement){if(destroyed)return;trigger=from;if(ui.openDialog)ui.openDialog(dialog,from);else if(!dialog.open)dialog.showModal();},close(){if(!destroyed&&canClose())dialog.close();},destroy(){if(destroyed)return;destroyed=true;for(const cleanup of cleanups)cleanup();dialogBindings.delete(dialog);}};dialogBindings.set(dialog,api);return api;
 }
 Object.assign(ui,{mountTabs,bindForm,validateForm,bindDialog});
})();
