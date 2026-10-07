const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const uiSource=fs.readFileSync(path.join(__dirname,'../public/shared/ui-components.js'),'utf8'),motionSource=fs.readFileSync(path.join(__dirname,'../public/shared/motion-policy.js'),'utf8');
function harness({reduced=false,enabled=true}={}){
 const frames=new Map(),observers=[],resizers=[],mutations=[];let nextFrame=0,document;
 function events(target){const listeners=new Map();return Object.assign(target,{addEventListener(type,fn){const entries=listeners.get(type)||new Set();entries.add(fn);listeners.set(type,entries);},dispatch(type,event={}){for(const fn of [...listeners.get(type)||[]])fn(event);}});}
 class Element{
  constructor(tag='span'){this.nodeType=1;this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attributes=new Map();this.dataset={};this._text='';this.width=100;this.textWidth=100;this.reads=0;this.rect={left:520,top:360,width:100,height:40,right:620,bottom:400};
   this.style={values:new Map(),getPropertyValue:key=>this.style.values.get(key)||'',setProperty:(key,value)=>{this.style.values.set(key,value);mutations.push({type:'attributes',target:this,attributeName:'style'});},removeProperty:key=>{this.style.values.delete(key);mutations.push({type:'attributes',target:this,attributeName:'style'});}};
   this.classList={contains:name=>this.classes().has(name),add:(...names)=>{const classes=this.classes();for(const name of names)classes.add(name);this.className=[...classes].join(' ');},toggle:(name,force)=>{const classes=this.classes(),has=classes.has(name),on=force??!has;if(on===has)return on;on?classes.add(name):classes.delete(name);this.className=[...classes].join(' ');return on;}};
  }
  classes(){return new Set((this.getAttribute('class')||'').split(/\s+/).filter(Boolean));}
  get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
  get textContent(){return this.children.length?this.children.map(child=>child.textContent).join(''):this._text;}set textContent(value){this._text=String(value);mutations.push({type:'childList',target:this,addedNodes:[],removedNodes:[]});}
  get clientWidth(){this.reads++;return this.width;}get scrollWidth(){this.reads++;return this.textWidth;}
  get isConnected(){return this===document.body||this===document.documentElement||!!this.parentElement?.isConnected;}
  get hidden(){return this.hasAttribute('hidden');}set hidden(value){value?this.setAttribute('hidden',''):this.removeAttribute('hidden');}
  setAttribute(key,value){this.attributes.set(key,String(value));mutations.push({type:'attributes',target:this,attributeName:key});}getAttribute(key){return this.attributes.get(key)??null;}hasAttribute(key){return this.attributes.has(key);}removeAttribute(key){if(this.attributes.delete(key))mutations.push({type:'attributes',target:this,attributeName:key});}
  append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}mutations.push({type:'childList',target:this,addedNodes:children,removedNodes:[]});}
  replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  matches(selector){return selector.split(',').some(part=>{part=part.trim();return part==='[data-ui-hint]'?this.hasAttribute('data-ui-hint'):['.ui-player-name','.ui-player-name-text','.ui-icon-button'].includes(part)&&this.classList.contains(part.slice(1));});}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getClientRects(){for(let node=this;node;node=node.parentElement)if(node.hidden)return[];return this.isConnected?[{width:this.width}]:[];}
  getBoundingClientRect(){return this.rect;}
  showPopover(){this.popoverOpen=true;}hidePopover(){this.popoverOpen=false;}
  remove(){const parent=this.parentElement;if(!parent)return;parent.children=parent.children.filter(child=>child!==this);this.parentElement=null;mutations.push({type:'childList',target:parent,addedNodes:[],removedNodes:[this]});}
 }
 const root=new Element('html'),body=new Element('body');document=events({body,documentElement:root,hidden:false,querySelectorAll:selector=>body.querySelectorAll(selector),createElement:tag=>new Element(tag)});body.parentElement=root;root.children.push(body);
 const media=events({matches:reduced}),window=events({document,innerWidth:640,innerHeight:480,matchMedia:()=>media,requestAnimationFrame(fn){const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)}),storage=new Map();
 class MutationObserver{constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}observe(target,options){this.targets.push({target,options});}disconnect(){this.targets=[];}}
 class ResizeObserver{constructor(callback){this.callback=callback;this.targets=new Set();resizers.push(this);}observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}disconnect(){this.targets.clear();}}
 const context=vm.createContext({window,document,MutationObserver,ResizeObserver,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},getComputedStyle:node=>({fontSize:'16px',visibility:node.style.getPropertyValue('visibility')||'visible'})});
 vm.runInContext(motionSource,context);window.MotionPolicy.set({enabled});vm.runInContext(uiSource,context);
 function deliver(){const batch=mutations.splice(0);for(const observer of observers){const records=batch.filter(record=>observer.targets.some(({target,options})=>(record.target===target||options.subtree&&target.contains(record.target))&&(record.type==='attributes'?options.attributes&&(!options.attributeFilter||options.attributeFilter.includes(record.attributeName)):options[record.type])));if(records.length)observer.callback(records);}}
 function flush(){for(let rounds=0;rounds<20;rounds++){deliver();if(!frames.size){if(!mutations.length)return;continue;}const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();}throw Error('observer/frame loop did not settle');}
 function name(value,{width=100,textWidth=100,tabindex=null,parent=body}={}){const slot=new Element(),text=new Element();slot.className='ui-player-name';text.className='ui-player-name-text';slot.setAttribute('title',value);if(tabindex!==null)slot.setAttribute('tabindex',tabindex);slot.width=width;text.textWidth=textWidth;text.textContent=value;slot.append(text);parent.append(slot);return{slot,text};}
 function resize(...nodes){for(const observer of resizers)observer.callback(nodes.filter(node=>observer.targets.has(node)).map(target=>({target})));}
 return{window,document,media,frames,resizers,observers,body,name,resize,flush,deliver,Element,hide(value){document.hidden=value;document.dispatch('visibilitychange');},reduce(value){media.matches=value;media.dispatch('change');}};
}

