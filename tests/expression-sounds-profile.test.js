const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/profile.js'),'utf8');
const first='user:12345678-1234-4234-8234-123456789abc',second='user:22345678-1234-4234-8234-123456789abc';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return {promise,resolve,reject};}
class Node{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.disabled=false;this.files=[];this.value='';this.attributes={};this.handlers=new Map();this.subnodes=new Map();this.dataset={};this.textContent='';const classes=new Set();this.classList={add:name=>classes.add(name),remove:name=>classes.delete(name),toggle(name,enabled){if(enabled===undefined)enabled=!classes.has(name);enabled?classes.add(name):classes.delete(name);return enabled;},contains:name=>classes.has(name)};}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=[...children];}setAttribute(name,value){this.attributes[name]=String(value);}querySelector(selector){if(!this.subnodes.has(selector))this.subnodes.set(selector,new Node(selector==='button'?'button':'div'));return this.subnodes.get(selector);}addEventListener(type,fn){this.handlers.set(type,fn);}reset(){this.value='';}
}
async function fixture({encode=async()=>({base64:'canonical-wav',durationMs:1000}),post,appearancePost}={}){
 const nodes=new Map(),requests=[],plays=[],previewClips=[],settings=[],stops=[],eventListeners=new Map();let saved=false;
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,new Node());return nodes.get(selector);};
 const characters=()=>[{id:'builtin:traveler',name:'內建',source:'內建',expressions:{neutral:'/default.png',happy:'/happy.png'}},{id:first,name:'第一位',source:'我的作品',owned:true,shared:true,expressions:{neutral:'/first.png',happy:'/first-happy.png'},sounds:saved?{happy:{url:`/assets/characters/sounds/${first.slice(5)}/happy`,durationMs:1200}}:{}},{id:second,name:'第二位',source:'我的作品',owned:true,expressions:{neutral:'/second.png',happy:'/second-happy.png'},sounds:{}},{id:'user:32345678-1234-4234-8234-123456789abc',name:'好友',source:'好友分享',owned:false,expressions:{neutral:'/friend.png',happy:'/friend-happy.png'},sounds:{happy:{url:'/assets/characters/sounds/32345678-1234-4234-8234-123456789abc/happy',durationMs:1200}}}];
 const document={body:new Node("body"),querySelector:node,createElement:tag=>new Node(tag),addEventListener(type,fn){eventListeners.set(type,fn);},hidden:false};
 const window={ExpressionSounds:{encodeFile:encode},AudioSettings:{set(...args){settings.push(args);},playExpression(...args){plays.push(args);const clip={clip:plays.length};previewClips.push(clip);return clip;},stopEffect(clip){stops.push(clip);const index=previewClips.indexOf(clip);if(index>=0)plays[index][1].onStop?.(clip);}},addEventListener(type,fn){eventListeners.set('window:'+type,fn);}};
 const context=vm.createContext({document,window,location:{search:''},URLSearchParams,FileReader:class{},fetch:async(url,options={})=>{
  requests.push({url,options});let data;
  if(url==='/api/auth/me')data={appearance:{version:5,characterId:first,expression:'happy'}};
  else if(url==='/api/profile/options')data={defaults:{version:5,characterId:'builtin:traveler',expression:'neutral'},characters:characters(),expressionLabels:{neutral:'平常',happy:'開心'}};
  else if(url==='/api/artworks')data={artworks:[]};
  else if(url==='/api/profile/appearance'){if(appearancePost)return await appearancePost(url,options);data={appearance:JSON.parse(options.body)};}
  else if(url.endsWith('/sound')||url.endsWith('/sound/remove')){if(post)return await post(url,options);saved=!url.endsWith('/remove');data=saved?{sound:{url:`/assets/characters/sounds/${first.slice(5)}/happy`,durationMs:1200}}:{ok:true};}
  else throw Error('unexpected route '+url);
  return {ok:true,json:async()=>data};
 }});vm.runInContext(source,context);await tick();
 const chooseCharacter=name=>{const button=node('#my-characters').children.concat(node('#shared-characters').children,node('#builtin-characters').children).find(button=>button.attributes['aria-label'].startsWith('選擇'+name+'，'));assert.ok(button);button.onclick();};
 const chooseExpression=label=>{const button=node('#expressions').children.find(button=>button.attributes['aria-label']==='顯示'+label+'表情');assert.ok(button);button.onclick();};
 return {node,requests,plays,previewClips,settings,stops,eventListeners,chooseCharacter,chooseExpression,context,selectFile(file={name:'聲音.wav',size:44}){node('#expression-sound-file').files=[file];node('#expression-sound-file').handlers.get('change')();},submit:()=>node('#upload-expression-sound').onsubmit({preventDefault(){}}),soundPosts:()=>requests.filter(request=>request.options.method==='POST'&&request.url.includes('/sound'))};
}
test('only owned nonneutral expression offers editing; saved shared sounds offer preview alone',async()=>{
 const f=await fixture();assert.equal(f.node('#expression-sound').hidden,false);assert.equal(f.node('#upload-expression-sound').hidden,false);assert.equal(f.node('#preview-expression-sound').hidden,true);
 f.chooseExpression('平常');assert.equal(f.node('#expression-sound').hidden,true);f.chooseCharacter('好友');f.chooseExpression('開心');assert.equal(f.node('#expression-sound').hidden,false);assert.equal(f.node('#upload-expression-sound').hidden,true);assert.equal(f.node('#remove-expression-sound').hidden,true);assert.equal(f.node('#preview-expression-sound').hidden,false);
 f.node('#preview-expression-sound').onclick();assert.equal(f.settings[0][0],'effects');assert.equal(f.settings[0][1].enabled,true);assert.equal(f.settings[0][2].gesture,true);assert.match(f.plays[0][0].url,/32345678/);assert.equal(f.soundPosts().length,0);
 f.chooseCharacter('內建');f.chooseExpression('開心');assert.equal(f.node('#expression-sound').hidden,true);
});
test('changing character during conversion prevents upload and does not apply old status or selection',async()=>{
 const conversion=deferred(),f=await fixture({encode:()=>conversion.promise});f.selectFile();const pending=f.submit();assert.equal(f.node('#save-expression-sound').disabled,true);
 f.chooseCharacter('第二位');f.chooseExpression('開心');conversion.resolve({base64:'old-wave',durationMs:1000});await pending;
 assert.equal(f.soundPosts().length,0);assert.equal(f.node('#preview').src,'/second-happy.png');assert.equal(f.node('#expression-sound-status').textContent,'');assert.equal(f.node('#save-expression-sound').disabled,false);
});
test('late successful POST refreshes gallery while preserving newly selected character and expression',async()=>{
 const sent=deferred(),f=await fixture({post:()=>sent.promise});f.selectFile();const pending=f.submit();await tick();
 assert.equal(f.soundPosts().length,1);assert.equal(f.soundPosts()[0].url,`/api/profile/characters/${first.slice(5)}/expressions/happy/sound`);assert.deepEqual(JSON.parse(f.soundPosts()[0].options.body),{base64:'canonical-wav'});
 f.chooseCharacter('第二位');f.chooseExpression('開心');sent.resolve({ok:true,json:async()=>({sound:{url:'old-target',durationMs:1000}})});await pending;
 assert.equal(f.node('#preview').src,'/second-happy.png');assert.equal(f.node('#expression-sound-status').textContent,'');assert.equal(f.node('#preview-expression-sound').hidden,true);assert.equal(f.node('#save-expression-sound').disabled,false);
});
test('conversion and POST failures unlock current editor for retry; successful save and removal refresh metadata',async()=>{
 let attempt=0;const f=await fixture({encode:async()=>{if(!attempt++)throw Error('音效不可超過 10 秒');return {base64:'canonical-wav',durationMs:1000};}});f.selectFile();await f.submit();assert.match(f.node('#expression-sound-status').textContent,/10 秒/);assert.equal(f.node('#save-expression-sound').disabled,false);assert.equal(f.soundPosts().length,0);
 await f.submit();assert.equal(f.node('#preview-expression-sound').hidden,false);assert.match(f.node('#expression-sound-duration').textContent,/1.2 秒/);assert.match(f.node('#expression-sound-status').textContent,/已保存/);assert.equal(f.node('#preview').src,'/first-happy.png');
 await f.node('#remove-expression-sound').onclick();assert.equal(f.node('#preview-expression-sound').hidden,true);assert.equal(f.soundPosts().at(-1).options.body,'{}');assert.match(f.node('#expression-sound-status').textContent,/已移除/);
 const failed=await fixture({post:async()=>({ok:false,json:async()=>({error:'暫時無法保存，請重試'})})});failed.selectFile();await failed.submit();assert.match(failed.node('#expression-sound-status').textContent,/請重試/);assert.equal(failed.node('#save-expression-sound').disabled,false);
});
test('late failed upload cannot replace status for a new expression and preview errors remain recoverable',async()=>{
 const sent=deferred(),f=await fixture({post:()=>sent.promise});f.selectFile();const pending=f.submit();await tick();f.chooseCharacter('好友');f.chooseExpression('開心');f.node('#preview-expression-sound').onclick();
 sent.resolve({ok:false,json:async()=>({error:'old target failure'})});await pending;assert.match(f.node('#expression-sound-status').textContent,/正在試聽/);
 f.plays[0][1].onError();assert.match(f.node('#expression-sound-status').textContent,/重試/);f.chooseCharacter('第二位');f.plays[0][1].onError();assert.equal(f.node('#expression-sound-status').textContent,'');
});
test('preview cleanup updates status and clears its clip; playback errors can follow the stopped status',async()=>{
 const f=await fixture();f.chooseCharacter('好友');f.chooseExpression('開心');f.node('#preview-expression-sound').onclick();assert.match(f.node('#expression-sound-status').textContent,/正在試聽/);
 f.plays[0][1].onStop(f.previewClips[0]);assert.equal(f.node('#expression-sound-status').textContent,'試聽已停止。');assert.equal(vm.runInContext('soundPreview',f.context),null);
 f.plays[0][1].onError();assert.match(f.node('#expression-sound-status').textContent,/無法播放/);
 f.node('#preview-expression-sound').onclick();assert.match(f.node('#expression-sound-status').textContent,/正在試聽/);f.eventListeners.get('visibilitychange')();assert.match(f.node('#expression-sound-status').textContent,/正在試聽/);
 vm.runInContext('document.hidden=true',f.context);f.eventListeners.get('visibilitychange')();assert.equal(f.node('#expression-sound-status').textContent,'試聽已停止。');assert.equal(vm.runInContext('soundPreview',f.context),null);
});
test('old preview cleanup and failure callbacks cannot replace a newer preview or selected expression status',async()=>{
 const f=await fixture();f.chooseCharacter('好友');f.chooseExpression('開心');f.node('#preview-expression-sound').onclick();f.node('#preview-expression-sound').onclick();
 assert.equal(vm.runInContext('soundPreview',f.context),f.previewClips[1]);assert.match(f.node('#expression-sound-status').textContent,/正在試聽/);
 f.plays[0][1].onStop(f.previewClips[0]);f.plays[0][1].onError();assert.equal(vm.runInContext('soundPreview',f.context),f.previewClips[1]);assert.match(f.node('#expression-sound-status').textContent,/正在試聽/);
 f.chooseExpression('平常');f.plays[1][1].onStop(f.previewClips[1]);f.plays[1][1].onError();assert.equal(f.node('#expression-sound-status').textContent,'');assert.equal(vm.runInContext('soundPreview',f.context),null);
});
test('late appearance save cannot revert a newer selection or cancel and lock its pending sound conversion',async()=>{
 const appearanceSaved=deferred(),conversion=deferred(),f=await fixture({appearancePost:()=>appearanceSaved.promise,encode:()=>conversion.promise});const saving=f.node('#save').onclick();
 assert.deepEqual(JSON.parse(f.requests.find(request=>request.url==='/api/profile/appearance').options.body),{version:5,characterId:first,expression:'happy'});
 f.chooseCharacter('第二位');f.chooseExpression('開心');f.selectFile();const uploading=f.submit();assert.equal(f.node('#save-expression-sound').disabled,true);
 appearanceSaved.resolve({ok:true,json:async()=>({appearance:{version:5,characterId:first,expression:'happy'}})});await saving;
 assert.equal(vm.runInContext('appearance.characterId',f.context),second);assert.equal(f.node('#preview').src,'/second-happy.png');assert.match(f.node('#message').textContent,/已保存/);assert.equal(f.node('#save-expression-sound').disabled,true);
 conversion.resolve({base64:'second-wave',durationMs:1000});await uploading;
 assert.equal(f.soundPosts().length,1);assert.equal(f.soundPosts()[0].url,`/api/profile/characters/${second.slice(5)}/expressions/happy/sound`);assert.deepEqual(JSON.parse(f.soundPosts()[0].options.body),{base64:'second-wave'});assert.equal(f.node('#save-expression-sound').disabled,false);assert.equal(f.node('#expression-sound-file').disabled,false);assert.equal(f.node('#preview').src,'/second-happy.png');assert.match(f.node('#expression-sound-status').textContent,/已保存/);
});
test('appearance save preserves newer character and expression choices while ordinary saves remain functional',async()=>{
 const saved=deferred(),f=await fixture({appearancePost:()=>saved.promise});const saving=f.node('#save').onclick();f.chooseCharacter('第二位');
 saved.resolve({ok:true,json:async()=>({appearance:{version:5,characterId:first,expression:'happy'}})});await saving;
 assert.equal(vm.runInContext('appearance.characterId',f.context),second);assert.equal(vm.runInContext('appearance.expression',f.context),'neutral');assert.equal(f.node('#preview').src,'/second.png');assert.equal(f.node('#save').disabled,false);assert.match(f.node('#message').textContent,/保留目前/);
 const ordinary=await fixture();await ordinary.node('#save').onclick();assert.equal(vm.runInContext('appearance.characterId',ordinary.context),first);assert.equal(ordinary.node('#preview').src,'/first-happy.png');assert.match(ordinary.node('#message').textContent,/遊戲座位會更新/);assert.equal(ordinary.node('#save').disabled,false);
});

