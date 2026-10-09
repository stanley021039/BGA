(function(){
 'use strict';
 // Owns read/stream lifetimes only. Canonical canvas, input, ACKs and rendering
 // remain with the page and their existing specialized modules.
 function create({context,request,receive,applySnapshot,receiveStroke,onSyncError=()=>{},onSyncSuccess=()=>{},onPollError=()=>{},onPollSuccess=()=>{},onStreamReady=()=>{},onStreamError=()=>{},cancelWork=()=>{},tick=()=>{},restoreSession,onRestored=()=>{},createStream=typeof EventSource==='function'?url=>new EventSource(url):null,setTimer=setTimeout,clearTimer=clearTimeout,setRepeater=setInterval,clearRepeater=clearInterval}){
  let running=false,generation=0,syncJob=null,pollJob=null,restoreJob=null,stream=null,pollTimer=null,tickTimer=null;
  const sameRoom=captured=>{const next=context();return running&&!!next.session&&captured.room===next.room;};
  const sameCanvas=(data,captured=context())=>!!captured.epoch&&data?.canvasEpoch===captured.epoch&&data.round===captured.round;
  function start(){if(running)return;running=true;const token=++generation;pollTimer=setRepeater(()=>{if(running&&generation===token)poll();},1000);tickTimer=setRepeater(()=>{if(running&&generation===token)tick();},250);}
  function cancelSync(){const job=syncJob;if(!job)return;syncJob=null;clearTimer(job.timer);job.timer=null;job.controller.abort();}
  function cancel({cancelSync:includeSync=true}={}){cancelWork();if(includeSync)cancelSync();}
  function dispose(){
   if(!running)return;running=false;generation++;
   clearRepeater(pollTimer);clearRepeater(tickTimer);pollTimer=tickTimer=null;
   const source=stream;stream=null;source?.close();
   const job=pollJob;pollJob=null;job?.controller.abort();const recovery=restoreJob;restoreJob=null;recovery?.controller.abort();cancel();
  }
  function syncCanvas(){
   const captured={...context()};if(!running||!captured.session)return Promise.resolve();
   if(syncJob)return syncJob.promise;
   const job={captured,generation,controller:new AbortController(),timer:null,promise:null};syncJob=job;
   const current=()=>syncJob===job&&job.generation===generation&&sameRoom(captured)&&context().epoch===captured.epoch&&context().round===captured.round;
   job.promise=(async()=>{
    const aborted=new Promise((_,reject)=>job.controller.signal.addEventListener('abort',()=>reject(job.controller.signal.reason),{once:true}));
    job.timer=setTimer(()=>job.controller.abort(new DOMException('畫布同步逾時','TimeoutError')),10000);
    try{
     const snapshot=await Promise.race([request('draw/canvas',undefined,{signal:job.controller.signal}),aborted]);
     if(!current()||!sameCanvas(snapshot))return;
     applySnapshot(snapshot);onSyncSuccess();
    }catch(error){if(current()&&error.name!=='AbortError')onSyncError(error);}
    finally{clearTimer(job.timer);job.timer=null;if(syncJob===job)syncJob=null;}
   })();
   return job.promise;
  }
  async function poll(){
   const captured={...context()};if(!running||!captured.session||captured.busy||pollJob)return;
   const job={controller:new AbortController(),generation};pollJob=job;
   const current=()=>pollJob===job&&generation===job.generation&&sameRoom(captured)&&context().epoch===captured.epoch&&context().round===captured.round;
   try{
    const aborted=new Promise((_,reject)=>job.controller.signal.addEventListener('abort',()=>reject(job.controller.signal.reason),{once:true}));
    const next=await Promise.race([request('state',undefined,{signal:job.controller.signal}),aborted]);
    if(current()){receive(next);onPollSuccess();}
   }catch(error){if(current()&&error.name!=='AbortError')onPollError(error);}
   finally{if(pollJob===job)pollJob=null;}
  }
  function restore(){
   const captured={...context()};if(!running||captured.session||!captured.room||!restoreSession)return Promise.resolve();
   if(restoreJob)return restoreJob.promise;
   const job={controller:new AbortController(),generation,promise:null};restoreJob=job;
   const current=()=>restoreJob===job&&generation===job.generation&&running&&!context().session&&context().room===captured.room;
   job.promise=(async()=>{
    try{
     const aborted=new Promise((_,reject)=>job.controller.signal.addEventListener('abort',()=>reject(job.controller.signal.reason),{once:true}));
     const restored=await Promise.race([restoreSession(captured.room,{signal:job.controller.signal}),aborted]);
     if(current()&&restored){onRestored(restored);poll();}
    }catch(error){if(current()&&error.name!=='AbortError')onPollError(error);}
    finally{if(restoreJob===job)restoreJob=null;}
   })();
   return job.promise;
  }
  function connectEvents(){
   const captured={...context()};if(!running||stream||!captured.session||!createStream)return;
   const source=createStream('/api/draw/events?code='+encodeURIComponent(captured.room)),token=generation;stream=source;
   const current=()=>stream===source&&generation===token&&sameRoom(captured);
   source.addEventListener('stroke',event=>{if(!current())return;try{receiveStroke(JSON.parse(event.data));}catch{syncCanvas();}});
   source.addEventListener('reset',event=>{if(!current())return;try{const data=JSON.parse(event.data);if(data.version>context().version)applySnapshot(data,true);}catch{syncCanvas();}});
   source.addEventListener('ready',event=>{if(!current())return;onStreamReady();try{const data=JSON.parse(event.data);if(sameCanvas(data)&&data.version!==context().version)syncCanvas();}catch{syncCanvas();}});
   source.addEventListener('error',()=>{if(current())onStreamError();});
  }
  return {start,dispose,cancel,cancelSync,syncCanvas,poll,restore,connectEvents,get pendingSync(){return syncJob?.promise||null;}};
 }
 window.DrawController={create};
})();
