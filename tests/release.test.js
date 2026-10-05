const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {run,check,bump}=require('../tools/release.cjs'),{createApp}=require('../src/app');
function fixture(t,version='1.3.7',lock=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-release-'));
 t.after(()=>{assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({name:'release-fixture',version,private:true}));
 fs.writeFileSync(path.join(root,'CHANGELOG.md'),'# 版本紀錄\n\n## ['+version+'] - 2026-10-05\n\n- 既有版本\n');
 if(lock)fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify({name:'release-fixture',version,lockfileVersion:3,packages:{'':{name:'release-fixture',version}}}));
 return root;
}
test('release bump preserves earlier changelog and synchronizes package/lock for all release levels',t=>{
 for(const [type,version]of [['patch','1.3.8'],['minor','1.4.0'],['major','2.0.0']]){
  const root=fixture(t,undefined,true);
  assert.equal(run(['bump',type,'--summary','新增功能','--date','2026-10-06'],root).version,version);
  assert.equal(check(root).version,version);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8')).packages[''].version,version);
  const text=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8');assert.ok(text.indexOf('['+version+']')<text.indexOf('[1.3.7]'));assert.match(text,/既有版本/);
 }
});
test('invalid release inputs cannot modify package, lock or changelog',t=>{
 const root=fixture(t,undefined,true),files=['package.json','package-lock.json','CHANGELOG.md'],before=files.map(file=>fs.readFileSync(path.join(root,file),'utf8'));
 for(const [type,options]of [['feature',{summary:'測試'}],['minor',{}],['minor',{summary:'注入\n## [9.0.0]'}],['patch',{summary:'更新',date:'2026-02-30'}]])assert.throws(()=>bump(root,type,options));
 assert.throws(()=>run(['bump','minor','--summary','更新','--summary','重複'],root));assert.throws(()=>run(['check','--base',''],root));
 assert.deepEqual(files.map(file=>fs.readFileSync(path.join(root,file),'utf8')),before);
});
test('release checks detect stale/missing/duplicate changelog and lock mismatch',t=>{
 for(const fault of ['stale','missing','duplicate','lock']){
  const root=fixture(t,undefined,true);
  if(fault==='lock'){const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));lock.packages[''].version='1.3.6';fs.writeFileSync(path.join(root,'package-lock.json'),JSON.stringify(lock));}
  else{const file=path.join(root,'CHANGELOG.md'),old=fs.readFileSync(file,'utf8');fs.writeFileSync(file,fault==='missing'?'# 紀錄\n':fault==='stale'?old.replace('1.3.7','1.3.6'):old+'\n## [1.3.7] - 2026-10-06\n\n- 重複\n');}
  assert.throws(()=>check(root));
 }
});
test('comparing with a real Git release rejects unchanged versions and patch-only new features',t=>{
 const root=fixture(t),git=args=>execFileSync('git',args,{cwd:root,stdio:['ignore','pipe','pipe']});
 git(['init','--quiet']);git(['add','package.json','CHANGELOG.md']);git(['-c','user.name=Release Test','-c','user.email=release@example.invalid','commit','--quiet','-m','baseline']);
 assert.throws(()=>check(root,{base:'HEAD',type:'minor'}),/沒有依 minor/);
 bump(root,'patch',{summary:'修正',date:'2026-10-06'});assert.equal(check(root,{base:'HEAD',type:'patch'}).version,'1.3.8');
 assert.throws(()=>check(root,{base:'HEAD',type:'minor'}),/沒有依 minor/);
 bump(root,'minor',{summary:'新功能',date:'2026-10-06'});assert.equal(check(root,{base:'HEAD',type:'minor'}).version,'1.4.0');
 assert.throws(()=>check(root,{base:'HEAD',type:'major'}),/沒有依 major/);
});
test('HTTP version is anonymous, uncached and exposes only the package version',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bga-version-http-'));
 const app=createApp({port:0,host:'127.0.0.1',historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),dbFile:path.join(root,'app.sqlite'),externalSideEffectsEnabled:false});
 t.after(async()=>{await app.close();assert.equal(path.dirname(root),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 const base='http://127.0.0.1:'+(await app.listen()).port;
 for(let i=0;i<2;i++){const response=await fetch(base+'/api/version');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-type'),/application\/json/);assert.deepEqual(await response.json(),{version:require('../package.json').version});}
 assert.equal((await fetch(base+'/api/auth/me')).status,401);
 assert.equal((await fetch(base+'/api/version',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 assert.equal(check(path.resolve(__dirname,'..')).version,require('../package.json').version);
});
