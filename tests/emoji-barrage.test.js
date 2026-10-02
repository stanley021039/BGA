const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app');
const {openDatabase}=require('../src/db');
const {createAuth}=require('../src/auth');

test('all five games broadcast emoji without changing character expressions or avatars',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-emoji-'));
 const config={host:'127.0.0.1',port:0,dbFile:path.join(root,'app.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('emojiadmin','test-password-123');db.close();
 const app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const post=async(route,cookie,data)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const host=(await post('auth/login',null,{username:'emojiadmin',password:'test-password-123'})).cookie;
  const options=await (await fetch(base+'/api/social/options',{headers:{Cookie:host}})).json();assert.ok(options.emojis.includes('❤️'));
  for(const [index,type] of ['poker','thunder','majority','gift','draw'].entries()){
   const invite=(await post('admin/invites',host,{days:1})).data.code;
   const friend=(await post('auth/register',null,{username:'emoji_friend_'+index,password:'test-password-123',confirmPassword:'test-password-123',invite})).cookie;
   const {code}=(await post('create',host,{type})).data;
   const forbidden=await post('social',friend,{code,kind:'emoji',emoji:'🎉'});assert.notEqual(forbidden.status,200);
   await post('join',friend,{code});
   const before=await (await fetch(base+'/api/state?code='+code,{headers:{Cookie:friend}})).json();
   assert.equal((await post('social',friend,{code,kind:'emoji',emoji:'<img onerror=alert(1)>'})).data.code,'INVALID_EMOJI');
   const sent=await post('social',friend,{code,kind:'emoji',emoji:'🎉'});assert.equal(sent.status,200);
   assert.equal(sent.data.barrages[0].kind,'emoji');assert.equal(sent.data.barrages[0].emoji,'🎉');
   assert.deepEqual(sent.data.expressions,before.expressions);assert.deepEqual(sent.data.players.map(player=>player.avatar),before.players.map(player=>player.avatar));
   const hostView=await (await fetch(base+'/api/state?code='+code,{headers:{Cookie:host}})).json();assert.equal(hostView.barrages[0].emoji,'🎉');
   assert.equal((await post('social',friend,{code,kind:'emoji',emoji:'😂'})).status,429);
  }
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
