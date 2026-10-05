// Deterministic pixel fixture: exercises read/paint/checkpoint behaviour without a browser.
function rasterCanvas(width=32,height=16){
 const canvas={width,height,getBoundingClientRect:()=>({left:0,top:0,width,height})};
 const data=new Uint8ClampedArray(width*height*4),calls={reads:0,writes:0,paths:0};
 let points=[],ellipse=null;
 function rgba(color){color=color||'#000000';if(color.length===4)color='#'+[...color.slice(1)].map(c=>c+c).join('');return [parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16),255];}
 function pixel(x,y,color){x=Math.floor(x);y=Math.floor(y);if(x>=0&&y>=0&&x<width&&y<height)data.set(color,(y*width+x)*4);}
 function rectangle(x,y,w,h,color){for(let py=Math.max(0,Math.floor(y));py<Math.min(height,Math.ceil(y+h));py++)for(let px=Math.max(0,Math.floor(x));px<Math.min(width,Math.ceil(x+w));px++)pixel(px,py,color);}
 function line(a,b,color,size){const count=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))));for(let i=0;i<=count;i++){const x=a[0]+(b[0]-a[0])*i/count,y=a[1]+(b[1]-a[1])*i/count;rectangle(x-size/2,y-size/2,size,size,color);}}
 const context={canvas,calls,fillStyle:'#000000',strokeStyle:'#000000',lineWidth:1,
  save(){this.saved={fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth};},restore(){Object.assign(this,this.saved);},
  clearRect(x,y,w,h){rectangle(x,y,w,h,[0,0,0,0]);},fillRect(x,y,w,h){rectangle(x,y,w,h,rgba(this.fillStyle));},
  strokeRect(x,y,w,h){const color=rgba(this.strokeStyle);line([x,y],[x+w,y],color,this.lineWidth);line([x+w,y],[x+w,y+h],color,this.lineWidth);line([x+w,y+h],[x,y+h],color,this.lineWidth);line([x,y+h],[x,y],color,this.lineWidth);},
  beginPath(){points=[];ellipse=null;},moveTo(x,y){points=[[x,y]];},lineTo(x,y){points.push([x,y]);},
  ellipse(cx,cy,rx,ry){ellipse={cx,cy,rx,ry};},
  stroke(){calls.paths++;if(ellipse){const {cx,cy,rx,ry}=ellipse;for(let angle=0;angle<Math.PI*2;angle+=.04)pixel(cx+rx*Math.cos(angle),cy+ry*Math.sin(angle),rgba(this.strokeStyle));}else for(let i=1;i<points.length;i++)line(points[i-1],points[i],rgba(this.strokeStyle),this.lineWidth);},
  fill(){if(ellipse){const {cx,cy,rx,ry}=ellipse;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)pixel(x,y,rgba(this.fillStyle));}},
  getImageData(){calls.reads++;return {width,height,data:data.slice()};},
  putImageData(image){calls.writes++;data.set(image.data);},
 };
 canvas.getContext=()=>context;
 canvas.pixel=(x,y)=>[...data.slice((y*width+x)*4,(y*width+x)*4+4)];
 canvas.pixels=()=>data.slice();
 return canvas;
}
module.exports={rasterCanvas};
