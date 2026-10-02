const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {openDatabase}=require('../src/db');
const {AchievementStore}=require('../src/achievements/store');
const {Room:PokerRoom}=require('../src/games/poker');
const {ThunderRoom}=require('../src/games/thunder');
const {createApp}=require('../src/app');
const {createAuth}=require('../src/auth');

function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-immersion-'));try{const db=openDatabase(path.join(root,'app.sqlite')),store=new AchievementStore(db);const addUser=name=>{const id='user-'+name;db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,id,name,'unused','member',new Date().toISOString());return id;};try{run({db,store,addUser});}finally{db.close();}}finally{fs.rmSync(root,{recursive:true,force:true});}}
function has(store,user,id){return !!store.list(user).achievements.find(item=>item.id===id)?.unlockedAt;}

test('first poker hand needs a settled hand and a real player decision',()=>fixture(({store,addUser})=>{
 const room=new PokerRoom('POKER1','牌桌',()=>0),seats=new Map(),a=room.add('甲'),b=room.add('乙');
 seats.set(addUser('甲'),a.id);seats.set(addUser('乙'),b.id);
 room.start();assert.deepEqual(store.awardPokerHand(room,seats),[]);
 const acting=room.players[room.turn],other=room.players.find(player=>player!==acting);
 room.humanAct(acting.id,'fold');assert.equal(room.phase,'showdown');
 assert.deepEqual(store.awardPokerHand(room,seats),['user-'+acting.name]);
 assert.deepEqual(store.awardPokerHand(room,seats),[]);
 assert.equal(has(store,'user-'+acting.name,'poker-first-hand'),true);
 assert.equal(has(store,'user-'+acting.name,'all-first-table'),true);
 assert.equal(has(store,'user-'+other.name,'poker-first-hand'),false);
 room.start();assert.equal(room.players.some(player=>player.handDecision),false);
 room.act(room.players[room.turn].id,'fold');assert.deepEqual(store.awardPokerHand(room,seats),[]);
 assert.equal(has(store,'user-'+other.name,'all-first-table'),false);
}));

test('race badge needs a completed human-operated turn and a finished race',()=>fixture(({store,addUser})=>{
 let seed=73;const rng=n=>((seed=(seed*1664525+1013904223)>>>0)%n);
 const room=new ThunderRoom('RACE01','賽道',rng),seats=new Map(),a=room.add('甲'),b=room.add('乙');
 seats.set(addUser('甲'),a.id);seats.set(addUser('乙'),b.id);room.start();
 const actor=room.player(room.actor()),other=room.players.find(player=>player!==actor);
 assert.throws(()=>room.humanAct(actor.id,'begin',{car:'invalid',die:0}),/可用車輛/);
 assert.equal(actor.humanActionThisTurn,false);
 room.humanAct(actor.id,'begin',{car:room.available(actor)[0].id,die:0});
 assert.equal(actor.humanActionThisTurn,true);
 assert.deepEqual(store.awardRaceFinish(room,seats),[]);
 room.endTurn();assert.equal(actor.completedHumanTurn,true);
 room.win(actor.id,'率先衝過終點');
 assert.deepEqual(store.awardRaceFinish(room,seats),['user-'+actor.name]);
 assert.deepEqual(store.awardRaceFinish(room,seats),[]);
 assert.equal(has(store,'user-'+actor.name,'thunder-first-drive'),true);
 assert.equal(has(store,'user-'+actor.name,'all-first-table'),true);
 assert.equal(has(store,'user-'+other.name,'thunder-first-drive'),false);
 room.start();assert.equal(room.players.some(player=>player.completedHumanTurn),false);
}));

test('poker HTTP action awards badges only after the hand settles',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-poker-http-badge-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('artist','test-password-123');db.close();
 const app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'artist',password:'test-password-123'})});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  async function post(route,data){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};}
  const created=await post('create',{type:'poker'});assert.equal(created.status,200);
  const code=created.body.code;await post('bot',{code});await post('start',{code});
  const before=await (await fetch(base+'/api/achievements',{headers:{Cookie:cookie}})).json();
  assert.equal(before.achievements.find(item=>item.id==='poker-first-hand').unlockedAt,null);
  const fold=await post('action',{code,action:'fold'});
  assert.equal(fold.status,200);assert.equal(fold.body.phase,'showdown');
  const after=await (await fetch(base+'/api/achievements',{headers:{Cookie:cookie}})).json();
  assert.ok(after.achievements.find(item=>item.id==='poker-first-hand').unlockedAt);
  assert.ok(after.achievements.find(item=>item.id==='all-first-table').unlockedAt);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
