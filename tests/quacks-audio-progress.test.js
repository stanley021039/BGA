
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {QuacksRoom}=require('../src/games/quacks');
test('successful bag draws get private bounded audio IDs; empty draws do not, and extra looks preserve normal draw count',()=>{
 const r=new QuacksRoom('ABCDEF','cue',n=>0),a=r.add('A'),b=r.add('B');r.start();const normal=a.draws;r.look(a,3);assert.equal(a.draws,normal);assert.equal(a.drawEvents.length,3);assert.equal(new Set(a.drawEvents.map(e=>e.id)).size,3);assert.equal(r.view(a.id).mine.drawEvents.length,3);assert.equal(r.view(b.id).mine.drawEvents.length,0);assert.equal(Object.hasOwn(r.view(b.id).recipes.find(p=>p.id===a.id),'drawEvents'),false);a.bag=[];const count=a.drawEvents.length;assert.equal(r.drawOne(a),null);assert.equal(a.drawEvents.length,count);for(let n=0;n<70;n++)r.recordDraw(a);assert.equal(a.drawEvents.length,64);r.nextRound();assert.equal(a.drawEvents.length,0);
});
test('essence advances to the computed maximum without awarding before confirmation, and a lower choice remains valid',()=>{
 const r=new QuacksRoom('ABCDEF','auto',n=>0),a=r.add('A'),b=r.add('B');r.configure(a.id,{alchemists:true});r.start();for(const p of [a,b]){p.alchemy.patientId='eyes';p.pot=[r.chip('orange'),r.chip('red')];p.ready=false;}r.phase='settlement';r.round=1;r.fortune={id:'test'};r.beginAlchemy();assert.equal(a.alchemy.essence,2);assert.equal(a.alchemy.max,2);assert.equal(a.alchemy.confirmed,false);const rubies=a.rubies,bag=a.bag.length;assert.equal(a.rubies,rubies);assert.equal(a.bag.length,bag);r.act(a.id,'essence',{position:1,roundId:r.roundId,requestId:crypto.randomUUID()});assert.equal(a.alchemy.essence,1);assert.equal(a.alchemy.confirmed,true);assert.equal(a.rubies,rubies+1);assert.equal(a.bag.length,bag);assert.equal(b.alchemy.confirmed,false);
});
function audioFixture({controlledClip=false,capacity=true}={}){
 let now=100000,id=0;const timers=new Map(),handlers=new Set(),calls=[];const document={hidden:false,addEventListener:(_,f)=>handlers.add(f),removeEventListener:(_,f)=>handlers.delete(f)};
 const window={document};vm.runInNewContext(fs.readFileSync('public/quacks-fx.js','utf8'),{window,Date:{now:()=>now},setTimeout(fn,ms){timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)});const cues=window.QuacksFx.createAudio({epoch:()=>4,hasCapacity:()=>capacity,play:(cue,key,options)=>{calls.push({cue,key,options});if(controlledClip)return {};}});
 const state=(events,extra={})=>({code:'ABCDEF',roundId:'r1',mine:{drawEvents:events},...extra});
 return {cues,calls,state,timers,freeCapacity(){capacity=true;},events:n=>Array.from({length:n},(_,i)=>({id:'draw'+i,at:now})),tick(ms){now+=ms;for(const [id,t]of [...timers])if(t.at<=now&&timers.delete(id))t.fn();},hide(){document.hidden=true;for(const fn of handlers)fn();}};
}
test('card and each private extra draw cue play once, in order, independently of visual motion',()=>{
 const f=audioFixture();f.cues.update(f.state([]),false);const state=f.state(f.events(3),{fortuneRevealId:'card1'});f.cues.update(state,true);assert.deepEqual(f.calls.map(x=>x.cue),['card-draw','ingredient-draw']);f.cues.update(state,true);f.tick(240);f.tick(240);assert.equal(f.calls.filter(x=>x.cue==='ingredient-draw').length,3);assert.equal(new Set(f.calls.map(x=>x.key)).size,4);assert.equal(f.calls[1].options.epoch,4);f.cues.destroy();assert.equal(f.timers.size,0);
});
test('baseline, reconnection, hidden pages and round changes consume events without old queued playback',()=>{
 const f=audioFixture(),old=f.state(f.events(2),{fortuneRevealId:'old'});f.cues.update(old,false);f.cues.update(old,true);assert.equal(f.calls.length,0);f.cues.update(f.state(f.events(5)),true);assert.equal(f.calls.length,1);f.hide();f.tick(1000);assert.equal(f.calls.length,1);f.cues.update(f.state(f.events(6)),true);f.cues.update(f.state(f.events(6),{roundId:'r2'}),false);assert.equal(f.calls.length,1);f.cues.destroy();
});
test('user-supplied cue waveforms match their manifest and have finite bounded samples and faded edges',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/assets/game-sounds/quacks-manifest.json','utf8'));
 for(const [cue,ms]of [['ingredient',650],['card',1500]]){const meta=manifest[cue],buf=fs.readFileSync('public/assets/game-sounds/'+meta.file);assert.equal(meta.durationMs,ms);assert.equal(buf.length,44+ms*48);assert.equal(buf.toString('ascii',0,4),'RIFF');assert.equal(meta.sha256,crypto.createHash('sha256').update(buf).digest('hex'));assert.equal(buf.readInt16LE(44),0);assert.equal(buf.readInt16LE(buf.length-2),0);assert.ok(meta.peak>1000&&meta.peak<15000);}
});


