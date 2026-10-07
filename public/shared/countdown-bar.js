(function(){
 'use strict';
 // A functional countdown runs on the compositor; it does not schedule frame callbacks.
 function create(node,{now=()=>Date.now(),reducedMotion=()=>false}={}){
  let animation=null,current=null;
  function reset(){animation?.cancel();animation=null;current=null;}
  function sync({key,deadline,duration,offset=0,visible=true}){
   const end=deadline+offset,remaining=Math.max(0,end-now()),fraction=Math.max(0,Math.min(1,remaining/duration)),reduce=reducedMotion();
   if(!visible||!Number.isFinite(end)||!Number.isFinite(duration)||duration<=0){reset();node.style.transform='scaleX(0)';return;}
   const clockDrift=animation&&typeof animation.currentTime==='number'?Math.abs((now()-current.started)-animation.currentTime):0;
   if(animation&&current?.key===key&&current.duration===duration&&current.reduce===reduce&&Math.abs(current.end-end)<40&&clockDrift<100)return;
   reset();node.style.transform='scaleX('+fraction+')';current={key,end,duration,reduce,started:now()};
   if(remaining&&!reduce&&typeof node.animate==='function')animation=node.animate([{transform:'scaleX('+fraction+')'},{transform:'scaleX(0)'}],{duration:remaining,easing:'linear',fill:'forwards'});
  }
  return {sync,reset};
 }
 window.CountdownBar={create};
})();
