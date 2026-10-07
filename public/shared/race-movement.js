/* Present confirmed displacements in order. Rules and polling never wait here. */
((root)=>{
 'use strict';
 const STEP_MS=240,PAN_MS=480,EVENT_MS=1600,ROAD_EVENT_MS=3200,MAX_GROUPS=128;
 const cueKinds=new Set(['glass','hazard','damage','fire','shot','trap','eliminated','road','slam','jump','quake','fireDie','airstrike']);
 const automaticKinds=new Set(['glass','hazard','damage','fire','shot','trap','eliminated','road']);
 const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&Math.abs(p.x)<=64&&Math.abs(p.y)<=1000000?{x:p.x,y:p.y}:null;
 const same=(a,b)=>a?.x===b?.x&&a?.y===b?.y;
 const position=(p,min)=>({x:48+(p.y-min)*44+(Math.abs(p.x)%2)*22,y:81+p.x*44});
 function distance(a,b){const q=p=>p.y-(p.x-(Math.abs(p.x)%2))/2,dq=q(b)-q(a),dr=b.x-a.x;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));}
 function mount({document:doc=root.document,policy=root.MotionPolicy,now=()=>root.performance.now(),setTimeout:schedule=(fn,ms)=>root.setTimeout(fn,ms),clearTimeout:unschedule=id=>root.clearTimeout(id),onCue=null,onMove=null,onSettled=()=>{}}={}){
  const tracks=new Map(),legacySeen=new Set(),finishedLandings=new Map(),claimed=new Set();let room=null,serial=0,eventSerial=0,start=0,end=0,groups=0,generation=0,pinnedMin=null,tiles=[],pans=[],callbacks=[],timer=null,activeCue=null,lastSvg=null,lastMin=0,worldAnimation=null,destroyed=false;
  function detach(){generation++;unschedule(timer);timer=null;for(const track of tracks.values()){if(track.animation){track.animation.onfinish=null;track.animation.cancel();track.animation=null;}}if(worldAnimation){worldAnimation.onfinish=null;worldAnimation.cancel();worldAnimation=null;}}
  function clear(notify=false){const had=end>0;detach();tracks.clear();start=end=groups=0;pinnedMin=null;tiles=[];pans=[];callbacks=[];activeCue=null;lastSvg=null;if(had&&notify&&!destroyed)onSettled({cancelled:true});}
  function reset(){clear();serial=eventSerial=0;legacySeen.clear();finishedLandings.clear();claimed.clear();room=null;}
  function locked(){return end>now()&&!doc.hidden&&policy.allowsMotion();}
  function claim(id){claimed.add(String(id));while(claimed.size>256)claimed.delete(claimed.values().next().value);}
  function flushCallbacks(time){
   if(doc.hidden||!policy.allowsMotion())return;
   for(const callback of callbacks){if(callback.delivered||callback.start>time)continue;callback.delivered=true;
    if(callback.type==='cue'){if(callback.end>time||callback.end===callback.start){activeCue=callback.end>time?callback:null;onCue?.({events:callback.events,duration:Math.max(0,callback.end-time)});}}
    else if(callback.end>time)onMove?.({...callback.group,elapsed:Math.max(0,time-callback.start),remaining:callback.end-time});
   }
   if(activeCue&&activeCue.end<=time)activeCue=null;
  }
  function armCallbacks(){
   unschedule(timer);timer=null;if(!end||destroyed||doc.hidden||!policy.allowsMotion()||!onCue&&!onMove)return;
   const time=now();flushCallbacks(time);const next=callbacks.filter(callback=>!callback.delivered).reduce((min,callback)=>Math.min(min,callback.start),Infinity);
   const token=generation;if(Number.isFinite(next))timer=schedule(()=>{if(token!==generation||destroyed)return;timer=null;armCallbacks();},Math.max(1,next-now()));
  }
  function appendCue(events,time,{manualTail=false}={}){
   if(!events.length)return;if(!end)start=end=time;
   const duration=manualTail?0:events.some(event=>event.kind==='road')?ROAD_EVENT_MS:events.some(event=>automaticKinds.has(event.kind))?EVENT_MS:0;
   for(const event of events)claim(event.id);callbacks.push({type:'cue',events,start:end,end:end+duration,delivered:false});end+=duration;
  }
  function key(move){return move.car?'car:'+move.car:move.player?'player:'+move.player:null;}
  function normalize(move){const to=point(move.to),from=point(move.from)||(move.from?.x===null&&to?{x:to.x,y:to.y-1}:null),id=key(move);return id&&from&&to&&!same(from,to)?{id,car:move.car,player:move.player,from,to}:null;}
  function append(group,time){
   const moves=(group.moves||[]).map(normalize).filter(Boolean);if(!moves.length||groups>=MAX_GROUPS)return false;
   if(!end){start=time;end=time;}
   const duration=STEP_MS*Math.max(...moves.map(m=>Math.max(1,Math.min(4,distance(m.from,m.to))))),at=end;
   const extra=moves.some(move=>{const track=tracks.get(move.id);return track&&!same(track.segments.at(-1)?.to||track.initial,move.from);})?STEP_MS:0;
   for(const move of moves){
    let track=tracks.get(move.id);if(!track){track={car:move.car,player:move.player,initial:move.from,segments:[],animation:null};tracks.set(move.id,track);}
    const previous=track.segments.at(-1)?.to||track.initial;
    if(!same(previous,move.from))track.segments.push({from:previous,to:move.from,start:at,end:at+extra,kind:'move'});
    track.segments.push({from:move.from,to:move.to,start:at+extra,end:at+extra+duration,kind:group.kind});
   }
   callbacks.push({type:'move',group,start:at+extra,end:at+extra+duration,delivered:false});end=at+duration+extra;groups++;return true;
  }
  function prepare(state,events=[],fallback=[],{live=false,previous=null}={}){
   if(destroyed)return;
   if(room!==state.code){reset();room=state.code;}
   const time=now(),journal=Array.isArray(state.motions)?state.motions:[],fresh=journal.filter(g=>Number.isSafeInteger(g.id)&&g.id>serial),publicEvents=Array.isArray(state.events)?state.events:events;
   const cues=publicEvents.filter(event=>Number.isSafeInteger(event.id)&&event.id>eventSerial&&Number.isSafeInteger(event.afterMotion)&&event.afterMotion>=0&&cueKinds.has(event.kind)).sort((a,b)=>a.afterMotion-b.afterMotion||a.id-b.id);
   for(const event of publicEvents)if(Number.isSafeInteger(event.id))eventSerial=Math.max(eventSerial,event.id);
   if(state.phase==='finished'){const alive=new Set(state.cars.filter(c=>!c.dead).map(c=>c.id));for(const group of journal)for(const move of group.moves||[])if(alive.has(move.car)&&point(move.to))finishedLandings.set(move.car,point(move.to));}else finishedLandings.clear();
   for(const group of journal)if(Number.isSafeInteger(group.id))serial=Math.max(serial,group.id);
   const legacy=events.filter(event=>{if(event.id==null||legacySeen.has(event.id))return false;legacySeen.add(event.id);while(legacySeen.size>256)legacySeen.delete(legacySeen.values().next().value);return true;});
   if(!live||doc.hidden||!policy.allowsMotion()||state.phase==='waiting'){clear(true);return;}
   if(end&&time>=end){flushCallbacks(time);clear();}else detach();
   const added=new Set();
   for(const group of fresh){
    if(!(group.moves||[]).some(normalize))continue;
    const boundary=cues.findIndex(event=>event.afterMotion>=group.id);appendCue(cues.splice(0,boundary<0?cues.length:boundary),time);
    if(append(group,time))for(const move of group.moves||[])if(key(move))added.add(key(move));
   }
   // Compatibility for an old server; the canonical journal wins when present.
   if(!Array.isArray(state.motions))for(const event of legacy){
    if(event.kind!=='movePath'||!Array.isArray(event.steps)||!event.steps.length||event.steps.length>16)continue;
    let from=event.from;for(const to of event.steps){append({kind:'move',moves:[{car:event.car,from,to}]},time);from=to;}if(point(event.to)&&!same(from,event.to))append({kind:'move',moves:[{car:event.car,from,to:event.to}]},time);added.add('car:'+event.car);
   }
   for(const move of fallback){if(added.has('car:'+move.to.id))continue;append({kind:'move',moves:[{car:move.to.id,from:move.from,to:move.to}]},time);}
   const cars=new Map(state.cars.map(c=>[c.id,c]));
   for(const [id,track]of tracks){if(!track.car)continue;const car=cars.get(track.car),last=track.segments.at(-1).to;if(!car||(!car.dead&&state.phase!=='finished'&&!same(last,car)))tracks.delete(id);}
   appendCue(cues.filter(event=>event.afterMotion<=serial),time,{manualTail:!!state.diceCheck});
   if(!tracks.size&&end<=start){for(const callback of callbacks)if(callback.type==='cue'&&!callback.delivered)for(const event of callback.events)claimed.delete(String(event.id));clear();return;}
   if(pinnedMin===null)pinnedMin=previous?.tiles?.[0]?.start??state.tiles?.[0]?.start??0;
   const tileMap=new Map([...tiles,...(previous?.tiles||[]),...(state.tiles||[])].map(tile=>[tile.start,tile]));tiles=[...tileMap.values()].filter(t=>t.start>=pinnedMin).sort((a,b)=>a.start-b.start).slice(-8);
   const min=state.tiles?.[0]?.start??pinnedMin,current=pans.at(-1)?.to??pinnedMin;
   if(min!==current){pans.push({from:current,to:min,start:end,end:end+PAN_MS});end+=PAN_MS;}
  }
  function view(state){
   const cars=state.cars.map(car=>{const track=tracks.get('car:'+car.id),last=track?.segments.at(-1)?.to||finishedLandings.get(car.id);return last?{...car,...last,motionGhost:!!car.dead}:car;});
   const players=(state.players||[]).map(player=>{const last=tracks.get('player:'+player.id)?.segments.at(-1)?.to;return last?{...player,chopper:{...player.chopper,...last}}:player;});
   return {min:pinnedMin??state.tiles?.[0]?.start??0,tiles:tiles.length?tiles:state.tiles,cars,players};
  }
  function frames(track,min){
   const last=track.segments.at(-1).to,base=position(last,min),result=[],total=end-start;
   const add=(v,at)=>result.push({transform:'translate('+(v.x-base.x)+'px,'+(v.y-base.y)+'px)',offset:Math.max(0,Math.min(1,(at-start)/total)),easing:'ease-in-out'});
   add(position(track.initial,min),start);let cursor=start;
   for(const segment of track.segments){if(segment.start>cursor)add(position(segment.from,min),segment.start);if(['jump','blast'].includes(segment.kind)){const a=position(segment.from,min),b=position(segment.to,min);add({x:(a.x+b.x)/2,y:(a.y+b.y)/2-24},(segment.start+segment.end)/2);}add(position(segment.to,min),segment.end);cursor=segment.end;}
   if(cursor<end)add(position(last,min),end);return result;
  }
  function attach(svg,min){
   if(destroyed||!svg||doc.hidden||!policy.allowsMotion()){clear();return;}
   if(!end)return;const elapsed=Math.max(0,now()-start),duration=end-start;
   if(elapsed>=duration){flushCallbacks(now());clear();return;}
   lastSvg=svg;lastMin=min;
   const token=generation,deadline=end,finished=()=>{if(token!==generation||deadline!==end||destroyed)return;flushCallbacks(now());clear();onSettled({cancelled:false});};
   const carNodes=new Map(Array.from(svg.querySelectorAll('.map-car')).map(n=>['car:'+n.dataset.car,n])),airNodes=new Map(Array.from(svg.querySelectorAll('.map-chopper')).map(n=>['player:'+n.dataset.player,n]));
   let attached=0;
   for(const [id,track]of tracks){const node=(carNodes.get(id)||airNodes.get(id))?.querySelector('.race-car-motion');if(!node)continue;const animation=policy.animate(node,frames(track,min),{duration,easing:'linear',fill:'both'});if(!animation)continue;animation.currentTime=elapsed;animation.onfinish=finished;track.animation=animation;attached++;}
   if(pans.length||!attached&&callbacks.some(callback=>callback.type==='cue'&&callback.end>callback.start)){const node=svg.querySelector?.('.race-world'),f=[{transform:'translate(0px,0px)',offset:0,easing:'ease-in-out'}];let cursor=start;for(const pan of pans){if(pan.start>cursor)f.push({transform:'translate('+(-(pan.from-pinnedMin)*44)+'px,0px)',offset:(pan.start-start)/duration,easing:'ease-in-out'});f.push({transform:'translate('+(-(pan.to-pinnedMin)*44)+'px,0px)',offset:(pan.end-start)/duration,easing:'ease-in-out'});cursor=pan.end;}if(cursor<end)f.push({...f.at(-1),offset:1});worldAnimation=policy.animate(node,f,{duration,easing:'linear',fill:'both'});if(worldAnimation){worldAnimation.currentTime=elapsed;worldAnimation.onfinish=finished;attached++;}}
   if(!attached){clear();onSettled({cancelled:true});}else armCallbacks();
  }
  function skipCue(){
   const time=now(),cue=activeCue;if(!cue||cue.end<=time||doc.hidden||!policy.allowsMotion())return false;
   const oldEnd=cue.end,delta=oldEnd-time;cue.end=time;activeCue=null;
   for(const track of tracks.values())for(const segment of track.segments)if(segment.start>=oldEnd){segment.start-=delta;segment.end-=delta;}
   for(const pan of pans)if(pan.start>=oldEnd){pan.start-=delta;pan.end-=delta;}
   for(const callback of callbacks)if(callback.start>=oldEnd){callback.start-=delta;callback.end-=delta;}
   end-=delta;const svg=lastSvg,min=lastMin;detach();
   if(end<=time){flushCallbacks(time);clear();onSettled({cancelled:false});}else if(svg)attach(svg,min);
   return true;
  }
  const visibility=()=>{if(doc.hidden)clear(true);},unsubscribe=policy.subscribe(()=>{if(!policy.allowsMotion())clear(true);});doc.addEventListener('visibilitychange',visibility);
  return {prepare,attach,view,locked,inCue:()=>!!activeCue&&activeCue.end>now(),claims:id=>claimed.has(String(id)),skipCue,cancel(){clear(true);},reset,destroy(){destroyed=true;reset();unsubscribe?.();doc.removeEventListener('visibilitychange',visibility);}};
 }
 const api={mount,STEP_MS,PAN_MS,EVENT_MS,ROAD_EVENT_MS};if(typeof module==='object'&&module.exports)module.exports=api;else root.RaceMovement=api;
})(typeof window==='object'?window:globalThis);
