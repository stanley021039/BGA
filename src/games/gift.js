const {assertRecordCapacity}=require('../rooms/membership');
const {randomInt,randomUUID}=require('node:crypto');
const {GIFTS}=require('./gift-catalog');
const {validCustomPercent,drawContent}=require('./content-draw');

const copy=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const rankPoints={great:3,good:2,ok:1,noWay:-4};
const clamp=(value,target)=>Math.max(0,Math.min(target,value));
const MAX_PENDING_ACHIEVEMENT_UNITS=256;
const CANONICAL_USER_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class GiftRoom{
 constructor(code,name,rng=randomInt){
  this.type='gift';this.code=code;this.name=name;this.rng=rng;
  this.players=[];this.host=null;this.phase='waiting';this.version=0;this.updated=Date.now();
  this.round=0;this.target=15;this.customPercent=null;this.includeAdult=true;this.dealerId=null;this.gifts=[];this.usedGiftIds=[];
  this.assignments={};this.rankings={};this.result=null;this.winner=null;this.events=[];
  Object.defineProperty(this,'achievementUnits',{value:{matchId:null,current:null,pending:new Map()},enumerable:false});
 }
 pendingAchievementUnits(){return [...this.achievementUnits.pending.values()];}
 // A retry reads the same immutable facts until persistence explicitly succeeds.
 drainAchievementUnits(){return this.pendingAchievementUnits();}
 acknowledgeAchievementUnit(unitEventId){return this.achievementUnits.pending.delete(unitEventId);}
 achievementCapacity(){
  if((typeof this.achievementUnitStart==='function'||typeof this.achievementUnitCompleted==='function')&&this.achievementUnits.pending.size>=MAX_PENDING_ACHIEVEMENT_UNITS)throw Error('回合紀錄等待儲存，請稍後再開始下一輪');
 }
 beginAchievementUnit(participantSeatIds){
  if(typeof this.achievementUnitStart!=='function'&&typeof this.achievementUnitCompleted!=='function'){this.achievementUnits.current=null;return;}
  const context=freeze({match_id:this.achievementUnits.matchId,unit_event_id:randomUUID(),game_type:this.type,unit:'round',round:this.round,participantSeatIds:[...participantSeatIds]});
  const participants=[],seats=new Set(participantSeatIds.filter(id=>this.players.some(player=>player.id===id&&!player.bot))),users=new Set(),usedSeats=new Set();
  try{
   const supplied=this.achievementUnitStart?.(context);
   if(supplied&&typeof supplied.then==='function')Promise.resolve(supplied).catch(()=>{});
   if(Array.isArray(supplied))for(const item of supplied){
    if(!item||typeof item.user_id!=='string'||!CANONICAL_USER_ID.test(item.user_id)||!seats.has(item.seat_id)||users.has(item.user_id.toLowerCase())||usedSeats.has(item.seat_id))continue;
    participants.push({user_id:item.user_id,seat_id:item.seat_id});users.add(item.user_id.toLowerCase());usedSeats.add(item.seat_id);
   }
  }catch{/* Optional persistence hooks cannot roll back accepted gameplay. */}
  this.achievementUnits.current={context,participants:freeze(participants),mappingComplete:participantSeatIds.every(id=>{const player=this.players.find(item=>item.id===id);return !!player&&(!!player.bot||usedSeats.has(id));}),gave:new Set(),wished:new Set(),deliveryInterrupted:false,completed:false};
 }
 completeAchievementUnit(status){
  const state=this.achievementUnits,unit=state.current;
  if(!unit||unit.completed)return;
  if(status==='rules_completed'&&!unit.mappingComplete)status='interrupted';
  const mappedSeats=new Set(unit.participants.map(participant=>participant.seat_id));
  const active=new Set(this.activePlayers().filter(player=>mappedSeats.has(player.id)).map(player=>player.id));
  const entries=this.result?.entries||[];
  const participants=unit.participants.map(participant=>{
   const received=entries.filter(entry=>entry.recipientId===participant.seat_id),counts=new Map();
   for(const entry of received)counts.set(entry.giftId,(counts.get(entry.giftId)||0)+1);
   return {...participant,eligible:active.has(participant.seat_id)&&unit.gave.has(participant.seat_id)&&unit.wished.has(participant.seat_id),receivedTwinGifts:[...counts.values()].some(count=>count>=2),positiveWish:received.some(entry=>['great','good','ok'].includes(entry.rank))};
  });
  const snapshot=freeze({unit_event_id:unit.context.unit_event_id,match_id:unit.context.match_id,game_type:this.type,unit:'round',round:unit.context.round,status,completed_at:new Date().toISOString(),participants,metrics:{participantCount:active.size}});
  unit.completed=true;state.pending.set(snapshot.unit_event_id,snapshot);
  try{const notified=this.achievementUnitCompleted?.(snapshot);if(notified&&typeof notified.then==='function')Promise.resolve(notified).catch(()=>{});}catch{/* The latched snapshot remains pending for reconciliation. */}
 }
 player(id){return this.players.find(player=>player.id===id);}
 activePlayers(){return this.players.filter(player=>!player.kicked);}
 event(kind,text){this.events.push({id:++this.version,kind,text});this.events=this.events.slice(-16);this.updated=Date.now();}
 add(name,bot=false){
  assertRecordCapacity(this);
  if(!['waiting','finished'].includes(this.phase))throw Error('本局已開始，請等待下一局');
  if(this.activePlayers().length>=8)throw Error('最多 8 位玩家');
  if(typeof name!=='string'||!name.trim())throw Error('請輸入名字');
  const player={id:randomUUID(),secret:randomUUID(),name:name.trim().slice(0,16),bot,kicked:false,giveScore:0,getScore:0,lastSeen:Date.now()};
  this.players.push(player);if(!this.host)this.host=player.id;
  this.event('join',`${player.name} 加入房間`);return player;
 }
 kick(id,target,leaving=false){
  if(id!==this.host)throw Error('只有房主可以踢人');
  const player=this.player(target);
  if(!player||player.kicked)throw Error('找不到玩家');
  if(target===this.host)throw Error('不能踢出自己');
  if(this.phase==='waiting')this.players.splice(this.players.indexOf(player),1);else player.kicked=true;delete this.assignments[target];delete this.rankings[target];
  for(const gifts of Object.values(this.assignments))delete gifts[target];
  this.event(leaving?'leave':'kick',player.name+(leaving?' 已離開房間':' 已被房主踢出'));
  if(this.phase==='waiting'||this.phase==='finished')return;
  if(this.phase==='delivering'&&this.achievementUnits.current)this.achievementUnits.current.deliveryInterrupted=true;
  if(this.activePlayers().length<3){this.phase='finished';this.winner={ids:[],reason:'玩家不足，本局提前結束'};this.event('finish','玩家不足，本局提前結束');this.completeAchievementUnit('abandoned');return;}
  if(this.phase==='choosing'&&this.readyToReveal())this.reveal();
  if(this.phase==='delivering'){
   const current=this.delivery.order[this.delivery.index];
   this.delivery.order=this.delivery.order.filter(playerId=>playerId!==target);
   if(current===target){if(this.delivery.index>=this.delivery.order.length)this.finishDelivery();}
   else this.delivery.index=this.delivery.order.indexOf(current);
  }
 }
 configure(id,data={}){
  if(id!==this.host)throw Error('只有房主可以更改設定');
  if(!['waiting','finished'].includes(this.phase))throw Error('遊戲中不能更改設定');
  if(!Number.isInteger(data.target)||data.target<8||data.target>30)throw Error('目標分數必須是 8 至 30 的整數');
  if(data.customPercent!==undefined&&!validCustomPercent(data.customPercent))throw Error('自訂禮物比例請選擇自動、0%、25%、50%、75% 或 100%');
  if(data.includeAdult!==undefined&&typeof data.includeAdult!=='boolean')throw Error('成人派對設定需為開啟或關閉');
  this.target=data.target;if(data.customPercent!==undefined)this.customPercent=data.customPercent;this.includeAdult=true;
  this.event('settings',`目標分數改為 ${this.target}；自訂禮物${this.customPercent===null?'依題庫比例':this.customPercent+'%'}`);
 }
 start(){
  if(!['waiting','finished'].includes(this.phase))throw Error('遊戲已開始');
  this.achievementCapacity();
  this.players=this.activePlayers();
  if(this.players.length<3||this.players.length>8)throw Error('需要 3 至 8 位玩家');
  for(const player of this.players){player.giveScore=0;player.getScore=0;}
  this.achievementUnits.matchId=randomUUID();this.round=0;this.usedGiftIds=[];this.winner=null;this.newRound();
 }
 newRound(){
  this.achievementCapacity();
  const players=this.activePlayers();
  const builtin=GIFTS,custom=this.giftProvider?.()||[];
  this.round++;this.dealerId=players[(this.round-1)%players.length].id;
  const draw=drawContent({builtin,custom,count:players.length+1,customPercent:this.customPercent,usedIds:this.usedGiftIds,rng:this.rng});
  this.gifts=draw.items;this.usedGiftIds=draw.usedIds;
  this.assignments={};this.rankings={};this.result=null;this.delivery=null;this.pendingResult=null;this.phase='choosing';
  this.beginAchievementUnit(players.map(player=>player.id));
  this.event('round',`第 ${this.round} 輪開始，請為朋友挑禮物並標記喜好`);
 }
 allSubmitted(records){return this.activePlayers().every(player=>Object.hasOwn(records,player.id));}
 readyToReveal(){return this.allSubmitted(this.assignments)&&this.allSubmitted(this.rankings);}
 give(id,assignments){
  if(this.phase!=='choosing')throw Error('現在不能送禮');
  if(Object.hasOwn(this.assignments,id))throw Error('你的禮物已鎖定');
  const recipients=this.activePlayers().filter(player=>player.id!==id).map(player=>player.id);
  const validIds=new Set(this.gifts.map(gift=>gift.id));
  if(!assignments||typeof assignments!=='object'||Array.isArray(assignments)||Object.keys(assignments).length!==recipients.length||
   recipients.some(recipient=>!Object.hasOwn(assignments,recipient)||!validIds.has(assignments[recipient]))||
   new Set(Object.values(assignments)).size!==recipients.length)throw Error('每位朋友都要收到一件不同的有效禮物');
  this.assignments[id]=Object.fromEntries(recipients.map(recipient=>[recipient,assignments[recipient]]));
  this.achievementUnits.current?.gave.add(id);
  this.event('give',`${this.player(id).name} 已選好禮物`);
  if(this.readyToReveal())this.reveal();
 }
 wish(id,ranking){
  if(this.phase!=='choosing')throw Error('現在不能標記喜好');
  if(Object.hasOwn(this.rankings,id))throw Error('你的喜好已鎖定');
  const keys=Object.keys(rankPoints),validIds=new Set(this.gifts.map(gift=>gift.id));
  if(!ranking||typeof ranking!=='object'||Array.isArray(ranking)||Object.keys(ranking).length!==keys.length||
   keys.some(key=>!Object.hasOwn(ranking,key)||!validIds.has(ranking[key]))||
   new Set(Object.values(ranking)).size!==keys.length)throw Error('請為四件不同禮物標記最想要、想要、還可以與不想要');
  this.rankings[id]=Object.fromEntries(keys.map(key=>[key,ranking[key]]));
  this.achievementUnits.current?.wished.add(id);
  this.event('wish',`${this.player(id).name} 已標記喜好`);
  if(this.readyToReveal())this.reveal();
 }
 reveal(){
  const players=this.activePlayers();
  const dealer=players.findIndex(player=>player.id===this.dealerId),order=players.slice(dealer).concat(players.slice(0,dealer));
  const entries=[];
  for(const recipient of order){
   for(const giver of players){
    if(giver.id===recipient.id)continue;
    const giftId=this.assignments[giver.id]?.[recipient.id];
    const rank=Object.keys(rankPoints).find(key=>this.rankings[recipient.id][key]===giftId)||'unranked';
    const points=rankPoints[rank]??-1;
    entries.push({giverId:giver.id,recipientId:recipient.id,giftId,rank,points});
   }
  }
  this.pendingResult={round:this.round,assignments:copy(this.assignments),rankings:copy(this.rankings),entries};
  this.delivery={order:order.map(player=>player.id),index:0};
  this.phase='delivering';this.event('delivery','大家一起送禮，等待收禮者確認');
 }
 accept(id,recipientId){
  if(this.phase!=='delivering')throw Error('現在沒有待確認的禮物');
  const current=this.delivery.order[this.delivery.index];
  if(id!==current)throw Error('只有目前的收禮者可以確認');
  if(recipientId!==current)throw Error('這份禮物已確認，請重新整理');
  this.event('accept',`${this.player(id).name} 已收到禮物`);
  this.delivery.index++;
  if(this.delivery.index<this.delivery.order.length)return;
  this.finishDelivery();
 }
 finishDelivery(){
  const players=this.activePlayers();
  const entries=this.pendingResult.entries.filter(entry=>players.some(player=>player.id===entry.giverId)&&players.some(player=>player.id===entry.recipientId));
  for(const entry of entries){
   const giver=this.player(entry.giverId),recipient=this.player(entry.recipientId);
   giver.giveScore=clamp(giver.giveScore+entry.points,this.target);
   recipient.getScore=clamp(recipient.getScore+entry.points,this.target);
   entry.giveAfter=giver.giveScore;entry.getAfter=recipient.getScore;
  }
  this.result={...this.pendingResult,entries};this.pendingResult=null;this.delivery=null;
  const winners=players.filter(player=>player.giveScore===this.target&&player.getScore===this.target);
  this.phase=winners.length?'finished':'reveal';
  if(winners.length)this.winner={ids:winners.map(player=>player.id),round:this.round};
  this.event(this.phase,this.phase==='finished'?'有人同時達成送禮與收禮目標！':'禮物已揭曉，查看這輪結果');
  this.completeAchievementUnit(this.achievementUnits.current?.deliveryInterrupted?'interrupted':'rules_completed');
 }
 act(id,action,data={}){
  if(!this.player(id)||this.player(id).kicked)throw Error('找不到玩家');
  if(action==='give')return this.give(id,data.assignments);
  if(action==='wish')return this.wish(id,data.ranking);
  if(action==='accept')return this.accept(id,data.recipientId);
  if(action==='next'&&this.phase==='reveal'){
   if(id!==this.host)throw Error('只有房主可以開始下一輪');
   return this.newRound();
  }
  throw Error('目前階段無法執行此操作');
 }
 view(id){
  const revealed=['reveal','finished'].includes(this.phase);
  return copy({
   type:this.type,code:this.code,name:this.name,phase:this.phase,version:this.version,
   host:id===this.host,hostId:this.host,me:id,round:this.round,target:this.target,customPercent:this.customPercent,includeAdult:!!this.includeAdult,
   dealerId:this.dealerId,gifts:this.gifts,
   players:this.activePlayers().map(player=>({id:player.id,name:player.name,avatar:player.avatar||null,bot:!!player.bot,giveScore:player.giveScore,getScore:player.getScore,online:!!player.bot||Date.now()-player.lastSeen<15000})),
   submittedIds:this.phase==='choosing'?this.activePlayers().filter(player=>Object.hasOwn(this.assignments,player.id)&&Object.hasOwn(this.rankings,player.id)).map(player=>player.id):[],
   gaveIds:this.phase==='choosing'?Object.keys(this.assignments):[],wishedIds:this.phase==='choosing'?Object.keys(this.rankings):[],
   ownAssignments:this.assignments[id]||null,ownRanking:this.rankings[id]||null,
   delivery:this.phase==='delivering'?{recipientId:this.delivery.order[this.delivery.index],index:this.delivery.index,total:this.delivery.order.length,entries:this.pendingResult.entries.filter(entry=>entry.recipientId===this.delivery.order[this.delivery.index]&&!this.player(entry.giverId).kicked).map(({giverId,recipientId,giftId,rank,points})=>({giverId,recipientId,giftId,rank,points}))}:null,
   result:revealed?this.result:null,winner:this.winner,events:this.events
  });
 }
}

module.exports={GiftRoom,rankPoints};
