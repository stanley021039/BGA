'use strict';

const {createHash}=require('node:crypto');

// These are fixed, verified TWSE daily-close feeds, not a general URL proxy.
// OpenAPI's history endpoints expose only the latest month. Older months use
// the separate, official report/print URLs verified through the TWSE UI.
const SOURCE_URLS=Object.freeze({
 calendar:'https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule',
 index:'https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX',
 history:'https://openapi.twse.com.tw/v1/indicesReport/MI_5MINS_HIST',
 market:'https://openapi.twse.com.tw/v1/exchangeReport/FMTQIK'
});
const MONTHLY_PATHS=Object.freeze({history:'https://www.twse.com.tw/rwd/zh/TAIEX/MI_5MINS_HIST',market:'https://www.twse.com.tw/rwd/zh/afterTrading/FMTQIK'});
const CALENDAR_PATH='https://www.twse.com.tw/rwd/zh/holidaySchedule/holidaySchedule';
const MAX_BYTES=2*1024*1024,REQUEST_TIMEOUT_MS=10000;
const TRADING_MARKERS=new Set(['國曆新年開始交易日','農曆春節前最後交易日','農曆春節後開始交易日']);
const HOLIDAYS=new Set(['中華民國開國紀念日','農曆除夕及春節','農曆除夕前一日','農曆除夕','農曆春節','春節','和平紀念日','兒童節及民族掃墓節','兒童節','民族掃墓節','勞動節','端午節','中秋節','孔子誕辰紀念日/ 教師節','國慶日','臺灣光復暨金門古寧頭大捷紀念日','行憲紀念日']);

