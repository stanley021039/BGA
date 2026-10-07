const {test}=require('node:test');
const assert=require('node:assert/strict');
const {placement}=require('../public/shared/popovers');
const view={width:1280,height:720};
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/popovers.js'),'utf8');
function runtime(){
 const frames=new Map(),observers=[],listeners=new Map(),docListeners=new Map();let frameId=0,reads=0;
 class Node{
  constructor(rect={},content=0){this.nodeType=1;this.rect={left:0,top:0,width:300,height:500,...rect};this.content=content;this.attrs=new Map();this.style={};this.dataset={};this.hidden=true;this.isConnected=true;this.children=[];this.scroll=0;this.focused=false;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}removeAttribute(name){this.attrs.delete(name);if(name==='style')this.style={};}
  matches(selector){return selector===':popover-open'&&!!this.popoverOpen;}showPopover(){this.popoverOpen=true;}hidePopover(){this.popoverOpen=false;}focus(){this.focused=true;}
  layout(){const height=Math.min(this.content||this.rect.height,parseFloat(this.style.maxHeight)||this.rect.height);this.scroll=Math.min(this.scroll,Math.max(0,this.content-height));return height;}
  get scrollHeight(){return this.content||this.rect.height;}get clientHeight(){return this.layout();}get scrollTop(){return this.scroll;}set scrollTop(value){this.scroll=Math.max(0,Math.min(value,this.content-this.layout()));}
  getBoundingClientRect(){reads++;const height=this.layout(),left=parseFloat(this.style.left)||this.rect.left,top=parseFloat(this.style.top)||this.rect.top;return {left,top,width:this.rect.width,height,right:left+this.rect.width,bottom:top+height};}
 }
 const document={body:new Node(),querySelector:()=>null,addEventListener(name,fn){const list=docListeners.get(name)||[];list.push(fn);docListeners.set(name,list);}},window={document,addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);}};
 class Observer{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(node){this.targets.push(node);}disconnect(){this.targets=[];}}
 const trigger=new Node({left:800,top:400,width:44,height:44}),panel=new Node({},900),child=new Node({},400);panel.children.push(child);
 const context={window,document,innerWidth:1200,innerHeight:800,MutationObserver:Observer,ResizeObserver:Observer,requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};vm.runInNewContext(source,context);
 const api=window.UIPopover.bind(trigger,panel,{onClose(){panel.hidden=true;}});
 const dispatch=(name,target,extra={})=>{for(const fn of listeners.get(name)||[])fn({target,...extra});};
 const documentEvent=(name,target,extra={})=>{for(const fn of docListeners.get(name)||[])fn({target,...extra});};
 function flush(){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();}
 return {window,document,context,trigger,panel,child,api,frames,observers,dispatch,documentEvent,flush,makeNode:(...args)=>new Node(...args),open(){panel.hidden=false;api.sync();},reads:()=>reads};
}
test('a menu with space below stays next to its trigger',()=>{
 const result=placement({left:980,right:1240,top:300,bottom:344},{width:300,height:220},view,{align:'end'});
 assert.equal(result.side,'bottom');assert.equal(result.top,352);assert.equal(result.left,940);assert.equal(result.maxHeight,220);
});
test('a menu near the bottom flips above and limits a long list',()=>{
 const result=placement({left:980,right:1240,top:610,bottom:654},{width:300,height:900},view);
 assert.equal(result.side,'top');assert.equal(result.top,8);assert.equal(result.maxHeight,594);
});
test('a wide menu shifts inside a narrow viewport without losing its contents',()=>{
 const result=placement({left:300,right:380,top:220,bottom:264},{width:600,height:200},{width:390,height:600});
 assert.equal(result.left,8);assert.equal(result.width,374);assert.equal(result.top,272);
});
test('visual viewport offsets and explicit top placement are respected',()=>{
 const result=placement({left:500,right:570,top:460,bottom:504},{width:190,height:160},{left:400,top:300,width:390,height:400},{placement:'top'});
 assert.equal(result.side,'bottom');assert.ok(result.left>=408);assert.ok(result.top>=308);assert.ok(result.top+result.maxHeight<=692);
});

