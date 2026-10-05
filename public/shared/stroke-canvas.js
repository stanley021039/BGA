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
 function createRenderer(canvas,options={}){
  const maxCheckpoints=options.maxCheckpoints??16,checkpointEvery=options.checkpointEvery??32;
  const maxStrokes=options.maxStrokes??1016,maxPoints=options.maxPoints??31024,maxFills=options.maxFills??49;
  if(!Number.isInteger(maxCheckpoints)||maxCheckpoints<2||maxCheckpoints>32||!Number.isInteger(checkpointEvery)||checkpointEvery<1)throw Error('Invalid canvas checkpoint limits');
  const context=canvas.getContext('2d');
  let keys=[],costs=[0],checkpoints=[],revision=0;
  const stats={strokeApplications:0,fillApplications:0,filledPixels:0,restores:0,checkpointBytes:0};
  function clear(){context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}
  function remember(index,pinned){
   if(!index||checkpoints.some(point=>point.index===index))return;
   const point={index,cost:costs[index],image:null};checkpoints.push(point);
   checkpoints.sort((a,b)=>a.index-b.index);
   while(checkpoints.length>maxCheckpoints){
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
  function render(strokes,{keys:nextKeys,mutableFrom=strokes.length}={}){
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
   if(common===keys.length&&common===nextKeys.length)return false;
   let from=common;
   if(common<keys.length){
    checkpoints=checkpoints.filter(point=>point.index<=common);
    const base=checkpoints.at(-1);
    if(base){context.putImageData(base.image,0,0);from=base.index;}else{clear();from=0;}
    stats.restores++;
   }
   costs=costs.slice(0,from+1);
   for(let index=from;index<strokes.length;index++){
    if(index===mutableFrom)remember(index,mutableFrom);
    const stroke=strokes[index],filledPixels=drawStroke(context,stroke)||0;
    stats.strokeApplications++;
    if(stroke.tool==='fill'){stats.fillApplications++;stats.filledPixels+=filledPixels;}
    costs.push(costs[index]+(stroke.tool==='fill'?32:1));
    if(index<mutableFrom&&(stroke.tool==='fill'||(index+1)%checkpointEvery===0))remember(index+1,mutableFrom);
   }
   keys=nextKeys.slice();revision++;
   stats.checkpointBytes=checkpoints.length*canvas.width*canvas.height*4;
   return true;
  }
  function reset(){keys=[];costs=[0];checkpoints=[];stats.checkpointBytes=0;clear();revision++;}
  function metrics(){return {...stats,revision,checkpoints:checkpoints.length,strokes:keys.length};}
  clear();
  return {render,reset,metrics};
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
