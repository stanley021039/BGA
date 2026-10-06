const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const {openDatabase,SCHEMA_VERSION}=require('../src/db/index');
const {DrawWordStore}=require('../src/games/draw-guess-store');
const {DrawGuessRoom,normalize}=require('../src/games/draw-guess');
const {WORDS}=require('../src/games/draw-guess-words');
const {leavePlayer}=require('../src/rooms/lifecycle');
const {rejoinPlayer}=require('../src/rooms/membership');
const {HistoryStore}=require('../src/history/store');
const {createApp}=require('../src/app');
const {createAuth}=require('../src/auth/index');

function tempRoot(){return fs.mkdtempSync(path.join(os.tmpdir(),'bga-word-ban-'));}
function removeRoot(dir){assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));fs.rmSync(dir,{recursive:true,force:true});}
function database(t){
 const root=tempRoot(t),file=path.join(root,'app.sqlite'),db=openDatabase(file),store=new DrawWordStore(db);
 const user={id:randomUUID(),display_name:'出題玩家'};
 db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(user.id,'word_owner',user.display_name,'unused','admin',new Date().toISOString());
 t.after(()=>{db.close();removeRoot(root);});
 return {root,file,db,store,user,add:title=>store.add(user,{title,aliases:[],difficulty:'easy',topic:'misc'})};
}
function game(store,count=2,code='ABC123',customOnly=false){
 let now=1_000_000;const room=new DrawGuessRoom(code,'投票測試',()=>0,()=>now);
 Object.defineProperties(room,{wordProvider:{value:()=>store.list()},wordExclusionProvider:{value:word=>store.isExcluded(word)},wordBanWriter:{value:(word,audit)=>store.ban(word,audit)}});
 const players=Array.from({length:count},(_,i)=>room.add('玩家'+i));
 if(customOnly)room.configure(players[0].id,{seconds:90,topics:['custom']});
 room.start();return {room,players,advance:ms=>{now+=ms;}};
}
function reveal(room){const word=room.candidates[0];room.choose(room.presenterId,word.id);room.reveal();return {word,id:room.result.resultId};}
function audit(count=2){const electorate=Array.from({length:count},()=>randomUUID());return {roomCode:'ABC123',resultId:randomUUID(),gameRunId:randomUUID(),electorate,votes:[...electorate],required:Math.floor(count/2)+1};}
const countRows=db=>db.prepare('SELECT COUNT(*) AS n FROM draw_word_exclusions').get().n;

for(const count of [2,4,5])test(count+' seats require strictly more than half, count each seat once, and freeze result pixels and scores',t=>{
 const f=database(t),{room,players}=game(f.store,count),{word,id}=reveal(room),snapshot=room.resultSnapshot(id),required=Math.floor(count/2)+1;
 assert.deepEqual(room.resultVote(id,players[0].id),{resultId:id,votes:0,total:count,required,voted:false,canVote:true,banned:false});
 for(let i=0;i<Math.floor(count/2);i++)room.voteWordBan(players[i].id,id);
 const halfway=room.resultVote(id,players[0].id),version=room.version;
 assert.equal(halfway.votes,required-1);assert.equal(halfway.banned,false);assert.equal(countRows(f.db),0);
 room.voteWordBan(players[0].id,id);assert.equal(room.version,version);assert.equal(room.resultVote(id,players[0].id).votes,required-1);
 const final=room.voteWordBan(players[required-1].id,id);
 assert.equal(final.banned,true);assert.equal(final.votes,required);assert.equal(final.canVote,false);assert.equal(final.voted,true);
 const row=f.db.prepare('SELECT * FROM draw_word_exclusions').get();
 assert.equal(countRows(f.db),1);assert.equal(row.word_id,word.id);assert.equal(row.title_key,normalize(word.title));assert.equal(row.required,required);
 assert.deepEqual(JSON.parse(row.electorate_json),players.map(player=>player.id));assert.deepEqual(JSON.parse(row.votes_json),players.slice(0,required).map(player=>player.id));
 assert.equal(row.result_id,id);assert.equal(row.game_run_id,room.gameRunId);
 assert.deepEqual(room.resultSnapshot(id),snapshot);assert.equal(f.store.isExcluded(word),true);
 const passedVersion=room.version;room.voteWordBan(players.at(-1).id,id);assert.equal(room.version,passedVersion);assert.equal(room.resultVote(id,players[0].id).votes,required);
 assert.ok(room.wordPools().builtin.every(item=>item.id!==word.id));
});

