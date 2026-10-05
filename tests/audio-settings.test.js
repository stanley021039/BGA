const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=file=>fs.readFileSync(path.join(__dirname,'../public/shared',file),'utf8');
function harness(saved={},blocked=false,storageBlocked=false){
 const storage=new Map(Object.entries(saved)),listeners=new Map(),clips=[],nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',dataset:{},textContent:'',innerHTML:'',attributes:{},classList:{toggle(){}},querySelector:node,append(){},replaceChildren(){},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}});return nodes.get(id);};
 const document={hidden:false,createElement:()=>node('panel'),body:{append(){}},querySelector:()=>null,addEventListener(type,fn){const key='document:'+type;listeners.set(key,[...(listeners.get(key)||[]),fn]);}};
 const window={addEventListener(type,fn){listeners.set('window:'+type,[...(listeners.get('window:'+type)||[]),fn]);}};
 class Audio {constructor(src){this.src=src;this.volume=1;this.paused=true;this.currentTime=0;this.readyState=1;this.plays=0;this.pauses=0;clips.push(this);}play(){this.plays++;if(blocked)return Promise.reject(Error('autoplay'));this.paused=false;return Promise.resolve();}pause(){this.pauses++;this.paused=true;}load(){}removeAttribute(key){delete this[key];}}
 const context={window,document,Audio,localStorage:{getItem(k){if(storageBlocked)throw Error('storage blocked');return storage.get(k)??null;},setItem(k,v){if(storageBlocked)throw Error('storage blocked');storage.set(k,String(v));}},Date,setInterval(){},MutationObserver:class{observe(){}},Option:class{},fetch:async url=>({ok:true,json:async()=>url.includes('room-music')?{version:1,serverNow:Date.now(),playing:true,position:0,loop:false,track:{id:'sample',title:'測試',duration:60}}:{tracks:[]}})};
 vm.runInNewContext(source('audio-settings.js'),context);
 return {api:window.AudioSettings,storage,clips,nodes,document,window,loadMusic(){vm.runInNewContext(source('table-music.js'),context);window.TableMusic.update({code:'ABC123',host:false});},fire(key,event={}){for(const fn of listeners.get(key)||[])fn(event);}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('preferences keep independent music/effect levels across navigation; one migration for old levels',()=>{
 const first=harness({'ah-music-listen':'on','ah-music-volume':'0.61','ah-gift-volume':'0.42'});
 assert.equal(first.api.get().music.enabled,true);assert.equal(first.api.get().music.volume,.61);assert.equal(first.api.get().effects.volume,.42);
 first.api.set('effects',{enabled:true,volume:.18});first.api.set('music',{volume:.77});
 const next=harness(Object.fromEntries(first.storage));assert.equal(next.api.get().music.volume,.77);assert.equal(next.api.get().effects.volume,.18);assert.equal(next.api.get().effects.enabled,true);
 next.api.get().effects.volume=1;assert.equal(next.api.get().effects.volume,.18);
});
test('invalid settings never create an invalid audio volume; unavailable storage still works',()=>{
 for(const raw of ['broken','{"music":{"volume":-4},"effects":{"volume":"1","enabled":"on"}}']){const ui=harness({'ah-audio-settings':raw});assert.equal(ui.api.get().music.volume,.3);assert.equal(ui.api.get().effects.volume,.25);assert.equal(ui.api.get().effects.enabled,false);}
 const ui=harness();for(const volume of [NaN,Infinity,-1,2,'0.3'])ui.api.set('effects',{volume});assert.equal(ui.api.get().effects.volume,.25);
 const denied=harness({},false,true);denied.api.set('effects',{enabled:true,volume:.8});assert.equal(denied.api.playEffect('confirm').volume,.8);
});
test('all effect clips use the common volume, update live, and stop immediately when muted or at zero',()=>{
 const ui=harness();assert.equal(ui.api.playEffect('confirm'),undefined);ui.api.set('effects',{enabled:true,volume:.2});
 const a=ui.api.playEffect('confirm'),b=ui.api.playEffect('reveal');assert.equal(a.volume,.2);assert.equal(b.volume,.2);
 ui.api.set('effects',{volume:.8});assert.equal(a.volume,.8);assert.equal(b.volume,.8);
 ui.api.set('effects',{enabled:false});assert.equal(a.paused,true);assert.equal(b.paused,true);assert.equal(a.currentTime,0);
 ui.api.set('effects',{enabled:true});assert.equal(a.plays,1);const c=ui.api.playEffect('confirm');ui.api.set('effects',{volume:0});assert.equal(c.paused,true);assert.equal(ui.api.playEffect('confirm'),undefined);
});
test('hidden pages never play new effects and navigation clears in-flight effects',()=>{
 const ui=harness();ui.api.set('effects',{enabled:true});const clip=ui.api.playEffect('confirm');ui.document.hidden=true;ui.fire('document:visibilitychange');assert.equal(clip.paused,true);assert.equal(ui.api.playEffect('reveal'),undefined);
 ui.document.hidden=false;const next=ui.api.playEffect('confirm');ui.fire('window:pagehide');assert.equal(next.paused,true);
});
test('storage changes propagate across open games without inventing a playback gesture',()=>{
 const ui=harness();const events=[];const unsubscribe=ui.api.subscribe((settings,meta)=>events.push({settings,meta}));ui.storage.set('ah-audio-settings',JSON.stringify({music:{enabled:true,volume:.4},effects:{enabled:true,volume:.6}}));ui.fire('window:storage',{key:'ah-audio-settings'});assert.equal(events.at(-1).settings.effects.volume,.6);assert.equal(events.at(-1).meta.gesture,false);unsubscribe();const count=events.length;ui.api.set('music',{volume:.7});assert.equal(events.length,count);
});
test('music library previews share preferences and release their listeners when removed',()=>{
 const ui=harness(),handlers=new Map(),audio={volume:1,muted:false,addEventListener(type,fn){handlers.set(type,fn);},removeEventListener(type){handlers.delete(type);}};
 const unbind=ui.api.bindPreview(audio);assert.equal(audio.volume,.3);assert.equal(audio.muted,true);
 handlers.get('play')();assert.equal(audio.muted,false);ui.api.set('music',{volume:.7});assert.equal(audio.volume,.7);
 audio.volume=.4;handlers.get('volumechange')();assert.equal(ui.api.get().music.volume,.4);audio.muted=true;handlers.get('volumechange')();assert.equal(ui.api.get().music.enabled,false);
 unbind();ui.api.set('music',{volume:.8});assert.equal(audio.volume,.4);assert.equal(handlers.size,0);
});
test('music waits for a real gesture, uses shared volume, and personal mute never changes room transport',async()=>{
 const ui=harness({'ah-music-listen':'on','ah-music-volume':'.2'});ui.loadMusic();await tick();const audio=ui.clips[0];assert.equal(audio.volume,.2);assert.equal(audio.plays,0);
 ui.fire('document:pointerdown',{isTrusted:false});assert.equal(audio.plays,0);ui.fire('document:pointerdown',{isTrusted:true});await tick();assert.equal(audio.paused,false);
 ui.api.set('music',{volume:.65});assert.equal(audio.volume,.65);ui.api.set('effects',{volume:.1});assert.equal(audio.volume,.65);
 ui.api.set('music',{enabled:false});assert.equal(audio.paused,true);assert.equal(ui.nodes.get('#music-global').attributes['aria-label'],'暫停');
 ui.api.set('music',{enabled:true},{gesture:true});await tick();assert.equal(audio.paused,false);ui.window.TableMusic.stop();assert.equal(audio.paused,true);assert.equal(audio.src,undefined);
});
test('blocked music and sound report a recoverable error without unhandled promises',async()=>{
 const ui=harness({},true);ui.loadMusic();await tick();ui.api.set('music',{enabled:true},{gesture:true});await tick();assert.match(ui.nodes.get('#music-error').textContent,/右上角設定/);
 let errors=0;ui.api.set('effects',{enabled:true});ui.api.playEffect('confirm',{onError:()=>errors++});await tick();assert.equal(errors,1);assert.equal(ui.clips.at(-1).plays,1);
});
test('the HTTP server serves the shared controller as executable JavaScript',async()=>{
 const os=require('node:os'),{createApp}=require('../src/app');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bga-audio-http-'));
 const app=createApp({port:0,host:'127.0.0.1',historyDir:path.join(dir,'history'),communityDir:path.join(dir,'community'),dbFile:path.join(dir,'app.sqlite')});
 try{const {port}=await app.listen();const response=await fetch(`http://127.0.0.1:${port}/shared/audio-settings.js`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);const served=await response.text();const ui=harness();vm.runInNewContext(served,{window:ui.window,document:ui.document,localStorage:{getItem:()=>null,setItem(){}},Audio:class{}});assert.equal(ui.window.AudioSettings.get().music.volume,.3);}
 finally{await app.close();fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});}
});
