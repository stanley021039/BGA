const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/ui-celebrations.js'),'utf8');
function fixture({webgl=true}={}){
 let enabled=true,reduced=false,next=0;const timers=new Map(),listeners=new Map(),subs=new Set(),layers=[],observers=[];
 function node(){return {isConnected:true,className:'',dataset:{},children:[],setAttribute(){},appendChild(child){child.parent=this;this.children.push(child);},remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);},getBoundingClientRect:()=>({width:360,height:96})};}
 const doc={hidden:false,body:node(),createElement:node,addEventListener:(name,fn)=>listeners.set(name,fn)};
 const media={get matches(){return reduced;},addEventListener:(name,fn)=>listeners.set('media:'+name,fn)};
 const root={document:doc,GameUI:{},matchMedia:()=>media,setTimeout(fn,ms){timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>listeners.set(name,fn),MotionPolicy:{allowsMotion:()=>enabled,subscribe(fn){subs.add(fn);fn();}},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.done=true;}}};
 if(webgl)root.GameFxLayer={create(host,options){const layer={host,options,events:[],play(...args){this.events.push(args);return true;},destroy(){this.destroyed=true;}};layers.push(layer);return layer;}};
 vm.runInNewContext(source,{window:root});
 return {ui:root.GameUI,root,doc,node,timers,layers,observers,fire(){const pending=[...timers.values()];timers.clear();for(const t of pending)t.fn();},hide(){doc.hidden=true;listeners.get('visibilitychange')();},reduce(){reduced=true;listeners.get('media:change')();},disable(){enabled=false;for(const fn of subs)fn();},pagehide(){listeners.get('pagehide')();}};
}
test('finite achievement effect uses a local small budget and disposes GPU after expiry',()=>{
 const f=fixture(),card=f.node(),cancel=f.ui.celebrate(card,{id:'gift:earned'});
 assert.equal(card.children.length,1);assert.equal(f.layers.length,1);const layer=f.layers[0];
 assert.equal(layer.options.maxParticles,24);assert.equal(layer.options.maxEffects,1);assert.equal(layer.options.maxPixels,90000);
 const [id,kind,anchor,settings]=layer.events[0];assert.equal(id,'gift:earned');assert.equal(kind,'sparks');assert.equal(settings.durationMs,960);assert.equal(settings.count,24);assert.deepEqual({...anchor()},{x:40,y:48});
 assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,1100);f.fire();cancel();assert.equal(card.children.length,0);assert.equal(layer.destroyed,true);assert.equal(f.ui.getCelebrationsState().active,0);assert.equal(f.observers[0].done,true);
});
test('duplicate, invisible, and reduced events never replay when motion becomes enabled',()=>{
 const f=fixture(),card=f.node();f.ui.celebrate(card,{id:'one'});f.ui.celebrate(card,{id:'one'});assert.equal(f.layers.length,1);f.hide();assert.equal(f.timers.size,0);assert.equal(card.children.length,0);
 f.ui.celebrate(card,{id:'hidden'});f.doc.hidden=false;f.ui.celebrate(card,{id:'hidden'});assert.equal(f.layers.length,1);
 for(const kind of ['reduce','disable']){const g=fixture();g[kind]();g.ui.celebrate(g.node(),{id:'blocked'});assert.equal(g.layers.length,0);assert.equal(g.timers.size,0);}
});
test('more notifications evict the oldest effect and keep dedupe and handles bounded',()=>{
 const f=fixture();for(let n=0;n<270;n++)f.ui.celebrate(f.node(),{id:'event:'+n});assert.equal(f.ui.getCelebrationsState().active,3);assert.equal(f.ui.getCelebrationsState().seen,256);assert.equal(f.timers.size,3);assert.equal(f.layers.filter(l=>!l.destroyed).length,3);f.pagehide();assert.equal(f.timers.size,0);assert.equal(f.ui.getCelebrationsState().active,0);
});
test('fallback is finite without WebGL and a detached card immediately releases its effect',()=>{
 const f=fixture({webgl:false}),card=f.node();f.ui.celebrate(card,{id:'fallback'});assert.equal(card.children[0].children[0].className,'ui-celebration-ring');card.isConnected=false;f.observers[0].fn();assert.equal(card.children.length,0);assert.equal(f.timers.size,0);
 const g=fixture(),target=g.node();const cancel=g.ui.celebrate(target,{id:'manual'});g.layers[0].options.onActivity({active:true});assert.equal(target.children[0].dataset.rendered,'true');cancel();cancel();assert.equal(g.layers[0].destroyed,true);assert.equal(g.ui.getCelebrationsState().active,0);
});
test('invalid IDs and disconnected nodes never create decorative DOM or timers',()=>{
 const f=fixture(),card=f.node();card.isConnected=false;f.ui.celebrate(card,{id:'gone'});card.isConnected=true;for(const id of [null,42,'','a'.repeat(161)])f.ui.celebrate(card,{id});assert.equal(card.children.length,0);assert.equal(f.timers.size,0);
});
