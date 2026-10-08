const {randomUUID}=require('node:crypto');
const {HttpError}=require('../http/errors');
const C=require('../../public/market-curve');
const fail=(status,code,message)=>{throw new HttpError(status,code,message);};
function freezeRules(db,targetDate,now){
 // Filter completed/valid observations before selecting the latest 252. A
 // future or unusable cached row must not evict an eligible historical sample.
 const observations=db.prepare('SELECT * FROM market_daily_closes WHERE target_date<? AND fetched_at<=? AND review_required=0 ORDER BY target_date DESC').all(targetDate,new Date(now).toISOString()).map(row=>({targetDate:row.target_date,returnPct:Number(row.return_pct),fetchedAt:row.fetched_at,fingerprint:row.fingerprint,...JSON.parse(row.evidence_json),evidence:JSON.stringify(JSON.parse(row.evidence_json).evidence)}));
 return {...C.createCurveSnapshot({targetDate,frozenAt:new Date(now).toISOString(),observations}),timeZone:'Asia/Taipei',cutoffTime:'23:59',cutoffExclusive:'target-midnight',settlementTime:'13:30'};
}
function forecast(db,round,user){return db.prepare('SELECT forecast_tick AS forecastTick,revision,updated_at AS updatedAt FROM market_forecasts WHERE round_id=? AND user_id=?').get(round,user)||null;}
function vote(store,actor,input){
 const data={requestId:input.requestId,roundId:input.roundId,forecastTick:input.forecastTick,expectedRevision:store.revision(input.expectedRevision)};
 return store.write(actor,'forecast',data,(user,now)=>{
  const round=store.round(data.roundId),rules=JSON.parse(round.rules_json);C.validateCurveSnapshot(rules);
  if(!Number.isSafeInteger(data.forecastTick)||data.forecastTick<-100||data.forecastTick>100||input.optionId!==undefined)fail(400,'INVALID_FORECAST','請以 0.1 個百分點為單位選擇 −10% 至 +10%');
  if(round.void_at||round.result_revision||now>=Date.parse(round.cutoff_at))fail(409,'VOTING_CLOSED','預測已截止');
  const old=store.db.prepare('SELECT * FROM market_forecasts WHERE round_id=? AND user_id=?').get(round.id,user.id);
  if((old?.revision||0)!==data.expectedRevision)fail(409,'STALE_VOTE','預測已在另一個頁面更新，請重新整理');
  if(old?.forecast_tick===data.forecastTick)return {ok:true,revision:old.revision,unchanged:true};
  const at=new Date(Math.max(now,Date.parse(round.created_at),old?Date.parse(old.updated_at):0)).toISOString(),revision=(old?.revision||0)+1;
  store.db.prepare('INSERT INTO market_forecasts VALUES(?,?,?,?,?,?) ON CONFLICT(round_id,user_id) DO UPDATE SET forecast_tick=excluded.forecast_tick,revision=excluded.revision,updated_at=excluded.updated_at').run(round.id,user.id,data.forecastTick,revision,old?.created_at||at,at);
  return {ok:true,revision};
 });
}
function applySettlement(db,{round,rules,value,reason,actorId=null,actorSource='system',now}){
 const revision=round.result_revision+1;
 db.prepare('INSERT INTO market_settlements(round_id,revision,return_pct,bucket,reason,created_by,created_at,actor_source) VALUES(?,?,?,?,?,?,?,?)').run(round.id,revision,value,'curve',reason,actorId,new Date(now).toISOString(),actorSource);
 const add=db.prepare('INSERT INTO market_curve_ledger VALUES(?,?,?,?,?,?,?,?,?)');
 for(const old of db.prepare("SELECT * FROM market_curve_ledger WHERE round_id=? AND revision=? AND kind='award'").all(round.id,round.result_revision))add.run(randomUUID(),round.id,old.user_id,revision,'reversal',-old.points_units,old.return_pct,old.forecast_tick,round.result_revision);
 for(const v of db.prepare('SELECT * FROM market_forecasts WHERE round_id=?').all(round.id))add.run(randomUUID(),round.id,v.user_id,revision,'award',C.scorePredictionUnits(v.forecast_tick,value,rules),value,v.forecast_tick,null);
 if(db.prepare("UPDATE market_rounds SET result_revision=?,return_pct=?,result_bucket='curve' WHERE id=? AND result_revision=? AND void_at IS NULL").run(revision,value,round.id,round.result_revision).changes!==1)fail(409,'STALE_RESULT','結算版本已更新');
 return {ok:true,revision};
}
function validateRound(db,round,rules){
 const check=ok=>{if(!ok)throw Error('Invalid curve score history');};
 C.validateCurveSnapshot(rules);check(rules.frozenAt===round.created_at&&rules.targetDate===round.target_date&&Date.parse(round.created_at)<Date.parse(round.cutoff_at));
 check(!db.prepare('SELECT 1 FROM market_votes WHERE round_id=?').get(round.id)&&!db.prepare('SELECT 1 FROM market_ledger WHERE round_id=?').get(round.id));
 const votes=db.prepare('SELECT * FROM market_forecasts WHERE round_id=?').all(round.id),settlements=db.prepare('SELECT * FROM market_settlements WHERE round_id=? ORDER BY revision').all(round.id);
 check(settlements.length===round.result_revision);
 for(const v of votes)check(Number.isSafeInteger(v.forecast_tick)&&v.forecast_tick>=-100&&v.forecast_tick<=100&&Number.isSafeInteger(v.revision)&&v.revision>0&&Date.parse(v.created_at)>=Date.parse(round.created_at)&&Date.parse(v.updated_at)>=Date.parse(v.created_at)&&Date.parse(v.updated_at)<Date.parse(round.cutoff_at));
 for(const [i,s] of settlements.entries()){
  check(s.revision===i+1&&s.bucket==='curve'&&Number.isFinite(s.return_pct)&&Date.parse(s.created_at)>=Date.parse(round.settlement_after)&&s.reason.length<=240&&(!i||s.reason.trim().length)&&['user','system'].includes(s.actor_source)&&(s.actor_source==='system'?s.created_by===null:typeof s.created_by==='string'));
  const rows=db.prepare('SELECT * FROM market_curve_ledger WHERE round_id=? AND revision=?').all(round.id,s.revision),awards=rows.filter(x=>x.kind==='award'),reversals=rows.filter(x=>x.kind==='reversal');
  check(awards.length===votes.length&&reversals.length===(i?votes.length:0));
  for(const v of votes){const a=awards.find(x=>x.user_id===v.user_id);check(a&&a.forecast_tick===v.forecast_tick&&a.return_pct===s.return_pct&&a.points_units===C.scorePredictionUnits(v.forecast_tick,s.return_pct,rules)&&a.reverses_revision===null);if(i){const old=db.prepare("SELECT * FROM market_curve_ledger WHERE round_id=? AND user_id=? AND revision=? AND kind='award'").get(round.id,v.user_id,i),rev=reversals.find(x=>x.user_id===v.user_id);check(rev&&rev.points_units===-old.points_units&&rev.forecast_tick===old.forecast_tick&&rev.return_pct===old.return_pct&&rev.reverses_revision===i);}}
 }
 const head=settlements.at(-1);check(head?round.return_pct===head.return_pct&&round.result_bucket==='curve':round.return_pct===null&&round.result_bucket===null&&!db.prepare('SELECT 1 FROM market_curve_ledger WHERE round_id=?').get(round.id));
}
module.exports={freezeRules,forecast,vote,applySettlement,validateRound};
