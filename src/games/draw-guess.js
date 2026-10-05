const {assertRecordCapacity}=require('../rooms/membership');
const {randomInt,randomUUID}=require('node:crypto');
const {WORDS,TOPICS,topicLabels}=require('./draw-guess-words');
const {drawContent,validCustomPercent}=require('./content-draw');
const {HttpError}=require('../http/errors');

const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const normalize=value=>value.normalize('NFKC').toLocaleLowerCase('zh-Hant').trim().replace(/\s+/gu,' ');
const CONTROLS=new Set(['brush','erase','line','rect','ellipse','fill']);
const MAX_BATCHES=1000,MAX_POINTS=30000,MAX_FILLS=48;
const MAX_PUBLIC_RESULTS=8,MAX_RESULT_SAVES=256;
const validTopic=topic=>topic==='all'||TOPICS.some(item=>item.id===topic);
const DRAW_CATEGORIES=[...TOPICS.map(item=>item.id),'custom'];
const validTopics=topics=>Array.isArray(topics)&&topics.length>0&&topics.length<=DRAW_CATEGORIES.length&&new Set(topics).size===topics.length&&topics.every(topic=>DRAW_CATEGORIES.includes(topic));

class DrawGuessRoom{
 constructor(code,name,rng=randomInt,now=Date.now){
  this.type='draw';this.code=code;this.name=name;this.rng=rng;this.now=now;
  this.players=[];this.host=null;this.phase='waiting';this.version=0;this.updated=now();
  this.round=0;this.roundLimit=0;this.pendingArtists=[];this.presenterId=null;this.gameRunId=null;
  this.options={seconds:90,customPercent:null,topic:'all',topics:[...DRAW_CATEGORIES]};this.candidates=[];this.question=null;
  this.usedWordIds=[];this.participantIds=[];this.guessedIds=[];this.guesses=[];this.result=null;this.results=[];this.winner=null;this.deadline=null;this.events=[];
  Object.defineProperty(this,'canvas',{value:{epoch:randomUUID(),version:0,strokes:[],batchIds:new Set(),points:0,acceptedPoints:0,recent:[],fills:0,fillRecent:[],commandRecent:[]},enumerable:false});
  // These bounded, in-memory snapshots must not enter every history row or poll.
  Object.defineProperty(this,'publicResults',{value:new Map(),enumerable:false});
  Object.defineProperty(this,'roundStartScores',{value:new Map(),enumerable:false});
 }
 player(id){return this.players.find(player=>player.id===id);}
 activePlayers(){return this.players.filter(player=>!player.kicked);}
 event(kind,text){this.events.push({id:++this.version,kind,text});this.events=this.events.slice(-16);this.updated=this.now();}
 add(name,bot=false){
  assertRecordCapacity(this);
  if(bot)throw Error('你畫我猜只接受真人玩家');
  if(this.activePlayers().length>=8)throw Error('最多 8 位玩家');
  if(typeof name!=='string'||!name.trim())throw Error('請輸入名字');
  const player={id:randomUUID(),secret:randomUUID(),name:name.trim().slice(0,16),bot:false,kicked:false,score:0,waitingForNextRound:this.phase!=='waiting',lastSeen:this.now()};
  this.players.push(player);if(!this.host)this.host=player.id;
  this.event('join',player.name+' 加入房間'+(player.waitingForNextRound?'，下一輪開始猜題':''));
  return player;
 }
 kick(id,target,leaving=false){
  if(id!==this.host)throw Error('只有房主可以踢人');
  const player=this.player(target);if(!player||player.kicked)throw Error('找不到玩家');
  if(target===this.host)throw Error('不能踢出自己');
  if(this.phase==='waiting')this.players.splice(this.players.indexOf(player),1);else player.kicked=true;this.pendingArtists=this.pendingArtists.filter(item=>item!==target);
  this.participantIds=this.participantIds.filter(item=>item!==target);
  this.event(leaving?'leave':'kick',player.name+(leaving?' 已離開房間':' 已被房主踢出'));
  if(this.phase==='waiting'||this.phase==='finished')return;
  if(this.activePlayers().length<2){this.finish('玩家不足，本局提前結束');return;}
  if(this.presenterId===target){this.reveal('畫者已離開');return;}
  if(this.phase==='drawing'&&this.allGuessed())this.reveal('所有猜題者已完成');
 }
 configure(id,data={}){
  if(id!==this.host)throw Error('只有房主可以更改設定');
  if(!['waiting','finished'].includes(this.phase))throw Error('遊戲中不能更改設定');
  if(!Number.isInteger(data.seconds)||![60,90,120].includes(data.seconds))throw Error('作畫時間請選 60、90 或 120 秒');
  if(data.customPercent!==undefined&&!validCustomPercent(data.customPercent))throw Error('投稿比例不正確');
  if(data.topic!==undefined&&!validTopic(data.topic))throw Error('題目類別不正確');
  if(data.topics!==undefined&&!validTopics(data.topics))throw Error('請至少選擇一個有效的題目類別');
  const options={...this.options,seconds:data.seconds,customPercent:data.customPercent===undefined?this.options.customPercent:data.customPercent};
  if(data.topics!==undefined){options.topics=DRAW_CATEGORIES.filter(topic=>data.topics.includes(topic));options.topic='all';options.customPercent=null;}
  else if(data.topic!==undefined){options.topic=data.topic;delete options.topics;}
  this.options=options;
  this.event('settings','房主已更新作畫時間與題目類別');
 }
 wordPools(){
  const custom=this.wordProvider?.()||[];
  if(Array.isArray(this.options.topics))return {builtin:WORDS.filter(word=>this.options.topics.includes(word.topic)),custom:this.options.topics.includes('custom')?custom:[]};
  // Keep recorded rooms and older clients using their original topic/ratio rules.
  const inTopic=word=>this.options.topic==='all'||word.topic===this.options.topic;
  return {builtin:WORDS.filter(inTopic),custom:custom.filter(inTopic)};
 }
 start(){
  if(!['waiting','finished'].includes(this.phase))throw Error('本局已開始');
  this.players=this.activePlayers();
  if(this.players.length<2||this.players.length>8)throw Error('需要 2 至 8 位玩家');
  const pools=this.wordPools();
  if(!pools.builtin.length&&(!pools.custom.length||this.options.customPercent===0))throw Error('所選類別還沒有題目，請到共編題庫新增自定義題目，或勾選其他類別');
  for(const player of this.players){player.score=0;player.waitingForNextRound=false;}
  this.gameRunId=randomUUID();this.round=0;this.roundLimit=this.players.length;this.pendingArtists=this.players.map(player=>player.id);
  this.results=[];this.winner=null;this.usedWordIds=[];
  this.newRound();
 }
 newRound(){
  for(const player of this.activePlayers())player.waitingForNextRound=false;
  while(this.pendingArtists.length&&!this.activePlayers().some(player=>player.id===this.pendingArtists[0]))this.pendingArtists.shift();
  if(!this.pendingArtists.length){this.finish();return;}
  this.round++;this.presenterId=this.pendingArtists.shift();
  this.roundStartScores.clear();for(const player of this.players)this.roundStartScores.set(player.id,player.score);
  this.participantIds=this.activePlayers().filter(player=>player.id!==this.presenterId).map(player=>player.id);
  const draw=drawContent({...this.wordPools(),count:3,customPercent:this.options.customPercent,usedIds:this.usedWordIds,rng:this.rng});
  this.candidates=draw.items.map(clone);this.usedWordIds=draw.usedIds;
  this.phase='choosing';this.question=null;this.guessedIds=[];this.guesses=[];this.result=null;
  this.deadline=this.now()+15000;
  this.canvas.epoch=randomUUID();this.canvas.strokes=[];this.canvas.batchIds.clear();this.canvas.points=0;this.canvas.acceptedPoints=0;this.canvas.recent=[];this.canvas.fills=0;this.canvas.fillRecent=[];this.canvas.commandRecent=[];this.canvas.version++;
  this.event('round','第 '+this.round+' 輪，由 '+this.player(this.presenterId).name+' 選題');
 }
 choose(id,questionId){
  if(this.phase!=='choosing'||id!==this.presenterId)throw Error('現在不是你選題');
  if(this.now()>=this.deadline)questionId=this.candidates[0].id;
  const question=this.candidates.find(item=>item.id===questionId);
  if(!question)throw Error('請選擇本輪三個題目之一');
  this.question=clone(question);this.candidates=[];this.phase='drawing';
  this.deadline=this.now()+this.options.seconds*1000;
  this.event('draw','畫者已選好題目，開始作畫');
 }
 allGuessed(){return this.participantIds.every(id=>this.guessedIds.includes(id));}
 guess(id,answer){
  if(this.phase!=='drawing')throw Error('目前不能猜題');
  if(this.now()>=this.deadline){this.reveal('時間到');throw Error('猜題時間已結束');}
  if(!this.participantIds.includes(id))throw Error('你從下一輪才開始猜題');
  if(this.guessedIds.includes(id))throw Error('你已經猜中了');
  if(typeof answer!=='string'||![...answer.trim()].length||[...answer].length>40||/[\u0000-\u001f\u007f]/u.test(answer))throw Error('猜測需為 1–40 字');
  const player=this.player(id),now=this.now();
  if(player.lastGuessAt&&now-player.lastGuessAt<700)throw Error('猜得太快，請稍後再試');
  player.lastGuessAt=now;
  const key=normalize(answer),correct=[this.question.title,...this.question.aliases].some(text=>normalize(text)===key);
  if(correct){
   const remaining=Math.max(0,this.deadline-now),points=30+Math.floor(70*remaining/(this.options.seconds*1000));
   player.score+=points;this.player(this.presenterId).score+=15;
   this.guessedIds.push(id);this.guesses.push({id,name:player.name,correct:true,points,at:now});
   this.guesses=this.guesses.slice(-50);
   this.event('correct',player.name+' 猜對了');
   if(this.allGuessed())this.reveal('所有猜題者已完成');
   return {correct:true,points};
  }
  this.guesses.push({id,name:player.name,answer:answer.trim(),correct:false,at:now});
  this.guesses=this.guesses.slice(-50);this.event('guess',player.name+' 提出猜測');
  return {correct:false};
 }
 reveal(reason='時間到'){
  if(!['drawing','choosing'].includes(this.phase))return;
  const artist=this.player(this.presenterId);
  this.result=freeze(clone({resultId:randomUUID(),gameRunId:this.gameRunId,canvasEpoch:this.canvas.epoch,revealedAt:this.now(),round:this.round,presenterId:this.presenterId,artist:{id:this.presenterId,name:artist?.name||'畫者',avatar:artist?.avatar||null},answer:this.question?.title||null,aliases:this.question?.aliases||[],reason,guessedIds:[...this.guessedIds],guesses:this.guesses,scores:this.activePlayers().map(player=>({id:player.id,name:player.name,avatar:player.avatar||null,score:player.score,roundPoints:player.score-(this.roundStartScores.get(player.id)||0)}))}));
  this.results.push(this.result);
  const {guesses,...metadata}=this.result;
  this.publicResults.set(this.result.resultId,{snapshot:freeze({result:metadata,canvas:this.canvasSnapshot()}),artworks:new Map()});
  while(this.publicResults.size>MAX_PUBLIC_RESULTS)this.publicResults.delete(this.publicResults.keys().next().value);
  this.phase='reveal';this.deadline=this.now()+8000;this.event('reveal',reason+'，本輪揭曉');
 }
 resultSnapshot(resultId){
  const entry=this.publicResults.get(resultId);
  if(!entry)throw new HttpError(404,'DRAW_RESULT_NOT_FOUND','這輪結果尚未公開或已不在最近八輪內');
  return clone(entry.snapshot);
 }
 resultMetadata(resultId){
  const entry=this.publicResults.get(resultId);
  if(!entry)throw new HttpError(404,'DRAW_RESULT_NOT_FOUND','這輪結果尚未公開或已不在最近八輪內');
  return clone(entry.snapshot.result);
 }
 savedResultArtwork(resultId,userId){
  const entry=this.publicResults.get(resultId);
  if(!entry)throw new HttpError(404,'DRAW_RESULT_NOT_FOUND','這輪結果尚未公開或已不在最近八輪內');
  if(!entry.artworks.has(userId)&&entry.artworks.size>=MAX_RESULT_SAVES)throw new HttpError(429,'DRAW_RESULT_SAVE_LIMIT','這輪的收藏紀錄已達上限');
  return entry.artworks.get(userId)||null;
 }
 rememberResultArtwork(resultId,userId,artworkId){this.savedResultArtwork(resultId,userId);this.publicResults.get(resultId).artworks.set(userId,artworkId);}
 finish(reason=null){
  this.phase='finished';this.deadline=null;
  const players=this.activePlayers(),high=Math.max(0,...players.map(player=>player.score));
  this.winner={ids:players.filter(player=>player.score===high).map(player=>player.id),score:high,...(reason?{reason}:{})};
  this.event('finish',reason||'每位畫者都已完成，本局結束');
 }
 next(id){
  if(this.phase!=='reveal'||id!==this.host)throw Error('只有房主可以繼續');
  this.newRound();
 }
 auto(){
  const now=this.now(),artist=this.player(this.presenterId);
  if(this.phase==='choosing'&&(now>=this.deadline||now-artist?.lastSeen>15000)){this.choose(this.presenterId,this.candidates[0].id);return true;}
  if(this.phase==='drawing'&&(now>=this.deadline||artist?.kicked||now-artist?.lastSeen>15000)){this.reveal(now>=this.deadline?'時間到':'畫者斷線');return true;}
  if(this.phase==='reveal'&&now>=this.deadline){this.newRound();return true;}
  return false;
 }
 act(id,action,data={}){
  if(!this.player(id)||this.player(id).kicked)throw Error('找不到玩家');
  if(action==='choose')return this.choose(id,data.questionId);
  if(action==='guess')return this.guess(id,data.answer);
  if(action==='next')return this.next(id);
  throw Error('目前階段無法執行此操作');
 }
 addStroke(id,data){
  if(this.phase!=='drawing'||id!==this.presenterId)throw Error('只有當輪畫者能作畫');
  if(this.now()>=this.deadline)throw Error('作畫時間已結束');
  if(data.round!==this.round)throw Error('筆畫屬於舊回合');
  if(data.canvasEpoch!==this.canvas.epoch)throw Error('畫布已更新，請重新同步後作畫');
  if(typeof data.batchId!=='string'||!/^[a-f0-9-]{8,36}$/i.test(data.batchId)||typeof data.strokeId!=='string'||!/^[a-f0-9-]{8,36}$/i.test(data.strokeId))throw Error('筆畫識別碼不正確');
  if(this.canvas.batchIds.has(data.batchId))return {canvasEpoch:this.canvas.epoch,round:this.round,version:this.canvas.version,duplicate:true,quota:this.canvasQuota()};
  const points=data.points;
  if(!CONTROLS.has(data.tool)||!/^#[0-9a-f]{6}$/i.test(data.color)||!Number.isInteger(data.size)||data.size<1||data.size>40||
    !Array.isArray(points)||points.length<1||points.length>64||points.some(point=>!Array.isArray(point)||point.length!==2||!Number.isInteger(point[0])||point[0]<0||point[0]>511||!Number.isInteger(point[1])||point[1]<0||point[1]>255)||
    (data.tool==='fill'?points.length!==1:data.tool!=='brush'&&data.tool!=='erase'&&points.length!==2))throw Error('筆畫格式不正確');
  const now=this.now();this.canvas.recent=this.canvas.recent.filter(time=>now-time<1000);
  if(this.canvas.recent.length>=10)throw new HttpError(429,'DRAW_RATE_LIMIT','畫得太快，請稍後再試');
  // Accepted batch IDs survive undo/clear; otherwise these operations could
  // bypass the round quota and grow the deduplication set indefinitely.
  if(this.canvas.batchIds.size>=MAX_BATCHES||this.canvas.acceptedPoints+points.length>MAX_POINTS)throw new HttpError(429,'DRAW_WORK_LIMIT','這輪畫布已達筆畫上限');
  if(data.tool==='fill'){
   this.canvas.fillRecent=this.canvas.fillRecent.filter(time=>now-time<1000);
   if(this.canvas.fillRecent.length>=2)throw new HttpError(429,'DRAW_RATE_LIMIT','填滿操作太快，請稍後再試');
   if(this.canvas.fills>=MAX_FILLS)throw new HttpError(429,'DRAW_WORK_LIMIT','這輪已達填滿操作上限');
   this.canvas.fillRecent.push(now);this.canvas.fills++;
  }
  this.canvas.recent.push(now);this.canvas.points+=points.length;this.canvas.acceptedPoints+=points.length;
  const stroke={version:++this.canvas.version,strokeId:data.strokeId,tool:data.tool,color:data.color.toLowerCase(),size:data.size,filled:data.filled===true,points:clone(points)};
  this.canvas.strokes.push(stroke);this.canvas.batchIds.add(data.batchId);
  return {canvasEpoch:this.canvas.epoch,round:this.round,version:this.canvas.version,stroke,quota:this.canvasQuota()};
 }
 canvasCommand(id,data){
  if(this.phase!=='drawing'||id!==this.presenterId)throw Error('只有當輪畫者能修改畫布');
  if(this.now()>=this.deadline)throw Error('作畫時間已結束');
  if(data.round!==this.round||!['undo','clear'].includes(data.command))throw Error('畫布操作不正確');
  if(data.canvasEpoch!==this.canvas.epoch)throw Error('畫布已更新，請重新同步後操作');
  const now=this.now();this.canvas.commandRecent=this.canvas.commandRecent.filter(time=>now-time<1000);
  if(this.canvas.commandRecent.length>=2)throw new HttpError(429,'DRAW_COMMAND_RATE_LIMIT','畫布操作太快，請稍後再試');
  this.canvas.commandRecent.push(now);
  if(data.command==='clear'){this.canvas.strokes=[];this.canvas.points=0;}
  else{const last=this.canvas.strokes.at(-1)?.strokeId;if(last){while(this.canvas.strokes.at(-1)?.strokeId===last)this.canvas.points-=this.canvas.strokes.pop().points.length;}}
  this.canvas.version++;
  return this.canvasSnapshot();
 }
 canvasQuota(){return {usedFills:this.canvas.fills,usedBatches:this.canvas.batchIds.size,usedPoints:this.canvas.acceptedPoints};}
 canvasSnapshot(){return {canvasEpoch:this.canvas.epoch,round:this.round,version:this.canvas.version,strokes:clone(this.canvas.strokes),limits:{maxBatches:MAX_BATCHES,maxPoints:MAX_POINTS,maxFills:MAX_FILLS},quota:this.canvasQuota()};}
 view(id){
  const revealed=['reveal','finished'].includes(this.phase)&&this.result?.canvasEpoch===this.canvas.epoch;
  return clone({
   type:this.type,code:this.code,name:this.name,phase:this.phase,version:this.version,host:id===this.host,hostId:this.host,me:id,
   round:this.round,roundLimit:this.roundLimit,gameRunId:this.gameRunId,presenterId:this.presenterId,options:this.options,deadline:this.deadline,serverNow:this.now(),
   candidates:this.phase==='choosing'&&id===this.presenterId?this.candidates:[],
   question:this.question&&(id===this.presenterId||revealed)?{title:this.question.title,aliases:this.question.aliases,category:this.question.category,difficulty:this.question.difficulty,topic:this.question.topic,topicLabel:this.question.topicLabel}:null,
   hint:this.question?{category:this.question.category,topicLabel:this.question.topicLabel||topicLabels[this.question.topic]||topicLabels.misc,length:[...this.question.title].length}:null,
   players:this.activePlayers().map(player=>({id:player.id,name:player.name,avatar:player.avatar||null,score:player.score,online:this.now()-player.lastSeen<15000,waitingForNextRound:player.waitingForNextRound})),
   participantIds:this.participantIds,guessedIds:this.guessedIds,guesses:this.guesses.map(item=>item.correct?{id:item.id,name:item.name,correct:true,points:item.points,at:item.at}:item),
   result:revealed?this.result:null,recentResults:[...this.publicResults.values()].reverse().map(entry=>entry.snapshot.result),winner:this.winner,canvasEpoch:this.canvas.epoch,strokeVersion:this.canvas.version,events:this.events
  });
 }
}
module.exports={DrawGuessRoom,normalize,validTopic,validTopics,DRAW_CATEGORIES,MAX_PUBLIC_RESULTS,MAX_RESULT_SAVES};