test('scrollbar and nested panel scrolling keep their scrollTop without scheduling repositioning',()=>{
 const f=runtime();f.open();f.panel.scrollTop=400;const reads=f.reads(),height=f.panel.style.maxHeight;
 for(const target of [f.panel,f.child]){f.dispatch('scroll',target);f.flush();assert.equal(f.panel.scrollTop,400,'reposition must not temporarily expand the panel and clamp its scroll range');}
 assert.equal(f.reads(),reads);assert.equal(f.panel.style.maxHeight,height);assert.equal(f.frames.size,0);
});
test('page scroll still follows its anchor without relaxing the established scroll constraint',()=>{
 const f=runtime();f.open();f.panel.scrollTop=400;const height=f.panel.style.maxHeight;f.trigger.rect.left-=60;
 f.dispatch('scroll',f.document);assert.equal(f.frames.size,1);f.flush();assert.equal(f.panel.style.left,'740px');assert.equal(f.panel.scrollTop,400);assert.equal(f.panel.style.maxHeight,height);
 const resize=f.observers.find(observer=>observer.targets.includes(f.trigger));resize.callback();f.flush();assert.equal(f.panel.scrollTop,400);assert.equal(f.frames.size,0);
});
test('a pointer drag originating in a menu does not turn its release outside into an outside click',()=>{
 const f=runtime();f.open();f.documentEvent('pointerdown',f.panel,{pointerId:4});f.documentEvent('click',f.document.body,{detail:1});assert.equal(f.panel.hidden,false);
 f.documentEvent('pointerdown',f.document.body,{pointerId:5});f.documentEvent('click',f.document.body,{detail:1});assert.equal(f.panel.hidden,true);assert.equal(f.panel.popoverOpen,false);
 f.open();f.documentEvent('pointerdown',f.child,{pointerId:6});f.documentEvent('pointercancel',f.child,{pointerId:6});f.documentEvent('click',f.document.body,{detail:1});assert.equal(f.panel.hidden,true);
});
test('hidden, detached anchors and destroyed menus clear frames and restore original panel state',()=>{
 const f=runtime();f.open();f.dispatch('scroll',f.document);assert.equal(f.frames.size,1);f.api.close();assert.equal(f.frames.size,0);f.flush();assert.equal(f.panel.attrs.has('popover'),false);assert.equal(f.panel.attrs.has('data-popover-side'),false);
 f.open();f.trigger.isConnected=false;f.api.position();f.flush();assert.equal(f.panel.hidden,true);f.trigger.isConnected=true;f.open();f.api.position();f.api.destroy();assert.equal(f.frames.size,0);assert.equal(f.panel.popoverOpen,false);
});
test('details and inline responsive menus restore styles while viewport changes remain clamped',()=>{
 const f=runtime(),panel=f.makeNode({},900),details={open:false,querySelector:()=>f.trigger,addEventListener(_name,fn){this.toggle=fn;}};panel.setAttribute('style','color:red');panel.setAttribute('popover','auto');
 const menu=f.window.UIPopover.bindDetails(details,panel,{inlineBelow:600,width:'trigger'});details.open=true;details.toggle();assert.equal(panel.popoverOpen,true);assert.equal(panel.style.width,'44px');panel.scrollTop=400;
 f.context.innerWidth=500;f.dispatch('resize',f.window);assert.equal(panel.popoverOpen,false);assert.equal(panel.getAttribute('style'),'color:red');assert.equal(panel.getAttribute('popover'),'auto');
 f.context.innerWidth=1200;f.dispatch('resize',f.window);assert.equal(panel.popoverOpen,true);f.window.visualViewport={width:390,height:600,offsetLeft:600,offsetTop:200};f.dispatch('resize',f.window);assert.ok(parseFloat(panel.style.left)>=608);assert.ok(parseFloat(panel.style.top)>=208);assert.ok(parseFloat(panel.style.top)+parseFloat(panel.style.maxHeight)<=792);
 menu.close(true);assert.equal(details.open,false);assert.equal(f.trigger.focused,true);assert.equal(panel.getAttribute('popover'),'auto');
});
test('spotlight overlays also ignore their internal scrolling while following their stage on page scroll',()=>{
 const f=runtime(),overlay=f.makeNode({},900),stage=f.makeNode({width:1200,height:800});overlay.hidden=false;const api=f.window.UIPopover.bindOverlay(overlay,stage),reads=f.reads(),left=overlay.style.left;
 f.dispatch('scroll',overlay);f.flush();assert.equal(f.reads(),reads);assert.equal(f.frames.size,0);
 stage.rect.left=80;f.dispatch('scroll',f.document);f.flush();assert.notEqual(overlay.style.left,left);assert.ok(f.reads()>reads);overlay.hidden=true;api.sync();assert.equal(overlay.popoverOpen,false);
});