test('unsaved character selections warn on unload, then successful saves clear the warning',async()=>{
 const f=await fixture();assert.equal(vm.runInContext('profileHasUnsavedChanges()',f.context),false);
 f.chooseCharacter('第二位');assert.equal(vm.runInContext('profileHasUnsavedChanges()',f.context),true);
 let blocked=false;const event={preventDefault(){blocked=true;}};f.eventListeners.get('window:beforeunload')(event);assert.equal(blocked,true);assert.equal(event.returnValue,'');
 assert.equal(await vm.runInContext('saveProfileBeforeLeaving()',f.context),true);assert.equal(vm.runInContext('profileHasUnsavedChanges()',f.context),false);
});
test('failed appearance saves retain unsaved state and selected image uploads also count as drafts',async()=>{
 const f=await fixture({appearancePost:async()=>({ok:false,json:async()=>({error:'保存失敗'})})});f.chooseCharacter('第二位');
 assert.equal(await vm.runInContext('saveProfileBeforeLeaving()',f.context),false);assert.equal(vm.runInContext('profileHasUnsavedChanges()',f.context),true);
 const fresh=await fixture();vm.runInContext("uploads.set('#character-file',{name:'draft.png'})",fresh.context);assert.equal(vm.runInContext('profileHasUnsavedChanges()',fresh.context),true);
});
