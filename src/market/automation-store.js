const {randomUUID,createHash}=require('node:crypto');
const {transaction}=require('../db');
const {HttpError}=require('../http/errors');
const R=require('../../public/market-rules');
const DAY=86400000;
const stamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dateAt=now=>new Date(now+8*3600000).toISOString().slice(0,10);
const addDays=(date,count)=>new Date(Date.parse(date+'T00:00:00Z')+count*DAY).toISOString().slice(0,10);
const closeAfter=date=>Date.parse(date+'T14:00:00+08:00');
function monthWindow(date){
 if(!R.validDate(date))throw Error('Invalid market date');
 const [year,month,day]=date.split('-').map(Number),last=new Date(Date.UTC(year,month-1,0)),from=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth(),Math.min(day,last.getUTCDate()))).toISOString().slice(0,10);
 return {from,to:date};
}
function officialUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&['www.twse.com.tw','openapi.twse.com.tw'].includes(url.hostname)&&!url.username&&!url.password&&!url.port&&!url.hash;}catch{return false;}}
function validateCalendar(calendar){
 if(!calendar||!Number.isInteger(calendar.year)||calendar.year<2000||calendar.year>2199||calendar.coverageStart!==`${calendar.year}-01-01`||calendar.coverageEnd!==`${calendar.year}-12-31`||!officialUrl(calendar.sourceUrl)||!/^[a-f0-9]{64}$/.test(calendar.sourceHash)||!stamp(calendar.fetchedAt))throw Error('Invalid official calendar');
 for(const key of ['closedDates','openDates'])if(!Array.isArray(calendar[key])||calendar[key].length>366||new Set(calendar[key]).size!==calendar[key].length||calendar[key].some(date=>!R.validDate(date)||Number(date.slice(0,4))!==calendar.year))throw Error('Invalid calendar dates');
 if(calendar.evidence!==undefined&&(!Array.isArray(calendar.evidence)||calendar.evidence.length<1||calendar.evidence.length>2||new Set(calendar.evidence.map(item=>item.url)).size!==calendar.evidence.length||calendar.evidence.some(item=>!officialUrl(item.url)||!/^[a-f0-9]{64}$/.test(item.sha256)||!stamp(item.fetchedAt))||!calendar.evidence.some(item=>item.url===calendar.sourceUrl&&item.sha256===calendar.sourceHash)))throw Error('Invalid calendar evidence');
 if(calendar.openDates.some(date=>calendar.closedDates.includes(date)))throw Error('Conflicting calendar dates');
 return calendar;
}
function validateClose(close){
 if(!close||!R.validDate(close.targetDate)||!Number.isSafeInteger(close.closeCents)||close.closeCents<=0||!Number.isSafeInteger(close.changeCents)||!Number.isSafeInteger(close.closeCents-close.changeCents)||close.closeCents-close.changeCents<=0||typeof close.returnPct!=='string'||!/^[-+]?\d+\.\d{2}$/.test(close.returnPct)||!Number.isFinite(Number(close.returnPct))||Math.abs(Number(close.returnPct))>100||!officialUrl(close.sourceUrl)||!stamp(close.fetchedAt))throw Error('Invalid official close');
 if(!Array.isArray(close.evidence)||close.evidence.length<2||close.evidence.length>6||new Set(close.evidence.map(item=>item.url)).size<2||close.evidence.some(item=>!officialUrl(item.url)||!/^[a-f0-9]{64}$/.test(item.sha256)||!stamp(item.fetchedAt)))throw Error('Missing official cross-check');
 if(!close.evidence.some(item=>item.url===close.sourceUrl))throw Error('Missing primary source evidence');
 // The percentage is the published two-decimal daily value (or explicitly
 // documented daily-report calculation), never a binary-float threshold guess.
 const numerator=BigInt(close.changeCents)*10000n,denominator=BigInt(close.closeCents-close.changeCents),abs=numerator<0n?-numerator:numerator;
 const rounded=Number((abs*2n+denominator)/(2n*denominator))*(numerator<0n?-1:1);
 if(Math.round(Number(close.returnPct)*100)!==rounded)throw Error('Inconsistent official percentage');
 return close;
}
const values=close=>({targetDate:close.targetDate,closeCents:close.closeCents,changeCents:close.changeCents,returnPct:Number(close.returnPct).toFixed(2)});
function storedClose(row){const proof=JSON.parse(row.evidence_json);return {...values({targetDate:row.target_date,closeCents:row.close_cents,changeCents:row.change_cents,returnPct:row.return_pct}),...proof,fetchedAt:row.fetched_at};}

