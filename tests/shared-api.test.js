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
  fetch:async(url,options)=>{requests.push({url,options});return {ok:reply.ok,status:reply.status,text:async()=>JSON.stringify(reply.body)};}
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
 const context={window:{GameShell:{showHistoryWarning:warning=>notices.push(warning)}},location:{},fetch:async()=>({ok:true,text:async()=>JSON.stringify(body)})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','shared','api.js'),'utf8'),context);
 const options={code:'ABC123',room:'draw'};
 await context.window.RoomApi.request('state',undefined,options);
 await context.window.RoomApi.request('state',undefined,options);
 assert.equal(notices.length,2);assert.equal(notices[1].code,'HISTORY_QUOTA');
 body={round:1,version:3};await context.window.RoomApi.request('draw/canvas',undefined,options);assert.equal(notices.length,2);
 body={phase:'drawing',players:[]};await context.window.RoomApi.request('state',undefined,options);assert.equal(notices.length,3);assert.equal(notices[2],undefined);
});

function transportHarness(fetch){
 const events=[];
 const context={window:{GameShell:{disconnected:()=>events.push('disconnected'),showHistoryWarning:warning=>events.push(['history',warning])},RoomReconnect:{forget:code=>events.push(['forget',code])}},location:{replace:url=>events.push(['redirect',url])},fetch};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','shared','api.js'),'utf8'),context);
 return {api:context.window.RoomApi,context,events};
}
const roomOptions={code:'A B',room:'race',session:{code:'A B'}};

for(const [status,body] of [[400,''],[401,'<html>login</html>'],[429,'not JSON'],[500,''],[503,'<html>unavailable</html>']])test('HTTP '+status+' keeps status with empty/non-JSON body and performs only applicable room effects',async()=>{
 let calls=0,reads=0;
 const {api,events}=transportHarness(async()=>{calls++;return {ok:false,status,text:async()=>{reads++;return body;}};});
 await assert.rejects(api.request('state',undefined,roomOptions),error=>{
  assert.equal(error.status,status);assert.equal(error.kind,'http');assert.equal(error.code,undefined);assert.equal(error.details,null);assert.match(error.message,new RegExp('HTTP '+status));
  assert.equal(!!error.cause,!!body);return true;
 });
 assert.equal(calls,1);assert.equal(reads,1);
 assert.deepEqual(events,status===401?[['redirect','/login?next=%2Frace%2FA%20B']]:status>=500?['disconnected']:[]);
});

test('requestJson is UI-free and preserves JSON error details, status, and server code',async()=>{
 const details={code:'DRAW_RATE_LIMIT',error:'稍後再試',retryAfter:300,quota:{usedPoints:10}};
 const {api,events}=transportHarness(async()=>new Response(JSON.stringify(details),{status:429}));
 await assert.rejects(api.requestJson('/api/draw/stroke',{method:'POST',body:'{}'}),error=>{
  assert.equal(error.status,429);assert.equal(error.code,details.code);assert.equal(error.message,details.error);
  assert.deepEqual(JSON.parse(JSON.stringify(error.details)),details);return true;
 });
 assert.deepEqual(events,[]);
});

test('transport keeps successful JSON types and defines empty and whitespace bodies as null',async()=>{
 const {api,context,events}=transportHarness();
 for(const body of ['', ' \n ', 'null', 'false', '0', '"text"', '[]', '{"value":1}']){
  context.fetch=async()=>new Response(body,{status:200});
  assert.equal(JSON.stringify(await api.requestJson('/api/example')),JSON.stringify(body.trim()?JSON.parse(body):null));
 }
 context.fetch=async()=>new Response(null,{status:204});
 assert.equal(await api.request('action',{},roomOptions),null);
 assert.deepEqual(events,[]);
});

