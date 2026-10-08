const {dateAt,monthWindow,closeAfter}=require('./automation-store');
const RETRY_MS=5*60*1000,CALENDAR_MS=6*60*60*1000;
const safeCode=error=>/^[A-Z][A-Z0-9_]{0,63}$/.test(error?.code||'')?error.code:'OFFICIAL_FETCH_FAILED';

// This job lives inside the application's existing single-writer data lock.
// A run is serialized, network waits never hold SQLite transactions, and close()
// aborts and joins outstanding work before the application's database closes.
class MarketAutomation{
 constructor(store,{provider,clock=Date.now,enabled=true,pollMs=60000}={}){
  this.store=store;this.provider=provider;this.clock=clock;this.enabled=enabled&&store.enabled;this.pollMs=pollMs;this.stopped=false;this.inFlight=null;this.timer=null;this.controller=null;
 }
 start(){if(!this.enabled||this.timer||this.stopped)return;this.tick();this.timer=setInterval(()=>this.tick(),this.pollMs);this.timer.unref?.();}
 tick(){
  if(!this.enabled||this.stopped)return Promise.resolve({disabled:true});
  if(this.inFlight)return this.inFlight;
  this.controller=new AbortController();
  this.inFlight=this.run(this.controller.signal).catch(error=>{
   if(!this.stopped){this.store.audit({kind:'job',status:'error',detail:safeCode(error)});this.store.updateState({status:'error',nextAttemptAt:new Date(this.clock()+RETRY_MS).toISOString()});}
   return {error:safeCode(error)};
  }).finally(()=>{this.inFlight=null;this.controller=null;});
  return this.inFlight;
 }
 async run(signal){
  let now=this.clock(),state=this.store.state();
  const dueCalendar=!state.calendarAttemptAt||now-Date.parse(state.calendarAttemptAt)>=(state.calendarFailed?RETRY_MS:CALENDAR_MS);
  if(dueCalendar){
   this.store.updateState({calendarAttemptAt:new Date(now).toISOString()});
   try{
    const calendars=await this.provider.fetchCalendar({signal});if(this.stopped)return;
    for(const calendar of Array.isArray(calendars)?calendars:[calendars])this.store.saveCalendar(calendar);
    this.store.updateState({calendarFailed:(this.store.state().calendarBlockedYears||[]).length>0});
   }catch(error){if(this.stopped)return;if(error.code==='CALENDAR_SOURCE_MISMATCH')this.store.blockCalendarYears(Array.isArray(error.years)?error.years:[Number(dateAt(now).slice(0,4))]);this.store.audit({kind:'calendar',status:'waiting',detail:safeCode(error)});this.store.updateState({calendarFailed:true});}
  }
  if(this.stopped)return;
  // Planning is deliberately before and independent of close-fetch backoff.
  const nextTradingDate=this.store.plan();
  now=this.clock();state=this.store.state();
  if(state.nextAttemptAt&&now<Date.parse(state.nextAttemptAt)){
   if(!nextTradingDate)this.store.updateState({status:'calendar-unavailable'});
   return {nextTradingDate,waiting:true};
  }
  const today=dateAt(now),window=monthWindow(today),at=new Date(now).toISOString();
  this.store.updateState({lastAttemptAt:at});
  // Always refill the visible calendar-month window, including after restart.
  // One older outstanding month is also retried per run. A persisted rotating
  // cursor prevents one unpublished old date from starving later obligations.
  const ranges=[window],older=[...new Set(this.store.pending().filter(date=>date<window.from).map(date=>date.slice(0,7)))];
  if(older.length){const next=older.find(month=>month>(state.catchupMonth||''))||older[0];ranges.push({from:next+'-01',to:new Date(Date.UTC(Number(next.slice(0,4)),Number(next.slice(5)),0)).toISOString().slice(0,10)});this.store.updateState({catchupMonth:next});}
  let failed=false,received=false;
  for(const range of ranges){
   if(this.stopped)return;
   try{
    const result=await this.provider.fetchCloses({...range,signal});if(this.stopped)return;
    for(const close of result.closes||[]){
     if(close.targetDate<range.from||close.targetDate>range.to){failed=true;this.store.audit({status:'waiting',detail:'OUT_OF_RANGE_DATE'});continue;}
     try{const outcome=this.store.recordClose(close);received||=!!(outcome.stored||outcome.settled||outcome.alreadySettled||outcome.review);}
     catch(error){failed=true;this.store.audit({targetDate:close.targetDate,status:'waiting',detail:safeCode(error)});}
    }
    for(const failure of result.failures||[]){failed=true;this.store.audit({targetDate:failure.targetDate||null,status:'waiting',sourceUrl:failure.sourceUrl,detail:safeCode(failure)});}
   }catch(error){if(this.stopped)return;failed=true;this.store.audit({status:'waiting',detail:safeCode(error)});}
  }
  if(this.stopped)return;
  now=this.clock();
  const view=this.store.view(),waiting=view.automation.waitingDates.some(date=>now>=closeAfter(date));
  // Before today's 14:00, schedule today's first eligible query. Afterwards,
  // missing/unknown data retries every five minutes. A successful day still
  // refreshes hourly to detect official corrections, never rewriting points.
  const delay=failed||waiting?RETRY_MS:60*60*1000,nextAttempt=Math.min(now+delay,now<closeAfter(today)?closeAfter(today):Infinity);
  this.store.updateState({status:!nextTradingDate?'calendar-unavailable':failed||waiting?'waiting':'ok',...(received?{lastSuccessAt:new Date(now).toISOString()}:{}),nextAttemptAt:new Date(nextAttempt).toISOString()});
  return {nextTradingDate,waiting,failed};
 }
 async stop(){if(this.stopped)return;this.stopped=true;clearInterval(this.timer);this.timer=null;this.controller?.abort();await this.inFlight;}
}
module.exports={MarketAutomation,RETRY_MS,CALENDAR_MS};
