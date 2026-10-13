'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {BluffRoom}=require('../src/games/bluff'),{QUESTIONS}=require('../src/games/bluff-catalog'),{addTestBot,runTestAIStep}=require('../src/ai');
function choose(r){if(r.phase==='selecting')r.act(r.thinkerId,'choose',{roundId:r.roundId,requestId:randomUUID(),questionId:r.choices[0].id});}
function setup(count=3){const room=new BluffRoom('ABC123','瞎掰測試',()=>0);for(let i=0;i<count;i++)room.add('玩家'+i);room.start();choose(room);return room;}
const act=(r,p,action,extra={})=>r.act(p,action,{roundId:r.roundId,requestId:randomUUID(),...extra});
function discuss(r){choose(r);for(const p of r.players)act(r,p.id,'ready');for(const p of r.players.filter(p=>p.id!==r.thinkerId))act(r,p.id,'spoken');}
test('expanded catalog keeps stable legacy IDs, unique questions, complete explanations and source provenance',()=>{assert.equal(QUESTIONS.length,148);for(const field of ['id','title'])assert.equal(new Set(QUESTIONS.map(q=>q[field])).size,148);const legacy=QUESTIONS.slice(0,60);assert.deepEqual(legacy.map(q=>q.id),Array.from({length:60},(_,i)=>'bk'+String(i+1).padStart(2,'0')));for(const level of [1,2,3])assert.equal(legacy.filter(q=>q.level===level).length,20);assert.ok(new Set(QUESTIONS.map(q=>q.category)).size>=20);for(const q of QUESTIONS){assert.ok([1,2,3].includes(q.level));assert.ok(q.answer.length<=240);assert.ok(q.explanation.detail.length>q.answer.length);assert.ok(q.explanation.example);assert.ok(q.explanation.clarification);assert.equal(new URL(q.source.url).protocol,'https:');assert.ok(['2026-10-09','2026-10-12'].includes(q.source.checkedAt));assert.ok(Object.isFrozen(q)&&Object.isFrozen(q.explanation));}});

