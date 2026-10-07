const {test}=require('node:test');
const assert=require('node:assert/strict');
const {HttpError}=require('../src/http/errors');
const {roomRole,isRoomManager,canKick,setRoomRole,pruneRoomRoles,permissionsView}=require('../src/rooms/permissions');

function fixture(){
 const room={host:'host',players:[{id:'host',name:'房主'},{id:'manager',name:'管理候選'},{id:'peer',name:'另一位'},{id:'member',name:'一般玩家'},{id:'bot',name:'電腦',bot:true},{id:'departed',name:'已離席',kicked:true}]};
 const active=['host','manager','peer','member'];
 return {room,active,promote:id=>setRoomRole(room,'host',id,'manager',active)};
}

test('roles are scoped to a live room and never elevate account or invalid seats',()=>{
 const f=fixture();
 assert.equal(roomRole(f.room,'host'),'host');assert.equal(roomRole(f.room,'manager'),'member');
 for(const id of ['unknown','bot','departed',undefined]){assert.equal(roomRole(f.room,id),null);assert.equal(isRoomManager(f.room,id),false);assert.deepEqual(permissionsView(f.room,id),{role:null,canManageMedia:false,canManagePlayers:false,canPromote:false,isHost:false});}
 assert.deepEqual(f.promote('manager'),{role:'manager',canManageMedia:true,canManagePlayers:true,canPromote:false,isHost:false});
 assert.equal(roomRole(f.room,'manager'),'manager');assert.equal(roomRole(fixture().room,'manager'),'member');
 assert.deepEqual(permissionsView(f.room,'host'),{role:'host',canManageMedia:true,canManagePlayers:true,canPromote:true,isHost:true});
 assert.equal(Object.keys(f.room).includes('managerIds'),false);assert.equal(JSON.stringify(f.room).includes('managerIds'),false);
 assert.equal(f.room.host,'host');assert.equal(Object.hasOwn(f.room.players[1],'role'),false);
});

test('only the active host can promote or demote another active human seat',()=>{
 const f=fixture();f.promote('manager');
 for(const actor of ['manager','member'])assert.throws(()=>setRoomRole(f.room,actor,'peer','manager',f.active),error=>error instanceof HttpError&&error.code==='ROOM_ROLE_HOST_ONLY'&&error.status===403);
 for(const actor of ['unknown','bot','departed'])assert.throws(()=>setRoomRole(f.room,actor,'member','manager',[...f.active,'bot','departed']),{code:'NOT_SEATED',status:403});
 assert.throws(()=>setRoomRole(f.room,'host','member','manager',f.active.filter(id=>id!=='host')),{code:'NOT_SEATED'});
 for(const target of ['host','unknown','bot','departed'])assert.throws(()=>setRoomRole(f.room,'host',target,'manager',[...f.active,'bot','departed']),{code:'INVALID_ROLE_TARGET',status:400});
 assert.throws(()=>setRoomRole(f.room,'host','member','manager',f.active.filter(id=>id!=='member')),{code:'INVALID_ROLE_TARGET'});
 for(const role of ['host','admin','MANAGER',null,{},''])assert.throws(()=>setRoomRole(f.room,'host','member',role,f.active),{code:'INVALID_ROOM_ROLE',status:400});
 assert.equal(roomRole(f.room,'manager'),'manager');assert.equal(roomRole(f.room,'peer'),'member');
 assert.equal(setRoomRole(f.room,'host','manager','member',f.active).role,'member');
 assert.equal(setRoomRole(f.room,'host','manager','member',f.active).role,'member','demotion is idempotent');
});

test('kick hierarchy preserves host bot controls and prevents manager peer, host, self or bot kicks',()=>{
 const f=fixture();f.promote('manager');f.promote('peer');
 for(const target of ['manager','peer','member','bot'])assert.equal(canKick(f.room,'host',target),true);
 assert.equal(canKick(f.room,'manager','member'),true);
 for(const target of ['host','manager','peer','bot','departed','unknown'])assert.equal(canKick(f.room,'manager',target),false);
 for(const actor of ['member','unknown','bot','departed'])for(const target of ['member','manager','bot'])assert.equal(canKick(f.room,actor,target),false);
 for(const target of ['host','departed','unknown'])assert.equal(canKick(f.room,'host',target),false);
 assert.equal(f.room.host,'host');
});

test('pruning revokes departed managers, preserves offline active seats, and never transfers old room roles',()=>{
 const f=fixture();f.promote('manager');f.promote('peer');
 f.room.players[1].online=false;f.room.players[1].lastSeen=0;
 assert.equal(pruneRoomRoles(f.room,new Set(f.active)).has('manager'),true);
 pruneRoomRoles(f.room,f.active.filter(id=>id!=='manager'));assert.equal(roomRole(f.room,'manager'),'member');
 assert.equal(canKick(f.room,'manager','member'),false);
 f.room.players[2].kicked=true;pruneRoomRoles(f.room,f.active);assert.equal(f.room.managerIds.has('peer'),false);
 f.room.players[2].kicked=false;assert.equal(roomRole(f.room,'peer'),'member','reclaimed kicked seat does not regain manager');
 f.promote('peer');f.room.players[2].bot=true;pruneRoomRoles(f.room,f.active);assert.equal(f.room.managerIds.has('peer'),false);
 f.room.players[2].bot=false;f.promote('peer');f.room.host='peer';pruneRoomRoles(f.room,f.active);assert.equal(f.room.managerIds.has('peer'),false);assert.equal(roomRole(f.room,'peer'),'host');
 f.room.host='host';assert.equal(roomRole(f.room,'peer'),'member','former host does not retain stale manager grant');
 assert.equal(pruneRoomRoles(f.room,[]).size,0);
});
