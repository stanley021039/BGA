'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
const png=fs.readFileSync(path.join(__dirname,'../public/assets/characters/traveler-neutral.png'));
function wave(samples=24000,value=100){const bytes=Buffer.alloc(44+samples*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(24000,24);bytes.writeUInt32LE(48000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);for(let i=44;i<bytes.length;i+=2)bytes.writeInt16LE(value,i);return bytes;}
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-expression-http-'));
 const config={host:'127.0.0.1',port:0,dbFile:path.join(root,'db.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),musicDir:path.join(root,'music'),externalSideEffectsEnabled:false};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('sound_owner','sound-password-123');db.close();
 const app=createApp(config),address=await app.listen(),base='http://127.0.0.1:'+address.port;
 t.after(async()=>{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('bga-expression-http-'));fs.rmSync(root,{recursive:true,force:true});});
 async function post(route,cookie,data={}){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const owner=(await post('auth/login',null,{username:'sound_owner',password:'sound-password-123'})).cookie;
 async function member(name){const invite=await post('admin/invites',owner);return (await post('auth/register',null,{username:name,password:'sound-password-123',confirmPassword:'sound-password-123',invite:invite.body.code})).cookie;}
 const peer=await member('sound_peer'),outsider=await member('sound_outsider');
 const character=await post('profile/characters',owner,{name:'Sound actor',base64:png.toString('base64')});assert.equal(character.status,200);const id=character.body.id,uuid=id.slice(5);
 const emote=await post('profile/characters/'+uuid+'/emotes',owner,{name:'歡呼',base64:png.toString('base64')});assert.equal(emote.status,200);const expression=emote.body.expression;
 const route=`profile/characters/${uuid}/expressions/${expression}/sound`;
 const get=(route,cookie,method='GET')=>fetch(base+route,{method,headers:cookie?{Cookie:cookie}:{}});
 const select=()=>post('profile/appearance',owner,{version:5,characterId:id,expression:'neutral'});
 return {post,get,owner,peer,outsider,id,uuid,expression,route,select};
}
test('sound HTTP validates actual ten-second WAV data and preserves prior audio on rejection',async t=>{
 const f=await fixture(t),ten=wave(240000),accepted=await f.post(f.route,f.owner,{base64:ten.toString('base64'),durationMs:1});
 assert.equal(accepted.status,200);assert.equal(accepted.body.sound.durationMs,10000);
 const rejected=await f.post(f.route,f.owner,{base64:wave(240001).toString('base64'),durationMs:1});assert.equal(rejected.status,400);
 const fetched=await f.get(accepted.body.sound.url,f.owner);assert.equal(fetched.status,200);assert.equal(fetched.headers.get('content-type'),'audio/wav');assert.equal(fetched.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await fetched.arrayBuffer()),ten);
 const head=await f.get(accepted.body.sound.url,f.owner,'HEAD');assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),ten.length);assert.equal((await head.arrayBuffer()).byteLength,0);
 const malformed=wave();malformed.writeUInt32LE(2,40);assert.equal((await f.post(f.route,f.owner,{base64:malformed.toString('base64')})).status,400);
});
test('only the expression author can edit sounds and options carry metadata rather than bytes',async t=>{
 const f=await fixture(t);assert.equal((await f.post(f.route,f.peer,{base64:wave().toString('base64')})).status,404);
 const uploaded=await f.post(f.route,f.owner,{base64:wave().toString('base64')});assert.equal(uploaded.status,200);
 const options=await (await f.get('/api/profile/options',f.owner)).json(),item=options.characters.find(c=>c.id===f.id);
 assert.deepEqual(Object.keys(item.sounds[f.expression]).sort(),['durationMs','url']);assert.equal(item.sounds[f.expression].durationMs,1000);
 assert.equal((await f.post(f.route+'/remove',f.peer)).status,404);
 assert.equal((await f.post(f.route+'/remove',f.owner)).status,200);assert.equal((await f.post(f.route+'/remove',f.owner)).status,200);assert.equal((await f.get(uploaded.body.sound.url,f.owner)).status,404);
});
test('received room expressions grant private sound bytes but unrelated members and stale versions cannot read them',async t=>{
 const f=await fixture(t);await f.select();const audio=await f.post(f.route,f.owner,{base64:wave().toString('base64')});
 const created=await f.post('create',f.owner,{type:'poker'}),code=created.body.code;await f.post('join',f.peer,{code});
 assert.equal((await f.get(audio.body.sound.url,f.peer)).status,404);
 const sent=await f.post('social',f.owner,{code,kind:'expression',expression:f.expression});assert.equal(sent.status,200);
 const state=await (await f.get('/api/state?code='+code,f.peer)).json(),event=state.expressions.find(e=>e.expression===f.expression);assert.equal(event.sound.durationMs,1000);assert.match(event.sound.url,/\?v=[a-f0-9]{64}$/);
 assert.equal((await f.get(event.sound.url,f.peer)).status,200);assert.equal((await f.get(event.sound.url,f.outsider)).status,404);assert.equal((await f.get(event.sound.url)).status,401);
 assert.equal((await f.post(f.route,f.owner,{base64:wave(24000,200).toString('base64')})).status,200);assert.equal((await f.get(event.sound.url,f.peer)).status,404);
 await f.post('leave',f.peer,{code});assert.equal((await f.get(audio.body.sound.url,f.peer)).status,404);
});
test('lobby emotes transport sound without granting access through an unobserved UUID',async t=>{
 const f=await fixture(t);await f.select();const audio=await f.post(f.route,f.owner,{base64:wave().toString('base64')});
 await f.get('/api/lobby',f.owner);await f.get('/api/lobby',f.peer);assert.equal((await f.get(audio.body.sound.url,f.peer)).status,404);
 const sent=await f.post('lobby/emote',f.owner,{expression:f.expression});assert.equal(sent.status,200);
 const state=await (await f.get('/api/lobby',f.peer)).json(),emote=state.visitors.find(v=>v.emote)?.emote;assert.equal(emote.sound.durationMs,1000);assert.ok(emote.id);assert.equal((await f.get(emote.sound.url,f.peer)).status,200);assert.equal((await f.get(emote.sound.url,f.outsider)).status,404);
});
