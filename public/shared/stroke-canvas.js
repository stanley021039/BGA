// Shared, deterministic canvas geometry used by the studio and live drawing game.
window.StrokeCanvas=(()=>{
 const icons={
  brush:'<path d="m4 20 5-1 10-10-4-4L5 15l-1 5Z"/><path d="m13 7 4 4M5 15l4 4"/>',
  line:'<path d="M4 20 20 4"/>',
  rect:'<rect x="4" y="5" width="16" height="14"/>',
  rectFilled:'<rect x="4" y="5" width="16" height="14" fill="currentColor"/>',
  ellipse:'<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  ellipseFilled:'<ellipse cx="12" cy="12" rx="9" ry="7" fill="currentColor"/>',
  fill:'<path d="m3 13 8-8 8 8-8 7-8-7Z"/><path d="M5 11h12M9 7V3h4v4"/><path d="M21 14s-3 4-3 5a3 3 0 0 0 6 0c0-1-3-5-3-5Z" fill="currentColor"/>',
  pick:'<path d="m14 5 5 5M7 17l10-10 2 2L9 19H6v-3Z"/><path d="m16 5 2-2 3 3-2 2"/>',
  erase:'<path d="m3 15 10-10 8 7-8 8H8l-5-5Z"/><path d="m8 10 8 7M8 20h13"/>',
  undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  clear:'<path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3"/>'
 };
 function iconMarkup(key){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]||''}</svg>`;}
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 // Four-connected fill: disconnected regions with the same color stay unchanged.
 function fillRegion(source,output,x,y,color,tolerance=24,workspace){
  const {width,height,data}=source,seed=y*width+x,reference=seed*4;
  if(x<0||y<0||x>=width||y>=height)return 0;
  const length=width*height;
  const visited=workspace?.visited?.length===length?workspace.visited:new Uint8Array(length),queue=workspace?.queue?.length===length?workspace.queue:new Int32Array(length);
  visited.fill(0);
  if(workspace){workspace.visited=visited;workspace.queue=queue;}
  let head=0,tail=0,count=0;queue[tail++]=seed;visited[seed]=1;
  const matches=offset=>{
   if(Math.abs(data[offset+3]-data[reference+3])>tolerance)return false;
   for(let c=0;c<3;c++)if(Math.abs(data[offset+c]*data[offset+3]/255-data[reference+c]*data[reference+3]/255)>tolerance)return false;
   return true;
  };
  while(head<tail){
   const index=queue[head++],offset=index*4;if(!matches(offset))continue;
   output.data.set(color,offset);count++;
   const px=index%width,py=Math.floor(index/width);
   // No temporary neighbour array per pixel (a full fill visits 131,072 pixels).
   if(px>0&&!visited[index-1]){visited[index-1]=1;queue[tail++]=index-1;}
   if(px<width-1&&!visited[index+1]){visited[index+1]=1;queue[tail++]=index+1;}
   if(py>0&&!visited[index-width]){visited[index-width]=1;queue[tail++]=index-width;}
   if(py<height-1&&!visited[index+width]){visited[index+width]=1;queue[tail++]=index+width;}
  }
  return count;
 }
 const fillWorkspaces=new WeakMap();
 function floodFill(ctx,point,color,alpha=255,source){
  source=source||ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
  const output=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
  const rgba=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));rgba.push(alpha);
  let workspace=fillWorkspaces.get(ctx);if(!workspace){workspace={};fillWorkspaces.set(ctx,workspace);}
  const count=fillRegion(source,output,point[0],point[1],rgba,24,workspace);ctx.putImageData(output,0,0);return count;
 }
 function pointFrom(event,canvas,width,height){
  const box=canvas.getBoundingClientRect();
  return [clamp(Math.floor((event.clientX-box.left)*width/box.width),0,width-1),clamp(Math.floor((event.clientY-box.top)*height/box.height),0,height-1)];
 }
 function drawStroke(ctx,stroke){
  const points=stroke.points;if(!points?.length)return;
  if(stroke.tool==='fill')return floodFill(ctx,points[0],stroke.color);
  ctx.save();
  ctx.lineWidth=stroke.size;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=stroke.tool==='erase'?'#fff':stroke.color;
  ctx.fillStyle=ctx.strokeStyle;
  const [first,last]=[points[0],points.at(-1)];
  if(stroke.tool==='brush'||stroke.tool==='erase'||stroke.tool==='line'){
   ctx.beginPath();ctx.moveTo(first[0]+.5,first[1]+.5);
   if(points.length===1)ctx.lineTo(first[0]+.51,first[1]+.51);
   else for(const point of points.slice(1))ctx.lineTo(point[0]+.5,point[1]+.5);
   ctx.stroke();
  }else if(stroke.tool==='rect'){
   const x=Math.min(first[0],last[0]),y=Math.min(first[1],last[1]),w=Math.abs(last[0]-first[0]),h=Math.abs(last[1]-first[1]);
   if(stroke.filled)ctx.fillRect(x,y,Math.max(1,w),Math.max(1,h));else ctx.strokeRect(x+.5,y+.5,w,h);
  }else if(stroke.tool==='ellipse'){
   const cx=(first[0]+last[0])/2,cy=(first[1]+last[1])/2,rx=Math.max(.5,Math.abs(last[0]-first[0])/2),ry=Math.max(.5,Math.abs(last[1]-first[1])/2);
   ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);stroke.filled?ctx.fill():ctx.stroke();
  }
  ctx.restore();
 }
 function redraw(canvas,strokes,preview){
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const stroke of strokes)drawStroke(ctx,stroke);
  if(preview)drawStroke(ctx,preview);
 }
 // Live drawing keeps the painted prefix instead of replaying every fill on SSE.
 // Checkpoints are distributed by drawing cost, with a pinned mutable-tail base.
 // At 512x256 the default cache is <=8 MiB; recovery work is bounded by input limits.
 let yieldChannel=null,yieldQueue=[];
 function yieldToMain(){
  // MessageChannel remains usable in a background tab; rAF would pause recovery.
  if(typeof globalThis.MessageChannel==='function'){
   if(!yieldChannel){yieldChannel=new globalThis.MessageChannel();yieldChannel.port1.onmessage=()=>yieldQueue.shift()?.();}
   return new Promise(resolve=>{yieldQueue.push(resolve);yieldChannel.port2.postMessage(0);});
  }
  return new Promise(resolve=>setTimeout(resolve,0));
 }
 function createRenderer(canvas,options={}){
  const maxCheckpoints=options.maxCheckpoints??16,checkpointEvery=options.checkpointEvery??32;
  const maxStrokes=options.maxStrokes??1016,maxPoints=options.maxPoints??31024,maxFills=options.maxFills??49;
  if(!Number.isInteger(maxCheckpoints)||maxCheckpoints<2||maxCheckpoints>32||!Number.isInteger(checkpointEvery)||checkpointEvery<1)throw Error('Invalid canvas checkpoint limits');
  if(options.atomicPresentation)return createAtomicRenderer(canvas,options);
  if(options.separateMutable)return createMutableRenderer(canvas,options);
  const context=canvas.getContext('2d',options.contextAttributes);
  const retainedCheckpoints=maxCheckpoints-(options.reserveCanvasCheckpoint?1:0)-(options.reservePresentationCheckpoint?1:0);
  const yieldMain=options.yieldToMain||yieldToMain,now=()=>globalThis.performance?.now?.()??Date.now();
  let keys=[],costs=[0],checkpoints=[],revision=0,surfaceRevision=0,epoch=0,pendingRender=null;
  const stats={strokeApplications:0,fillApplications:0,filledPixels:0,restores:0,checkpointBytes:0,yields:0,cancelledRenders:0,maxBatchStrokes:0,maxBatchFills:0,maxBatchMs:0};
  function clear(){context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);surfaceRevision++;}
  function remember(index,pinned){
   if(!index||checkpoints.some(point=>point.index===index))return;
   const point={index,cost:costs[index],image:null};checkpoints.push(point);
   checkpoints.sort((a,b)=>a.index-b.index);
   while(checkpoints.length>retainedCheckpoints){
    let remove=-1,smallest=Infinity;
    for(let i=0;i<checkpoints.length-1;i++){
     if(checkpoints[i].index===pinned)continue;
     const gap=checkpoints[i+1].cost-(checkpoints[i-1]?.cost||0);
     if(gap<smallest){smallest=gap;remove=i;}
    }
    checkpoints.splice(remove<0?0:remove,1);
   }
   if(checkpoints.includes(point))point.image=context.getImageData(0,0,canvas.width,canvas.height);
   stats.checkpointBytes=checkpoints.length*canvas.width*canvas.height*4;
  }
  function plan(strokes,{keys:nextKeys,mutableFrom=strokes.length}={}){
   if(!Array.isArray(strokes)||strokes.length>maxStrokes)throw Error('Canvas stroke limit exceeded');
   let pointCount=0,fillCount=0;
   for(const stroke of strokes){
    if(!Array.isArray(stroke.points)||!stroke.points.length)throw Error('Invalid canvas stroke');
    pointCount+=stroke.points.length;if(stroke.tool==='fill')fillCount++;
   }
   if(pointCount>maxPoints||fillCount>maxFills)throw Error('Canvas work limit exceeded');
   nextKeys=nextKeys||strokes.map(stroke=>JSON.stringify(stroke));
   if(nextKeys.length!==strokes.length)throw Error('Invalid canvas keys');
   let common=0;while(common<keys.length&&common<nextKeys.length&&keys[common]===nextKeys[common])common++;
   const base=common<keys.length?checkpoints.filter(point=>point.index<=common).at(-1):null;
   return {strokes,nextKeys:nextKeys.slice(),mutableFrom,common,from:common<keys.length?(base?.index||0):common,base,unchanged:common===keys.length&&common===nextKeys.length};
  }
  function cancelPending(){
   if(pendingRender){pendingRender.cancelled=true;pendingRender.plan.strokes=null;pendingRender.plan.nextKeys=null;pendingRender=null;stats.cancelledRenders++;}
  }
  function begin(job){
   cancelPending();const token=++epoch;
   if(job.unchanged)return token;
   const {common,from,base}=job;
   if(common<keys.length){
    checkpoints=checkpoints.filter(point=>point.index<=common);
    if(base){context.putImageData(base.image,0,0);surfaceRevision++;}else clear();
    stats.restores++;
   }
   costs=costs.slice(0,from+1);keys=job.nextKeys.slice(0,from);
   stats.checkpointBytes=checkpoints.length*canvas.width*canvas.height*4;
   job.base=null;
   return token;
  }
  function paint(job,index){
    if(index===job.mutableFrom)remember(index,job.mutableFrom);
    const stroke=job.strokes[index],filledPixels=drawStroke(context,stroke)||0;surfaceRevision++;
    stats.strokeApplications++;
    if(stroke.tool==='fill'){stats.fillApplications++;stats.filledPixels+=filledPixels;}
    costs.push(costs[index]+(stroke.tool==='fill'?32:1));
    keys.push(job.nextKeys[index]);
    if(index<job.mutableFrom&&(stroke.tool==='fill'||(index+1)%checkpointEvery===0))remember(index+1,job.mutableFrom);
  }
  function renderPlan(job){
   begin(job);if(job.unchanged)return false;
   for(let index=job.from;index<job.strokes.length;index++)paint(job,index);
   revision++;return true;
  }
  function render(strokes,settings){return renderPlan(plan(strokes,settings));}
  function renderCooperatively(strokes,settings){
   const job=plan(strokes,settings);
   if(pendingRender&&job.mutableFrom===pendingRender.plan.mutableFrom&&job.nextKeys.length===pendingRender.plan.nextKeys.length&&job.nextKeys.every((key,index)=>key===pendingRender.plan.nextKeys[index]))return pendingRender.promise;
   let work=0;for(let index=job.from;index<strokes.length;index++)work+=strokes[index].tool==='fill'?32:1;
   if(job.unchanged||work<=32&&strokes.length-job.from<=16)return renderPlan(job);
   const token=begin(job);
   // Freeze mutable drafts, then retain only one recovery target when newer data arrives.
   job.strokes=strokes.map(stroke=>({...stroke,points:stroke.points.map(point=>point.slice())}));
   const current={plan:job,cancelled:false,promise:null};pendingRender=current;
   current.promise=(async()=>{
    let index=job.from;
    try{
     while(index<job.strokes.length){
      stats.yields++;await yieldMain();
      if(token!==epoch||current.cancelled)return false;
      const started=now();let batchCost=0,batchStrokes=0,batchFills=0;
      while(index<job.strokes.length){
       const cost=job.strokes[index].tool==='fill'?32:1;
       if(batchStrokes&&(batchCost+cost>32||batchStrokes>=16||now()-started>=8))break;
       paint(job,index++);batchCost+=cost;batchStrokes++;if(cost===32)batchFills++;
      }
      stats.maxBatchStrokes=Math.max(stats.maxBatchStrokes,batchStrokes);stats.maxBatchFills=Math.max(stats.maxBatchFills,batchFills);stats.maxBatchMs=Math.max(stats.maxBatchMs,now()-started);
     }
     revision++;return true;
    }finally{if(pendingRender===current)pendingRender=null;}
   })();
   return current.promise;
  }
  function whenIdle(){
   const promise=pendingRender?.promise;
   return promise?promise.then(whenIdle):Promise.resolve();
   }
  function reset(){cancelPending();epoch++;keys=[];costs=[0];checkpoints=[];stats.checkpointBytes=0;clear();revision++;}
  function metrics(){return {...stats,revision,surfaceRevision,checkpoints:checkpoints.length,strokes:keys.length,rendering:!!pendingRender,targetStrokes:pendingRender?.plan.strokes.length??keys.length};}
  clear();
  return {render,renderCooperatively,whenIdle,reset,metrics};
 }
 function createAtomicRenderer(canvas,options){
  const context=canvas.getContext('2d',options.contextAttributes),factory=options.createCanvas||((width,height)=>{const node=(canvas.ownerDocument||globalThis.document)?.createElement('canvas');if(!node)throw Error('An atomic canvas factory is required');node.width=width;node.height=height;return node;});
  const staging=factory(canvas.width,canvas.height);
  if(!staging||staging===canvas||typeof context.drawImage!=='function')throw Error('Independent atomic canvas support is required');
  staging.width=canvas.width;staging.height=canvas.height;
  // The complete canonical operation sequence stays on one persistent surface.
  // Visible pixels are copied only when that sequence finishes, never between yields.
  // Preserve the caller's creation intent. Reported default false is not the
  // same readback heuristic as omitting willReadFrequently in Chromium.
  const attributes=options.contextAttributes;
  staging.getContext('2d',attributes);
  const worker=createRenderer(staging,{...options,atomicPresentation:false,reservePresentationCheckpoint:true,contextAttributes:attributes});
  let generation=0,pending=null,presentationCopies=0,presentedSurfaceRevision=-1;
  function present(){context.save();context.setTransform?.(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='copy';context.drawImage(staging,0,0);context.restore();presentedSurfaceRevision=worker.metrics().surfaceRevision;presentationCopies++;}
  // A cancelled replay can leave staging at the new target without completing
  // a worker revision. Track pixel writes separately from the last visible copy.
  function presentIfNeeded(){if(worker.metrics().surfaceRevision===presentedSurfaceRevision)return false;present();return true;}
  function render(strokes,settings){worker.render(strokes,settings);generation++;pending=null;return presentIfNeeded();}
  function renderCooperatively(strokes,settings){
   const result=worker.renderCooperatively(strokes,settings);
   if(!result||typeof result.then!=='function'){generation++;pending=null;return presentIfNeeded();}
   if(pending?.source===result)return pending.promise;
   const job={source:result,generation:++generation,promise:null};pending=job;
   job.promise=result.then(()=>{if(pending!==job||job.generation!==generation)return false;return presentIfNeeded();}).finally(()=>{if(pending===job)pending=null;});
   return job.promise;
  }
  function whenIdle(){const promise=pending?.promise;return promise?promise.then(whenIdle):worker.whenIdle().then(()=>pending?whenIdle():undefined);}
  function reset(){worker.reset();generation++;pending=null;present();}
  function metrics(){const current=worker.metrics(),presentationBytes=staging.width*staging.height*4;return {...current,atomicPresentation:true,presentationBytes,presentationCopies,presentedSurfaceRevision,cachedBytes:(current.cachedBytes??current.checkpointBytes)+presentationBytes,rendering:!!pending||current.rendering};}
  present();return {render,renderCooperatively,whenIdle,reset,metrics};
 }
 function createMutableRenderer(canvas,options){
  const context=canvas.getContext('2d');
  const factory=options.createCanvas||((width,height)=>{const node=(canvas.ownerDocument||globalThis.document)?.createElement('canvas');if(!node)throw Error('A mutable canvas factory is required');node.width=width;node.height=height;return node;});
  const base=factory(canvas.width,canvas.height);
  if(!base||base===canvas||typeof context.drawImage!=='function')throw Error('Independent mutable canvas support is required');
  base.width=canvas.width;base.height=canvas.height;
  // Reserve one checkpoint-sized surface for this opaque base, preserving the
  // original total cache budget. Both contexts use the same creation hints.
  const prefix=createRenderer(base,{...options,separateMutable:false,reserveCanvasCheckpoint:true,contextAttributes:context.getContextAttributes?.()});
  const yieldMain=options.yieldToMain||yieldToMain,now=()=>globalThis.performance?.now?.()??Date.now();
  let keys=[],split=0,prefixRevision=-1,revision=0,surfaceRevision=0,epoch=0,pending=null,fallback=null,fillSensitive=false;
  const fallbackPast={strokeApplications:0,fillApplications:0,filledPixels:0,restores:0,yields:0,cancelledRenders:0,revision:0,surfaceRevision:0,maxBatchStrokes:0,maxBatchFills:0,maxBatchMs:0};
  const stats={mutableStrokeApplications:0,mutableFillApplications:0,mutableFilledPixels:0,baseCopies:0,mutableRebuilds:0,mutableLineTo:0,modeSwitches:0,yields:0,cancelledRenders:0,maxBatchStrokes:0,maxBatchFills:0,maxBatchMs:0};
  function plan(strokes,settings={}){
   if(!Array.isArray(strokes)||strokes.length>(options.maxStrokes??1016))throw Error('Canvas stroke limit exceeded');
   let points=0,fills=0;
   for(const stroke of strokes){if(!Array.isArray(stroke.points)||!stroke.points.length)throw Error('Invalid canvas stroke');points+=stroke.points.length;if(stroke.tool==='fill')fills++;}
   if(points>(options.maxPoints??31024)||fills>(options.maxFills??49))throw Error('Canvas work limit exceeded');
   const nextKeys=settings.keys||strokes.map(stroke=>JSON.stringify(stroke));if(nextKeys.length!==strokes.length)throw Error('Invalid canvas keys');
   const requested=Number.isInteger(settings.mutableFrom)?Math.max(0,Math.min(strokes.length,settings.mutableFrom)):strokes.length;
   // Only explicit local drafts need an isolated prefix. Accepted chunks and
   // completed scenes stay on the original visible drawing surface.
   return {strokes,nextKeys:nextKeys.slice(),split:requested};
  }
  function equal(job,otherKeys,otherSplit){return job.split===otherSplit&&job.nextKeys.length===otherKeys.length&&job.nextKeys.every((key,index)=>key===otherKeys[index]);}
  function discardFallback(){
   if(!fallback)return;
   fallback.reset();const previous=fallback.metrics();
   for(const key of Object.keys(fallbackPast))fallbackPast[key]=key.startsWith('max')?Math.max(fallbackPast[key],previous[key]):fallbackPast[key]+previous[key];
   fallback=null;
  }
  function useFallback(job){
   fillSensitive||=job.strokes.some(stroke=>stroke.tool==='fill');
   if(fillSensitive||job.split===job.strokes.length){
    if(!fallback){
     // Copying layered pixels into a settled scene can retain different native
     // antialiasing. Clear them and replay canonical strokes on this surface.
     cancel();epoch++;prefix.reset();keys=[];split=job.split;prefixRevision=-1;stats.modeSwitches++;
     fallback=createRenderer(canvas,{...options,separateMutable:false,reserveCanvasCheckpoint:true,contextAttributes:context.getContextAttributes?.()});
    }
    split=job.split;return fallback;
   }
   if(fallback){
    // Keep only one checkpoint cache. A fill-bearing epoch cannot return here
    // until reset, because fill necessarily reads the visible canvas pixels.
    cancel();epoch++;discardFallback();prefix.reset();keys=[];split=0;prefixRevision=-1;stats.modeSwitches++;
   }
   return null;
  }
  function cancel(){if(pending){pending.cancelled=true;pending.plan.strokes=null;pending.plan.nextKeys=null;pending=null;stats.cancelledRenders++;}}
  function copyBase(job){
   context.save();context.setTransform?.(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='copy';context.drawImage(base,0,0);context.restore();
   surfaceRevision++;stats.baseCopies++;stats.mutableRebuilds++;keys=job.nextKeys.slice(0,job.split);split=job.split;prefixRevision=prefix.metrics().revision;
  }
  function paint(job,index){
   const stroke=job.strokes[index],filled=drawStroke(context,stroke)||0;surfaceRevision++;stats.mutableStrokeApplications++;
   if(stroke.tool==='fill'){stats.mutableFillApplications++;stats.mutableFilledPixels+=filled;}
   if(['brush','erase','line'].includes(stroke.tool))stats.mutableLineTo+=Math.max(1,stroke.points.length-1);
   keys.push(job.nextKeys[index]);
  }
  function render(strokes,settings){
   const job=plan(strokes,settings),single=useFallback(job);if(single)return single.render(strokes,settings);
   cancel();epoch++;
   const changed=prefix.render(strokes.slice(0,job.split),{keys:job.nextKeys.slice(0,job.split)});
   if(!changed&&equal(job,keys,split)&&prefixRevision===prefix.metrics().revision)return false;
   copyBase(job);for(let index=job.split;index<strokes.length;index++)paint(job,index);revision++;return true;
  }
  function renderCooperatively(strokes,settings){
   const job=plan(strokes,settings),single=useFallback(job);if(single)return single.renderCooperatively(strokes,settings);
   if(pending&&equal(job,pending.plan.nextKeys,pending.plan.split))return pending.promise;
   const prefixResult=prefix.renderCooperatively(strokes.slice(0,job.split),{keys:job.nextKeys.slice(0,job.split)});
   let work=0;for(let index=job.split;index<strokes.length;index++)work+=strokes[index].tool==='fill'?32:1;
   const asynchronous=prefixResult&&typeof prefixResult.then==='function'||work>32||strokes.length-job.split>16;
   cancel();const token=++epoch;
   if(!asynchronous){
    if(!prefixResult&&equal(job,keys,split)&&prefixRevision===prefix.metrics().revision)return false;
    copyBase(job);for(let index=job.split;index<strokes.length;index++)paint(job,index);revision++;return true;
   }
   job.strokes=strokes.map(stroke=>({...stroke,points:stroke.points.map(point=>point.slice())}));
   const current={plan:job,cancelled:false,promise:null};pending=current;
   current.promise=(async()=>{
    try{
     if(prefixResult&&typeof prefixResult.then==='function')await prefixResult;
     if(current.cancelled||token!==epoch)return false;
     copyBase(job);let index=job.split;
     while(index<job.strokes.length){
      stats.yields++;await yieldMain();if(current.cancelled||token!==epoch)return false;
      const started=now();let cost=0,count=0,fills=0;
      while(index<job.strokes.length){const next=job.strokes[index].tool==='fill'?32:1;if(count&&(cost+next>32||count>=16||now()-started>=8))break;paint(job,index++);cost+=next;count++;if(next===32)fills++;}
      stats.maxBatchStrokes=Math.max(stats.maxBatchStrokes,count);stats.maxBatchFills=Math.max(stats.maxBatchFills,fills);stats.maxBatchMs=Math.max(stats.maxBatchMs,now()-started);
     }
     revision++;return true;
    }finally{if(pending===current)pending=null;}
   })();return current.promise;
  }
  function whenIdle(){
   const active=fallback,promise=active?active.whenIdle():pending?.promise;
   return promise?promise.then(()=>active!==fallback||pending?whenIdle():prefix.whenIdle()):prefix.whenIdle();
  }
  function reset(){
   cancel();epoch++;discardFallback();fillSensitive=false;
   prefix.reset();keys=[];split=0;prefixRevision=-1;context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);surfaceRevision++;revision++;
  }
  function metrics(){
   const baseStats=prefix.metrics(),single=fallback?.metrics(),layerBytes=canvas.width*canvas.height*4,history={};
   for(const key of Object.keys(fallbackPast))history[key]=key.startsWith('max')?Math.max(fallbackPast[key],single?.[key]||0):fallbackPast[key]+(single?.[key]||0);
   const checkpointBytes=baseStats.checkpointBytes+(single?.checkpointBytes||0);
   return {...baseStats,...stats,revision:revision+history.revision,surfaceRevision:surfaceRevision+history.surfaceRevision,strokeApplications:baseStats.strokeApplications+stats.mutableStrokeApplications+history.strokeApplications,fillApplications:baseStats.fillApplications+stats.mutableFillApplications+history.fillApplications,filledPixels:baseStats.filledPixels+stats.mutableFilledPixels+history.filledPixels,
    prefixStrokeApplications:baseStats.strokeApplications,prefixFillApplications:baseStats.fillApplications,fallbackStrokeApplications:history.strokeApplications,fallbackFillApplications:history.fillApplications,layerBytes,checkpointBytes,cachedBytes:checkpointBytes+layerBytes,checkpoints:baseStats.checkpoints+(single?.checkpoints||0),
    restores:baseStats.restores+history.restores,yields:baseStats.yields+stats.yields+history.yields,cancelledRenders:stats.cancelledRenders+history.cancelledRenders,prefixCancelledRenders:baseStats.cancelledRenders,maxBatchStrokes:Math.max(baseStats.maxBatchStrokes,stats.maxBatchStrokes,history.maxBatchStrokes),maxBatchFills:Math.max(baseStats.maxBatchFills,stats.maxBatchFills,history.maxBatchFills),maxBatchMs:Math.max(baseStats.maxBatchMs,stats.maxBatchMs,history.maxBatchMs),
    strokes:single?.strokes??keys.length,mutableFrom:split,rendering:!!pending||baseStats.rendering||!!single?.rendering,targetStrokes:single?.targetStrokes??pending?.plan.strokes?.length??keys.length,separateMutable:true,fallback:fillSensitive,mode:fallback?(fillSensitive?'canonical-fill':'canonical'):'layered'};
  }
  reset();return {render,renderCooperatively,whenIdle,reset,metrics};
 }
 function strokeId(){
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
 }
 return {pointFrom,drawStroke,redraw,createRenderer,strokeId,fillRegion,floodFill,icons,iconMarkup};
})();
