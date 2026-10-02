const CUSTOM_PERCENT_OPTIONS=[0,25,50,75,100];

function validCustomPercent(value){
 return value===null||CUSTOM_PERCENT_OPTIONS.includes(value);
}

// A percentage is a target for the current draw. If one source cannot fill its
// slots, use the other. Avoid repeating either source until the matching
// combined pool has been exhausted; never repeat within a draw.
function drawContent({builtin,custom,count,customPercent,usedIds,rng}){
 const selected=[],selectedIds=new Set(),used=new Set(usedIds);
 const pool=customPercent===0?builtin:[...builtin,...custom];
 const take=source=>{
  const available=source.filter(item=>!selectedIds.has(item.id)&&!used.has(item.id));
  if(!available.length)return null;
  const item=available[rng(available.length)];
  selected.push(item);selectedIds.add(item.id);used.add(item.id);
  return item;
 };
 const total=Math.min(count,new Set(pool.map(item=>item.id)).size);
 const customSlots=customPercent===null?0:Math.round(total*customPercent/100);
 for(let index=0;index<total;index++){
  const preferred=customPercent===null?pool:index<customSlots?custom:builtin;
  const fallback=customPercent===null||customPercent===0?[]:index<customSlots?builtin:custom;
  if(take(preferred)||take(fallback))continue;
  for(const item of pool)used.delete(item.id);
  for(const item of selected)used.add(item.id);
  if(!take(preferred))take(fallback);
 }
 if(customPercent!==null)for(let index=selected.length-1;index>0;index--){
  const other=rng(index+1);
  [selected[index],selected[other]]=[selected[other],selected[index]];
 }
 return {items:selected,usedIds:[...used]};
}

module.exports={CUSTOM_PERCENT_OPTIONS,validCustomPercent,drawContent};
