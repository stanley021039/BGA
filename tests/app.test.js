const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('../src/app');
const {openDatabase}=require('../src/db/index');
const {createAuth}=require('../src/auth/index');

test('independent app instances can start, serve, and release their history locks',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-app-'));
 const config={port:0,host:'127.0.0.1',publicUrl:null,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 let app=createApp(config);
 try{
  const {port}=await app.listen();
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);
  for(const asset of ['api.js','room-reconnect.js','room-host.js','room-host.css','game-shell.js','game-shell.css']){
   const response=await fetch(`http://127.0.0.1:${port}/shared/${asset}`);
   assert.equal(response.status,200,asset);
   assert.match(response.headers.get('content-type'),asset.endsWith('.css')?/text\/css/:/text\/javascript/);
  }
  assert.equal((await fetch(`http://127.0.0.1:${port}/room-reconnect.js`)).status,200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/lobby.js`)).status,200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/lobby.css`)).status,200);
  await app.close();
  await app.close();
  assert.equal(fs.existsSync(path.join(root,'history','.lock')),false);
  app=createApp(config);
  const next=await app.listen();
  assert.equal((await fetch(`http://127.0.0.1:${next.port}/community`)).status,200);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('API errors distinguish unknown routes, missing rooms, and expired room sessions',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-app-errors-'));
 const config={port:0,host:'127.0.0.1',publicUrl:null,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('testadmin','test-password-123');db.close();
 const app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const withoutLogin=await fetch(base+'/api/missing');
  assert.equal(withoutLogin.status,401);
  assert.equal((await withoutLogin.json()).code,'LOGIN_REQUIRED');
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'testadmin',password:'test-password-123'})});
  assert.equal(login.status,200);
  const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
  assert.equal((await fetch(base+'/api/lobby')).status,401);
  const lobby=await (await fetch(base+'/api/lobby',{headers})).json();
  assert.equal(lobby.visitors.length,1);
  assert.equal(lobby.visitors[0].id,lobby.selfId);
  const lobbyMove=await fetch(base+'/api/lobby/move',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({x:60,y:60})});
  assert.equal(lobbyMove.status,200);
  assert.equal((await fetch(base+'/api/lobby/move',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({x:999,y:0})})).status,400);
  assert.equal((await fetch(base+'/api/lobby/emotes')).status,401);
  const emoteOptions=await (await fetch(base+'/api/lobby/emotes',{headers})).json();
  assert.ok(emoteOptions.emotes.some(emote=>emote.expression==='happy'&&emote.image.endsWith('happy.gif')));
  const lobbyEmote=await fetch(base+'/api/lobby/emote',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expression:'happy'})});
  assert.equal(lobbyEmote.status,200);
  assert.equal((await lobbyEmote.json()).visitors[0].emote.label,'開心');
  assert.equal((await fetch(base+'/api/lobby/emote',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expression:'made-up'})})).status,400);
  const unknown=await fetch(base+'/api/missing',{headers});
  assert.equal(unknown.status,404);
  assert.equal((await unknown.json()).code,'NOT_FOUND');
  const missing=await fetch(base+'/api/state?code=ABC123',{headers});
  assert.equal(missing.status,404);
  assert.equal((await missing.json()).code,'ROOM_NOT_FOUND');
  const created=await fetch(base+'/api/create',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({type:'poker',name:'A'})});
  assert.equal(created.status,200);
  const {code}=await created.json();
  for(const route of ['/poker/ABC123','/race/ABC123','/majority/ABC123']){
   const html=await (await fetch(base+route,{headers})).text();
   assert.match(html,/\/game-shell\.js/);
   assert.match(html,/\/game-shell\.css/);
  }
  const state=await fetch(base+'/api/state?code='+code,{headers});
  assert.equal(state.status,200);
  const message=await fetch(base+'/api/social',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({code,kind:'message',message:'今晚好！'})});
  assert.equal(message.status,200);
  assert.equal((await message.json()).social[0].message,'今晚好！');
  assert.equal((await (await fetch(base+'/api/state?code='+code,{headers})).json()).social[0].kind,'message');
  const options=await (await fetch(base+'/api/profile/options',{headers})).json();
  const appearance={...options.characters[2].appearance,expression:'happy'};
  assert.equal(options.characters.length,10);
  assert.equal(options.expressionLabels.happy,'開心');
  assert.equal((await fetch(base+'/api/community/avatars',{headers})).status,404);
  assert.equal((await fetch(base+'/avatar-picker.js',{headers})).status,404);
  const invalid=await fetch(base+'/api/profile/appearance',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...appearance,characterId:'user:00000000-0000-0000-0000-000000000000'})});
  assert.equal(invalid.status,400);
  const saved=await fetch(base+'/api/profile/appearance',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(appearance)});
  assert.equal(saved.status,200);
  const view=await (await fetch(base+'/api/state?code='+code,{headers})).json();
  assert.match(view.players[0].avatar,/^\/characters\/[a-f0-9-]+$/);
  const avatar=await fetch(base+view.players[0].avatar,{headers});
  assert.equal(avatar.headers.get('content-type'),'image/gif');
  assert.equal(Buffer.from(await avatar.arrayBuffer()).toString('ascii',0,6),'GIF89a');
  const png=fs.readFileSync(path.join(__dirname,'..','public/assets/characters/traveler-neutral.png'));
  const upload=await fetch(base+'/api/profile/characters',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'我的角色',base64:png.toString('base64'),mime:'image/png'})});
  assert.equal(upload.status,200);
  const own=await upload.json();
  const ownOptions=await (await fetch(base+'/api/profile/options',{headers})).json();
  assert.ok(ownOptions.characters.some(character=>character.id===own.id));
  const ownMedia=await fetch(base+ownOptions.characters.find(character=>character.id===own.id).expressions.neutral,{headers});
  assert.equal(ownMedia.headers.get('content-type'),'image/png');
  const rejected=await fetch(base+'/api/profile/characters/'+own.id.slice(5)+'/expressions',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expression:'happy',base64:Buffer.from('<svg/>').toString('base64'),mime:'image/png'})});
  assert.equal(rejected.status,400);
  const gif=fs.readFileSync(path.join(__dirname,'..','public/assets/characters/traveler-happy.gif'));
  const expression=await fetch(base+'/api/profile/characters/'+own.id.slice(5)+'/expressions',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expression:'happy',base64:gif.toString('base64'),mime:'image/gif'})});
  assert.equal(expression.status,200);
  const selectOwn=await fetch(base+'/api/profile/appearance',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({version:5,characterId:own.id,expression:'happy'})});
  assert.equal(selectOwn.status,200);
  assert.equal((await fetch(base+view.players[0].avatar,{headers})).headers.get('content-type'),'image/gif');
  const emote=await fetch(base+'/api/social',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({code,kind:'expression',expression:'happy'})});
  assert.equal(emote.status,200);
  const emoteState=await emote.json();
  assert.equal(emoteState.social.at(-1).kind,'message');
  assert.equal(emoteState.expressions.at(-1).kind,'expression');
  assert.match(emoteState.players[0].avatar,/\/assets\/characters\/user\/.*\/happy\?v=[a-f0-9]{64}$/);
  const other=await fetch(base+'/api/state?code='+code);
  assert.equal(other.status,401);
  assert.equal((await other.json()).code,'LOGIN_REQUIRED');
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
