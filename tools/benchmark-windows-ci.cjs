'use strict';
// Diagnostic branch only. The candidate is compiled in memory in test children;
// source files, production durability settings and assertions remain unchanged.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module');
const {createHash}=require('node:crypto'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),target=path.join(root,'tests/market-images.test.js');
function batched(source){
 const start=source.indexOf("test('backup validator rejects per-author/gallery/storage quotas before decoding rows'");
 const end=source.indexOf('\n});',start)+4;
 if(start<0||end<start)throw Error('Quota test source mismatch');
 let count=0;
 const block=source.slice(start,end).replace(/for\(let i=0;i<(100|900|65);i\+\+\)insert\.run\([^;\r\n]+\);/g,loop=>{
  count++;return "f.db.exec('BEGIN');try{"+loop+"f.db.exec('COMMIT');}catch(error){f.db.exec('ROLLBACK');throw error;}";
 });
 if(count!==3)throw Error('Expected exactly three unchanged fixture insert loops');
 return source.slice(0,start)+block+source.slice(end);
}
if(require.main!==module){
 if(process.env.BGA_BENCH_VARIANT==='batched'){
  const original=Module._extensions['.js'];
  Module._extensions['.js']=function(mod,filename){
   if(path.resolve(filename)===target)return mod._compile(batched(fs.readFileSync(filename,'utf8')),filename);
   return original(mod,filename);
  };
 }
}else{
 const output=path.resolve(process.env.BGA_BENCH_OUTPUT||path.join(os.tmpdir(),'bga-windows-benchmark'));
 fs.mkdirSync(output,{recursive:true});
 const original=fs.readFileSync(target,'utf8');batched(original);
 const report={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,platform:process.platform,os:os.release(),cpu:os.cpus()[0]?.model,availableParallelism:os.availableParallelism(),totalMemory:os.totalmem(),image:process.env.ImageVersion,sourceSha256:createHash('sha256').update(original).digest('hex'),runs:[]};
 console.log('BENCH_ENV '+JSON.stringify(report));
 const files=['tests/market-images.test.js','tests/server-resource-limits.test.js','tests/quacks-http.test.js'];
 const pattern='backup validator rejects per-author|1000 waiting join/leave|quacks retry authenticated';
 const smoke=process.argv.includes('--smoke'),repeats=smoke?1:3;
 for(let repeat=1;repeat<=repeats;repeat++)for(const concurrency of smoke?[1]:repeat%2?[1,3]:[3,1])for(const variant of repeat%2?['baseline','batched']:['batched','baseline']){
  const args=['--require',__filename,'--test','--test-reporter=tap','--test-concurrency='+concurrency,'--test-name-pattern',smoke?'backup validator rejects per-author':pattern,...(smoke?[files[0]]:files)];
  const env={...process.env,BGA_BENCH_VARIANT:variant};delete env.NODE_TEST_CONTEXT;
  const start=performance.now(),run=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',maxBuffer:8*1024*1024,timeout:180000});
  const wallMs=performance.now()-start,records=[];let name;
  for(const line of (run.stdout||'').split(/\r?\n/)){
   const match=line.match(/^# Subtest: (.*)/);if(match)name=match[1];
   const duration=line.match(/^  duration_ms: ([\d.]+)/);if(duration&&name){records.push({name,ms:Number(duration[1])});name=null;}
  }
  const result={repeat,concurrency,variant,wallMs,status:run.status,error:run.error?.message,records};report.runs.push(result);
  fs.writeFileSync(path.join(output,`${repeat}-c${concurrency}-${variant}.tap`),(run.stdout||'')+'\n'+(run.stderr||''));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('BENCH_RUN '+JSON.stringify(result));
  if(run.status!==0||records.length!==(smoke?1:5)||!new RegExp('^# pass '+(smoke?1:5)+'$','m').test(run.stdout)){process.exitCode=1;break;}
 }
 if(fs.readFileSync(target,'utf8')!==original)throw Error('Benchmark changed source');
}
