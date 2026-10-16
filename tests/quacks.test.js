'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {QuacksRoom,LAST}=require('../src/games/quacks'),{BOARD,FORTUNES,WITCHES}=require('../src/games/quacks-catalog');
function setup(set=1,witches=false,fortuneIndex=null){let seed=1259;const rng=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};const r=new QuacksRoom('ABCDEF','試藥',rng),a=r.add('A'),b=r.add('B');r.configure(a.id,{bookSet:set,witches,hiddenProgress:true});if(fortuneIndex!==null)r.rng=n=>n===24?fortuneIndex:rng(n);r.start();act(r,r.player(r.roundStarterId),'draw-fortune');return {r,a,b};}
const act=(r,p,action,data={})=>r.act(p.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});
function clear(r){let safety=0;while(r.players.some(p=>p.pending.length)){assert.ok(++safety<100);for(const p of r.players){const q=p.pending[0];if(!q)continue;const o=q.options.find(o=>o.ops.filter(x=>x.op==='ruby'&&x.amount<0).reduce((n,x)=>n-x.amount,0)<=p.rubies);assert.ok(o);act(r,p,'choice',{choiceId:q.id,optionId:o.id});}}}
function settlement(r){
 for(const p of r.players)if(r.stage==='witches'&&!p.ready)act(r,p,'settle-ready');
 for(const p of r.players)if(r.stage==='bonus'&&!p.ready){if(p.bonusEligible&&!p.bonusRolled)act(r,p,'roll-bonus');act(r,p,'bonus-ready');}
 clear(r);for(const p of r.players)if(r.stage==='effects-confirm'&&!p.ready)act(r,p,'confirm-effects');
}
function play(r){
 let loops=0;while(r.phase!=='finished'){
  assert.ok(++loops<1500,'game must make progress');clear(r);
  if(r.phase==='fortune'){act(r,r.player(r.roundStarterId),'draw-fortune');continue;}
  if(r.phase==='round-intro'){r.auto(r.nextRoundAt);continue;}if(r.phase==='between'){act(r,r.player(r.host),'next');continue;}
  if(r.phase==='brewing'){
   if(r.stage==='reserves'){for(const p of r.players){if(p.pending.length)continue;const c=p.reserve[0];if(c)act(r,p,'reserve',{chipId:c.id});else if(!p.reserveDone)act(r,p,'reserve-done');}continue;}
   for(const p of r.players){const s=r.view(p.id);if(s.mine.canDraw)act(r,p,r.white(p)>=r.threshold(p)-2||p.draws>=8?'stop':'draw',{step:r.step});}
  }else if(r.phase==='settlement'){
   for(const p of r.players){if(p.ready||p.pending.length)continue;const stage=r.stage;if(stage==='witches')act(r,p,'settle-ready');else if(stage==='bonus'){if(p.bonusEligible&&!p.bonusRolled)act(r,p,'roll-bonus');act(r,p,'bonus-ready');}else if(stage==='effects-confirm')act(r,p,'confirm-effects');else if(stage==='rewards')act(r,p,'reward',{mode:'score'});else if(stage==='shopping'){
    if(r.round<9&&p.canBuy){const b=r.availableBooks().find(b=>!p.bought.some(x=>x.color===b.color)&&b.offers.some(o=>o.price<=p.budget));if(b&&p.bought.length<2){const o=b.offers.filter(o=>o.price<=p.budget).at(-1);act(r,p,'buy',{color:b.color,value:o.value});}}
    act(r,p,'shop-ready');
   }}
  }
 }return loops;
}
test('synchronous draw barrier, idempotency and stale step guard',()=>{
 const {r,a,b}=setup();clear(r);r.fortune=FORTUNES[0];a.bag=[r.chip('orange'),r.chip('green')];b.bag=[r.chip('orange'),r.chip('green')];
 const input={roundId:r.roundId,requestId:randomUUID(),step:r.step};r.act(a.id,'draw',input);assert.equal(a.draws,0);assert.equal(b.draws,0);r.act(a.id,'draw',input);assert.equal(a.draws,0);
 act(r,b,'draw',{step:1});assert.equal(a.draws,1);assert.equal(b.draws,1);assert.equal(r.step,2);assert.throws(()=>act(r,a,'draw',{step:1}),e=>e.code==='STALE_STEP');
});
test('blue effect extra draws do not count as ordinary draws and block the barrier',()=>{
 const {r,a,b}=setup();clear(r);r.fortune=FORTUNES[0];a.bag=[r.chip('blue',2),r.chip('orange',1),r.chip('green',1)];b.bag=[r.chip('orange'),r.chip('green')];r.rng=n=>0;
 act(r,a,'draw',{step:r.step});act(r,b,'draw',{step:r.step});assert.equal(a.draws,1);assert.equal(b.draws,1);assert.equal(a.pending.length,1);assert.equal(r.view(b.id).mine.canDraw,false);
 const q=a.pending[0];act(r,a,'choice',{choiceId:q.id,optionId:q.options[0].id});assert.equal(a.draws,1);assert.equal(a.pot.length,2);assert.equal(r.step,2);
});
test('hidden progress filters pot, white sum, position, threshold and extra-choice data',()=>{
 const {r,a,b}=setup();clear(r);r.fortune=FORTUNES[0];a.bag=[r.chip('white',3),r.chip('white',3),r.chip('white',2)];b.bag=[r.chip('orange'),r.chip('orange'),r.chip('orange'),r.chip('green')];r.rng=n=>0;
 for(let n=0;n<2;n++){act(r,a,'draw',{step:r.step});act(r,b,'draw',{step:r.step});const s=r.view(b.id),peer=s.recipes.find(p=>p.id===a.id);assert.equal(peer.position,null);assert.equal(peer.pot,null);assert.equal(peer.white,null);assert.equal(peer.threshold,null);assert.equal(s.intents,undefined);assert.equal(s.players.find(p=>p.id===a.id).bag,undefined);}
 act(r,a,'draw',{step:r.step});act(r,b,'draw',{step:r.step});const peer=r.view(b.id).recipes.find(p=>p.id===a.id);assert.equal(peer.exploded,true);assert.equal(peer.hidden,false);assert.equal(peer.white,8);assert.ok(peer.explosionId);assert.equal(peer.pot.length,3);
});
test('white exactly seven is safe, greater explodes, flask cannot undo explosion',()=>{
 const {r,a,b}=setup();clear(r);r.fortune=FORTUNES[0];a.bag=[];a.pot=[];a.position=0;r.place(a,r.chip('white',3));r.place(a,r.chip('white',3));r.place(a,r.chip('white',1));assert.equal(a.exploded,false);r.place(a,r.chip('white',1));assert.equal(a.exploded,true);assert.throws(()=>act(r,a,'potion'),e=>e.code==='POTION_UNAVAILABLE');
});
test('board distinguishes repeated coin labels; ruby and final spoon match source',()=>{
 assert.equal(BOARD.length,54);assert.equal(BOARD[15].coins,15);assert.equal(BOARD[16].coins,15);assert.equal(BOARD[15].ruby,false);assert.equal(BOARD[16].ruby,true);assert.equal(BOARD.at(-1).coins,35);assert.equal(BOARD.at(-1).points,15);assert.equal(LAST,52);
});
test('witch overflow half rounds down and inactive ingredient effects do not run',()=>{
 const {r,a}=setup(5,true);clear(r);r.fortune=FORTUNES[0];a.position=LAST;const before=a.score;r.place(a,r.chip('blue',4));r.place(a,r.chip('orange',1));assert.equal(a.score,before);assert.equal(a.overflow.length,2);r.players.forEach(p=>{p.stopped=true;p.pending=[];});r.rng=n=>0;r.beginSettlement();settlement(r);r.players.forEach(p=>act(r,p,'reward',{mode:'score'}));assert.equal(a.score-before,15+2+1); // deterministic bonus die awards 1 point.
});
test('gold witch rescue, one-use coin, and full flask requirement',()=>{
 const {r,a,b}=setup(1,true);clear(r);r.fortune=FORTUNES[0];r.witches.gold=WITCHES.gold.find(w=>w.id==='rescue');a.pot=[];a.position=0;r.place(a,r.chip('white',3));r.place(a,r.chip('white',3));r.place(a,r.chip('white',2));assert.equal(a.exploded,true);r.useWitch(a,'gold');assert.equal(a.exploded,false);assert.equal(a.potion,false);assert.equal(a.coins.gold,false);assert.equal(r.white(a),6);assert.throws(()=>r.useWitch(a,'gold'));
});
test('red fifth set takes maximum instead of adding, blue sixth checks prior chips',()=>{
 const {r,a}=setup(5,true);clear(r);r.fortune=FORTUNES[0];a.pot=[];a.position=0;r.place(a,r.chip('red',4));r.place(a,r.chip('red',1));assert.equal(a.position,8);
 r.activeBooks.blue=6;a.pot=[];a.position=0;a.rubies=0;r.place(a,r.chip('white',1));r.place(a,r.chip('blue',1));assert.equal(a.rubies,1);
});
test('final totals include ruby conversion, unused witch pennies and pot tie breaker',()=>{
 const {r,a,b}=setup(1,true);clear(r);r.round=9;r.phase='settlement';r.stage='shopping';a.rubies=5;b.rubies=1;a.score=10;b.score=16;a.position=2;b.position=3;for(const p of r.players){p.field=BOARD[3];p.canBuy=false;p.bought=[];}act(r,a,'shop-ready');act(r,b,'shop-ready');assert.equal(a.score,18);assert.equal(b.score,22);assert.equal(r.winner.names[0],'B');
});
test('all six books, every base fortune and nine rounds terminate with valid state',()=>{
 for(let set=1;set<=6;set++)for(const fortune of FORTUNES){
  const {r}=setup(set,set>=5,FORTUNES.indexOf(fortune));clear(r);const loops=play(r);assert.ok(loops>0);assert.equal(r.results.length,9);assert.ok(r.players.every(p=>Number.isInteger(p.score)&&p.rubies>=0));assert.ok(r.winner.names.length>0);
 }
});


