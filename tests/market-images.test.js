const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {randomUUID,randomBytes}=require('node:crypto'),{deflateSync}=require('node:zlib'),{Worker}=require('node:worker_threads');
const sharp=require('sharp'),{PNG}=require('pngjs'),{crc32}=require('pngjs/lib/crc');
const {openDatabase}=require('../src/db');
const {MarketImageStore,validateMarketImagesDatabase,inspectCanonicalImage,DEFAULT_IMAGE_LIMITS,BUCKETS}=require('../src/market/images');
const {imageInput,canonicalImage}=require('../src/market/image-codec');
const start=Date.parse('2026-10-07T05:00:00.000Z'),request=()=>randomUUID(),code=value=>error=>error.code===value;
function png(width=2,height=2){const image=new PNG({width,height});image.data.fill(255);return PNG.sync.write(image);}
const sample=png(),base64=sample.toString('base64');
function fixture(t,limits){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-market-images-')),file=path.join(root,'app.sqlite'),db=openDatabase(file);let now=start;
 const users=['admin','member','member'].map((role,index)=>({id:randomUUID(),username:'image_user_'+index,displayName:'圖片玩家 '+index,role}));
 for(const user of users)db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,disabled,created_at) VALUES(?,?,?,?,?,0,?)').run(user.id,user.username,user.displayName,'scrypt:'+'0'.repeat(32)+':'+'0'.repeat(128),user.role,new Date(start).toISOString());
 const store=new MarketImageStore(db,()=>now,{limits});
 t.after(()=>{try{db.close();}catch{}fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 return {root,file,db,store,admin:users[0],owner:users[1],other:users[2],setTime:value=>{now=value;}};
}
const upload=(f,actor=f.owner,extra={})=>f.store.upload(actor,{requestId:request(),mime:'image/png',base64,buckets:['crash'],weekdays:[1],...extra});
const approve=(f,images,extra={})=>f.store.approve(f.admin,{requestId:request(),confirmed:true,images:images.map(image=>({id:image.id,version:image.version})),...extra});
function chunk(type,data=Buffer.alloc(0)){const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);result.write(type,4,4,'ascii');data.copy(result,8);result.writeInt32BE(crc32(result.subarray(4,result.length-4)),result.length-4);return result;}
function chunks(bytes){const result=[];for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset);result.push({type:bytes.toString('ascii',offset+4,offset+8),data:bytes.subarray(offset+8,offset+8+length)});offset+=length+12;}return result;}
function composed(parts){return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),...parts.map(part=>chunk(part.type,part.data))]);}

