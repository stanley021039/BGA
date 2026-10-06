const {randomUUID,createHash}=require('node:crypto');
const {HttpError}=require('../http/errors');

const MAX_POSITION_SEC=86400;
const CONTROLLER_GRACE_MS=30000;
const MAX_PROPOSALS=8;
const MAX_PLAYER_PROPOSALS=2;
const MAX_REQUESTS=128;
const REQUEST_TTL_MS=10*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const ACTIONS=new Set(['propose','select','play','pause','seek','replay','stop','takeover','transfer']);

// Parse identifiers only. The server never fetches a supplied URL or video.
function youtubeVideoId(value){
 const invalid=()=>new HttpError(400,'WATCH_INVALID_URL','請貼上有效的 HTTPS YouTube 影片網址');
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value))throw invalid();
 let url;try{url=new URL(value);}catch{throw invalid();}
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw invalid();
 let id;
 if(url.hostname==='youtu.be'){
  const match=url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/);id=match?.[1];
 }else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)){
  if(url.pathname==='/watch'&&url.searchParams.getAll('v').length===1)id=url.searchParams.get('v');
  else id=url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
 }
 if(!VIDEO_ID.test(id||''))throw invalid();
 return id;
}

class RoomWatch{
 constructor(now=Date.now){
  this.now=now;this.roomInstanceId=randomUUID();this.watchSessionId=randomUUID();
  this.revision=0;this.controllerEpoch=0;this.controllerId=null;this.selectedById=null;
  this.video=null;this.playback={state:'paused',anchorPositionSec:0,anchorServerMs:now(),rate:1};
  this.proposals=[];this.requests=new Map();this.observedHostId=null;
 }
 position(now=this.now()){
  return Math.min(MAX_POSITION_SEC,this.playback.anchorPositionSec+(this.playback.state==='playing'?Math.max(0,now-this.playback.anchorServerMs)/1000:0));
 }
 online(member,now=this.now()){return !!member&&Number.isFinite(member.lastSeen)&&now-member.lastSeen<CONTROLLER_GRACE_MS;}
 pause(now=this.now()){
  this.playback={state:'paused',anchorPositionSec:this.position(now),anchorServerMs:now,rate:1};
 }
 // Called from existing room requests, never from a watch timer or heartbeat.
 reconcile(context){
  const now=this.now(),members=context.members;
  const remaining=this.proposals.filter(proposal=>members.some(member=>member.id===proposal.proposerId));
  let changed=remaining.length!==this.proposals.length;
  if(changed)this.proposals=remaining;
  if(this.observedHostId!==context.hostId){if(this.observedHostId!==null)changed=true;this.observedHostId=context.hostId;}
  if(this.video&&(!this.controllerId||!this.online(members.find(member=>member.id===this.controllerId),now))){
   const next=(members.find(member=>member.id===context.hostId&&this.online(member,now))||members.find(member=>this.online(member,now)))?.id||null;
   if(next!==this.controllerId){
   this.pause(now);
   this.controllerId=next;
   this.controllerEpoch++;changed=true;
   }
  }
  if(changed)this.revision++;
 }
 summary(context){
  return {roomInstanceId:this.roomInstanceId,revision:this.revision,hasVideo:!!this.video,controllerId:this.controllerId,controllerName:context.members.find(member=>member.id===this.controllerId)?.name||null};
 }
 snapshot(playerId,context){
  return {schemaVersion:1,roomInstanceId:this.roomInstanceId,watchSessionId:this.watchSessionId,revision:this.revision,controllerEpoch:this.controllerEpoch,
   controllerId:this.controllerId,controllerName:context.members.find(member=>member.id===this.controllerId)?.name||null,selectedById:this.selectedById,
   video:this.video?{...this.video}:null,playback:{...this.playback},serverNowMs:this.now(),
   proposals:this.proposals.map(proposal=>({...proposal,proposerName:context.members.find(member=>member.id===proposal.proposerId)?.name||proposal.proposerName})),
   canControl:!!this.video&&this.controllerId===playerId&&context.members.some(member=>member.id===playerId),isHost:context.hostId===playerId};
 }
 select(videoId,playerId,now){
  this.video={provider:'youtube',id:videoId};this.selectedById=playerId;this.controllerId=playerId;
  this.watchSessionId=randomUUID();this.controllerEpoch++;
  this.playback={state:'paused',anchorPositionSec:0,anchorServerMs:now,rate:1};
 }
 pruneRequests(now){
  for(const [key,entry] of this.requests)if(now-entry.at>=REQUEST_TTL_MS)this.requests.delete(key);
 }
 act(playerId,data,context){
  if(!context.members.some(member=>member.id===playerId))throw new HttpError(403,'NOT_SEATED','尚未加入此房間');
  this.reconcile(context);
  const conflict=(code,message)=>{const error=new HttpError(409,code,message);error.watchState=this.snapshot(playerId,context);return error;};
  if(!data||typeof data!=='object'||Array.isArray(data)||typeof data.requestId!=='string'||!UUID.test(data.requestId))throw new HttpError(400,'WATCH_INVALID_REQUEST','共看操作需要有效的 requestId');
  if(!ACTIONS.has(data.action))throw new HttpError(400,'WATCH_INVALID_ACTION','不支援的共看操作');
  if(!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||!Number.isSafeInteger(data.controllerEpoch)||data.controllerEpoch<0)throw new HttpError(400,'WATCH_INVALID_VERSION','共看版本不正確');
  // Bind retries to the effective payload, not key ordering or ignored identity claims.
  const fingerprint=createHash('sha256').update(JSON.stringify([data.roomInstanceId,data.watchSessionId,data.expectedRevision,data.controllerEpoch,data.action,data.url??null,data.proposalId??null,data.positionSec??null,data.playerId??null])).digest('hex');
  const now=this.now(),key=playerId+':'+data.requestId;
  this.pruneRequests(now);
  const accepted=this.requests.get(key);
  if(accepted){
   if(accepted.fingerprint!==fingerprint)throw conflict('WATCH_REQUEST_REUSED','這個操作編號已用於其他請求，請重新操作');
   return {...this.snapshot(playerId,context),duplicate:true};
  }
  if(data.roomInstanceId!==this.roomInstanceId||data.watchSessionId!==this.watchSessionId||data.expectedRevision!==this.revision||data.controllerEpoch!==this.controllerEpoch)throw conflict('WATCH_STALE','共看狀態已更新，請確認最新狀態後再操作');
  const isHost=context.hostId===playerId,isController=this.controllerId===playerId;
  if(data.action!=='propose'&&!isController&&!(isHost&&['takeover','transfer','select','stop'].includes(data.action)))throw new HttpError(403,'WATCH_CONTROLLER_ONLY','只有目前控制者可以調整全桌播放，房主可先接管');
  if(data.action==='takeover'&&!isHost)throw new HttpError(403,'HOST_ONLY','只有房主可以接管共看');
  if(['play','pause','seek','replay','transfer','takeover'].includes(data.action)&&!this.video)throw new HttpError(400,'WATCH_NO_VIDEO','請先提出一部影片');
  if(data.action==='propose'){
   const videoId=youtubeVideoId(data.url);
   if(!this.video)this.select(videoId,playerId,now);
   else{
    if(this.video.id===videoId||this.proposals.some(proposal=>proposal.videoId===videoId))throw conflict('WATCH_ALREADY_PROPOSED','這部影片已在共看或建議清單中');
    if(this.proposals.length>=MAX_PROPOSALS||this.proposals.filter(proposal=>proposal.proposerId===playerId).length>=MAX_PLAYER_PROPOSALS)throw new HttpError(429,'WATCH_PROPOSAL_LIMIT','每人最多兩部建議，全房最多八部，請先選用清單中的影片');
    this.proposals.push({id:randomUUID(),videoId,proposerId:playerId,proposerName:context.members.find(member=>member.id===playerId).name});
   }
  }else if(data.action==='select'){
   const proposal=this.proposals.find(item=>item.id===data.proposalId);
   if(!proposal)throw conflict('WATCH_PROPOSAL_NOT_FOUND','影片建議已更新，請重新選擇');
   if(!this.online(context.members.find(member=>member.id===proposal.proposerId),now))throw conflict('WATCH_PROPOSER_OFFLINE','提案者暫時離線，請等他回來或選另一部影片');
   this.select(proposal.videoId,proposal.proposerId,now);this.proposals=this.proposals.filter(item=>item.id!==proposal.id);
  }else if(data.action==='stop'){
   this.video=null;this.selectedById=null;this.controllerId=null;this.watchSessionId=randomUUID();this.controllerEpoch++;
   this.playback={state:'paused',anchorPositionSec:0,anchorServerMs:now,rate:1};this.proposals=[];
  }else if(data.action==='transfer'||data.action==='takeover'){
   const target=data.action==='takeover'?playerId:data.playerId;
   if(!this.online(context.members.find(member=>member.id===target),now))throw new HttpError(400,'WATCH_INVALID_CONTROLLER','請選擇仍在線上的房員');
   this.pause(now);this.controllerId=target;this.controllerEpoch++;
  }else{
   let position=this.position(now),state=this.playback.state;
   if(data.action==='seek'){
    if(typeof data.positionSec!=='number'||!Number.isFinite(data.positionSec)||data.positionSec<0||data.positionSec>MAX_POSITION_SEC)throw new HttpError(400,'WATCH_INVALID_POSITION','播放進度需為 0 至 86400 秒');
    position=data.positionSec;
   }else if(data.action==='play')state='playing';
   else if(data.action==='pause')state='paused';
   else if(data.action==='replay'){position=0;state='playing';}
   this.playback={state,anchorPositionSec:position,anchorServerMs:now,rate:1};
  }
  this.revision++;
  this.requests.set(key,{fingerprint,at:now});
  while(this.requests.size>MAX_REQUESTS)this.requests.delete(this.requests.keys().next().value);
  return {...this.snapshot(playerId,context),duplicate:false};
 }
}

// Compare actual room objects as well as the short navigation code. A new room
// reusing a code must never inherit a prior controller, video or request ledger.
class RoomWatchRegistry{
 constructor(now=Date.now){this.now=now;this.rooms=new Map();}
 get(room,{create=false}={}){
  let entry=this.rooms.get(room.code);
  if(entry&&entry.room!==room){this.rooms.delete(room.code);entry=null;}
  if(!entry&&create){entry={room,watch:new RoomWatch(this.now)};this.rooms.set(room.code,entry);}
  return entry?.watch||null;
 }
 delete(code){this.rooms.delete(code);}
 clear(){this.rooms.clear();}
}

module.exports={RoomWatch,RoomWatchRegistry,youtubeVideoId,MAX_POSITION_SEC,CONTROLLER_GRACE_MS,MAX_PROPOSALS,MAX_PLAYER_PROPOSALS,MAX_REQUESTS,REQUEST_TTL_MS};
