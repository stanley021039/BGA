const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID,scryptSync}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {openDatabase}=require('../src/db');
const {createApp}=require('../src/app');

async function fixture(t,purpose='production',{uppercaseIds=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-achievement-http-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false,achievementPurpose:purpose};
 const users=Array.from({length:3},(_,i)=>({id:uppercaseIds?randomUUID().toUpperCase():randomUUID(),username:'badge_player_'+i})),password='synthetic-badge-password',salt=Buffer.alloc(16,29);
 const hash='scrypt:'+salt.toString('hex')+':'+scryptSync(password,salt,64).toString('hex'),db=openDatabase(config.dbFile);
 for(const [i,user]of users.entries())db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(user.id,user.username,'玩家'+i,hash,i===0?'admin':'member',new Date().toISOString());
 db.close();let app=createApp(config),base='http://127.0.0.1:'+(await app.listen()).port;
 t.after(async()=>{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 async function api(seat,route,data){const response=await fetch(base+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{...(users[seat].cookie?{Cookie:users[seat].cookie}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));const cookie=response.headers.get('set-cookie');if(cookie)users[seat].cookie=cookie.split(';')[0];return body;}
 for(let seat=0;seat<3;seat++)await api(seat,'auth/login',{username:users[seat].username,password});
 return {users,api,async room(type){const {code}=await api(0,'create',{type});for(let seat=1;seat<3;seat++)await api(seat,'join',{code});await api(0,'start',{code});return code;},read(run){const db=new DatabaseSync(config.dbFile,{readOnly:true});try{return run(db);}finally{db.close();}},async restart(){await app.close();app=createApp(config);base='http://127.0.0.1:'+(await app.listen()).port;}};
}
const unlocked=body=>body.achievements.filter(item=>item.unlockedAt).map(item=>item.id);
test('app factory rejects an explicit invalid purpose and releases its data locks',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-achievement-purpose-')),config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false};
 try{for(const achievementPurpose of [false,0,'',null,'staging'])assert.throws(()=>createApp({...config,achievementPurpose}),/Invalid achievement purpose/);const app=createApp({...config,achievementPurpose:'test'});await app.close();}
 finally{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});

test('HTTP draw awards only a normally completed round and preserves its frozen receipt after restart',async t=>{
 const f=await fixture(t),code=await f.room('draw'),views=await Promise.all(f.users.map((_,i)=>f.api(i,'state?code='+code)));
 const artist=views.findIndex(view=>view.me===view.presenterId),state=views[artist];
 await f.api(artist,'action',{code,action:'choose',questionId:state.candidates[0].id});
 const drawing=await f.api(artist,'state?code='+code);
 const stroke={code,round:drawing.round,canvasEpoch:drawing.canvasEpoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:5,points:[[4,5],[9,10]]};
 await f.api(artist,'draw/stroke',stroke);await f.api(artist,'draw/stroke',stroke);
 assert.deepEqual(unlocked(await f.api(artist,'achievements')),[]);
 for(let seat=0;seat<3;seat++)if(seat!==artist)await f.api(seat,'action',{code,action:'guess',answer:drawing.question.title});
 const collection=await f.api(artist,'achievements');assert.equal(collection.achievements.length,13);
 assert.ok(unlocked(collection).includes('draw-soul-artist'));assert.ok(unlocked(collection).includes('draw-first-round'));
 assert.equal(JSON.stringify(collection).includes('user_id'),false);
 const receipt=f.read(db=>db.prepare('SELECT * FROM processed_unit_events').get());assert.equal(receipt.status,'rules_completed');assert.equal(receipt.unit_number,1);
 assert.equal(receipt.facts_json.includes(drawing.question.title),false);assert.equal(JSON.parse(receipt.facts_json).participants.length,3);
 const awardsBefore=f.read(db=>db.prepare('SELECT * FROM user_achievements ORDER BY user_id,achievement_id').all());
 for(let seat=0;seat<3;seat++)await f.api(seat,'leave',{code});
 await f.restart();assert.deepEqual(await f.api(artist,'achievements'),collection);
 assert.deepEqual(f.read(db=>db.prepare('SELECT * FROM user_achievements ORDER BY user_id,achievement_id').all()),awardsBefore);
 assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM processed_unit_events').get().n),1);
});

test('HTTP removing the artist interrupts the draw unit without phantom achievements',async t=>{
 const f=await fixture(t),code=await f.room('draw'),views=await Promise.all(f.users.map((_,i)=>f.api(i,'state?code='+code))),artist=views.findIndex(view=>view.me===view.presenterId);
 await f.api(artist,'action',{code,action:'choose',questionId:views[artist].candidates[0].id});
 await f.api(artist,'leave',{code});
 for(let seat=0;seat<3;seat++)assert.deepEqual(unlocked(await f.api(seat,'achievements')),[]);
 const events=f.read(db=>db.prepare('SELECT status FROM processed_unit_events').all());assert.equal(events.length,1);assert.equal(events[0].status,'interrupted');
});

test('HTTP official majority answers count across game types but do not infer progress from old badges',async t=>{
 const f=await fixture(t),code=await f.room('majority');
 await f.api(0,'action',{code,action:'ask',type:'two',prompt:'測試是否同頻',options:['一起','另一種']});
 for(let seat=0;seat<3;seat++)await f.api(seat,'action',{code,action:'answer',answer:0});
 const collection=await f.api(0,'achievements');assert.ok(unlocked(collection).includes('majority-one-channel'));
 assert.equal(unlocked(collection).includes('all-two-tables'),false);
 assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM achievement_progress').get().n),3);
 for(let seat=0;seat<3;seat++)await f.api(seat,'leave',{code});
 const poker=await f.api(0,'create',{type:'poker'});await f.api(0,'bot',{code:poker.code});await f.api(0,'start',{code:poker.code});await f.api(0,'action',{code:poker.code,action:'fold'});
 assert.ok(unlocked(await f.api(0,'achievements')).includes('all-two-tables'));
});

for(const purpose of ['test','tutorial'])test(`HTTP ${purpose} poker units persist receipts without issuing production badges or progress`,async t=>{
 const f=await fixture(t,purpose),{code}=await f.api(0,'create',{type:'poker'});await f.api(0,'bot',{code});await f.api(0,'start',{code});await f.api(0,'action',{code,action:'fold'});
 assert.deepEqual(unlocked(await f.api(0,'achievements')),[]);assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM achievement_progress').get().n),0);
 const receipt=f.read(db=>db.prepare('SELECT purpose FROM processed_unit_events').get());assert.equal(receipt.purpose,purpose);
});
test('HTTP imported uppercase account UUIDs retain their exact database identity when earning achievements',async t=>{
 const f=await fixture(t,'production',{uppercaseIds:true}),code=await f.room('majority');
 await f.api(0,'action',{code,action:'ask',type:'two',prompt:'舊帳號相容驗證',options:['一起','另一種']});
 for(let seat=0;seat<3;seat++)await f.api(seat,'action',{code,action:'answer',answer:0});
 for(let seat=0;seat<3;seat++)assert.ok(unlocked(await f.api(seat,'achievements')).includes('majority-one-channel'));
 const users=f.read(db=>db.prepare('SELECT DISTINCT user_id FROM achievement_progress ORDER BY user_id').all()).map(row=>row.user_id);
 assert.deepEqual(users,f.users.map(user=>user.id).sort());
 const facts=f.read(db=>JSON.parse(db.prepare('SELECT facts_json FROM processed_unit_events').get().facts_json));
 assert.deepEqual(facts.participants.map(p=>p.user_id).sort(),users);
 assert.equal(f.read(db=>require('../src/achievements/store').validateAchievementUnitsDatabase(db)),true);
});


test('HTTP three humans and one AI normally complete majority and award each human',async t=>{
 const f=await fixture(t),{code}=await f.api(0,'create',{type:'majority'});
 for(let seat=1;seat<3;seat++)await f.api(seat,'join',{code});
 await f.api(0,'bot',{code});await f.api(0,'start',{code});
 await f.api(0,'action',{code,action:'ask',type:'two',prompt:'混合真人與AI',options:['一起','另一種']});
 for(let seat=0;seat<3;seat++)await f.api(seat,'action',{code,action:'answer',answer:0});
 let state;for(let i=0;i<50;i++){
  state=await f.api(0,'state?code='+code);if(['review','reveal','finished'].includes(state.phase))break;
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(['review','reveal','finished'].includes(state.phase),'AI must submit its actual answer');
 if(state.phase==='review')state=await f.api(0,'action',{code,action:'score'});
 assert.ok(['reveal','finished'].includes(state.phase));
 for(let seat=0;seat<3;seat++){
  const badges=unlocked(await f.api(seat,'achievements'));assert.ok(badges.includes('majority-first-vote'));assert.ok(badges.includes('all-first-table'));
 }
 assert.equal(f.read(db=>db.prepare('SELECT COUNT(*) n FROM achievement_progress').get().n),3);
});
