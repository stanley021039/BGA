const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('./src/app');
const {openDatabase}=require('./src/db/index');
const {createAuth}=require('./src/auth/index');

test('independent app instances can start, serve, and release their history locks',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-app-'));
 const config={port:0,host:'127.0.0.1',publicUrl:null,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 let app=createApp(config);
 try{
  const {port}=await app.listen();
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);
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
  const unknown=await fetch(base+'/api/missing',{headers});
  assert.equal(unknown.status,404);
  assert.equal((await unknown.json()).code,'NOT_FOUND');
  const missing=await fetch(base+'/api/state?code=ABC123',{headers});
  assert.equal(missing.status,404);
  assert.equal((await missing.json()).code,'ROOM_NOT_FOUND');
  const created=await fetch(base+'/api/create',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({type:'poker',name:'A'})});
  assert.equal(created.status,200);
  const {code}=await created.json();
  const state=await fetch(base+'/api/state?code='+code,{headers});
  assert.equal(state.status,200);
  const options=await (await fetch(base+'/api/profile/options',{headers})).json();
  const appearance={...options.defaults,hair:'curly',outfit:'jacket'};
  const invalid=await fetch(base+'/api/profile/appearance',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({...appearance,hairColor:'<script>'})});
  assert.equal(invalid.status,400);
  const saved=await fetch(base+'/api/profile/appearance',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(appearance)});
  assert.equal(saved.status,200);
  const view=await (await fetch(base+'/api/state?code='+code,{headers})).json();
  assert.match(view.players[0].avatar,/^\/avatars\/[a-f0-9-]+\.svg$/);
  const avatar=await fetch(base+view.players[0].avatar,{headers});
  assert.equal(avatar.headers.get('content-type'),'image/svg+xml');
  assert.match(await avatar.text(),/<svg/);
  const other=await fetch(base+'/api/state?code='+code);
  assert.equal(other.status,401);
  assert.equal((await other.json()).code,'LOGIN_REQUIRED');
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