test('reveal electorate includes artist, offline and mid-round seats, but excludes later joins and departed seats',t=>{
 const {store}=database(t),{room,players}=game(store,3);room.choose(room.presenterId,room.candidates[0].id);
 players[1].lastSeen=0;const middle=room.add('本輪中途加入');assert.equal(middle.waitingForNextRound,true);
 const before=room.add('揭曉前離席');leavePlayer(room,before.id);room.reveal();const id=room.result.resultId;
 const late=room.add('揭曉後加入');assert.equal(room.resultVote(id,late.id).total,4);assert.equal(room.resultVote(id,late.id).required,3);
 for(const player of [...players,middle])assert.equal(room.resultVote(id,player.id).canVote,true);
 assert.equal(room.resultVote(id,late.id).canVote,false);assert.throws(()=>room.voteWordBan(late.id,id),{code:'DRAW_BAN_NOT_ELIGIBLE'});
 assert.throws(()=>room.voteWordBan(before.id,id),{code:'NOT_SEATED'});rejoinPlayer(room,before.id,'返回但無資格');assert.throws(()=>room.voteWordBan(before.id,id),{code:'DRAW_BAN_NOT_ELIGIBLE'});
 room.voteWordBan(players[1].id,id);leavePlayer(room,players[1].id);
 assert.equal(room.resultVote(id,players[0].id).votes,1);assert.equal(room.resultVote(id,players[0].id).total,4);assert.equal(room.resultVote(id,players[0].id).required,3);
 assert.throws(()=>room.voteWordBan(players[1].id,id),{code:'NOT_SEATED'});rejoinPlayer(room,players[1].id,'原席返回');
 const version=room.version;room.voteWordBan(players[1].id,id);assert.equal(room.version,version);assert.equal(room.resultVote(id,players[1].id).voted,true);
 room.kick(players[0].id,players[2].id);assert.throws(()=>room.voteWordBan(players[2].id,id),{code:'NOT_SEATED'});
 room.voteWordBan(players[0].id,id);assert.equal(room.resultVote(id,middle.id).banned,false);
 room.voteWordBan(middle.id,id);assert.equal(room.resultVote(id,middle.id).banned,true);assert.equal(room.resultVote(id,middle.id).total,4);
});

test('a recent result can receive its deciding vote in a new round and game without changing its immutable context',t=>{
 const {store}=database(t),{room,players}=game(store,2),first=reveal(room),snapshot=room.resultSnapshot(first.id),run=room.gameRunId;
 room.voteWordBan(players[0].id,first.id);room.next(players[0].id);const second=reveal(room);room.next(players[0].id);assert.equal(room.phase,'finished');
 room.start();assert.notEqual(room.gameRunId,run);assert.equal(room.round,1);
 room.voteWordBan(players[1].id,first.id);assert.equal(room.resultVote(first.id,players[1].id).banned,true);assert.equal(room.resultVote(second.id,players[1].id).banned,false);
 assert.deepEqual(room.resultSnapshot(first.id),snapshot);assert.equal(room.view(players[0].id).resultVotes.length,2);
});

