const {randomInt,randomUUID}=require('node:crypto');
const {WORDS,TOPICS,topicLabels}=require('./draw-guess-words');
const {drawContent,validCustomPercent}=require('./content-draw');

const clone=value=>JSON.parse(JSON.stringify(value));
const normalize=value=>value.normalize('NFKC').toLocaleLowerCase('zh-Hant').trim().replace(/\s+/gu,' ');
const CONTROLS=new Set(['brush','erase','line','rect','ellipse']);
const MAX_BATCHES=1000,MAX_POINTS=30000;
const validTopic=topic=>topic==='all'||TOPICS.some(item=>item.id===topic);

class DrawGuessRoom{
 constructor(code,name,rng=randomInt,now=Date.now){
  this.type='draw';this.code=code;this.name=name;this.rng=rng;this.now=now;
  this.players=[];this.host=null;this.phase='waiting';this.version=0;this.updated=now();
  this.round=0;this.roundLimit=0;this.pendingArtists=[];this.presenterId=null;
  this.options={seconds:90,customPercent:null,topic:'all'};this.candidates=[];this.question=null;
  this.usedWordIds=[];this.participantIds=[];this.guessedIds=[];this.guesses=[];this.result=null;this.results=[];this.winner=null;this.deadline=null;this.events=[];
  Object.defineProperty(this,'canvas',{value:{version:0,strokes:[],batchIds:new Set(),points:0,recent:[]},enumerable:false});
 }
 player(id){return this.players.find(player=>player.id===id);}
 activePlayers(){return this.players.filter(player=>!player.kicked);}
 event(kind,text){this.events.push({id:++this.version,kind,text});this.events=this.events.slice(-16);this.updated=this.now();}
 add(name,bot=false){
  if(bot)throw Error('你畫我猜只接受真人玩家');
  if(this.activePlayers().length>=8)throw Error('最多 8 位玩家');
  if(typeof name!=='string'||!name.trim())throw Error('請輸入名字');
  const player={id:randomUUID(),secret:randomUUID(),name:name.trim().slice(0,16),bot:false,kicked:false,score:0,waitingForNextRound:this.phase!=='waiting',lastSeen:this.now()};
  this.players.push(player);if(!this.host)this.host=player.id;
  this.event('join',player.name+' 加入房間'+(player.waitingForNextRound?'，下一輪開始猜題':''));
  return player;
 }
 kick(id,target){
  if(id!==this.host)throw Error('只有房主可以踢人');
  const player=this.player(target);if(!player||player.kicked)throw Error('找不到玩家');
  if(target===this.host)throw Error('不能踢出自己');
  player.kicked=true;this.pendingArtists=this.pendingArtists.filter(item=>item!==target);
  this.participantIds=this.participantIds.filter(item=>item!==target);
  this.event('kick',player.name+' 已被房主踢出');
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
  this.options={seconds:data.seconds,customPercent:data.customPercent===undefined?this.options.customPercent:data.customPercent,topic:data.topic===undefined?this.options.topic:data.topic};
  this.event('settings','房主已更新作畫時間、題目類別與投稿比例');
 }
 start(){
  if(!['waiting','finished'].includes(this.phase))throw Error('本局已開始');
  this.players=this.activePlayers();
  if(this.players.length<2||this.players.length>8)throw Error('需要 2 至 8 位玩家');
  for(const player of this.players){player.score=0;player.waitingForNextRound=false;}
  this.round=0;this.roundLimit=this.players.length;this.pendingArtists=this.players.map(player=>player.id);
  this.results=[];this.winner=null;this.usedWordIds=[];
  this.newRound();
 }
 newRound(){
  for(const player of this.activePlayers())player.waitingForNextRound=false;
  while(this.pendingArtists.length&&!this.activePlayers().some(player=>player.id===this.pendingArtists[0]))this.pendingArtists.shift();
  if(!this.pendingArtists.length){this.finish();return;}
  this.round++;this.presenterId=this.pendingArtists.shift();
  this.participantIds=this.activePlayers().filter(player=>player.id!==this.presenterId).map(player=>player.id);
  const inTopic=word=>this.options.topic==='all'||word.topic===this.options.topic;
  const draw=drawContent({builtin:WORDS.filter(inTopic),custom:(this.wordProvider?.()||[]).filter(inTopic),count:3,customPercent:this.options.customPercent,usedIds:this.usedWordIds,rng:this.rng});
  this.candidates=draw.items.map(clone);this.usedWordIds=draw.usedIds;
  this.phase='choosing';this.question=null;this.guessedIds=[];this.guesses=[];this.result=null;
  this.deadline=this.now()+15000;
  this.canvas.strokes=[];this.canvas.batchIds.clear();this.canvas.points=0;this.canvas.recent=[];this.canvas.version++;
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
  this.result={round:this.round,presenterId:this.presenterId,answer:this.question?.title||null,aliases:this.question?.aliases||[],reason,guessedIds:[...this.guessedIds],guesses:clone(this.guesses),scores:this.activePlayers().map(player=>({id:player.id,score:player.score}))};
  this.results.push(this.result);
  this.phase='reveal';this.deadline=this.now()+8000;this.event('reveal',reason+'，本輪揭曉');
 }
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
  if(typeof data.batchId!=='string'||!/^[a-f0-9-]{8,36}$/i.test(data.batchId)||typeof data.strokeId!=='string'||!/^[a-f0-9-]{8,36}$/i.test(data.strokeId))throw Error('筆畫識別碼不正確');
  if(this.canvas.batchIds.has(data.batchId))return {round:this.round,version:this.canvas.version,duplicate:true};
  const points=data.points;
  if(!CONTROLS.has(data.tool)||!/^#[0-9a-f]{6}$/i.test(data.color)||!Number.isInteger(data.size)||data.size<1||data.size>40||
    !Array.isArray(points)||points.length<1||points.length>64||points.some(point=>!Array.isArray(point)||point.length!==2||!Number.isInteger(point[0])||point[0]<0||point[0]>511||!Number.isInteger(point[1])||point[1]<0||point[1]>255)||
    (data.tool!=='brush'&&data.tool!=='erase'&&points.length!==2))throw Error('筆畫格式不正確');
  const now=this.now();this.canvas.recent=this.canvas.recent.filter(time=>now-time<1000);
  if(this.canvas.recent.length>=10)throw Error('畫得太快，請稍後再試');
  if(this.canvas.strokes.length>=MAX_BATCHES||this.canvas.points+points.length>MAX_POINTS)throw Error('這輪畫布已達筆畫上限');
  this.canvas.recent.push(now);this.canvas.points+=points.length;
  const stroke={version:++this.canvas.version,strokeId:data.strokeId,tool:data.tool,color:data.color.toLowerCase(),size:data.size,filled:data.filled===true,points:clone(points)};
  this.canvas.strokes.push(stroke);this.canvas.batchIds.add(data.batchId);
  return {round:this.round,version:this.canvas.version,stroke};
 }
 canvasCommand(id,data){
  if(this.phase!=='drawing'||id!==this.presenterId)throw Error('只有當輪畫者能修改畫布');
  if(this.now()>=this.deadline)throw Error('作畫時間已結束');
  if(data.round!==this.round||!['undo','clear'].includes(data.command))throw Error('畫布操作不正確');
  if(data.command==='clear'){this.canvas.strokes=[];this.canvas.points=0;}
  else{const last=this.canvas.strokes.at(-1)?.strokeId;if(last){while(this.canvas.strokes.at(-1)?.strokeId===last)this.canvas.points-=this.canvas.strokes.pop().points.length;}}
  this.canvas.version++;
  return this.canvasSnapshot();
 }
 canvasSnapshot(){return {round:this.round,version:this.canvas.version,strokes:clone(this.canvas.strokes)};}
 view(id){
  const revealed=['reveal','finished'].includes(this.phase);
  return clone({
   type:this.type,code:this.code,name:this.name,phase:this.phase,version:this.version,host:id===this.host,hostId:this.host,me:id,
   round:this.round,roundLimit:this.roundLimit,presenterId:this.presenterId,options:this.options,deadline:this.deadline,serverNow:this.now(),
   candidates:this.phase==='choosing'&&id===this.presenterId?this.candidates:[],
   question:this.question&&(id===this.presenterId||revealed)?{title:this.question.title,aliases:this.question.aliases,category:this.question.category,difficulty:this.question.difficulty,topic:this.question.topic,topicLabel:this.question.topicLabel}:null,
   hint:this.question?{category:this.question.category,topicLabel:this.question.topicLabel||topicLabels[this.question.topic]||topicLabels.misc,length:[...this.question.title].length}:null,
   players:this.activePlayers().map(player=>({id:player.id,name:player.name,avatar:player.avatar||null,score:player.score,online:this.now()-player.lastSeen<15000,waitingForNextRound:player.waitingForNextRound})),
   participantIds:this.participantIds,guessedIds:this.guessedIds,guesses:this.guesses.map(item=>item.correct?{id:item.id,name:item.name,correct:true,points:item.points,at:item.at}:item),
   result:revealed?this.result:null,winner:this.winner,strokeVersion:this.canvas.version,events:this.events
  });
 }
}
module.exports={DrawGuessRoom,normalize,validTopic};
