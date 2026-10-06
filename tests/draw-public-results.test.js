const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {DrawGuessRoom,MAX_PUBLIC_RESULTS,MAX_RESULT_SAVES}=require('../src/games/draw-guess');
const {createApp}=require('../src/app');
const {openDatabase}=require('../src/db/index');
const {createAuth}=require('../src/auth/index');
const {leavePlayer}=require('../src/rooms/lifecycle');
const {rejoinPlayer}=require('../src/rooms/membership');

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const png=fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png'));
const base64=png.toString('base64');
function game(count=2){
 let now=1_000_000;const room=new DrawGuessRoom('ABC123','公開結果',()=>0,()=>now);
 const players=Array.from({length:count},(_,index)=>room.add('玩家'+index));
 players.forEach((player,index)=>{player.avatar='/characters/'+index;});
 room.start();return {room,players,advance:ms=>{now+=ms;}};
}
function choose(room){const word=room.candidates[0];room.choose(room.presenterId,word.id);return word;}
function stroke(room,points=[[13,27],[34,58]]){
 return room.addStroke(room.presenterId,{round:room.round,canvasEpoch:room.canvas.epoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#336699',size:4,points});
}

test('only reveal publishes immutable metadata and a separate stroke snapshot',()=>{
 const {room,players:[artist,guest]}=game();
 const candidates=room.candidates.map(word=>word.title);
 assert.match(room.gameRunId,uuid);
 assert.deepEqual(room.view(guest.id).recentResults,[]);
 assert.deepEqual(room.view(guest.id).candidates,[]);
 for(const id of [room.canvas.epoch,room.gameRunId,room.candidates[0].id,randomUUID(),undefined])assert.throws(()=>room.resultSnapshot(id),{code:'DRAW_RESULT_NOT_FOUND'});
 const word=choose(room),accepted=stroke(room);
 assert.equal(room.view(guest.id).question,null);
 assert.deepEqual(room.view(guest.id).recentResults,[]);
 assert.ok(!JSON.stringify(room.view(guest.id)).includes(word.title));
 room.guess(guest.id,word.title);
 const result=room.result,detail=room.resultSnapshot(result.resultId),metadata=room.view(guest.id).recentResults[0];
 assert.match(result.resultId,uuid);assert.equal(result.gameRunId,room.gameRunId);
 assert.equal(result.canvasEpoch,detail.canvas.canvasEpoch);assert.equal(result.revealedAt,1_000_000);
 assert.deepEqual(metadata.artist,{id:artist.id,name:'玩家0',avatar:'/characters/0'});
 assert.equal(metadata.answer,word.title);assert.deepEqual(detail.canvas.strokes,[accepted.stroke]);
 assert.deepEqual(result.scores.map(row=>[row.id,row.score,row.roundPoints]),[[artist.id,15,15],[guest.id,100,100]]);
 assert.equal(metadata.guesses,undefined);assert.equal(metadata.strokes,undefined);assert.equal(metadata.candidates,undefined);
 assert.ok(candidates.slice(1).every(title=>!JSON.stringify(detail).includes(title)));
 assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.scores[0]));
 const frozen=JSON.stringify(detail);
 room.question.title='replacement';room.question.aliases.push('changed');artist.name='renamed';artist.avatar='/changed';artist.score=999;
 room.canvas.strokes[0].points[0][0]=501;
 metadata.artist.name='client replacement';detail.canvas.strokes[0].points[0][1]=250;detail.result.scores[0].score=999;
 assert.equal(JSON.stringify(room.resultSnapshot(result.resultId)),frozen);
 room.reveal('duplicate');assert.equal(room.publicResults.size,1);assert.equal(room.result.resultId,result.resultId);
 for(const key of ['canvas','publicResults','roundStartScores'])assert.equal(Object.keys(room).includes(key),false);
 assert.equal(JSON.stringify(room).includes(accepted.stroke.strokeId),false);
 assert.equal(JSON.stringify(room.view(guest.id)).includes(accepted.stroke.strokeId),false);
});

