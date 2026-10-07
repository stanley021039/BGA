const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
const VIDEO='M7lc1UVf-VE',OTHER='dQw4w9WgXcQ',password='synthetic-test-password';
function deferred(){let resolve;const promise=new Promise(ok=>{resolve=ok;});return {promise,resolve};}
async function fixture(t,extra={}){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'bga-unified-media-'));
 const config={host:'127.0.0.1',port:0,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false,...extra};
 const setup=openDatabase(config.dbFile);await createAuth(setup).bootstrap('host',password);setup.close();
 const app=createApp(config),{port}=await app.listen(),base=`http://127.0.0.1:${port}`;
 t.after(async()=>{await app.close();const absolute=fs.realpathSync(root);assert.equal(path.dirname(absolute),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('bga-unified-media-'));fs.rmSync(absolute,{recursive:true,force:true,maxRetries:5});});
 const users={};
 async function request(route,who,options={}){const response=await fetch(base+'/api/'+route,{...options,headers:{...(users[who]?.cookie?{Cookie:users[who].cookie}:{}),...options.headers}});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const post=(route,who,data)=>request(route,who,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const login=await post('auth/login',null,{username:'host',password});users.host={cookie:login.cookie,id:login.body.id};
 for(const name of ['manager','member','other']){const invite=await post('admin/invites','host',{days:1}),registered=await post('auth/register',null,{username:name,password,confirmPassword:password,invite:invite.body.code});assert.equal(registered.status,200);users[name]={cookie:registered.cookie,id:registered.body.id};}
 const track=await request('music/upload','host',{method:'POST',headers:{'Content-Type':'audio/mpeg','x-music-title':encodeURIComponent('Shared test song'),'x-music-duration':'60'},body:Buffer.concat([Buffer.from([255,251,144,100]),Buffer.alloc(830)])});assert.equal(track.status,200);
 async function create(type='poker',members=['manager','member']){const created=await post('create','host',{type});assert.equal(created.status,200);for(const who of members)assert.equal((await post('join',who,{code:created.body.code})).status,200);return created.body.code;}
 const game=(code,who='host')=>request('state?code='+code,who);
 const media=(code,who='host')=>request('room-media?code='+code,who);
 const command=(code,state,action,extra={})=>({code,requestId:randomUUID(),roomInstanceId:state.roomInstanceId,playbackSessionId:state.playbackSessionId,expectedRevision:state.revision,action,...extra});
 async function act(code,who,action,extra={}){const state=(await media(code,who)).body;return post('room-media',who,command(code,state,action,extra));}
 return {config,base,request,post,users,track:track.body,create,game,media,command,act};
}
test('new media authenticates active seats and all five games expose role/instance markers with mixed queues',async t=>{
 const f=await fixture(t);
 for(const type of ['poker','thunder','majority','gift','draw']){
  const code=await f.create(type),initial=(await f.game(code,'member')).body;assert.equal(initial.permissions.role,'member');assert.equal(initial.players.find(p=>p.id===initial.me).roomRole,'member');assert.equal(typeof initial.media.roomInstanceId,'string');
  assert.equal((await f.request('room-media?code='+code,null)).status,401);assert.equal((await f.media(code,'other')).body.code,'NOT_SEATED');
  const state=(await f.media(code,'member')).body;assert.equal(state.roomInstanceId,initial.media.roomInstanceId);assert.equal(state.canControl,false);
  const first=await f.post('room-media','member',f.command(code,state,'enqueue',{type:'music',trackId:f.track.id,title:'fake'}));assert.equal(first.status,200);assert.equal(first.body.current.title,'Shared test song');assert.equal(first.body.current.requestedById,initial.me);assert.equal(first.body.playback.state,'playing');
  const next=await f.act(code,'manager','enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'Named video'});assert.equal(next.body.current.type,'music');assert.equal(next.body.queue[0].title,'Named video');
  const after=(await f.game(code,'member')).body;assert.equal(after.media.revision,next.body.revision);assert.equal(after.media.hasCurrent,true);assert.equal(Object.hasOwn(after.media,'queue'),false);
  assert.equal((await f.request('room-media?code='+code,'host',{method:'PUT'})).status,405);
 }
});
test('host promotion and demotion update permissions, game/media revisions and manager transport ACL immediately',async t=>{
 const f=await fixture(t),code=await f.create('draw'),manager=(await f.game(code,'manager')).body,member=(await f.game(code,'member')).body;
 await f.media(code,'manager');const before=(await f.game(code)).body;
 const promoted=await f.post('room-role','host',{code,playerId:manager.me,role:'manager'});assert.equal(promoted.status,200);assert.ok(promoted.body.version>before.version);assert.ok(promoted.body.media.revision>before.media.revision);
 const state=(await f.media(code,'manager')).body;assert.equal(state.canControl,true);assert.equal(state.isManager,true);assert.equal((await f.game(code,'manager')).body.permissions.canManagePlayers,true);
 assert.equal((await f.post('room-role','manager',{code,playerId:member.me,role:'manager'})).body.code,'ROOM_ROLE_HOST_ONLY');
 assert.equal((await f.post('room-role','host',{code,playerId:before.me,role:'member'})).body.code,'INVALID_ROLE_TARGET');
 const song=await f.act(code,'member','enqueue',{type:'music',trackId:f.track.id});assert.equal(song.status,200);assert.equal((await f.act(code,'manager','pause')).body.playback.state,'paused');
 assert.equal((await f.act(code,'member','ended',{itemId:song.body.current.id,isHost:true,role:'manager'})).body.code,'MEDIA_MANAGER_ONLY');
 const cached=(await f.media(code,'manager')).body;await f.post('room-role','host',{code,playerId:manager.me,role:'member'});
 const denied=await f.post('room-media','manager',f.command(code,cached,'play'));assert.equal(denied.status,403);assert.equal(denied.body.code,'MEDIA_MANAGER_ONLY');assert.equal((await f.media(code,'manager')).body.canControl,false);
 await f.act(code,'host','stop');const queued=await f.act(code,'member','enqueue',{type:'music',trackId:f.track.id});assert.equal(queued.body.current,null);assert.equal(queued.body.playback.state,'paused');assert.equal(queued.body.queue.length,1);assert.equal((await f.act(code,'host','play')).body.current.type,'music');
});
test('manager kicks only members; kick/leave prune roles and queued requests, while reconnect preserves roles',async t=>{
 const f=await fixture(t),code=await f.create('poker',['manager','member','other']),host=(await f.game(code)).body,manager=(await f.game(code,'manager')).body,member=(await f.game(code,'member')).body,other=(await f.game(code,'other')).body;
 await f.post('room-role','host',{code,playerId:manager.me,role:'manager'});await f.post('room-role','host',{code,playerId:other.me,role:'manager'});
 assert.equal((await f.post('reconnect','manager',{code})).status,200);assert.equal((await f.game(code,'manager')).body.permissions.role,'manager');
 for(const playerId of [host.me,other.me,manager.me])assert.equal((await f.post('kick','manager',{code,playerId,confirmed:true})).status,403);
 await f.act(code,'host','enqueue',{type:'music',trackId:f.track.id});await f.act(code,'member','enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'Member suggestion'});
 const kicked=await f.post('kick','manager',{code,playerId:member.me,confirmed:true});assert.equal(kicked.status,200);assert.equal(kicked.body.permissions.role,'manager');assert.equal((await f.media(code)).body.queue.length,0);assert.equal((await f.media(code,'member')).body.code,'KICKED');
 assert.equal((await f.post('leave','manager',{code})).status,200);assert.equal((await f.post('join','manager',{code})).status,200);assert.equal((await f.game(code,'manager')).body.permissions.role,'member');
 const before=(await f.media(code,'other')).body;await f.post('leave','host',{code});const after=(await f.media(code,'other')).body;assert.ok(after.revision>before.revision);assert.equal((await f.game(code,'manager')).body.players.find(p=>p.id===other.me).roomRole,'host');
});
test('stale ordering, current/session changes and request reuse return state instead of overwriting queue',async t=>{
 const f=await fixture(t),code=await f.create(),initial=(await f.media(code)).body,enqueue=f.command(code,initial,'enqueue',{type:'music',trackId:f.track.id});
 const first=await f.post('room-media','member',enqueue);assert.equal(first.status,200);const duplicate=await f.post('room-media','member',{...enqueue,claimedHost:true});assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.current.id,first.body.current.id);
 const reused=await f.post('room-media','member',{...enqueue,type:'video',url:`https://youtu.be/${VIDEO}`,title:'reuse'});assert.equal(reused.body.code,'MEDIA_REQUEST_REUSED');assert.equal(reused.body.state.current.id,first.body.current.id);
 await f.act(code,'member','enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'First video'});const pending=(await f.media(code)).body,order=f.command(code,pending,'reorder',{orderIds:pending.queue.map(item=>item.id)});
 await f.act(code,'manager','enqueue',{type:'video',url:`https://youtu.be/${OTHER}`,title:'Second video'});const stale=await f.post('room-media','host',order);assert.equal(stale.status,409);assert.equal(stale.body.state.queue.length,2);
 const ended=f.command(code,stale.body.state,'ended',{itemId:first.body.current.id});await f.act(code,'host','skip');const oldEnded=await f.post('room-media','host',ended);assert.equal(oldEnded.body.code,'MEDIA_STALE');assert.equal(oldEnded.body.state.current.type,'video');
 const wrong=await f.post('room-media','host',f.command(code,oldEnded.body.state,'pause',{roomInstanceId:randomUUID()}));assert.equal(wrong.status,409);
});
test('legacy music/watch remain exclusive before takeover; canonical takeover blocks every old mutation and projects one current',async t=>{
 const f=await fixture(t),code=await f.create();await f.game(code,'member');
 const oldMusic=await f.post('room-music','member',{code,action:'select',trackId:f.track.id});assert.equal(oldMusic.status,200);
 const watch=(await f.request('room-watch?code='+code,'member')).body,watchCommand={code,requestId:randomUUID(),roomInstanceId:watch.roomInstanceId,watchSessionId:watch.watchSessionId,expectedRevision:watch.revision,controllerEpoch:watch.controllerEpoch,action:'propose',url:`https://youtu.be/${VIDEO}`};
 assert.equal((await f.post('room-watch','member',watchCommand)).body.code,'LEGACY_MEDIA_BUSY');
 const proposed=await f.post('room-watch','host',watchCommand);assert.equal(proposed.status,200);assert.equal((await f.request('room-music?code='+code,'member')).body.track,null);
 assert.equal((await f.post('room-music','member',{code,action:'select',trackId:f.track.id})).body.code,'LEGACY_MEDIA_BUSY');
 assert.equal((await f.post('room-music','host',{code,action:'select',trackId:f.track.id})).status,200);assert.equal((await f.request('room-watch?code='+code,'member')).body.video,null);
 const media=(await f.media(code,'member')).body;assert.equal(media.current.type,'music');assert.equal(media.current.requestedByName,'host');
 for(const [route,body] of [['room-music',{code,action:'select',trackId:f.track.id}],['room-watch',watchCommand]]){const blocked=await f.post(route,'member',body);assert.equal(blocked.status,409);assert.equal(blocked.body.code,'MEDIA_API_REQUIRED');assert.equal(blocked.body.state.current.id,media.current.id);}
 await f.act(code,'member','enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'Canonical video'});await f.act(code,'host','skip');
 assert.equal((await f.request('room-music?code='+code,'member')).body.track,null);const projection=(await f.request('room-watch?code='+code,'member')).body;assert.equal(projection.video.id,VIDEO);assert.equal(projection.managedBy,'room-media');
 assert.equal((await f.act(code,'member','play')).status,403);
});
test('takeover preserves old paused YouTube position and proposal names without adding external requests',async t=>{
 const f=await fixture(t),code=await f.create(),old=(await f.request('room-watch?code='+code,'member')).body;
 const legacy=(state,action,extra={})=>({code,requestId:randomUUID(),roomInstanceId:state.roomInstanceId,watchSessionId:state.watchSessionId,expectedRevision:state.revision,controllerEpoch:state.controllerEpoch,action,...extra});
 const proposed=(await f.post('room-watch','member',legacy(old,'propose',{url:`https://youtu.be/${VIDEO}`}))).body;
 const controlled=(await f.post('room-watch','host',legacy(proposed,'takeover'))).body;
 const seek=(await f.post('room-watch','host',legacy(controlled,'seek',{positionSec:12}))).body;
 await f.post('room-watch','manager',legacy(seek,'propose',{url:`https://youtu.be/${OTHER}`}));
 const adopted=(await f.media(code,'host')).body;assert.equal(adopted.current.videoId,VIDEO);assert.equal(adopted.current.requestedByName,'member');assert.equal(adopted.playback.anchorPositionSec,12);assert.equal(adopted.playback.state,'paused');assert.equal(adopted.queue[0].videoId,OTHER);assert.equal(adopted.queue[0].requestedByName,'manager');
});
test('ordinary legacy proposers cannot control, cut, replace or restart current media before new API takeover',async t=>{
 const f=await fixture(t),code=await f.create(),initial=(await f.request('room-watch?code='+code,'member')).body;
 const legacy=(state,action,extra={})=>({code,requestId:randomUUID(),roomInstanceId:state.roomInstanceId,watchSessionId:state.watchSessionId,expectedRevision:state.revision,controllerEpoch:state.controllerEpoch,action,...extra});
 const proposed=await f.post('room-watch','member',legacy(initial,'propose',{url:`https://youtu.be/${VIDEO}`}));assert.equal(proposed.status,200);assert.equal(proposed.body.canControl,false);
 for(const action of ['play','pause','seek','replay','stop','select','takeover','transfer']){const denied=await f.post('room-watch','member',legacy(proposed.body,action,{positionSec:1,proposalId:randomUUID(),playerId:(await f.game(code,'member')).body.me}));assert.equal(denied.status,403);assert.equal(denied.body.code,'MEDIA_MANAGER_ONLY');}
 const unchanged=(await f.request('room-watch?code='+code,'host')).body;assert.equal(unchanged.video.id,VIDEO);assert.equal(unchanged.playback.state,'paused');assert.equal(unchanged.revision,proposed.body.revision);
 const queued=await f.post('room-watch','member',legacy(unchanged,'propose',{url:`https://youtu.be/${OTHER}`}));assert.equal(queued.status,200);assert.equal(queued.body.video.id,VIDEO);assert.equal(queued.body.proposals.length,1);
 assert.equal((await f.post('room-music','member',{code,action:'select',trackId:f.track.id})).body.code,'LEGACY_MEDIA_BUSY');
 await f.post('room-watch','host',legacy(queued.body,'stop'));assert.equal((await f.post('room-music','member',{code,action:'select',trackId:f.track.id})).status,200);
 assert.equal((await f.post('room-music','member',{code,action:'select',trackId:f.track.id})).body.code,'LEGACY_MEDIA_BUSY');assert.equal((await f.post('room-watch','member',legacy((await f.request('room-watch?code='+code,'member')).body,'propose',{url:`https://youtu.be/${VIDEO}`}))).body.code,'LEGACY_MEDIA_BUSY');
 assert.equal((await f.request('room-music?code='+code,'member')).body.track.id,f.track.id);
});
test('metadata is revalidated after await: concurrent queue changes conflict and departed or kicked seats cannot publish',async t=>{
 const pending=deferred(),started=deferred(),f=await fixture(t,{youtubeTitleResolver:{resolve(){started.resolve();return pending.promise;}}}),code=await f.create();
 const state=(await f.media(code,'member')).body,waiting=f.post('room-media','member',f.command(code,state,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`}));await started.promise;
 await f.act(code,'host','enqueue',{type:'music',trackId:f.track.id});pending.resolve('Actual title');const result=await waiting;assert.equal(result.status,409);assert.equal(result.body.code,'MEDIA_STALE');assert.equal(result.body.state.current.type,'music');assert.equal(result.body.state.queue.length,0);
 const pending2=deferred(),started2=deferred();const f2=await fixture(t,{youtubeTitleResolver:{resolve(){started2.resolve();return pending2.promise;}}}),code2=await f2.create(),member=(await f2.game(code2,'member')).body;
 const waiting2=f2.post('room-media','member',f2.command(code2,(await f2.media(code2,'member')).body,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`}));await started2.promise;await f2.post('kick','host',{code:code2,playerId:member.me,confirmed:true});pending2.resolve('Cannot be published');assert.equal((await waiting2).body.code,'KICKED');assert.equal((await f2.media(code2)).body.current,null);
});
test('metadata failure falls back, user titles bypass resolver, and disabled accounts are checked after await',async t=>{
 let calls=0;const f=await fixture(t,{youtubeTitleResolver:{async resolve(){calls++;throw Error('metadata fail');}}}),code=await f.create();
 const fallback=await f.act(code,'member','enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});assert.equal(fallback.status,200);assert.match(fallback.body.current.title,/YouTube/);assert.equal(calls,1);
 await f.act(code,'manager','enqueue',{type:'video',url:`https://youtu.be/${OTHER}`,title:'User title'});assert.equal(calls,1);
 const pending=deferred(),started=deferred(),f2=await fixture(t,{youtubeTitleResolver:{resolve(){started.resolve();return pending.promise;}}}),code2=await f2.create(),state=(await f2.media(code2,'member')).body;
 const waiting=f2.post('room-media','member',f2.command(code2,state,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`}));await started.promise;
 const db=openDatabase(f2.config.dbFile);db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f2.users.member.id);db.close();pending.resolve('Not accepted');assert.equal((await waiting).status,401);assert.equal((await f2.media(code2)).body.current,null);
});
test('library deletion updates current and pending queues; last-player deletion releases media state',async t=>{
 const f=await fixture(t),code=await f.create();await f.act(code,'member','enqueue',{type:'music',trackId:f.track.id});await f.act(code,'manager','enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'Next'});await f.act(code,'member','enqueue',{type:'music',trackId:f.track.id});
 assert.equal((await f.post('music/'+f.track.id+'/delete','host',{})).status,200);const state=(await f.media(code)).body;assert.equal(state.current.type,'video');assert.equal(state.queue.length,0);
 for(const who of ['member','manager','host'])assert.equal((await f.post('leave',who,{code})).status,200);assert.equal((await f.media(code)).body.code,'ROOM_NOT_FOUND');
 const fresh=await f.create();const next=(await f.media(fresh)).body;assert.notEqual(next.roomInstanceId,state.roomInstanceId);assert.equal(next.current,null);assert.equal(next.queue.length,0);
});
test('new media endpoints enforce command frequency even for accepted retries',async t=>{
 const f=await fixture(t),code=await f.create(),state=(await f.media(code,'member')).body,body=f.command(code,state,'enqueue',{type:'music',trackId:f.track.id});
 for(let n=0;n<60;n++)assert.equal((await f.post('room-media','member',body)).status,200);
 assert.equal((await f.post('room-media','member',body)).status,429);assert.equal((await f.media(code)).body.queue.length,0);
});
