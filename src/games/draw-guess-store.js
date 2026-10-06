const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const {normalize}=require('./draw-guess');
const {WORDS,topicLabels}=require('./draw-guess-words');
const {transaction}=require('../db/index');
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

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
 const topic=data?.topic===undefined?'misc':data.topic;
 if(typeof topic!=='string'||!Object.hasOwn(topicLabels,topic))throw new HttpError(400,'INVALID_WORD_TOPIC','請選擇有效的題材');
 return {title,aliases,difficulty,category:{easy:'簡單',medium:'一般',hard:'挑戰'}[difficulty],topic,topicLabel:topicLabels[topic]};
}
class DrawWordStore{
 constructor(db){this.db=db;this.exclusionQuery=db.prepare('SELECT * FROM draw_word_exclusions WHERE word_id=? OR title_key=?');this.excludedQuery=db.prepare('SELECT 1 FROM draw_word_exclusions WHERE word_id=? OR title_key=?');}
 isExcluded(word){return !!this.excludedQuery.get(word.id,normalize(word.title));}
 builtin(){return WORDS.filter(word=>!this.isExcluded(word));}
 list(){
  return this.db.prepare('SELECT w.id,w.title,w.aliases,w.difficulty,w.category,w.topic,w.author_name AS authorName,w.created_at AS createdAt FROM draw_words w WHERE NOT EXISTS(SELECT 1 FROM draw_word_exclusions e WHERE e.word_id=w.id OR e.title_key=w.title_key) ORDER BY w.created_at DESC,w.id DESC').all()
   .map(row=>({...row,aliases:JSON.parse(row.aliases),topicLabel:topicLabels[row.topic]||topicLabels.misc,custom:true}));
 }
 ban(word,audit){
  const title=clean(word?.title,24,'題目'),key=normalize(title),electorate=audit?.electorate,votes=audit?.votes;
  const validSeats=items=>Array.isArray(items)&&items.length>=1&&items.length<=8&&new Set(items).size===items.length&&items.every(id=>typeof id==='string'&&UUID.test(id));
  if(typeof word?.id!=='string'||!/^[a-z0-9-]{1,64}$/i.test(word.id)||key.length>512||!validSeats(electorate)||!validSeats(votes)||votes.some(id=>!electorate.includes(id))||audit.required!==Math.floor(electorate.length/2)+1||votes.length<audit.required||typeof audit.roomCode!=='string'||!/^[A-F0-9]{6}$/.test(audit.roomCode)||!UUID.test(audit.resultId||'')||!UUID.test(audit.gameRunId||''))throw new HttpError(400,'INVALID_WORD_BAN','禁題投票紀錄不正確');
  try{return transaction(this.db,()=>{
   const existing=this.exclusionQuery.get(word.id,key);if(existing)return existing;
   const row={word_id:word.id,title,title_key:key,room_code:audit.roomCode,result_id:audit.resultId,game_run_id:audit.gameRunId,electorate_json:JSON.stringify(electorate),votes_json:JSON.stringify(votes),required:audit.required,created_at:new Date().toISOString()};
   this.db.prepare('INSERT INTO draw_word_exclusions(word_id,title,title_key,room_code,result_id,game_run_id,electorate_json,votes_json,required,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(row.word_id,row.title,row.title_key,row.room_code,row.result_id,row.game_run_id,row.electorate_json,row.votes_json,row.required,row.created_at);
   return row;
  });}catch(error){const failure=new HttpError(503,'DRAW_BAN_UNAVAILABLE','暫時無法保存禁題投票；這一票尚未接受，請稍後重試');failure.cause=error;throw failure;}
 }
 add(user,data){
  const word=validateWord(data);
  if(this.isExcluded({id:'',title:word.title}))throw new HttpError(400,'DRAW_WORD_BANNED','這個題目已經由玩家投票停用，不能重新投稿');
  if(this.db.prepare('SELECT COUNT(*) AS count FROM draw_words').get().count>=500)throw new HttpError(400,'WORD_LIMIT','好友題庫已達 500 題');
  const key=normalize(word.title);
  if(this.db.prepare('SELECT id FROM draw_words WHERE title_key=?').get(key))throw new HttpError(400,'DUPLICATE_WORD','這個題目已經有人投稿');
  const row={id:'shared-'+randomUUID(),...word,authorName:user.display_name,createdAt:new Date().toISOString(),custom:true};
  this.db.prepare('INSERT INTO draw_words(id,author_id,author_name,title,title_key,aliases,difficulty,category,topic,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
   .run(row.id,user.id,row.authorName,row.title,key,JSON.stringify(row.aliases),row.difficulty,row.category,row.topic,row.createdAt);
  return row;
 }
}
module.exports={DrawWordStore,validateWord};
