const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../tools/data-transfer-ui/app.js'),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const bundleId='31e9c257-8eb2-4b24-a0e0-3dc4b42296c4';
const success=action=>({ok:true,result:{action,...(['verify','restore'].includes(action)?{bundleId}:{})}});
const idle=lastResponse=>({ok:true,result:{busy:false,action:null,lastResponse:lastResponse||null}});
const running=()=>({ok:true,result:{busy:true,action:'export',lastResponse:null}});
function harness(action='keygen'){
 const nodes=new Map(),requests=[],timers=new Map(),copied=[];let timerId=0;
 const groups={keyFile:'keyFields',dbFile:'sourceFields',historyDir:'sourceFields',communityDir:'sourceFields',musicDir:'sourceFields',envId:'sourceFields',sourceStopped:'sourceFields',outputDir:'outputFields',bundleDir:'bundleFields',destinationDir:'restoreFields',targetStopped:'restoreFields'};
 function node(id){
  if(!nodes.has(id))nodes.set(id,{id,value:id==='action'?action:id==='envId'?'production':'',name:id,checked:id==='dryMode',disabled:false,hidden:false,textContent:'',dataset:{},handlers:{},children:[],files:[],attributes:{},
   querySelectorAll(){return Object.keys(groups).filter(field=>groups[field]===id).map(node);},closest(){return node(groups[id]||'advanced');},addEventListener(type,fn){this.handlers[type]=fn;},
   reportValidity(){return [...nodes.values()].every(field=>field.disabled||!field.required||(['sourceStopped','targetStopped'].includes(field.id)?field.checked:Boolean(field.value)));},
   replaceChildren(){this.children=[];},append(...items){this.children.push(...items);},setAttribute(key,value){this.attributes[key]=value;},
  });return nodes.get(id);
 }
 const document={getElementById:node,querySelector:()=>({content:'a'.repeat(64)}),createElement:tag=>({tag,textContent:'',children:[],handlers:{},append(...items){this.children.push(...items);},addEventListener(type,fn){this.handlers[type]=fn;}})};
 const context=vm.createContext({document,window:{},navigator:{clipboard:{async writeText(text){copied.push(text);}}},
  setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},
  fetch(url,options={}){return new Promise((resolve,reject)=>requests.push({url,options,resolve:body=>resolve({json:async()=>body}),resolveResponse:resolve,reject}));},
 });
 vm.runInContext(script,context,{filename:'tools/data-transfer-ui/app.js'});
 return {node,requests,timers,copied,
  stateRequests:()=>requests.filter(req=>req.url==='/api/state'),posts:()=>requests.filter(req=>req.url==='/api/run'),
  input(id,value){node(id).value=value;node('transferForm').handlers.input({target:node(id)});},
  check(id,value=true){node(id).checked=value;node('transferForm').handlers.input({target:node(id)});},
  mode(value){node('dryMode').checked=value==='dry';node('applyMode').checked=value==='apply';const mode={value,name:'restoreMode'};node('transferForm').handlers.input({target:mode});node('transferForm').handlers.change({target:mode});},
  files(id,files){node(id).files=files;node('transferForm').handlers.input({target:node(id)});node('transferForm').handlers.change({target:node(id)});},
  click:id=>node(id).handlers.click(),
  uploads:()=>requests.filter(req=>req.url.startsWith('/api/import-upload')),
  submit:()=>node('transferForm').handlers.submit({preventDefault(){}}),
  async poll(){const [id,timer]=timers.entries().next().value;timers.delete(id);return timer.fn();},
 };
}
async function ready(){const ui=harness();ui.stateRequests()[0].resolve(idle());await turn();ui.input('keyFile','C:/synthetic/backup.key');return ui;}

test('an older initial idle response cannot unlock a submitted operation or replace its result',async()=>{
 const ui=harness();ui.input('keyFile','C:/synthetic/backup.key');const submitted=ui.submit();
 assert.equal(ui.node('controls').disabled,true);assert.equal(ui.posts().length,1);
 ui.stateRequests()[0].resolve(idle(success('inspect')));await turn();
 assert.equal(ui.node('controls').disabled,true);assert.equal(ui.node('resultOutput').textContent,'');
 await ui.submit();assert.equal(ui.posts().length,1,'even a direct submit event cannot send again');
 ui.posts()[0].resolve(success('keygen'));await submitted;
 assert.equal(ui.node('controls').disabled,false);assert.equal(JSON.parse(ui.node('resultOutput').textContent).result.action,'keygen');
});

