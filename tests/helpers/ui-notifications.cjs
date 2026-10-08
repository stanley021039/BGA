const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function events(target={}){
 const listeners=new Map();return Object.assign(target,{listeners,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(callback);},removeEventListener(type,callback){listeners.get(type)?.delete(callback);},dispatch(type,event={}){for(const callback of [...listeners.get(type)||[]])callback(event);}});
}
function fixture({reduced=false,hidden=false,enabled=true,policy=true,body=true,celebration=true}={}){
 let now=0,number=0;const timers=new Map(),animations=[],observers=[],celebrations=[],subscriptions=new Set(),media=events({matches:reduced});
 class Node{
  constructor(tag){events(this);this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.dataset={};this.attributes=new Map();this.style={};this.textContent='';this.hidden=false;this.className='';this._html='';}
  append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
  get isConnected(){return this===document.body||!!this.parentNode?.isConnected;}
  contains(node){return this===node||this.children.some(child=>child.contains(node));}
  setAttribute(name,value){this.attributes.set(name,String(value));}getAttribute(name){return this.attributes.get(name)??null;}
  set innerHTML(value){this._html=value;}get innerHTML(){return this._html;}
  focus(){document.activeElement=this;}click(){document.activeElement=this;this.dispatch('click');}
  animate(keyframes,options){let resolve,reject;const animation={keyframes,options,playState:'running',cancelled:false,finished:new Promise((ok,fail)=>{resolve=ok;reject=fail;}),finish(){this.playState='finished';resolve();},cancel(){this.cancelled=true;this.playState='idle';reject(Error('cancelled'));}};animations.push(animation);return animation;}
 }
 const document=events({hidden,activeElement:null,body:null,createElement:tag=>new Node(tag)});if(body)document.body=new Node('body');
 const window=events({matchMedia:()=>media,GameUI:{symbol:name=>'<span data-icon="'+name+'"></span>',decorateButton(node,icon,{label=node.textContent,iconOnly=false}={}){node.textContent='';node.dataset.icon=icon;node.dataset.iconOnly=String(iconOnly);node.setAttribute('aria-label',label);}}});
 if(policy)window.MotionPolicy={allowsMotion:()=>enabled&&!media.matches&&!document.hidden,animate:(...args)=>window.MotionPolicy.allowsMotion()?args[0].animate(...args.slice(1)):null,subscribe(callback){subscriptions.add(callback);callback();return()=>subscriptions.delete(callback);}};
 if(celebration)window.GameUI.celebrate=(element,options)=>{const entry={element,options,cancelled:false};celebrations.push(entry);return()=>{entry.cancelled=true;};};
 const context=vm.createContext({window,document,location:{origin:'https://bga.test',href:'https://bga.test/draw/test'},URL,AbortController,performance:{now:()=>now},Date:{now:()=>now},MutationObserver:class{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}},setTimeout(callback,delay){const id=++number;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
 const source=fs.readFileSync(path.join(__dirname,'../../public/shared/ui-notifications.js'),'utf8');vm.runInContext(source,context,{filename:'ui-notifications.js'});
 async function flush(){for(let index=0;index<5;index++)await Promise.resolve();}
 async function tick(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;const[id,timer]=next;now=timer.at;timers.delete(id);timer.callback();await flush();}now=end;await flush();}
 return{window,document,context,media,timers,animations,observers,celebrations,subscriptions,Node,flush,tick,ui:window.GameUI,notify:(...args)=>window.GameUI.notify(...args),state:()=>window.GameUI.notifications.getState(),hide(value){document.hidden=value;document.dispatch('visibilitychange');},reduce(value){media.matches=value;media.dispatch('change');for(const callback of subscriptions)callback();},enable(value){enabled=value;for(const callback of subscriptions)callback();},mutate(){for(const observer of observers)if(!observer.disconnected)observer.callback([]);},attachBody(){document.body=new Node('body');document.dispatch('DOMContentLoaded');},run:code=>vm.runInContext(code,context)};
}
module.exports={fixture};