class OfficialDataError extends Error{
 constructor(code,message=code){super(message);this.name='OfficialDataError';this.code=code;}
}
function requireValue(ok,code){if(!ok)throw new OfficialDataError(code);}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1999-01-01'&&value<='2199-12-31'&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function parseOfficialDate(value){
 requireValue(typeof value==='string','INVALID_DATE');
 let result=value,match;
 if((match=/^(\d{2,3})(\d{2})(\d{2})$/.exec(value))||(match=/^(\d{2,3})\/(\d{2})\/(\d{2})$/.exec(value))){result=`${Number(match[1])+1911}-${match[2]}-${match[3]}`;}
 requireValue(validDate(result),'INVALID_DATE');return result;
}
function parseDecimalCents(value,{signed=false,positive=false}={}){
 requireValue(typeof value==='string','INVALID_DECIMAL');
 const pattern=signed?/^[+-]?(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)\.\d{2}$/:/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)\.\d{2}$/;
 requireValue(pattern.test(value),'INVALID_DECIMAL');
 const clean=value.replaceAll(',',''),negative=clean[0]==='-',digits=clean.replace(/^[+-]/,'').replace('.','');
 const integer=BigInt(digits)*(negative?-1n:1n);
 requireValue(integer>=-BigInt(Number.MAX_SAFE_INTEGER)&&integer<=BigInt(Number.MAX_SAFE_INTEGER),'DECIMAL_OUT_OF_RANGE');
 const result=Number(integer);requireValue(!positive||result>0,'INVALID_CLOSE');return result===0?0:result;
}
function formatHundredths(value){const n=BigInt(value),absolute=n<0n?-n:n;return `${n<0n?'-':''}${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`;}
// change and previous close have the same (0.01-index-point) unit. Return
// hundredths of a percent, with exact arithmetic and half-away-from-zero ties.
function computedReturnPct(closeCents,changeCents){
 requireValue(Number.isSafeInteger(closeCents)&&closeCents>0&&Number.isSafeInteger(changeCents),'INVALID_CLOSE');
 const previous=BigInt(closeCents)-BigInt(changeCents);requireValue(previous>0n&&previous<=BigInt(Number.MAX_SAFE_INTEGER),'INVALID_PREVIOUS_CLOSE');
 const numerator=BigInt(changeCents)*10000n,absolute=numerator<0n?-numerator:numerator;
 const rounded=(absolute*2n+previous)/(previous*2n);
 requireValue(rounded<=10000n,'RETURN_OUT_OF_RANGE');return formatHundredths(numerator<0n?-rounded:rounded);
}
function rows(value,max=5000){requireValue(Array.isArray(value)&&value.length>0&&value.length<=max,'INVALID_SCHEMA');return value;}
function record(value){requireValue(value&&typeof value==='object'&&!Array.isArray(value),'INVALID_SCHEMA');return value;}
function unique(map,date,value){requireValue(!map.has(date),'DUPLICATE_DATE');map.set(date,value);}
function parseIndex(value){
 const selected=rows(value).filter(row=>record(row)['指數']==='發行量加權股價指數');
 requireValue(selected.length===1,selected.length?'DUPLICATE_INDEX':'INDEX_MISSING');
 const row=selected[0],targetDate=parseOfficialDate(row['日期']),closeCents=parseDecimalCents(row['收盤指數'],{positive:true});
 requireValue(typeof row['特殊處理註記']==='string'&&!row['特殊處理註記'].trim(),'EXCEPTIONAL_INDEX_NOTE');
 const points=parseDecimalCents(row['漲跌點數']),sign=row['漲跌'];
 requireValue(sign==='+'||sign==='-'||sign==='','INVALID_CHANGE_SIGN');
 requireValue(points===0||sign!=='','INVALID_CHANGE_SIGN');
 const changeCents=points===0?0:points*(sign==='-'?-1:1),percent=parseDecimalCents(row['漲跌百分比'],{signed:true});
 requireValue(Math.abs(percent)<=10000,'RETURN_OUT_OF_RANGE');
 requireValue(!percent||Math.sign(percent)===Math.sign(changeCents),'INVALID_CHANGE_SIGN');
 const returnPct=formatHundredths(percent);
 requireValue(computedReturnPct(closeCents,changeCents)===returnPct,'PERCENT_MISMATCH');
 return {targetDate,closeCents,changeCents,returnPct};
}
function parseHistory(value){
 const result=new Map();
 for(const row of rows(value,64)){
  record(row);const targetDate=parseOfficialDate(row.Date),openCents=parseDecimalCents(row.OpeningIndex,{positive:true}),highCents=parseDecimalCents(row.HighestIndex,{positive:true}),lowCents=parseDecimalCents(row.LowestIndex,{positive:true}),closeCents=parseDecimalCents(row.ClosingIndex,{positive:true});
  requireValue(lowCents<=openCents&&openCents<=highCents&&lowCents<=closeCents&&closeCents<=highCents,'INVALID_OHLC');
  unique(result,targetDate,{targetDate,openCents,highCents,lowCents,closeCents});
 }
 requireValue(new Set([...result.keys()].map(date=>date.slice(0,7))).size===1,'MIXED_HISTORY_MONTH');return result;
}
function parseMarket(value){
 const result=new Map();
 for(const row of rows(value,64)){
  record(row);const targetDate=parseOfficialDate(row.Date),closeCents=parseDecimalCents(row.TAIEX,{positive:true}),changeCents=parseDecimalCents(row.Change,{signed:true});
  for(const field of ['TradeVolume','TradeValue','Transaction'])requireValue(typeof row[field]==='string'&&/^(?:0|[1-9]\d*)$/.test(row[field]),'INVALID_MARKET_TOTAL');
  const returnPct=computedReturnPct(closeCents,changeCents);unique(result,targetDate,{targetDate,closeCents,changeCents,returnPct});
 }
 requireValue(new Set([...result.keys()].map(date=>date.slice(0,7))).size===1,'MIXED_MARKET_MONTH');return result;
}
function parseCalendar(value){
 const entries=rows(value,128),dates=new Set(),closedDates=[],openDates=[],names=new Set(),years=new Set();
 for(const row of entries){
  record(row);const date=parseOfficialDate(row.Date),name=row.Name,description=row.Description;
  requireValue(typeof name==='string'&&typeof description==='string','INVALID_CALENDAR_ROW');
  requireValue(!dates.has(date),'DUPLICATE_DATE');dates.add(date);years.add(Number(date.slice(0,4)));names.add(name);
  requireValue(row.Weekday==='日一二三四五六'[new Date(date+'T00:00:00Z').getUTCDay()],'CALENDAR_WEEKDAY_MISMATCH');
  if(TRADING_MARKERS.has(name)){
   requireValue(htmlText(description).replace(/\s/g,'').replace(/[。.]$/,'')===name.replace(/日$/,''),'CONTRADICTORY_CALENDAR_EVENT');openDates.push(date);
  }else if(HOLIDAYS.has(name)){
   requireValue(/放假|補假|休市/.test(description)&&!/開市|交易/.test(description.replace(/不交易(?:亦不交割)?|無交易/g,'')),'UNKNOWN_CALENDAR_EVENT');closedDates.push(date);
  }else if(name==='市場無交易，僅辦理結算交割作業'){
   const note=htmlText(description).replace(/\s/g,'').replace(/[。.]$/,'');requireValue(!note||note===name,'CONTRADICTORY_CALENDAR_EVENT');closedDates.push(date);
  }else{throw new OfficialDataError('UNKNOWN_CALENDAR_EVENT');}
 }
 requireValue(years.size===1,'UNKNOWN_CALENDAR_YEAR');const year=[...years][0];
 // Anchors prevent treating a partial holiday list as complete year coverage.
 for(const name of [...TRADING_MARKERS,'中華民國開國紀念日','和平紀念日','勞動節','端午節','中秋節','國慶日'])requireValue(names.has(name),'INCOMPLETE_CALENDAR');
 requireValue(dates.has(`${year}-01-01`),'INCOMPLETE_CALENDAR');
 const markerDate=name=>parseOfficialDate(entries.find(row=>row.Name===name).Date),start=markerDate('國曆新年開始交易日'),lastLunar=markerDate('農曆春節前最後交易日'),firstLunar=markerDate('農曆春節後開始交易日');
 requireValue(start>=`${year}-01-02`&&start<=`${year}-01-10`&&lastLunar<firstLunar&&lastLunar.slice(5,7)<='02'&&firstLunar.slice(5,7)<='02','INVALID_CALENDAR_ANCHORS');
 for(let time=Date.parse(lastLunar)+86400000;time<Date.parse(firstLunar);time+=86400000){const date=new Date(time);if(![0,6].includes(date.getUTCDay()))requireValue(closedDates.includes(date.toISOString().slice(0,10)),'INCOMPLETE_CALENDAR');}
 return {year,coverageStart:`${year}-01-01`,coverageEnd:`${year}-12-31`,closedDates:closedDates.sort(),openDates:openDates.sort()};
}
function monthlyUrl(kind,month){
 requireValue(Object.hasOwn(MONTHLY_PATHS,kind)&&/^\d{4}-\d{2}$/.test(month)&&validDate(month+'-01'),'INVALID_HISTORY_MONTH');
 return `${MONTHLY_PATHS[kind]}?date=${month.replace('-','')}01&response=html`;
}
function calendarUrl(year){requireValue(Number.isInteger(year)&&year>=2000&&year<=2199,'UNKNOWN_CALENDAR_YEAR');return `${CALENDAR_PATH}?date=${year}0101&response=html`;}
function htmlText(value){
 const result=value.replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).trim();
 requireValue(!/&[a-z#][^;\s]*;/i.test(result),'INVALID_HISTORY_HTML');return result;
}
function cells(row){return [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]\s*>/gi)].map(match=>htmlText(match[1]));}
function parseMonthlyHtml(html,{kind,month}){
 monthlyUrl(kind,month);requireValue(typeof html==='string','INVALID_HISTORY_HTML');
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];requireValue(tables.length===1,'INVALID_HISTORY_HTML');
 const table=tables[0][1],head=/<thead\b[^>]*>([\s\S]*?)<\/thead\s*>/i.exec(table),body=/<tbody\b[^>]*>([\s\S]*?)<\/tbody\s*>/i.exec(table);
 requireValue(head&&body,'INVALID_HISTORY_HTML');
 const headerRows=[...head[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(match=>cells(match[1]));
 const title=`${Number(month.slice(0,4))-1911}年${month.slice(5)}月${kind==='history'?'發行量加權股價指數歷史資料':'市場成交資訊'}`;
 requireValue(headerRows.some(row=>row.length===1&&row[0].replace(/\s/g,'')===title),'HISTORY_MONTH_MISMATCH');
 const fields=kind==='history'?['日期','開盤指數','最高指數','最低指數','收盤指數']:['日期','成交股數','成交金額','成交筆數','發行量加權股價指數','漲跌點數'];
 requireValue(headerRows.some(row=>JSON.stringify(row)===JSON.stringify(fields)),'HISTORY_FIELDS_MISMATCH');
 const data=[...body[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(match=>cells(match[1]));rows(data,31);
 const parsed=data.map(row=>{
  requireValue(row.length===fields.length,'HISTORY_FIELDS_MISMATCH');requireValue(parseOfficialDate(row[0]).slice(0,7)===month,'HISTORY_MONTH_MISMATCH');
  if(kind==='history')return {Date:row[0],OpeningIndex:row[1],HighestIndex:row[2],LowestIndex:row[3],ClosingIndex:row[4]};
  const total=value=>{requireValue(/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(value),'INVALID_MARKET_TOTAL');return value.replaceAll(',','');};
  return {Date:row[0],TradeVolume:total(row[1]),TradeValue:total(row[2]),Transaction:total(row[3]),TAIEX:row[4],Change:row[5]};
 });
 return kind==='history'?parseHistory(parsed):parseMarket(parsed);
}
function parseCalendarHtml(html,{year}){
 calendarUrl(year);requireValue(typeof html==='string','INVALID_CALENDAR_HTML');
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];requireValue(tables.length===1,'INVALID_CALENDAR_HTML');
 const head=/<thead\b[^>]*>([\s\S]*?)<\/thead\s*>/i.exec(tables[0][1]),body=/<tbody\b[^>]*>([\s\S]*?)<\/tbody\s*>/i.exec(tables[0][1]);requireValue(head&&body,'INVALID_CALENDAR_HTML');
 const headers=[...head[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(match=>cells(match[1]));
 requireValue(headers.some(row=>row.length===1&&row[0].replace(/\s/g,'')===`${year-1911}年市場開休市日期`),'CALENDAR_YEAR_MISMATCH');
 requireValue(headers.some(row=>JSON.stringify(row)===JSON.stringify(['日期','名稱','說明'])),'CALENDAR_FIELDS_MISMATCH');
 const data=[...body[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(match=>cells(match[1]));
 const calendar=parseCalendar(data.map(row=>{
  requireValue(row.length===3,'CALENDAR_FIELDS_MISMATCH');const date=parseOfficialDate(row[0]);requireValue(Number(date.slice(0,4))===year,'CALENDAR_YEAR_MISMATCH');
  return {Date:date,Name:row[1],Description:row[2],Weekday:'日一二三四五六'[new Date(date+'T00:00:00Z').getUTCDay()]};
 }));
 requireValue(calendar.year===year,'CALENDAR_YEAR_MISMATCH');return calendar;
}
function dateRange(from,to){
 requireValue(validDate(from)&&validDate(to)&&from<=to,'INVALID_DATE_RANGE');
 const length=(Date.parse(to)-Date.parse(from))/86400000+1;requireValue(length<=366,'DATE_RANGE_TOO_LARGE');
 return Array.from({length},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10));
}
function taipeiDate(time){return new Date(time+8*3600000).toISOString().slice(0,10);}
function failure(targetDate,error){return {targetDate,code:error instanceof OfficialDataError?error.code:'OFFICIAL_SOURCE_UNAVAILABLE'};}
async function raceAbort(promise,signal){
 if(signal.aborted)throw signal.reason;
 let listener;
 try{return await Promise.race([promise,new Promise((_,reject)=>{listener=()=>reject(signal.reason);signal.addEventListener('abort',listener,{once:true});})]);}
 finally{if(listener)signal.removeEventListener('abort',listener);}
}
async function readSource(url,{fetchImpl,clock,signal,format='json'}){
 const isMonthly=Object.keys(MONTHLY_PATHS).some(kind=>{const prefix=MONTHLY_PATHS[kind]+'?date=',match=/[?]date=(\d{4})(\d{2})01&response=html$/.exec(url);return match&&url.startsWith(prefix)&&url===monthlyUrl(kind,`${match[1]}-${match[2]}`);});
 const calendarMatch=/[?]date=(\d{4})0101&response=html$/.exec(url),isCalendar=calendarMatch&&url.startsWith(CALENDAR_PATH+'?')&&url===calendarUrl(Number(calendarMatch[1]));
 requireValue(format==='json'&&Object.values(SOURCE_URLS).includes(url)||format==='html'&&(isMonthly||isCalendar),'SOURCE_NOT_ALLOWED');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(new OfficialDataError('OFFICIAL_SOURCE_TIMEOUT')),REQUEST_TIMEOUT_MS);
 const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
 try{
  if(combined.aborted)throw combined.reason;
  return await raceAbort((async()=>{
   const response=await fetchImpl(url,{method:'GET',headers:{Accept:format==='json'?'application/json':'text/html'},redirect:'error',credentials:'omit',cache:'no-store',signal:combined});
   requireValue(response&&response.status===200,'OFFICIAL_HTTP_STATUS');
   requireValue(!response.redirected&&(!response.url||response.url===url),'OFFICIAL_REDIRECT');
   requireValue((format==='json'?/^application\/json(?:\s*;|$)/i:/^text\/html(?:\s*;|$)/i).test(response.headers?.get('content-type')||''),'OFFICIAL_CONTENT_TYPE');
   const size=response.headers.get('content-length');
   requireValue(size===null||/^\d+$/.test(size)&&Number(size)<=MAX_BYTES,'OFFICIAL_BODY_TOO_LARGE');
   requireValue(response.body&&typeof response.body.getReader==='function','OFFICIAL_BODY_MISSING');
   const reader=response.body.getReader(),chunks=[];let length=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;requireValue(length<=MAX_BYTES,'OFFICIAL_BODY_TOO_LARGE');chunks.push(Buffer.from(value));}}
   catch(error){await reader.cancel().catch(()=>{});throw error;}
   finally{reader.releaseLock();}
   const bytes=Buffer.concat(chunks);let text,json;
   try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(format==='json')json=JSON.parse(text);}catch{throw new OfficialDataError(format==='json'?'OFFICIAL_INVALID_JSON':'OFFICIAL_INVALID_HTML');}
   return {json,text,evidence:{url,sha256:createHash('sha256').update(bytes).digest('hex'),fetchedAt:new Date(clock()).toISOString()}};
  })(),combined);
 }catch(error){if(error instanceof OfficialDataError)throw error;if(combined.aborted)throw combined.reason instanceof OfficialDataError?combined.reason:new OfficialDataError('OFFICIAL_REQUEST_ABORTED');throw new OfficialDataError('OFFICIAL_SOURCE_UNAVAILABLE');}
 finally{clearTimeout(timeout);}
}
function createOfficialProvider({fetchImpl=globalThis.fetch,clock=Date.now,signal:providerSignal}={}){
 requireValue(typeof fetchImpl==='function'&&typeof clock==='function','INVALID_PROVIDER');
 const combinedSignal=signal=>providerSignal&&signal?AbortSignal.any([providerSignal,signal]):signal||providerSignal;
 const read=(key,signal)=>readSource(SOURCE_URLS[key],{fetchImpl,clock,signal:combinedSignal(signal)});
 return {
  async fetchCalendar({signal}={}){
   const year=Number(taipeiDate(clock()).slice(0,4)),years=[year,year+1],proof=(calendar,source)=>({...calendar,sourceUrl:source.evidence.url,sourceHash:source.evidence.sha256,fetchedAt:source.evidence.fetchedAt,evidence:[source.evidence]});
   // At most three requests. A not-yet-published next year never discards a
   // verified current year; the planner still treats missing years as unknown.
   const attempts=[(async()=>{const source=await read('calendar',signal);return proof(parseCalendar(source.json),source);})(),...years.map(async requestedYear=>{
    const source=await readSource(calendarUrl(requestedYear),{fetchImpl,clock,signal:combinedSignal(signal),format:'html'});return proof(parseCalendarHtml(source.text,{year:requestedYear}),source);
   })];
   const settled=await Promise.allSettled(attempts),known=new Map(),conflicts=new Set();let firstError;
   if(combinedSignal(signal)?.aborted)throw new OfficialDataError('OFFICIAL_REQUEST_ABORTED');
   for(const result of settled){
    if(result.status==='rejected'){firstError||=result.reason;continue;}
    const calendar=result.value;if(!years.includes(calendar.year))continue;
    const prior=known.get(calendar.year);
    if(prior&&(JSON.stringify(prior.closedDates)!==JSON.stringify(calendar.closedDates)||JSON.stringify(prior.openDates)!==JSON.stringify(calendar.openDates))){conflicts.add(calendar.year);continue;}
    known.set(calendar.year,{...calendar,evidence:[...(prior?.evidence||[]),...calendar.evidence]});
   }
   // A fresh disagreement must invalidate that year's cached planning data,
   // even when another requested year is valid. The scheduler uses years to
   // block existing coverage until a later consistent fetch resolves it.
   if(conflicts.size){const error=new OfficialDataError('CALENDAR_SOURCE_MISMATCH');error.years=[...conflicts].sort((a,b)=>a-b);throw error;}
   if(!known.size)throw firstError||new OfficialDataError('UNKNOWN_CALENDAR_YEAR');
   return [...known.values()].sort((a,b)=>a.year-b.year);
  },
  async fetchCloses({from,to,signal}={}){
   const targets=dateRange(from,to),closes=[],failures=[];let index,history,market,sources;const monthly=new Map(),monthErrors=new Map();
   try{
    sources=await Promise.all(['index','history','market'].map(key=>read(key,signal)));
    index=parseIndex(sources[0].json);history=parseHistory(sources[1].json);market=parseMarket(sources[2].json);
    const today=taipeiDate(clock());
    requireValue(index.targetDate<=today&&[...history.keys(),...market.keys()].every(date=>date<=today),'FUTURE_SOURCE_DATE');
   }catch(error){return {closes,failures:targets.map(target=>failure(target,error))};}
   const liveMonth=[...history.keys()][0].slice(0,7),marketMonth=[...market.keys()][0].slice(0,7);
   if(liveMonth===marketMonth)monthly.set(liveMonth,{history,market,evidence:[sources[1].evidence,sources[2].evidence]});
   // Fixed monthly URLs, bounded range, no redirects, and independent reports.
   // Each response must prove its own title month and exact row dates.
   for(const month of new Set(targets.map(date=>date.slice(0,7)))){
    if(monthly.has(month)||month>index.targetDate.slice(0,7))continue;
    try{
     const reports=[];
     for(const kind of ['history','market'])reports.push(await readSource(monthlyUrl(kind,month),{fetchImpl,clock,signal:combinedSignal(signal),format:'html'}));
     monthly.set(month,{history:parseMonthlyHtml(reports[0].text,{kind:'history',month}),market:parseMonthlyHtml(reports[1].text,{kind:'market',month}),evidence:reports.map(report=>report.evidence)});
    }catch(error){monthErrors.set(month,error);}
   }
   for(const targetDate of targets){
    try{
     if(clock()<Date.parse(targetDate+'T14:00:00+08:00'))continue;
     const month=targetDate.slice(0,7);if(monthErrors.has(month))throw monthErrors.get(month);
     const reports=monthly.get(month);if(!reports)continue;
     const h=reports.history.get(targetDate),m=reports.market.get(targetDate);
     if(!h&&!m)continue;requireValue(h&&m,'OFFICIAL_DATE_MISMATCH');
     requireValue(h.closeCents===m.closeCents,'OFFICIAL_CLOSE_MISMATCH');
     // A newer date cannot silently use calculated data while MI_INDEX lags.
     if(targetDate>index.targetDate)continue;
     const previousDates=[...reports.history.keys()].filter(date=>date<targetDate).sort();
     const previous=previousDates.length?reports.history.get(previousDates.at(-1)):null;
     if(previous)requireValue(previous.closeCents===m.closeCents-m.changeCents,'PREVIOUS_CLOSE_MISMATCH');
     let evidence=reports.evidence,returnPct=m.returnPct,returnPctSource='computed-from-official-close-change',sourceUrl=evidence[1].url;
     if(targetDate===index.targetDate){
      requireValue(index.closeCents===m.closeCents&&index.changeCents===m.changeCents,'OFFICIAL_INDEX_MISMATCH');
      returnPct=index.returnPct;returnPctSource='official-published';sourceUrl=SOURCE_URLS.index;evidence=[sources[0].evidence,...reports.evidence];
     }
     closes.push({targetDate,closeCents:m.closeCents,changeCents:m.changeCents,returnPct,returnPctSource,sourceUrl,evidence,fetchedAt:new Date(clock()).toISOString()});
    }catch(error){failures.push(failure(targetDate,error));}
   }
   return {closes,failures};
  }
 };
}

module.exports={createOfficialProvider,OfficialDataError,SOURCE_URLS,MONTHLY_PATHS,monthlyUrl,calendarUrl,parseMonthlyHtml,parseCalendarHtml,parseOfficialDate,parseDecimalCents,computedReturnPct,parseIndex,parseHistory,parseMarket,parseCalendar,REQUEST_TIMEOUT_MS,MAX_BYTES};
