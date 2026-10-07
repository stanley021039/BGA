const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {randomUUID,webcrypto}=require('node:crypto');
const script=fs.readFileSync(path.join(__dirname,'../../public/shared/table-watch.js'),'utf8');

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const json=(body,{ok=true,status=200}={})=>({ok,status,json:async()=>structuredClone(body)});

// Exercise the real browser module without loading YouTube or using a browser service.
// The DOM supports the actual controls, events, dialog lifecycle and iframe ownership.
function watchHarness({youtube=true,fetchHandler,savedPosition,savedSize,measurements,storageFailure=false,crypto:randomSource={randomUUID,getRandomValues:bytes=>webcrypto.getRandomValues(bytes)}}={}){
 const ids=new Map(),timers=new Map(),frames=new Map(),network=[],players=[],thirdParty=[],observers=[],storage=new Map();
 if(savedPosition!==undefined)storage.set('bga.watch.window.v1',savedPosition);
 if(savedSize!==undefined)storage.set('bga.watch.size.v1',savedSize);
 const music={suspended:0,released:0,active:0,collapsed:0},audio={subscriptions:0,unsubscriptions:0,active:0,changes:[]};
 let now=0,nextTimer=1,nextFrame=1,settings={music:{enabled:false,volume:.3},effects:{enabled:false,volume:.25}},context;
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attributes=new Map();this.handlers=new Map();this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.value='';this.textContent='';this._html='';this.capturedPointers=new Set();this.style={setProperty(name,value){this[name]=String(value);},getPropertyValue(name){return this[name]||'';},removeProperty(name){const prior=this[name]||'';delete this[name];return prior;}};const classes=new Set();this.classList={toggle(name,force){if(force===undefined)force=!classes.has(name);if(force)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)};this.rect={x:30,y:60,width:600,height:340,top:60,left:30,right:630,bottom:400};}
  set id(value){this._id=value;ids.set(value,this);if(measurements?.[value])this.rect={...this.rect,...measurements[value]};}get id(){return this._id||'';}
  set innerHTML(value){this._html=value;this.replaceChildren();for(const match of value.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)){const node=new Node(match[1]);node.id=match[3];for(const attribute of match[2].matchAll(/\b([a-z][\w:-]*)="([^"]*)"/gi))node.setAttribute(attribute[1],attribute[2]);node.hidden=/\bhidden\b/.test(match[2]);const val=match[2].match(/\bvalue="([^"]*)"/);if(val)node.value=val[1];this.append(node);}}
  get innerHTML(){return this._html;}
  append(...nodes){for(const node of nodes){if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node);if(node.tagName==='SCRIPT'&&/^https:/.test(node.src||''))thirdParty.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
  get parentElement(){return this.parentNode;}
  setAttribute(name,value){this.attributes.set(name,String(value));if(name==='id')this.id=String(value);}
  getAttribute(name){return this.attributes.get(name)??null;}
  querySelector(selector){return selector.startsWith('#')?ids.get(selector.slice(1))||null:null;}
  addEventListener(type,callback){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(callback);}
  dispatch(type,event={}){for(const callback of this.handlers.get(type)||[])callback(event);}
  getBoundingClientRect(){const pixel=(value,fallback)=>typeof value==='string'&&/^-?\d+(?:\.\d+)?px$/.test(value)?parseFloat(value):fallback;const left=pixel(this.style.left,this.rect.left??this.rect.x??30),top=pixel(this.style.top,this.rect.top??this.rect.y??60),width=pixel(this.style.width,this.rect.width),height=pixel(this.style.height,this.rect.height);return {...this.rect,x:left,y:top,left,top,width,height,right:left+width,bottom:top+height};}
  setPointerCapture(id){this.capturedPointers.add(id);}
  releasePointerCapture(id){this.capturedPointers.delete(id);}
  hasPointerCapture(id){return this.capturedPointers.has(id);}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;this.modal=true;}
  show(){this.open=true;this.modal=false;}
  close(){if(!this.open)return;this.open=false;this.dispatch('close');}
  cancel(){let prevented=false;this.dispatch('cancel',{preventDefault(){prevented=true;}});if(!prevented)this.close();}
  click(){if(this.disabled)return false;return this.onclick?.({target:this,preventDefault(){}});}
  submit(){return this.onsubmit?.({target:this,preventDefault(){}});}
 }
 const document={body:new Node('body'),head:new Node('head'),hidden:false,activeElement:null,handlers:new Map(),createElement:tag=>new Node(tag),getElementById:id=>ids.get(id)||null,querySelector(selector){return selector==='dialog:modal'?[...ids.values()].find(node=>node.tagName==='DIALOG'&&node.open&&node.modal)||null:null;},addEventListener(type,callback){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(callback);},dispatch(type,event={}){for(const callback of this.handlers.get(type)||[])callback(event);}};
 const musicExpand=new Node('button');musicExpand.id='music-expand';document.body.append(musicExpand);
 const window={innerHeight:720,innerWidth:1280,handlers:new Map(),addEventListener(type,callback){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(callback);},dispatch(type,event={}){for(const callback of this.handlers.get(type)||[])callback(event);}};
 window.requestAnimationFrame=callback=>{const id=nextFrame++;frames.set(id,callback);return id;};
 window.cancelAnimationFrame=id=>frames.delete(id);
 // Opt-in chrome geometry exercises measurement-dependent budgets. It does not
 // pretend to calculate CSS layout, and leaves all pre-existing fixtures intact.
 if(measurements)window.getComputedStyle=()=>({});
 window.GameUI={decorateButton(node,_icon,{label}){node.setAttribute('aria-label',label);},setStatus(node,message){node.textContent=message;return true;},openDialog(dialog){dialog.showModal();}};
 window.TableMusic={collapseLocal(){music.collapsed++;},suspendLocal(){music.suspended++;music.active++;let done=false;return ()=>{if(done)return;done=true;music.released++;music.active--;};}};
 const audioListeners=new Set();
 window.AudioSettings={get:()=>structuredClone(settings),subscribe(callback){audio.subscriptions++;audio.active++;audioListeners.add(callback);callback(structuredClone(settings));let done=false;return ()=>{if(done)return;done=true;audio.unsubscriptions++;audio.active--;audioListeners.delete(callback);};},set(kind,patch,options){audio.changes.push({kind,patch,options});settings[kind]={...settings[kind],...patch};for(const callback of audioListeners)callback(structuredClone(settings));}};
 const makePlayer=()=>class Player{
  constructor(iframe,{events}){this.iframe=iframe;this.events=events;this.calls=[];this.destroyed=false;this.playbackState=-1;players.push(this);}
  pauseVideo(){this.calls.push(['pause']);this.state(2);}
  playVideo(){this.calls.push(['play']);this.state(1);}
  // A seek may start an unstarted YouTube player: the final transport call must win.
  seekTo(position,allow){this.calls.push(['seek',position,allow]);this.state(1);}
  cueVideoById({videoId,startSeconds}){this.calls.push(['cue',{videoId,startSeconds}]);this.state(5);}
  getPlayerState(){return this.playbackState;}
  setVolume(value){this.calls.push(['volume',value]);}
  mute(){this.calls.push(['mute']);}
  unMute(){this.calls.push(['unmute']);}
  destroy(){this.calls.push(['destroy']);this.destroyed=true;this.iframe.remove();}
  ready(){this.events.onReady?.();}
  state(value){this.playbackState=value;this.events.onStateChange?.({data:value});}
  error(value){this.events.onError?.({data:value});}
  blocked(){this.events.onAutoplayBlocked?.();}
 };
 if(youtube)window.YT={Player:makePlayer()};
 class Observer{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}emit(records){this.callback(records);}}
 const schedule=(callback,delay,repeat)=>{const id=nextTimer++;timers.set(id,{callback,due:now+delay,repeat});return id;};
 const fetch=async(route,options={})=>{const request={route,options,body:options.body?JSON.parse(options.body):null};network.push(request);return fetchHandler?fetchHandler(request):json(watchSnapshot());};
 context=vm.createContext({window,document,localStorage:{getItem(key){if(storageFailure)throw Error('Storage unavailable');return storage.get(key)??null;},setItem(key,value){if(storageFailure)throw Error('Storage unavailable');storage.set(key,String(value));},removeItem(key){if(storageFailure)throw Error('Storage unavailable');return storage.delete(key);}},location:{origin:'http://localhost:3000'},performance:{now:()=>now},crypto:randomSource,AbortController,fetch,IntersectionObserver:Observer,ResizeObserver:Observer,MutationObserver:Observer,requestAnimationFrame:window.requestAnimationFrame,cancelAnimationFrame:window.cancelAnimationFrame,setTimeout:(callback,delay)=>schedule(callback,delay,0),clearTimeout:id=>timers.delete(id),setInterval:(callback,delay)=>schedule(callback,delay,delay),clearInterval:id=>timers.delete(id)});
 vm.runInContext(script,context,{filename:'public/shared/table-watch.js'});
 const node=id=>{const result=ids.get(id.replace(/^#/,''));if(!result)throw Error('Unknown control '+id);return result;};
 async function advance(ms){const end=now+ms;for(;;){const pending=[...timers].filter(([,task])=>task.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!pending)break;const [id,task]=pending;now=task.due;if(task.repeat)task.due+=task.repeat;else timers.delete(id);task.callback();await flush();}now=end;await flush();}
 async function flushFrames(){const pending=[...frames];frames.clear();for(const [,callback] of pending)callback(now);await flush();}
 return {context,window,document,node,network,players,thirdParty,observers,timers,frames,storage,music,audio,advance,flush,flushFrames,now:()=>now,update:state=>window.TableWatch.update(state),close:()=>window.TableWatch.closeForDialog(new Node('dialog')),installYT(){window.YT={Player:makePlayer()};window.onYouTubeIframeAPIReady?.();},async open(){await node('tableWatchOpen').click();await flush();},async join(){await node('watchJoin').click();await flush();},async click(id){await node(id).click();await flush();},submit(id){node(id).submit();return flush();},hidden(value=true){document.hidden=value;document.dispatch('visibilitychange');},pagehide(){window.dispatch('pagehide');},otherDialog(){const other=new Node('dialog');other.showModal();for(const observer of observers)if(observer.target===document.body)observer.emit([{target:other}]);},setFetch(handler){fetchHandler=handler;}};
}
function watchSnapshot(changes={}){return {roomInstanceId:'room-instance-a',watchSessionId:'watch-session-a',revision:1,controllerEpoch:1,controllerId:'host-seat',controllerName:'房主',selectedById:'host-seat',isHost:true,canControl:true,video:{provider:'youtube',id:'M7lc1UVf-VE'},playback:{state:'paused',anchorPositionSec:12,anchorServerMs:100000,rate:1},serverNowMs:100000,proposals:[],...changes};}
function roomState(snapshot=watchSnapshot(),changes={}){return {code:'ABC123',me:'host-seat',watch:snapshot?{roomInstanceId:snapshot.roomInstanceId,revision:snapshot.revision,hasVideo:!!snapshot.video,controllerId:snapshot.controllerId,controllerName:snapshot.controllerName}:null,...changes};}
module.exports={watchHarness,watchSnapshot,roomState,deferred,json,flush};
