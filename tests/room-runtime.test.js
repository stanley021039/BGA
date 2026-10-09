'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {createRoomRuntime}=require('../src/rooms/runtime');
const maps=['rooms','seats','departedSeats','kickedUsers','socialEvents','expressionEvents','barrageEvents','reconnectGrace','drawStreams','musicStreams','musicRooms'];
function timers(t){
 const live=new Set(),set=global.setInterval,clear=global.clearInterval;
 t.mock.method(global,'setInterval',(...args)=>{const handle=set(...args);live.add(handle);return handle;});
 t.mock.method(global,'clearInterval',handle=>{live.delete(handle);return clear(handle);});
 t.after(()=>{for(const handle of live)clear(handle);});return live;
}
test('per-app room ownership is isolated and expiration clears every registry despite history failure',t=>{
 const a=createRoomRuntime(),b=createRoomRuntime();t.after(()=>{a.close();b.close();});
 const room={code:'ABC123',players:[]};
 for(const runtime of [a,b]){
  for(const key of maps.filter(key=>!['drawStreams','musicStreams','reconnectGrace'].includes(key)))runtime[key].set(room.code,key==='rooms'?room:new Map());
  runtime.reconnectGrace.set(room.code+':user',1);runtime.reconnectGrace.set('ABC1234:user',2);
  runtime.watchRooms.get(room,{create:true});runtime.mediaRooms.get(room,{create:true});
 }
 let ended=0;for(const streams of [a.drawStreams,a.musicStreams])streams.set(room.code,new Set([{res:{end(){ended++;}}}]));
 t.mock.method(console,'error',()=>{});a.expireRooms({interrupt(){throw Error('history unavailable');}});
 for(const key of maps)assert.equal(a[key].has(room.code),false,key);
 assert.equal(a.reconnectGrace.has(room.code+':user'),false);assert.equal(a.reconnectGrace.has('ABC1234:user'),true);
 assert.equal(a.watchRooms.get(room),null);assert.equal(a.mediaRooms.get(room),null);assert.equal(ended,2);
 assert.ok(b.rooms.has(room.code));assert.ok(b.watchRooms.get(room));assert.ok(b.mediaRooms.get(room));
});
test('stream disconnect, reconnect and room cleanup release owned timers synchronously',t=>{
 const live=timers(t),runtime=createRoomRuntime();t.after(()=>runtime.close());
 for(const streams of [runtime.drawStreams,runtime.musicStreams]){
  const req=new EventEmitter(),entry={res:{end(){}}},subscribers=new Set([entry]);streams.set('ABC123',subscribers);
  runtime.ownStream(streams,'ABC123',entry,req,setInterval(()=>{},10000));assert.equal(live.size,1);
  req.emit('close');assert.equal(live.size,0);assert.equal(streams.size,0);
  const replacement={res:{end(){}}};streams.set('ABC123',new Set([replacement]));
  runtime.ownStream(streams,'ABC123',replacement,new EventEmitter(),setInterval(()=>{},10000));
  req.emit('close');assert.equal(streams.get('ABC123').size,1);
  runtime.cleanupRoom('ABC123');assert.equal(live.size,0);assert.equal(streams.size,0);
 }
});
test('runtime scheduler starts once, stops repeatedly and releases both timers',t=>{
 const live=timers(t),runtime=createRoomRuntime();runtime.start({history:{}});runtime.start({history:{}});
 assert.equal(live.size,2);runtime.stop();runtime.stop();runtime.close();runtime.close();assert.equal(live.size,0);
 assert.throws(()=>runtime.start({history:{}}),/closed/);
});
test('scheduler acquisition failure releases the earlier timer',t=>{
 const live=timers(t),set=global.setInterval;let calls=0;
 t.mock.method(global,'setInterval',(...args)=>{if(++calls===2)throw Error('timer acquisition failure');return set(...args);});
 const runtime=createRoomRuntime();assert.throws(()=>runtime.start({history:{}}),/timer acquisition failure/);
 runtime.close();assert.equal(live.size,0);
});
test('one broken stream cannot prevent other streams and registries from being released',t=>{
 const live=timers(t),runtime=createRoomRuntime();let ended=0;
 for(const streams of [runtime.drawStreams,runtime.musicStreams]){
  const entry={res:{end(){ended++;if(streams===runtime.drawStreams)throw Error('broken transport');}}};streams.set('ABC123',new Set([entry]));
  runtime.ownStream(streams,'ABC123',entry,new EventEmitter(),setInterval(()=>{},10000));
 }
 assert.throws(()=>runtime.close(),/runtime cleanup failed/);assert.equal(ended,2);assert.equal(live.size,0);
 for(const key of maps)assert.equal(runtime[key].size,0);runtime.close();
});
test('a stream registered by an in-flight request after stop ends immediately',t=>{
 const live=timers(t),runtime=createRoomRuntime();let ended=0;runtime.stop();
 const entry={res:{end(){ended++;}}};runtime.drawStreams.set('ABC123',new Set([entry]));
 runtime.ownStream(runtime.drawStreams,'ABC123',entry,new EventEmitter(),setInterval(()=>{},10000));
 assert.equal(ended,1);assert.equal(live.size,0);assert.equal(runtime.drawStreams.size,0);runtime.close();
});
