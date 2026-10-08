(function(root){
 'use strict';
 class ChatClient{
  constructor({fetcher=(...args)=>root.fetch(...args),changed=()=>{}}={}){this.fetcher=fetcher;this.changed=changed;this.code=null;this.roomKey=null;this.channel='lobby';this.open=false;this.generation=0;this.controllers=new Set();this.viewer=null;this.enabled=true;this.pending=false;this.retry=null;this.messages={lobby:[],table:[]};this.unread={lobby:0,table:0};this.initial={lobby:false,table:false};this.status='';this.polling=false;}
  cancel(){this.generation++;for(const c of this.controllers)c.abort();this.controllers.clear();this.pending=false;this.polling=false;}
  reset(){this.messages={lobby:[],table:[]};this.unread={lobby:0,table:0};this.initial={lobby:false,table:false};this.retry=null;}
  room(snapshot){const key=snapshot?`${snapshot.code}:${snapshot.me}:${snapshot.media?.roomInstanceId||''}`:null;if(key===this.roomKey)return;this.cancel();this.roomKey=key;this.code=snapshot?.code||null;this.messages.table=[];this.unread.table=0;this.initial.table=false;this.channel=this.code?'table':'lobby';this.retry=null;this.status='';this.changed();}
  logout(){this.cancel();this.reset();this.viewer=null;this.enabled=false;this.status='請登入後使用聊天室';this.changed();}
  select(channel){if(channel==='table'&&!this.code)return;this.channel=channel;this.retry=null;if(this.open)this.unread[channel]=0;this.changed();}
  show(open){this.open=open;if(open)this.unread[this.channel]=0;this.changed();}
  async request(channel,body){
   const generation=this.generation,code=this.code,c=new AbortController();this.controllers.add(c);const timeout=setTimeout(()=>c.abort(),10000);
   try{
    const response=await this.fetcher('/api/chat'+(body?'':`?channel=${channel}${channel==='table'?'&code='+encodeURIComponent(code):''}`),{method:body?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:c.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,channel,...(channel==='table'?{code}:{})})}:{})});
    const data=await response.json();if(generation!==this.generation)return false;
    if(response.status===401){this.logout();return false;}
    if(channel==='table'&&[403,404].includes(response.status)){this.room(null);this.status='本桌聊天已結束，請重新入座';this.changed();return false;}
    if(!response.ok)throw Error(data.error||'聊天室暫時無法連線');
    if(data.channel!==channel||(channel==='table'&&data.code!==code))return false;
    if(this.viewer&&this.viewer!==data.viewerId){this.cancel();this.reset();this.code=null;this.roomKey=null;this.channel='lobby';this.viewer=data.viewerId;this.status='登入身分已變更，請重新確認房間';this.changed();return false;}
    this.viewer=data.viewerId;
    const previous=new Set(this.messages[channel].map(item=>item.id));
    if(this.initial[channel]&&(!this.open||this.channel!==channel))this.unread[channel]=Math.min(50,this.unread[channel]+data.messages.filter(item=>!previous.has(item.id)).length);
    this.messages[channel]=data.messages.slice(-50);this.initial[channel]=true;this.status='';this.changed();return true;
   }catch(error){if(generation===this.generation){this.status=error.name==='AbortError'?'連線逾時，稍後重試':error.message;this.changed();}return false;}
   finally{clearTimeout(timeout);this.controllers.delete(c);}
  }
  async poll(){if(!this.enabled||this.polling||this.pending)return false;this.polling=true;const generation=this.generation;
   try{let ok=await this.request('lobby');if(generation===this.generation&&this.code)ok=(await this.request('table'))&&ok;return ok;}finally{if(generation===this.generation)this.polling=false;}
  }
  async send(message){if(!this.enabled||this.pending||!message.trim())return false;if(this.polling)this.cancel();
   const generation=this.generation,channel=this.channel,key=`${channel}:${this.code}:${message}`;
   if(this.retry?.key!==key)this.retry={key,id:root.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(16).slice(2)};
   this.pending=true;this.changed();
   try{const ok=await this.request(channel,{message,requestId:this.retry.id});if(generation!==this.generation)return false;if(ok)this.retry=null;return ok;}
   finally{if(generation===this.generation){this.pending=false;this.changed();}}
  }
 }
 if(typeof module==='object'&&module.exports){module.exports={ChatClient};return;}
 let mountAttempts=0;
 let queuedRoom=null,queuedLogout=false;root.SharedChat={updateRoom:s=>{queuedRoom=s;},clearRoom:()=>{queuedRoom=null;},logout:()=>{queuedRoom=null;queuedLogout=true;}};
 function mount(){
  const game=location.pathname!=='/';
  if(game&&new URLSearchParams(location.search).has('learn'))return;
  const host=document.querySelector(game?'.room-sidebar,.race-utility-panel,.race-controls':'.lobby-section');if(!host){if(game&&mountAttempts++<50)setTimeout(mount,100);return;}
  const panel=document.createElement('section');panel.className='shared-chat';panel.setAttribute('aria-label','聊天室');
  panel.innerHTML='<button type="button" class="chat-toggle" aria-expanded="false" aria-controls="chat-content">聊天室 <span class="chat-badge"></span></button><div id="chat-content" hidden><div class="chat-channels" role="group" aria-label="聊天頻道"><button type="button" data-channel="lobby">大廳 <span></span></button><button type="button" data-channel="table" hidden>本桌 <span></span></button></div><p class="chat-retention">各頻道最多保留 50 則；僅存記憶體，重啟後消失，本桌隨房間結束清除。</p><ol class="chat-messages" aria-label="聊天訊息"></ol><form autocomplete="off"><label for="chat-input"></label><div class="chat-compose"><input id="chat-input" maxlength="160" required autocomplete="off"><button type="submit" aria-label="發送聊天訊息">發送</button></div></form><p class="chat-status" role="status" aria-live="polite"></p></div>';
  host.append(panel);const q=s=>panel.querySelector(s),list=q('.chat-messages'),input=q('input'),submit=q('[type=submit]');
  root.GameUI?.decorateButton(submit,'send',{iconOnly:true,label:'發送聊天訊息'});
  let rendered='',lastContext='',timer=null,backoff=3000,paused=false,pollEpoch=0;
  const client=new ChatClient({changed:render});
  function render(){
   const context=`${client.viewer}:${client.code}:${client.channel}`;if(context!==lastContext){input.value='';lastContext=context;rendered=null;}
   q('#chat-content').hidden=!client.open;q('.chat-toggle').setAttribute('aria-expanded',String(client.open));
   q('.chat-badge').textContent=client.unread.lobby+client.unread.table?`未讀 ${Math.min(99,client.unread.lobby+client.unread.table)}`:'';
   for(const button of panel.querySelectorAll('[data-channel]')){const channel=button.dataset.channel;button.hidden=channel==='table'&&!client.code;button.setAttribute('aria-pressed',String(client.channel===channel));button.querySelector('span').textContent=client.unread[channel]?`未讀 ${client.unread[channel]}`:'';}
   const destination=client.channel==='table'?`本桌 ${client.code}`:'大廳（所有登入玩家可見）';q('label').textContent='發送至 '+destination;input.placeholder='留言最多 160 字';
   input.disabled=!client.enabled||!client.viewer||client.pending;submit.disabled=!client.enabled||!client.viewer||client.pending;q('form').setAttribute('aria-busy',String(client.pending));q('.chat-status').textContent=client.pending?'傳送中…':client.status;
   const messages=client.messages[client.channel],signature=messages.map(item=>item.id).join();if(signature===rendered)return;
   const atBottom=list.scrollHeight-list.scrollTop-list.clientHeight<40;rendered=signature;list.replaceChildren();
   for(const message of messages){const row=document.createElement('li'),name=document.createElement('b'),time=document.createElement('time'),text=document.createElement('p');name.textContent=message.name;time.textContent=new Date(message.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});text.textContent=message.message;row.append(name,time,text);list.append(row);}
   if(atBottom)list.scrollTop=list.scrollHeight;
  }
  async function tick(){const epoch=++pollEpoch;clearTimeout(timer);if(paused||document.hidden||!client.enabled)return;const ok=await client.poll();if(epoch!==pollEpoch||paused||document.hidden||!client.enabled)return;backoff=ok?3000:Math.min(30000,backoff*2);timer=setTimeout(tick,backoff);}
  q('.chat-toggle').onclick=()=>{client.show(!client.open);if(client.open){list.scrollTop=list.scrollHeight;input.focus();}};
  for(const button of panel.querySelectorAll('[data-channel]'))button.onclick=()=>client.select(button.dataset.channel);
  q('form').onsubmit=async event=>{event.preventDefault();if(event.isComposing)return;const message=input.value;if(client.polling)client.cancel();const generation=client.generation,channel=client.channel;if(await client.send(message)&&generation===client.generation&&channel===client.channel&&input.value===message)input.value='';};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);client.cancel();}else tick();});
  root.addEventListener('online',tick);root.addEventListener('pagehide',()=>{paused=true;clearTimeout(timer);client.cancel();client.reset();render();});root.addEventListener('pageshow',()=>{paused=false;tick();});
  root.addEventListener('storage',event=>{if(event.key==='ah-chat-logout'){clearTimeout(timer);client.logout();}});
  root.SharedChat={updateRoom(snapshot){client.room(snapshot);},clearRoom(){client.room(null);},logout(){clearTimeout(timer);client.logout();}};
  if(queuedRoom)client.room(queuedRoom);if(queuedLogout)client.logout();render();tick();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window==='object'?window:globalThis);
