const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function tooltip(){
 const source=fs.readFileSync(path.join(__dirname,'../public/race.js'),'utf8'),start=source.indexOf('// Delayed terrain help'),end=source.indexOf('\n})();',start)+6,listeners=new Map(),timers=new Map();let next=0;
 const tip={hidden:true,style:{},scrollTop:0,scrollHeight:500,clientHeight:140,offsetWidth:320,offsetHeight:140,innerHTML:'',getBoundingClientRect(){const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0;return{left,top,right:left+320,bottom:top+140};}};
 const cell=(x,y)=>({dataset:{x:String(x),y:String(y)},isConnected:true,closest(){return this;},contains(e){return e===this;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},getBoundingClientRect(){return{left:100,top:100,right:140,bottom:140,width:40,height:40};}}),a=cell(3,0),b=cell(3,1),track={contains:e=>e===a||e===b,addEventListener(type,fn){listeners.set('track:'+type,fn);}},document={body:{append(){}},activeElement:a,createElement:()=>tip,addEventListener(type,fn){listeners.set('document:'+type,fn);}},window={innerWidth:1280,innerHeight:720,addEventListener(){}};
 vm.runInNewContext(source.slice(start,end),{$:()=>track,state:{tiles:[{start:0,cells:Array.from({length:6},()=>Array.from({length:8},()=>({kind:'R'})))}]},esc:String,document,window,setTimeout(fn){const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 listeners.get('track:pointerover')({target:a,pointerType:'mouse',buttons:0,clientX:110,clientY:110});for(const [id,fn]of timers){timers.delete(id);fn();}
 return{tip,listeners,a,b,document};
}
test('terrain tooltip stays readable over adjacent cells and never cancels their pointer press',()=>{
 const {tip,listeners,b}=tooltip();assert.equal(tip.hidden,false);
 listeners.get('track:pointerover')({target:b,pointerType:'mouse',buttons:0,clientX:180,clientY:120});assert.equal(tip.hidden,false);
 let prevented=false;listeners.get('track:pointerdown')({target:b,preventDefault(){prevented=true;}});assert.equal(tip.hidden,true);assert.equal(prevented,false);
});
test('long click-through terrain help scrolls by wheel and keyboard within its viewport rectangle',()=>{
 const {tip,listeners}=tooltip();let prevented=false;listeners.get('document:wheel')({clientX:180,clientY:120,deltaY:80,deltaMode:0,preventDefault(){prevented=true;}});assert.equal(tip.scrollTop,80);assert.equal(prevented,true);
 prevented=false;listeners.get('document:wheel')({clientX:20,clientY:20,deltaY:80,deltaMode:0,preventDefault(){prevented=true;}});assert.equal(tip.scrollTop,80);assert.equal(prevented,false);
 listeners.get('document:keydown')({key:'PageDown',preventDefault(){prevented=true;}});assert.equal(tip.scrollTop,220);assert.equal(prevented,true);
 listeners.get('document:keydown')({key:'Escape'});assert.equal(tip.hidden,true);
});
