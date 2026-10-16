'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {QuacksRoom}=require('../src/games/quacks'),{WITCHES,FORTUNES}=require('../src/games/quacks-catalog');
const {openDatabase}=require('../src/db'),{AchievementStore}=require('../src/achievements/store');
const art=require('../public/quacks-art');
const act=(r,p,action,data={})=>r.act(p.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});
function fixture(t,{bot=false,witches=false}={}){
 const db=openDatabase(':memory:');t.after(()=>db.close());const ids=[randomUUID(),randomUUID()];
 ids.forEach((id,i)=>db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,'qa'+i,'同名','unused','member',new Date().toISOString()));
 const r=new QuacksRoom('ABCDEF','成就',n=>0),a=r.add('同名'),b=r.add('同名',bot),seats=new Map([[a.id,ids[0]],[b.id,ids[1]]]);
 Object.defineProperty(r,'achievementUnitStart',{value:({participantSeatIds})=>participantSeatIds.map(seat_id=>({seat_id,user_id:seats.get(seat_id)}))});
 r.configure(a.id,{witches});r.start();
 if(witches)r.witches={gold:WITCHES.gold.find(w=>w.id==='all'),copper:WITCHES.copper.find(w=>w.id==='double'),silver:WITCHES.silver.find(w=>w.id==='colors')};
 return {r,a,b,ids,seats,db,store:new AchievementStore(db)};
}
function play(r,{witches=false,beforeLast=()=>{}}={}){
 let n=0;while(r.phase!=='finished'){
  assert.ok(++n<1500);if(r.phase==='round-intro'){r.auto(r.nextRoundAt);continue;}if(r.phase==='between'){act(r,r.player(r.host),'next');continue;}
  if(r.phase==='fortune'){act(r,r.player(r.roundStarterId),'draw-fortune');continue;}
  for(const p of r.players){
   const m=r.view(p.id).mine;if(m.pending){const o=m.pending.options.find(o=>!o.disabled);act(r,p,'choice',{choiceId:m.pending.id,optionId:o.id});continue;}
   if(witches&&!p.bot){const color=['gold','copper','silver'].find(c=>r.witchAllowed(p,c));if(color){act(r,p,'witch',{color});continue;}}
   if(r.phase==='brewing'&&m.canDraw){act(r,p,'stop',{step:r.step});continue;}
   if(r.phase==='brewing'&&r.stage==='reserves'){act(r,p,p.reserve[0]?'reserve':'reserve-done',p.reserve[0]?{chipId:p.reserve[0].id}:{});continue;}
   if(r.phase==='settlement'&&!m.ready){
    if(r.stage==='witches')act(r,p,'settle-ready');
    else if(r.stage==='bonus'){if(m.bonusEligible&&!m.bonusRolled)act(r,p,'roll-bonus');else act(r,p,'bonus-ready');}
    else if(r.stage==='effects-confirm')act(r,p,'confirm-effects');
    else if(r.stage==='rewards')act(r,p,'reward',{mode:'score'});
    else if(r.stage==='shopping'){if(r.round===9)beforeLast(r);act(r,p,'shop-ready');}
   }
  }
 }
}
test('nine actual rounds freeze identities, award all qualified badges and persist without duplicate dates',t=>{
 const f=fixture(t,{witches:true}),{r,a,b,store,ids,db}=f;f.seats.set(a.id,ids[1]);
 play(r,{witches:true,beforeLast(){a.score=60;b.score=0;}});
 const snap=r.quacksAchievements.completed;assert.ok(Object.isFrozen(snap));assert.ok(Object.isFrozen(snap.participants));
 const awards=store.awardQuacksFinish(r);assert.deepEqual(awards.filter(x=>x.user_id===ids[0]).map(x=>x.achievement_id).sort(),['all-first-table','quacks-first-match','quacks-winner','quacks-no-explosion','quacks-three-witches','quacks-fifty-points'].sort());
 assert.equal(awards.some(x=>x.user_id===ids[1]&&x.achievement_id==='quacks-winner'),false,'winner uses seat identity rather than duplicate display names');
 const rows=db.prepare('SELECT * FROM user_achievements ORDER BY user_id,achievement_id').all();assert.deepEqual(store.awardQuacksFinish(r),[]);assert.deepEqual(new AchievementStore(db).awardQuacksFinish(r),[]);assert.deepEqual(db.prepare('SELECT * FROM user_achievements ORDER BY user_id,achievement_id').all(),rows);
 assert.ok(!JSON.stringify(r).includes('quacksAchievements'));assert.ok(!JSON.stringify(r.view(a.id)).includes('user_id'));
});
test('bots, disabled accounts, test purpose and abandoned games do not earn badges',t=>{
 const f=fixture(t,{bot:true});play(f.r);assert.deepEqual(f.store.awardQuacksFinish(f.r,{purpose:'test'}),[]);assert.deepEqual(f.store.awardQuacksFinish(f.r,{purpose:'tutorial'}),[]);
 f.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f.ids[0]);assert.deepEqual(f.store.awardQuacksFinish(f.r),[]);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM user_achievements').get().n,0);
 const g=fixture(t);g.r.kick(g.a.id,g.b.id);assert.equal(g.r.quacksAchievements.completed,null);assert.deepEqual(g.store.awardQuacksFinish(g.r),[]);
});
test('an explosion cannot be erased by rescue and incomplete human participation is not eligible',t=>{
 const f=fixture(t,{witches:true});const {r,a,b}=f;r.witches.gold=WITCHES.gold.find(w=>w.id==='rescue');act(r,a,'draw-fortune');a.pot.push(r.chip('white',8));r.exploded(a);r.exploded(a);assert.equal(r.quacksAchievements.current.stats.get(a.id).explosions,1);
 act(r,a,'witch',{color:'gold'});assert.equal(a.exploded,false);play(r);const stats=r.quacksAchievements.completed.participants.find(p=>p.seat_id===a.id);assert.equal(stats.noExplosion,false);
 const g=fixture(t);play(g.r);assert.equal(g.r.quacksAchievements.current.stats.get(g.a.id).rounds.size,9);
});
test('failed award transaction rolls back and the fixed snapshot can retry after room replacement',t=>{
 const f=fixture(t);play(f.r);const snapshot=f.r.quacksAchievements.completed,original=f.store.insert;let calls=0;
 f.store.insert={run(...args){if(++calls===2)throw Error('synthetic storage fault');return original.run(...args);}};
 assert.throws(()=>f.store.awardQuacksFinish(f.r),/storage fault/);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM user_achievements').get().n,0);
 f.store.insert=original;f.r.start();assert.equal(f.r.quacksAchievements.completed,null);assert.ok(f.store.recordQuacksResult(snapshot).length>0);assert.deepEqual(f.store.recordQuacksResult(snapshot),[]);
});
test('missing identity mapping fails closed and invalid actions never count as participation',t=>{
 const f=fixture(t);assert.throws(()=>act(f.r,f.a,'draw',{step:1}));assert.equal(f.r.quacksAchievements.current.stats.get(f.a.id).rounds.size,0);
 f.seats.delete(f.b.id);f.r.phase='finished';f.r.start();play(f.r);assert.equal(f.r.quacksAchievements.completed,null);assert.deepEqual(f.store.awardQuacksFinish(f.r),[]);
 const g=fixture(t);play(g.r);g.r.quacksAchievements.current.stats.get(g.a.id).rounds.delete(9);g.r.quacksAchievements.completed=null;g.r.quacksAchievements.finish();assert.equal(g.r.quacksAchievements.completed.participants.find(p=>p.seat_id===g.a.id).eligible,false);
});
test('rat marks repeat at even scores and actual droplet is separate from round start',()=>{
 assert.deepEqual(art.ratScores,[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50]);assert.deepEqual(art.markerPositions({droplet:2,startPosition:7}),{droplet:2,start:7});
 for(const [mine,leader,expected]of [[0,1,0],[0,2,0],[0,3,1],[2,3,1],[3,4,0],[50,53,2]]){
  const r=new QuacksRoom('ABCDEF','老鼠',n=>0),a=r.add('A'),b=r.add('B');r.start();a.score=mine;b.score=leader;r.deck=['seasoned'];act(r,a,'draw-fortune');assert.equal(a.rat,expected);
 }
});
