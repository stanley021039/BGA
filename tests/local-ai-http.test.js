const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db/index'),{createAuth}=require('../src/auth/index');
test('authenticated host can add test AI to every supported room, with real scheduling and canvas SSE',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-test-ai-'));
 const config={port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false};
 const db=openDatabase(config.dbFile);await createAuth(db).bootstrap('aiadmin','test-password-123');db.close();
 const app=createApp(config);let stream;
 try{
  const {port}=await app.listen(),base=`http://127.0.0.1:${port}`;
  const post=async(route,cookie,data)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const login=await post('auth/login',null,{username:'aiadmin',password:'test-password-123'}),admin=login.cookie;
  const invite=await post('admin/invites',admin,{days:1});
  const guest=(await post('auth/register',null,{username:'aiguest',password:'test-password-123',confirmPassword:'test-password-123',invite:invite.body.code})).cookie;
  const state=async code=>{const response=await fetch(base+'/api/state?code='+code,{headers:{Cookie:admin}});assert.equal(response.status,200);return response.json();};
  const until=async(code,predicate)=>{for(let i=0;i<50;i++){const s=await state(code);if(predicate(s))return s;await delay(200);}assert.fail('AI did not progress within 10 seconds');};
  for(const type of ['poker','majority','gift','draw']){
   const created=await post('create',admin,{type}),code=created.body.code;assert.equal(created.status,200);
   assert.equal((await post('bot',null,{code})).status,401);
   assert.equal((await post('join',guest,{code})).status,200);
   assert.equal((await post('bot',guest,{code})).status,400);
   const added=await post('bot',admin,{code});assert.equal(added.status,200);assert.equal(added.body.players.filter(p=>p.bot).length,1);assert.equal(added.body.botSupport.supported,true);
   const bot=added.body.players.find(p=>p.bot);assert.equal(bot.online,true);
   assert.equal((await post('kick',admin,{code,playerId:bot.id,confirmed:true})).status,200);
   assert.equal((await state(code)).players.some(p=>p.id===bot.id),false);
   assert.equal((await post('leave',guest,{code})).status,200);
   await post('bot',admin,{code});if(type==='majority'||type==='gift')await post('bot',admin,{code});
   if(type==='majority'){
    assert.equal((await post('start',admin,{code})).status,200);
    assert.equal((await post('action',admin,{code,action:'ask',type:'two',prompt:'選一個',options:['一','二']})).status,200);
    const answered=await until(code,s=>s.answeredIds.length===2);assert.equal(answered.phase,'answering');assert.equal(answered.answers,undefined);
    assert.equal((await post('action',admin,{code,action:'answer',answer:0})).body.phase,'reveal');
   }
   assert.equal((await post('leave',admin,{code})).body.deleted,true);
  }
  // A one-word public custom bank makes this test independent of random guesses.
  const word=await post('draw/words',admin,{title:'測試星星',difficulty:'easy',topic:'nature',aliases:[]});assert.equal(word.status,200);
  const created=await post('create',admin,{type:'draw',topics:['custom']}),code=created.body.code;
  await post('bot',admin,{code});let s=(await post('start',admin,{code})).body;
  s=(await post('action',admin,{code,action:'choose',questionId:s.candidates[0].id})).body;
  const stroke=await post('draw/stroke',admin,{code,round:s.round,canvasEpoch:s.canvasEpoch,batchId:'12345678',strokeId:'12345678',tool:'line',color:'#273942',size:5,points:[[100,100],[200,150]]});assert.equal(stroke.status,200);
  await until(code,s=>s.phase==='reveal');
  const next=await post('action',admin,{code,action:'next'});assert.equal(next.status,200);
  stream=new AbortController();const response=await fetch(base+'/api/draw/events?code='+code,{headers:{Cookie:admin},signal:stream.signal});assert.equal(response.status,200);
  const reader=response.body.getReader(),decoder=new TextDecoder();let received='';
  const timer=setTimeout(()=>stream.abort(),10000);
  try{while(!received.includes('event: stroke')){const result=await reader.read();assert.equal(result.done,false);received+=decoder.decode(result.value);}}finally{clearTimeout(timer);await reader.cancel();}
  assert.match(received,/"canvasEpoch"/);s=await until(code,s=>s.phase==='drawing'&&s.strokeVersion>next.body.strokeVersion);
  assert.equal(s.players.find(p=>p.id===s.presenterId).bot,true);assert.equal(s.question,null);
  await post('leave',admin,{code});
  assert.ok(fs.readdirSync(config.historyDir).filter(file=>file.endsWith('.jsonl')).some(file=>fs.readFileSync(path.join(config.historyDir,file),'utf8').includes('"source":"bot"')));
 }finally{stream?.abort();await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
