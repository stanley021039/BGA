window.RoomReconnect={
 forget(code){
  for(const key of ['ah-draw','ah-gift','ah-majority','ah-thunder','ah-session']){
   localStorage.removeItem(key+':'+code);
   try{if(JSON.parse(localStorage.getItem(key)||'null')?.code===code)localStorage.removeItem(key);}catch{localStorage.removeItem(key);}
  }
 },
 async restore(code,type,statusSelector){
  const status=document.querySelector(statusSelector);
  const key=type==='draw'?'ah-draw':type==='majority'?'ah-majority':type==='thunder'?'ah-thunder':type==='gift'?'ah-gift':'ah-session';
  const path=type==='draw'?'/draw/':type==='majority'?'/majority/':type==='thunder'?'/race/':type==='gift'?'/gift/':'/poker/';
  for(;;){
   try{
    if(status)status.textContent='正在找回原座位…';
    const response=await fetch('/api/reconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    const result=await response.json();
    if(!response.ok){
     if(response.status===401){location.replace('/login?next='+encodeURIComponent(path+code));return null;}
     if(['NOT_SEATED','KICKED','ROOM_NOT_FOUND'].includes(result.code)){
      this.forget(code);location.replace(result.code==='ROOM_NOT_FOUND'?'/?closedRoom='+code+'&game='+type:'/?room='+code+'&game='+type);return null;
     }
     throw Error(result.error||'無法重新連線');
    }
    if(result.type!==type){location.replace((result.type==='draw'?'/draw/':result.type==='majority'?'/majority/':result.type==='thunder'?'/race/':result.type==='gift'?'/gift/':'/poker/')+code);return null;}
    localStorage.setItem(key,JSON.stringify(result));
    localStorage.setItem(key+':'+code,JSON.stringify(result));
    if(status)status.textContent='已重新連線，恢復原座位';
    return result;
   }catch(error){
    if(status)status.textContent='連線中斷，正在重試…';
    await new Promise(resolve=>setTimeout(resolve,3000));
   }
  }
 }
};
