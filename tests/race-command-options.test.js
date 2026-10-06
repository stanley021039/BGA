const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createScenario}=require('../src/games/tutorial');
const source=fs.readFileSync(require.resolve('../public/race.js'),'utf8'),scope={};
vm.runInNewContext(source.slice(source.indexOf('function commandAccepts('),source.indexOf('const usedCommandHistory=')),scope);
test('command options exclude used or incompatible dice and require a second unused die',()=>{
 const {p,r,car}=createScenario(0);p.dice=[{value:6,used:false},{value:6,used:false},{value:2,used:true},{value:4,used:true}];
 for(const kind of ['nitro','drift'])assert.ok(scope.commandUnavailableReason(kind,p,r.cars,car));
 assert.equal(scope.commandUnavailableReason('airstrike',p,r.cars,car),'');
 assert.match(scope.commandOptionsMarkup(p,r.cars,car,''),/value="nitro"[^>]*disabled/);
 p.dice[1].used=true;assert.ok(scope.commandUnavailableReason('airstrike',p,r.cars,car));
 p.dice[1].used=false;car.moved=true;assert.ok(scope.commandUnavailableReason('airstrike',p,r.cars,car));
 car.moved=false;p.commandUsed=true;assert.ok(scope.commandUnavailableReason('airstrike',p,r.cars,car));
});
test('repair requires a surviving damaged own car, including a disabled teammate',()=>{
 const {p,r,car,ally,target}=createScenario(4);
 assert.equal(scope.commandUnavailableReason('repair',p,r.cars,car),'');
 ally.damage=[];target.dead=false;target.damage=['dent'];assert.ok(scope.commandUnavailableReason('repair',p,r.cars,car));
 ally.damage=['dent'];ally.dead=true;assert.ok(scope.commandUnavailableReason('repair',p,r.cars,car));
 ally.dead=false;assert.equal(scope.commandUnavailableReason('repair',p,r.cars,car),'');
 r.begin(p,{car:car.id,die:0,command:'repair',commandDie:1,repairCar:ally.id});assert.equal(ally.damage.length,0);
});
test('a command can swap the movement die to preserve the only compatible die and passes engine validation',()=>{
 const {p,r,car}=createScenario(5);p.dice=[{value:2,used:false},{value:5,used:false},{value:6,used:true},{value:4,used:true}];
 const choice=scope.normalizeCommandSelection(p,r.cars,car,0,'nitro',null);
 assert.equal(choice.die,1);assert.equal(choice.commandDie,0);
 r.begin(p,{car:car.id,...choice});assert.equal(r.active.remaining,7);assert.equal(p.dice.filter(d=>d.used).length,4);
});
test('state changes discard stale commands and recover an unused movement die',()=>{
 const {p,r,car}=createScenario(0);p.dice=[{value:6,used:true},{value:6,used:false},{value:6,used:false},{value:4,used:true}];
 const choice=scope.normalizeCommandSelection(p,r.cars,car,0,'nitro',2);
 assert.equal(choice.die,1);assert.equal(choice.command,'');assert.equal(choice.commandDie,null);
 p.dice.forEach(d=>d.used=true);assert.equal(scope.normalizeCommandSelection(p,r.cars,car,-1,'',null).die,-1);
 p.dice[2].used=false;assert.equal(scope.normalizeCommandSelection(p,r.cars,car,-1,'',null).die,2);
});