test('all twelve witches obey phase, currency and once-per-match restrictions',()=>{
 for(const [color,list]of Object.entries(WITCHES))for(const witch of list){
  const {r,a}=setup(1,true);clear(r);r.fortune=FORTUNES[0];r.witches[color]=witch;a.pending=[];a.pot=[{...r.chip('blue',1),effectColor:'blue',effectValue:1,position:1},{...r.chip('red',2),effectColor:'red',effectValue:2,position:3},{...r.chip('white',1),effectColor:'white',effectValue:1,position:4}];a.position=4;
  a.bag=Array.from({length:6},()=>r.chip('orange'));a.rubies=3;a.budget=12;a.canBuy=true;a.bought=[{color:'blue',value:2,price:10}];
  if(witch.id==='rescue'){a.pot.push({...r.chip('white',3),position:7,fromPosition:4});a.exploded=true;a.stopped=true;}
  if(color==='copper'||color==='silver'&&witch.id==='discount'){r.phase='settlement';r.stage='shopping';}
  else if(witch.id==='all'||witch.id==='ruby'){r.phase='settlement';r.stage='witches';}
  else if(color==='silver'){r.phase='settlement';r.stage='rewards';}
  assert.equal(r.witchAllowed(a,color),true,witch.id);const before=a.draws;act(r,a,'witch',{color});assert.equal(a.coins[color],false,witch.id);clear(r);assert.equal(a.draws,before,'witch draws excluded');assert.throws(()=>act(r,a,'witch',{color}),e=>e.code==='WITCH_UNAVAILABLE');
  if(witch.id==='rubies')assert.equal(a.budget,18);if(witch.id==='double')assert.equal(a.budget,24);if(witch.id==='discount')assert.equal(a.discount,1);
 }
});
test('strong fortune does not activate immediate or settlement ingredient actions',()=>{
 const {r,a,b}=setup();clear(r);r.fortune=FORTUNES.find(f=>f.id==='strong');a.pot=[];a.position=0;a.rubies=1;a.bag=[];r.place(a,r.chip('green',1),{noEffect:true,safe:true});assert.equal(a.pot[0].noEffect,true);for(const p of r.players){p.stopped=true;p.pending=[];}r.beginSettlement();r.rng=n=>0;settlement(r);assert.equal(a.rubies,1);
});
test('unaffordable queued ruby choice remains available to skip without partial mutation',()=>{
 const {r,a}=setup(4);clear(r);a.rubies=0;r.queue(a,'pay',[r.option('支付',[{op:'ruby',amount:-1},{op:'droplet',amount:1}]),r.option('略過',[])]);const q=a.pending[0],before=a.droplet;assert.equal(r.view(a.id).mine.pending.options[0].disabled,true);assert.throws(()=>act(r,a,'choice',{choiceId:q.id,optionId:'0'}),e=>e.code==='CHOICE_UNAVAILABLE');assert.equal(a.pending[0].id,q.id);assert.equal(a.droplet,before);act(r,a,'choice',{choiceId:q.id,optionId:'1'});assert.equal(a.pending.length,0);
});

