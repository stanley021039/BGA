const {HttpError}=require('../http/errors');

const MIN_X=15,MAX_X=85,MIN_Y=32,MAX_Y=92;
const PRESENCE_MS=15000,MAX_VISITORS=80;

function createLobby(now=()=>Date.now()){
 const visitors=new Map();
 function clean(time){for(const [id,visitor] of visitors)if(time-visitor.seenAt>PRESENCE_MS)visitors.delete(id);}
 function enter(user){
  const time=now();clean(time);
  let visitor=visitors.get(user.id);
  if(!visitor){
   if(visitors.size>=MAX_VISITORS)throw new HttpError(503,'LOBBY_FULL','大廳目前已滿');
   const seed=[...user.id].reduce((sum,char)=>sum+char.charCodeAt(0),0);
   visitor={id:user.id,x:22+(seed%7)*9,y:37+(seed%3)*15,lastMoveAt:time,dx:0,dy:0};
   visitors.set(user.id,visitor);
  }
  visitor.name=user.display_name;
  visitor.seenAt=time;
  return visitor;
 }
 function view(user){
  enter(user);
  const time=now();
  return {selfId:user.id,visitors:[...visitors.values()].map(visitor=>({id:visitor.id,name:visitor.name,x:visitor.x,y:visitor.y,facing:visitor.dx<0?'left':'right',moving:time-visitor.lastMoveAt<300&&(visitor.dx!==0||visitor.dy!==0),image:`/characters/${visitor.id}`}))};
 }
 function move(user,input){
  if(!input||typeof input!=='object'||![input.dx,input.dy].every(value=>Number.isInteger(value)&&value>=-1&&value<=1))throw new HttpError(400,'INVALID_MOVEMENT','移動方向不正確');
  const visitor=enter(user),time=now();
  const seconds=Math.min(.2,Math.max(0,(time-visitor.lastMoveAt)/1000));
  const length=Math.hypot(input.dx,input.dy)||1;
  visitor.x=Math.max(MIN_X,Math.min(MAX_X,visitor.x+input.dx/length*24*seconds));
  visitor.y=Math.max(MIN_Y,Math.min(MAX_Y,visitor.y+input.dy/length*32*seconds));
  visitor.dx=input.dx;visitor.dy=input.dy;visitor.lastMoveAt=time;
  return view(user);
 }
 return {view,move};
}

module.exports={createLobby};
