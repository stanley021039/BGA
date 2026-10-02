const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {GiftRoom}=require('./src/games/gift');
const {createApp}=require('./src/app');
const {openDatabase}=require('./src/db/index');
const {createAuth}=require('./src/auth/index');
const {GiftStore}=require('./src/games/gift-store');
const {AchievementStore}=require('./src/achievements/store');
const {GIFTS}=require('./src/games/gift-catalog');
const {drawContent}=require('./src/games/content-draw');

test('0% custom content stays built-in even after the built-in draw cycle resets',()=>{
 const builtin=Array.from({length:3},(_,index)=>({id:'built-in-'+index}));
 const custom=[{id:'custom-0'}];
 let usedIds=[];
 for(let round=0;round<3;round++){
  const draw=drawContent({builtin,custom,count:2,customPercent:0,usedIds,rng:()=>0});
  assert.equal(draw.items.length,2);
  assert.ok(draw.items.every(item=>item.id.startsWith('built-in-')));
  assert.equal(new Set(draw.items.map(item=>item.id)).size,2);
  usedIds=draw.usedIds;
 }
});

test('300 default gifts keep legacy IDs and have bundled PNG artwork',()=>{
 assert.equal(GIFTS.length,300);
 assert.deepEqual(Object.entries(GIFTS.reduce((counts,gift)=>(counts[gift.category]=(counts[gift.category]||0)+1,counts),{})),[
  ['日常',75],['體驗',75],['奇想',75],['冒險',75]
 ]);
 assert.equal(new Set(GIFTS.map(gift=>gift.id)).size,300);
 assert.equal(new Set(GIFTS.map(gift=>gift.title.normalize('NFKC'))).size,300);
 assert.equal(GIFTS.find(gift=>gift.id==='g1-01').title,'一年份早餐券');
 assert.equal(GIFTS.find(gift=>gift.id==='g4-16').title,'與朋友完成一條長途步道');
 for(const gift of GIFTS){
  assert.match(gift.image,/^\/assets\/gifts\/(?:kenney|noto)\/[a-zA-Z0-9_]+\.png$/);
  const bytes=fs.readFileSync(path.join(__dirname,'public',gift.image.slice(1)));
  assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),gift.id);
 }
});

