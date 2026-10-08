const {randomUUID,createHash}=require('node:crypto');
const {transaction}=require('../db');
const {HttpError}=require('../http/errors');
const R=require('../../public/market-rules');
const fail=(status,code,message)=>{throw new HttpError(status,code,message);};

class MarketStore{
 constructor(db,clock=Date.now){this.db=db;this.clock=clock;}
 user(actor,admin=false){const user=this.db.prepare('SELECT id,username,display_name,role,disabled FROM users WHERE id=?').get(actor?.id||'');if(!user||user.disabled)fail(401,'UNAUTHORIZED','請重新登入');if(admin&&user.role!=='admin')fail(403,'ADMIN_REQUIRED','只有管理者可以操作');return user;}
 round(id){const row=this.db.prepare('SELECT * FROM market_rounds WHERE id=?').get(typeof id==='string'?id:'');if(!row)fail(404,'ROUND_NOT_FOUND','找不到交易日');return row;}
 revision(value){if(!Number.isSafeInteger(value)||value<0)fail(400,'INVALID_REVISION','請重新整理後再操作');return value;}
 write(actor,operation,data,run,admin=false){
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(data.requestId||''))fail(400,'INVALID_REQUEST_ID','缺少操作識別碼');
  const fingerprint=createHash('sha256').update(JSON.stringify({operation,...data})).digest('hex');
  return transaction(this.db,()=>{
   const user=this.user(actor,admin),old=this.db.prepare('SELECT * FROM market_requests WHERE user_id=? AND request_id=?').get(user.id,data.requestId);
   if(old){if(old.fingerprint!==fingerprint)fail(409,'REQUEST_ID_REUSED','操作識別碼已被使用');return {...JSON.parse(old.response_json),replayed:true};}
   // Sample time after obtaining the write lock; queued requests cannot cross a deadline.
   const now=this.clock(),result=run(user,now);
   this.db.prepare('INSERT INTO market_requests VALUES(?,?,?,?,?,?)').run(user.id,data.requestId,operation,fingerprint,JSON.stringify(result),new Date(now).toISOString());return result;
  });
 }
 create(actor,input){const data={requestId:input.requestId,targetDate:input.targetDate,confirmed:input.confirmed===true};return this.write(actor,'create',data,(user,now)=>{
  if(!data.confirmed)fail(400,'CONFIRM_REQUIRED','請確認這是下一個交易日');if(!R.validDate(data.targetDate))fail(400,'INVALID_DATE','交易日期格式不正確');
  const rules=R.snapshot(),cutoff=R.cutoffFor(data.targetDate,rules),after=R.settlementFor(data.targetDate,rules);
  if(now>=Date.parse(cutoff))fail(409,'CUTOFF_PASSED','此交易日的投票截止時間已過');if(this.db.prepare('SELECT 1 FROM market_rounds WHERE target_date=?').get(data.targetDate))fail(409,'ROUND_EXISTS','此交易日已建立');
  const id=randomUUID();this.db.prepare('INSERT INTO market_rounds(id,target_date,cutoff_at,settlement_after,rules_json,created_by,created_at) VALUES(?,?,?,?,?,?,?)').run(id,data.targetDate,cutoff,after,JSON.stringify(rules),user.id,new Date(now).toISOString());return {ok:true,roundId:id};
 },true);}
 vote(actor,input){const data={requestId:input.requestId,roundId:input.roundId,optionId:input.optionId,expectedRevision:this.revision(input.expectedRevision)};return this.write(actor,'vote',data,(user,now)=>{
  const round=this.round(data.roundId),rules=R.validate(JSON.parse(round.rules_json));if(!rules.options.some(o=>o.id===data.optionId))fail(400,'INVALID_OPTION','請選擇一個預測區間');
  if(round.void_at||round.result_revision||now>=Date.parse(round.cutoff_at))fail(409,'VOTING_CLOSED','投票已截止');
  const old=this.db.prepare('SELECT * FROM market_votes WHERE round_id=? AND user_id=?').get(round.id,user.id);
  if((old?.revision||0)!==data.expectedRevision)fail(409,'STALE_VOTE','投票已在另一個頁面更新，請重新整理');
  if(old?.option_id===data.optionId)return {ok:true,revision:old.revision,unchanged:true};
  // Wall-clock rollback must not invert vote history or invalidate a backup.
  // The deadline above still uses the freshly sampled wall clock.
  const at=new Date(old?Math.max(now,Date.parse(old.created_at),Date.parse(old.updated_at)):now).toISOString(),revision=(old?.revision||0)+1;
  this.db.prepare('INSERT INTO market_votes VALUES(?,?,?,?,?,?) ON CONFLICT(round_id,user_id) DO UPDATE SET option_id=excluded.option_id,revision=excluded.revision,updated_at=excluded.updated_at').run(round.id,user.id,data.optionId,revision,old?.created_at||at,at);return {ok:true,revision};
 });}
 settlementInput(input){return {requestId:input.requestId,roundId:input.roundId,returnPct:input.returnPct,reason:typeof input.reason==='string'?input.reason.trim():'',expectedRevision:this.revision(input.expectedRevision),confirmed:input.confirmed===true};}
 checkSettlement(data,now){const round=this.round(data.roundId),rules=R.validate(JSON.parse(round.rules_json));if(round.void_at)fail(409,'ROUND_VOID','此交易日已因休市作廢，不計分');if(data.expectedRevision!==round.result_revision)fail(409,'STALE_RESULT','結算版本已更新，請重新預覽');if(now<Date.parse(round.settlement_after))fail(409,'TOO_EARLY','交易日 13:30 後才可結算');
  let value;try{value=R.parseReturn(data.returnPct,rules);}catch(error){fail(400,'INVALID_RETURN',error.message);}const bucket=R.classify(value,rules);
  if(round.result_revision&&value===round.return_pct)fail(409,'RESULT_UNCHANGED','此結果已結算，無須重複操作');if(data.reason.length>240||round.result_revision&&!data.reason)fail(400,'CORRECTION_REASON','更正結果須填寫原因（最多 240 字）');
  return {round,rules,value,bucket};
 }
 preview(actor,input){const data=this.settlementInput(input);return transaction(this.db,()=>{const user=this.user(actor,true),now=this.clock(),{round,rules,value,bucket}=this.checkSettlement(data,now),votes=this.db.prepare('SELECT * FROM market_votes WHERE round_id=?').all(round.id),counts={hit:0,miss:0,tie:0};for(const vote of votes)counts[R.outcome(vote.option_id,bucket)]++;
  const own=votes.find(v=>v.user_id===user.id),old=this.db.prepare("SELECT points FROM market_ledger WHERE round_id=? AND user_id=? AND revision=? AND kind='award'").get(round.id,user.id,round.result_revision)?.points||0,next=own?R.points(own.option_id,bucket,rules):0;
  return {roundId:round.id,targetDate:round.target_date,returnPct:value,bucket,counts,voteCount:votes.length,expectedRevision:round.result_revision,ownPrevious:old,ownNext:next,ownScoreAfter:this.stats(user.id).score-old+next,serverNow:new Date(now).toISOString()};
 });}
 settle(actor,input){const data=this.settlementInput(input);return this.write(actor,'settle',data,(user,now)=>{
  if(!data.confirmed)fail(400,'CONFIRM_REQUIRED','請先預覽並確認結算');const {round,rules,value,bucket}=this.checkSettlement(data,now);
  return this.applySettlement({round,rules,value,bucket,reason:data.reason,actorId:user.id,actorSource:'user',now});
 },true);}
 // Internal primitive: callers own the SQLite transaction and authorization.
 // The system path never manufactures an account or borrows an administrator.
 applySettlement({round,rules,value,bucket,reason,actorId=null,actorSource='system',now}){
  const revision=round.result_revision+1;
  this.db.prepare('INSERT INTO market_settlements(round_id,revision,return_pct,bucket,reason,created_by,created_at,actor_source) VALUES(?,?,?,?,?,?,?,?)').run(round.id,revision,value,bucket,reason,actorId,new Date(now).toISOString(),actorSource);
  const add=this.db.prepare('INSERT INTO market_ledger VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  if(round.result_revision)for(const old of this.db.prepare("SELECT * FROM market_ledger WHERE round_id=? AND revision=? AND kind='award'").all(round.id,round.result_revision))add.run(randomUUID(),round.id,old.user_id,revision,'reversal',-old.points,old.return_pct,old.bucket,old.vote_option,old.outcome,round.result_revision);
  for(const vote of this.db.prepare('SELECT * FROM market_votes WHERE round_id=?').all(round.id))add.run(randomUUID(),round.id,vote.user_id,revision,'award',R.points(vote.option_id,bucket,rules),value,bucket,vote.option_id,R.outcome(vote.option_id,bucket),null);
  if(this.db.prepare('UPDATE market_rounds SET result_revision=?,return_pct=?,result_bucket=? WHERE id=? AND result_revision=? AND void_at IS NULL').run(revision,value,bucket,round.id,round.result_revision).changes!==1)fail(409,'STALE_RESULT','結算版本已更新');
  return {ok:true,revision};
 }
 leaderboard(id){
  const query=`WITH totals AS (
   SELECT u.id,u.display_name,u.created_at,SUM(l.points) score,
    SUM(CASE WHEN l.kind='award' AND l.revision=r.result_revision THEN 1 ELSE 0 END) played
   FROM users u JOIN market_ledger l ON l.user_id=u.id JOIN market_rounds r ON r.id=l.round_id WHERE u.disabled=0 GROUP BY u.id
  ), ranked AS (SELECT *,RANK() OVER(ORDER BY score DESC) rank,COUNT(*) OVER() total FROM totals) SELECT * FROM ranked`;
  const rows=this.db.prepare(query+' ORDER BY score DESC,created_at,id LIMIT 100').all(),own=this.db.prepare(query+' WHERE id=?').get(id);
  const safe=row=>({rank:row.rank,displayName:row.display_name,score:row.score,played:row.played,isMe:row.id===id});
  return {rows:rows.map(safe),totalParticipants:rows[0]?.total||0,ownRank:own?safe(own):null};
 }
 stats(id){const score=this.db.prepare('SELECT COALESCE(SUM(points),0) AS n FROM market_ledger WHERE user_id=?').get(id).n,counts=this.db.prepare("SELECT COUNT(*) AS played,SUM(CASE WHEN l.outcome='hit' THEN 1 ELSE 0 END) AS hits,SUM(CASE WHEN l.outcome='tie' THEN 1 ELSE 0 END) AS ties FROM market_ledger l JOIN market_rounds r ON r.id=l.round_id AND r.result_revision=l.revision WHERE l.user_id=? AND l.kind='award'").get(id);return {score,played:counts.played,hits:counts.hits||0,ties:counts.ties||0};}
 view(actor,admin=false){return transaction(this.db,()=>{
  const user=this.user(actor,admin),now=this.clock(),rounds=this.db.prepare('SELECT * FROM market_rounds ORDER BY target_date DESC LIMIT 100').all().map(row=>{
   const vote=this.db.prepare('SELECT option_id AS optionId,revision,updated_at AS updatedAt FROM market_votes WHERE round_id=? AND user_id=?').get(row.id,user.id)||null,result=row.result_revision?this.db.prepare('SELECT created_at AS settledAt,reason,actor_source AS actorSource FROM market_settlements WHERE round_id=? AND revision=?').get(row.id,row.result_revision):null;
   return {id:row.id,targetDate:row.target_date,cutoffAt:row.cutoff_at,settlementAfter:row.settlement_after,rules:JSON.parse(row.rules_json),vote,voidReason:row.void_reason,phase:row.void_at?'void':row.result_revision?'settled':now>=Date.parse(row.cutoff_at)?'closed':'open',result:result?{...result,revision:row.result_revision,returnPct:row.return_pct,bucket:row.result_bucket,points:vote?R.points(vote.optionId,row.result_bucket,JSON.parse(row.rules_json)):null}:null,...(admin?{voteCount:this.db.prepare('SELECT COUNT(*) AS n FROM market_votes WHERE round_id=?').get(row.id).n,settlementHistory:this.db.prepare('SELECT s.revision,s.return_pct AS returnPct,s.bucket,s.reason,s.created_at AS at,s.actor_source AS actorSource,COALESCE(u.display_name,\'系統\') AS administrator FROM market_settlements s LEFT JOIN users u ON u.id=s.created_by WHERE s.round_id=? ORDER BY s.revision DESC').all(row.id)}:{})};
  });
  const ledger=this.db.prepare('SELECT l.*,r.target_date AS targetDate,s.created_at AS at,s.reason FROM market_ledger l JOIN market_rounds r ON r.id=l.round_id JOIN market_settlements s ON s.round_id=l.round_id AND s.revision=l.revision WHERE l.user_id=? ORDER BY s.created_at DESC,l.revision DESC,CASE WHEN l.kind=\'award\' THEN 0 ELSE 1 END LIMIT 100').all(user.id);
  return {me:{id:user.id,username:user.username,displayName:user.display_name,role:user.role},serverNow:new Date(now).toISOString(),rules:R.snapshot(),stats:this.stats(user.id),leaderboard:this.leaderboard(user.id),rounds,ledger};
 });}
}

