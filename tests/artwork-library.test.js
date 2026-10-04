const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('../src/app');
const {openDatabase}=require('../src/db/index');
const {createAuth}=require('../src/auth/index');

test('private account artwork can be copied into a character, expression, and gift',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-artworks-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const setup=openDatabase(config.dbFile);await createAuth(setup).bootstrap('artist','test-password-123');setup.close();
 let app=createApp(config);
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  async function post(route,cookie,data){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
  const owner=await post('auth/login',null,{username:'artist',password:'test-password-123'});
  const invite=await post('admin/invites',owner.cookie,{days:1});
  const friend=await post('auth/register',null,{username:'artfriend',displayName:'好友',password:'friend-password-123',confirmPassword:'friend-password-123',invite:invite.body.code});
  const png=fs.readFileSync(path.join(__dirname,'..','public/assets/characters/traveler-neutral.png'));
  const art=await post('artworks',owner.cookie,{name:'我的畫作',mime:'image/png',base64:png.toString('base64')});
  assert.equal(art.status,200);
  assert.equal((await fetch(base+art.body.url,{headers:{Cookie:owner.cookie}})).status,200);
  assert.equal((await fetch(base+art.body.url,{headers:{Cookie:friend.cookie}})).status,404);
  assert.equal((await fetch(base+art.body.url)).status,401);
  assert.equal((await post('artworks',owner.cookie,{name:'壞圖',mime:'image/png',base64:Buffer.from('<svg/>').toString('base64')})).body.code,'INVALID_CHARACTER_IMAGE');
  const friendList=await (await fetch(base+'/api/artworks',{headers:{Cookie:friend.cookie}})).json();
  assert.equal(friendList.artworks.length,0);
  assert.equal((await post('profile/characters',friend.cookie,{name:'借圖',artworkId:art.body.id})).status,404);
  assert.equal((await post('community/gifts',friend.cookie,{title:'不能借圖的禮物',category:'奇想',image:{artworkId:art.body.id}})).status,404);
  const character=await post('profile/characters',owner.cookie,{name:'畫作角色',artworkId:art.body.id});
  assert.equal(character.status,200);
  const emote=await post(`profile/characters/${character.body.id.slice(5)}/emotes`,owner.cookie,{name:'笑',artworkId:art.body.id});
  assert.equal(emote.status,200);
  const gift=await post('community/gifts',owner.cookie,{title:'畫作相框禮物',category:'奇想',image:{artworkId:art.body.id}});
  assert.equal(gift.status,200);
  assert.equal((await fetch(base+gift.body.image,{headers:{Cookie:friend.cookie}})).status,200);
  assert.equal((await post(`artworks/${art.body.id}/delete`,friend.cookie,{})).status,404);
  assert.equal((await post(`artworks/${art.body.id}/delete`,owner.cookie,{})).status,200);
  assert.equal((await fetch(base+art.body.url,{headers:{Cookie:owner.cookie}})).status,404);
  assert.equal((await fetch(base+gift.body.image,{headers:{Cookie:friend.cookie}})).status,200);
  const options=await (await fetch(base+'/api/profile/options',{headers:{Cookie:owner.cookie}})).json();
  assert.ok(options.characters.find(item=>item.id===character.body.id).expressions[emote.body.expression]);
  await app.close();app=createApp(config);await app.listen();
  const saved=openDatabase(config.dbFile);
  assert.equal(saved.prepare('PRAGMA user_version').get().user_version,12);
  assert.equal(saved.prepare('SELECT COUNT(*) AS n FROM user_artworks').get().n,0);
  saved.close();
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
