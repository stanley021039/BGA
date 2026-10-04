const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const helperPath=path.join(__dirname,'../public/shared/race-terrain-help.js');
const {helpFor,position}=require(helperPath);

function legendHelp(){
 const listeners=new Map(),timers=new Map();let nextTimer=0,mapHides=0;
 const element=tag=>({tag,attrs:{},style:{},children:[],textContent:'',hidden:false,offsetWidth:320,offsetHeight:100,
  setAttribute(name,value){this.attrs[name]=String(value);},getAttribute(name){return this.attrs[name]??null;},removeAttribute(name){delete this.attrs[name];},
  append(...children){this.children.push(...children);},getBoundingClientRect(){const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0;return{left,top,right:left+this.offsetWidth,bottom:top+this.offsetHeight};}});
 const button=code=>({...element('button'),dataset:{raceTerrain:code},isConnected:true,closest(){return this;},contains(target){return target===this;},getBoundingClientRect(){return{left:300,top:300,right:344,bottom:344,width:44,height:44};}});
 const poison=button('G'),glass=button('V'),unknown=button('?'),buttons=[poison,glass,unknown];
 const legend={contains:node=>buttons.includes(node),addEventListener(type,fn){listeners.set('legend:'+type,fn);}};
 const body=element('body'),document={body,activeElement:null,querySelector:selector=>selector==='.terrain-legend'?legend:null,createElement:element,addEventListener(type,fn){listeners.set('document:'+type,fn);}};
 const window={document,innerWidth:390,innerHeight:360,hideTrackHover(){mapHides++;},setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),addEventListener(type,fn){listeners.set('window:'+type,fn);}};
 vm.runInNewContext(fs.readFileSync(helperPath,'utf8'),{window});
 const tip=body.children[0];
 return{listeners,timers,tip,poison,glass,unknown,document,get mapHides(){return mapHides;},fire(type,event={}){const callback=listeners.get(type);assert.ok(callback,type+' listener');callback(event);},flush(ms){for(const [id,timer]of [...timers])if(timer.ms===ms){timers.delete(id);timer.fn();}}};
}

test('public terrain help describes movement cost, stopping and sliding without reading hidden tokens',()=>{
 assert.match(helpFor('G').effect,/耗 1.*立即停止/);
 assert.match(helpFor('V').effect,/耗 1.*進入方向再滑 1 格.*落點效果/);
 assert.match(helpFor('R').effect,/非滑行.*全程公路.*未停車/);
 assert.match(helpFor('M').effect,/耗 2/);
 assert.match(helpFor('J').effect,/正後方.*其他方向.*淘汰/);
 for(const unknown of ['?',undefined,'mine','constructor','toString',{kind:'mine',face:false}])assert.deepEqual(helpFor(unknown),helpFor('?'));
 assert.match(helpFor('?').effect,/進入才翻開.*屆時揭露/);
 assert.ok(Object.isFrozen(helpFor('G')));
});

test('tooltip placement stays inside narrow, short and offset visual viewports',()=>{
 for(const viewport of [{left:0,top:0,width:390,height:360},{left:25,top:40,width:250,height:180}]){
  const size={width:320,height:100};
  for(const anchor of [{left:-10,top:60,bottom:104},{left:viewport.left+viewport.width-10,top:viewport.top+viewport.height-44,bottom:viewport.top+viewport.height}]){
   const placed=position(anchor,size,viewport),width=Math.min(size.width,viewport.width-16),height=Math.min(size.height,viewport.height-16);
   assert.ok(placed.left>=viewport.left+8);assert.ok(placed.left+width<=viewport.left+viewport.width-8);
   assert.ok(placed.top>=viewport.top+8);assert.ok(placed.top+height<=viewport.top+viewport.height-8);
  }
 }
});