test('unknown and unselected results cannot be voted, and the ninth reveal evicts the first ballot',t=>{
 const {store}=database(t),{room,players}=game(store,8);
 for(const id of [randomUUID(),room.gameRunId,room.canvas.epoch,room.candidates[0].id,undefined])assert.throws(()=>room.voteWordBan(players[0].id,id),{code:'DRAW_RESULT_NOT_FOUND'});
 assert.deepEqual(room.view(players[1].id).resultVotes,[]);
 room.reveal('未選題');const empty=room.result.resultId;assert.equal(room.resultVote(empty,players[0].id).canVote,false);
 assert.throws(()=>room.voteWordBan(players[0].id,empty),{code:'DRAW_WORD_NOT_SELECTED'});room.next(players[0].id);
 const ids=[];for(let i=1;i<8;i++){ids.push(reveal(room).id);room.next(players[0].id);}
 assert.equal(room.publicResults.size,8);assert.equal(room.resultVote(empty,players[0].id).votes,0);
 room.start();reveal(room);assert.equal(room.publicResults.size,8);assert.throws(()=>room.voteWordBan(players[0].id,empty),{code:'DRAW_RESULT_NOT_FOUND'});
 assert.equal(room.view(players[0].id).resultVotes.length,8);assert.equal(room.resultVote(ids[0],players[0].id).canVote,true);
 const view=JSON.stringify(room.view(players[1].id));assert.equal(view.includes('electorate'),false);assert.equal(view.includes('votes_json'),false);assert.equal(JSON.stringify(room).includes('ballot'),false);
});

test('SQLite failure does not consume the deciding vote or room version, and a retry persists exactly once',t=>{
 const f=database(t),{room,players}=game(f.store),{id}=reveal(room);room.voteWordBan(players[0].id,id);const version=room.version;
 f.db.exec("CREATE TRIGGER reject_word_ban BEFORE INSERT ON draw_word_exclusions BEGIN SELECT RAISE(ABORT,'fixture refuses write'); END");
 assert.throws(()=>room.voteWordBan(players[1].id,id),{code:'DRAW_BAN_UNAVAILABLE'});
 assert.equal(room.version,version);assert.equal(countRows(f.db),0);assert.deepEqual(room.resultVote(id,players[1].id),{resultId:id,votes:1,total:2,required:2,voted:false,canVote:true,banned:false});
 f.db.exec('DROP TRIGGER reject_word_ban');room.voteWordBan(players[1].id,id);room.voteWordBan(players[1].id,id);
 assert.equal(room.version,version+1);assert.equal(countRows(f.db),1);assert.equal(room.resultVote(id,players[1].id).votes,2);
});

test('soft exclusions cover builtin and custom titles, reject normalized reposts, and preserve the first audit across restart',t=>{
 const f=database(t),builtin=WORDS[0],duplicate=f.add(builtin.title),custom=f.add('Ａpple　 Pie'),originalAudit=audit();
 const first=f.store.ban(builtin,originalAudit);assert.equal(f.store.builtin().some(word=>word.id===builtin.id),false);assert.equal(f.store.list().some(word=>word.id===duplicate.id),false);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM draw_words').get().n,2);
 assert.equal(f.store.ban(duplicate,audit()).result_id,first.result_id);assert.equal(countRows(f.db),1);
 f.store.ban(custom,audit());assert.equal(f.store.isExcluded({id:randomUUID(),title:'  apple   pie '}),true);
 assert.throws(()=>f.add('apple pie'),{code:'DRAW_WORD_BANNED'});assert.equal(f.store.list().length,0);
 const second=openDatabase(f.file);try{
  const reopened=new DrawWordStore(second);assert.equal(reopened.isExcluded(builtin),true);assert.equal(reopened.isExcluded(custom),true);
  assert.deepEqual({...reopened.ban({...builtin,id:'replacement'},audit())},{...first});assert.equal(countRows(second),2);
  assert.ok(game(reopened).room.candidates.every(word=>word.id!==builtin.id));
 }finally{second.close();}
});

