const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('shared room API preserves room codes, login return paths, and kicked handling',async()=>{
 const requests=[];
 let reply={ok:true,status:200,body:{phase:'waiting'}};
 let redirect=null,kicked=0;
 const context={
  window:{},
  location:{replace:url=>{redirect=url;}},
  fetch:async(url,options)=>{requests.push({url,options});return {ok:reply.ok,status:reply.status,json:async()=>reply.body};}
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'public','shared','api.js'),'utf8'),context);
 const options={code:'ABC123',room:'gift',session:{code:'ABC123'},onKicked:()=>{kicked++;}};
 assert.equal((await context.window.RoomApi.request('state',undefined,options)).phase,'waiting');
 assert.equal(requests[0].url,'/api/state?code=ABC123');
 await context.window.RoomApi.request('action',{action:'start'},options);
 assert.equal(requests[1].options.method,'POST');
 assert.equal(JSON.parse(requests[1].options.body).code,'ABC123');

 reply={ok:false,status:401,body:{code:'LOGIN_REQUIRED',error:'請先登入'}};
 await assert.rejects(context.window.RoomApi.request('state',undefined,options),/請先登入/);
 assert.equal(redirect,'/login?next=%2Fgift%2FABC123');
 reply={ok:false,status:403,body:{code:'KICKED',error:'已被移出房間'}};
 await assert.rejects(context.window.RoomApi.request('state',undefined,options),/已被移出房間/);
 assert.equal(kicked,1);
});