test('only one honest player sees answer; no role roster, question source or future answers in views',()=>{const r=setup(9);for(const p of r.players){const s=r.view(p.id);assert.equal(s.secretAnswer,s.myRole==='honest'?r.question.answer:null);assert.deepEqual(s.secretExplanation,s.myRole==='honest'?r.question.explanation:null);assert.equal(s.roles,undefined);assert.equal(s.sequence,undefined);assert.equal(s.prompt.source,undefined);assert.equal(s.players.filter(p=>p.role).length,0);assert.equal(s.results.length,0);}assert.equal(r.players.filter(p=>r.roles[p.id]==='honest').length,1);assert.equal(new Set(r.sequence.map(q=>q.id)).size,9);assert.throws(()=>r.view('outsider'),/尚未入座/);});
test('hint contract has one, three or zero categories',()=>{for(const level of [1,2,3]){const r=new BluffRoom('ABC123','提示',()=>0);r.add('A');r.add('B');r.add('C');r.configure(r.host,{levels:[level]});r.start();choose(r);assert.equal(r.view(r.host).prompt.hints.length,level===1?1:level===2?3:0);if(level<3)assert.ok(r.view(r.host).prompt.hints.includes(r.question.category));}});
test('correct pick, honest challenge penalty and bluff challenge reward combine exactly once',()=>{const r=setup();discuss(r);const honest=r.players.find(p=>r.roles[p.id]==='honest'),bluffer=r.players.find(p=>r.roles[p.id]==='bluffer'),thinker=r.player(r.thinkerId);act(r,thinker.id,'challenge',{targetId:honest.id});act(r,thinker.id,'challenge',{targetId:bluffer.id});const data={roundId:r.roundId,requestId:randomUUID(),targetId:honest.id,confirmed:true};r.act(thinker.id,'guess',data);const expected=[thinker.score,honest.score,bluffer.score];assert.deepEqual(expected,[2,4,2]);r.act(thinker.id,'guess',data);assert.deepEqual([thinker.score,honest.score,bluffer.score],expected);assert.equal(r.results.length,1);assert.throws(()=>r.act(thinker.id,'guess',{...data,targetId:bluffer.id}),/內容不一致/);});
test('wrong pick awards only selected bluffer; scores may be negative',()=>{const r=setup();discuss(r);const honest=r.players.find(p=>r.roles[p.id]==='honest'),b=r.players.find(p=>r.roles[p.id]==='bluffer');r.player(r.thinkerId).score=0;act(r,r.thinkerId,'challenge',{targetId:honest.id});act(r,r.thinkerId,'guess',{targetId:b.id,confirmed:true});assert.equal(r.player(r.thinkerId).score,-3);assert.equal(honest.score,3);assert.equal(b.score,4);});
test('permissions, duplicate challenges, two-card limit and unfinished speeches reject without scores changing',()=>{const r=setup(4);const honest=r.players.find(p=>r.roles[p.id]==='honest');assert.throws(()=>act(r,r.thinkerId,'guess',{targetId:honest.id,confirmed:true}),/現在不能/);for(const p of r.players)act(r,p.id,'ready');assert.throws(()=>act(r,honest.id,'challenge',{targetId:r.thinkerId}),/只有想想/);assert.throws(()=>act(r,r.thinkerId,'challenge',{targetId:r.thinkerId}),/另一位/);assert.throws(()=>act(r,r.thinkerId,'guess',{targetId:honest.id,confirmed:true}),/說明完畢/);const others=r.players.filter(p=>p.id!==r.thinkerId);act(r,r.thinkerId,'challenge',{targetId:others[0].id});assert.throws(()=>act(r,r.thinkerId,'challenge',{targetId:others[0].id}),/不能重複/);act(r,r.thinkerId,'challenge',{targetId:others[1].id});assert.throws(()=>act(r,r.thinkerId,'challenge',{targetId:others[2].id}),/最多兩/);assert.ok(r.players.every(p=>p.score===3));});
test('every player becomes thinker once, finish and new match reset, stale round rejected',()=>{const r=setup(9),seen=[];for(let i=0;i<9;i++){seen.push(r.thinkerId);discuss(r);act(r,r.thinkerId,'guess',{targetId:r.players.find(p=>r.roles[p.id]==='honest').id,confirmed:true});if(i<8){const old=r.roundId;act(r,r.host,'next');assert.throws(()=>r.act(r.host,'ready',{roundId:old,requestId:randomUUID()}),/已換輪/);}}assert.equal(new Set(seen).size,9);assert.equal(r.phase,'finished');assert.equal(r.results.length,9);assert.ok(r.winner.names.length);r.start();choose(r);assert.equal(r.round,1);assert.equal(r.results.length,0);assert.ok(r.players.every(p=>p.score===3));});
test('leave interrupts without fake winner and prevents score mutation',()=>{const r=setup();discuss(r);r.kick(r.host,r.players[1].id);assert.equal(r.phase,'finished');assert.equal(r.interrupted,true);assert.equal(r.winner,null);assert.throws(()=>act(r,r.host,'guess',{targetId:r.players[2].id,confirmed:true}),/現在不能/);});
test('atomic start rejects bad rng; expanded single level supports nine players',()=>{const r=new BluffRoom('ABC123','rng',()=>99);for(let i=0;i<3;i++)r.add('p');assert.throws(()=>r.start(),/無效/);assert.equal(r.phase,'waiting');assert.ok(r.players.every(p=>p.score===0));const nine=setup(9);nine.phase='finished';nine.configure(nine.host,{levels:[1]});nine.start();choose(nine);assert.equal(nine.sequence.length,9);assert.equal(new Set(nine.sequence.map(q=>q.id)).size,9);assert.ok(nine.sequence.every(q=>q.level===1));});
test('script AI supports all roles using their own view and can finish an all-bot match',()=>{const r=new BluffRoom('ABC123','ai',()=>0);for(let i=0;i<3;i++)addTestBot(r);r.start();choose(r);for(let i=0;i<80&&r.phase!=='finished';i++){if(r.phase==='reveal')act(r,r.host,'next');else runTestAIStep(r,{now:Date.now()+i*10000,history:{transact(room,op,fn){fn();}}});}assert.equal(r.phase,'finished');assert.equal(r.results.length,3);});

