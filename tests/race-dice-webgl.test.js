const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/race-dice-webgl.js'),'utf8');
function fixture({budget=true,unavailable=false,compile=true,link=true,drawError=false,callback}={}){
 let time=0,next=1,enabled=true,reduced=false,reserved=0;const calls=[],frames=new Map(),activities=[],subscriptions=new Set(),observers=[],maps=[];
 const target=extra=>{const listeners=new Map();maps.push(listeners);return {...extra,listeners,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type,event={}){for(const fn of listeners.get(type)||[])fn(event);}};};
 const gl={};['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','ELEMENT_ARRAY_BUFFER','DYNAMIC_DRAW','STATIC_DRAW','FLOAT','TEXTURE0','TEXTURE_2D','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','DEPTH_TEST','LEQUAL','CULL_FACE','BLEND','UNPACK_FLIP_Y_WEBGL','RGBA','UNSIGNED_BYTE','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','TRIANGLES','UNSIGNED_SHORT','ONE','ONE_MINUS_SRC_ALPHA'].forEach((n,i)=>gl[n]=i+1);gl.NO_ERROR=0;
 for(const n of ['createProgram','createShader','createBuffer','createTexture'])gl[n]=()=>({id:next++});
 for(const n of ['shaderSource','compileShader','attachShader','bindAttribLocation','linkProgram','deleteShader','deleteProgram','deleteBuffer','deleteTexture','useProgram','bindBuffer','bufferData','enableVertexAttribArray','vertexAttribPointer','activeTexture','bindTexture','texParameteri','enable','depthFunc','depthMask','blendFunc','disable','viewport','clearColor','clear','pixelStorei','texImage2D','bufferSubData','uniform2f','uniform1f','uniform1i','drawElements'])gl[n]=(...args)=>calls.push({name:n,args:n==='bufferSubData'?[args[0],args[1],Array.from(args[2])]:args});
 gl.getShaderParameter=()=>compile;gl.getProgramParameter=()=>link;gl.getUniformLocation=(_,n)=>n;gl.getError=()=>drawError?1:0;gl.getExtension=()=>({loseContext(){calls.push({name:'loseContext'});}});
 const ctx={};for(const n of ['save','translate','fillRect','strokeRect','beginPath','arc','fill','rotate','moveTo','lineTo','stroke','bezierCurveTo','fillText','restore','clearRect'])ctx[n]=(...args)=>calls.push({name:'2d.'+n,args});
 const host=target({isConnected:true,clientWidth:800,clientHeight:300,clientLeft:0,clientTop:0,scrollLeft:0,scrollTop:0,children:[],appendChild(node){this.children.push(node);node.parentNode=this;},getBoundingClientRect:()=>({left:10,top:20,width:800,height:300})});
 const doc=target({hidden:false,createElement(){return target({isConnected:true,width:0,height:0,style:{},attrs:{},classList:{add(){}},setAttribute(k,v){this.attrs[k]=v;},getContext(type){calls.push({name:'getContext',args:[type]});return type==='2d'?ctx:unavailable?null:gl;},remove(){this.isConnected=false;host.children=host.children.filter(c=>c!==this);}});}});
 const media=target({get matches(){return reduced;}}),policy={allowsMotion:()=>enabled&&!doc.hidden&&!reduced,subscribe(fn){subscriptions.add(fn);fn();return()=>subscriptions.delete(fn);}};
 const root=target({document:doc,MotionPolicy:policy,devicePixelRatio:3,performance:{now:()=>time},requestAnimationFrame(fn){const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>media,GameFxLayer:{acquireContext(){calls.push({name:'acquire'});if(!budget)return false;reserved++;return true;},releaseContext(){reserved--;calls.push({name:'release'});}},ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}});
 vm.runInNewContext(source,{window:root});
 const layer=root.RaceDiceWebGL.create(host,{onActivity(value){activities.push({active:value.active,anchors:[...value.anchors],drawCalls:calls.filter(c=>c.name==='drawElements').length});callback?.(value,layer);}});
 function die(value=5,faces=[1,2,3,4,5,6],x=100,y=60){const parentElement={getBoundingClientRect:()=>({left:x+10,top:y+20,width:70,height:100})};return {anchor:{isConnected:true,parentElement,offsetWidth:56,offsetHeight:56,offsetTop:0},faces,value};}
 return {layer,root,host,doc,gl,calls,frames,activities,observers,maps,subscriptions,canvas:host.children[0],die,get reserved(){return reserved;},tick(ms=16){time+=ms;const batch=[...frames];frames.clear();for(const [,fn]of batch)fn(time);},hide(hidden){doc.hidden=hidden;doc.dispatch('visibilitychange');},reduce(value){reduced=value;media.dispatch('change');},enable(value){enabled=value;for(const fn of subscriptions)fn();},event(type,event){host.children[0]?.dispatch(type,event);}};
}
function rolling(f,key='one',dice=[f.die()],extra={}){return f.layer.show({key,stage:'rolling',dice,...extra});}
test('one lazy context covers the batch with actual textured 3D indexed cubes',()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.root.RaceDiceWebGL.create(f.host),f.layer);assert.equal(f.canvas.style.pointerEvents,'none');assert.equal(f.canvas.style.display,'none');assert.equal(f.canvas.attrs['aria-hidden'],'true');
 const dice=Array.from({length:17},(_,i)=>f.die(i%6+1,undefined,20+(i%10)*70,20+Math.floor(i/10)*110));assert.equal(rolling(f,'round',dice),true);
 assert.equal(f.calls.filter(c=>c.name==='acquire').length,1);assert.equal(f.calls.filter(c=>c.name==='getContext'&&c.args[0]==='webgl').length,1);
 assert.equal(f.calls.filter(c=>c.name==='drawElements'&&c.args[1]>6).length,17);assert.equal(f.canvas.style.display,'block');assert.equal(f.activities.at(-1).anchors.length,17);assert.equal(f.activities.at(-1).drawCalls,34);assert.equal(f.frames.size,1);
 assert.ok(f.layer.getState().pixels<=750000);assert.ok(f.layer.getState().dpr<=1.5);f.layer.destroy();
});
test('rolling does not inspect authoritative result values, even via getters',()=>{
 const f=fixture(),die=f.die();Object.defineProperty(die,'value',{get(){throw Error('secret read');}});assert.equal(rolling(f,'secret',[die]),true);f.tick(250);f.tick(1000);assert.equal(f.frames.size,0);assert.equal(f.layer.getState().active,true);f.layer.destroy();
});
test('result maps the supplied face to the front and is rendered once without RAF',()=>{
 const f=fixture();rolling(f);f.tick(40);const dice=[f.die('SML',['SM','M','L','L','L','SML'])];assert.equal(f.layer.show({key:'one',stage:'result',dice}),true);
 assert.equal(f.frames.size,0);const before=f.calls.filter(c=>c.name==='drawElements').length;
 assert.equal(f.layer.show({key:'one',stage:'result',dice}),true);assert.equal(f.calls.filter(c=>c.name==='drawElements').length,before);
 const text=f.calls.filter(c=>c.name==='2d.fillText');assert.equal(text.at(-3)?.args[0]||text[0].args[0],'SML');
 const angles=f.calls.filter(c=>c.name==='uniform2f'&&c.args[0]==='u_angle').at(-1).args;assert.equal(angles[1],.22);assert.equal(angles[2],-.3);f.layer.destroy();
});
test('duplicate faces retain six UV slots and shot/fire/direction atlases are original',()=>{
 const f=fixture();rolling(f,'commands',[f.die(1,[1,1,1,2,2,3]),f.die('out',[1,1,2,2,'out','eliminate'],200),f.die('前左',['前左','前右','後左','後右','左','右'],300)]);
 const data=f.calls.filter(c=>c.name==='bufferSubData')[0].args[2];assert.equal(data.length,490*8);assert.deepEqual(data.slice(6,8),data.slice(81*8+6,81*8+8));assert.deepEqual(data.slice(6,8),data.slice(162*8+6,162*8+8));assert.notDeepEqual(data.slice(6,8),data.slice(243*8+6,243*8+8));
 assert.ok(f.calls.some(c=>c.name==='2d.bezierCurveTo'));assert.ok(f.calls.some(c=>c.name==='2d.rotate'));assert.equal(f.calls.filter(c=>c.name==='texImage2D').length,1);f.tick();assert.equal(f.calls.filter(c=>c.name==='texImage2D').length,1);f.layer.destroy();
});
test('same rolling key never rewinds and clear/hidden/reduce do not replay a consumed stage',()=>{
 const f=fixture(),dice=[f.die()];rolling(f,'same',dice);f.tick(600);rolling(f,'same',dice,{elapsedMs:0});f.tick(500);assert.equal(f.frames.size,0);
 f.hide(true);assert.equal(f.layer.getState().active,false);f.hide(false);assert.equal(rolling(f,'same',dice),false);assert.equal(f.frames.size,0);
 rolling(f,'new');f.reduce(true);assert.equal(f.frames.size,0);assert.equal(f.layer.getState().active,false);f.reduce(false);assert.equal(rolling(f,'new'),false);f.layer.destroy();
});
test('actual draw errors and compile failure retain fallback and release the shared budget',()=>{
 for(const opts of [{unavailable:true},{compile:false},{link:false},{drawError:true}]){const f=fixture(opts);assert.equal(rolling(f),false);assert.equal(f.layer.getState().active,false);assert.equal(f.reserved,0);assert.equal(f.frames.size,0);assert.equal(f.activities.some(a=>a.active),false);f.layer.destroy();}
 const f=fixture({budget:false});assert.equal(rolling(f),false);assert.equal(f.calls.some(c=>c.name==='getContext'),false);assert.equal(f.layer.getState().reason,'context-budget');f.layer.destroy();
});
test('loss restores DOM immediately and only new stage initializes after restore',()=>{
 const f=fixture();rolling(f,'old');let prevented=false;f.event('webglcontextlost',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(f.reserved,1,'loss retains slot to cover a browser restoring its old context');assert.equal(f.frames.size,0);assert.equal(f.layer.getState().active,false);
 f.event('webglcontextrestored');assert.equal(f.frames.size,0);assert.equal(rolling(f,'old'),false);assert.equal(rolling(f,'fresh'),true);assert.equal(f.reserved,1);f.layer.destroy();
});
test('large body uses CSS projection across the full area while backing pixels remain bounded',()=>{
 const f=fixture();f.host.clientWidth=2000;f.host.clientHeight=1000;f.host.getBoundingClientRect=()=>({left:10,top:20,width:2000,height:1000});rolling(f,'large',[f.die(6,undefined,1600,700)]);
 assert.ok(f.canvas.width*f.canvas.height<=750000);assert.equal(f.canvas.style.width,'2000px');assert.equal(f.canvas.style.height,'1000px');assert.deepEqual(f.calls.filter(c=>c.name==='uniform2f'&&c.args[0]==='u_view').at(-1).args,['u_view',2000,1000]);
 assert.ok(f.calls.filter(c=>c.name==='uniform2f'&&c.args[0]==='u_center').at(-1).args[1]>1500);f.layer.destroy();
});
test('scroll/redraw only paints covered slots and hidden fallback anchors remain measurable',()=>{
 const f=fixture(),die=f.die(),off=f.die(2,undefined,2000,50);die.anchor.style={visibility:'hidden'};
 f.layer.show({key:'r',stage:'result',dice:[die,off]});assert.deepEqual(f.activities.at(-1).anchors,[die.anchor]);assert.equal(f.frames.size,0);
 f.host.scrollTop=100;f.host.dispatch('scroll');assert.equal(f.canvas.style.transform,'translate(0px,100px)');assert.equal(f.frames.size,0);f.observers[0].fn();assert.equal(f.frames.size,0);f.layer.destroy();
});
test('bounded validation, stage dedupe and destroy release GPU resources/listeners exactly once',()=>{
 const f=fixture();assert.equal(rolling(f,'overflow',Array.from({length:33},()=>f.die())),false);assert.equal(f.calls.length,0);
 rolling(f,'good');f.layer.destroy();f.layer.destroy();assert.equal(f.reserved,0);assert.equal(f.frames.size,0);assert.equal(f.host.children.length,0);assert.equal(f.subscriptions.size,0);assert.equal(f.observers[0].disconnected,true);
 for(const map of f.maps)for(const listeners of map.values())assert.equal(listeners.size,0);
 assert.equal(f.calls.filter(c=>c.name==='deleteBuffer').length,2);assert.equal(f.calls.filter(c=>c.name==='deleteTexture').length,1);assert.equal(f.calls.filter(c=>c.name==='loseContext').length,1);assert.equal(rolling(f,'dead'),false);
});
test('offsetParent geometry avoids counting positioned body coordinates twice',()=>{
 const f=fixture(),die=f.die();die.anchor.offsetParent=f.host;die.anchor.offsetTop=170;
 f.layer.show({key:'geometry',stage:'result',dice:[die]});const center=f.calls.filter(c=>c.name==='uniform2f'&&c.args[0]==='u_center').at(-1).args;
 assert.equal(center[2],198);f.host.scrollTop=100;f.host.dispatch('scroll');const after=f.calls.filter(c=>c.name==='uniform2f'&&c.args[0]==='u_center').at(-1).args;
 assert.equal(after[2],98,'offset-parent content position follows local scroll');f.layer.destroy();
});
test('idle ResizeObserver is a no-op and rolling driver error query is not per-frame',()=>{
 const f=fixture();let checks=0;f.gl.getError=()=>{checks++;return 0;};rolling(f);f.tick(50);f.tick(50);assert.equal(checks,1);
 const dice=[f.die()];f.layer.show({key:'r',stage:'result',dice});const count=f.calls.filter(c=>c.name==='drawElements').length;
 f.observers[0].fn();f.observers[0].fn();assert.equal(f.calls.filter(c=>c.name==='drawElements').length,count);assert.equal(f.frames.size,0);f.layer.destroy();
});
test('failed renderer retires its GPU context before releasing the shared context slot',()=>{
 const f=fixture({link:false});rolling(f);const names=f.calls.map(c=>c.name);assert.ok(names.indexOf('loseContext')<names.indexOf('release'));assert.equal(f.reserved,0);
 f.event('webglcontextrestored');assert.equal(rolling(f,'later'),false);assert.equal(f.layer.getState().reason,'initialization-failed');f.layer.destroy();
});
test('cleared wide overlay cannot create scrollbars in the next smaller awaiting dialog',()=>{
 const f=fixture();rolling(f,'wide');assert.equal(f.canvas.style.width,'800px');f.layer.clear();assert.equal(f.canvas.style.display,'none');
 f.host.clientWidth=400;f.host.clientHeight=200;f.host.getBoundingClientRect=()=>({left:10,top:20,width:400,height:200});
 assert.equal(f.frames.size,0);assert.equal(f.canvas.style.display,'none','retained GPU backing does not participate in awaiting scroll geometry');
 assert.equal(rolling(f,'small'),true);assert.equal(f.canvas.style.width,'400px');assert.equal(f.canvas.style.height,'200px');assert.equal(f.canvas.style.display,'block');
 f.hide(true);assert.equal(f.canvas.style.display,'none');f.layer.destroy();
});
test('every rolling pose fits its face box with one pixel margin while the one-second clock stays unchanged',()=>{
 const f=fixture();rolling(f,'fit');for(let i=0;i<20;i++)f.tick(50);assert.equal(f.frames.size,0);
 const angles=f.calls.filter(c=>c.name==='uniform2f'&&c.args[0]==='u_angle'),sizes=f.calls.filter(c=>c.name==='uniform1f'&&c.args[0]==='u_size').filter((_,i)=>i%2===1);
 assert.equal(angles.length,21);assert.equal(sizes.length,21);
 for(let i=0;i<angles.length;i++){
  const [,ax,ay]=angles[i].args,size=sizes[i].args[1],sx=Math.sin(ax),cx=Math.cos(ax),sy=Math.sin(ay),cy=Math.cos(ay);
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
   const ry=y*cx-z*sx,rz=y*sx+z*cx,rx=x*cy+rz*sy,depth=5-(-x*sy+rz*cy);
   assert.ok(Math.abs(rx*size*4/depth)<=27.00001,`pose ${i} stays inside horizontal artwork box`);
   assert.ok(Math.abs(ry*size*4/depth)<=27.00001,`pose ${i} cannot cover the caption below its face`);
  }
 }
 assert.ok(sizes.some(c=>c.args[1]<24));assert.ok(Math.max(...sizes.map(c=>c.args[1]))-Math.min(...sizes.map(c=>c.args[1]))>1,'scale follows each silhouette instead of a fixed shrink factor');
 f.layer.show({key:'fit',stage:'result',dice:[f.die()]});assert.equal(f.calls.filter(c=>c.name==='uniform1f'&&c.args[0]==='u_size').at(-1).args[1],56*.46);assert.equal(f.frames.size,0);f.layer.destroy();
});
test('rounded ivory dice have curved corner normals and opaque faces over a bounded translucent shadow',()=>{
 const f=fixture();f.layer.show({key:'rounded',stage:'result',dice:[f.die()]});
 const data=f.calls.find(c=>c.name==='bufferSubData').args[2],corner=data.slice(0,3),normal=data.slice(3,6);
 assert.ok(corner.every(p=>Math.abs(p)<1),'rounded corner is inset from the old sharp cube');assert.ok(Math.abs(Math.hypot(...normal)-1)<.00001);assert.ok(normal.every(p=>Math.abs(p)>.5),'corner has a smooth diagonal normal');
 assert.ok(data.slice(40*8,40*8+3).some(p=>Math.abs(p)===1),'face center keeps full-size geometry');
 const draws=f.calls.filter(c=>c.name==='drawElements');assert.equal(draws.length,2);assert.equal(draws[0].args[1],6);assert.equal(draws[1].args[1],2304);assert.ok(draws[0].args[3]>0);assert.equal(draws[1].args[3],0);
 assert.deepEqual(f.calls.filter(c=>c.name==='depthMask').map(c=>c.args[0]),[false,true]);assert.equal(f.frames.size,0);assert.equal(f.calls.some(c=>c.name==='2d.strokeRect'),false,'physical bevel replaces the painted square border');f.layer.destroy();
});
