const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('./src/app');
const {openDatabase}=require('./src/db/index');
const {createAuth}=require('./src/auth/index');
const {createCharacterMediaAccess}=require('./src/profiles/media');
const {defaults}=require('./src/profiles/appearance');

const png=fs.readFileSync(path.join(__dirname,'public/assets/characters/traveler-neutral.png'));
const gif=fs.readFileSync(path.join(__dirname,'public/assets/characters/traveler-happy.gif'));
const replacement=fs.readFileSync(path.join(__dirname,'public/assets/characters/woods-happy.gif'));
const upload=bytes=>({base64:bytes.toString('base64')});

async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-media-access-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite')};
 const db=openDatabase(config.dbFile);
 await createAuth(db).bootstrap('artist','test-password-123');db.close();
 const app=createApp(config),{port}=await app.listen(),base=`http://127.0.0.1:${port}`;
 t.after(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true});});
 const get=(route,user)=>fetch(base+route,{headers:user?{Cookie:user.cookie}:{}});
 async function post(route,user,data){
  const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Cookie:user.cookie}:{})},body:JSON.stringify(data)});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 const owner=await post('auth/login',null,{username:'artist',password:'test-password-123'});
 async function member(username){
  const invite=await post('admin/invites',owner,{days:1});
  const user=await post('auth/register',null,{username,password:'test-password-123',confirmPassword:'test-password-123',invite:invite.body.code});
  assert.equal(user.status,200);return user;
 }
 const peer=await member('peer'),outsider=await member('outsider');
 const character=await post('profile/characters',owner,{name:'Private character',...upload(png)});
 assert.equal(character.status,200);
 const id=character.body.id,uuid=id.slice(5),media=expression=>`/assets/characters/user/${uuid}/${expression}`;
 const appearance=expression=>({version:5,characterId:id,expression});
 const select=(expression,user=owner)=>post('profile/appearance',user,appearance(expression));
 const expression=(name,bytes=gif)=>post(`profile/characters/${uuid}/expressions`,owner,{expression:name,...upload(bytes)});
 const sharing=shared=>post(`profile/characters/${uuid}/sharing`,owner,{shared});
 async function room(){
  const created=await post('create',owner,{type:'poker'});
  assert.equal((await post('join',peer,{code:created.body.code})).status,200);
  return created.body.code;
 }
 return {get,post,owner,peer,outsider,member,id,uuid,media,select,expression,sharing,room};
}

test('private owner preloads all art but a known UUID or avatar alias does not authorize other members',async t=>{
 const {get,owner,peer,outsider,media,select,expression}=await fixture(t);
 assert.equal((await expression('happy')).status,200);
 assert.equal((await select('neutral')).status,200);
 for(const image of [media('neutral'),media('happy')]){
  assert.equal((await get(image)).status,401);
  const own=await get(image,owner);
  assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'no-store');
  for(const user of [peer,outsider])assert.equal((await get(image,user)).status,404);
 }
 for(const suffix of ['', '.svg']){
  const alias='/characters/'+owner.body.id+suffix;
  assert.equal((await get(alias)).status,401);
  assert.equal((await get(alias,owner)).status,200);
  for(const user of [peer,outsider])assert.equal((await get(alias,user)).status,404);
 }
});

