/* Replay confirmed movement locally; never advance game rules or send steps. */
((root)=>{
 'use strict';
 const STEP_MS=240,MAX_POINTS=65;
 const cell=value=>value&&Number.isInteger(value.x)&&value.x>=0&&value.x<6&&Number.isInteger(value.y)?{x:value.x,y:value.y}:null;
 const same=(a,b)=>a?.x===b?.x&&a?.y===b?.y;
 const position=(point,min)=>({x:48+(point.y-min)*44+(point.x%2)*22,y:81+point.x*44});
 function mount({document:doc=root.document,policy=root.MotionPolicy,now=()=>root.performance.now()}={}){
  const records=new Map(),seen=new Set();let room=null,destroyed=false;
  function detach(record){if(record.animation){record.animation.onfinish=null;record.animation.cancel();record.animation=null;}record.node=null;}
  function clear(){for(const record of records.values())detach(record);records.clear();}
  function reset(){clear();seen.clear();room=null;}
  function remember(event){if(event.id===undefined||event.id===null)return false;const id=String(event.id);if(seen.has(id))return false;seen.add(id);while(seen.size>256)seen.delete(seen.values().next().value);return true;}
  function add(id,cells,car,time){
   if(cells.length<2||cells.length>MAX_POINTS)return;
   const previous=records.get(id);
   if(previous&&time<previous.start+previous.duration&&same(previous.cells.at(-1),cells[0])&&previous.cells.length+cells.length-1<=MAX_POINTS){
    previous.cells.push(...cells.slice(1));previous.duration=(previous.cells.length-1)*STEP_MS;previous.car={...car};return;
   }
   if(previous)detach(previous);
   records.set(id,{cells,car:{...car},start:time,duration:(cells.length-1)*STEP_MS,animation:null,node:null});
  }
  function prepare(state,events=[],moves=[],{live=false}={}){
   if(destroyed)return;
   if(room!==state.code){reset();room=state.code;}
   const time=now(),fresh=events.filter(remember);
   if(!live||doc.hidden||!policy.allowsMotion()||state.phase==='waiting'){clear();return;}
   for(const [id,record]of records){if(time>=record.start+record.duration){detach(record);records.delete(id);}else detach(record);}
   const cars=new Map(state.cars.map(car=>[car.id,car])),pathCars=new Set();
   for(const event of fresh){
    const car=cars.get(event.car);
    if(event.kind!=='movePath'||!car||car.dead||!Array.isArray(event.steps)||!event.steps.length||event.steps.length>16)continue;
    const steps=event.steps.map(cell),to=cell(event.to);
    if(steps.some(point=>!point)||!to)continue;
    // Garage entry has no board coordinates. Slide in through the first lane's
    // entrance, then visit every confirmed step, including an interrupted route.
    const from=cell(event.from)||(event.from?.x===null?{x:steps[0].x,y:steps[0].y-1}:null);
    if(!from)continue;
    const cells=[from,...steps];if(!same(cells.at(-1),to))cells.push(to);
    add(car.id,cells,car,time);pathCars.add(car.id);
   }
   for(const movement of moves){
    if(pathCars.has(movement.to.id))continue;
    const from=cell(movement.from),to=cell(movement.to);if(from&&to&&!same(from,to))add(movement.to.id,[from,to],movement.to,time);
   }
   // State remains authoritative. Do not finish a stale path after the car was
   // eliminated, moved by another effect, or changed rooms.
   for(const [id,record]of records){const car=cars.get(id);if(!car||car.dead||!same(record.cells.at(-1),car)){detach(record);records.delete(id);}}
  }
  function attach(svg,min){
   if(destroyed||!svg||doc.hidden||!policy.allowsMotion()){clear();return;}
   const nodes=new Map(Array.from(svg.querySelectorAll('.map-car')).map(node=>[node.dataset.car,node]));
   for(const [id,record]of records){
    const elapsed=Math.max(0,now()-record.start);if(elapsed>=record.duration){records.delete(id);continue;}
    const node=nodes.get(id)?.querySelector('.race-car-motion');if(!node)continue;
    const final=position(record.cells.at(-1),min),frames=record.cells.map((point,index)=>{const p=position(point,min);return {transform:'translate('+(p.x-final.x)+'px,'+(p.y-final.y)+'px)',offset:index/(record.cells.length-1),easing:'ease-in-out'};});
    const animation=policy.animate(node,frames,{duration:record.duration,easing:'linear',fill:'both'});if(!animation)continue;
    // A presence/poll redraw replaces SVG nodes. Restore elapsed time in this
    // same task, before paint, rather than replaying or snapping to the last cell.
    animation.currentTime=elapsed;record.animation=animation;record.node=node;
    animation.onfinish=()=>{if(records.get(id)!==record||record.animation!==animation)return;record.animation=null;records.delete(id);animation.cancel();};
   }
  }
  const visibility=()=>{if(doc.hidden)clear();},unsubscribe=policy.subscribe(()=>{if(!policy.allowsMotion())clear();});
  doc.addEventListener('visibilitychange',visibility);
  return {prepare,attach,reset,destroy(){reset();destroyed=true;unsubscribe?.();doc.removeEventListener('visibilitychange',visibility);}};
 }
 const api={mount,STEP_MS};if(typeof module==='object'&&module.exports)module.exports=api;else root.RaceMovement=api;
})(typeof window==='object'?window:globalThis);
