const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');

test('independent avatar and character settings validate ownership, persist, and preserve old editor updates',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-profile-settings-')),config={port:0,host:'127.0.0.1',dbFile:path.join(root,'app.sqlite'),communityDir:path.join(root,'community'),historyDir:path.join(root,'history')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('settingsadmin','test-password-123');db.close();let app=createApp(config);
 try{
  let {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const post=async(route,cookie,data)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const get=async(route,cookie)=>{const r=await fetch(base+'/api/'+route,{headers:cookie?{Cookie:cookie}:{}});return {status:r.status,data:await r.json()};};
  const host=(await post('auth/login',null,{username:'settingsadmin',password:'test-password-123'})).cookie;
  const invite=(await post('admin/invites',host,{days:1})).data.code;
  const friend=(await post('auth/register',null,{username:'settingsfriend',password:'test-password-123',confirmPassword:'test-password-123',invite})).cookie;
  assert.equal((await get('profile/settings')).status,401);
  const png=fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png'));
  const artwork=(await post('artworks',host,{name:'頭像',mime:'image/png',base64:png.toString('base64')})).data;
  const appearance={version:5,characterId:'builtin:woods',expression:'happy'},avatar={kind:'artwork',artworkId:artwork.id};
  assert.equal((await post('profile/settings',friend,{appearance,avatar})).status,400);
  const saved=await post('profile/settings',host,{appearance,avatar});assert.equal(saved.status,200);assert.deepEqual(saved.data.appearance,appearance);assert.deepEqual(saved.data.avatar,avatar);
  const media=await fetch(base+'/api/profile/avatar',{headers:{Cookie:host}});assert.equal(media.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await media.arrayBuffer()),png);
  assert.equal((await fetch(base+'/api/profile/avatar')).status,401);
  assert.equal((await post('profile/settings',host,{appearance:{...appearance,characterId:'builtin:missing'},avatar})).status,400);
  assert.deepEqual((await get('profile/settings',host)).data.appearance,appearance);
  await post('profile/appearance',host,{...appearance,expression:'neutral'});
  assert.deepEqual((await get('profile/settings',host)).data.avatar,avatar);
  await app.close();app=createApp(config);({port}=await app.listen());base=`http://127.0.0.1:${port}`;
  assert.deepEqual((await get('profile/settings',host)).data.avatar,avatar);
  await post('artworks/'+artwork.id+'/delete',host,{});
  const fallback=(await get('profile/settings',host)).data;assert.equal(fallback.avatar.kind,'character');assert.equal(fallback.avatar.characterId,'builtin:woods');
  const switched=await post('profile/settings',host,{appearance,avatar:{kind:'character',characterId:'builtin:mage',expression:'neutral'}});assert.equal(switched.status,200);assert.equal(switched.data.appearance.characterId,'builtin:woods');
  const image=await fetch(base+'/api/profile/avatar',{headers:{Cookie:host},redirect:'manual'});assert.equal(image.status,302);assert.equal(image.headers.get('location'),'/assets/characters/mage-neutral.png');
  const shared=(await post('profile/characters',host,{name:'分享角色',mime:'image/png',base64:png.toString('base64')})).data.id;
  await post('profile/characters/'+shared.slice(5)+'/sharing',host,{shared:true});
  const friendAvatar={kind:'character',characterId:'builtin:mage',expression:'neutral'};
  assert.equal((await post('profile/settings',friend,{appearance:{version:5,characterId:shared,expression:'neutral'},avatar:friendAvatar})).status,200);
  await post('profile/characters/'+shared.slice(5)+'/sharing',host,{shared:false});
  const revoked=(await get('profile/settings',friend)).data;assert.deepEqual(revoked.avatar,friendAvatar);assert.equal(revoked.appearance.characterId,'builtin:traveler');
  for(const route of ['/','/settings','/profile','/studio','/history','/poker','/race','/majority','/gift','/draw']){const r=await fetch(base+route,{headers:{Cookie:host}});assert.equal(r.status,200);assert.match(await r.text(),/data-site-header/);}
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});