test('PNG, JPEG and WebP fully decode to metadata-free canonical PNG BLOBs',async t=>{
 const f=fixture(t),formats=[['image/png',sample],['image/jpeg',await sharp(sample).withMetadata({orientation:6}).jpeg().toBuffer()],['image/webp',await sharp(sample).withXmp('<private>discard me</private>').webp().toBuffer()]];
 for(const [mime,bytes] of formats){
  const result=await upload(f,f.owner,{mime,base64:bytes.toString('base64'),authorId:f.admin.id,authorName:'偽造作者',status:'approved',buckets:['surge','crash'],weekdays:[6,1]});
  assert.equal(result.ok,true);assert.deepEqual(result.image.buckets,['crash','surge']);assert.deepEqual(result.image.weekdays,[1,6]);assert.equal(result.image.authorName,f.owner.displayName);assert.equal(result.image.version,1);assert.equal(result.image.status,'pending');
  const row=f.db.prepare('SELECT *,typeof(bytes) AS storage FROM market_images WHERE id=?').get(result.image.id),image=inspectCanonicalImage(row.bytes);
  assert.equal(row.author_id,f.owner.id);assert.equal(row.storage,'blob');assert.equal(row.mime,'image/png');assert.equal(row.width,image.width);assert.equal(row.height,image.height);assert.equal(row.approved_by,null);assert.deepEqual(chunks(Buffer.from(row.bytes)).map(chunk=>chunk.type),['IHDR','IDAT','IEND']);
 }
 assert.equal(f.store.listMine(f.owner).images.length,3);assert.equal(f.store.listMine(f.other).images.length,0);assert.deepEqual(f.store.listMine(f.owner).limits,DEFAULT_IMAGE_LIMITS);assert.equal(validateMarketImagesDatabase(f.db),true);
});
test('orientation is applied before canonical re-encoding and metadata is stripped',async()=>{
 const input=await sharp(png(2,3)).jpeg().withMetadata({orientation:6}).toBuffer(),output=await canonicalImage(imageInput({mime:'image/jpeg',base64:input.toString('base64')}));
 assert.equal(output.width,3);assert.equal(output.height,2);assert.deepEqual(chunks(output.bytes).map(chunk=>chunk.type),['IHDR','IDAT','IEND']);
});
test('strict MIME, file content, canonical base64 and request IDs reject before persistence',async t=>{
 const f=fixture(t),jpeg=await sharp(sample).jpeg().toBuffer(),fakeJpeg=Buffer.from([255,216,255,0,0,0,0,0]);
 const fakeWebp=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),Buffer.from('VP8L'),Buffer.alloc(4),Buffer.from('fake')]);fakeWebp.writeUInt32LE(fakeWebp.length-8,4);fakeWebp.writeUInt32LE(4,16);
 for(const input of [
  {mime:'image/svg+xml',base64:Buffer.from('<svg/>').toString('base64')},{mime:'image/png',base64:Buffer.from('<svg/>').toString('base64')},
  {mime:'image/gif',base64:Buffer.from('GIF89a').toString('base64')},{mime:'image/jpg',base64:jpeg.toString('base64')},
  {mime:'image/jpeg',base64},{mime:'image/png',base64:jpeg.toString('base64')},{mime:'image/jpeg',base64:fakeJpeg.toString('base64')},{mime:'image/webp',base64:fakeWebp.toString('base64')},
  {base64:''},{base64:base64+'\n'},{base64:'data:image/png;base64,'+base64},{base64:base64.replace(/=+$/,'')},{base64:'!!!!'},
  {base64:sample.subarray(0,33).toString('base64')},{base64:composed([chunks(sample)[0],{type:'IEND',data:Buffer.alloc(0)}]).toString('base64')}
 ])await assert.rejects(upload(f,f.owner,input),code('INVALID_MARKET_IMAGE'));
 for(const requestId of ['',1,'tiny','x'.repeat(81),'with space'])await assert.rejects(upload(f,f.owner,{requestId}),code('INVALID_REQUEST_ID'));
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_requests').get().n,0);
});
test('upload byte, axis and pixel bounds reject before pixel decoding',async t=>{
 const f=fixture(t);await assert.rejects(upload(f,f.owner,{base64:Buffer.alloc(DEFAULT_IMAGE_LIMITS.maxUploadBytes+1).toString('base64')}),code('IMAGE_TOO_LARGE'));
 for(const [width,height] of [[4097,1],[1,4097],[4096,4096]]){const parts=chunks(sample),header=Buffer.from(parts[0].data);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);parts[0].data=header;await assert.rejects(upload(f,f.owner,{base64:composed(parts).toString('base64')}),code('INVALID_MARKET_IMAGE'));}
 const wideJpeg=await sharp({create:{width:4097,height:1,channels:3,background:'white'}}).jpeg().toBuffer();await assert.rejects(upload(f,f.owner,{mime:'image/jpeg',base64:wideJpeg.toString('base64')}),code('INVALID_MARKET_IMAGE'));
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,0);
});
test('actual animated WebP and APNG control chunks are rejected',async t=>{
 const f=fixture(t),animated=await sharp(Buffer.from([255,0,0,255,0,255,0,255]),{raw:{width:1,height:2,channels:4,pageHeight:1}}).webp({delay:[100,100],loop:0}).toBuffer();assert.equal((await sharp(animated).metadata()).pages,2);
 await assert.rejects(upload(f,f.owner,{mime:'image/webp',base64:animated.toString('base64')}),code('INVALID_MARKET_IMAGE'));
 const parts=chunks(sample),control=Buffer.alloc(8);control.writeUInt32BE(1);parts.splice(1,0,{type:'acTL',data:control});await assert.rejects(upload(f,f.owner,{base64:composed(parts).toString('base64')}),code('INVALID_MARKET_IMAGE'));
});
test('PNG input rejects corrupt CRC and a corrupt zlib trailer even when the chunk CRC is valid',async t=>{
 const f=fixture(t),parts=chunks(sample),idat=parts.find(part=>part.type==='IDAT'),payload=Buffer.from(idat.data);payload[payload.length-1]^=1;
 await assert.rejects(upload(f,f.owner,{base64:composed(parts.map(part=>part.type==='IDAT'?{...part,data:payload}:part)).toString('base64')}),code('INVALID_MARKET_IMAGE'));
 const badCrc=Buffer.from(sample);badCrc[29]^=1;await assert.rejects(upload(f,f.owner,{base64:badCrc.toString('base64')}),code('INVALID_MARKET_IMAGE'));
});
test('axis, pixel, canonical output and storage caps accept their exact inclusive boundary',async t=>{
 const f=fixture(t);
 for(const [width,height] of [[4096,1],[1,4096],[4000,2000]]){const input=await sharp({create:{width,height,channels:4,background:'white'}}).png().toBuffer(),image=(await upload(f,f.owner,{base64:input.toString('base64')})).image;assert.equal(image.width,width);assert.equal(image.height,height);}
 const canonical=await canonicalImage(imageInput({mime:'image/png',base64})),exact=fixture(t,{maxUploadBytes:sample.length,maxImageBytes:canonical.bytes.length,maxStorageBytes:canonical.bytes.length});assert.equal((await upload(exact)).ok,true);await assert.rejects(upload(exact),code('IMAGE_QUOTA_EXCEEDED'));
 const under=fixture(t,{maxImageBytes:canonical.bytes.length-1});await assert.rejects(upload(under),code('IMAGE_TOO_LARGE'));
});
test('canonical PNG inspector rejects bad CRC/zlib/trailer/extra pixels, metadata and animation',()=>{
 const parts=chunks(sample),canonical=inspectCanonicalImage(sample);assert.equal(canonical.width,2);
 const badCrc=Buffer.from(sample);badCrc[29]^=1;assert.throws(()=>inspectCanonicalImage(badCrc),code('INVALID_MARKET_IMAGE'));
 assert.throws(()=>inspectCanonicalImage(Buffer.concat([sample,Buffer.from('trailing')])),code('INVALID_MARKET_IMAGE'));
 for(const type of ['tEXt','pHYs','acTL']){const extra=[parts[0],{type,data:Buffer.alloc(8)},...parts.slice(1)];assert.throws(()=>inspectCanonicalImage(composed(extra)),code('INVALID_MARKET_IMAGE'));}
 const idat=parts.find(part=>part.type==='IDAT'),badAdler=Buffer.from(idat.data);badAdler[badAdler.length-1]^=1;
 for(const data of [badAdler,idat.data.subarray(0,-1),Buffer.concat([idat.data,Buffer.from('suffix')]),deflateSync(Buffer.alloc(100000))])assert.throws(()=>inspectCanonicalImage(composed([parts[0],{type:'IDAT',data},parts.at(-1)])),code('INVALID_MARKET_IMAGE'));
});
test('output PNG cap is independently enforced after a valid JPEG decodes',async t=>{
 const f=fixture(t,{maxImageBytes:32});await assert.rejects(upload(f),code('IMAGE_TOO_LARGE'));
 const real=fixture(t),noise=randomBytes(1024*2048*3),jpeg=await sharp(noise,{raw:{width:1024,height:2048,channels:3}}).jpeg({quality:70}).toBuffer();assert.ok(jpeg.length<DEFAULT_IMAGE_LIMITS.maxUploadBytes);
 await assert.rejects(upload(real,real.owner,{mime:'image/jpeg',base64:jpeg.toString('base64')}),code('IMAGE_TOO_LARGE'));assert.equal(real.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,0);
});
test('bounded global decoder concurrency rejects excess work without queueing and releases slots',async t=>{
 const f=fixture(t),results=await Promise.allSettled([upload(f),upload(f),upload(f)]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,2);assert.equal(results.find(result=>result.status==='rejected').reason.code,'IMAGE_BUSY');
 await assert.rejects(upload(f,f.owner,{mime:'image/jpeg',base64:Buffer.from([255,216,255,0,0,0]).toString('base64')}),code('INVALID_MARKET_IMAGE'));
 assert.equal((await upload(f)).ok,true);
});
test('rules require unique nonempty valid groups and cannot be edited after upload',async t=>{
 const f=fixture(t);
 for(const input of [{buckets:[]},{buckets:['tie']},{buckets:['crash','crash']},{buckets:'crash'},{weekdays:[]},{weekdays:[7]},{weekdays:[-1]},{weekdays:['1']},{weekdays:[1,1]},{weekdays:[1.1]}])await assert.rejects(upload(f,f.owner,input),code('INVALID_IMAGE_RULES'));
 const input={requestId:request(),mime:'image/png',base64,buckets:['crash'],weekdays:[1]},pending=f.store.upload(f.owner,input);input.buckets.push('surge');input.weekdays.push(6);const result=await pending;
 assert.deepEqual(result.image.buckets,['crash']);assert.deepEqual(result.image.weekdays,[1]);assert.equal(typeof f.store.edit,'undefined');assert.equal(typeof f.store.remove,'undefined');
});
test('media and listing recheck canonical identity, owner, admin, and disabled account',async t=>{
 const f=fixture(t),image=(await upload(f)).image;
 assert.throws(()=>f.store.listMine({id:request()}),code('UNAUTHORIZED'));await assert.rejects(upload(f,{id:request()}),code('UNAUTHORIZED'));
 assert.throws(()=>f.store.pending({...f.owner,role:'admin'}),code('ADMIN_REQUIRED'));assert.throws(()=>f.store.media(f.other,image.id),code('IMAGE_NOT_FOUND'));assert.throws(()=>f.store.media(f.owner,request()),code('IMAGE_NOT_FOUND'));
 assert.equal(f.store.media(f.owner,image.id).mime,'image/png');assert.equal(f.store.media(f.admin,image.id).mime,'image/png');approve(f,[image]);assert.equal(f.store.media(f.other,image.id).mime,'image/png');
 f.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f.owner.id);
 for(const action of [()=>f.store.listMine(f.owner),()=>f.store.draw(f.owner,{targetDate:'2027-01-04'}),()=>f.store.media(f.owner,image.id)])assert.throws(action,code('UNAUTHORIZED'));await assert.rejects(upload(f),code('UNAUTHORIZED'));
 f.db.prepare("UPDATE users SET role='member' WHERE id=?").run(f.admin.id);assert.throws(()=>f.store.pending(f.admin),code('ADMIN_REQUIRED'));assert.equal(validateMarketImagesDatabase(f.db),true);
});
test('async upload rechecks disabled state and uses the latest canonical name under write lock',async t=>{
 const f=fixture(t),pending=upload(f);f.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f.owner.id);await assert.rejects(pending,code('UNAUTHORIZED'));assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,0);
 f.db.prepare('UPDATE users SET disabled=0 WHERE id=?').run(f.owner.id);const renamed=upload(f);f.db.prepare('UPDATE users SET display_name=? WHERE id=?').run('最新名稱',f.owner.id);assert.equal((await renamed).image.authorName,'最新名稱');
 f.db.prepare('UPDATE users SET display_name=? WHERE id=?').run('後來改名',f.owner.id);assert.equal(validateMarketImagesDatabase(f.db),true);
 f.db.prepare('UPDATE users SET display_name=? WHERE id=?').run('bootstrap_username_24xxx',f.admin.id);assert.equal((await upload(f,f.admin)).image.authorName,'bootstrap_username_24xxx');assert.equal(validateMarketImagesDatabase(f.db),true);
});
test('upload and approval receipts are idempotent, bound to operation/payload, and survive restart',async t=>{
 const f=fixture(t,{maxPerUser:1}),input={requestId:request(),mime:'image/png',base64,buckets:['crash'],weekdays:[1]},first=await f.store.upload(f.owner,input);
 assert.deepEqual(await f.store.upload(f.owner,input),{...first,replayed:true});await assert.rejects(f.store.upload(f.owner,{...input,buckets:['fall']}),code('REQUEST_ID_REUSED'));
 const batch={requestId:request(),confirmed:true,images:[{id:first.image.id,version:1}]},approved=f.store.approve(f.admin,batch);assert.deepEqual(f.store.approve(f.admin,batch),{...approved,replayed:true});
 assert.throws(()=>f.store.approve(f.admin,{...batch,images:[{id:first.image.id,version:2}]}),code('REQUEST_ID_REUSED'));
 assert.equal((await f.store.upload(f.owner,input)).image.status,'pending');assert.equal(f.store.listMine(f.owner).images[0].status,'approved');assert.equal(validateMarketImagesDatabase(f.db),true);
 const before=Buffer.from(f.store.media(f.owner,first.image.id).bytes);f.db.close();const reopened=openDatabase(f.file);try{const store=new MarketImageStore(reopened,()=>start);assert.deepEqual(Buffer.from(store.media(f.other,first.image.id).bytes),before);assert.equal(store.approve(f.admin,batch).replayed,true);assert.equal(validateMarketImagesDatabase(reopened),true);}finally{reopened.close();}
});
test('per-user, table and total storage quotas are applied atomically after decoding',async t=>{
 for(const [limits,actors] of [[{maxPerUser:1},[0,0]],[{maxImages:1},[0,1]],[{maxStorageBytes:1},[0]]]){
  const f=fixture(t,limits),users=[f.owner,f.other];
  if(actors.length>1){await upload(f,users[actors[0]]);await assert.rejects(upload(f,users[actors[1]]),code('IMAGE_QUOTA_EXCEEDED'));assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,1);}
  else await assert.rejects(upload(f),code('IMAGE_QUOTA_EXCEEDED'));
 }
 const concurrent=fixture(t,{maxPerUser:1}),results=await Promise.allSettled([upload(concurrent),upload(concurrent)]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.code,'IMAGE_QUOTA_EXCEEDED');
 assert.throws(()=>new MarketImageStore(concurrent.db,Date.now,{limits:{maxImages:1001}}),/Invalid market image limits/);
});
test('filtered pending queue uses AND groups/OR values and remains bounded',async t=>{
 const f=fixture(t),a=(await upload(f,f.owner,{buckets:['crash','rise'],weekdays:[1,2]})).image,b=(await upload(f,f.other,{buckets:['fall'],weekdays:[1]})).image,c=(await upload(f,f.owner,{buckets:['crash'],weekdays:[3]})).image;
 assert.equal(f.store.pending(f.admin).total,3);assert.deepEqual(f.store.pending(f.admin,{buckets:['crash','fall'],weekdays:[2,3]}).images.map(image=>image.id).sort(),[a.id,c.id].sort());
 assert.equal(f.store.pending(f.admin,{buckets:['fall'],weekdays:[2]}).total,0);assert.equal(f.store.pending(f.admin,{buckets:[],weekdays:[]}).total,3);assert.throws(()=>f.store.pending(f.admin,{weekdays:['1']}),code('INVALID_IMAGE_RULES'));
 approve(f,[a]);assert.deepEqual(f.store.pending(f.admin).images.map(image=>image.id).sort(),[b.id,c.id].sort());assert.equal(f.store.listMine(f.owner).images.length,2);
 const bounded=new MarketImageStore(f.db,()=>start,{limits:{maxImages:2}});assert.throws(()=>bounded.pending(f.admin),code('IMAGE_GALLERY_LIMIT'));
});
test('frozen approval batches require explicit confirmation, canonical admin and all pending versions',async t=>{
 const f=fixture(t),a=(await upload(f)).image,b=(await upload(f)).image;
 assert.throws(()=>f.store.approve(f.admin,{requestId:request(),images:[{id:a.id,version:1}]}),code('CONFIRM_REQUIRED'));
 for(const images of [[],[{id:'bad',version:1}],[{id:a.id,version:'1'}],[{id:a.id,version:1},{id:a.id,version:1}],Array.from({length:1001},()=>({id:request(),version:1}))])assert.throws(()=>f.store.approve(f.admin,{requestId:request(),confirmed:true,images}),code('INVALID_IMAGE_BATCH'));
 assert.throws(()=>f.store.approve({...f.owner,role:'admin'},{requestId:request(),confirmed:true,images:[{id:a.id,version:1}]}),code('ADMIN_REQUIRED'));
 approve(f,[a]);assert.throws(()=>approve(f,[a,b]),code('STALE_IMAGE_BATCH'));assert.equal(f.store.listMine(f.owner).images.find(image=>image.id===b.id).status,'pending');
 assert.throws(()=>approve(f,[{...b,version:2}]),code('STALE_IMAGE_BATCH'));assert.throws(()=>approve(f,[b,{id:request(),version:1}]),code('STALE_IMAGE_BATCH'));assert.equal(f.store.listMine(f.owner).images.find(image=>image.id===b.id).status,'pending');
 const later=(await upload(f)).image;assert.equal(approve(f,[b]).approved,1);assert.equal(f.store.listMine(f.owner).images.find(image=>image.id===later.id).status,'pending');
 assert.throws(()=>f.store.approve(f.admin,{requestId:request(),confirmed:true,buckets:['crash']}),code('INVALID_IMAGE_BATCH'));
});
test('approval failure rolls back every status/version and receipt; clock rollback remains exportable',async t=>{
 const f=fixture(t),a=(await upload(f)).image,b=(await upload(f)).image;
 f.db.exec(`CREATE TRIGGER image_approval_failure BEFORE UPDATE ON market_images WHEN NEW.id='${b.id}' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`);assert.throws(()=>approve(f,[a,b]));assert.ok(f.store.listMine(f.owner).images.every(image=>image.status==='pending'&&image.version===1));assert.equal(f.db.prepare("SELECT COUNT(*) n FROM market_requests WHERE operation='image-approve'").get().n,0);
 f.db.exec('DROP TRIGGER image_approval_failure');f.setTime(start-1000);approve(f,[a,b]);assert.ok(f.db.prepare('SELECT approved_at,created_at FROM market_images').all().every(row=>row.approved_at===row.created_at));assert.equal(validateMarketImagesDatabase(f.db),true);
});
test('draw uses target-date weekday and approved eligibility, with null fallbacks for empty pools',async t=>{
 const f=fixture(t),monday=(await upload(f,f.owner,{buckets:['crash','rise'],weekdays:[1]})).image,sunday=(await upload(f,f.other,{buckets:['fall'],weekdays:[0]})).image,second=(await upload(f,f.owner,{buckets:['crash'],weekdays:[1]})).image;
 assert.deepEqual(f.store.draw(f.owner,{targetDate:'2027-01-04'}),{targetDate:'2027-01-04',images:Object.fromEntries(BUCKETS.map(bucket=>[bucket,null]))});
 approve(f,[monday,sunday,second]);const seen=new Set();
 for(let i=0;i<100;i++){const result=f.store.draw(f.owner,{targetDate:'2027-01-04'});assert.equal(result.images.rise.id,monday.id);assert.equal(result.images.fall,null);assert.ok([monday.id,second.id].includes(result.images.crash.id));seen.add(result.images.crash.id);}assert.equal(seen.size,2);
 const result=f.store.draw(f.owner,{targetDate:'2027-01-03'});assert.equal(result.images.fall.id,sunday.id);assert.equal(result.images.crash,null);assert.throws(()=>f.store.draw(f.owner,{targetDate:'2027-02-29'}),code('INVALID_DATE'));
});