test('a queued ingredient waits for the previous clip cleanup and late callbacks cannot restart a cleared queue',()=>{
 const f=audioFixture({controlledClip:true});f.cues.update(f.state([]),false);f.cues.update(f.state(f.events(3)),true);assert.equal(f.calls.length,1);f.tick(240);assert.equal(f.calls.length,1);f.calls[0].options.onStop();f.tick(25);assert.equal(f.calls.length,2);f.hide();f.calls[1].options.onStop();f.tick(1500);assert.equal(f.calls.length,2);assert.equal(f.timers.size,0);f.cues.destroy();
});

test('potion returns a real chip, records a private one-shot cue, deduplicates retries and resets on new rounds',()=>{
 const r=new QuacksRoom('ABCDEF','potion',n=>0),a=r.add('A'),b=r.add('B');r.start();r.drawFortune();r.place(a,r.drawOne(a));const bag=a.bag.length,request={roundId:r.roundId,requestId:crypto.randomUUID()};
 r.act(a.id,'potion',request);r.act(a.id,'potion',request);assert.equal(a.bag.length,bag+1);assert.equal(r.view(a.id).mine.potionEvents.length,1);assert.equal(r.view(b.id).mine.potionEvents.length,0);assert.equal(Object.hasOwn(r.view(b.id).recipes[0],'potionEvents'),false);assert.throws(()=>r.act(a.id,'potion',{...request,requestId:crypto.randomUUID()}));assert.equal(a.potionEvents.length,1);r.nextRound();assert.equal(a.potionEvents.length,0);
});
test('potion sounds once after a live action, waits for draw cleanup and never replays on initial load or reconnect',()=>{
 const f=audioFixture({controlledClip:true});const old={potionEvents:[{id:'old',at:100000}]};f.cues.update(f.state([],{mine:old}),false);f.cues.update(f.state([],{mine:old}),true);assert.equal(f.calls.length,0);
 f.cues.update(f.state(f.events(1)),true);assert.equal(f.calls[0].cue,'ingredient-draw');const next=f.state(f.events(1));next.mine.potionEvents=[{id:'fresh',at:100000}];f.cues.update(next,true);assert.equal(f.calls.length,1);f.calls[0].options.onStop();f.tick(25);assert.equal(f.calls[1].cue,'potion-drink');f.cues.update(next,true);assert.equal(f.calls.length,2);f.cues.update(next,false);f.tick(2000);assert.equal(f.calls.length,2);f.cues.destroy();
});
test('potion WAV has faded bounds and recorded deterministic checksum',()=>{
 const m=JSON.parse(fs.readFileSync('public/assets/game-sounds/quacks-manifest.json')).potion,b=fs.readFileSync('public/assets/game-sounds/'+m.file);assert.equal(m.durationMs,600);assert.equal(b.length,28844);assert.equal(m.sha256,crypto.createHash('sha256').update(b).digest('hex'));assert.equal(b.readInt16LE(44),0);assert.equal(b.readInt16LE(b.length-2),0);assert.ok(m.peak>1000&&m.peak<15000);
});

