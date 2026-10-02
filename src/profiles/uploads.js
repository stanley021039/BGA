const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {expressionLabels}=require('./appearance');

const MAX_BYTES=1024*1024;
const MAX_CUSTOM_EXPRESSIONS=6;
function invalid(message='圖片格式不正確'){throw new HttpError(400,'INVALID_CHARACTER_IMAGE',message);}
function imageOf(data){
 if(typeof data.base64!=='string'||data.base64.length>Math.ceil(MAX_BYTES*4/3)+16||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64))invalid();
 const bytes=Buffer.from(data.base64,'base64');
 if(!bytes.length||bytes.length>MAX_BYTES||bytes.toString('base64')!==data.base64)invalid('圖片不得超過 1 MB');
 let mime,width,height;
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){
  mime='image/png';width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
 }else if(bytes.length>=10&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))){
  mime='image/gif';width=bytes.readUInt16LE(6);height=bytes.readUInt16LE(8);
 }else if(bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'&&bytes.readUInt32LE(4)+8===bytes.length){
  const chunk=bytes.toString('ascii',12,16);
  if(chunk==='VP8X'){
   width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3);
  }else if(chunk==='VP8 '&&bytes.subarray(23,26).equals(Buffer.from([157,1,42]))){
   width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;
  }else if(chunk==='VP8L'&&bytes[20]===47){
   width=1+(bytes[21]|((bytes[22]&63)<<8));height=1+((bytes[22]>>6)|(bytes[23]<<2)|((bytes[24]&15)<<10));
  }
  mime='image/webp';
 }
 if(!mime||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)invalid('僅接受有效的 PNG、GIF 或 WebP 圖片');
 if(data.mime&&data.mime!==mime)invalid('圖片類型與檔案內容不符');
 return {bytes,mime,width,height};
}
function expressionOf(value){if(!Object.hasOwn(expressionLabels,value))throw new HttpError(400,'INVALID_EXPRESSION','不支援的表情');return value;}
function nameOf(value){const name=String(value||'').trim();if(!name||name.length>32)throw new HttpError(400,'INVALID_CHARACTER_NAME','角色名稱需為 1–32 字');return name;}
function createCharacter(db,ownerId,data){
 const name=nameOf(data.name),image=imageOf(data),id=randomUUID(),now=new Date().toISOString();
 const count=db.prepare('SELECT COUNT(*) AS count FROM player_characters WHERE owner_id=?').get(ownerId).count;
 if(count>=10)throw new HttpError(400,'CHARACTER_LIMIT','每個帳號最多上傳 10 個角色');
 db.exec('BEGIN IMMEDIATE');
 try{
  db.prepare('INSERT INTO player_characters(id,owner_id,name,created_at) VALUES(?,?,?,?)').run(id,ownerId,name,now);
  db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?)').run(id,'neutral',image.mime,image.bytes);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return {id:'user:'+id,name};
}
function setExpression(db,ownerId,id,data){
 const expression=expressionOf(data.expression),image=imageOf(data),uuid=id.replace(/^user:/,'');
 const owned=db.prepare('SELECT id FROM player_characters WHERE id=? AND owner_id=?').get(uuid,ownerId);
 if(!owned)throw new HttpError(404,'CHARACTER_NOT_FOUND','找不到你的角色');
 db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes) VALUES(?,?,?,?) ON CONFLICT(character_id,expression) DO UPDATE SET mime=excluded.mime,bytes=excluded.bytes').run(uuid,expression,image.mime,image.bytes);
 return {id:'user:'+uuid,expression};
}
function addExpression(db,ownerId,id,data){
 const name=typeof data.name==='string'?data.name.trim():'';
 if(!name||[...name].length>20||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'INVALID_EXPRESSION_NAME','表情名稱需為 1–20 字');
 const image=imageOf(data);
 const uuid=id.replace(/^user:/,'');
 db.exec('BEGIN IMMEDIATE');
 try{
  const owned=db.prepare('SELECT id FROM player_characters WHERE id=? AND owner_id=?').get(uuid,ownerId);
  if(!owned)throw new HttpError(404,'CHARACTER_NOT_FOUND','找不到你的角色');
  const count=db.prepare("SELECT COUNT(*) AS count FROM character_images WHERE character_id=? AND expression LIKE 'emote-%'").get(uuid).count;
  if(count>=MAX_CUSTOM_EXPRESSIONS)throw new HttpError(400,'EXPRESSION_LIMIT','每個角色最多新增 6 個表情');
  if(db.prepare('SELECT 1 FROM character_images WHERE character_id=? AND label=?').get(uuid,name))throw new HttpError(400,'DUPLICATE_EXPRESSION_NAME','這個表情名稱已經使用');
  const expression='emote-'+randomUUID();
  db.prepare('INSERT INTO character_images(character_id,expression,mime,bytes,label) VALUES(?,?,?,?,?)').run(uuid,expression,image.mime,image.bytes,name);
  db.exec('COMMIT');
  return {id:'user:'+uuid,expression,name};
 }catch(error){db.exec('ROLLBACK');throw error;}
}
module.exports={MAX_BYTES,imageOf,createCharacter,setExpression,addExpression};
