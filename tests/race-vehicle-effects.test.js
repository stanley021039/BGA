const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'../public/shared/race-vehicle-effects.js'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../public/race.css'),'utf8');
class Node{
 constructor(tag){this.tagName=tag;this.attributes={};this.dataset={};this.children=[];this.parentNode=null;this.style={values:{},setProperty(key,value){this.values[key]=value;},getPropertyValue(key){return this.values[key]||'';}};this.classList={contains:name=>(this.attributes.class||'').split(/\s+/).includes(name)};}
 get firstChild(){return this.children[0]||null;}
 setAttribute(key,value){this.attributes[key]=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5)]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
 insertBefore(node,before){node.remove();const index=this.children.indexOf(before);assert.notEqual(index,-1);node.parentNode=this;this.children.splice(index,0,node);}
 remove(){if(this.parentNode){const index=this.parentNode.children.indexOf(this);this.parentNode.children.splice(index,1);this.parentNode=null;}}
 getBoundingClientRect(){return{width:820,height:220};}
}
function walk(node){return[node,...node.children.flatMap(walk)];}
function fixture({reduced=false,garage=false}={}){
 let now=1000,sequence=0,svg,hidden=false;const timers=new Map(),listeners=new Map(),mediaListeners=new Map();
 const state={code:'ROOM',round:2,phase:'move',tiles:[{start:8}],active:{car:'source'},cars:[{id:'source',x:garage?null:3,y:10},{id:'target',x:2,y:11}]};
 function replace(){svg=new Node('svg');svg.setAttribute('viewBox','0 0 1180 398');for(const car of state.cars){if(car.x===null||car.dead)continue;const outer=new Node('g'),moving=new Node('g'),graphics=new Node('g');outer.setAttribute('data-car',car.id);outer.setAttribute('transform',`translate(${48+(car.y-8)*44+(car.x%2)*22},${81+car.x*44})`);moving.setAttribute('class','race-car-moving');moving.style.setProperty('--race-dx','-44px');moving.style.setProperty('--race-dy','0px');graphics.setAttribute('class','race-car-impact');graphics.append(new Node('rect'));moving.append(new Node('circle'),graphics,new Node('text'));outer.append(new Node('title'),moving);svg.append(outer);}return svg;}
 replace();
 const doc={createElementNS:(ns,name)=>new Node(name),querySelector:()=>svg,querySelectorAll:()=>walk(svg).filter(node=>node.dataset.car),addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},get hidden(){return hidden;}},media={matches:reduced,addEventListener(type,fn){mediaListeners.set(type,fn);},removeEventListener(type){mediaListeners.delete(type);}};
 const window={document:doc,matchMedia:()=>media};vm.runInNewContext(script,{window,Date:{now:()=>now},setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
 const effects=window.RaceVehicleEffects.mount();
 function tick(ms){const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
 const nodes=name=>walk(svg).filter(node=>node.classList.contains(name)),car=id=>walk(svg).find(node=>node.dataset.car===id),body=id=>car(id).children.find(node=>node.tagName==='g');
 return{effects,state,replace,tick,nodes,car,body,timers,listeners,mediaListeners,hide(value){hidden=value;listeners.get('visibilitychange')?.();},setReduced(value){media.matches=value;mediaListeners.get('change')?.();}};
}
test('shot creates an actual animated projectile at firing coordinates and a source-car label',()=>{
 const ui=fixture();ui.effects.show([{id:1,kind:'shot',source:'source',target:'target',from:{x:3,y:10},to:{x:2,y:11},hit:true}],ui.state);
 const projectile=ui.nodes('race-vehicle-projectile')[0],line=projectile.children[0],bullet=ui.nodes('race-vehicle-shot-bullet')[0];
 assert.deepEqual([line.getAttribute('x1'),line.getAttribute('y1'),line.getAttribute('x2'),line.getAttribute('y2')],['158','213','180','169']);
 assert.equal(bullet.style.getPropertyValue('--shot-from-x'),'158px');assert.equal(bullet.style.getPropertyValue('--shot-to-y'),'169px');assert.equal(ui.nodes('race-vehicle-label')[0].parentNode,ui.body('source'));
 assert.equal(ui.nodes('race-vehicle-label')[0].children[1].textContent,'射擊');assert.match(css,/\.race-vehicle-shot-bullet\{[^}]*animation:race-vehicle-bullet \.55s linear both/);
 ui.tick(700);ui.replace();ui.effects.show([],ui.state);assert.equal(ui.nodes('race-vehicle-projectile')[0].style.getPropertyValue('--vehicle-effect-delay'),'-700ms');
 ui.tick(500);assert.equal(ui.nodes('race-vehicle-projectile').length,0);ui.effects.show([{id:1,kind:'shot',source:'source',target:'target'}],ui.state);assert.equal(ui.nodes('race-vehicle-projectile').length,0);
});
test('oil and shot-induced skid spin the affected sprite without replacing car placement or movement',()=>{
 for(const event of [{id:1,kind:'hazard',hazard:'oil',car:'source'},{id:1,kind:'damage',damage:'skid',car:'target'}]){
  const ui=fixture(),outer=ui.car(event.car),body=ui.body(event.car),graphics=body.children.find(node=>node.classList.contains('race-car-impact')),position=outer.getAttribute('transform');
  ui.effects.show([event],ui.state);const wrapper=ui.nodes('race-vehicle-skid-wrapper')[0];assert.ok(wrapper);assert.equal(wrapper.firstChild,graphics);assert.equal(wrapper.parentNode,body);assert.equal(outer.getAttribute('transform'),position);assert.equal(body.style.getPropertyValue('--race-dx'),'-44px');
  assert.match(css,/\.race-vehicle-skid-wrapper\{[^}]*animation:race-vehicle-spin \.85s/);assert.match(css,/@keyframes race-vehicle-spin\{[^\n]*rotate\(360deg\)/);
  ui.tick(700);ui.replace();ui.effects.show([],ui.state);assert.equal(ui.nodes('race-vehicle-skid-wrapper')[0].style.getPropertyValue('--vehicle-effect-delay'),'-700ms');
  const currentBody=ui.body(event.car),currentGraphics=ui.nodes('race-vehicle-skid-wrapper')[0].firstChild;ui.tick(400);assert.equal(ui.nodes('race-vehicle-skid-wrapper').length,0);assert.equal(currentGraphics.parentNode,currentBody);assert.equal(currentBody.style.getPropertyValue('--race-dx'),'-44px');
 }
});
test('nitro waits for a garage car, keeps thrust throughout its movement and does not restart after polling',()=>{
 const ui=fixture({garage:true}),event={id:1,kind:'command',command:'nitro',car:'source'};
 ui.effects.show([event],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,0);assert.equal(ui.timers.size,0);
 ui.tick(3000);ui.state.cars[0].x=3;ui.replace();ui.effects.show([],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);assert.equal(ui.nodes('race-vehicle-exhaust')[0].style.getPropertyValue('--vehicle-effect-delay'),'0ms');
 ui.tick(700);ui.replace();ui.effects.show([event],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);assert.equal(ui.nodes('race-vehicle-exhaust')[0].style.getPropertyValue('--vehicle-effect-delay'),'-700ms');
 ui.tick(2000);assert.equal(ui.nodes('race-vehicle-label').length,0);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);assert.equal(ui.timers.size,0);
 ui.replace();ui.effects.show([],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust')[0].style.getPropertyValue('--vehicle-effect-delay'),'-2700ms');assert.equal(ui.nodes('race-vehicle-label').length,0);assert.match(css,/\.race-vehicle-exhaust\{[^}]*infinite alternate/);
 ui.state.phase='shoot';ui.effects.show([],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,0);
});
test('the short label keeps at least 14 visible pixels at the 720p map height and fits its capsule',()=>{
 const ui=fixture();ui.effects.show([{id:1,kind:'command',command:'nitro',car:'source'}],ui.state);const label=ui.nodes('race-vehicle-label')[0],[rect,text]=label.children,font=parseFloat(text.style.getPropertyValue('font-size'));
 assert.ok(font*220/398>=14);assert.equal(rect.getAttribute('width'),String(text.textContent.length*font+20));assert.equal(rect.getAttribute('height'),String(font+10));assert.match(css,/\.race-vehicle-effect,\.race-vehicle-effect \*\{pointer-events:none\}/);
});
test('inverse-scaled labels at the first lane stay within the SVG top and left edges',()=>{
 const ui=fixture();Object.assign(ui.state.cars[0],{x:0,y:8});const svg=ui.replace();svg.getBoundingClientRect=()=>({width:820,height:100});ui.effects.show([{id:1,kind:'command',command:'nitro',car:'source'}],ui.state);
 const label=ui.nodes('race-vehicle-label')[0],[rect,text]=label.children,[dx,dy]=label.getAttribute('transform').match(/[-\d.]+/g).map(Number),font=parseFloat(text.style.getPropertyValue('font-size'));
 assert.ok(font*100/398>=14);assert.ok(48+dx+Number(rect.getAttribute('x'))>=4);assert.ok(81+dy+Number(rect.getAttribute('y'))>=4);
});
test('assign and command use one name per car, while repair names the repaired target',()=>{
 const ui=fixture();ui.effects.show([{id:1,kind:'assign',car:'source',coast:true}],ui.state);assert.equal(ui.nodes('race-vehicle-label')[0].children[1].textContent,'滑行');
 ui.effects.show([{id:2,kind:'assign',car:'source',coast:false},{id:3,kind:'command',command:'nitro',car:'source'}],ui.state);assert.equal(ui.nodes('race-vehicle-label').length,1);assert.equal(ui.nodes('race-vehicle-label')[0].children[1].textContent,'氮氣加速');
 ui.effects.show([{id:4,kind:'command',command:'repair',car:'source',target:'target'}],ui.state);assert.equal(ui.nodes('race-vehicle-label').find(node=>node.children[1].textContent==='維修').parentNode,ui.body('target'));
});
test('airstrike uses helicopter endpoints and reduced motion retains text and a static target marker',()=>{
 const ui=fixture({reduced:true});ui.effects.show([{id:1,kind:'command',command:'nitro',car:'source'},{id:2,kind:'damage',damage:'skid',car:'target'},{id:3,kind:'shot',source:null,target:'target',air:true,from:{x:2,y:10},to:{x:2,y:11}}],ui.state);
 assert.equal(ui.nodes('race-vehicle-exhaust').length,0);assert.equal(ui.nodes('race-vehicle-skid-wrapper').length,0);assert.equal(ui.nodes('race-vehicle-shot-bullet').length,0);assert.equal(ui.nodes('race-vehicle-projectile')[0].dataset.reduced,'true');assert.equal(ui.nodes('race-vehicle-shot-hit').length,1);
 assert.equal(ui.nodes('race-vehicle-label').find(node=>node.children[1].textContent==='空襲射擊').parentNode.tagName,'svg');assert.match(css,/\.race-vehicle-projectile\[data-reduced="true"\] \.race-vehicle-shot-hit\{animation:none/);
});
test('backgrounding discards pending and active effects, remembers hidden events, and cleans up listeners',()=>{
 const ui=fixture({garage:true}),event={id:1,kind:'command',command:'nitro',car:'source'};ui.effects.show([event],ui.state);ui.hide(true);ui.effects.show([{id:2,kind:'damage',damage:'skid',car:'target'}],ui.state);ui.hide(false);
 ui.state.cars[0].x=3;ui.replace();ui.effects.show([event,{id:2,kind:'damage',damage:'skid',car:'target'}],ui.state);assert.equal(ui.nodes('race-vehicle-effect').length,0);
 ui.effects.show([{id:3,kind:'command',command:'nitro',car:'source'}],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);ui.hide(true);assert.equal(ui.nodes('race-vehicle-effect').length,0);assert.equal(ui.timers.size,0);
 ui.effects.destroy();assert.equal(ui.listeners.size,0);assert.equal(ui.mediaListeners.size,0);ui.hide(false);ui.effects.show([{id:4,kind:'command',command:'nitro',car:'source'}],ui.state);assert.equal(ui.nodes('race-vehicle-effect').length,0);
});
test('tutorial reset, round rollback and room changes allow new events without retaining old artifacts',()=>{
 const ui=fixture(),event={id:1,kind:'command',command:'nitro',car:'source'};ui.effects.show([event],ui.state);ui.effects.reset();assert.equal(ui.nodes('race-vehicle-effect').length,0);ui.effects.show([event],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);
 ui.state.round=1;ui.effects.show([event],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);ui.state.code='NEW';ui.effects.show([event],ui.state);assert.equal(ui.nodes('race-vehicle-exhaust').length,1);
 ui.setReduced(true);assert.equal(ui.nodes('race-vehicle-effect').length,0);assert.equal(ui.timers.size,0);ui.effects.show([event],ui.state);assert.equal(ui.nodes('race-vehicle-effect').length,0);
});