test('round deltas preserve cumulative score and old results survive seat return and a new round one',()=>{
 const {room,players:[host,guest],advance}=game();
 const firstWord=choose(room);stroke(room);room.guess(guest.id,firstWord.title);
 const first=room.resultSnapshot(room.result.resultId),runId=room.gameRunId;
 room.next(host.id);advance(1000);
 const secondWord=choose(room);room.guess(host.id,secondWord.title);
 assert.deepEqual(room.result.scores.map(row=>[row.id,row.score,row.roundPoints]),[[host.id,115,100],[guest.id,115,15]]);
 room.next(host.id);assert.equal(room.phase,'finished');
 leavePlayer(room,guest.id);assert.equal(rejoinPlayer(room,guest.id,'返回玩家').id,guest.id);
 room.start();assert.equal(room.round,1);assert.notEqual(room.gameRunId,runId);assert.notEqual(room.canvas.epoch,first.canvas.canvasEpoch);
 assert.equal(room.view(host.id).recentResults.length,2);assert.deepEqual(room.resultSnapshot(first.result.resultId),first);
 advance(1000);choose(room);room.guess(guest.id,room.question.title);
 assert.notEqual(room.result.resultId,first.result.resultId);assert.notEqual(room.result.gameRunId,first.result.gameRunId);
 assert.equal(room.result.scores.find(row=>row.id===guest.id).roundPoints,100);
});

test('unrevealed early finish does not publish an answer, candidates or a result',()=>{
 for(const drawing of [false,true]){
  const {room,players:[host,guest]}=game();
  if(drawing)choose(room);
  const id=room.canvas.epoch;leavePlayer(room,host.id);
  assert.equal(room.phase,'finished');assert.equal(room.view(guest.id).question,null);
  assert.deepEqual(room.view(guest.id).candidates,[]);assert.deepEqual(room.view(guest.id).recentResults,[]);
  assert.equal(room.view(guest.id).result,null);assert.throws(()=>room.resultSnapshot(id),{code:'DRAW_RESULT_NOT_FOUND'});
 }
});

test('a mid-round returning seat keeps prior totals without counting them as new round points',()=>{
 const {room,players:[host,returning]}=game(3);choose(room);room.guess(returning.id,room.question.title);room.reveal();
 assert.equal(returning.score,100);leavePlayer(room,returning.id);room.next(host.id);
 assert.equal(room.round,2);assert.equal(rejoinPlayer(room,returning.id,'返回玩家').id,returning.id);
 assert.equal(returning.waitingForNextRound,true);assert.equal(room.participantIds.includes(returning.id),false);
 choose(room);room.reveal();
 const saved=room.result.scores.find(row=>row.id===returning.id);assert.equal(saved.score,100);assert.equal(saved.roundPoints,0);
});

test('only eight public rounds and bounded per-account collection references survive, and evicted IDs cannot be reused',()=>{
 const {room,players:[host]}=game(8),ids=[];
 for(let index=0;index<8;index++){
  choose(room);room.reveal();ids.push(room.result.resultId);
  room.rememberResultArtwork(room.result.resultId,'account','artwork');room.next(host.id);
 }
 assert.equal(room.publicResults.size,MAX_PUBLIC_RESULTS);assert.equal(room.phase,'finished');
 assert.deepEqual(room.view(host.id).recentResults.map(result=>result.resultId),[...ids].reverse());
 const before=room.resultSnapshot(ids[1]);room.start();choose(room);room.reveal();
 assert.equal(room.publicResults.size,MAX_PUBLIC_RESULTS);assert.equal(room.publicResults.has(ids[0]),false);
 for(const get of [()=>room.resultSnapshot(ids[0]),()=>room.resultMetadata(ids[0]),()=>room.savedResultArtwork(ids[0],'account'),()=>room.rememberResultArtwork(ids[0],'account','another')])assert.throws(get,{code:'DRAW_RESULT_NOT_FOUND'});
 assert.deepEqual(room.resultSnapshot(ids[1]),before);
 const current=room.result.resultId;
 for(let index=0;index<MAX_RESULT_SAVES;index++)room.rememberResultArtwork(current,'user-'+index,'art-'+index);
 assert.throws(()=>room.savedResultArtwork(current,'overflow'),{code:'DRAW_RESULT_SAVE_LIMIT'});
 assert.throws(()=>room.rememberResultArtwork(current,'overflow','art'),{code:'DRAW_RESULT_SAVE_LIMIT'});
 assert.equal(room.savedResultArtwork(current,'user-0'),'art-0');room.rememberResultArtwork(current,'user-0','recollected');
 assert.equal(room.savedResultArtwork(current,'user-0'),'recollected');assert.equal(room.publicResults.get(current).artworks.size,MAX_RESULT_SAVES);
});

