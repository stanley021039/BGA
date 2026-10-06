const {test}=require('node:test'),assert=require('node:assert/strict'),{ThunderRoom}=require('../src/games/thunder'),{createScenario,act,outcome}=require('../src/games/tutorial'),{revealDice,settleDice,autoStep}=require('./helpers/race-dice');
test('round hides four dice, road bonus and first player until the shared reveal',()=>{
 const r=new ThunderRoom('T','T');for(let i=0;i<4;i++)r.add('P'+i);r.start();const id=r.diceCheck.id,version=r.version;
 for(const p of r.players){const v=r.view(p.id);assert.equal(v.diceCheck.status,'rolling');assert.equal(v.diceCheck.result,undefined);assert.ok(v.players.every(p=>p.dice.length===0));assert.equal(v.roadDie,null);assert.equal(v.turn,-1);assert.equal(v.first,-1);assert.equal(v.actor,r.host);assert.deepEqual(v.available,[]);assert.ok(!v.events.some(e=>e.kind==='round'));}
 assert.equal(r.diceCheck.dice.length,17);assert.equal(r.advanceDice(r.diceCheck.readyAt-1),false);assert.equal(r.version,version);assert.throws(()=>r.act(r.actor(),'acceptDice',{check:id}));
 assert.equal(r.advanceDice(r.diceCheck.readyAt),true);const a=r.view(r.players[0].id),b=r.view(r.players[1].id);assert.deepEqual(a.diceCheck.result,b.diceCheck.result);assert.equal(a.diceCheck.result.faces.length,17);assert.ok(a.players.every(p=>p.dice.length===0));assert.equal(a.first,-1);assert.ok(r.players[r.first].dice.reduce((n,d)=>n+d.value,0)<Math.min(...r.players.filter((_,i)=>i!==r.first).map(p=>p.dice.reduce((n,d)=>n+d.value,0))));
 r.humanAct(r.actor(),'acceptDice',{check:id});assert.equal(r.player(r.host).humanActionThisTurn,false);assert.equal(r.diceCheck,null);assert.equal(r.view(r.host).players[0].dice.length,4);assert.equal(r.view(r.host).first,r.first);assert.ok(r.events.some(e=>e.kind==='round'));r.newRound();assert.equal(r.view(r.host).players[0].dice.length,0);assert.equal(r.diceCheck.status,'rolling');
});
test('shoot has a known condition, rolls only on button, and applies damage only after acceptance',()=>{
 const s=createScenario(3);act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});let rolls=0;s.r.roll=()=>{rolls++;return 'L';};act(s,'shoot',{target:s.target.id});const d=s.r.diceCheck;
 assert.match(d.condition,/L（重型）/);assert.equal(rolls,0);assert.equal(s.target.damage.length,0);assert.deepEqual(s.r.view(s.q.id).targets,[]);assert.equal(s.result,null);
 assert.throws(()=>s.r.act(s.q.id,'rollDice',{check:d.id}));assert.throws(()=>s.r.act(s.p.id,'rollDice',{check:d.id+1}));assert.throws(()=>s.r.act(s.p.id,'shoot',{target:s.target.id}));
 act(s,'rollDice',{check:d.id});assert.equal(rolls,1);assert.equal(s.r.view(s.q.id).diceCheck.result,undefined);assert.ok(!s.r.events.some(e=>e.kind==='shot'));assert.throws(()=>act(s,'rollDice',{check:d.id}));assert.throws(()=>act(s,'acceptDice',{check:d.id}));
 s.r.auto();assert.equal(d.status,'rolling');s.r.advanceDice(d.readyAt);assert.equal(d.status,'result');assert.equal(s.target.damage.length,0);assert.equal(outcome(s),null);assert.deepEqual(s.r.view(s.p.id).diceCheck.result,s.r.view(s.q.id).diceCheck.result);
 act(s,'acceptDice',{check:d.id});assert.equal(s.target.damage.length,1);assert.equal(s.result.ok,true);assert.throws(()=>act(s,'acceptDice',{check:d.id}));assert.equal(rolls,1);
});
test('collision shows both vehicles and allows exactly one joint reroll',()=>{
 const s=createScenario(2);act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});const d=s.r.diceCheck;assert.equal(d.kind,'collision');assert.equal(d.participants.length,2);assert.equal(d.dice.length,2);assert.equal(d.owner,s.p.id);assert.match(d.condition,/2\/6/);assert.equal(s.r.active.remaining,0);
 revealDice(s.r);assert.equal(d.rerollAllowed,true);assert.notEqual(d.result.faces[1],undefined);act(s,'rerollDice',{check:d.id});assert.equal(d.status,'rolling');assert.equal(d.result,undefined);s.r.advanceDice(d.readyAt);assert.equal(d.rerollAllowed,false);assert.throws(()=>act(s,'rerollDice',{check:d.id}));act(s,'acceptDice',{check:d.id});assert.notDeepEqual({x:s.car.x,y:s.car.y},{x:s.target.x,y:s.target.y});assert.equal(s.result.ok,true);
});
test('equal-sized vehicles and wrecks settle without granting a reroll',()=>{
 for(const wreck of [false,true]){const s=createScenario(2);s.target.size=s.car.size;if(wreck){Object.assign(s.r.cars.find(c=>c.owner===s.q.id&&c.id!==s.target.id),{dead:false,x:4,y:18});s.target.wreck=true;s.target.owner=null;}act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});revealDice(s.r);assert.equal(s.r.diceCheck.rerollAllowed,false);settleDice(s.r);assert.ok(!s.r.diceCheck);}
});
test('kicked owner becomes AI and can finish a waiting check',()=>{
 const s=createScenario(3);s.r.host=s.q.id;act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});act(s,'shoot',{target:s.target.id});s.r.kick(s.q.id,s.p.id);assert.equal(s.r.player(s.r.actor()).bot,true);autoStep(s.r);assert.equal(s.r.diceCheck.status,'rolling');autoStep(s.r);assert.equal(s.r.diceCheck.status,'result');autoStep(s.r);assert.equal(s.target.damage.length,1);
});
test('server scheduler reveals human dice on time through a history transaction',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),s=createScenario(3);act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});act(s,'shoot',{target:s.target.id});act(s,'rollDice',{check:s.r.diceCheck.id});const callbacks=[],operations=[];let now=s.r.diceCheck.readyAt-1;
 const scope={require:()=>({expireEmptyRooms(){}}),module:{exports:{}},console,Date:{now:()=>now},setInterval:fn=>{callbacks.push(fn);return {unref(){}};},clearInterval(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/rooms/scheduler'),'utf8'),scope);scope.module.exports.startRoomScheduler({rooms:new Map([['T',s.r]]),history:{transact(r,op,run){operations.push(op);return run();}}});callbacks[1]();assert.equal(s.r.diceCheck.status,'rolling');now++;callbacks[1]();assert.equal(s.r.diceCheck.status,'result');assert.equal(operations[0].action,'revealDice');assert.equal(operations[0].source,'timer');assert.equal(s.target.damage.length,0);
});
