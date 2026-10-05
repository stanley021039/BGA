const ROOM_RECONNECT_MS=90000;
const humans=room=>room.players.filter(player=>!player.bot&&!player.kicked);
function endRoomHistory(history,room,reason,onHistoryError=error=>console.error('History interruption failed:',error.code||error.message)){
 try{history.interrupt(room,reason);return true;}catch(error){onHistoryError(error,room);return false;}
}

function expireEmptyRooms({rooms,history,onDelete=()=>{},now=Date.now(),onHistoryError}){
 for(const [code,room] of rooms){
  if(humans(room).some(player=>now-player.lastSeen<ROOM_RECONNECT_MS))continue;
  endRoomHistory(history,room,'所有玩家已離開房間',onHistoryError);rooms.delete(code);onDelete(code);
 }
}

function leavePlayer(room,playerId){
 const remaining=humans(room).filter(player=>player.id!==playerId);
 if(!remaining.length)return {deleted:true};
 if(room.host===playerId)room.host=remaining[0].id;
 room.kick(room.host,playerId,true);
 return {deleted:false};
}

module.exports={ROOM_RECONNECT_MS,expireEmptyRooms,leavePlayer,endRoomHistory};