test('eight maximum-work drawings stay out of state and serialized history while details remain retrievable',t=>{
 const {room,players:[host],advance}=game(8),ids=[];
 for(let round=0;round<8;round++){
  choose(room);room.deadline+=2_000_000;
  for(let index=0;index<1000;index++){advance(1001);stroke(room,Array.from({length:30},(_,point)=>[index%512,point]));}
  assert.deepEqual(room.canvasQuota(),{usedFills:0,usedBatches:1000,usedPoints:30000});room.reveal();ids.push(room.result.resultId);
  room.next(host.id);
 }
 const id=ids[0],detail=room.resultSnapshot(id);
 assert.equal(detail.canvas.strokes.length,1000);assert.equal(detail.canvas.quota.usedPoints,30000);
 assert.ok(Buffer.byteLength(JSON.stringify(detail))>300_000);
 assert.equal(room.publicResults.size,8);
 const snapshots=[...room.publicResults.values()].map(entry=>entry.snapshot);
 assert.equal(snapshots.reduce((total,snapshot)=>total+snapshot.canvas.quota.usedPoints,0),240000);
 const stateBytes=Buffer.byteLength(JSON.stringify(room.view(host.id))),historyBytes=Buffer.byteLength(JSON.stringify(room)),snapshotBytes=Buffer.byteLength(JSON.stringify(snapshots));
 assert.ok(stateBytes<20_000);assert.ok(historyBytes<20_000);
 t.diagnostic(JSON.stringify({snapshots:8,batches:8000,points:240000,stateBytes,historyBytes,snapshotBytes}));
 room.start();assert.equal(room.canvas.strokes.length,0);assert.equal(room.resultSnapshot(id).canvas.strokes.length,1000);
 choose(room);room.reveal();assert.equal(room.publicResults.size,8);assert.throws(()=>room.resultSnapshot(id),{code:'DRAW_RESULT_NOT_FOUND'});
});

