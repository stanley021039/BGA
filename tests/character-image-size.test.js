const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
const {imageOf,imageForRequest,MAX_BYTES,MAX_CHARACTER_IMAGE_BYTES,MAX_CHARACTER_IMAGE_BODY_BYTES}=require('../src/profiles/uploads');
const {characterImagePng}=require('./helpers/character-image-fixture.cjs');
const {CATEGORIES}=require('../src/games/gift-catalog');
const MIB=1024*1024,PASSWORD='synthetic-image-test-password',payload=bytes=>({mime:'image/png',base64:bytes.toString('base64')});
const invalidImage=error=>error.code==='INVALID_CHARACTER_IMAGE';

function independentCrc32(bytes){if(typeof zlib.crc32==='function')return zlib.crc32(bytes)>>>0;let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return(crc^0xffffffff)>>>0;}
function inspectPng(bytes){
 assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));let offset=8;const chunks=[],idat=[];
 while(offset<bytes.length){const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+length+12;assert.ok(end<=bytes.length);assert.equal(bytes.readUInt32BE(end-4),independentCrc32(bytes.subarray(offset+4,end-4)));chunks.push(type);if(type==='IDAT')idat.push(bytes.subarray(offset+8,end-4));offset=end;}
 assert.equal(offset,bytes.length);assert.deepEqual(chunks,['IHDR','npAD','IDAT','IEND']);assert.deepEqual(zlib.inflateSync(Buffer.concat(idat)),Buffer.from([0,64,144,96,255]));
}

async function fixture(t){
 const parent=fs.realpathSync(os.tmpdir()),prefix='bga-character-image-size-',root=fs.mkdtempSync(path.join(parent,prefix));let app;
 t.after(async()=>{await app?.close();const absolute=fs.realpathSync(root);assert.equal(absolute,path.resolve(root));assert.equal(path.dirname(absolute),parent);assert.ok(path.basename(absolute).startsWith(prefix));fs.rmSync(absolute,{recursive:true,force:true,maxRetries:5});});
 const config={port:0,host:'127.0.0.1',externalSideEffectsEnabled:false,dbFile:path.join(root,'app.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community')};
 const db=openDatabase(config.dbFile),auth=createAuth(db);let ownerId,peerId;
 try{ownerId=await auth.bootstrap('image_author',PASSWORD);const admin=db.prepare('SELECT * FROM users WHERE id=?').get(ownerId),invite=auth.createInvite(admin).code;peerId=(await auth.register({username:'image_peer',displayName:'圖片測試好友',password:PASSWORD,confirmPassword:PASSWORD,invite},{setHeader(){}})).id;}finally{db.close();}
 app=createApp(config);const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
 async function post(route,user,data){const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Cookie:user.cookie}:{})},body:JSON.stringify(data)});return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const owner=await post('/api/auth/login',null,{username:'image_author',password:PASSWORD}),peer=await post('/api/auth/login',null,{username:'image_peer',password:PASSWORD});assert.equal(owner.status,200);assert.equal(peer.status,200);
 const get=(route,user)=>fetch(base+route,{headers:user?{Cookie:user.cookie}:{}});
 const database=fn=>{const check=openDatabase(config.dbFile);try{return fn(check);}finally{check.close();}};
 function chunked(route,user,length){
  return new Promise((resolve,reject)=>{let responded=false;const request=http.request(base+route,{method:'POST',headers:{'Content-Type':'application/json','Transfer-Encoding':'chunked',...(user?{Cookie:user.cookie}:{})}},response=>{responded=true;const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{try{resolve({status:response.statusCode,body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch(error){reject(error);}});response.on('error',reject);});request.on('error',error=>{if(!responded)reject(error);});request.write('{}');const chunk=Buffer.alloc(64*1024,32);for(let sent=2;sent<length;sent+=chunk.length)request.write(chunk.subarray(0,Math.min(chunk.length,length-sent)));request.end();});
 }
 return{post,get,chunked,database,owner,peer,ownerId,peerId};
}

test('boundary PNG fixtures have real image chunks, correct CRCs and a decodable scanline',()=>{
 for(const size of [MIB,4*MIB,4*MIB+1]){const image=characterImagePng(size);assert.equal(image.length,size);inspectPng(image);}
});

test('image limits are trusted parameters and validate decoded bytes, MIME and canonical base64',()=>{
 assert.equal(MAX_BYTES,MIB);assert.equal(MAX_CHARACTER_IMAGE_BYTES,4*MIB);assert.equal(MAX_CHARACTER_IMAGE_BODY_BYTES,4*Math.ceil(4*MIB/3)+8192);
 const bytes=characterImagePng(4*MIB),exact=payload(bytes),oversized=payload(characterImagePng(4*MIB+1)),options={maxBytes:MAX_CHARACTER_IMAGE_BYTES};
 assert.equal(exact.base64.length,oversized.base64.length,'the +1 decoded-byte case cannot be caught only by base64 string length');
 assert.deepEqual(imageOf(exact,options).bytes,bytes);assert.equal(imageOf(exact,options).mime,'image/png');assert.equal(imageOf(exact,options).width,1);assert.deepEqual(imageForRequest(null,'owner',exact,options).bytes,bytes);
 assert.throws(()=>imageOf(oversized,options),invalidImage);assert.throws(()=>imageOf(exact),invalidImage);assert.throws(()=>imageOf({...exact,maxBytes:4*MIB}),invalidImage);
 assert.deepEqual(imageOf(payload(characterImagePng(MIB))).bytes,characterImagePng(MIB));assert.throws(()=>imageForRequest(null,'owner',payload(characterImagePng(MIB+1))),invalidImage);
 for(const bad of [{...exact,mime:'image/gif'},{...exact,base64:exact.base64.replace(/=+$/,'')},{...exact,base64:'data:image/png;base64,'+exact.base64}])assert.throws(()=>imageOf(bad,options),invalidImage);
});

test('all three character image routes accept exact 4MiB, reject +1 without mutation and keep private media authorized',async t=>{
 const f=await fixture(t),neutral=characterImagePng(4*MIB,{paddingByte:0xa1}),happy=characterImagePng(4*MIB,{paddingByte:0xa2}),custom=characterImagePng(4*MIB,{paddingByte:0xa3}),oversized=payload(characterImagePng(4*MIB+1));
 const created=await f.post('/api/profile/characters',f.owner,{name:'四MiB主角色',...payload(neutral)});assert.equal(created.status,200);const id=created.body.id.slice(5),route='/api/profile/characters/'+id;
 assert.equal((await f.post(route+'/expressions',f.owner,{expression:'happy',...payload(happy)})).status,200);
 const added=await f.post(route+'/emotes',f.owner,{name:'四MiB表情',...payload(custom)});assert.equal(added.status,200);assert.match(added.body.expression,/^emote-/);
 for(const [url,data]of [['/api/profile/characters',{name:'不可新增',...oversized}],[route+'/expressions',{expression:'happy',...oversized}],[route+'/emotes',{name:'不可新增',...oversized}]]){const refused=await f.post(url,f.owner,data);assert.equal(refused.status,400);assert.equal(refused.body.code,'INVALID_CHARACTER_IMAGE');}
 const rows=f.database(db=>db.prepare('SELECT expression,mime,bytes FROM character_images WHERE character_id=? ORDER BY expression').all(id));assert.equal(rows.length,3);assert.equal(f.database(db=>db.prepare('SELECT COUNT(*) n FROM player_characters WHERE owner_id=?').get(f.ownerId).n),1);
 for(const [expression,expected]of [['neutral',neutral],['happy',happy],[added.body.expression,custom]]){
  const row=rows.find(row=>row.expression===expression);assert.equal(row.mime,'image/png');assert.deepEqual(Buffer.from(row.bytes),expected);
  const image='/assets/characters/user/'+id+'/'+expression,own=await f.get(image,f.owner);assert.equal(own.status,200);assert.equal(own.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await own.arrayBuffer()),expected);
  for(const [user,status]of [[null,401],[f.peer,404]]){const response=await f.get(image,user);assert.equal(response.status,status);await response.arrayBuffer();}
 }
 for(const [suffix,data]of [['expressions',{expression:'happy',...payload(neutral)}],['emotes',{name:'非作者不能修改',...payload(neutral)}]])assert.equal((await f.post(route+'/'+suffix,f.peer,data)).status,404);
 assert.deepEqual(Buffer.from(f.database(db=>db.prepare('SELECT bytes FROM character_images WHERE character_id=? AND expression=?').get(id,'happy').bytes)),happy);
});