test('keyboard focus opens readable help immediately and preserves existing accessible descriptions',()=>{
 const h=legendHelp();h.poison.setAttribute('aria-describedby','roundStatus');h.document.activeElement=h.poison;
 h.fire('legend:focusin',{target:h.poison});
 assert.equal(h.tip.hidden,false);assert.equal(h.tip.children[0].textContent,'毒液');assert.match(h.tip.children[1].textContent,/立即停止/);
 assert.equal(h.tip.attrs.role,'tooltip');assert.equal(h.poison.getAttribute('aria-describedby'),'roundStatus raceTerrainLegendTooltip');assert.equal(h.mapHides,1);
 const box=h.tip.getBoundingClientRect();assert.ok(box.right<=382&&box.bottom<=352);
 h.fire('document:keydown',{key:'Escape'});assert.equal(h.tip.hidden,true);assert.equal(h.poison.getAttribute('aria-describedby'),'roundStatus');assert.equal(h.document.activeElement,h.poison);
 h.fire('legend:focusout',{target:h.poison,relatedTarget:h.glass});h.fire('legend:focusin',{target:h.glass});assert.equal(h.tip.hidden,false);assert.equal(h.tip.children[0].textContent,'玻璃');
});

test('mouse hover is delayed, survives travel across the help text and dismisses on Escape until leave',()=>{
 const h=legendHelp();h.fire('legend:pointerover',{target:h.poison,pointerType:'mouse',buttons:0});
 assert.equal(h.tip.hidden,true);assert.equal([...h.timers.values()][0].ms,400);h.flush(400);assert.equal(h.tip.hidden,false);
 h.fire('legend:pointerout',{target:h.poison,relatedTarget:null,clientX:344,clientY:320});
 h.fire('document:pointermove',{target:null,clientX:100,clientY:210});h.flush(180);assert.equal(h.tip.hidden,false);
 h.fire('document:keydown',{key:'Escape'});h.fire('legend:pointerover',{target:h.poison,pointerType:'mouse',buttons:0});h.flush(400);assert.equal(h.tip.hidden,true);
 h.fire('legend:pointerout',{target:h.poison,relatedTarget:null,clientX:0,clientY:0});h.fire('legend:pointerover',{target:h.poison,pointerType:'mouse',buttons:0});h.flush(400);assert.equal(h.tip.hidden,false);
 h.fire('document:pointermove',{target:null,clientX:0,clientY:0});h.flush(180);assert.equal(h.tip.hidden,true);
});

test('scrolling a focused button into view preserves its help; leaving the viewport closes it',()=>{
 const h=legendHelp();h.document.activeElement=h.glass;h.fire('legend:focusin',{target:h.glass});
 h.fire('document:scroll');assert.equal(h.tip.hidden,false);assert.equal(h.tip.children[0].textContent,'玻璃');
 h.glass.getBoundingClientRect=()=>({left:300,top:-100,right:344,bottom:-56});
 h.fire('document:scroll');assert.equal(h.tip.hidden,true);assert.equal(h.glass.getAttribute('aria-describedby'),null);
 h.document.activeElement=null;h.fire('legend:click',{target:h.poison});h.fire('document:scroll');assert.equal(h.tip.hidden,true);
});

test('touch opens help by activation and outside presses stay available to the board',()=>{
 const h=legendHelp();h.fire('legend:pointerover',{target:h.unknown,pointerType:'touch',buttons:0});h.flush(400);assert.equal(h.tip.hidden,true);
 h.fire('legend:click',{target:h.unknown});assert.equal(h.tip.hidden,false);assert.equal(h.tip.children[0].textContent,'未知危險');assert.match(h.tip.children[1].textContent,/屆時揭露/);
 let prevented=false;h.fire('document:pointerdown',{target:{},preventDefault(){prevented=true;}});assert.equal(h.tip.hidden,true);assert.equal(prevented,false);
 h.fire('legend:click',{target:h.glass});h.fire('window:resize');assert.equal(h.tip.hidden,true);assert.equal(h.glass.getAttribute('aria-describedby'),null);
});

test('every public terrain legend is a named native button and loads the dedicated help',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/race.html'),'utf8');
 const buttons=[...html.matchAll(/<button\b[^>]*data-race-terrain="([^"]+)"[^>]*>/g)];
 assert.deepEqual(buttons.map(match=>match[1]),['R','O','M','X','?','G','V','J','F','S']);
 for(const [markup,code]of buttons){assert.match(markup,/type="button"/);assert.ok(markup.includes(`aria-label="${helpFor(code).name}地形說明"`));}
 assert.ok(html.includes('<script src="/shared/race-terrain-help.js"></script>'));
});