test('store rejects non-majority, duplicate, foreign, oversized and malformed audit electorates',t=>{
 const f=database(t),word=WORDS[0],valid=audit(4),outsider=randomUUID();
 const bad=[{...valid,votes:valid.votes.slice(0,2)},{...valid,required:2},{...valid,votes:[valid.votes[0],valid.votes[0],valid.votes[1]]},{...valid,votes:[...valid.votes.slice(0,2),outsider]},{...valid,electorate:[...valid.electorate,valid.electorate[0]]},audit(9),{...valid,resultId:'invalid'},{...valid,roomCode:'../bad'}];
 for(const record of bad)assert.throws(()=>f.store.ban(word,record),{code:'INVALID_WORD_BAN'});
 assert.equal(countRows(f.db),0);f.store.ban(word,valid);assert.equal(countRows(f.db),1);
});

test('schema 12 migrates without altering users or words, and reopening the current schema is idempotent',t=>{
 const root=tempRoot(t),file=path.join(root,'app.sqlite');t.after(()=>removeRoot(root));let db=openDatabase(file);
 db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run('retained-user','retained','保留玩家','exact-hash','member','2026-10-05T00:00:00.000Z');
 new DrawWordStore(db).add({id:'retained-user',display_name:'保留玩家'},{title:'保留題目',aliases:['原別名'],difficulty:'easy'});
 const beforeUsers=db.prepare('SELECT * FROM users').all(),beforeWords=db.prepare('SELECT * FROM draw_words').all();
 db.exec('DROP TABLE character_sounds; DROP TABLE draw_word_exclusions; PRAGMA user_version=12');db.close();db=openDatabase(file);
 try{
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);assert.equal(countRows(db),0);
  assert.deepEqual(db.prepare('SELECT * FROM users').all(),beforeUsers);assert.deepEqual(db.prepare('SELECT * FROM draw_words').all(),beforeWords);
  new DrawWordStore(db).ban(WORDS[0],audit());
 }finally{db.close();}
 db=openDatabase(file);try{assert.equal(countRows(db),1);assert.deepEqual(db.prepare('SELECT * FROM users').all(),beforeUsers);}finally{db.close();}
});

test('cross-room exclusions reject warm candidates, update same-version result votes, and leave active drawings intact',t=>{
 const f=database(t),a=game(f.store,2,'ABC123'),b=game(f.store,2,'ABC124'),c=game(f.store,2,'ABC125'),d=game(f.store,2,'ABC126');
 const picked=reveal(a.room),other=reveal(d.room);assert.equal(other.word.id,picked.word.id);
 c.room.choose(c.room.presenterId,picked.word.id);const drawingEpoch=c.room.canvas.epoch,version=d.room.version;
 a.players.forEach(player=>a.room.voteWordBan(player.id,picked.id));
 assert.equal(d.room.version,version);assert.equal(d.room.resultVote(other.id,d.players[0].id).banned,true);assert.equal(d.room.resultVote(other.id,d.players[0].id).votes,0);
 assert.ok(b.room.view(b.players[0].id).candidates.every(word=>word.id!==picked.word.id));
 assert.throws(()=>b.room.choose(b.room.presenterId,picked.word.id),{code:'DRAW_WORD_BANNED'});assert.equal(b.room.phase,'choosing');assert.ok(b.room.candidates.length>0);
 assert.ok(b.room.candidates.every(word=>!f.store.isExcluded(word)));b.room.choose(b.room.presenterId,b.room.candidates[0].id);assert.equal(b.room.phase,'drawing');
 assert.equal(c.room.question.id,picked.word.id);assert.equal(c.room.canvas.epoch,drawingEpoch);c.room.guess(c.players[1].id,picked.word.title);
 assert.equal(c.room.result.answer,picked.word.title);assert.equal(c.room.result.scores.find(row=>row.id===c.players[1].id).score,100);
});

test('automatic selection skips or redraws banned warm candidates',t=>{
 const f=database(t),one=game(f.store),all=game(f.store,2,'ABC124');
 const first=one.room.candidates[0];f.store.ban(first,audit());one.advance(15001);assert.equal(one.room.auto(),true);assert.equal(one.room.phase,'drawing');assert.notEqual(one.room.question.id,first.id);
 for(const word of all.room.candidates)f.store.ban(word,audit());all.advance(15001);assert.equal(all.room.auto(),true);assert.equal(all.room.phase,'drawing');assert.equal(f.store.isExcluded(all.room.question),false);
});

