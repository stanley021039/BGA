'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const {MajorityRoom}=require('../src/games/majority'),{CRUEL_QUESTIONS}=require('../src/games/majority-cruel-catalog'),{TOPICS}=require('../src/games/majority-questions');
function room(n=4,rules='teams',scoring='majority'){const r=new MajorityRoom('ABCDEF','cruel',()=>0);for(let i=0;i<n;i++)r.add('P'+i);r.configure(r.host,{mode:'cruel',cruelRules:rules,cruelScoring:scoring});return r;}
const act=(r,p,a,data={})=>r.act(p.id,a,{questionId:r.question?.id,...data});
function answer(r,list){list.forEach((a,i)=>act(r,r.players[i],'answer',{answer:a}));}
test('96 distinct two-image cards with six balanced themes, safe local assets and no third-party scans',()=>{
 assert.equal(CRUEL_QUESTIONS.length,96);assert.equal(new Set(CRUEL_QUESTIONS.map(q=>q.id)).size,96);assert.equal(TOPICS.find(t=>t.id==='cruel').label,'殘酷2選1');
 const themes={};for(const q of CRUEL_QUESTIONS){themes[q.theme]=(themes[q.theme]||0)+1;assert.equal(q.type,'two');assert.equal(q.options.length,2);assert.equal(new Set(q.options).size,2);assert.equal(q.images.length,2);for(const url of q.images){assert.match(url,/^\/assets\/majority-cruel\/cruel-two-\d{3}-[ab]\.svg$/);const svg=fs.readFileSync(path.join(__dirname,'../public',url),'utf8');assert.ok(svg.includes('<title>'));assert.doesNotMatch(svg,/<script|(?:href|src)="https?:|onload=/);}}assert.equal(Object.keys(themes).length,6);assert.ok(Object.values(themes).every(n=>n===16));
});
test('team play accepts exactly 4/6/8, individual accepts 1–12; settings are host-only and freeze at start',()=>{
 for(const n of [1,2,3,5,7,9])assert.throws(()=>room(n).start(),/4、6/);for(const n of [4,6,8]){const r=room(n);r.start();assert.equal(r.phase,'answering');assert.equal(r.roundLimit,10);assert.equal(r.cruelTeams.length,n/2);assert.throws(()=>r.configure(r.host,{mode:'majority',rounds:3}));}
 const r=room(1,'individual');r.start();assert.equal(r.participantIds.length,1);const rr=room();assert.throws(()=>rr.configure(rr.players[1].id,{mode:'cruel'}));assert.throws(()=>rr.configure(rr.host,{mode:'bad'}));
});
test('host can pair any two distinct players without duplicate seats, then pairing locks',()=>{
 const r=room();act(r,r.players[0],'pair',{playerId:r.players[0].id,partnerId:r.players[2].id});assert.deepEqual(r.setupCruelTeams()[0].members,[r.players[0].id,r.players[2].id]);assert.equal(new Set(r.setupCruelTeams().flatMap(t=>t.members)).size,4);
 assert.throws(()=>act(r,r.players[1],'pair',{playerId:r.players[0].id,partnerId:r.players[1].id}));r.start();assert.throws(()=>act(r,r.players[0],'pair',{playerId:r.players[0].id,partnerId:r.players[1].id}));
});
test('pairs score independently even when table answers are tied, and never settle twice',()=>{
 const r=room();r.start();answer(r,[0,0,1,1]);assert.deepEqual(r.cruelTeams.map(t=>t.score),[1,1]);assert.deepEqual(r.players.map(p=>p.score),[1,1,1,1]);assert.throws(()=>r.score());act(r,r.players[0],'next');answer(r,[0,1,0,0]);assert.deepEqual(r.cruelTeams.map(t=>t.score),[1,2]);
});
test('secret answers reveal only after everyone responds; late joiners cannot join or alter current pairings',()=>{
 const r=room();r.start();act(r,r.players[0],'answer',{answer:0});const s=r.view(r.players[1].id);assert.equal(s.answers,undefined);assert.deepEqual(s.groups,[]);assert.equal(s.ownAnswer,null);const late=r.add('LATE');assert.throws(()=>act(r,late,'answer',{answer:0}));[1,2,3].forEach(i=>act(r,r.players[i],'answer',{answer:1}));act(r,r.players[0],'next');assert.equal(r.participantIds.includes(late.id),false);
});
test('one replacement per person per match; no repeat cards, stale answers and concurrent replacements are refused',()=>{
 const r=room();r.start();const old=r.question.id;act(r,r.players[0],'replace');assert.notEqual(r.question.id,old);assert.throws(()=>r.act(r.players[1].id,'answer',{questionId:old,answer:1}),/更新/);assert.throws(()=>r.act(r.players[1].id,'replace',{questionId:old}),/更新/);assert.throws(()=>act(r,r.players[0],'replace'),/用完/);assert.equal(r.cruelSkipped[r.players[1].id],undefined);act(r,r.players[1],'answer',{answer:1});assert.throws(()=>act(r,r.players[2],'replace'),/交卷/);
 [0,2,3].forEach(i=>act(r,r.players[i],'answer',{answer:0}));
});
test('ten actual questions conclude team match, ties share victory and restart resets scores/skips',()=>{
 const r=room();r.start();act(r,r.players[0],'replace');const seen=new Set();for(let i=1;i<=10;i++){seen.add(r.question.id);answer(r,[0,0,1,1]);act(r,r.players[0],'next');}assert.equal(seen.size,10);assert.equal(r.phase,'finished');assert.equal(r.results.length,10);assert.equal(r.winner.ids.length,4);assert.deepEqual(r.view(r.host).cruel.teams.map(t=>t.score),[10,10]);r.start();assert.equal(r.round,1);assert.deepEqual(r.cruelSkipped,{});assert.deepEqual(r.cruelTeams.map(t=>t.score),[0,0]);
});
test('individual majority/minority scoring and ties use settings fixed before answering',()=>{
 for(const scoring of ['majority','minority']){const r=room(4,'individual',scoring);r.start();answer(r,[0,0,0,1]);assert.deepEqual(r.players.map(p=>p.score),scoring==='majority'?[1,1,1,0]:[0,0,0,1]);act(r,r.players[0],'next');answer(r,[0,0,1,1]);assert.deepEqual(r.result.gains,Object.fromEntries(r.players.map(p=>[p.id,0])));if(scoring==='minority'){act(r,r.players[0],'next');answer(r,[0,0,0,0]);assert.ok(Object.values(r.result.gains).every(n=>n===0));}}
});
test('a genuine solo game records ten preferences with no fabricated score or winning opponent',()=>{
 const r=room(1,'individual');r.start();for(let i=0;i<10;i++){act(r,r.players[0],'answer',{answer:i%2});act(r,r.players[0],'next');}const s=r.view(r.host);assert.equal(s.phase,'finished');assert.equal(s.cruel.recap.length,10);assert.equal(s.players[0].score,0);assert.deepEqual(s.winner.ids,[]);assert.equal(s.cruel.recap[1].answers[r.host],1);
});
test('timeout missing teammate scores zero, deadline rejects replacements, departure interrupts match',()=>{
 const r=room();r.start();act(r,r.players[0],'answer',{answer:0});act(r,r.players[2],'answer',{answer:1});act(r,r.players[3],'answer',{answer:1});r.deadline=Date.now()-1;r.auto();assert.deepEqual(r.cruelTeams.map(t=>t.score),[0,1]);assert.equal(r.result.missingIds.length,1);act(r,r.players[0],'next');r.deadline=Date.now()-1;assert.throws(()=>act(r,r.players[1],'replace'),/結束/);assert.equal(r.cruelSkipped[r.players[1].id],undefined);act(r,r.players[0],'next');r.kick(r.host,r.players[1].id);assert.equal(r.phase,'finished');assert.match(r.winner.reason,/離席/);
});
test('standard mode can draw the image category, but does not change its normal scoring; custom text cannot impersonate image cards',()=>{
 const r=new MajorityRoom('ABCDEF','normal',()=>0);for(let i=0;i<3;i++)r.add('P'+i);r.start();r.act(r.presenterId,'draw',{topic:'cruel',type:'two'});assert.equal(r.candidates.length,3);assert.ok(r.candidates.every(q=>q.images.length===2));r.act(r.presenterId,'ask',{questionId:r.candidates[0].id});answer(r,[0,0,1]);assert.deepEqual(r.players.map(p=>p.score),[1,1,0]);assert.throws(()=>require('../src/community/store').validateQuestion({topic:'cruel',type:'two',prompt:'fake',options:['A','B']}));
});
