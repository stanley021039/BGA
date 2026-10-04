const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {RoomMusic}=require('../src/music/room');
const {MusicStore,MAX_BYTES,audioType}=require('../src/music/store');
const {openDatabase}=require('../src/db');
const {createAuth}=require('../src/auth');
const {createApp}=require('../src/app');
const mp3=Buffer.concat([Buffer.from([255,251,144,100]),Buffer.alloc(830)]);

test('room transport and shuffle advance once on the server for every listener',()=>{
 let now=0;const tracks=[{id:'a',title:'A',duration:10},{id:'b',title:'B',duration:20},{id:'c',title:'C',duration:30}],store={list:()=>tracks,get:id=>tracks.find(t=>t.id===id)},room=new RoomMusic(()=>now,store,()=>0);
 room.act('select',{trackId:'a'},store);room.act('next',{},store);assert.equal(room.snapshot().track.id,'b');
 room.act('previous',{},store);assert.equal(room.snapshot().track.id,'a');room.act('previous',{},store);assert.equal(room.snapshot().track.id,'c');
 room.act('mode',{mode:'repeat'},store);now=31000;assert.equal(room.snapshot().position,1);assert.equal(room.snapshot().track.id,'c');
 room.act('mode',{mode:'shuffle'},store);now=61000;const first=room.snapshot();assert.equal(first.track.id,'a');assert.equal(first.position,0);assert.equal(first.playing,true);
 assert.equal(room.snapshot().track.id,first.track.id);assert.equal(room.snapshot().version,first.version);
 room.act('pause',{},store);now+=60000;assert.equal(room.snapshot().track.id,'a');assert.equal(room.snapshot().playing,false);
 room.act('mode',{mode:'none'},store);room.act('play',{},store);now+=11000;assert.equal(room.snapshot().playing,false);
 assert.throws(()=>room.act('mode',{mode:'bad'},store),/模式/);
 const empty=new RoomMusic(()=>now,{list:()=>[]});assert.throws(()=>empty.act('next',{},empty.store),/沒有歌曲/);
});

test('room music uses elapsed server time, pauses, seeks, loops, and restarts ended tracks',()=>{
 let now=100000;const room=new RoomMusic(()=>now),store={get:()=>({id:'a',title:'音樂',duration:10})};
 room.act('select',{trackId:'a'},store);now+=3200;assert.equal(room.snapshot().position,3.2);
 room.act('pause',{},store);now+=5000;assert.equal(room.snapshot().position,3.2);
 room.act('seek',{position:8},store);room.act('play',{},store);now+=3000;
 assert.equal(room.snapshot().playing,false);assert.equal(room.snapshot().position,10);
 room.act('play',{},store);assert.equal(room.snapshot().position,0);
 room.act('loop',{loop:true},store);now+=23500;assert.equal(room.snapshot().position,3.5);
 assert.throws(()=>room.act('seek',{position:-1},store),/進度/);
 assert.throws(()=>room.act('loop',{loop:'true'},store),/循環/);
 room.act('stop',{},store);assert.equal(room.snapshot().track,null);
});

test('music storage validates content, metadata, ownership, quotas, and persists files',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-music-store-')),db=openDatabase(path.join(root,'app.sqlite'));
 try{
  const auth=createAuth(db);await auth.bootstrap('musicadmin','test-password-123');
  const user=db.prepare('SELECT * FROM users').get(),store=new MusicStore(db,path.join(root,'music'));
  assert.equal(audioType(mp3).mime,'audio/mpeg');
  for(const bytes of [Buffer.from('<html>'),Buffer.alloc(100),Buffer.from('MZ'+'x'.repeat(100))])assert.throws(()=>audioType(bytes),/音樂/);
  assert.throws(()=>store.add(user,{title:'a',duration:NaN},mp3),/長度/);
  assert.throws(()=>store.add(user,{title:'a\n',duration:2},mp3),/曲名/);
  assert.throws(()=>store.add(user,{title:'a',duration:2},Buffer.alloc(MAX_BYTES+1)),/20 MB/);
  const track=store.add(user,{title:'測試',duration:2},mp3);
  assert.deepEqual(fs.readFileSync(path.join(root,'music',track.id+'.mp3')),mp3);
  assert.throws(()=>store.remove({id:'stranger',role:'member'},track.id),/自己/);
  for(let i=1;i<20;i++)store.add(user,{title:'歌'+i,duration:2},mp3);
  assert.throws(()=>store.add(user,{title:'滿了',duration:2},mp3),/20 首/);
  store.remove(user,track.id);assert.equal(store.list().length,19);
  assert.equal(fs.existsSync(path.join(root,'music',track.id+'.mp3')),false);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});

