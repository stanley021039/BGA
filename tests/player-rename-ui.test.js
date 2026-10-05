const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(accept=>resolve=accept);return {promise,resolve};}
function harness(){
 const nodes=new Map(),network=[],events=[],pending=[];
 for(const id of ['settings-form','avatar-source','character-expression','avatar-upload','settings-save','nickname-form','nickname','nickname-save','nickname-account','nickname-message'])nodes.set('#'+id,{value:'',textContent:'',disabled:false,focus(){this.focused=true;}});
 nodes.get('#settings-form').querySelectorAll=()=>['avatar-source','character-expression','avatar-upload','settings-save'].map(id=>nodes.get('#'+id));
 nodes.get('#nickname-form').querySelectorAll=()=>['nickname','nickname-save'].map(id=>nodes.get('#'+id));
 const json=(body,ok=true)=>({ok,json:async()=>body});
 const context={document:{querySelector:selector=>nodes.get(selector)},window:{dispatchEvent:event=>events.push(event)},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},fetch:async(url,options={})=>{
  network.push({url,options});if(url==='/api/auth/me')return json({displayName:'舊暱稱',username:'stable_login'});
  if(url==='/api/profile/name'){const item=deferred();pending.push(item);return item.promise;}
  return new Promise(()=>{});
 }};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/settings.js'),'utf8'),context);
 return {node:id=>nodes.get('#'+id),network,events,pending,json,submit:()=>nodes.get('#nickname-form').onsubmit({preventDefault(){}})};
}

test('nickname form counts Unicode, prevents duplicate saves, and remains separate from pending avatar settings',async()=>{
 const ui=harness();await flush();assert.equal(ui.node('nickname').value,'舊暱稱');assert.equal(ui.node('nickname-account').textContent,'stable_login');assert.equal(ui.node('nickname').disabled,false);
 assert.equal(ui.node('avatar-source').disabled,true);
 for(const value of ['','  ','字'.repeat(17),'名字\n換行']){ui.node('nickname').value=value;await ui.submit();assert.equal(ui.network.filter(item=>item.url==='/api/profile/name').length,0);assert.match(ui.node('nickname-message').textContent,/1–16/);}
 const displayName='😀'.repeat(16);ui.node('nickname').value=' '+displayName+' ';const saving=ui.submit();await flush();
 assert.equal(ui.node('nickname').disabled,true);assert.equal(ui.node('nickname-save').disabled,true);await ui.submit();
 const posts=ui.network.filter(item=>item.url==='/api/profile/name');assert.equal(posts.length,1);assert.deepEqual(JSON.parse(posts[0].options.body),{displayName});
 ui.pending[0].resolve(ui.json({displayName,username:'stable_login'}));await saving;
 assert.equal(ui.node('nickname').value,displayName);assert.equal(ui.node('nickname-save').disabled,false);assert.equal(ui.node('avatar-source').disabled,true);
 assert.equal(ui.events.length,1);assert.equal(ui.events[0].type,'profile-updated');assert.equal(ui.events[0].detail.displayName,displayName);
});

test('failed nickname saves leave the draft editable and render server messages as plain text',async()=>{
 const ui=harness();await flush();ui.node('nickname').value='<svg/onload=x>';const first=ui.submit();await flush();
 const message='<b>儲存失敗</b>';ui.pending[0].resolve(ui.json({error:message},false));await first;
 assert.equal(ui.node('nickname').value,'<svg/onload=x>');assert.equal(ui.node('nickname-message').textContent,message);assert.equal(ui.node('nickname-save').disabled,false);assert.equal(ui.events.length,0);
 const retry=ui.submit();await flush();ui.pending[1].resolve(ui.json({displayName:'<svg/onload=x>'}));await retry;
 assert.equal(ui.events[0].detail.displayName,'<svg/onload=x>');assert.equal(ui.node('nickname').value,'<svg/onload=x>');
});
