(function(root){
 'use strict';
 class ChatClient{
  constructor({fetcher=(...args)=>root.fetch(...args),changed=()=>{},roomChanged=()=>{}}={}){Object.assign(this,{fetcher,changed,roomChanged,code:null,roomKey:null,channel:'table',open:false,generation:0,controllers:new Set(),viewer:null,enabled:true,pending:false,retry:null,messages:{lobby:[],table:[]},unread:{lobby:0,table:0},initial:{lobby:false,table:false},status:'',polling:false});}
  cancel(){this.generation++;for(const c of this.controllers)c.abort();this.controllers.clear();this.pending=false;this.polling=false;}
  reset(){this.messages={lobby:[],table:[]};this.unread={lobby:0,table:0};this.initial={lobby:false,table:false};this.retry=null;}
  room(snapshot){const key=snapshot?`${snapshot.code}:${snapshot.me}:${snapshot.media?.roomInstanceId||''}`:null;if(key===this.roomKey)return;this.cancel();this.roomKey=key;this.code=snapshot?.code||null;this.reset();this.status='';this.changed();}
  logout(){this.cancel();this.reset();this.code=null;this.roomKey=null;this.viewer=null;this.enabled=false;this.status='請登入並入座後使用彈幕';this.changed();}
  select(channel){if(channel!=='table'||!this.code)return;this.channel='table';this.retry=null;if(this.open)this.unread.table=0;this.changed();}
  show(open){this.open=open;if(open)this.unread.table=0;this.changed();}
  async request(channel,body){
   if(channel!=='table'||!this.code)return false;
   const generation=this.generation,code=this.code,c=new AbortController();this.controllers.add(c);const timeout=setTimeout(()=>c.abort(),10000);
   try{
    const response=await this.fetcher('/api/chat'+(body?'':`?channel=table&code=${encodeURIComponent(code)}`),{method:body?'POST':'GET',cache:'no-store',credentials:'same-origin',signal:c.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,channel:'table',code})}:{})});
    const data=await response.json();if(generation!==this.generation)return false;
    if(response.status===401){this.logout();return false;}
    if([403,404].includes(response.status)){this.room(null);this.status='本桌已結束，請重新入座';this.changed();return false;}
    if(!response.ok)throw Error(data.error||'聊天室暫時無法連線');
    if(data.channel!=='table'||data.code!==code)return false;
    if(this.viewer&&this.viewer!==data.viewerId){this.cancel();this.reset();this.code=null;this.roomKey=null;this.viewer=data.viewerId;this.status='登入身分已變更，請重新確認房間';this.changed();return false;}
    this.viewer=data.viewerId;const previous=new Set(this.messages.table.map(item=>item.id));
    if(this.initial.table&&!this.open)this.unread.table=Math.min(50,this.unread.table+data.messages.filter(item=>!previous.has(item.id)).length);
    this.messages.table=data.messages.slice(-50);this.initial.table=true;this.status='';this.changed();if(data.roomState)this.roomChanged(data.roomState);return true;
   }catch(error){if(generation===this.generation){this.status=error.name==='AbortError'?'連線逾時，稍後重試':error.message;this.changed();}return false;}
   finally{clearTimeout(timeout);this.controllers.delete(c);}
  }
  async poll(){if(!this.enabled||!this.code||this.polling||this.pending)return false;this.polling=true;const generation=this.generation;try{return await this.request('table');}finally{if(generation===this.generation)this.polling=false;}}
  async send(message){if(!this.enabled||!this.code||this.pending||typeof message!=='string'||!message.trim())return false;if([...message.trim()].length>160){this.status='彈幕最多160字';this.changed();return false;}if(this.polling)this.cancel();
   const generation=this.generation,key=`${this.code}:${message}`;if(this.retry?.key!==key)this.retry={key,id:root.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(16).slice(2)};this.pending=true;this.changed();
   try{const frame=root.BarrageFrames?.get().selected,ok=await this.request('table',{message,requestId:this.retry.id,...(frame?{builtinFrameId:frame}:{})});if(generation!==this.generation)return false;if(ok)this.retry=null;return ok;}
   finally{if(generation===this.generation){this.pending=false;this.changed();}}
  }
 }
 if(typeof module==='object'&&module.exports){module.exports={ChatClient};return;}
 let mountAttempts=0,queuedRoom=null,queuedLogout=false,queuedMount=null,queuedTools=[],queuedHeightPeer=null;
 root.SharedChat={mountIn:(host,options)=>{queuedMount={host,options};},mountTools:tools=>{queuedTools=tools;},matchRosterHeight:peer=>{queuedHeightPeer=peer;},updateRoom:s=>{queuedRoom=s;},clearRoom:()=>{queuedRoom=null;},logout:()=>{queuedRoom=null;queuedLogout=true;}};
 function mount(){
  if(location.pathname==='/'||new URLSearchParams(location.search).has('learn'))return;
  const host=queuedMount?.host||document.querySelector('.room-sidebar,.race-utility-panel,.race-controls,.action-panel,#controls');if(!host){if(mountAttempts++<50)setTimeout(mount,100);return;}
  const panel=document.createElement('section');panel.className='shared-chat';panel.setAttribute('aria-label','聊天室與房間彈幕');
  panel.innerHTML='<h2 class="chat-heading" hidden>聊天室</h2><button type="button" class="chat-toggle" aria-expanded="false" aria-controls="chat-content">聊天室 <span class="chat-badge"></span></button><div id="chat-content" hidden><ol class="chat-messages" aria-label="聊天訊息"></ol><form autocomplete="off"><label for="chat-input" class="ui-sr-only">房間彈幕</label><div class="chat-compose"><input id="chat-input" maxlength="320" required autocomplete="off"><button type="submit" aria-label="發送房間彈幕">發送</button></div></form><div class="chat-room-tools ui-control-row" aria-label="媒體與表情"></div><p class="chat-status" role="status" aria-live="polite"></p></div>';
  host.append(panel);const q=s=>panel.querySelector(s),list=q('.chat-messages'),input=q('input'),submit=q('[type=submit]');const content=q('#chat-content'),footer=document.createElement('footer');footer.className='chat-room-footer';footer.append(q('.chat-status'),q('.chat-room-tools'),q('form'));root.GameUI.framePanel(panel,{header:q('.chat-heading'),body:content,content:list,footer});root.GameUI?.decorateButton(submit,'send',{iconOnly:true,label:'發送房間彈幕'});
  let rendered='',lastContext='',timer=null,backoff=3000,paused=false,pollEpoch=0;
  const client=new ChatClient({changed:render,roomChanged:s=>{if(root.RoomHost?.acceptSnapshot?.(s))return;root.GameShell?.update(s);}});
  function render(){
   const context=`${client.viewer}:${client.code}`;if(context!==lastContext){input.value='';lastContext=context;rendered=null;}
   q('#chat-content').hidden=!client.open;q('.chat-toggle').setAttribute('aria-expanded',String(client.open));q('.chat-badge').textContent=client.unread.table?`未讀 ${client.unread.table}`:'';input.placeholder='輸入彈幕（最多160字）';
   input.disabled=submit.disabled=!client.enabled||!client.code||!client.viewer||client.pending;q('form').setAttribute('aria-busy',String(client.pending));q('.chat-status').textContent=client.pending?'傳送中…':client.status;
   const messages=client.messages.table,signature=messages.map(item=>item.id).join();if(signature===rendered)return;const atBottom=list.scrollHeight-list.scrollTop-list.clientHeight<40;rendered=signature;list.replaceChildren();
   for(const message of messages){const row=document.createElement('li'),name=document.createElement('b'),time=document.createElement('time'),text=document.createElement('p');name.textContent=message.name;time.textContent=new Date(message.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});text.textContent=message.message;row.append(name,time,text);list.append(row);}if(atBottom)list.scrollTop=list.scrollHeight;
  }
  async function tick(){const epoch=++pollEpoch;clearTimeout(timer);if(paused||document.hidden||!client.enabled||!client.code)return;const ok=await client.poll();if(epoch!==pollEpoch||paused||document.hidden||!client.enabled)return;backoff=ok?3000:Math.min(30000,backoff*2);timer=setTimeout(tick,backoff);}
  q('.chat-toggle').onclick=()=>{client.show(!client.open);if(client.open){list.scrollTop=list.scrollHeight;input.focus();}};
  input.addEventListener('input',event=>{if(!event.isComposing&&[...input.value].length>160)input.value=[...input.value].slice(0,160).join('');});
  q('form').onsubmit=async event=>{event.preventDefault();if(event.isComposing)return;const message=input.value;if(client.polling)client.cancel();const generation=client.generation;if(await client.send(message)&&generation===client.generation&&input.value===message)input.value='';};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);client.cancel();}else tick();});root.addEventListener('online',tick);root.addEventListener('pagehide',()=>{paused=true;clearTimeout(timer);client.cancel();client.reset();render();});root.addEventListener('pageshow',()=>{paused=false;tick();});root.addEventListener('storage',event=>{if(event.key==='ah-chat-logout'){clearTimeout(timer);client.logout();}});
  let inline=false,previousOpen=false;
  function mountIn(host,options={}){
   if(!host)return;if(panel.parentElement!==host)host.append(panel);const next=options.inline===true;if(next===inline)return;
   inline=next;panel.classList.toggle('chat-inline',inline);q('.chat-heading').hidden=!inline;q('.chat-toggle').hidden=inline;if(inline){previousOpen=client.open;client.show(true);}else client.show(previousOpen);
  }
  function mountTools(tools){for(const tool of tools||[])if(tool)q('.chat-room-tools').append(tool);}
  let heightPeer=null,heightHost=null,heightFrame=null,heightSettleFrame=null;
  function releaseHeight(){
   if(heightFrame!==null)cancelAnimationFrame(heightFrame);if(heightSettleFrame!==null)cancelAnimationFrame(heightSettleFrame);heightFrame=heightSettleFrame=null;
   heightPeer?.classList.remove('ui-chat-height-peer');heightPeer?.removeAttribute('data-chat-height-bound');heightPeer?.style.removeProperty('--ui-chat-fixed-height');heightHost?.style.removeProperty('--ui-chat-fixed-height');panel.removeAttribute('data-roster-height-bound');heightPeer=heightHost=null;
  }
  function measurePeerHeight(){
   if(!heightPeer?.isConnected||!heightHost?.isConnected)return;
   if(heightFrame!==null)cancelAnimationFrame(heightFrame);if(heightSettleFrame!==null)cancelAnimationFrame(heightSettleFrame);
   heightFrame=requestAnimationFrame(()=>{
    heightFrame=null;if(!heightPeer||!heightHost)return;
    heightPeer.style.removeProperty('--ui-chat-fixed-height');heightHost.style.removeProperty('--ui-chat-fixed-height');
    heightSettleFrame=requestAnimationFrame(()=>{
     heightSettleFrame=null;if(!heightPeer?.isConnected||!heightHost?.isConnected||!heightPeer.getClientRects().length)return;
     const minimum=parseFloat(getComputedStyle(panel).getPropertyValue('--ui-room-row-height'))||440;
     const css=getComputedStyle(heightHost),gap=parseFloat(css.gap)||0;
     const extras=[...heightHost.children].filter(n=>n!==panel&&getComputedStyle(n).position!=='absolute'&&n.getClientRects().length&&n.getBoundingClientRect().height>1);
     const extraHeight=extras.reduce((total,n)=>{const style=getComputedStyle(n);return total+n.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);},0)+extras.length*gap;
     const header=q('.chat-heading'),footer=q('.ui-panel-footer'),panelCss=getComputedStyle(panel);
     const frameHeight=(header?.getBoundingClientRect().height||0)+(footer?.getBoundingClientRect().height||0)+2*(parseFloat(panelCss.getPropertyValue('--ui-panel-gap'))||12)+112;
     const padding=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0)+(parseFloat(css.borderTopWidth)||0)+(parseFloat(css.borderBottomWidth)||0);
     const height=Math.ceil(Math.max(minimum,heightPeer.getBoundingClientRect().height,extraHeight+frameHeight+padding));
     heightPeer.style.setProperty('--ui-chat-fixed-height',height+'px');heightHost.style.setProperty('--ui-chat-fixed-height',height+'px');heightPeer.dataset.chatHeightBound='true';panel.dataset.rosterHeightBound='true';
    });
   });
  }
  function matchRosterHeight(peer){
   if(peer===heightPeer&&panel.parentElement===heightHost)return;
   releaseHeight();if(!peer)return;heightPeer=peer;heightHost=panel.parentElement;heightPeer.classList.add('ui-chat-height-peer');measurePeerHeight();
  }
  root.addEventListener('resize',measurePeerHeight);root.addEventListener('pagehide',releaseHeight);
  root.SharedChat={mountIn,mountTools,matchRosterHeight,updateRoom(snapshot){const old=client.roomKey;client.room(snapshot);if(old!==client.roomKey)tick();},clearRoom(){clearTimeout(timer);matchRosterHeight(null);client.room(null);},logout(){clearTimeout(timer);matchRosterHeight(null);client.logout();}};
  if(queuedRoom)client.room(queuedRoom);if(queuedMount)mountIn(queuedMount.host,queuedMount.options);mountTools(queuedTools);matchRosterHeight(queuedHeightPeer);if(queuedLogout)client.logout();render();tick();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof window==='object'?window:globalThis);
