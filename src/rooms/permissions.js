const {HttpError}=require('../http/errors');

const player=(room,id)=>room?.players?.find(seat=>seat.id===id&&!seat.kicked);
const human=(room,id)=>{const seat=player(room,id);return seat&&!seat.bot?seat:null;};

// Roles belong to this live room object, never to account records or history.
function managers(room){
 if(!(room.managerIds instanceof Set))Object.defineProperty(room,'managerIds',{value:new Set(),configurable:true});
 return room.managerIds;
}

function roomRole(room,id){
 if(!human(room,id))return null;
 if(room.host===id)return 'host';
 return room.managerIds?.has(id)?'manager':'member';
}

function isRoomManager(room,id){const role=roomRole(room,id);return role==='host'||role==='manager';}

function canKick(room,actorId,targetId){
 const role=roomRole(room,actorId),target=player(room,targetId);
 if(!target||actorId===targetId||targetId===room.host)return false;
 if(role==='host')return true;
 return role==='manager'&&!target.bot&&roomRole(room,targetId)==='member';
}

function pruneRoomRoles(room,activeIds){
 const active=new Set(activeIds||[]),roles=managers(room);
 for(const id of roles)if(!active.has(id)||!human(room,id)||room.host===id)roles.delete(id);
 return roles;
}

function setRoomRole(room,actorId,targetId,role,activeIds){
 const active=new Set(activeIds||[]);
 if(!active.has(actorId)||!human(room,actorId))throw new HttpError(403,'NOT_SEATED','尚未加入此房間');
 if(roomRole(room,actorId)!=='host')throw new HttpError(403,'ROOM_ROLE_HOST_ONLY','只有房主可以設定房間角色');
 if(!['manager','member'].includes(role))throw new HttpError(400,'INVALID_ROOM_ROLE','房間角色只能是管理者或一般玩家');
 if(!active.has(targetId)||!human(room,targetId)||targetId===room.host)throw new HttpError(400,'INVALID_ROLE_TARGET','請選擇房內其他一般玩家');
 pruneRoomRoles(room,active);
 if(role==='manager')managers(room).add(targetId);else managers(room).delete(targetId);
 return permissionsView(room,targetId);
}

function permissionsView(room,id){
 const role=roomRole(room,id),isHost=role==='host',canManage=role==='manager'||isHost;
 return {role,canManageMedia:canManage,canManagePlayers:canManage,canPromote:isHost,isHost};
}

module.exports={roomRole,isRoomManager,canKick,setRoomRole,pruneRoomRoles,permissionsView};
