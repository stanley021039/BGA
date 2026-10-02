(function(){
 'use strict';

 async function request(route,data,{code,room,session,onKicked}){
  const post=data!==undefined;
  const response=await fetch('/api/'+route+(post?'':'?code='+encodeURIComponent(code||'')),{
   method:post?'POST':'GET',
   headers:{'Content-Type':'application/json'},
   ...(post?{body:JSON.stringify({...data,code:data.code||code})}:{})
  });
  const result=await response.json();
  if(!response.ok){
   if(response.status===401&&session)location.replace('/login?next='+encodeURIComponent('/'+room+'/'+code));
   if(result.code==='KICKED'&&session)onKicked?.();
   throw Error(result.error||'連線失敗');
  }
  return result;
 }

 window.RoomApi={request};
})();
