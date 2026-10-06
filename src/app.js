const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomBytes}=require('node:crypto');
const {Room}=require('./games/poker'),{ThunderRoom}=require('./games/thunder'),{MajorityRoom}=require('./games/majority'),{GiftRoom}=require('./games/gift');
const {GiftStore}=require('./games/gift-store'),{GIFTS,CATEGORIES}=require('./games/gift-catalog');
const {DrawGuessRoom,validTopic,validTopics,DRAW_CATEGORIES}=require('./games/draw-guess'),{DrawWordStore}=require('./games/draw-guess-store'),{TOPICS}=require('./games/draw-guess-words');
const {AchievementStore}=require('./achievements/store');
const {MarketStore}=require('./market/store');
const {HistoryStore}=require('./history/store'),{CommunityStore}=require('./community/store');
const {startRoomScheduler}=require('./rooms/scheduler');
const {reconnectPlayer}=require('./rooms/reconnect');
const {leavePlayer,expireEmptyRooms,endRoomHistory}=require('./rooms/lifecycle');
const {listRooms}=require('./rooms/listing');
const {rejoinPlayer}=require('./rooms/membership');
const {createLobby}=require('./rooms/lobby');
const {HttpError,writeError}=require('./http/errors');
const {clientAddress,setSecurityHeaders}=require('./http/security');
const {openDatabase}=require('./db/index');
const {createAuth}=require('./auth/index');
const {BoardStore}=require('./community/board');
const {createGitHubClient}=require('./integrations/github/client');
const {SubmissionService}=require('./integrations/github/submissions');
const {expressionLabels,builtinCharacters,defaults,normalizeAppearance,characterFor,galleryFor,selectedImage}=require('./profiles/appearance');
const {createCharacter,setExpression,addExpression,setSharing,removeCharacter,MAX_CHARACTER_IMAGE_BODY_BYTES}=require('./profiles/uploads');
const {setExpressionSound,removeExpressionSound}=require('./profiles/sounds');
const {USER_IMAGE_PATH,USER_SOUND_PATH,createCharacterMediaAccess}=require('./profiles/media');
const {ArtworkStore}=require('./artworks/store');
const {MusicStore,MAX_BYTES}=require('./music/store');
const {RoomMusic}=require('./music/room');
const {RoomWatchRegistry}=require('./watch/room');
const {getProfileSettings,setProfileSettings,avatarContent,preserveAvatar}=require('./profiles/settings');
const {ROOM_EMOJIS}=require('./social/emojis');
const {acquireDataLocks}=require('./data/locks');
const {version:applicationVersion}=require('../package.json');
function createApp(config){
 const lock=acquireDataLocks(config);
 try{return initializeApp(config,lock);}catch(error){lock.release();throw error;}
}
function initializeApp(config,dataLock){
 const rooms=new Map(),seats=new Map(),kickedUsers=new Map(),socialEvents=new Map(),expressionEvents=new Map(),barrageEvents=new Map(),socialRate=new Map(),reconnectGrace=new Map(),drawStreams=new Map(),departedSeats=new Map(),roomRate=new Map();
 const publishDraw=(code,kind,payload)=>{for(const entry of drawStreams.get(code)||[])try{entry.res.write('event: '+kind+'\ndata: '+JSON.stringify(payload)+'\n\n');}catch{entry.res.end();}};
 const musicRooms=new Map(),musicStreams=new Map();
 const watchRooms=new RoomWatchRegistry();
 const watchContext=room=>{
  const activeSeats=new Set(seats.get(room.code)?.values()||[]);
  return {hostId:room.host,members:room.players.filter(player=>activeSeats.has(player.id)&&!player.bot&&!player.kicked).map(player=>({id:player.id,name:player.name,lastSeen:player.lastSeen}))};
 };
 const reconcileWatch=room=>{const watch=watchRooms.get(room);if(watch)watch.reconcile(watchContext(room));return watch;};
 const roomMusic=room=>{if(!musicRooms.has(room.code))musicRooms.set(room.code,new RoomMusic(Date.now,musicStore));return musicRooms.get(room.code);};
 const publishMusic=code=>{const state=musicRooms.get(code)?.snapshot();for(const entry of musicStreams.get(code)||[])try{entry.res.write('event: music\ndata: '+JSON.stringify(state)+'\n\n');}catch{entry.res.end();}};
 const lobby=createLobby();
 const cleanupRoom=code=>{seats.delete(code);departedSeats.delete(code);kickedUsers.delete(code);socialEvents.delete(code);expressionEvents.delete(code);barrageEvents.delete(code);for(const entry of drawStreams.get(code)||[])entry.res.end();drawStreams.delete(code);for(const entry of musicStreams.get(code)||[])entry.res.end();musicStreams.delete(code);musicRooms.delete(code);watchRooms.delete(code);for(const key of reconnectGrace.keys())if(key.startsWith(code+':'))reconnectGrace.delete(key);};
 const expireRooms=()=>expireEmptyRooms({rooms,history,onDelete:cleanupRoom});
 const withSocial=(room,view)=>{
  const social=socialEvents.get(room.code)||[],now=Date.now(),expressions=(expressionEvents.get(room.code)||[]).filter(event=>now-event.at<5000),barrages=(barrageEvents.get(room.code)||[]).filter(event=>now-event.at<8000),recent=new Map();
  for(const event of expressions)recent.set(event.playerId,event.image);
  const accounts=new Map([...(seats.get(room.code)||[])].map(([userId,playerId])=>[playerId,userId]));
  const viewerId=accounts.get(view.me);
  if(viewerId)characterMedia.rememberExpressions(viewerId,'room:'+room.code,expressions.map(event=>({userId:accounts.get(event.playerId),image:event.image,at:event.at,until:event.at+5000,sound:event.sound,soundUntil:event.at+10000})));
  const watch=reconcileWatch(room);
  return {...view,serverNow:now,...(history.warning(room)?{historyWarning:history.warning(room)}:{}),players:view.players.map(player=>recent.has(player.id)?{...player,avatar:recent.get(player.id)}:player),social,expressions,barrages,watch:watch?watch.summary(watchContext(room)):null};
 };
 const resumeSeat=(room,user)=>reconnectPlayer(room,user.id,seats,reconnectGrace);
 const history=new HistoryStore(config.historyDir,config.historyLimits,{preserveImportedSessions:config.historyPreserveImportedSessions});
 let community,db,auth,board,submissions,giftStore,drawWordStore,achievementStore,artworkStore,musicStore,marketStore;
 try{community=new CommunityStore(config.communityDir);db=openDatabase(config.dbFile);auth=createAuth(db,{secureCookies:config.publicUrl?.startsWith('https://')});marketStore=new MarketStore(db,config.marketClock||Date.now);board=new BoardStore(db,community.data.issues);giftStore=new GiftStore(db);drawWordStore=new DrawWordStore(db);achievementStore=new AchievementStore(db);artworkStore=new ArtworkStore(db);musicStore=new MusicStore(db,config.musicDir||path.join(path.dirname(config.dbFile),'music'));submissions=new SubmissionService(db,board,config.githubClient||createGitHubClient({token:config.githubToken??process.env.GITHUB_TOKEN,baseUrl:config.githubApiBase??process.env.GITHUB_API_BASE}),{enabled:config.externalSideEffectsEnabled!==false});}
 catch(error){history.close();db?.close();throw error;}
 const characterMedia=createCharacterMediaAccess(db,viewerId=>{
  const audiences=[];
  for(const [code,room] of rooms){
   const members=new Map([...(seats.get(code)||[])].filter(([userId,playerId])=>!kickedUsers.get(code)?.has(userId)&&room.players.some(player=>player.id===playerId&&!player.kicked&&!player.bot)));
   if(!members.has(viewerId))continue;
   const accounts=new Map([...members].map(([userId,playerId])=>[playerId,userId]));
   audiences.push({id:'room:'+code,userIds:new Set(members.keys()),expressions:(expressionEvents.get(code)||[]).map(event=>({userId:accounts.get(event.playerId),image:event.image,at:event.at,until:event.at+5000,sound:event.sound,soundUntil:event.at+10000}))});
  }
  const lobbyAudience=lobby.mediaAudience(viewerId);
  if(lobbyAudience)audiences.push(lobbyAudience);
  return audiences;
 });
 const withLobbyMedia=(user,view)=>{const serverNow=Date.now();characterMedia.rememberExpressions(user.id,'lobby',view.visitors.filter(visitor=>visitor.emote).map(visitor=>({userId:visitor.id,...visitor.emote})));return {...view,serverNow};};
 const communityRate=new Map(),accountRate=new Map(),authRate=new Map();
 const trustCloudflare=config.host==='127.0.0.1'&&config.publicUrl?.startsWith('https://');
 const clientKey=req=>clientAddress(req,trustCloudflare);
 const achievementWarnings=new WeakSet();
 const awardRoomAchievements=room=>{
  try{
   if(room.type==='gift')achievementStore.awardGiftRound(room,seats.get(room.code));
   if(room.type==='majority')achievementStore.awardMajorityRound(room,seats.get(room.code));
   if(!room.type)achievementStore.awardPokerHand(room,seats.get(room.code));
   if(room.type==='thunder')achievementStore.awardRaceFinish(room,seats.get(room.code));
  }
  catch(error){if(!achievementWarnings.has(room)){achievementWarnings.add(room);console.error('Achievement update failed:',error);}}
 };
 const robots=fs.readFileSync(path.join(__dirname,'..','public','robots.txt'));
 function limitRate(map,key,max){const now=Date.now(),recent=(map.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=max)throw new HttpError(429,'RATE_LIMITED','操作太頻繁，請稍後再試');recent.push(now);map.set(key,recent);if(map.size>2000)for(const [address,times]of map)if(!times.some(t=>now-t<60000))map.delete(address);}
 function limitCommunity(req){limitRate(communityRate,clientKey(req),40);}
 function limitAccount(user){limitRate(accountRate,user.id,10);}
 const lobbyCharacter=user=>{
  let appearance;
  try{appearance=normalizeAppearance(user.appearance?JSON.parse(user.appearance):defaults);}catch{appearance=defaults;}
  return characterFor(db,user.id,appearance.characterId)||characterFor(db,user.id,defaults.characterId);
 };
 const port=config.port,protocol='http';
 function limitAuth(req){limitRate(authRate,clientKey(req),20);}
const handler=async(req,res)=>{setSecurityHeaders(res,config.publicUrl);try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.searchParams.get('embed')==='1'&&['/gifts','/draw-words','/community'].includes(url.pathname)){
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Content-Security-Policy',"frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
 }
 if(url.pathname==='/robots.txt'&&req.method==='GET'){res.setHeader('Content-Type','text/plain; charset=utf-8');return res.end(robots);}
 if(url.pathname==='/api/version'&&req.method==='GET'){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify({version:applicationVersion}));}
 if(url.pathname.startsWith('/api/')){
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(url.pathname==='/api/music/upload'&&req.method==='POST'){
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw new HttpError(403,'CROSS_ORIGIN','不允許跨站請求');
  const user=auth.requireUser(req);limitAccount(user);
  if(!['audio/mpeg','audio/mp4','audio/ogg','application/octet-stream'].includes(req.headers['content-type']?.split(';')[0]))throw new HttpError(400,'INVALID_AUDIO','需要音樂檔案');
  if(Number(req.headers['content-length'])>MAX_BYTES)throw new HttpError(413,'MUSIC_TOO_LARGE','每首最多 20 MB');
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>MAX_BYTES)throw new HttpError(413,'MUSIC_TOO_LARGE','每首最多 20 MB');chunks.push(chunk);}
  let title;try{title=decodeURIComponent(req.headers['x-music-title']||'');}catch{throw new HttpError(400,'INVALID_TITLE','曲名不正確');}
  return res.end(JSON.stringify(musicStore.add(user,{title,duration:Number(req.headers['x-music-duration'])},Buffer.concat(chunks))));
 }
 let data={};if(req.method==='POST'){
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('不允許跨站請求');
  if(!req.headers['content-type']?.startsWith('application/json'))throw Error('需要 JSON');
  const characterImageUpload=url.pathname==='/api/profile/characters'||/^\/api\/profile\/characters\/[a-f0-9-]{36}\/(?:expressions|emotes)$/.test(url.pathname);
  const limit=characterImageUpload?MAX_CHARACTER_IMAGE_BODY_BYTES:(url.pathname==='/api/artworks'||url.pathname==='/api/draw/result/save'||url.pathname.startsWith('/api/profile/characters/')||url.pathname==='/api/community/gifts'?1400000:8192);
  const chunks=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw new HttpError(413,'REQUEST_TOO_LARGE','請求過大');chunks.push(chunk);}
  data=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
 }
 const send=x=>res.end(JSON.stringify(x));
 if(url.pathname==='/api/auth/login'&&req.method==='POST'){limitAuth(req);return send(await auth.login(data,res));}
 if(url.pathname==='/api/auth/register'&&req.method==='POST'){limitAuth(req);return send(await auth.register(data,res));}
 if(url.pathname==='/api/auth/reset'&&req.method==='POST'){limitAuth(req);await auth.resetPassword(data);return send({ok:true});}
 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){auth.logout(req,res);return send({ok:true});}
 const user=auth.requireUser(req);
 if(url.pathname==='/api/auth/me'&&req.method==='GET'){const me=auth.publicUser(user);if(me.appearance)me.appearance=normalizeAppearance(me.appearance);return send(me);}
 if(url.pathname==='/api/profile/name'&&req.method==='POST'){
  limitAccount(user);const me=auth.rename(user,data);
  // Names are presentation data. Keep seat IDs and recorded/revealed snapshots
  // intact; changing a name must not execute or replay any game action.
  lobby.rename(user.id,me.displayName);
  for(const room of rooms.values()){
   const playerId=seats.get(room.code)?.get(user.id),player=room.players.find(p=>p.id===playerId&&!p.kicked);
   if(player&&player.name!==me.displayName){
    player.name=me.displayName;if(Number.isSafeInteger(room.version))room.version++;room.updated=Date.now();
    const watch=watchRooms.get(room);if(watch)watch.revision++;
   }
  }
  if(me.appearance)me.appearance=normalizeAppearance(me.appearance);
  return send(me);
 }
 if(url.pathname==='/api/market'&&req.method==='GET')return send(marketStore.view(user));
 if(url.pathname==='/api/market/vote'&&req.method==='POST'){limitRate(accountRate,'market:'+user.id,60);return send(marketStore.vote(user,data));}
 if(['/api/market','/api/market/vote'].includes(url.pathname))throw new HttpError(405,'METHOD_NOT_ALLOWED','此操作不支援此方法');
 if(url.pathname==='/api/lobby'&&req.method==='GET')return send(withLobbyMedia(user,lobby.view(user)));
 if(url.pathname==='/api/lobby/move'&&req.method==='POST')return send(withLobbyMedia(user,lobby.move(user,data)));
 if(url.pathname==='/api/lobby/emotes'&&req.method==='GET'){
  const character=lobbyCharacter(user);
  return send({emotes:Object.entries(character.expressions).filter(([key])=>key!=='neutral').map(([expression,image])=>({expression,image,label:character.labels[expression]||expressionLabels[expression]||expression,...(character.sounds?.[expression]?{sound:character.sounds[expression]}:{})}))});
 }
 if(url.pathname==='/api/lobby/emote'&&req.method==='POST'){
  const character=lobbyCharacter(user),expression=data.expression;
  if(typeof expression!=='string'||expression==='neutral'||!Object.hasOwn(character.expressions,expression))throw new HttpError(400,'INVALID_EXPRESSION','這個角色沒有該表情');
  const sound=character.sounds?.[expression];
  return send(withLobbyMedia(user,lobby.emote(user,{image:characterMedia.broadcastImage(character.expressions[expression]),label:character.labels[expression]||expressionLabels[expression]||expression,...(sound?{sound:{...sound,url:characterMedia.broadcastSound(sound.url)}}:{})})));
 }
 if(url.pathname==='/api/music'&&req.method==='GET')return send({tracks:musicStore.list(),me:user.id,admin:user.role==='admin'});
 const musicDelete=url.pathname.match(/^\/api\/music\/([a-f0-9-]{36})\/delete$/);
 if(musicDelete&&req.method==='POST'){limitAccount(user);const result=musicStore.remove(user,musicDelete[1]);for(const [code,state]of musicRooms)if(state.track?.id===musicDelete[1]){state.act('stop',{},musicStore);publishMusic(code);}return send(result);}
 if(url.pathname==='/api/collection/avatars'&&req.method==='GET')return send({artworks:artworkStore.visible(user.id)});
 const avatarSharing=url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})\/sharing$/);
 if(avatarSharing&&req.method==='POST'){limitAccount(user);return send(artworkStore.share(user.id,avatarSharing[1],data.shared));}
 if(url.pathname==='/api/artworks'&&req.method==='GET')return send({artworks:artworkStore.list(user.id)});
 if(url.pathname==='/api/artworks'&&req.method==='POST'){limitAccount(user);return send(artworkStore.add(user.id,data));}
 const artworkDelete=url.pathname.match(/^\/api\/artworks\/([a-f0-9-]{36})\/delete$/);
 if(artworkDelete&&req.method==='POST'){limitAccount(user);return send(artworkStore.remove(user.id,artworkDelete[1]));}
 if(url.pathname==='/api/profile/settings'&&req.method==='GET')return send(getProfileSettings(db,user.id));
 if(url.pathname==='/api/profile/settings'&&req.method==='POST'){
  limitAccount(user);const settings=setProfileSettings(db,user.id,data);
  for(const room of rooms.values()){const playerId=seats.get(room.code)?.get(user.id);const player=room.players.find(p=>p.id===playerId);if(player)player.avatar=`/characters/${user.id}`;}
  return send(settings);
 }
 if(url.pathname==='/api/profile/avatar'&&req.method==='GET'){
  const selection=avatarContent(db,user.id);
  if(selection.content){res.setHeader('Content-Type',selection.content.mime);return res.end(Buffer.from(selection.content.bytes));}
  res.writeHead(302,{Location:selection.url});return res.end();
 }
 if(url.pathname==='/api/profile/options'&&req.method==='GET'){
  return send({defaults,expressionLabels,characters:galleryFor(db,user.id)});
 }
 if(url.pathname==='/api/social/options'&&req.method==='GET')return send({emojis:ROOM_EMOJIS});
 if(url.pathname==='/api/profile/characters'&&req.method==='POST'){limitAccount(user);return send(createCharacter(db,user.id,data));}
 const characterDelete=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/delete$/);
 if(characterDelete&&req.method==='POST'){limitAccount(user);return send(removeCharacter(db,user.id,characterDelete[1]));}
 const sharingUpdate=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/sharing$/);
 if(sharingUpdate&&req.method==='POST'){limitAccount(user);return send(setSharing(db,user.id,sharingUpdate[1],data.shared));}
 const customExpressionUpload=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/emotes$/);
 if(customExpressionUpload&&req.method==='POST'){limitAccount(user);return send(addExpression(db,user.id,customExpressionUpload[1],data));}
 const expressionUpload=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/expressions$/);
 if(expressionUpload&&req.method==='POST'){limitAccount(user);return send(setExpression(db,user.id,expressionUpload[1],data));}
 const expressionSound=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/expressions\/(happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})\/sound(\/remove)?$/);
 if(expressionSound&&req.method==='POST'){
  limitAccount(user);
  if(expressionSound[3])return send(removeExpressionSound(db,user.id,expressionSound[1],expressionSound[2]));
  return send({sound:setExpressionSound(db,user.id,expressionSound[1],expressionSound[2],data)});
 }
 if(url.pathname==='/api/profile/appearance'&&req.method==='POST'){
  const {appearance}=selectedImage(db,user.id,data);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(preserveAvatar(db,user.id,appearance)),user.id);
  for(const room of rooms.values()){const playerId=seats.get(room.code)?.get(user.id);const player=room.players.find(p=>p.id===playerId);if(player)player.avatar=`/characters/${user.id}`;}
  return send({appearance});
 }
 if(url.pathname.startsWith('/api/submissions/')&&req.method==='GET')return send(submissions.visible(url.pathname.split('/')[3],user));
 if(url.pathname.startsWith('/api/admin/')){
  if(user.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以操作');
  if(url.pathname==='/api/admin/market'&&req.method==='GET')return send(marketStore.view(user,true));
  if(url.pathname.startsWith('/api/admin/market')&&req.method==='POST'){
   limitRate(accountRate,'market-admin:'+user.id,60);
   if(url.pathname==='/api/admin/market/rounds')return send(marketStore.create(user,data));
   if(url.pathname==='/api/admin/market/preview')return send(marketStore.preview(user,data));
   if(url.pathname==='/api/admin/market/settle')return send(marketStore.settle(user,data));
  }
  if(['/api/admin/market','/api/admin/market/rounds','/api/admin/market/preview','/api/admin/market/settle'].includes(url.pathname))throw new HttpError(405,'METHOD_NOT_ALLOWED','此操作不支援此方法');
  if(url.pathname==='/api/admin/submissions'&&req.method==='GET')return send(submissions.pending());
  if(url.pathname==='/api/admin/submissions/retry'&&req.method==='POST')return send(await submissions.retry(data.id,user));
  if(url.pathname==='/api/admin/invites'&&req.method==='POST')return send(auth.createInvite(user,data));
  if(url.pathname==='/api/admin/invites/revoke'&&req.method==='POST'){auth.revokeInvite(data.code);return send({ok:true});}
  if(url.pathname==='/api/admin/users'&&req.method==='GET')return send(db.prepare('SELECT id,username,display_name AS displayName,role,disabled,created_at AS createdAt FROM users ORDER BY created_at').all());
  if(url.pathname==='/api/admin/resets'&&req.method==='POST')return send(auth.createReset(user,data.userId,data));
  if(url.pathname==='/api/admin/users/disable'&&req.method==='POST'){auth.disableUser(user,data.userId,!!data.disabled);return send({ok:true});}
  throw new HttpError(404,'NOT_FOUND','找不到請求路徑');
 }
 if(url.pathname.startsWith('/api/community/')){const resource=url.pathname.split('/')[3];if(req.method==='GET'){if(resource==='issues')return send(board.list());if(resource==='questions')return send({topics:require('./games/majority-questions').TOPICS,questions:[...require('./games/majority-questions').QUESTIONS,...community.data.questions]});if(resource==='gifts')return send({categories:CATEGORIES,gifts:[...GIFTS,...giftStore.list()]});}if(req.method==='POST'){limitCommunity(req);limitAccount(user);if(resource==='questions')return send(community.question({...data,name:user.display_name}));if(resource==='gifts')return send(giftStore.add(user,data));if(resource==='issues'){const kind=data.id?data.action==='comment'?'comment':'status':'issue';const result=await submissions.submit(kind,data,user);if(result.state==='needs_review')res.statusCode=202;else if(result.state==='failed')res.statusCode=502;return send(result);}}throw new HttpError(404,'NOT_FOUND','找不到請求路徑');}
 if(url.pathname==='/api/draw/words'&&req.method==='GET')return send({topics:TOPICS,builtin:drawWordStore.builtin(),custom:drawWordStore.list()});
 if(url.pathname==='/api/draw/words'&&req.method==='POST'){limitCommunity(req);limitAccount(user);return send(drawWordStore.add(user,data));}
 if(url.pathname==='/api/achievements'&&req.method==='GET')return send(achievementStore.list(user.id));
 if(url.pathname==='/api/history')return send(history.list());
 if(url.pathname.startsWith('/api/history/'))return send(history.read(url.pathname.split('/')[3]));
 if(url.pathname==='/api/info'){const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>`${protocol}://${x.address}:${port}`);const preferred=config.publicUrl||addresses.find(a=>a.includes('://26.'))||null;return send({preferred,addresses:config.publicUrl?[config.publicUrl,...addresses.filter(a=>a!==config.publicUrl)]:addresses});}
 if(url.pathname==='/api/rooms'&&req.method==='GET'){expireRooms();return send({rooms:listRooms(rooms,seats,kickedUsers,user.id)});}
 if(url.pathname==='/api/create'&&req.method==='POST'){
  limitRate(roomRate,'create:'+user.id,20);limitRate(roomRate,'create-ip:'+clientKey(req),60);
  if(rooms.size>=100)throw Error('房間數已達上限');
  if(!['poker','thunder','majority','gift','draw'].includes(data.type))throw new HttpError(400,'INVALID_GAME','不支援的遊戲');
  const draw=data.type==='draw';
  if(draw&&data.topic!==undefined&&!validTopic(data.topic))throw new HttpError(400,'INVALID_DRAW_TOPIC','題目類別不正確');
  if(draw&&data.topics!==undefined&&!validTopics(data.topics))throw new HttpError(400,'INVALID_DRAW_TOPIC','請至少選擇一個有效的題目類別');
  let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
  const thunder=data.type==='thunder',majority=data.type==='majority',gift=data.type==='gift';
  const room=new (draw?DrawGuessRoom:gift?GiftRoom:majority?MajorityRoom:thunder?ThunderRoom:Room)(code,String(data.roomName||(draw?'你畫我猜好友局':gift?'送禮達人好友局':majority?'同頻俱樂部':thunder?'末路狂飆好友局':'深夜好友局')).slice(0,24));
  if(majority)Object.defineProperty(room,'questionProvider',{value:()=>community.data.questions});
  if(gift)Object.defineProperty(room,'giftProvider',{value:()=>giftStore.list()});
  if(draw){
   if(data.topics!==undefined)room.options.topics=DRAW_CATEGORIES.filter(topic=>data.topics.includes(topic));
   else if(data.topic!==undefined){room.options.topic=data.topic;delete room.options.topics;}
   Object.defineProperty(room,'wordProvider',{value:()=>drawWordStore.list()});
   Object.defineProperty(room,'wordExclusionProvider',{value:word=>drawWordStore.isExcluded(word)});
   Object.defineProperty(room,'wordBanWriter',{value:(word,audit)=>drawWordStore.ban(word,audit)});
  }
  history.attach(room);
  let p;try{p=history.transact(room,{action:'create',source:'player',name:user.display_name},()=>{const player=room.add(user.display_name);player.name=user.display_name;return player;});}catch(error){endRoomHistory(history,room,'建立房間未完成');throw error;}
  p.avatar=`/characters/${user.id}`;rooms.set(code,room);seats.set(code,new Map([[user.id,p.id]]));return send({code,type:room.type||'poker'});
 }
 if(!['/api/room-watch','/api/room-music','/api/room-music/events','/api/leave','/api/join','/api/reconnect','/api/state','/api/action','/api/kick','/api/settings','/api/start','/api/bot','/api/rebuy','/api/social','/api/draw/canvas','/api/draw/events','/api/draw/stroke','/api/draw/command','/api/draw/result','/api/draw/result/save','/api/draw/result/ban'].includes(url.pathname))throw new HttpError(404,'NOT_FOUND','找不到請求路徑');
 expireRooms();
 const room=rooms.get(String(data.code||url.searchParams.get('code')||'').toUpperCase());if(!room)throw new HttpError(404,'ROOM_NOT_FOUND','找不到房間，請確認房間代碼');
 if(kickedUsers.get(room.code)?.has(user.id))throw new HttpError(403,'KICKED','你已被房主踢出房間');
 // Revoke an expired controller before this request refreshes their seat lease.
 reconcileWatch(room);
 if(url.pathname==='/api/reconnect'&&req.method==='POST'){resumeSeat(room,user);return send({code:room.code,type:room.type||'poker',reconnected:true});}
 if(url.pathname==='/api/join'&&req.method==='POST'){
  const previous=seats.get(room.code)?.get(user.id);if(previous){resumeSeat(room,user);return send({code:room.code,type:room.type||'poker'});}
  limitRate(roomRate,'join:'+user.id,30);limitRate(roomRate,'join-ip:'+clientKey(req),120);
  if((kickedUsers.get(room.code)?.size||0)>=256)throw new HttpError(429,'ROOM_RECORD_LIMIT','這間房的離席紀錄已達上限，請建立新房間');
  const departed=departedSeats.get(room.code);if(departed)for(const [account,id]of departed)if(!room.players.some(p=>p.id===id))departed.delete(account);
  const p=history.transact(room,{action:'join',source:'player',name:user.display_name},()=>{const player=rejoinPlayer(room,departed?.get(user.id),user.display_name)||room.add(user.display_name);player.name=user.display_name;return player;});
  departed?.delete(user.id);p.avatar=`/characters/${user.id}`;seats.get(room.code).set(user.id,p.id);return send({code:room.code,type:room.type||'poker'});
 }
 const p=resumeSeat(room,user);
 if(url.pathname==='/api/leave'&&req.method==='POST'){
  limitRate(roomRate,'leave:'+user.id,30);limitRate(roomRate,'leave-ip:'+clientKey(req),120);
  let result,applied=false,historyPersisted=true;
  try{history.transact(room,{action:'leave',source:'player',actor:p.id},()=>{result=leavePlayer(room,p.id);applied=true;return result;});}
  catch(error){
   if(error.code!=='HISTORY_QUOTA'&&!history.isPaused(room))throw error;
   // Leaving is always possible even when the recorder cannot accept writes.
   // Do not run a partially applied leave twice or report an unrecorded match
   // as safely persisted. Remaining players can exit this paused room too.
   historyPersisted=false;history.markUnrecorded(room);if(!applied)result=leavePlayer(room,p.id);
  }
  seats.get(room.code)?.delete(user.id);
  reconcileWatch(room);
  if(room.players.some(q=>q.id===p.id&&q.kicked)){
   if(!departedSeats.has(room.code))departedSeats.set(room.code,new Map());
   const departed=departedSeats.get(room.code);for(const [account,id]of departed)if(!room.players.some(q=>q.id===id))departed.delete(account);
   departed.set(user.id,p.id);
  }
  for(const entry of drawStreams.get(room.code)||[])if(entry.userId===user.id)entry.res.end();
  for(const entry of musicStreams.get(room.code)||[])if(entry.userId===user.id)entry.res.end();
  const historyWarning=history.warning(room);
  if(result.deleted){historyPersisted=endRoomHistory(history,room,'最後一位玩家已離開房間')&&historyPersisted;rooms.delete(room.code);cleanupRoom(room.code);}
  return send({code:room.code,left:true,deleted:result.deleted,...(!historyPersisted?{historyPersisted:false,historyWarning:historyWarning||{code:'HISTORY_WRITE_FAILED',message:'已離開房間，但對局記錄未完整保存'}}:{})});
 }
 if(url.pathname==='/api/room-watch'){
  if(req.method!=='GET'&&req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','不支援的請求');
  const watch=watchRooms.get(room,{create:true}),context=watchContext(room);
  watch.reconcile(context);
  if(req.method==='GET'){limitRate(roomRate,'watch-read:'+user.id,120);return send(watch.snapshot(p.id,context));}
  limitRate(roomRate,'watch-command:'+user.id,60);
  try{return send(watch.act(p.id,data,context));}
  catch(error){if(error.watchState){res.statusCode=error.status;return send({code:error.code,error:error.message,state:error.watchState});}throw error;}
 }
 if(url.pathname==='/api/room-music'){
  if(req.method==='GET')return send(roomMusic(room).snapshot());
  if(req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','不支援的請求');
  if(data.action!=='select'&&p.id!==room.host)throw new HttpError(403,'HOST_ONLY','只有房主可以控制全桌音樂');
  limitRate(socialRate,'music:'+user.id,60);const result=roomMusic(room).act(data.action,data,musicStore);publishMusic(room.code);return send(result);
 }
 if(url.pathname==='/api/room-music/events'&&req.method==='GET'){
  const subscribers=musicStreams.get(room.code)||new Set();if(subscribers.size>=32||[...subscribers].filter(e=>e.userId===user.id).length>=3)throw new HttpError(429,'STREAM_LIMIT','音樂連線太多，請關閉舊分頁');
  const entry={res,userId:user.id};subscribers.add(entry);musicStreams.set(room.code,subscribers);
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
  const sendState=()=>{if(!auth.sessionFrom(req)||kickedUsers.get(room.code)?.has(user.id))return res.end();res.write('event: music\ndata: '+JSON.stringify(roomMusic(room).snapshot())+'\n\n');};sendState();
  const timer=setInterval(sendState,10000);timer.unref();req.on('close',()=>{clearInterval(timer);subscribers.delete(entry);if(!subscribers.size)musicStreams.delete(room.code);});return;
 }
 if(url.pathname.startsWith('/api/draw/')){
  if(room.type!=='draw')throw new HttpError(400,'WRONG_GAME','這不是你畫我猜房間');
  if(url.pathname==='/api/draw/canvas'&&req.method==='GET')return send(room.canvasSnapshot());
  if(url.pathname==='/api/draw/result'&&req.method==='GET')return send(room.resultSnapshot(url.searchParams.get('resultId')));
  if(url.pathname==='/api/draw/events'&&req.method==='GET'){
   const entry={res,userId:user.id},subscribers=drawStreams.get(room.code)||new Set();
   if(subscribers.size>=32||[...subscribers].filter(item=>item.userId===user.id).length>=3)throw new HttpError(429,'DRAW_STREAM_LIMIT','畫布連線太多，請先關閉舊分頁');
   res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('X-Accel-Buffering','no');res.setHeader('Connection','keep-alive');res.flushHeaders();
   subscribers.add(entry);drawStreams.set(room.code,subscribers);
   res.write('event: ready\ndata: '+JSON.stringify({canvasEpoch:room.canvas.epoch,round:room.round,version:room.canvas.version})+'\n\n');
   const keepAlive=setInterval(()=>res.write(': keepalive\n\n'),25000);keepAlive.unref();
   req.on('close',()=>{clearInterval(keepAlive);subscribers.delete(entry);if(!subscribers.size)drawStreams.delete(room.code);});return;
  }
  if(req.method!=='POST')throw new HttpError(405,'METHOD_NOT_ALLOWED','不支援的請求');
  if(url.pathname==='/api/draw/result/ban'){
   limitRate(roomRate,'mutation:'+user.id,120);
   history.transact(room,{action:'draw-word-ban',source:'player',actor:p.id,input:{resultId:data.resultId}},()=>room.voteWordBan(p.id,data.resultId));
   return send(withSocial(room,room.view(p.id)));
  }
  if(url.pathname==='/api/draw/result/save'){
   limitAccount(user);
   const result=room.resultMetadata(data.resultId),savedId=room.savedResultArtwork(result.resultId,user.id),saved=savedId&&artworkStore.owned(user.id,savedId);
   const context={resultId:result.resultId,gameRunId:result.gameRunId,canvasEpoch:result.canvasEpoch};
   if(saved)return send({...context,artwork:saved,duplicate:true});
   if(savedId&&data.recollect!==true)throw new HttpError(409,'DRAW_SAVED_ARTWORK_DELETED','你已刪除這輪收藏的作品，請確認是否重新收藏');
   // The client renders this PNG. The server binds its label and idempotency
   // to the revealed result; it does not claim to reproduce or verify pixels.
   const name=[...`你畫我猜：${result.answer||'未選題'} — ${result.artist.name}`].slice(0,40).join('');
   const artwork=artworkStore.add(user.id,{name,mime:'image/png',base64:data.base64});
   room.rememberResultArtwork(result.resultId,user.id,artwork.id);
   return send({...context,artwork,duplicate:false});
  }
  if(url.pathname==='/api/draw/result')throw new HttpError(405,'METHOD_NOT_ALLOWED','不支援的請求');
  if(url.pathname==='/api/draw/stroke'){const result=room.addStroke(p.id,data);if(!result.duplicate)publishDraw(room.code,'stroke',result);return send(result);}
  if(url.pathname==='/api/draw/command'){const result=room.canvasCommand(p.id,data);publishDraw(room.code,'reset',result);return send(result);}
 }
 if(url.pathname==='/api/state'){awardRoomAchievements(room);return send(withSocial(room,room.view(p.id)));}
 if(req.method!=='POST')throw Error('不支援的請求');
 if(url.pathname==='/api/social'){
  const now=Date.now(),rateKey=user.id+':'+String(data.kind),last=socialRate.get(rateKey)||0;
  if(now-last<1500)throw new HttpError(429,'SOCIAL_RATE_LIMIT','請稍後再傳送');
  let event;
  if(data.kind==='message'){
   const message=String(data.message||'').trim();
   if(!message||message.length>160)throw new HttpError(400,'INVALID_MESSAGE','留言需為 1–160 字');
   event={id:randomBytes(8).toString('hex'),kind:'message',name:user.display_name,message,at:now};
  }else if(data.kind==='barrage'){
   const message=typeof data.message==='string'?data.message.trim():'';
   if(!message||[...message].length>40||/[\u0000-\u001f\u007f]/.test(message))throw new HttpError(400,'INVALID_BARRAGE','文字彈幕需為 1–40 字，且不能換行');
   event={id:randomBytes(8).toString('hex'),kind:'barrage',playerId:p.id,name:user.display_name,message,at:now};
  }else if(data.kind==='emoji'){
   if(typeof data.emoji!=='string'||!ROOM_EMOJIS.includes(data.emoji))throw new HttpError(400,'INVALID_EMOJI','請選擇選單中的 emoji');
   event={id:randomBytes(8).toString('hex'),kind:'emoji',playerId:p.id,name:user.display_name,emoji:data.emoji,at:now};
  }else if(data.kind==='expression'){
   const saved=user.appearance?JSON.parse(user.appearance):defaults;
   const selected=selectedImage(db,user.id,{...normalizeAppearance(saved),expression:data.expression});
   if(selected.appearance.expression!==data.expression)throw new HttpError(400,'INVALID_EXPRESSION','這個角色沒有此表情');
   event={id:randomBytes(8).toString('hex'),kind:'expression',playerId:p.id,name:user.display_name,expression:data.expression,label:selected.label,image:characterMedia.broadcastImage(selected.url),at:now,...(selected.sound?{sound:{...selected.sound,url:characterMedia.broadcastSound(selected.sound.url)}}:{})};
  }else throw new HttpError(400,'INVALID_SOCIAL_KIND','不支援的互動');
  socialRate.set(rateKey,now);
  const events=data.kind==='message'?socialEvents:data.kind==='expression'?expressionEvents:barrageEvents;
  const roomEvents=events.get(room.code)||[];roomEvents.push(event);if(roomEvents.length>50)roomEvents.shift();events.set(room.code,roomEvents);
  return send(withSocial(room,room.view(p.id)));
 }
 if(url.pathname==='/api/start'&&room.host!==p.id)throw new HttpError(403,'HOST_ONLY','只有房主可以開始');
 limitRate(roomRate,'mutation:'+user.id,120);
 history.transact(room,{action:url.pathname.slice(5),source:'player',actor:p.id,input:data},()=>{
 if(url.pathname==='/api/action'){if(room.type==='thunder'||!room.type)room.humanAct(p.id,data.action,room.type==='thunder'?data:data.amount);else room.act(p.id,data.action,data);}
 else if(url.pathname==='/api/kick'){if(data.confirmed!==true)throw new HttpError(400,'CONFIRM_REQUIRED','請先確認踢出玩家');const target=room.players.find(q=>q.id===data.playerId);if(!target)throw new HttpError(404,'PLAYER_NOT_FOUND','找不到玩家');room.kick(p.id,target.id);const account=[...seats.get(room.code)].find(([,id])=>id===target.id)?.[0];if(account){seats.get(room.code).delete(account);if(!kickedUsers.has(room.code))kickedUsers.set(room.code,new Set());kickedUsers.get(room.code).add(account);for(const entry of drawStreams.get(room.code)||[])if(entry.userId===account)entry.res.end();for(const entry of musicStreams.get(room.code)||[])if(entry.userId===account)entry.res.end();}}
 else if(url.pathname==='/api/settings'){if(!['thunder','majority','gift','draw'].includes(room.type))throw Error('此遊戲沒有此設定');room.configure(p.id,data);}
 else if(url.pathname==='/api/start'){if(room.host!==p.id)throw Error('只有房主可以發牌');room.start();}
 else if(url.pathname==='/api/bot'){if(room.host!==p.id)throw Error('只有房主可以加入電腦');room.add(['River','Clover','Atlas','Nova','Juno'][room.players.filter(p=>p.bot).length%5],true);}
 else if(url.pathname==='/api/rebuy'){if(['thunder','majority','gift','draw'].includes(room.type)||!['waiting','showdown'].includes(room.phase)||p.stack>0)throw Error('籌碼用完且本局結束後才能補充');p.stack=2000;}
 else throw Error('未知請求');
 });awardRoomAchievements(room);return send(withSocial(room,room.view(p.id)));
 }
 if(url.pathname==='/lobby.js'||url.pathname==='/lobby.css'){
  const file=url.pathname.slice(1);
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');
  return res.end(fs.readFileSync(path.join(__dirname,'..','public',file)));
 }
 const musicAsset=url.pathname.match(/^\/assets\/music\/([a-f0-9-]{36})$/);
 if(musicAsset){auth.requireUser(req);if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'METHOD_NOT_ALLOWED','不支援的請求');return musicStore.stream(req,res,musicAsset[1]);}
 const artworkAsset=url.pathname.match(/^\/assets\/artworks\/([a-f0-9-]{36})$/);
 if(artworkAsset){const viewer=auth.requireUser(req),image=artworkStore.image(viewer.id,artworkAsset[1]);if(!image)throw new HttpError(404,'ARTWORK_NOT_FOUND','找不到你的作品');res.setHeader('Content-Type',image.mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(image.bytes);}
 const sharedGift=url.pathname.match(/^\/assets\/gifts\/shared\/([a-f0-9-]{36})$/);
 if(sharedGift){auth.requireUser(req);const image=giftStore.image(sharedGift[1]);if(!image?.bytes)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到禮物圖片');res.setHeader('Content-Type',image.mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(image.bytes);}
 if(GIFTS.some(gift=>gift.image===url.pathname)){auth.requireUser(req);res.setHeader('Content-Type','image/png');res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(fs.readFileSync(path.join(__dirname,'..','public',url.pathname)));}
 if(USER_SOUND_PATH.test(url.pathname)){const viewer=auth.requireUser(req),row=characterMedia.sound(viewer.id,url.href);if(!row)throw new HttpError(404,'SOUND_NOT_FOUND','找不到表情音效');res.setHeader('Content-Type',row.mime);res.setHeader('Content-Length',row.bytes.length);res.setHeader('Content-Security-Policy',"default-src 'none'");if(req.method==='HEAD')return res.end();return res.end(row.bytes);}
 const media=url.pathname.match(USER_IMAGE_PATH);
 if(media){const viewer=auth.requireUser(req),row=characterMedia.image(viewer.id,url.href);if(!row)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到角色圖片');res.setHeader('Content-Type',row.mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(row.bytes);}
 if(url.pathname.startsWith('/assets/characters/')){auth.requireUser(req);const asset=builtinCharacters.flatMap(character=>Object.values(character.expressions)).find(value=>value===url.pathname);if(!asset)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到角色圖片');res.setHeader('Content-Type',asset.endsWith('.gif')?'image/gif':'image/png');res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(fs.readFileSync(path.join(__dirname,'..','public',asset)));}
 const characterId=url.pathname.match(/^\/characters\/([a-f0-9-]{36})(?:\.svg)?$/)?.[1];if(characterId){const viewer=auth.requireUser(req),selected=characterMedia.avatar(characterId);if(!selected)throw new HttpError(404,'CHARACTER_NOT_FOUND','找不到角色外觀');let bytes,mime;if(USER_IMAGE_PATH.test(selected.url)){const row=characterMedia.image(viewer.id,selected.url);if(!row)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到角色圖片');bytes=row.bytes;mime=row.mime;}else{bytes=fs.readFileSync(path.join(__dirname,'..','public',selected.url));mime=selected.url.endsWith('.gif')?'image/gif':'image/png';}res.setHeader('Content-Type',mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(bytes);}
 const files={'/market':'market.html','/market.js':'market.js','/market.css':'market.css','/market-rules.js':'market-rules.js','/shared/race-movement.js':'shared/race-movement.js','/shared/race-paths.js':'shared/race-paths.js','/shared/table-watch.js':'shared/table-watch.js','/shared/table-watch.css':'shared/table-watch.css','/shared/draw-results.js':'shared/draw-results.js','/shared/motion-policy.js':'shared/motion-policy.js','/shared/audio-settings.js':'shared/audio-settings.js','/shared/expression-sounds.js':'shared/expression-sounds.js','/shared/game-sounds.js':'shared/game-sounds.js','/shared/race-game-sounds.js':'shared/race-game-sounds.js','/assets/game-sounds/turn.wav':'assets/game-sounds/turn.wav','/assets/game-sounds/correct.wav':'assets/game-sounds/correct.wav','/assets/game-sounds/dice-roll.wav':'assets/game-sounds/dice-roll.wav','/assets/game-sounds/shot.wav':'assets/game-sounds/shot.wav','/assets/game-sounds/slam.wav':'assets/game-sounds/slam.wav','/assets/game-sounds/nitro.wav':'assets/game-sounds/nitro.wav','/assets/game-sounds/skid.wav':'assets/game-sounds/skid.wav','/shared/popovers.js':'shared/popovers.js','/shared/ui-foundation.css':'shared/ui-foundation.css','/shared/ui-primitives.css':'shared/ui-primitives.css','/shared/ui-components.js':'shared/ui-components.js','/collection':'collection.html','/collection.js':'collection.js','/collection.css':'collection.css','/settings':'settings.html','/settings.js':'settings.js','/settings.css':'settings.css','/shared/site-header.js':'shared/site-header.js','/shared/site-header.css':'shared/site-header.css','/music':'music.html','/music.js':'music.js','/shared/table-music.js':'shared/table-music.js','/shared/table-music.css':'shared/table-music.css','/profile':'profile.html','/profile.js':'profile.js','/studio':'studio.html','/studio.js':'studio.js','/studio-editor.js':'studio-editor.js','/admin':'admin.html','/admin.js':'admin.js','/login':'login.html','/login.js':'login.js','/majority-social.js':'majority-social.js','/community':'community.html','/community.js':'community.js','/community.css':'community.css','/majority':'majority.html','/majority.js':'majority.js','/majority.css':'majority.css','/gift':'gift.html','/gift.js':'gift.js','/gift.css':'gift.css','/draw':'draw.html','/draw.js':'draw.js','/draw.css':'draw.css','/draw-words':'draw-words.html','/draw-words.js':'draw-words.js','/shared/stroke-canvas.js':'shared/stroke-canvas.js','/gifts':'gifts.html','/gifts.js':'gifts.js','/gifts.css':'gifts.css','/':'index.html','/poker':'poker.html','/race':'race.html','/rules':'rules.html','/history':'history.html','/history.js':'history.js','/history.css':'history.css','/achievements':'achievements.html','/achievements.js':'achievements.js','/achievements.css':'achievements.css','/app.js':'app.js','/style.css':'style.css','/hub.js':'hub.js','/club.css':'club.css','/rooms.css':'rooms.css','/club-pages.css':'club-pages.css','/race.js':'race.js','/race.css':'race.css','/assets/thunder-components.png':'assets/thunder-components.png','/assets/thunder-box.png':'assets/thunder-box.png','/assets/gift-sounds/open_001.wav':'assets/gift-sounds/open_001.wav','/assets/gift-sounds/confirmation_001.wav':'assets/gift-sounds/confirmation_001.wav','/room-reconnect.js':'shared/room-reconnect.js','/shared/room-reconnect.js':'shared/room-reconnect.js','/room-host.js':'shared/room-host.js','/shared/room-host.js':'shared/room-host.js','/room-host.css':'shared/room-host.css','/shared/room-host.css':'shared/room-host.css','/game-shell.js':'shared/game-shell.js','/shared/game-shell.js':'shared/game-shell.js','/game-shell.css':'shared/game-shell.css','/shared/game-shell.css':'shared/game-shell.css','/shared/immersion.js':'shared/immersion.js','/shared/race-event-cues.js':'shared/race-event-cues.js','/shared/race-vehicle-effects.js':'shared/race-vehicle-effects.js','/shared/race-dice-dialog.js':'shared/race-dice-dialog.js','/shared/race-terrain-help.js':'shared/race-terrain-help.js','/shared/api.js':'shared/api.js'};const roomPath=url.pathname.match(/^\/(race|poker|majority|gift|draw)\/[A-Fa-f0-9]{6}\/?$/);const file=roomPath?roomPath[1]+'.html':files[url.pathname];if(!file){res.writeHead(404);return res.end();}if(file.endsWith('.html')&&file!=='login.html'){const visitor=auth.sessionFrom(req);if(!visitor){res.writeHead(302,{Location:roomPath||file==='market.html'?'/login?next='+encodeURIComponent(url.pathname):'/login'});return res.end();}if(file==='admin.html'&&visitor.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以操作');}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.wav')?'audio/wav':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'..','public',file)));
 }catch(e){writeError(res,e);}};

 const server=http.createServer(handler);
 server.headersTimeout=10000;
 server.requestTimeout=30000;
 server.keepAliveTimeout=5000;
 let stopScheduler,closed=false;
 async function listen(){
  if(closed)throw Error('Application has been closed');
  if(server.listening)return server.address();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,config.host,()=>{server.off('error',reject);resolve();});});
  stopScheduler=startRoomScheduler({rooms,history,onDelete:cleanupRoom});
  submissions.recover();
  return server.address();
 }
 async function close(){
  if(closed)return;
  closed=true;
  stopScheduler?.();
  watchRooms.clear();
  for(const entries of musicStreams.values())for(const entry of entries)entry.res.end();
  for(const entries of drawStreams.values())for(const entry of entries)entry.res.end();
  if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  history.close();
  await Promise.allSettled([...submissions.inFlight.values()]);
  try{db.close();}finally{dataLock.release();}
 }
 return {server,listen,close};
}
module.exports={createApp};
