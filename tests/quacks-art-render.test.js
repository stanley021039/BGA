'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/quacks-art-dom.cjs');
const {QuacksRoom}=require('../src/games/quacks'),{randomUUID}=require('node:crypto');
function state(){const r=new QuacksRoom('ABCDEF','排版',n=>0),a=r.add('甲'),b=r.add('乙');r.start();r.act(a.id,'draw-fortune',{roundId:r.roundId,requestId:randomUUID()});a.droplet=2;a.roundStartPosition=7;a.rat=5;a.position=12;a.potName='黑鬼鍋';return r.view(a.id);}
test('SVG keeps short pot titles natural and marks actual droplet separately from rat start',()=>{
 const {art}=fixture(),s=state(),p=s.recipes[0],svg=art.cauldron(s,p);
 assert.equal(svg.querySelector('.pot-name').textContent,'黑鬼鍋');assert.equal(svg.querySelector('.pot-name').getAttribute('textLength'),null);
 assert.equal(svg.querySelector('.pot-droplet').getAttribute('data-position'),'2');assert.equal(svg.querySelector('.pot-rat-stone').getAttribute('data-position'),'7');
 assert.notEqual(svg.querySelector('.pot-droplet').querySelector('path').getAttribute('d'),svg.querySelector('.pot-rat-stone').querySelector('path').getAttribute('d'));
 p.potName='長'.repeat(24);assert.equal(art.cauldron(s,p).querySelector('.pot-name').getAttribute('textLength'),'300');
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
