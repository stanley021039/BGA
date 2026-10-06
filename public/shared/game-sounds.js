/* Live game cues share the effect player; rendering and sound preferences are independent. */
((root)=>{
 'use strict';
 const document=root.document;let visibilityEpoch=0;
 document?.addEventListener('visibilitychange',()=>{visibilityEpoch++;});
 const known=new Set(['turn','correct','dice-roll','shot','slam','nitro','skid','confirm','reveal']);
 const quietCues=new Set(['shot','slam','nitro','skid']);
 function create({now=()=>Date.now(),maxSeen=256,maxGapMs=5000}={}){
  maxSeen=Math.max(1,Math.min(1024,Number(maxSeen)||256));maxGapMs=Math.max(1,Math.min(5000,Number(maxGapMs)||5000));
  let context=null,version=-1,lastAt=0,initialized=false,live=false,epoch=0,visibleAt=visibilityEpoch,destroyed=false,lastQuietAt=-Infinity;
  const seen=new Set(),clips=new Set();
  function stop(){for(const clip of [...clips])root.AudioSettings?.stopEffect?.(clip);clips.clear();}
  function invalidate(){epoch++;live=false;stop();lastQuietAt=-Infinity;}
  function reset(){invalidate();context=null;version=-1;initialized=false;lastAt=0;visibleAt=visibilityEpoch;seen.clear();}
  function update(state,{connected=true}={}){
   if(destroyed)return false;
   const next=String(state?.code||''),nextVersion=Number.isFinite(state?.version)?state.version:version,at=now();
   const same=initialized&&context===next,visible=visibleAt===visibilityEpoch,gap=at-lastAt<=maxGapMs&&at>=lastAt;
   if(same&&nextVersion<version){live=false;return false;}
   if(!same){invalidate();seen.clear();}else if(!connected||document?.hidden||!visible||!gap)invalidate();
   live=same&&connected&&!document?.hidden&&visible&&gap;
   context=next;version=nextVersion;lastAt=at;visibleAt=visibilityEpoch;initialized=true;return live;
  }
  function play(cue,key,{live:eligible=live,epoch:token=epoch,quiet=quietCues.has(cue)}={}){
   if(destroyed||!known.has(cue)||key==null)return;
   key=String(key);if(seen.has(key))return;seen.add(key);while(seen.size>maxSeen)seen.delete(seen.values().next().value);
   if(!eligible||!live||token!==epoch||visibleAt!==visibilityEpoch||document?.hidden)return;
   const at=now();if(quiet&&at-lastQuietAt<250)return;
   let ended=false;const clip=root.AudioSettings?.playEffect?.(cue,{onStop:item=>{ended=true;clips.delete(item);}});
   if(clip&&!ended){clips.add(clip);if(quiet)lastQuietAt=at;}return clip;
  }
  const hide=()=>{if(document?.hidden)invalidate();};const leave=()=>reset();
  document?.addEventListener('visibilitychange',hide);root.addEventListener?.('pagehide',leave);
  return {update,play,epoch:()=>epoch,disconnect(){invalidate();initialized=false;},reset,stop,size:()=>seen.size,destroy(){if(destroyed)return;reset();destroyed=true;document?.removeEventListener?.('visibilitychange',hide);root.removeEventListener?.('pagehide',leave);}};
 }
 root.GameSounds={create};
})(typeof window==='object'?window:globalThis);
