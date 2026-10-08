/* Original, finite achievement sparks. No network, audio, or permanent frame loop. */
((root)=>{
 'use strict';
 const ui=root.GameUI=root.GameUI||{},doc=root.document,active=new Map(),seen=new Set();
 const media=root.matchMedia?.('(prefers-reduced-motion: reduce)');
 let sequence=0;
 function allowed(){try{return !!doc&&!doc.hidden&&!media?.matches&&(root.MotionPolicy?.allowsMotion?root.MotionPolicy.allowsMotion():root.MotionPolicy?.get?.().enabled!==false);}catch{return false;}}
 function remember(id){if(typeof id!=='string'||!id||id.length>160||seen.has(id))return false;seen.add(id);while(seen.size>256)seen.delete(seen.values().next().value);return true;}
 function clear(){for(const cancel of [...active.values()])cancel();}
 function celebrate(target,{id='celebration:'+ ++sequence}={}){
  if(!target||!remember(id)||!allowed()||target.isConnected===false)return ()=>{};
  // A finite fallback remains available when WebGL is blocked or its page budget is used.
  while(active.size>=3)active.values().next().value();
  const host=doc.createElement('span'),ring=doc.createElement('span');
  host.className='ui-celebration';host.setAttribute('aria-hidden','true');
  ring.className='ui-celebration-ring';host.appendChild(ring);target.appendChild(host);
  let layer=null,timer=null,observer=null,cancelled=false;
  const cancel=()=>{
   if(cancelled)return;cancelled=true;
   if(timer!==null)root.clearTimeout(timer);
   observer?.disconnect();layer?.destroy();host.remove();active.delete(id);
  };
  active.set(id,cancel);
  try{
   if(root.GameFxLayer){
    layer=root.GameFxLayer.create(host,{maxParticles:24,maxEffects:1,maxDpr:1.25,maxPixels:90000,
     onActivity:({active})=>{host.dataset.rendered=String(active);}});
    layer.play(id,'sparks',()=>{
     if(target.isConnected===false)return null;
     const box=host.getBoundingClientRect();
     return {x:Math.min(40,box.width*.18),y:box.height*.5};
    },{count:24,durationMs:960,direction:0});
   }
   if(root.MutationObserver&&doc.body){observer=new root.MutationObserver(()=>{if(target.isConnected===false)cancel();});observer.observe(doc.body,{childList:true,subtree:true});}
   timer=root.setTimeout(cancel,1100);
  }catch{layer?.destroy();layer=null;timer=root.setTimeout(cancel,1100);}
  return cancel;
 }
 function cancelBlocked(){if(!allowed())clear();}
 doc?.addEventListener('visibilitychange',cancelBlocked);
 media?.addEventListener?.('change',cancelBlocked);
 root.MotionPolicy?.subscribe?.(cancelBlocked);
 root.addEventListener?.('pagehide',clear);
 ui.celebrate=celebrate;
 // Bounded diagnostic counters are also useful for verifying idle cleanup.
 ui.getCelebrationsState=()=>({active:active.size,seen:seen.size});
})(typeof window==='object'?window:globalThis);
