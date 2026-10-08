/* Short vehicle effects use separate SVG nodes; car placement and movement stay intact. */
((root)=>{
 const NS='http://www.w3.org/2000/svg';
 const position=(cell,min)=>cell&&Number.isInteger(cell.x)&&Number.isInteger(cell.y)?{x:48+(cell.y-min)*44+(cell.x%2)*22,y:81+cell.x*44}:null;
 const commandNames={nitro:'氮氣加速',drift:'甩尾',repair:'維修',airstrike:'空襲'};
 const motionNames={oil:'油漬滑移',skid:'失控打滑',glass:'玻璃滑移',slam:'碰撞推移',jump:'跳躍',blast:'爆炸拋飛',quake:'地震推移',dazed:'失控移動'};
 function describe(event){
  if(event.kind==='command'&&commandNames[event.command])return{type:event.command==='nitro'?'nitro':'command',car:event.command==='repair'&&event.target?event.target:event.car,name:commandNames[event.command],duration:event.command==='nitro'?Infinity:1600};
  if(event.kind==='assign')return{type:'assign',car:event.car,name:event.coast?'滑行':'前進',duration:1000};
  if(event.kind==='motion'&&motionNames[event.motion]){const skid=event.motion==='oil'||event.motion==='skid';return{type:skid?'skid':'command',car:event.car,name:motionNames[event.motion],duration:skid?1100:1600};}
  if(event.kind==='shot')return{type:'shot',car:event.source,name:event.air?'空襲射擊':'射擊',duration:1200};
  return null;
 }
 if(typeof module==='object'&&module.exports)module.exports={position,describe};
 if(!root.document)return;
 function mount(){
  const doc=root.document,records=new Map(),seen=new Set(),media=root.matchMedia?.('(prefers-reduced-motion: reduce)');let room=null,round=0,timer=null,destroyed=false,particleLayer=null;
  const svgNode=(name,attrs={})=>{const node=doc.createElementNS(NS,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
  function clean(record){
   for(const node of record.art||[])node.remove();
   for(const wrapper of record.wrappers||[]){const parent=wrapper.parentNode;if(parent){while(wrapper.firstChild)parent.insertBefore(wrapper.firstChild,wrapper);wrapper.remove();}}
   record.art=[];record.wrappers=[];record.labels=[];record.svg=null;
  }
  function discard(key,record){if(record.type==='nitro')particleLayer?.stop?.('vehicle:'+record.event.id);clean(record);records.delete(key);}
  function clear(){clearTimeout(timer);timer=null;for(const record of records.values())clean(record);records.clear();particleLayer?.clear();}
  function reset(){clear();seen.clear();room=null;round=0;particleLayer?.clear({resetSeen:true});}
  function remember(event){if(event.id===undefined||event.id===null)return false;const id=String(event.id);if(seen.has(id))return false;seen.add(id);while(seen.size>256)seen.delete(seen.values().next().value);return true;}
  const carNode=id=>Array.from(doc.querySelectorAll('#track g[data-car]')).find(node=>node.dataset.car===id);
  const carrier=node=>Array.from(node?.children||[]).find(child=>child.tagName?.toLowerCase()==='g');
  function updateParticleKinds(value={kinds:particleLayer?.getState()?.activeKinds||[]}){
   const kinds=Array.isArray(value.kinds)?value.kinds.filter(kind=>['nitro','smoke','sparks'].includes(kind)):[];
   doc.querySelector('#track svg')?.setAttribute('data-particle-kinds',kinds.join(' '));
  }
  function enhance(record,reduced,eventId=record.event.id){
   const first=eventId===record.event.id;
   if(reduced||first&&record.particlesAttempted||!root.GameFxLayer||!root.MotionPolicy?.allowsMotion()||doc.hidden)return;
   const kind=record.type==='nitro'?'nitro':record.type==='skid'?'smoke':record.type==='shot'&&record.event.hit!==false||['slam','glass','blast','quake'].includes(record.event.motion)?'sparks':null;
   if(!kind)return;
   const host=doc.querySelector('.race-stage'),board=doc.querySelector('#boardScroll');if(!host||!board)return;
   const anchor=()=>{
    if(destroyed||!records.has(String(record.event.id)))return null;
    const bounds=host.getBoundingClientRect(),clip=board.getBoundingClientRect(),svg=doc.querySelector('#track svg');if(!svg||!bounds.width||!bounds.height)return null;
    const id=record.type==='shot'?record.event.target:record.car,node=carrier(carNode(id));let point,thrust;
    if(node?.getScreenCTM){const m=node.getScreenCTM();if(m){point={x:m.e,y:m.f};if(kind==='nitro'&&Number.isFinite(m.a)&&Number.isFinite(m.b)){point={x:m.e-20*m.a,y:m.f-20*m.b};thrust={direction:Math.atan2(-m.b,-m.a),scale:Math.hypot(m.a,m.b)};}}}
    if(!point&&record.type==='shot'){
     const at=position(record.event.to,record.viewMin),m=svg.getScreenCTM?.();if(at&&m)point={x:m.a*at.x+m.c*at.y+m.e,y:m.b*at.x+m.d*at.y+m.f};
    }
    if(!point||point.x<clip.left||point.x>clip.right||point.y<clip.top||point.y>clip.bottom)return null;
    const canvas=host.querySelector('canvas.game-fx-layer');if(canvas)canvas.style.clipPath=`inset(${Math.max(0,clip.top-bounds.top)}px ${Math.max(0,bounds.right-clip.right)}px ${Math.max(0,bounds.bottom-clip.bottom)}px ${Math.max(0,clip.left-bounds.left)}px)`;
    return{x:point.x-bounds.left,y:point.y-bounds.top,...thrust};
   };
   if(!anchor())return;
   if(first)record.particlesAttempted=true;
   // The canonical SVG labels, projectile and movement always remain intact.
   try{particleLayer??=root.GameFxLayer.create(host,{onActivity:updateParticleKinds});particleLayer.play('vehicle:'+eventId,kind,anchor,{durationMs:kind==='nitro'?1400:900,count:kind==='nitro'?6:24,continuous:kind==='nitro',elapsedMs:first?Date.now()-record.start:0});}catch{}
  }
  function expireLabel(record){for(const node of record.labels||[])node.remove();record.labels=[];record.labelExpired=true;}
  function label(record,parent,at,location,reduced,svg){
   const bounds=svg.getBoundingClientRect?.(),view=svg.getAttribute('viewBox')?.split(/\s+/).map(Number),scale=bounds&&view?.[2]&&view?.[3]?Math.min(bounds.width/view[2],bounds.height/view[3]):1,fontSize=Math.ceil(Math.max(24,scale>0?14/scale:24));
   const width=Math.max(76,record.name.length*fontSize+20),center=location||at,x=Math.max(width/2+4,Math.min((view?.[2]||1180)-4-width/2,center?.x||0)),y=Math.max(fontSize+5,Math.min((view?.[3]||398)-13,(center?.y||0)-42)),dx=at?x:x-(center?.x||0),dy=at?y:y-(center?.y||0);
   const group=svgNode('g',{class:'race-vehicle-effect race-vehicle-label',transform:`translate(${dx},${dy})`,'aria-hidden':'true','data-reduced':String(reduced)});
   group.append(svgNode('rect',{x:-width/2,y:-fontSize-1,width,height:fontSize+10,rx:7}));const text=svgNode('text',{x:0,y:0,'text-anchor':'middle'});text.style.setProperty('font-size',fontSize+'px');text.textContent=record.name;group.append(text);parent.append(group);record.art.push(group);record.labels.push(group);
  }
  function render(record,state,svg,min,now){
   const event=record.event,car=state.cars?.find(car=>car.id===record.car),node=carNode(record.car),body=carrier(node),reduced=!!media?.matches||root.MotionPolicy?.get().enabled===false;
   if(record.type!=='shot'&&(!body||car?.x===null))return false;
   const from=position(event.from,min)||position(state.cars?.find(car=>car.id===event.source),min),to=position(event.to,min)||position(state.cars?.find(car=>car.id===event.target),min);
   if(record.type==='shot'&&(!from||!to))return false;
   if(record.start===null)record.start=now;if(now-record.start>=record.duration)return false;
   if(!record.labelExpired&&now-record.start>=1600)expireLabel(record);
   record.viewMin=min;enhance(record,reduced);
   if(record.svg===svg)return true;
   clean(record);record.svg=svg;
   const delay=-(now-record.start)+'ms';
   if(!record.labelExpired){if(body)label(record,body,null,position(car,min),reduced,svg);else if(from)label(record,svg,from,null,reduced,svg);}
   if(record.type==='nitro'&&!reduced){
    const flame=svgNode('g',{class:'race-vehicle-effect race-vehicle-exhaust','aria-hidden':'true'});flame.style.setProperty('--vehicle-effect-delay',delay);
    flame.append(svgNode('path',{class:'race-vehicle-flame-outer',d:'M-20,-9 Q-35,-10 -62,0 Q-36,11 -20,9 L-27,0Z'}),svgNode('path',{class:'race-vehicle-flame-inner',d:'M-22,-5 Q-34,-6 -47,0 Q-33,7 -22,5Z'}));body.insertBefore(flame,body.firstChild);record.art.push(flame);
   }
   if(record.type==='skid'&&!reduced){
    const graphics=Array.from(body.children).find(child=>child.tagName?.toLowerCase()==='g'&&!child.classList.contains('race-vehicle-effect'));
    if(graphics){const wrapper=svgNode('g',{class:'race-vehicle-skid-wrapper'});wrapper.style.setProperty('--vehicle-effect-delay',delay);body.insertBefore(wrapper,graphics);wrapper.append(graphics);record.wrappers.push(wrapper);}
    const marks=svgNode('g',{class:'race-vehicle-effect race-vehicle-skid-marks','aria-hidden':'true'});marks.append(svgNode('path',{d:'M-32,-14q-12,-8 -24,0m24,28q-12,8 -24,0'}));body.insertBefore(marks,body.firstChild);record.art.push(marks);
   }
   if(record.type==='shot'){
    const group=svgNode('g',{class:'race-vehicle-effect race-vehicle-projectile','aria-hidden':'true','data-reduced':String(reduced)});group.style.setProperty('--vehicle-effect-delay',delay);
    group.append(svgNode('line',{class:'race-vehicle-shot-trail',x1:from.x,y1:from.y,x2:to.x,y2:to.y}));
    if(!reduced){const bullet=svgNode('g',{class:'race-vehicle-shot-bullet'});for(const [key,value]of Object.entries({'--shot-from-x':from.x+'px','--shot-from-y':from.y+'px','--shot-to-x':to.x+'px','--shot-to-y':to.y+'px'}))bullet.style.setProperty(key,value);bullet.append(svgNode('circle',{r:4}),svgNode('circle',{r:9,class:'race-vehicle-bullet-glow'}));group.append(bullet);}
    group.append(svgNode('circle',{class:'race-vehicle-shot-hit'+(event.hit===false?' is-miss':''),cx:to.x,cy:to.y,r:15}));svg.append(group);record.art.push(group);
   }
   return true;
  }
  function expire(){timer=null;const now=Date.now();for(const [key,record]of records)if(record.start!==null){if(now-record.start>=record.duration){clean(record);records.delete(key);}else if(now-record.start>=1600)expireLabel(record);}schedule();}
  function schedule(){clearTimeout(timer);timer=null;const ends=[];for(const record of records.values())if(record.start!==null){if(Number.isFinite(record.duration))ends.push(record.start+record.duration);else if(!record.labelExpired)ends.push(record.start+1600);}if(ends.length)timer=setTimeout(expire,Math.max(1,Math.min(...ends)-Date.now()));}
  function show(events=[],state,{min=state?.tiles?.[0]?.start||0}={}){
   if(destroyed||!state)return;
   if(room!==state.code||state.round<round){reset();room=state.code;}round=state.round||0;
   for(const event of events)if(remember(event)){const effect=describe(event);if(!effect)continue;for(const [key,old]of records)if(old.car===effect.car){if(old.type===effect.type||old.type==='assign')discard(key,old);else expireLabel(old);}records.set(String(event.id),{...effect,event,start:null,art:[],wrappers:[],labels:[],labelExpired:false,svg:null,round});}
   if(doc.hidden){clear();return;}
   const svg=doc.querySelector('#track svg');if(!svg)return;
   const now=Date.now();
   for(const [key,record]of records){
    const car=state.cars?.find(car=>car.id===record.car),garage=car?.x===null&&['nitro','command','assign'].includes(record.type);
    if(record.type==='nitro'&&(state.active?.car!==record.car||state.phase!=='move')){discard(key,record);continue;}
    if(garage&&(record.round!==round||state.active?.car!==record.event.car)){discard(key,record);continue;}
    if(!render(record,state,svg,min,now)&&!garage)discard(key,record);
   }
   updateParticleKinds();schedule();
  }
  const visibility=()=>{if(doc.hidden)clear();},preference=()=>clear(),leave=()=>{clear();particleLayer?.destroy();particleLayer=null;};doc.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',preference);root.addEventListener?.('pagehide',leave);
  const unsubscribe=root.MotionPolicy?.subscribe(()=>{if(!root.MotionPolicy.allowsMotion())clear();});
  return{show,reset,particleState:()=>particleLayer?.getState()||{available:false,reason:'not-needed',effects:0,frameScheduled:false},destroy(){reset();destroyed=true;particleLayer?.destroy();particleLayer=null;unsubscribe?.();doc.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',preference);root.removeEventListener?.('pagehide',leave);}};
 }
 root.RaceVehicleEffects={mount};
})(typeof window==='object'?window:globalThis);