test('server completion while the HTTP body is pending still blocks a second submit',async()=>{
 const ui=harness();ui.input('keyFile','C:/synthetic/backup.key');const submitted=ui.submit();let finishBody;
 ui.posts()[0].resolveResponse({json:()=>new Promise(resolve=>finishBody=resolve)});await turn();
 ui.stateRequests()[0].resolve(idle(success('keygen')));await turn();await ui.submit();
 assert.equal(ui.node('controls').disabled,true);assert.equal(ui.posts().length,1);
 finishBody(success('keygen'));await submitted;assert.equal(ui.node('controls').disabled,false);
});

test('stale state errors do not unlock or overwrite a newer pending or completed submission',async()=>{
 for(const completed of [false,true]){
  const ui=harness();ui.input('keyFile','C:/synthetic/backup.key');const submitted=ui.submit();
  if(completed){ui.posts()[0].resolve(success('keygen'));await submitted;}
  ui.stateRequests()[0].reject(Error('old query failed'));await turn();
  assert.equal(ui.node('controls').disabled,!completed);assert.equal(ui.timers.size,0);
  assert.equal(ui.node('status').dataset.kind,completed?'success':'busy');
  if(!completed){ui.posts()[0].resolve(success('keygen'));await submitted;}
 }
});

test('a stale running state cannot re-lock a completed submission or overwrite its success',async()=>{
 const ui=harness();ui.input('keyFile','C:/synthetic/backup.key');const submitted=ui.submit();
 ui.posts()[0].resolve(success('keygen'));await submitted;ui.stateRequests()[0].resolve(running());await turn();
 assert.equal(ui.node('controls').disabled,false);assert.equal(ui.node('status').dataset.kind,'success');assert.equal(ui.timers.size,0);
});

test('refresh only queries work, polls once per second and shows its final result without a POST',async()=>{
 const ui=harness();assert.equal(ui.requests.length,1);assert.equal(ui.posts().length,0);
 ui.stateRequests()[0].resolve(running());await turn();assert.equal(ui.node('controls').disabled,true);
 assert.deepEqual([...ui.timers.values()].map(timer=>timer.delay),[1000]);
 const polling=ui.poll();ui.stateRequests()[1].resolve(idle(success('export')));await polling;
 assert.equal(ui.posts().length,0);assert.equal(ui.node('controls').disabled,false);assert.equal(ui.timers.size,0);
 assert.equal(JSON.parse(ui.node('resultOutput').textContent).result.action,'export');
});

test('BUSY rejection remains locked until a fresh state confirms the active work has settled',async()=>{
 const ui=await ready(),submitted=ui.submit();ui.posts()[0].resolve({ok:false,error:{code:'BUSY',message:'Another operation is running'}});await turn();
 assert.equal(ui.node('controls').disabled,true);await ui.submit();assert.equal(ui.posts().length,1);
 ui.stateRequests()[1].resolve(running());await submitted;
 assert.deepEqual([...ui.timers.values()].map(timer=>timer.delay),[1000]);
 const polling=ui.poll();ui.stateRequests()[2].resolve(idle(success('inspect')));await polling;
 assert.equal(ui.node('controls').disabled,false);assert.equal(ui.posts().length,1);
});

test('a lost POST and failed recovery query stay locked; two-second GET retries never resend it',async()=>{
 const ui=await ready(),submitted=ui.submit();ui.posts()[0].reject(Error('connection lost'));await turn();
 assert.equal(ui.node('controls').disabled,true);ui.stateRequests()[1].reject(Error('still unavailable'));await submitted;
 assert.equal(ui.node('controls').disabled,true);assert.match(ui.node('status').textContent,/無法確認/);
 assert.deepEqual([...ui.timers.values()].map(timer=>timer.delay),[2000]);await ui.submit();assert.equal(ui.posts().length,1);
 const polling=ui.poll();ui.stateRequests()[2].resolve(idle(success('keygen')));await polling;
 assert.equal(ui.node('controls').disabled,false);assert.equal(ui.posts().length,1);assert.equal(ui.timers.size,0);
});