async function httpGame(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-draw-results-'));
 assert.equal(path.dirname(root),path.resolve(os.tmpdir()));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false};
 const db=openDatabase(config.dbFile),auth=createAuth(db),users={};
 try{
  users.host=await auth.bootstrap('draw_host','draw-results-password');
  const hash=db.prepare('SELECT password_hash FROM users WHERE id=?').get(users.host).password_hash;
  for(const name of ['guest','late','outsider']){
   users[name]=randomUUID();db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(users[name],'draw_'+name,name,hash,'member',new Date().toISOString());
  }
 }finally{db.close();}
 const app=createApp(config);t.after(async()=>{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
 const {port}=await app.listen(),base='http://127.0.0.1:'+port,cookies={};
 const request=async(route,who,{method='GET',data,headers={}}={})=>{
  const response=await fetch(base+'/api/'+route,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 const post=(route,who,data,headers)=>request(route,who,{method:'POST',data,headers});
 for(const name of Object.keys(users)){const login=await post('auth/login',null,{username:'draw_'+name,password:'draw-results-password'});assert.equal(login.status,200);cookies[name]=login.cookie;}
 const created=await post('create','host',{type:'draw'});assert.equal(created.status,200);const code=created.body.code;
 assert.equal((await post('join','guest',{code})).status,200);assert.equal((await post('start','host',{code})).status,200);
 const state=who=>request('state?code='+code,who);
 const detail=(who,resultId,otherCode=code)=>request('draw/result?code='+otherCode+'&resultId='+encodeURIComponent(resultId),who);
 const save=(who,resultId,extra={})=>post('draw/result/save',who,{code,resultId,base64,...extra});
 const reveal=async(artist='host',guesser='guest')=>{
  const choosing=(await state(artist)).body,word=choosing.candidates[0];
  assert.equal((await post('action',artist,{code,action:'choose',questionId:word.id})).status,200);
  const batch={code,round:choosing.round,canvasEpoch:choosing.canvasEpoch,batchId:randomUUID(),strokeId:randomUUID(),tool:'brush',color:'#123456',size:4,points:[[13,27],[31,47]]};
  assert.equal((await post('draw/stroke',artist,batch)).status,200);
  assert.equal((await post('action',guesser,{code,action:'guess',answer:word.title})).status,200);
  const shown=(await state(guesser)).body;assert.equal(shown.phase,'reveal');return {metadata:shown.result,batch,word};
 };
 return {root,config,users,cookies,base,code,request,post,state,detail,save,reveal};
}

test('HTTP results authorize current seats, late joins and rejoin but deny outsiders and kicked users',async t=>{
 const f=await httpGame(t),state=(await f.state('host')).body;
 for(const id of [state.canvasEpoch,state.gameRunId,state.candidates[0].id,randomUUID()]){
  const response=await f.detail('guest',id);assert.equal(response.status,404);assert.equal(response.body.code,'DRAW_RESULT_NOT_FOUND');
 }
 assert.equal((await f.state('guest')).body.recentResults.length,0);
 const {metadata,batch}=await f.reveal(),id=metadata.resultId;
 const snapshot=await f.detail('guest',id);assert.equal(snapshot.status,200);assert.equal(snapshot.body.canvas.strokes[0].strokeId,batch.strokeId);
 assert.equal(snapshot.body.result.artist.name,'draw_host');
 assert.equal((await f.detail(null,id)).status,401);assert.equal((await f.detail('outsider',id)).body.code,'NOT_SEATED');
 assert.equal((await f.save('outsider',id)).status,403);
 const other=await f.post('create','outsider',{type:'draw'});assert.equal((await f.detail('outsider',id,other.body.code)).body.code,'DRAW_RESULT_NOT_FOUND');
 assert.equal((await f.post('join','late',{code:f.code})).status,200);
 const lateState=(await f.state('late')).body;assert.equal(lateState.players.find(player=>player.id===lateState.me).waitingForNextRound,true);
 assert.deepEqual((await f.detail('late',id)).body,snapshot.body);
 assert.equal((await f.post('leave','guest',{code:f.code})).status,200);assert.equal((await f.detail('guest',id)).body.code,'NOT_SEATED');
 assert.equal((await f.post('join','guest',{code:f.code})).status,200);assert.deepEqual((await f.detail('guest',id)).body,snapshot.body);
 const guest=(await f.state('guest')).body.me;
 assert.equal((await f.post('kick','host',{code:f.code,playerId:guest,confirmed:true})).status,200);
 assert.equal((await f.detail('guest',id)).body.code,'KICKED');assert.equal((await f.save('guest',id)).body.code,'KICKED');
 assert.equal((await f.post('join','guest',{code:f.code})).body.code,'KICKED');
 assert.deepEqual((await f.detail('late',id)).body,snapshot.body);
});

test('HTTP late saves and concurrent retries bind the original result and remain private after room deletion',async t=>{
 const f=await httpGame(t),first=await f.reveal(),id=first.metadata.resultId;
 const original=(await f.detail('guest',id)).body;
 assert.equal((await f.post('action','host',{code:f.code,action:'next'})).status,200);
 await f.reveal('guest','host');assert.equal((await f.post('action','host',{code:f.code,action:'next'})).status,200);
 assert.equal((await f.post('start','host',{code:f.code})).status,200);
 const restarted=(await f.state('guest')).body;assert.equal(restarted.round,1);assert.notEqual(restarted.gameRunId,first.metadata.gameRunId);
 assert.deepEqual((await f.detail('guest',id)).body,original);
 const requests=await Promise.all([f.save('guest',id,{name:'client cannot choose this name'}),f.save('guest',id)]);
 assert.ok(requests.every(response=>response.status===200));assert.deepEqual(requests.map(response=>response.body.duplicate).sort(),[false,true]);
 const saved=requests[0].body;assert.equal(saved.resultId,id);assert.equal(saved.gameRunId,first.metadata.gameRunId);assert.equal(saved.canvasEpoch,first.metadata.canvasEpoch);
 assert.equal(requests[1].body.artwork.id,saved.artwork.id);assert.equal(saved.artwork.name,'你畫我猜：'+first.word.title+' — '+first.metadata.artist.name);
 const retry=await f.save('guest',id,{base64:'not-an-image'});assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.artwork.id,saved.artwork.id);
 const list=await f.request('artworks','guest');assert.equal(list.body.artworks.length,1);
 const bytes=await fetch(f.base+saved.artwork.url,{headers:{Cookie:f.cookies.guest}});assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),png);
 assert.equal((await fetch(f.base+saved.artwork.url,{headers:{Cookie:f.cookies.host}})).status,404);
 const hostSaved=await f.save('host',id);assert.equal(hostSaved.status,200);assert.notEqual(hostSaved.body.artwork.id,saved.artwork.id);
 assert.equal((await f.post('leave','guest',{code:f.code})).status,200);assert.equal((await f.post('leave','host',{code:f.code})).body.deleted,true);
 assert.equal((await f.detail('guest',id)).body.code,'ROOM_NOT_FOUND');
 assert.equal((await fetch(f.base+saved.artwork.url,{headers:{Cookie:f.cookies.guest}})).status,200);
 assert.equal((await f.request('artworks','guest')).body.artworks.length,1);
 const rows=fs.readdirSync(f.config.historyDir).filter(name=>name.endsWith('.jsonl')).flatMap(name=>fs.readFileSync(path.join(f.config.historyDir,name),'utf8').trim().split('\n').map(line=>JSON.parse(line))).filter(row=>['intent','result'].includes(row.kind));
 assert.ok(rows.length>0);const recorded=JSON.stringify(rows);
 assert.equal(recorded.includes(first.batch.strokeId),false);assert.equal(recorded.includes(base64),false);assert.equal(recorded.includes('publicResults'),false);
});

