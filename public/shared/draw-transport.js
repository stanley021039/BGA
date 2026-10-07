(function(){
 'use strict';
 // Only unsent adjacent work may merge. A prepared request keeps its ID and body through retries.
 function create({send,createId,isCurrent,onPending=()=>{},onAccepted=()=>{},onError=()=>{},onSettled=()=>{},onDiscard=()=>{},onStart=()=>{},now=()=>performance.now(),pacing=()=>({lastStart:-Infinity,lastFill:-Infinity}),maxPoints=30000,maxEntries=1000}){
  let queue=[],inFlight=null,timer=null,requestTimer=null,generation=0,drain=null,resolveDrain=null;
  const pointBytes=point=>JSON.stringify(point).length+1;
  const key=data=>JSON.stringify([data.canvasEpoch,data.round,data.strokeId,data.tool,data.color,data.size,!!data.filled]);
  function pending(){return queue.reduce((total,job)=>total+job.points.length,0);}
  function idle(){if(!queue.length&&!inFlight&&resolveDrain){resolveDrain();resolveDrain=null;drain=null;}}
  function whenIdle(){if(!queue.length&&!inFlight)return Promise.resolve();if(!drain)drain=new Promise(resolve=>resolveDrain=resolve);return drain;}
  function clearTimer(){if(timer!==null)clearTimeout(timer);timer=null;}
  function dropQueue(reason){for(const job of queue){onDiscard(job.token,reason);onPending(job.token,-1);}queue=[];}
  function cancel({retainInFlight=false}={}){
   if(inFlight?.retrying)retainInFlight=false;
   clearTimer();dropQueue('cancel');
   if(!retainInFlight){generation++;if(requestTimer!==null)clearTimeout(requestTimer);requestTimer=null;if(inFlight){inFlight.controller?.abort();inFlight.cancelTimeout?.();onPending(inFlight.token,-1);inFlight=null;}}
   idle();
  }
  function schedule(delay=0){if(inFlight||timer!==null||!queue.length)return;timer=setTimeout(()=>{timer=null;pump();},delay);}
  function enqueue(data,token){
   const points=data.points.map(point=>[...point]),signature=key(data),tail=queue.at(-1);
   if(tail?.key===signature&&tail.token===token&&['brush','erase'].includes(data.tool)&&points.length&&tail.points.length){const last=tail.points.at(-1);if(last[0]===points[0][0]&&last[1]===points[0][1])points.shift();}
   if(!points.length)return true;
   const merge=tail?.key===signature&&tail.token===token&&['brush','erase'].includes(data.tool);
   if(pending()+points.length>maxPoints||(!merge&&queue.length>=maxEntries))throw Error('畫布同步中的資料已達上限；尚未同步的筆畫已取消，正在回復已確認畫布。');
   if(merge)tail.points.push(...points);
   else{queue.push({data:{...data,points:undefined},points,key:signature,token,queuedAt:now()});onPending(token,1);}
   schedule();return true;
  }
  function transient(error){return error?.code==='DRAW_RATE_LIMIT'&&error.status===429||error?.status>=500||['TypeError','SyntaxError','TimeoutError'].includes(error?.name);}
  function stillCurrent(job){return inFlight===job&&job.generation===generation&&isCurrent(job.data,job.token);}
  function finish(job){if(inFlight!==job)return;if(requestTimer!==null)clearTimeout(requestTimer);requestTimer=null;inFlight=null;onPending(job.token,-1);onSettled(job.token);schedule();idle();}
  function pump(){
   while(queue.length&&!isCurrent(queue[0].data,queue[0].token)){const old=queue.shift();onPending(old.token,-1);}
   if(inFlight||!queue.length){idle();return;}
   const head=queue[0],clock=now(),pace=pacing(),delay=Math.max(0,115-(clock-pace.lastStart),head.data.tool==='fill'?500-(clock-pace.lastFill):0);
   if(delay){schedule(delay);return;}
   const points=head.points.splice(0,64);
   if(head.points.length){head.points.unshift([...points.at(-1)]);onPending(head.token,1);}else queue.shift();
   const data=Object.freeze({...head.data,batchId:createId(),points:Object.freeze(points.map(point=>Object.freeze(point)))});
   inFlight={data,token:head.token,generation,attempts:0,queuedAt:head.queuedAt,controller:null};attempt(inFlight);
  }
  function attempt(job){
   if(!stillCurrent(job)){finish(job);return;}
   const pace=pacing(),clock=now(),delay=Math.max(0,115-(clock-pace.lastStart),job.data.tool==='fill'?500-(clock-pace.lastFill):0);
   if(delay){timer=setTimeout(()=>{timer=null;attempt(job);},delay);return;}
   job.retrying=false;job.attempts++;job.controller=new AbortController();onStart(job.data,clock);
   let expire;
   const timeout=new Promise((_,reject)=>{expire=reject;requestTimer=setTimeout(()=>{requestTimer=null;const error=new DOMException('畫布傳送逾時','TimeoutError');job.controller.abort(error);reject(error);},10000);});
   Promise.race([Promise.resolve().then(()=>send(job.data,{signal:job.controller.signal},job.attempts)),timeout]).then(async result=>{
    if(!stillCurrent(job)){finish(job);return;}if(requestTimer!==null)clearTimeout(requestTimer);requestTimer=null;
    await onAccepted(result,job.data,job.token);finish(job);
   }).catch(error=>{
    if(!stillCurrent(job)){finish(job);return;}
    if(requestTimer!==null)clearTimeout(requestTimer);requestTimer=null;
    if(transient(error)&&job.attempts<3){job.retrying=true;timer=setTimeout(()=>{timer=null;attempt(job);},job.attempts===1?1000:2000);return;}
    dropQueue('error');onError(error,job.token);finish(job);
   });
   job.cancelTimeout=()=>expire(new DOMException('畫布傳送已取消','AbortError'));
  }
  function metrics(){
   const oldest=inFlight?inFlight.queuedAt:queue[0]?.queuedAt;
   return {pendingPoints:pending(),pendingBytes:queue.reduce((total,job)=>total+JSON.stringify(job.data).length+job.points.reduce((n,point)=>n+pointBytes(point),0),0),pendingEntries:queue.length,inFlightPoints:inFlight?.data.points.length||0,inFlightAttempts:inFlight?.attempts||0,oldestAgeMs:oldest===undefined?0:Math.max(0,now()-oldest)};
  }
  return {enqueue,whenIdle,cancel,metrics};
 }
 window.DrawTransport={create};
})();