test('initial state failure keeps controls locked until state is known, then removes the stale error',async()=>{
 const ui=harness();ui.stateRequests()[0].reject(Error('offline'));await turn();ui.input('keyFile','C:/synthetic/backup.key');
 await ui.submit();assert.equal(ui.posts().length,0);assert.equal(ui.node('controls').disabled,true);
 const polling=ui.poll();ui.stateRequests()[1].resolve(idle());await polling;
 assert.equal(ui.node('controls').disabled,false);assert.match(ui.node('status').textContent,/沒有執行中的工作/);assert.equal(ui.node('status').dataset.kind,'info');
});

test('ordinary transfer failure unlocks for correction and preserves the returned error',async()=>{
 const ui=await ready(),submitted=ui.submit();ui.posts()[0].resolve({ok:false,error:{code:'INVALID_KEY',message:'Invalid key'}});await submitted;
 assert.equal(ui.node('controls').disabled,false);assert.match(ui.node('status').textContent,/32-byte/);assert.equal(ui.stateRequests().length,1);
});

test('a malformed operation response stays locked while fresh state is being recovered',async()=>{
 const ui=await ready(),submitted=ui.submit();ui.posts()[0].resolve({ok:false,error:null});await turn();
 assert.equal(ui.node('controls').disabled,true);await ui.submit();assert.equal(ui.posts().length,1);
 ui.stateRequests()[1].resolve(idle());await submitted;
 assert.equal(ui.node('controls').disabled,false);assert.match(ui.node('status').textContent,/沒有執行中的工作/);
});

async function localVerified(){
 const ui=await ready();ui.input('action','verify');ui.input('bundleDir','C:/synthetic/bundle');
 const submitted=ui.submit();ui.posts()[0].resolve(success('verify'));await submitted;
 ui.input('destinationDir','C:/synthetic/new-generation');return ui;
}
async function localRehearsed(){
 const ui=await localVerified(),submitted=ui.submit();
 assert.equal(JSON.parse(ui.posts()[1].options.body).request.apply,false);
 ui.posts()[1].resolve({ok:true,result:{action:'restore',bundleId,dryRun:true}});await submitted;return ui;
}
test('copied preview matches a rehearsed restore and apply still requires stopped-target acknowledgement',async()=>{
 const ui=await localRehearsed();await ui.submit();assert.equal(ui.posts().length,2);assert.equal(ui.node('targetStopped').required,true);
 ui.check('targetStopped');await ui.click('copyRequest');const preview=JSON.parse(ui.copied[0]);
 const submitted=ui.submit(),posted=JSON.parse(ui.posts()[2].options.body);
 assert.deepEqual(posted.request,preview);assert.equal(posted.request.apply,true);assert.equal(posted.confirmations.targetStopped,true);
 ui.posts()[2].resolve({ok:true,result:{action:'restore',bundleId,dryRun:false}});await submitted;
 assert.equal(ui.node('runButton').disabled,true);assert.match(ui.node('status').textContent,/尚未切換/);
 ui.input('destinationDir','C:/synthetic/another-generation');assert.equal(ui.node('targetStopped').checked,false);assert.equal(ui.node('applyMode').disabled,true);
});

