// Thunder Road: Vendetta core rules. See docs/RULES-SOURCES.md for reference and variant details.
const {randomInt,randomUUID}=require('node:crypto');
const RacePaths=require('../../public/shared/race-paths');
const COLORS=['#ec9b35','#43c6cd','#c4d3c0','#c260b6'];
const DIRS=['前左','前方','前右','後左','後方','後右'];
const SIZES=['輕型','中型','重型'];
const ROAD_DIE=[1,1,1,2,2,3],STUNT_DIE=[1,2,2,3,3,4],SHOT_DIE=['SM','M','L','L','L','SML'];
// Provisional digital playtest distribution, NOT a verified physical fire die.
const FIRE_DIE=[1,1,2,2,'out','eliminate'];
const HAZARD_NAMES={road:'安全道路',mud:'泥地',oil:'油漬',mine:'地雷',wreck:'殘骸',glass:'沙漠玻璃',ramp:'跳台',fire:'火焰',pit:'陷阱',quake:'地震',worm:'沙蟲'};
const DAMAGE_NAMES={fire:'起火損傷',dent:'鈑金凹陷',shrapnel:'碎片飛散',dazed:'暈頭轉向',blast:'爆炸拋飛',skid:'失控滑移'};
// Original digital road layouts, six staggered lanes and eight columns per tile.
// Each string is one lane from rear to front. R road, O off-road, M mud, X impassable, ? hidden hazard.
const MAPS=[
 {name:'起跑停車場',sides:[['RROOOMOO','RRRRR?RR','RR?RRRRR','RRRR?RRR','RR?RRRRR','RROOOORR'],['RROOOORR','RRR?RRRR','RRRRRRRR','RR?RR?RR','RRRRRRRR','RROOMOOR']]},
 {name:'峽谷瓶頸',sides:[['OOXXXXOO','RRROOORR','R?RR?RRR','RRRRRR?R','RROOORRR','OOXXXOOO'],['OOMXXOOO','RRRMORRR','R?RRRR?R','RRRR?RRR','RRROMRRR','OOOXXMOO']]},
 {name:'泥濘盆地',sides:[['OORRRROO','RRR?RRRR','RMMOOMRR','RRMM?MRR','RR?RRRRR','OOROOMOO'],['OOROOMOO','RR?RRRRR','RR?MMMRR','RMMOOMRR','RRRR?RRR','OORRRROO']]},
 {name:'廢土彎道',sides:[['OOXOOXOO','RRR?ORRR','R?RRRRRR','RRRR?RRR','RRORRR?R','OOXOOXOO'],['OOMOOXOO','RR?RRRRR','RRR?ORRR','RRORR?RR','RRRRRRRR','OOXOOMOO']]},
 {name:'殘骸公路',sides:[['OOMOOXOO','RRR?RRRR','R?RRMRRR','RRRMR?RR','RR?RRRRR','OOXOOMOO'],['OOXOOMOO','RR?RRRRR','RRRRR?RR','RR?RRMRR','RRMRRRRR','OOMOOXOO']]}
];
// Original layouts for the terrain/hazard preview; not reconstructions of retail tiles.
const DEVIL_MAPS=[
 {name:'試作・毒液谷',sides:[['OOOGGOOO','RRR?RRRR','RRGGR?RR','RRR?GGRR','RRRRRRRR','OOOGGOOO'],['OOOGGOOO','RRR?RRRR','RRSGG?RR','RRGGRRRR','RRR?RRRR','OOOGGOOO']]},
 {name:'試作・玻璃荒原',sides:[['OOVVOOOO','RRR?RRRR','RRVVV?RR','RRR?VVRR','RRRRRRRR','OOOVVOOO'],['OOOVVOOO','RRR?RRRR','RRSVV?RR','RRVVRRRR','RRR?RRRR','OOVVOOOO']]},
 {name:'試作・飛躍峽谷',sides:[['OOXXOOOO','RRJ?RRRR','RRRRX?RR','RRR?JRRR','RRRRRRRR','OOXXOOOO'],['OOXXOOOO','RRR?RRRR','RRJRR?RR','RRR?XRRR','RRRSJRRR','OOOXXOOO']]},
 {name:'試作・火焰走廊',sides:[['OOFFOOOO','RRR?RRRR','RRFFR?RR','RRR?FFRR','RRRRRRRR','OOOOFFOO'],['OOOOFFOO','RRR?RRRR','RRSFF?RR','RRFFRRRR','RRR?RRRR','OOFFOOOO']]},
 {name:'試作・鹽灘直線',sides:[['OOSSSSOO','RRR?RRRR','RRSSS?RR','RRR?SSRR','RRRRRRRR','OOSSSSOO'],['OOSSSSOO','RRR?RRRR','RRSSG?RR','RRVSSRRR','RRR?RRRR','OOSSSSOO']]}
];
const ALL_MAPS=[...MAPS,...DEVIL_MAPS];
function neighbor(x,y,d){const front=x%2?1:0,back=front-1;return d===0?{x:x-1,y:y+front}:d===1?{x,y:y+1}:d===2?{x:x+1,y:y+front}:d===3?{x:x-1,y:y+back}:d===4?{x,y:y-1}:{x:x+1,y:y+back};}
class ThunderRoom{
 constructor(code,name,rng=randomInt){this.options={devilsRun:false};this.type='thunder';this.code=code;this.name=name;this.rng=rng;this.players=[];this.cars=[];this.tiles=[];this.log=[];this.events=[];this.motions=[];this.motionSerial=0;this.phase='waiting';this.turn=-1;this.version=0;this.round=0;this.queue=[];this.updated=Date.now();}
 configure(id,options){if(id!==this.host)throw Error('只有房主可以更改玩法');if(!['waiting','finished'].includes(this.phase))throw Error('比賽中不能更改玩法');if(typeof options.devilsRun!=='boolean')throw Error('擴充設定不正確');this.options.devilsRun=options.devilsRun;this.event('settings',options.devilsRun?'已開啟惡魔賽道：地形／危險試玩（暫定骰面、不含持續效果卡）':'已選擇主遊戲');}
 roll(faces){return faces[this.rng(faces.length)];}
 // Public checks contain only rules until the server's one-second reveal deadline.
 offerDice(spec,faces,resolve){if(this.diceCheck)throw Error('請先完成目前的擲骰');const owner=spec.owner&&this.player(spec.owner)&&!this.player(spec.owner).out?spec.owner:(!this.players[this.turn]?.out?this.players[this.turn]?.id:null)||this.players.find(p=>!p.out)?.id;this.diceCheck={id:++this.version,kind:spec.kind,title:spec.title,condition:spec.condition,owner,status:'awaiting',participants:spec.participants||[],dice:faces.map((f,i)=>({label:spec.labels?.[i]||'骰子',faces:f,participant:spec.diceOwners?.[i]}))};this._diceRoll={faces,resolve,rerolls:0};this.touch();}
 dicePlayers(cars){return cars.map(c=>({id:c.owner,name:this.player(c.owner)?.name||'殘骸',color:this.player(c.owner)?.color||'#aaa',car:c.id,label:SIZES[c.size]}));}
 rollDice(){const d=this.diceCheck,r=this._diceRoll;r.values=r.faces.map(f=>this.roll(f));d.status='rolling';delete d.result;d.startedAt=Date.now();d.readyAt=d.startedAt+1000;this.version++;}
 advanceDice(now=Date.now()){const d=this.diceCheck;if(!d||d.status!=='rolling'||now<d.readyAt)return false;const result=this._diceRoll.resolve(this._diceRoll.values);this._diceRoll.apply=result.apply;this._diceRoll.slam=result.slam;d.result={faces:this._diceRoll.values.slice(),text:result.text};d.rerollAllowed=!!result.rerollAllowed&&this._diceRoll.rerolls===0;d.status='result';this.touch();this.botAt=now+1200;return true;}
 acceptDice(){const apply=this._diceRoll.apply;this.diceCheck=null;this._diceRoll=null;apply();this.drain();this.touch();}
 clearDice(){this.diceCheck=null;this._diceRoll=null;}
 shuffle(a){for(let i=a.length-1;i>0;i--){const j=this.rng(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
 note(text){this.log.unshift(text);this.log=this.log.slice(0,60);this.updated=Date.now();}
 event(kind,text,extra={}){this.events.push({id:++this.version,kind,text,...extra});this.events=this.events.slice(-12);this.note(text);}
 // Public displacement journal is independent of decorative/log events. A
 // group is simultaneous (quake); groups are applied in their recorded order.
 // Copy only public identity and coordinates, never vehicle/player objects.
 motion(kind,moves){if(!moves.length)return;this.motions.push({id:++this.motionSerial,kind,moves:moves.map(move=>({...('car' in move?{car:move.car}:{player:move.player}),from:{x:move.from.x,y:move.from.y},to:{x:move.to.x,y:move.to.y}}))});let transfers=this.motions.reduce((sum,group)=>sum+group.moves.length,0);while(this.motions.length>64||transfers>128)transfers-=this.motions.shift().moves.length;}
 add(name,bot=false){if(this.phase!=='waiting')throw Error('比賽已開始，請等下一場或建立新房間');if(this.players.length===4)throw Error('主遊戲最多四支車隊');const p={id:randomUUID(),secret:randomUUID(),name:name.slice(0,16),bot,color:COLORS.find(color=>!this.players.some(p=>p.color===color)),lastSeen:Date.now(),out:false,dice:[],turns:0};this.players.push(p);if(!this.host)this.host=p.id;this.event('join',`${p.name} 加入車隊`);return p;}
 kick(id,target,leaving=false){if(id!==this.host)throw Error('只有房主可以踢人');const p=this.player(target);if(!p||p.kicked)throw Error('找不到玩家');if(target===this.host)throw Error('不能踢出自己');if(this.phase==='waiting'){this.players.splice(this.players.indexOf(p),1);this.event('kick',p.name+(leaving?' 已離開房間':' 已被房主踢出'));}else{p.kicked=true;p.bot=true;this.botAt=Date.now();this.event('kick',p.name+(leaving?' 已離開房間，由電腦接手':' 已被房主踢出，由電腦接手'));}}
 car(id){return this.cars.find(c=>c.id===id);}
 player(id){return this.players.find(p=>p.id===id);}
 label(c){return c.wreck?'殘骸':`${this.player(c.owner)?.name}的${SIZES[c.size]}車`;}
 operable(c){return !c.dead&&!c.wreck&&c.damage.length<2;}
 boardMax(){return this.tiles.length?this.tiles[this.tiles.length-1].start+8:24;}
 boardMin(){return this.tiles[0]?.start||0;}
 terrain(x,y){const t=this.tiles.find(t=>y>=t.start&&y<t.start+8);return t&&x>=0&&x<6?t.cells[x][y-t.start]:null;}
 kind(cell){if(!cell)return null;return cell.hazard?.face?({road:'R',oil:'R',mud:'M',glass:'V',ramp:'J',fire:'F',pit:'X'}[cell.hazard.kind]||cell.kind):cell.kind;}
 road(x,y){return this.kind(this.terrain(x,y))==='R';}
 cost(x,y){const c=this.terrain(x,y);return this.kind(c)==='M'?2:1;}
 occupied(x,y,except){return this.cars.find(c=>!c.dead&&c.x===x&&c.y===y&&c.id!==except);}
 empty(x,y){const c=this.terrain(x,y);return !!c&&this.kind(c)!=='X'&&!c.hazard&&!this.occupied(x,y)&&!this.players.some(p=>p.chopper?.x===x&&p.chopper?.y===y);}
 hazard(){if(!this.hazardDeck.length){this.hazardDeck=this.shuffle(this.hazardDiscard.splice(0));}return this.hazardDeck.pop()||'road';}
 addTile(spec,start){const map=ALL_MAPS[spec.map].sides[spec.side];const cells=map.map(row=>[...row].map(ch=>({kind:ch==='?'?'R':ch,...(ch==='?'?{hazard:{kind:this.hazard(),face:false}}:{})})));this.tiles.push({...spec,name:ALL_MAPS[spec.map].name,start,cells});}
 start(){if(!['waiting','finished'].includes(this.phase))throw Error('比賽尚未結束');if(this.players.length<2)throw Error('至少需要兩支車隊');
 this.tiles=[];this.cars=[];this.queue=[];this.active=null;this.pending=null;this.clearDice();this.winner=null;this.finishAt=null;this.round=0;this.events=[];this.motions=[];this.hazardDiscard=[];
 // Token quantities are digital-variant values; reference material does not enumerate their distribution.
 this.hazardDeck=this.shuffle([...Array(8).fill('road'),...Array(6).fill('mud'),...Array(6).fill('oil'),...Array(3).fill('mine'),...Array(3).fill('wreck')]);
 this.damageDeck=this.shuffle([...Array(8).fill('dent'),...Array.from({length:6},(_,i)=>'skid'+i),'shrapnel','shrapnel','dazed','dazed','blast','blast']);
 if(this.options.devilsRun){this.hazardDeck.push(...Array(4).fill('glass'),...Array(4).fill('ramp'),...Array(4).fill('fire'),...Array(4).fill('pit'),...Array(3).fill('quake'),...Array(3).fill('worm'));this.shuffle(this.hazardDeck);this.damageDeck.push('fire','fire');this.shuffle(this.damageDeck);}
 this.tileDeck=this.shuffle((this.options.devilsRun?[1,2,3,4,5,6,7,8,9]:[1,2,3,4]).map(map=>({map,side:this.rng(2)})));this.addTile({map:0,side:0},0);this.addTile(this.tileDeck.shift(),8);this.addTile(this.tileDeck.shift(),16);this.tileCount=3;
 for(const p of this.players){p.out=false;p.chopper=null;p.completedHumanTurn=false;p.humanActionThisTurn=false;for(let size=0;size<3;size++)this.cars.push({id:randomUUID(),owner:p.id,size,x:null,y:-1,damage:[],pendingDamage:0,burning:false,dead:false,moved:false,coasts:0});}
 this.newRound(true);this.event('start','引擎啟動！第一輪禁止射擊。');}
 newRound(first=false){this.round++;for(const p of this.players){p.dice=Array.from({length:4},()=>({value:this.rng(6)+1,used:false}));p.commandUsed=false;p.turns=0;}for(const c of this.cars){c.moved=false;c.coasts=0;}
 if(first){let sums;do{for(const p of this.players)p.dice.forEach(d=>d.value=this.rng(6)+1);sums=this.players.map(p=>p.dice.reduce((a,d)=>a+d.value,0));}while(sums.filter(s=>s===Math.min(...sums)).length!==1);this.first=sums.indexOf(Math.min(...sums));}else this.first=this.next(this.first,p=>!p.out);
 this.turn=this.first;this.roadDie=this.roll(ROAD_DIE);this.active=null;this.phase='assign';const participants=this.players.filter(p=>!p.out),values=participants.flatMap(p=>p.dice.map(d=>d.value)).concat(this.roadDie);
 this.offerDice({kind:'round',title:`第 ${this.round} 輪：車隊擲骰`,condition:first?'每隊擲四顆骰子，總和最低者先手；最低並列時全部重擲。':'每隊擲四顆骰子，先手依原順序輪替。',owner:this.player(this.host)?.out?participants[0].id:this.host,participants:participants.map(p=>({id:p.id,name:p.name,color:p.color})),labels:participants.flatMap(()=>['骰子 1','骰子 2','骰子 3','骰子 4']).concat('公路加速骰'),diceOwners:participants.flatMap(p=>Array(4).fill(p.id))},participants.flatMap(()=>Array(4).fill([1,2,3,4,5,6])).concat([ROAD_DIE]),()=>({text:`${this.players[this.first].name} 先手 · 公路加速 +${this.roadDie}`,apply:()=>this.event('round',`第 ${this.round} 輪 · 公路加速 +${this.roadDie}`)}));
 this._diceRoll.values=values;this.diceCheck.status='rolling';this.diceCheck.startedAt=Date.now();this.diceCheck.readyAt=this.diceCheck.startedAt+1000;}
 next(i,predicate){for(let n=1;n<=this.players.length;n++){const j=(i+n)%this.players.length;if(predicate(this.players[j]))return j;}return -1;}
 touch(){this.deadline=Date.now()+90000;this.botAt=Date.now()+650;this.version++;}
 actor(){return this.diceCheck?.owner||this.pending?.owner||this.players[this.turn]?.id;}
 available(p){const cars=this.cars.filter(c=>c.owner===p.id&&this.operable(c));const unused=cars.filter(c=>!c.moved);return unused.length?unused:cars.filter(c=>c.coasts<2);}
 targets(source){if(!source||source.dead||source.x===null||this.round===1||(!source.chopper&&!this.operable(source)))return [];const front=[0,1,2].map(d=>neighbor(source.x,source.y,d));return this.cars.filter(c=>!c.dead&&front.some(v=>v.x===c.x&&v.y===c.y));}
 legalMoves(){const c=this.car(this.active?.car);if(!c||c.dead)return [];if(c.x===null)return Array.from({length:6},(_,x)=>({x,y:0}));return [0,1,2].map(d=>neighbor(c.x,c.y,d)).filter(v=>v.x>=0&&v.x<6&&v.y>=this.boardMin());}
 begin(p,d){if(!Number.isInteger(d.die)||d.die<0||d.die>3||(d.command&&(!Number.isInteger(d.commandDie)||d.commandDie<0||d.commandDie>3)))throw Error('骰子選擇不正確');const c=this.car(d.car),die=p.dice[d.die];if(!c||!this.available(p).includes(c)||!die||die.used)throw Error('請選擇可用車輛與骰子');const coast=c.moved;let cmd=d.command||'',cd=p.dice[d.commandDie];
 if(cmd){if(coast||p.commandUsed||!cd||cd.used||d.commandDie===d.die)throw Error('本回合無法使用這個指令骰');if(!['nitro','drift','repair','airstrike'].includes(cmd))throw Error('未知指令');if(cmd==='nitro'&&cd.value>3||cmd==='drift'&&(cd.value<3||cd.value>5)||cmd==='repair'&&cd.value!==6)throw Error('指令骰點數不符合條件');if(cmd==='repair'){const target=this.car(d.repairCar);if(!target||target.owner!==p.id||target.dead||!target.damage.length)throw Error('請選擇一輛受損但未淘汰的己方車');}}
 die.used=true;if(coast)c.coasts++;else c.moved=true;
 this.active={car:c.id,remaining:coast?1:die.value,coast,roadEligible:!coast&&this.road(c.x,c.y),bonusUsed:false,drift:cmd==='drift',driftUsed:false,stopped:false};
 this.event('assign',`${p.name}：${SIZES[c.size]}車 ${coast?'滑行 1':'前進 '+die.value} 格`,{car:c.id,coast,x:c.x,y:c.y});
 if(cmd){p.commandUsed=true;cd.used=true;this.event('command',`${p.name} 啟用${{nitro:'氮氣加速',drift:'甩尾穿越',repair:'維修',airstrike:'直升機空襲'}[cmd]}`,{command:cmd,car:c.id,owner:p.id,x:c.x,y:c.y,...(cmd==='repair'?{target:d.repairCar}:{})});if(cmd==='nitro')this.active.remaining+=cd.value;if(cmd==='repair'){const target=this.car(d.repairCar);this.damageDeck.push(target.damage.pop());this.shuffle(this.damageDeck);}if(cmd==='airstrike'){this.phase='airplace';return;}}
 this.startMove();}
 ignite(c){if(this.operable(c)&&!c.burning){c.burning=true;this.event('fire',`${this.label(c)}著火！`,{car:c.id});}}
 humanAct(id,action,data={}){const player=this.player(id),previous=player?.humanActionThisTurn;if(player&&this.diceCheck?.kind!=='round')player.humanActionThisTurn=true;try{this.act(id,action,data);}catch(error){if(player)player.humanActionThisTurn=previous;throw error;}}
 startMove(){this.phase='move';const c=this.car(this.active?.car);if(c?.burning&&this.operable(c)){this.offerDice({kind:'fire',title:'火焰檢定',condition:'火焰骰可能增加 1／2 點、熄滅，或淘汰車輛（試玩配比）。',owner:c.owner,participants:this.dicePlayers([c]),labels:['火焰骰']},[FIRE_DIE],([face])=>({text:face==='out'?'火焰熄滅':face==='eliminate'?'車輛淘汰':'加速 +'+face,apply:()=>{this.event('fireDie',`${this.label(c)}火焰骰（試玩配比）：${face==='out'?'熄滅':face==='eliminate'?'淘汰':'加速 +'+face}`,{car:c.id,face});if(face==='out')c.burning=false;else if(face==='eliminate')this.eliminate(c,'火焰骰');else this.active.remaining+=face;}}));return;}this.drain();}
 movePath(id,data){
  if(!Number.isSafeInteger(data.version)||data.version!==this.version||data.car!==this.active?.car)throw Error('路線已變更，請依目前車輛與點數重新選擇');
  if(!Number.isInteger(data.x)||!Number.isInteger(data.y)||data.x<0||data.x>=6||Object.hasOwn(data,'path')||Object.hasOwn(data,'route'))throw Error('移動目標不正確；請選擇目前亮起的格子');
  const route=RacePaths.routes(this.view(id)).get(RacePaths.key(data.x,data.y));
  if(!route)throw Error('目前點數無法到達這個格子');
  const active=this.active,c=this.car(active.car),turn=this.turn,from={x:c.x,y:c.y},steps=[];
  let reason='已到達目標',spent=0;
  for(const step of route.path){
   if(this.active!==active||this.turn!==turn||this.phase!=='move'||this.pending||this.diceCheck||!this.operable(c)||active.remaining<=0){reason='移動已結束';break;}
   if(!this.legalMoves().some(v=>v.x===step.x&&v.y===step.y)){reason='位置已改變';break;}
   const cell=this.terrain(step.x,step.y),hidden=!!cell?.hazard&&!cell.hazard.face,remaining=active.remaining,seq=c.moveSeq||0,min=this.boardMin();
   active.remaining=Math.max(0,remaining-this.cost(step.x,step.y));
   this.queue.push({type:'move',id:c.id,x:step.x,y:step.y,normal:true});this.drain();
   spent+=remaining-active.remaining;steps.push({...step});
   if(this.diceCheck||this.pending){reason='請完成擲骰／決定後重新選路';break;}
   if(hidden){reason='已揭露危險，請重新選路';break;}
   if(c.dead||active.stopped){reason='車輛已停止';break;}
   if(this.boardMin()!==min){reason='道路已更新，請重新選路';break;}
   if(c.x!==step.x||c.y!==step.y||(c.moveSeq||0)!==seq+1){reason='地形改變了位置，請重新選路';break;}
   if(this.active!==active||this.turn!==turn||this.phase!=='move'){if(steps.length<route.path.length)reason='移動已結束';break;}
  }
  this.event('movePath',`${this.label(c)}連續移動 ${steps.length} 格 · ${reason}`,{car:c.id,from,to:{x:c.x,y:c.y},steps,cost:spent,target:{x:data.x,y:data.y},reason});
 }
 act(id,action,data={}){if(this.phase==='waiting'||this.phase==='finished')throw Error('比賽尚未開始或已結束');if(this.actor()!==id)throw Error('尚未輪到你操作');const p=this.player(id);
 if(this.diceCheck){const d=this.diceCheck;if(data.check!==d.id)throw Error('這次擲骰已變更，請依目前畫面操作');if(action==='rollDice'&&d.status==='awaiting'){this.rollDice();return;}if(action==='rerollDice'&&d.status==='result'&&d.rerollAllowed){this._diceRoll.rerolls++;d.rerollAllowed=false;this.rollDice();return;}if(action==='acceptDice'&&d.status==='result'){this.acceptDice();return;}throw Error('請先完成擲骰與結果確認');}
 if(this.pending){if(action!=='slam')throw Error('請先選擇是否重擲碰撞骰');const pending=this.pending;this.pending=null;if(data.reroll){pending.topMoves=this.rng(6)<2;pending.direction=this.rng(6);this.event('dice',`${p.name} 重擲碰撞骰：${pending.topMoves?'進入車':'原位車'}向${DIRS[pending.direction]}`);}this.resolveSlam(pending);this.drain();this.touch();return;}
 if(this.phase==='assign'&&action==='begin')this.begin(p,data);
 else if(this.phase==='move'&&action==='movePath')this.movePath(id,data);
 else if(this.phase==='move'&&action==='move'){if(!this.legalMoves().some(v=>v.x===data.x&&v.y===data.y))throw Error('只能前往亮起的前方格子');const c=this.car(this.active.car);this.active.remaining=Math.max(0,this.active.remaining-this.cost(data.x,data.y));this.queue.push({type:'move',id:c.id,x:data.x,y:data.y,normal:true});this.drain();}
 else if(this.phase==='bonus'&&action==='bonus'){if(data.use){this.active.bonusUsed=true;this.active.remaining=this.roadDie;this.phase='move';}else{this.active.bonusUsed=true;this.prepareShot();}}
 else if(this.phase==='airplace'&&action==='airplace'){if(!Number.isInteger(data.x)||!Number.isInteger(data.y)||!this.empty(data.x,data.y))throw Error('直升機只能放在沒有障礙的空格');this.motion('airplace',[{player:p.id,from:p.chopper||{x:data.x,y:this.boardMin()-1},to:{x:data.x,y:data.y}}]);p.chopper={x:data.x,y:data.y,chopper:true};this.event('airstrike',`${p.name} 的直升機抵達戰場`);this.phase='airshoot';if(!this.targets(p.chopper).length)this.startMove();}
 else if(['shoot','airshoot'].includes(this.phase)&&action==='shoot'){const air=this.phase==='airshoot';const source=air?p.chopper:this.car(this.active.car);this.resume=air?'move':'end';if(data.target){const target=this.targets(source).find(c=>c.id===data.target);if(!target){this.resume=null;throw Error('目標不在前方射界');}const from={x:source.x,y:source.y},to={x:target.x,y:target.y};this.offerDice({kind:'shot',title:air?'直升機射擊檢定':'射擊檢定',condition:`骰面包含 ${['S','M','L'][target.size]}（${SIZES[target.size]}）即命中。`,owner:p.id,participants:this.dicePlayers(air?[target]:[source,target]),labels:['射擊骰']},[SHOT_DIE],([face])=>{const hit=face.includes(['S','M','L'][target.size]);return {text:`${this.label(target)}：${hit?'命中！':'未命中'} [${face}]`,apply:()=>{this.event('shot',`${p.name} 射擊${this.label(target)}：${hit?'命中！':'未命中'} [${face}]`,{target:target.id,hit,source:air?null:source.id,owner:p.id,air,from,to});if(hit)this.queue.push({type:'damage',id:target.id});}};});}this.phase='effects';this.drain();}
 else throw Error('現在不能執行這個動作');this.touch();}
 stop(c){c.stopSeq=(c.stopSeq||0)+1;if(this.active?.car===c.id){this.active.remaining=0;this.active.stopped=true;this.active.roadEligible=false;}}
 eliminate(c,why){if(!c||c.dead)return;c.dead=true;c.burning=false;this.stop(c);this.damageDeck.push(...c.damage);c.damage=[];this.shuffle(this.damageDeck);this.event('eliminated',`${this.label(c)}淘汰：${why}`,{car:c.id});}
 advanceBoard(){const old=this.tiles.shift();for(const c of this.cars)if(!c.dead&&c.y<old.start+8)this.eliminate(c,'落在被移除的後方道路');for(const row of old.cells)for(const cell of row)if(cell.hazard)this.hazardDiscard.push(cell.hazard.kind);for(const p of this.players)if(p.chopper&&p.chopper.y<old.start+8)p.chopper=null;this.tileDeck.push({map:old.map,side:1-old.side});this.addTile(this.tileDeck.shift(),this.boardMax());this.tileCount++;this.event('road','道路向前延伸，後方路段已崩落');if(this.players.length===2&&this.tileCount>=5)this.finishAt=this.boardMax();this.checkEnd();}
 moveEffect(e){const c=this.car(e.id);if(!c||c.dead||(e.preplaced&&c.moveSeq!==e.expectedSeq))return;const from=e.from||{x:c.x,y:c.y};const direction=e.direction??(from.x===null?1:[0,1,2,3,4,5].find(d=>{const v=neighbor(from.x,from.y,d);return v.x===e.x&&v.y===e.y;}));if(!e.preplaced&&(from.x!==e.x||from.y!==e.y))this.motion(e.motionKind||'move',[{car:c.id,from,to:{x:e.x,y:e.y}}]);c.moveSeq=(c.moveSeq||0)+1;if(e.x<0||e.x>=6||e.y<this.boardMin()){this.eliminate(c,'衝出賽道');return;}if(e.y>=this.boardMax()){
 if(this.finishAt!==null){if(!c.wreck&&!this.player(c.owner)?.out)this.win(c.owner,'率先衝過終點');else this.eliminate(c,'離開終點');return;}
 // A leap can cross a tile boundary; update each crossed tile in order.
 c.x=e.x;c.y=e.y;while(e.y>=this.boardMax()&&this.phase!=='finished'){this.advanceBoard();if(this.finishAt!==null&&e.y>=this.finishAt){if(!c.wreck&&!this.player(c.owner)?.out)this.win(c.owner,'衝過終點');else this.eliminate(c,'離開終點');return;}}
 }c.x=e.x;c.y=e.y;if(this.phase==='finished')return;const cell=this.terrain(c.x,c.y);if(!cell){this.eliminate(c,'離開道路');return;}
 const revealed=!!cell.hazard&&!cell.hazard.face,knownKind=this.kind(cell);
 if(knownKind==='X'){this.eliminate(c,'撞上不可通行地形');return;}
 this.queue.unshift({type:'collision',id:c.id,normal:e.normal,x:c.x,y:c.y,seq:c.moveSeq});
 if(cell.hazard){const h=cell.hazard;h.face=true;
 this.event('hazard',`${this.label(c)}遇到${HAZARD_NAMES[h.kind]}`,{car:c.id,hazard:h.kind});
 if(['mine','wreck','quake','worm'].includes(h.kind)){this.hazardDiscard.push(h.kind);delete cell.hazard;}
 if(h.kind==='mine'){this.stop(c);this.queue.unshift({type:'damage',id:c.id});}
 if(h.kind==='wreck'){if(this.cars.filter(c=>c.wreck&&!c.dead).length<4)this.cars.push({id:randomUUID(),owner:null,size:0,x:c.x,y:c.y,damage:[],dead:false,wreck:true});this.stop(c);}
 if(h.kind==='oil')this.queue.unshift({type:'dice',run:()=>this.directionCheck(c,'oil','油漬滑移','擲方向骰，車輛往該方向滑移一格。',dir=>this.queue.unshift({type:'move',id:c.id,...neighbor(c.x,c.y,dir),direction:dir,motionKind:'oil'}))});
 if(h.kind==='quake')this.queue.unshift({type:'dice',run:()=>this.directionCheck(c,'quake','地震方向','擲方向骰，所有在賽道上的車輛同步移動一格。',dir=>this.queue.unshift({type:'quake',direction:dir}))});
 if(h.kind==='worm'){const onBoard=this.cars.filter(v=>!v.dead&&v.x!==null);const back=Math.min(...onBoard.map(v=>v.y+(v.x%2)/2));for(const v of onBoard)if(v.y+(v.x%2)/2===back)this.eliminate(v,'沙蟲吞噬最後方車輛');}
 if(h.kind==='pit'&&revealed)this.queue.unshift({type:'dice',run:()=>this.offerDice({kind:'pit',title:'陷阱檢定',condition:`射擊骰包含 ${['S','M','L'][c.size]}（${SIZES[c.size]}）就淘汰；其他骰面可逃過陷阱。`,owner:c.owner,participants:this.dicePlayers([c]),labels:['陷阱射擊骰']},[SHOT_DIE],([face])=>{const hit=face.includes(['S','M','L'][c.size]);return {text:hit?'陷阱命中，車輛淘汰':'逃過陷阱',apply:()=>{this.event('trap',`陷阱射擊骰 [${face}]：${hit?'命中':'逃過陷阱'}`,{car:c.id});if(hit)this.eliminate(c,'陷阱');}};})});
 }
 if(c.dead)return;
 const kind=this.kind(cell);
 // Only the newly revealed mud surcharge was not charged by the caller.
 if(kind==='M'&&knownKind!=='M'){if(e.normal&&this.active?.car===c.id)this.active.remaining=Math.max(0,this.active.remaining-1);if(e.dazedStep){const next=this.queue.find(v=>v.type==='dazed'&&v.id===c.id);if(next)next.remaining--;}}
 if(kind==='G')this.stop(c);
 if(kind==='F')this.ignite(c);
 if(kind==='V'&&direction!==undefined)this.queue.unshift({type:'move',id:c.id,...neighbor(c.x,c.y,direction),direction,motionKind:'glass'});
 if(kind==='J'){if(direction!==1){this.eliminate(c,'從跳台側面或前方進入');return;}this.stop(c);this.queue.unshift({type:'dice',run:()=>this.offerDice({kind:'jump',title:'跳台距離',condition:'特技骰決定跳躍 1–4 格；跳過中間地形，落點仍需處理地形與碰撞。',owner:c.owner,participants:this.dicePlayers([c]),labels:['特技骰']},[STUNT_DIE],([amount])=>({text:`跳躍 ${amount} 格`,apply:()=>{this.event('jump',`${this.label(c)}跳躍 ${amount} 格`,{car:c.id});this.queue.unshift({type:'move',id:c.id,x:c.x,y:c.y+amount,direction:1,motionKind:'jump'});}}))});}
 if(this.active?.car===c.id){if(kind==='S'&&!this.active.coast)this.active.saltBonus=true;if(!this.road(c.x,c.y))this.active.roadEligible=false;}
 }
 quake(direction){
 // Commit every position before resolving any destination. This prevents false slams
 // into spaces being vacated by the same simultaneous translation.
 const moves=this.cars.filter(c=>!c.dead&&c.x!==null).map(c=>({c,from:{x:c.x,y:c.y},to:neighbor(c.x,c.y,direction)}));
 this.motion('quake',moves.map(({c,from,to})=>({car:c.id,from,to})));
 for(const {c,to} of moves){c.x=to.x;c.y=to.y;c.moveSeq=(c.moveSeq||0)+1;}
 this.event('quake',`地震：全部車輛向${DIRS[direction]}同步移動`);
 this.queue.unshift(...moves.map(({c,from,to})=>({type:'move',id:c.id,...to,from,direction,preplaced:true,expectedSeq:c.moveSeq})));
 }

 collision(e){const c=this.car(e.id);if(!c||c.dead||(e.seq!==undefined&&(c.moveSeq!==e.seq||c.x!==e.x||c.y!==e.y)))return;const other=this.occupied(c.x,c.y,c.id);if(!other)return;if(e.normal&&this.active?.car===c.id&&this.active.drift&&!this.active.driftUsed&&this.active.remaining>0){this.active.driftUsed=true;return;}this.stop(c);const large=c.size>other.size?c:other.size>c.size?other:null;this.offerDice({kind:'collision',title:'碰撞對抗',condition:'受推車骰：進入車 2/6、原位車 4/6；方向骰決定推移一格。較大車車主可重擲兩顆一次。',owner:large?.owner||c.owner,participants:this.dicePlayers([c,other]),labels:['受推車骰','方向骰']},[['進入車','進入車','原位車','原位車','原位車','原位車'],DIRS],([who,dir])=>{const slam={top:c.id,bottom:other.id,topMoves:who==='進入車',direction:DIRS.indexOf(dir),owner:large?.owner};return {text:`${this.label(this.car(slam.topMoves?slam.top:slam.bottom))} → ${dir}，推移一格`,slam,rerollAllowed:!!large&&!this.player(large.owner)?.out,apply:()=>{this.event('slam',`${this.label(c)}撞上${this.label(other)}：${who}向${dir}`,{car:c.id,other:other.id,x:c.x,y:c.y});this.resolveSlam(slam);}};});}
 directionCheck(c,kind,title,condition,apply){this.offerDice({kind,title,condition,owner:c.owner,participants:this.dicePlayers([c]),labels:['方向骰']},[DIRS],([dir])=>({text:`方向：${dir}`,apply:()=>apply(DIRS.indexOf(dir))}));}
 resolveSlam(s){const c=this.car(s.topMoves?s.top:s.bottom);if(!c||c.dead)return;this.queue.unshift({type:'move',id:c.id,...neighbor(c.x,c.y,s.direction),direction:s.direction,motionKind:'slam'});}
 damage(e){const c=this.car(e.id);if(!c||c.dead)return;if(c.wreck){this.eliminate(c,'殘骸被擊毀');return;}if(c.damage.length+(c.pendingDamage||0)>=2)return;this.stop(c);const token=this.damageDeck.pop()||'dent';const kind=token.startsWith('skid')?'skid':token;
 this.event('damage',`${this.label(c)}受損：${DAMAGE_NAMES[kind]}`,{car:c.id,damage:kind});
 // Reserve capacity separately; the car becomes inoperable only after its effect resolves.
 c.pendingDamage=(c.pendingDamage||0)+1;this.queue.unshift({type:'finishDamage',id:c.id,token});
 if(kind==='fire')this.ignite(c);
 if(kind==='skid')this.queue.unshift({type:'move',id:c.id,...neighbor(c.x,c.y,Number(token.slice(4))),direction:Number(token.slice(4)),motionKind:'skid'});
 else if(kind==='dazed')this.queue.unshift({type:'dice',run:()=>this.offerDice({kind:'dazed',title:'暈頭轉向距離',condition:'特技骰決定移動點數；每一步另擲方向骰，泥地仍多花一點。',owner:c.owner,participants:this.dicePlayers([c]),labels:['特技骰']},[STUNT_DIE],([amount])=>({text:`失控移動 ${amount} 點`,apply:()=>this.queue.unshift({type:'dazed',id:c.id,remaining:amount,stopSeq:c.stopSeq||0})}))});
 else if(kind==='blast')this.queue.unshift({type:'dice',run:()=>this.offerDice({kind:'blast',title:'爆炸拋飛',condition:'方向骰與特技骰決定拋飛方向及 1–4 格距離；跳過中間格子。',owner:c.owner,participants:this.dicePlayers([c]),labels:['方向骰','特技骰']},[DIRS,STUNT_DIE],([direction,amount])=>({text:`向${direction}拋飛 ${amount} 格`,apply:()=>{const dir=DIRS.indexOf(direction);let v={x:c.x,y:c.y};for(let i=0;i<amount;i++)v=neighbor(v.x,v.y,dir);this.queue.unshift({type:'move',id:c.id,...v,direction:dir,motionKind:'blast'});}}))});
 else if(kind==='shrapnel')this.queue.unshift({type:'dice',run:()=>this.directionCheck(c,'shrapnel','碎片飛散','方向骰決定碎片方向，擊中路徑上第一輛車並造成損傷。',dir=>{let v={x:c.x,y:c.y};for(let i=0;i<100;i++){v=neighbor(v.x,v.y,dir);if(v.x<0||v.x>=6||v.y<this.boardMin()||v.y>=this.boardMax())break;const target=this.occupied(v.x,v.y);if(target){this.queue.unshift({type:'damage',id:target.id});break;}}})});
 }
 drain(){let safety=0;while(this.queue.length&&!this.pending&&!this.diceCheck&&this.phase!=='finished'){if(++safety>500)throw Error('效果鏈過長');const e=this.queue.shift();if(e.type==='dice')e.run();else if(e.type==='move')this.moveEffect(e);else if(e.type==='collision')this.collision(e);else if(e.type==='damage')this.damage(e);else if(e.type==='quake')this.quake(e.direction);else if(e.type==='finishDamage'){const c=this.car(e.id);c.pendingDamage=Math.max(0,(c.pendingDamage||0)-1);if(c.dead){this.damageDeck.push(e.token);this.shuffle(this.damageDeck);}else{c.damage.push(e.token);if(c.damage.length>=2)c.burning=false;}}else if(e.type==='dazed'){const c=this.car(e.id);if(!c||c.dead||e.remaining<=0||(c.stopSeq||0)!==e.stopSeq)continue;this.directionCheck(c,'dazed-step','暈頭轉向方向','擲方向骰決定這一步的移動方向。碰撞、停止地形或離開道路仍照常處理。',direction=>{const pos=neighbor(c.x,c.y,direction),remaining=e.remaining-this.cost(pos.x,pos.y),stops=this.occupied(pos.x,pos.y,c.id)||['mine','wreck'].includes(this.terrain(pos.x,pos.y)?.hazard?.kind);if(!stops&&remaining>0)this.queue.unshift({type:'dazed',id:c.id,remaining,stopSeq:c.stopSeq||0});this.queue.unshift({type:'move',id:c.id,...pos,direction,dazedStep:true,motionKind:'dazed'});});}}
 if(this.phase==='finished'||this.pending||this.diceCheck)return;this.checkEnd();if(this.phase==='finished')return;
 if(this.phase==='effects'){const resume=this.resume;this.resume=null;if(resume==='end'){this.endTurn();return;}this.startMove();return;}
 if(this.phase==='move'){const c=this.car(this.active?.car);if(!c||!this.operable(c)||this.active.remaining<=0){if(c&&this.operable(c)&&(this.active.roadEligible||this.active.saltBonus)&&!this.active.bonusUsed&&!this.active.stopped)this.phase='bonus';else this.prepareShot();}}
 }
 prepareShot(){this.phase='shoot';if(!this.targets(this.car(this.active?.car)).length)this.endTurn();}
 checkEnd(){for(const p of this.players)if(!p.out&&!this.cars.some(c=>c.owner===p.id&&this.operable(c))){p.out=true;p.chopper=null;this.finishAt=this.boardMax();this.event('out',`${p.name} 全車失能，終點線出現！`);}const alive=this.players.filter(p=>!p.out);if(alive.length===1)this.win(alive[0].id,'最後存活的車隊');else if(!alive.length){this.phase='finished';this.winner={id:null,name:'無人生還',reason:'所有車隊同時失去行動能力'};this.queue=[];this.pending=null;this.clearDice();}}
 win(id,reason){this.winner={id,name:this.player(id)?.name||'車隊',reason};this.phase='finished';this.queue=[];this.pending=null;this.clearDice();this.event('win',`${this.winner.name} 獲勝：${reason}`);}
 endTurn(){for(const c of this.cars)if(!c.dead&&this.players.some(p=>p.chopper?.x===c.x&&p.chopper?.y===c.y))this.eliminate(c,'停在直升機下方');this.checkEnd();if(this.phase==='finished')return;const player=this.players[this.turn];if(player.humanActionThisTurn)player.completedHumanTurn=true;player.humanActionThisTurn=false;player.turns++;this.active=null;const next=this.next(this.turn,p=>!p.out&&p.turns<3);if(next===-1)this.newRound();else{this.turn=next;this.phase='assign';this.touch();}}
 auto(){const id=this.actor(),p=this.player(id);if(!p||['waiting','finished'].includes(this.phase))return;
 if(this.diceCheck){const d=this.diceCheck;if(d.status==='rolling'){this.advanceDice();return;}if(d.status==='awaiting'){this.act(id,'rollDice',{check:d.id});return;}const s=this._diceRoll.slam,c=s&&this.car(s.topMoves?s.top:s.bottom),to=c&&neighbor(c.x,c.y,s.direction),bad=c&&c.owner===id&&(to.x<0||to.x>=6||to.y<this.boardMin()||this.terrain(to.x,to.y)?.kind==='X');this.act(id,bad&&d.rerollAllowed?'rerollDice':'acceptDice',{check:d.id});return;}
 if(this.pending){const s=this.pending,c=this.car(s.topMoves?s.top:s.bottom),to=neighbor(c.x,c.y,s.direction),bad=c.owner===id&&(to.x<0||to.x>=6||to.y<this.boardMin()||this.terrain(to.x,to.y)?.kind==='X');this.act(id,'slam',{reroll:bad});return;}
 if(this.phase==='assign'){const available=this.available(p).sort((a,b)=>a.y-b.y),c=available[0],dice=p.dice.map((d,i)=>({...d,i})).filter(d=>!d.used).sort((a,b)=>b.value-a.value);if(!c||!dice.length){this.endTurn();return;}const input={car:c.id,die:dice[0].i};const damaged=this.cars.find(c=>c.owner===id&&!c.dead&&c.damage.length);const repair=dice.slice(1).find(d=>d.value===6),nitro=dice.slice(1).find(d=>d.value<=3);if(!c.moved&&!p.commandUsed){if(damaged&&repair)Object.assign(input,{command:'repair',commandDie:repair.i,repairCar:damaged.id});else if(nitro)Object.assign(input,{command:'nitro',commandDie:nitro.i});}this.act(id,'begin',input);}
 else if(this.phase==='move'){const options=this.legalMoves();const rank=v=>{const cell=this.terrain(v.x,v.y),occupant=this.occupied(v.x,v.y),heli=this.players.some(p=>p.chopper?.x===v.x&&p.chopper?.y===v.y);return (cell?.kind==='X'?-1000:0)+(occupant?-12:0)+(heli&&this.active.remaining<=1?-500:0)+(this.road(v.x,v.y)?4:0)-(cell?.hazard?3:0)-(this.cost(v.x,v.y)-1)*2+v.y*.05;};options.sort((a,b)=>rank(b)-rank(a));this.act(id,'move',options[0]);}
 else if(this.phase==='bonus')this.act(id,'bonus',{use:true});
 else if(this.phase==='shoot'||this.phase==='airshoot'){const targets=this.targets(this.phase==='airshoot'?p.chopper:this.car(this.active.car)).filter(c=>c.owner!==id);targets.sort((a,b)=>b.size-a.size);this.act(id,'shoot',{target:targets[0]?.id});}
 else if(this.phase==='airplace'){outer:for(let y=this.boardMax()-1;y>=this.boardMin();y--)for(let x=0;x<6;x++)if(this.empty(x,y)){this.act(id,'airplace',{x,y});break outer;}}
 }
 view(id){const masked=this.diceCheck?.kind==='round',blocked=!!this.diceCheck,check=this.diceCheck?JSON.parse(JSON.stringify(this.diceCheck)):null;if(check)check.serverNow=Date.now();return {options:{...this.options},type:this.type,code:this.code,name:this.name,phase:this.phase,round:this.round,turn:masked?-1:this.turn,first:masked?-1:this.first,roadDie:masked?null:this.roadDie,deadline:this.deadline,version:this.version,host:this.host===id,me:id,actor:this.actor(),active:this.active,pending:this.pending,diceCheck:check,finishAt:this.finishAt,tileCount:this.tileCount,winner:this.winner,legalMoves:this.phase==='move'&&!this.pending&&!blocked?this.legalMoves():[],targets:['shoot','airshoot'].includes(this.phase)&&!this.pending&&!blocked?this.targets(this.phase==='airshoot'?this.players[this.turn].chopper:this.car(this.active?.car)).map(c=>c.id):[],available:this.phase==='assign'&&!blocked?this.available(this.player(id)||{id:null}).map(c=>c.id):[],players:this.players.map(({secret,lastSeen,...p})=>({...p,dice:masked?[]:p.dice.map(d=>({...d})),online:p.bot||Date.now()-lastSeen<15000})),cars:this.cars.map(c=>({...c,damage:c.damage.map(()=>true)})),tiles:this.tiles.map(t=>({...t,cells:t.cells.map(row=>row.map(c=>({...c,...(c.hazard?{hazard:c.hazard.face?c.hazard:{face:false,kind:'unknown'}}:{})})))})),log:this.log,events:this.events,motions:this.motions.map(group=>({id:group.id,kind:group.kind,moves:group.moves.map(move=>({...move,from:{...move.from},to:{...move.to}}))}))};}
}
module.exports={ThunderRoom,neighbor,ROAD_DIE,STUNT_DIE,SHOT_DIE,MAPS,DEVIL_MAPS,FIRE_DIE};
