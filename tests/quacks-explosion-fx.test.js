
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({motion=true}={}){
 const timers=new Map(),handlers=new Set();let nextTimer=0,listener;
 class El{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.hidden=true;this.className='';this._text='';}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=[...items];}setAttribute(k,v){this.attrs[k]=v;}set textContent(value){this._text=value;}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}}
 const document={hidden:false,createElement:tag=>new El(tag),addEventListener:(_,fn)=>handlers.add(fn),removeEventListener:(_,fn)=>handlers.delete(fn)};
 const window={document,GameUI:{decorateButton(){}},MotionPolicy:{allowsMotion:()=>motion&&!document.hidden,subscribe(fn){listener=fn;fn();return ()=>{listener=null;};}}};
 vm.runInNewContext(fs.readFileSync('public/quacks-fx.js','utf8'),{window,setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)});
 const host=new El('div'),fx=window.QuacksFx.createExplosion(host),state=(recipes,roundId='r1')=>({code:'ABCDEF',roundId,recipes});
 return {fx,host,state,timers,hide(){document.hidden=true;for(const fn of handlers)fn();},show(){document.hidden=false;},stopMotion(){motion=false;listener?.();},tick(){for(const [id,fn]of [...timers])if(timers.delete(id))fn();},handlers};
}
test('all viewers see one cut-in for an unseen explosion even while viewing their own other pot',()=>{
 const viewers=[fixture(),fixture()];for(const f of viewers){f.fx.update(f.state([{id:'A',name:'甲'},{id:'B',name:'乙'}]),false);const snapshot=f.state([{id:'A',name:'甲',explosionId:'boom1'},{id:'B',name:'乙'}]);f.fx.update(snapshot,true);assert.equal(f.host.hidden,false);assert.match(f.host.textContent,/甲.*爆鍋/);assert.equal(f.fx.size(),1);const scene=f.host.children[0];f.fx.update(snapshot,true);assert.equal(f.host.children[0],scene);f.tick();assert.equal(f.host.hidden,true);f.fx.update(snapshot,true);assert.equal(f.host.hidden,true);}
});
test('simultaneous and closely following explosions show their names and never duplicate an ID',()=>{
 const f=fixture();f.fx.update(f.state([]),false);f.fx.update(f.state([{name:'甲',explosionId:'a'},{name:'乙',explosionId:'b'}]),true);assert.match(f.host.textContent,/甲、乙/);assert.equal(f.timers.size,1);f.fx.update(f.state([{name:'甲',explosionId:'a'},{name:'乙',explosionId:'b'},{name:'丙',explosionId:'c'}]),true);assert.match(f.host.textContent,/甲、乙、丙/);assert.equal(f.fx.size(),3);assert.equal(f.timers.size,1);f.host.children[0].children.at(-1).onclick();assert.equal(f.host.hidden,true);assert.equal(f.timers.size,0);
});
test('initial load, reconnect, backgrounding and a round baseline do not catch up old explosions',()=>{
 const f=fixture(),old=f.state([{name:'甲',explosionId:'old'}]);f.fx.update(old,false);f.fx.update(old,true);assert.equal(f.host.hidden,true);f.fx.update(f.state([{name:'乙',explosionId:'late'}]),false);f.fx.update(f.state([{name:'乙',explosionId:'late'}]),true);assert.equal(f.host.hidden,true);f.fx.update(f.state([{name:'丙',explosionId:'live'}]),true);assert.equal(f.host.hidden,false);f.hide();assert.equal(f.host.hidden,true);f.fx.update(f.state([{name:'丁',explosionId:'hidden'}]),true);f.show();f.fx.update(f.state([{name:'丁',explosionId:'hidden'}]),true);assert.equal(f.host.hidden,true);f.fx.update(f.state([{name:'甲',explosionId:'next-round'}],'r2'),true);assert.equal(f.host.hidden,true);f.fx.destroy();assert.equal(f.handlers.size,0);assert.equal(f.timers.size,0);
});
test('reduced motion keeps the public information as a static cut-in and expiry still clears it',()=>{
 const f=fixture({motion:false});f.fx.update(f.state([]),false);f.fx.update(f.state([{name:'甲',explosionId:'a'}]),true);assert.equal(f.host.hidden,false);assert.equal(f.host.children[0].dataset.motion,'still');f.tick();assert.equal(f.host.hidden,true);
 const g=fixture();g.fx.update(g.state([]),false);g.fx.update(g.state([{name:'乙',explosionId:'b'}]),true);g.stopMotion();assert.equal(g.host.hidden,false);assert.equal(g.host.children[0].dataset.motion,'still');g.fx.destroy();
});
