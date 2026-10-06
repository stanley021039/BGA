(() => {
 'use strict';
 const storageKey='ah-motion-settings',media=window.matchMedia?.('(prefers-reduced-motion: reduce)'),listeners=new Set(),animations=new Set();
 const defaults={enabled:true,barrages:true};let prefs={...defaults},visibilityEpoch=0;
 function read(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved?.version===1)return {enabled:saved.enabled!==false,barrages:saved.barrages!==false};if(['gift','majority','poker','race'].some(game=>localStorage.getItem('ah-'+game+'-motion')==='off'))return {...defaults,enabled:false};}catch{}return {...defaults};}
 prefs=read();
 const get=()=>({...prefs,reduced:!!media?.matches});
 const allowsMotion=()=>prefs.enabled&&!media?.matches&&!document.hidden;
 function cancelAll(){for(const animation of animations){try{animation.cancel();}catch{}}animations.clear();}
 function notify(){if(!allowsMotion())cancelAll();document.documentElement?.classList.toggle('motion-reduced',!prefs.enabled||!!media?.matches);for(const listener of listeners)listener(get());}
 function set(next){for(const key of ['enabled','barrages'])if(typeof next?.[key]==='boolean')prefs[key]=next[key];try{localStorage.setItem(storageKey,JSON.stringify({version:1,...prefs}));}catch{}notify();return get();}
 function subscribe(listener){listeners.add(listener);listener(get());return ()=>listeners.delete(listener);}
 // A snapshot establishes a baseline. Visibility changes, reconnects and long
 // gaps establish another one, so queued events never become a catch-up show.
 function createGate({maxSeen=256,maxGapMs=5000}={}){
  maxSeen=Math.max(1,Math.min(1024,Number(maxSeen)||256));
  let room=null,version=-1,lastAt=0,visibleAt=visibilityEpoch,initialized=false,live=false,disposed=false;const seen=new Set();
  return {
   update(state,{connected=true}={}){
    if(disposed)return false;
    const nextRoom=String(state?.code||''),nextVersion=Number.isFinite(state?.version)?state.version:version,now=Date.now(),sameRoom=initialized&&room===nextRoom;
    live=sameRoom&&connected&&!document.hidden&&visibleAt===visibilityEpoch&&now-lastAt<=maxGapMs&&nextVersion>=version;
    if(!sameRoom)seen.clear();
    if(sameRoom&&nextVersion<version){live=false;return false;}
    room=nextRoom;version=nextVersion;lastAt=now;visibleAt=visibilityEpoch;initialized=true;return live;
   },
   take(key,eligible=live){if(disposed||key===undefined||key===null)return false;key=String(key);if(seen.has(key))return false;seen.add(key);while(seen.size>maxSeen)seen.delete(seen.values().next().value);return !!eligible&&!document.hidden;},
   size:()=>seen.size,
   dispose(){disposed=true;seen.clear();live=false;},
  };
 }
 function animate(node,keyframes,options={}){
  if(!allowsMotion()||!node?.animate)return null;
  let animation;try{animation=node.animate(keyframes,options);}catch{return null;}
  animations.add(animation);if(animations.size>64){const first=animations.values().next().value;first.cancel();animations.delete(first);}
  if(animation.finished?.then)animation.finished.catch(()=>{}).then(()=>animations.delete(animation));
  else{animation.onfinish=()=>animations.delete(animation);animation.oncancel=()=>animations.delete(animation);}
  return animation;
 }
 const confirm=node=>animate(node,[{transform:'scale(.98)',opacity:.75},{transform:'scale(1)',opacity:1}],{duration:160,easing:'ease-out'});
 function createBarrageController(show){
  const gate=createGate(),lanes=new Map();let disconnected=false,destroyed=false,room=null;
  function clear(){for(const entry of lanes.values()){clearTimeout(entry.timer);entry.remove?.();}lanes.clear();}
  const unsubscribe=subscribe(()=>{if(document.hidden||!prefs.barrages)clear();else if(lanes.size)clear();});
  return {
   update(state){
    if(destroyed)return;
    if(room!==state.code){clear();room=state.code;}
    const live=gate.update(state,{connected:!disconnected});disconnected=false;
    for(const item of state.barrages||[]){
     if(!gate.take(item.id,live)||!prefs.barrages||Date.now()-item.at>=8000)continue;
     // Do not queue overflow: older messages should not cover a later decision.
     let lane=0;while(lanes.has(lane)&&lane<4)lane++;if(lane===4)continue;
     const moving=allowsMotion(),entry={remove:null,timer:null};lanes.set(lane,entry);
     const finish=()=>{if(lanes.get(lane)!==entry)return;clearTimeout(entry.timer);entry.remove?.();lanes.delete(lane);};
     entry.remove=show(item,lane,{moving,finish});entry.timer=setTimeout(finish,moving?8000:5000);
    }
   },
   disconnect(){disconnected=true;clear();},
   clear,
   size:()=>lanes.size,
   dispose(){destroyed=true;clear();unsubscribe();gate.dispose();},
  };
 }
 media?.addEventListener?.('change',notify);
 window.addEventListener('storage',event=>{if(event.key!==null&&event.key!==storageKey)return;prefs=read();notify();});
 document.addEventListener('visibilitychange',()=>{visibilityEpoch++;notify();});
 window.addEventListener('pagehide',cancelAll);
 window.MotionPolicy={get,set,subscribe,allowsMotion,createGate,animate,confirm,cancelAll,createBarrageController};notify();
})();
