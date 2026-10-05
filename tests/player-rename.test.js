const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');

test('HTTP nickname updates current seats in all five games while keeping results, history and watch playback stable',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-player-rename-'));
 const config={port:0,host:'127.0.0.1',dbFile:path.join(root,'app.sqlite'),communityDir:path.join(root,'community'),historyDir:path.join(root,'history'),externalSideEffectsEnabled:false};
 const seed=openDatabase(config.dbFile),auth=createAuth(seed),hostId=await auth.bootstrap('rename_host','rename-password-123'),friendId=randomUUID();
 const hash=seed.prepare('SELECT password_hash FROM users WHERE id=?').get(hostId).password_hash;
 seed.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(friendId,'rename_guest','原來的朋友',hash,'member',new Date().toISOString());
 seed.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),'rename_third','第三位玩家',hash,'member',new Date().toISOString());seed.close();
 let app=createApp(config),base,cookies={};
 const request=async(route,who,data,extra={})=>{const response=await fetch(base+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
 const state=(code,who='host')=>request('state?code='+code,who);
 try{
  base='http://127.0.0.1:'+(await app.listen()).port;
  for(const who of ['host','guest','third'])cookies[who]=(await request('auth/login',null,{username:'rename_'+who,password:'rename-password-123'})).cookie;
  assert.equal((await request('profile/name',null,{displayName:'未登入'})).status,401);
  for(const displayName of ['', '  ', '一'.repeat(17), '錯\n誤', 123])assert.equal((await request('profile/name','guest',{displayName})).data.code,'INVALID_DISPLAY_NAME');
  const rooms={};for(const type of ['draw','gift','majority','thunder','poker']){
   const created=await request('create','host',{type});assert.equal(created.status,200);const code=created.data.code;
   assert.equal((await request('join','guest',{code})).status,200);
   if(['gift','majority'].includes(type))assert.equal((await request('join','third',{code})).status,200);
   if(type!=='draw')assert.equal((await request('start','host',{code})).status,200);
   rooms[type]={code,before:(await state(code)).data};
  }
  const code=rooms.draw.code;assert.equal((await request('start','host',{code})).status,200);
  const choosing=(await state(code)).data,word=choosing.candidates[0];
  assert.equal((await request('action','host',{code,action:'choose',questionId:word.id})).status,200);
  assert.equal((await request('action','guest',{code,action:'guess',answer:word.title})).status,200);
  rooms.draw.before=(await state(code)).data;assert.equal(rooms.draw.before.phase,'reveal');
  const resultId=rooms.draw.before.result.resultId,oldResult=(await request('draw/result?code='+code+'&resultId='+resultId,'guest')).data;
  const beforeWatch=(await request('room-watch?code='+code,'host')).data;
  const watch=(await request('room-watch','host',{code,action:'propose',url:'https://www.youtube.com/watch?v=M7lc1UVf-VE',requestId:randomUUID(),roomInstanceId:beforeWatch.roomInstanceId,watchSessionId:beforeWatch.watchSessionId,expectedRevision:beforeWatch.revision,controllerEpoch:beforeWatch.controllerEpoch})).data;
  const archiveBefore=Object.fromEntries(fs.readdirSync(config.historyDir).filter(name=>name.endsWith('.jsonl')).map(name=>[name,fs.readFileSync(path.join(config.historyDir,name),'utf8')]));
  const lobbyBefore=(await request('lobby/move','host',{x:80,y:90})).data.visitors.find(visitor=>visitor.id===hostId);
  await request('lobby','guest');
  const saved=await request('profile/name','host',{displayName:'新的房主',userId:friendId,username:'hacked',role:'member'});assert.equal(saved.status,200);assert.equal(saved.data.id,hostId);assert.equal(saved.data.username,'rename_host');assert.equal(saved.data.role,'admin');assert.equal(saved.cookie,undefined);
  const tagName='<svg/onload=x>';
  assert.equal((await request('profile/name','guest',{displayName:tagName})).status,200);
  for(const {code,before} of Object.values(rooms)){
   const next=(await state(code)).data,guest=(await state(code,'guest')).data;
   assert.equal(next.me,before.me);assert.equal(next.host,true);assert.equal(guest.host,false);
   assert.deepEqual(next.players.map(player=>player.id),before.players.map(player=>player.id));
   assert.equal(next.players.find(player=>player.id===next.me).name,'新的房主');assert.equal(next.players.find(player=>player.id===guest.me).name,tagName);
   assert.equal(next.phase,before.phase);assert.equal(next.round,before.round);assert.equal(next.deadline,before.deadline);
   for(const key of ['actor','active','cars','board','pot','participantIds','presenterId'])assert.deepEqual(next[key],before[key]);
   if(before.diceCheck){const {serverNow:beforeNow,...oldCheck}=before.diceCheck,{serverNow:nextNow,...newCheck}=next.diceCheck;assert.deepEqual(newCheck,oldCheck);assert.ok(nextNow>=beforeNow);}
   for(const player of before.players){const updated=next.players.find(other=>other.id===player.id);for(const metric of ['score','giveScore','getScore','stack','dice','chopper','out','color'])assert.deepEqual(updated[metric],player[metric]);}
   if(Number.isSafeInteger(before.version))assert.equal(next.version,before.version+2);
  }
  assert.deepEqual((await request('draw/result?code='+code+'&resultId='+resultId,'guest')).data,oldResult);
  assert.equal(oldResult.result.artist.name,'rename_host');
  for(const [name,text] of Object.entries(archiveBefore))assert.equal(fs.readFileSync(path.join(config.historyDir,name),'utf8'),text);
  const nextWatch=(await request('room-watch?code='+code,'guest')).data;assert.equal(nextWatch.controllerName,'新的房主');assert.equal(nextWatch.revision,watch.revision+2);
  for(const key of ['roomInstanceId','watchSessionId','controllerId','controllerEpoch','video','playback'])assert.deepEqual(nextWatch[key],watch[key]);
  const visitor=(await request('lobby','guest')).data.visitors.find(item=>item.id===hostId);assert.equal(visitor.name,'新的房主');assert.equal(visitor.moveId,lobbyBefore.moveId);assert.equal(visitor.targetX,lobbyBefore.targetX);assert.equal(visitor.targetY,lobbyBefore.targetY);
  assert.equal((await request('auth/me','guest')).data.displayName,tagName);
  const oldSeat=(await state(code,'guest')).data.me,oldScore=rooms.draw.before.players.find(player=>player.id===oldSeat).score;
  assert.equal((await request('leave','guest',{code})).status,200);
  assert.equal((await request('profile/name','guest',{displayName:'重返的朋友'})).status,200);
  assert.equal((await request('join','guest',{code})).status,200);
  const returned=(await state(code,'guest')).data;assert.equal(returned.me,oldSeat);assert.equal(returned.players.find(player=>player.id===oldSeat).score,oldScore);assert.equal(returned.players.find(player=>player.id===oldSeat).name,'重返的朋友');
  assert.deepEqual((await request('draw/result?code='+code+'&resultId='+resultId,'guest')).data,oldResult);
  await app.close();app=createApp(config);base='http://127.0.0.1:'+(await app.listen()).port;
  assert.equal((await request('auth/me','host')).data.displayName,'新的房主');assert.equal((await request('auth/me','guest')).data.displayName,'重返的朋友');
  const logged=await request('auth/login',null,{username:'rename_guest',password:'rename-password-123'});assert.equal(logged.status,200);assert.equal(logged.data.displayName,'重返的朋友');
  const hostEmoji='😀'.repeat(16),guestEmoji='🚗'.repeat(16);
  assert.equal((await request('profile/name','host',{displayName:hostEmoji})).status,200);
  assert.equal((await request('profile/name','guest',{displayName:guestEmoji})).status,200);
  const fresh=await request('create','host',{type:'draw'});assert.equal((await state(fresh.data.code)).data.players[0].name,hostEmoji);
  assert.equal((await request('join','guest',{code:fresh.data.code})).status,200);
  const freshGuest=(await state(fresh.data.code,'guest')).data;assert.equal(freshGuest.players.find(player=>player.id===freshGuest.me).name,guestEmoji);
  assert.equal((await request('start','host',{code:fresh.data.code})).status,200);
  assert.equal((await request('leave','guest',{code:fresh.data.code})).status,200);
  assert.equal((await request('join','guest',{code:fresh.data.code})).status,200);
  const emojiReturn=(await state(fresh.data.code,'guest')).data;assert.equal(emojiReturn.me,freshGuest.me);assert.equal(emojiReturn.players.find(player=>player.id===emojiReturn.me).name,guestEmoji);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
});
