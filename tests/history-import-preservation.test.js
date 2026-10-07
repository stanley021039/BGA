const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {HistoryStore}=require('../src/history/store'),{settings,loadEnv}=require('../src/config'),{createApp}=require('../src/app');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(t){
 const parent=path.resolve(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'bga-import-sessions-')),dir=path.join(root,'history');fs.mkdirSync(dir);
 t.after(()=>{assert.equal(path.dirname(path.resolve(root)),parent);assert.ok(path.basename(root).startsWith('bga-import-sessions-'));fs.rmSync(root,{recursive:true,force:true});});
 return {root,dir};
}
function session(dir,header={},tail=''){
 const id=crypto.randomUUID(),file=path.join(dir,id+'.jsonl');
 fs.writeFileSync(file,JSON.stringify({kind:'session',schema:1,at:new Date().toISOString(),type:'draw',room:'ABC123',...header})+'\n'+tail);return {id,file};
}
function archive(dir,{ageDays=1,status='finished'}={}){
 const id=crypto.randomUUID(),at=new Date(Date.now()-ageDays*86400000).toISOString(),file=path.join(dir,id+'.jsonl');
 fs.writeFileSync(file,JSON.stringify({kind:'header',schema:1,id,at,engine:{source:'throw new Error("must not execute")'}})+'\n');
 fs.writeFileSync(path.join(dir,id+'.meta.json'),JSON.stringify({id,status,startedAt:at,endedAt:at,count:0}));return {id,file};
}
test('opt-in keeps all 33 imported session log bytes after boot and later pruning without making matches',t=>{
 const {dir}=fixture(t),files=Array.from({length:33},(_,i)=>session(dir,{},JSON.stringify({kind:'intent',seq:1,action:'fixture'})+'\n'+JSON.stringify({kind:'result',seq:1,after:{fixture:i}})+'\n'));
 const before=new Map(files.map(x=>[x.file,digest(x.file)])),bytes=files.reduce((n,x)=>n+fs.statSync(x.file).size,0),match=archive(dir);
 const h=new HistoryStore(dir,{}, {preserveImportedSessions:true});try{
  assert.equal(h.importedSessions.size,33);assert.equal(h.list().length,1);assert.equal(h.list()[0].id,match.id);
  assert.ok(h.totalBytes>=bytes);h.prune(0);for(const [file,hash]of before)assert.equal(digest(file),hash);
  for(const {id}of files)assert.throws(()=>h.read(id));
 }finally{h.close();}
 const restarted=new HistoryStore(dir,{}, {preserveImportedSessions:true});try{for(const [file,hash]of before)assert.equal(digest(file),hash);}finally{restarted.close();}
});
test('default policy still removes unattached sessions',t=>{const {dir}=fixture(t),{file}=session(dir);const h=new HistoryStore(dir);try{assert.equal(fs.existsSync(file),false);assert.equal(h.importedSessions.size,0);}finally{h.close();}});
test('opt-in never preserves malformed or match headers without metadata',t=>{
 const {dir}=fixture(t),files=[session(dir,{kind:'header',engine:{source:'globalThis.importHistoryExecuted=true'}}),session(dir,{schema:2}),session(dir,{type:'unknown'}),session(dir,{at:'invalid'}),session(dir,{room:'../bad'}),session(dir,{engine:{source:'globalThis.importHistoryExecuted=true'}})];
 const broken=session(dir);fs.writeFileSync(broken.file,'{invalid JSON\n');files.push(broken);
 const h=new HistoryStore(dir,{}, {preserveImportedSessions:true});try{assert.equal(h.importedSessions.size,0);for(const x of files)assert.equal(fs.existsSync(x.file),false);assert.equal(globalThis.importHistoryExecuted,undefined);}finally{h.close();}
});
test('only a bounded first line is read; oversized first lines are not preserved',t=>{
 const {dir}=fixture(t),valid=session(dir,{},JSON.stringify({kind:'result',payload:'x'.repeat(2*1024*1024)})+'\n'),large=session(dir,{initial:{payload:'x'.repeat(32*1024)}}),before=digest(valid.file);
 const original=fs.readSync;let bytesRead=0;fs.readSync=function(...args){const n=original.apply(this,args);bytesRead+=n;return n;};let h;
 try{h=new HistoryStore(dir,{}, {preserveImportedSessions:true});}finally{fs.readSync=original;h?.close();}
 assert.ok(bytesRead<=4096+16385);assert.equal(digest(valid.file),before);assert.equal(fs.existsSync(large.file),false);
});
test('archive retention and capacity still apply with imported sessions preserved',t=>{
 const {dir}=fixture(t),saved=session(dir),before=digest(saved.file),old=archive(dir,{ageDays:45}),current=archive(dir,{ageDays:1});
 const h=new HistoryStore(dir,{retentionDays:30,maxTotalBytes:1024*1024}, {preserveImportedSessions:true});try{
  assert.equal(fs.existsSync(old.file),false);assert.equal(fs.existsSync(current.file),true);assert.equal(digest(saved.file),before);
  assert.throws(()=>h.ensureCapacity(crypto.randomUUID(),1024*1024),e=>e.code==='HISTORY_QUOTA');assert.equal(digest(saved.file),before);
 }finally{h.close();}
});
test('newly created unattached logs are not mistaken for imported sessions',t=>{
 const {dir}=fixture(t),saved=session(dir),h=new HistoryStore(dir,{}, {preserveImportedSessions:true});try{const fresh=session(dir);h.sizes.set(path.basename(fresh.file),fs.statSync(fresh.file).size);h.totalBytes+=fs.statSync(fresh.file).size;h.prune(0);assert.equal(fs.existsSync(saved.file),true);assert.equal(fs.existsSync(fresh.file),false);}finally{h.close();}
});
test('preservation rejects symlink logs without reading or deleting their target and releases its lock',t=>{
 const {root,dir}=fixture(t),protectedDir=path.join(root,'protected');fs.mkdirSync(protectedDir);const target=path.join(protectedDir,'protected.jsonl');fs.writeFileSync(target,'protected');const file=path.join(dir,crypto.randomUUID()+'.jsonl');
 // Windows junctions are real reparse links and need no symlink privilege;
 // Linux uses a file symlink to exercise O_NOFOLLOW-compatible path handling.
 fs.symlinkSync(process.platform==='win32'?protectedDir:target,file,process.platform==='win32'?'junction':'file');assert.throws(()=>new HistoryStore(dir,{}, {preserveImportedSessions:true}),/符號連結/);
 assert.equal(fs.readFileSync(target,'utf8'),'protected');assert.equal(fs.lstatSync(file).isSymbolicLink(),true);assert.equal(fs.existsSync(path.join(dir,'.lock')),false);
});
test('config and real app startup propagate strict opt-in and preserve existing session bytes',async t=>{
 const {root,dir}=fixture(t),saved=session(dir),before=digest(saved.file),file=path.join(root,'.env');
 assert.equal(settings({}).historyPreserveImportedSessions,false);assert.equal(settings({HISTORY_PRESERVE_IMPORTED_SESSIONS:'false'}).historyPreserveImportedSessions,false);
 for(const value of ['1','TRUE','false ','',true])assert.throws(()=>settings({HISTORY_PRESERVE_IMPORTED_SESSIONS:value}),/HISTORY_PRESERVE_IMPORTED_SESSIONS/);
 fs.writeFileSync(file,'HISTORY_PRESERVE_IMPORTED_SESSIONS=true\n');assert.equal(settings(loadEnv(file,{})).historyPreserveImportedSessions,true);assert.equal(settings(loadEnv(file,{HISTORY_PRESERVE_IMPORTED_SESSIONS:'false'})).historyPreserveImportedSessions,false);
 const config=settings({DB_FILE:path.join(root,'app.sqlite'),HISTORY_DIR:dir,COMMUNITY_DIR:path.join(root,'community'),MUSIC_DIR:path.join(root,'music'),HOST:'127.0.0.1',EXTERNAL_SIDE_EFFECTS_ENABLED:'false',HISTORY_PRESERVE_IMPORTED_SESSIONS:'true'});
 const app=createApp({...config,port:0,githubClient:{configured:false}});try{assert.equal(digest(saved.file),before);}finally{await app.close();}
 assert.equal(digest(saved.file),before);
 const plain=createApp({...config,port:0,historyPreserveImportedSessions:false,githubClient:{configured:false}});try{assert.equal(fs.existsSync(saved.file),false);}finally{await plain.close();}
 assert.throws(()=>new HistoryStore(dir,{}, {preserveImportedSessions:'true'}),/布林/);
});