const workerScript=`const {parentPort,workerData}=require('node:worker_threads');const {openDatabase}=require(workerData.repo+'/src/db');const {MarketImageStore}=require(workerData.repo+'/src/market/images');const db=openDatabase(workerData.file),barrier=new Int32Array(workerData.barrier);parentPort.postMessage({ready:true});Atomics.wait(barrier,0,0);(async()=>{try{const store=new MarketImageStore(db,()=>workerData.now,{limits:workerData.limits});const result=await store[workerData.operation]({id:workerData.userId},workerData.input);parentPort.postMessage({ok:true,result});}catch(error){parentPort.postMessage({ok:false,code:error.code});}finally{db.close();}})();`;
async function race(f,operations,limits){
 const barrier=new SharedArrayBuffer(4),workers=operations.map(operation=>new Worker(workerScript,{eval:true,workerData:{repo:path.resolve(__dirname,'..'),file:f.file,barrier,now:start,limits,...operation}}));
 try{
  await Promise.all(workers.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);})));const results=workers.map(worker=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}));Atomics.store(new Int32Array(barrier),0,1);Atomics.notify(new Int32Array(barrier),0,workers.length);return await Promise.all(results);
 }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
}
test('independent SQLite connections serialize upload quota and replay identical uploads once',async t=>{
 const f=fixture(t),input={requestId:request(),mime:'image/png',base64,buckets:['crash'],weekdays:[1]},operations=[0,1].map(()=>({operation:'upload',userId:f.owner.id,input}));
 const replay=await race(f,operations,{maxPerUser:1});assert.ok(replay.every(result=>result.ok));assert.equal(replay.filter(result=>result.result.replayed).length,1);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,1);
 const g=fixture(t),quota=await race(g,[0,1].map(()=>({operation:'upload',userId:g.owner.id,input:{...input,requestId:request()}})),{maxPerUser:1});assert.equal(quota.filter(result=>result.ok).length,1);assert.equal(quota.find(result=>!result.ok).code,'IMAGE_QUOTA_EXCEEDED');
});
test('independent SQLite approval races reject stale batches and replay identical approvals once',async t=>{
 const f=fixture(t),a=(await upload(f)).image,batch={requestId:request(),confirmed:true,images:[{id:a.id,version:1}]};
 const result=await race(f,[0,1].map(()=>({operation:'approve',userId:f.admin.id,input:batch})));assert.ok(result.every(value=>value.ok));assert.equal(result.filter(value=>value.result.replayed).length,1);
 const b=(await upload(f)).image,stale=await race(f,[0,1].map(()=>({operation:'approve',userId:f.admin.id,input:{...batch,requestId:request(),images:[{id:b.id,version:1}]}})));assert.equal(stale.filter(value=>value.ok).length,1);assert.equal(stale.find(value=>!value.ok).code,'STALE_IMAGE_BATCH');assert.equal(validateMarketImagesDatabase(f.db),true);
});
test('backup validator rejects semantic metadata, references, canonical corruption and forged receipts',async t=>{
 const f=fixture(t),image=(await upload(f)).image;assert.equal(validateMarketImagesDatabase(f.db),true);f.db.exec('PRAGMA ignore_check_constraints=ON; PRAGMA foreign_keys=OFF');
 const row=f.db.prepare('SELECT * FROM market_images WHERE id=?').get(image.id);
 for(const [column,value] of [['id','bad'],['author_id',request()],['author_name','bad\nname'],['mime','image/jpeg'],['width',3],['buckets_json','["tie"]'],['buckets_json','["crash","crash"]'],['weekdays_json','["1"]'],['weekdays_json','[7]'],['version',2],['status','unknown'],['created_at','not a date'],['approved_by',f.admin.id],['bytes',sample.subarray(0,33)]]){
  f.db.prepare(`UPDATE market_images SET ${column}=? WHERE id=?`).run(value,image.id);assert.throws(()=>validateMarketImagesDatabase(f.db));f.db.prepare(`UPDATE market_images SET ${column}=? WHERE id=?`).run(row[column],column==='id'?value:image.id);
 }
 const receipt=f.db.prepare("SELECT * FROM market_requests WHERE operation='image-upload'").get();
 for(const [column,value] of [['fingerprint','bad'],['request_id','short'],['response_json','{"ok":true,"image":null}'],['created_at','not a date']]){f.db.prepare(`UPDATE market_requests SET ${column}=?`).run(value);assert.throws(()=>validateMarketImagesDatabase(f.db));f.db.prepare(`UPDATE market_requests SET ${column}=?`).run(receipt[column]);}
 approve(f,[image]);const approved=f.db.prepare('SELECT * FROM market_images').get();for(const [column,value] of [['approved_by',request()],['approved_at',new Date(start-1).toISOString()],['approved_at','invalid'],['version',1]]){f.db.prepare(`UPDATE market_images SET ${column}=?`).run(value);assert.throws(()=>validateMarketImagesDatabase(f.db));f.db.prepare(`UPDATE market_images SET ${column}=?`).run(approved[column]);}assert.equal(validateMarketImagesDatabase(f.db),true);
});
test('backup validator rejects per-author/gallery/storage quotas before decoding rows',async t=>{
 const f=fixture(t),image=(await upload(f)).image,row=f.db.prepare('SELECT * FROM market_images').get(),insert=f.db.prepare('INSERT INTO market_images VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<100;i++)insert.run(request(),row.author_id,row.author_name,row.mime,row.bytes,row.width,row.height,row.buckets_json,row.weekdays_json,row.version,row.status,row.created_at,row.approved_by,row.approved_at);
 assert.throws(()=>validateMarketImagesDatabase(f.db));assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,101);
 for(let i=0;i<900;i++)insert.run(request(),row.author_id,row.author_name,row.mime,row.bytes,row.width,row.height,row.buckets_json,row.weekdays_json,row.version,row.status,row.created_at,row.approved_by,row.approved_at);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM market_images').get().n,1001);assert.throws(()=>validateMarketImagesDatabase(f.db));
 // These aggregate checks intentionally precede full decoding of any BLOB.
 f.db.exec('DELETE FROM market_requests; DELETE FROM market_images; PRAGMA ignore_check_constraints=ON');
 const large=Buffer.alloc(4*1024*1024);for(let i=0;i<65;i++)insert.run(request(),row.author_id,row.author_name,row.mime,large,row.width,row.height,row.buckets_json,row.weekdays_json,row.version,row.status,row.created_at,row.approved_by,row.approved_at);assert.throws(()=>validateMarketImagesDatabase(f.db));
});