const verification = {action:'verify',bundleId,origin:{envId:'test-origin'},summary:{database:{tableCounts:{users:3,user_artworks:2,draw_words:4,player_characters:1,community_gifts:1}},communityQuestions:5,musicFiles:6,historyMatches:7}};
const uploaded = {uploadId:'upload-one',bundleDir:'C:/managed/bundle',keyFile:'C:/managed/key',files:3,bytes:300,verification};
function uploadFiles(changes={}){
 const manifest={files:[{payload:'payload/000001.bin',bytes:8},{payload:'payload/000002.bin',bytes:12}],summary:{database:{tableCounts:{users:99999}}}};
 return [
  {name:'manifest.json',webkitRelativePath:'test-bundle/manifest.json',size:200,text:async()=>JSON.stringify(manifest)},
  {name:'000001.bin',webkitRelativePath:'test-bundle/payload/000001.bin',size:8},
  {name:'000002.bin',webkitRelativePath:'test-bundle/payload/000002.bin',size:12},
 ].map((file,index)=>({...file,...changes[index]}));
}
async function importReady(){
 const ui=harness('verify');ui.stateRequests()[0].resolve(idle());await turn();return ui;
}
function chooseFiles(ui,files=uploadFiles(),key={name:'backup.key',size:32}){
 ui.files('bundlePicker',files);ui.files('keyPicker',[key]);return {files,key};
}
async function uploadUntilFinish(ui){
 const operation=ui.click('uploadButton');await turn();
 ui.uploads().at(-1).resolve({ok:true,result:{uploadId:'upload-one'}});await turn();
 for(let i=0;i<3;i++){ui.uploads().at(-1).resolve({ok:true,result:{files:i+1}});await turn();}
 ui.uploads().at(-1).resolve({ok:true,result:{keyReceived:true}});await turn();
 assert.match(ui.uploads().at(-1).url,/\/finish$/);
 return {operation,finish:ui.uploads().at(-1)};
}
async function successfullyUploaded(){
 const ui=await importReady();chooseFiles(ui);const {operation,finish}=await uploadUntilFinish(ui);
 finish.resolve({ok:true,result:uploaded});await operation;return ui;
}
test('import starts with five visible unknown counts and sends only the state query',async()=>{
 const ui=harness('verify');
 assert.equal(ui.node('action').value,'verify');assert.equal(ui.node('uploadButton').disabled,true);
 assert.equal(ui.node('resultSummary').children.length,5);
 assert.ok(ui.node('resultSummary').children.every(box=>box.children[0].textContent==='—'));
 assert.equal(ui.requests.length,1);assert.equal(ui.posts().length,0);assert.equal(ui.uploads().length,0);
 ui.stateRequests()[0].resolve(idle());await turn();
});
test('upload streams manifest first, payloads and key in order; old state and repeated clicks cannot unlock or resend',async()=>{
 const ui=harness('verify'),chosen=chooseFiles(ui),operation=ui.click('uploadButton');await turn();
 assert.equal(ui.node('controls').disabled,true);
 ui.stateRequests()[0].resolve(idle(success('inspect')));await turn();
 assert.equal(ui.node('controls').disabled,true);assert.equal(ui.node('resultOutput').textContent,'');
 await ui.click('uploadButton');await ui.submit();assert.equal(ui.uploads().length,1);assert.equal(ui.posts().length,0);
 ui.uploads()[0].resolve({ok:true,result:{uploadId:'upload-one'}});await turn();
 for(let i=0;i<3;i++){
  const req=ui.uploads().at(-1);
  assert.equal(req.options.method,'PUT');assert.equal(req.options.headers['Content-Type'],'application/octet-stream');
  assert.equal(req.options.headers['X-Import-Path'],['manifest.json','payload/000001.bin','payload/000002.bin'][i]);
  assert.equal(req.options.headers['X-Transfer-Token'],'a'.repeat(64));assert.equal(req.options.body,chosen.files[i]);
  req.resolve({ok:true,result:{files:i+1}});await turn();
 }
 const keyReq=ui.uploads().at(-1);assert.match(keyReq.url,/\/key$/);assert.equal(keyReq.options.body,chosen.key);
 assert.equal(keyReq.options.headers['Content-Type'],'application/octet-stream');
 assert.equal(ui.node('resultSummary').children[0].children[0].textContent,'—','unauthenticated manifest counts are never displayed');
 keyReq.resolve({ok:true,result:{keyReceived:true}});await turn();
 ui.uploads().at(-1).resolve({ok:true,result:uploaded});await operation;
 assert.equal(ui.node('controls').disabled,false);assert.equal(ui.node('action').value,'restore');
 assert.equal(ui.node('bundleDir').value,uploaded.bundleDir);assert.equal(ui.node('keyFile').value,uploaded.keyFile);
 assert.equal(ui.node('applyMode').disabled,true);assert.equal(ui.node('applyMode').checked,false);
 assert.deepEqual(ui.node('resultSummary').children.map(box=>box.children[0].textContent),['3','2','9','6','7']);
 assert.equal(ui.node('uploadSelection').hidden,true);assert.equal(ui.node('uploadedBundle').hidden,false);
 assert.equal(ui.node('keyPicker').value,'');assert.equal(ui.posts().length,0);
});
test('wrong-sized keys and malformed or incomplete selected directories are rejected before an upload batch is created',async()=>{
 const cases=[
  {files:uploadFiles(),key:{name:'wrong.key',size:31}},
  {files:uploadFiles().slice(1)},
  {files:uploadFiles({1:{webkitRelativePath:'test-bundle/../000001.bin'}})},
  {files:uploadFiles({2:{size:11}})},
  {files:uploadFiles({0:{text:async()=>'{broken'}})},
  {files:[...uploadFiles(),{name:'secret.key',webkitRelativePath:'test-bundle/secret.key',size:32}]},
 ];
 for(const input of cases){
  const ui=await importReady();chooseFiles(ui,input.files,input.key);const operation=ui.click('uploadButton');await turn();
  assert.equal(ui.uploads().length,0);assert.equal(ui.posts().length,0);
  ui.stateRequests().at(-1).resolve(idle());await operation;
  assert.equal(ui.node('controls').disabled,false);assert.equal(ui.node('status').dataset.kind,'error');assert.equal(ui.node('applyMode').disabled,true);
 }
});
test('failed upload verification can be cleaned and selected again without exposing key bytes',async()=>{
 const ui=await importReady();chooseFiles(ui);const {operation,finish}=await uploadUntilFinish(ui);
 finish.resolve({ok:false,error:{code:'AUTHENTICATION_FAILED',message:'Wrong key'}});await turn();
 ui.stateRequests().at(-1).resolve({ok:true,result:{busy:false,lastResponse:success('export'),uploads:[{uploadId:'upload-one',status:'failed',files:3,bytes:220,keyReceived:true}]}});
 await operation;assert.match(ui.node('status').textContent,/金鑰不符/);assert.equal(ui.node('applyMode').disabled,true);
 const row=ui.node('savedUploads').children[0],remove=row.children[1].children[0],cleaning=remove.handlers.click();
 assert.equal(ui.node('controls').disabled,true);assert.equal(ui.uploads().at(-1).options.method,'DELETE');
 ui.uploads().at(-1).resolve({ok:true,result:{uploadId:'upload-one',deleted:true}});await cleaning;
 assert.equal(ui.node('savedUploadsPanel').hidden,true);assert.equal(ui.node('controls').disabled,false);
 chooseFiles(ui);assert.equal(ui.node('uploadButton').disabled,false);assert.equal(ui.posts().length,0);
});
test('a lost finish response recovers the verified batch through GET; choosing it never resends upload or restore',async()=>{
 const ui=await importReady();chooseFiles(ui);const {operation,finish}=await uploadUntilFinish(ui);
 finish.reject(Error('connection lost'));await turn();
 ui.stateRequests().at(-1).resolve({ok:true,result:{busy:false,lastResponse:null,uploads:[{...uploaded,status:'verified',keyReceived:true}]}});
 await operation;assert.equal(ui.node('savedUploadsPanel').hidden,false);
 const count=ui.requests.length,use=ui.node('savedUploads').children[0].children[1].children[0];use.handlers.click();
 assert.equal(ui.requests.length,count);assert.equal(ui.node('action').value,'restore');assert.equal(ui.node('applyMode').checked,false);
 assert.deepEqual(ui.node('resultSummary').children.map(box=>box.children[0].textContent),['3','2','9','6','7']);
 ui.input('destinationDir','C:/synthetic/new-generation');ui.mode('apply');ui.check('targetStopped');await ui.submit();assert.equal(ui.posts().length,0);
});
test('reload shows completed restore and managed uploads without reusing prior apply permission',async()=>{
 const ui=harness('verify');
 ui.stateRequests()[0].resolve({ok:true,result:{busy:false,lastResponse:{ok:true,result:{action:'restore',dryRun:false,destinationDir:'C:/already-created',summary:verification.summary,config:{DB_FILE:'C:/already-created/db/afterhours.sqlite'}}},uploads:[{...uploaded,status:'verified',keyReceived:true}]}});
 await turn();assert.equal(ui.posts().length,0);assert.equal(ui.uploads().length,0);assert.match(ui.node('status').textContent,/尚未切換/);
 assert.equal(ui.node('configPanel').hidden,false);
 ui.node('savedUploads').children[0].children[1].children[0].handlers.click();
 assert.equal(ui.node('applyMode').checked,false);assert.equal(ui.node('applyMode').disabled,true);
 assert.equal(ui.posts().length,0);assert.equal(ui.uploads().length,0);
});
test('changing any restore input revokes rehearsal and the stopped-target confirmation',async()=>{
 for(const [id,value] of [['bundleDir','C:/another/bundle'],['keyFile','C:/another/key'],['maxBytes','123456'],['destinationDir','C:/another/destination'],['acknowledgeInterruptedMatches',true]]){
  const ui=await localRehearsed();ui.check('targetStopped');
  if(typeof value==='boolean')ui.check(id,value);else ui.input(id,value);
  assert.equal(ui.node('targetStopped').checked,false,id);assert.equal(ui.node('applyMode').disabled,true,id);
  ui.input('action','restore');ui.mode('apply');ui.check('targetStopped');await ui.submit();assert.equal(ui.posts().length,2,id);
 }
});
test('unknown apply outcome discards rehearsal and never automatically republishes',async()=>{
 const ui=await localRehearsed();ui.check('targetStopped');const operation=ui.submit();
 ui.posts()[2].reject(Error('lost apply response'));await turn();
 ui.stateRequests().at(-1).resolve(idle({ok:true,result:{action:'restore',dryRun:false,destinationDir:'C:/synthetic/new-generation'}}));await operation;
 assert.equal(ui.node('applyMode').disabled,true);await ui.submit();assert.equal(ui.posts().length,3);
 assert.match(ui.node('status').textContent,/驗證及預演/);
});
test('changing uploaded local paths deselects its verified card while keeping the managed batch available',async()=>{
 const ui=await successfullyUploaded();ui.input('keyFile','C:/different/key');
 assert.equal(ui.node('uploadedBundle').hidden,true);assert.equal(ui.node('uploadSelection').hidden,false);
 assert.equal(ui.node('savedUploadsPanel').hidden,false);assert.equal(ui.node('action').value,'verify');
 assert.ok(ui.node('resultSummary').children.every(box=>box.children[0].textContent==='—'));
});
test('cleanup is fenced against duplicate clicks and stale state while the DELETE body is pending',async()=>{
 const ui=harness('verify');
 ui.stateRequests()[0].resolve({ok:true,result:{busy:false,lastResponse:null,uploads:[{...uploaded,status:'verified'}]}});await turn();
 ui.node('savedUploads').children[0].children[1].children[0].handlers.click();
 const cleaning=ui.click('clearUpload');assert.equal(ui.node('controls').disabled,true);
 await ui.click('clearUpload');await ui.click('uploadButton');await ui.submit();assert.equal(ui.uploads().length,1);
 ui.uploads()[0].resolve({ok:true,result:{uploadId:'upload-one',deleted:true}});await cleaning;
 assert.equal(ui.node('bundleDir').value,'');assert.equal(ui.node('keyFile').value,'');assert.equal(ui.node('applyMode').disabled,true);
 assert.equal(ui.node('action').value,'verify');assert.equal(ui.posts().length,0);
});


