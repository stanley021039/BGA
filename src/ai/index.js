const {randomUUID}=require('node:crypto');
const {TOPICS}=require('../games/majority-questions');
const {sketchFor,hasSketch}=require('./sketches');
const adapters=new Map(),runtime=new WeakMap();
const shuffle=(items,rng)=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=rng(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;};
function registerTestAI(type,adapter){
 if(typeof type!=='string'||!type||typeof adapter?.plan!=='function'||!Number.isInteger(adapter.maxPlayers))throw Error('測試 AI 必須提供遊戲類型、人數上限與 plan');
 if(adapters.has(type))throw Error('此遊戲已註冊測試 AI');
 adapters.set(type,adapter);
}
function botSupport(room){
 const type=room.type||'poker',adapter=adapters.get(type);
 if(!adapter)return {supported:false,canAdd:false};
 const count=type==='poker'?room.players.length:room.players.filter(p=>!p.kicked).length;
 return {supported:true,canAdd:count<adapter.maxPlayers&&(type!=='gift'||['waiting','finished'].includes(room.phase)),maxPlayers:adapter.maxPlayers,label:'本機測試 AI'};
}
function addTestBot(room){
 const support=botSupport(room);
 if(!support.supported)throw Error('此遊戲尚未提供測試 AI');
 if(!support.canAdd)throw Error(room.type==='gift'&&!['waiting','finished'].includes(room.phase)?'本局已開始，請等待下一局再加入 AI':'房間已滿');
 let number=1;while(room.players.some(p=>!p.kicked&&p.name===`測試 AI ${number}`))number++;
 return room.add(`測試 AI ${number}`,true);
}
const action=(id,name,data={})=>({actor:id,action:name,input:data,run:room=>room.act(id,name,data)});
const blankAnswer=(prompt,rng)=>{
 const options=/吃|食|餐|料理|早餐|點心|飲料/u.test(prompt)?['珍珠奶茶','披薩','麵包','咖啡']:/動物|寵物/u.test(prompt)?['貓','狗','兔子']:/旅行|國家|城市|出遊/u.test(prompt)?['台灣','日本','台北','海邊']:/顏色/u.test(prompt)?['藍色','綠色','紅色']:['朋友','音樂','遊戲','休息'];
 return options[rng(options.length)];
};
registerTestAI('poker',{maxPlayers:6,plan:()=>null}); // Existing poker scheduler handles these players.
registerTestAI('majority',{maxPlayers:12,plan(room,p){
 if(room.phase==='choosing'&&room.presenterId===p.id){
  if(room.candidates.length)return {actor:p.id,action:'ask',run:r=>r.act(p.id,'ask',{questionId:r.candidates[r.rng(r.candidates.length)].id})};
  return {actor:p.id,action:'draw',run:r=>r.act(p.id,'draw',{topic:TOPICS[r.rng(TOPICS.length)].id,type:['two','three','blank'][r.round%3]})};
 }
 if(room.phase==='answering'&&room.participantIds.includes(p.id)&&!Object.hasOwn(room.answers,p.id))return {actor:p.id,action:'answer',run:r=>{const q=r.view(p.id).question;r.act(p.id,'answer',{answer:q.type==='blank'?blankAnswer(q.prompt,r.rng):r.rng(q.options.length)});}};
 return null;
}});
registerTestAI('gift',{maxPlayers:8,plan(room,p){
 if(room.phase==='choosing'){
  if(!Object.hasOwn(room.assignments,p.id))return {actor:p.id,action:'give',run:r=>{const s=r.view(p.id),gifts=shuffle(s.gifts,r.rng);r.act(p.id,'give',{assignments:Object.fromEntries(s.players.filter(q=>q.id!==p.id).map((q,i)=>[q.id,gifts[i].id]))});}};
  if(!Object.hasOwn(room.rankings,p.id))return {actor:p.id,action:'wish',run:r=>{const gifts=shuffle(r.view(p.id).gifts,r.rng);r.act(p.id,'wish',{ranking:Object.fromEntries(['great','good','ok','noWay'].map((key,i)=>[key,gifts[i].id]))});}};
 }
 if(room.phase==='delivering'&&room.delivery.order[room.delivery.index]===p.id)return action(p.id,'accept',{recipientId:p.id});
 return null;
}});
registerTestAI('draw',{maxPlayers:8,plan(room,p,cache){
 const s=room.view(p.id);
 if(s.phase==='choosing'&&s.presenterId===p.id){
  const options=s.candidates.filter(hasSketch),candidates=options.length?options:s.candidates;
  if(candidates.length)return {actor:p.id,action:'choose',run:r=>r.act(p.id,'choose',{questionId:candidates[r.rng(candidates.length)].id})};
 }
 if(s.phase!=='drawing')return null;
 if(s.presenterId===p.id){
  if(!cache.sketch)cache.sketch=sketchFor(s.question);
  const shape=cache.sketch[cache.stroke||0];if(!shape)return null;
  const data={...shape,round:s.round,canvasEpoch:s.canvasEpoch,batchId:randomUUID(),strokeId:randomUUID()};
  return {actor:p.id,action:'draw-stroke',input:data,delay:400,run:r=>r.addStroke(p.id,data),after:()=>{cache.stroke=(cache.stroke||0)+1;},stroke:true};
 }
 if(!s.participantIds.includes(p.id)||s.guessedIds.includes(p.id)||!room.canvas.strokes.length)return null;
 // Word banks and hints are public. Never inspect room.question or another
 // player's private view when choosing a guess.
 const pools=room.wordPools(),words=[...pools.builtin,...pools.custom].filter(word=>[...word.title].length===s.hint?.length&&(!s.hint?.topicLabel||word.topicLabel===s.hint.topicLabel||word.custom));
 cache.guessed||=new Set();const choices=words.filter(word=>!cache.guessed.has(word.title));
 if(!choices.length)return null;
 return {actor:p.id,action:'guess',delay:2400,run:r=>{const answer=choices[r.rng(choices.length)].title;r.act(p.id,'guess',{answer});cache.guessed.add(answer);}};
}});
function runTestAIStep(room,{history,now=Date.now(),onDrawStroke=()=>{}}){
 const adapter=adapters.get(room.type||'poker');if(!adapter||['waiting','finished','showdown'].includes(room.phase)||history.isPaused?.(room))return false;
 let state=runtime.get(room);const key=[room.round,room.phase,room.presenterId,room.canvas?.epoch].join(':');
 if(!state||state.key!==key){state={key,players:new Map(),cursor:0};runtime.set(room,state);}
 const bots=room.players.filter(p=>p.bot&&!p.kicked&&!p.waitingForNextRound);if(!bots.length)return false;
 for(let offset=0;offset<bots.length;offset++){
  const index=(state.cursor+offset)%bots.length,p=bots[index];
  if(!state.players.has(p.id))state.players.set(p.id,{at:now});const cache=state.players.get(p.id);
  if(now-cache.at<400)continue;
  const operation=adapter.plan(room,p,cache);if(!operation||now-cache.at<(operation.delay||1200))continue;
  const result=history.transact(room,{action:operation.action,source:'bot',actor:p.id,...(operation.input?{input:operation.input}:{})},()=>operation.run(room));
  cache.at=now;operation.after?.();state.cursor=(index+1)%bots.length;
  if(operation.stroke)onDrawStroke(room.code,'stroke',result);
  return true;
 }
 return false;
}
module.exports={registerTestAI,botSupport,addTestBot,runTestAIStep};