test('custom gifts persist in SQLite and become eligible for the next draw',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-gift-catalog-'));
 const file=path.join(root,'app.sqlite');
 try{
  let db=openDatabase(file),store=new GiftStore(db);
  const user={id:'test-user',display_name:'測試玩家'};
  db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").run(user.id,'tester',user.display_name,'unused','member',new Date().toISOString());
  const gift=store.add(user,{title:' 一張雲端野餐地圖 ',category:'奇想'});
  assert.equal(gift.title,'一張雲端野餐地圖');assert.equal(gift.image,null);
  assert.throws(()=>store.add(user,{title:'一張雲端野餐地圖',category:'奇想'}),/同名/);
  assert.throws(()=>store.add(user,{title:'無效',category:'未知'}),/分類/);
  db.close();db=openDatabase(file);store=new GiftStore(db);
  assert.equal(store.list()[0].id,gift.id);
  const room=new GiftRoom('CAT123','共編房',n=>n-1);
  room.giftProvider=()=>store.list();
  for(const name of ['甲','乙','丙'])room.add(name);
  room.start();assert.ok(room.gifts.some(item=>item.id===gift.id));
  db.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('gift host controls the custom share with unique cards and built-in fallback',()=>{
 const room=new GiftRoom('MIX123','混合題庫',()=>0);
 const host=room.add('房主'),guest=room.add('朋友'),third=room.add('另一位');
 const custom=Array.from({length:5},(_,index)=>({id:'shared-gift-'+index,title:'投稿'+index,category:'日常'}));
 room.giftProvider=()=>custom;
 assert.equal(room.view(host.id).customPercent,null);
 assert.throws(()=>room.configure(guest.id,{target:15,customPercent:50}),/房主/);
 for(const invalid of ['50',10,-25,125])assert.throws(()=>room.configure(host.id,{target:15,customPercent:invalid}),/比例/);
 room.configure(host.id,{target:15,customPercent:50});
 assert.equal(room.view(third.id).customPercent,50);
 room.start();
 assert.equal(room.gifts.filter(gift=>gift.id.startsWith('shared-')).length,2);
 assert.equal(new Set(room.gifts.map(gift=>gift.id)).size,4);
 assert.throws(()=>room.configure(host.id,{target:15,customPercent:100}),/遊戲中/);

 const few=new GiftRoom('FEW123','少量投稿',()=>0);
 const owner=few.add('甲');few.add('乙');few.add('丙');
 few.giftProvider=()=>custom.slice(0,1);
 few.configure(owner.id,{target:15,customPercent:100});
 few.start();
 assert.equal(few.gifts.filter(gift=>gift.id.startsWith('shared-')).length,1);
 assert.equal(new Set(few.gifts.map(gift=>gift.id)).size,4);
 few.newRound();
 assert.equal(few.gifts.filter(gift=>gift.id.startsWith('shared-')).length,0);
 const none=new GiftRoom('NONE12','只抽內建',()=>0),noneHost=none.add('甲');
 none.add('乙');none.add('丙');none.giftProvider=()=>custom;
 none.configure(noneHost.id,{target:15,customPercent:0});none.start();
 assert.equal(none.gifts.filter(gift=>gift.id.startsWith('shared-')).length,0);
});

test('existing v5 data survives the achievement migration',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-gift-achievements-')),file=path.join(root,'app.sqlite');
 try{
  let db=openDatabase(file);
  db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").run('existing-user','existing','原有會員','unused','member',new Date().toISOString());
  db.exec('DROP TABLE user_achievements; PRAGMA user_version=5;');db.close();
  db=openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,6);
  assert.equal(db.prepare('SELECT display_name FROM users WHERE id=?').get('existing-user').display_name,'原有會員');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_achievements').get().count,0);
  db.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('gift badge requires an active player to submit both choices and settle a round',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-gift-award-')),file=path.join(root,'app.sqlite');
 try{
  const db=openDatabase(file),store=new AchievementStore(db),room=new GiftRoom('BADGE1','徽章測試',()=>0);
  const seats=new Map();
  for(const name of ['甲','乙','丙','丁']){
   const userId='user-'+name;
   db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").run(userId,userId,name,'unused','member',new Date().toISOString());
   seats.set(userId,room.add(name).id);
  }
  const [a,b,c,d]=[...seats.values()];room.kick(a,d);room.start();
  assert.deepEqual(store.awardGiftRound(room,seats),[]);
  const [g0,g1,g2,g3]=room.gifts.map(gift=>gift.id);
  room.give(a,{[b]:g0,[c]:g1});room.give(b,{[a]:g0,[c]:g2});room.give(c,{[a]:g1,[b]:g2});
  assert.deepEqual(store.awardGiftRound(room,seats),[]);
  const ranking={great:g0,good:g1,ok:g2,noWay:g3};
  for(const id of [a,b,c])room.wish(id,ranking);
  assert.equal(room.phase,'reveal');
  assert.equal(store.awardGiftRound(room,seats).length,3);
  assert.deepEqual(store.awardGiftRound(room,seats),[]);
  assert.equal(store.list('user-丁').achievements[0].unlockedAt,null);
  for(const name of ['甲','乙','丙'])assert.ok(store.list('user-'+name).achievements[0].unlockedAt);
  db.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('gift rounds keep choices secret, score both tracks, and finish only after a complete round',()=>{
 const room=new GiftRoom('ABC123','送禮達人',()=>0);
 const players=['阿星','小河','雨點'].map(name=>room.add(name));
 assert.throws(()=>room.add('機器人',true),/真人/);
 room.configure(players[0].id,{target:8});room.start();
 assert.equal(room.gifts.length,4);
 const runRound=()=>{
  const [a,b,c]=players.map(player=>player.id),[g0,g1,g2,g3]=room.gifts.map(gift=>gift.id);
  room.act(a,'wish',{ranking:{great:g0,good:g1,ok:g2,noWay:g3}});
  assert.equal(room.phase,'choosing');
  assert.equal(room.view(b).ownRanking,null);
  room.act(a,'give',{assignments:{[b]:g0,[c]:g1}});
  assert.equal(room.view(b).ownAssignments,null);
  assert.equal(room.view(b).result,null);
  assert.throws(()=>room.act(b,'give',{assignments:{[a]:g0,[c]:g0}}),/不同/);
  room.act(b,'give',{assignments:{[a]:g0,[c]:g2}});
  room.act(c,'give',{assignments:{[a]:g1,[b]:g2}});
  assert.equal(room.phase,'choosing');
  assert.equal(room.view(b).ownRanking,null);
  assert.equal(room.view(b).result,null);
  room.act(b,'wish',{ranking:{great:g0,good:g2,ok:g1,noWay:g3}});
  room.act(c,'wish',{ranking:{great:g2,good:g1,ok:g0,noWay:g3}});
 };
 runRound();
 assert.equal(room.phase,'reveal');
 assert.deepEqual(room.players.map(player=>[player.giveScore,player.getScore]),[[5,5],[6,5],[4,5]]);
 assert.equal(room.view(players[0].id).result.entries.length,6);
 assert.throws(()=>room.act(players[1].id,'next'),/房主/);
 const previousGifts=new Set(room.gifts.map(gift=>gift.id));
 room.act(players[0].id,'next');
 assert.equal(room.round,2);
 assert.equal(room.view(players[0].id).result,null);
 assert.ok(room.gifts.every(gift=>!previousGifts.has(gift.id)));
 runRound();
 assert.equal(room.phase,'finished');
 assert.deepEqual(room.winner.ids,players.map(player=>player.id));
 assert.ok(room.players.every(player=>player.giveScore===8&&player.getScore===8));
 room.start();assert.equal(room.phase,'choosing');assert.equal(room.round,1);
});

test('invalid input cannot leak choices or alter a locked round; kicking a player cannot stall it',()=>{
 const room=new GiftRoom('DEF456','朋友局',()=>0);
 const [host,friend,other,leaving]=['甲','乙','丙','丁'].map(name=>room.add(name));
 room.start();
 const [g0,g1,g2,g3,g4]=room.gifts.map(gift=>gift.id);
 assert.throws(()=>room.act(host.id,'give',{assignments:{[friend.id]:g0}}),/每位朋友/);
 room.act(host.id,'give',{assignments:{[friend.id]:g0,[other.id]:g1,[leaving.id]:g2}});
 assert.throws(()=>room.act(host.id,'give',{assignments:{[friend.id]:g0,[other.id]:g1,[leaving.id]:g2}}),/鎖定/);
 const ranking={great:g0,good:g1,ok:g2,noWay:g3};
 room.act(friend.id,'wish',{ranking});
 room.act(friend.id,'give',{assignments:{[host.id]:g4,[other.id]:g2,[leaving.id]:g3}});
 room.act(other.id,'give',{assignments:{[host.id]:g1,[friend.id]:g3,[leaving.id]:g4}});
 room.kick(host.id,leaving.id);
 assert.equal(room.phase,'choosing');
 assert.throws(()=>room.add('晚到'),/已開始/);
 assert.throws(()=>room.act(host.id,'wish',{ranking:{great:g0,good:g0,ok:g1,noWay:g2}}),/四件不同/);
 for(const player of [host,other])room.act(player.id,'wish',{ranking});
 assert.equal(room.phase,'reveal');
 assert.equal(room.result.entries.length,6);
 assert.ok(room.result.entries.every(entry=>entry.giverId!==leaving.id&&entry.recipientId!==leaving.id));
 assert.ok(room.result.entries.some(entry=>entry.points===-1));
 assert.ok(room.result.entries.some(entry=>entry.points===-4));
});

test('eight players can rank before gifting and reveal all 56 gifts only after both choices',()=>{
 const room=new GiftRoom('EIGHT8','八人試玩',()=>0);
 const players=Array.from({length:8},(_,index)=>room.add(`玩家${index+1}`));
 room.start();assert.equal(room.phase,'choosing');assert.equal(room.gifts.length,9);
 const [g0,g1,g2,g3]=room.gifts.map(gift=>gift.id);
 for(const player of players)room.wish(player.id,{great:g0,good:g1,ok:g2,noWay:g3});
 assert.equal(room.phase,'choosing');assert.equal(room.view(players[0].id).result,null);
 for(const player of players){
  const recipients=players.filter(other=>other.id!==player.id);
  const assignments=Object.fromEntries(recipients.map((recipient,index)=>[recipient.id,room.gifts[index].id]));
  room.give(player.id,assignments);
 }
 assert.equal(room.phase,'reveal');assert.equal(room.result.entries.length,56);
});

test('authenticated players can create, join and reconnect to a gift room without seeing hidden choices',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-gift-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('giftadmin','test-password-123');db.close();
 const app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const post=async(route,cookie,data)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const host=(await post('auth/login',null,{username:'giftadmin',password:'test-password-123'})).cookie;
  const register=async username=>{const invite=await post('admin/invites',host,{days:1});return (await post('auth/register',null,{username,displayName:username,password:'test-password-123',confirmPassword:'test-password-123',invite:invite.body.code})).cookie;};
  const friend=await register('giftfriend'),other=await register('giftother'),outsider=await register('giftoutside');
  const imageBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rv0AAAAASUVORK5CYII=';
  const custom=await post('community/gifts',friend,{title:'朋友送的星光瓶',category:'奇想',image:{mime:'image/png',base64:imageBase64}});
  assert.equal(custom.status,200);assert.equal(custom.body.author,'giftfriend');
  const giftList=await (await fetch(base+'/api/community/gifts',{headers:{Cookie:host}})).json();
  assert.ok(giftList.gifts.some(gift=>gift.id===custom.body.id&&gift.image===custom.body.image));
  const imageResponse=await fetch(base+custom.body.image,{headers:{Cookie:host}});
  assert.equal(imageResponse.status,200);assert.equal(imageResponse.headers.get('content-type'),'image/png');
  assert.equal(Buffer.from(await imageResponse.arrayBuffer()).toString('base64'),imageBase64);
  assert.equal((await post('community/gifts',friend,{title:'壞圖',category:'奇想',image:{mime:'image/png',base64:'AA=='}})).status,400);
  assert.equal((await post('community/gifts',friend,{title:'朋友送的星光瓶',category:'奇想'})).status,409);
  const created=await post('create',host,{type:'gift',roomName:'送禮測試',name:'不能覆蓋角色名稱'});
  assert.equal(created.status,200);assert.equal(created.body.type,'gift');
  const code=created.body.code;
  const unauthorized=await fetch(base+'/gift/'+code,{redirect:'manual'});
  assert.equal(unauthorized.status,302);
  assert.equal((await fetch(base+'/api/achievements')).status,401);
  assert.equal((await fetch(base+'/gift/'+code,{headers:{Cookie:host}})).status,200);
  assert.equal((await fetch(base+'/gift.js',{headers:{Cookie:host}})).status,200);
  assert.equal((await fetch(base+'/achievements',{redirect:'manual'})).status,302);
  assert.equal((await fetch(base+'/achievements',{headers:{Cookie:host}})).status,200);
  for(const name of ['open_001','confirmation_001']){
   const sound=await fetch(base+'/assets/gift-sounds/'+name+'.wav');
   assert.equal(sound.status,200);
   assert.equal(sound.headers.get('content-type'),'audio/wav');
   assert.equal(Buffer.from(await sound.arrayBuffer()).toString('ascii',0,4),'RIFF');
  }
  for(const gift of [GIFTS.find(gift=>gift.image.includes('/kenney/')),GIFTS.find(gift=>gift.image.includes('/noto/'))]){
   const image=await fetch(base+gift.image,{headers:{Cookie:host}});
   assert.equal(image.status,200);
   assert.match(image.headers.get('content-type'),/^image\/png/);
  }
  assert.equal((await post('join',friend,{code,name:'不能覆蓋角色名稱'})).status,200);
  assert.equal((await post('join',other,{code})).status,200);
  const getState=async (cookie=host)=>(await (await fetch(base+'/api/state?code='+code,{headers:{Cookie:cookie}})).json());
  const getAchievements=async cookie=>(await (await fetch(base+'/api/achievements',{headers:{Cookie:cookie}})).json()).achievements;
  assert.equal((await getAchievements(host))[0].unlockedAt,null);
  let state=await getState();assert.equal(state.phase,'waiting');
  assert.deepEqual(state.players.map(player=>player.name),['giftadmin','giftfriend','giftother']);
  assert.equal((await post('settings',friend,{code,target:8})).status,400);
  const configured=await post('settings',host,{code,target:8,customPercent:75});
  assert.equal(configured.status,200);
  assert.equal(configured.body.customPercent,75);
  assert.equal((await post('start',friend,{code})).status,403);
  assert.equal((await post('start',host,{code})).status,200);
  state=await getState();assert.equal(state.gifts.length,4);
  assert.equal(state.gifts.filter(gift=>gift.shared).length,1);
  const [a,b,c]=state.players.map(player=>player.id),[g0,g1,g2,g3]=state.gifts.map(gift=>gift.id);
  assert.equal((await post('join',outsider,{code})).status,400);
  const visible=(await (await fetch(base+'/api/rooms',{headers:{Cookie:outsider}})).json()).rooms.find(room=>room.code===code);
  assert.equal(visible.joinable,false);
  assert.equal((await post('action',host,{code,action:'give',assignments:{[b]:g0,[c]:g1}})).status,200);
  state=await getState(friend);assert.equal(state.ownAssignments,null);assert.equal(state.result,null);
  assert.deepEqual(state.submittedIds,[]);assert.deepEqual(state.gaveIds,[a]);assert.deepEqual(state.wishedIds,[]);
  assert.equal((await post('reconnect',friend,{code})).body.reconnected,true);
  assert.equal((await post('action',friend,{code,action:'wish',ranking:{great:g0,good:g2,ok:g1,noWay:g3}})).status,200);
  state=await getState();assert.equal(state.phase,'choosing');assert.deepEqual(state.wishedIds,[b]);assert.equal(state.ownRanking,null);
  await post('action',friend,{code,action:'give',assignments:{[a]:g0,[c]:g2}});
  await post('action',other,{code,action:'give',assignments:{[a]:g1,[b]:g2}});
  state=await getState();assert.equal(state.phase,'choosing');assert.deepEqual(state.gaveIds,[a,b,c]);assert.equal(state.result,null);
  const rank=(great,good,ok,noWay)=>({great,good,ok,noWay});
  await post('action',host,{code,action:'wish',ranking:rank(g0,g1,g2,g3)});
  assert.equal((await getState(other)).ownRanking,null);
  await post('action',other,{code,action:'wish',ranking:rank(g2,g1,g0,g3)});
  state=await getState();assert.equal(state.phase,'reveal');assert.equal(state.result.entries.length,6);
  const unlockedAt=(await getAchievements(host))[0].unlockedAt;
  assert.ok(unlockedAt);
  assert.equal((await getAchievements(friend))[0].unlockedAt,unlockedAt);
  assert.equal((await getAchievements(other))[0].unlockedAt,unlockedAt);
  assert.equal((await getAchievements(outsider))[0].unlockedAt,null);
  const history=await (await fetch(base+'/api/history',{headers:{Cookie:host}})).json();
  assert.equal(history[0].type,'gift');assert.equal(history[0].status,'playing');
  assert.equal((await post('action',friend,{code,action:'next'})).status,400);
  assert.equal((await post('action',host,{code,action:'next'})).status,200);
  state=await getState();assert.equal(state.phase,'choosing');assert.equal(state.round,2);
  const [h0,h1,h2,h3]=state.gifts.map(gift=>gift.id);
  assert.ok(state.gifts.every(gift=>![g0,g1,g2,g3].includes(gift.id)));
  assert.equal((await post('action',host,{code,action:'give',assignments:{[b]:h0,[c]:h1}})).status,200);
  assert.equal((await post('action',friend,{code,action:'give',assignments:{[a]:h0,[c]:h2}})).status,200);
  assert.equal((await post('action',other,{code,action:'give',assignments:{[a]:h1,[b]:h2}})).status,200);
  assert.equal((await post('action',host,{code,action:'wish',ranking:rank(h0,h1,h2,h3)})).status,200);
  assert.equal((await post('action',friend,{code,action:'wish',ranking:rank(h0,h2,h1,h3)})).status,200);
  assert.equal((await post('action',other,{code,action:'wish',ranking:rank(h2,h1,h0,h3)})).status,200);
  state=await getState();assert.equal(state.phase,'finished');
  assert.equal(state.result.entries.length,6);
  assert.equal(state.winner.ids.length,3);
  assert.equal((await getAchievements(host))[0].unlockedAt,unlockedAt);
  const finishedHistory=await (await fetch(base+'/api/history',{headers:{Cookie:host}})).json();
  assert.equal(finishedHistory[0].status,'finished');
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