// Full backups preserve these tables; reject semantically damaged score histories.
function validateMarketDatabase(db){
 const check=(ok)=>{if(!ok)throw Error('Invalid market history');};
 for(const round of db.prepare('SELECT * FROM market_rounds').iterate()){
  const rules=R.validate(JSON.parse(round.rules_json));check(R.validDate(round.target_date)&&round.cutoff_at===R.cutoffFor(round.target_date,rules)&&round.settlement_after===R.settlementFor(round.target_date,rules));
  const votes=db.prepare('SELECT * FROM market_votes WHERE round_id=?').all(round.id),settlements=db.prepare('SELECT * FROM market_settlements WHERE round_id=? ORDER BY revision').all(round.id);
  check(settlements.length===round.result_revision);
  if(round.actor_source!==undefined)check(['user','system'].includes(round.actor_source)&&(round.actor_source==='system'?round.created_by===null:typeof round.created_by==='string')&&(!round.void_at||round.result_revision===0&&typeof round.void_reason==='string'&&round.void_reason.length>0&&Number.isFinite(Date.parse(round.void_at))));
  for(const vote of votes)check(rules.options.some(o=>o.id===vote.option_id)&&Number.isFinite(Date.parse(vote.updated_at))&&Date.parse(vote.updated_at)<Date.parse(round.cutoff_at)&&Date.parse(vote.created_at)<=Date.parse(vote.updated_at));
  for(let i=0;i<settlements.length;i++){
   const s=settlements[i];if(s.actor_source!==undefined)check(['user','system'].includes(s.actor_source)&&(s.actor_source==='system'?s.created_by===null:typeof s.created_by==='string'));const rows=db.prepare('SELECT * FROM market_ledger WHERE round_id=? AND revision=?').all(round.id,s.revision),awards=rows.filter(x=>x.kind==='award'),reversals=rows.filter(x=>x.kind==='reversal');
   check(s.revision===i+1&&R.classify(s.return_pct,rules)===s.bucket&&Date.parse(s.created_at)>=Date.parse(round.settlement_after)&&s.reason.length<=240&&(!i||s.reason.length>0)&&awards.length===votes.length&&reversals.length===(i?votes.length:0));
   for(const vote of votes){const a=awards.find(x=>x.user_id===vote.user_id);check(a&&a.vote_option===vote.option_id&&a.return_pct===s.return_pct&&a.bucket===s.bucket&&a.outcome===R.outcome(vote.option_id,s.bucket)&&a.points===R.points(vote.option_id,s.bucket,rules)&&a.reverses_revision===null);if(i){const old=db.prepare("SELECT * FROM market_ledger WHERE round_id=? AND user_id=? AND revision=? AND kind='award'").get(round.id,vote.user_id,i),rev=reversals.find(x=>x.user_id===vote.user_id);check(rev&&rev.points===-old.points&&rev.reverses_revision===i&&rev.return_pct===old.return_pct&&rev.bucket===old.bucket&&rev.vote_option===old.vote_option&&rev.outcome===old.outcome);}}
  }
  const head=settlements.at(-1);check(head?round.return_pct===head.return_pct&&round.result_bucket===head.bucket:round.return_pct===null&&round.result_bucket===null&&!db.prepare('SELECT 1 FROM market_ledger WHERE round_id=?').get(round.id));
 }
 return true;
}
module.exports={MarketStore,validateMarketDatabase};
