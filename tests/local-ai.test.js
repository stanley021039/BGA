const {test}=require('node:test'),assert=require('node:assert/strict');
const {MajorityRoom}=require('../src/games/majority');
const {GiftRoom}=require('../src/games/gift');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {Room}=require('../src/games/poker');
const {addTestBot,botSupport,runTestAIStep,registerTestAI}=require('../src/ai');
const {leavePlayer,expireEmptyRooms}=require('../src/rooms/lifecycle');
function harness(t,RoomClass){
 let now=100000;t.mock.method(Date,'now',()=>now);
 const room=new RoomClass('AIROOM','AI test',()=>0,()=>now),human=room.add('human'),records=[],strokes=[];
 const history={transact(r,operation,run){records.push(operation);return run();}};
 const tick=(count=1)=>{for(let i=0;i<count;i++){now+=400;runTestAIStep(room,{history,now,onDrawStroke:(...args)=>strokes.push(args)});}};
 return {room,human,history,records,strokes,tick,advance:ms=>{now+=ms;},now:()=>now};
}
test('each supported game accepts AI up to capacity with unique visible names',()=>{
 for(const [RoomClass,max]of [[Room,6],[MajorityRoom,12],[GiftRoom,8],[DrawGuessRoom,8]]){
  const r=new RoomClass('T','T'),human=r.add('human');
  for(let i=1;i<max;i++){const bot=addTestBot(r);assert.equal(bot.bot,true);assert.equal(bot.name,`測試 AI ${i}`);}
  assert.equal(botSupport(r).canAdd,false);assert.throws(()=>addTestBot(r),/已滿/);
  assert.equal(r.view(human.id).players.filter(p=>p.bot).length,max-1);
 }
 assert.deepEqual(botSupport({type:'thunder'}),{supported:false,canAdd:false});
 assert.throws(()=>addTestBot({type:'unknown'}),/尚未/);
});
test('majority bots answer privately, take presenter turns, and leave scoring to the human',t=>{
 const h=harness(t,MajorityRoom),r=h.room,a=addTestBot(r),b=addTestBot(r);
 r.configure(h.human.id,{rounds:3});r.start();
 r.act(h.human.id,'ask',{type:'two',prompt:'午餐吃什麼？',options:['麵','飯']});
 h.tick(12);assert.deepEqual(Object.keys(r.answers).sort(),[a.id,b.id].sort());
 assert.equal(r.view(h.human.id).answers,undefined);assert.equal(r.phase,'answering');
 r.act(h.human.id,'answer',{answer:0});assert.equal(r.phase,'reveal');
 r.act(h.human.id,'next');assert.equal(r.presenterId,a.id);
 h.tick(18);assert.equal(r.phase,'answering');assert.equal(r.question.type,'blank');
 r.act(h.human.id,'answer',{answer:'朋友'});h.tick(18);assert.equal(r.phase,'review');
 h.tick(20);assert.equal(r.phase,'review');r.act(h.human.id,'score');assert.equal(r.phase,'reveal');
 assert.ok(h.records.every(op=>op.source==='bot'));assert.ok(h.records.some(op=>op.action==='ask'));
});
test('gift AI locks unique gifts and wishes and confirms only its own delivery',t=>{
 const h=harness(t,GiftRoom),r=h.room;addTestBot(r);addTestBot(r);r.start();
 assert.equal(botSupport(r).canAdd,false);assert.throws(()=>addTestBot(r),/等待下一局/);
 h.tick(24);assert.equal(Object.keys(r.assignments).length,2);assert.equal(Object.keys(r.rankings).length,2);
 assert.equal(r.view(h.human.id).ownAssignments,null);assert.equal(r.phase,'choosing');
 const gifts=r.gifts,others=r.activePlayers().filter(p=>p.id!==h.human.id);
 r.act(h.human.id,'give',{assignments:Object.fromEntries(others.map((p,i)=>[p.id,gifts[i].id]))});
 r.act(h.human.id,'wish',{ranking:Object.fromEntries(['great','good','ok','noWay'].map((key,i)=>[key,gifts[i].id]))});
 h.tick(12);assert.equal(r.phase,'delivering');assert.equal(r.delivery.order[r.delivery.index],h.human.id);
 r.act(h.human.id,'accept',{recipientId:h.human.id});h.tick(24);assert.equal(r.phase,'reveal');
 h.tick(20);assert.equal(r.phase,'reveal');assert.equal(r.result.entries.length,6);
});
test('draw AI guesses from its public view without accessing the hidden question',t=>{
 const h=harness(t,DrawGuessRoom),r=h.room,bot=addTestBot(r),word={id:'custom-one',title:'測試星星',aliases:[],category:'自訂',topic:'custom',topicLabel:'自訂',custom:true};
 r.wordProvider=()=>[word];r.options.topics=['custom'];r.start();r.choose(h.human.id,word.id);
 r.addStroke(h.human.id,{round:r.round,canvasEpoch:r.canvas.epoch,batchId:'11111111',strokeId:'11111111',tool:'line',color:'#273942',size:5,points:[[100,100],[150,150]]});
 assert.equal(r.view(bot.id).question,null);assert.deepEqual(r.view(bot.id).candidates,[]);
 const guarded=new Proxy(r,{get(target,key){if(key==='question'||key==='candidates')throw Error('private state access');const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 for(let i=0;i<16;i++){h.advance(400);runTestAIStep(guarded,{history:h.history,now:h.now()});}
 assert.equal(r.phase,'reveal');assert.ok(r.guessedIds.includes(bot.id));
 assert.equal(r.resultVote(r.result.resultId,h.human.id).total,1);
 assert.equal(r.resultVote(r.result.resultId,bot.id).canVote,false);
});
test('draw AI chooses and publishes legal strokes and is not mistaken for a disconnected artist',t=>{
 const h=harness(t,DrawGuessRoom),r=h.room,bot=addTestBot(r);
 r.start();r.choose(h.human.id,r.candidates[0].id);r.reveal();r.next(h.human.id);
 h.tick(22);assert.equal(r.presenterId,bot.id);assert.equal(r.phase,'drawing');
 assert.ok(r.canvas.strokes.length>0);assert.equal(h.strokes.length,r.canvas.strokes.length);
 assert.ok(h.strokes.every(([code,kind,data])=>code===r.code&&kind==='stroke'&&data.canvasEpoch===r.canvas.epoch));
 h.advance(16000);assert.equal(r.auto(),false);assert.equal(r.view(h.human.id).players.find(p=>p.bot).online,true);
 r.guess(h.human.id,r.question.title);assert.equal(r.phase,'reveal');
});
test('paused history blocks AI mutations and kicking bots or leaving the last human cleans up',t=>{
 const h=harness(t,MajorityRoom),r=h.room,a=addTestBot(r);addTestBot(r);r.start();
 r.act(h.human.id,'ask',{type:'two',prompt:'選一個',options:['一','二']});
 h.advance(5000);runTestAIStep(r,{history:{...h.history,isPaused:()=>true},now:h.now()});assert.deepEqual(r.answers,{});
 r.kick(h.human.id,a.id);h.tick(12);assert.equal(Object.keys(r.answers).length,1);assert.ok(!Object.hasOwn(r.answers,a.id));
 assert.equal(leavePlayer(r,h.human.id).deleted,true);
 const rooms=new Map([[r.code,r]]);h.human.lastSeen=0;
 expireEmptyRooms({rooms,history:{interrupt(){}},now:h.now()});assert.equal(rooms.size,0);
});
test('future game adapters use the shared add and scheduler contract',t=>{
 const h=harness(t,MajorityRoom),r=h.room;r.type='future-test-game';
 registerTestAI(r.type,{maxPlayers:4,plan(room,p){return room.answers[p.id]?null:{actor:p.id,action:'test',run:room=>{room.answers[p.id]='done';}};}});
 const bot=addTestBot(r);r.phase='answering';h.tick(8);assert.equal(r.answers[bot.id],'done');assert.equal(botSupport(r).supported,true);
});
