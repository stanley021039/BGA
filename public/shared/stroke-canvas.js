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
 function fillRegion(source,output,x,y,color,tolerance=24){
  const {width,height,data}=source,seed=y*width+x,reference=seed*4;
  if(x<0||y<0||x>=width||y>=height)return 0;
  const visited=new Uint8Array(width*height),queue=new Int32Array(width*height);
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
   for(const next of [px>0?index-1:-1,px<width-1?index+1:-1,py>0?index-width:-1,py<height-1?index+width:-1]){
    if(next>=0&&!visited[next]){visited[next]=1;queue[tail++]=next;}
   }
  }
  return count;
 }
 function floodFill(ctx,point,color,alpha=255,source){
  source=source||ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
  const output=ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height);
  const rgba=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16));rgba.push(alpha);
  const count=fillRegion(source,output,point[0],point[1],rgba);ctx.putImageData(output,0,0);return count;
 }
 function pointFrom(event,canvas,width,height){
  const box=canvas.getBoundingClientRect();
  return [clamp(Math.floor((event.clientX-box.left)*width/box.width),0,width-1),clamp(Math.floor((event.clientY-box.top)*height/box.height),0,height-1)];
 }
 function drawStroke(ctx,stroke){
  const points=stroke.points;if(!points?.length)return;
  if(stroke.tool==='fill'){floodFill(ctx,points[0],stroke.color);return;}
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
 function strokeId(){
  if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
 }
 return {pointFrom,drawStroke,redraw,strokeId,fillRegion,floodFill,icons,iconMarkup};
})();