test('single human start gives actionable player requirement, not RNG failure',()=>{const r=new BluffRoom('ABC123','single');r.add('Solo');assert.throws(()=>r.start(),e=>e.code==='NEED_PLAYERS');assert.equal(r.phase,'waiting');});

test('role time validates atomically, preserves difficulty, and closes private cards at exact expiry',()=>{
 let now=1000;const r=new BluffRoom('ABC123','clock',()=>0,()=>now);for(let i=0;i<3;i++)r.add('p'+i);
 assert.equal(r.options.roleSeconds,30);
 for(const roleSeconds of [10,30,60]){r.configure(r.host,{roleSeconds});r.start();choose(r);assert.equal(r.deadline,now+roleSeconds*1000);const honest=r.players.find(p=>r.roles[p.id]==='honest');now=r.deadline-1;assert.equal(r.view(honest.id).secretAnswer,r.question.answer);assert.deepEqual(r.view(honest.id).secretExplanation,r.question.explanation);r.auto();assert.equal(r.phase,'preparing');now++;assert.equal(r.view(honest.id).myRole,null);assert.equal(r.view(honest.id).secretAnswer,null);assert.equal(r.view(honest.id).secretExplanation,null);assert.throws(()=>act(r,honest.id,'ready'),/時間已結束/);r.auto();assert.equal(r.phase,'discussion');assert.equal(r.deadline,null);const version=r.version;r.auto();assert.equal(r.version,version);r.phase='finished';}
 for(const invalid of [0,9,11,61,'10',null,NaN]){const before=JSON.stringify(r.options);assert.throws(()=>r.configure(r.host,{roleSeconds:invalid}));assert.equal(JSON.stringify(r.options),before);}
 assert.throws(()=>r.configure(r.players[1].id,{roleSeconds:10}),/房主/);
 r.start();choose(r);assert.throws(()=>r.configure(r.host,{roleSeconds:60}),/開始後/);
});
test('all-ready advances early, no secret answer in discussion, and every round gets a fresh deadline',()=>{
 let now=1000;const r=new BluffRoom('ABC123','ready',()=>0,()=>now);for(let i=0;i<3;i++)r.add('p');r.configure(r.host,{roleSeconds:60});r.start();choose(r);const first=r.deadline;discuss(r);assert.equal(r.phase,'discussion');assert.ok(now<first);for(const p of r.players){assert.equal(r.view(p.id).myRole,null);assert.equal(r.view(p.id).secretAnswer,null);assert.equal(r.view(p.id).secretExplanation,null);}act(r,r.thinkerId,'guess',{targetId:r.players.find(p=>r.roles[p.id]==='honest').id,confirmed:true});now+=100000;act(r,r.host,'next');choose(r);assert.equal(r.deadline,now+60000);assert.equal(r.readyIds.length,0);
});
test('AI remembers only its own preparation answer when timeout skips its ready action',()=>{
 let now=1000;const r=new BluffRoom('ABC123','memory',()=>0,()=>now);r.add('human');addTestBot(r);addTestBot(r);r.configure(r.host,{roleSeconds:10});r.start();choose(r);const honest=r.players.find(p=>r.roles[p.id]==='honest'),answer=r.question.answer;assert.ok(honest.bot);now=r.deadline;r.auto();assert.equal(r.view(honest.id).secretAnswer,null);assert.equal(r.view(honest.id).secretExplanation,null);
 for(let i=0;i<10&&!r.spokenIds.includes(honest.id);i++)runTestAIStep(r,{now:now+i*2000,history:{transact(room,op,fn){return fn();}}});
 assert.equal(r.botStatements[honest.id],answer);assert.equal(r.view(r.host).botMemories,undefined);
});
test('scheduler advances bluff timeout through history before bot action',t=>{
 let now=1000;const callbacks=[],operations=[];t.mock.method(Date,'now',()=>now);t.mock.method(global,'setInterval',fn=>{callbacks.push(fn);return {unref(){}};});t.mock.method(global,'clearInterval',()=>{});
 const r=new BluffRoom('ABC123','scheduler',()=>0,()=>now);for(let i=0;i<3;i++)r.add('human');r.configure(r.host,{roleSeconds:10});r.start();choose(r);
 const stop=require('../src/rooms/scheduler').startRoomScheduler({rooms:new Map([[r.code,r]]),history:{transact(room,op,fn){operations.push(op);return fn();}}});t.after(stop);
 now=r.deadline;callbacks[1]();assert.equal(r.phase,'discussion');assert.deepEqual(operations.map(o=>o.source),['timeout']);callbacks[1]();assert.equal(operations.length,1);
});