test('red second-set reserve requires stopping, can return to bag, and respects next-step barrier',()=>{
 const {r,a,b}=setup(2);clear(r);r.fortune=FORTUNES[0];a.bag=[r.chip('red',1),r.chip('orange')];b.bag=[r.chip('orange'),r.chip('green')];r.rng=n=>0;act(r,a,'draw',{step:r.step});act(r,b,'draw',{step:r.step});const c=a.reserve[0];assert.ok(c);assert.throws(()=>act(r,a,'reserve',{chipId:c.id}),e=>e.code==='MUST_STOP');act(r,a,'reserve-return',{chipId:c.id});assert.equal(a.reserve.length,0);assert.ok(a.bag.some(x=>x.id===c.id));
});
test('silver color bonus counts physical locoweed as its own eighth color',()=>{
 const {r,a}=setup(6,true);clear(r);r.phase='settlement';r.stage='rewards';r.witches.silver=WITCHES.silver.find(w=>w.id==='colors');a.pot=['orange','red','blue','yellow','green','black','purple','locoweed'].map((color,i)=>({...r.chip(color,1),effectColor:color==='locoweed'?'purple':color,effectValue:1,position:i+1}));const score=a.score;act(r,a,'witch',{color:'silver'});assert.equal(a.score-score,14);
});

