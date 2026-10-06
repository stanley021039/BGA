const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {WORDS}=require('../src/games/draw-guess-words');
const {DrawWordStore}=require('../src/games/draw-guess-store');
const {openDatabase}=require('../src/db/index');
const {createAuth}=require('../src/auth/index');
const {createApp}=require('../src/app');

test('120 original words have unique ids and three difficulties',()=>{
 assert.equal(WORDS.length,120);
 assert.equal(new Set(WORDS.map(word=>word.id)).size,120);
 assert.equal(new Set(WORDS.map(word=>word.title)).size,120);
 assert.deepEqual(Object.groupBy(WORDS,word=>word.difficulty).easy.length,40);
});

test('drawing game keeps the answer private, validates strokes, scores aliases, and rotates',()=>{
 let time=1_000_000;
 const room=new DrawGuessRoom('DRAW12','試玩',()=>0,()=>time);
 const host=room.add('畫者'),guest=room.add('猜者');
 const words=[0,1,2].map(index=>({id:'shared-'+index,title:'自訂詞'+index,aliases:['別名'+index],difficulty:'easy',category:'簡單',custom:true}));
 room.wordProvider=()=>words;
 room.configure(host.id,{seconds:60,customPercent:100});room.start();
 assert.equal(room.phase,'choosing');assert.equal(room.view(guest.id).candidates.length,0);
 assert.equal(room.view(host.id).candidates.length,3);
 const selected=room.candidates[0];room.act(host.id,'choose',{questionId:selected.id});
 assert.equal(room.view(guest.id).question,null);
 assert.deepEqual(room.view(guest.id).hint,{category:'簡單',topicLabel:'綜合',length:[...selected.title].length});
 assert.throws(()=>room.act(host.id,'guess',{answer:selected.title}),/下一輪|不能猜/);
 const strokeId=randomUUID(),batchId=randomUUID();
 assert.throws(()=>room.addStroke(guest.id,{canvasEpoch:room.canvas.epoch,round:1,batchId,strokeId,tool:'brush',color:'#123456',size:5,points:[[1,2]]}),/畫者/);
 assert.throws(()=>room.addStroke(host.id,{canvasEpoch:room.canvas.epoch,round:1,batchId,strokeId,tool:'brush',color:'red',size:5,points:[[1,2]]}),/格式/);
 const stroke=room.addStroke(host.id,{canvasEpoch:room.canvas.epoch,round:1,batchId,strokeId,tool:'brush',color:'#123456',size:5,points:[[1,2],[3,4]]});
 assert.equal(stroke.stroke.points.length,2);
 assert.equal(room.addStroke(host.id,{canvasEpoch:room.canvas.epoch,round:1,batchId,strokeId,tool:'brush',color:'#123456',size:5,points:[[1,2]]}).duplicate,true);
 assert.equal(room.canvasSnapshot().strokes.length,1);
 room.canvasCommand(host.id,{canvasEpoch:room.canvas.epoch,round:1,command:'undo'});assert.equal(room.canvasSnapshot().strokes.length,0);
 const fill={canvasEpoch:room.canvas.epoch,round:1,batchId:randomUUID(),strokeId:randomUUID(),tool:'fill',color:'#e88751',size:5,points:[[100,80]]};
 assert.throws(()=>room.addStroke(guest.id,fill),/畫者/);
 assert.throws(()=>room.addStroke(host.id,{...fill,points:[[100,80],[200,90]]}),/格式/);
 room.addStroke(host.id,fill);
 assert.equal(room.canvasSnapshot().strokes[0].tool,'fill');
 assert.deepEqual(room.canvasSnapshot().strokes[0].points,[[100,80]]);
 room.canvasCommand(host.id,{canvasEpoch:room.canvas.epoch,round:1,command:'undo'});assert.equal(room.canvasSnapshot().strokes.length,0);
 assert.throws(()=>room.addStroke(host.id,{canvasEpoch:room.canvas.epoch,round:0,batchId:randomUUID(),strokeId,tool:'brush',color:'#123456',size:5,points:[[1,2]]}),/舊回合/);
 room.act(guest.id,'guess',{answer:'猜錯'});assert.equal(room.view(guest.id).guesses.at(-1).answer,'猜錯');
 time+=800;
 room.act(guest.id,'guess',{answer:selected.aliases[0]});
 assert.equal(room.phase,'reveal');assert.equal(room.view(guest.id).question.title,selected.title);
 assert.ok(guest.score>=30&&guest.score<=100);assert.equal(host.score,15);
 room.act(host.id,'next');assert.equal(room.presenterId,guest.id);
 const second=room.candidates[0];room.act(guest.id,'choose',{questionId:second.id});
 assert.equal(room.view(guest.id).host,false);
 room.addStroke(guest.id,{canvasEpoch:room.canvas.epoch,round:2,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:5,points:[[10,20],[30,40]]});
 assert.equal(room.canvasSnapshot().strokes.length,1);
 room.act(host.id,'guess',{answer:second.title});room.act(host.id,'next');
 assert.equal(room.phase,'finished');assert.equal(room.round,2);
});

