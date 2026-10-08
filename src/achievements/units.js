const {createHash}=require('node:crypto');
const {HttpError}=require('../http/errors');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FLAG_KEYS=['eligible','strokeAccepted','guessAccepted','correctGuess','artist','receivedTwinGifts','positiveWish','answerAccepted'];
const BASE_KEYS=['unit_event_id','match_id','game_type','unit','round','status','completed_at','participants','metrics','purpose','source','rule_version'];
function invalid(message='遊玩結算資料不正確'){throw new HttpError(400,'INVALID_ACHIEVEMENT_UNIT',message);}
function plain(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(key=>!keys.includes(key)))invalid();}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))invalid();return value.toLowerCase();}
function normalizeUnit(input,{legacy=false}={}){
 plain(input,BASE_KEYS);
 const game=input.game_type,unit=input.unit;
 if(!(legacy?['poker','thunder']:['draw','gift','majority']).includes(game)||unit!==(legacy?(game==='poker'?'hand':'race'):'round'))invalid();
 if(!Number.isSafeInteger(input.round)||input.round<1||input.round>1000000||!['rules_completed','interrupted','abandoned'].includes(input.status))invalid();
 if(typeof input.completed_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.completed_at)||!Number.isFinite(Date.parse(input.completed_at))||new Date(input.completed_at).toISOString()!==input.completed_at)invalid();
 const purpose=input.purpose===undefined?'production':input.purpose,source=input.source===undefined?'game_server':input.source;
 if(!['production','test','tutorial'].includes(purpose)||source!=='game_server'||input.rule_version!==undefined&&input.rule_version!==1)invalid();
 if(!Array.isArray(input.participants)||input.participants.length>256||!input.participants.length&&input.status==='rules_completed')invalid();
 const users=new Set(),seats=new Set();
 const participants=input.participants.map(item=>{
  plain(item,['user_id','seat_id',...FLAG_KEYS]);
  // Account IDs are exact persisted identities: older imports may use uppercase
  // UUIDs. Validate them without changing the bytes used by users/FK lookups.
  const user_id=legacy?(typeof item.user_id==='string'&&item.user_id.length>0&&item.user_id.length<=128?item.user_id:invalid()):(uuid(item.user_id),item.user_id);
  const userKey=UUID.test(user_id)?user_id.toLowerCase():user_id;
  if(typeof item.seat_id!=='string'||!item.seat_id.length||item.seat_id.length>128||/[\u0000-\u001f\u007f]/.test(item.seat_id)||users.has(userKey)||seats.has(item.seat_id))invalid();users.add(userKey);seats.add(item.seat_id);
  const row={user_id,seat_id:item.seat_id};for(const key of FLAG_KEYS){if(item[key]!==undefined&&typeof item[key]!=='boolean')invalid();row[key]=item[key]===true;}
  if(row.correctGuess&&!row.guessAccepted||row.strokeAccepted&&!row.artist||row.artist&&row.guessAccepted)invalid();
  if(game!=='draw'&&(row.strokeAccepted||row.guessAccepted||row.correctGuess||row.artist)||game!=='gift'&&(row.receivedTwinGifts||row.positiveWish)||game!=='majority'&&row.answerAccepted)invalid();
  return Object.freeze(row);
 }).sort((a,b)=>a.user_id<b.user_id?-1:a.user_id>b.user_id?1:0);
 if(participants.filter(p=>p.artist).length>1)invalid();
 const metrics=input.metrics===undefined?{}:input.metrics;plain(metrics,['participantCount','allSame','tiedLargest']);
 const participantCount=metrics.participantCount===undefined?participants.length:metrics.participantCount;
 if(!Number.isSafeInteger(participantCount)||participantCount<0||participantCount>participants.length||metrics.allSame!==undefined&&typeof metrics.allSame!=='boolean'||metrics.tiedLargest!==undefined&&typeof metrics.tiedLargest!=='boolean')invalid();
 if(game!=='majority'&&(metrics.allSame===true||metrics.tiedLargest===true)||metrics.allSame===true&&metrics.tiedLargest===true)invalid();
 return Object.freeze({unit_event_id:uuid(input.unit_event_id),match_id:uuid(input.match_id),game_type:game,unit,round:input.round,status:input.status,completed_at:input.completed_at,purpose,source,rule_version:1,participants:Object.freeze(participants),metrics:Object.freeze({participantCount,allSame:metrics.allSame===true,tiedLargest:metrics.tiedLargest===true})});
}
const fingerprintUnit=unit=>createHash('sha256').update(JSON.stringify(unit)).digest('hex');
function effectiveParticipants(unit){
 if(unit.status!=='rules_completed'||unit.purpose!=='production'||unit.source!=='game_server')return [];
 return unit.participants.filter(p=>p.eligible&&(unit.game_type==='draw'?p.strokeAccepted||p.guessAccepted:unit.game_type==='majority'?p.answerAccepted:true));
}
function participantAwards(unit,p){
 const ids=[{'draw':'draw-first-round','gift':'gift-first-gift','majority':'majority-first-vote','poker':'poker-first-hand','thunder':'thunder-first-drive'}[unit.game_type],'all-first-table'];
 if(unit.game_type==='draw'){
  if(p.artist&&p.strokeAccepted&&unit.participants.some(other=>other.user_id!==p.user_id&&other.eligible&&other.guessAccepted&&other.correctGuess))ids.push('draw-soul-artist');
  if(p.correctGuess&&p.guessAccepted)ids.push('draw-first-correct');
 }
 if(unit.game_type==='gift'){if(p.receivedTwinGifts)ids.push('gift-coincidental-twins');if(p.positiveWish)ids.push('gift-wishlist-echo');}
 if(unit.game_type==='majority'){
  const answered=unit.participants.filter(other=>other.eligible&&other.answerAccepted).length;
  if(unit.metrics.allSame&&unit.metrics.participantCount>=3&&answered===unit.metrics.participantCount)ids.push('majority-one-channel');
  if(unit.metrics.tiedLargest&&unit.metrics.participantCount>=4&&answered>=4)ids.push('majority-tied-signals');
 }
 return ids;
}
function validateAchievementUnitsDatabase(db){
 const units=new Map();
 for(const row of db.prepare('SELECT * FROM processed_unit_events ORDER BY unit_event_id').iterate()){
  let facts;try{facts=JSON.parse(row.facts_json);}catch{invalid();}
  const unit=normalizeUnit(facts,{legacy:['poker','thunder'].includes(facts.game_type)});
  if(JSON.stringify(unit)!==row.facts_json||fingerprintUnit(unit)!==row.fingerprint)invalid('遊玩結算指紋不一致');
  for(const key of ['unit_event_id','match_id','game_type','unit','status','completed_at','purpose','source','rule_version'])if(row[key]!==unit[key])invalid('遊玩結算欄位不一致');
  if(row.unit_number!==unit.round)invalid();
  for(const p of unit.participants)if(!UUID.test(p.user_id)||!db.prepare('SELECT 1 FROM users WHERE id=?').get(p.user_id))invalid('遊玩結算缺少帳號');
  units.set(unit.unit_event_id,unit);
 }
 const progress=new Map();
 for(const row of db.prepare('SELECT * FROM achievement_progress ORDER BY user_id,game_type').iterate()){
  const unit=units.get(row.first_unit_event_id);
  if(row.achievement_id!=='all-two-tables'||row.rule_version!==1||!unit||unit.game_type!==row.game_type||row.first_completed_at!==unit.completed_at||!effectiveParticipants(unit).some(p=>p.user_id===row.user_id))invalid('探索進度不符合正式參與');
  if(!progress.has(row.user_id))progress.set(row.user_id,new Set());progress.get(row.user_id).add(row.game_type);
 }
 for(const row of db.prepare("SELECT * FROM user_achievements WHERE source_key LIKE 'unit:%'").iterate()){
  const unit=units.get(row.source_key.slice(5)),participant=unit&&effectiveParticipants(unit).find(p=>p.user_id===row.user_id);
  if(!participant||row.unlocked_at!==unit.completed_at||!(row.achievement_id==='all-two-tables'?(progress.get(row.user_id)?.size||0)>=2:participantAwards(unit,participant).includes(row.achievement_id)))invalid('成就來源不符合正式結算');
 }
 return true;
}
module.exports={normalizeUnit,fingerprintUnit,effectiveParticipants,participantAwards,validateAchievementUnitsDatabase,UUID,FLAG_KEYS};
