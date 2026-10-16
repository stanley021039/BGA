(function(root){
 'use strict';
 const types={ping:{label:'這裡',icon:'ping'},attention:{label:'注意',icon:'ping-attention'},question:{label:'疑問',icon:'ping-question'},help:{label:'幫忙',icon:'ping-help'},look:{label:'看這裡',icon:'ping-look'}};
 function pick(dx,dy,threshold=24){if(Math.hypot(dx,dy)<threshold)return 'ping';return Math.abs(dx)>Math.abs(dy)?dx>0?'look':'question':dy>0?'help':'attention';}
 function clamp(n,min,max){return Math.min(max,Math.max(min,n));}
 function point(rect,x,y){return {x:clamp((x-rect.left)/rect.width,0,1),y:clamp((y-rect.top)/rect.height,0,1)};}
 function place(rect,target,width,height){const x=rect.left+rect.width*target.x,y=rect.top+rect.height*target.y;return {x:clamp(x,32,width-32),y:clamp(y,48,height-48),edge:x<16||x>width-16||y<16||y>height-16,dx:x-width/2,dy:y-height/2};}
 const api={types,pick,point,place};if(typeof module==='object'&&module.exports)module.exports=api;else root.PingModel=api;
})(typeof window==='object'?window:globalThis);
