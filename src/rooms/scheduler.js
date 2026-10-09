const {expireEmptyRooms,endRoomHistory}=require('./lifecycle');
const {runTestAIStep}=require('../ai');
function advanceTimedPhase(room,history){
 const now=Date.now();let due=false;
 if(room.type==='majority')due=room.phase==='answering'&&room.deadline!=null&&now>=room.deadline;
 if(room.type==='draw'){
  const artist=room.player(room.presenterId);
  due=room.deadline!=null&&now>=room.deadline||(['choosing','drawing'].includes(room.phase)&&artist&&!artist.bot&&now-artist.lastSeen>15000);
 }
 if(!due)return false;
 try{history.transact(room,{action:'auto',source:'timeout'},()=>room.auto());}catch(e){console.error(e);}
 return true;
}
function startRoomScheduler({rooms,history,onDelete=()=>{},onDrawStroke=()=>{},onTransition=()=>{},onSweep=()=>{}}){
 let emptyTimer,timer;
 try{
 emptyTimer=setInterval(()=>expireEmptyRooms({rooms,history,onDelete}),400);emptyTimer.unref();
 timer=setInterval(()=>{for(const [code,r]of rooms){try{
  if(Date.now()-Math.max(...r.players.map(p=>p.lastSeen))>86400000){endRoomHistory(history,r,'房間閒置逾 24 小時');rooms.delete(code);onDelete(code);continue;}
  if(history.isPaused?.(r))continue;
  // Expired phases must advance before an AI attempts a now-illegal action.
  if(advanceTimedPhase(r,history))continue;
  try{if(r.type!=='thunder'&&runTestAIStep(r,{history,onDrawStroke}))continue;}catch(e){console.error('Test AI action failed:',e);}
  // The deadline can also pass during an AI action that throws.
  if(advanceTimedPhase(r,history))continue;
  if(['majority','draw','gift','trpg'].includes(r.type))continue;
  if(r.type==='thunder'&&r.diceCheck?.status==='rolling'){if(Date.now()>=r.diceCheck.readyAt)try{history.transact(r,{action:'revealDice',source:'timer',actor:r.actor()},()=>r.advanceDice(Date.now()));}catch(e){console.error(e);}continue;}
  const p=r.type==='thunder'?r.player(r.actor()):r.players[r.turn];
  if(!p||['waiting','finished'].includes(r.phase))continue;
  if((p.bot&&Date.now()>r.botAt)||Date.now()>r.deadline){try{
   if(r.type==='thunder'){history.transact(r,{action:'auto',source:p.bot?'bot':'timeout',actor:p.id},()=>r.auto());continue;}
   let due=r.currentBet-p.bet;let action=due===0?'check':'call';
   if(!p.bot)action=due===0?'check':'fold';else if(due>150&&Math.random()<.4)action='fold';
   history.transact(r,{action,source:p.bot?'bot':'timeout',actor:p.id},()=>r.act(p.id,action));
  }catch(e){console.error(e);}}
 }finally{try{onTransition(r);}catch(error){console.error(error);}}}try{onSweep();}catch(error){console.error(error);}},400);
 timer.unref();
 return ()=>{clearInterval(timer);clearInterval(emptyTimer);};
 }catch(error){clearInterval(timer);clearInterval(emptyTimer);throw error;}
}
module.exports={startRoomScheduler};
