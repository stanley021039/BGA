const {HttpError}=require('../http/errors');

function reconnectPlayer(room,userId,seats,reconnectGrace,now=Date.now()){
 const playerId=seats.get(room.code)?.get(userId);
 const player=room.players.find(item=>item.id===playerId&&!item.bot&&!item.kicked);
 if(!player)throw new HttpError(403,'NOT_SEATED','尚未加入此房間');
 const wasOffline=now-player.lastSeen>=15000;
 player.lastSeen=now;
 const actor=room.type==='thunder'?room.actor():room.players[room.turn]?.id;
 const canAct=room.type==='majority'?room.phase==='answering'&&room.participantIds.includes(player.id)&&!Object.hasOwn(room.answers,player.id):actor===player.id;
 if(wasOffline&&canAct&&room.deadline&&!['waiting','showdown','finished'].includes(room.phase)){
  const key=room.code+':'+player.id,turn=room.type==='majority'?`${room.round}:${room.phase}`:[room.hand||room.round||0,room.phase,room.turn,room.updated].join(':');
  if(reconnectGrace.get(key)!==turn){room.deadline=Math.max(room.deadline,now+15000);reconnectGrace.set(key,turn);}
 }
 return player;
}

module.exports={reconnectPlayer};