test('Rats Are Your Friends uses the supplied card value four, or one victory point per tail',()=>{
 const {r,a}=setup();clear(r);r.fortune=FORTUNES.find(f=>f.id==='friends');a.rat=1;a.pending=[];r.applyFortune();const q=a.pending[0];assert.ok(q);const choice=q.options.find(o=>o.label==='烏鴉頭骨 4');assert.ok(choice);assert.equal(q.options.some(o=>o.label==='烏鴉頭骨 1'),false);act(r,a,'choice',{choiceId:q.id,optionId:choice.id});assert.ok(a.bag.some(c=>c.color==='blue'&&c.value===4));
});

test('shopping finishes with a two-second announcement then automatically advances once',()=>{const {r,a,b}=setup();clear(r);let now=1000;r.now=()=>now;r.phase='settlement';r.stage='shopping';for(const p of [a,b]){p.pending=[];p.ready=false;p.canBuy=false;p.budget=0;}a.pot=[{...r.chip('orange'),position:1}];a.overflow=[r.chip('green',2)];const ids=[...a.pot,...a.overflow].map(c=>c.id),roundId=r.roundId;act(r,a,'shop-ready');a.offline=true;assert.equal(r.phase,'settlement');assert.equal(r.results.length,0);const last={roundId,requestId:randomUUID()};r.act(b.id,'shop-ready',last);assert.equal(r.phase,'round-intro');assert.equal(r.round,1);assert.equal(r.nextRoundAt,3000);assert.equal(r.view(b.id).nextRoundAt,3000);assert.equal(r.results.length,1);assert.equal(r.results[0].players.find(p=>p.id===a.id).overflow.length,1);assert.ok(ids.every(id=>a.bag.some(c=>c.id===id)));r.act(b.id,'shop-ready',last);assert.throws(()=>act(r,a,'next'),e=>e.code==='INVALID_PHASE');assert.throws(()=>act(r,a,'draw-fortune'),e=>e.code==='INVALID_PHASE');assert.equal(r.auto(2999),false);assert.equal(r.round,1);assert.equal(r.auto(3000),true);assert.equal(r.phase,'fortune');assert.equal(r.stage,'draw-card');assert.equal(r.round,2);assert.notEqual(r.roundId,roundId);assert.equal(r.nextRoundAt,null);assert.equal(r.view(a.id).nextRoundAt,null);assert.equal(a.settlementEvents.length,0);assert.equal(b.settlementEvents.length,0);assert.throws(()=>r.act(b.id,'shop-ready',last),e=>e.code==='STALE_ROUND');assert.equal(r.auto(6000),false);assert.equal(r.round,2);assert.equal(r.results.length,1);});

test('ninth shopping completion preserves final scoring and never starts a tenth round',()=>{const {r,a,b}=setup();clear(r);r.phase='settlement';r.stage='shopping';r.round=9;for(const p of [a,b]){p.pending=[];p.ready=false;p.canBuy=false;p.budget=0;p.rubies=2;p.score=4;}act(r,a,'shop-ready');assert.equal(r.phase,'settlement');act(r,b,'shop-ready');assert.equal(r.phase,'finished');assert.equal(r.round,9);assert.equal(r.view(a.id).nextRoundAt,null);assert.equal(r.auto(Date.now()+10000),false);assert.equal(r.winner.score,5);assert.equal(r.results.at(-1).round,9);assert.ok(r.players.every(p=>p.score===5));});
