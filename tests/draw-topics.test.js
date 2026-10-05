const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {WORDS,TOPICS,topicLabels}=require('../src/games/draw-guess-words');
const {DrawWordStore,validateWord}=require('../src/games/draw-guess-store');
const {openDatabase,SCHEMA_VERSION}=require('../src/db/index');

test('all 1000 drawing words are unique, drawable-length prompts in nine thematic categories',()=>{
 assert.equal(WORDS.length,1000);
 assert.equal(TOPICS.length,9);
 assert.equal(new Set(TOPICS.map(topic=>topic.id)).size,9);
 const {normalize}=require('../src/games/draw-guess');
 assert.equal(new Set(WORDS.map(word=>normalize(word.title))).size,1000);
 assert.equal(new Set(WORDS.map(word=>word.id)).size,1000);
 for(const word of WORDS){
  assert.ok(TOPICS.some(topic=>topic.id===word.topic),word.title);
  assert.equal(word.topicLabel,topicLabels[word.topic]);
  assert.ok(['簡單','一般','挑戰'].includes(word.category));
  assert.ok([...word.title].length>0&&[...word.title].length<=24,word.title);
  assert.ok(word.aliases.length<=5&&word.aliases.every(alias=>[...alias].length<=24),word.title);
  assert.equal(new Set([word.title,...word.aliases].map(normalize)).size,word.aliases.length+1,word.title);
 }
 for(const topic of TOPICS)assert.ok(WORDS.filter(word=>word.topic===topic.id).length>=3,topic.id);
});

test('all original 120 word identities, aliases and category metadata stay byte-for-byte compatible',()=>{
 const {createHash}=require('node:crypto'),legacy=WORDS.filter(word=>/^builtin-(easy|medium|hard)-\d+$/.test(word.id));
 assert.equal(legacy.length,120);
 assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),'1259e50c1a00a7364b1ca93874bbca61932862ff6871bbb4b906f8d0bab64082');
});

test('meme is a selectable builtin category while custom submissions remain an independent source',()=>{
 const {DrawGuessRoom,validTopic,validTopics}=require('../src/games/draw-guess');
 assert.ok(validTopic('meme'));assert.ok(validTopics(['meme','custom']));
 const memes=WORDS.filter(word=>word.topic==='meme');assert.equal(memes.length,100);
 assert.equal(memes.filter(word=>word.memeKind==='template').length,50);assert.equal(memes.filter(word=>word.memeKind==='original').length,50);
 const room=new DrawGuessRoom('MEME12','迷因試玩',n=>n-1),host=room.add('甲');room.add('乙');
 room.wordProvider=()=>[{id:'shared-food',title:'自訂食物',topic:'food',custom:true},{id:'shared-meme',title:'自訂迷因',topic:'meme',custom:true}];
 room.configure(host.id,{seconds:90,topics:['meme']});room.start();assert.ok(room.candidates.every(word=>word.topic==='meme'&&!word.custom));
 room.choose(host.id,room.candidates[0].id);assert.equal(room.view(room.players[1].id).question,null);assert.equal(room.view(room.players[1].id).hint.topicLabel,'迷因 Meme');
 const old=new DrawGuessRoom('OLD123','舊客戶端',n=>n-1),owner=old.add('甲');old.add('乙');old.wordProvider=room.wordProvider;
 old.configure(owner.id,{seconds:90,topic:'meme',customPercent:100});old.start();assert.equal(old.candidates[0].id,'shared-meme');
});

test('SQLite v9 custom words migrate to misc without losing their difficulty or aliases',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bga-draw-topic-migrate-')),file=path.join(dir,'app.sqlite');
 let db;
 try{
  db=new DatabaseSync(file);
  db.exec(`
   CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT NOT NULL);
   CREATE TABLE user_artworks(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE draw_words(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id),author_name TEXT NOT NULL,title TEXT NOT NULL,title_key TEXT NOT NULL UNIQUE,aliases TEXT NOT NULL,difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard')),category TEXT NOT NULL,created_at TEXT NOT NULL);
   INSERT INTO users VALUES('u1','朋友');
   INSERT INTO draw_words VALUES('shared-old','u1','朋友','舊投稿','舊投稿','["別名"]','medium','一般','2026-01-01T00:00:00.000Z');
   PRAGMA user_version=9;
  `);
  db.close();db=openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  const stored=new DrawWordStore(db).list()[0];
  assert.equal(stored.topic,'misc');assert.equal(stored.topicLabel,'綜合');
  assert.equal(stored.category,'一般');assert.deepEqual(stored.aliases,['別名']);
  db.exec('PRAGMA user_version=9');db.close();db=openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  assert.equal(db.prepare('PRAGMA table_info(draw_words)').all().filter(column=>column.name==='topic').length,1);
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('new custom words save a topic and reject unrecognized topic IDs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bga-draw-topic-store-')),file=path.join(dir,'app.sqlite');
 let db;
 try{
  db=openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)")
   .run('u1','draw-friend','朋友','unused','member','2026-01-01T00:00:00.000Z');
  const store=new DrawWordStore(db),user={id:'u1',display_name:'朋友'};
  const saved=store.add(user,{title:'草莓蛋糕',aliases:['莓果蛋糕'],difficulty:'easy',topic:'food'});
  assert.equal(saved.topicLabel,'食物飲料');
  assert.equal(store.list()[0].topic,'food');
  assert.equal(validateWord({title:'舊客戶端題目',aliases:[],difficulty:'hard'}).topic,'misc');
  assert.throws(()=>validateWord({title:'壞題目',aliases:[],difficulty:'easy',topic:'__proto__'}),/題材/);
  const meme=store.add(user,{title:'我的原創迷因',aliases:['我的梗圖'],difficulty:'hard',topic:'meme'});
  assert.equal(meme.topicLabel,'迷因 Meme');assert.equal(store.list().find(word=>word.id===meme.id).topic,'meme');
 }finally{db?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
