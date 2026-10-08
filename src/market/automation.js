const {dateAt,monthWindow,closeAfter}=require('./automation-store');
const {HttpError}=require('../http/errors');
const R=require('../../public/market-rules');
const RETRY_MS=5*60*1000,CALENDAR_MS=6*60*60*1000,DAILY_WINDOW_MS=2*60*60*1000,HISTORY_ATTEMPTS=5;
const safeCode=error=>/^[A-Z][A-Z0-9_]{0,63}$/.test(error?.code||'')?error.code:'OFFICIAL_FETCH_FAILED';
const cutoffFor=date=>closeAfter(date)+DAILY_WINDOW_MS;
const iso=value=>new Date(value).toISOString();
function slotAt(date,now){
 const start=closeAfter(date);
 return now<start||now>cutoffFor(date)?null:iso(start+Math.floor((now-start)/RETRY_MS)*RETRY_MS);
}

// The application's data lock still owns the only writer. Slot claims commit
// before network I/O; a restart never replays an elapsed or already claimed slot.
class MarketAutomation{
 constructor(store,{provider,clock=Date.now,enabled=true,pollMs=60000}={}){
  this.store=store;this.provider=provider;this.clock=clock;this.enabled=enabled&&store.enabled;this.pollMs=pollMs;this.stopped=false;this.inFlight=null;this.manualPending=null;this.timer=null;this.controller=null;
 }
 start(){if(!this.enabled||this.timer||this.stopped)return;this.tick();this.timer=setInterval(()=>this.tick(),this.pollMs);this.timer.unref?.();}
 execute(work){
  this.controller=new AbortController();
  this.inFlight=work(this.controller.signal).catch(error=>{
   if(!this.stopped){this.store.audit({kind:'job',status:'error',detail:safeCode(error)});this.store.updateState({status:'error',nextAttemptAt:null});}
   return {failed:true,error:safeCode(error)};
  }).finally(()=>{this.inFlight=null;this.controller=null;});
  return this.inFlight;
 }
 tick(){
  if(!this.enabled||this.stopped)return Promise.resolve({disabled:true});
  if(this.manualPending)return this.manualPending;
  if(this.inFlight)return this.inFlight;
  return this.execute(signal=>this.run(signal));
 }
 manualRecheck(date){
  if(!this.enabled||this.stopped)return Promise.reject(new HttpError(503,'AUTOMATION_DISABLED','市場自動查核目前停用'));
  if(!R.validDate(date)||date>dateAt(this.clock())||this.clock()<closeAfter(date))return Promise.reject(new HttpError(400,'INVALID_MARKET_RECHECK_DATE','請選擇已到查核時間的有效日期'));
  if(this.manualPending)return Promise.reject(new HttpError(409,'MARKET_RECHECK_IN_PROGRESS','已有指定日期查核進行中'));
  const previous=this.inFlight;
  this.manualPending=(async()=>{
   await previous;
   if(this.stopped)throw new HttpError(503,'AUTOMATION_DISABLED','市場自動查核目前停用');
   return this.execute(async signal=>{
    const before=this.store.fetchState(date),result=await this.fetchDates([{date,kind:'manual'}],signal);
    if(this.stopped)return {targetDate:date,disabled:true};
    // A failed explicit recheck does not reopen an exhausted automatic budget.
    if(!result.received&&before.status==='exhausted')this.store.finishFetch(date,{status:'exhausted',error:result.error});
    this.refreshStatus(this.store.nextTradingDay(),this.clock(),result);
    return {...result,targetDate:date,status:this.store.fetchState(date).status};
   });
  })().finally(()=>{this.manualPending=null;});
  return this.manualPending;
 }
 async refreshCalendar(signal){
  const now=this.clock(),state=this.store.state();
  if(state.calendarAttemptAt&&now-Date.parse(state.calendarAttemptAt)<(state.calendarFailed?RETRY_MS:CALENDAR_MS))return;
  this.store.updateState({calendarAttemptAt:iso(now)});
  try{
   const calendars=await this.provider.fetchCalendar({signal});if(this.stopped)return;
   for(const calendar of Array.isArray(calendars)?calendars:[calendars])this.store.saveCalendar(calendar);
   this.store.updateState({calendarFailed:(this.store.state().calendarBlockedYears||[]).length>0});
  }catch(error){
   if(this.stopped)return;
   if(error.code==='CALENDAR_SOURCE_MISMATCH')this.store.blockCalendarYears(Array.isArray(error.years)?error.years:[Number(dateAt(now).slice(0,4))]);
   this.store.audit({kind:'calendar',status:'waiting',detail:safeCode(error)});this.store.updateState({calendarFailed:true});
  }
 }
 exhaustDaily(date,now){
  const state=this.store.fetchState(date);
  if(this.store.hasClose(date)||state.status==='success'||state.status==='exhausted'||this.store.isTradingDay(date)===false)return;
  if(now>cutoffFor(date)&&(date===dateAt(now)||state.scheduledSlots.length))this.store.finishFetch(date,{status:'exhausted',error:'DAILY_WINDOW_ENDED'});
 }
 historyDates(window){
  // Unknown calendar days are not invented. An existing pending round is an
  // explicit obligation and can still be queried unless the day is closed.
  return [...new Set([...this.store.missingDates(window),...this.store.pending().filter(date=>date>=window.from&&date<=window.to&&this.store.isTradingDay(date)!==false)])].sort();
 }
 historyCandidate(date,now,kind){
  if(date>=dateAt(now)||this.store.hasClose(date)||this.store.isTradingDay(date)===false)return null;
  this.exhaustDaily(date,now);const state=this.store.fetchState(date);
  if(['success','exhausted'].includes(state.status))return null;
  if(state.automaticAttempts>=HISTORY_ATTEMPTS){this.store.finishFetch(date,{status:'exhausted',error:'HISTORY_ATTEMPTS_EXHAUSTED'});return null;}
  if(state.lastAutomaticAttemptAt&&now-Date.parse(state.lastAutomaticAttemptAt)<RETRY_MS)return null;
  return {date,kind};
 }
 async run(signal){
  await this.refreshCalendar(signal);if(this.stopped)return;
  // Planning and stored-proof settlement must not depend on the daily job's
  // success, cutoff, backoff, or an unrelated year's calendar coverage.
  const nextTradingDate=this.store.plan();
  for(const date of this.store.pending())if(this.store.hasClose(date))this.store.settleStored(date);
  let now=this.clock();const today=dateAt(now),window=monthWindow(today);
  for(const date of this.store.fetchDates())if(date<today)this.exhaustDaily(date,now);
  this.exhaustDaily(today,now);
  const visible=this.historyDates(window),candidates=visible.map(date=>this.historyCandidate(date,now,'history')).filter(Boolean);
  const slot=slotAt(today,now),state=this.store.fetchState(today);
  const due=!state.lastAutomaticAttemptAt||now-Date.parse(state.lastAutomaticAttemptAt)>=RETRY_MS;
  if(slot&&due&&this.store.isTradingDay(today)!==false&&!this.store.hasClose(today)&&!['success','exhausted'].includes(state.status))candidates.push({date:today,kind:'scheduled',slot});
  let result={received:false,failed:false,review:false};
  if(candidates.length)result=await this.fetchDates(candidates,signal);
  if(this.stopped)return;
  // At most one older outstanding month per run; persist rotation so one
  // unpublished month cannot starve other outstanding settlement dates.
  now=this.clock();const older=[...new Set(this.store.pending().filter(date=>date<window.from&&!this.store.hasClose(date)&&this.store.isTradingDay(date)!==false).map(date=>date.slice(0,7)))].sort();
  if(older.length){
   const cursor=this.store.state().catchupMonth||'',month=older.find(value=>value>cursor)||older[0];
   const dates=this.store.pending().filter(date=>date.slice(0,7)===month).map(date=>this.historyCandidate(date,now,'catchup')).filter(Boolean);
   this.store.updateState({catchupMonth:month});
   if(dates.length){const catchup=await this.fetchDates(dates,signal);result={received:result.received||catchup.received,failed:result.failed||catchup.failed,review:result.review||catchup.review};}
  }
  if(this.stopped)return;
  this.refreshStatus(nextTradingDate,this.clock(),result);
  return {nextTradingDate,waiting:this.store.view().automation.waitingDates.length>0,...result};
 }
 async fetchDates(candidates,signal){
  const selected=candidates.filter(item=>this.store.recordFetchAttempt(item.date,{slot:item.slot,kind:item.kind,at:iso(this.clock())}));
  if(!selected.length)return {received:false,failed:false,review:false};
  const dates=selected.map(item=>item.date).sort(),allowed=new Set(dates),accepted=new Set(),errors=new Map();
  let received=false,failed=false,review=false;
  this.store.updateState({lastAttemptAt:iso(this.clock())});
  try{
   const result=await this.provider.fetchCloses({from:dates[0],to:dates.at(-1),dates,signal});if(this.stopped)return {received:false,failed:false,review:false};
   // A provider response that reports an error and a close for the same date
   // is contradictory; reject that date before any proof or points are stored.
   for(const failure of result.failures||[]){
    if(failure.targetDate&&!allowed.has(failure.targetDate)){failed=true;this.store.audit({status:'waiting',detail:'OUT_OF_REQUEST_DATE'});continue;}
    const code=safeCode(failure);for(const date of failure.targetDate?[failure.targetDate]:dates)errors.set(date,code);
    this.store.audit({targetDate:failure.targetDate||null,status:'waiting',sourceUrl:failure.sourceUrl,detail:code});
   }
   const closes=result.closes||[],counts=new Map();for(const close of closes)counts.set(close.targetDate,(counts.get(close.targetDate)||0)+1);
   for(const close of closes){
    if(!allowed.has(close.targetDate)){failed=true;this.store.audit({status:'waiting',detail:'OUT_OF_REQUEST_DATE'});continue;}
    if(counts.get(close.targetDate)>1){errors.set(close.targetDate,'DUPLICATE_OFFICIAL_DATE');continue;}
    if(errors.has(close.targetDate))continue;
    try{
     const outcome=this.store.recordClose(close);
     if(this.store.hasClose(close.targetDate)&&!outcome.waiting){accepted.add(close.targetDate);received=true;review||=!!outcome.review;}
     else if(this.store.hasClose(close.targetDate)&&!outcome.code){accepted.add(close.targetDate);received=true;}
     else errors.set(close.targetDate,outcome.code||'DATA_NOT_PUBLISHED');
    }catch(error){errors.set(close.targetDate,safeCode(error));}
   }
  }catch(error){if(this.stopped)return {received:false,failed:false,review:false};for(const date of dates)errors.set(date,safeCode(error));}
  if(this.stopped)return {received:false,failed:false,review:false};
  const now=this.clock();
  for(const {date,kind} of selected){
   if(accepted.has(date)){this.store.finishFetch(date,{status:'success',at:iso(now)});continue;}
   failed=true;const state=this.store.fetchState(date),error=errors.get(date)||'DATA_NOT_PUBLISHED';errors.set(date,error);
   const exhausted=state.status==='exhausted'||(state.scheduledSlots.length||date===dateAt(now))&&now>=cutoffFor(date)||kind!=='manual'&&kind!=='scheduled'&&state.automaticAttempts>=HISTORY_ATTEMPTS;
   this.store.finishFetch(date,{status:exhausted?'exhausted':'waiting',at:iso(now),error});
   this.store.audit({targetDate:date,status:'waiting',detail:error});
  }
  return {received,failed,review,...(errors.size?{error:errors.values().next().value}:{})};
 }
 refreshStatus(nextTradingDate,now,{received=false,failed=false}={}){
  const today=dateAt(now),window=monthWindow(today),dates=[...new Set([...this.historyDates(window),...this.store.pending()])];
  for(const date of this.store.fetchDates())if(date<today)this.exhaustDaily(date,now);
  this.exhaustDaily(today,now);
  let next=Infinity;
  const daily=this.store.fetchState(today);
  if(!this.store.hasClose(today)&&!['success','exhausted'].includes(daily.status)&&this.store.isTradingDay(today)!==false){
   const start=closeAfter(today),lastSlot=daily.scheduledSlots.at(-1);
   // A late poll may claim a slot shortly before its next boundary. Preserve
   // five real minutes between starts, rather than bursting at that boundary.
   const candidate=Math.max(now,start,lastSlot?Date.parse(lastSlot)+RETRY_MS:start,daily.lastAutomaticAttemptAt?Date.parse(daily.lastAutomaticAttemptAt)+RETRY_MS:start);
   if(candidate<=cutoffFor(today))next=candidate;
  }
  for(const date of dates){
   if(date>=today||this.store.hasClose(date)||this.store.isTradingDay(date)===false)continue;
   this.exhaustDaily(date,now);const state=this.store.fetchState(date);
   if(['success','exhausted'].includes(state.status)||state.automaticAttempts>=HISTORY_ATTEMPTS)continue;
   next=Math.min(next,Math.max(now+this.pollMs,state.lastAutomaticAttemptAt?Date.parse(state.lastAutomaticAttemptAt)+RETRY_MS:now));
  }
  const view=this.store.view(),waiting=view.automation.waitingDates.some(date=>now>=closeAfter(date));
  const manualRequired=view.automation.manualRequiredDates.length>0;
  this.store.updateState({status:!nextTradingDate?'calendar-unavailable':manualRequired?'manual-required':failed||waiting?'waiting':'ok',...(received?{lastSuccessAt:iso(now)}:{}),nextAttemptAt:Number.isFinite(next)?iso(next):null});
 }
 async stop(){if(this.stopped)return;this.stopped=true;clearInterval(this.timer);this.timer=null;this.controller?.abort();await Promise.allSettled([this.inFlight,this.manualPending].filter(Boolean));}
}
module.exports={MarketAutomation,RETRY_MS,CALENDAR_MS};
