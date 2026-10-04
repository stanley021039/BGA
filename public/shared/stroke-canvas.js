// Shared, deterministic canvas geometry used by the studio and live drawing game.
window.StrokeCanvas=(()=>{
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function pointFrom(event,canvas,width,height){
  const box=canvas.getBoundingClientRect();
  return [clamp(Math.floor((event.clientX-box.left)*width/box.width),0,width-1),clamp(Math.floor((event.clientY-box.top)*height/box.height),0,height-1)];
 }
 function drawStroke(ctx,stroke){
  const points=stroke.points;if(!points?.length)return;
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
 return {pointFrom,drawStroke,redraw};
})();
