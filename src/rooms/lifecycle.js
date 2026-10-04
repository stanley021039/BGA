const ROOM_RECONNECT_MS=90000;
const humans=room=>room.players.filter(player=>!player.bot&&!player.kicked);

function expireEmptyRooms({rooms,history,onDelete=()=>{},now=Date.now()}){
 for(const [code,room] of rooms){
  if(humans(room).some(player=>now-player.lastSeen<ROOM_RECONNECT_MS))continue;
  history.interrupt(room,'所有玩家已離開房間');rooms.delete(code);onDelete(code);
 }
}

function leavePlayer(room,playerId){
 const remaining=humans(room).filter(player=>player.id!==playerId);
 if(!remaining.length)return {deleted:true};
 if(room.host===playerId)room.host=remaining[0].id;
 room.kick(room.host,playerId,true);
 return {deleted:false};
}

module.exports={ROOM_RECONNECT_MS,expireEmptyRooms,leavePlayer};
