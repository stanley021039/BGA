const {test}=require('node:test'),assert=require('node:assert/strict');
const {createScenario,act}=require('../src/games/tutorial');
const {settleDice}=require('./helpers/race-dice');
test('browser teaching table embeds the same action events as the server engine',()=>{
 const fs=require('node:fs'),engine=fs.readFileSync(require.resolve('../src/games/thunder'),'utf8').replaceAll('\r\n','\n').trim();
 const html=fs.readFileSync(require.resolve('../public/race.html'),'utf8').replaceAll('\r\n','\n');
 assert.ok(html.includes(engine),'Teaching table engine must be synchronized when public events change');
});
test('action events identify the actual vehicle and repair target without leaking secrets',()=>{
 const s=createScenario(4);act(s,'begin',{car:s.car.id,die:0,command:'repair',commandDie:1,repairCar:s.ally.id});
 const events=s.r.view(s.p.id).events,command=events.find(e=>e.kind==='command'),assign=events.find(e=>e.kind==='assign');
 assert.equal(assign.car,s.car.id);assert.equal(command.car,s.car.id);assert.equal(command.target,s.ally.id);assert.equal(command.command,'repair');
 assert.ok(!JSON.stringify(events).includes(s.p.secret));assert.ok(!JSON.stringify(events).includes(s.q.secret));
});
test('shot endpoints preserve the positions at firing even when skid damage moves the target',()=>{
 const s=createScenario(3);act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});
 s.r.damageDeck=['skid1'];act(s,'shoot',{target:s.target.id});settleDice(s.r);
 const shot=s.r.view(s.p.id).events.find(e=>e.kind==='shot');
 assert.equal(shot.source,s.car.id);assert.equal(shot.target,s.target.id);assert.equal(shot.air,false);assert.equal(shot.hit,true);
 assert.deepEqual(shot.from,{x:2,y:2});assert.deepEqual(shot.to,{x:2,y:3});assert.equal(s.target.y,4);
 assert.ok(s.r.events.some(e=>e.kind==='damage'&&e.damage==='skid'&&e.car===s.target.id));
});
test('airstrike bullet originates at the helicopter, without inventing a car source',()=>{
 const s=createScenario(3);act(s,'begin',{car:s.car.id,die:0,command:'airstrike',commandDie:1});act(s,'airplace',{x:2,y:2});
 act(s,'shoot',{target:s.target.id});settleDice(s.r);const shot=s.r.events.find(e=>e.kind==='shot');
 assert.equal(shot.air,true);assert.equal(shot.source,null);assert.deepEqual(shot.from,{x:2,y:2});assert.deepEqual(shot.to,{x:2,y:3});
});
test('accepted event snapshots preserve shot deltas when the browser lesson mutates its engine',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../public/race.js'),'utf8'),scope={};
 const start=source.indexOf('function snapshotRaceState('),end=source.indexOf('\nfunction render(',start);vm.runInNewContext(source.slice(start,end),scope);
 const s=createScenario(3);act(s,'begin',{car:s.car.id,die:0});act(s,'move',{x:2,y:2});
 const previous=scope.snapshotRaceState(s.r.view(s.p.id)),latestId=previous.events.at(-1).id;
 act(s,'shoot',{target:s.target.id});settleDice(s.r);const next=s.r.view(s.p.id),delta=next.events.filter(e=>e.id>previous.events.at(-1).id);
 assert.equal(previous.events.at(-1).id,latestId);assert.ok(delta.some(e=>e.kind==='shot'));assert.ok(delta.some(e=>e.kind==='damage'));
});