test('HTTP duplicates bypass the artwork quota, while deleted originals require explicit recollection',async t=>{
 const f=await httpGame(t),first=await f.reveal(),id=first.metadata.resultId,saved=await f.save('guest',id);
 assert.equal(saved.status,200);
 const db=new DatabaseSync(f.config.dbFile);
 try{
  const insert=db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?)');
  for(let index=0;index<99;index++)insert.run(randomUUID(),f.users.guest,'quota '+index,'image/png',png,new Date().toISOString());
 }finally{db.close();}
 assert.equal((await f.request('artworks','guest')).body.artworks.length,100);
 const duplicate=await f.save('guest',id);assert.equal(duplicate.status,200);assert.equal(duplicate.body.artwork.id,saved.body.artwork.id);
 assert.equal((await f.post('artworks','guest',{name:'over quota',mime:'image/png',base64})).body.code,'ARTWORK_LIMIT');
 assert.equal((await f.post('artworks/'+saved.body.artwork.id+'/delete','guest',{})).status,200);
 const lost=await f.save('guest',id);assert.equal(lost.status,409);assert.equal(lost.body.code,'DRAW_SAVED_ARTWORK_DELETED');
 assert.equal((await f.request('artworks','guest')).body.artworks.length,99);
 const recollected=await f.save('guest',id,{recollect:true});assert.equal(recollected.status,200);assert.equal(recollected.body.duplicate,false);
 assert.notEqual(recollected.body.artwork.id,saved.body.artwork.id);assert.equal((await f.request('artworks','guest')).body.artworks.length,100);
 const retry=await f.save('guest',id,{recollect:true});assert.equal(retry.status,200);assert.equal(retry.body.artwork.id,recollected.body.artwork.id);assert.equal(retry.body.duplicate,true);
});

test('HTTP result routes enforce method, PNG, body size, origin and account rate limits',async t=>{
 const f=await httpGame(t),{metadata}=await f.reveal(),id=metadata.resultId;
 assert.ok(base64.length>8192);
 assert.equal((await f.request('draw/result/save?code='+f.code,'guest')).status,405);
 assert.equal((await f.post('draw/result','guest',{code:f.code,resultId:id})).status,405);
 assert.equal((await f.save(null,id)).status,401);
 assert.equal((await f.save('guest',randomUUID())).body.code,'DRAW_RESULT_NOT_FOUND');
 assert.equal((await f.save('guest',id,{base64:'broken'})).body.code,'INVALID_CHARACTER_IMAGE');
 const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
 assert.equal((await f.save('guest',id,{base64:gif.toString('base64')})).body.code,'INVALID_CHARACTER_IMAGE');
 assert.equal((await f.save('guest',id,{base64:'A'.repeat(1_400_000)})).status,413);
 assert.equal((await f.post('draw/result/save','guest',{code:f.code,resultId:id,base64},{Origin:'https://foreign.invalid'})).status,400);
 assert.equal((await f.request('artworks','guest')).body.artworks.length,0);
 const saved=await f.save('guest',id);assert.equal(saved.status,200);
 for(let index=0;index<6;index++)assert.equal((await f.save('guest',id)).status,200);
 const limited=await f.save('guest',id);assert.equal(limited.status,429);assert.equal(limited.body.code,'RATE_LIMITED');
 assert.equal((await f.request('artworks','guest')).body.artworks.length,1);
});
