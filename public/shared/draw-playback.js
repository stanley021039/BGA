(function(){
 'use strict';
 // Authoritative strokes stay untouched. Only the live observer's presentation is paced.
 function create({now=()=>performance.now(),requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame,onFrame=()=>{},maxLead=900}={}){
  let queue=[],head=0,shown=new Map(),origins=new Map(),frame=null,tail=0;
  function schedule(){if(frame===null&&head<queue.length)frame=requestFrame(tick);}
  function tick(){
   frame=null;const clock=now();let changed=false;
   while(head<queue.length&&queue[head].due<=clock){const sample=queue[head++];shown.set(sample.version,sample.count);if(sample.count===sample.length)shown.delete(sample.version);changed=true;}
   if(head===queue.length){queue=[];head=0;}
   if(changed)onFrame();schedule();
  }
  function reset(){if(frame!==null)cancelFrame(frame);frame=null;queue=[];head=0;shown.clear();origins.clear();tail=0;}
  function finish({notify=true}={}){const changed=shown.size>0;reset();if(changed&&notify)onFrame();return changed;}
  function add(stroke){
   if(!['brush','erase'].includes(stroke.tool)){finish({notify:false});return false;}
   const clock=now();if(tail-clock>maxLead)finish({notify:false});
   const times=stroke.pointTimes,previous=origins.get(stroke.strokeId),length=stroke.points.length;
   // A repeated batch anchor keeps its original time; old senders get a short progressive replay.
   const gap=previous&&times?Math.max(0,times[0]-previous.time):0;
   let start=Math.max(clock+(previous?0:60),tail,previous?previous.due+Math.min(300,gap,Math.max(0,clock+maxLead-previous.due)):0);
   const deltas=stroke.points.map((_,i)=>i?Math.min(300,times?times[i]-times[i-1]:4):0);
   const span=deltas.reduce((sum,value)=>sum+value,0),budget=Math.max(0,Math.min(700,clock+maxLead-start)),scale=span?Math.min(1,budget/span):1;
   if(head){queue=queue.slice(head);head=0;}shown.set(stroke.version,0);
   for(let i=0;i<length;i++){start+=deltas[i]*scale;queue.push({version:stroke.version,count:i+1,length,due:start});}
   tail=start;origins.set(stroke.strokeId,{time:times?.at(-1)??0,due:start});schedule();return true;
  }
  function view(stroke){const count=shown.get(stroke.version);if(count===undefined)return stroke;if(!count)return null;return {...stroke,points:stroke.points.slice(0,count),playbackCount:count};}
  return {add,view,reset,finish,metrics:()=>({pendingSamples:queue.length-head,pendingEntries:shown.size,leadMs:Math.max(0,tail-now()),scheduled:frame!==null})};
 }
 window.DrawPlayback={create};
})();
