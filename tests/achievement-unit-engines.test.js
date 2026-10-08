const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {GiftRoom}=require('../src/games/gift');
const {MajorityRoom}=require('../src/games/majority');
const {rejoinPlayer}=require('../src/rooms/membership');
const {openDatabase}=require('../src/db');
const {AchievementStore}=require('../src/achievements/store');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fixture(game,count=3,capture=null,{botIndex}={}){
 const clock={time:1_000_000};
 const room=game==='draw'?new DrawGuessRoom('UNIT01','單位事件',()=>0,()=>clock.time):game==='gift'?new GiftRoom('UNIT01','單位事件',()=>0):new MajorityRoom('UNIT01','單位事件',()=>0);
 const players=Array.from({length:count},(_,i)=>room.add('玩家'+i));
 if(botIndex!==undefined)players[botIndex].bot=true;
 const mapping=new Map(players.map(player=>[player.id,randomUUID()]));
 const starts=[],events=[];
 Object.defineProperty(room,'achievementUnitStart',{configurable:true,value:context=>{
  starts.push(context);return capture?capture(context,mapping):context.participantSeatIds.filter(id=>!room.players.find(p=>p.id===id)?.bot).map(seat_id=>({seat_id,user_id:mapping.get(seat_id)}));
 }});
 Object.defineProperty(room,'achievementUnitCompleted',{configurable:true,value:event=>events.push(event)});
 room.start();
 return {room,players,mapping,starts,events,clock};
}
function draw(f){f.room.choose(f.room.presenterId,f.room.candidates[0].id);}
function stroke(f,data={}){
 return f.room.addStroke(f.room.presenterId,{round:f.room.round,canvasEpoch:f.room.canvas.epoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:5,points:[[1,2],[3,4]],...data});
}
function finishDraw(f){
 f.clock.time=f.room.deadline;for(const player of f.room.activePlayers())player.lastSeen=f.clock.time;
 f.room.auto();
}
function chooseGifts(f,{negative=false}={}){
 const {room}=f,players=room.activePlayers();
 for(const player of players){
  const ownIndex=f.players.findIndex(p=>p.id===player.id),own=room.gifts[ownIndex].id;
  room.act(player.id,'give',{assignments:Object.fromEntries(players.filter(p=>p.id!==player.id).map(p=>[p.id,room.gifts[f.players.findIndex(original=>original.id===p.id)].id]))});
  const rest=room.gifts.filter(gift=>gift.id!==own).slice(0,3).map(gift=>gift.id);
  room.act(player.id,'wish',{ranking:negative?{great:rest[0],good:rest[1],ok:rest[2],noWay:own}:{great:own,good:rest[0],ok:rest[1],noWay:rest[2]}});
 }
}
function acceptGifts(f){while(f.room.phase==='delivering'){const current=f.room.delivery.order[f.room.delivery.index];f.room.act(current,'accept',{recipientId:current});}}
function ask(f,type='two'){f.room.act(f.room.presenterId,'ask',{type,prompt:'不進事件的秘密題目',options:type==='blank'?[]:type==='three'?['秘密甲','秘密乙','秘密丙']:['秘密甲','秘密乙']});}
function answer(f,values){for(let i=0;i<values.length;i++)f.room.act(f.players[i].id,'answer',{answer:values[i]});}
function row(event,seat){return event.participants.find(p=>p.seat_id===seat.id);}
function assertPrivate(event){
 assert.deepEqual(Object.keys(event).sort(),['completed_at','game_type','match_id','metrics','participants','round','status','unit','unit_event_id'].sort());
 assert.match(event.unit_event_id,UUID);assert.match(event.match_id,UUID);
 assert.equal(event.unit,'round');assert.equal(new Date(event.completed_at).toISOString(),event.completed_at);
 assert.ok(Object.isFrozen(event));assert.ok(Object.isFrozen(event.participants));assert.ok(Object.isFrozen(event.metrics));
 for(const participant of event.participants){
  assert.ok(Object.isFrozen(participant));assert.equal(typeof participant.eligible,'boolean');
  assert.ok(Object.keys(participant).every(key=>['user_id','seat_id','eligible','strokeAccepted','guessAccepted','correctGuess','artist','receivedTwinGifts','positiveWish','answerAccepted'].includes(key)));
 }
 assert.ok(!/秘密|answer|assignments|rankings|giftId|question|canvas|strokeId|points|name/.test(JSON.stringify(event).replaceAll('answerAccepted','')));
}

