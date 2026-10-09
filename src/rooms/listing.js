const limits={thunder:4,poker:6,majority:12,gift:8,draw:8,trpg:6};

function listRooms(rooms,seats,kickedUsers,userId){
 return [...rooms.values()].map(room=>{
  const type=room.type||'poker';
  const playerCount=['majority','gift','draw','trpg'].includes(type)?room.activePlayers().length:room.players.length;
  const seatId=seats.get(room.code)?.get(userId);
  const seated=!!room.players.find(player=>player.id===seatId&&!player.bot&&!player.kicked);
  const kicked=!!kickedUsers.get(room.code)?.has(userId);
  const joinable=!kicked&&(seated||(playerCount<limits[type]&&(type==='poker'||type==='draw'||room.phase==='waiting'||(['gift','trpg'].includes(type)&&room.phase==='finished'))));
  return {code:room.code,name:room.name,type,phase:room.phase,playerCount,maxPlayers:limits[type],seated,kicked,joinable,updated:room.updated};
 }).sort((a,b)=>b.updated-a.updated||a.code.localeCompare(b.code));
}

module.exports={listRooms};
