'use strict';
const {randomUUID,randomInt,createHash}=require('node:crypto');
const {HttpError}=require('../http/errors'),{assertRecordCapacity}=require('../rooms/membership');
const clone=x=>JSON.parse(JSON.stringify(x));
const fail=(code,message,status=409)=>{throw new HttpError(status,code,message);};
const normalize=x=>x.normalize('NFKC').toLocaleLowerCase('zh-Hant').replace(/[\p{P}\p{Z}\s]/gu,'');
function text(value,max=80){if(typeof value!=='string'||[...value.trim()].length>max||/[\u0000-\u001f\u007f]/.test(value))fail('INVALID_TEXT','文字格式不正確',400);return value.trim();}
class PartyRoom{
 constructor(type,code,name,max,min,rng=randomInt,now=Date.now){Object.assign(this,{type,code,name,max,min,rng,now,players:[],host:null,phase:'waiting',round:0,roundLimit:0,roundId:null,version:0,updated:now(),events:[],log:[],results:[],interrupted:false,winner:null});Object.defineProperty(this,'receipts',{value:new Map(),enumerable:false});}
 activePlayers(){return this.players.filter(p=>!p.kicked);}player(id){return this.activePlayers().find(p=>p.id===id);}
 event(kind,message){this.events.push({id:++this.version,kind,text:message});this.events=this.events.slice(-30);this.log.unshift(message);this.log=this.log.slice(0,60);this.updated=this.now();}
 add(name,bot=false){if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','請等下一場再加入');if(this.activePlayers().length>=this.max)fail('ROOM_FULL','房間已滿',400);assertRecordCapacity(this);const p={id:randomUUID(),name:String(name).slice(0,16),secret:randomUUID(),bot:!!bot,kicked:false,lastSeen:this.now(),score:0};this.players.push(p);this.host||=p.id;this.event('join',p.name+' 入座');return p;}
 prepare(){if(!['waiting','finished'].includes(this.phase))fail('MATCH_STARTED','遊戲已開始');if(this.activePlayers().length<this.min)fail('NEED_PLAYERS','至少 '+this.min+' 人',400);this.players=this.activePlayers();this.players.forEach(p=>p.score=0);this.results=[];this.round=0;this.interrupted=false;this.winner=null;this.receipts.clear();}
 command(id,action,data,run){const p=this.player(id);if(!p)fail('NOT_SEATED','尚未入座',403);if(data.roundId!==this.roundId)fail('STALE_ROUND','已換輪，請更新畫面');if(typeof data.requestId!=='string'||! /^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))fail('INVALID_REQUEST_ID','操作識別碼不正確',400);const key=id+':'+data.requestId,fingerprint=createHash('sha256').update(JSON.stringify([action,data])).digest('hex');if(this.receipts.has(key)){if(this.receipts.get(key)!==fingerprint)fail('REQUEST_CONFLICT','操作識別碼內容不一致');return;}run(p);this.receipts.set(key,fingerprint);if(this.receipts.size>128)this.receipts.delete(this.receipts.keys().next().value);}
 finish(){this.phase='finished';const score=Math.max(...this.activePlayers().map(p=>p.score));this.winner={score,names:this.activePlayers().filter(p=>p.score===score).map(p=>p.name)};this.event('finish','本場完成，保留各輪回顧。');}
 kick(id,targetId,leaving=false){if(id!==this.host&&!leaving)fail('HOST_ONLY','只有房主可以移除席位',403);const p=this.player(targetId);if(!p)fail('PLAYER_NOT_FOUND','找不到玩家',404);p.kicked=true;if(this.host===targetId)this.host=this.activePlayers()[0]?.id??null;if(!['waiting','finished'].includes(this.phase)){this.phase='finished';this.interrupted=true;this.winner=null;this.deadline=null;}this.event('leave',p.name+' 離席；進行中的場次中止。');}
 baseView(id){if(!this.player(id))fail('NOT_SEATED','尚未入座',403);return {type:this.type,code:this.code,name:this.name,me:id,host:this.host,phase:this.phase,version:this.version,round:this.round,roundLimit:this.roundLimit,roundId:this.roundId,interrupted:this.interrupted,players:this.activePlayers().map(p=>({id:p.id,name:p.name,bot:p.bot,avatar:p.avatar,score:p.score})),results:this.results,winner:this.winner,events:this.events,log:this.log};}
}
module.exports={PartyRoom,fail,clone,text,normalize};
