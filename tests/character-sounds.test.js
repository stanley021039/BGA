const {legacyMarketSchema}=require('./helpers/market-legacy-schema.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {openDatabase,SCHEMA_VERSION}=require('../src/db');
const {MAX_SOUND_BYTES,inspectExpressionSound,setExpressionSound,removeExpressionSound}=require('../src/profiles/sounds');
const {characterFor,selectedImage}=require('../src/profiles/appearance');
const {setExpression}=require('../src/profiles/uploads');

const owner='11111111-1111-1111-1111-111111111111',peer='22222222-2222-2222-2222-222222222222';
const character='33333333-3333-3333-3333-333333333333',emote='emote-44444444-4444-4444-4444-444444444444';
const png=fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png'));
function wav(samples=24){
 const bytes=Buffer.alloc(44+samples*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
 return bytes;
}
function setup(t){
 const db=openDatabase(':memory:');t.after(()=>db.close());
 for(const [id,name] of [[owner,'artist'],[peer,'peer']])db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,'synthetic-hash','member','test')").run(id,name,name);
 db.prepare("INSERT INTO player_characters(id,owner_id,name,created_at) VALUES(?,?,'test','test')").run(character,owner);
 for(const expression of ['neutral','happy',emote])db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?)').run(character,expression,'image/png',png);
 return db;
}
const upload=bytes=>({base64:bytes.toString('base64')});
const fails=(run,code,status=400)=>assert.throws(run,error=>error.code===code&&error.status===status);

test('canonical mono PCM WAV duration comes from its samples including the exact ten-second boundary',()=>{
 const tiny=inspectExpressionSound(wav(1));assert.equal(tiny.durationMs,1);assert.equal(tiny.mime,'audio/wav');
 assert.equal(inspectExpressionSound(wav(25)).durationMs,2);
 const full=wav(240000),sound=inspectExpressionSound(full);
 assert.equal(full.length,MAX_SOUND_BYTES);assert.equal(sound.durationMs,10000);assert.deepEqual(sound.bytes,full);
 assert.equal(inspectExpressionSound(new Uint8Array(wav())).durationMs,1);
 fails(()=>inspectExpressionSound(wav(240001)),'INVALID_EXPRESSION_SOUND');
});

test('WAV parser rejects forged lengths, chunks, encodings and empty or odd sample bodies',()=>{
 const changes=[
  bytes=>bytes.writeUInt32LE(bytes.length,4),bytes=>bytes.write('MP3 ',0),bytes=>bytes[0]|=128,
  bytes=>bytes.write('WEBP',8),bytes=>bytes.write('JUNK',12),bytes=>bytes.writeUInt32LE(18,16),
  bytes=>bytes.writeUInt16LE(3,20),bytes=>bytes.writeUInt16LE(2,22),bytes=>bytes.writeUInt32LE(48000,24),
  bytes=>bytes.writeUInt32LE(96000,28),bytes=>bytes.writeUInt16LE(4,32),bytes=>bytes.writeUInt16LE(8,34),
  bytes=>bytes.write('LIST',36),bytes=>bytes.writeUInt32LE(2,40)
 ];
 for(const change of changes){const bytes=wav();change(bytes);fails(()=>inspectExpressionSound(bytes),'INVALID_EXPRESSION_SOUND');}
 for(const input of [null,{},'RIFF',Buffer.alloc(0),wav(0),wav().subarray(0,43),Buffer.concat([wav(),Buffer.from([0])])])fails(()=>inspectExpressionSound(input),'INVALID_EXPRESSION_SOUND');
 const odd=Buffer.concat([wav(),Buffer.from([0])]);odd.writeUInt32LE(odd.length-8,4);odd.writeUInt32LE(odd.length-44,40);
 fails(()=>inspectExpressionSound(odd),'INVALID_EXPRESSION_SOUND');
 // A short declared body cannot hide an oversized body or its true duration.
 const oversized=wav(240001);oversized.writeUInt32LE(48,40);oversized.writeUInt32LE(84,4);
 fails(()=>inspectExpressionSound(oversized),'INVALID_EXPRESSION_SOUND');
});

test('only an enabled owner may attach audio to an existing non-neutral expression',t=>{
 const db=setup(t),body=upload(wav());
 for(const expression of ['neutral','sad','emote-55555555-5555-5555-5555-555555555555','constructor','happy/extra'])fails(()=>setExpressionSound(db,owner,character,expression,body),'INVALID_EXPRESSION');
 fails(()=>setExpressionSound(db,peer,character,'happy',body),'CHARACTER_NOT_FOUND',404);
 fails(()=>setExpressionSound(db,owner,'55555555-5555-5555-5555-555555555555','happy',body),'CHARACTER_NOT_FOUND',404);
 for(const expression of ['happy',emote])assert.equal(setExpressionSound(db,owner,character,expression,body).durationMs,1);
 db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(owner);
 fails(()=>setExpressionSound(db,owner,character,'happy',body),'CHARACTER_NOT_FOUND',404);
});

test('uploads require strict canonical base64 and retain prior audio after a rejected replacement',t=>{
 const db=setup(t),bytes=wav(25),body=upload(bytes);
 setExpressionSound(db,owner,character,'happy',body);
 for(const invalid of [undefined,null,{}, {base64:''},{base64:42},{base64:'!!!!'}, {base64:body.base64+'\n'}, {base64:body.base64.replace(/=+$/,'')},{base64:'data:audio/wav;base64,'+body.base64},upload(wav(240001)),upload(Buffer.from('RIFF fake'))])fails(()=>setExpressionSound(db,owner,character,'happy',invalid),'INVALID_EXPRESSION_SOUND');
 assert.deepEqual(Buffer.from(db.prepare('SELECT bytes FROM character_sounds').get().bytes),bytes);
 // Claims about duration and MIME do not override the canonical sample body.
 const result=setExpressionSound(db,owner,character,'happy',{...upload(wav(240000)),durationMs:1,mime:'audio/mpeg'});
 assert.equal(result.durationMs,10000);
 assert.equal(db.prepare('SELECT count(*) AS n FROM character_sounds').get().n,1);
});

