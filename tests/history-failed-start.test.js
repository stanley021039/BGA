const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {HistoryStore}=require('../src/history/store');
const {DrawGuessRoom}=require('../src/games/draw-guess'),{GiftRoom}=require('../src/games/gift'),{MajorityRoom}=require('../src/games/majority'),{Room}=require('../src/games/poker'),{ThunderRoom}=require('../src/games/thunder');
function harness(t){const testRoot=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(testRoot,'bga-failed-start-')),h=new HistoryStore(dir,{maxArchives:2,maxResultBytes:64*1024,maxSessionBytes:128*1024,maxMatchBytes:512*1024,maxTotalBytes:1024*1024});t.after(()=>{h.close();assert.equal(path.dirname(path.resolve(dir)),testRoot);assert.ok(path.basename(dir).startsWith('bga-failed-start-'));fs.rmSync(dir,{recursive:true,force:true});});return {dir,h};}
for(const Engine of [DrawGuessRoom,GiftRoom,MajorityRoom,Room,ThunderRoom])test(Engine.name+': repeated rejected starts remain evictable and do not consume active match slots',t=>{
 const {dir,h}=harness(t),r=new Engine('FA1111','rejected start');h.attach(r);h.transact(r,{action:'create'},()=>r.add('only player'));
 for(let i=0;i<12;i++){
  assert.throws(()=>h.transact(r,{action:'start'},()=>r.start()));
  assert.equal(r.phase,'waiting');assert.ok(h.list().length<=2);assert.ok(h.list().every(m=>m.status==='interrupted'&&m.reason==='開局未完成'));
  assert.ok(fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).length<=3);
 }
 const archived=h.list().at(0),rows=h.read(archived.id);assert.equal(rows[0].kind,'header');assert.equal(rows.filter(row=>row.kind==='intent').length,1);assert.equal(rows.filter(row=>row.kind==='result').length,1);assert.equal(rows.at(-1).ok,false);assert.equal(rows.at(-1).after.phase,'waiting');
 for(let i=0;i<(Engine===GiftRoom||Engine===MajorityRoom?2:1);i++)h.transact(r,{action:'join'},()=>r.add('ready'+i));
 h.transact(r,{action:'start'},()=>r.start());const live=h.list().find(m=>m.status==='playing');assert.ok(live);assert.equal(live.count,1);assert.ok(h.list().length<=2);assert.equal(h.readRows(live.id).at(-1).ok,true);
 const other=new DrawGuessRoom('FA2222','unaffected');h.attach(other);h.transact(other,{action:'create'},()=>other.add('healthy'));assert.equal(other.players.length,1);
});

test('a rejected restart from a finished room cannot archive the previous winner as a new successful result',t=>{
 const {h}=harness(t),r=new DrawGuessRoom('FA3333','old result');h.attach(r);r.add('only player');r.phase='finished';r.winner={ids:[r.players[0].id],score:99};
 assert.throws(()=>h.transact(r,{action:'start'},()=>r.start()));const m=h.list()[0];assert.equal(m.status,'interrupted');assert.equal(m.reason,'開局未完成');assert.equal(m.result,undefined);assert.equal(h.read(m.id).at(-1).ok,false);
});

test('a failed fsync after writing the result still accounts for the physical bytes and pauses the room',t=>{
 const {h,dir}=harness(t),r=new DrawGuessRoom('FA4444','fsync accounting');h.attach(r);h.transact(r,{action:'create'},()=>r.add('a'));
 const fsync=fs.fsyncSync;let writes=0;t.mock.method(fs,'fsyncSync',fd=>{if(++writes===2)throw Object.assign(Error('failed result fsync'),{code:'EIO'});return fsync(fd);});
 assert.throws(()=>h.transact(r,{action:'join'},()=>r.add('b')),/failed result fsync/);assert.equal(h.isPaused(r),true);
 const physical=fs.readdirSync(dir).filter(name=>name!=='.lock').reduce((sum,name)=>sum+fs.statSync(path.join(dir,name)).size,0);
 assert.equal(h.totalBytes,physical);
});

test('a failed metadata rename accounts for the leftover temporary file and keeps game state unmodified',t=>{
 const {h,dir}=harness(t),r=new DrawGuessRoom('FA5555','metadata accounting');h.attach(r);r.add('a');r.add('b');
 t.mock.method(fs,'renameSync',()=>{throw Object.assign(Error('failed metadata rename'),{code:'EIO'});});
 assert.throws(()=>h.transact(r,{action:'start'},()=>r.start()),/failed metadata rename/);assert.equal(h.isPaused(r),true);assert.equal(r.phase,'waiting');
 assert.ok(fs.readdirSync(dir).some(name=>name.endsWith('.meta.json.tmp')));
 const physical=fs.readdirSync(dir).filter(name=>name!=='.lock').reduce((sum,name)=>sum+fs.statSync(path.join(dir,name)).size,0);
 assert.equal(h.totalBytes,physical);
});
