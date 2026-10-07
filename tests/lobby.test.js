const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLobby}=require('../src/rooms/lobby');

test('click destinations advance at bounded speed and emotes expire for other visitors',()=>{
 let time=1000;const lobby=createLobby(()=>time);
 const alice={id:'alice',display_name:'小明'},bob={id:'bob',display_name:'小美'};
 const first=lobby.view(alice).visitors[0];
 lobby.view(bob);
 const ordered=lobby.move(alice,{x:90,y:95});
 assert.equal(ordered.visitors[0].x,first.x);
 assert.equal(ordered.visitors[0].moving,true);
 assert.equal(ordered.visitors[0].moveId,1);
 assert.equal(ordered.visitors[0].targetX,85);
 assert.ok(ordered.visitors[0].remainingMs>500);
 time+=500;
 const moved=lobby.view(bob).visitors[0];
 assert.ok(moved.x>first.x&&moved.x-first.x<=6);
 assert.ok(moved.y>first.y&&moved.y-first.y<=8);
 assert.equal(moved.moveId,1);
 assert.ok(moved.remainingMs<ordered.visitors[0].remainingMs);
 assert.equal(moved.image,'/characters/alice');
 assert.throws(()=>lobby.move(alice,{x:'90',y:50}),error=>error.code==='INVALID_MOVEMENT');
 assert.throws(()=>lobby.move(alice,{x:101,y:50}),error=>error.code==='INVALID_MOVEMENT');
 assert.throws(()=>lobby.move(alice,{x:NaN,y:50}),error=>error.code==='INVALID_MOVEMENT');
 const expressed=lobby.emote(alice,{image:'/assets/characters/example-happy.gif',label:'開心'});
 assert.equal(expressed.visitors[0].emote.label,'開心');
 assert.equal(lobby.view(bob).visitors[0].emote.image,'/assets/characters/example-happy.gif');
 assert.throws(()=>lobby.emote(alice,{image:'/another.png',label:'難過'}),error=>error.code==='EMOTE_RATE_LIMIT');
 time+=5001;
 assert.equal(lobby.view(bob).visitors[0].emote,null);
 time+=11000;
 assert.deepEqual(lobby.view(bob).visitors.map(visitor=>visitor.id),['bob']);
 lobby.move(bob,{x:100,y:0});
 time+=10000;
 const atEdge=lobby.view(bob).visitors[0];
 assert.ok(atEdge.x<=85&&atEdge.y>=32);
});

test('nickname refresh preserves movement and does not create a visitor or renew presence',()=>{
 let time=1000;const lobby=createLobby(()=>time),alice={id:'alice',display_name:'舊名字'},bob={id:'bob',display_name:'Bob'};
 const before=lobby.move(alice,{x:85,y:90}).visitors.find(visitor=>visitor.id===alice.id);
 lobby.rename(alice.id,'新名字');lobby.rename('absent','不能加入');
 const after=lobby.view(bob).visitors.find(visitor=>visitor.id===alice.id);
 assert.equal(after.name,'新名字');for(const key of ['id','x','y','targetX','targetY','moveId','remainingMs','facing','moving','image'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(lobby.view(bob).visitors.map(visitor=>visitor.id),['alice','bob']);
 time+=15001;
 assert.deepEqual(lobby.view(bob).visitors.map(visitor=>visitor.id),['bob']);
});

test('media audience checks neither enter the lobby nor refresh visitor presence',()=>{
 let time=1000;const lobby=createLobby(()=>time);
 const alice={id:'alice',display_name:'Alice'},bob={id:'bob',display_name:'Bob'};
 lobby.view(alice);
 assert.equal(lobby.mediaAudience(bob.id),null);
 assert.deepEqual([...lobby.mediaAudience(alice.id).userIds],['alice']);
 lobby.view(bob);
 lobby.emote(alice,{image:'/happy.png',label:'Happy'});
 assert.equal(lobby.mediaAudience(bob.id).expressions[0].image,'/happy.png');
 time+=5001;
 assert.deepEqual(lobby.mediaAudience(bob.id).expressions,[]);
 time+=9999;
 assert.ok(lobby.mediaAudience(bob.id));
 time++;
 assert.equal(lobby.mediaAudience(bob.id),null);
 assert.deepEqual(lobby.view(alice).visitors.map(visitor=>visitor.id),['alice']);
});
