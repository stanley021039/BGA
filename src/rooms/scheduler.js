function startRoomScheduler({rooms,history,onDelete=()=>{}}){
 const timer=setInterval(()=>{for(const [code,r]of rooms){if(Date.now()-Math.max(...r.players.map(p=>p.lastSeen))>86400000){history.interrupt(r,'房間閒置逾 24 小時');rooms.delete(code);onDelete(code);continue;}if(r.type==='majority'){if(r.phase==='answering'&&r.deadline&&Date.now()>r.deadline)try{history.transact(r,{action:'auto',source:'timeout'},()=>r.auto());}catch(e){console.error(e);}continue;}if(r.type==='gift')continue;const p=r.type==='thunder'?r.player(r.actor()):r.players[r.turn];if(!p||['waiting','finished'].includes(r.phase))continue;if((p.bot&&Date.now()>r.botAt)||Date.now()>r.deadline){try{if(r.type==='thunder'){history.transact(r,{action:'auto',source:p.bot?'bot':'timeout',actor:p.id},()=>r.auto());continue;}let due=r.currentBet-p.bet;let action=due===0?'check':'call';if(!p.bot)action=due===0?'check':'fold';else if(due>150&&Math.random()<.4)action='fold';history.transact(r,{action,source:p.bot?'bot':'timeout',actor:p.id},()=>r.act(p.id,action));}catch(e){console.error(e);}}}},400);
 timer.unref();
 return ()=>clearInterval(timer);
}
module.exports={startRoomScheduler};