for(const game of ['draw','gift','majority']){
 test(game+' freezes identity at start, latches minimal facts and requires explicit acknowledgement',()=>{
  const f=fixture(game),{room,starts,events,mapping,players}=f;
  const oldUser=mapping.get(players[0].id);
  mapping.set(players[0].id,randomUUID());
  assert.ok(Object.isFrozen(starts[0]));assert.ok(Object.isFrozen(starts[0].participantSeatIds));
  if(game==='draw'){draw(f);stroke(f);finishDraw(f);}else if(game==='gift'){chooseGifts(f);acceptGifts(f);}else{ask(f);answer(f,[0,0,0]);}
  assert.equal(events.length,1);assertPrivate(events[0]);assert.equal(row(events[0],players[0]).user_id,oldUser);
  assert.equal(events[0].unit_event_id,starts[0].unit_event_id);assert.equal(events[0].match_id,starts[0].match_id);
  assert.equal(events[0].status,'rules_completed');assert.equal(events[0].metrics.participantCount,3);
  for(let i=0;i<3;i++)room.view(players[0].id);assert.equal(events.length,1);
  const pending=room.pendingAchievementUnits();assert.deepEqual(pending,[events[0]]);pending.length=0;
  assert.deepEqual(room.drainAchievementUnits(),[events[0]]);
  assert.ok(!JSON.stringify(room).includes('unit_event_id'));assert.ok(!JSON.stringify(room.view(players[0].id)).includes('unit_event_id'));
  assert.equal(room.acknowledgeAchievementUnit(randomUUID()),false);
  assert.equal(room.acknowledgeAchievementUnit(events[0].unit_event_id),true);
  assert.equal(room.acknowledgeAchievementUnit(events[0].unit_event_id),false);
  assert.deepEqual(room.pendingAchievementUnits(),[]);
 });
 test(game+' preserves uppercase canonical DB account IDs and awards a normal unit',()=>{
  const f=fixture(game,3,(context,mapping)=>context.participantSeatIds.map(seat_id=>({seat_id,user_id:mapping.get(seat_id).toUpperCase()})));
  if(game==='draw'){draw(f);stroke(f);for(const player of f.players.slice(1))f.room.guess(player.id,f.room.question.title);}
  else if(game==='gift'){chooseGifts(f);acceptGifts(f);}else{ask(f);answer(f,[0,0,0]);}
  const event=f.events[0],userIds=f.players.map(player=>f.mapping.get(player.id).toUpperCase());
  assert.equal(event.status,'rules_completed');assert.equal(event.metrics.participantCount,3);
  for(const player of f.players)assert.equal(row(event,player).user_id,f.mapping.get(player.id).toUpperCase());
  const db=openDatabase(':memory:');
  try{
   for(const userId of userIds)db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(userId,userId,'會員','unused','member',new Date().toISOString());
   const store=new AchievementStore(db),result=store.processUnit(event),badge={draw:'draw-first-round',gift:'gift-first-gift',majority:'majority-first-vote'}[game];
   assert.equal(result.duplicate,false);
   for(const userId of userIds){
    assert.ok(result.awards.some(award=>award.user_id===userId&&award.achievement_id===badge));
    assert.equal(store.list(userId).achievements.find(item=>item.id===badge).unlockedAt,event.completed_at);
   }
   const stored=JSON.parse(db.prepare('SELECT facts_json FROM processed_unit_events WHERE unit_event_id=?').get(event.unit_event_id).facts_json);
   assert.deepEqual(new Set(stored.participants.map(participant=>participant.user_id)),new Set(userIds));
   assert.equal(stored.match_id,event.match_id);assert.equal(stored.unit_event_id,event.unit_event_id);
   assert.equal(f.room.acknowledgeAchievementUnit(event.unit_event_id),true);assert.deepEqual(f.room.pendingAchievementUnits(),[]);
  }finally{db.close();}
 });
 test(game+' completion hook failure cannot roll back the completed game or lose the latched event',()=>{
  const f=fixture(game),{room}=f;
  Object.defineProperty(room,'achievementUnitCompleted',{value:()=>{throw Error('temporary persistence failure');}});
  if(game==='draw'){draw(f);stroke(f);assert.doesNotThrow(()=>finishDraw(f));}else if(game==='gift'){chooseGifts(f);assert.doesNotThrow(()=>acceptGifts(f));}else{ask(f);assert.doesNotThrow(()=>answer(f,[0,0,0]));}
  assert.ok(['reveal','finished'].includes(room.phase));assert.equal(room.pendingAchievementUnits().length,1);
  assertPrivate(room.pendingAchievementUnits()[0]);assert.equal(room.pendingAchievementUnits()[0].status,'rules_completed');
 });
 test(game+' failed identity capture cannot attach current identities later in the round',()=>{
  const f=fixture(game),{room}=f;
  // Restart with a failing start hook; the completed notification remains usable.
  if(game==='draw'){while(room.phase!=='finished'){draw(f);finishDraw(f);room.next(room.host);}}
  else if(game==='gift'){room.kick(room.host,f.players[2].id);room.add('新朋友');}
  else{while(room.phase!=='finished'){ask(f);answer(f,[0,0,0]);room.act(room.host,'next');}}
  Object.defineProperty(room,'achievementUnitStart',{value:()=>{throw Error('identity unavailable');},configurable:true});
  assert.doesNotThrow(()=>room.start());
  Object.defineProperty(room,'achievementUnitStart',{value:context=>context.participantSeatIds.map(seat_id=>({seat_id,user_id:randomUUID()}))});
  if(game==='draw'){draw(f);stroke(f);finishDraw(f);}else if(game==='gift'){chooseGifts({...f,players:room.activePlayers()});acceptGifts(f);}else{ask(f);answer(f,[0,0,0]);}
  assert.deepEqual(f.events.at(-1).participants,[]);assert.ok(room.pendingAchievementUnits().includes(f.events.at(-1)));
  assert.equal(f.events.at(-1).status,'interrupted');assert.equal(f.events.at(-1).metrics.participantCount,0);
 });
 test(game+' identity failures persist once and acknowledge with zero awards or exploration progress',()=>{
  for(const failure of ['throw','missing','partial','invalid','duplicate']){
   const f=fixture(game,3,(context,mapping)=>{
    if(failure==='throw')throw Error('identity unavailable');
    if(failure==='missing')return undefined;
    const mapped=context.participantSeatIds.map(seat_id=>({seat_id,user_id:mapping.get(seat_id)}));
    if(failure==='partial')return mapped.slice(0,2);
    if(failure==='invalid')return [{...mapped[0],user_id:'name-is-not-an-account'},...mapped.slice(1)];
    return mapped.map((item,index)=>({...item,user_id:index?mapped[0].user_id.toUpperCase():mapped[0].user_id}));
   });
   if(game==='draw'){draw(f);stroke(f);finishDraw(f);}else if(game==='gift'){chooseGifts(f);acceptGifts(f);}else{ask(f);answer(f,[0,0,0]);}
   const event=f.events[0];assert.equal(event.status,'interrupted');assert.ok(event.metrics.participantCount<=event.participants.length);
   if(game==='majority'){assert.equal(event.metrics.allSame,false);assert.equal(event.metrics.tiedLargest,false);}
   const db=openDatabase(':memory:');
   try{
    for(const userId of f.mapping.values())db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(userId,userId,'會員','unused','member',new Date().toISOString());
    const store=new AchievementStore(db),result=store.processUnit(event);
    assert.equal(result.duplicate,false);assert.deepEqual(result.awards,[]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM processed_unit_events').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_achievements').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM achievement_progress').get().n,0);
    assert.equal(store.processUnit(event).duplicate,true);
    assert.equal(f.room.acknowledgeAchievementUnit(event.unit_event_id),true);assert.deepEqual(f.room.pendingAchievementUnits(),[]);
   }finally{db.close();}
  }
 });
}

