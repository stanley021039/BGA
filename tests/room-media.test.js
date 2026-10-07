const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {RoomMedia,RoomMediaRegistry,MAX_QUEUE_ITEMS,MAX_PLAYER_ITEMS,MAX_REQUESTS,REQUEST_TTL_MS}=require('../src/media/room');
const {HttpError}=require('../src/http/errors');
const VIDEO='M7lc1UVf-VE';
function fixture(count=8){
 let now=1000;const members=Array.from({length:count},(_,i)=>({id:randomUUID(),name:'player '+i}));
 const tracks=[{id:randomUUID(),title:'trusted A',duration:10},{id:randomUUID(),title:'trusted B',duration:20}];
 const store={get(id){const track=tracks.find(item=>item.id===id);if(!track)throw new HttpError(404,'MUSIC_NOT_FOUND','missing');return track;}};
 const context={hostId:members[0].id,managerIds:new Set([members[1].id]),members},room=new RoomMedia(()=>now,store);
 room.managed=true;room.reconcile(context);
 const command=(action,extra={})=>({requestId:randomUUID(),roomInstanceId:room.roomInstanceId,playbackSessionId:room.playbackSessionId,expectedRevision:room.revision,action,...extra});
 const act=(index,action,extra={})=>room.act(members[index].id,command(action,extra),context);
 return {room,members,context,tracks,store,command,act,advance:ms=>{now+=ms;},snapshot:index=>room.snapshot(members[index].id,context)};
}
test('all seats enqueue trusted music and named videos into one current and mixed queue',()=>{
 const f=fixture(),initial=f.snapshot(2),first=f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id,title:'spoof',durationSec:999});
 assert.equal(first.current.title,'trusted A');assert.equal(first.current.durationSec,10);assert.equal(first.current.requestedById,f.members[2].id);assert.equal(first.playback.state,'playing');assert.notEqual(first.playbackSessionId,initial.playbackSessionId);assert.equal(first.revision,1);
 const mixed=f.act(3,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'Good video'});assert.equal(mixed.current.type,'music');assert.equal(mixed.queue[0].title,'Good video');assert.equal(mixed.queue[0].videoId,VIDEO);
 f.act(4,'enqueue',{type:'music',trackId:f.tracks[1].id});const next=f.act(1,'skip');assert.equal(next.current.type,'video');assert.equal(next.queue[0].type,'music');assert.equal(next.canControl,true);
 const copy=f.snapshot(2);copy.current.title='corrupt';copy.queue[0].title='corrupt';copy.playback.state='paused';assert.equal(f.room.current.title,'Good video');assert.equal(f.room.queue[0].title,'trusted B');assert.equal(f.room.playback.state,'playing');
});
test('host and manager control transport and members cannot spoof roles or use ended to skip',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});
 for(const action of ['play','pause','seek','skip','remove','reorder','ended','duration','stop'])assert.throws(()=>f.room.act(f.members[2].id,f.command(action,{positionSec:1,durationSec:100,itemId:f.room.current.id,orderIds:[],isHost:true,role:'manager'}),f.context),{code:'MEDIA_MANAGER_ONLY',status:403});
 assert.equal(f.snapshot(0).isHost,true);assert.equal(f.snapshot(1).isManager,true);assert.equal(f.snapshot(2).canControl,false);
 f.advance(3500);f.act(1,'pause');assert.equal(f.room.playback.anchorPositionSec,3.5);f.advance(10000);assert.equal(f.room.position(),3.5);
 f.act(0,'seek',{positionSec:30});assert.equal(f.room.position(),30);f.act(1,'play');f.advance(1500);assert.equal(f.room.position(),31.5);
});
test('music advances lazily across elapsed songs once, while videos never advance from client clocks',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});f.act(3,'enqueue',{type:'music',trackId:f.tracks[1].id});f.act(4,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});
 f.advance(33000);f.room.reconcile(f.context);assert.equal(f.room.current.type,'video');assert.equal(f.room.position(),3);const revision=f.room.revision,session=f.room.playbackSessionId;
 f.room.reconcile(f.context);assert.equal(f.room.revision,revision);assert.equal(f.room.playbackSessionId,session);
 f.act(1,'duration',{durationSec:5,itemId:f.room.current.id});f.advance(10000);f.room.reconcile(f.context);assert.equal(f.room.current.type,'video');assert.equal(f.room.position(),5);
 f.act(1,'ended',{itemId:f.room.current.id});assert.equal(f.room.current,null);assert.equal(f.room.playback.state,'paused');
});
test('request IDs are idempotent for normalized effective payload, even after later commands',()=>{
 const f=fixture(),body=f.command('enqueue',{type:'video',url:`https://youtu.be/${VIDEO}?si=a`,title:' Good video '});
 const sent=f.room.act(f.members[2].id,body,f.context);f.act(1,'pause');
 const duplicate=f.room.act(f.members[2].id,{...body,url:`https://www.youtube.com/watch?v=${VIDEO}`,title:'Good video',role:'host'},f.context);
 assert.equal(duplicate.duplicate,true);assert.equal(duplicate.current.id,sent.current.id);assert.equal(duplicate.playback.state,'paused');assert.equal(f.room.queue.length,0);
 assert.throws(()=>f.room.act(f.members[2].id,{...body,title:'different'},f.context),{code:'MEDIA_REQUEST_REUSED',status:409});
 assert.throws(()=>f.room.act(f.members[2].id,{...body,requestId:randomUUID()},f.context),error=>error.code==='MEDIA_STALE'&&error.mediaState.revision===f.room.revision);
});
test('old session and old room instance commands cannot act on a newly selected item',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});f.act(3,'enqueue',{type:'music',trackId:f.tracks[0].id});
 const ended=f.command('ended',{itemId:f.room.current.id});f.act(1,'skip');
 assert.throws(()=>f.room.act(f.members[1].id,{...ended,expectedRevision:f.room.revision},f.context),{code:'MEDIA_STALE'});
 assert.throws(()=>f.room.act(f.members[1].id,f.command('pause',{roomInstanceId:randomUUID()}),f.context),{code:'MEDIA_STALE'});
 assert.throws(()=>f.act(1,'ended',{itemId:ended.itemId}),{code:'MEDIA_ITEM_NOT_FOUND'});
});
test('reorder requires the entire unique pending set and a current revision; current remains separate',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});f.act(3,'enqueue',{type:'music',trackId:f.tracks[1].id});f.act(4,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});
 const ids=f.room.queue.map(item=>item.id),current=f.room.current.id,stale=f.command('reorder',{orderIds:[...ids].reverse()});
 for(const orderIds of [[ids[0],ids[0]],[ids[0]],[ids[0],randomUUID()],[current,ids[0]]])assert.throws(()=>f.act(0,'reorder',{orderIds}));
 f.act(1,'reorder',{orderIds:[...ids].reverse()});assert.equal(f.room.queue[0].id,ids[1]);assert.equal(f.room.current.id,current);
 assert.throws(()=>f.room.act(f.members[0].id,stale,f.context),{code:'MEDIA_STALE'});
 f.act(1,'remove',{itemId:ids[0]});assert.deepEqual(f.room.queue.map(item=>item.id),[ids[1]]);assert.throws(()=>f.act(0,'remove',{itemId:current}),{code:'MEDIA_ITEM_NOT_FOUND'});
});
test('stop pauses and clears current while preserving queue, and play starts that next item',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});f.act(3,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});
 const stop=f.act(1,'stop');assert.equal(stop.current,null);assert.equal(stop.queue.length,1);assert.equal(stop.playback.state,'paused');assert.equal(f.act(1,'play').current.type,'video');
 f.act(1,'stop');const queued=f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});assert.equal(queued.current,null);assert.equal(queued.queue.length,1);assert.equal(queued.playback.state,'paused');assert.equal(f.act(0,'play').current.type,'music');
});
test('role, host, name and membership changes refresh marker permissions and clear departed queue entries',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});f.act(3,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});
 let before=f.room.revision;f.context.managerIds.delete(f.members[1].id);f.room.reconcile(f.context);assert.ok(f.room.revision>before);assert.equal(f.snapshot(1).canControl,false);
 f.context.managerIds.add(f.members[2].id);f.context.hostId=f.members[1].id;f.members[2].name='New name';before=f.room.revision;f.room.reconcile(f.context);assert.ok(f.room.revision>before);assert.equal(f.snapshot(1).isHost,true);assert.equal(f.room.current.requestedByName,'New name');
 f.context.members=f.members.filter(item=>item.id!==f.members[3].id);f.room.reconcile(f.context);assert.equal(f.room.queue.length,0);assert.throws(()=>f.room.act(f.members[3].id,f.command('enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`}),f.context),{code:'NOT_SEATED'});
});
test('deleting a trusted library track removes pending copies and advances a matching current',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});f.act(3,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`});f.act(4,'enqueue',{type:'music',trackId:f.tracks[0].id});
 f.room.removeTrack(f.tracks[0].id);assert.equal(f.room.current.type,'video');assert.equal(f.room.queue.length,0);
});
test('invalid commands leave anchor and accepted request ledger unchanged',()=>{
 const f=fixture();f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});const before=JSON.stringify(f.room.playback),revision=f.room.revision,count=f.room.requests.size;
 for(const data of [f.command('seek',{positionSec:11}),f.command('seek',{positionSec:NaN}),f.command('duration',{durationSec:0}),f.command('enqueue',{type:'video',url:'https://evil.test/x'}),f.command('enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`,title:'x\n'}),f.command('pause',{requestId:'bad'}),f.command('unknown')])assert.throws(()=>f.room.act(f.members[0].id,data,f.context));
 assert.equal(JSON.stringify(f.room.playback),before);assert.equal(f.room.revision,revision);assert.equal(f.room.requests.size,count);
});
test('queue quotas and accepted request cache are bounded, with TTL and no stale replay after eviction',()=>{
 const f=fixture(8);for(let n=0;n<MAX_PLAYER_ITEMS;n++)f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id});assert.throws(()=>f.act(2,'enqueue',{type:'music',trackId:f.tracks[0].id}),{code:'MEDIA_QUEUE_LIMIT'});
 for(let n=f.room.queue.length;n<MAX_QUEUE_ITEMS;n++)f.act(3+Math.floor((n-9)/10),'enqueue',{type:'music',trackId:f.tracks[0].id});assert.equal(f.room.queue.length,50);assert.throws(()=>f.act(0,'enqueue',{type:'video',url:`https://youtu.be/${VIDEO}`}),{code:'MEDIA_QUEUE_LIMIT'});
 const old=f.command('pause');f.room.act(f.members[0].id,old,f.context);for(let n=0;n<MAX_REQUESTS+5;n++)f.act(0,'pause');assert.equal(f.room.requests.size,MAX_REQUESTS);assert.throws(()=>f.room.act(f.members[0].id,old,f.context),{code:'MEDIA_STALE'});
 f.advance(REQUEST_TTL_MS);f.room.reconcile(f.context);assert.equal(f.room.requests.size,0);
});
test('registry isolates reused short codes and closes every room reference',()=>{
 const registry=new RoomMediaRegistry(),first={code:'ABCDEF'},second={code:'ABCDEF'};assert.equal(registry.get(first),null);const old=registry.get(first,{create:true});assert.equal(registry.get(first),old);
 const fresh=registry.get(second,{create:true});assert.notEqual(fresh.roomInstanceId,old.roomInstanceId);assert.equal(fresh.current,null);registry.delete('ABCDEF');assert.equal(registry.get(second),null);registry.get(first,{create:true});registry.clear();assert.equal(registry.rooms.size,0);
});