test('an exhausted custom-only pool ends both new-round and warm choosing paths without publishing an unselected answer',t=>{
 const f=database(t);f.add('唯一自訂題');const a=game(f.store,2,'ABC123',true),b=game(f.store,2,'ABC124',true),c=game(f.store,2,'ABC125',true),chosen=b.room.candidates[0].id;
 const {id}=reveal(a.room),snapshot=a.room.resultSnapshot(id);a.players.forEach(player=>a.room.voteWordBan(player.id,id));a.room.next(a.players[0].id);
 assert.equal(a.room.phase,'finished');assert.equal(a.room.round,1);assert.match(a.room.winner.reason,/沒有可用題目/);assert.deepEqual(a.room.resultSnapshot(id),snapshot);assert.equal(a.room.result.resultId,id);
 assert.throws(()=>a.room.start(),/還沒有題目/);
 b.advance(15001);assert.equal(b.room.auto(),true);assert.equal(b.room.phase,'finished');assert.equal(b.room.result,null);assert.deepEqual(b.room.view(b.players[1].id).recentResults,[]);
 assert.throws(()=>c.room.choose(c.room.presenterId,chosen),{code:'DRAW_WORD_BANNED'});assert.equal(c.room.phase,'finished');assert.equal(c.room.result,null);
});

test('history preflight blocks an unrecordable deciding vote and ballot/stroke snapshots stay out of vote traces',t=>{
 const f=database(t),{room,players}=game(f.store),history=new HistoryStore(path.join(f.root,'history'));
 t.after(()=>history.close());history.attach(room);const {id}=reveal(room);
 const vote=player=>history.transact(room,{action:'draw-word-ban',source:'player',actor:player.id,input:{resultId:id}},()=>room.voteWordBan(player.id,id));
 vote(players[0]);const version=room.version;history.limits.maxTotalBytes=1;
 assert.throws(()=>vote(players[1]),{code:'HISTORY_QUOTA'});assert.equal(room.version,version);assert.equal(countRows(f.db),0);assert.equal(room.resultVote(id,players[1].id).votes,1);
 const rows=fs.readdirSync(history.dir).filter(name=>name.endsWith('.jsonl')).flatMap(name=>fs.readFileSync(path.join(history.dir,name),'utf8').trim().split('\n').map(JSON.parse));
 const votes=rows.filter(row=>row.operation?.action==='draw-word-ban');assert.equal(votes.length,2);const encoded=JSON.stringify(votes);
 for(const forbidden of ['electorate','votes_json','ballot','publicResults','strokeSnapshot'])assert.equal(encoded.includes(forbidden),false);
});

