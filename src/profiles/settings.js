const {HttpError}=require('../http/errors');
const {defaults,selectedImage}=require('./appearance');

function savedProfile(db,userId){const row=db.prepare('SELECT appearance FROM users WHERE id=?').get(userId);try{return row?.appearance?JSON.parse(row.appearance):defaults;}catch{return defaults;}}
function validAvatar(db,userId,value){
 if(value?.kind==='artwork'&&typeof value.artworkId==='string'){
  const row=db.prepare('SELECT id,mime,bytes FROM user_artworks WHERE id=? AND owner_id=?').get(value.artworkId,userId);
  if(!row)throw new HttpError(400,'INVALID_AVATAR','請選擇自己的收藏圖片');
  return {avatar:{kind:'artwork',artworkId:row.id},content:row};
 }
 if(value?.kind==='character'){
  const selection=selectedImage(db,userId,{version:5,characterId:value.characterId,expression:value.expression});
  return {avatar:{kind:'character',characterId:selection.appearance.characterId,expression:selection.appearance.expression},url:selection.url};
 }
 throw new HttpError(400,'INVALID_AVATAR','頭像設定不正確');
}
function getProfileSettings(db,userId){
 const saved=savedProfile(db,userId);let appearance;
 try{appearance=selectedImage(db,userId,saved).appearance;}catch{appearance={...defaults};}
 let selection;try{selection=validAvatar(db,userId,saved.avatar);}catch{selection=validAvatar(db,userId,{kind:'character',...appearance});}
 return {appearance,avatar:selection.avatar,avatarUrl:'/api/profile/avatar'};
}
function setProfileSettings(db,userId,data){
 const appearance=selectedImage(db,userId,data.appearance).appearance;
 const {avatar}=validAvatar(db,userId,data.avatar);
 db.prepare('UPDATE users SET appearance=? WHERE id=?').run(JSON.stringify({...appearance,avatar}),userId);
 return getProfileSettings(db,userId);
}
function avatarContent(db,userId){return validAvatar(db,userId,getProfileSettings(db,userId).avatar);}
function preserveAvatar(db,userId,appearance){const avatar=savedProfile(db,userId).avatar;return avatar?{...appearance,avatar}:appearance;}
module.exports={getProfileSettings,setProfileSettings,avatarContent,preserveAvatar};
