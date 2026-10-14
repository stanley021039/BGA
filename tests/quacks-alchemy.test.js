'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {QuacksRoom}=require('../src/games/quacks'),{PATIENTS}=require('../src/games/quacks-alchemy'),{FORTUNES:EXTRA}=require('../src/games/quacks-expansion-fortunes'),{BOARD,WITCHES}=require('../src/games/quacks-catalog');
const act=(r,p,action,data={})=>r.act(p.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});
function fixture(patient='carrot',witches=false,red=1){
 const r=new QuacksRoom('ABCDEF','alchemy',n=>0),a=r.add('A'),b=r.add('B');r.configure(a.id,{alchemists:true,witches,hiddenProgress:true});for(const p of [a,b])act(r,p,'book-vote',{color:'red',set:red});
 r.start();r.patientChoices=[patient,...PATIENTS.filter(p=>p.id!==patient).slice(0,2).map(p=>p.id)];
 act(r,a,'patient',{patientId:patient});act(r,b,'patient',{patientId:patient});r.deck=['seasoned'];act(r,a,'draw-fortune');r.deck=require('../src/games/quacks-catalog').FORTUNES.concat(r.expansionFortunes()).filter(f=>f.id!=='seasoned').map(f=>f.id);return {r,a,b};
}
function chip(r,color,value,position){return {...r.chip(color,value),position,fromPosition:position-value,effectColor:color,effectValue:value};}
function settle(r){for(const p of r.players){p.stopped=true;p.pending=[];}r.beginSettlement();for(const p of r.players)act(r,p,'settle-ready');}
function choices(r){let n=0;while(r.hasPending()){assert.ok(++n<120,'pending effects terminate');for(const p of r.players){const q=r.view(p.id).mine.pending;if(!q)continue;const o=q.options.find(x=>!x.disabled);act(r,p,'choice',{choiceId:q.id,optionId:o.id});}}}
function driver(r,cap=2000){
 let steps=0;while(r.phase!=='finished'){
  assert.ok(++steps<cap,'progress '+r.round+' '+r.phase+' '+r.stage);if(r.phase==='between'){act(r,r.player(r.host),'next');continue;}
  for(const p of r.players){
   const s=r.view(p.id),m=s.mine;
   if(m.pending){const q=m.pending,o=q.options.find(o=>!o.disabled);assert.ok(o);act(r,p,'choice',{choiceId:q.id,optionId:o.id});continue;}
   if(s.phase==='patients'){if(!m.alchemy.patientId)act(r,p,'patient',{patientId:s.patients[0].id});continue;}
   if(s.phase==='fortune'){if(s.roundStarterId===p.id)act(r,p,'draw-fortune');continue;}
   if(s.phase==='brewing'){if(s.stage==='reserves'){const c=m.reserve.find(c=>c.must)||m.reserve[0];if(c)act(r,p,'reserve',{chipId:c.id});else if(!p.reserveDone)act(r,p,'reserve-done');}
    else if(m.canDraw)act(r,p,m.white>=m.threshold-2||p.draws>=7?'stop':'draw',{step:s.step});continue;}
   if(s.phase==='settlement'){
    if(s.stage==='essence'){if(!m.alchemy.confirmed)act(r,p,'essence',{position:m.alchemy.max});else if(m.alchemy.diceRemaining)act(r,p,'essence-roll');continue;}
    if(m.ready)continue;
    if(s.stage==='witches')act(r,p,'settle-ready');
    if(s.stage==='bonus'){if(m.bonusEligible&&!m.bonusRolled)act(r,p,'roll-bonus');else act(r,p,'bonus-ready');}
    if(s.stage==='effects-confirm')act(r,p,'confirm-effects');
    if(s.stage==='rewards')act(r,p,'reward',{mode:'score'});
    if(s.stage==='shopping'){if(r.round<9&&m.canBuy&&m.bought.length<2){const b=s.books.find(b=>!m.bought.some(c=>c.color===b.color)&&b.offers.some(o=>o.price<=m.budget));if(b){act(r,p,'buy',{color:b.color,value:b.offers.filter(o=>o.price<=m.budget).at(-1).value});continue;}}act(r,p,'shop-ready');}
   }
  }
 }
 return steps;
}
test('three distinct public patients, own choice, duplicates allowed, start gifts and immutable match settings',()=>{
 const r=new QuacksRoom('ABCDEF','patient',n=>0),a=r.add('A'),b=r.add('B');r.configure(a.id,{alchemists:true});r.start();
 assert.equal(r.phase,'patients');assert.equal(new Set(r.patientChoices).size,3);assert.equal(r.view(a.id).patients.length,3);
 assert.throws(()=>act(r,a,'patient',{patientId:'vampire'}),e=>e.code==='INVALID_PATIENT');
 act(r,a,'patient',{patientId:'carrot'});assert.equal(r.phase,'patients');act(r,b,'patient',{patientId:'carrot'});assert.equal(r.phase,'fortune');assert.equal(a.bag.length,10);assert.equal(b.bag.length,10);
 assert.throws(()=>act(r,a,'patient',{patientId:'earworm'}),e=>e.code==='INVALID_PHASE');assert.throws(()=>r.configure(a.id,{alchemists:false}),e=>e.code==='MATCH_STARTED');
 const f=fixture('forgetful');assert.equal(f.a.bag.length,11);assert.equal(f.a.bag.filter(c=>c.color==='blue').length,1);
});
test('standalone and combined expansions, filtered card symbols, four new weed faces and disable coercion',()=>{
 const {r,a}=fixture('carrot');assert.deepEqual(r.choiceSets('locoweed'),[7,8,9,10]);assert.equal(r.max,4);assert.equal(r.expansionFortunes().length,17);assert.equal(r.expansionFortunes().some(f=>f.requires==='witches'),false);
 const both=fixture('carrot',true);assert.deepEqual(both.r.choiceSets('locoweed'),[5,6,7,8,9,10]);assert.equal(both.r.expansionFortunes().length,20);assert.equal(both.r.max,5);
 r.phase='finished';r.configure(a.id,{alchemists:false});assert.deepEqual(r.choiceSets('locoweed'),[]);r.start();assert.equal(r.phase,'fortune');assert.equal(r.patientChoices.length,0);assert.equal(a.alchemy,undefined);
 assert.throws(()=>r.configure(a.id,{alchemists:'yes'}),e=>e.code==='MATCH_STARTED');
});
test('essence snapshot: actual colors, white7, unique neighbors, explosion still eligible and lower rewards',()=>{
 const {r,a,b}=fixture('nervous');a.pot=[chip(r,'white',3,3),chip(r,'white',2,5),chip(r,'white',2,7),chip(r,'red',1,8),chip(r,'red',2,10),chip(r,'orange',1,11),chip(r,'blue',1,12)];a.position=12;a.exploded=true;b.exploded=true;
 settle(r);assert.equal(r.stage,'essence');assert.deepEqual(a.alchemy.calculation,{colors:3,exactSeven:1,explosions:1,locoweed:0,fortune:0});assert.equal(a.alchemy.max,5);
 assert.throws(()=>act(r,a,'essence',{position:6}),e=>e.code==='INVALID_ESSENCE');assert.equal(a.alchemy.confirmed,false);
 const data={roundId:r.roundId,requestId:randomUUID(),position:1};r.act(a.id,'essence',data);r.act(a.id,'essence',data);assert.equal(a.alchemy.nextRat,1);assert.equal(r.stage,'essence');act(r,b,'essence',{position:0});assert.equal(r.stage,'bonus');
 assert.equal(r.view(b.id).mine.alchemy.pool.length,0);
});
test('three seats count both exploded neighbors once, weed bonus, 10 cap and ninth-round points only',()=>{
 const {r,a}=fixture('eyes',true);const b=r.players[1],c={...b,id:randomUUID(),name:'C',alchemy:{...b.alchemy,pool:[]}};r.players.push(c);b.exploded=c.exploded=true;
 r.activeBooks.locoweed=7;a.pot=['red','orange','blue','green','yellow','black','purple','locoweed','locoweed'].map((color,i)=>chip(r,color,1,i+1));a.pot.push(chip(r,'white',7,16));a.position=16;r.round=9;r.fortune=EXTRA.find(f=>f.id==='alchemy-last');settle(r);
 assert.equal(a.alchemy.calculation.colors,8);assert.equal(a.alchemy.calculation.locoweed,2);assert.equal(a.alchemy.calculation.explosions,2);assert.equal(a.alchemy.max,10);
 const before={score:a.score,rubies:a.rubies,bag:a.bag.length};act(r,a,'essence',{position:10});assert.equal(a.score,before.score+10);assert.equal(a.rubies,before.rubies);assert.equal(a.bag.length,before.bag);assert.equal(a.alchemy.diceRemaining,0);assert.equal(a.alchemy.nextRat,0);
});
test('earworm sequentially places extra bombs and blue choices safely, ordinary counts and old explosion preserved',()=>{
 for(const exploded of [false,true]){
  const {r,a,b}=fixture('earworm');a.pot=[chip(r,'white',7,7),...['red','orange','green','yellow','purple','black'].map((c,i)=>chip(r,c,1,8+i))];a.position=13;a.exploded=exploded;
  a.bag=[r.chip('blue'),r.chip('white',3),r.chip('white',3),r.chip('orange')];const draws=a.draws;settle(r);assert.ok(a.alchemy.max>=6);
  act(r,a,'essence',{position:6});assert.ok(a.pending.length);choices(r);assert.equal(a.exploded,exploded);assert.equal(a.draws,draws);assert.ok(r.white(a)>7);act(r,b,'essence',{position:0});assert.equal(r.stage,'bonus');assert.equal(a.bonusEligible,!exploded);
 }
});
test('earworm red2 reserves count as draws, mandatory red6 extras finish before evaluation',()=>{
 for(const red of [2,6]){const {r,a,b}=fixture('earworm',red===6,red);a.pot=[chip(r,'orange',1,1)];a.position=1;a.bag=[r.chip('red'),r.chip('white',3),r.chip('orange')];settle(r);act(r,a,'essence',{position:1});act(r,b,'essence',{position:0});choices(r);assert.equal(r.stage,'bonus');assert.equal(a.exploded,false);assert.equal(a.draws,0);if(red===2)assert.equal(a.reserve.length,1);else assert.equal(a.reserve.some(c=>c.must),false);}
});
test('nervous pool private, bomb rejection, pool replaces one synchronized draw and rat is once next round',()=>{
 const {r,a,b}=fixture('nervous');r.phase='between';a.alchemy.preview=4;a.alchemy.nextRat=1;a.bag=[r.chip('white'),r.chip('red'),r.chip('blue'),r.chip('green'),r.chip('orange')];act(r,a,'next');r.deck=['seasoned'];act(r,b,'draw-fortune');assert.equal(a.rat,1);assert.equal(a.alchemy.nextRat,0);assert.equal(a.alchemy.pool.length,3);
 const own=r.view(a.id),other=r.view(b.id);assert.equal(own.mine.alchemy.pool.length,3);assert.equal(other.recipes.find(p=>p.id===a.id).alchemy.pool,undefined);assert.equal(other.recipes.find(p=>p.id===a.id).pot,null);
 assert.throws(()=>act(r,b,'draw',{step:r.step,chipId:a.alchemy.pool[0].id}),e=>e.code==='INVALID_CHIP');
 const id=a.alchemy.pool[0].id;act(r,a,'draw',{step:r.step,chipId:id});assert.equal(a.draws,0);act(r,b,'stop',{step:r.step});assert.equal(a.draws,1);assert.equal(a.alchemy.pool.some(c=>c.id===id),false);
});
test('nervous red2 cannot be ordinarily drawn but can be placed after stopping and blocks reserve-ready barrier',()=>{
 const {r,a,b}=fixture('nervous',false,2);a.alchemy.pool=[r.chip('red')];a.bag=[r.chip('orange')];b.bag=[r.chip('orange')];
 assert.throws(()=>act(r,a,'draw',{step:r.step,chipId:a.alchemy.pool[0].id}),e=>e.code==='INVALID_CHIP');
 act(r,a,'stop',{step:r.step});act(r,b,'stop',{step:r.step});assert.equal(r.stage,'reserves');act(r,a,'alchemy-pool',{chipId:a.alchemy.pool[0].id});assert.equal(a.pot.at(-1).color,'red');if(r.stage==='reserves')act(r,a,'reserve-done');assert.equal(r.stage,'witches');
});
test('carrot jumps to next ruby, spends essence exactly once, and first round cannot use it',()=>{
 const {r,a}=fixture('carrot');a.alchemy.essence=4;a.position=1;r.place(a,r.chip('orange'));assert.equal(a.pending.length,0);
 r.round=2;a.position=1;r.place(a,r.chip('orange'));let q=a.pending[0];assert.ok(q);const d={roundId:r.roundId,requestId:randomUUID(),choiceId:q.id,optionId:'1'};r.act(a.id,'choice',d);r.act(a.id,'choice',d);assert.equal(a.position,5);assert.equal(a.alchemy.essence,2);
});
test('wing ears can double or return safe bomb, cannot intercept explosion, and valid choices block next step',()=>{
 for(const opt of [1,2]){const {r,a}=fixture('ears');r.round=2;a.alchemy.essence=5;r.place(a,r.chip('white',2));assert.ok(a.pending.length);const q=a.pending[0];act(r,a,'choice',{choiceId:q.id,optionId:String(opt)});assert.equal(a.alchemy.essence,opt===1?3:2);assert.equal(a.position,opt===1?4:0);}
 const {r,a}=fixture('ears');r.round=2;a.alchemy.essence=10;a.pot=[chip(r,'white',7,7)];a.position=7;r.place(a,r.chip('white'));assert.equal(a.pending.length,0);assert.equal(a.exploded,true);assert.equal(a.alchemy.essence,10);
});
test('forgetfulness actual token value costs, preserves gaps and progress, excludes bomb and copied weed',()=>{
 const {r,a}=fixture('forgetful');r.round=2;a.alchemy.essence=4;const blue=chip(r,'blue',2,7),white=chip(r,'white',1,8),weed=chip(r,'locoweed',1,9);a.pot=[blue,white,weed];a.position=9;
 act(r,a,'alchemy-return',{chipId:blue.id});assert.equal(a.position,9);assert.equal(a.pot[0].position,8);assert.equal(a.alchemy.essence,2);assert.equal(a.bag.at(-1).id,blue.id);
 for(const c of [white,weed])assert.throws(()=>act(r,a,'alchemy-return',{chipId:c.id}),e=>e.code==='INVALID_CHIP');
});
test('hump actual purple/black/weed categories take priority and pre-stop ruby rewards use essence',()=>{
 for(const [color,value,kind] of [['orange',1,'ruby'],['black',1,'dice'],['purple',1,'yellow'],['locoweed',1,'points']]){
  const {r,a}=fixture('hump');r.round=2;a.alchemy.essence=5;a.position=4;
  if(color==='locoweed')r.activeBooks.locoweed=7;const old={rubies:a.rubies,score:a.score,bag:a.bag.length};r.place(a,r.chip(color,value));const q=a.pending.find(q=>q.title.startsWith('女巫駝峰'));assert.ok(q,color);act(r,a,'choice',{choiceId:q.id,optionId:'1'});assert.equal(a.alchemy.essence,3);if(kind==='ruby')assert.equal(a.rubies,old.rubies+1);if(kind==='dice')assert.equal(r.rollEvents.at(-1).source,'特效藥 · 女巫駝峰');if(kind==='yellow')assert.equal(a.bag.at(-1).color,'yellow');if(kind==='points')assert.equal(a.score,old.score+3);
 }
});
test('chicken direct gifts, compatible upgrades, manual shared dice and blocked double claims',()=>{
 for(const pos of [1,2,3,4,5,6,7,8,9,10]){
  const {r,a,b}=fixture('eyes');a.pot=[chip(r,'blue',1,1)];a.position=1;settle(r);a.alchemy.max=10;a.potion=false;const before=a.rubies;act(r,a,'essence',{position:pos});if(pos===1)assert.equal(a.rubies,before+1);if(pos===6)assert.equal(a.rubies,before+3);if(pos===4)assert.equal(a.potion,true);if([3,9].includes(pos)){const q=a.pending[0];const o=q.options.find(o=>o.ops[0]?.op==='alchemyUpgrade');assert.ok(o);act(r,a,'choice',{choiceId:q.id,optionId:o.id});assert.equal(a.bag.at(-1).value,pos===3?2:4);}
  act(r,b,'essence',{position:0});if([7,10].includes(pos)){const n=pos===7?2:4;assert.equal(r.stage,'essence');for(let i=0;i<n;i++)act(r,a,'essence-roll');assert.equal(r.rollEvents.filter(x=>x.source==='特效藥 · 雞眼').length,n);assert.throws(()=>act(r,a,'essence-roll'),e=>e.code==='CANNOT_ROLL');}assert.equal(r.stage,'bonus');
 }
});
test('vampire independent one-chip shopping observes unlocks and never changes normal budget or bought count',()=>{
 const {r,a,b}=fixture('vampire');a.pot=[chip(r,'blue',1,1),chip(r,'red',1,2),chip(r,'orange',1,3)];a.position=3;settle(r);act(r,a,'essence',{position:3});const q=a.pending[0];assert.ok(q);assert.equal(q.options.some(o=>o.ops[0]?.color==='yellow'),false);const o=q.options.find(o=>o.ops[0]?.op==='alchemyBuy');assert.ok(o);const before=a.bag.length;act(r,a,'choice',{choiceId:q.id,optionId:o.id});assert.equal(a.bag.length,before+1);assert.equal(a.bought.length,0);assert.equal(a.budget,0);act(r,b,'essence',{position:0});assert.equal(r.stage,'bonus');
});
test('new weed faces movement, color bonus, returns and effect descriptions preserve original physical tokens',()=>{
 for(const [set,move] of [[7,1],[8,3],[9,1],[10,5]]){
  const {r,a}=fixture('carrot');r.activeBooks.locoweed=set;a.pot=[chip(r,'red',1,1),chip(r,'orange',1,2),chip(r,'white',5,7)];a.position=7;r.place(a,r.chip('locoweed'));assert.equal(a.position,7+move);if(set===9){const q=a.pending[0],opt=q.options.find(o=>o.ops[0]?.chipId===a.pot[0].id);assert.ok(opt);act(r,a,'choice',{choiceId:q.id,optionId:opt.id});assert.equal(a.position,8);}
 }
});
test('all eight patients and every expansion fortune complete nine rounds in both modes',()=>{
 for(const witches of [false,true])for(const patient of PATIENTS){
  const {r}=fixture(patient.id,witches);r.rng=n=>Math.floor(n/2);driver(r);assert.equal(r.results.length,9,patient.id);assert.ok(r.results.every(x=>x.players.every(p=>p.alchemy.patientId===patient.id)));assert.ok(r.players.every(p=>Number.isInteger(p.score)&&p.rubies>=0));
 }
 for(const fortune of EXTRA){
  const {r}=fixture('earworm',true);r.deck=[fortune.id,...r.deck];r.phase='between';r.round=0;act(r,r.player(r.host),'next');driver(r);assert.equal(r.results.length,9,fortune.id);
 }
});
test('new SVG flask shows chosen position and eight original patient portraits have valid viewBoxes',()=>{
 const {fixture}=require('./helpers/quacks-art-dom.cjs'),f=fixture();for(const p of PATIENTS){const svg=f.art.patientPortrait(p.id);assert.equal(svg.attrs.viewBox,'0 0 120 120');}
 const svg=f.art.essenceFlask(7);assert.equal(svg.querySelectorAll('[data-essence]').length,11);assert.match(svg.attrs['aria-label'],/第7格/);
});
module.exports={fixture,driver};

