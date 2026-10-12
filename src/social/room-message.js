'use strict';
const {builtinFrameDescriptor}=require('../barrage/builtins');
function barrageText(message){const points=[...message.replace(/\s+/gu,' ')];return points.slice(0,40).join('')+(points.length>40?'…':'');}
function sendRoomMessage({chat,barrageEvents,room,user,playerId,data}){
 const frame=builtinFrameDescriptor(data.builtinFrameId);
 const record=chat.send(room.code,user,data.message,data.requestId);
 const events=barrageEvents.get(room.code)||[];
 // A lost reply may be retried; never display a second barrage for the same record.
 if(!events.some(event=>event.id===record.id)){
  events.push({id:record.id,kind:'barrage',playerId,name:record.name,message:barrageText(record.message),frame,at:record.at});
  if(events.length>50)events.shift();barrageEvents.set(room.code,events);
 }
 return record;
}
module.exports={barrageText,sendRoomMessage};