test('late joiners wait one round, and timeout preserves the original seat',()=>{
 let time=2_000_000;
 const room=new DrawGuessRoom('LATE12','試玩',()=>0,()=>time),host=room.add('甲'),guest=room.add('乙');
 room.start();room.act(host.id,'choose',{questionId:room.candidates[0].id});
 const newcomer=room.add('丙');
 assert.equal(newcomer.waitingForNextRound,true);
 assert.throws(()=>room.act(newcomer.id,'guess',{answer:room.question.title}),/下一輪/);
 time+=16000;assert.equal(room.auto(),true);
 assert.equal(room.phase,'reveal');
 room.act(host.id,'next');
 assert.equal(room.participantIds.includes(newcomer.id),true);
});

test('host category limits all three drawing candidates and rejects unknown categories',()=>{
 const room=new DrawGuessRoom('TOPIC1','題材試玩',()=>0),host=room.add('甲');room.add('乙');
 assert.throws(()=>room.configure(host.id,{seconds:90,topic:'invalid'}),/題目類別/);
 room.configure(host.id,{seconds:90,customPercent:100,topic:'animals'});
 room.start();
 assert.equal(room.view(host.id).options.topic,'animals');
 assert.equal(room.candidates.length,3);
 assert.ok(room.candidates.every(word=>word.topic==='animals'));
 assert.throws(()=>room.configure(host.id,{seconds:90,topic:'food'}),/遊戲中/);
});

test('multiple built-in categories draw only their union, without custom or unselected topics',()=>{
 const room=new DrawGuessRoom('MULTI1','多類別',()=>0),host=room.add('甲');
 for(let i=1;i<8;i++)room.add('朋友'+i);
 room.wordProvider=()=>[{id:'custom-other',title:'自訂動物',topic:'animals',custom:true}];
 room.configure(host.id,{seconds:90,topics:['food','transport']});
 room.start();const seen=new Set();
 while(room.phase==='choosing'){
  assert.equal(room.candidates.length,3);
  assert.equal(new Set(room.candidates.map(word=>word.id)).size,3);
  for(const word of room.candidates){assert.ok(['food','transport'].includes(word.topic));assert.equal(word.custom,false);seen.add(word.topic);}
  room.choose(room.presenterId,room.candidates[0].id);room.reveal('時間到');room.next(host.id);
 }
 assert.deepEqual([...seen].sort(),['food','transport']);
});