test('both rehearsal and publication carry the authenticated bundle identity',async()=>{
 const ui=await localRehearsed();
 assert.equal(JSON.parse(ui.posts()[1].options.body).request.expectedBundleId,bundleId);
 assert.equal(JSON.parse(ui.node('requestPreview').textContent).expectedBundleId,bundleId);
 ui.check('targetStopped');const operation=ui.submit();
 assert.equal(JSON.parse(ui.posts()[2].options.body).request.expectedBundleId,bundleId);
 ui.posts()[2].resolve({ok:true,result:{action:'restore',bundleId,dryRun:false}});await operation;
});
test('a changed bundle rejection or a mismatched rehearsal response revokes the verified source',async()=>{
 for(const response of [
  {ok:false,error:{code:'BUNDLE_CHANGED',message:'Changed after verification'}},
  {ok:true,result:{action:'restore',bundleId:'8c9cf1cb-4bd0-494f-a96e-790be68c2cf6',dryRun:true}}
 ]){
  const ui=await localVerified(),operation=ui.submit();ui.posts()[1].resolve(response);await operation;
  assert.equal(ui.node('action').value,'verify');assert.equal(ui.node('applyMode').disabled,true);
  assert.match(ui.node('status').textContent,/備份身分已改變/);
  ui.input('action','restore');ui.mode('apply');ui.check('targetStopped');await ui.submit();assert.equal(ui.posts().length,2);
 }
});
test('local verification clears picker selections and identifies the actual local source',async()=>{
 const ui=await importReady();chooseFiles(ui,uploadFiles(),{name:'wrong.key',size:32});
 ui.input('keyFile','C:/local/correct.key');ui.input('bundleDir','C:/local/backup');
 const operation=ui.submit();ui.posts()[0].resolve({ok:true,result:verification});await operation;
 assert.equal(ui.node('keyPicker').value,'');assert.equal(ui.node('bundlePicker').value,'');
 assert.equal(ui.node('uploadSelection').hidden,true);assert.equal(ui.node('uploadedBundle').hidden,false);
 assert.match(ui.node('selectedBundleHeading').textContent,/管理工具主機/);
 assert.match(ui.node('uploadedDescription').textContent,/C:\/local\/backup/);
 assert.ok(ui.node('uploadedDescription').textContent.includes(bundleId));
 const requests=ui.requests.length;await ui.click('clearUpload');
 assert.equal(ui.requests.length,requests);assert.equal(ui.node('uploadSelection').hidden,false);
 assert.equal(ui.node('action').value,'verify');assert.equal(ui.node('applyMode').disabled,true);
});
test('rehearsal describes planned token revocation and publication describes completed revocation',async()=>{
 const ui=await localVerified(),preview=ui.submit();
 ui.posts()[1].resolve({ok:true,result:{action:'restore',bundleId,dryRun:true,config:{DB_FILE:'C:/new/db'},changes:{revoked:{sessions:2},heldSubmissions:1}}});await preview;
 assert.match(ui.node('nextSteps').children[0].textContent,/預計撤銷 2/);
 ui.check('targetStopped');const publication=ui.submit();
 ui.posts()[2].resolve({ok:true,result:{action:'restore',bundleId,dryRun:false,config:{DB_FILE:'C:/new/db'},changes:{revoked:{sessions:2},heldSubmissions:1}}});await publication;
 assert.match(ui.node('nextSteps').children[0].textContent,/已撤銷 2/);
});
test('lost DELETE response reconciles an absent unfinished batch and permits a new upload',async()=>{
 const ui=await importReady();chooseFiles(ui);const upload=ui.click('uploadButton');await turn();
 ui.uploads()[0].resolve({ok:true,result:{uploadId:'upload-one'}});await turn();
 ui.uploads()[1].reject(Error('upload interrupted'));await turn();
 ui.stateRequests().at(-1).resolve({ok:true,result:{busy:false,lastResponse:null,uploads:[{uploadId:'upload-one',status:'failed',files:0,bytes:0}]}});await upload;
 const cleanup=ui.node('savedUploads').children[0].children[1].children[0].handlers.click();
 ui.uploads().at(-1).reject(Error('DELETE completed but reply lost'));await turn();
 ui.stateRequests().at(-1).resolve({ok:true,result:{busy:false,lastResponse:null,uploads:[]}});await cleanup;
 assert.equal(ui.node('savedUploadsPanel').hidden,true);assert.equal(ui.node('cleanupUpload').hidden,true);
 const count=ui.uploads().length,retry=ui.click('uploadButton');await turn();
 assert.equal(ui.uploads().length,count+1);assert.equal(ui.uploads().at(-1).url,'/api/import-upload/start');
 ui.uploads().at(-1).resolve({ok:false,error:{code:'UPLOAD_LIMIT',message:'Synthetic stop'}});await turn();
 ui.stateRequests().at(-1).resolve({ok:true,result:{busy:false,lastResponse:null,uploads:[]}});await retry;
});
test('an already removed upload is treated as cleaned when DELETE returns not found',async()=>{
 const ui=await successfullyUploaded(),cleanup=ui.click('clearUpload');
 ui.uploads().at(-1).resolve({ok:false,error:{code:'UPLOAD_NOT_FOUND',message:'Already removed'}});await cleanup;
 assert.equal(ui.node('controls').disabled,false);assert.equal(ui.node('keyFile').value,'');
 assert.equal(ui.node('bundleDir').value,'');assert.equal(ui.node('uploadedBundle').hidden,true);
 assert.equal(ui.stateRequests().length,1);assert.equal(ui.node('action').value,'verify');
});