test('settlement acknowledgements are private, bounded, retry-safe and exclude rejected commands',()=>{
 const r=new QuacksRoom('ABCDEF','settle',n=>0),a=r.add('A'),b=r.add('B');r.start();r.phase='settlement';r.stage='witches';
 const req={roundId:r.roundId,requestId:crypto.randomUUID()};
 r.act(a.id,'settle-ready',req);r.act(a.id,'settle-ready',req);
 assert.equal(a.settlementEvents.length,1);assert.equal(r.view(b.id).mine.settlementEvents.length,0);
 assert.equal(Object.hasOwn(r.view(b.id).recipes[0],'settlementEvents'),false);
 assert.throws(()=>r.act(a.id,'reward',{roundId:r.roundId,requestId:crypto.randomUUID(),mode:'bad'}));assert.equal(a.settlementEvents.length,1);
 for(let n=0;n<40;n++){a.ready=false;r.phase='settlement';r.stage='witches';r.act(a.id,'settle-ready',{roundId:r.roundId,requestId:crypto.randomUUID()});}
 assert.equal(a.settlementEvents.length,32);r.nextRound();assert.equal(a.settlementEvents.length,0);
});
test('all settlement stages and own confirmations sound once, coalescing same-snapshot transitions',()=>{
 const f=audioFixture();f.cues.update(f.state([],{phase:'brewing',version:1}),false);
 const stages=['witches','essence','bonus','effects','effects-confirm','rewards','shopping'];
 stages.forEach((stage,i)=>{const s=f.state([],{phase:'settlement',stage,version:i+2,mine:{settlementEvents:[{id:'ack'+i,at:100000}]}});f.cues.update(s,true);f.cues.update(s,true);f.tick(30);});
 assert.equal(f.calls.length,7);assert.ok(f.calls.every(c=>c.cue==='settlement'));
 f.cues.update(f.state([],{phase:'between',version:10}),true);assert.equal(f.calls.length,8);f.cues.destroy();
});
test('settlement load, reconnect and hidden transitions do not replay historical acknowledgements',()=>{
 const f=audioFixture(),s=f.state([],{phase:'settlement',stage:'shopping',version:1,mine:{settlementEvents:[{id:'old',at:100000}]}});
 f.cues.update(s,false);f.cues.update(s,true);assert.equal(f.calls.length,0);
 f.cues.update({...s,version:2,mine:{settlementEvents:[{id:'new',at:100000}]}},true);assert.equal(f.calls.length,1);
 f.hide();f.cues.update({...s,phase:'between',version:3},true);f.tick(1000);assert.equal(f.calls.length,1);f.cues.destroy();
});
test('settlement WAV has faded bounds and reproducible manifest checksum',()=>{
 const m=JSON.parse(fs.readFileSync('public/assets/game-sounds/quacks-manifest.json')).settlement,b=fs.readFileSync('public/assets/game-sounds/'+m.file);
 assert.equal(m.durationMs,420);assert.equal(b.length,20204);assert.equal(m.sha256,crypto.createHash('sha256').update(b).digest('hex'));
 assert.equal(b.readInt16LE(44),0);assert.equal(b.readInt16LE(b.length-2),0);assert.ok(m.peak>1000&&m.peak<15000);
});
test('settlement waits for an occupied game audio slot, then plays once',()=>{
 const f=audioFixture({capacity:false});f.cues.update(f.state([],{phase:'brewing'}),false);f.cues.update(f.state([],{phase:'settlement',stage:'bonus',version:2}),true);
 assert.equal(f.calls.length,0);f.tick(100);assert.equal(f.calls.length,0);f.freeCapacity();f.tick(50);assert.equal(f.calls.length,1);assert.equal(f.calls[0].cue,'settlement');f.cues.destroy();
});
test('settlement glow marks actual outcomes, includes upgrade and dice results, and resets every round',()=>{
 const r=new QuacksRoom('ABCDEF','glow',n=>0),a=r.add('A'),b=r.add('B');r.start();r.phase='settlement';r.round=3;r.fortune={id:'test'};
 const chip=(color,value=1)=>({...r.chip(color,value),effectColor:color,effectValue:value,position:1});
 a.pot=[chip('black'),chip('purple'),chip('green')];b.pot=[];r.beginEffects();
 assert.ok(a.effectSummary.some(e=>e.color==='black'&&e.triggered));assert.ok(a.effectSummary.some(e=>e.color==='green'&&e.triggered));assert.ok(!a.effectSummary.some(e=>e.color==='purple'&&e.triggered));
 const q=a.pending[0];r.act(a.id,'choice',{choiceId:q.id,optionId:q.options[0].id,roundId:r.roundId,requestId:crypto.randomUUID()});
 assert.ok(a.effectSummary.some(e=>e.color==='purple'&&e.triggered));assert.ok(!b.effectSummary.some(e=>e.triggered));
 const before=r.effectSnapshot(a);a.pot[0].value=2;r.effectRecord(a,'purple',before);assert.equal(a.effectSummary.at(-1).triggered,true);
 const diceBefore=r.effectSnapshot(a);a.dice.push(0);r.effectRecord(a,'green',diceBefore);assert.equal(a.effectSummary.at(-1).triggered,true);
 r.nextRound();assert.deepEqual(a.effectSummary,[]);
});
