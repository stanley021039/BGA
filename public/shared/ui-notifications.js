/* Finite, local notifications. Game state and persistent error notices remain authoritative. */
(()=>{
 'use strict';
 const ui=window.GameUI=window.GameUI||{};if(ui.notifications)return;
 const visibleLimit=3,queueLimit=12,seenLimit=256,entries=[],queue=[],seen=new Map(),trackers=new Set();
 const clock=()=>globalThis.performance?.now?.()??Date.now(),media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let host=null,observer=null,disposed=false,suspended=false,number=0,unsubscribe=null;
 const motionAllowed=()=>!document.hidden&&!media?.matches&&(!window.MotionPolicy||window.MotionPolicy.allowsMotion());
 function safeHref(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{const url=new URL(value,location.href||location.origin+'/');return url.origin===location.origin&&['http:','https:'].includes(url.protocol)?url.pathname+url.search+url.hash:null;}catch{return null;}
 }
 function remember(key){if(!key)return;seen.set(key,true);while(seen.size>seenLimit)seen.delete(seen.keys().next().value);}
 function ensureHost(){
  if(!document.body||disposed)return null;if(host?.isConnected)return host;
  host=document.createElement('section');host.className='ui-notification-stack';host.setAttribute('aria-label','通知');document.body.append(host);return host;
 }
 function cancelMotion(entry){
  entry.motionSuppressed=true;const animation=entry.animation;entry.animation=null;try{animation?.cancel();}catch{}
  const cancel=entry.cancelCelebration;entry.cancelCelebration=null;try{cancel?.();}catch{}
 }
 function pause(entry){
  if(entry.timer!==null){clearTimeout(entry.timer);entry.timer=null;entry.remaining=Math.max(0,entry.remaining-(clock()-entry.startedAt));}
 }
 function schedule(entry){
  if(entry.closed||!entry.mounted||document.hidden||entry.hovered||entry.focused||entry.timer!==null)return;
  entry.startedAt=clock();entry.timer=setTimeout(()=>dismiss(entry),entry.remaining);
 }
 function listen(entry,node,type,callback){node.addEventListener(type,callback);entry.listeners.push(()=>node.removeEventListener(type,callback));}
 function dismiss(entry,{pump=true,restoreFocus=false}={}){
  if(entry.closed)return false;entry.closed=true;pause(entry);cancelMotion(entry);
  for(const remove of entry.listeners.splice(0))remove();const focused=entry.element.contains(document.activeElement);
  entry.element.remove();for(const list of [entries,queue]){const index=list.indexOf(entry);if(index!==-1)list.splice(index,1);}
  if(restoreFocus&&focused&&entry.origin?.isConnected)try{entry.origin.focus({preventScroll:true});}catch{}
  if(pump)drain();if(!entries.length&&!queue.length&&host){host.remove();host=null;}return true;
 }
 function mount(entry){
  const target=ensureHost();if(!target)return false;entry.mounted=true;entries.push(entry);target.append(entry.element);
  if(!entry.motionSuppressed&&motionAllowed()&&clock()-entry.createdAt<2000){
   try{entry.animation=window.MotionPolicy?.animate?window.MotionPolicy.animate(entry.element,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'ease-out'}):entry.element.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'ease-out'});
    const animation=entry.animation;animation?.finished?.then(()=>{if(entry.animation===animation)entry.animation=null;},()=>{if(entry.animation===animation)entry.animation=null;});
   }catch{}
   if(entry.celebrate)try{const cancel=ui.celebrate?.(entry.element,{id:entry.key||'notification:'+entry.number});if(typeof cancel==='function')entry.cancelCelebration=cancel;}catch{}
  }
  schedule(entry);return true;
 }
 function drain(){
  if(disposed||!document.body)return;
  while(entries.length<visibleLimit&&queue.length){const entry=queue.shift();if(entry.closed)continue;if(!mount(entry)){queue.unshift(entry);break;}}
 }
 function notify(text,{kind='info',key,href,label,durationMs=5000,celebrate=false}={}){
  if(disposed||suspended)return null;const message=String(text??'').trim();if(!message)return null;
  kind=['info','success','warning','error','achievement'].includes(kind)?kind:'info';key=key===undefined||key===null?'':String(key).slice(0,160);
  const link=safeHref(href),existing=[...entries,...queue].find(entry=>key?entry.key===key:!entry.key&&entry.message===message&&entry.kind===kind&&entry.href===link);
  if(existing)return existing.handle;if(key&&seen.has(key))return null;
  const element=document.createElement('article');element.className='ui-notification';element.dataset.kind=kind;element.setAttribute('role','status');element.setAttribute('aria-live','polite');element.setAttribute('aria-atomic','true');
  const icon=document.createElement('span');icon.className='ui-notification-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=ui.symbol?.(kind==='achievement'?'book':kind==='success'?'check':kind==='error'?'ban':'help')||'';
  const content=document.createElement('div');content.className='ui-notification-content';const messageNode=document.createElement('p');messageNode.className='ui-notification-message';messageNode.textContent=message;content.append(messageNode);
  if(link){const action=document.createElement('a');action.className='ui-notification-link';action.href=link;action.textContent=String(label||'查看詳情');content.append(action);}
  const close=document.createElement('button');close.type='button';close.className='ui-notification-close';close.textContent='×';close.setAttribute('aria-label','關閉通知');ui.decorateButton?.(close,'close',{label:'關閉通知',iconOnly:true});element.append(icon,content,close);
  const duration=Number(durationMs),entry={number:++number,element,message,kind,key,href:link,createdAt:clock(),remaining:Number.isFinite(duration)?Math.max(3000,Math.min(12000,duration)):5000,startedAt:0,timer:null,animation:null,cancelCelebration:null,celebrate:!!celebrate,motionSuppressed:!motionAllowed(),hovered:false,focused:false,mounted:false,closed:false,listeners:[],origin:document.activeElement};
  entry.handle={element,dismiss:()=>dismiss(entry)};
  listen(entry,element,'pointerenter',()=>{entry.hovered=true;pause(entry);});listen(entry,element,'pointerleave',()=>{entry.hovered=false;schedule(entry);});
  listen(entry,element,'focusin',()=>{entry.focused=true;pause(entry);});listen(entry,element,'focusout',event=>{if(element.contains(event.relatedTarget))return;entry.focused=false;schedule(entry);});
  listen(entry,close,'click',()=>dismiss(entry,{restoreFocus:true}));remember(key);
  if(queue.length>=queueLimit)dismiss(queue[0],{pump:false});queue.push(entry);drain();return entry.handle;
 }
 function clear(){for(const entry of [...entries,...queue])dismiss(entry,{pump:false});}
 function visibility(){for(const entry of [...entries,...queue]){if(document.hidden){pause(entry);cancelMotion(entry);}else schedule(entry);}}
 function policyChanged(){if(!motionAllowed())for(const entry of [...entries,...queue])cancelMotion(entry);}
 function sweep(){
  if(host&&!host.isConnected){clear();host=null;return;}
  for(const entry of [...entries])if(!entry.element.isConnected)dismiss(entry);
 }
 // Only existing semantic checks initiate reads. Apply full snapshots in request order
 // so a quick settlement cannot establish the baseline before the initial request.
 function createAchievementTracker({onEarned=()=>{}}={}){
  const jobs=[];let known=null,generation=0,retired=disposed;
  function discard(job){job.retired=true;clearTimeout(job.timer);job.controller?.abort();job.resolve(false);}
  function cancelPending(){generation++;for(const job of jobs.splice(0))discard(job);}
  function drainSnapshots(){
   while(jobs[0]?.ready){
    const job=jobs.shift();job.retired=true;
    if(job.items){
     const earned=known?job.items.filter(item=>!known.has(item.id)):[];
     known=new Set([...(known||[]),...job.items.map(item=>item.id)]);
     if(earned.length)try{onEarned(earned);}catch{}
    }
    job.resolve(!!job.items);
   }
  }
  function settle(job,items){
   if(job.retired||job.ready||retired||disposed||suspended||job.generation!==generation)return;
   clearTimeout(job.timer);job.ready=true;job.items=items;drainSnapshots();
  }
  function check(){
   if(retired||disposed||suspended)return Promise.resolve(false);
   // Preserve the pending baseline/head and the newest complete snapshot. Dropping
   // an intermediate request does not issue a retry or add a background read.
   if(jobs.length>=8)discard(jobs.splice(1,1)[0]);
   const controller=typeof AbortController==='function'?new AbortController():null;
   const job={generation,controller,ready:false,retired:false,items:null,timer:null,resolve:null};
   const result=new Promise(resolve=>{job.resolve=resolve;});jobs.push(job);
   job.timer=setTimeout(()=>{controller?.abort();settle(job,null);},10000);
   (async()=>{
    try{
     const response=await fetch('/api/achievements',controller?{signal:controller.signal}:undefined);
     if(!response.ok){settle(job,null);return;}const data=await response.json();
     const items=Array.isArray(data.achievements)?[...new Map(data.achievements.filter(item=>item?.unlockedAt&&typeof item.id==='string').map(item=>[item.id,item])).values()]:null;
     settle(job,items);
    }catch{settle(job,null);}
   })();
   return result;
  }
  function destroyTracker(){if(retired)return;retired=true;cancelPending();trackers.delete(tracker);}
  const tracker={check,destroy:destroyTracker,cancelPending,getState:()=>({pending:jobs.length,known:known?.size??0,baseline:known!==null,disposed:retired,suspended:disposed||suspended})};
  if(!retired){if(trackers.size>=8)trackers.values().next().value.destroy();trackers.add(tracker);}return tracker;
 }
 function init(){
  if(disposed)return;drain();if(typeof MutationObserver==='function'&&!observer){observer=new MutationObserver(sweep);observer.observe(document.body,{childList:true,subtree:true});}
 }
 function pagehide(event){if(!event.persisted){destroy();return;}suspended=true;clear();for(const tracker of trackers)tracker.cancelPending();observer?.disconnect();observer=null;}
 function pageshow(event){if(event.persisted&&!disposed){suspended=false;init();}}
 function destroy(){
  if(disposed)return;disposed=true;clear();seen.clear();for(const tracker of [...trackers])tracker.destroy();observer?.disconnect();observer=null;unsubscribe?.();unsubscribe=null;
  document.removeEventListener('visibilitychange',visibility);document.removeEventListener('DOMContentLoaded',init);media?.removeEventListener?.('change',policyChanged);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);
 }
 ui.notify=notify;ui.createAchievementTracker=createAchievementTracker;ui.notifications={clear,destroy,getState:()=>({visible:entries.length,queued:queue.length,seen:seen.size,timers:entries.filter(entry=>entry.timer!==null).length,trackers:trackers.size,disposed,suspended})};
 document.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',policyChanged);window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);unsubscribe=window.MotionPolicy?.subscribe?.(policyChanged);
 if(document.body)init();else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