test('invalid success JSON is a response failure with status and cause, never an HTTP or network error',async()=>{
 const {api,events}=transportHarness(async()=>new Response('<html>proxy</html>',{status:200}));
 await assert.rejects(api.request('state',undefined,roomOptions),error=>{
  assert.equal(error.status,200);assert.equal(error.code,'INVALID_JSON');assert.equal(error.kind,'response');assert.equal(error.cause.name,'SyntaxError');assert.match(error.message,/JSON/);return true;
 });
 assert.deepEqual(events,['disconnected']);
});

test('body-read failure retains HTTP classification on errors and response classification on success',async()=>{
 const broken=TypeError('body interrupted');
 const {api,context,events}=transportHarness();
 for(const status of [200,401,503]){
  context.fetch=async()=>({ok:status===200,status,text:async()=>{throw broken;}});
  await assert.rejects(api.request('state',undefined,roomOptions),error=>{
   assert.equal(error.status,status);assert.equal(error.kind,status===200?'response':'http');assert.equal(error.cause,broken);return true;
  });
 }
 assert.deepEqual(events,['disconnected',['redirect','/login?next=%2Frace%2FA%20B'],'disconnected']);
});

test('fetch failures retain their identity without invented HTTP status or retries',async()=>{
 const failure=TypeError('network interrupted');let calls=0;
 const {api,events}=transportHarness(async()=>{calls++;throw failure;});
 await assert.rejects(api.request('action',{action:'start'},roomOptions),error=>error===failure&&error.status===undefined);
 assert.equal(calls,1);assert.deepEqual(events,['disconnected']);
});

test('fetch and body AbortError preserve identity and suppress redirects, kicks, history, and disconnects',async()=>{
 const aborted=new DOMException('cancelled','AbortError');
 const {api,context,events}=transportHarness();
 for(const status of [200,401,403,503]){
  context.fetch=async()=>({ok:status===200,status,text:async()=>{throw aborted;}});
  await assert.rejects(api.request('state',undefined,{...roomOptions,onKicked:()=>events.push('kicked')}),error=>error===aborted);
 }
 context.fetch=async()=>{throw aborted;};
 await assert.rejects(api.request('action',{},roomOptions),error=>error===aborted);
 assert.deepEqual(events,[]);
});

test('an aborted late body cannot apply stale room or history side effects',async()=>{
 for(const [status,result] of [[200,{players:[],phase:'waiting',historyWarning:{code:'OLD'}}],[401,{code:'LOGIN_REQUIRED'}],[403,{code:'KICKED'}],[404,{code:'ROOM_NOT_FOUND'}]]){
  const controller=new AbortController();let resolveBody,bodyStarted;
  const started=new Promise(resolve=>{bodyStarted=resolve;});
  const {api,events}=transportHarness(async()=>({ok:status===200,status,text:()=>{bodyStarted();return new Promise(resolve=>{resolveBody=resolve;});}}));
  const pending=api.request('state',undefined,{...roomOptions,signal:controller.signal,onKicked:()=>events.push('kicked')});
  await started;controller.abort();resolveBody(JSON.stringify(result));
  await assert.rejects(pending,error=>error===controller.signal.reason);
  assert.deepEqual(events,[]);
 }
});

test('room side effects keep disconnect, login, kick, forget, redirect ordering and session guards',async()=>{
 const {api,context,events}=transportHarness();
 const options={...roomOptions,onKicked:()=>events.push('kicked')};
 for(const [status,code] of [[401,'KICKED'],[500,'ROOM_NOT_FOUND'],[403,'NOT_SEATED']]){
  context.fetch=async()=>new Response(JSON.stringify({code,error:'server message'}),{status});
  await assert.rejects(api.request('state',undefined,options),error=>error.status===status&&error.code===code);
 }
 assert.deepEqual(events,[['redirect','/login?next=%2Frace%2FA%20B'],'kicked','disconnected',['forget','A B'],['redirect','/?closedRoom=A%20B&game=thunder'],['forget','A B'],['redirect','/?closedRoom=A%20B&game=thunder']]);
 events.length=0;
 for(const [status,code] of [[401,'LOGIN_REQUIRED'],[403,'KICKED'],[404,'ROOM_NOT_FOUND'],[403,'NOT_SEATED']]){
  context.fetch=async()=>new Response(JSON.stringify({code}),{status});
  await assert.rejects(api.request('state',undefined,{...options,session:null}));
 }
 assert.deepEqual(events,[]);
});