test('authenticated streaming ranges, shared library, host controls, isolation, SSE and kicking',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-music-http-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('musicadmin','test-password-123');db.close();
 const app=createApp(config);let reader;
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const post=async(route,cookie,data)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const host=(await post('auth/login',null,{username:'musicadmin',password:'test-password-123'})).cookie;
  const invite=(await post('admin/invites',host,{days:1})).body.code;
  const friend=(await post('auth/register',null,{username:'musicfriend',displayName:'朋友',password:'friend-password-123',confirmPassword:'friend-password-123',invite})).cookie;
  const upload=await fetch(base+'/api/music/upload',{method:'POST',headers:{Cookie:friend,'Content-Type':'audio/mpeg','X-Music-Title':encodeURIComponent('朋友的歌'),'X-Music-Duration':'60'},body:mp3});
  assert.equal(upload.status,200);const track=await upload.json();
  assert.equal((await fetch(base+'/api/music')).status,401);
  const library=await (await fetch(base+'/api/music',{headers:{Cookie:host}})).json();assert.equal(library.tracks[0].title,'朋友的歌');
  const asset=base+'/assets/music/'+track.id;
  assert.equal((await fetch(asset)).status,401);
  for(const [range,start,end]of [['bytes=2-5',2,5],['bytes=-4',mp3.length-4,mp3.length-1],['bytes=800-',800,mp3.length-1]]){
   const r=await fetch(asset,{headers:{Cookie:host,Range:range}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),`bytes ${start}-${end}/${mp3.length}`);assert.deepEqual(Buffer.from(await r.arrayBuffer()),mp3.subarray(start,end+1));
  }
  assert.equal((await fetch(asset,{method:'HEAD',headers:{Cookie:host}})).headers.get('content-length'),String(mp3.length));
  assert.equal((await fetch(asset,{headers:{Cookie:host,Range:'bytes=10000-'}})).status,416);
  assert.equal((await post('music/'+track.id+'/delete',friend,{unrelated:true})).status,200);
  const again=await fetch(base+'/api/music/upload',{method:'POST',headers:{Cookie:host,'Content-Type':'audio/mpeg','X-Music-Title':'test','X-Music-Duration':'60'},body:mp3});const owned=await again.json();
  assert.equal((await post('music/'+owned.id+'/delete',friend,{})).status,403);
  const a=(await post('create',host,{type:'poker',roomName:'音樂測試'})).body.code;
  const b=(await post('create',friend,{type:'poker',roomName:'另一桌'})).body.code;
  await post('join',friend,{code:a});
  assert.equal((await post('room-music',friend,{code:a,action:'select',trackId:owned.id})).status,403);
  for(const action of ['previous','next','mode'])assert.equal((await post('room-music',friend,{code:a,action,mode:'shuffle'})).status,403);
  const stream=await fetch(base+'/api/room-music/events?code='+a,{headers:{Cookie:friend}});reader=stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value),/event: music/);
  const selected=await post('room-music',host,{code:a,action:'select',trackId:owned.id});assert.equal(selected.body.playing,true);
  assert.match(new TextDecoder().decode((await reader.read()).value),new RegExp(owned.id));
  const state=await (await fetch(base+'/api/room-music?code='+a,{headers:{Cookie:friend}})).json();assert.equal(state.track.id,owned.id);
  assert.equal((await (await fetch(base+'/api/room-music?code='+b,{headers:{Cookie:friend}})).json()).track,null);
  await post('room-music',host,{code:a,action:'pause'});assert.equal((await (await fetch(base+'/api/room-music?code='+a,{headers:{Cookie:friend}})).json()).playing,false);
  await post('music/'+owned.id+'/delete',host,{});assert.equal((await (await fetch(base+'/api/room-music?code='+a,{headers:{Cookie:friend}})).json()).track,null);
  const view=await (await fetch(base+'/api/state?code='+a,{headers:{Cookie:friend}})).json();
  assert.equal((await post('kick',host,{code:a,playerId:view.me,confirmed:true})).status,200);
  assert.equal((await fetch(base+'/api/room-music?code='+a,{headers:{Cookie:friend}})).status,403);
  for(const game of ['poker','race','majority','gift','draw']){const html=await (await fetch(base+'/'+game,{headers:{Cookie:host}})).text();assert.match(html,/shared\/table-music.js/);}
 }finally{await reader?.cancel();await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});
