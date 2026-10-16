'use strict';
const {HttpError}=require('../http/errors');
const {leavePlayer,endRoomHistory}=require('./lifecycle');
const {canKick}=require('./permissions');

// All recorded state changes cross this seam, whether initiated by a player,
// an AI or a deadline. History is a write-ahead recorder, not a DB rollback.
function createRoomTransitions({history,onTransition=()=>{},runtime,onMembershipChanged=()=>{}}){
 function completed(room){try{onTransition(room);}catch(error){console.error('Room transition completion failed:',error);}}
 function transact(room,operation,run){
  try{return history.transact(room,operation,run);}
  finally{completed(room);}
 }
 function detach(room,userId,playerId,kicked){
  runtime.seats.get(room.code)?.delete(userId);
  if(kicked){
   if(!runtime.kickedUsers.has(room.code))runtime.kickedUsers.set(room.code,new Set());
   runtime.kickedUsers.get(room.code).add(userId);
  }else if(room.players.some(player=>player.id===playerId&&player.kicked)){
   if(!runtime.departedSeats.has(room.code))runtime.departedSeats.set(room.code,new Map());
   const departed=runtime.departedSeats.get(room.code);
   for(const [account,id]of departed)if(!room.players.some(player=>player.id===id))departed.delete(account);
   departed.set(userId,playerId);
  }
  onMembershipChanged(room);
  for(const streams of [runtime.drawStreams,runtime.musicStreams])for(const entry of streams.get(room.code)||[])if(entry.userId===userId)entry.res.end();
 }
 function leave(room,userId,playerId){
  let result,applied=false,historyPersisted=true;
  try{transact(room,{action:'leave',source:'player',actor:playerId},()=>{result=leavePlayer(room,playerId);applied=true;return result;});}
  catch(error){
   if(error.code!=='HISTORY_QUOTA'&&!history.isPaused(room))throw error;
   // A failed recorder must not trap players or apply a partial leave twice.
   historyPersisted=false;history.markUnrecorded(room);
   if(!applied){result=leavePlayer(room,playerId);completed(room);}
  }
  detach(room,userId,playerId,false);
  const historyWarning=history.warning(room);
  if(result.deleted){historyPersisted=endRoomHistory(history,room,'最後一位玩家已離開房間')&&historyPersisted;runtime.rooms.delete(room.code);runtime.cleanupRoom(room.code);}
  return {code:room.code,left:true,deleted:result.deleted,...(!historyPersisted?{historyPersisted:false,historyWarning:historyWarning||{code:'HISTORY_WRITE_FAILED',message:'已離開房間，但對局記錄未完整保存'}}:{})};
 }
 function kick(room,actor,input){
  return transact(room,{action:'kick',source:'player',actor,input},()=>{
   if(input.confirmed!==true)throw new HttpError(400,'CONFIRM_REQUIRED','請先確認踢出玩家');
   const target=room.players.find(player=>player.id===input.playerId);
   if(!target)throw new HttpError(404,'PLAYER_NOT_FOUND','找不到玩家');
   if(!canKick(room,actor,target.id))throw new HttpError(403,'ROOM_KICK_FORBIDDEN','只有房主或有權限的房間管理者可以踢出這位玩家');
   room.kick(room.host,target.id);
   const account=[...(runtime.seats.get(room.code)||[])].find(([,id])=>id===target.id)?.[0];
   if(account)detach(room,account,target.id,true);else onMembershipChanged(room);
  });
 }
 return {transact,leave,kick};
}
module.exports={createRoomTransitions};