test('sharing permits editor images and avatar aliases; revocation denies new unused art even while owner wears the character',async t=>{
 const {get,post,owner,peer,outsider,id,media,select,expression,sharing,room}=await fixture(t);
 await select('neutral');await expression('sad');await sharing(true);
 for(const user of [peer,outsider]){
  const options=await (await get('/api/profile/options',user)).json();
  assert.ok(options.characters.some(character=>character.id===id));
  for(const image of [media('neutral'),media('sad'),'/characters/'+owner.body.id])assert.equal((await get(image,user)).status,200);
 }
 await select('sad',peer);
 assert.equal((await get('/characters/'+peer.body.id,outsider)).status,200);
 await room();
 assert.equal((await sharing(false)).status,200);
 assert.equal((await expression('happy')).status,200);
 for(const user of [peer,outsider]){
  const options=await (await get('/api/profile/options',user)).json();
  assert.equal(options.characters.some(character=>character.id===id),false);
  assert.equal((await get(media('happy'),user)).status,404);
  assert.equal((await get(media('sad'),user)).status,404);
  assert.equal((await post('profile/appearance',user,{version:5,characterId:id,expression:'neutral'})).status,400);
 }
 assert.equal((await get(media('neutral'),peer)).status,200);
 assert.equal((await get('/characters/'+owner.body.id,peer)).status,200);
 assert.equal((await get(media('neutral'),outsider)).status,404);
 assert.equal((await get('/characters/'+owner.body.id,outsider)).status,404);
 const peerProfile=await (await get('/api/auth/me',peer)).json();
 assert.deepEqual(peerProfile.appearance,defaults);
 // The actual saved expression, including a non-neutral one, is the only
 // private gallery image made visible by the avatar in the room.
 await select('happy');
 assert.equal((await get(media('happy'),peer)).status,200);
 assert.equal((await get(media('neutral'),peer)).status,404);
 assert.deepEqual(Buffer.from(await (await get('/characters/'+owner.body.id+'.svg',peer)).arrayBuffer()),gif);
});

test('room expression grants are audience-scoped, content-bound and revoked on kick',async t=>{
 const {get,post,owner,peer,outsider,media,select,expression,room}=await fixture(t);
 await select('neutral');await expression('happy');await expression('sad');
 const code=await room();
 assert.equal((await get(media('happy'),peer)).status,404);
 const sent=await post('social',owner,{code,kind:'expression',expression:'happy'});
 assert.equal(sent.status,200);
 const eventImage=sent.body.expressions[0].image;
 assert.match(eventImage,/\?v=[a-f0-9]{64}$/);
 const received=await (await get('/api/state?code='+code,peer)).json();
 assert.equal(received.expressions[0].image,eventImage);
 for(const image of [eventImage,media('happy')]){
  assert.equal((await get(image,peer)).status,200);
  assert.equal((await get(image,outsider)).status,404);
 }
 assert.equal((await get(media('sad'),peer)).status,404);
 // Replacing bytes under the old expression path does not reuse a broadcast.
 assert.equal((await expression('happy',replacement)).status,200);
 assert.equal((await get(eventImage,peer)).status,404);
 assert.equal((await get(media('happy'),peer)).status,404);
 assert.equal((await get(eventImage,owner)).status,404);
 assert.deepEqual(Buffer.from(await (await get(media('happy'),owner)).arrayBuffer()),replacement);
 const kick=await post('kick',owner,{code,playerId:received.me,confirmed:true});
 assert.equal(kick.status,200);
 for(const image of [media('neutral'),media('happy'),eventImage,'/characters/'+owner.body.id,'/characters/'+owner.body.id+'.svg'])assert.equal((await get(image,peer)).status,404);
});

test('lobby access requires existing presence and image reads cannot join or keep a visitor alive',async t=>{
 const {get,owner,peer,outsider,media,select,expression}=await fixture(t);
 await select('happy');await expression('happy');await select('happy');
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 await get('/api/lobby',owner);
 for(const image of [media('happy'),'/characters/'+owner.body.id])assert.equal((await get(image,peer)).status,404);
 let view=await (await get('/api/lobby',owner)).json();
 assert.deepEqual(view.visitors.map(visitor=>visitor.id),[owner.body.id]);
 await get('/api/lobby',peer);
 for(const image of [media('happy'),'/characters/'+owner.body.id])assert.equal((await get(image,peer)).status,200);
 assert.equal((await get(media('neutral'),peer)).status,404);
 assert.equal((await get(media('happy'),outsider)).status,404);
 t.mock.timers.tick(14000);
 await get('/api/lobby',owner);
 assert.equal((await get(media('happy'),peer)).status,200);
 t.mock.timers.tick(1001);
 assert.equal((await get(media('happy'),peer)).status,404);
 assert.equal((await get('/characters/'+owner.body.id,peer)).status,404);
 view=await (await get('/api/lobby',owner)).json();
 assert.deepEqual(view.visitors.map(visitor=>visitor.id),[owner.body.id]);
});