test('expansion currencies, independent cheap-copy, rat budgets and return coin are once per round',()=>{
 const {r,a,b}=fixture('carrot',true);r.fortune=EXTRA.find(f=>f.id==='give-get');a.rubies=2;r.applyFortune();let q=a.pending[0];const o=q.options.find(o=>o.ops.some(x=>x.op==='ruby'&&x.amount===-2));assert.ok(o);act(r,a,'choice',{choiceId:q.id,optionId:o.id});assert.equal(a.rubies,0);choices(r);
 r.fortune=EXTRA.find(f=>f.id==='rat-rich');a.field=b.field=BOARD[15];a.rat=3;r.phase='settlement';r.stage='rewards';a.settlementChoice=b.settlementChoice='score';r.enterShopping();assert.equal(a.budget,BOARD[15].coins+6);
 r.fortune=EXTRA.find(f=>f.id==='twin-shopping');const before=a.bag.length;act(r,a,'buy',{color:'orange',value:1});act(r,a,'buy',{color:'blue',value:1});assert.equal(a.bag.length,before+3);assert.equal(a.bought.length,2);assert.equal(a.freeCheap,true);
 r.fortune=EXTRA.find(f=>f.id==='witch-return');a.coins.gold=false;act(r,a,'shop-ready');assert.equal(a.ready,false);q=a.pending[0];const gold=q.options.find(o=>o.ops[0]?.color==='gold');assert.ok(gold);act(r,a,'choice',{choiceId:q.id,optionId:gold.id});assert.equal(a.coins.gold,true);act(r,a,'shop-ready');assert.equal(a.ready,true);
});
test('snow bonus and refine swap cannot repeat after a rescue revisits settlement',()=>{
 const {r,a}=fixture('carrot',true);r.fortune=EXTRA.find(f=>f.id==='snow');a.pot=[chip(r,'white',2,2)];a.position=2;const score=a.score;r.beginSettlement();r.beginSettlement();assert.equal(a.score,score+2);
 a.pending=[];a.fortuneSettlementApplied=false;r.fortune=EXTRA.find(f=>f.id==='refine');a.pot=[chip(r,'red',2,10)];a.position=10;r.beginSettlement();assert.equal(a.pending.length,1);r.beginSettlement();assert.equal(a.pending.length,1);const q=a.pending[0],o=q.options.find(o=>o.ops[0]?.color==='green');assert.ok(o);act(r,a,'choice',{choiceId:q.id,optionId:o.id});assert.equal(a.position,10);assert.equal(a.pot[0].position,10);assert.equal(a.pot[0].color,'green');
});
test('visiting witch uses no coin, does not mark paid coin achievement, and cannot repeat',()=>{
 const {r,a,b}=fixture('carrot',true);r.fortune=EXTRA.find(f=>f.id==='witch-visit');r.applyFortune();r.visitingWitch={color:'copper',...WITCHES.copper.find(w=>w.id==='double')};const original=r.witches.copper;
 r.phase='settlement';r.stage='shopping';a.budget=9;a.canBuy=true;const before=cloneCoins(a.coins);act(r,a,'free-witch');assert.equal(a.budget,18);assert.deepEqual(a.coins,before);assert.equal(r.witches.copper,original);assert.equal(a.visitorUsed,true);assert.throws(()=>act(r,a,'free-witch'),e=>e.code==='WITCH_UNAVAILABLE');
 r.fortune=EXTRA.find(f=>f.id==='good-neighbor');r.phase='brewing';r.stage='drawing';a.stopped=false;a.exploded=false;a.ready=false;const rubies=b.rubies,count=a.bag.length;act(r,a,'fortune-neighbor');assert.equal(b.rubies,rubies+2);assert.equal(a.bag.length,count+1);assert.throws(()=>act(r,a,'fortune-neighbor'),e=>e.code==='INVALID_PHASE');
 function cloneCoins(c){return {...c};}
});
test('real AI planner picks patients and completes essence plus nine rounds without forbidden private views',()=>{
 const {runTestAIStep}=require('../src/ai');let seed=345;const r=new QuacksRoom('ABCDEF','AI',n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;});const a=r.add('BotA',true);r.add('BotB',true);r.configure(a.id,{alchemists:true,witches:true});r.start();let now=0,tries=0;
 const history={transact:(room,entry,run)=>run()};
 while(r.phase!=='finished'){assert.ok(++tries<2500,'AI progresses '+r.phase+' '+r.stage);if(r.phase==='between')act(r,r.player(r.host),'next');else runTestAIStep(r,{history,now:now+=1500});}
 assert.equal(r.results.length,9);assert.ok(r.results.every(x=>x.players.every(p=>p.alchemy)));
});

test('potion returns to the actual pre-bomb space even after a forgotten chip left a gap',()=>{const {r,a}=fixture('forgetful');r.round=2;a.alchemy.essence=2;const blue=chip(r,'blue',2,7);a.pot=[blue];a.position=7;act(r,a,'alchemy-return',{chipId:blue.id});r.place(a,r.chip('white'));assert.equal(a.position,8);act(r,a,'potion');assert.equal(a.position,7);});
