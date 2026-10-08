const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {openDatabase}=require('../src/db'),{AchievementStore,definitions,validateAchievementUnitsDatabase}=require('../src/achievements/store');
const {normalizeUnit}=require('../src/achievements/units');
const at='2026-10-08T03:00:00.000Z';
function fixture(t,{uppercase=false}={}){
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'bga-achievement-units-')),file=path.join(root,'app.sqlite');let db=openDatabase(file),store=new AchievementStore(db);
 const users=Array.from({length:4},(_,i)=>{const id=uppercase&&i===0?'ABCDEFAB-CDEF-4ABC-ABCD-EFABCDEFABCD':randomUUID();db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run(id,'unit_'+i,'玩家'+i,'unused','member',at);return id;});
 t.after(()=>{db.close();assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(root).startsWith('bga-achievement-units-'));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});});
 const participants=()=>users.map((user_id,i)=>({user_id,seat_id:'seat-'+i,eligible:true}));
 function unit(game='draw',changes={}){const people=participants();if(game==='draw'){Object.assign(people[0],{artist:true,strokeAccepted:true});Object.assign(people[1],{guessAccepted:true,correctGuess:true});}if(game==='majority')for(const p of people)p.answerAccepted=true;
  return {unit_event_id:randomUUID(),match_id:randomUUID(),game_type:game,unit:'round',round:1,status:'rules_completed',completed_at:at,participants:people,metrics:{participantCount:4},...changes};}
 const has=(user,id)=>!!store.list(user).achievements.find(a=>a.id===id)?.unlockedAt;
 const count=table=>db.prepare('SELECT COUNT(*) n FROM '+table).get().n;
 return {users,unit,has,count,get db(){return db;},get store(){return store;},reopen(){db.close();db=openDatabase(file);store=new AchievementStore(db);}};
}

test('metadata registers exactly the five unchanged entries and eight scoped new IDs',t=>{
 const f=fixture(t),list=f.store.list(f.users[0]);assert.equal(list.achievements.length,13);assert.equal(new Set(definitions.map(d=>d.id)).size,13);
 assert.deepEqual(definitions.slice(0,5).map(({id,title})=>({id,title})),[{id:'gift-first-gift',title:'第一份心意'},{id:'majority-first-vote',title:'第一次舉牌'},{id:'poker-first-hand',title:'第一手牌'},{id:'thunder-first-drive',title:'公路初航'},{id:'all-first-table',title:'第一桌'}]);
 for(const d of list.achievements){assert.equal(d.achievement_id,d.id);assert.equal(d.rule_version,1);assert.equal(d.visibility,'private');assert.equal(d.status,'enabled');assert.equal(d.unlockedAt,null);assert.ok(d.condition_key&&d.description);assert.ok(['edit','check','gift','users','cards','car','table'].includes(d.icon_key));}
 assert.ok(Object.isFrozen(definitions));assert.ok(definitions.every(Object.isFrozen));
});

test('old achievement dates and sources survive new awards without retroactive exploration progress',t=>{
 const f=fixture(t),user=f.users[0],date='2026-10-01T01:02:03.000Z';
 for(const d of definitions.slice(0,5))f.db.prepare('INSERT INTO user_achievements VALUES(?,?,?,?)').run(user,d.id,'old:'+d.id,date);
 const before=f.db.prepare('SELECT * FROM user_achievements WHERE user_id=? ORDER BY achievement_id').all(user);f.store.processUnit(f.unit());
 const after=f.db.prepare("SELECT * FROM user_achievements WHERE user_id=? AND source_key LIKE 'old:%' ORDER BY achievement_id").all(user);assert.deepEqual(after,before);assert.equal(f.has(user,'all-two-tables'),false);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM achievement_progress WHERE user_id=?').get(user).n,1);
 f.store.processUnit(f.unit('majority'));assert.equal(f.has(user,'all-two-tables'),true);assert.equal(validateAchievementUnitsDatabase(f.db),true);
});

test('draw awards require accepted core participation and another eligible account understanding the artist',t=>{
 const f=fixture(t),event=f.unit(),result=f.store.processUnit(event);assert.equal(result.duplicate,false);
 assert.ok(f.has(f.users[0],'draw-soul-artist'));assert.ok(f.has(f.users[0],'draw-first-round'));assert.ok(f.has(f.users[1],'draw-first-correct'));assert.ok(f.has(f.users[1],'all-first-table'));
 assert.equal(f.has(f.users[2],'draw-first-round'),false);assert.equal(f.has(f.users[2],'all-first-table'),false);assert.equal(f.count('achievement_progress'),2);
 const g=fixture(t),noStroke=g.unit();noStroke.participants[0].strokeAccepted=false;noStroke.participants[1].correctGuess=false;g.store.processUnit(noStroke);assert.equal(g.has(g.users[0],'draw-soul-artist'),false);assert.equal(g.has(g.users[0],'draw-first-round'),false);assert.equal(g.has(g.users[1],'draw-first-correct'),false);assert.equal(g.has(g.users[1],'draw-first-round'),true);
});

