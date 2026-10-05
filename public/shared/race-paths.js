(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.RacePaths=factory();
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const MAX_POINTS=16,MAX_STATES=3000;
 const key=(x,y)=>x+':'+y;
 function front(x,y){const shift=x%2?1:0;return [{x:x-1,y:y+shift},{x,y:y+1},{x:x+1,y:y+shift}].filter(v=>v.x>=0&&v.x<6);}
 function kind(cell){return cell?.hazard?.face?({road:'R',oil:'R',mud:'M',glass:'V',ramp:'J',fire:'F',pit:'X'}[cell.hazard.kind]||cell.kind):cell?.kind;}
 // Only public/masked cells are accepted: the contents of an unrevealed hazard
 // must not influence either the preview or the server's selected route.
 function routes(s){
  const car=s.cars?.find(c=>c.id===s.active?.car),points=s.active?.remaining;
  if(s.phase!=='move'||s.pending||s.diceCheck||!car||car.dead||!Number.isInteger(points)||points<1||points>MAX_POINTS||!Array.isArray(s.tiles)||!s.tiles.length||s.tiles.length>3)return new Map();
  const min=s.tiles[0].start,max=s.tiles.at(-1).start+8,cells=new Map(),occupied=new Set(),helicopters=new Set();
  for(const tile of s.tiles)for(let x=0;x<6;x++)for(let j=0;j<8;j++)cells.set(key(x,tile.start+j),tile.cells?.[x]?.[j]);
  for(const c of s.cars)if(!c.dead&&c.id!==car.id&&c.x!==null)occupied.add(key(c.x,c.y));
  for(const p of s.players||[])if(p.chopper)helicopters.add(key(p.chopper.x,p.chopper.y));
  const best=new Map(),states=new Map(),queue=[{x:car.x,y:car.y,cost:0,risk:0,path:[],warnings:[]}];
  const rank=(a,b)=>a.risk-b.risk||a.cost-b.cost||a.path.length-b.path.length;
  let processed=0;
  while(queue.length&&processed++<MAX_STATES){
   queue.sort(rank);const current=queue.shift();
   if(current.path.length&&states.get(key(current.x,current.y)+':'+current.cost)!==current)continue;
   const next=current.x===null?Array.from({length:6},(_,x)=>({x,y:0})):front(current.x,current.y);
   for(const cellPos of next){
    const {x,y}=cellPos;if(y<min||y>max)continue;
    const id=key(x,y),cell=cells.get(id),k=kind(cell),boundary=y===max;
    if(!cell&&!boundary)continue;
    const terrainCost=k==='M'?2:1,cost=current.cost+Math.min(terrainCost,points-current.cost);
    if(cost>points)continue;
    const hidden=!!cell?.hazard&&!cell.hazard.face,blocked=occupied.has(id),heli=helicopters.has(id);
    const effect=cell?.hazard?.face&&!['road','mud'].includes(cell.hazard.kind);
    const terminal=boundary||blocked||['X','G','V','J'].includes(k)||effect;
    const warnings=[...current.warnings];
    if(hidden&&!warnings.includes('未知危險'))warnings.push('未知危險');
    if(blocked)warnings.push('進入車輛格，依碰撞／甩尾規則結算');
    if(heli)warnings.push('停在直升機下方會淘汰');
    if(k==='X')warnings.push('岩壁／陷阱會淘汰');
    else if(['G','V','J'].includes(k)||effect)warnings.push('地形效果會中斷路線');
    else if(k==='F')warnings.push('火焰會使車輛著火');
    if(boundary)warnings.push(s.finishAt!==null?'抵達終點':'新路段將重新選路');
    const risk=current.risk+(k==='X'?1000:blocked?120:heli?100:terminal&&!boundary?60:hidden?25:k==='F'?12:k==='M'?4:k==='O'?1:0);
    const route={x,y,cost,risk,path:[...current.path,{x,y}],warnings};
    if(!best.has(id)||rank(route,best.get(id))<0)best.set(id,route);
    const stateKey=id+':'+cost;
    // Stable front-left/front/front-right order breaks identical scores.
    if(!terminal&&cost<points&&(!states.has(stateKey)||rank(route,states.get(stateKey))<0)){
     states.set(stateKey,route);queue.push(route);
    }
   }
  }
  return best;
 }
 return {routes,key,MAX_POINTS,MAX_STATES};
});
