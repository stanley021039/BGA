(function(){
 'use strict';
 // The accepted canvas is immutable; only live presentation follows the input clock.
 function create({now=()=>performance.now(),requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,onFrame=()=>{},maxLead=450,catchupLead=180}={}){
  let queue=[],head=0,shown=new Map(),timelines=new Map(),origins=new Map(),frame=null,tail=0;
  function schedule(){if(frame===null&&head<queue.length)frame=requestFrame(tick);}
  function tick(){
   frame=null;const clock=now();let changed=false;
   while(head<queue.length&&queue[head].due<=clock){const sample=queue[head++];shown.set(sample.version,sample.count);if(sample.count===sample.length){shown.delete(sample.version);timelines.delete(sample.version);}changed=true;}
   if(head===queue.length){queue=[];head=0;}
   // A known next point is interpolated each frame, including intervals with no new packet.
   if(changed||[...shown.values()].some(count=>count>0))onFrame();schedule();
  }
  function reset(){if(frame!==null)cancelFrame(frame);frame=null;queue=[];head=0;shown.clear();timelines.clear();origins.clear();tail=0;}
  function finish({notify=true}={}){const changed=shown.size>0;reset();if(changed&&notify)onFrame();return changed;}
  function catchUp(clock){
   if(tail-clock<=maxLead)return;
   const scale=Math.min(1,Math.max(0,catchupLead)/Math.max(1,tail-clock));
   const adjust=due=>due>clock?clock+(due-clock)*scale:due;
   for(let i=head;i<queue.length;i++)queue[i].due=adjust(queue[i].due);
   for(const timeline of timelines.values())for(let i=0;i<timeline.length;i++)timeline[i]=adjust(timeline[i]);
   for(const origin of origins.values())origin.due=adjust(origin.due);
   tail=adjust(tail);
  }
  function add(stroke){
   if(!['brush','erase'].includes(stroke.tool)){finish({notify:false});return false;}
   const clock=now(),times=stroke.pointTimes,previous=origins.get(stroke.strokeId),length=stroke.points.length;
   // Keep one clock across batches. Late arrivals must not add another receive-time delay.
   const gap=previous&&times?Math.min(1000,Math.max(0,times[0]-previous.time)):0;
   let due=previous?Math.max(tail,previous.due+gap):Math.max(clock+60,tail);
   if(head){queue=queue.slice(head);head=0;}
   shown.set(stroke.version,0);const timeline=[];timelines.set(stroke.version,timeline);
   for(let i=0;i<length;i++){
    due+=i?Math.min(1000,times?Math.max(0,times[i]-times[i-1]):4):0;
    timeline.push(due);queue.push({version:stroke.version,count:i+1,length,due});
   }
   tail=due;origins.set(stroke.strokeId,{time:times?.at(-1)??0,due});catchUp(clock);schedule();return true;
  }
  function view(stroke){
   const count=shown.get(stroke.version);if(count===undefined)return stroke;if(!count)return null;
   const timeline=timelines.get(stroke.version),span=timeline[count]-timeline[count-1];
   const fraction=span>0?Math.max(0,Math.min(1,(now()-timeline[count-1])/span)):0;
   const points=stroke.points.slice(0,count);
   if(fraction>0&&count<stroke.points.length){const a=stroke.points[count-1],b=stroke.points[count];points.push([a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction]);}
   return {...stroke,points,playbackCount:count+fraction};
  }
  return {add,view,reset,finish,metrics:()=>({pendingSamples:queue.length-head,pendingEntries:shown.size,leadMs:Math.max(0,tail-now()),scheduled:frame!==null})};
 }
 window.DrawPlayback={create};
})();
