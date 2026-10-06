const {createHash}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {defaults,selectedImage}=require('./appearance');
const {MAX_SOUND_DURATION_MS}=require('./sounds');

const USER_IMAGE_PATH=/^\/assets\/characters\/user\/([a-f0-9-]{36})\/(neutral|happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})$/;
const USER_SOUND_PATH=/^\/assets\/characters\/sounds\/([a-f0-9-]{36})\/(happy|sad|surprised|thinking|angry|emote-[a-f0-9-]{36})$/;
const EXPRESSION_FETCH_GRACE_MS=2000;
const versionOf=row=>createHash('sha256').update(row.mime).update('\0').update(row.bytes).digest('hex');
function imageReference(image){
 const url=new URL(image,'http://localhost');
 const match=url.pathname.match(USER_IMAGE_PATH);
 return match?{path:url.pathname,characterId:match[1],expression:match[2],version:url.searchParams.get('v')}:null;
}
function soundReference(sound){
 const url=new URL(sound,'http://localhost');
 const match=url.pathname.match(USER_SOUND_PATH);
 return match?{path:url.pathname,characterId:match[1],expression:match[2],version:url.searchParams.get('v')}:null;
}

// Audience lookups must be read-only: fetching an image never joins a room or
// enters/refreshes lobby presence. Grants are only for expressions actually sent
// in a view, and remain bound to both their audience and their original bytes.
function createCharacterMediaAccess(db,audiencesFor,now=()=>Date.now()){
 const grants=new Map();
 const soundGrants=new Map();
 function avatar(userId){
  const user=db.prepare('SELECT appearance FROM users WHERE id=? AND disabled=0').get(userId);
  if(!user)return null;
  try{return selectedImage(db,userId,user.appearance?JSON.parse(user.appearance):defaults);}
  catch(error){if(error.code!=='INVALID_APPEARANCE'&&!(error instanceof SyntaxError))throw error;return selectedImage(db,userId,defaults);}
 }
 function rowFor(reference){
  return db.prepare('SELECT character_images.mime,character_images.bytes,player_characters.owner_id,player_characters.shared FROM character_images JOIN player_characters ON player_characters.id=character_images.character_id JOIN users ON users.id=player_characters.owner_id WHERE character_id=? AND expression=? AND users.disabled=0').get(reference.characterId,reference.expression);
 }
 function broadcastImage(image){
  const reference=imageReference(image);
  if(!reference)return image;
  const row=rowFor(reference);
  if(!row)throw new HttpError(404,'IMAGE_NOT_FOUND','找不到角色圖片');
  return `${reference.path}?v=${versionOf(row)}`;
 }
 function soundRowFor(reference){
  return db.prepare('SELECT character_sounds.mime,character_sounds.bytes,character_sounds.duration_ms,player_characters.owner_id,player_characters.shared FROM character_sounds JOIN player_characters ON player_characters.id=character_sounds.character_id JOIN users ON users.id=player_characters.owner_id WHERE character_id=? AND expression=? AND users.disabled=0').get(reference.characterId,reference.expression);
 }
 function broadcastSound(sound){
  const reference=soundReference(sound);
  if(!reference)return sound;
  const row=soundRowFor(reference);
  if(!row)throw new HttpError(404,'SOUND_NOT_FOUND','找不到表情音效');
  return `${reference.path}?v=${versionOf(row)}`;
 }
 function rememberExpressions(viewerId,audienceId,expressions){
  const time=now();
  for(const [key,grant] of grants)if(grant.until<=time)grants.delete(key);
  for(const [key,grant] of soundGrants)if(grant.until<=time)soundGrants.delete(key);
  if(!expressions.length)return;
  const audience=audiencesFor(viewerId).find(item=>item.id===audienceId);
  if(!audience)return;
  // Use the events actually emitted by the view, rather than re-selecting
  // active events after it was built: an event may expire between these steps.
  for(const event of expressions){
   if(!audience.userIds.has(event.userId))continue;
   if(event.until+EXPRESSION_FETCH_GRACE_MS>time){
    const reference=imageReference(event.image);
    if(reference?.version){
     const key=JSON.stringify([viewerId,audienceId,event.userId,event.image]);
     grants.set(key,{viewerId,audienceId,userId:event.userId,...reference,until:event.until+EXPRESSION_FETCH_GRACE_MS});
    }
   }
   if(event.sound?.url){
    const reference=soundReference(event.sound.url);
    const at=Number.isFinite(event.at)?event.at:event.until-5000;
    const soundUntil=Number.isFinite(event.soundUntil)?Math.min(event.soundUntil,at+MAX_SOUND_DURATION_MS):at+MAX_SOUND_DURATION_MS;
    const until=soundUntil+EXPRESSION_FETCH_GRACE_MS;
    if(reference?.version&&Number.isFinite(until)&&until>time){
     const key=JSON.stringify([viewerId,audienceId,event.userId,event.sound.url,at]);
     soundGrants.set(key,{viewerId,audienceId,userId:event.userId,...reference,until});
    }
   }
  }
 }
 function image(viewerId,imageUrl){
  const reference=imageReference(imageUrl);
  if(!reference)return null;
  const row=rowFor(reference);
  if(!row)return null;
  const version=versionOf(row);
  // A URL broadcast before an upload must never start serving the replacement.
  if(reference.version!==null&&reference.version!==version)return null;
  if(row.owner_id===viewerId||row.shared)return row;
  const time=now(),audiences=audiencesFor(viewerId),avatars=new Map();
  const saved=userId=>{
   if(!avatars.has(userId))avatars.set(userId,avatar(userId));
   return avatars.get(userId);
  };
  for(const audience of audiences){
   for(const userId of audience.userIds)if(saved(userId)?.url===reference.path)return row;
   for(const event of audience.expressions){
    if(event.until<=time||!audience.userIds.has(event.userId)||!saved(event.userId))continue;
    const displayed=imageReference(event.image);
    if(displayed?.path===reference.path&&displayed.version===version)return row;
   }
  }
  for(const [key,grant] of grants){
   if(grant.until<=time){grants.delete(key);continue;}
   if(grant.viewerId!==viewerId||grant.path!==reference.path||grant.version!==version)continue;
   const audience=audiences.find(item=>item.id===grant.audienceId);
   if(audience?.userIds.has(grant.userId)&&saved(grant.userId))return row;
  }
  return null;
 }
 function sound(viewerId,soundUrl){
  const reference=soundReference(soundUrl);
  if(!reference)return null;
  const row=soundRowFor(reference);
  if(!row)return null;
  const version=versionOf(row);
  if(reference.version!==null&&reference.version!==version)return null;
  if(row.owner_id===viewerId||row.shared)return row;
  const time=now(),audiences=audiencesFor(viewerId);
  // Audio has no avatar-based permission. A private clip needs a receipt from
  // a view which actually carried this sound, even while its event is live.
  for(const [key,grant] of soundGrants){
   if(grant.until<=time){soundGrants.delete(key);continue;}
   if(grant.viewerId!==viewerId||grant.path!==reference.path||grant.version!==version)continue;
   const audience=audiences.find(item=>item.id===grant.audienceId);
   if(audience?.userIds.has(viewerId)&&audience.userIds.has(grant.userId)&&avatar(grant.userId))return row;
  }
  return null;
 }
 return {avatar,image,sound,broadcastImage,broadcastSound,rememberExpressions};
}

module.exports={USER_IMAGE_PATH,USER_SOUND_PATH,EXPRESSION_FETCH_GRACE_MS,createCharacterMediaAccess};