test('gift twins and positive wishes reward only qualifying recipients after complete rules outcome',t=>{
 const f=fixture(t),event=f.unit('gift');event.participants[0].receivedTwinGifts=true;event.participants[1].positiveWish=true;Object.assign(event.participants[2],{eligible:false,receivedTwinGifts:true,positiveWish:true});f.store.processUnit(event);
 assert.equal(f.has(f.users[0],'gift-coincidental-twins'),true);assert.equal(f.has(f.users[1],'gift-wishlist-echo'),true);assert.equal(f.has(f.users[0],'gift-wishlist-echo'),false);assert.equal(f.has(f.users[2],'gift-first-gift'),false);assert.equal(f.has(f.users[3],'gift-coincidental-twins'),false);assert.equal(validateAchievementUnitsDatabase(f.db),true);
});

test('majority collective awards enforce minimum counts and retain valid-answer qualification',t=>{
 const f=fixture(t),same=f.unit('majority',{metrics:{participantCount:4,allSame:true}});f.store.processUnit(same);for(const user of f.users)assert.equal(f.has(user,'majority-one-channel'),true);
 const g=fixture(t),tied=g.unit('majority',{metrics:{participantCount:4,tiedLargest:true}});g.store.processUnit(tied);for(const user of g.users)assert.equal(g.has(user,'majority-tied-signals'),true);
 const h=fixture(t),small=h.unit('majority',{metrics:{participantCount:2,allSame:true}});small.participants=small.participants.slice(0,2);h.store.processUnit(small);assert.equal(h.has(h.users[0],'majority-one-channel'),false);
 const k=fixture(t),missing=k.unit('majority',{metrics:{participantCount:4,allSame:true}});missing.participants[3].answerAccepted=false;k.store.processUnit(missing);assert.equal(k.has(k.users[0],'majority-one-channel'),false);assert.equal(k.has(k.users[3],'majority-first-vote'),false);
 const l=fixture(t),removed=l.unit('majority',{metrics:{participantCount:4,tiedLargest:true}});removed.participants[3].eligible=false;l.store.processUnit(removed);assert.equal(l.has(l.users[0],'majority-tied-signals'),false);
});

test('interrupted, abandoned, test and tutorial receipts never award or advance exploration',t=>{
 const f=fixture(t);
 for(const changes of [{status:'interrupted'},{status:'abandoned'},{purpose:'test'},{purpose:'tutorial'}]){const result=f.store.processUnit(f.unit('gift',changes));assert.deepEqual(result.awards,[]);assert.equal(result.duplicate,false);}
 assert.equal(f.count('processed_unit_events'),4);assert.equal(f.count('user_achievements'),0);assert.equal(f.count('achievement_progress'),0);assert.equal(validateAchievementUnitsDatabase(f.db),true);
});

test('reordered equivalent participants, retries and a reopened store are durable no-ops',t=>{
 const f=fixture(t),event=f.unit('gift'),first=f.store.processUnit(event),counts=['processed_unit_events','achievement_progress','user_achievements'].map(f.count);
 event.participants.reverse();assert.equal(f.store.processUnit(event).duplicate,true);f.reopen();const repeated=f.store.processUnit(event);assert.equal(repeated.duplicate,true);assert.deepEqual(repeated.awards,[]);assert.deepEqual(['processed_unit_events','achievement_progress','user_achievements'].map(f.count),counts);assert.ok(first.awards.length>0);
});

test('same UUID changed facts and same match/unit changed event UUID cause hard conflicts without writes',t=>{
 const f=fixture(t),event=f.unit('gift');f.store.processUnit(event);const counts=['processed_unit_events','achievement_progress','user_achievements'].map(f.count);
 assert.throws(()=>f.store.processUnit({...event,status:'interrupted'}),{status:409,code:'UNIT_EVENT_CONFLICT'});assert.throws(()=>f.store.processUnit({...event,unit_event_id:randomUUID()}),{status:409,code:'UNIT_EVENT_CONFLICT'});assert.deepEqual(['processed_unit_events','achievement_progress','user_achievements'].map(f.count),counts);
});

