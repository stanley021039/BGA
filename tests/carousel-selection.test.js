const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('swipe guard blocks trailing card clicks but keyboard and navigation still synchronize real hub selection and create type',async()=>{
 for(const action of ['ArrowRight','ArrowLeft','Home','End','next','previous']){
  let now=0,request;
  class Node{
   constructor(game,title){this.dataset=game?{game}:{};this.title=title;this.textContent='';this.value='';this.style={setProperty(){},removeProperty(){}};this.attrs={};this.listeners={};this.classes=new Set(game==='thunder'?['selected']:[]);this.classList={contains:x=>this.classes.has(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
   querySelector(s){return s==='h2'?(this.heading||={childNodes:[{textContent:this.title}],textContent:''}):this.label||(this.label=new Node());}
   setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}focus(){}setPointerCapture(){this.captured=true;}hasPointerCapture(){return !!this.captured;}releasePointerCapture(){this.captured=false;}
   fire(k,event={}){let stopped=false;const e={preventDefault(){},stopImmediatePropagation(){stopped=true;},...event};for(const fn of this.listeners[k]||[]){fn(e);if(stopped)break;}if(!stopped)this['on'+k]?.(e);}
   click(){this.fire('click');}
  }
  const cards=['poker','thunder','majority','gift','draw',null].map((g,i)=>new Node(g,['撲克','賽車','同頻','送禮','畫猜','市場'][i]));const root=new Node(),nodes=new Map();root.querySelectorAll=()=>cards;
  const get=s=>{if(s==='[data-card-carousel]')return root;if(!nodes.has(s))nodes.set(s,new Node());return nodes.get(s);};const document={querySelector:get,querySelectorAll:s=>s==='[data-game]'?cards.filter(c=>c.dataset.game):[],addEventListener(){}};
  const hub=fs.readFileSync(path.join(__dirname,'../public/hub.js'),'utf8'),selection=hub.slice(hub.indexOf("document.querySelectorAll('[data-game]').forEach"),hub.indexOf("$('#create').onclick"));
  const scope={document,performance:{now:()=>now},window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},location:{},localStorage:{setItem(){}},fetch:async(url,opts)=>{request=JSON.parse(opts.body);return {ok:true,json:async()=>({type:request.type,code:'ABCDEF'})};},toast:assert.fail};
  vm.createContext(scope);vm.runInContext("let selected='thunder',busy=false;const $=s=>document.querySelector(s);const titles={thunder:'賽車',poker:'撲克',majority:'同頻',gift:'送禮',draw:'畫猜'};"+selection,scope);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/shared/game-card-carousel.js'),'utf8'),scope);
  const pointer={button:0,isPrimary:true,pointerId:1,clientX:200,clientY:10};root.fire('pointerdown',pointer);root.fire('pointermove',{...pointer,clientX:100});root.fire('pointerup',{...pointer,clientX:100});assert.equal(vm.runInContext('selected',scope),'majority');
  now=100;cards[1].click();assert.equal(vm.runInContext('selected',scope),'majority');
  if(action==='next'||action==='previous')get(action==='next'?'#carouselNext':'#carouselPrevious').click();else root.fire('keydown',{key:action});
  const expected={ArrowRight:'gift',ArrowLeft:'thunder',Home:'poker',End:'majority',next:'gift',previous:'thunder'}[action];
  assert.equal(vm.runInContext('selected',scope),expected);const visible=cards.find(c=>c.tabIndex===0);if(action!=='End'){assert.equal(visible.dataset.game,expected);assert.equal(get('#createRoomDialog').querySelector('h2').textContent,'開一桌'+visible.title);await vm.runInContext('enter(false)',scope);assert.equal(request.type,expected);}else assert.equal(get('#openCreateRoom').hidden,true);
  now=500;cards[4].click();assert.equal(vm.runInContext('selected',scope),'draw');
 }
});