test('draw accepted evidence survives undo/clear and duplicates; invalid or waiting-seat work cannot qualify',()=>{
 const f=fixture('draw'),{room,players,clock}=f;draw(f);
 const newcomer=room.add('旁觀者');f.mapping.set(newcomer.id,randomUUID());
 assert.throws(()=>room.addStroke(players[1].id,{round:room.round}),/畫者/);
 assert.throws(()=>room.guess(newcomer.id,'錯誤'),/下一輪/);
 assert.throws(()=>stroke(f,{color:'bad'}),/格式/);
 assert.throws(()=>room.guess(players[2].id,''),/猜測/);
 const batchId=randomUUID(),strokeId=randomUUID();stroke(f,{batchId,strokeId});
 room.canvasCommand(room.presenterId,{round:room.round,canvasEpoch:room.canvas.epoch,command:'undo'});
 assert.equal(stroke(f,{batchId,strokeId}).duplicate,true);
 room.canvasCommand(room.presenterId,{round:room.round,canvasEpoch:room.canvas.epoch,command:'clear'});
 assert.equal(room.canvas.strokes.length,0);assert.equal(room.canvas.batchIds.size,1);
 room.guess(players[1].id,'錯誤');clock.time+=800;room.guess(players[1].id,room.question.title);
 finishDraw(f);const event=f.events[0];
 assert.equal(row(event,players[0]).strokeAccepted,true);assert.equal(row(event,players[0]).artist,true);assert.equal(row(event,players[0]).eligible,true);
 assert.equal(row(event,players[1]).guessAccepted,true);assert.equal(row(event,players[1]).correctGuess,true);assert.equal(row(event,players[1]).eligible,true);
 assert.equal(row(event,players[2]).guessAccepted,false);assert.equal(row(event,players[2]).eligible,false);
 assert.equal(event.participants.some(p=>p.seat_id===newcomer.id),false);
});