test('award insertion failure atomically rolls back receipt, progress and earlier awards; the same unit can retry',t=>{
 const f=fixture(t),event=f.unit();f.db.exec("CREATE TEMP TRIGGER fail_badge BEFORE INSERT ON user_achievements WHEN NEW.achievement_id='all-first-table' BEGIN SELECT RAISE(ABORT,'synthetic award failure'); END");
 assert.throws(()=>f.store.processUnit(event),/synthetic award failure/);for(const table of ['processed_unit_events','achievement_progress','user_achievements'])assert.equal(f.count(table),0);
 f.db.exec('DROP TRIGGER fail_badge');assert.equal(f.store.processUnit(event).duplicate,false);assert.ok(f.count('user_achievements')>0);assert.equal(validateAchievementUnitsDatabase(f.db),true);
});

test('malformed identities, duplicate mapping, private raw facts and coercive booleans fail before any write',t=>{
 const f=fixture(t),event=f.unit();const invalid=[{...event,unit_event_id:'room-code'},{...event,participants:[event.participants[0],event.participants[0]]},{...event,participants:[{...event.participants[0],user_id:'display name'}]},{...event,participants:[{...event.participants[0],eligible:'true'}]},{...event,participants:[{...event.participants[0],rawAnswer:'private'}]},{...event,rawCanvas:'private'},{...event,metrics:{...event.metrics,answer:'private'}},{...event,metrics:null},{...event,source:'archive'},{...event,rule_version:2},{...event,round:0}];
 for(const input of invalid)assert.throws(()=>f.store.processUnit(input),{status:400,code:'INVALID_ACHIEVEMENT_UNIT'});assert.equal(f.count('processed_unit_events'),0);assert.equal(f.count('achievement_progress'),0);
 const missing=f.unit('gift');missing.participants[0].user_id=randomUUID();assert.throws(()=>f.store.processUnit(missing),{code:'INVALID_ACHIEVEMENT_UNIT'});assert.equal(f.count('processed_unit_events'),0);
});

test('disabled account cannot gain new badges or exploration while its canonical receipt remains auditable',t=>{
 const f=fixture(t);f.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(f.users[0]);f.store.processUnit(f.unit('gift'));assert.equal(f.has(f.users[0],'gift-first-gift'),false);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM achievement_progress WHERE user_id=?').get(f.users[0]).n,0);assert.equal(f.count('processed_unit_events'),1);
});

test('existing poker and race handlers add only fresh qualifying exploration and respect purpose',t=>{
 const f=fixture(t),seat='legacy-seat',seats=new Map([[f.users[0],seat]]),player={id:seat,handDecision:true,completedHumanTurn:true};
 const poker={phase:'showdown',hand:1,results:[{name:'not an identity'}],players:[player],achievementMatchId:randomUUID()};assert.deepEqual(f.store.awardPokerHand(poker,seats),[f.users[0]]);assert.equal(f.has(f.users[0],'all-two-tables'),false);
 const race={type:'thunder',phase:'finished',winner:{id:seat},round:9,player:()=>player,achievementMatchId:randomUUID()};assert.deepEqual(f.store.awardRaceFinish(race,seats),[f.users[0]]);assert.equal(f.has(f.users[0],'all-two-tables'),true);const count=f.count('processed_unit_events');f.reopen();assert.deepEqual(f.store.awardPokerHand(poker,seats),[]);assert.deepEqual(f.store.awardRaceFinish(race,seats),[]);assert.equal(f.count('processed_unit_events'),count);assert.equal(validateAchievementUnitsDatabase(f.db),true);
 const otherSeats=new Map([[f.users[1],seat]]),testPoker={...poker,results:[],achievementMatchId:randomUUID()};testPoker.results=[{}];assert.deepEqual(f.store.awardPokerHand(testPoker,otherSeats,{purpose:'test'}),[]);assert.equal(f.has(f.users[1],'poker-first-hand'),false);
 const testRace={...race,winner:{id:seat},achievementMatchId:randomUUID()};assert.deepEqual(f.store.awardRaceFinish(testRace,otherSeats,{purpose:'tutorial'}),[]);assert.equal(f.has(f.users[1],'thunder-first-drive'),false);
});

test('legacy processed guards are committed only after the durable award transaction succeeds',t=>{
 const f=fixture(t),seat='seat',seats=new Map([[f.users[0],seat]]),room={phase:'showdown',hand:1,results:[{}],players:[{id:seat,handDecision:true}],achievementMatchId:randomUUID()};
 f.db.exec("CREATE TEMP TRIGGER fail_old_badge BEFORE INSERT ON user_achievements BEGIN SELECT RAISE(ABORT,'retry legacy'); END");assert.throws(()=>f.store.awardPokerHand(room,seats),/retry legacy/);assert.equal(f.count('processed_unit_events'),0);f.db.exec('DROP TRIGGER fail_old_badge');assert.deepEqual(f.store.awardPokerHand(room,seats),[f.users[0]]);assert.equal(f.count('processed_unit_events'),1);
});

