/* Sound owners follow confirmed presentation checkpoints, independently of motion preferences. */
((root)=>{
 'use strict';
 const revealKinds=new Set(['glass','hazard','damage','fire','shot','trap','eliminated','road','slam','jump','quake','fireDie','airstrike']);
 const eventCue=event=>event.kind==='shot'?'shot':event.kind==='slam'?'slam':event.kind==='command'&&event.command==='nitro'?'nitro':null;
 const moved=group=>(group.moves||[]).some(move=>move.car&&(move.from?.x===null||Number.isInteger(move.from?.x))&&Number.isInteger(move.from?.y)&&Number.isInteger(move.to?.x)&&Number.isInteger(move.to?.y)&&(move.from.x!==move.to.x||move.from.y!==move.to.y));
 const sliding=group=>['oil','skid'].includes(group.kind)&&moved(group);
 function follows(previous,next){
  if(!previous||previous.kind!==next.kind||!sliding(previous)||previous.moves.length!==next.moves.length)return false;
  return next.moves.every(move=>previous.moves.some(before=>before.car===move.car&&before.to.x===move.from.x&&before.to.y===move.from.y));
 }
 function create({gate=root.GameSounds.create()}={}){
  const events=new Map(),motions=new Map();let room=null,eventSerial=-1,motionSerial=-1,live=false,destroyed=false;
  const trim=map=>{while(map.size>256)map.delete(map.keys().next().value);};
  function clear(){events.clear();motions.clear();live=false;}
  function update(state,options){
   if(destroyed)return {live:false,events:[],motions:[],epoch:gate.epoch()};
   const allowed=gate.update(state,options),epoch=gate.epoch();
   if(room!==state.code){clear();eventSerial=motionSerial=-1;room=state.code;}
   if(!allowed)clear();live=allowed;
   const freshEvents=[],freshMotions=[];
   for(const event of state.events||[]){
    if(!Number.isSafeInteger(event.id)||event.id<=eventSerial)continue;
    if(allowed){const car=state.cars?.find(car=>car.id===event.car);events.set(event.id,{event,epoch,presented:false,waitingForCar:eventCue(event)==='nitro'&&(event.x===null||car?.x===null)});freshEvents.push(event);}
    eventSerial=Math.max(eventSerial,event.id);
   }
   let previous=null,slideStart=null;
   for(const group of state.motions||[]){
    if(sliding(group)){if(!follows(previous,group))slideStart=group.id;}else slideStart=null;
    if(Number.isSafeInteger(group.id)&&group.id>motionSerial){
     if(allowed&&moved(group)){motions.set(group.id,{epoch,key:sliding(group)?'race:skid:'+slideStart:null,presented:false});freshMotions.push(group);}
     motionSerial=Math.max(motionSerial,group.id);
    }
    previous=group;
   }
   trim(events);trim(motions);
   if(state.phase==='waiting'){clear();gate.stop();return {live:allowed,epoch,events:[],motions:[]};}
   return {live:allowed,epoch,events:freshEvents,motions:freshMotions};
  }
  function presentEvents(batch,{reveal=true}={}){
   const fresh=batch.map(event=>events.get(event.id)).filter(record=>record&&!record.presented&&!record.waitingForCar&&record.epoch===gate.epoch());
   const themed=fresh.filter(record=>eventCue(record.event)),main=['shot','slam','nitro'].map(cue=>themed.find(record=>eventCue(record.event)===cue)).find(Boolean);
   if(main){for(const record of fresh)record.presented=true;gate.play(eventCue(main.event),'race:event:'+main.event.id,{live,epoch:main.epoch});}
   else if(reveal){for(const record of fresh)record.presented=true;const primary=fresh.find(record=>revealKinds.has(record.event.kind));if(primary)gate.play('reveal','race:checkpoint:'+fresh.map(record=>record.event.id).join(','),{live,epoch:primary.epoch});}
  }
  function presentMotion(group){
   const record=motions.get(group.id);if(!record||record.presented||record.epoch!==gate.epoch())return;record.presented=true;
   // A nitro command issued in the garage gets its sound when the exhaust first
   // becomes visible on the confirmed entry, rather than at the earlier ACK.
   const nitro=[...events.values()].find(event=>event.waitingForCar&&!event.presented&&event.epoch===record.epoch&&group.moves.some(move=>move.car===event.event.car));
   if(nitro){nitro.presented=true;gate.play('nitro','race:event:'+nitro.event.id,{live,epoch:nitro.epoch});}
   else if(record.key)gate.play('skid',record.key,{live,epoch:record.epoch});
  }
  return {update,events:presentEvents,motion:presentMotion,motions:batch=>batch.forEach(presentMotion),
   rolling({cycleKey,live:eligible,epoch}){gate.play('dice-roll','race:dice:'+cycleKey,{live:live&&eligible,epoch});},
   epoch:()=>gate.epoch(),disconnect(){clear();gate.disconnect();},reset(){clear();room=null;eventSerial=motionSerial=-1;gate.reset();},
   destroy(){if(destroyed)return;destroyed=true;clear();gate.destroy();}};
 }
 root.RaceGameSounds={create};
})(typeof window==='object'?window:globalThis);
