'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {starterIndex,starterOrder}=require('../src/games/random-starter');
const cases=[
 ['quacks',require('../src/games/quacks').QuacksRoom,r=>r.roundStarterId],
 ['minimal',require('../src/games/minimal').MinimalRoom,r=>r.guesserId],
 ['gift',require('../src/games/gift').GiftRoom,r=>r.dealerId],
 ['trpg',require('../src/games/trpg').TrpgRoom,r=>r.leaderId],
 ['majority',require('../src/games/majority').MajorityRoom,r=>r.presenterId],
 ['draw',require('../src/games/draw-guess').DrawGuessRoom,r=>r.presenterId],
 ['bluff',require('../src/games/bluff').BluffRoom,r=>r.thinkerId],
 ['poker',require('../src/games/poker').Room,r=>r.players[r.button].id]
];
for(const [name,Room,actor]of cases)test(name+': every eligible seat can start, host/seats stay fixed and restart rerolls',()=>{let selected=0,calls=0;const rng=n=>{calls++;return n===3?selected:0;},r=new Room('ABCDEF','random',rng),players=Array.from({length:3},(_,i)=>r.add('P'+i)),host=r.host,order=players.map(p=>p.id);for(selected=0;selected<3;selected++){r.phase=name==='poker'&&selected?'showdown':'waiting';r.start();assert.equal(actor(r),players[selected].id);assert.equal(r.host,host);assert.deepEqual(r.players.map(p=>p.id),order);const before=calls;r.view(players[0].id);r.view(players[1].id);assert.equal(calls,before);assert.equal(actor(r),players[selected].id);}});
test('cyclic drawing order preserves everyone once; invalid random indices are rejected',()=>{const p=['A','B','C'];assert.deepEqual(starterOrder(p,()=>1),['B','C','A']);assert.deepEqual(p,['A','B','C']);for(const value of [-1,3,NaN,1.5])assert.throws(()=>starterIndex(p,()=>value));assert.throws(()=>starterIndex([],()=>0));});
test('Quacks and minimal rotate after their random initial seat without redrawing',()=>{for(const [,Room,key]of cases.filter(c=>['quacks','minimal'].includes(c[0]))){let draws=0;const r=new Room('ABCDEF','rotation',n=>{draws++;return n===3?1:0;}),p=Array.from({length:3},(_,i)=>r.add('P'+i));r.start();assert.equal(key(r),p[1].id);r.nextRound();assert.equal(key(r),p[2].id);r.nextRound();assert.equal(key(r),p[0].id);}});

test('new matches exclude kicked players and poker excludes zero-stack seats',()=>{for(const [name,Room,actor]of cases){if(name==='poker')continue;const r=new Room('ABCDEF','eligible',n=>n-1),p=Array.from({length:4},(_,i)=>r.add('P'+i));p[3].kicked=true;r.start();assert.equal(actor(r),p[2].id);assert.equal(r.host,p[0].id);}const Room=require('../src/games/poker').Room,r=new Room('ABCDEF','eligible',n=>n-1),p=Array.from({length:3},(_,i)=>r.add('P'+i));p[2].stack=0;r.start();assert.equal(r.players[r.button].id,p[1].id);assert.equal(p[2].cards.length,0);});
test('race preserves dice-based random starter and gives that player the initial roll control',()=>{const {ThunderRoom}=require('../src/games/thunder');let seed=7;const r=new ThunderRoom('ABCDEF','race',n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}),p=Array.from({length:3},(_,i)=>r.add('P'+i));r.start();assert.equal(r.diceCheck.owner,r.players[r.first].id);assert.equal(r.turn,r.first);assert.equal(r.host,p[0].id);const before=seed;r.view(p[1].id);assert.equal(seed,before);});

test('a queued majority question does not override the randomly selected first presenter',()=>{const {MajorityRoom}=require('../src/games/majority'),r=new MajorityRoom('ABCDEF','queued',()=>1),p=Array.from({length:3},(_,i)=>r.add('P'+i));r.act(p[0].id,'enqueue',{type:'two',prompt:'先抽誰',options:['甲','乙']});r.start();assert.equal(r.presenterId,p[1].id);assert.equal(r.phase,'answering');assert.equal(r.question.prompt,'先抽誰');assert.equal(r.host,p[0].id);});