test('database verifier rejects altered facts, metadata columns and exploration pointing at an ineligible unit',t=>{
 for(const mutate of [
  (f,event)=>f.db.prepare('UPDATE processed_unit_events SET fingerprint=? WHERE unit_event_id=?').run('0'.repeat(64),event.unit_event_id),
  (f,event)=>f.db.prepare('UPDATE processed_unit_events SET completed_at=? WHERE unit_event_id=?').run('2026-10-09T00:00:00.000Z',event.unit_event_id),
  (f,event)=>f.db.prepare('UPDATE achievement_progress SET first_completed_at=? WHERE first_unit_event_id=?').run('2026-10-09T00:00:00.000Z',event.unit_event_id),
 ]){const f=fixture(t),event=f.unit('gift');f.store.processUnit(event);assert.equal(validateAchievementUnitsDatabase(f.db),true);mutate(f,event);assert.throws(()=>validateAchievementUnitsDatabase(f.db),{code:'INVALID_ACHIEVEMENT_UNIT'});}
});

test('canonical normalization freezes minimal facts and does not retain caller-owned mutable arrays',()=>{
 const user=randomUUID(),event={unit_event_id:randomUUID(),match_id:randomUUID(),game_type:'draw',unit:'round',round:1,status:'rules_completed',completed_at:at,participants:[{user_id:user,seat_id:'artist',eligible:true,artist:true,strokeAccepted:true}]};
 const canonical=normalizeUnit(event);event.participants[0].eligible=false;event.participants.push({});assert.equal(canonical.participants.length,1);assert.equal(canonical.participants[0].eligible,true);assert.ok(Object.isFrozen(canonical));assert.ok(Object.isFrozen(canonical.participants[0]));assert.ok(Object.isFrozen(canonical.metrics));
});
test('a drawn round cannot forge extra participants, multiple artists or an artist guessing their own answer',t=>{
 const f=fixture(t),event=f.unit();
 assert.throws(()=>f.store.processUnit({...event,metrics:{participantCount:5}}),{code:'INVALID_ACHIEVEMENT_UNIT'});
 const multiple=structuredClone(event);multiple.participants[2].artist=true;assert.throws(()=>f.store.processUnit(multiple),{code:'INVALID_ACHIEVEMENT_UNIT'});
 const selfGuess=structuredClone(event);Object.assign(selfGuess.participants[0],{guessAccepted:true,correctGuess:true});assert.throws(()=>f.store.processUnit(selfGuess),{code:'INVALID_ACHIEVEMENT_UNIT'});
 assert.equal(f.count('processed_unit_events'),0);
});
test('uppercase imported account UUIDs keep their exact database identity through awards, progress, verification and reboot replay',t=>{
 const f=fixture(t,{uppercase:true}),user=f.users[0],before=f.db.prepare('SELECT * FROM users WHERE id=?').get(user),event=f.unit('gift');
 event.unit_event_id=event.unit_event_id.toUpperCase();event.match_id=event.match_id.toUpperCase();const canonical=normalizeUnit(event);
 assert.equal(canonical.unit_event_id,event.unit_event_id.toLowerCase());assert.equal(canonical.match_id,event.match_id.toLowerCase());
 const result=f.store.processUnit(event);assert.equal(result.duplicate,false);assert.ok(f.has(user,'gift-first-gift'));assert.equal(f.has(user.toLowerCase(),'gift-first-gift'),false);assert.equal(canonical.participants.find(p=>p.seat_id==='seat-0').user_id,user);
 const progress=f.db.prepare('SELECT * FROM achievement_progress WHERE user_id=?').get(user);assert.equal(progress.user_id,user);assert.equal(progress.first_unit_event_id,event.unit_event_id.toLowerCase());
 const receipt=f.db.prepare('SELECT facts_json FROM processed_unit_events WHERE unit_event_id=?').get(progress.first_unit_event_id);assert.equal(JSON.parse(receipt.facts_json).participants.find(p=>p.seat_id==='seat-0').user_id,user);assert.equal(validateAchievementUnitsDatabase(f.db),true);
 const counts=['processed_unit_events','achievement_progress','user_achievements'].map(f.count);f.reopen();assert.equal(f.store.processUnit(event).duplicate,true);assert.deepEqual(['processed_unit_events','achievement_progress','user_achievements'].map(f.count),counts);assert.deepEqual(f.db.prepare('SELECT * FROM users WHERE id=?').get(user),before);
 const duplicate=f.unit('gift');duplicate.participants=[{user_id:user,seat_id:'one',eligible:true},{user_id:user.toLowerCase(),seat_id:'two',eligible:true}];duplicate.metrics={participantCount:2};assert.throws(()=>f.store.processUnit(duplicate),{code:'INVALID_ACHIEVEMENT_UNIT'});assert.equal(f.count('processed_unit_events'),counts[0]);
});
