const {randomInt,randomUUID}=require('node:crypto');
const {GIFTS}=require('./gift-catalog');
const {validCustomPercent,drawContent}=require('./content-draw');

const copy=value=>JSON.parse(JSON.stringify(value));
const rankPoints={great:3,good:2,ok:1,noWay:-4};
const clamp=(value,target)=>Math.max(0,Math.min(target,value));

class GiftRoom{
 constructor(code,name,rng=randomInt){
  this.type='gift';this.code=code;this.name=name;this.rng=rng;
  this.players=[];this.host=null;this.phase='waiting';this.version=0;this.updated=Date.now();
  this.round=0;this.target=15;this.customPercent=null;this.dealerId=null;this.gifts=[];this.usedGiftIds=[];
  this.assignments={};this.rankings={};this.result=null;this.winner=null;this.events=[];
 }
 player(id){return this.players.find(player=>player.id===id);}
 activePlayers(){return this.players.filter(player=>!player.kicked);}
 event(kind,text){this.events.push({id:++this.version,kind,text});this.events=this.events.slice(-16);this.updated=Date.now();}
 add(name,bot=false){
  if(bot)throw Error('送禮達人只接受真人玩家');
  if(!['waiting','finished'].includes(this.phase))throw Error('本局已開始，請等待下一局');
  if(this.activePlayers().length>=8)throw Error('最多 8 位玩家');
  if(typeof name!=='string'||!name.trim())throw Error('請輸入名字');
  const player={id:randomUUID(),secret:randomUUID(),name:name.trim().slice(0,16),bot:false,kicked:false,giveScore:0,getScore:0,lastSeen:Date.now()};
  this.players.push(player);if(!this.host)this.host=player.id;
  this.event('join',`${player.name} 加入房間`);return player;
 }
 kick(id,target){
  if(id!==this.host)throw Error('只有房主可以踢人');
  const player=this.player(target);
  if(!player||player.kicked)throw Error('找不到玩家');
  if(target===this.host)throw Error('不能踢出自己');
  player.kicked=true;delete this.assignments[target];delete this.rankings[target];
  for(const gifts of Object.values(this.assignments))delete gifts[target];
  this.event('kick',`${player.name} 已被房主踢出`);
  if(this.phase==='waiting'||this.phase==='finished')return;
  if(this.activePlayers().length<3){this.phase='finished';this.winner={ids:[],reason:'玩家不足，本局提前結束'};this.event('finish','玩家不足，本局提前結束');return;}
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
  this.target=data.target;if(data.customPercent!==undefined)this.customPercent=data.customPercent;
  this.event('settings',`目標分數改為 ${this.target}；自訂禮物${this.customPercent===null?'依題庫比例':this.customPercent+'%'}`);
 }
 start(){
  if(!['waiting','finished'].includes(this.phase))throw Error('遊戲已開始');
  this.players=this.activePlayers();
  if(this.players.length<3||this.players.length>8)throw Error('需要 3 至 8 位玩家');
  for(const player of this.players){player.giveScore=0;player.getScore=0;}
  this.round=0;this.usedGiftIds=[];this.winner=null;this.newRound();
 }
 newRound(){
  const players=this.activePlayers();
  const custom=this.giftProvider?.()||[];
  this.round++;this.dealerId=players[(this.round-1)%players.length].id;
  const draw=drawContent({builtin:GIFTS,custom,count:players.length+1,customPercent:this.customPercent,usedIds:this.usedGiftIds,rng:this.rng});
  this.gifts=draw.items;this.usedGiftIds=draw.usedIds;
  this.assignments={};this.rankings={};this.result=null;this.delivery=null;this.pendingResult=null;this.phase='choosing';
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
   host:id===this.host,hostId:this.host,me:id,round:this.round,target:this.target,customPercent:this.customPercent,
   dealerId:this.dealerId,gifts:this.gifts,
   players:this.activePlayers().map(player=>({id:player.id,name:player.name,avatar:player.avatar||null,bot:false,giveScore:player.giveScore,getScore:player.getScore,online:Date.now()-player.lastSeen<15000})),
   submittedIds:this.phase==='choosing'?this.activePlayers().filter(player=>Object.hasOwn(this.assignments,player.id)&&Object.hasOwn(this.rankings,player.id)).map(player=>player.id):[],
   gaveIds:this.phase==='choosing'?Object.keys(this.assignments):[],wishedIds:this.phase==='choosing'?Object.keys(this.rankings):[],
   ownAssignments:this.assignments[id]||null,ownRanking:this.rankings[id]||null,
   delivery:this.phase==='delivering'?{recipientId:this.delivery.order[this.delivery.index],index:this.delivery.index,total:this.delivery.order.length,entries:this.pendingResult.entries.filter(entry=>entry.recipientId===this.delivery.order[this.delivery.index]&&!this.player(entry.giverId).kicked).map(({giverId,recipientId,giftId,rank,points})=>({giverId,recipientId,giftId,rank,points}))}:null,
   result:revealed?this.result:null,winner:this.winner,events:this.events
  });
 }
}

module.exports={GiftRoom,rankPoints};
