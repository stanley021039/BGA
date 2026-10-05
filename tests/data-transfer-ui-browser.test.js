const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../tools/data-transfer-ui/app.js'),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const success=action=>({ok:true,result:{action}});
const idle=lastResponse=>({ok:true,result:{busy:false,action:null,lastResponse:lastResponse||null}});
const running=()=>({ok:true,result:{busy:true,action:'export',lastResponse:null}});
function harness(){
 const nodes=new Map(),requests=[],timers=new Map(),copied=[];let timerId=0;
 const groups={keyFile:'keyFields',dbFile:'sourceFields',historyDir:'sourceFields',communityDir:'sourceFields',musicDir:'sourceFields',envId:'sourceFields',sourceStopped:'sourceFields',outputDir:'outputFields',bundleDir:'bundleFields',destinationDir:'restoreFields',targetStopped:'restoreFields'};
 function node(id){
  if(!nodes.has(id))nodes.set(id,{id,value:id==='action'?'keygen':id==='envId'?'production':'',name:id,checked:false,disabled:false,hidden:false,textContent:'',dataset:{},handlers:{},children:[],
   querySelectorAll(){return Object.keys(groups).filter(field=>groups[field]===id).map(node);},closest(){return node(groups[id]||'advanced');},addEventListener(type,fn){this.handlers[type]=fn;},
   reportValidity(){return [...nodes.values()].every(field=>field.disabled||!field.required||(['sourceStopped','targetStopped'].includes(field.id)?field.checked:Boolean(field.value)));},
   replaceChildren(){this.children=[];},append(...items){this.children.push(...items);},
  });return nodes.get(id);
 }
 let mode={value:'dry',name:'restoreMode'};
 const document={getElementById:node,querySelector:selector=>selector.includes('transfer-token')?{content:'a'.repeat(64)}:mode,createElement:tag=>({tag,textContent:'',children:[],append(...items){this.children.push(...items);}})};
 const context=vm.createContext({document,window:{},navigator:{clipboard:{async writeText(text){copied.push(text);}}},
  setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},
  fetch(url,options={}){return new Promise((resolve,reject)=>requests.push({url,options,resolve:body=>resolve({json:async()=>body}),resolveResponse:resolve,reject}));},
 });
 vm.runInContext(script,context,{filename:'tools/data-transfer-ui/app.js'});
 return {node,requests,timers,copied,
  stateRequests:()=>requests.filter(req=>req.url==='/api/state'),posts:()=>requests.filter(req=>req.url==='/api/run'),
  input(id,value){node(id).value=value;node('transferForm').handlers.input({target:node(id)});},
  check(id,value=true){node(id).checked=value;node('transferForm').handlers.input({target:node(id)});},
  mode(value){mode={value,name:'restoreMode'};node('transferForm').handlers.input({target:mode});node('transferForm').handlers.change({target:mode});},
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
 assert.equal(ui.node('controls').disabled,false);assert.match(ui.node('status').textContent,/INVALID_KEY/);assert.equal(ui.stateRequests().length,1);
});

test('a malformed operation response stays locked while fresh state is being recovered',async()=>{
 const ui=await ready(),submitted=ui.submit();ui.posts()[0].resolve({ok:false,error:null});await turn();
 assert.equal(ui.node('controls').disabled,true);await ui.submit();assert.equal(ui.posts().length,1);
 ui.stateRequests()[1].resolve(idle());await submitted;
 assert.equal(ui.node('controls').disabled,false);assert.match(ui.node('status').textContent,/沒有執行中的工作/);
});

test('copied preview matches the submitted restore request and apply still requires stopped-target acknowledgement',async()=>{
 const ui=await ready();ui.input('action','restore');ui.input('bundleDir','C:/synthetic/bundle');ui.input('destinationDir','C:/synthetic/new-generation');
 assert.equal(JSON.parse(ui.node('requestPreview').textContent).apply,false);
 ui.mode('apply');await ui.submit();assert.equal(ui.posts().length,0);assert.equal(ui.node('targetStopped').required,true);
 ui.check('targetStopped');await ui.node('copyRequest').handlers.click();const preview=JSON.parse(ui.copied[0]);
 const submitted=ui.submit(),posted=JSON.parse(ui.posts()[0].options.body);
 assert.deepEqual(posted.request,preview);assert.equal(posted.request.apply,true);assert.equal(posted.confirmations.targetStopped,true);
 ui.posts()[0].resolve({ok:true,result:{action:'restore',dryRun:false}});await submitted;
 ui.input('destinationDir','C:/synthetic/another-generation');assert.equal(ui.node('targetStopped').checked,false);
});
