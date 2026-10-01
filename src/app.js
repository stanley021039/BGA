const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomBytes}=require('node:crypto');
const {Room}=require('./games/poker'),{ThunderRoom}=require('./games/thunder'),{MajorityRoom}=require('./games/majority'),{GiftRoom}=require('./games/gift');
const {GiftStore}=require('./games/gift-store'),{GIFTS,CATEGORIES}=require('./games/gift-catalog');
const {HistoryStore}=require('./history/store'),{CommunityStore}=require('./community/store');
const {startRoomScheduler}=require('./rooms/scheduler');
const {reconnectPlayer}=require('./rooms/reconnect');
const {listRooms}=require('./rooms/listing');
const {HttpError,writeError}=require('./http/errors');
const {openDatabase}=require('./db/index');
const {createAuth}=require('./auth/index');
const {BoardStore}=require('./community/board');
const {createGitHubClient}=require('./integrations/github/client');
const {SubmissionService}=require('./integrations/github/submissions');
const {expressionLabels,builtinCharacters,defaults,normalizeAppearance,characterFor,selectedImage}=require('./profiles/appearance');
const {createCharacter,setExpression,addExpression}=require('./profiles/uploads');
function createApp(config){
 const rooms=new Map(),seats=new Map(),kickedUsers=new Map(),socialEvents=new Map(),expressionEvents=new Map(),barrageEvents=new Map(),socialRate=new Map(),reconnectGrace=new Map();
 const withSocial=(room,view)=>{
  const social=socialEvents.get(room.code)||[],now=Date.now(),expressions=(expressionEvents.get(room.code)||[]).filter(event=>now-event.at<5000),barrages=(barrageEvents.get(room.code)||[]).filter(event=>now-event.at<8000),recent=new Map();
  for(const event of expressions)recent.set(event.playerId,event.image);
  return {...view,players:view.players.map(player=>recent.has(player.id)?{...player,avatar:recent.get(player.id)}:player),social,expressions,barrages};
 };
 const resumeSeat=(room,user)=>reconnectPlayer(room,user.id,seats,reconnectGrace);
 const history=new HistoryStore(config.historyDir);
 let community,db,auth,board,submissions,giftStore;
 try{community=new CommunityStore(config.communityDir);db=openDatabase(config.dbFile);auth=createAuth(db,{secureCookies:config.publicUrl?.startsWith('https://')});board=new BoardStore(db,community.data.issues);giftStore=new GiftStore(db);submissions=new SubmissionService(db,board,config.githubClient||createGitHubClient({token:config.githubToken??process.env.GITHUB_TOKEN,baseUrl:config.githubApiBase??process.env.GITHUB_API_BASE}));}
 catch(error){history.close();db?.close();throw error;}
 const communityRate=new Map();
 function limitCommunity(req){const key=req.socket.remoteAddress,now=Date.now(),recent=(communityRate.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=40)throw Error('操作太頻繁，請稍後再試');recent.push(now);communityRate.set(key,recent);if(communityRate.size>2000)for(const [k,v]of communityRate)if(now-v.at(-1)>60000)communityRate.delete(k);}
 const accountRate=new Map();
 function limitAccount(user){const key=user.id,now=Date.now(),recent=(accountRate.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=10)throw new HttpError(429,'RATE_LIMITED','請稍後再試');recent.push(now);accountRate.set(key,recent);}
 const port=config.port,protocol='http';
 const authRate=new Map();
 function limitAuth(req){const key=req.socket.remoteAddress,now=Date.now(),recent=(authRate.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=20)throw new HttpError(429,'RATE_LIMITED','請稍後再試');recent.push(now);authRate.set(key,recent);}
const handler=async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
 res.setHeader('Content-Type','application/json; charset=utf-8');let data={};if(req.method==='POST'){if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('不允許跨站請求');if(!req.headers['content-type']?.startsWith('application/json'))throw Error('需要 JSON');const limit=url.pathname==='/api/profile/characters'||url.pathname.startsWith('/api/profile/characters/')||url.pathname==='/api/community/gifts'?1400000:8192;const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw new HttpError(413,'REQUEST_TOO_LARGE','請求過大');chunks.push(chunk);}data=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
 const send=x=>res.end(JSON.stringify(x));
 if(url.pathname==='/api/auth/login'&&req.method==='POST'){limitAuth(req);return send(await auth.login(data,res));}
 if(url.pathname==='/api/auth/register'&&req.method==='POST'){limitAuth(req);return send(await auth.register(data,res));}
 if(url.pathname==='/api/auth/reset'&&req.method==='POST'){limitAuth(req);await auth.resetPassword(data);return send({ok:true});}
 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){auth.logout(req,res);return send({ok:true});}
 const user=auth.requireUser(req);
 if(url.pathname==='/api/auth/me'&&req.method==='GET'){const me=auth.publicUser(user);if(me.appearance)me.appearance=normalizeAppearance(me.appearance);return send(me);}
 if(url.pathname==='/api/profile/options'&&req.method==='GET'){
  const owned=db.prepare('SELECT id FROM player_characters WHERE owner_id=? ORDER BY created_at DESC').all(user.id).map(row=>characterFor(db,user.id,'user:'+row.id));
  return send({defaults,expressionLabels,characters:[...builtinCharacters,...owned]});
 }
 if(url.pathname==='/api/profile/characters'&&req.method==='POST'){limitAccount(user);return send(createCharacter(db,user.id,data));}
 const customExpressionUpload=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/emotes$/);
 if(customExpressionUpload&&req.method==='POST'){limitAccount(user);return send(addExpression(db,user.id,customExpressionUpload[1],data));}
 const expressionUpload=url.pathname.match(/^\/api\/profile\/characters\/([a-f0-9-]{36})\/expressions$/);
 if(expressionUpload&&req.method==='POST'){limitAccount(user);return send(setExpression(db,user.id,expressionUpload[1],data));}
 if(url.pathname==='/api/profile/appearance'&&req.method==='POST'){
  const {appearance}=selectedImage(db,user.id,data);
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(appearance),user.id);
  for(const room of rooms.values()){const playerId=seats.get(room.code)?.get(user.id);const player=room.players.find(p=>p.id===playerId);if(player)player.avatar=`/characters/${user.id}`;}
  return send({appearance});
 }
 if(url.pathname.startsWith('/api/submissions/')&&req.method==='GET')return send(submissions.visible(url.pathname.split('/')[3],user));
 if(url.pathname.startsWith('/api/admin/')){
  if(user.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以操作');
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
 if(url.pathname==='/api/history')return send(history.list());
 if(url.pathname.startsWith('/api/history/'))return send(history.read(url.pathname.split('/')[3]));
 if(url.pathname==='/api/info'){const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>`${protocol}://${x.address}:${port}`);const preferred=config.publicUrl||addresses.find(a=>a.includes('://26.'))||null;return send({preferred,addresses:config.publicUrl?[config.publicUrl,...addresses.filter(a=>a!==config.publicUrl)]:addresses});}
 if(url.pathname==='/api/rooms'&&req.method==='GET')return send({rooms:listRooms(rooms,seats,kickedUsers,user.id)});
 if(url.pathname==='/api/create'&&req.method==='POST'){if(rooms.size>=100)throw Error('房間數已達上限');let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const thunder=data.type==='thunder',majority=data.type==='majority',gift=data.type==='gift';const room=new (gift?GiftRoom:majority?MajorityRoom:thunder?ThunderRoom:Room)(code,String(data.roomName||(gift?'送禮達人好友局':majority?'同頻俱樂部':thunder?'末路狂飆好友局':'深夜好友局')).slice(0,24));if(majority)Object.defineProperty(room,'questionProvider',{value:()=>community.data.questions});if(gift)Object.defineProperty(room,'giftProvider',{value:()=>giftStore.list()});history.attach(room);const p=history.transact(room,{action:'create',source:'player',name:user.display_name},()=>room.add(user.display_name));p.avatar=`/characters/${user.id}`;rooms.set(code,room);seats.set(code,new Map([[user.id,p.id]]));return send({code,type:room.type||'poker'});}
 if(!['/api/join','/api/reconnect','/api/state','/api/action','/api/kick','/api/settings','/api/start','/api/bot','/api/rebuy','/api/social'].includes(url.pathname))throw new HttpError(404,'NOT_FOUND','找不到請求路徑');
 const room=rooms.get(String(data.code||url.searchParams.get('code')||'').toUpperCase());if(!room)throw new HttpError(404,'ROOM_NOT_FOUND','找不到房間，請確認房間代碼');
 if(kickedUsers.get(room.code)?.has(user.id))throw new HttpError(403,'KICKED','你已被房主踢出房間');
 if(url.pathname==='/api/reconnect'&&req.method==='POST'){resumeSeat(room,user);return send({code:room.code,type:room.type||'poker',reconnected:true});}
 if(url.pathname==='/api/join'&&req.method==='POST'){const previous=seats.get(room.code)?.get(user.id);if(previous){resumeSeat(room,user);return send({code:room.code,type:room.type||'poker'});}const p=history.transact(room,{action:'join',source:'player',name:user.display_name},()=>room.add(user.display_name));p.avatar=`/characters/${user.id}`;seats.get(room.code).set(user.id,p.id);return send({code:room.code,type:room.type||'poker'});}
 const p=resumeSeat(room,user);
 if(url.pathname==='/api/state')return send(withSocial(room,room.view(p.id)));
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
  }else if(data.kind==='expression'){
   const saved=user.appearance?JSON.parse(user.appearance):defaults;
   const selected=selectedImage(db,user.id,{...normalizeAppearance(saved),expression:data.expression});
   if(selected.appearance.expression!==data.expression)throw new HttpError(400,'INVALID_EXPRESSION','這個角色沒有此表情');
   event={id:randomBytes(8).toString('hex'),kind:'expression',playerId:p.id,name:user.display_name,expression:data.expression,label:selected.label,image:selected.url,at:now};
  }else throw new HttpError(400,'INVALID_SOCIAL_KIND','不支援的互動');
  socialRate.set(rateKey,now);
  const events=data.kind==='message'?socialEvents:data.kind==='expression'?expressionEvents:barrageEvents;
  const roomEvents=events.get(room.code)||[];roomEvents.push(event);if(roomEvents.length>50)roomEvents.shift();events.set(room.code,roomEvents);
  return send(withSocial(room,room.view(p.id)));
 }
 if(url.pathname==='/api/start'&&room.host!==p.id)throw new HttpError(403,'HOST_ONLY','只有房主可以開始');
 history.transact(room,{action:url.pathname.slice(5),source:'player',actor:p.id,input:data},()=>{
 if(url.pathname==='/api/action')room.act(p.id,data.action,['thunder','majority','gift'].includes(room.type)?data:data.amount);
 else if(url.pathname==='/api/kick'){if(data.confirmed!==true)throw new HttpError(400,'CONFIRM_REQUIRED','請先確認踢出玩家');const target=room.players.find(q=>q.id===data.playerId);if(!target)throw new HttpError(404,'PLAYER_NOT_FOUND','找不到玩家');room.kick(p.id,target.id);const account=[...seats.get(room.code)].find(([,id])=>id===target.id)?.[0];if(account){seats.get(room.code).delete(account);if(!kickedUsers.has(room.code))kickedUsers.set(room.code,new Set());kickedUsers.get(room.code).add(account);}}
 else if(url.pathname==='/api/settings'){if(!['thunder','majority','gift'].includes(room.type))throw Error('此遊戲沒有此設定');room.configure(p.id,data);}
 else if(url.pathname==='/api/start'){if(room.host!==p.id)throw Error('只有房主可以發牌');room.start();}
 else if(url.pathname==='/api/bot'){if(room.host!==p.id)throw Error('只有房主可以加入電腦');room.add(['River','Clover','Atlas','Nova','Juno'][room.players.filter(p=>p.bot).length%5],true);}
 else if(url.pathname==='/api/rebuy'){if(['thunder','majority','gift'].includes(room.type)||!['waiting','showdown'].includes(room.phase)||p.stack>0)throw Error('籌碼用完且本局結束後才能補充');p.stack=2000;}
 else throw Error('未知請求');
 });return send(withSocial(room,room.view(p.id)));
 }
 const sharedGift=url.pathname.match(/^\/assets\/gifts\/shared\/([a-f0-9-]{36})$/);
 if(sharedGift){auth.requireUser(req);const image=giftStore.image(sharedGift[1]);if(!image?.bytes)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到禮物圖片');res.setHeader('Content-Type',image.mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(image.bytes);}
 if(GIFTS.some(gift=>gift.image===url.pathname)){auth.requireUser(req);res.setHeader('Content-Type','image/png');res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(fs.readFileSync(path.join(__dirname,'..','public',url.pathname)));}
 const media=url.pathname.match(/^\/assets\/characters\/user\/([a-f0-9-]{36})\/(neutral|happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})$/);
 if(media){auth.requireUser(req);const row=db.prepare('SELECT character_images.mime,character_images.bytes FROM character_images JOIN player_characters ON player_characters.id=character_images.character_id JOIN users ON users.id=player_characters.owner_id WHERE character_id=? AND expression=? AND users.disabled=0').get(media[1],media[2]);if(!row)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到角色圖片');res.setHeader('Content-Type',row.mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(row.bytes);}
 if(url.pathname.startsWith('/assets/characters/')){auth.requireUser(req);const asset=builtinCharacters.flatMap(character=>Object.values(character.expressions)).find(value=>value===url.pathname);if(!asset)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到角色圖片');res.setHeader('Content-Type',asset.endsWith('.gif')?'image/gif':'image/png');res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(fs.readFileSync(path.join(__dirname,'..','public',asset)));}
 const characterId=url.pathname.match(/^\/characters\/([a-f0-9-]{36})(?:\.svg)?$/)?.[1];if(characterId){auth.requireUser(req);const record=db.prepare('SELECT appearance FROM users WHERE id=? AND disabled=0').get(characterId);if(!record)throw new HttpError(404,'CHARACTER_NOT_FOUND','找不到角色外觀');const selected=selectedImage(db,characterId,record.appearance?JSON.parse(record.appearance):defaults);const userMedia=selected.url.match(/^\/assets\/characters\/user\/([a-f0-9-]{36})\/(neutral|happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})$/);let bytes,mime;if(userMedia){const row=db.prepare('SELECT mime,bytes FROM character_images WHERE character_id=? AND expression=?').get(userMedia[1],userMedia[2]);bytes=row.bytes;mime=row.mime;}else{bytes=fs.readFileSync(path.join(__dirname,'..','public',selected.url));mime=selected.url.endsWith('.gif')?'image/gif':'image/png';}res.setHeader('Content-Type',mime);res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(bytes);}
 const files={'/profile':'profile.html','/profile.js':'profile.js','/admin':'admin.html','/admin.js':'admin.js','/login':'login.html','/login.js':'login.js','/majority-social.js':'majority-social.js','/community':'community.html','/community.js':'community.js','/community.css':'community.css','/majority':'majority.html','/majority.js':'majority.js','/majority.css':'majority.css','/gift':'gift.html','/gift.js':'gift.js','/gift.css':'gift.css','/gifts':'gifts.html','/gifts.js':'gifts.js','/gifts.css':'gifts.css','/':'index.html','/poker':'poker.html','/race':'race.html','/rules':'rules.html','/history':'history.html','/history.js':'history.js','/history.css':'history.css','/app.js':'app.js','/style.css':'style.css','/hub.js':'hub.js','/club.css':'club.css','/rooms.css':'rooms.css','/club-pages.css':'club-pages.css','/race.js':'race.js','/race.css':'race.css','/assets/thunder-components.png':'assets/thunder-components.png','/assets/thunder-box.png':'assets/thunder-box.png','/room-reconnect.js':'shared/room-reconnect.js','/shared/room-reconnect.js':'shared/room-reconnect.js','/room-host.js':'shared/room-host.js','/shared/room-host.js':'shared/room-host.js','/room-host.css':'shared/room-host.css','/shared/room-host.css':'shared/room-host.css','/game-shell.js':'shared/game-shell.js','/shared/game-shell.js':'shared/game-shell.js','/game-shell.css':'shared/game-shell.css','/shared/game-shell.css':'shared/game-shell.css','/shared/api.js':'shared/api.js'};const roomPath=url.pathname.match(/^\/(race|poker|majority|gift)\/[A-Fa-f0-9]{6}\/?$/);const file=roomPath?roomPath[1]+'.html':files[url.pathname];if(!file){res.writeHead(404);return res.end();}if(file.endsWith('.html')&&file!=='login.html'){const visitor=auth.sessionFrom(req);if(!visitor){res.writeHead(302,{Location:roomPath?'/login?next='+encodeURIComponent(url.pathname):'/login'});return res.end();}if(file==='admin.html'&&visitor.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以操作');}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'..','public',file)));
 }catch(e){writeError(res,e);}};

 const server=http.createServer(handler);
 let stopScheduler,closed=false;
 async function listen(){
  if(closed)throw Error('Application has been closed');
  if(server.listening)return server.address();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,config.host,()=>{server.off('error',reject);resolve();});});
  stopScheduler=startRoomScheduler({rooms,history,onDelete:code=>{seats.delete(code);kickedUsers.delete(code);socialEvents.delete(code);expressionEvents.delete(code);barrageEvents.delete(code);for(const key of reconnectGrace.keys())if(key.startsWith(code+':'))reconnectGrace.delete(key);}});
  submissions.recover();
  return server.address();
 }
 async function close(){
  if(closed)return;
  closed=true;
  stopScheduler?.();
  if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  history.close();
  await Promise.allSettled([...submissions.inFlight.values()]);
  db.close();
 }
 return {server,listen,close};
}
module.exports={createApp};
