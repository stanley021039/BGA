const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {imageOf}=require('../profiles/uploads');
const {GIFTS,CATEGORIES}=require('./gift-catalog');

const keyOf=title=>title.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
const publicGift=row=>({
 id:'shared-'+row.id,title:row.title,category:row.category,
 image:row.image_mime?`/assets/gifts/shared/${row.id}`:null,
 author:row.author_name,shared:true,at:row.created_at
});

class GiftStore{
 constructor(db){this.db=db;}
 list(){return this.db.prepare('SELECT id,title,category,image_mime,author_name,created_at FROM community_gifts ORDER BY created_at DESC').all().map(publicGift);}
 add(user,data){
  const title=typeof data.title==='string'?data.title.trim():'';
  if(!title||[...title].length>60||/[\u0000-\u001f\u007f]/.test(title))throw new HttpError(400,'INVALID_GIFT_TITLE','禮物名稱需為 1–60 字，且不能換行');
  if(!CATEGORIES.includes(data.category))throw new HttpError(400,'INVALID_GIFT_CATEGORY','請選擇有效的禮物分類');
  const key=keyOf(title);
  if(GIFTS.some(gift=>keyOf(gift.title)===key)||this.db.prepare('SELECT 1 FROM community_gifts WHERE title_key=?').get(key))throw new HttpError(409,'DUPLICATE_GIFT','題庫已有同名禮物');
  if(this.db.prepare('SELECT COUNT(*) AS count FROM community_gifts').get().count>=5000)throw new HttpError(400,'GIFT_LIMIT','共用禮物題庫已達上限');
  if(this.db.prepare('SELECT COUNT(*) AS count FROM community_gifts WHERE author_id=?').get(user.id).count>=100)throw new HttpError(400,'GIFT_AUTHOR_LIMIT','每位玩家最多投稿 100 件禮物');
  const image=data.image==null?null:imageOf(data.image);
  const row={id:randomUUID(),title,title_key:key,category:data.category,author_name:user.display_name,created_at:new Date().toISOString()};
  this.db.prepare('INSERT INTO community_gifts(id,author_id,author_name,title,title_key,category,image_mime,image_bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
   .run(row.id,user.id,row.author_name,row.title,row.title_key,row.category,image?.mime||null,image?.bytes||null,row.created_at);
  return publicGift({...row,image_mime:image?.mime||null});
 }
 image(id){return this.db.prepare('SELECT image_mime AS mime,image_bytes AS bytes FROM community_gifts WHERE id=?').get(id);}
}

module.exports={GiftStore};