test('POST transport never amplifies duplicate submissions or retries ambiguous results; payload IDs stay unchanged',async()=>{
 const requests=[];let reply=()=>Promise.reject(new TypeError('ACK lost'));
 const {api}=transportHarness(async(url,options)=>{requests.push({url,options});return reply();});
 const payload={code:'OVERRIDE',action:'stroke',requestId:'same-request',strokeId:'same-stroke',batchId:'same-batch',round:1,canvasEpoch:'same-epoch'};
 const send=()=>api.request('draw/stroke',payload,roomOptions);
 const first=send(),second=send();
 await Promise.all([assert.rejects(first,/ACK lost/),assert.rejects(second,/ACK lost/)]);
 assert.equal(requests.length,2,'each explicit call sends once, even if the server may have accepted it');
 reply=async()=>new Response('{"code":"DRAW_RATE_LIMIT","error":"slow"}',{status:429});
 await assert.rejects(send(),error=>error.status===429);assert.equal(requests.length,3);
 reply=async()=>{throw new DOMException('timeout','TimeoutError');};
 await assert.rejects(send(),error=>error.name==='TimeoutError');assert.equal(requests.length,4);
 reply=async()=>new Response('{"duplicate":true,"version":2}',{status:200});
 assert.equal((await send()).duplicate,true);assert.equal(requests.length,5);
 for(const request of requests){assert.equal(request.url,'/api/draw/stroke');assert.equal(request.options.method,'POST');assert.equal(request.options.headers['Content-Type'],'application/json');assert.deepEqual(JSON.parse(request.options.body),payload);}
});

test('request encoding errors do not send or falsely report a lost connection',async()=>{
 let calls=0;const {api,events}=transportHarness(async()=>{calls++;});
 const circular={};circular.self=circular;
 await assert.rejects(api.request('action',circular,roomOptions),/circular/i);
 assert.equal(calls,0);assert.deepEqual(events,[]);
});

test('full-state action results publish history warnings while normal acknowledgments leave them alone',async()=>{
 const {api,context,events}=transportHarness();
 const warning={code:'HISTORY_QUOTA',message:'已暫停操作'};
 for(const body of [{players:[],phase:'waiting',historyWarning:warning},{version:1},{players:[],phase:'waiting'}]){
  context.fetch=async()=>new Response(JSON.stringify(body));await api.request('action',{},roomOptions);
 }
 assert.deepEqual(JSON.parse(JSON.stringify(events)),[['history',warning],['history',null]]);
});

test('cancellation between transport settlement and RoomApi continuation suppresses stale effects',async()=>{
 for(const [status,result] of [[200,{players:[],phase:'waiting'}],[401,{code:'LOGIN_REQUIRED'}],[403,{code:'KICKED'}],[404,{code:'ROOM_NOT_FOUND'}],[503,{code:'UNAVAILABLE'}]]){
  const controller=new AbortController();
  const {api,events}=transportHarness(async()=>({ok:status===200,status,text:async()=>{
   queueMicrotask(()=>queueMicrotask(()=>controller.abort()));return JSON.stringify(result);
  }}));
  await assert.rejects(api.request('state',undefined,{...roomOptions,signal:controller.signal,onKicked:()=>events.push('kicked')}),error=>error===controller.signal.reason);
  assert.deepEqual(events,[]);
 }
});

test('signal timeout keeps its reason and disconnect notification rather than becoming a silent abort',async()=>{
 const controller=new AbortController(),timeout=new DOMException('request deadline','TimeoutError');
 const {api,events}=transportHarness(async()=>({ok:true,status:200,text:async()=>{controller.abort(timeout);return '{}';}}));
 await assert.rejects(api.request('state',undefined,{...roomOptions,signal:controller.signal}),error=>error===timeout);
 assert.deepEqual(events,['disconnected']);
});
