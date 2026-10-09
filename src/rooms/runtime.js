'use strict';
const {startRoomScheduler}=require('./scheduler');
const {expireEmptyRooms}=require('./lifecycle');
const {RoomWatchRegistry}=require('../watch/room');
const {RoomMediaRegistry}=require('../media/room');

// One runtime per app. Membership, permissions, history and game rules remain
// with their existing owners; callbacks are supplied only when the app starts.
function createRoomRuntime(){
 const rooms=new Map(),seats=new Map(),departedSeats=new Map(),kickedUsers=new Map();
 const socialEvents=new Map(),expressionEvents=new Map(),barrageEvents=new Map(),reconnectGrace=new Map();
 const drawStreams=new Map(),musicStreams=new Map(),musicRooms=new Map();
 const watchRooms=new RoomWatchRegistry(),mediaRooms=new RoomMediaRegistry();
 const registries=[seats,departedSeats,kickedUsers,socialEvents,expressionEvents,barrageEvents,musicRooms,watchRooms,mediaRooms];
 let stopScheduler=null,stopped=false;
 function closeStreams(code){
  const errors=[];
  for(const streams of [drawStreams,musicStreams]){
   for(const entry of [...(streams.get(code)||[])]){
    try{entry.dispose?.();entry.res.end();}catch(error){errors.push(error);}
   }
   streams.delete(code);
  }
  if(errors.length)throw new AggregateError(errors,'Room stream cleanup failed');
 }
 function cleanupRoom(code){
  for(const registry of registries)registry.delete(code);
  for(const key of reconnectGrace.keys())if(key.startsWith(code+':'))reconnectGrace.delete(key);
  closeStreams(code);
 }
 function drainStreams(){
  const errors=[];
  for(const code of new Set([...drawStreams.keys(),...musicStreams.keys()]))try{closeStreams(code);}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError(errors,'Room stream drain failed');
 }
 // A stream's timer is released immediately on room cleanup, not only when the
 // transport eventually emits close. Old connections cannot delete a new set.
 function ownStream(streams,code,entry,req,timer){
  const subscribers=streams.get(code);let disposed=false;
  entry.dispose=()=>{
   if(disposed)return;disposed=true;clearInterval(timer);
   req.off('close',entry.dispose);subscribers?.delete(entry);
   if(!subscribers?.size&&streams.get(code)===subscribers)streams.delete(code);
  };
  req.once('close',entry.dispose);
  if(stopped){entry.dispose();entry.res.end();}
 }
 function start({history,onTransition,onSweep,onDrawStroke}){
  if(stopped)throw Error('Room runtime has been closed');
  if(!stopScheduler)stopScheduler=startRoomScheduler({rooms,history,onDelete:cleanupRoom,onTransition,onSweep,onDrawStroke});
 }
 function stop(){if(stopped)return;stopped=true;stopScheduler?.();stopScheduler=null;}
 function close(){
  stop();const errors=[];
  const codes=new Set([...rooms.keys(),...drawStreams.keys(),...musicStreams.keys()]);
  for(const code of codes)try{cleanupRoom(code);}catch(error){errors.push(error);}
  for(const registry of [rooms,...registries,reconnectGrace,drawStreams,musicStreams])registry.clear();
  if(errors.length)throw new AggregateError(errors,'Room runtime cleanup failed');
 }
 return {rooms,seats,departedSeats,kickedUsers,socialEvents,expressionEvents,barrageEvents,reconnectGrace,drawStreams,musicStreams,musicRooms,watchRooms,mediaRooms,
  cleanupRoom,drainStreams,ownStream,start,stop,close,expireRooms:history=>expireEmptyRooms({rooms,history,onDelete:cleanupRoom})};
}
module.exports={createRoomRuntime};
