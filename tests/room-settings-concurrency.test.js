const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(kind){
 const listeners={},pending=[],errors=[];let value=10,valid=true,id=0;const timers=new Map();
 const window={addEventListener(){}},document={querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn,querySelector:()=>({set textContent(text){errors.push(text);}})};
 const ctx=vm.createContext({window,document,location:{pathname:'/telephone'},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 const file=kind==='shell'?'game-shell.js':'room-waiting.js',source=fs.readFileSync(path.join(__dirname,'../public/shared',file),'utf8');
 vm.runInContext(kind==='shell'?source.slice(source.indexOf(' function autoSaveSettings('),source.indexOf(' function settingsActions(')):source,ctx);
 const factory=kind==='shell'?ctx.autoSaveSettings:window.RoomWaiting.bindSettings;
 const api=factory({container:'#controls',read:()=>({value}),save:data=>{const wait=deferred();pending.push({value:data.value,...wait});return wait.promise;},canSave:()=>true,isBusy:()=>false,onError:text=>errors.push(text)});
 return {api,pending,errors,change(next,isValid=true){value=next;valid=isValid;listeners.change({target:{tagName:'SELECT',closest:()=>true,checkValidity:()=>valid}});}};
}
for(const kind of ['shell','waiting']){
 test(kind+' start flush waits for the latest queued setting after an earlier save fails',async()=>{
  const f=fixture(kind);f.change(10);const first=f.api.flush();await tick();f.change(30);let finished=false;const start=f.api.flush().then(()=>finished=true);
  f.pending[0].reject(Error('first save failed'));await tick();assert.equal(finished,false);assert.deepEqual(f.pending.map(p=>p.value),[10,30]);
  f.pending[1].resolve();await Promise.all([first,start]);assert.equal(finished,true);assert.equal(f.api.error(),'');assert.deepEqual(f.errors,[]);
 });
 test(kind+' an earlier successful response cannot erase a newer invalid setting',async()=>{
  const f=fixture(kind);f.change(10);const first=f.api.flush();await tick();f.change(999,false);const error=f.api.error();assert.ok(error);f.pending[0].resolve();await first;
  assert.equal(f.api.error(),error);await f.api.flush();assert.equal(f.pending.length,1);
  f.change(30);const retry=f.api.flush();await tick();f.pending[1].resolve();await retry;assert.equal(f.api.error(),'');
 });
 test(kind+' the latest failed save blocks start until a valid retry succeeds',async()=>{
  const f=fixture(kind);f.change(10);const saving=f.api.flush();await tick();f.pending[0].reject(Error('save denied'));await saving;assert.equal(f.api.error(),'save denied');await f.api.flush();assert.equal(f.api.error(),'save denied');
  f.change(30);const retry=f.api.flush();await tick();f.pending[1].resolve();await retry;assert.equal(f.api.error(),'');assert.equal(f.pending.length,2);
 });
}
