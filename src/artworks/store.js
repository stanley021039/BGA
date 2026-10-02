const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {imageOf}=require('../profiles/uploads');

class ArtworkStore{
 constructor(db){this.db=db;}
 list(ownerId){return this.db.prepare('SELECT id,name,mime,created_at AS createdAt FROM user_artworks WHERE owner_id=? ORDER BY created_at DESC,id DESC').all(ownerId).map(row=>({...row,url:'/assets/artworks/'+row.id}));}
 add(ownerId,data){
  const name=typeof data.name==='string'?data.name.trim():'';
  if(!name||[...name].length>40||/[\u0000-\u001f\u007f]/.test(name))throw new HttpError(400,'INVALID_ARTWORK_NAME','作品名稱需為 1–40 字');
  const image=imageOf(data);
  if(this.db.prepare('SELECT COUNT(*) AS count FROM user_artworks WHERE owner_id=?').get(ownerId).count>=100)throw new HttpError(400,'ARTWORK_LIMIT','每個帳號最多保存 100 件作品');
  const row={id:randomUUID(),name,mime:image.mime,createdAt:new Date().toISOString()};
  this.db.prepare('INSERT INTO user_artworks(id,owner_id,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?)').run(row.id,ownerId,row.name,row.mime,image.bytes,row.createdAt);
  return {...row,url:'/assets/artworks/'+row.id};
 }
 image(ownerId,id){return this.db.prepare('SELECT mime,bytes FROM user_artworks WHERE id=? AND owner_id=?').get(id,ownerId);}
 remove(ownerId,id){
  const result=this.db.prepare('DELETE FROM user_artworks WHERE id=? AND owner_id=?').run(id,ownerId);
  if(!result.changes)throw new HttpError(404,'ARTWORK_NOT_FOUND','找不到你的作品');
  return {ok:true};
 }
}
module.exports={ArtworkStore};
