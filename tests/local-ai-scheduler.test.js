const {test}=require('node:test'),assert=require('node:assert/strict');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {validateWord}=require('../src/games/draw-guess-store');
const {MajorityRoom}=require('../src/games/majority');
const {addTestBot}=require('../src/ai');
const {startRoomScheduler}=require('../src/rooms/scheduler');

function schedulerHarness(t,RoomClass=DrawGuessRoom,title='手機'){
 let now=100000;
 t.mock.method(Date,'now',()=>now);
 const callbacks=[],records=[],strokes=[],errors=[];
 t.mock.method(global,'setInterval',fn=>{callbacks.push(fn);return {unref(){}};});
 t.mock.method(global,'clearInterval',()=>{});
 t.mock.method(console,'error',(...args)=>errors.push(args));
 const room=new RoomClass('AITIME','AI timeout',()=>0,()=>now),human=room.add('human'),bot=addTestBot(room);
 if(RoomClass===DrawGuessRoom){
  const word={...validateWord({title,aliases:[],difficulty:'easy',topic:'objects'}),id:'custom-timeout',custom:true};
  room.wordProvider=()=>[word];room.options.topics=['custom'];room.options.seconds=60;
  room.start();room.choose(human.id,room.candidates[0].id);room.reveal();room.next(human.id);
 }
 const history={transact(r,operation,run){records.push(operation);return run();}};
 const stop=startRoomScheduler({rooms:new Map([[room.code,room]]),history,onDrawStroke:(...args)=>strokes.push(args)});
 t.after(stop);
 return {room,human,bot,records,strokes,errors,setNow:value=>{now=value;},tick(){now+=400;human.lastSeen=now;callbacks[1]();}};
}

test('scheduler reveals an unfinished AI drawing at the deadline before attempting another stroke',t=>{
 const h=schedulerHarness(t),r=h.room;
 for(let i=0;i<6;i++)h.tick();
 assert.equal(r.phase,'drawing');assert.equal(r.presenterId,h.bot.id);
 assert.equal(r.canvas.strokes.length,1);const strokeCount=r.canvas.strokes.length;
 const deadline=r.deadline;
 h.setNow(deadline-400);h.tick();
 assert.equal(r.phase,'reveal');assert.equal(r.result.reason,'時間到');
 assert.equal(r.canvas.strokes.length,strokeCount);assert.equal(h.strokes.length,strokeCount);
 assert.equal(h.errors.length,0);assert.equal(h.records.at(-1).source,'timeout');
 for(let i=0;i<10;i++)h.tick();
 assert.equal(r.phase,'reveal');assert.equal(h.errors.length,0);
 h.setNow(r.deadline-400);h.tick();assert.equal(r.phase,'finished');
});

test('AI action failure when the clock crosses the deadline still reveals in the same scheduler tick',t=>{
 const h=schedulerHarness(t),r=h.room;
 for(let i=0;i<6;i++)h.tick();assert.equal(r.phase,'drawing');
 t.mock.method(r,'addStroke',()=>{h.setNow(r.deadline);throw Error('作畫時間已結束');});
 h.tick();
 assert.equal(h.errors.length,1);assert.match(h.errors[0][1].message,/作畫時間已結束/);
 assert.equal(r.phase,'reveal');assert.equal(r.result.reason,'時間到');
 assert.equal(h.records.at(-1).source,'timeout');assert.equal(h.strokes.length,1);
});

test('a repeated AI planning failure before the deadline does not block later timeout progression',t=>{
 const h=schedulerHarness(t),r=h.room;
 for(let i=0;i<6;i++)h.tick();
 t.mock.method(r,'view',()=>{throw Error('AI planning failed');});
 for(let i=0;i<3;i++)h.tick();assert.equal(h.errors.length,3);assert.equal(r.phase,'drawing');
 h.setNow(r.deadline-400);h.tick();assert.equal(r.phase,'reveal');assert.equal(h.errors.length,3);
});

test('majority timeout at the exact deadline precedes the AI answer',t=>{
 const h=schedulerHarness(t,MajorityRoom),r=h.room;
 addTestBot(r);r.start();r.act(h.human.id,'ask',{type:'two',prompt:'選一個',options:['一','二']});
 h.tick();h.setNow(r.deadline-400);h.tick();
 assert.equal(r.phase,'reveal');assert.equal(r.closedReason,'timeout');
 assert.deepEqual(r.answers,{});assert.equal(h.errors.length,0);
 assert.deepEqual(h.records.map(op=>op.source),['timeout']);
});

for(const title of ['__proto__','constructor','toString','hasOwnProperty','proto']){
 test(`AI draws a validated custom title ${title} using legal fallback strokes`,t=>{
  const h=schedulerHarness(t,DrawGuessRoom,title),r=h.room;
  for(let i=0;i<8;i++)h.tick();
  assert.equal(r.phase,'drawing');assert.equal(r.question.title,title);
  assert.equal(h.errors.length,0);assert.equal(r.canvas.strokes.length,3);
  assert.equal(h.strokes.length,3);assert.ok(h.strokes.every(([code,kind,data])=>code===r.code&&kind==='stroke'&&data.canvasEpoch===r.canvas.epoch));
 });
}
