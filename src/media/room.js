const {randomUUID,createHash}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {youtubeVideoId}=require('../watch/room');

const MAX_QUEUE_ITEMS=50,MAX_PLAYER_ITEMS=10,MAX_REQUESTS=256,REQUEST_TTL_MS=600000,MAX_POSITION_SEC=14400;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['enqueue','play','pause','seek','skip','remove','reorder','ended','duration','stop']);
const fallbackTitle=id=>`YouTube 影片（${id}）`;
function videoTitle(value){
 if(value===undefined||value==='')return null;
 if(typeof value!=='string'||!value.trim()||[...value.trim()].length>120||/[\u0000-\u001f\u007f]/.test(value))throw new HttpError(400,'MEDIA_INVALID_TITLE','影片名稱需為 1–120 字');
 return value.trim();
}
class RoomMedia{
 constructor(now=Date.now,store=null){
  this.now=now;this.store=store;this.roomInstanceId=randomUUID();this.playbackSessionId=randomUUID();this.revision=0;
  this.current=null;this.queue=[];this.managed=false;this.autoStart=true;this.requests=new Map();this.permissionSignature=null;
  this.playback={state:'paused',anchorPositionSec:0,anchorServerMs:now(),rate:1};
 }
 canControl(playerId,context){return context.hostId===playerId||context.managerIds?.has(playerId)||false;}
 position(now=this.now()){
  if(!this.current)return 0;
  return Math.min(this.current.durationSec||MAX_POSITION_SEC,this.playback.anchorPositionSec+(this.playback.state==='playing'?Math.max(0,now-this.playback.anchorServerMs)/1000:0));
 }
 marker(){return {roomInstanceId:this.roomInstanceId,revision:this.revision,hasCurrent:!!this.current};}
 snapshot(playerId,context){
  const control=context.members.some(member=>member.id===playerId)&&this.canControl(playerId,context);
  return {schemaVersion:1,roomInstanceId:this.roomInstanceId,revision:this.revision,playbackSessionId:this.playbackSessionId,
   current:this.current?{...this.current}:null,queue:this.queue.map(item=>({...item})),playback:{...this.playback},serverNowMs:this.now(),
   canControl:control,canManageQueue:control,isHost:context.hostId===playerId,isManager:context.hostId!==playerId&&!!context.managerIds?.has(playerId),myPlayerId:playerId};
 }
 next(at=this.now()){
  this.current=this.queue.shift()||null;this.playbackSessionId=randomUUID();this.autoStart=true;
  this.playback={state:this.current?'playing':'paused',anchorPositionSec:0,anchorServerMs:at,rate:1};this.revision++;
 }
 trackExists(item){try{return !!this.store?.get(item.trackId);}catch(error){if(error.code==='MUSIC_NOT_FOUND')return false;throw error;}}
 reconcile(context){
  const members=new Map(context.members.map(member=>[member.id,member]));
  const signature=JSON.stringify([context.hostId,[...(context.managerIds||[])].filter(id=>members.has(id)).sort(),[...members.keys()].sort()]);
  if(this.permissionSignature!==null&&signature!==this.permissionSignature)this.revision++;
  this.permissionSignature=signature;
  const remaining=this.queue.filter(item=>members.has(item.requestedById)&&(item.type!=='music'||this.trackExists(item)));
  let changed=remaining.length!==this.queue.length;this.queue=remaining;
  for(const item of [this.current,...this.queue].filter(Boolean)){const name=members.get(item.requestedById)?.name;if(name&&name!==item.requestedByName){item.requestedByName=name;changed=true;}}
  if(changed)this.revision++;
  if(this.current?.type==='music'&&!this.trackExists(this.current))this.next();
  // Use only trusted library durations and existing room requests. Videos
  // advance only when a current manager explicitly reports ended/skip.
  const now=this.now();
  for(let n=0;n<=MAX_QUEUE_ITEMS&&this.current?.type==='music'&&this.playback.state==='playing';n++){
   const end=this.playback.anchorServerMs+(this.current.durationSec-this.playback.anchorPositionSec)*1000;
   if(now<end)break;this.next(end);
  }
  for(const [key,request] of this.requests)if(now-request.at>=REQUEST_TTL_MS)this.requests.delete(key);
 }
 conflict(playerId,context,code='MEDIA_STALE',message='媒體清單已更新，請確認最新狀態後再操作'){
  const error=new HttpError(409,code,message);error.mediaState=this.snapshot(playerId,context);return error;
 }
 prepare(playerId,data,context){
  if(!context.members.some(member=>member.id===playerId))throw new HttpError(403,'NOT_SEATED','尚未加入此房間');
  this.reconcile(context);
  if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.requestId!=='string'||!UUID.test(data.requestId))throw new HttpError(400,'MEDIA_INVALID_REQUEST','媒體操作需要有效的 requestId');
  if(!ACTIONS.has(data.action))throw new HttpError(400,'MEDIA_INVALID_ACTION','不支援的媒體操作');
  if(!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0)throw new HttpError(400,'MEDIA_INVALID_VERSION','媒體版本不正確');
  if(data.action!=='enqueue'&&!this.canControl(playerId,context))throw new HttpError(403,'MEDIA_MANAGER_ONLY','只有房主或房間管理者可以控制媒體');
  const effective={action:data.action};
  if(data.action==='enqueue'){
   if(!['music','video'].includes(data.type))throw new HttpError(400,'MEDIA_INVALID_TYPE','請選擇歌曲或 YouTube 影片');
   effective.type=data.type;
   if(data.type==='music'){if(typeof data.trackId!=='string'||!UUID.test(data.trackId))throw new HttpError(400,'MEDIA_INVALID_TRACK','歌曲選擇不正確');effective.trackId=data.trackId;}
   else{effective.videoId=youtubeVideoId(data.url);effective.title=videoTitle(data.title);}
  }else if(data.action==='seek'){
   if(typeof data.positionSec!=='number'||!Number.isFinite(data.positionSec)||data.positionSec<0||data.positionSec>MAX_POSITION_SEC)throw new HttpError(400,'MEDIA_INVALID_POSITION','播放進度不正確');effective.positionSec=data.positionSec;
  }else if(data.action==='duration'){
   if(typeof data.durationSec!=='number'||!Number.isFinite(data.durationSec)||data.durationSec<=0||data.durationSec>MAX_POSITION_SEC)throw new HttpError(400,'MEDIA_INVALID_DURATION','影片長度需為 0 至 14400 秒');effective.durationSec=data.durationSec;effective.itemId=data.itemId??null;
  }else if(data.action==='remove'||data.action==='ended'){
   if(typeof data.itemId!=='string'||!UUID.test(data.itemId))throw new HttpError(400,'MEDIA_INVALID_ITEM','項目選擇不正確');effective.itemId=data.itemId;
  }else if(data.action==='reorder'){
   if(!Array.isArray(data.orderIds)||data.orderIds.length>MAX_QUEUE_ITEMS||data.orderIds.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(data.orderIds).size!==data.orderIds.length)throw new HttpError(400,'MEDIA_INVALID_ORDER','播放清單順序不正確');effective.orderIds=[...data.orderIds];
  }
  const fingerprint=createHash('sha256').update(JSON.stringify([data.roomInstanceId,data.playbackSessionId,data.expectedRevision,effective])).digest('hex');
  const key=playerId+':'+data.requestId,accepted=this.requests.get(key);
  if(accepted){if(accepted.fingerprint!==fingerprint)throw this.conflict(playerId,context,'MEDIA_REQUEST_REUSED','這個操作編號已用於其他請求');return {effective,fingerprint,key,duplicate:true};}
  if(data.roomInstanceId!==this.roomInstanceId||data.playbackSessionId!==this.playbackSessionId||data.expectedRevision!==this.revision)throw this.conflict(playerId,context);
  if(effective.action==='enqueue'&&(this.queue.length>=MAX_QUEUE_ITEMS||[this.current,...this.queue].filter(item=>item?.requestedById===playerId).length>=MAX_PLAYER_ITEMS))throw new HttpError(429,'MEDIA_QUEUE_LIMIT','全房最多 50 筆待播項目，每人最多點播 10 筆');
  return {effective,fingerprint,key,duplicate:false};
 }
 makeItem(effective,member,title){
  const common={id:randomUUID(),type:effective.type,requestedById:member.id,requestedByName:member.name};
  if(effective.type==='music'){const track=this.store.get(effective.trackId);return {...common,title:track.title,trackId:track.id,durationSec:track.duration};}
  return {...common,title:effective.title||title||fallbackTitle(effective.videoId),videoId:effective.videoId};
 }
 adopt(item,playback,member){
  if(item){this.current=this.makeItem(item,member);this.playbackSessionId=randomUUID();this.playback={state:playback.state,anchorPositionSec:playback.position||0,anchorServerMs:this.now(),rate:1};this.revision++;}
  this.managed=true;
 }
 act(playerId,data,context,{title}={}){
  const request=this.prepare(playerId,data,context);if(request.duplicate)return {...this.snapshot(playerId,context),duplicate:true};
  const value=request.effective,now=this.now(),revision=this.revision;
  if(value.action==='enqueue'){
   if(this.queue.length>=MAX_QUEUE_ITEMS||[this.current,...this.queue].filter(item=>item?.requestedById===playerId).length>=MAX_PLAYER_ITEMS)throw new HttpError(429,'MEDIA_QUEUE_LIMIT','全房最多 50 筆待播項目，每人最多點播 10 筆');
   const item=this.makeItem(value,context.members.find(member=>member.id===playerId),title);
   this.queue.push(item);if(!this.current&&this.autoStart)this.next(now);
  }else if(value.action==='reorder'){
   if(value.orderIds.length!==this.queue.length||value.orderIds.some(id=>!this.queue.some(item=>item.id===id)))throw this.conflict(playerId,context,'MEDIA_INVALID_ORDER','排序需包含所有待播項目且不可重複');
   const items=new Map(this.queue.map(item=>[item.id,item]));this.queue=value.orderIds.map(id=>items.get(id));
  }else if(value.action==='remove'){
   const index=this.queue.findIndex(item=>item.id===value.itemId);if(index<0)throw this.conflict(playerId,context,'MEDIA_ITEM_NOT_FOUND','待播項目已更新');this.queue.splice(index,1);
  }else if(value.action==='skip')this.next(now);
  else if(value.action==='stop'){this.current=null;this.autoStart=false;this.playbackSessionId=randomUUID();this.playback={state:'paused',anchorPositionSec:0,anchorServerMs:now,rate:1};}
  else if(value.action==='play'&&!this.current){if(!this.queue.length)throw new HttpError(400,'MEDIA_NO_CURRENT','請先點播一首歌曲或影片');this.next(now);}
  else{
   if(!this.current)throw new HttpError(400,'MEDIA_NO_CURRENT','目前沒有播放項目');
   if(value.action==='ended'){
    if(value.itemId!==this.current.id)throw this.conflict(playerId,context,'MEDIA_ITEM_NOT_FOUND','目前播放項目已更新');
    if(this.playback.state!=='playing')throw new HttpError(400,'MEDIA_NOT_PLAYING','目前項目已暫停');this.next(now);
   }else if(value.action==='duration'){
    if(this.current.type!=='video'||(value.itemId!==null&&value.itemId!==this.current.id))throw this.conflict(playerId,context,'MEDIA_ITEM_NOT_FOUND','目前影片已更新');
    const position=this.position(now);this.current.durationSec=value.durationSec;this.playback={...this.playback,anchorPositionSec:Math.min(position,value.durationSec),anchorServerMs:now};
   }else{
    let position=this.position(now),state=this.playback.state;
    if(value.action==='seek'){if(value.positionSec>(this.current.durationSec||MAX_POSITION_SEC))throw new HttpError(400,'MEDIA_INVALID_POSITION','播放進度超過項目長度');position=value.positionSec;}
    else if(value.action==='pause')state='paused';else if(value.action==='play'){state='playing';if(position>=(this.current.durationSec||MAX_POSITION_SEC))position=0;}
    this.playback={state,anchorPositionSec:position,anchorServerMs:now,rate:1};
   }
  }
  this.revision=revision+1;this.requests.set(request.key,{fingerprint:request.fingerprint,at:now});
  while(this.requests.size>MAX_REQUESTS)this.requests.delete(this.requests.keys().next().value);
  return {...this.snapshot(playerId,context),duplicate:false};
 }
 removeTrack(trackId){const length=this.queue.length;this.queue=this.queue.filter(item=>item.trackId!==trackId);if(this.queue.length!==length)this.revision++;if(this.current?.trackId===trackId)this.next();}
}
class RoomMediaRegistry{
 constructor(now=Date.now,store=null){this.now=now;this.store=store;this.rooms=new Map();}
 get(room,{create=false}={}){let entry=this.rooms.get(room.code);if(entry&&entry.room!==room){this.rooms.delete(room.code);entry=null;}if(!entry&&create){entry={room,media:new RoomMedia(this.now,this.store)};this.rooms.set(room.code,entry);}return entry?.media||null;}
 delete(code){this.rooms.delete(code);}clear(){this.rooms.clear();}
}
module.exports={RoomMedia,RoomMediaRegistry,MAX_QUEUE_ITEMS,MAX_PLAYER_ITEMS,MAX_REQUESTS,REQUEST_TTL_MS,MAX_POSITION_SEC,videoTitle,fallbackTitle};
