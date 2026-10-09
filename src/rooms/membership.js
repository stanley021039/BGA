const {HttpError}=require('../http/errors');

// In-progress score/results may reference departed seats. Bound those records
// instead of deleting identities that the current match still needs.
const MAX_PLAYER_RECORDS=64;
function assertRecordCapacity(room){
 if(room.players.length>=MAX_PLAYER_RECORDS)throw new HttpError(429,'ROOM_RECORD_LIMIT','這局加入過的玩家已達上限，請開始新局或建立新房間');
}
function rejoinPlayer(room,playerId,name){
 const player=room.players.find(p=>p.id===playerId&&p.kicked);
 if(!player)return null;
 if(['gift','trpg','telephone'].includes(room.type)&&!['waiting','finished'].includes(room.phase))throw Error('本局已開始，請等待下一局');
 if(room.type==='thunder'&&room.phase!=='waiting')throw Error('比賽已開始，請等下一場或建立新房間');
 const limits={draw:8,gift:8,majority:12,thunder:4,poker:6,trpg:6,telephone:8};
 if(room.players.filter(p=>!p.kicked).length>=limits[room.type||'poker'])throw Error('房間已滿');
 player.kicked=false;player.bot=false;player.name=name.slice(0,16);player.lastSeen=Date.now();
 if(['draw','majority'].includes(room.type))player.waitingForNextRound=room.phase!=='waiting';
 if(room.event)room.event('join',player.name+' 重新加入房間');else room.note(player.name+' 重新加入牌桌');
 return player;
}
module.exports={MAX_PLAYER_RECORDS,assertRecordCapacity,rejoinPlayer};
