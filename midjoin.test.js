const {test}=require('node:test'),assert=require('node:assert/strict');
const {MajorityRoom}=require('./majority');
function room(){const r=new MajorityRoom('TEST','Test');for(let i=0;i<3;i++)r.add('P'+i);r.start();return r;}
function ask(r,type='two'){r.act(r.presenterId,'ask',{type,prompt:'早餐？',options:type==='blank'?[]:['A','B']});}
function answerAll(r,answers){r.participantIds.forEach((id,i)=>r.act(id,'answer',{answer:answers[i]}));}
test('joining an active question preserves participants, hidden answers and scoring until next question',()=>{
 const r=room();ask(r,'blank');r.act(r.host,'answer',{answer:'A'});const late=r.add('Late');
 assert.equal(late.waitingForNextRound,true);assert.equal(r.participantIds.length,3);assert.equal(r.view(late.id).answers,undefined);
 assert.throws(()=>r.act(late.id,'answer',{answer:'A'}),/下一題/);assert.throws(()=>r.act(late.id,'withdraw'),/下一題/);
 r.act(late.id,'enqueue',{type:'two',prompt:'Next',options:['A','B']});r.act(late.id,'react',{emoji:'👍'});
 r.act(r.players[1].id,'answer',{answer:'B'});r.act(r.players[2].id,'answer',{answer:'C'});r.act(r.host,'score');
 assert.equal(r.result.presenterPenalty,1);assert.equal(late.score,0);assert.equal(r.result.missingIds.length,0);
 r.act(r.host,'next');assert.equal(r.presenterId,late.id);assert.ok(r.participantIds.includes(late.id));assert.equal(late.waitingForNextRound,false);
 r.act(late.id,'answer',{answer:0});assert.equal(r.answers[late.id],0);
});
test('joining during choosing cannot become presenter through pass or answer this question',()=>{
 const r=room(),late=r.add('Late');for(let i=0;i<6;i++){r.act(r.host,'pass');assert.notEqual(r.presenterId,late.id);}
 ask(r);assert.throws(()=>r.act(late.id,'answer',{answer:0}));answerAll(r,[0,0,1]);r.act(r.host,'next');assert.ok(r.participantIds.includes(late.id));
});
test('joining during review/reveal or after finish leaves settled scores and winners unchanged',()=>{
 const r=room();r.roundLimit=3;ask(r,'blank');answerAll(r,['A','A','B']);const review=r.add('Review');r.act(r.host,'score');
 assert.equal(review.score,0);assert.equal(r.groups[0].count,2);const reveal=r.add('Reveal');r.act(r.host,'next');assert.equal(r.participantIds.length,5);
 for(let round=2;round<=3;round++){ask(r);answerAll(r,r.participantIds.map(()=>0));r.act(r.host,'next');}
 const winner=JSON.stringify(r.winner),finished=r.add('After');assert.equal(JSON.stringify(r.winner),winner);assert.equal(finished.score,0);assert.equal(finished.waitingForNextRound,true);
 r.start();assert.equal(finished.waitingForNextRound,false);assert.equal(r.participantIds.length,6);assert.ok(r.players.every(p=>p.score===0));
});
test('kicking a queued newcomer removes prepared questions without changing active answers',()=>{
 const r=room();ask(r);const late=r.add('Late');r.act(late.id,'enqueue',{type:'two',prompt:'Next',options:['A','B']});
 r.act(r.host,'answer',{answer:0});r.kick(r.host,late.id);assert.equal(r.questionQueue.length,0);assert.equal(r.participantIds.length,3);assert.equal(r.answers[r.host],0);assert.equal(r.phase,'answering');
});
test('a newcomer waiting for the next game is excluded from a zero-score tie',()=>{
 const r=room();r.roundLimit=1;ask(r);const late=r.add('Late');answerAll(r,[0,1,1]);r.players.forEach(p=>p.score=0);r.act(r.host,'next');assert.ok(!r.winner.ids.includes(late.id));assert.equal(r.winner.ids.length,3);
});