test('playerName escapes both contexts and preserves one full readable name with a title',()=>{
 const h=harness(),name='"><img src=x onerror="bad"> & 🦊朋友',html=h.window.GameUI.playerName(name);
 assert.doesNotMatch(html,/<img|onerror="bad"/);assert.match(html,/title="&quot;&gt;&lt;img/);assert.match(html,/&amp; 🦊朋友/);
 assert.equal((html.match(/class="ui-player-name-text"/g)||[]).length,1);assert.equal(html.replace(/<[^>]*>/g,''),'&quot;&gt;&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; 🦊朋友');
 assert.equal(h.window.GameUI.playerName(null),'<span class="ui-player-name" title=""><span class="ui-player-name-text"></span></span>');
});

test('short and exactly fitting names do not animate, gain focus stops or schedule idle frames',()=>{
 const h=harness(),short=h.name('短名',{width:100,textWidth:60}),exact=h.name('剛好',{width:100,textWidth:100});h.flush();
 for(const{slot}of [short,exact]){assert.equal(slot.getAttribute('data-name-overflow'),'false');assert.equal(slot.getAttribute('data-name-motion'),'off');assert.equal(slot.getAttribute('tabindex'),null);assert.equal(slot.style.getPropertyValue('--ui-player-name-shift'),'');}
 assert.equal(h.frames.size,0);const reads=short.slot.reads+short.text.reads;h.flush();assert.equal(short.slot.reads+short.text.reads,reads);
});

test('only measured overflow moves, using the real excess width and a keyboard pause target',()=>{
 const h=harness(),long=h.name('一個超過姓名欄的名字',{width:80,textWidth:200});h.flush();
 assert.equal(long.slot.getAttribute('data-name-overflow'),'true');assert.equal(long.slot.getAttribute('data-name-motion'),'on');assert.equal(long.slot.getAttribute('tabindex'),'0');assert.equal(long.slot.style.getPropertyValue('--ui-player-name-shift'),'-120px');assert.equal(long.slot.getAttribute('title'),'一個超過姓名欄的名字');assert.equal(long.slot.children.length,1);
 assert.equal(h.resizers[0].targets.size,2);
});

test('resize bursts and parent mutations batch one frame and do not measure unrelated names',()=>{
 const h=harness(),container=new h.Element('div');h.body.append(container);const a=h.name('甲',{parent:container,width:80,textWidth:200}),b=h.name('乙',{width:100,textWidth:40});h.flush();const bReads=b.slot.reads+b.text.reads;
 a.slot.width=120;for(let i=0;i<8;i++)h.resize(a.slot,a.text);container.className='changed';h.deliver();assert.equal(h.frames.size,1);h.flush();assert.equal(a.slot.style.getPropertyValue('--ui-player-name-shift'),'-80px');assert.equal(b.slot.reads+b.text.reads,bReads);assert.equal(h.frames.size,0);
});

test('hidden names stop and remeasure when their ancestor becomes visible',()=>{
 const h=harness(),container=new h.Element('div');h.body.append(container);const long=h.name('隱藏的長名字',{parent:container,width:80,textWidth:200});h.flush();container.hidden=true;h.flush();
 assert.equal(long.slot.getAttribute('data-name-motion'),'off');assert.equal(long.slot.getAttribute('tabindex'),null);assert.equal(long.slot.style.getPropertyValue('--ui-player-name-shift'),'');
 container.hidden=false;h.flush();assert.equal(long.slot.getAttribute('data-name-motion'),'on');long.slot.style.setProperty('visibility','hidden');h.flush();assert.equal(long.slot.getAttribute('data-name-motion'),'off');
});

test('system reduced motion and shared motion preferences stop names immediately and can resume',()=>{
 const h=harness(),long=h.name('長名字',{width:80,textWidth:200});h.flush();h.reduce(true);assert.equal(long.slot.getAttribute('data-name-motion'),'off');h.reduce(false);h.flush();assert.equal(long.slot.getAttribute('data-name-motion'),'on');
 h.window.MotionPolicy.set({enabled:false});assert.equal(long.slot.getAttribute('data-name-motion'),'off');h.flush();assert.equal(long.slot.getAttribute('data-name-motion'),'off');h.window.MotionPolicy.set({enabled:true});h.flush();assert.equal(long.slot.getAttribute('data-name-motion'),'on');
 const reduced=harness({reduced:true}),staticName=reduced.name('從開始就減少動態',{width:70,textWidth:150});reduced.flush();assert.equal(staticName.slot.getAttribute('data-name-overflow'),'true');assert.equal(staticName.slot.getAttribute('data-name-motion'),'off');
});

test('background visibility stops without waiting for rAF and resumes current layout',()=>{
 const h=harness(),long=h.name('背景長名字',{width:80,textWidth:200});h.flush();h.resize(long.slot);assert.equal(h.frames.size,1);h.hide(true);assert.equal(long.slot.getAttribute('data-name-motion'),'off');assert.equal(h.frames.size,0);
 long.slot.width=250;h.resize(long.slot);assert.equal(h.frames.size,0);h.hide(false);h.flush();assert.equal(long.slot.getAttribute('data-name-overflow'),'false');assert.equal(long.slot.getAttribute('data-name-motion'),'off');
});

test('renaming updates the full title, clears overflow and restores caller tabindex',()=>{
 const h=harness(),long=h.name('原本很長的名字',{width:80,textWidth:200,tabindex:'-1'});h.flush();assert.equal(long.slot.getAttribute('tabindex'),'0');long.text.textWidth=40;long.text.textContent='新名';h.flush();
 assert.equal(long.slot.getAttribute('title'),'新名');assert.equal(long.slot.getAttribute('data-name-overflow'),'false');assert.equal(long.slot.getAttribute('tabindex'),'-1');assert.equal(long.slot.children.length,1);
});

test('removed name nodes release both resize targets and stop their animations',()=>{
 const h=harness(),long=h.name('會被替換的名字',{width:80,textWidth:200});h.flush();long.slot.remove();h.flush();assert.equal(h.resizers[0].targets.size,0);assert.equal(long.slot.getAttribute('data-name-motion'),'off');h.resize(long.slot,long.text);assert.equal(h.frames.size,0);
});

test('replacing the text element preserves the original tabindex and releases the previous target',()=>{
 const h=harness(),long=h.name('原本很長',{width:80,textWidth:200});h.flush();const replacement=new h.Element();replacement.className='ui-player-name-text';replacement.textContent='短名';replacement.textWidth=40;long.text.remove();long.slot.append(replacement);h.flush();
 assert.equal(long.slot.getAttribute('title'),'短名');assert.equal(long.slot.getAttribute('tabindex'),null);assert.equal(long.slot.getAttribute('data-name-motion'),'off');assert.equal(h.resizers[0].targets.has(long.text),false);assert.equal(h.resizers[0].targets.has(replacement),true);
});

test('BFCache pauses without disposal while a final pagehide disconnects measurement',()=>{
 const h=harness(),long=h.name('重新顯示名字',{width:80,textWidth:200});h.flush();h.window.dispatch('pagehide',{persisted:true});assert.equal(long.slot.getAttribute('data-name-motion'),'off');assert.equal(h.resizers[0].targets.size,2);
 h.window.dispatch('pageshow',{persisted:true});h.flush();assert.equal(long.slot.getAttribute('data-name-motion'),'on');h.window.dispatch('pagehide',{persisted:false});assert.equal(h.resizers[0].targets.size,0);assert.equal(long.slot.getAttribute('data-name-motion'),'off');h.resize(long.slot);assert.equal(h.frames.size,0);
});

test('name styles isolate margins, preserve hidden state and pause on hover/focus without permanent will-change',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../public/shared/ui-primitives.css'),'utf8'),start=css.indexOf('/* A name occupies one line'),names=css.slice(start);
 assert.match(names,/\.room-player-info \.room-player-name\{display:flex/);assert.match(names,/\.room-player-info \.room-player-self\{flex:none;white-space:nowrap;margin:0;padding:0/);
 assert.match(names,/\.ui-player-name\{[^}]*margin:0;padding:0[^}]*white-space:nowrap/);assert.match(names,/\.ui-player-name\[hidden\],\.ui-player-name-text\[hidden\]\{display:none!important/);
 assert.match(names,/:is\(:hover,:focus-within\)[^{]*\{animation-play-state:paused/);assert.match(names,/prefers-reduced-motion:reduce/);assert.doesNotMatch(names,/will-change/);
});

test('overflowText preserves escaped one-line content and opts into intent-only motion without changing playerName',()=>{
 const h=harness(),value='影片 <img onerror="bad"> & 很長的標題',html=h.window.GameUI.overflowText(value,{hoverOnly:true});
 assert.match(html,/class="ui-player-name ui-overflow-text" data-name-activation="hover"/);assert.match(html,/title="影片 &lt;img/);assert.doesNotMatch(html,/<img|onerror="bad"/);assert.equal((html.match(/class="ui-player-name-text"/g)||[]).length,1);
 assert.doesNotMatch(h.window.GameUI.playerName(value),/ui-overflow-text|data-name-activation/);
 const long=h.name(value,{width:100,textWidth:300});long.slot.classList.add('ui-overflow-text');long.slot.setAttribute('data-name-activation','hover');h.flush();
 assert.equal(long.slot.getAttribute('data-name-overflow'),'true');assert.equal(long.slot.getAttribute('tabindex'),'0');assert.equal(long.slot.style.getPropertyValue('--ui-player-name-shift'),'-200px');
 h.reduce(true);assert.equal(long.slot.getAttribute('data-name-motion'),'off');h.reduce(false);h.flush();h.hide(true);assert.equal(long.slot.getAttribute('data-name-motion'),'off');
 const css=fs.readFileSync(path.join(__dirname,'../public/shared/ui-primitives.css'),'utf8');assert.match(css,/\.ui-overflow-text>\.ui-player-name-text\{width:auto;overflow:hidden;text-overflow:ellipsis/);assert.match(css,/data-name-activation=hover[^\n]*\{animation:none;transform:none/);assert.match(css,/data-name-activation=hover[^\n]*:is\(:hover,:focus-within\)[^\n]*animation-play-state:running/);
});

test('icon hints reuse one top-layer node, clamp near the viewport edge and restore titles/descriptions on Escape',()=>{
 const h=harness(),button=new h.Element('button');h.body.append(button);button.setAttribute('aria-describedby','caller-help');h.window.GameUI.decorateButton(button,'remove',{iconOnly:true,label:'移除這筆媒體'});
 assert.equal(button.title,'移除這筆媒體');assert.equal(button.getAttribute('aria-label'),'移除這筆媒體');assert.equal(button.classList.contains('ui-icon-button'),true);button.setAttribute('title',button.title);
 h.document.activeElement=button;h.document.dispatch('focusin',{target:button});const hint=h.body.children.find(node=>node.classList.contains('ui-control-tooltip'));assert.ok(hint.popoverOpen);assert.equal(hint.textContent,'移除這筆媒體');assert.equal(button.getAttribute('title'),'');assert.equal(button.getAttribute('aria-describedby'),'caller-help ui-control-hint');
 assert.ok(parseFloat(hint.style.getPropertyValue('left'))+hint.rect.width<=632);assert.equal(hint.style.getPropertyValue('top'),'408px');
 let prevented=false;h.document.dispatch('keydown',{key:'Escape',preventDefault(){prevented=true;}});assert.equal(prevented,false,'hint cleanup must preserve the owning dialog Escape behavior');assert.equal(hint.hidden,true);assert.equal(hint.popoverOpen,false);assert.equal(button.getAttribute('title'),'移除這筆媒體');assert.equal(button.getAttribute('aria-describedby'),'caller-help');
 h.document.dispatch('pointerover',{target:button});assert.equal(h.body.children.filter(node=>node.classList.contains('ui-control-tooltip')).length,1);button.remove();h.deliver();assert.equal(hint.hidden,true);
});

test('icon hints stay reachable when moving into the hint and release on pointer-down, hidden or pagehide',()=>{
 const h=harness(),button=new h.Element('button');h.body.append(button);h.window.GameUI.decorateButton(button,'add',{iconOnly:true,label:'加入播放清單'});button.setAttribute('title',button.title);h.document.dispatch('pointerover',{target:button});const hint=h.body.children.find(node=>node.classList.contains('ui-control-tooltip'));
 h.document.dispatch('pointerout',{target:button,relatedTarget:hint});assert.equal(hint.hidden,false);h.document.dispatch('pointerout',{target:hint,relatedTarget:h.body});assert.equal(hint.hidden,true);
 h.document.dispatch('focusin',{target:button});h.hide(true);assert.equal(hint.hidden,true);h.hide(false);h.document.dispatch('focusin',{target:button});h.document.dispatch('pointerdown',{target:button});assert.equal(hint.hidden,true);h.document.dispatch('focusin',{target:button});h.window.dispatch('pagehide',{persisted:true});assert.equal(hint.hidden,true);
});

test('unsupported top-layer hints keep the native title and accessible label without a visible fallback overlay',()=>{
 const h=harness(),button=new h.Element('button');h.body.append(button);h.window.GameUI.decorateButton(button,'play',{iconOnly:true,label:'全桌播放'});button.setAttribute('title',button.title);h.Element.prototype.showPopover=undefined;h.document.dispatch('focusin',{target:button});
 assert.equal(button.getAttribute('title'),'全桌播放');assert.equal(button.getAttribute('aria-label'),'全桌播放');assert.equal(button.getAttribute('aria-describedby'),null);const hint=h.body.children.find(node=>node.classList.contains('ui-control-tooltip'));assert.notEqual(hint.hidden,false);
});

test('image-only expression cards share hover and focus hints without icon-button geometry or replacing the image',()=>{
 const h=harness(),card=new h.Element('button'),image=new h.Element('img');card.setAttribute('data-ui-hint','');card.setAttribute('aria-label','送出「開心」表情');card.setAttribute('title','送出「開心」表情');card.append(image);h.body.append(card);
 h.document.dispatch('pointerover',{target:image});const hint=h.body.children.find(node=>node.classList.contains('ui-control-tooltip'));assert.equal(hint.textContent,'送出「開心」表情');assert.equal(hint.popoverOpen,true);assert.equal(card.classList.contains('ui-icon-button'),false);assert.equal(card.children[0],image);
 h.document.dispatch('keydown',{key:'Escape'});assert.equal(hint.hidden,true);assert.equal(card.getAttribute('title'),'送出「開心」表情');h.document.dispatch('focusin',{target:card});assert.equal(hint.popoverOpen,true);assert.equal(card.children[0],image);card.remove();h.deliver();assert.equal(hint.hidden,true);
});
