/* Room YouTube intent travels only with explicit commands and the existing game snapshot.
   Closed viewers never fetch, and native player events never become room commands. */
(()=>{
 'use strict';
 const maxPosition=86400,snapshotAttempts=3,snapshotRetryDelays=[1000,4000],clock=()=>performance.now();
 const opener=document.createElement('button');opener.type='button';opener.className='table-watch-open';opener.hidden=true;opener.id='tableWatchOpen';
 opener.setAttribute('aria-haspopup','dialog');opener.setAttribute('aria-controls','tableWatch');
 window.GameUI?.decorateButton(opener,'video',{label:'YouTube 共看'});
 const dialog=document.createElement('dialog');dialog.id='tableWatch';dialog.className='ui-dialog table-watch-dialog';dialog.setAttribute('aria-labelledby','watchTitle');
 dialog.innerHTML=`<header id="watchWindowBar" class="table-watch-header" role="toolbar" aria-label="影片視窗工具列" aria-describedby="watchMoveHint" tabindex="0"><div><h2 id="watchTitle">YouTube 共看</h2><p id="watchController">尚未選片</p></div><div class="table-watch-window-tools"><button id="watchResetPosition" type="button">重設影片位置</button><button id="watchControlsToggle" type="button" aria-expanded="false" aria-controls="watchRoomControls">顯示全桌播放與選片</button><button id="watchClose" type="button">關閉自己的影片</button></div><span id="watchMoveHint" class="ui-sr-only">拖曳頂端工具列移動，方向鍵微調，Home 重設；位置只影響自己。</span></header>
 <p id="watchStatus" class="ui-status" role="status" aria-live="polite"></p>
 <div class="table-watch-body"><div class="table-watch-view">
 <section class="table-watch-screen" aria-label="本機 YouTube 播放器"><div id="watchConsent"><strong id="watchVideoLabel">這一桌還沒選影片</strong><p>自行加入才會連線到 YouTube。關閉只影響自己，其他人繼續觀看。</p><button id="watchJoin" type="button">加入觀看</button><p class="table-watch-privacy"><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google 隱私權政策 ↗</a></p></div><div id="watchPlayer" hidden></div></section>
 <div id="watchLocal" class="table-watch-local" hidden><button id="watchRejoin" type="button">返回全桌進度</button><button id="watchLocalPlay" type="button" hidden>在這裡開始播放</button><button id="watchExit" type="button">關閉自己的影片</button><p>影片內的播放、暫停與拖曳只影響自己。</p><div class="table-watch-volume"><button id="watchSound" type="button" aria-pressed="false">開啟影片聲音</button><label for="watchVolume">音量</label><input id="watchVolume" type="range" min="0" max="100" step="1" value="30"><span id="watchVolumeValue">30%</span></div></div>
 </div><div id="watchRoomControls" class="table-watch-controls"><section id="watchTransport" class="table-watch-transport" aria-label="全桌播放控制" hidden><div class="table-watch-control-heading"><strong>全桌進度</strong><output id="watchClock">0:00</output></div><div class="table-watch-buttons"><button id="watchPlay" type="button">全桌播放</button><button id="watchPause" type="button">全桌暫停</button><button id="watchReplay" type="button">從頭共看</button><button id="watchStop" type="button">停止共看</button></div><form id="watchSeekForm" class="table-watch-seek"><label for="watchSeek">跳至秒數</label><input id="watchSeek" type="number" min="0" max="86400" step="1" value="0" inputmode="numeric" required><button id="watchSeekSubmit" type="submit">全桌跳轉</button></form><p id="watchPermission"></p><button id="watchTakeover" type="button" hidden>房主接管控制</button></section>
 <form id="watchPropose" class="table-watch-propose"><label for="watchUrl">提議 YouTube 影片</label><div><input id="watchUrl" type="url" inputmode="url" maxlength="2048" placeholder="貼上 YouTube 網址" autocomplete="off" required><button id="watchProposeSubmit" type="submit">送出影片</button></div><p>第一部直接選用；之後由控制者或房主選用。選用後由提案者控制。</p></form>
 <section id="watchProposalsSection" hidden><h3>朋友提議的影片</h3><ul id="watchProposals"></ul></section>
 </div></div>`;
 document.body.append(dialog);
 const q=selector=>dialog.querySelector(selector),status=message=>window.GameUI?.setStatus(q('#watchStatus'),message)||(!window.GameUI&&(q('#watchStatus').textContent=message));
 for(const [id,icon,label] of [['#watchClose','close','關閉自己的影片'],['#watchPlay','play','全桌播放'],['#watchPause','pause','全桌暫停'],['#watchReplay','replay','從頭共看'],['#watchStop','ban','停止共看'],['#watchRejoin','refresh','返回全桌進度'],['#watchExit','close','關閉自己的影片']])window.GameUI?.decorateButton(q(id),icon,{iconOnly:id==='#watchClose',label});
 for(const [id,icon,label] of [['#watchResetPosition','refresh','重設影片位置'],['#watchControlsToggle','settings','顯示全桌播放與選片']])window.GameUI?.decorateButton(q(id),icon,{iconOnly:true,label});
 let room=null,snapshot=null,generation=0,viewGeneration=0,playerGeneration=0,requestSequence=0,acceptedSequence=0;
 let marker=null,pendingMarker=null,snapshotRetry=null,fetching=null,submitting=false,pendingRetry=null,interval=null,apiPromise=null,apiScript=null,apiTimer=null,apiCancel=null;
 let joined=false,player=null,ready=false,playerVideo=null,unlisten=null,releaseMusic=null,intersection=null,resize=null,observedAt=0,serverAt=0,appliedPlayback=null,localEnded=false;
 const requests=new Set();
 const positionKey='bga.watch.window.v1';let windowPosition=null,preferredPosition=null,drag=null,controlsOpen=false;
 try{const saved=JSON.parse(localStorage.getItem(positionKey));if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))preferredPosition={left:saved.left,top:saved.top};}catch{}
 function placeWindow(next=preferredPosition){if(!dialog.open)return;const box=dialog.getBoundingClientRect(),width=window.innerWidth,height=window.innerHeight;const maxLeft=Math.max(8,width-box.width-8),maxTop=Math.max(8,height-box.height-8);windowPosition={left:Math.max(8,Math.min(maxLeft,next?.left??maxLeft)),top:Math.max(8,Math.min(maxTop,next?.top??maxTop))};dialog.style.left=windowPosition.left+'px';dialog.style.top=windowPosition.top+'px';}
 function saveWindow(){preferredPosition={...windowPosition};try{localStorage.setItem(positionKey,JSON.stringify(preferredPosition));}catch{}}
 function resetWindow(){windowPosition=null;preferredPosition=null;placeWindow();saveWindow();}
 const windowBar=q('#watchWindowBar');
 function isWindowControl(target){for(let node=target;node&&node!==windowBar;node=node.parentElement||node.parentNode)if(['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(node.tagName))return true;return false;}
 windowBar.onpointerdown=event=>{if(event.button!==0||isWindowControl(event.target))return;event.preventDefault();placeWindow();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:windowPosition.left,top:windowPosition.top};windowBar.setPointerCapture?.(event.pointerId);};
 windowBar.onpointermove=event=>{if(!drag||event.pointerId!==drag.id)return;placeWindow({left:drag.left+event.clientX-drag.x,top:drag.top+event.clientY-drag.y});};
 function finishDrag(event){if(!drag||event.pointerId!==drag.id)return;windowBar.releasePointerCapture?.(drag.id);drag=null;saveWindow();}
 windowBar.onpointerup=finishDrag;windowBar.onpointercancel=finishDrag;
 windowBar.onkeydown=event=>{if(isWindowControl(event.target))return;const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(event.key==='Home'){event.preventDefault();resetWindow();return;}if(!direction)return;event.preventDefault();placeWindow();const step=event.shiftKey?50:20;placeWindow({left:windowPosition.left+direction[0]*step,top:windowPosition.top+direction[1]*step});saveWindow();};
 q('#watchResetPosition').onclick=resetWindow;q('#watchControlsToggle').onclick=()=>{controlsOpen=!controlsOpen;render();};window.addEventListener('resize',()=>placeWindow());
 function format(seconds){const n=Math.floor(Math.max(0,Number(seconds)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
 function position(){if(!snapshot)return 0;const p=snapshot.playback;return Math.max(0,Math.min(maxPosition,p.anchorPositionSec+(p.state==='playing'?Math.max(0,serverAt+clock()-observedAt-p.anchorServerMs)/1000:0)));}
 function signature(s){return s?JSON.stringify([s.roomInstanceId,s.watchSessionId,s.video?.id,s.playback.state,s.playback.anchorPositionSec,s.playback.anchorServerMs]):null;}
 function markerKey(m){return m?m.roomInstanceId+':'+m.revision:null;}
 function requestId(){
  const random=globalThis.crypto;if(typeof random?.randomUUID==='function')return random.randomUUID();
  if(typeof random?.getRandomValues!=='function')throw Error('此瀏覽器無法安全建立操作識別碼，請改用支援安全亂數的瀏覽器。');
  const bytes=random.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
 }
 function label(){const hasVideo=marker?marker.hasVideo:!!snapshot?.video,name=marker?marker.controllerName:snapshot?.controllerName;opener.classList.toggle('has-video',!!hasVideo);opener.title=hasVideo?'YouTube 共看 · '+(name||'朋友')+' 控制':'YouTube 共看';opener.setAttribute('aria-label',opener.title);}
 function localPlayPrompt(){return snapshot?.isHost?'請按「在這裡開始播放」。':'請直接按 YouTube 播放器裡的播放按鈕。';}
 function render(){
  label();if(!dialog.open)return;
  const video=!!snapshot?.video,can=!!snapshot?.canControl,host=!!snapshot?.isHost;
  const compact=joined&&!controlsOpen;dialog.classList.toggle('watch-compact',compact);q('#watchRoomControls').hidden=compact;q('#watchControlsToggle').disabled=!joined;q('#watchControlsToggle').setAttribute('aria-expanded',String(!compact));q('#watchControlsToggle').setAttribute('aria-label',compact?'顯示全桌播放與選片':'收合全桌播放與選片');q('#watchControlsToggle').title=compact?'顯示全桌播放與選片':'收合全桌播放與選片';
  q('#watchController').textContent=video?'控制者：'+(snapshot.controllerName||'等待房主'):'尚未選片';
  q('#watchVideoLabel').textContent=video?'已選影片 · '+snapshot.video.id:'這一桌還沒選影片';
  q('#watchJoin').disabled=!video||!!fetching||submitting;q('#watchJoin').textContent=video?'加入觀看':'先提議影片';
  q('#watchConsent').hidden=joined;q('#watchPlayer').hidden=!joined;q('#watchLocal').hidden=!joined;q('#watchTransport').hidden=!video;
  q('#watchLocalPlay').hidden=!host;
  q('#watchClock').textContent=format(position())+' · '+(snapshot?.playback.state==='playing'?'播放中':'已暫停');
  for(const id of ['#watchPlay','#watchPause','#watchReplay','#watchSeek','#watchSeekSubmit'])q(id).disabled=!can||submitting||!snapshot;
  q('#watchPlay').disabled||=snapshot?.playback.state==='playing';q('#watchPause').disabled||=snapshot?.playback.state==='paused';
  q('#watchStop').disabled=(!can&&!host)||submitting;q('#watchTakeover').hidden=!host||can;q('#watchTakeover').disabled=submitting;
  q('#watchPermission').textContent=can?'你可以控制全桌播放。':'全桌播放由控制者操作；自己的影片可隨時關閉。';
  q('#watchProposeSubmit').disabled=submitting||!snapshot;q('#watchUrl').disabled=submitting;
  q('#watchProposalsSection').hidden=!snapshot?.proposals?.length;
  const list=q('#watchProposals'),key=JSON.stringify([snapshot?.proposals,can,host,submitting]);
  if(list.dataset.content!==key){list.dataset.content=key;list.replaceChildren();for(const proposal of snapshot?.proposals||[]){const item=document.createElement('li'),text=document.createElement('span'),select=document.createElement('button');text.textContent=proposal.proposerName+' · '+proposal.videoId;select.type='button';select.textContent='選用';select.disabled=(!can&&!host)||submitting;select.setAttribute('aria-label','選用 '+proposal.proposerName+' 提議的影片');select.onclick=()=>command('select',{proposalId:proposal.id});item.append(text,select);list.append(item);}}placeWindow();
 }
 function volume(settings=window.AudioSettings?.get?.()){
  if(!settings)return;const {enabled,value}= {enabled:settings.music.enabled,value:settings.music.volume};
  q('#watchVolume').value=Math.round(value*100);q('#watchVolumeValue').textContent=Math.round(value*100)+'%';q('#watchSound').textContent=enabled?'關閉影片聲音':'開啟影片聲音';q('#watchSound').setAttribute('aria-pressed',String(enabled));
  if(ready&&player){try{player.setVolume(value*100);if(enabled)player.unMute();else player.mute();}catch{}}
 }
 function clearApiWait(){if(apiTimer!==null)clearTimeout(apiTimer);apiTimer=null;}
 function youtubeApi(){
  if(window.YT?.Player)return Promise.resolve(window.YT);if(apiPromise)return apiPromise;
  apiPromise=new Promise((resolve,reject)=>{const previous=window.onYouTubeIframeAPIReady;let complete=false;const finish=()=>{clearApiWait();apiCancel=null;if(window.onYouTubeIframeAPIReady===done)window.onYouTubeIframeAPIReady=previous;};const done=()=>{if(complete)return;if(!window.YT?.Player){fail();return;}complete=true;finish();try{previous?.();}catch{}resolve(window.YT);};const fail=()=>{if(complete)return;complete=true;finish();apiScript?.remove();apiScript=null;apiPromise=null;reject(Error('YouTube 播放器未能載入，請再試一次。'));};apiCancel=fail;
   window.onYouTubeIframeAPIReady=done;apiScript=document.createElement('script');apiScript.src='https://www.youtube.com/iframe_api';apiScript.referrerPolicy='strict-origin-when-cross-origin';apiScript.onerror=fail;apiTimer=setTimeout(fail,20000);document.head.append(apiScript);
  });return apiPromise;
 }
 function destroyPlayer(){
  playerGeneration++;ready=false;playerVideo=null;appliedPlayback=null;localEnded=false;
  intersection?.disconnect();intersection=null;resize?.disconnect();resize=null;
  try{player?.pauseVideo();player?.destroy();}catch{}player=null;q('#watchPlayer').replaceChildren();
  unlisten?.();unlisten=null;releaseMusic?.();releaseMusic=null;
 }
 function exitLocal(message='自己的影片已關閉，其他人繼續觀看。'){joined=false;destroyPlayer();apiCancel?.();render();if(dialog.open&&message)status(message);}
 function isVisibleEnough(){const box=q('#watchPlayer').getBoundingClientRect();return box.width>=200&&box.height>=200&&Math.max(0,Math.min(box.bottom,window.innerHeight)-Math.max(box.top,0))>=box.height/2;}
 function applyPlayback(force=false){
  if(!joined||!ready||!player||!snapshot?.video||document.hidden)return;const key=signature(snapshot);if(!force&&appliedPlayback===key)return;appliedPlayback=key;localEnded=false;
  if(!isVisibleEnough()){exitLocal('播放器目前不可完整觀看；捲回播放器後再按加入觀看。');return;}
  try{if(snapshot.playback.state==='paused'){player.cueVideoById({videoId:snapshot.video.id,startSeconds:position()});player.pauseVideo();}else{player.seekTo(position(),true);player.playVideo();}status(snapshot.playback.state==='playing'?'已對齊全桌進度；若沒有播放，'+localPlayPrompt():'全桌已暫停。');}catch{status('影片尚未準備好，請按「返回全桌進度」重試。');}
 }
 async function mountPlayer(){
  destroyPlayer();if(!joined||!dialog.open||!snapshot?.video)return;
  const token=playerGeneration,view=viewGeneration,video=snapshot.video.id;playerVideo=video;
  releaseMusic=window.TableMusic?.suspendLocal?.('youtube-watch')||null;unlisten=window.AudioSettings?.subscribe?.(volume)||null;
  status('載入自己的 YouTube 播放器…');
  try{const yt=await youtubeApi();if(token!==playerGeneration||view!==viewGeneration||!joined||!dialog.open||document.hidden)return;
   if(!isVisibleEnough()){exitLocal('播放器至少需要 200 × 200 的可見空間，請放大視窗後再加入。');return;}
   const iframe=document.createElement('iframe');iframe.title='YouTube 共看影片';iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin');iframe.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');iframe.setAttribute('allowfullscreen','');iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(video)+'?enablejsapi=1&controls=1&playsinline=1&origin='+encodeURIComponent(location.origin);q('#watchPlayer').replaceChildren(iframe);
   const valid=()=>token===playerGeneration&&view===viewGeneration&&joined&&dialog.open&&!document.hidden;
   player=new yt.Player(iframe,{events:{onReady:()=>{if(!valid())return;ready=true;volume();applyPlayback(true);},onStateChange:event=>{if(!valid())return;if(event.data===0){localEnded=true;status('此端已播放完畢，可等控制者換片，或自行返回全桌進度。');}else if(event.data===3)status('此端正在緩衝；不會改變其他人的播放。');else if(event.data===1)status('自己的影片正在播放；影片內的操作只影響自己。');else if(event.data===2)status('自己的影片已暫停；可返回全桌進度。');},onAutoplayBlocked:()=>{if(valid())status('瀏覽器需要你允許播放，'+localPlayPrompt());},onError:event=>{if(!valid())return;const messages={2:'這部影片的網址或識別碼無效。',5:'此瀏覽器無法播放這部影片。',100:'這部影片不存在、已移除或設為私人。',101:'這部影片不允許嵌入觀看。',150:'這部影片不允許嵌入觀看。',153:'YouTube 未能確認網站來源，請重新整理後重試。'};status((messages[event.data]||'這部影片目前無法嵌入播放。')+' 可改選其他影片；其他人的播放不受影響。');}}});
   if(typeof IntersectionObserver==='function'){intersection=new IntersectionObserver(entries=>{if(valid()&&entries.some(entry=>entry.intersectionRatio<.5))exitLocal('影片已離開可見範圍；需要時再加入觀看。');},{threshold:[.5]});intersection.observe(iframe);}
   if(typeof ResizeObserver==='function'){resize=new ResizeObserver(()=>{if(valid()&&!isVisibleEnough())exitLocal('播放器空間不足；放大視窗後再加入觀看。');});resize.observe(q('#watchPlayer'));}
  }catch(error){if(token===playerGeneration&&view===viewGeneration&&dialog.open){exitLocal('');status(error.message);}}
 }
 function receive(next,{sent,sequence,roomGeneration,view}={}){
  if(roomGeneration!==generation||view!==viewGeneration||!dialog.open||!next||typeof next.revision!=='number')return false;
  if(snapshot&&next.roomInstanceId===snapshot.roomInstanceId&&(next.revision<snapshot.revision||(next.revision===snapshot.revision&&sequence<acceptedSequence)))return false;
  if(marker&&next.roomInstanceId!==marker.roomInstanceId)return false;
  const oldVideo=snapshot?.video?.id,oldSession=snapshot?.watchSessionId;snapshot=next;acceptedSequence=sequence;observedAt=clock();serverAt=next.serverNowMs+Math.max(0,observedAt-sent)/2;
  if(!marker||next.revision>=marker.revision)marker={roomInstanceId:next.roomInstanceId,revision:next.revision,hasVideo:!!next.video,controllerId:next.controllerId,controllerName:next.controllerName};
  if(joined){if(!next.video)exitLocal('全桌共看已結束。');else if(oldVideo!==next.video.id||oldSession!==next.watchSessionId)mountPlayer();else applyPlayback();}render();return true;
 }
 async function requestSnapshot({force=false}={}){
  if(!room||!dialog.open)return false;if(fetching&&!force)return fetching.promise;
  const key=markerKey(marker);
  // Only existing game updates retry failures: one initial attempt plus two bounded retries.
  // Explicit open/join/rejoin starts a fresh budget; there is no watch network timer.
  if(!force&&snapshotRetry?.key===key&&(snapshotRetry.attempts>=snapshotAttempts||clock()<snapshotRetry.notBefore))return false;
  if(force||snapshotRetry?.key!==key)snapshotRetry={key,attempts:0,notBefore:0};
  const retry=snapshotRetry;retry.attempts++;
  const tag={roomGeneration:generation,view:viewGeneration,sequence:++requestSequence,sent:clock()},controller=new AbortController();requests.add(controller);
  const task={key,instance:marker?.roomInstanceId,revision:marker?.revision,promise:null};fetching=task;render();
  task.promise=(async()=>{
   let accepted=false;
   try{
    const response=await fetch('/api/room-watch?code='+encodeURIComponent(room.code),{signal:controller.signal,cache:'no-store'});
    const terminal=response.status>=400&&response.status<500&&![408,429].includes(response.status);let body;
    try{body=await response.json();}catch(error){error.terminal=terminal;throw error;}
    if(!response.ok){const error=Error(body.error||'共看狀態暫時無法載入。');error.terminal=terminal;throw error;}
    if(task.instance&&(body.roomInstanceId!==task.instance||body.revision<task.revision))throw Error('共看狀態尚未更新，請稍後再試。');
    accepted=receive(body,tag);
    if(accepted&&!joined)status(body.video?'可自行加入觀看；關閉只影響自己。':'貼上 YouTube 網址，邀朋友一起看。');
    return accepted;
   }catch(error){
    if(error.name!=='AbortError'&&fetching===task&&tag.roomGeneration===generation&&tag.view===viewGeneration&&dialog.open){
     if(error.terminal)retry.attempts=snapshotAttempts;
     status(error.message+(retry.attempts>=snapshotAttempts?' 可關閉後重開，或按「返回全桌進度」再試。':''));
    }
    return false;
   }finally{
    requests.delete(controller);
    if(fetching===task){
     fetching=null;
     if(snapshotRetry===retry){if(accepted)snapshotRetry=null;else retry.notBefore=clock()+(snapshotRetryDelays[retry.attempts-1]??Infinity);}
     render();const next=pendingMarker;pendingMarker=null;
     if(dialog.open&&markerKey(marker)!==markerKey(snapshot)&&next&&next!==markerKey(snapshot)&&next!==task.key)requestSnapshot();
    }
   }
  })();return task.promise;
 }
 async function command(action,extra={}){
  if(!room||!snapshot||submitting||!dialog.open)return false;
  // An uncertain network outcome can be retried by the same explicit gesture without reapplying it.
  const shape=JSON.stringify([action,extra]);let body;
  try{body=pendingRetry?.shape===shape&&pendingRetry.body.roomInstanceId===snapshot.roomInstanceId?pendingRetry.body:{code:room.code,roomInstanceId:snapshot.roomInstanceId,watchSessionId:snapshot.watchSessionId,requestId:requestId(),expectedRevision:snapshot.revision,controllerEpoch:snapshot.controllerEpoch,action,...extra};}catch(error){status(error.message||'無法建立操作識別碼，請稍後再試。');return false;}
  const tag={roomGeneration:generation,view:viewGeneration,sequence:++requestSequence,sent:clock()},controller=new AbortController();requests.add(controller);submitting=true;status('送出全桌操作…');render();
  try{const response=await fetch('/api/room-watch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal}),result=await response.json();
   if(tag.roomGeneration!==generation||tag.view!==viewGeneration||!dialog.open)return false;
   if(!response.ok){pendingRetry=null;if(result.state)receive(result.state,tag);status(result.error||'操作未成功，請確認最新狀態後重試。');return false;}
   pendingRetry=null;receive(result,tag);status(action==='propose'?'影片已送出。':action==='seek'?'全桌已跳轉至 '+format(extra.positionSec)+'。':'全桌狀態已更新。');if(action==='propose')q('#watchUrl').value='';return true;
  }catch(error){if(tag.roomGeneration===generation&&tag.view===viewGeneration&&dialog.open&&error.name!=='AbortError'){pendingRetry={shape,body};status('未收到操作結果；再按同一操作可安全重試，或關閉後重開查看最新狀態。');}return false;
  }finally{requests.delete(controller);if(tag.roomGeneration===generation&&tag.view===viewGeneration){submitting=false;render();}}
 }
 async function open(){if(!room||window.RaceLesson||dialog.open)return;window.TableMusic?.collapseLocal?.();const view=++viewGeneration;snapshot=null;acceptedSequence=0;pendingRetry=null;snapshotRetry=null;controlsOpen=false;status('載入這一桌的共看狀態…');dialog.show();if(interval===null)interval=setInterval(()=>{if(dialog.open&&snapshot)q('#watchClock').textContent=format(position())+' · '+(snapshot.playback.state==='playing'?'播放中':'已暫停');},1000);volume();render();await requestSnapshot();if(dialog.open&&view===viewGeneration)q('#watchClose').focus();}
 function cleanup(){viewGeneration++;joined=false;if(drag){windowBar.releasePointerCapture?.(drag.id);drag=null;}destroyPlayer();for(const controller of requests)controller.abort();requests.clear();fetching=null;pendingMarker=null;snapshotRetry=null;submitting=false;pendingRetry=null;if(interval!==null)clearInterval(interval);interval=null;apiCancel?.();render();}
 function close(){cleanup();if(dialog.open){dialog.close();document.getElementById('music-expand')?.focus();}}
 opener.onclick=open;q('#watchClose').onclick=close;dialog.addEventListener('close',cleanup);dialog.addEventListener('cancel',()=>{joined=false;destroyPlayer();});
 q('#watchJoin').onclick=async()=>{if(!snapshot?.video)return;const view=viewGeneration;if(!await requestSnapshot({force:true})||view!==viewGeneration||!dialog.open||!snapshot?.video)return;joined=true;render();mountPlayer();};
 q('#watchRejoin').onclick=async()=>{const view=viewGeneration;if(await requestSnapshot({force:true})&&view===viewGeneration)applyPlayback(true);};
 q('#watchLocalPlay').onclick=()=>{if(!snapshot?.isHost||!joined||!ready||!player)return;try{localEnded=false;player.playVideo();status('這裡已允許播放；原生控制只影響自己。');}catch{status('請直接按 YouTube 播放器裡的播放按鈕。');}};
 q('#watchExit').onclick=()=>exitLocal();q('#watchSound').onclick=()=>{const settings=window.AudioSettings?.get();if(settings)window.AudioSettings.set('music',{enabled:!settings.music.enabled},{gesture:true});};
 q('#watchVolume').oninput=()=>window.AudioSettings?.set('music',{volume:Number(q('#watchVolume').value)/100},{gesture:true});
 for(const [id,action] of [['#watchPlay','play'],['#watchPause','pause'],['#watchReplay','replay'],['#watchStop','stop'],['#watchTakeover','takeover']])q(id).onclick=()=>command(action);
 q('#watchSeekForm').onsubmit=event=>{event.preventDefault();const value=Number(q('#watchSeek').value);if(q('#watchSeek').value.trim()===''||!Number.isFinite(value)||value<0||value>maxPosition){status('請輸入 0 到 86400 的秒數。');return;}command('seek',{positionSec:value});};
 q('#watchPropose').onsubmit=event=>{event.preventDefault();const url=q('#watchUrl').value.trim();if(url)command('propose',{url});};
 function update(next){
  if(window.RaceLesson){opener.hidden=true;close();return;}if(!next?.code){stop();return;}
  if(room?.code!==next.code||room?.me!==next.me){close();generation++;room=next;snapshot=null;marker=next.watch||null;acceptedSequence=0;}else{room=next;const incoming=next.watch||null;if(incoming&&(!marker||incoming.roomInstanceId!==marker.roomInstanceId||incoming.revision>=marker.revision)){if(marker&&incoming.roomInstanceId!==marker.roomInstanceId){close();generation++;snapshot=null;}marker=incoming;}}
  opener.hidden=false;label();if(dialog.open&&(!snapshot||markerKey(marker)!==markerKey(snapshot))){if(fetching)pendingMarker=markerKey(marker);else requestSnapshot();}
 }
 function stop(){close();generation++;room=null;snapshot=null;marker=null;opener.hidden=true;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)close();});window.addEventListener('pagehide',close);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open&&!document.querySelector('dialog:modal')){event.preventDefault();close();}});
 if(typeof MutationObserver==='function')new MutationObserver(records=>{if(dialog.open&&records.some(record=>record.target!==dialog&&record.target.tagName==='DIALOG'&&record.target.open))close();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
 window.TableWatch={mount(target){target.append(opener);},update,stop,disconnected:close,closeForDialog(other){if(other!==dialog&&dialog.open)close();}};
})();
