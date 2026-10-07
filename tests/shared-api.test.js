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
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','shared','api.js'),'utf8'),context);
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
 reply={ok:false,status:429,body:{code:'DRAW_RATE_LIMIT',error:'稍後再試'}};
 await assert.rejects(context.window.RoomApi.request('draw/stroke',{points:[[1,1]]},options),error=>error.message==='稍後再試'&&error.status===429&&error.code==='DRAW_RATE_LIMIT');
});

test('optional room API cancellation reaches fetch and avoids disconnecting for a stale-context abort',async()=>{
 const controller=new AbortController();let seenSignal,disconnects=0;
 const aborted=Object.assign(new Error('stale context'),{name:'AbortError'});
 const context={window:{GameShell:{disconnected:()=>disconnects++}},location:{},fetch:async(_url,options)=>{seenSignal=options.signal;throw aborted;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','shared','api.js'),'utf8'),context);
 await assert.rejects(context.window.RoomApi.request('draw/stroke',{}, {code:'ABC123',room:'draw',signal:controller.signal}),error=>error===aborted);
 assert.equal(seenSignal,controller.signal);assert.equal(disconnects,0);
 context.fetch=async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});};
 await assert.rejects(context.window.RoomApi.request('draw/stroke',{}, {code:'ABC123',room:'draw',signal:controller.signal}),/timeout/);
 assert.equal(disconnects,1);
});

test('history warnings survive unchanged state polls and clear after recovery, without canvas acknowledgments clearing them',async()=>{
 const notices=[];let body={phase:'drawing',players:[],historyWarning:{code:'HISTORY_QUOTA',message:'已暫停操作'}};
 const context={window:{GameShell:{showHistoryWarning:warning=>notices.push(warning)}},location:{},fetch:async()=>({ok:true,json:async()=>body})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','shared','api.js'),'utf8'),context);
 const options={code:'ABC123',room:'draw'};
 await context.window.RoomApi.request('state',undefined,options);
 await context.window.RoomApi.request('state',undefined,options);
 assert.equal(notices.length,2);assert.equal(notices[1].code,'HISTORY_QUOTA');
 body={round:1,version:3};await context.window.RoomApi.request('draw/canvas',undefined,options);assert.equal(notices.length,2);
 body={phase:'drawing',players:[]};await context.window.RoomApi.request('state',undefined,options);assert.equal(notices.length,3);assert.equal(notices[2],undefined);
});
