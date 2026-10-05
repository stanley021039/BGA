const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {HttpError}=require('../http/errors');
const clone=x=>JSON.parse(JSON.stringify(x,(key,value)=>['secret','lastSeen'].includes(key)||typeof value==='function'?undefined:value));
const snapshot=room=>clone(room);
const finished=r=>['thunder','majority','gift','draw'].includes(r.type)?r.phase==='finished':r.phase==='showdown';
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,MiB=1024*1024;
const DEFAULT_LIMITS=Object.freeze({maxRowBytes:3*MiB,maxResultBytes:512*1024,maxTraceBytes:256*1024,maxSessionBytes:2*MiB,maxMatchBytes:64*MiB,maxTotalBytes:512*MiB,maxArchives:1000,maxFiles:2200,retentionDays:30});
class HistoryStore{
 constructor(dir,limits={}){
  this.limits={...DEFAULT_LIMITS,...limits};
  for(const [key,value]of Object.entries(this.limits))if(!Number.isSafeInteger(value)||value<1)throw Error('歷史配額設定不正確：'+key);
  this.dir=dir;fs.mkdirSync(dir,{recursive:true});this.records=new WeakMap();this.metas=new Map();this.activeSessions=new Set();this.sizes=new Map();this.totalBytes=0;
  this.lock=path.join(dir,'.lock');
  if(fs.existsSync(this.lock)){const pid=Number(fs.readFileSync(this.lock,'utf8'));let live=false;try{process.kill(pid,0);live=true;}catch{}if(live)throw Error('歷史資料夾已由另一個伺服器使用');fs.unlinkSync(this.lock);}
  fs.writeFileSync(this.lock,String(process.pid),{flag:'wx'});
  try{
   for(const name of fs.readdirSync(dir)){const stat=fs.lstatSync(path.join(dir,name));if(!stat.isFile()||name==='.lock')continue;this.sizes.set(name,stat.size);this.totalBytes+=stat.size;}
   for(const name of [...this.sizes.keys()].filter(f=>f.endsWith('.meta.json'))){const m=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));if(!UUID.test(m.id)||name!==m.id+'.meta.json')throw Error('歷史識別碼不正確');this.metas.set(m.id,m);if(m.status==='playing'){m.status='interrupted';this.saveMeta(m);}}
   this.prune(0,new Set());
  }catch(error){this.close();throw error;}
 }
 close(){if(fs.existsSync(this.lock)&&fs.readFileSync(this.lock,'utf8')===String(process.pid))fs.unlinkSync(this.lock);}
 encode(row,max=this.limits.maxRowBytes){const text=JSON.stringify(row)+'\n';if(Buffer.byteLength(text)>max)throw new HttpError(429,'HISTORY_ROW_LIMIT','對局記錄過大，請建立新房間');return text;}
 account(name,bytes){this.totalBytes+=bytes-(this.sizes.get(name)||0);this.sizes.set(name,bytes);}
 remove(name){if(!this.sizes.has(name))return;fs.unlinkSync(path.join(this.dir,name));this.totalBytes-=this.sizes.get(name);this.sizes.delete(name);}
 removeArchive(id){this.remove(id+'.jsonl');this.remove(id+'.meta.json');this.metas.delete(id);}
 prune(required,protectedIds=new Set(),extraFiles=0){
  const expired=Date.now()-this.limits.retentionDays*86400000;
  const archives=[...this.metas.values()].filter(m=>m.status!=='playing'&&!protectedIds.has(m.id)).sort((a,b)=>String(a.startedAt).localeCompare(String(b.startedAt)));
  for(const m of archives)if(Date.parse(m.endedAt||m.startedAt)<expired||this.metas.size>this.limits.maxArchives||this.totalBytes+required>this.limits.maxTotalBytes||this.sizes.size+extraFiles>this.limits.maxFiles)this.removeArchive(m.id);
  // Completed headers embed setup; an unattached session need not live forever.
  // Active match JSONL is never trimmed or removed to make space.
  for(const name of [...this.sizes.keys()]){const id=name.replace(/\.jsonl$/,'');if(name.endsWith('.jsonl')&&UUID.test(id)&&!this.metas.has(id)&&!this.activeSessions.has(id)&&!protectedIds.has(id))this.remove(name);}
 }
 ensureCapacity(id,bytes,{match=false,extraFiles=0}={}){
  const limit=match?this.limits.maxMatchBytes:this.limits.maxSessionBytes;
  if((this.sizes.get(id+'.jsonl')||0)+bytes>limit)throw new HttpError(429,'HISTORY_QUOTA','這份對局記錄已達容量上限，請建立新房間');
  this.prune(bytes,new Set([id]),extraFiles);
  if(this.totalBytes+bytes>this.limits.maxTotalBytes||this.sizes.size+extraFiles>this.limits.maxFiles)throw new HttpError(429,'HISTORY_QUOTA','歷史記錄容量已滿，請稍後再試或聯絡管理者');
 }
 saveMeta(m){const name=m.id+'.meta.json',file=path.join(this.dir,name),text=JSON.stringify(m);fs.writeFileSync(file+'.tmp',text);fs.renameSync(file+'.tmp',file);this.account(name,Buffer.byteLength(text));}
 appendText(id,text){const name=id+'.jsonl',fd=fs.openSync(path.join(this.dir,name),'a');try{fs.writeFileSync(fd,text);fs.fsyncSync(fd);this.account(name,(this.sizes.get(name)||0)+Buffer.byteLength(text));}finally{fs.closeSync(fd);}}
 append(id,row){const text=this.encode(row);this.ensureCapacity(id,Buffer.byteLength(text),{match:this.metas.has(id),extraFiles:this.sizes.has(id+'.jsonl')?0:1});this.appendText(id,text);}
 trace(ctx,makeRow){if(!ctx.trace||ctx.traceTruncated)return;const row=makeRow(),bytes=Buffer.byteLength(JSON.stringify(row));if(ctx.traceBytes+bytes>this.limits.maxTraceBytes){ctx.traceTruncated=true;return;}ctx.traceBytes+=bytes;ctx.trace.push(row);}
 newSession(room,ctx,previous){
  const session=crypto.randomUUID(),row={kind:'session',schema:1,at:new Date().toISOString(),type:room.type||'poker',room:room.code,...(previous?{continuationOf:previous,initial:snapshot(room)}:{})};
  this.append(session,row);this.activeSessions.add(session);ctx.session=session;
  if(previous){this.activeSessions.delete(previous);this.remove(previous+'.jsonl');}
 }
 attach(room){
  const ctx={session:null,current:null,seq:0,trace:null};this.newSession(room,ctx);this.records.set(room,ctx);
  const readOnly=new Set(['constructor','view','car','player','label','operable','boardMax','boardMin','terrain','kind','road','cost','occupied','empty','actor','targets','available','legalMoves','next','canRaise','touch']);
  for(const name of Object.getOwnPropertyNames(Object.getPrototypeOf(room))){
   if(readOnly.has(name)||typeof room[name]!=='function')continue;const method=room[name],history=this;
   Object.defineProperty(room,name,{value:function(...args){history.trace(ctx,()=>({stage:'enter',method:name,args:clone(args)}));try{const result=method.apply(this,args);history.trace(ctx,()=>({stage:'exit',method:name,...(['moveEffect','resolveSlam','damage','endTurn','newRound','finish','advance','showdown'].includes(name)?{state:snapshot(this)}:{})}));return result;}catch(error){history.trace(ctx,()=>({stage:'error',method:name,error:error.message}));throw error;}},configurable:true});
  }
  const rng=room.rng||crypto.randomInt;room.rng=n=>{const value=rng(n);this.trace(ctx,()=>({stage:'random',max:n,value}));return value;};
 }
 transact(room,operation,run){
  const ctx=this.records.get(room);if(!ctx)throw Error('缺少對局記錄器');if(ctx.failed)throw Error('歷史寫入失敗，已暫停操作以免遺失記錄');
  if(ctx.blockedUntil>Date.now())throw new HttpError(429,'HISTORY_QUOTA','歷史記錄容量已滿，請稍後再試或建立新房間');
  const seq=ctx.seq+1,before=snapshot(room),intent=this.encode({kind:'intent',seq,at:new Date().toISOString(),operation:clone(operation),before});
  const reserve=Buffer.byteLength(intent)+this.limits.maxResultBytes+16*1024;let m=ctx.current,id=m?.id||ctx.session,header=null;
  if(operation.action==='start'&&['waiting','finished','showdown'].includes(room.phase)){
   id=crypto.randomUUID();const type=room.type||'poker',source=fs.readFileSync(path.join(__dirname,'..','games',type==='majority'?'majority.js':type==='thunder'?'thunder.js':type==='gift'?'gift.js':type==='draw'?'draw-guess.js':'poker.js'),'utf8');
   m={id,type,room:room.code,name:room.name,startedAt:new Date().toISOString(),status:'playing',players:room.players.map(p=>p.name),count:0};
   header=this.encode({kind:'header',schema:1,id,session:ctx.session,meta:m,initial:before,engine:{sha256:crypto.createHash('sha256').update(source).digest('hex'),source,...(type==='majority'?{questionBank:fs.readFileSync(path.join(__dirname,'..','games','majority-questions.js'),'utf8')}:type==='gift'?{giftCatalog:fs.readFileSync(path.join(__dirname,'..','games','gift-catalog.js'),'utf8')}:{})},setup:this.readRows(ctx.session)});
  }
  try{
   if(!m&&(this.sizes.get(id+'.jsonl')||0)+reserve>this.limits.maxSessionBytes){this.newSession(room,ctx,ctx.session);id=ctx.session;}
   this.ensureCapacity(id,reserve+(header?Buffer.byteLength(header):0),{match:!!m,extraFiles:header?2:0});
   if(header){this.appendText(id,header);this.metas.set(id,m);ctx.current=m;this.saveMeta(m);}
  }catch(error){if(error.code==='HISTORY_QUOTA')ctx.blockedUntil=Date.now()+60000;else if(!(error instanceof HttpError))ctx.failed=true;throw error;}
  // Preflight a bounded result before writing intent or mutating game state.
  try{this.appendText(id,intent);}catch(error){ctx.failed=true;throw error;}
  ctx.seq=seq;ctx.trace=[];ctx.traceBytes=0;ctx.traceTruncated=false;let result,error;
  try{result=run();}catch(e){error=e;}
  const row={kind:'result',seq,at:new Date().toISOString(),operation:clone(operation),ok:!error,...(error?{error:error.message}:{}),trace:ctx.trace,...(ctx.traceTruncated?{traceTruncated:true}:{}),after:snapshot(room)};ctx.trace=null;
  try{
   this.appendText(id,this.encode(row,this.limits.maxResultBytes));
   if(m){m.count++;m.players=room.players.map(p=>p.name);if(finished(room)){m.status='finished';m.endedAt=row.at;m.result=clone(room.winner||room.results||[]);ctx.current=null;}this.saveMeta(m);}
   this.prune(0,new Set([id]));
  }catch(e){ctx.failed=true;throw e;}
  if(error)throw error;return result;
 }
 list(){return [...this.metas.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt));}
 isPaused(room){const ctx=this.records.get(room);return !!ctx&&(ctx.failed||ctx.blockedUntil>Date.now());}
 markUnrecorded(room){const ctx=this.records.get(room);if(ctx){ctx.failed=true;ctx.unrecorded=true;}}
 warning(room){const ctx=this.records.get(room);if(ctx?.unrecorded)return {code:'HISTORY_WRITE_FAILED',message:'記錄暫停期間有人離席，本局已暫停且未完整保存，請離房後建立新局'};if(ctx?.failed)return {code:'HISTORY_WRITE_FAILED',message:'對局記錄寫入失敗，已暫停操作，請聯絡管理者'};if(ctx?.blockedUntil>Date.now())return {code:'HISTORY_QUOTA',message:'對局記錄容量已滿，已暫停操作，請稍後再試或建立新房間'};return null;}
 interrupt(room,reason){
  const ctx=this.records.get(room),m=ctx?.current;if(!ctx)return;
  try{
   if(m){m.status='interrupted';m.endedAt=new Date().toISOString();m.reason=reason;
    if(ctx.unrecorded)m.incomplete=true;
    this.append(m.id,{kind:'interrupted',at:m.endedAt,reason,...(ctx.unrecorded?{incomplete:true}:{}),state:snapshot(room)});this.saveMeta(m);ctx.current=null;
   }
  }finally{this.activeSessions.delete(ctx.session);this.records.delete(room);this.remove(ctx.session+'.jsonl');}
 }
 read(id){const m=this.metas.get(id);if(!m)throw Error('找不到歷史');if(m.status==='playing')throw Error('對局尚未結束，暫不公開完整歷史');return this.readRows(id);}
 readRows(id){if(!UUID.test(id))throw Error('歷史識別碼不正確');const lines=fs.readFileSync(path.join(this.dir,id+'.jsonl'),'utf8').split('\n'),rows=[];for(let i=0;i<lines.length;i++){if(!lines[i])continue;try{rows.push(JSON.parse(lines[i]));}catch(e){if(i!==lines.length-1)throw e;}}return rows;}
}
module.exports={HistoryStore,snapshot,DEFAULT_LIMITS};
