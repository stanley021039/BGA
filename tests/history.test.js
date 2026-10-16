const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HistoryStore}=require('../src/history/store'),{Room}=require('../src/games/poker'),{ThunderRoom}=require('../src/games/thunder');
function harness(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bga-history-'));const h=new HistoryStore(dir);t.after(()=>{h.close();fs.rmSync(dir,{recursive:true,force:true});});return{h,dir};}
test('Poker: full hand, shuffled deck, no credentials, restart and separate hands',t=>{const {h,dir}=harness(t),r=new Room('ABC123','Test');h.attach(r);const a=h.transact(r,{action:'create'},()=>r.add('A'));h.transact(r,{action:'join'},()=>r.add('B'));h.transact(r,{action:'start'},()=>r.start());let id=h.list()[0].id;assert.throws(()=>h.read(id),/尚未結束/);h.transact(r,{action:'fold',source:'timeout'},()=>r.act(r.players[r.turn].id,'fold'));let rows=h.read(id);assert.equal(rows[0].initial.phase,'waiting');assert.equal(rows.at(-1).after.phase,'showdown');assert.equal(rows.find(x=>x.kind==='result').trace.filter(x=>x.stage==='random').length,52);assert.ok(!JSON.stringify(rows).includes(a.secret));assert.equal(rows.find(x=>x.kind==='result').after.deck.length,48);h.transact(r,{action:'start'},()=>r.start());assert.equal(h.list().length,2);assert.notEqual(h.list().find(x=>x.status==='playing').id,id);h.close();const h2=new HistoryStore(dir);assert.equal(h2.list().find(x=>x.id!==id).status,'interrupted');assert.equal(h2.read(id).at(-1).after.phase,'showdown');h2.close();});
const {autoStep}=require('./helpers/race-dice');
function race(){
 let seed=913;const rng=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 const r=new ThunderRoom('DEF123','Race',rng);r.add('A');r.add('B',true);return r;
}
test('Thunder: deterministic complete automatic game terminates with a valid winner in memory',()=>{
 const r=race();r.start();let steps=0;
 while(r.phase!=='finished'){assert.ok(++steps<=2000,'automatic game must terminate');autoStep(r);}
 assert.ok(r.winner);assert.ok(r.winner.id===null||r.players.some(p=>p.id===r.winner.id));
 assert.equal(r.queue.length,0);assert.equal(r.diceCheck,null);
});
test('Thunder: real history captures start randomness, intermediate movement and a short elimination finish',t=>{
 const {h,dir}=harness(t),r=race();h.attach(r);
 h.transact(r,{action:'start'},()=>r.start());const id=h.list()[0].id;
 const start=h.readRows(id).at(-1),random=start.trace.filter(x=>x.stage==='random');
 assert.ok(random.length>0);for(const draw of random)assert.ok(Number.isInteger(draw.value)&&draw.value>=0&&draw.value<draw.max);
 h.transact(r,{action:'reveal'},()=>r.advanceDice(r.diceCheck.readyAt));
 h.transact(r,{action:'acceptDice'},()=>r.act(r.actor(),'acceptDice',{check:r.diceCheck.id}));
 const car=r.cars.find(c=>c.owner===r.players[0].id);
 h.transact(r,{action:'movement-effect'},()=>r.moveEffect({id:car.id,x:1,y:0}));
 const moved=h.readRows(id).at(-1),checkpoint=moved.trace.find(x=>x.method==='moveEffect'&&x.stage==='exit');
 assert.ok(checkpoint?.state);const saved=checkpoint.state.cars.find(c=>c.id===car.id);
 assert.equal(saved.x,1);assert.equal(saved.y,0);
 // Off-board displacement uses real elimination rules, without assigning a
 // fabricated phase, winner or car.dead. This is a domain/storage integration.
 h.transact(r,{action:'elimination-effects'},()=>{
  for(const opponent of r.cars.filter(c=>c.owner===r.players[1].id))r.moveEffect({id:opponent.id,x:-1,y:0});
  r.checkEnd();
 });
 const rows=h.read(id),last=rows.at(-1);assert.equal(r.phase,'finished');
 assert.equal(last.after.winner.id,r.players[0].id);assert.equal(h.list()[0].status,'finished');
 assert.match(rows[0].engine.source,/class ThunderRoom/);
 assert.equal(rows[0].engine.sha256,require('node:crypto').createHash('sha256').update(rows[0].engine.source).digest('hex'));
 for(const intent of rows.filter(x=>x.kind==='intent'))assert.equal(rows.filter(x=>x.kind==='result'&&x.seq===intent.seq).length,1);
 h.close();const reopened=new HistoryStore(dir);try{assert.deepEqual(reopened.read(id).at(-1).after.winner,last.after.winner);}finally{reopened.close();}
});
test('Thunder: history retains all 70 ordered events beyond the public 64-event window',t=>{
 const {h}=harness(t),r=race();h.attach(r);h.transact(r,{action:'start'},()=>r.start());
 const expected=Array.from({length:70},(_,i)=>'checkpoint '+i);
 h.transact(r,{action:'event-sequence'},()=>{for(const text of expected)r.event('test',text);});
 const row=h.readRows(h.list()[0].id).at(-1);
 assert.equal(row.traceTruncated,undefined);
 assert.deepEqual(row.trace.filter(x=>x.method==='event'&&x.stage==='enter').map(x=>x.args[1]),expected);
 assert.deepEqual(row.after.events.map(x=>x.text),expected.slice(-64));
});
test('Failed actions are recorded and cannot expose an ongoing archive',t=>{const{h}=harness(t),r=new Room('BAD123','Test');h.attach(r);r.add('A');r.add('B');h.transact(r,{action:'start'},()=>r.start());assert.throws(()=>h.transact(r,{action:'raise',source:'player'},()=>r.act(r.players[r.turn].id,'raise',-1)));const id=h.list()[0].id;assert.equal(h.readRows(id).at(-1).ok,false);assert.throws(()=>h.read(id));assert.throws(()=>h.read('../server'));});