test('custom is an independent category including submissions from every thematic category',()=>{
 const room=new DrawGuessRoom('CUSTOM','自定義',max=>max-1),host=room.add('甲');room.add('乙');
 room.wordProvider=()=>['food','animals','misc'].map((topic,index)=>({id:'custom-'+index,title:'投稿'+index,topic,custom:true}));
 room.configure(host.id,{seconds:90,topics:['custom']});room.start();
 assert.equal(room.candidates.length,3);assert.ok(room.candidates.every(word=>word.custom));
 assert.deepEqual(room.candidates.map(word=>word.topic).sort(),['animals','food','misc']);
 const mixed=new DrawGuessRoom('MIXED1','混合',max=>max-1),owner=mixed.add('甲');mixed.add('乙');mixed.wordProvider=room.wordProvider;
 mixed.configure(owner.id,{seconds:90,topics:['food','custom']});mixed.start();
 assert.equal(mixed.candidates.length,3);assert.ok(mixed.candidates.every(word=>word.custom||word.topic==='food'));
 assert.ok(mixed.candidates.some(word=>word.custom&&word.topic==='animals'));
});

test('empty and invalid selections cannot change settings, and an empty custom bank cannot start a broken round',()=>{
 const room=new DrawGuessRoom('EMPTY1','空題庫',()=>0),host=room.add('甲');room.add('乙');
 const original=structuredClone(room.options);
 for(const topics of [[],['unknown'],['food','food'],'food',null]){
  assert.throws(()=>room.configure(host.id,{seconds:60,topics}),/題目類別/);assert.deepEqual(room.options,original);
 }
 room.configure(host.id,{seconds:90,topics:['custom']});
 assert.throws(()=>room.start(),/還沒有題目/);assert.equal(room.phase,'waiting');assert.equal(room.round,0);
 room.wordProvider=()=>[{id:'custom-one',title:'第一道自訂題',topic:'misc',custom:true}];
 room.start();assert.equal(room.phase,'choosing');assert.equal(room.candidates[0].id,'custom-one');
 assert.throws(()=>room.configure(host.id,{seconds:90,topics:['food']}),/遊戲中/);
});

test('custom words persist in SQLite and reject malformed aliases',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-draw-words-')),file=path.join(root,'app.sqlite');
 let db;
 try{
  db=openDatabase(file);const user={id:randomUUID(),display_name:'朋友'};
  db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)").run(user.id,'draw-friend',user.display_name,'unused','member',new Date().toISOString());
  const store=new DrawWordStore(db),saved=store.add(user,{title:'腳踏車測試題',aliases:['自行車測試題'],difficulty:'easy'});
  assert.equal(store.list()[0].title,saved.title);
  assert.throws(()=>store.add(user,{title:'重複',aliases:['重複'],difficulty:'easy'}),/重複/);
  db.close();db=openDatabase(file);assert.equal(new DrawWordStore(db).list()[0].aliases[0],'自行車測試題');
 }finally{db?.close();try{fs.rmSync(root,{recursive:true,force:true});}catch{}}
});

