/* One snapshot delivery owner for room UI. Game pages keep their gameplay state. */
(()=>{
 'use strict';
 let current=null,receive=null,dispatching=false,accepting=null,delivery=0,generation=0;
 function sameRoom(a,b){
  return !!a&&!!b&&a.code===b.code&&a.me===b.me&&(a.type||'poker')===(b.type||'poker')&&
   [s=>s.roomInstanceId,s=>s.media?.roomInstanceId,s=>s.watch?.roomInstanceId].every(read=>!read(a)||!read(b)||read(a)===read(b));
 }
 function stale(next){
  return sameRoom(next,current)&&(next.version<current.version||
   next.version===current.version&&Number.isFinite(next.serverNow)&&Number.isFinite(current.serverNow)&&next.serverNow<current.serverNow);
 }
 function update(snapshot,callback){
  if(!snapshot||stale(snapshot)||dispatching)return false;
  if(!sameRoom(snapshot,current))receive=null;
  if(typeof callback==='function')receive=callback;
  current=snapshot;
  delivery++;dispatching=true;
  try{
  document.body.dataset.roomPhase=snapshot.phase;
  window.RoomHost?.renderSnapshot(snapshot);
  window.RoomWaiting?.update(snapshot);
  if(!window.RaceLesson){
   window.RoomControls?.update(snapshot);
   window.SharedChat?.updateRoom(snapshot);
  }
  window.TableMedia?.update(snapshot);
  window.GameShell?.renderSnapshot(snapshot);
  return true;
  }finally{dispatching=false;}
 }
 function acceptSnapshot(snapshot){
  if(!snapshot||!sameRoom(snapshot,current)||stale(snapshot)||accepting===snapshot)return false;
  // Commands enter through the game owner so its state and the shared UI agree.
  const before=delivery,epoch=generation;accepting=snapshot;
  try{
   if(receive)receive(snapshot);
   // Presence-only callbacks may intentionally skip their gameplay render.
   if(generation!==epoch)return false;
   if(delivery===before)update(snapshot);
   return true;
  }finally{accepting=null;}
 }
 window.RoomUI={update,acceptSnapshot,stop(){generation++;current=null;receive=null;}};
})();
