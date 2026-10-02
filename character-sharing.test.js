const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('./src/app');
const {openDatabase}=require('./src/db/index');
const {createAuth}=require('./src/auth/index');

test('friends can choose shared characters, while private art and editing stay with the author',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-character-sharing-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const setup=openDatabase(config.dbFile);
 await createAuth(setup).bootstrap('artist','test-password-123');
 setup.close();
 let app=createApp(config);
 try{
  const {port}=await app.listen();
  const base=`http://127.0.0.1:${port}`;
  async function post(route,cookie,data){
   const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
   return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function get(route,cookie){return fetch(base+route,{headers:cookie?{Cookie:cookie}:{}});}
  const artist=await post('auth/login',null,{username:'artist',password:'test-password-123'});
  assert.equal((await fetch(base+'/studio',{redirect:'manual'})).status,302);
  assert.equal((await get('/studio',artist.cookie)).status,200);
  const invite=await post('admin/invites',artist.cookie,{days:1});
  const friend=await post('auth/register',null,{username:'friend',displayName:'好友',password:'friend-password-123',confirmPassword:'friend-password-123',invite:invite.body.code});
  const png=fs.readFileSync(path.join(__dirname,'public/assets/characters/traveler-neutral.png'));
  const created=await post('profile/characters',artist.cookie,{name:'好友的畫作',mime:'image/png',base64:png.toString('base64')});
  assert.equal(created.status,200);
  const uuid=created.body.id.slice(5),image=`/assets/characters/user/${uuid}/neutral`;
  assert.equal((await get(image,friend.cookie)).status,404);
  assert.equal((await get(image,artist.cookie)).status,200);
  let options=await (await get('/api/profile/options',friend.cookie)).json();
  assert.equal(options.characters.some(item=>item.id===created.body.id),false);
  assert.equal((await post('profile/appearance',friend.cookie,{version:5,characterId:created.body.id,expression:'neutral'})).body.code,'INVALID_APPEARANCE');
  assert.equal((await post(`profile/characters/${uuid}/sharing`,friend.cookie,{shared:true})).status,404);
  assert.equal((await post(`profile/characters/${uuid}/sharing`,artist.cookie,{shared:'true'})).body.code,'INVALID_SHARING');
  assert.equal((await post(`profile/characters/${uuid}/sharing`,artist.cookie,{shared:true})).status,200);
  options=await (await get('/api/profile/options',friend.cookie)).json();
  const shared=options.characters.find(item=>item.id===created.body.id);
  assert.equal(shared.source,'由 artist 分享');
  assert.equal(shared.owned,false);
  assert.equal(shared.shared,true);
  assert.equal((await get(image,friend.cookie)).headers.get('content-type'),'image/png');
  assert.equal((await post('profile/appearance',friend.cookie,{version:5,characterId:created.body.id,expression:'neutral'})).status,200);
  assert.equal((await post(`profile/characters/${uuid}/emotes`,friend.cookie,{name:'冒充作者',mime:'image/png',base64:png.toString('base64')})).status,404);
  assert.equal((await get('/characters/'+friend.body.id,artist.cookie)).status,200);
  assert.equal((await post(`profile/characters/${uuid}/sharing`,artist.cookie,{shared:false})).status,200);
  options=await (await get('/api/profile/options',friend.cookie)).json();
  assert.equal(options.characters.some(item=>item.id===created.body.id),false);
  assert.equal((await get(image,friend.cookie)).status,404);
  assert.equal((await get('/characters/'+friend.body.id,friend.cookie)).status,200);
  const me=await (await get('/api/auth/me',friend.cookie)).json();
  assert.equal(me.appearance.characterId,'builtin:traveler');
  await app.close();
  app=createApp(config);
  await app.listen();
  const persisted=openDatabase(config.dbFile);
  assert.equal(persisted.prepare('PRAGMA user_version').get().user_version,7);
  assert.equal(persisted.prepare('SELECT shared FROM player_characters WHERE id=?').get(uuid).shared,0);
  persisted.close();
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