test('generic artwork and gift uploads remain limited to 1MiB even when clients supply a larger limit',async t=>{
 const f=await fixture(t),exact=payload(characterImagePng(MIB)),oversized=payload(characterImagePng(MIB+1));
 const artwork=await f.post('/api/artworks',f.owner,{name:'一MiB作品',...exact});assert.equal(artwork.status,200);
 const gift=await f.post('/api/community/gifts',f.owner,{title:'一MiB禮物邊界',category:CATEGORIES[0],image:exact});assert.equal(gift.status,200,JSON.stringify(gift.body));
 for(const [route,data]of [['/api/artworks',{name:'超限作品',...oversized,maxBytes:4*MIB}],['/api/community/gifts',{title:'超限禮物',category:CATEGORIES[0],image:{...oversized,maxBytes:4*MIB}}]]){const response=await f.post(route,f.owner,data);assert.equal(response.status,400);assert.equal(response.body.code,'INVALID_CHARACTER_IMAGE');}
 assert.equal(f.database(db=>db.prepare('SELECT COUNT(*) n FROM user_artworks').get().n),1);assert.equal(f.database(db=>db.prepare('SELECT COUNT(*) n FROM community_gifts').get().n),1);
});

test('chunked requests enforce the exact character body cap and never enlarge sharing, sound or generic caps',async t=>{
 const f=await fixture(t),created=await f.post('/api/profile/characters',f.owner,{name:'路由測試',...payload(characterImagePng(256))});assert.equal(created.status,200);const route='/api/profile/characters/'+created.body.id.slice(5);
 for(const path of ['/api/profile/characters',route+'/expressions',route+'/emotes']){const response=await f.chunked(path,f.owner,MAX_CHARACTER_IMAGE_BODY_BYTES+1);assert.equal(response.status,413);assert.equal(response.body.code,'REQUEST_TOO_LARGE');}
 for(const path of [route+'/sharing',route+'/expressions/happy/sound',route+'/delete',route+'/expressions/','/api/profile/characters/not-a-uuid/emotes','/api/artworks','/api/community/gifts']){const response=await f.chunked(path,f.owner,1400001);assert.equal(response.status,413,path);assert.equal(response.body.code,'REQUEST_TOO_LARGE',path);}
 const ordinary=await f.chunked('/api/profile/settings',f.owner,8193);assert.equal(ordinary.status,413);assert.equal(ordinary.body.code,'REQUEST_TOO_LARGE');
 assert.equal(f.database(db=>db.prepare('SELECT COUNT(*) n FROM player_characters').get().n),1);assert.equal(f.database(db=>db.prepare('SELECT COUNT(*) n FROM character_sounds').get().n),0);
});
