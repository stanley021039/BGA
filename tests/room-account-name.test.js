const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
test('creating and joining all five room games uses saved account names instead of client-provided nicknames',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-account-room-name-')),config={host:'127.0.0.1',port:0,dbFile:path.join(root,'app.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),externalSideEffectsEnabled:false,achievementPurpose:'test'};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('name_admin','test-password-long');db.close();const app=createApp(config);
 try{const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  const post=async(route,cookie,data)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});assert.equal(response.status,200,route);return {body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const admin=(await post('auth/login',null,{username:'name_admin',password:'test-password-long'})).cookie;
  const invite=(await post('admin/invites',admin,{days:1})).body.code;
  const guest=(await post('auth/register',null,{username:'name_guest',displayName:'初始朋友',password:'test-password-long',confirmPassword:'test-password-long',invite})).cookie;
  await post('profile/name',admin,{displayName:'設定中的房主'});await post('profile/name',guest,{displayName:'設定中的朋友'});
  for(const type of ['poker','thunder','majority','gift','draw'])await t.test(type,async()=>{
   const room=(await post('create',admin,{type,name:'不應使用的開房暱稱',roomName:'帳號名稱測試'})).body;
   await post('join',guest,{code:room.code,name:'不應使用的入座暱稱'});
   const response=await fetch(base+'/api/state?code='+room.code,{headers:{Cookie:admin}});assert.equal(response.status,200);const state=await response.json();assert.deepEqual(state.players.map(player=>player.name),['設定中的房主','設定中的朋友']);
  });
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
