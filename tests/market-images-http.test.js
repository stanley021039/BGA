const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {PNG}=require('pngjs'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth'),{createApp}=require('../src/app'),{settings}=require('../src/config');
const png=()=>PNG.sync.write({width:2,height:2,data:Buffer.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,255])}),request=()=>randomUUID();
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-image-http-')),file=path.join(root,'app.sqlite'),db=openDatabase(file),auth=createAuth(db),password='fixture-'+randomUUID(),adminId=await auth.bootstrap('image_admin',password),admin=db.prepare('SELECT * FROM users WHERE id=?').get(adminId),users=[admin];
 for(let i=0;i<2;i++)users.push(await auth.register({username:'image_member_'+i,displayName:'圖片作者 '+i,password,confirmPassword:password,invite:auth.createInvite(admin).code},{setHeader(){}}));db.close();
 const config={...settings({DB_FILE:file,HISTORY_DIR:path.join(root,'history'),COMMUNITY_DIR:path.join(root,'community'),MUSIC_DIR:path.join(root,'music'),EXTERNAL_SIDE_EFFECTS_ENABLED:'false'}),host:'127.0.0.1',port:0,githubClient:{configured:false}};
 const app=createApp(config),address=await app.listen(),base='http://127.0.0.1:'+address.port,cookies=[];
 const fetcher=(route,{body,headers={},cookie,method=body?'POST':'GET'}={})=>fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...headers},body:body?JSON.stringify(body):undefined});
 for(const user of users){const r=await fetcher('/api/auth/login',{body:{username:user.username,password}});assert.equal(r.status,200);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
 t.after(async()=>{await app.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 const upload=(cookie,extra={})=>fetcher('/api/market/images',{cookie,body:{requestId:request(),mime:'image/png',base64:png().toString('base64'),buckets:['crash','rally'],weekdays:[1,3],...extra}});
 return {root,file,base,app,users,cookies,fetcher,upload};
}
test('gallery endpoints require a session before reading large uploads and reject unsupported media methods',async t=>{const f=await fixture(t);
 for(const route of ['/api/market/images/mine','/api/market/images/'+request()+'/media','/api/admin/market/images'])assert.equal((await f.fetcher(route)).status,401);
 assert.equal((await f.fetcher('/api/market/images',{body:{base64:'x'.repeat(3*1024*1024+1)}})).status,401);
 assert.equal((await f.fetcher('/api/market/images',{cookie:f.cookies[1]})).status,405);
 assert.equal((await f.fetcher('/api/admin/market/images',{cookie:f.cookies[1]})).status,403);
 assert.equal((await f.fetcher('/api/market/images/'+request()+'/media',{cookie:f.cookies[1],method:'POST',body:{}})).status,405);
});
test('HTTP pending media is owner/admin-only; approval makes canonical PNG available to logged-in players',async t=>{const f=await fixture(t),r=await f.upload(f.cookies[1],{authorId:f.users[2].id,authorName:'forged',status:'approved',approvedBy:f.users[0].id});assert.equal(r.status,200);const image=(await r.json()).image;assert.equal(image.status,'pending');assert.equal(image.authorName,'圖片作者 0');assert.equal(image.version,1);
 const own=await (await f.fetcher('/api/market/images/mine',{cookie:f.cookies[1]})).json();assert.equal(own.images.length,1);assert.equal((await f.fetcher(image.url,{cookie:f.cookies[2]})).status,404);
 for(const cookie of [f.cookies[0],f.cookies[1]]){const media=await f.fetcher(image.url,{cookie});assert.equal(media.status,200);assert.equal(media.headers.get('content-type'),'image/png');assert.equal(media.headers.get('x-content-type-options'),'nosniff');assert.equal(media.headers.get('cache-control'),'no-store');assert.equal(media.headers.get('cross-origin-resource-policy'),'same-origin');const bytes=Buffer.from(await media.arrayBuffer());assert.equal(PNG.sync.read(bytes).width,2);}
 const draw=await (await f.fetcher('/api/market/images/draw',{cookie:f.cookies[2],body:{targetDate:'2027-01-04'}})).json();assert.ok(Object.values(draw.images).every(x=>x===null));
 assert.equal((await f.fetcher('/api/admin/market/images/approve',{cookie:f.cookies[2],body:{requestId:request(),confirmed:true,images:[{id:image.id,version:image.version}]}})).status,403);
 const approval=await f.fetcher('/api/admin/market/images/approve',{cookie:f.cookies[0],body:{requestId:request(),confirmed:true,images:[{id:image.id,version:image.version}]}});assert.equal(approval.status,200);
 const approved=await f.fetcher(image.url,{cookie:f.cookies[2]});assert.equal(approved.status,200);assert.equal((await f.fetcher(image.url)).status,401);
 const match=await (await f.fetcher('/api/market/images/draw',{cookie:f.cookies[2],body:{targetDate:'2027-01-04'}})).json();assert.equal(match.images.crash.id,image.id);assert.equal(match.images.rally.id,image.id);assert.equal(match.images.fall,null);
});
test('gallery same-origin guard covers upload, approval, lists and guessed media URLs',async t=>{const f=await fixture(t),image=(await (await f.upload(f.cookies[1])).json()).image;
 const cases=[['/api/market/images/mine',undefined], [image.url,undefined], ['/api/market/images/draw',{targetDate:'2027-01-04'}], ['/api/market/images',{requestId:request()}], ['/api/admin/market/images/approve',{requestId:request()}]];
 for(const [route,body]of cases){assert.equal((await f.fetcher(route,{cookie:f.cookies[0],body,headers:{Origin:'https://untrusted.invalid'}})).status,403,route);assert.equal((await f.fetcher(route,{cookie:f.cookies[0],body,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403,route);}
 assert.equal((await f.fetcher(image.url,{cookie:f.cookies[1],headers:{Origin:f.base,'Sec-Fetch-Site':'same-origin'}})).status,200);
 assert.equal((await f.fetcher(image.url,{cookie:f.cookies[1],headers:{Origin:f.base.replace('http:','https:')}})).status,403);
 assert.equal((await f.fetcher('/api/admin/market/images?weekdays=1&weekdays=2',{cookie:f.cookies[0]})).status,400);
 assert.equal((await f.fetcher('/api/admin/market/images?weekdays=NaN',{cookie:f.cookies[0]})).status,400);
});
test('HTTP upload bounds reject excess raw bytes and JSON envelope, and operation rate is bounded',async t=>{const f=await fixture(t);
 assert.equal((await f.upload(f.cookies[1],{base64:Buffer.alloc(2*1024*1024+1).toString('base64')})).status,413);
 assert.equal((await f.upload(f.cookies[1],{base64:'x'.repeat(3*1024*1024+1)})).status,413);
 for(let i=0;i<4;i++)assert.equal((await f.upload(f.cookies[1],{base64:'not-base64!'})).status,400);
 assert.equal((await f.upload(f.cookies[1])).status,429);
 const mine=await (await f.fetcher('/api/market/images/mine',{cookie:f.cookies[1]})).json();assert.equal(mine.images.length,0);
});
test('disabled sessions and revoked admin role cannot preview or approve with stale cookies',async t=>{const f=await fixture(t),image=(await (await f.upload(f.cookies[1])).json()).image,db=openDatabase(f.file);
 try{db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f.users[1].id);db.prepare("UPDATE users SET role='member' WHERE id=?").run(f.users[0].id);}finally{db.close();}
 assert.equal((await f.fetcher(image.url,{cookie:f.cookies[1]})).status,401);assert.equal((await f.fetcher('/api/market/images/mine',{cookie:f.cookies[1]})).status,401);
 assert.equal((await f.fetcher('/api/admin/market/images',{cookie:f.cookies[0]})).status,403);assert.equal((await f.fetcher('/api/admin/market/images/approve',{cookie:f.cookies[0],body:{requestId:request(),confirmed:true,images:[{id:image.id,version:1}]}})).status,403);
 assert.equal((await f.fetcher('/api/market/images/../../app.sqlite',{cookie:f.cookies[2]})).status,404);
 assert.equal((await f.fetcher('/api/market/images/'+image.id+'/edit',{cookie:f.cookies[2],body:{base64:png().toString('base64')}})).status,404);
});
test('large frozen HTTP approval batches fit the bounded envelope and exclude newly uploaded images',async t=>{const f=await fixture(t),db=openDatabase(f.file),ids=[],bytes=png();
 try{const insert=db.prepare("INSERT INTO market_images(id,author_id,author_name,mime,bytes,width,height,buckets_json,weekdays_json,version,status,created_at,approved_by,approved_at) VALUES(?,?,?,'image/png',?,2,2,'[\"crash\"]','[1]',1,'pending',?,NULL,NULL)");
  for(let i=0;i<200;i++){const user=f.users[1+Math.floor(i/100)],id=request();ids.push(id);insert.run(id,user.id,user.displayName,bytes,new Date().toISOString());}
 }finally{db.close();}
 const listed=await (await f.fetcher('/api/admin/market/images?buckets=crash&weekdays=1',{cookie:f.cookies[0]})).json();assert.equal(listed.total,200);
 const newer=(await (await f.upload(f.cookies[0],{buckets:['crash'],weekdays:[1]})).json()).image;
 const batch={requestId:request(),confirmed:true,images:listed.images.map(image=>({id:image.id,version:image.version}))};assert.ok(Buffer.byteLength(JSON.stringify(batch))>8192);
 const result=await f.fetcher('/api/admin/market/images/approve',{cookie:f.cookies[0],body:batch});assert.equal(result.status,200);assert.equal((await result.json()).approved,200);
 const pending=await (await f.fetcher('/api/admin/market/images',{cookie:f.cookies[0]})).json();assert.equal(pending.total,1);assert.equal(pending.images[0].id,newer.id);
 const replay=await f.fetcher('/api/admin/market/images/approve',{cookie:f.cookies[0],body:batch});assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
});

const {createClient}=require('./helpers/market-client.cjs'),R=require('../public/market-rules');
const clientSource=()=>fs.readFileSync(path.join(__dirname,'../public/market.js'),'utf8');
async function eventually(predicate){const until=performance.now()+5000;while(!predicate()){if(performance.now()>until)throw Error('HTTP-backed client did not settle');await new Promise(resolve=>setTimeout(resolve,2));}}
test('real HTTP rate-limited upload retries preserve one frozen request and never duplicate a committed image',async t=>{const f=await fixture(t),events=[],realNow=Date.now;let offset=0,dropReplies=true;Date.now=()=>realNow()+offset;
 try{
  const transport=async(url,options={})=>{const r=await fetch(f.base+url,{...options,headers:{...options.headers,Cookie:f.cookies[1]}});if(url==='/api/market/images'&&options.method==='POST'){events.push({id:JSON.parse(options.body).requestId,status:r.status});if(r.ok&&dropReplies){await r.text();throw Error('synthetic committed upload response lost');}}return r;};
  const client=await createClient({source:clientSource(),rules:R,fetch:transport,hash:'#uploads'});await eventually(()=>!client.inspect().gallery.mineBusy);
  const bytes=png();await client.file({name:'same.png',type:'image/png',size:bytes.length,bytes,width:2,height:2});client.check('#uploadBuckets',['crash']);client.check('#uploadWeekdays',[1]);
  for(let i=0;i<7;i++)await client.upload();assert.deepEqual(events.map(event=>event.status),[200,200,200,200,200,200,429]);
  const frozen=client.inspect().gallery.uploadAttempt;assert.ok(frozen,'429 must not discard an already-ambiguous upload');assert.equal(frozen.payload.requestId,events[0].id);
  let mine=await (await f.fetcher('/api/market/images/mine',{cookie:f.cookies[1]})).json();assert.equal(mine.images.length,1);
  offset=61000;dropReplies=false;await client.upload();assert.equal(events.at(-1).status,200);assert.equal(new Set(events.map(event=>event.id)).size,1);assert.equal(client.inspect().gallery.uploadAttempt,null);
  mine=await (await f.fetcher('/api/market/images/mine',{cookie:f.cookies[1]})).json();assert.equal(mine.images.length,1);assert.match(client.node('#uploadStatus').textContent,/投稿已送出/);
 }finally{Date.now=realNow;}
});
test('real HTTP rate-limited approval retries preserve the original frozen batch and leave new uploads pending',async t=>{const f=await fixture(t),first=(await (await f.upload(f.cookies[1])).json()).image,events=[],realNow=Date.now;let offset=0,dropReplies=true;Date.now=()=>realNow()+offset;
 try{
  const transport=async(url,options={})=>{const r=await fetch(f.base+url,{...options,headers:{...options.headers,Cookie:f.cookies[0]}});if(url==='/api/admin/market/images/approve'&&options.method==='POST'){events.push({input:JSON.parse(options.body),status:r.status});if(r.ok&&dropReplies){await r.text();throw Error('synthetic committed approval response lost');}}return r;};
  const client=await createClient({source:clientSource(),rules:R,fetch:transport,hash:'#admin'});await eventually(()=>!client.inspect().gallery.reviewBusy&&client.inspect().gallery.review);
  client.node('#approveFiltered').onclick();const frozen=client.inspect().gallery.approval;assert.deepEqual(frozen.images,[{id:first.id,version:1}]);
  for(let i=0;i<31;i++)await client.node('#confirmApproval').onclick();assert.equal(events.length,31);assert.equal(events.at(-1).status,429);
  const retry=client.inspect().gallery.approval;assert.equal(retry.uncertain,true);assert.equal(retry.invalid,false);assert.deepEqual(retry.images,frozen.images);assert.equal(retry.requestId,frozen.requestId);
  client.node('#cancelApproval').onclick();assert.equal(client.node('#resumeApproval').hidden,false);
  const newer=(await (await f.upload(f.cookies[1])).json()).image;offset=61000;dropReplies=false;await client.node('#refreshReview').onclick();client.node('#resumeApproval').onclick();await client.node('#confirmApproval').onclick();
  assert.equal(events.at(-1).status,200);assert.equal(new Set(events.map(event=>event.input.requestId)).size,1);for(const event of events)assert.deepEqual(event.input.images,frozen.images);
  const pending=await (await f.fetcher('/api/admin/market/images',{cookie:f.cookies[0]})).json();assert.equal(pending.total,1);assert.equal(pending.images[0].id,newer.id);assert.equal(client.inspect().gallery.approval,null);
 }finally{Date.now=realNow;}
});
