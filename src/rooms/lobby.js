const {HttpError}=require('../http/errors');

const MIN_X=15,MAX_X=85,MIN_Y=32,MAX_Y=92;
const PRESENCE_MS=15000,EMOTE_MS=5000,MAX_VISITORS=80;

function createLobby(now=()=>Date.now()){
 const visitors=new Map();
 function clean(time){for(const [id,visitor] of visitors)if(time-visitor.seenAt>PRESENCE_MS)visitors.delete(id);}
 function advance(visitor,time){
  const elapsed=Math.max(0,(time-visitor.updatedAt)/1000);
  const dx=visitor.targetX-visitor.x,dy=visitor.targetY-visitor.y;
  const duration=Math.hypot(dx/24,dy/32);
  const ratio=duration?Math.min(1,elapsed/duration):1;
  visitor.x+=dx*ratio;visitor.y+=dy*ratio;
  visitor.updatedAt=time;
 }
 function enter(user){
  const time=now();clean(time);
  let visitor=visitors.get(user.id);
  if(!visitor){
   if(visitors.size>=MAX_VISITORS)throw new HttpError(503,'LOBBY_FULL','大廳目前已滿');
   const seed=[...user.id].reduce((sum,char)=>sum+char.charCodeAt(0),0);
   const x=22+(seed%7)*9,y=37+(seed%3)*15;
   visitor={id:user.id,x,y,targetX:x,targetY:y,updatedAt:time,facing:'right'};
   visitors.set(user.id,visitor);
  }
  visitor.name=user.display_name;
  visitor.seenAt=time;
  return visitor;
 }
 function view(user){
  enter(user);
  const time=now();
  for(const visitor of visitors.values())advance(visitor,time);
  return {selfId:user.id,visitors:[...visitors.values()].map(visitor=>({
   id:visitor.id,name:visitor.name,x:visitor.x,y:visitor.y,facing:visitor.facing,
   moving:Math.hypot(visitor.targetX-visitor.x,visitor.targetY-visitor.y)>.05,
   image:`/characters/${visitor.id}`,
   emote:visitor.emote&&visitor.emote.until>time?visitor.emote:null
  }))};
 }
 function move(user,input){
  if(!input||typeof input!=='object'||![input.x,input.y].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100))throw new HttpError(400,'INVALID_MOVEMENT','目的地不正確');
  const visitor=enter(user),time=now();advance(visitor,time);
  visitor.targetX=Math.max(MIN_X,Math.min(MAX_X,input.x));
  visitor.targetY=Math.max(MIN_Y,Math.min(MAX_Y,input.y));
  if(visitor.targetX<visitor.x-.1)visitor.facing='left';
  if(visitor.targetX>visitor.x+.1)visitor.facing='right';
  return view(user);
 }
 function emote(user,selected){
  const visitor=enter(user),time=now();
  if(visitor.lastEmoteAt!==undefined&&time-visitor.lastEmoteAt<1200)throw new HttpError(429,'EMOTE_RATE_LIMIT','表情太快了，請稍後再試');
  visitor.lastEmoteAt=time;
  visitor.emote={image:selected.image,label:selected.label,at:time,until:time+EMOTE_MS};
  return view(user);
 }
 return {view,move,emote};
}

module.exports={createLobby};
