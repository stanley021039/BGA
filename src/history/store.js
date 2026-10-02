const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x, (key,value)=>['secret','lastSeen'].includes(key)||typeof value==='function'?undefined:value));
const snapshot=room=>clone(room);
const finished=r=>['thunder','majority','gift'].includes(r.type)?r.phase==='finished':r.phase==='showdown';
class HistoryStore{
 constructor(dir){
  this.dir=dir;fs.mkdirSync(dir,{recursive:true});this.records=new WeakMap();this.metas=new Map();
  this.lock=path.join(dir,'.lock');
  if(fs.existsSync(this.lock)){const pid=Number(fs.readFileSync(this.lock,'utf8'));let live=false;try{process.kill(pid,0);live=true;}catch{}if(live)throw Error('歷史資料夾已由另一個伺服器使用');fs.unlinkSync(this.lock);}
  fs.writeFileSync(this.lock,String(process.pid),{flag:'wx'});
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.meta.json'))){const m=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));if(m.status==='playing'){m.status='interrupted';this.saveMeta(m);}this.metas.set(m.id,m);}
 }
 close(){if(fs.existsSync(this.lock)&&fs.readFileSync(this.lock,'utf8')===String(process.pid))fs.unlinkSync(this.lock);}
 saveMeta(m){const file=path.join(this.dir,m.id+'.meta.json');fs.writeFileSync(file+'.tmp',JSON.stringify(m));fs.renameSync(file+'.tmp',file);}
 append(id,row){const fd=fs.openSync(path.join(this.dir,id+'.jsonl'),'a');try{fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
 attach(room){
  const session=crypto.randomUUID(),ctx={session,current:null,seq:0,trace:null};this.records.set(room,ctx);
  const readOnly=new Set(['constructor','view','car','player','label','operable','boardMax','boardMin','terrain','kind','road','cost','occupied','empty','actor','targets','available','legalMoves','next','canRaise','touch']);
  for(const name of Object.getOwnPropertyNames(Object.getPrototypeOf(room))){if(readOnly.has(name)||typeof room[name]!=='function')continue;const method=room[name];Object.defineProperty(room,name,{value:function(...args){const trace=ctx.trace;if(trace)trace.push({stage:'enter',method:name,args:clone(args)});try{const result=method.apply(this,args);if(trace)trace.push({stage:'exit',method:name,...(['moveEffect','resolveSlam','damage','endTurn','newRound','finish','advance','showdown'].includes(name)?{state:snapshot(this)}:{})});return result;}catch(e){if(trace)trace.push({stage:'error',method:name,error:e.message});throw e;}},configurable:true});}
  const rng=room.rng||crypto.randomInt;room.rng=n=>{const value=rng(n);if(ctx.trace)ctx.trace.push({stage:'random',max:n,value});return value;};
  this.append(session,{kind:'session',schema:1,at:new Date().toISOString(),type:room.type||'poker',room:room.code});
 }
 transact(room,operation,run){
  const ctx=this.records.get(room);if(!ctx)throw Error('缺少對局記錄器');
  if(ctx.failed)throw Error('歷史寫入失敗，已暫停操作以免遺失記錄');
  if(operation.action==='start'&&['waiting','finished','showdown'].includes(room.phase)){
   const id=crypto.randomUUID(),type=room.type||'poker',source=fs.readFileSync(path.join(__dirname,'..','games',type==='majority'?'majority.js':type==='thunder'?'thunder.js':type==='gift'?'gift.js':'poker.js'),'utf8');
   const m={id,type,room:room.code,name:room.name,startedAt:new Date().toISOString(),status:'playing',players:room.players.map(p=>p.name),count:0};
   ctx.current=m;this.metas.set(id,m);this.saveMeta(m);
   this.append(id,{kind:'header',schema:1,id,session:ctx.session,meta:m,initial:snapshot(room),engine:{sha256:crypto.createHash('sha256').update(source).digest('hex'),source,...(type==='majority'?{questionBank:fs.readFileSync(path.join(__dirname,'..','games','majority-questions.js'),'utf8')}:type==='gift'?{giftCatalog:fs.readFileSync(path.join(__dirname,'..','games','gift-catalog.js'),'utf8')}:{})},setup:fs.readFileSync(path.join(this.dir,ctx.session+'.jsonl'),'utf8').trim().split('\n').map(JSON.parse)});
  }
  const m=ctx.current,id=m?.id||ctx.session,seq=++ctx.seq;
  try{this.append(id,{kind:'intent',seq,at:new Date().toISOString(),operation:clone(operation),before:snapshot(room)});}catch(e){ctx.failed=true;throw e;}
  ctx.trace=[];let result,error;
  try{result=run();}catch(e){error=e;}
  const row={kind:'result',seq,at:new Date().toISOString(),operation:clone(operation),ok:!error,...(error?{error:error.message}:{}),trace:ctx.trace,after:snapshot(room)};ctx.trace=null;
  try{
   this.append(id,row);
   if(m){m.count++;m.players=room.players.map(p=>p.name);if(finished(room)){m.status='finished';m.endedAt=row.at;m.result=clone(room.winner||room.results||[]);ctx.current=null;}this.saveMeta(m);}
  }catch(e){ctx.failed=true;throw e;}
  if(error)throw error;return result;
 }
 list(){return [...this.metas.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt));}
 interrupt(room,reason){const ctx=this.records.get(room),m=ctx?.current;if(!m)return;m.status='interrupted';m.endedAt=new Date().toISOString();m.reason=reason;this.append(m.id,{kind:'interrupted',at:m.endedAt,reason,state:snapshot(room)});this.saveMeta(m);ctx.current=null;}
 read(id){const m=this.metas.get(id);if(!m)throw Error('找不到歷史');if(m.status==='playing')throw Error('對局尚未結束，暫不公開完整歷史');return this.readRows(id);}
 readRows(id){const lines=fs.readFileSync(path.join(this.dir,id+'.jsonl'),'utf8').split('\n'),rows=[];for(let i=0;i<lines.length;i++){if(!lines[i])continue;try{rows.push(JSON.parse(lines[i]));}catch(e){if(i!==lines.length-1)throw e;}}return rows;}
}
module.exports={HistoryStore,snapshot};
