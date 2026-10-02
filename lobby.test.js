const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLobby}=require('./src/rooms/lobby');

test('lobby syncs authenticated identities, bounds movement, and expires inactive visitors',()=>{
 let time=1000;const lobby=createLobby(()=>time);
 const alice={id:'alice',display_name:'小明'},bob={id:'bob',display_name:'小美'};
 const first=lobby.view(alice);
 assert.equal(first.selfId,'alice');
 assert.deepEqual(first.visitors.map(visitor=>visitor.name),['小明']);
 const before=first.visitors[0];
 lobby.view(bob);
 time+=100;
 const moved=lobby.move(alice,{dx:1,dy:1});
 assert.equal(moved.visitors.length,2);
 assert.ok(moved.visitors[0].x>before.x);
 assert.ok(moved.visitors[0].y>before.y);
 assert.equal(moved.visitors[0].image,'/characters/alice');
 assert.equal(moved.visitors[0].moving,true);
 assert.throws(()=>lobby.move(alice,{dx:100,dy:0}),error=>error.code==='INVALID_MOVEMENT');
 assert.throws(()=>lobby.move(alice,{dx:'1',dy:0}),error=>error.code==='INVALID_MOVEMENT');
 time+=16000;
 assert.deepEqual(lobby.view(bob).visitors.map(visitor=>visitor.id),['bob']);
 for(let i=0;i<100;i++){time+=200;lobby.move(bob,{dx:1,dy:-1});}
 const atEdge=lobby.view(bob).visitors[0];
 assert.ok(atEdge.x<=85&&atEdge.y>=32);
});
