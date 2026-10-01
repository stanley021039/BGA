const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {randomBytes}=require('node:crypto');
const {Room}=require('./engine'),{ThunderRoom}=require('./thunder'),{MajorityRoom}=require('./majority');
const {HistoryStore}=require('./history'),{CommunityStore}=require('./community');
const {startRoomScheduler}=require('./rooms');
const {HttpError,writeError}=require('./http-errors');
const {openDatabase}=require('./db');
const {createAuth}=require('./auth');
const {BoardStore}=require('./board');
const {createGitHubClient}=require('./github');
const {SubmissionService}=require('./submissions');
const {parts,colors,defaults,validateAppearance,renderAppearance}=require('./appearance');
function createApp(config){
 const rooms=new Map(),seats=new Map(),kickedUsers=new Map();
 const history=new HistoryStore(config.historyDir);
 let community,db,auth,board,submissions;
 try{community=new CommunityStore(config.communityDir);db=openDatabase(config.dbFile);auth=createAuth(db,{secureCookies:config.publicUrl?.startsWith('https://')});board=new BoardStore(db,community.data.issues);submissions=new SubmissionService(db,board,config.githubClient||createGitHubClient({token:config.githubToken??process.env.GITHUB_TOKEN,baseUrl:config.githubApiBase??process.env.GITHUB_API_BASE}));}
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
 res.setHeader('Content-Type','application/json; charset=utf-8');let data={};if(req.method==='POST'){if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Error('不允許跨站請求');if(!req.headers['content-type']?.startsWith('application/json'))throw Error('需要 JSON');let body='';for await(const chunk of req){body+=chunk;if(body.length>(url.pathname==='/api/community/avatars'?450000:8192))throw Error('請求過大');}data=JSON.parse(body||'{}');}
 const send=x=>res.end(JSON.stringify(x));
 if(url.pathname==='/api/auth/login'&&req.method==='POST'){limitAuth(req);return send(await auth.login(data,res));}
 if(url.pathname==='/api/auth/register'&&req.method==='POST'){limitAuth(req);return send(await auth.register(data,res));}
 if(url.pathname==='/api/auth/reset'&&req.method==='POST'){limitAuth(req);await auth.resetPassword(data);return send({ok:true});}
 if(url.pathname==='/api/auth/logout'&&req.method==='POST'){auth.logout(req,res);return send({ok:true});}
 const user=auth.requireUser(req);
 if(url.pathname==='/api/auth/me'&&req.method==='GET')return send(auth.publicUser(user));
 if(url.pathname==='/api/profile/options'&&req.method==='GET')return send({parts,colors,defaults});
 if(url.pathname==='/api/profile/preview.svg'&&req.method==='GET'){res.setHeader('Content-Type','image/svg+xml');res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(renderAppearance(Object.fromEntries(url.searchParams)));}
 if(url.pathname==='/api/profile/appearance'&&req.method==='POST'){const appearance=validateAppearance(data);db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify(appearance),user.id);for(const room of rooms.values()){const playerId=seats.get(room.code)?.get(user.id);const player=room.players.find(p=>p.id===playerId);if(player)player.avatar=`/avatars/${user.id}.svg`;}return send({appearance});}
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
 if(url.pathname.startsWith('/api/community/')){const resource=url.pathname.split('/')[3];if(req.method==='GET'){if(resource==='avatars')return send(community.avatars());if(resource==='issues')return send(board.list());if(resource==='questions')return send({topics:require('./majority-questions').TOPICS,questions:[...require('./majority-questions').QUESTIONS,...community.data.questions]});}if(req.method==='POST'){limitCommunity(req);limitAccount(user);if(resource==='avatars')return send(community.upload(data));if(resource==='questions')return send(community.question({...data,name:user.display_name}));if(resource==='issues'){const kind=data.id?data.action==='comment'?'comment':'status':'issue';const result=await submissions.submit(kind,data,user);if(result.state==='needs_review')res.statusCode=202;else if(result.state==='failed')res.statusCode=502;return send(result);}}throw Error('未知共用資源');}
 if(url.pathname==='/api/history')return send(history.list());
 if(url.pathname.startsWith('/api/history/'))return send(history.read(url.pathname.split('/')[3]));
 if(url.pathname==='/api/info'){const addresses=Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>`${protocol}://${x.address}:${port}`);const preferred=config.publicUrl||addresses.find(a=>a.includes('://26.'))||null;return send({preferred,addresses:config.publicUrl?[config.publicUrl,...addresses.filter(a=>a!==config.publicUrl)]:addresses});}
 if(url.pathname==='/api/create'&&req.method==='POST'){if(rooms.size>=100)throw Error('房間數已達上限');let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const thunder=data.type==='thunder',majority=data.type==='majority';const room=new (majority?MajorityRoom:thunder?ThunderRoom:Room)(code,String(data.roomName||(majority?'同頻俱樂部':thunder?'末路狂飆好友局':'深夜好友局')).slice(0,24));if(majority)Object.defineProperty(room,'questionProvider',{value:()=>community.data.questions});history.attach(room);const p=history.transact(room,{action:'create',source:'player',name:user.display_name},()=>room.add(user.display_name));p.avatar=user.appearance?`/avatars/${user.id}.svg`:community.avatar(data.avatar);rooms.set(code,room);seats.set(code,new Map([[user.id,p.id]]));return send({code,type:room.type||'poker'});}
 if(!['/api/join','/api/state','/api/action','/api/kick','/api/settings','/api/start','/api/bot','/api/rebuy'].includes(url.pathname))throw new HttpError(404,'NOT_FOUND','找不到請求路徑');
 const room=rooms.get(String(data.code||url.searchParams.get('code')||'').toUpperCase());if(!room)throw new HttpError(404,'ROOM_NOT_FOUND','找不到房間，請確認房間代碼');
 if(kickedUsers.get(room.code)?.has(user.id))throw new HttpError(403,'KICKED','你已被房主踢出房間');
 if(url.pathname==='/api/join'&&req.method==='POST'){const previous=seats.get(room.code)?.get(user.id);if(previous)return send({code:room.code,type:room.type||'poker'});const p=history.transact(room,{action:'join',source:'player',name:user.display_name},()=>room.add(user.display_name));p.avatar=user.appearance?`/avatars/${user.id}.svg`:community.avatar(data.avatar);seats.get(room.code).set(user.id,p.id);return send({code:room.code,type:room.type||'poker'});}
 const playerId=seats.get(room.code)?.get(user.id);const p=room.players.find(p=>p.id===playerId&&!p.bot);if(!p)throw new HttpError(403,'NOT_SEATED','尚未加入此房間');p.lastSeen=Date.now();
 if(url.pathname==='/api/state')return send(room.view(p.id));
 if(req.method!=='POST')throw Error('不支援的請求');
 if(url.pathname==='/api/start'&&room.host!==p.id)throw new HttpError(403,'HOST_ONLY','只有房主可以開始');
 history.transact(room,{action:url.pathname.slice(5),source:'player',actor:p.id,input:data},()=>{
 if(url.pathname==='/api/action')room.act(p.id,data.action,['thunder','majority'].includes(room.type)?data:data.amount);
 else if(url.pathname==='/api/kick'){if(data.confirmed!==true)throw new HttpError(400,'CONFIRM_REQUIRED','請先確認踢出玩家');const target=room.players.find(q=>q.id===data.playerId);if(!target)throw new HttpError(404,'PLAYER_NOT_FOUND','找不到玩家');room.kick(p.id,target.id);const account=[...seats.get(room.code)].find(([,id])=>id===target.id)?.[0];if(account){seats.get(room.code).delete(account);if(!kickedUsers.has(room.code))kickedUsers.set(room.code,new Set());kickedUsers.get(room.code).add(account);}}
 else if(url.pathname==='/api/settings'){if(!['thunder','majority'].includes(room.type))throw Error('此遊戲沒有此設定');room.configure(p.id,data);}
 else if(url.pathname==='/api/start'){if(room.host!==p.id)throw Error('只有房主可以發牌');room.start();}
 else if(url.pathname==='/api/bot'){if(room.host!==p.id)throw Error('只有房主可以加入電腦');room.add(['River','Clover','Atlas','Nova','Juno'][room.players.filter(p=>p.bot).length%5],true);}
 else if(url.pathname==='/api/rebuy'){if(['thunder','majority'].includes(room.type)||!['waiting','showdown'].includes(room.phase)||p.stack>0)throw Error('籌碼用完且本局結束後才能補充');p.stack=2000;}
 else throw Error('未知請求');
 });return send(room.view(p.id));
 }
 if(url.pathname.startsWith('/uploads/avatars/')){const file=url.pathname.slice('/uploads/avatars/'.length);if(!/^[a-f0-9-]{36}\.(png|jpeg|webp)$/.test(file)||!community.data.avatars.some(a=>a.url===url.pathname)){res.writeHead(404);return res.end();}res.setHeader('Content-Type','image/'+file.split('.').pop());res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(fs.readFileSync(path.join(community.avatarDir,file)));}
 const avatarId=url.pathname.match(/^\/avatars\/([a-f0-9-]{36})\.svg$/)?.[1];if(avatarId){auth.requireUser(req);const appearance=db.prepare('SELECT appearance FROM users WHERE id=? AND disabled=0').get(avatarId)?.appearance;if(!appearance)throw new HttpError(404,'AVATAR_NOT_FOUND','找不到角色外觀');res.setHeader('Content-Type','image/svg+xml');res.setHeader('Content-Security-Policy',"default-src 'none'");return res.end(renderAppearance(JSON.parse(appearance)));}
 const files={'/profile':'profile.html','/profile.js':'profile.js','/admin':'admin.html','/admin.js':'admin.js','/login':'login.html','/login.js':'login.js','/majority-social.js':'majority-social.js','/community':'community.html','/community.js':'community.js','/community.css':'community.css','/avatar-picker.js':'avatar-picker.js','/avatar-picker.css':'avatar-picker.css','/majority':'majority.html','/majority.js':'majority.js','/majority.css':'majority.css','/':'index.html','/poker':'poker.html','/race':'race.html','/rules':'rules.html','/history':'history.html','/history.js':'history.js','/history.css':'history.css','/app.js':'app.js','/style.css':'style.css','/hub.js':'hub.js','/club.css':'club.css','/club-pages.css':'club-pages.css','/race.js':'race.js','/race.css':'race.css','/assets/thunder-components.png':'assets/thunder-components.png','/assets/thunder-box.png':'assets/thunder-box.png','/room-host.js':'room-host.js','/room-host.css':'room-host.css'};const roomPath=url.pathname.match(/^\/(race|poker|majority)\/[A-Fa-f0-9]{6}\/?$/);const file=roomPath?roomPath[1]+'.html':files[url.pathname];if(!file){res.writeHead(404);return res.end();}if(file.endsWith('.html')&&file!=='login.html'){const visitor=auth.sessionFrom(req);if(!visitor){res.writeHead(302,{Location:'/login'});return res.end();}if(file==='admin.html'&&visitor.role!=='admin')throw new HttpError(403,'ADMIN_REQUIRED','只有管理者可以操作');}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'public',file)));
 }catch(e){writeError(res,e);}};

 const server=http.createServer(handler);
 let stopScheduler,closed=false;
 async function listen(){
  if(closed)throw Error('Application has been closed');
  if(server.listening)return server.address();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,config.host,()=>{server.off('error',reject);resolve();});});
  stopScheduler=startRoomScheduler({rooms,history,onDelete:code=>{seats.delete(code);kickedUsers.delete(code);}});
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
