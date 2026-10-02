const {transaction}=require('../db');

const definitions=[{
 id:'gift-first-gift',game:'gift',title:'第一份心意',
 description:'完成一輪送禮與喜好標記，並等到該輪正式揭曉。'
},{
 id:'majority-first-vote',game:'majority',title:'第一次舉牌',
 description:'提交至少一題答案，並等到該題正式揭曉；不需要猜中多數。'
},{
 id:'poker-first-hand',game:'poker',title:'第一手牌',
 description:'完成一手牌局，且本人作過至少一次合法決策；不必跟到攤牌或獲勝。'
},{
 id:'thunder-first-drive',game:'thunder',title:'公路初航',
 description:'完成至少一個有本人操作的回合，並等到比賽正常結束。'
},{
 id:'all-first-table',game:'all',title:'第一桌',
 description:'在任一遊戲首次完成有本人操作的正式遊玩單位。'
}];

class AchievementStore{
 constructor(db){
  this.db=db;
  this.processed=new WeakSet();
  this.insert=db.prepare('INSERT OR IGNORE INTO user_achievements(user_id,achievement_id,source_key,unlocked_at) VALUES(?,?,?,?)');
  this.find=db.prepare('SELECT achievement_id,unlocked_at FROM user_achievements WHERE user_id=?');
 }
 list(userId){
  const unlocked=new Map(this.find.all(userId).map(row=>[row.achievement_id,row.unlocked_at]));
  return {achievements:definitions.map(item=>({...item,unlockedAt:unlocked.get(item.id)||null}))};
 }
 firstTable(userId,sourceKey,at){this.insert.run(userId,'all-first-table',sourceKey,at);}
 awardGiftRound(room,seats){
  if(room.type!=='gift'||!room.result||!['reveal','finished'].includes(room.phase)||this.processed.has(room.result))return [];
  const active=new Set(room.activePlayers().map(player=>player.id));
  const unlocked=[],sourceKey=`gift:${room.code}:round:${room.result.round}:event:${room.version}`,at=new Date().toISOString();
  transaction(this.db,()=>{
   for(const [userId,playerId] of seats||[]){
    if(!active.has(playerId)||!Object.hasOwn(room.result.assignments,playerId)||!Object.hasOwn(room.result.rankings,playerId))continue;
    if(this.insert.run(userId,'gift-first-gift',sourceKey,at).changes)unlocked.push(userId);
    this.firstTable(userId,sourceKey,at);
   }
  });
  this.processed.add(room.result);
  return unlocked;
 }
 awardMajorityRound(room,seats){
  if(room.type!=='majority'||!room.result||!['reveal','finished'].includes(room.phase)||this.processed.has(room.result))return [];
  const active=new Set(room.activePlayers().map(player=>player.id));
  const unlocked=[],sourceKey=`majority:${room.code}:round:${room.result.round}:event:${room.version}`,at=new Date().toISOString();
  transaction(this.db,()=>{
   for(const [userId,playerId] of seats||[]){
    if(!active.has(playerId)||!room.participantIds.includes(playerId)||!Object.hasOwn(room.result.answers,playerId))continue;
    if(this.insert.run(userId,'majority-first-vote',sourceKey,at).changes)unlocked.push(userId);
    this.firstTable(userId,sourceKey,at);
   }
  });
  this.processed.add(room.result);
  return unlocked;
 }
 awardPokerHand(room,seats){
  if(room.type||room.phase!=='showdown'||!room.hand||!room.results?.length||this.processed.has(room.results))return [];
  const unlocked=[],sourceKey=`poker:${room.code}:hand:${room.hand}`,at=new Date().toISOString();
  transaction(this.db,()=>{
   for(const [userId,playerId] of seats||[]){
    const player=room.players.find(item=>item.id===playerId);
    if(!player||player.kicked||player.bot||!player.handDecision)continue;
    if(this.insert.run(userId,'poker-first-hand',sourceKey,at).changes)unlocked.push(userId);
    this.firstTable(userId,sourceKey,at);
   }
  });
  this.processed.add(room.results);
  return unlocked;
 }
 awardRaceFinish(room,seats){
  if(room.type!=='thunder'||room.phase!=='finished'||!room.winner||this.processed.has(room.winner))return [];
  const unlocked=[],sourceKey=`thunder:${room.code}:race:${room.round}:event:${room.version}`,at=new Date().toISOString();
  transaction(this.db,()=>{
   for(const [userId,playerId] of seats||[]){
    const player=room.player(playerId);
    if(!player||player.kicked||player.bot||!player.completedHumanTurn)continue;
    if(this.insert.run(userId,'thunder-first-drive',sourceKey,at).changes)unlocked.push(userId);
    this.firstTable(userId,sourceKey,at);
   }
  });
  this.processed.add(room.winner);
  return unlocked;
 }
}

module.exports={AchievementStore,definitions};
