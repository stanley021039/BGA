const {test}=require('node:test'),assert=require('node:assert/strict');
const {ThunderRoom,neighbor}=require('../src/games/thunder');
const {createScenario,act}=require('../src/games/tutorial');
const {settleDice,revealDice}=require('./helpers/race-dice');

function scenario(){
 const s=createScenario(5);
 for(const t of s.r.tiles)for(const row of t.cells)for(const c of row){c.kind='O';delete c.hazard;}
 return s;
}
const point=c=>({x:c.x,y:c.y});
const carMoves=(s)=>s.r.view(s.p.id).motions.flatMap(group=>group.moves.filter(move=>move.car===s.car.id).map(move=>({kind:group.kind,from:move.from,to:move.to})));
function begin(s){act(s,'begin',{car:s.car.id,die:0});}

test('glass records every ordered displacement, including intermediate positions absent from final state and log',()=>{
 const s=scenario();s.r.terrain(2,2).kind='V';s.r.terrain(2,3).kind='V';begin(s);act(s,'move',{x:2,y:2});
 assert.deepEqual(carMoves(s),[
  {kind:'move',from:{x:2,y:1},to:{x:2,y:2}},
  {kind:'glass',from:{x:2,y:2},to:{x:2,y:3}},
  {kind:'glass',from:{x:2,y:3},to:{x:2,y:4}}
 ]);
 assert.equal(s.r.events.some(event=>event.kind==='motion'),false);
 assert.deepEqual(point(s.car),{x:2,y:4});assert.equal(s.r.active.remaining,2);
});

test('collision journal shows approach before the check and the explicit accepted push even when it returns to the origin',()=>{
 const s=scenario();s.target.x=2;s.target.y=2;
 s.r.roll=faces=>faces.includes('進入車')?'進入車':faces.includes('後方')?'後方':faces[0];
 begin(s);act(s,'move',{x:2,y:2});
 assert.equal(s.r.diceCheck.kind,'collision');assert.equal(s.r.diceCheck.status,'awaiting');
 assert.deepEqual(carMoves(s),[{kind:'move',from:{x:2,y:1},to:{x:2,y:2}}]);
 revealDice(s.r);assert.equal(s.r.diceCheck.status,'result');assert.equal(carMoves(s).length,1);
 act(s,'acceptDice',{check:s.r.diceCheck.id});
 assert.deepEqual(carMoves(s),[
  {kind:'move',from:{x:2,y:1},to:{x:2,y:2}},
  {kind:'slam',from:{x:2,y:2},to:{x:2,y:1}}
 ]);
 assert.deepEqual(point(s.car),{x:2,y:1});assert.deepEqual(point(s.target),{x:2,y:2});
});

test('quake records all 12 cars in one simultaneous group and does not replay its preplaced landings',()=>{
 const r=new ThunderRoom('MOTION','地震測試');for(let i=0;i<4;i++)r.add('車隊 '+i);r.start();settleDice(r);
 for(const t of r.tiles)for(const row of t.cells)for(const c of row){c.kind='O';delete c.hazard;}
 r.cars.forEach((c,i)=>Object.assign(c,{x:i%6,y:2+Math.floor(i/6)*6}));
 const before=r.cars.map(c=>({car:c.id,from:point(c),to:neighbor(c.x,c.y,1)}));
 r.quake(1);r.drain();
 assert.equal(r.motions.length,1);assert.equal(r.motions[0].kind,'quake');assert.deepEqual(r.motions[0].moves,before);
 assert.ok(r.cars.every(c=>!c.dead));assert.equal(r.diceCheck,null);
 // A later effect invalidating a queued preplaced landing cannot invent motion.
 const c=r.cars[0],count=r.motionSerial;c.moveSeq++;
 r.moveEffect({id:c.id,x:c.x,y:c.y,from:{x:0,y:2},preplaced:true,expectedSeq:c.moveSeq-1});
 assert.equal(r.motionSerial,count);
});

