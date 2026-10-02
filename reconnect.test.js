const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Room}=require('./src/games/poker');
const {MajorityRoom}=require('./src/games/majority');
const {reconnectPlayer}=require('./src/rooms/reconnect');

test('returning player keeps the original seat and receives one turn grace after an offline gap',()=>{
 const room=new Room('ABC123','test'),first=room.add('A'),second=room.add('B');
 room.start();
 const actor=room.players[room.turn],other=actor===first?second:first;
 const seats=new Map([[room.code,new Map([['actor',actor.id],['other',other.id]])]]),grace=new Map(),now=100000;
 actor.lastSeen=other.lastSeen=0;
 room.deadline=now+1000;
 assert.equal(reconnectPlayer(room,'other',seats,grace,now),other);
 assert.equal(room.deadline,now+1000);
 assert.equal(reconnectPlayer(room,'actor',seats,grace,now),actor);
 assert.equal(actor.lastSeen,now);
 assert.equal(room.deadline,now+15000);
 actor.lastSeen=0;
 room.deadline=now+1000;
 reconnectPlayer(room,'actor',seats,grace,now+100);
 assert.equal(room.deadline,now+1000);
 assert.throws(()=>reconnectPlayer(room,'stranger',seats,grace,now),{code:'NOT_SEATED'});
 actor.bot=true;
 assert.throws(()=>reconnectPlayer(room,'actor',seats,grace,now),{code:'NOT_SEATED'});
});

test('returning majority player keeps the same seat while a game is underway',()=>{
 const room=new MajorityRoom('DEF456','test');
 const players=[room.add('A'),room.add('B'),room.add('C')];
 room.start();
 const seats=new Map([[room.code,new Map([['player',players[1].id]])]]);
 players[1].lastSeen=0;
 assert.equal(reconnectPlayer(room,'player',seats,new Map(),100000),players[1]);
 assert.equal(room.players.length,3);
 assert.equal(room.phase,'choosing');
 room.act(room.presenterId,'ask',{type:'two',prompt:'今晚玩嗎？',options:['玩','不玩']});
 players[1].lastSeen=0;
 room.deadline=101000;
 reconnectPlayer(room,'player',seats,new Map(),100000);
 assert.equal(room.deadline,115000);
});