test('draw normal all-guessed completion preserves an earlier departed participant and immutable result',()=>{
 const f=fixture('draw',4),{room,players}=f;draw(f);stroke(f);
 room.guess(players[1].id,room.question.title);room.kick(players[0].id,players[1].id,true);
 room.guess(players[2].id,room.question.title);room.guess(players[3].id,room.question.title);
 const event=f.events[0];assert.equal(event.status,'rules_completed');assert.equal(event.metrics.participantCount,3);
 assert.equal(row(event,players[1]).correctGuess,true);assert.equal(row(event,players[1]).eligible,true);
 room.kick(players[0].id,players[2].id);assert.equal(f.events.length,1);assert.equal(event.status,'rules_completed');
});

test('draw a departed guesser rejoining for the next round keeps earlier evidence but is not counted as a current seat',()=>{
 const f=fixture('draw',4),{room,players}=f;draw(f);stroke(f);
 room.guess(players[1].id,room.question.title);room.kick(room.host,players[1].id,true);
 rejoinPlayer(room,players[1].id,'再次入席');assert.equal(players[1].waitingForNextRound,true);
 assert.throws(()=>room.guess(players[1].id,room.question.title),/下一輪/);
 room.guess(players[2].id,room.question.title);room.guess(players[3].id,room.question.title);
 const event=f.events[0];assert.equal(event.status,'rules_completed');assert.equal(event.metrics.participantCount,3);
 assert.equal(row(event,players[1]).correctGuess,true);assert.equal(row(event,players[1]).eligible,true);
});

test('draw artist departure and offline reveal interrupt units, and player shortage abandons',()=>{
 for(const kind of ['artist-leave','offline','shortage']){
  const f=fixture('draw',kind==='shortage'?2:3),{room,players,clock}=f;draw(f);stroke(f);
  if(kind==='artist-leave'){room.host=players[1].id;room.kick(players[1].id,players[0].id,true);}
  else if(kind==='offline'){clock.time=room.deadline;room.auto();}
  else room.kick(players[0].id,players[1].id,true);
  assert.equal(f.events.length,1);assert.equal(f.events[0].status,kind==='shortage'?'abandoned':'interrupted');
  assert.equal(row(f.events[0],players[0]).strokeAccepted,true);
 }
});

test('draw snapshots keep match identity across rounds and create a fresh match on restart',()=>{
 const f=fixture('draw',2),{room,players}=f;
 for(let i=0;i<2;i++){draw(f);room.guess(room.participantIds[0],room.question.title);room.next(players[0].id);}
 assert.equal(f.events.length,2);assert.equal(f.events[0].match_id,f.events[1].match_id);assert.notEqual(f.events[0].unit_event_id,f.events[1].unit_event_id);
 room.start();assert.notEqual(f.starts[2].match_id,f.events[0].match_id);assert.equal(room.pendingAchievementUnits().length,2);
});

