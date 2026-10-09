(function(root){
 'use strict';
 // Synchronization and page lifetime only. The page owns rendering, selection,
 // movement, dice and sound presentation; the transport owns HTTP semantics.
 function create({getSession,getState,isBusy,isDisconnected,isLesson,isStaleSnapshot,
  request:transport,render,updatePresence,onConnected,onDisconnected,onClosed,
  onSuspend,restore,onRestored,tick,document,window,setInterval,clearInterval,AbortController}){
  let epoch=0,polling=null,recovering=null,live=false,suspended=false,disposed=false;
  let pollTimer=null,tickTimer=null,receiver=null;
  const requests=new Set();
  const token=()=>({epoch,session:getSession()});
  const current=value=>!disposed&&!suspended&&value.epoch===epoch&&value.session===getSession();
  function aborted(){const error=Error('Race request cancelled');error.name='AbortError';return error;}
  async function request(route,data){
   const owner=token();if(!current(owner))throw aborted();
   const abort=new AbortController();requests.add(abort);
   try{const result=await transport(route,data,{signal:abort.signal,session:owner.session,isCurrent:()=>current(owner)});if(!current(owner))throw aborted();return result;}
   catch(error){if(!current(owner))throw aborted();throw error;}
   finally{requests.delete(abort);}
  }
  function receive(snapshot){
   if(disposed||suspended)return;
   const state=getState();
   if(snapshot.code&&getSession()?.code&&snapshot.code!==getSession().code)return;
   if(state&&(snapshot.version<state.version||isStaleSnapshot(snapshot,state)))return;
   const presence=s=>s.players.map(player=>player.online).join(',');
   if(!state||snapshot.version!==state.version||presence(snapshot)!==presence(state)||isDisconnected())render(snapshot);
   else updatePresence(snapshot);
  }
  function getReceiver(){
   if(!receiver){const owner=token();receiver=snapshot=>{if(current(owner))receive(snapshot);};}
   return receiver;
  }
  async function refresh(){
   if(disposed||suspended||isLesson()||!getSession()||isBusy()||polling)return;
   const owner=token();polling=owner;
   try{const snapshot=await request('state');if(!current(owner))return;receive(snapshot);onConnected();}
   catch(error){if(!current(owner)||error?.name==='AbortError')return;onDisconnected(error);if(/找不到房間|連線已失效/.test(error.message))onClosed(owner.session);}
   finally{if(polling===owner)polling=null;}
  }
  function clearTimers(){if(pollTimer!==null)clearInterval(pollTimer);if(tickTimer!==null)clearInterval(tickTimer);pollTimer=tickTimer=null;}
  function cancel(reason='reset'){
   epoch++;receiver=null;polling=null;recovering=null;
   for(const abort of requests)abort.abort();requests.clear();onSuspend(reason);
  }
  async function recover(){
   if(!restore||recovering)return;
   const owner=token(),abort=new AbortController();recovering=owner;requests.add(abort);
   try{const session=await restore({signal:abort.signal});if(current(owner)&&session){onRestored(session);receiver=null;startTimers();}}
   catch(error){if(current(owner)&&error?.name!=='AbortError')onDisconnected(error);}
   finally{requests.delete(abort);if(recovering===owner)recovering=null;}
  }
  function startTimers(){
   if(disposed||suspended||!live||isLesson()||pollTimer!==null)return;
   if(!getSession()){recover();return;}
   refresh();pollTimer=setInterval(refresh,700);tickTimer=setInterval(tick,250);
  }
  function beginLive(){if(disposed||isLesson()||live)return;live=true;suspended=!!document.hidden;startTimers();}
  function suspend(reason){if(disposed)return;suspended=true;clearTimers();cancel(reason);}
  function resume(){if(disposed||document.hidden||!suspended)return;suspended=false;startTimers();}
  const visibility=()=>document.hidden?suspend('hidden'):resume();
  const pagehide=()=>suspend('pagehide'),pageshow=()=>resume();
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
  function dispose(){if(disposed)return;suspend('dispose');disposed=true;live=false;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);}
  return {request,receive,receiver:getReceiver,refresh,beginLive,cancel,dispose,token,current};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RaceController=api;
})(typeof window!=='undefined'?window:globalThis);
