const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
// Ephemeral, bounded history. Metadata for retry de-duplication never leaves RAM.
function createChat({events=new Map(),clock=Date.now}={}){
 const rates=new Map(),metadata=new WeakMap();
 function send(channel,user,message,requestId){
  if(typeof message!=='string'||!message.trim()||message.trim().length>160||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(message))throw new HttpError(400,'INVALID_MESSAGE','留言需為 1–160 字純文字');
  if(requestId!==undefined&&(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(requestId)))throw new HttpError(400,'INVALID_REQUEST_ID','傳送識別碼不正確');
  const messages=events.get(channel)||[];
  const duplicate=requestId&&messages.find(event=>{const meta=metadata.get(event);return meta?.userId===user.id&&meta.requestId===requestId;});
  if(duplicate){if(duplicate.message!==message.trim())throw new HttpError(409,'CHAT_RETRY_CONFLICT','請重新傳送修改後的留言');return duplicate;}
  const now=clock();
  for(const [key,at] of rates)if(now-at>=60000)rates.delete(key);
  if(rates.has(user.id)&&now-rates.get(user.id)<1500)throw new HttpError(429,'SOCIAL_RATE_LIMIT','請稍後再傳送（間隔 1.5 秒）');
  if(!rates.has(user.id)&&rates.size>=4096)throw new HttpError(503,'CHAT_BUSY','聊天室忙碌中，請稍後再試');
  const event={id:randomUUID(),kind:'message',name:user.display_name,message:message.trim(),at:now};
  metadata.set(event,{userId:user.id,requestId});rates.set(user.id,now);messages.push(event);if(messages.length>50)messages.shift();events.set(channel,messages);return event;
 }
 return {send,read:channel=>(events.get(channel)||[]).slice(),delete:channel=>events.delete(channel)};
}
module.exports={createChat};