test('gift facts appear only after all recipient confirmations and count twins by exact gift identity',()=>{
 const f=fixture('gift');chooseGifts(f);assert.equal(f.events.length,0);assert.equal(f.room.phase,'delivering');
 const first=f.room.delivery.order[0];f.room.act(first,'accept',{recipientId:first});assert.equal(f.events.length,0);
 assert.throws(()=>f.room.act(first,'accept',{recipientId:first}),/目前|確認/);
 acceptGifts(f);assert.equal(f.events.length,1);
 assert.ok(f.events[0].participants.every(p=>p.eligible&&p.receivedTwinGifts&&p.positiveWish));
 assert.equal(f.events[0].status,'rules_completed');
});

test('gift dislikes do not count as a positive wish',()=>{
 const f=fixture('gift');chooseGifts(f,{negative:true});acceptGifts(f);
 assert.ok(f.events[0].participants.every(p=>p.receivedTwinGifts&&!p.positiveWish));
});

test('gift twins use distinct gift IDs rather than matching display names',()=>{
 const f=fixture('gift'),{room,players}=f;room.gifts=room.gifts.map(gift=>({...gift,name:'全部同名'}));
 for(let i=0;i<players.length;i++){
  room.act(players[i].id,'give',{assignments:Object.fromEntries(players.filter(p=>p!==players[i]).map(recipient=>[recipient.id,room.gifts[(i+players.indexOf(recipient))%room.gifts.length].id]))});
  room.act(players[i].id,'wish',{ranking:Object.fromEntries(['great','good','ok','noWay'].map((rank,index)=>[rank,room.gifts[index].id]))});
 }
 acceptGifts(f);assert.ok(f.events[0].participants.every(p=>!p.receivedTwinGifts));
});

test('gift unranked gifts never qualify as positive wishes',()=>{
 const f=fixture('gift',4),{room,players}=f;
 for(const player of players){
  room.act(player.id,'give',{assignments:Object.fromEntries(players.filter(p=>p!==player).map(recipient=>[recipient.id,room.gifts[recipient===players[0]?4:players.indexOf(recipient)].id]))});
  room.act(player.id,'wish',{ranking:Object.fromEntries(['great','good','ok','noWay'].map((rank,index)=>[rank,room.gifts[index].id]))});
 }
 acceptGifts(f);assert.equal(row(f.events[0],players[0]).positiveWish,false);assert.equal(row(f.events[0],players[0]).receivedTwinGifts,true);
});

test('gift removing an unconfirmed recipient interrupts delivery without changing the scoring flow',()=>{
 const f=fixture('gift',4);chooseGifts(f);
 for(let i=0;i<3;i++){const current=f.room.delivery.order[f.room.delivery.index];f.room.act(current,'accept',{recipientId:current});}
 const removed=f.room.player(f.room.delivery.order[f.room.delivery.index]);f.room.kick(f.room.host,removed.id,true);
 assert.ok(['reveal','finished'].includes(f.room.phase));assert.equal(f.events.length,1);assert.equal(f.events[0].status,'interrupted');
 assert.equal(row(f.events[0],removed).eligible,false);assert.equal(f.events[0].metrics.participantCount,3);
});

test('gift player shortage abandons pending facts, with no phantom normal completion',()=>{
 const f=fixture('gift');chooseGifts(f);f.room.kick(f.room.host,f.players[2].id);
 assert.equal(f.room.phase,'finished');assert.equal(f.events.length,1);assert.equal(f.events[0].status,'abandoned');
 assert.equal(f.room.pendingAchievementUnits()[0],f.events[0]);
});

test('majority official scoring emits after blank review/merges, never from the review preview',()=>{
 const f=fixture('majority');ask(f,'blank');answer(f,['甲','乙','丙']);
 assert.equal(f.room.phase,'review');assert.equal(f.events.length,0);
 const [a,b,c]=f.room.groups;f.room.act(f.room.host,'merge',{from:b.id,to:a.id});f.room.act(f.room.host,'merge',{from:c.id,to:a.id});
 assert.equal(f.events.length,0);f.room.act(f.room.host,'score');assert.equal(f.events.length,1);
 assert.equal(f.events[0].metrics.allSame,true);assert.equal(f.events[0].metrics.tiedLargest,false);
 assert.ok(f.events[0].participants.every(p=>p.answerAccepted&&p.eligible));
 assert.throws(()=>f.room.act(f.room.host,'score'),/階段/);assert.equal(f.events.length,1);
});