test('jump and blast expose attempted endpoints only after the explicit result is accepted, without inventing intermediate terrain checks',()=>{
 const jump=scenario();jump.r.terrain(2,2).kind='J';jump.r.terrain(2,3).kind='X';jump.r.roll=()=>3;
 begin(jump);act(jump,'move',{x:2,y:2});assert.equal(jump.r.diceCheck.kind,'jump');assert.equal(carMoves(jump).length,1);
 revealDice(jump.r);assert.equal(carMoves(jump).length,1);act(jump,'acceptDice',{check:jump.r.diceCheck.id});
 assert.deepEqual(carMoves(jump).at(-1),{kind:'jump',from:{x:2,y:2},to:{x:2,y:5}});assert.equal(jump.car.dead,false);
 const blast=scenario();blast.r.damageDeck=['blast'];blast.r.roll=faces=>faces.includes('前方')?'前方':3;
 blast.r.damage({id:blast.car.id});blast.r.drain();assert.equal(blast.r.diceCheck.kind,'blast');assert.equal(carMoves(blast).length,0);
 settleDice(blast.r);assert.deepEqual(carMoves(blast),[{kind:'blast',from:{x:2,y:1},to:{x:2,y:4}}]);
});

test('oil, skid and each dazed step retain their movement causes and actual order',()=>{
 const oil=scenario();oil.r.terrain(2,2).hazard={kind:'oil',face:false};oil.r.roll=faces=>faces.includes('前方')?'前方':faces[0];
 begin(oil);act(oil,'move',{x:2,y:2});assert.equal(oil.r.diceCheck.kind,'oil');assert.equal(carMoves(oil).length,1);settleDice(oil.r);
 assert.deepEqual(carMoves(oil).at(-1),{kind:'oil',from:{x:2,y:2},to:{x:2,y:3}});
 const skid=scenario();skid.r.damageDeck=['skid1'];skid.r.damage({id:skid.car.id});skid.r.drain();
 assert.deepEqual(carMoves(skid),[{kind:'skid',from:{x:2,y:1},to:{x:2,y:2}}]);
 const dazed=scenario();dazed.r.damageDeck=['dazed'];dazed.r.roll=faces=>typeof faces[0]==='number'?2:'前方';
 dazed.r.damage({id:dazed.car.id});dazed.r.drain();settleDice(dazed.r);
 assert.deepEqual(carMoves(dazed),[
  {kind:'dazed',from:{x:2,y:1},to:{x:2,y:2}},
  {kind:'dazed',from:{x:2,y:2},to:{x:2,y:3}}
 ]);
});

test('roadside exit, fatal terrain and crossing the existing finish keep the attempted displacement even when authoritative coordinates do not change',()=>{
 const side=scenario();side.car.x=0;side.r.moveEffect({id:side.car.id,x:-1,y:1,direction:0});
 assert.equal(side.car.dead,true);assert.deepEqual(point(side.car),{x:0,y:1});assert.deepEqual(carMoves(side),[{kind:'move',from:{x:0,y:1},to:{x:-1,y:1}}]);
 const obstacle=scenario();obstacle.r.terrain(2,2).kind='X';begin(obstacle);act(obstacle,'move',{x:2,y:2});
 assert.equal(obstacle.car.dead,true);assert.deepEqual(carMoves(obstacle),[{kind:'move',from:{x:2,y:1},to:{x:2,y:2}}]);
 const finish=scenario();finish.car.y=23;finish.r.finishAt=24;finish.r.moveEffect({id:finish.car.id,x:2,y:24,direction:1});
 assert.equal(finish.r.phase,'finished');assert.equal(finish.r.winner.id,finish.p.id);assert.equal(finish.car.y,23);
 assert.deepEqual(carMoves(finish),[{kind:'move',from:{x:2,y:23},to:{x:2,y:24}}]);
});

test('airstrike deployment records public helicopter identity and its entrance or previous position',()=>{
 for(const previous of [null,{x:1,y:5,chopper:true}]){
  const s=scenario();s.p.chopper=previous;
  act(s,'begin',{car:s.car.id,die:0,command:'airstrike',commandDie:1});act(s,'airplace',{x:4,y:10});
  assert.deepEqual(s.r.view(s.p.id).motions,[{id:1,kind:'airplace',moves:[{player:s.p.id,from:previous?{x:1,y:5}:{x:4,y:-1},to:{x:4,y:10}}]}]);
  assert.deepEqual(s.p.chopper,{x:4,y:10,chopper:true});
 }
});