test('authenticated HTTP draw room hides answers and restricts the stroke channel',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-draw-http-')),config={port:0,host:'127.0.0.1',publicUrl:null,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile),auth=createAuth(db);
 await auth.bootstrap('drawadmin','test-password-88888888');
 const admin=db.prepare("SELECT * FROM users WHERE username='drawadmin'").get(),invite=auth.createInvite(admin,{days:1});
 await auth.register({username:'drawguest',displayName:'猜者',password:'test-password-88888888',confirmPassword:'test-password-88888888',invite:invite.code},{setHeader(){}});
 db.close();const app=createApp(config);
 try{
  const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  async function login(username){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-password-88888888'})});assert.equal(response.status,200);return {Cookie:response.headers.get('set-cookie').split(';')[0]};}
  const host=await login('drawadmin'),guest=await login('drawguest');
  async function post(route,headers,data){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};}
  assert.equal((await post('create',host,{type:'draw',topic:'wrong'})).status,400);
  for(const topics of [[],['wrong'],['food','food'],'food'])assert.equal((await post('create',host,{type:'draw',topics})).status,400);
  const multi=await post('create',host,{type:'draw',topics:['transport','food','custom']});assert.equal(multi.status,200);
  const multiState=await (await fetch(base+'/api/state?code='+multi.body.code,{headers:host})).json();
  assert.deepEqual(multiState.options.topics,['food','transport','custom']);
  assert.equal((await post('settings',host,{code:multi.body.code,seconds:90,topics:[]})).status,400);
  const unchanged=await (await fetch(base+'/api/state?code='+multi.body.code,{headers:host})).json();assert.deepEqual(unchanged.options.topics,multiState.options.topics);
  assert.equal((await post('leave',host,{code:multi.body.code})).status,200);
  const created=await post('create',host,{type:'draw',topic:'food'});assert.equal(created.status,200);
  const code=created.body.code;assert.equal((await post('join',guest,{code})).status,200);
  const initial=await (await fetch(base+'/api/state?code='+code,{headers:host})).json();assert.equal(initial.options.topic,'food');
  assert.equal((await post('settings',host,{code,seconds:90,customPercent:null,topic:'animals'})).status,200);
  assert.equal((await post('start',host,{code})).status,200);
  const chooser=await (await fetch(base+'/api/state?code='+code,{headers:host})).json();
  assert.equal(chooser.options.topic,'animals');assert.ok(chooser.candidates.every(word=>word.topic==='animals'));
  const hidden=await (await fetch(base+'/api/state?code='+code,{headers:guest})).json();
  assert.equal(chooser.candidates.length,3);assert.equal(hidden.candidates.length,0);
  assert.equal((await post('action',host,{code,action:'choose',questionId:chooser.candidates[0].id})).status,200);
  const drawing=await (await fetch(base+'/api/state?code='+code,{headers:guest})).json();
  assert.equal(drawing.question,null);assert.ok(drawing.hint);
  const batch={code,canvasEpoch:drawing.canvasEpoch,round:1,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:4,points:[[10,10],[12,12]]};
  assert.equal((await post('draw/stroke',guest,batch)).status,400);
  assert.equal((await post('draw/stroke',host,batch)).status,200);
  const snapshot=await (await fetch(base+'/api/draw/canvas?code='+code,{headers:guest})).json();assert.equal(snapshot.strokes.length,1);
  assert.equal(snapshot.canvasEpoch,drawing.canvasEpoch);
  assert.equal((await post('draw/stroke',host,{...batch,canvasEpoch:undefined,batchId:randomUUID()})).status,400);
  assert.equal((await post('leave',guest,{code})).status,200);assert.equal((await post('join',guest,{code})).status,200);assert.equal((await post('start',host,{code})).status,200);
  const reopened=await (await fetch(base+'/api/state?code='+code,{headers:host})).json();assert.equal(reopened.round,1);assert.notEqual(reopened.canvasEpoch,drawing.canvasEpoch);
  assert.equal((await post('action',host,{code,action:'choose',questionId:reopened.candidates[0].id})).status,200);
  assert.equal((await post('draw/stroke',host,batch)).status,400);
  assert.equal((await post('draw/command',host,{code,canvasEpoch:drawing.canvasEpoch,round:1,command:'clear'})).status,400);
  const accepted=await post('draw/stroke',host,{...batch,canvasEpoch:reopened.canvasEpoch});assert.equal(accepted.status,200);assert.equal(accepted.body.canvasEpoch,reopened.canvasEpoch);assert.deepEqual(accepted.body.quota,{usedFills:0,usedBatches:1,usedPoints:2});
  const abort=new AbortController();
  try{
   const response=await fetch(base+'/api/draw/events?code='+code,{headers:guest,signal:abort.signal}),reader=response.body.getReader();const ready=new TextDecoder().decode((await reader.read()).value),payload=JSON.parse(ready.split('\ndata: ')[1].trim());
   assert.equal(response.status,200);assert.equal(payload.canvasEpoch,reopened.canvasEpoch);assert.equal(payload.round,1);assert.equal(payload.version,accepted.body.version);
  }finally{abort.abort();}
  assert.equal((await fetch(base+'/api/draw/canvas?code='+code)).status,401);
  for(const asset of ['draw','draw.js','draw.css','draw-words','shared/stroke-canvas.js'])assert.equal((await fetch(base+'/'+asset,{headers:guest})).status,200,asset);
 }finally{await app.close();try{fs.rmSync(root,{recursive:true,force:true});}catch{}}
});