test('majority ties require multiple largest groups with at least two members each',()=>{
 const tied=fixture('majority',4);ask(tied);answer(tied,[0,1,0,1]);
 assert.equal(tied.events[0].metrics.tiedLargest,true);assert.equal(tied.events[0].metrics.allSame,false);
 const singleton=fixture('majority');ask(singleton,'three');answer(singleton,[0,1,2]);
 assert.equal(singleton.events[0].metrics.tiedLargest,false);
});

test('majority withdrawn/missing/kicked answers are ineligible and do not create all-same facts',()=>{
 const f=fixture('majority',4);ask(f);
 f.room.act(f.players[0].id,'answer',{answer:0});f.room.act(f.players[0].id,'withdraw');
 f.room.act(f.players[1].id,'answer',{answer:0});f.room.kick(f.room.host,f.players[1].id);
 f.room.act(f.players[2].id,'answer',{answer:0});f.room.act(f.room.host,'close');
 const event=f.events[0];assert.equal(event.metrics.participantCount,3);assert.equal(event.metrics.allSame,false);
 assert.equal(row(event,f.players[0]).answerAccepted,false);assert.equal(row(event,f.players[1]).answerAccepted,false);
 assert.equal(row(event,f.players[2]).eligible,true);assert.equal(row(event,f.players[3]).eligible,false);
});

test('majority waiting-seat joiners enter only the next frozen unit and shortage abandons the current one',()=>{
 const f=fixture('majority');ask(f);const late=f.room.add('晚入席');f.mapping.set(late.id,randomUUID());
 assert.throws(()=>f.room.act(late.id,'answer',{answer:0}),/下一題/);answer(f,[0,0,0]);
 assert.equal(f.events[0].participants.some(p=>p.seat_id===late.id),false);
 f.room.act(f.room.host,'next');ask(f);assert.ok(f.starts[1].participantSeatIds.includes(late.id));
 for(const p of f.players.slice(1))f.room.kick(f.room.host,p.id);f.room.kick(f.room.host,late.id);
 assert.equal(f.events[1].status,'abandoned');assert.equal(f.room.phase,'finished');
});

test('pending cap refuses a next round before mutating the result and recovers after acknowledgement',()=>{
 const f=fixture('majority');f.room.roundLimit=3;
 for(let i=0;i<256;i++){ask(f);answer(f,[0,0,0]);if(i<255){f.room.act(f.room.host,'next');if(f.room.phase==='finished')f.room.start();}}
 assert.equal(f.room.pendingAchievementUnits().length,256);const version=f.room.version,count=f.room.results.length,round=f.room.round;
 assert.throws(()=>f.room.act(f.room.host,'next'),/紀錄|儲存/);
 assert.equal(f.room.phase,'reveal');assert.equal(f.room.round,round);assert.equal(f.room.version,version);assert.equal(f.room.results.length,count);
 f.room.acknowledgeAchievementUnit(f.events[0].unit_event_id);f.room.act(f.room.host,'next');assert.equal(f.room.round,round+1);
});

test('gift pending cap preserves the completed round and resumes only after explicit acknowledgement',()=>{
 const f=fixture('gift');
 for(let i=0;i<256;i++){chooseGifts(f,{negative:true});acceptGifts(f);if(i<255)f.room.act(f.room.host,'next');}
 const result=f.room.result,version=f.room.version;assert.equal(f.room.pendingAchievementUnits().length,256);
 assert.throws(()=>f.room.act(f.room.host,'next'),/紀錄|儲存/);assert.equal(f.room.result,result);assert.equal(f.room.version,version);assert.equal(f.room.round,256);
 f.room.acknowledgeAchievementUnit(f.events[0].unit_event_id);f.room.act(f.room.host,'next');assert.equal(f.room.round,257);
});

