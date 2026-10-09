'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {TelephoneRoom,drawing}=require('../src/games/telephone');
const stroke={tool:'brush',color:'#123456',size:4,points:[[10,10],[30,30]]};
function fixture(n=3){const r=new TelephoneRoom('ABCDEF','傳情',()=>0),players=Array.from({length:n},(_,i)=>r.add('玩家'+i));r.start();return {r,players};}
const cmd=(r,p,action,data={})=>r.act(p.id,action,{stepId:r.stepId,requestId:randomUUID(),...data});
for(const n of [3,4,5,6,7,8])test(n+' seats simultaneously alternate drawing/guessing and end with a guess',()=>{
 const {r,players}=fixture(n),limit=n%2?n-1:n;
 for(let round=1;round<=limit;round++){
  const seen=new Set();for(const p of players){const s=r.view(p.id);seen.add(r.bookFor(p.id).ownerId);assert.equal(s.task.previous.kind,round%2?'text':'drawing');cmd(r,p,'submit',round%2?{strokes:[stroke]}:{text:'第'+round+'頁'});}assert.equal(seen.size,n);
  assert.equal(r.view(players[0].id).canAdvance,true);cmd(r,players[0],'advance');
 }
 assert.equal(r.phase,'finished');for(const b of r.view(players[0].id).books){assert.equal(b.pages.length,limit+1);assert.equal(b.pages.at(-1).kind,'text');assert.equal(new Set(b.pages.slice(1).map(p=>p.authorId)).size,limit);}
});
test('passing view only reveals the assigned previous page, never other drafts or full books',()=>{
 const {r,players:p}=fixture(4);cmd(r,p[0],'submit',{strokes:[stroke]});assert.deepEqual(r.view(p[1].id).books,[]);assert.ok(!JSON.stringify(r.view(p[1].id)).includes('#123456'));assert.ok(!JSON.stringify(r.view(p[0].id)).includes('secret'));
 assert.equal(r.view(p[0].id).task.submitted,true);assert.equal(r.view(p[1].id).task.submitted,false);
});
test('same receipt is idempotent, changed receipt conflicts, stale page/restart cannot write',()=>{
 const {r,players:p}=fixture(),data={stepId:r.stepId,requestId:randomUUID(),strokes:[stroke]};r.act(p[0].id,'submit',data);const version=r.version;r.act(p[0].id,'submit',data);assert.equal(r.version,version);assert.throws(()=>r.act(p[0].id,'submit',{...data,strokes:[{...stroke,color:'#ffffff'}]}),e=>e.code==='REQUEST_CONFLICT');
 cmd(r,p[1],'skip');cmd(r,p[2],'skip');cmd(r,p[0],'advance');assert.throws(()=>r.act(p[0].id,'submit',data),e=>e.code==='STALE_STEP');
 for(const q of p)cmd(r,q,'skip');cmd(r,p[0],'advance');r.start();assert.throws(()=>r.act(p[0].id,'submit',data),e=>e.code==='STALE_STEP');
});
test('host/all-ready gates, single submission and text validation precede writes',()=>{
 const {r,players:p}=fixture();assert.throws(()=>cmd(r,p[1],'advance'),e=>e.code==='HOST_ONLY');assert.throws(()=>cmd(r,p[0],'advance'),e=>e.code==='NOT_READY');assert.throws(()=>cmd(r,p[0],'unknown'),e=>e.code==='INVALID_ACTION');
 for(const q of p)cmd(r,q,'skip');assert.throws(()=>cmd(r,p[0],'skip'),e=>e.code==='ALREADY_SUBMITTED');cmd(r,p[0],'advance');
 const version=r.version;for(const text of ['', 'x'.repeat(81),'a\nb',null])assert.throws(()=>cmd(r,p[0],'submit',{text}),e=>e.code==='INVALID_TEXT');assert.equal(r.version,version);cmd(r,p[0],'submit',{text:'<script>文字</script>'});assert.equal(r.submissions[p[0].id].text,'<script>文字</script>');
});
test('drawings are bounded, validated and copied; invalid coordinates/colour/tool/size rejected',()=>{
 for(const s of [{...stroke,tool:'fill'},{...stroke,color:'red'},{...stroke,size:100},{...stroke,points:[[512,0]]},{...stroke,points:[[0,-1]]},{...stroke,points:[[1.5,2]]},{...stroke,points:Array(257).fill([0,0])}])assert.throws(()=>drawing([s]),e=>e.code==='INVALID_DRAWING');
 assert.throws(()=>drawing([]));assert.throws(()=>drawing(Array(101).fill(stroke)));assert.throws(()=>drawing(Array(12).fill({...stroke,points:Array(256).fill([0,0])})),e=>e.code==='DRAWING_LIMIT');const s=JSON.parse(JSON.stringify(stroke)),saved=drawing([s]);s.points[0][0]=99;assert.equal(saved[0].points[0][0],10);
});
test('departure preserves submitted pages, marks interruption and transfers host; no new seats mid-game',()=>{
 const {r,players:p}=fixture();assert.throws(()=>r.add('晚到'),e=>e.code==='MATCH_STARTED');cmd(r,p[0],'submit',{strokes:[stroke]});r.kick(p[0].id,p[0].id,true);assert.equal(r.phase,'finished');assert.equal(r.interrupted,true);assert.equal(r.host,p[1].id);assert.equal(r.view(p[1].id).books[0].pages[1].strokes[0].color,'#123456');r.add('新玩家');r.start();assert.equal(r.interrupted,false);
});
test('independent source settings, capacity and invalid RNG leave start atomic',()=>{
 const r=new TelephoneRoom('ABCDEF','test',()=>999),p=Array.from({length:8},(_,i)=>r.add(String(i)));assert.throws(()=>r.add('9'));assert.throws(()=>r.configure(p[1].id,{sources:['silly']}),e=>e.code==='HOST_ONLY');for(const sources of [[],['custom'],['silly','silly']])assert.throws(()=>r.configure(p[0].id,{sources}));r.configure(p[0].id,{sources:['silly']});assert.throws(()=>r.start());assert.equal(r.phase,'waiting');assert.equal(r.books.length,0);r.rng=()=>0;r.start();assert.ok(r.books.every(b=>b.promptId.startsWith('telephone-silly-')));assert.equal(new Set(r.books.map(b=>b.promptId)).size,8);
});
test('script bots only submit their public task; host still controls passing',()=>{
 const {runTestAIStep}=require('../src/ai'),r=new TelephoneRoom('ABCDEF','bots',()=>0),host=r.add('host');r.add('bot1',true);r.add('bot2',true);r.start();const history={transact:(room,op,run)=>run()};for(let i=0;i<5;i++)runTestAIStep(r,{history,now:i*1500});assert.equal(r.round,1);assert.equal(Object.keys(r.submissions).length,2);cmd(r,host,'skip');cmd(r,host,'advance');for(let i=5;i<10;i++)runTestAIStep(r,{history,now:i*1500});assert.equal(Object.keys(r.submissions).length,2);
});
