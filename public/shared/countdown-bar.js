(function(){
 'use strict';
 // Prefer the compositor; older browsers retain a continuous frame-based fallback.
 function create(node,{now=()=>Date.now(),reducedMotion=()=>false}={}){
  let animation=null,current=null,frame=null;
  function reset(){animation?.cancel();animation=null;if(frame!==null)cancelAnimationFrame(frame);frame=null;current=null;}
  function paintFallback(){
   frame=null;if(!current)return;
   const remaining=Math.max(0,current.end-now()),fraction=Math.max(0,Math.min(1,remaining/current.duration));
   node.style.transform='scaleX('+fraction+')';
   if(remaining)frame=requestAnimationFrame(paintFallback);
  }
  function sync({key,deadline,duration,offset=0,visible=true}){
   const end=deadline+offset,remaining=Math.max(0,end-now()),fraction=Math.max(0,Math.min(1,remaining/duration)),reduce=reducedMotion();
   if(!visible||!Number.isFinite(end)||!Number.isFinite(duration)||duration<=0){reset();node.style.transform='scaleX(0)';return;}
   const clockDrift=animation&&typeof animation.currentTime==='number'?Math.abs((now()-current.started)-animation.currentTime):0;
   const running=(animation&&animation.playState!=='idle'&&animation.playState!=='paused')||frame!==null;
   if(running&&current?.key===key&&current.duration===duration&&current.reduce===reduce&&Math.abs(current.end-end)<40&&clockDrift<100)return;
   reset();node.style.transform='scaleX('+fraction+')';current={key,end,duration,reduce,started:now()};
   if(remaining&&!reduce){
    if(typeof node.animate==='function')animation=node.animate([{transform:'scaleX('+fraction+')'},{transform:'scaleX(0)'}],{duration:remaining,easing:'linear',fill:'forwards'});
    else if(typeof requestAnimationFrame==='function')frame=requestAnimationFrame(paintFallback);
   }
  }
  return {sync,reset};
 }
 window.CountdownBar={create};
})();
