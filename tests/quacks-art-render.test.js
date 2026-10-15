'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/quacks-art-dom.cjs');
const {QuacksRoom}=require('../src/games/quacks'),{randomUUID}=require('node:crypto');
function state(){const r=new QuacksRoom('ABCDEF','排版',n=>0),a=r.add('甲'),b=r.add('乙');r.start();r.act(a.id,'draw-fortune',{roundId:r.roundId,requestId:randomUUID()});a.droplet=2;a.roundStartPosition=7;a.rat=5;a.position=12;a.potName='黑鬼鍋';return r.view(a.id);}
test('SVG keeps short pot titles natural and marks actual droplet separately from rat start',()=>{
 const {art}=fixture(),s=state(),p=s.recipes[0],svg=art.cauldron(s,p);
 assert.equal(svg.querySelector('.pot-name').textContent,'黑鬼鍋');assert.equal(svg.querySelector('.pot-name').getAttribute('textLength'),null);
 assert.equal(svg.querySelector('.pot-droplet').getAttribute('data-position'),'2');assert.equal(svg.querySelector('.pot-rat-stone').getAttribute('data-position'),'7');
 assert.notEqual(svg.querySelector('.pot-droplet').querySelector('path').getAttribute('d'),svg.querySelector('.pot-rat-stone').querySelector('path').getAttribute('d'));
 p.potName='長'.repeat(24);assert.equal(art.cauldron(s,p).querySelector('.pot-name').getAttribute('textLength'),'216');
 p.startPosition=2;assert.equal(art.cauldron(s,p).querySelector('.pot-rat-stone'),null);
});
test('scoreboard shows 25 rat locations, one current-round marker and authoritative score positions',()=>{
 const {fx,host,legend,art}=fixture(),s=state(),board=fx.createScoreboard(host);s.round=3;s.recipes[0].score=51;board.update(s,false);const svg=host.children[0];
 assert.equal(svg.querySelectorAll('.score-rat').length,25);assert.equal(svg.querySelectorAll('.current-round').length,1);assert.equal(svg.querySelector('.current-round').getAttribute('data-round'),'3');assert.equal(svg.querySelector('.current-round').getAttribute('aria-current'),'step');
 assert.equal(svg.querySelector('.round-flame').getAttribute('visibility'),'visible');const first=svg.querySelector('.round-flame').getAttribute('transform');assert.equal(svg.querySelector('.score-round-label').textContent,'目前第 3 / 9 回合');
 assert.ok(legend.textContent.includes('51 分'));assert.equal(svg.querySelectorAll('.score-pawn').length,2);assert.match(svg.querySelector('.score-pawn').style.transform,/translate/);
 s.round=9;board.update(s,true);assert.equal(svg.querySelector('.current-round').getAttribute('data-round'),'9');assert.notEqual(svg.querySelector('.round-flame').getAttribute('transform'),first);
 s.round=0;board.update(s,false);assert.equal(svg.querySelector('.round-flame').getAttribute('visibility'),'hidden');assert.equal(svg.querySelectorAll('.current-round').length,0);
});

test('round milestone icons correspond to real ingredient unlocks and the round-six bag addition',()=>{
 const {art}=fixture(),svg=art.scoreBoard();assert.equal(svg.querySelectorAll('.round-event').length,4);
 const r=new QuacksRoom('ABCDEF','事件',n=>0),a=r.add('甲');r.add('乙');r.start();
 for(const [round,color]of [[2,'yellow'],[3,'purple']]){r.round=round-1;assert.equal(r.availableBooks().some(b=>b.color===color),false);r.round=round;assert.equal(r.availableBooks().some(b=>b.color===color),true);assert.equal(art.roundMilestones[round].color,color);}
 r.round=5;const before=a.bag.filter(c=>c.color==='white'&&c.value===1).length;r.nextRound();assert.equal(a.bag.filter(c=>c.color==='white'&&c.value===1).length,before+1);assert.equal(art.roundMilestones[6].color,'white');
 assert.equal(svg.querySelector('.round-event').getAttribute('data-milestone'),'2');
});

test('expansion overflow basin reflects actual chips and scoring; hidden opponent progress is still inaccessible',()=>{
 const {art}=fixture(),r=new QuacksRoom('ABCDEF','basin',n=>0),a=r.add('A'),b=r.add('B');r.configure(a.id,{witches:true,hiddenProgress:true});r.start();r.drawFortune();a.position=52;r.place(a,r.chip('orange',6));r.place(a,r.chip('green',2));let s=r.view(a.id),pot=art.cauldron(s,s.recipes[0]);assert.equal(pot.querySelectorAll('.overflow-chip').length,2);assert.match(pot.querySelector('.overflow-basin').getAttribute('aria-label'),/2 片，4 分/);assert.equal(r.view(b.id).recipes[0].overflow,null);assert.throws(()=>art.cauldron(r.view(b.id),r.view(b.id).recipes[0]));r.phase='settlement';r.stage='rewards';for(const p of [a,b])p.field=r.field(p);r.enterShopping();assert.equal(a.score,a.field.points+4);s.options.witches=false;assert.equal(art.cauldron(s,s.recipes[0]).querySelector('.overflow-basin'),null);
});
test('each dice result retains the throw-time kettle color and renders resin tones with the real face',()=>{
 const {fx}=fixture(),r=new QuacksRoom('ABCDEF','dice',n=>2),a=r.add('A');r.add('B');r.start();const color=a.potColor;r.roll(a);a.potColor='amethyst';assert.equal(r.rollEvents[0].potColor,color);const die=fx.die(2,110,['#123456','#234567','#345678']);assert.equal(die.style['--die-glow'],'#123456');assert.equal(die.style['--die-body'],'#234567');assert.equal(die.getAttribute('aria-label'),'2 分');assert.ok(die.textContent.includes('2'));
});

test('settlement frame follows the next payable space and uses the terminal reward beyond 52',()=>{const {art}=fixture(),s=state(),p=s.recipes[0];p.position=8;let svg=art.cauldron(s,p);assert.equal(svg.querySelector('.settlement-target').getAttribute('data-position'),'9');assert.equal(svg.querySelectorAll('.settlement-frame').length,1);p.position=0;svg=art.cauldron(s,p);assert.equal(svg.querySelector('.settlement-target').getAttribute('data-position'),'1');p.position=52;svg=art.cauldron(s,p);assert.equal(svg.querySelector('.settlement-target'),null);assert.equal(svg.querySelector('.pot-settlement-terminal').getAttribute('data-position'),'53');});
test('name plate grows for the character count, centers its text and caps long names',()=>{const {art}=fixture(),s=state(),p=s.recipes[0];p.potName='鍋';const short=art.cauldron(s,p),a=Number(short.querySelector('.pot-nameplate').getAttribute('width'));p.potName='機車幫';const long=art.cauldron(s,p),b=Number(long.querySelector('.pot-nameplate').getAttribute('width'));assert.ok(b>a);assert.equal(long.querySelector('.pot-name').getAttribute('text-anchor'),'middle');assert.equal(Number(long.querySelector('.pot-name').getAttribute('x')),12+b/2);});