test('lobby expressions remain visible briefly only to actual recipients and do not expose replacements',async t=>{
 const {get,post,owner,peer,outsider,media,select,expression}=await fixture(t);
 await select('neutral');await expression('happy');
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 await get('/api/lobby',owner);await get('/api/lobby',peer);await get('/api/lobby',outsider);
 const sent=await post('lobby/emote',owner,{expression:'happy'});
 assert.equal(sent.status,200);
 const eventImage=sent.body.visitors.find(visitor=>visitor.id===owner.body.id).emote.image;
 await get('/api/lobby',peer);
 assert.equal((await get(eventImage,peer)).status,200);
 t.mock.timers.tick(5001);
 // Outsider was present, but never received this expression in a lobby view.
 assert.equal((await get(eventImage,outsider)).status,404);
 assert.equal((await get(eventImage,peer)).status,200);
 assert.equal((await get(media('happy'),peer)).status,200);
 assert.equal((await expression('happy',replacement)).status,200);
 assert.equal((await get(eventImage,peer)).status,404);
 assert.equal((await get(media('happy'),peer)).status,404);
 t.mock.timers.tick(2000);
 assert.equal((await get(media('happy'),peer)).status,404);
});

test('room expiry tolerance covers only delivered bytes and recipients who remain in that audience',async t=>{
 const {get,post,owner,peer,outsider,media,select,expression,sharing,room}=await fixture(t);
 await select('neutral');await expression('happy');await sharing(true);
 const code=await room();
 await post('join',outsider,{code});
 await select('neutral',peer);
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const sent=await post('social',peer,{code,kind:'expression',expression:'happy'});
 const eventImage=sent.body.expressions[0].image;
 await get('/api/state?code='+code,owner);
 await sharing(false);
 assert.equal((await get(eventImage,outsider)).status,200);
 t.mock.timers.tick(5001);
 // The sender received the event in the POST response; the other member did
 // not receive a room view after it was sent, so no expiry grace is granted.
 assert.equal((await get(eventImage,peer)).status,200);
 assert.equal((await get(eventImage,outsider)).status,404);
 assert.equal((await get(media('happy'),outsider)).status,404);
 t.mock.timers.tick(2000);
 assert.equal((await get(eventImage,peer)).status,404);
 assert.equal((await get(media('happy'),peer)).status,404);
});

test('media authorization denies disabled wearers and does not carry grace across audience boundaries',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-media-unit-')),db=openDatabase(path.join(root,'app.sqlite'));
 const owner='11111111-1111-1111-1111-111111111111',viewer='22222222-2222-2222-2222-222222222222',character='33333333-3333-3333-3333-333333333333';
 try{
  for(const [id,name] of [[owner,'owner'],[viewer,'viewer']])db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,'test','member','test')").run(id,name,name);
  db.prepare('INSERT INTO player_characters(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(character,owner,'test','test');
  for(const expression of ['neutral','happy'])db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?)').run(character,expression,'image/png',png);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'user:'+character,expression:'neutral'}),owner);
  let time=1000,audienceId='room:a',members=new Set([owner,viewer]);
  const events=[],access=createCharacterMediaAccess(db,id=>members.has(id)?[{id:audienceId,userIds:members,expressions:events}]:[],()=>time);
  const image=`/assets/characters/user/${character}/happy`,broadcast=access.broadcastImage(image);
  events.push({userId:owner,image:broadcast,until:6000});
  const emitted=[...events];
  time=6001;
  events.length=0;
  // The response selected the event before expiry; by the time its grant is
  // recorded, the audience no longer lists that event as active.
  access.rememberExpressions(viewer,'room:a',emitted);
  assert.ok(access.image(viewer,broadcast));
  audienceId='room:b';assert.equal(access.image(viewer,broadcast),null);
  audienceId='room:a';members=new Set([viewer]);assert.equal(access.image(viewer,broadcast),null);
  members=new Set([owner,viewer]);
  db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(owner);
  assert.equal(access.image(viewer,broadcast),null);
  assert.equal(access.image(owner,image),null);
  assert.equal(access.avatar(owner),null);
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
