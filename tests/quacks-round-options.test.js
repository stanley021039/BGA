'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {QuacksRoom}=require('../src/games/quacks'),{FORTUNES,BOARD}=require('../src/games/quacks-catalog'),art=require('../public/quacks-art');
const act=(r,p,action,data={})=>r.act(p.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});
function lobby(witches=false){const r=new QuacksRoom('ABCDEF','mix',n=>0),a=r.add('A'),b=r.add('B');r.configure(a.id,{witches,hiddenProgress:true});return {r,a,b};}
function ready(r){for(const p of r.players)if(!p.ready)act(r,p,'settle-ready');}
function bonuses(r){for(const p of r.players){if(p.bonusEligible&&!p.bonusRolled)act(r,p,'roll-bonus');if(!p.ready)act(r,p,'bonus-ready');}}
test('independent color voting, host ties, bot exclusion and locked mixed books',()=>{
 const {r,a,b}=lobby(true),bot=r.add('Bot',true);
 act(r,a,'book-vote',{color:'red',set:3});assert.throws(()=>r.start(),e=>e.code==='BOOK_TIE');
 assert.throws(()=>act(r,b,'book-tie',{color:'red',set:3}),e=>e.code==='HOST_ONLY');
 assert.throws(()=>act(r,a,'book-tie',{color:'red',set:6}),e=>e.code==='INVALID_TIE');
 act(r,a,'book-tie',{color:'red',set:3});
 act(r,a,'book-vote',{color:'green',set:2});act(r,b,'book-vote',{color:'green',set:2});
 assert.throws(()=>act(r,bot,'book-vote',{color:'blue',set:6}),e=>e.code==='HUMANS_ONLY');
 // A changed green ballot must not discard the already resolved red tie.
 assert.equal(r.bookSelection().find(c=>c.color==='red').selected,3);
 r.start();assert.equal(r.activeBooks.red,3);assert.equal(r.activeBooks.green,2);assert.equal(r.activeBooks.blue,1);
 assert.equal(r.bookFor('red').offers[0].price,5);assert.equal(r.bookFor('green').offers[0].price,6);
 assert.throws(()=>act(r,a,'book-vote',{color:'red',set:1}),e=>e.code==='MATCH_STARTED');
 act(r,a,'draw-fortune');a.pot=[];a.position=0;r.place(a,r.chip('white',2));r.place(a,r.chip('red',1));assert.equal(a.position,5);
});
test('invalid expansion faces rejected; disabling expansion coerces old ballot',()=>{
 const {r,a,b}=lobby(true);act(r,a,'book-vote',{color:'blue',set:6});act(r,b,'book-vote',{color:'blue',set:6});
 r.configure(a.id,{witches:false,bookSet:1});assert.equal(r.bookSelection().find(c=>c.color==='blue').selected,1);
 assert.throws(()=>act(r,a,'book-vote',{color:'locoweed',set:5}),e=>e.code==='INVALID_BOOK');
 assert.throws(()=>act(r,a,'book-vote',{color:'black',set:2}),e=>e.code==='INVALID_BOOK');
});
test('all-bot fixtures use preset books without pretending bots voted',()=>{
 const r=new QuacksRoom('ABCDEF','bots',n=>0);r.add('A',true);r.add('B',true);r.start();assert.ok(r.bookSelection().every(c=>c.votes.length===0));assert.equal(r.phase,'fortune');
});
test('round starter alone reveals one card; retries do not redraw and next round rotates',()=>{
 const {r,a,b}=lobby();r.start();const view=r.view(a.id);assert.equal(view.phase,'fortune');assert.equal(view.fortune,null);assert.equal(view.deck,undefined);assert.equal(view.fortuneRevealId,null);
 assert.throws(()=>act(r,b,'draw-fortune'),e=>e.code==='STARTER_ONLY');assert.equal(r.deck.length,24);
 const data={roundId:r.roundId,requestId:randomUUID()};r.act(a.id,'draw-fortune',data);const reveal=r.fortuneRevealId;r.act(a.id,'draw-fortune',data);assert.equal(r.deck.length,23);assert.equal(r.fortuneRevealId,reveal);
 r.phase='between';act(r,a,'next');assert.equal(r.roundStarterId,b.id);assert.equal(r.fortune,null);assert.equal(r.view(b.id).recipes.find(p=>p.id===a.id).startPosition,null);
 assert.throws(()=>act(r,a,'draw-fortune'),e=>e.code==='STARTER_ONLY');act(r,b,'draw-fortune');assert.equal(r.deck.length,22);
});
test('bonus die is explicit, awards once, tied leaders roll and explosion blocks eligibility',()=>{
 const {r,a,b}=lobby();r.start();act(r,a,'draw-fortune');a.position=b.position=12;a.stopped=b.stopped=true;r.beginSettlement();ready(r);
 assert.equal(r.stage,'bonus');assert.equal(a.score,0);assert.equal(a.bonusEligible,true);assert.equal(b.bonusEligible,true);
 assert.throws(()=>act(r,a,'bonus-ready'),e=>e.code==='ROLL_FIRST');const data={roundId:r.roundId,requestId:randomUUID()};
 r.act(a.id,'roll-bonus',data);r.act(a.id,'roll-bonus',data);assert.equal(a.score,1);assert.deepEqual(a.bonusDice,[0]);
 assert.throws(()=>act(r,a,'roll-bonus'),e=>e.code==='CANNOT_ROLL');act(r,a,'bonus-ready');assert.equal(r.stage,'bonus');act(r,b,'roll-bonus');act(r,b,'bonus-ready');assert.equal(r.stage,'effects-confirm');
 const before=a.score;act(r,a,'confirm-effects');assert.equal(r.stage,'effects-confirm');act(r,b,'confirm-effects');assert.equal(r.stage,'rewards');assert.equal(a.score,before);
 r.beginSettlement();a.exploded=true;ready(r);assert.equal(a.bonusEligible,false);assert.equal(b.bonusEligible,true);assert.throws(()=>act(r,a,'roll-bonus'),e=>e.code==='CANNOT_ROLL');
});
test('double die fortune and gold witch include otherwise exploded leader',()=>{
 const {r,a,b}=lobby(true);r.start();act(r,a,'draw-fortune');r.fortune=FORTUNES.find(f=>f.id==='full');a.exploded=true;a.goldAll=true;a.position=20;b.position=4;r.beginSettlement();ready(r);act(r,a,'roll-bonus');assert.deepEqual(a.bonusDice,[0,0]);assert.equal(a.score,2);
});
test('mixed black, green and purple results apply once and appear in confirmation',()=>{
 const {r,a,b}=lobby();for(const p of [a,b])act(r,p,'book-vote',{color:'purple',set:3});r.start();act(r,a,'draw-fortune');
 a.pot=[{...r.chip('purple'),effectColor:'purple',effectValue:1,position:25},{...r.chip('black'),effectColor:'black',effectValue:1,position:26},{...r.chip('green'),effectColor:'green',effectValue:1,position:27}];a.position=27;b.pot=[];b.position=0;r.beginSettlement();ready(r);bonuses(r);
 assert.equal(r.stage,'effects-confirm');assert.equal(a.score,3);assert.equal(a.rubies,3);assert.equal(a.droplet,1);
 const summary=r.view(a.id).mine.effectSummary;assert.ok(summary.some(x=>x.color==='black'&&x.text.includes('紅寶石 +1')));assert.ok(summary.some(x=>x.color==='green'&&x.text.includes('紅寶石 +1')));assert.ok(summary.some(x=>x.color==='purple'&&x.text.includes('分數 +2')));
 const input={roundId:r.roundId,requestId:randomUUID()};r.act(a.id,'confirm-effects',input);r.act(a.id,'confirm-effects',input);assert.equal(a.score,3);assert.equal(a.rubies,3);
});
test('purple pending choice must finish before effect confirmation and rewards are recorded',()=>{
 const {r,a,b}=lobby();r.start();act(r,a,'draw-fortune');a.pot=[{...r.chip('purple'),effectColor:'purple',effectValue:1,position:1}];a.position=1;r.beginSettlement();ready(r);bonuses(r);
 assert.equal(r.stage,'effects');assert.throws(()=>act(r,a,'confirm-effects'),e=>e.code==='INVALID_PHASE');
 const q=a.pending[0];act(r,a,'choice',{choiceId:q.id,optionId:'0'});assert.equal(r.stage,'effects-confirm');assert.ok(a.effectSummary.some(x=>x.color==='purple'&&x.text.includes('分數 +1')));
});
test('Second Chance returns to immutable round start including rat position',()=>{
 const {r,a,b}=lobby();r.start();a.score=0;b.score=10;a.droplet=2;r.deck=['second'];act(r,a,'draw-fortune');assert.ok(a.roundStartPosition>2);const start=a.roundStartPosition;
 for(let n=0;n<5;n++)r.place(a,r.chip('orange'));a.droplet+=3;a.draws=5;const q=a.pending.find(q=>q.title.startsWith('第二機會'));assert.ok(q);act(r,a,'choice',{choiceId:q.id,optionId:'1'});
 assert.equal(a.position,start);assert.equal(a.pot.length,0);assert.equal(a.draws,5);assert.equal(a.secondUsed,true);assert.equal(a.protect,0);assert.equal(a.doubleNext,false);
});
test('pot inspection respects hidden views and uses active color effect with no-effect exception',()=>{
 const {r,a,b}=lobby();r.start();act(r,a,'draw-fortune');let s=r.view(a.id),peer=s.recipes.find(p=>p.id===b.id);
 assert.equal(art.canInspect(s,peer),false);assert.equal(art.selectRecipe(s,b.id).id,a.id);
 b.exploded=true;s=r.view(a.id);assert.equal(art.canInspect(s,s.recipes.find(p=>p.id===b.id)),true);
 const p=s.recipes.find(p=>p.id===a.id);const c={color:'blue',value:2};assert.match(art.info(s,p,BOARD[2],c).effect,/最多選一片/);
 assert.match(art.info(s,p,BOARD[2],{...c,noEffect:true}).effect,/不觸發/);
 assert.match(art.info(s,p,BOARD[2],null).title,/空格/);assert.match(art.info(s,p,BOARD[2],{color:'locoweed',value:1,effectColor:'blue',effectValue:2}).effect,/本片模仿烏鴉頭骨：抽出/);
 const points=BOARD.slice(0,-1).map(t=>art.position(t.position));for(const p of points){assert.ok(p.x>25&&p.x<695&&p.y>25&&p.y<605);}
 const min=Math.min(...points.flatMap((a,i)=>points.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.y-b.y))));assert.ok(min>36,'tokens have separately visible centers');
});