test('random first thinker rotates in seat order once each for every possible start, and rerolls on rematch',()=>{
 for(const count of [3,9])for(let first=0;first<count;first++){
  let selected=first;const r=new BluffRoom('ABC123','rotation',n=>n===count?selected:0);
  for(let i=0;i<count;i++)r.add('seat'+i);
  const seats=r.players.map(p=>p.id);
  const play=()=>{
   const seen=[];r.start();choose(r);
   for(let round=0;round<count;round++){
    seen.push(r.view(r.host).thinkerId);discuss(r);
    act(r,r.thinkerId,'guess',{targetId:r.players.find(p=>r.roles[p.id]==='honest').id,confirmed:true});
    if(round<count-1)act(r,r.host,'next');
   }
   assert.equal(r.phase,'finished');assert.equal(new Set(seen).size,count);
   return seen;
  };
  assert.deepEqual(play(),seats.slice(first).concat(seats.slice(0,first)));
  selected=(first+1)%count;
  assert.deepEqual(play(),seats.slice(selected).concat(seats.slice(0,selected)));
 }
});
test('invalid first-thinker RNG fails before resetting match or mutating scores',()=>{
 const r=new BluffRoom('ABC123','atomic',n=>n===3?3:0);
 for(let i=0;i<3;i++)r.add('seat'+i);
 const before=JSON.stringify(r);
 assert.throws(()=>r.start(),/無效/);assert.equal(JSON.stringify(r),before);
});
test('random rotation excludes departed seats without exposing its future order',()=>{
 const r=new BluffRoom('ABC123','roster',n=>n===3?2:0);
 for(let i=0;i<4;i++)r.add('seat'+i);
 r.kick(r.host,r.players[1].id);
 const active=r.activePlayers().map(p=>p.id);r.start();choose(r);
 assert.equal(r.thinkerId,active[2]);assert.equal(r.roundLimit,3);
 assert.equal(r.view(r.host).thinkerOrder,undefined);
});

test('detailed explanation and all future question notes stay private until a result is revealed',()=>{const r=setup(9);for(const p of r.players){const v=r.view(p.id);if(v.myRole!=='honest')assert.ok(!JSON.stringify(v).includes(r.question.explanation.detail));for(const future of r.sequence.filter(q=>q.id!==r.question.id))assert.ok(!JSON.stringify(v).includes(future.explanation.detail));}discuss(r);for(const p of r.players)assert.ok(!JSON.stringify(r.view(p.id)).includes(r.question.explanation.detail));act(r,r.thinkerId,'guess',{targetId:r.players.find(p=>r.roles[p.id]==='honest').id,confirmed:true});for(const p of r.players)assert.deepEqual(r.view(p.id).results[0].explanation,r.question.explanation);});
