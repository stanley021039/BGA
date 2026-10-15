const {createApp}=require('../../src/app');
const {openDatabase}=require('../../src/db');
const {createAuth}=require('../../src/auth');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto');
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-transitions-')),dbFile=path.join(root,'db.sqlite'),password=randomBytes(18).toString('hex'),db=openDatabase(dbFile);try{await createAuth(db).bootstrap('transition_qa',password);}finally{db.close();}
 const app=createApp({host:'127.0.0.1',port:0,dbFile,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),musicDir:path.join(root,'music'),historyLimits:{maxMatchBytes:1},externalSideEffectsEnabled:false,marketAutomationEnabled:false,achievementPurpose:'test',githubClient:{configured:false}});
 try{const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  async function req(route,data,cookie){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
  const owner=(await req('auth/login',{username:'transition_qa',password})).cookie;
  const invite=await req('admin/invites',{},owner),peer=(await req('auth/register',{username:'transition_peer',displayName:'驗收同伴',password,confirmPassword:password,invite:invite.body.code})).cookie;
  const kickRoom=(await req('create',{type:'draw',roomName:'Kick cleanup validation'},owner)).body.code;await req('join',{code:kickRoom},peer);
  const peerState=await (await fetch(base+'/api/state?code='+kickRoom,{headers:{Cookie:peer}})).json();
  assert.equal((await req('kick',{code:kickRoom,playerId:peerState.me},owner)).status,400);
  assert.equal((await req('kick',{code:kickRoom,playerId:peerState.me,confirmed:true},owner)).status,200);
  assert.equal((await req('join',{code:kickRoom},peer)).status,403);
  assert.equal((await req('leave',{code:kickRoom},owner)).body.deleted,true);
  const created=await req('create',{type:'draw',roomName:'History pause leave validation'},owner),code=created.body.code;assert.equal(created.status,200);await req('join',{code},peer);
  const start=await req('start',{code},owner);assert.equal(start.status,429);assert.equal(start.body.code,'HISTORY_QUOTA');
  const left=await req('leave',{code},peer);assert.equal(left.status,200);assert.equal(left.body.historyPersisted,false);assert.equal(left.body.deleted,false);
  const last=await req('leave',{code},owner);assert.equal(last.status,200);assert.equal(last.body.deleted,true);assert.equal(last.body.historyPersisted,false);
  console.log(JSON.stringify({kickConfirmation:true,kickedRejoinBlocked:true,historyQuotaBlocksStart:true,leaveWhilePaused:true,lastSeatCleanup:true,isolatedData:true,port}));
 }finally{await app.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
