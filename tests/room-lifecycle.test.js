const test=require('node:test');
const assert=require('node:assert/strict');
const {ROOM_RECONNECT_MS,expireEmptyRooms,leavePlayer}=require('../src/rooms/lifecycle');
const {Room}=require('../src/games/poker');
const {ThunderRoom}=require('../src/games/thunder');
const {DrawGuessRoom}=require('../src/games/draw-guess');
const {GiftRoom}=require('../src/games/gift');
const {MajorityRoom}=require('../src/games/majority');

test('empty room cleanup preserves the reconnect window and ignores bots and kicked players',()=>{
 const now=200000,make=(code,players)=>({code,players});
 const rooms=new Map([
  ['recent',make('recent',[{lastSeen:now-ROOM_RECONNECT_MS+1}])],
  ['expired',make('expired',[{lastSeen:now-ROOM_RECONNECT_MS},{bot:true,lastSeen:now}])],
  ['kicked',make('kicked',[{kicked:true,lastSeen:now}])],
  ['empty',make('empty',[])],
 ]),interrupted=[],deleted=[];
 expireEmptyRooms({rooms,now,history:{interrupt:room=>interrupted.push(room.code)},onDelete:code=>deleted.push(code)});
 assert.deepEqual([...rooms.keys()],['recent']);
 assert.deepEqual(deleted,['expired','kicked','empty']);assert.deepEqual(interrupted,deleted);
 rooms.get('recent').players[0].lastSeen=now;
 expireEmptyRooms({rooms,now:now+ROOM_RECONNECT_MS-1,history:{interrupt(){}}});
 assert.equal(rooms.size,1);
});

for(const Engine of [Room,ThunderRoom,DrawGuessRoom,GiftRoom,MajorityRoom]){
 test(Engine.name+': leaving host transfers control, removes their seat from play, and last human closes the room',()=>{
  const room=new Engine('ABC123','test'),host=room.add('Host'),guest=room.add('Guest');
  assert.deepEqual(leavePlayer(room,host.id),{deleted:false});
  assert.equal(room.host,guest.id);assert.ok(!room.players.some(p=>p.id===host.id&&!p.kicked&&!p.bot));
  assert.deepEqual(leavePlayer(room,guest.id),{deleted:true});
 });
}

test('leaving a started poker table hands the player to AI while another human remains',()=>{
 const room=new Room('ABC123','test'),host=room.add('Host'),guest=room.add('Guest');room.start();
 assert.equal(leavePlayer(room,host.id).deleted,false);assert.equal(host.bot,true);assert.equal(host.kicked,true);
 assert.equal(room.host,guest.id);assert.equal(leavePlayer(room,guest.id).deleted,true);
});
