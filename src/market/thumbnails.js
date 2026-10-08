// Disposable derivatives only: originals and all permissions remain in SQLite.
const fs=require('node:fs/promises'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {thumbnailImage,THUMBNAIL_MAX_BYTES:MAX_BYTES}=require('./image-codec');
const VERSION='webp512-v1';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const keyFor=(id,bytes)=>`${id}-${digest(Buffer.from(id))}-${digest(bytes)}-${VERSION}.webp`;
const OWN_FILE=/^[a-f0-9-]{36}-[a-f0-9]{64}-[a-f0-9]{64}-webp512-v1\.webp(?:\.[a-f0-9-]{36}\.tmp)?$/i;
class MarketThumbnails{
 constructor({directory=null,maxImages=1000}={}){this.directory=directory;this.maxImages=maxImages;this.memory=new Map();this.writes=Promise.resolve();}
 async read(key){
  if(!this.directory)return this.memory.get(key)||null;
  try{
   const file=await fs.open(path.join(this.directory,key),'r');
   try{const stat=await file.stat();if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES+65)return null;const stored=await file.readFile();const bytes=stored.subarray(65);return stored[64]===10&&stored.subarray(0,64).toString()===digest(bytes)?bytes:null;}finally{await file.close();}
  }catch(error){if(error.code==='ENOENT')return null;throw error;}
 }
 async write(key,bytes){
  const result=this.writes.then(()=>this.writeOne(key,bytes));this.writes=result.catch(()=>{});return result;
 }
 async writeOne(key,bytes){
  if(!bytes.length||bytes.length>MAX_BYTES)throw Error('Thumbnail exceeds cache limit');
  if(!this.directory){
   // Store tests/embedded users have a bounded in-memory derivative cache.
   for(const old of this.memory.keys())if(old.slice(0,36)===key.slice(0,36))this.memory.delete(old);
   if(this.memory.size>=this.maxImages&&!this.memory.has(key))throw Error('Thumbnail cache is full');
   this.memory.set(key,bytes);return;
  }
  await fs.mkdir(this.directory,{recursive:true,mode:0o700});
  const names=await fs.readdir(this.directory);
  for(const name of names)if(OWN_FILE.test(name)&&name.endsWith('.webp')&&name.slice(0,36)===key.slice(0,36)&&name!==key)await fs.rm(path.join(this.directory,name),{force:true});
  if(!names.includes(key)&&names.filter(name=>OWN_FILE.test(name)&&name.endsWith('.webp')&&name.slice(0,36)!==key.slice(0,36)).length>=this.maxImages)throw Error('Thumbnail cache is full');
  const target=path.join(this.directory,key),temporary=target+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temporary,Buffer.concat([Buffer.from(digest(bytes)+'\n'),bytes]),{flag:'wx',mode:0o600});await fs.rename(temporary,target);}
  finally{await fs.rm(temporary,{force:true});}
 }
 async ensure(id,bytes){const key=keyFor(id,bytes);if(await this.read(key))return;await this.write(key,(await thumbnailImage(bytes)).bytes);}
 async prune(isLive){
  if(!this.directory){for(const key of this.memory.keys())if(!isLive(key))this.memory.delete(key);return;}
  let names;try{names=await fs.readdir(this.directory);}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const name of names){
   await new Promise(resolve=>setImmediate(resolve));
   if(!OWN_FILE.test(name))continue;
   if(name.endsWith('.tmp')){const stat=await fs.stat(path.join(this.directory,name)).catch(()=>null);if(stat&&Date.now()-stat.mtimeMs>3600000)await fs.rm(path.join(this.directory,name),{force:true});}
   else if(!isLive(name))await fs.rm(path.join(this.directory,name),{force:true});
  }
 }
}
module.exports={MarketThumbnails,keyFor,digest,MAX_BYTES};
