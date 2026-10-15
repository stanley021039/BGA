'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('fs'),vm=require('vm');
const {QuacksRoom}=require('../src/games/quacks'),{POT_COLORS,FORTUNES,NAMES}=require('../src/games/quacks-catalog'),art=require('../public/quacks-art');
const act=(r,p,action,data={})=>r.act(p.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});
function setup(){const r=new QuacksRoom('ABCDEF','immersive',n=>0),a=r.add('A'),b=r.add('B');return {r,a,b};}
test('bag contents are absent in all views until private once-per-round peek',()=>{
 const {r,a,b}=setup();r.start();for(const p of [a,b]){const s=r.view(p.id);assert.equal(s.mine.bag,undefined);assert.equal(s.mine.bagCount,9);assert.equal(s.mine.bagPeek,null);assert.ok(s.recipes.every(p=>p.bagCount===9));assert.equal(s.players[0].bag,undefined);}
 assert.throws(()=>act(r,a,'peek-bag',{targetId:b.id}),e=>e.code==='OWN_BAG_ONLY');assert.equal(a.bagPeekUsed,false);
 const data={roundId:r.roundId,requestId:randomUUID()};r.act(a.id,'peek-bag',data);r.act(a.id,'peek-bag',data);
 const snapshot=r.view(a.id).mine.bagPeek;assert.equal(snapshot.chips.length,9);assert.equal(snapshot.chips[0].id,undefined);assert.equal(r.view(b.id).mine.bagPeek,null);assert.equal(r.view(b.id).recipes.find(p=>p.id===a.id).bagPeek,undefined);
 r.drawOne(a);assert.equal(r.view(a.id).mine.bagCount,8);assert.equal(r.view(a.id).mine.bagPeek.chips.length,9,'peek is a fixed snapshot, not ongoing inventory');
 act(r,a,'close-bag');assert.equal(r.view(a.id).mine.bagPeek,null);assert.throws(()=>act(r,a,'peek-bag'),e=>e.code==='PEEK_USED');
 r.phase='between';act(r,a,'next');assert.equal(a.bagPeekUsed,false);assert.equal(r.view(a.id).mine.peekAvailable,true);act(r,a,'peek-bag');assert.throws(()=>act(r,a,'peek-bag'),e=>e.code==='PEEK_USED');
 r.phase='finished';r.start();assert.equal(a.bagPeekUsed,false);assert.equal(r.view(a.id).mine.peekAvailable,true);
});
test('bag peek excludes AI and new-round state drops open inventory and restores the new round quota',()=>{
 const {r,a}=setup();const bot=r.add('bot',true);r.start();assert.throws(()=>act(r,bot,'peek-bag'),e=>e.code==='HUMANS_ONLY');act(r,a,'peek-bag');r.phase='between';act(r,a,'next');assert.equal(a.bagPeek,null);assert.equal(a.bagPeekUsed,false);
});
test('pot names validate, are public, and survive a new match',()=>{
 const {r,a,b}=setup();act(r,a,'name-pot',{name:'小學煉藥鍋'});assert.equal(r.view(b.id).recipes.find(p=>p.id===a.id).potName,'小學煉藥鍋');
 for(const name of ['',null,'a'.repeat(25),'bad\nname'])assert.throws(()=>act(r,a,'name-pot',{name}));assert.equal(a.potName,'小學煉藥鍋');r.start();assert.equal(a.potName,'小學煉藥鍋');
});
test('pot colors are unique; a claimed color cannot be taken and a released one becomes free',()=>{
 const {r,a,b}=setup();assert.notEqual(a.potColor,b.potColor);const previous=a.potColor;
 assert.throws(()=>act(r,b,'color-pot',{color:a.potColor}),e=>e.code==='COLOR_TAKEN');act(r,a,'color-pot',{color:'rose'});act(r,b,'color-pot',{color:previous});r.start();assert.equal(a.potColor,'rose');
 assert.throws(()=>act(r,a,'color-pot',{color:b.potColor}),e=>e.code==='COLOR_TAKEN');assert.throws(()=>act(r,a,'color-pot',{color:'__proto__'}),e=>e.code==='INVALID_COLOR');assert.equal(r.view(b.id).recipes.find(p=>p.id===a.id).potColor,'rose');assert.equal(Object.keys(POT_COLORS).length,8);
});
test('random book selection changes shared effects for all viewers using legal faces',()=>{
 const {r,a,b}=setup();r.configure(a.id,{witches:true});r.rng=n=>n-1;act(r,a,'book-random');for(const row of r.bookSelection()){assert.equal(row.selected,row.candidates.at(-1).set);assert.equal(row.chosenBy,a.id);assert.equal(r.view(b.id).bookSelection.find(c=>c.color===row.color).selected,row.selected);assert.equal(row.votes.length,0);}
 const bot=r.add('bot',true);assert.throws(()=>act(r,bot,'book-random'),e=>e.code==='HUMANS_ONLY');assert.throws(()=>act(r,a,'book-random',{color:'no'}),e=>e.code==='INVALID_BOOK');
 r.start();assert.throws(()=>act(r,a,'book-random'),e=>e.code==='MATCH_STARTED');
});
test('yellow round 2, purple round 3 and exactly one white bomb value 1 in round 6',()=>{
 const {r,a}=setup();r.start();assert.equal(r.availableBooks().some(b=>b.color==='yellow'),false);assert.equal(r.availableBooks().some(b=>b.color==='purple'),false);
 r.round=2;assert.equal(r.availableBooks().some(b=>b.color==='yellow'),true);assert.equal(r.availableBooks().some(b=>b.color==='purple'),false);
 r.round=3;assert.equal(r.availableBooks().some(b=>b.color==='purple'),true);r.round=5;const before=a.bag.filter(c=>c.color==='white'&&c.value===1).length;r.nextRound();assert.equal(r.round,6);assert.equal(a.bag.filter(c=>c.color==='white'&&c.value===1).length,before+1);r.view(a.id);r.view(a.id);assert.equal(a.bag.length,10);assert.equal(NAMES.white,'白色炸彈');
});
test('dice results have unique public IDs, shared face values and remain through settlement',()=>{
 const {r,a,b}=setup();r.start();act(r,a,'draw-fortune');r.beginSettlement();act(r,a,'settle-ready');act(r,b,'settle-ready');act(r,a,'roll-bonus');const x=r.view(a.id).rollEvents,y=r.view(b.id).rollEvents;assert.equal(x.length,1);assert.deepEqual(x,y);assert.equal(x[0].face,0);assert.equal(x[0].name,'A');assert.ok(x[0].id);assert.equal(x[0].source,'獎勵骰');act(r,a,'bonus-ready');act(r,b,'roll-bonus');act(r,b,'bonus-ready');assert.equal(r.rollEvents.length,2);assert.notEqual(r.rollEvents[0].id,r.rollEvents[1].id);
});
test('fortune material categories and looping 50-space scoreboard preserve exact totals',()=>{
 assert.ok(FORTUNES.every(f=>['round','immediate'].includes(f.timing)));assert.equal(FORTUNES.find(f=>f.id==='time').timing,'immediate');assert.equal(FORTUNES.find(f=>f.id==='seasoned').timing,'round');assert.equal(art.scoreCells.length,50);assert.deepEqual(art.scorePoint(51),art.scorePoint(1));assert.deepEqual(art.scorePoint(100),art.scorePoint(50));assert.deepEqual(art.scorePoint(70),art.scorePoint(20));assert.notDeepEqual(art.scorePoint(0),art.scorePoint(50));
});
test('original explosion PCM has valid size, finite amplitude and audible energy',()=>{
 const buf=fs.readFileSync('public/assets/game-sounds/quacks-explosion.wav');assert.equal(buf.toString('ascii',0,4),'RIFF');assert.equal(buf.readUInt32LE(24),22050);assert.equal(buf.readUInt16LE(34),16);assert.equal(buf.length,44+buf.readUInt32LE(40));let peak=0,energy=0;for(let i=44;i<buf.length;i+=2){const n=buf.readInt16LE(i);peak=Math.max(peak,Math.abs(n));energy+=n*n;}assert.ok(peak<32767&&peak>1000);assert.ok(energy>1e9);
});
function fxFixture(){
 let now=100000,id=0;const timers=new Map(),handlers={},listeners=[];class El{constructor(){this.children=[];this.attrs={};this.dataset={};this.hidden=true;this.style={setProperty(){}};this.classList={add(){}};}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}}
 const document={hidden:false,createElement:()=>new El(),addEventListener:(k,fn)=>handlers[k]=fn,removeEventListener:k=>delete handlers[k]},window={document,MotionPolicy:{allowsMotion:()=>!document.hidden,subscribe(fn){listeners.push(fn);return ()=>{};}},QuacksArt:{resource:()=>new El(),token:()=>new El()},GameUI:{decorateButton(){}}};
 vm.runInNewContext(fs.readFileSync('public/quacks-fx.js','utf8'),{window,Date:{now:()=>now},setTimeout(fn,ms){timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});
 const host=new El(),fx=window.QuacksFx.create(host),state=(v,extra={})=>({code:'ABCDEF',roundId:'round1',serverNow:now,version:v,me:'A',players:[{id:'A',name:'A'}],roundStarterId:'A',...extra});return {fx,host,state,hide(){document.hidden=true;handlers.visibilitychange();},tick(ms){now+=ms;for(const [key,t]of [...timers])if(t.at<=now&&timers.delete(key))t.fn();}};
}
test('summon/dice presentation only plays live unseen server results and skip clears queued scenes',()=>{
 const f=fxFixture();f.fx.update(f.state(1),false);const drawn=f.state(2,{fortuneRevealId:'card1',fortuneDrawnAt:100000,fortune:{name:'測試占卜',text:'結果'}});f.fx.update(drawn,true);assert.equal(f.host.hidden,false);assert.equal(f.host.children[0].attrs['aria-label'],'占卜抽卡動畫');f.fx.update(drawn,true);assert.equal(f.fx.size(),1);f.tick(2701);assert.equal(f.host.hidden,true);f.fx.update(drawn,true);assert.equal(f.host.hidden,true);
 f.fx.update(f.state(3,{rollEvents:[{id:'roll1',at:102701,face:1,name:'A',source:'獎勵骰',round:1}]}),true);assert.equal(f.host.children[0].attrs['aria-label'],'獎勵骰動畫');f.fx.clear();assert.equal(f.host.hidden,true);
 f.fx.update(f.state(4,{rollEvents:[{id:'roll1',at:102701,face:1}]}),true);assert.equal(f.host.hidden,true);
});
test('first load and reconnect do not replay card or dice; hidden state cancels the scene',()=>{
 const f=fxFixture(),loaded=f.state(1,{fortuneRevealId:'old',fortune:{name:'old'},rollEvents:[{id:'oldRoll',at:100000,face:0}]});f.fx.update(loaded,false);f.fx.update(loaded,true);assert.equal(f.host.hidden,true);
 f.fx.update(f.state(2,{rollEvents:[{id:'new',at:100000,face:2,name:'B'}]}),true);assert.equal(f.host.hidden,false);f.hide();assert.equal(f.host.hidden,true);f.fx.update(f.state(3,{roundId:'newRound',fortuneRevealId:'late',fortune:{name:'late'}}),false);assert.equal(f.host.hidden,true);
});

test('only the current starter sees the centered card reveal while other players retain dice effects',()=>{const f=fxFixture();f.fx.update(f.state(1,{me:'B'}),false);f.fx.update(f.state(2,{me:'B',fortuneRevealId:'card1',fortune:{name:'card'},fortuneDrawnAt:100000}),true);assert.equal(f.host.hidden,true);f.fx.update(f.state(3,{me:'B',rollEvents:[{id:'dice',at:100000,face:1,name:'A'}]}),true);assert.equal(f.host.hidden,false);});
