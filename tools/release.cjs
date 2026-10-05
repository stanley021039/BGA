'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const TYPES=['major','minor','patch'];
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function parts(version){
  if(typeof version!=='string'||!VERSION.test(version))throw Error('版號必須為 major.minor.patch，不含前導零或先行版標記');
  const values=version.split('.').map(Number);
  if(values.some(value=>!Number.isSafeInteger(value)))throw Error('版號超出安全整數範圍');
  return values;
}
function compare(a,b){for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i]?1:-1;return 0;}
function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('日期必須為有效的 YYYY-MM-DD');return date;}
function read(root){
  const file=path.join(root,'package.json'),pkg=JSON.parse(fs.readFileSync(file,'utf8'));
  parts(pkg.version);
  const changelog=fs.readFileSync(path.join(root,'CHANGELOG.md'),'utf8').replace(/\r\n/g,'\n');
  const releases=[...changelog.matchAll(/^## \[([^\]]+)\] - (\S+)$/gm)];
  for(let i=0;i<releases.length;i++){
    const current=parts(releases[i][1]);validDate(releases[i][2]);
    if(i&&compare(parts(releases[i-1][1]),current)<=0)throw Error('CHANGELOG 版號必須唯一並從新到舊排列');
    const end=releases[i+1]?.index??changelog.length;
    if(!/^\- \S.*/m.test(changelog.slice(releases[i].index+releases[i][0].length,end)))throw Error('每個版本必須有更新摘要');
  }
  const lockFile=path.join(root,'package-lock.json'),lock=fs.existsSync(lockFile)?JSON.parse(fs.readFileSync(lockFile,'utf8')):null;
  if(lock&&(lock.version!==pkg.version||(lock.packages?.['']&&lock.packages[''].version!==pkg.version)))throw Error('package-lock 與 package.json 版號不一致');
  return {file,pkg,changelog,releases,lockFile,lock};
}
function check(root,{base,type='patch'}={}){
  if(!TYPES.includes(type))throw Error('升版類型必須為 major、minor 或 patch');
  const state=read(root);
  if(state.releases[0]?.[1]!==state.pkg.version)throw Error('目前版號缺少對應的最新 CHANGELOG 紀錄');
  if(base!==undefined){
    if(typeof base!=='string'||!base||base.startsWith('-'))throw Error('無效的基準 ref');
    const sha=execFileSync('git',['rev-parse','--verify',base+'^{commit}'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    if(!/^[a-f0-9]{40,64}$/.test(sha))throw Error('無效的基準 commit');
    const prior=JSON.parse(execFileSync('git',['show',sha+':package.json'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    const old=parts(prior.version),next=parts(state.pkg.version),minimum=TYPES.indexOf(type);
    const actual=next.findIndex((value,i)=>value!==old[i]);
    if(compare(next,old)<=0||actual>minimum)throw Error('目前版號沒有依 '+type+' 高於基準 '+prior.version);
  }
  return {version:state.pkg.version,...(base?{base,type}:{})};
}
function bump(root,type,{summary,date=new Date().toISOString().slice(0,10)}={}){
  if(!TYPES.includes(type))throw Error('升版類型必須為 major、minor 或 patch');
  if(typeof summary!=='string'||!summary.trim()||[...summary].length>240||/[\r\n\x00-\x1f\x7f]/.test(summary))throw Error('請提供單行更新摘要，最多240字');
  validDate(date);
  const state=read(root),next=parts(state.pkg.version),index=TYPES.indexOf(type);
  // The original baseline has no changelog entry. After the first release,
  // refuse to build a new entry on top of inconsistent version metadata.
  if(state.releases.length&&state.releases[0][1]!==state.pkg.version)throw Error('先修正目前版號與 CHANGELOG 的不一致');
  next[index]++;for(let i=index+1;i<3;i++)next[i]=0;
  const version=next.join('.');parts(version);
  state.pkg.version=version;
  const entry='## ['+version+'] - '+date+'\n\n- '+summary.trim()+'\n\n';
  const first=state.releases[0]?.index??state.changelog.length;
  const changelog=state.changelog.slice(0,first).trimEnd()+'\n\n'+entry+state.changelog.slice(first);
  const files=[[state.file,JSON.stringify(state.pkg,null,2)+'\n'],[path.join(root,'CHANGELOG.md'),changelog.trimEnd()+'\n']];
  if(state.lock){state.lock.version=version;if(state.lock.packages?.[''])state.lock.packages[''].version=version;files.push([state.lockFile,JSON.stringify(state.lock,null,2)+'\n']);}
  // Validate all inputs before writing; each rename prevents a torn JSON file.
  // A multi-file interruption is detected by release:check, not hidden.
  for(const [file,contents]of files){const temp=file+'.release-'+process.pid;try{fs.writeFileSync(temp,contents,{flag:'wx'});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
  return {version,type,date};
}
function run(argv,root=path.resolve(__dirname,'..')){
  const command=argv.shift(),type=command==='bump'?argv.shift():undefined,options={};
  const allowed=command==='bump'?['summary','date']:command==='check'?['base','type']:[];
  while(argv.length){const flag=argv.shift(),key=flag?.slice(2);if(!flag?.startsWith('--')||!allowed.includes(key)||Object.hasOwn(options,key)||!argv.length)throw Error('無效或重複的參數');options[key]=argv.shift();}
  if(command==='bump')return bump(root,type,options);
  if(command==='check')return check(root,options);
  throw Error('用法：release.cjs bump <minor|patch|major> --summary <摘要> [--date YYYY-MM-DD]；check [--base <ref> --type <類型>]');
}
if(require.main===module){try{console.log(JSON.stringify(run(process.argv.slice(2))));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={run,check,bump};
