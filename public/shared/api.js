(function(){
 'use strict';

 async function request(route,data,{code,room,session,onKicked}){
  const post=data!==undefined;
  const response=await fetch('/api/'+route+(post?'':'?code='+encodeURIComponent(code||'')),{
   method:post?'POST':'GET',
   headers:{'Content-Type':'application/json'},
   ...(post?{body:JSON.stringify({...data,code:data.code||code})}:{})
  }).catch(error=>{window.GameShell?.disconnected?.();throw error;});
  const result=await response.json().catch(error=>{window.GameShell?.disconnected?.();throw error;});
  if(!response.ok){
   if(response.status>=500)window.GameShell?.disconnected?.();
   if(response.status===401&&session)location.replace('/login?next='+encodeURIComponent('/'+room+'/'+code));
   if(result.code==='KICKED'&&session)onKicked?.();
   if(['ROOM_NOT_FOUND','NOT_SEATED'].includes(result.code)&&session){window.RoomReconnect?.forget(code);location.replace('/?closedRoom='+encodeURIComponent(code)+'&game='+(room==='race'?'thunder':room));}
   throw Error(result.error||'連線失敗');
  }
  if(route==='state'||Array.isArray(result.players)&&result.phase)window.GameShell?.showHistoryWarning?.(result.historyWarning);
  return result;
 }

 window.RoomApi={request};
})();
