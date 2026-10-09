(function(){
 'use strict';

 // Transport only: one fetch, one body read, no UI/session effects or retries.
 // Empty success returns null; HTTP failures keep their status even without JSON.
 async function requestJson(url,options={}){
  const response=await fetch(url,options);
  options.signal?.throwIfAborted();
  let text,result=null,bodyError;
  try{text=await response.text();}
  catch(error){if(error?.name==='AbortError')throw error;bodyError=error;}
  options.signal?.throwIfAborted();
  if(!bodyError&&text.trim()){
   try{result=JSON.parse(text);}
   catch(error){bodyError=error;}
  }
  if(!response.ok){
   const error=Error(typeof result?.error==='string'&&result.error||'請求失敗（HTTP '+response.status+'）');
   error.status=response.status;error.code=result?.code;error.details=result;error.kind='http';
   if(bodyError)error.cause=bodyError;
   throw error;
  }
  if(bodyError){
   const error=Error(text===undefined?'無法讀取伺服器回應':'伺服器回應不是有效的 JSON');
   error.status=response.status;error.code=text===undefined?'BODY_READ_FAILED':'INVALID_JSON';error.kind='response';error.cause=bodyError;
   throw error;
  }
  return result;
 }

 async function request(route,data,{code,room,session,onKicked,signal}){
  const post=data!==undefined;
  const url='/api/'+route+(post?'':'?code='+encodeURIComponent(code||''));
  const options={
   method:post?'POST':'GET',
   headers:{'Content-Type':'application/json'},
   ...(signal?{signal}:{}),
   ...(post?{body:JSON.stringify({...data,code:data.code||code})}:{})
  };
  let result;
  try{result=await requestJson(url,options);signal?.throwIfAborted();}
  catch(error){
   if(signal?.aborted)error=signal.reason;
   if(error?.name==='AbortError')throw error;
   if(!error?.status||error.status>=500||error.kind==='response')window.GameShell?.disconnected?.();
   if(error?.kind==='http'){
    if(error.status===401&&session)location.replace('/login?next='+encodeURIComponent('/'+room+'/'+code));
    if(error.code==='KICKED'&&session)onKicked?.();
    if(['ROOM_NOT_FOUND','NOT_SEATED'].includes(error.code)&&session){window.RoomReconnect?.forget(code);location.replace('/?closedRoom='+encodeURIComponent(code)+'&game='+(room==='race'?'thunder':room));}
   }
   throw error;
  }
  if(route==='state'||Array.isArray(result?.players)&&result.phase)window.GameShell?.showHistoryWarning?.(result?.historyWarning);
  return result;
 }

 window.RoomApi={request,requestJson};
})();