test('draw pending cap permits final match closure but refuses a fresh match without losing old facts',()=>{
 const f=fixture('draw',2);
 for(let match=0;match<128;match++){
  if(match)f.room.start();
  for(let round=0;round<2;round++){draw(f);f.clock.time+=800;f.room.guess(f.room.participantIds[0],f.room.question.title);f.room.next(f.room.host);}
 }
 assert.equal(f.room.phase,'finished');assert.equal(f.room.pendingAchievementUnits().length,256);const run=f.room.gameRunId,version=f.room.version;
 assert.throws(()=>f.room.start(),/紀錄|儲存/);assert.equal(f.room.gameRunId,run);assert.equal(f.room.version,version);
 f.room.acknowledgeAchievementUnit(f.events[0].unit_event_id);f.room.start();assert.notEqual(f.room.gameRunId,run);assert.equal(f.room.round,1);
});

test('unhooked fixture play remains normal beyond the optional event retention cap',()=>{
 const room=new MajorityRoom('NOHOOK','原玩法',()=>0);for(let i=0;i<3;i++)room.add('P'+i);room.configure(room.host,{rounds:3});room.start();
 for(let i=0;i<260;i++){room.ask({type:'two',prompt:'普通題',options:['甲','乙']});for(const player of room.players)room.act(player.id,'answer',{answer:0});room.act(room.host,'next');if(room.phase==='finished')room.start();}
 assert.equal(room.phase,'choosing');assert.equal(room.round,3);assert.deepEqual(room.pendingAchievementUnits(),[]);
});

for(const game of ['draw','gift','majority'])for(const missingHuman of [false,true]){
 test(game+' mixed human/AI completion '+(missingHuman?'still fails closed for a missing human account':'grants eligible humans without mapping AI'),()=>{
  const f=fixture(game,4,missingHuman?(context,mapping)=>context.participantSeatIds.slice(1,3).map(seat_id=>({seat_id,user_id:mapping.get(seat_id)})):null,{botIndex:3});
  if(game==='draw'){draw(f);stroke(f);finishDraw(f);}else if(game==='gift'){chooseGifts(f);acceptGifts(f);}else{ask(f);answer(f,[0,0,0,0]);}
  assert.equal(f.events.length,1);const event=f.events[0];assert.equal(event.status,missingHuman?'interrupted':'rules_completed');
  assert.equal(event.participants.length,missingHuman?2:3);assert.ok(!event.participants.some(p=>p.seat_id===f.players[3].id));assertPrivate(event);
  const db=openDatabase(':memory:');try{
   for(const id of f.mapping.values())db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,id,'會員','unused','member',new Date().toISOString());
   const store=new AchievementStore(db);store.recordUnit({...event,purpose:'production'});
   const granted=db.prepare('SELECT COUNT(*) AS n FROM user_achievements').get().n;
   assert.equal(granted>0,!missingHuman);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_achievements WHERE user_id=?').get(f.mapping.get(f.players[3].id)).n,0);
  }finally{db.close();}
 });
}


for(const {name,count,botIndex,values,expected}of [
 {name:'all humans together',count:3,values:[0,0,0],expected:true},
 {name:'three humans plus AI together',count:4,botIndex:3,values:[0,0,0,0],expected:true},
 {name:'AI answer differs',count:4,botIndex:3,values:[0,0,0,1],expected:false},
 {name:'human answer differs',count:4,botIndex:3,values:[0,1,0,0],expected:false},
 {name:'only two humans plus AI together',count:3,botIndex:2,values:[0,0,0],expected:false},
])test('majority all-same: '+name,()=>{
 const f=fixture('majority',count,null,{botIndex});ask(f);answer(f,values);
 const event=f.events[0];assert.equal(event.status,'rules_completed');assert.equal(event.metrics.allSame,expected);
 assert.equal(event.metrics.participantCount,count-(botIndex===undefined?0:1));
 const db=openDatabase(':memory:');try{
  for(const id of f.mapping.values())db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,id,'會員','unused','member',new Date().toISOString());
  new AchievementStore(db).recordUnit({...event,purpose:'production'});
  const awarded=db.prepare("SELECT user_id FROM user_achievements WHERE achievement_id='majority-one-channel'").all().map(p=>p.user_id);
  assert.equal(awarded.length,expected?event.participants.length:0);
  if(botIndex!==undefined)assert.ok(!awarded.includes(f.mapping.get(f.players[botIndex].id)));
 }finally{db.close();}
});
