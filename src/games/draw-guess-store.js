const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {normalize}=require('./draw-guess');

const clean=(value,max,label)=>{
 if(typeof value!=='string')throw new HttpError(400,'INVALID_WORD',label+'不正確');
 const text=value.trim();
 if(!text||[...text].length>max||/[\u0000-\u001f\u007f]/u.test(text))throw new HttpError(400,'INVALID_WORD',label+'需為 1–'+max+' 字且不能換行');
 return text;
};
function validateWord(data){
 const title=clean(data?.title,24,'題目');
 const difficulty=data?.difficulty;
 if(!['easy','medium','hard'].includes(difficulty))throw new HttpError(400,'INVALID_WORD','請選擇難度');
 if(!Array.isArray(data.aliases)||data.aliases.length>5)throw new HttpError(400,'INVALID_WORD','別名最多五個');
 const aliases=data.aliases.map(alias=>clean(alias,24,'別名'));
 if(new Set([title,...aliases].map(normalize)).size!==aliases.length+1)throw new HttpError(400,'INVALID_WORD','題目與別名不能重複');
 return {title,aliases,difficulty,category:{easy:'簡單',medium:'一般',hard:'挑戰'}[difficulty]};
}
class DrawWordStore{
 constructor(db){this.db=db;}
 list(){
  return this.db.prepare('SELECT id,title,aliases,difficulty,category,author_name AS authorName,created_at AS createdAt FROM draw_words ORDER BY created_at DESC,id DESC').all()
   .map(row=>({...row,aliases:JSON.parse(row.aliases),custom:true}));
 }
 add(user,data){
  const word=validateWord(data);
  if(this.db.prepare('SELECT COUNT(*) AS count FROM draw_words').get().count>=500)throw new HttpError(400,'WORD_LIMIT','好友題庫已達 500 題');
  const key=normalize(word.title);
  if(this.db.prepare('SELECT id FROM draw_words WHERE title_key=?').get(key))throw new HttpError(400,'DUPLICATE_WORD','這個題目已經有人投稿');
  const row={id:'shared-'+randomUUID(),...word,authorName:user.display_name,createdAt:new Date().toISOString(),custom:true};
  this.db.prepare('INSERT INTO draw_words(id,author_id,author_name,title,title_key,aliases,difficulty,category,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
   .run(row.id,user.id,row.authorName,row.title,key,JSON.stringify(row.aliases),row.difficulty,row.category,row.createdAt);
  return row;
 }
}
module.exports={DrawWordStore,validateWord};