class MarketAutomationStore{
 constructor(db,market,{clock=Date.now,enabled=true}={}){this.db=db;this.market=market;this.clock=clock;this.enabled=enabled;}
 state(){const row=this.db.prepare("SELECT value_json FROM market_automation_state WHERE key='status'").get();return row?JSON.parse(row.value_json):{};}
 updateState(value){if(!this.enabled)return;this.db.prepare("INSERT INTO market_automation_state(key,value_json) VALUES('status',?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json").run(JSON.stringify({...this.state(),...value}));}
 // Daily job metadata shares the existing durable key/value table. Claims are
 // committed before network I/O; a crash consumes a slot instead of replaying it.
 fetchState(date){
  if(!R.validDate(date))throw Error('Invalid fetch date');
  const row=this.db.prepare('SELECT value_json FROM market_automation_state WHERE key=?').get('fetch:'+date);
  return row?JSON.parse(row.value_json):{status:'pending',scheduledSlots:[],automaticAttempts:0,manualAttempts:0};
 }
 writeFetchState(date,value){this.db.prepare('INSERT INTO market_automation_state(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').run('fetch:'+date,JSON.stringify(value));}
 fetchDates(){return this.db.prepare("SELECT key FROM market_automation_state WHERE key LIKE 'fetch:%' ORDER BY key").all().map(row=>row.key.slice(6));}
 hasClose(date){return !!this.db.prepare('SELECT 1 FROM market_daily_closes WHERE target_date=?').get(date);}
 missingDates({from,to}){
  if(!R.validDate(from)||!R.validDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*DAY)throw Error('Invalid missing date range');
  const saved=new Set(this.db.prepare('SELECT target_date FROM market_daily_closes WHERE target_date>=? AND target_date<=?').all(from,to).map(row=>row.target_date)),dates=[];
  for(let date=from;date<=to;date=addDays(date,1))if(this.isTradingDay(date)===true&&!saved.has(date))dates.push(date);
  return dates;
 }
 recordFetchAttempt(date,{slot=null,kind,at=new Date(this.clock()).toISOString()}){
  if(!this.enabled)return false;
  if(!R.validDate(date)||!['scheduled','history','catchup','manual'].includes(kind)||!stamp(at))throw Error('Invalid fetch attempt');
  if(kind==='scheduled'&&(!stamp(slot)||dateAt(Date.parse(slot))!==date||Date.parse(slot)<closeAfter(date)||Date.parse(slot)>closeAfter(date)+2*3600000||(Date.parse(slot)-closeAfter(date))%300000!==0))throw Error('Invalid scheduled fetch slot');
  return transaction(this.db,()=>{
   const state=this.fetchState(date),manual=kind==='manual';
   if(!manual&&(this.hasClose(date)||['success','exhausted'].includes(state.status)))return false;
   if(kind==='scheduled'&&(state.scheduledSlots.length>=25||state.scheduledSlots.some(previous=>previous>=slot)))return false;
   if(!manual&&state.lastAutomaticAttemptAt&&Date.parse(at)-Date.parse(state.lastAutomaticAttemptAt)<300000)return false;
   if(!manual&&kind!=='scheduled'&&state.automaticAttempts>=5)return false;
   this.writeFetchState(date,{...state,status:state.status==='success'?'success':'waiting',scheduledSlots:kind==='scheduled'?[...state.scheduledSlots,slot]:state.scheduledSlots,automaticAttempts:state.automaticAttempts+(manual?0:1),manualAttempts:state.manualAttempts+(manual?1:0),lastAttemptAt:at,lastAttemptKind:kind,...(!manual?{lastAutomaticAttemptAt:at}:{})});
   this.audit({targetDate:date,kind:'fetch-attempt',status:'started',detail:kind+(slot?':'+slot:'')});return true;
  });
 }
 finishFetch(date,{status,at=new Date(this.clock()).toISOString(),error,firstValidObservedAt}){
  if(!this.enabled)return;
  if(!['success','waiting','exhausted'].includes(status)||!stamp(at))throw Error('Invalid fetch outcome');
  return transaction(this.db,()=>{
   const state=this.fetchState(date),observed=state.firstValidObservedAt||firstValidObservedAt;
   this.writeFetchState(date,{...state,status:state.status==='success'?'success':status,...(error?{lastError:String(error).slice(0,64)}:{lastError:null}),...(observed?{firstValidObservedAt:observed}:{})});
  });
 }
 observeValidClose(date){
  const state=this.fetchState(date);
  this.writeFetchState(date,{...state,status:'success',firstValidObservedAt:state.firstValidObservedAt||new Date(this.clock()).toISOString(),lastError:null});
 }
 settleStored(date){
  const row=this.db.prepare('SELECT * FROM market_daily_closes WHERE target_date=?').get(date);
  if(!row)return {waiting:true};if(row.review_required)return {review:true};
  return this.recordClose(storedClose(row));
 }
 audit({targetDate=null,kind='close',status='waiting',sourceUrl='https://openapi.twse.com.tw/',sourceHash=null,detail=''}){
  if(!this.enabled)return;
  this.db.prepare('INSERT INTO market_fetch_audit(target_date,kind,status,source_url,source_hash,at,detail) VALUES(?,?,?,?,?,?,?)').run(targetDate,kind,status,officialUrl(sourceUrl)?sourceUrl:'https://openapi.twse.com.tw/',sourceHash,new Date(this.clock()).toISOString(),String(detail).slice(0,240));
  this.db.exec('DELETE FROM market_fetch_audit WHERE id NOT IN (SELECT id FROM market_fetch_audit ORDER BY id DESC LIMIT 2000)');
 }
 saveCalendar(input){if(!this.enabled)return false;const calendar=validateCalendar(input);return transaction(this.db,()=>{
  const blocked=this.state().calendarBlockedYears||[],required=['https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',`https://www.twse.com.tw/rwd/zh/holidaySchedule/holidaySchedule?date=${calendar.year}0101&response=html`];
  const reconciled=required.every(url=>calendar.evidence?.some(item=>item.url===url));
  if(blocked.includes(calendar.year)&&!reconciled){this.audit({kind:'calendar',status:'waiting',sourceUrl:calendar.sourceUrl,sourceHash:calendar.sourceHash,detail:'CALENDAR_CONFLICT_UNRESOLVED'});return false;}
  this.db.prepare('INSERT INTO market_calendar_years(year,calendar_json,fetched_at) VALUES(?,?,?) ON CONFLICT(year) DO UPDATE SET calendar_json=excluded.calendar_json,fetched_at=excluded.fetched_at').run(calendar.year,JSON.stringify(calendar),calendar.fetchedAt);
  this.audit({kind:'calendar',status:'ok',sourceUrl:calendar.sourceUrl,sourceHash:calendar.sourceHash});
  if(blocked.includes(calendar.year))this.updateState({calendarBlockedYears:blocked.filter(year=>year!==calendar.year)});
  return true;
 });}
 blockCalendarYears(years){if(!this.enabled)return;const valid=years.filter(year=>Number.isInteger(year)&&year>=2000&&year<=2199);this.updateState({calendarBlockedYears:[...new Set([...(this.state().calendarBlockedYears||[]),...valid])].sort()});}
 calendarBlocked(date){return (this.state().calendarBlockedYears||[]).includes(Number(date.slice(0,4)));}
 isTradingDay(date){
  if(!R.validDate(date))return null;
  const override=this.db.prepare('SELECT is_open FROM market_calendar_overrides WHERE target_date=?').get(date);if(override)return !!override.is_open;
  if(this.calendarBlocked(date))return null;
  const row=this.db.prepare('SELECT calendar_json FROM market_calendar_years WHERE year=?').get(Number(date.slice(0,4)));if(!row)return null;
  const calendar=validateCalendar(JSON.parse(row.calendar_json));if(date<calendar.coverageStart||date>calendar.coverageEnd)return null;
  if(calendar.closedDates.includes(date))return false;if(calendar.openDates.includes(date))return true;
  return ![0,6].includes(new Date(date+'T00:00:00Z').getUTCDay());
 }
 nextTradingDay(today=dateAt(this.clock())){
  for(let i=1;i<=370;i++){const date=addDays(today,i),open=this.isTradingDay(date);if(open===null)return null;if(open)return date;}
  return null;
 }
 plan(){if(!this.enabled)return null;return transaction(this.db,()=>{
  const now=this.clock(),target=this.nextTradingDay(dateAt(now));
  // Refreshing a calendar can cancel an unscored date, but never rewrites scores.
  for(const round of this.db.prepare('SELECT * FROM market_rounds WHERE result_revision=0 AND void_at IS NULL').all())if(this.isTradingDay(round.target_date)===false)this.db.prepare('UPDATE market_rounds SET void_reason=?,void_at=? WHERE id=? AND result_revision=0').run('官方行事曆或管理員覆核為休市，不計分',new Date(now).toISOString(),round.id);
  if(!target)return null;
  const existing=this.db.prepare('SELECT * FROM market_rounds WHERE target_date=?').get(target);if(existing)return existing.void_at?null:target;
  const rules=require('./curve-store').freezeRules(this.db,target,now),cutoff=R.cutoffFor(target,rules);if(now>=Date.parse(cutoff))return null;
  this.db.prepare("INSERT INTO market_rounds(id,target_date,cutoff_at,settlement_after,rules_json,created_by,created_at,actor_source) VALUES(?,?,?,?,?,NULL,?,'system')").run(randomUUID(),target,cutoff,R.settlementFor(target,rules),JSON.stringify(rules),new Date(now).toISOString());
  this.audit({targetDate:target,kind:'round',status:'created',detail:'official-calendar'});return target;
 });}
 override(actor,input){
  if(input?.confirmed!==true||!R.validDate(input.targetDate)||typeof input.isOpen!=='boolean'||typeof input.reason!=='string'||!input.reason.trim()||input.reason.trim().length>240||!officialUrl(input.sourceUrl))throw new HttpError(400,'INVALID_CALENDAR_OVERRIDE','請確認日期、開休市狀態、原因及證交所官方來源');
  const data={requestId:input.requestId,targetDate:input.targetDate,isOpen:input.isOpen,reason:input.reason.trim(),sourceUrl:input.sourceUrl,confirmed:true};
  return this.market.write(actor,'calendar-override',data,(user,now)=>{
   const round=this.db.prepare('SELECT * FROM market_rounds WHERE target_date=?').get(data.targetDate);
   if(data.isOpen&&round?.void_at)throw new HttpError(409,'ROUND_ALREADY_VOID','已作廢的預測不能重新開放，請另行覆核');
   this.db.prepare('INSERT INTO market_calendar_overrides VALUES(?,?,?,?,?,?) ON CONFLICT(target_date) DO UPDATE SET is_open=excluded.is_open,reason=excluded.reason,source_url=excluded.source_url,created_by=excluded.created_by,created_at=excluded.created_at').run(data.targetDate,Number(data.isOpen),data.reason,data.sourceUrl,user.id,new Date(now).toISOString());
   if(!data.isOpen&&round&&!round.result_revision)this.db.prepare('UPDATE market_rounds SET void_reason=?,void_at=? WHERE id=?').run(data.reason,new Date(now).toISOString(),round.id);
   if(!data.isOpen&&round?.result_revision)this.db.prepare('UPDATE market_daily_closes SET review_required=1 WHERE target_date=?').run(data.targetDate);
   return {ok:true,targetDate:data.targetDate,isOpen:data.isOpen,reason:data.reason,sourceUrl:data.sourceUrl,administrator:user.display_name,at:new Date(now).toISOString()};
  },true);
 }
 recordClose(input){if(!this.enabled)return {disabled:true};const close=validateClose(input),fingerprint=hash(values(close)),sourceHash=close.evidence.find(item=>item.url===close.sourceUrl).sha256;return transaction(this.db,()=>{
  const now=this.clock();if(now<closeAfter(close.targetDate))return {waiting:true,code:'BEFORE_CLOSE_QUERY'};
  if(this.calendarBlocked(close.targetDate)&&this.isTradingDay(close.targetDate)===null)return {waiting:true,code:'CALENDAR_UNCONFIRMED'};
  if(this.isTradingDay(close.targetDate)===false){this.audit({targetDate:close.targetDate,status:'waiting',sourceUrl:close.sourceUrl,detail:'CALENDAR_CLOSE_MISMATCH'});return {waiting:true,code:'CALENDAR_CLOSED'};}
  const existing=this.db.prepare('SELECT * FROM market_daily_closes WHERE target_date=?').get(close.targetDate),round=this.db.prepare('SELECT * FROM market_rounds WHERE target_date=?').get(close.targetDate);
  if(existing?.review_required){this.observeValidClose(close.targetDate);this.audit({targetDate:close.targetDate,status:'review',sourceUrl:close.sourceUrl,sourceHash,detail:'AWAITING_ADMIN_REVIEW'});return {review:true};}
  if(existing&&existing.fingerprint===fingerprint&&round?.result_revision){
   this.observeValidClose(close.targetDate);this.audit({targetDate:close.targetDate,status:'verified',sourceUrl:close.sourceUrl,sourceHash});
   if(round.return_pct!==Number(close.returnPct))this.db.prepare('UPDATE market_daily_closes SET review_required=1 WHERE target_date=?').run(close.targetDate);
   return {alreadySettled:true};
  }
  if(existing&&existing.fingerprint!==fingerprint&&round?.result_revision){
   this.observeValidClose(close.targetDate);this.db.prepare('UPDATE market_daily_closes SET review_required=1,revised_json=? WHERE target_date=?').run(JSON.stringify(close),close.targetDate);
   this.audit({targetDate:close.targetDate,status:'review',sourceUrl:close.sourceUrl,sourceHash,detail:'OFFICIAL_CORRECTION'});return {review:true};
  }
  this.db.prepare('INSERT INTO market_daily_closes(target_date,close_cents,change_cents,return_pct,evidence_json,fingerprint,fetched_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(target_date) DO UPDATE SET close_cents=excluded.close_cents,change_cents=excluded.change_cents,return_pct=excluded.return_pct,evidence_json=excluded.evidence_json,fingerprint=excluded.fingerprint,fetched_at=excluded.fetched_at').run(close.targetDate,close.closeCents,close.changeCents,Number(close.returnPct).toFixed(2),JSON.stringify({sourceUrl:close.sourceUrl,evidence:close.evidence,returnPctSource:close.returnPctSource||'official-published'}),fingerprint,close.fetchedAt);
  this.observeValidClose(close.targetDate);
  this.audit({targetDate:close.targetDate,status:'verified',sourceUrl:close.sourceUrl,sourceHash});
  if(!round||round.void_at)return {stored:true};
  if(round.result_revision){if(round.return_pct!==Number(close.returnPct))this.db.prepare('UPDATE market_daily_closes SET review_required=1 WHERE target_date=?').run(close.targetDate);return {alreadySettled:true};}
  const rules=R.validate(JSON.parse(round.rules_json)),value=R.parseReturn(close.returnPct,rules);
  if(now<Date.parse(round.settlement_after))return {waiting:true};
  const result=this.market.applySettlement({round,rules,value,bucket:R.classify(value,rules),reason:'官方日收盤資料交叉核對後自動結算',actorSource:'system',now});
  return {...result,settled:true};
 });}
 pending(){return this.db.prepare('SELECT target_date FROM market_rounds WHERE result_revision=0 AND void_at IS NULL AND target_date<=? ORDER BY target_date').all(dateAt(this.clock())).map(row=>row.target_date);}
 view(admin=false){
  const today=dateAt(this.clock()),window=monthWindow(today),state=this.state(),rows=this.db.prepare('SELECT * FROM market_daily_closes WHERE target_date>=? AND target_date<=? ORDER BY target_date DESC').all(window.from,window.to);
  const verified=new Set(rows.map(row=>row.target_date)),waitingDates=[];
  for(let date=window.from;date<=today;date=addDays(date,1))if(this.isTradingDay(date)===true&&!verified.has(date))waitingDates.push(date);
  const reviewDates=[...new Set([...this.db.prepare('SELECT target_date FROM market_daily_closes WHERE review_required=1 ORDER BY target_date').all().map(row=>row.target_date),...this.db.prepare('SELECT target_date FROM market_rounds WHERE result_revision>0').all().map(row=>row.target_date).filter(date=>this.isTradingDay(date)===false)])].sort();
  const calendarYears=this.db.prepare('SELECT year FROM market_calendar_years ORDER BY year').all().map(row=>row.year),nextTradingDate=this.nextTradingDay(today);
  const dailyFetch={targetDate:today,...this.fetchState(today)},manualRequiredDates=this.db.prepare("SELECT key FROM market_automation_state WHERE key LIKE 'fetch:%' AND json_extract(value_json,'$.status')='exhausted' ORDER BY key").all().map(row=>row.key.slice(6)).filter(date=>this.isTradingDay(date)!==false&&!this.hasClose(date));
  return {automation:{dailyFetch,manualRequiredDates,enabled:this.enabled,status:this.enabled?(state.status||'waiting'):'disabled',lastAttemptAt:state.lastAttemptAt||null,lastSuccessAt:state.lastSuccessAt||null,nextAttemptAt:this.enabled?state.nextAttemptAt||null:null,nextTradingDate,calendarYears,waitingDates:[...new Set([...this.pending(),...waitingDates])].sort(),reviewDates},marketHistory:{...window,rows:rows.map(row=>{const close=storedClose(row);return {targetDate:row.target_date,firstValidObservedAt:this.fetchState(row.target_date).firstValidObservedAt||null,close:row.close_cents/100,change:row.change_cents/100,returnPct:Number(row.return_pct),sourceUrl:close.sourceUrl,fetchedAt:row.fetched_at,reviewRequired:!!row.review_required,returnPctSource:close.returnPctSource||'official-published'};}),waitingDates},...(admin?{marketFetchAudit:this.db.prepare('SELECT target_date AS targetDate,kind,status,source_url AS sourceUrl,source_hash AS sourceHash,at,detail FROM market_fetch_audit ORDER BY id DESC LIMIT 50').all()}: {})};
 }
}

