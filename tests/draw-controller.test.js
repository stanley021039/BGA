const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/draw-controller.js'),'utf8');
function fixture(){
 const timers=new Map(),repeaters=new Map(),requests=[],recoveries=[],sources=[],accepted=[],failures=[],work=[];let nextId=0,ticks=0;
 const state={room:'ABC123',session:{},busy:false,epoch:'epoch-a',round:1,version:0};
 const context=vm.createContext({window:{},AbortController,DOMException,setTimeout,clearTimeout,setInterval,clearInterval});vm.runInContext(source,context);
 const controller=context.window.DrawController.create({context:()=>state,restoreSession:(room,options)=>new Promise((resolve,reject)=>recoveries.push({room,signal:options.signal,resolve,reject})),onRestored:session=>{state.session=session;accepted.push(['restored',session]);},request:(route,_data,options)=>new Promise((resolve,reject)=>requests.push({route,signal:options.signal,resolve,reject})),receive:next=>accepted.push(['state',next]),applySnapshot:(next,reset)=>accepted.push(['canvas',next,reset]),receiveStroke:next=>accepted.push(['stroke',next]),onSyncError:error=>failures.push(error),onPollError:error=>failures.push(error),onStreamReady:()=>work.push('ready'),onStreamError:()=>work.push('error'),cancelWork:()=>work.push('cancel'),tick:()=>ticks++,createStream:url=>{const handlers=new Map(),stream={url,closed:0,addEventListener:(name,fn)=>handlers.set(name,fn),close(){this.closed++;},emit(name,data){handlers.get(name)?.({data:JSON.stringify(data)});}};sources.push(stream);return stream;},setTimer:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),setRepeater:(fn,ms)=>{const id=++nextId;repeaters.set(id,{fn,ms});return id;},clearRepeater:id=>repeaters.delete(id)});
 return {controller,state,timers,repeaters,requests,recoveries,sources,accepted,failures,work,ticks:()=>ticks};
}
const canvas=(version=1,epoch='epoch-a',round=1)=>({canvasEpoch:epoch,round,version,strokes:[]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('start/dispose are repeatable, own one pair of intervals and close the stream once',async()=>{
 const f=fixture(),c=f.controller;c.start();c.start();assert.deepEqual([...f.repeaters.values()].map(x=>x.ms),[1000,250]);
 c.connectEvents();c.connectEvents();assert.equal(f.sources.length,1);assert.equal(f.sources[0].url,'/api/draw/events?code=ABC123');
 const oldTimers=[...f.repeaters.values()];oldTimers[1].fn();assert.equal(f.ticks(),1);
 const sync=c.syncCanvas(),poll=c.poll();assert.equal(f.requests.length,2);assert.equal(f.timers.size,1);
 c.dispose();c.dispose();await Promise.all([sync,poll]);assert.equal(f.repeaters.size,0);assert.equal(f.timers.size,0);assert.equal(f.sources[0].closed,1);assert.deepEqual(f.work,['cancel']);assert.ok(f.requests.every(x=>x.signal.aborted));
 c.start();c.start();c.connectEvents();assert.equal(f.repeaters.size,2);assert.equal(f.sources.length,2);
 for(const timer of oldTimers)timer.fn();assert.equal(f.ticks(),1);assert.equal(f.requests.length,2,'queued old interval callbacks cannot issue new reads');
 f.sources[0].emit('stroke',canvas());f.sources[0].emit('reset',canvas());f.sources[0].emit('ready',canvas());f.sources[0].emit('error');assert.deepEqual(f.accepted,[]);assert.deepEqual(f.work,['cancel']);
 f.sources[1].emit('ready',canvas(0));assert.deepEqual(f.work,['cancel','ready']);c.dispose();
});

test('late disposed poll success, failure and finally cannot mutate or release a restarted poll',async()=>{
 for(const reject of [false,true]){
  const f=fixture(),c=f.controller;c.start();const old=c.poll();c.dispose();c.start();const current=c.poll();await old;
  if(reject)f.requests[0].reject(Error('old failure'));else f.requests[0].resolve({version:99});await flush();
  await c.poll();assert.equal(f.requests.length,2);assert.deepEqual(f.accepted,[]);assert.deepEqual(f.failures,[]);
  f.requests[1].resolve({version:2});await current;assert.deepEqual(f.accepted,[['state',{version:2}]]);c.dispose();
 }
});

test('canvas timeout is one ten-second read without retry and later results do not apply',async()=>{
 const f=fixture(),c=f.controller;c.start();const pending=c.syncCanvas();assert.equal(c.syncCanvas(),pending);assert.equal([...f.timers.values()][0].ms,10000);
 [...f.timers.values()][0].fn();await pending;assert.equal(f.requests.length,1);assert.equal(f.requests[0].signal.aborted,true);assert.equal(f.failures[0].name,'TimeoutError');assert.equal(c.pendingSync,null);assert.equal(f.timers.size,0);
 f.requests[0].resolve(canvas());await flush();assert.deepEqual(f.accepted,[]);c.dispose();
});

test('cancel permits an independent read and old completion cannot clear its pending identity',async()=>{
 const f=fixture(),c=f.controller;c.start();const old=c.syncCanvas();c.cancel();const current=c.syncCanvas();await old;
 assert.equal(c.pendingSync,current);assert.equal(f.requests[0].signal.aborted,true);f.requests[0].resolve(canvas(999));await flush();assert.deepEqual(f.accepted,[]);assert.equal(c.pendingSync,current);
 f.requests[1].resolve(canvas(2));await current;assert.equal(f.accepted[0][1].version,2);assert.equal(c.pendingSync,null);c.dispose();
});

test('round, epoch and room transitions reject old results; current-room streams keep canvas validation delegated',async()=>{
 for(const change of [{round:2},{epoch:'epoch-b'},{room:'DEF456'},{session:null}]){
  const f=fixture(),c=f.controller;c.start();const pending=c.syncCanvas(),poll=c.poll();c.connectEvents();Object.assign(f.state,change);
  f.requests[0].resolve(canvas());f.requests[1].resolve({version:99});await Promise.all([pending,poll]);assert.deepEqual(f.accepted,[]);assert.deepEqual(f.failures,[]);
  if(change.room||change.session===null){f.sources[0].emit('stroke',canvas());assert.deepEqual(f.accepted,[]);}c.dispose();
 }
});

test('two controllers keep pending reads, stream events, timers and disposal isolated',async()=>{
 const a=fixture(),b=fixture();a.controller.start();b.controller.start();a.controller.connectEvents();b.controller.connectEvents();
 const first=a.controller.syncCanvas(),second=b.controller.syncCanvas();a.controller.dispose();await first;
 assert.equal(b.requests[0].signal.aborted,false);assert.equal(b.timers.size,1);assert.equal(b.repeaters.size,2);assert.equal(b.sources[0].closed,0);
 b.sources[0].emit('stroke',canvas(3));b.requests[0].resolve(canvas(4));await second;assert.equal(b.accepted.length,2);assert.deepEqual(a.accepted,[]);b.controller.dispose();
});

test('phase cancellation can preserve a canvas read while still cancelling input/playback work',async()=>{
 const f=fixture(),c=f.controller;c.start();const pending=c.syncCanvas();c.cancel({cancelSync:false});assert.deepEqual(f.work,['cancel']);assert.equal(f.requests[0].signal.aborted,false);assert.equal(c.pendingSync,pending);
 f.requests[0].resolve(canvas());await pending;assert.equal(f.accepted.length,1);c.dispose();
});

test('initial reconnect is cancellable and its late completion cannot overwrite a restarted restore',async()=>{
 const f=fixture(),c=f.controller;f.state.session=null;c.start();const old=c.restore();assert.equal(c.restore(),old);assert.equal(f.recoveries.length,1);
 c.dispose();assert.equal(f.recoveries[0].signal.aborted,true);c.start();const current=c.restore();await old;
 f.recoveries[0].resolve({code:'ABC123',id:'old'});await flush();assert.equal(f.state.session,null);assert.deepEqual(f.accepted,[]);assert.equal(c.restore(),current);
 const session={code:'ABC123',id:'new'};f.recoveries[1].resolve(session);await current;assert.equal(f.state.session,session);assert.equal(f.requests.length,1);assert.equal(f.requests[0].route,'state');c.dispose();await flush();assert.deepEqual(f.failures,[]);
});

test('a reconnect result cannot replace a seat established while recovery was pending',async()=>{
 const f=fixture(),c=f.controller;f.state.session=null;c.start();const restore=c.restore();f.state.session={id:'joined'};
 f.recoveries[0].resolve({id:'old'});await restore;assert.equal(f.state.session.id,'joined');assert.deepEqual(f.accepted,[]);assert.equal(f.requests.length,0);c.dispose();
});
