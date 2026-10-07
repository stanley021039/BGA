'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');
const publicDir=path.resolve(__dirname,'../public');

async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-merged-app-')),password='test-'+randomUUID();
 const config={host:'127.0.0.1',port:0,dbFile:path.join(root,'db.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),musicDir:path.join(root,'music'),externalSideEffectsEnabled:false,marketClock:()=>Date.parse('2027-01-04T12:00:00Z')};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('merge_app_owner',password);db.close();
 const app=createApp(config),base='http://127.0.0.1:'+(await app.listen()).port;
 t.after(async()=>{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('bga-merged-app-'));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'merge_app_owner',password})});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],user=await login.json();
 const get=(route,anonymous=false)=>fetch(base+route,{headers:anonymous?{}:{Cookie:cookie},redirect:'manual'});
 const post=async(route,data)=>{const response=await fetch(base+route,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};};
 return {get,post,user};
}

test('merged app serves every HTML script and stylesheet, market entry and game sound assets together',async t=>{
 const f=await fixture(t),resources=new Set(),pages=fs.readdirSync(publicDir).filter(file=>file.endsWith('.html'));
 for(const file of pages){
  const route=file==='index.html'?'/':'/'+file.slice(0,-5),response=await f.get(route);
  assert.equal(response.status,200,route);assert.match(response.headers.get('content-type'),/^text\/html/,route);
  const html=await response.text();
  for(const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"|<link\b[^>]*\bhref="([^"]+)"/g)){
   const url=match[1]||match[2];if(url.startsWith('/')&&/\.(?:js|css)(?:\?|$)/.test(url))resources.add(url);
  }
  if(file==='index.html'){
   assert.match(html,/<a class="game-tile market-tile" href="\/market">/);
   assert.match(html,/<div class="library-count"><strong>06<\/strong>/);
   assert.match(html,/<script src="\/shared\/expression-sounds\.js"><\/script>/);
  }
 }
 for(const route of resources){
  const response=await f.get(route);assert.equal(response.status,200,route);
  assert.match(response.headers.get('content-type'),route.split('?')[0].endsWith('.css')?/^text\/css/:/^text\/javascript/,route);
  assert.ok((await response.text()).length>0,route);
 }
 for(const name of ['turn','correct','dice-roll','shot','slam','nitro','skid']){
  const route='/assets/game-sounds/'+name+'.wav',response=await f.get(route,true);
  assert.equal(response.status,200,route);assert.equal(response.headers.get('content-type'),'audio/wav',route);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(publicDir,route)),route);
 }
 const version=await f.get('/api/version',true);assert.equal(version.status,200);assert.equal(version.headers.get('cache-control'),'no-store');assert.deepEqual(await version.json(),{version:require('../package.json').version});
 for(const route of ['/market','/draw/ABC123']){
  const response=await f.get(route,true);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/login?next='+encodeURIComponent(route));
 }
});

test('nickname and market APIs coexist without changing the canonical account or vote',async t=>{
 const f=await fixture(t),created=await f.post('/api/admin/market/rounds',{requestId:randomUUID(),targetDate:'2027-01-06',confirmed:true});
 assert.equal(created.status,200);const roundId=created.body.roundId;
 const vote=await f.post('/api/market/vote',{requestId:randomUUID(),roundId,optionId:'rally',expectedRevision:0});assert.equal(vote.status,200);
 const before=await (await f.get('/api/market')).json(),renamed=await f.post('/api/profile/name',{displayName:'新的冥燈'});
 assert.equal(renamed.status,200);assert.equal(renamed.body.id,before.me.id);assert.equal(renamed.body.username,before.me.username);
 const after=await (await f.get('/api/market')).json();assert.equal(after.me.id,before.me.id);assert.equal(after.me.displayName,'新的冥燈');
 assert.deepEqual(after.rounds,before.rounds);assert.deepEqual(after.stats,before.stats);assert.deepEqual(after.ledger,before.ledger);
 assert.equal((await f.get('/api/market/vote')).status,405);
});