test('garage entry, ordinary one-cell movement and multi-cell movement all use the same ordered journal',()=>{
 const s=scenario();s.car.x=null;s.car.y=-1;begin(s);
 s.r.act(s.p.id,'move',{x:2,y:0});
 s.r.act(s.p.id,'movePath',{version:s.r.version,car:s.car.id,x:2,y:2});
 assert.deepEqual(carMoves(s),[
  {kind:'move',from:{x:null,y:-1},to:{x:2,y:0}},
  {kind:'move',from:{x:2,y:0},to:{x:2,y:1}},
  {kind:'move',from:{x:2,y:1},to:{x:2,y:2}}
 ]);
 assert.equal(s.r.events.at(-1).kind,'movePath');
});

test('journal adds no version or log updates, exposes no secrets, and every view is a deep copy',()=>{
 const s=scenario(),version=s.r.version,log=JSON.stringify(s.r.log),events=JSON.stringify(s.r.events);
 s.r.moveEffect({id:s.car.id,x:2,y:2,direction:1});
 assert.equal(s.r.version,version);assert.equal(JSON.stringify(s.r.log),log);assert.equal(JSON.stringify(s.r.events),events);
 const expected=JSON.parse(JSON.stringify(s.r.motions)),view=s.r.view(s.p.id);
 assert.ok(!JSON.stringify(view.motions).includes(s.p.secret));assert.ok(!JSON.stringify(view.motions).includes(s.q.secret));
 assert.deepEqual(Object.keys(view.motions[0]).sort(),['id','kind','moves']);assert.deepEqual(Object.keys(view.motions[0].moves[0]).sort(),['car','from','to']);
 view.motions[0].kind='changed';view.motions[0].moves[0].from.x=99;view.motions[0].moves[0].to.y=99;view.motions[0].moves.push({car:'other'});view.motions.push({});
 assert.deepEqual(s.r.motions,expected);assert.deepEqual(s.r.view(s.q.id).motions,expected);
});

test('journal evicts whole oldest groups at both bounds and keeps serials monotonic across a restart',()=>{
 const s=scenario();for(let i=0;i<150;i++){s.r.moveEffect({id:s.car.id,x:2,y:i%2?1:2,direction:i%2?4:1});s.r.drain();}
 assert.equal(s.r.motions.length,64);assert.equal(s.r.motions[0].id,87);assert.equal(s.r.motions.at(-1).id,150);
 // Six transfers per quake must be evicted together, not split or reordered.
 s.r.motions=[];s.r.cars.forEach((c,i)=>Object.assign(c,{dead:false,x:i%6,y:4}));
 for(let i=0;i<25;i++){s.r.quake(i%2?4:1);s.r.drain();}
 assert.equal(s.r.motions.length,21);assert.equal(s.r.motions.reduce((sum,group)=>sum+group.moves.length,0),126);
 assert.ok(s.r.motions.every(group=>group.kind==='quake'&&group.moves.length===6));
 const last=s.r.motionSerial;s.r.phase='finished';s.r.start();settleDice(s.r);assert.deepEqual(s.r.motions,[]);assert.equal(s.r.motionSerial,last);
 const c=s.r.cars[0];s.r.moveEffect({id:c.id,x:2,y:0,normal:true});assert.equal(s.r.motions[0].id,last+1);
});

test('removed, dead and stale preplaced cars cannot add misleading journal entries',()=>{
 const s=scenario();s.car.moveSeq=4;
 s.r.moveEffect({id:'missing',x:2,y:2});
 s.r.moveEffect({id:s.car.id,x:2,y:2,preplaced:true,expectedSeq:3});
 s.car.dead=true;s.r.moveEffect({id:s.car.id,x:2,y:2});assert.deepEqual(s.r.motions,[]);assert.equal(s.r.motionSerial,0);
});