async function httpFixture(t){
 const root=tempRoot(t),config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false};
 const db=openDatabase(config.dbFile),auth=createAuth(db),users={};
 try{
  users.host=await auth.bootstrap('ban_host','word-ban-password');const hash=db.prepare('SELECT password_hash FROM users WHERE id=?').get(users.host).password_hash;
  for(const who of ['guest','middle','late','outsider']){users[who]=randomUUID();db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(users[who],'ban_'+who,who,hash,'member',new Date().toISOString());}
 }finally{db.close();}
 let app=createApp(config),base,cookies={};
 t.after(async()=>{await app.close();removeRoot(root);});
 async function listen(){base='http://127.0.0.1:'+(await app.listen()).port;}await listen();
 const request=async(route,who,{method='GET',data,headers={}}={})=>{
  const response=await fetch(base+'/api/'+route,{method,headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 const post=(route,who,data,headers)=>request(route,who,{method:'POST',data,headers});
 for(const who of Object.keys(users)){const login=await post('auth/login',null,{username:'ban_'+who,password:'word-ban-password'});assert.equal(login.status,200);cookies[who]=login.cookie;}
 async function create(customOnly=false){const created=await post('create','host',{type:'draw'});assert.equal(created.status,200);const code=created.body.code;
  if(customOnly)assert.equal((await post('settings','host',{code,seconds:90,topics:['custom']})).status,200);
  assert.equal((await post('join','guest',{code})).status,200);assert.equal((await post('start','host',{code})).status,200);return code;
 }
 const state=(code,who='host')=>request('state?code='+code,who);
 const vote=(code,resultId,who='host')=>post('draw/result/ban',who,{code,resultId});
 async function revealHttp(code,middle=false){const choosing=(await state(code)).body,word=choosing.candidates[0];assert.ok(word);
  assert.equal((await post('action','host',{code,action:'choose',questionId:word.id})).status,200);
  if(middle)assert.equal((await post('join','middle',{code})).status,200);
  assert.equal((await post('action','guest',{code,action:'guess',answer:word.title})).status,200);
  const shown=(await state(code)).body;assert.equal(shown.phase,'reveal');return {id:shown.result.resultId,word,shown};
 }
 return {root,config,users,post,request,create,state,vote,reveal:revealHttp,restart:async()=>{await app.close();app=createApp(config);await listen();}};
}

test('HTTP ban authenticates active seats, freezes mid-round eligibility, denies late and kicked users, and is idempotent across concurrent retries',async t=>{
 const f=await httpFixture(t),code=await f.create(),before=(await f.state(code)).body;
 assert.equal((await f.vote(code,before.canvasEpoch)).body.code,'DRAW_RESULT_NOT_FOUND');assert.deepEqual((await f.state(code,'guest')).body.resultVotes,[]);
 const {id,shown}=await f.reveal(code,true);assert.equal(shown.resultVotes[0].total,3);assert.equal(shown.resultVotes[0].required,2);
 assert.equal((await f.vote(code,id,null)).status,401);assert.equal((await f.vote(code,id,'outsider')).body.code,'NOT_SEATED');
 assert.equal((await f.request('draw/result/ban?code='+code+'&resultId='+id,'host')).status,405);
 assert.equal((await f.post('draw/result/ban','host',{code,resultId:id},{Origin:'https://untrusted.example'})).status,400);
 assert.equal((await f.post('draw/result/ban','host',{code,resultId:id,extra:'x'.repeat(9000)})).status,413);
 const unrelated=await f.post('create','outsider',{type:'draw'});assert.equal((await f.vote(unrelated.body.code,id,'outsider')).body.code,'DRAW_RESULT_NOT_FOUND');
 const otherGame=await f.post('create','outsider',{type:'majority'});assert.equal((await f.vote(otherGame.body.code,id,'outsider')).body.code,'WRONG_GAME');
 assert.equal((await f.post('join','late',{code})).status,200);assert.equal((await f.vote(code,id,'late')).body.code,'DRAW_BAN_NOT_ELIGIBLE');
 const first=await f.vote(code,id);assert.equal(first.status,200);assert.equal(first.body.resultVotes[0].votes,1);assert.equal(first.body.resultVotes[0].banned,false);
 assert.ok(first.body.players.length);assert.ok(first.body.recentResults.length);assert.equal(first.body.code,code);
 assert.equal((await f.post('leave','host',{code})).status,200);assert.equal((await f.vote(code,id)).body.code,'NOT_SEATED');
 assert.equal((await f.post('join','host',{code})).status,200);const rejoined=(await f.state(code)).body;assert.equal(rejoined.me,shown.me);assert.equal(rejoined.resultVotes[0].voted,true);
 assert.equal((await f.vote(code,id)).body.resultVotes[0].votes,1);
 const retries=await Promise.all([f.vote(code,id,'middle'),f.vote(code,id,'middle')]);assert.ok(retries.every(response=>response.status===200));assert.ok(retries.every(response=>response.body.resultVotes[0].votes===2&&response.body.resultVotes[0].banned));assert.equal(retries[0].body.version,retries[1].body.version);
 const middle=(await f.state(code,'middle')).body.me;assert.equal((await f.post('kick','guest',{code,playerId:middle,confirmed:true})).status,200);
 assert.equal((await f.vote(code,id,'middle')).body.code,'KICKED');assert.equal((await f.state(code)).body.resultVotes[0].total,3);assert.equal((await f.state(code)).body.resultVotes[0].votes,2);
 const db=new DatabaseSync(f.config.dbFile);try{assert.equal(countRows(db),1);}finally{db.close();}
});

test('HTTP final-write failure is retriable and successful bans disappear from the global catalog and survive server restart',async t=>{
 const f=await httpFixture(t),word=await f.post('draw/words','host',{title:'跨站永久停用測試',aliases:[],difficulty:'easy',topic:'misc'});assert.equal(word.status,200);
 const code=await f.create(true),{id}=await f.reveal(code);assert.equal((await f.vote(code,id)).status,200);
 const db=new DatabaseSync(f.config.dbFile);try{
  db.exec("CREATE TRIGGER reject_http_ban BEFORE INSERT ON draw_word_exclusions BEGIN SELECT RAISE(ABORT,'fixture write failure'); END");
  const failed=await f.vote(code,id,'guest');assert.equal(failed.status,503);assert.equal(failed.body.code,'DRAW_BAN_UNAVAILABLE');assert.equal(countRows(db),0);
  const after=(await f.state(code,'guest')).body.resultVotes[0];assert.equal(after.votes,1);assert.equal(after.voted,false);assert.equal(after.canVote,true);
  db.exec('DROP TRIGGER reject_http_ban');assert.equal((await f.vote(code,id,'guest')).body.resultVotes[0].banned,true);assert.equal(countRows(db),1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM draw_words WHERE id=?').get(word.body.id).n,1);
 }finally{db.close();}
 assert.equal((await f.request('draw/words','guest')).body.custom.some(item=>item.id===word.body.id),false);
 assert.equal((await f.post('draw/words','guest',{title:'跨站永久停用測試',aliases:[],difficulty:'easy'})).body.code,'DRAW_WORD_BANNED');
 const next=await f.post('action','host',{code,action:'next'});assert.equal(next.body.phase,'finished');assert.equal(next.body.recentResults[0].resultId,id);
 await f.restart();assert.equal((await f.request('draw/words','guest')).body.custom.some(item=>item.id===word.body.id),false);
 const created=await f.post('create','host',{type:'draw'}),newCode=created.body.code;
 assert.equal((await f.post('settings','host',{code:newCode,seconds:90,topics:['custom']})).status,200);assert.equal((await f.post('join','guest',{code:newCode})).status,200);
 const start=await f.post('start','host',{code:newCode});assert.equal(start.status,400);assert.match(start.body.error,/還沒有題目/);
 const rows=fs.readdirSync(f.config.historyDir).filter(name=>name.endsWith('.jsonl')).flatMap(name=>fs.readFileSync(path.join(f.config.historyDir,name),'utf8').trim().split('\n').map(JSON.parse));
 assert.ok(rows.some(row=>row.operation?.action==='draw-word-ban'&&row.kind==='result'&&row.ok===true));
 const recorded=JSON.stringify(rows.filter(row=>row.operation?.action==='draw-word-ban'));
 for(const secret of ['electorate_json','votes_json','publicResults','ballot'])assert.equal(recorded.includes(secret),false);
});

test('HTTP votes retain the per-account mutation rate limit, including idempotent retries',async t=>{
 const f=await httpFixture(t),code=await f.create(),{id}=await f.reveal(code);let attempts=0,response;
 do{response=await f.vote(code,id);attempts++;}while(response.status===200&&attempts<=121);
 assert.equal(response.status,429);assert.ok(attempts<=121);assert.equal((await f.state(code)).body.resultVotes[0].votes,1);
});
