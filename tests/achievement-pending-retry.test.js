const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const {createApp}=require('../src/app'),{openDatabase}=require('../src/db'),{createAuth}=require('../src/auth');

test('a completed poker unit survives failed SQLite writes and room deletion, then commits exactly once during the live process sweep',async t=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'bga-achievement-pending-'));
 const config={host:'127.0.0.1',port:0,dbFile:path.join(root,'app.sqlite'),historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),externalSideEffectsEnabled:false,achievementPurpose:'production'};
 const setup=openDatabase(config.dbFile);await createAuth(setup).bootstrap('pending_host','synthetic-pending-password');setup.close();
 const app=createApp(config),{port}=await app.listen(),base='http://127.0.0.1:'+port,db=openDatabase(config.dbFile);
 const warnings=[],originalError=console.error;console.error=(...args)=>warnings.push(args);
 t.after(async()=>{
  try{db.exec('DROP TRIGGER IF EXISTS reject_unit_receipt');await app.close();db.close();}
  finally{console.error=originalError;assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('bga-achievement-pending-'));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});}
 });
 let cookie;
 async function post(route,data={}){const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 async function get(route){const response=await fetch(base+'/api/'+route,{headers:{Cookie:cookie}});return {status:response.status,body:await response.json()};}
 const login=await post('auth/login',{username:'pending_host',password:'synthetic-pending-password'});assert.equal(login.status,200);cookie=login.cookie;
 const created=await post('create',{type:'poker'});assert.equal(created.status,200);const code=created.body.code;
 assert.equal((await post('bot',{code})).status,200);assert.equal((await post('start',{code})).status,200);
 // The trigger is on the real application's SQLite connection too. No mocked
 // clock, engine finish call or synthetic HTTP winner is involved.
 db.exec("CREATE TRIGGER reject_unit_receipt BEFORE INSERT ON processed_unit_events BEGIN SELECT RAISE(ABORT,'synthetic receipt unavailable'); END");
 const folded=await post('action',{code,action:'fold'});assert.equal(folded.status,200);assert.equal(folded.body.phase,'showdown');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM processed_unit_events').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM achievement_progress').get().n,0);
 const before=await get('achievements');assert.equal(before.body.achievements.find(a=>a.id==='poker-first-hand').unlockedAt,null);
 const left=await post('leave',{code});assert.equal(left.status,200);assert.equal(left.body.deleted,true);assert.equal((await get('state?code='+code)).status,404);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM processed_unit_events').get().n,0);assert.ok(warnings.some(args=>String(args[0]).includes('Achievement update failed')));
 db.exec('DROP TRIGGER reject_unit_receipt');
 const deadline=Date.now()+4000;let receipt;
 while(Date.now()<deadline){receipt=db.prepare('SELECT * FROM processed_unit_events').get();if(receipt)break;await delay(40);}
 assert.ok(receipt,'the global retry queue must outlive its deleted room');assert.equal(receipt.game_type,'poker');assert.equal(receipt.unit,'hand');assert.equal(receipt.unit_number,1);assert.equal(receipt.status,'rules_completed');assert.equal(receipt.purpose,'production');
 const after=await get('achievements');assert.equal(after.status,200);assert.ok(after.body.achievements.find(a=>a.id==='poker-first-hand').unlockedAt);assert.ok(after.body.achievements.find(a=>a.id==='all-first-table').unlockedAt);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM processed_unit_events').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM achievement_progress').get().n,1);
 const records=db.prepare('SELECT * FROM user_achievements ORDER BY achievement_id').all();assert.equal(records.length,2);assert.ok(records.every(row=>row.source_key==='unit:'+receipt.unit_event_id&&row.unlocked_at===receipt.completed_at));
 await delay(850);await get('achievements');assert.equal(db.prepare('SELECT COUNT(*) n FROM processed_unit_events').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM achievement_progress').get().n,1);assert.deepEqual(db.prepare('SELECT * FROM user_achievements ORDER BY achievement_id').all(),records);
 assert.equal((await get('state?code='+code)).status,404,'retry must not recreate or rejoin the room');
});
