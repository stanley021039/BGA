const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
test('collection permissions, avatar sharing/revocation and character deletion survive restart',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-collection-')),config={port:0,host:'127.0.0.1',dbFile:path.join(root,'app.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('collectadmin','test-password-123');db.close();let app=createApp(config);
 try{
  let base='http://127.0.0.1:'+(await app.listen()).port;
  const post=async(route,cookie,data)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const get=async(route,cookie)=>{const r=await fetch(base+'/api/'+route,{headers:cookie?{Cookie:cookie}:{}});return {status:r.status,data:await r.json()};};
  const host=(await post('auth/login',null,{username:'collectadmin',password:'test-password-123'})).cookie;
  const invite=(await post('admin/invites',host,{days:1})).data.code,friend=(await post('auth/register',null,{username:'collectfriend',password:'test-password-123',confirmPassword:'test-password-123',invite})).cookie;
  assert.equal((await get('collection/avatars')).status,401);
  const png=fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png'));
  const artwork=(await post('artworks',host,{name:'私人頭像',mime:'image/png',base64:png.toString('base64')})).data;
  assert.equal((await get('collection/avatars',friend)).data.artworks.length,0);
  assert.equal((await fetch(base+artwork.url,{headers:{Cookie:friend}})).status,404);
  assert.equal((await post('artworks/'+artwork.id+'/sharing',friend,{shared:true})).status,404);
  await post('artworks/'+artwork.id+'/sharing',host,{shared:true});
  const shared=(await get('collection/avatars',friend)).data.artworks[0];assert.equal(shared.owned,false);assert.equal(shared.shared,true);
  assert.equal((await fetch(base+artwork.url,{headers:{Cookie:friend}})).status,200);
  const appearance={version:5,characterId:'builtin:mage',expression:'neutral'};
  assert.equal((await post('profile/settings',friend,{appearance,avatar:{kind:'artwork',artworkId:artwork.id}})).status,200);
  await app.close();app=createApp(config);base='http://127.0.0.1:'+(await app.listen()).port;
  assert.equal((await get('collection/avatars',friend)).data.artworks[0].id,artwork.id);
  await post('artworks/'+artwork.id+'/sharing',host,{shared:false});
  assert.equal((await fetch(base+artwork.url,{headers:{Cookie:friend}})).status,404);
  assert.equal((await get('profile/settings',friend)).data.avatar.kind,'character');
  await post('profile/settings',friend,{appearance,avatar:{kind:'character',characterId:'builtin:mage',expression:'neutral'}});
  assert.equal((await post('artworks/'+artwork.id+'/delete',friend,{})).status,404);
  const character=(await post('profile/characters',host,{name:'收藏建立角色',artworkId:artwork.id})).data.id;
  assert.equal((await post('profile/characters/'+character.slice(5)+'/delete',friend,{})).status,404);
  await post('profile/characters/'+character.slice(5)+'/sharing',host,{shared:true});
  await post('profile/appearance',friend,{version:5,characterId:character,expression:'neutral'});
  await post('profile/characters/'+character.slice(5)+'/delete',host,{});
  const fallback=(await get('profile/settings',friend)).data;assert.equal(fallback.appearance.characterId,'builtin:traveler');assert.equal(fallback.avatar.characterId,'builtin:mage');
  const page=await fetch(base+'/collection',{headers:{Cookie:host}});assert.equal(page.status,200);assert.match(await page.text(),/section-music/);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});
