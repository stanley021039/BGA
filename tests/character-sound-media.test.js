const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openDatabase}=require('../src/db');
const {setExpressionSound,removeExpressionSound}=require('../src/profiles/sounds');
const {createCharacterMediaAccess,USER_SOUND_PATH}=require('../src/profiles/media');
const {createLobby}=require('../src/rooms/lobby');

const owner='11111111-1111-1111-1111-111111111111',viewer='22222222-2222-2222-2222-222222222222';
const outsider='33333333-3333-3333-3333-333333333333',wearer='44444444-4444-4444-4444-444444444444';
const character='55555555-5555-5555-5555-555555555555';
function wav(samples=240){
 const bytes=Buffer.alloc(44+samples*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);
 bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
 return bytes;
}
function setup(t){
 const db=openDatabase(':memory:');t.after(()=>db.close());
 for(const [id,name] of [[owner,'artist'],[viewer,'viewer'],[outsider,'outsider'],[wearer,'wearer']])db.prepare("INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,'synthetic-hash','member','test')").run(id,name,name);
 db.prepare("INSERT INTO player_characters(id,owner_id,name,created_at) VALUES(?,?,'test','test')").run(character,owner);
 for(const expression of ['neutral','happy','sad'])db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?)').run(character,expression,'image/png',Buffer.from('synthetic-image'));
 db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'user:'+character,expression:'happy'}),owner);
 const clip=setExpressionSound(db,owner,character,'happy',{base64:wav().toString('base64')});
 const other=setExpressionSound(db,owner,character,'sad',{base64:wav(480).toString('base64')});
 let time=1000;
 const events=[],members=new Set([owner,viewer,outsider,wearer]),audience={id:'room:a',userIds:members,expressions:events};
 const audiences=new Map([[viewer,[audience]],[outsider,[audience]]]);
 const access=createCharacterMediaAccess(db,userId=>audiences.get(userId)||[],()=>time);
 const sound={...clip,url:access.broadcastSound(clip.url)},image=access.broadcastImage(`/assets/characters/user/${character}/happy`);
 const event={userId:owner,image,at:1000,until:6000,sound,soundUntil:11000};events.push(event);
 return {db,access,clip,other,sound,event,events,members,audience,audiences,setTime:value=>{time=value;}};
}

test('sound URLs are versioned by bytes, with author and shared access independent of room grants',t=>{
 const {db,access,clip,sound}=setup(t);
 assert.ok(USER_SOUND_PATH.test(clip.url));assert.match(sound.url,/\?v=[a-f0-9]{64}$/);
 assert.equal(access.sound(owner,clip.url).duration_ms,10);assert.ok(access.sound(owner,sound.url));
 assert.equal(access.sound(viewer,clip.url),null);assert.equal(access.sound(viewer,sound.url),null);
 db.prepare('UPDATE player_characters SET shared=1 WHERE id=?').run(character);
 assert.ok(access.sound(viewer,clip.url));assert.ok(access.sound(outsider,sound.url));
 assert.equal(access.sound(owner,clip.url+'?v='+'0'.repeat(64)),null);
 assert.equal(access.sound(viewer,`/assets/characters/sounds/${character}/neutral`),null);
 assert.equal(access.sound(viewer,`/assets/characters/user/${character}/happy`),null);
 assert.throws(()=>access.broadcastSound(`/assets/characters/sounds/${character}/angry`),error=>error.code==='SOUND_NOT_FOUND'&&error.status===404);
});

test('same-room saved appearances and live events do not expose audio until a viewer receives that clip',t=>{
 const {access,clip,other,event}=setup(t);
 // Images keep the existing saved-avatar behavior; sounds need a receipt.
 assert.ok(access.image(viewer,event.image));assert.equal(access.sound(viewer,clip.url),null);
 access.rememberExpressions(viewer,'room:a',[{...event,sound:undefined}]);assert.equal(access.sound(viewer,clip.url),null);
 access.rememberExpressions(viewer,'room:a',[event]);assert.ok(access.sound(viewer,event.sound.url));assert.ok(access.sound(viewer,clip.url));
 assert.equal(access.sound(outsider,event.sound.url),null);assert.equal(access.sound(viewer,other.url),null);
 access.rememberExpressions(outsider,'room:b',[event]);assert.equal(access.sound(outsider,event.sound.url),null);
});

test('sound grants last through ten seconds plus fetch grace without being extended by repeated views',t=>{
 const {access,clip,event,events,setTime}=setup(t);
 access.rememberExpressions(viewer,'room:a',[event]);setTime(6001);events.length=0;
 assert.ok(access.sound(viewer,clip.url));assert.equal(access.sound(outsider,clip.url),null);
 setTime(11001);access.rememberExpressions(viewer,'room:a',[{...event,soundUntil:999999}]);assert.ok(access.sound(viewer,clip.url));
 setTime(12999);assert.ok(access.sound(viewer,clip.url));
 setTime(13000);assert.equal(access.sound(viewer,clip.url),null);
 access.rememberExpressions(viewer,'room:a',[event]);assert.equal(access.sound(viewer,clip.url),null);
});

