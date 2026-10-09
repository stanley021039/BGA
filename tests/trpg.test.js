'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {TrpgRoom}=require('../src/games/trpg');
const {botSupport,runTestAIStep}=require('../src/ai');
const {listRooms}=require('../src/rooms/listing');
const {rejoinPlayer}=require('../src/rooms/membership');
function room(count=3,rng=()=>5){const r=new TrpgRoom('ABCDEF','測試冒險',rng);for(let i=0;i<count;i++)r.add('隊友'+i);r.start();return r;}
function act(r,id,action,input={}){const data={sceneId:r.sceneId,requestId:randomUUID(),...input};r.act(id,action,data);return data;}
function ready(r,approach='bold'){for(const p of r.activePlayers())act(r,p.id,'plan',{approach,stance:p.focus>0||p.id===r.leaderId?'assist':'recover',note:'準備前進'});}

test('six-player adventure rotates leadership fairly, ends once and preserves shared results',()=>{
 const r=room(6),leaders=[];for(let n=0;n<6;n++){leaders.push(r.leaderId);ready(r);const cmd=act(r,r.leaderId,'resolve');const after=JSON.stringify(r.view(r.leaderId));r.act(r.leaderId,'resolve',cmd);assert.equal(JSON.stringify(r.view(r.leaderId)),after);if(n<5)act(r,r.leaderId,'next');}
 assert.equal(new Set(leaders).size,6);assert.equal(r.phase,'finished');assert.equal(r.results.length,6);assert.equal(r.winner.restored,true);assert.ok(r.activePlayers().every(p=>p.focus>=0));
});
test('all failed checks still advance the story without elimination or fabricated success',()=>{
 const r=room(1,()=>0);for(let i=0;i<6;i++){ready(r);act(r,r.leaderId,'resolve');if(i<5)act(r,r.leaderId,'next');}
 assert.equal(r.phase,'finished');assert.equal(r.activePlayers().length,1);assert.equal(r.results.length,6);assert.equal(r.results[0].outcome,'failure');assert.equal(r.winner.restored,false);assert.match(r.winner.text,/下一次冒險/);
});
test('partial check records exact die, skill, cost and public consequences',()=>{
 const r=room(1,()=>1);ready(r,'careful');act(r,r.leaderId,'resolve');const result=r.results[0];assert.deepEqual([result.die,result.skill,result.support,result.total,result.difficulty],[2,2,0,4,6]);assert.equal(result.outcome,'partial');assert.deepEqual([r.clues,r.danger,r.supplies],[1,1,3]);
});
test('plans remain private until reveal; no seat secrets or server receipts reach views',()=>{
 const r=room();act(r,r.players[0].id,'plan',{approach:'careful',stance:'assist',note:'私人草稿'});
 const peer=r.view(r.players[1].id);assert.equal(peer.myPlan,null);assert.equal(peer.plans,undefined);assert.ok(!JSON.stringify(peer).includes('私人草稿'));assert.ok(!JSON.stringify(peer).includes(r.players[0].secret));assert.equal(peer.receipts,undefined);
 ready(r,'careful');act(r,r.leaderId,'resolve');assert.equal(r.view(r.players[1].id).results[0].participants.length,3);
});
test('no forged leader, incomplete party, invalid role/note/command or conflicting retry mutates resources',()=>{
 const r=room(),before=[r.supplies,r.clues,r.danger];assert.throws(()=>act(r,r.players[1].id,'resolve'),e=>e.code==='LEADER_ONLY');assert.throws(()=>act(r,r.leaderId,'resolve'),e=>e.code==='NOT_READY');
 assert.throws(()=>act(r,r.leaderId,'role',{role:'toString'}),e=>e.code==='MATCH_STARTED');
 assert.throws(()=>act(r,r.leaderId,'plan',{approach:'toString',stance:'assist',note:''}),e=>e.code==='INVALID_APPROACH');
 assert.throws(()=>act(r,r.leaderId,'plan',{approach:'bold',stance:'assist',note:'x'.repeat(161)}),e=>e.code==='INVALID_NOTE');
 const data=act(r,r.leaderId,'plan',{approach:'bold',stance:'assist',note:''});assert.throws(()=>r.act(r.leaderId,'plan',{...data,approach:'careful'}),e=>e.code==='REQUEST_CONFLICT');assert.deepEqual([r.supplies,r.clues,r.danger],before);
});
test('stale callbacks after scene change or restart cannot consume resources or alter plans',()=>{
 const r=room(1);ready(r);const old={sceneId:r.sceneId,requestId:randomUUID(),stance:'assist',approach:'bold',note:'old'};act(r,r.leaderId,'resolve');act(r,r.leaderId,'next');assert.throws(()=>r.act(r.leaderId,'plan',old),e=>e.code==='STALE_SCENE');assert.deepEqual(r.plans,{});
 while(r.phase!=='finished'){ready(r);act(r,r.leaderId,'resolve');if(r.phase!=='finished')act(r,r.leaderId,'next');}r.start();assert.throws(()=>r.act(r.leaderId,'plan',old),e=>e.code==='STALE_SCENE');
});
test('cooperation caps charges at two, zero focus requires rest, and leader resting loses expertise',()=>{
 const r=room(4,()=>0);ready(r,'careful');act(r,r.leaderId,'resolve');assert.deepEqual(r.players.map(p=>p.focus),[3,2,2,3]);assert.equal(r.results[0].support,2);
 act(r,r.leaderId,'next');const helper=r.players[2];helper.focus=0;assert.throws(()=>act(r,helper.id,'plan',{stance:'assist',note:''}),e=>e.code==='NO_FOCUS');act(r,helper.id,'plan',{stance:'recover',note:''});
 const solo=room(1,()=>0);act(solo,solo.leaderId,'plan',{approach:'careful',stance:'recover',note:''});act(solo,solo.leaderId,'resolve');assert.equal(solo.results[0].skill,0);
});
test('offline recovery never spends or rolls for the missing seat and cannot skip leader or online player',()=>{
 const r=room();const peer=r.players[1];assert.throws(()=>act(r,r.host,'skip',{playerId:peer.id,confirmed:true}),e=>e.code==='NOT_OFFLINE');peer.lastSeen=Date.now()-16000;
 assert.throws(()=>act(r,r.players[2].id,'skip',{playerId:peer.id,confirmed:true}),e=>e.code==='HOST_ONLY');act(r,r.host,'skip',{playerId:peer.id,confirmed:true});act(r,r.host,'plan',{approach:'bold',stance:'assist',note:''});act(r,r.players[2].id,'plan',{stance:'recover',note:''});act(r,r.host,'resolve');assert.equal(peer.focus,3);assert.equal(r.results[0].participants.find(p=>p.id===peer.id).skipped,true);
});
test('leaving leader invalidates pending scene commands, transfers host and remains playable',()=>{
 const r=room(),oldScene=r.sceneId,first=r.players[0].id;ready(r);r.kick(first,first,true);assert.notEqual(r.sceneId,oldScene);assert.equal(r.leaderId,r.players[1].id);assert.equal(r.host,r.players[1].id);assert.deepEqual(r.plans,{});ready(r);act(r,r.leaderId,'resolve');assert.equal(r.phase,'reveal');r.kick(r.host,r.leaderId,true);act(r,r.leaderId,'next');assert.equal(r.phase,'planning');
});
test('supply validation and faulty RNG do not partially spend resources',()=>{
 const r=room(1,()=>9);ready(r,'careful');assert.throws(()=>act(r,r.leaderId,'resolve'),/骰子/);assert.deepEqual([r.supplies,r.clues,r.danger],[4,0,0]);r.supplies=0;assert.throws(()=>act(r,r.leaderId,'plan',{approach:'careful',stance:'assist',note:''}),e=>e.code==='NO_SUPPLIES');
});
test('capacity, listing and rejoin obey waiting/finished boundaries for TRPG',()=>{
 const r=room(6);assert.throws(()=>r.add('late'),e=>e.code==='MATCH_STARTED');const rows=listRooms(new Map([[r.code,r]]),new Map(),new Map(),'outsider');assert.equal(rows[0].maxPlayers,6);assert.equal(rows[0].joinable,false);const id=r.players[5].id;r.kick(r.host,id);assert.throws(()=>rejoinPlayer(r,id,'late'),/下一局/);r.phase='finished';assert.ok(rejoinPlayer(r,id,'back'));assert.equal(r.activePlayers().length,6);assert.throws(()=>r.add('full'),e=>e.code==='ROOM_FULL');
});
test('scripted test partners use only public state and can complete solo-leader scenes',()=>{
 const r=new TrpgRoom('ABCDEF','bot',()=>5),p=r.add('script',true);r.start();assert.equal(botSupport(r).supported,true);const history={transact:(_room,_op,fn)=>fn()};
 for(let i=0;i<40&&r.phase!=='finished';i++)runTestAIStep(r,{history,now:Date.now()+i*2000});assert.equal(r.phase,'finished');assert.equal(r.results.length,6);assert.ok(r.results.every(result=>result.leaderName===p.name));
});