test('gallery and selected expression expose audio metadata without bytes or another expression clip',t=>{
 const db=setup(t),metadata=setExpressionSound(db,owner,character,emote,upload(wav(25))),id='user:'+character;
 assert.deepEqual(metadata,{url:`/assets/characters/sounds/${character}/${emote}`,durationMs:2});
 const own=characterFor(db,owner,id);assert.deepEqual(own.sounds,{[emote]:metadata});
 assert.equal(characterFor(db,peer,id),null);
 db.prepare('UPDATE player_characters SET shared=1 WHERE id=?').run(character);
 assert.deepEqual(characterFor(db,peer,id).sounds,{[emote]:metadata});
 assert.deepEqual(selectedImage(db,peer,{version:5,characterId:id,expression:emote}).sound,metadata);
 assert.equal(Object.hasOwn(selectedImage(db,peer,{version:5,characterId:id,expression:'happy'}),'sound'),false);
 assert.equal(Object.hasOwn(selectedImage(db,peer,{version:5,characterId:id,expression:'sad'}),'sound'),false);
});

test('image replacement retains its sound; owner removal is idempotent; expression and character deletion cascade',t=>{
 const db=setup(t),bytes=wav(25);
 setExpressionSound(db,owner,character,'happy',upload(bytes));
 setExpression(db,owner,character,{expression:'happy',base64:png.toString('base64')});
 assert.deepEqual(Buffer.from(db.prepare("SELECT bytes FROM character_sounds WHERE expression='happy'").get().bytes),bytes);
 fails(()=>removeExpressionSound(db,peer,character,'happy'),'CHARACTER_NOT_FOUND',404);
 fails(()=>removeExpressionSound(db,owner,character,'neutral'),'INVALID_EXPRESSION');
 assert.deepEqual(removeExpressionSound(db,owner,character,'happy'),{ok:true});
 assert.deepEqual(removeExpressionSound(db,owner,character,'happy'),{ok:true});
 setExpressionSound(db,owner,character,'happy',upload(bytes));setExpressionSound(db,owner,character,emote,upload(bytes));
 db.prepare('DELETE FROM character_images WHERE character_id=? AND expression=?').run(character,emote);
 assert.equal(db.prepare('SELECT count(*) AS n FROM character_sounds').get().n,1);
 db.prepare('DELETE FROM player_characters WHERE id=?').run(character);
 assert.equal(db.prepare('SELECT count(*) AS n FROM character_sounds').get().n,0);
});

test('current schema constrains stored MIME, duration, uniqueness and expression foreign keys',t=>{
 const db=setup(t),insert=db.prepare('INSERT INTO character_sounds(character_id,expression,mime,bytes,duration_ms) VALUES(?,?,?,?,?)');
 for(const duration of [0,10001,1.5])assert.throws(()=>insert.run(character,'happy','audio/wav',wav(),duration),/CHECK constraint failed/);
 assert.throws(()=>insert.run(character,'happy','audio/mpeg',wav(),1),/CHECK constraint failed/);
 assert.throws(()=>insert.run(character,'sad','audio/wav',wav(),1),/FOREIGN KEY constraint failed/);
 insert.run(character,'happy','audio/wav',wav(),1);
 assert.throws(()=>insert.run(character,'happy','audio/wav',wav(),1),/UNIQUE constraint failed/);
 assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
});

test('schema thirteen upgrades once without altering accounts or existing character images',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-sound-migration-')),file=path.join(root,'app.sqlite');
 let db;
 try{
  db=openDatabase(file);
  db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,appearance,created_at) VALUES(?,'artist','Original name','synthetic-hash','admin',?,'original-time')").run(owner,JSON.stringify({version:5,characterId:'user:'+character,expression:'happy'}));
  db.prepare("INSERT INTO player_characters(id,owner_id,name,created_at,shared) VALUES(?,?,'original-character','original-time',1)").run(character,owner);
  db.prepare("INSERT INTO character_images(character_id,expression,mime,bytes,label) VALUES(?,'happy','image/png',?,'Original label')").run(character,png);
  const account=db.prepare('SELECT * FROM users').get(),image=db.prepare('SELECT * FROM character_images').get();
  legacyMarketSchema(db);db.exec('DROP TABLE character_sounds; PRAGMA user_version=13');db.close();db=openDatabase(file);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,SCHEMA_VERSION);
  assert.equal(db.prepare('SELECT count(*) AS n FROM character_sounds').get().n,0);
  assert.deepEqual(db.prepare('SELECT * FROM users').get(),account);assert.deepEqual(db.prepare('SELECT * FROM character_images').get(),image);
  setExpressionSound(db,owner,character,'happy',upload(wav(25)));db.close();db=openDatabase(file);
  assert.equal(db.prepare('SELECT duration_ms FROM character_sounds').get().duration_ms,2);
  assert.deepEqual(db.prepare('SELECT * FROM users').get(),account);assert.deepEqual(db.prepare('SELECT * FROM character_images').get(),image);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{db?.close();assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});}
});
