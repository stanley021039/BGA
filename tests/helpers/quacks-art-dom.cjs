'use strict';
const fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 class El{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.handlers=new Map();this._text='';this.style={setProperty(k,v){this[k]=v;}};this.classList={contains:name=>(this.attrs.class||'').split(/\s+/).includes(name),add:(name)=>this.toggle(name,true),toggle:(name,on)=>this.toggle(name,on)};}
  toggle(name,on){const classes=new Set((this.attrs.class||'').split(/\s+/).filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.attrs.class=[...classes].join(' ');}
  append(...items){for(const n of items){n.remove?.();n.parent=this;this.children.push(n);}}
  replaceChildren(...items){this.children=[];this._text='';this.append(...items);}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  set textContent(s){this.children=[];this._text=String(s);}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  addEventListener(type,handler){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(handler);}dispatch(type,event={}){for(const handler of this.handlers.get(type)||[])handler({target:this,...event});}contains(node){return this===node||this.children.some(n=>n.contains(node));}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  querySelectorAll(selector){const match=n=>selector.startsWith('.')?(n.attrs.class||'').split(/\s+/).includes(selector.slice(1)):selector.startsWith('[')?Object.hasOwn(n.attrs,selector.slice(1,-1)):n.tagName===selector;const out=[];const walk=n=>{for(const c of n.children){if(match(c))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 const legend=new El('div'),document={createElementNS:(ns,tag)=>new El(tag),createElement:tag=>new El(tag),querySelector:()=>legend},window={document,MotionPolicy:{allowsMotion:()=>false}},context=vm.createContext({window,document});
 vm.runInContext(fs.readFileSync('public/quacks-art.js','utf8'),context);vm.runInContext(fs.readFileSync('public/quacks-fx.js','utf8'),context);
 return {art:window.QuacksArt,fx:window.QuacksFx,host:new El('div'),legend};
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function xml(n){const attrs={...n.attrs};if(n.style.transform)attrs.style='transform:'+n.style.transform;if(n.tagName==='svg')attrs.xmlns='http://www.w3.org/2000/svg';return '<'+n.tagName+Object.entries(attrs).map(([k,v])=>' '+k+'="'+escape(v)+'"').join('')+'>'+escape(n._text)+n.children.map(xml).join('')+'</'+n.tagName+'>';}
module.exports={fixture,xml};