function validateMarketAutomationDatabase(db){
 const check=value=>{if(!value)throw Error('Invalid market automation history');};
 for(const row of db.prepare('SELECT * FROM market_calendar_years').iterate()){const calendar=validateCalendar(JSON.parse(row.calendar_json));check(calendar.year===row.year&&calendar.fetchedAt===row.fetched_at);}
 for(const row of db.prepare('SELECT * FROM market_daily_closes').iterate()){
  const close=validateClose(storedClose(row));check(hash(values(close))===row.fingerprint&&[0,1].includes(row.review_required));
  if(row.revised_json){const revised=validateClose(JSON.parse(row.revised_json));check(row.review_required===1&&revised.targetDate===row.target_date);}
 }
 for(const row of db.prepare('SELECT * FROM market_calendar_overrides').iterate())check(R.validDate(row.target_date)&&[0,1].includes(row.is_open)&&typeof row.reason==='string'&&row.reason.trim().length>0&&row.reason.length<=240&&officialUrl(row.source_url)&&stamp(row.created_at));
 for(const row of db.prepare('SELECT * FROM market_fetch_audit').iterate())check((row.target_date===null||R.validDate(row.target_date))&&officialUrl(row.source_url)&&stamp(row.at)&&(row.source_hash===null||/^[a-f0-9]{64}$/.test(row.source_hash))&&row.detail.length<=240);
 for(const row of db.prepare("SELECT s.*,r.target_date FROM market_settlements s JOIN market_rounds r ON r.id=s.round_id WHERE s.actor_source='system'").iterate()){
  const close=db.prepare('SELECT * FROM market_daily_closes WHERE target_date=?').get(row.target_date);check(row.revision===1&&close&&row.return_pct===Number(close.return_pct)&&Date.parse(row.created_at)>=closeAfter(row.target_date));
 }
 for(const row of db.prepare('SELECT * FROM market_automation_state').iterate()){
  const state=JSON.parse(row.value_json);check(state&&typeof state==='object'&&!Array.isArray(state));
  if(row.key.startsWith('fetch:')){
   const date=row.key.slice(6),allowed=['status','scheduledSlots','automaticAttempts','manualAttempts','firstValidObservedAt','lastAttemptAt','lastAttemptKind','lastAutomaticAttemptAt','lastError'];
   check(R.validDate(date)&&Object.keys(state).every(key=>allowed.includes(key))&&['pending','waiting','success','exhausted'].includes(state.status));
   check(Array.isArray(state.scheduledSlots)&&state.scheduledSlots.length<=25&&new Set(state.scheduledSlots).size===state.scheduledSlots.length&&state.scheduledSlots.every((slot,i)=>stamp(slot)&&dateAt(Date.parse(slot))===date&&Date.parse(slot)>=closeAfter(date)&&Date.parse(slot)<=closeAfter(date)+2*3600000&&(Date.parse(slot)-closeAfter(date))%300000===0&&(!i||slot>state.scheduledSlots[i-1])));
   for(const key of ['automaticAttempts','manualAttempts'])check(Number.isSafeInteger(state[key])&&state[key]>=0);
   check(state.automaticAttempts>=state.scheduledSlots.length);
   for(const key of ['firstValidObservedAt','lastAttemptAt','lastAutomaticAttemptAt'])if(state[key]!==undefined)check(stamp(state[key]));
   if(state.firstValidObservedAt)check(Date.parse(state.firstValidObservedAt)>=closeAfter(date)&&!!db.prepare('SELECT 1 FROM market_daily_closes WHERE target_date=?').get(date));
   if(state.lastAttemptKind!==undefined)check(['scheduled','history','catchup','manual'].includes(state.lastAttemptKind));
   if(state.lastError!==undefined)check(state.lastError===null||typeof state.lastError==='string'&&state.lastError.length<=64);
   if(state.status==='success')check(!!db.prepare('SELECT 1 FROM market_daily_closes WHERE target_date=?').get(date));
   continue;
  }
  check(row.key==='status');
  const allowed=['status','lastAttemptAt','lastSuccessAt','nextAttemptAt','calendarAttemptAt','calendarFailed','catchupMonth','calendarBlockedYears'];check(Object.keys(state).every(key=>allowed.includes(key)));
  if(state.status!==undefined)check(['waiting','ok','calendar-unavailable','disabled','error','manual-required'].includes(state.status));
  for(const key of ['lastAttemptAt','lastSuccessAt','nextAttemptAt','calendarAttemptAt'])if(state[key]!==undefined)check(key==='nextAttemptAt'&&state[key]===null||stamp(state[key]));
  if(state.calendarBlockedYears!==undefined)check(Array.isArray(state.calendarBlockedYears)&&state.calendarBlockedYears.length<=200&&new Set(state.calendarBlockedYears).size===state.calendarBlockedYears.length&&state.calendarBlockedYears.every(year=>Number.isInteger(year)&&year>=2000&&year<=2199));
  if(state.calendarFailed!==undefined)check(typeof state.calendarFailed==='boolean');if(state.catchupMonth!==undefined)check(R.validDate(state.catchupMonth+'-01'));
 }
 return true;
}
module.exports={MarketAutomationStore,validateMarketAutomationDatabase,validateClose,validateCalendar,dateAt,addDays,monthWindow,closeAfter,officialUrl};
