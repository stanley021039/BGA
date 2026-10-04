const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const MAX_BYTES=20*1024*1024;
function audioType(bytes){
 if(bytes.length<64)throw new HttpError(400,'INVALID_AUDIO','音樂檔案不完整');
 if(bytes.toString('ascii',0,4)==='OggS'&&bytes[4]===0&&(bytes.includes(Buffer.from('OpusHead'))||bytes.includes(Buffer.from('\x01vorbis','binary'))))return {mime:'audio/ogg',ext:'ogg'};
 if(bytes.toString('ascii',4,8)==='ftyp'&&['M4A ','mp41','mp42','isom','iso2'].includes(bytes.toString('ascii',8,12))&&bytes.includes(Buffer.from('mdat'))&&bytes.includes(Buffer.from('moov')))return {mime:'audio/mp4',ext:'m4a'};
 let start=0;if(bytes.toString('ascii',0,3)==='ID3'){if(bytes.subarray(6,10).some(n=>n>127))throw new HttpError(400,'INVALID_AUDIO','MP3 標籤不正確');start=10+((bytes[6]<<21)|(bytes[7]<<14)|(bytes[8]<<7)|bytes[9]);}
 for(let i=start;i<Math.min(bytes.length-3,start+4096);i++){const b=bytes[i+1],c=bytes[i+2];if(bytes[i]===255&&(b&224)===224&&(b&24)!==8&&(b&6)===2&&(c&240)!==0&&(c&240)!==240&&(c&12)!==12)return {mime:'audio/mpeg',ext:'mp3'};}
 throw new HttpError(400,'INVALID_AUDIO','請上傳有效的 MP3、M4A 或 OGG 音樂');
}
class MusicStore{
 constructor(db,dir){this.db=db;this.dir=dir;fs.mkdirSync(dir,{recursive:true});}
 list(){return this.db.prepare('SELECT music_tracks.id,music_tracks.title,music_tracks.duration,music_tracks.size,music_tracks.owner_id AS ownerId,users.display_name AS author,music_tracks.created_at AS createdAt FROM music_tracks JOIN users ON users.id=music_tracks.owner_id ORDER BY music_tracks.created_at DESC').all();}
 get(id){const row=this.db.prepare('SELECT * FROM music_tracks WHERE id=?').get(id);if(!row)throw new HttpError(404,'MUSIC_NOT_FOUND','找不到這首音樂');return row;}
 add(user,{title,duration},bytes){
  if(typeof title!=='string'||!title.trim()||[...title.trim()].length>80||/[\u0000-\u001f\u007f]/.test(title))throw new HttpError(400,'INVALID_TITLE','曲名需為 1–80 字');
  if(!Number.isFinite(duration)||duration<1||duration>14400)throw new HttpError(400,'INVALID_DURATION','音樂長度需為 1 秒至 4 小時');
  if(bytes.length>MAX_BYTES)throw new HttpError(413,'MUSIC_TOO_LARGE','每首最多 20 MB');
  if(this.db.prepare('SELECT COUNT(*) AS n FROM music_tracks WHERE owner_id=?').get(user.id).n>=20)throw new HttpError(400,'MUSIC_LIMIT','每人最多上傳 20 首');
  if(this.db.prepare('SELECT COUNT(*) AS n FROM music_tracks').get().n>=500)throw new HttpError(400,'MUSIC_LIMIT','共用音樂庫已達 500 首上限');
  const {mime,ext}=audioType(bytes),id=randomUUID(),file=path.join(this.dir,id+'.'+ext);
  fs.writeFileSync(file,bytes,{flag:'wx'});
  try{this.db.prepare('INSERT INTO music_tracks(id,owner_id,title,duration,size,mime,ext,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,title.trim(),duration,bytes.length,mime,ext,new Date().toISOString());}catch(error){fs.unlinkSync(file);throw error;}
  return this.list().find(row=>row.id===id);
 }
 remove(user,id){const row=this.get(id);if(user.role!=='admin'&&row.owner_id!==user.id)throw new HttpError(403,'FORBIDDEN','只能刪除自己上傳的音樂');const file=path.join(this.dir,row.id+'.'+row.ext);if(fs.existsSync(file))fs.unlinkSync(file);this.db.prepare('DELETE FROM music_tracks WHERE id=?').run(id);return {ok:true};}
 stream(req,res,id){
  const row=this.get(id),file=path.join(this.dir,row.id+'.'+row.ext),size=fs.statSync(file).size;
  let start=0,end=size-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!match||(!match[1]&&!match[2]))return this.invalidRange(res,size);if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return this.invalidRange(res,size);start=Math.max(0,size-suffix);}else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return this.invalidRange(res,size);status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);}
  res.setHeader('Content-Type',row.mime);res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',end-start+1);res.setHeader('Cache-Control','private, no-store');res.statusCode=status;
  if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
 }
 invalidRange(res,size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();}
}
module.exports={MusicStore,MAX_BYTES,audioType};