test('a view selected before expiry may record its original sound after the image has expired',t=>{
 const {db,access,clip,event,events,setTime}=setup(t);
 db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'user:'+character,expression:'neutral'}),owner);
 const delivered=[{...event}];setTime(8000);events.length=0;
 access.rememberExpressions(viewer,'room:a',delivered);
 assert.ok(access.sound(viewer,clip.url));assert.equal(access.image(viewer,event.image),null);
 setTime(13000);assert.equal(access.sound(viewer,clip.url),null);
});

test('replacement and removal revoke old sound URLs and cannot let an old event reveal new bytes',t=>{
 const {db,access,clip,event}=setup(t);
 access.rememberExpressions(viewer,'room:a',[event]);assert.ok(access.sound(viewer,event.sound.url));
 setExpressionSound(db,owner,character,'happy',{base64:wav(481).toString('base64')});
 assert.equal(access.sound(viewer,event.sound.url),null);assert.equal(access.sound(owner,event.sound.url),null);assert.equal(access.sound(viewer,clip.url),null);
 assert.deepEqual(Buffer.from(access.sound(owner,clip.url).bytes),wav(481));
 const changed={...event,sound:{...clip,url:access.broadcastSound(clip.url)}};
 access.rememberExpressions(viewer,'room:a',[changed]);assert.ok(access.sound(viewer,changed.sound.url));
 removeExpressionSound(db,owner,character,'happy');assert.equal(access.sound(viewer,changed.sound.url),null);assert.equal(access.sound(owner,clip.url),null);
});

test('sound permission follows its original audience and revokes when either viewer or sender leaves',t=>{
 const {access,event,clip,members,audience,audiences}=setup(t);
 access.rememberExpressions(viewer,'room:a',[event]);assert.ok(access.sound(viewer,clip.url));
 audience.id='room:b';assert.equal(access.sound(viewer,clip.url),null);
 audience.id='room:a';members.delete(viewer);assert.equal(access.sound(viewer,clip.url),null);
 members.add(viewer);members.delete(owner);assert.equal(access.sound(viewer,clip.url),null);
 members.add(owner);assert.ok(access.sound(viewer,clip.url));
 audiences.set(viewer,[{id:'lobby',userIds:members,expressions:[event]}]);assert.equal(access.sound(viewer,clip.url),null);
});

test('disabled authors and disabled shared-character senders invalidate delivered audio',t=>{
 const {db,access,event,clip}=setup(t);
 access.rememberExpressions(viewer,'room:a',[event]);assert.ok(access.sound(viewer,clip.url));
 db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(owner);
 assert.equal(access.sound(viewer,clip.url),null);assert.equal(access.sound(owner,clip.url),null);
 db.prepare('UPDATE users SET disabled=0 WHERE id=?').run(owner);
 // This sender picked the shared character; revoking sharing resets their
 // appearance but does not itself erase an already-delivered event receipt.
 db.prepare('UPDATE player_characters SET shared=1 WHERE id=?').run(character);
 db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'user:'+character,expression:'neutral'}),wearer);
 const wearerEvent={...event,userId:wearer};access.rememberExpressions(outsider,'room:a',[wearerEvent]);
 db.prepare('UPDATE player_characters SET shared=0 WHERE id=?').run(character);
 db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({version:5,characterId:'builtin:traveler',expression:'neutral'}),wearer);
 assert.ok(access.sound(outsider,clip.url));
 db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(wearer);
 assert.equal(access.sound(outsider,clip.url),null);
});

test('private lobby sound fetches do not enter or extend presence and require actual receipt',t=>{
 const {db,clip}=setup(t);let time=1000;
 const lobby=createLobby(()=>time),users=new Map([[owner,{id:owner,display_name:'owner'}],[viewer,{id:viewer,display_name:'viewer'}],[outsider,{id:outsider,display_name:'outsider'}]]);
 lobby.view(users.get(owner));lobby.view(users.get(viewer));lobby.view(users.get(outsider));
 const access=createCharacterMediaAccess(db,id=>{const audience=lobby.mediaAudience(id);return audience?[audience]:[];},()=>time);
 const event={userId:owner,image:access.broadcastImage(`/assets/characters/user/${character}/happy`),at:time,until:time+5000,sound:{...clip,url:access.broadcastSound(clip.url)},soundUntil:time+10000};
 access.rememberExpressions(viewer,'lobby',[event]);assert.ok(access.sound(viewer,event.sound.url));assert.equal(access.sound(outsider,event.sound.url),null);
 time=9000;assert.ok(access.sound(viewer,event.sound.url));
 // Only the author refreshes their presence; fetching audio does not refresh
 // the original viewer, who disappears after the existing lobby TTL.
 lobby.view(users.get(owner));
 const recent={...event,at:time,until:time+5000,soundUntil:time+10000};
 access.rememberExpressions(viewer,'lobby',[recent]);
 time=16001;
 assert.equal(access.sound(viewer,event.sound.url),null);assert.equal(lobby.mediaAudience(viewer),null);
 const present=lobby.view(users.get(owner)).visitors;assert.deepEqual(present.map(user=>user.id),[owner]);
});
