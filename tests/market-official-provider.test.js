'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createOfficialProvider,SOURCE_URLS,monthlyUrl,calendarUrl,parseMonthlyHtml,parseCalendarHtml,parseOfficialDate,parseDecimalCents,computedReturnPct,parseIndex,parseHistory,parseMarket,parseCalendar,MAX_BYTES,REQUEST_TIMEOUT_MS}=require('../src/market/official-provider');
const errorCode=code=>error=>error.code===code;
const now=Date.parse('2026-10-07T08:00:00Z');
const indexRow=(extra={})=>({'日期':'1151006','指數':'發行量加權股價指數','收盤指數':'49822.55','漲跌':'+','漲跌點數':'110.51','漲跌百分比':'0.22','特殊處理註記':'',...extra});
// Sample values verified against TWSE OpenAPI on 2026-10-07.
function sources(){return {
 index:[indexRow()],
 history:[
  {Date:'1151001',OpeningIndex:'47961.98',HighestIndex:'48353.49',LowestIndex:'47893.42',ClosingIndex:'48353.49'},
  {Date:'1151002',OpeningIndex:'48390.65',HighestIndex:'48491.62',LowestIndex:'48205.81',ClosingIndex:'48475.74'},
  {Date:'1151005',OpeningIndex:'48574.95',HighestIndex:'49770.66',LowestIndex:'48574.95',ClosingIndex:'49712.04'},
  {Date:'1151006',OpeningIndex:'49736.37',HighestIndex:'49968.92',LowestIndex:'49479.69',ClosingIndex:'49822.55'}],
 market:[
  {Date:'1151001',TradeVolume:'10691867330',TradeValue:'874046252416',Transaction:'4715278',TAIEX:'48353.49',Change:'413.36'},
  {Date:'1151002',TradeVolume:'11017717304',TradeValue:'938222196327',Transaction:'4612433',TAIEX:'48475.74',Change:'122.25'},
  {Date:'1151005',TradeVolume:'14490437804',TradeValue:'1211041395113',Transaction:'5843674',TAIEX:'49712.04',Change:'1236.30'},
  {Date:'1151006',TradeVolume:'10889677530',TradeValue:'1026204771139',Transaction:'4923225',TAIEX:'49822.55',Change:'110.51'}],
 calendar:calendarRows()
};}
function calendarRows(){
 const events=[
  ['0101','中華民國開國紀念日','依規定放假1日。'],['0102','國曆新年開始交易日','國曆新年開始交易。'],
  ['0211','農曆春節前最後交易日','農曆春節前最後交易。<br>'],['0212','市場無交易，僅辦理結算交割作業',''],['0213','市場無交易，僅辦理結算交割作業',''],
  ...['0215','0216','0217','0218','0219','0220'].map(date=>[date,'農曆除夕及春節','依規定於2月15日至2月19日放假5日。2月15日適逢星期日，於2月20日（星期五）補假。']),
  ['0223','農曆春節後開始交易日','農曆春節後開始交易。'],['0227','和平紀念日','於2月27日補假。'],['0228','和平紀念日','依規定放假1日。'],
  ...['0403','0404','0405','0406'].map(date=>[date,'兒童節及民族掃墓節','依規定放假1日。']),
  ['0501','勞動節','依規定放假1日。'],['0619','端午節','依規定放假1日。'],['0925','中秋節','依規定放假1日。'],['0928','孔子誕辰紀念日/ 教師節','依規定放假1日。'],
  ['1009','國慶日','於10月9日補假。'],['1010','國慶日','依規定放假1日。'],['1025','臺灣光復暨金門古寧頭大捷紀念日','依規定放假1日。'],['1026','臺灣光復暨金門古寧頭大捷紀念日','於10月26日補假。'],['1225','行憲紀念日','依規定放假1日。']
 ];
 return events.map(([day,Name,Description])=>({Date:'115'+day,Name,Description,Weekday:'日一二三四五六'[new Date(`2026-${day.slice(0,2)}-${day.slice(2)}T00:00:00Z`).getUTCDay()]}));
}
function mockFetch(data=sources(),mutate){
 const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});const key=Object.keys(SOURCE_URLS).find(key=>SOURCE_URLS[key]===url),kind=['history','market'].find(kind=>url===monthlyUrl(kind,'2026-09')),calendarYear=[2026,2027].find(year=>url===calendarUrl(year));assert.ok(key||kind||calendarYear,'only fixed official sources are fetched');const body=key?JSON.stringify(data[key]):calendarYear?(calendarYear===2026?calendarHtml():'<div>（查無資料）</div>'):monthlyHtml(kind);return mutate?mutate({url,options,key:key||kind||'calendarReport',body}):new Response(body,{headers:{'Content-Type':key?'application/json; charset=utf-8':'text/html; charset=UTF-8'}});};
 return {fetchImpl,calls};
}
function calendarHtml(entries=calendarRows(),year=2026){
 return `<table><thead><tr><th colspan="3"><div>${year-1911} 年市場開休市日期</div></th></tr><tr><th>日期</th><th>名稱</th><th>說明</th></tr></thead><tbody>${entries.map(row=>`<tr><td>${parseOfficialDate(row.Date)}</td><td>${row.Name}</td><td>${row.Description}</td></tr>`).join('')}</tbody></table>`;
}
// Print-table structure and index values captured from the official UI's
// September 2026 reports. Totals are reduced synthetic values for these tests.
function monthlyHtml(kind){
 const fields=kind==='history'?['日期','開盤指數','最高指數','最低指數','收盤指數']:['日期','成交股數','成交金額','成交筆數','發行量加權股價指數','漲跌點數'];
 const title=kind==='history'?'115年09月 發行量加權股價指數歷史資料':'115年09月市場成交資訊';
 const data=kind==='history'?[
  ['115/09/29','47,873.89','48,045.13','47,573.09','47,631.96'],['115/09/30','47,767.49','48,379.71','47,767.49','47,940.13']
 ]:[['115/09/29','1,000','1,000','100','47,631.96','-392.64'],['115/09/30','1,000','1,000','100','47,940.13','308.17']];
 return `<html><table><thead><tr><th colspan="${fields.length}"><div>${title}</div></th></tr><tr>${fields.map(name=>`<th>${name}</th>`).join('')}</tr></thead><tbody>${data.map(row=>`<tr align="center" style="font-size:14px">${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="notes">表外說明</div></html>`;
}
test('official ROC compact/slash and ISO dates are exact and calendar-valid',()=>{
 for(const value of ['1151006','115/10/06','2026-10-06'])assert.equal(parseOfficialDate(value),'2026-10-06');
 for(const value of ['1150230','115/2/03','2026-02-29','20261006','1151006junk',' 1151006',null,1151006])assert.throws(()=>parseOfficialDate(value),errorCode('INVALID_DATE'));
 assert.equal(parseOfficialDate('1130229'),'2024-02-29');
});
test('prices use exact integer hundredths and reject malformed or floating notation',()=>{
 assert.equal(parseDecimalCents('49,822.55'),4982255);assert.equal(parseDecimalCents('-16.18',{signed:true}),-1618);
 assert.equal(parseDecimalCents('-0.00',{signed:true}),0);
 for(const value of ['1,23.45','1,0000.00','01.00','1e3','NaN','Infinity','12','12.3','12.345','12.30%',' 12.30','--','',12.3])assert.throws(()=>parseDecimalCents(value),errorCode('INVALID_DECIMAL'));
 assert.throws(()=>parseDecimalCents('90071992547409.92'),errorCode('DECIMAL_OUT_OF_RANGE'));
 assert.throws(()=>parseDecimalCents('0.00',{positive:true}),errorCode('INVALID_CLOSE'));
});
test('rational percent calculation preserves every bucket threshold without binary rounding',()=>{
 for(const [change,expected] of [[-500,'-5.00'],[-200,'-2.00'],[-1,'-0.01'],[0,'0.00'],[1,'0.01'],[200,'2.00'],[500,'5.00']])assert.equal(computedReturnPct(10000+change,change),expected);
 assert.equal(computedReturnPct(101995,1995),'2.00');assert.equal(computedReturnPct(98005,-1995),'-2.00');
 assert.equal(computedReturnPct(100001,1),'0.00');assert.equal(computedReturnPct(99999,-1),'0.00');
 assert.equal(computedReturnPct(4982255,11051),'0.22');
 assert.throws(()=>computedReturnPct(100,100),errorCode('INVALID_PREVIOUS_CLOSE'));
 assert.throws(()=>computedReturnPct(Number.MAX_SAFE_INTEGER,-1),errorCode('INVALID_PREVIOUS_CLOSE'));
});
test('published TAIEX is selected by exact name and checked against sign and rational return',()=>{
 const actual=parseIndex([{...indexRow(),'指數':'寶島股價指數'},indexRow()]);
 assert.deepEqual(actual,{targetDate:'2026-10-06',closeCents:4982255,changeCents:11051,returnPct:'0.22'});
 for(const extra of [{'漲跌':'?'},{'漲跌':''},{'漲跌百分比':'-0.22'}])assert.throws(()=>parseIndex([indexRow(extra)]),errorCode('INVALID_CHANGE_SIGN'));
 assert.throws(()=>parseIndex([indexRow({'特殊處理註記':'更正'})]),errorCode('EXCEPTIONAL_INDEX_NOTE'));
 assert.throws(()=>parseIndex([indexRow({'漲跌百分比':'0.23'})]),errorCode('PERCENT_MISMATCH'));
 assert.throws(()=>parseIndex([indexRow(),indexRow()]),errorCode('DUPLICATE_INDEX'));
 assert.throws(()=>parseIndex([{...indexRow(),'指數':'TAIEX'}]),errorCode('INDEX_MISSING'));
});
test('zero and small negative published returns normalize negative zero safely',()=>{
 assert.equal(parseIndex([indexRow({'收盤指數':'1000.00','漲跌':'','漲跌點數':'0.00','漲跌百分比':'0.00'})]).returnPct,'0.00');
 assert.equal(parseIndex([indexRow({'收盤指數':'999.99','漲跌':'-','漲跌點數':'0.01','漲跌百分比':'-0.00'})]).returnPct,'0.00');
});
test('OHLC rejects duplicates, impossible ranges and mixed month responses',()=>{
 const data=sources();assert.equal(parseHistory(data.history).size,4);
 assert.throws(()=>parseHistory([...data.history,data.history[0]]),errorCode('DUPLICATE_DATE'));
 assert.throws(()=>parseHistory([{...data.history[0],HighestIndex:'1.00'}]),errorCode('INVALID_OHLC'));
 assert.throws(()=>parseHistory([...data.history,{...data.history[0],Date:'1150930'}]),errorCode('MIXED_HISTORY_MONTH'));
});
test('market parser validates signed change, totals, duplicates and prior close',()=>{
 const data=sources();assert.equal(parseMarket(data.market).get('2026-10-06').returnPct,'0.22');
 assert.throws(()=>parseMarket([...data.market,data.market[0]]),errorCode('DUPLICATE_DATE'));
 assert.throws(()=>parseMarket([{...data.market[0],Transaction:'1e6'}]),errorCode('INVALID_MARKET_TOTAL'));
 assert.throws(()=>parseMarket([{...data.market[0],Change:data.market[0].TAIEX}]),errorCode('INVALID_PREVIOUS_CLOSE'));
});
test('annual calendar keeps opening and final-trading markers out of holidays',()=>{
 const result=parseCalendar(calendarRows());assert.equal(result.year,2026);assert.equal(result.coverageStart,'2026-01-01');assert.equal(result.coverageEnd,'2026-12-31');
 assert.deepEqual(result.openDates,['2026-01-02','2026-02-11','2026-02-23']);assert.equal(result.closedDates.length,24);
 assert.ok(result.closedDates.includes('2026-02-12'));assert.ok(!result.closedDates.includes('2026-02-11'));assert.ok(!result.closedDates.includes('2027-01-01'));
});
test('calendar unknown events, contradictory descriptions, weekday errors, duplicate dates and unknown year fail closed',()=>{
 for(const [extra,code] of [[{Name:'未知事件'},'UNKNOWN_CALENDAR_EVENT'],[{Description:'未知狀態'},'UNKNOWN_CALENDAR_EVENT'],[{Weekday:'日'},'CALENDAR_WEEKDAY_MISMATCH']]){
  const data=calendarRows();data[0]={...data[0],...extra};assert.throws(()=>parseCalendar(data),errorCode(code));
 }
 const data=calendarRows();data[1].Description='開始交易，但全日休市';assert.throws(()=>parseCalendar(data),errorCode('CONTRADICTORY_CALENDAR_EVENT'));
 assert.throws(()=>parseCalendar([...calendarRows(),calendarRows()[0]]),errorCode('DUPLICATE_DATE'));
 assert.throws(()=>parseCalendar(calendarRows().filter(row=>row.Name!=='中秋節')),errorCode('INCOMPLETE_CALENDAR'));
 assert.throws(()=>parseCalendar(calendarRows().filter(row=>row.Date!=='1150216')),errorCode('INCOMPLETE_CALENDAR'));
 const cross=calendarRows();cross[0]={...cross[0],Date:'1160101',Weekday:'五'};assert.throws(()=>parseCalendar(cross),errorCode('UNKNOWN_CALENDAR_YEAR'));
});
test('calendar HTTP result includes raw-body digest and validated year-only coverage',async()=>{
 const data=sources(),mock=mockFetch(data),provider=createOfficialProvider({...mock,clock:()=>now});const results=await provider.fetchCalendar(),result=results[0];
 assert.equal(results.length,1);assert.equal(result.sourceUrl,calendarUrl(2026));assert.equal(result.sourceHash,createHash('sha256').update(calendarHtml()).digest('hex'));assert.equal(result.fetchedAt,new Date(now).toISOString());
 assert.equal(mock.calls[0].options.redirect,'error');assert.equal(mock.calls[0].options.credentials,'omit');assert.equal(mock.calls[0].options.cache,'no-store');
});
test('calendar HTML checks actual year, all ISO rows, exact columns and empty settlement-only notes',()=>{
 const calendar=parseCalendarHtml(calendarHtml(),{year:2026});assert.equal(calendar.closedDates.length,24);assert.ok(calendar.closedDates.includes('2026-02-13'));
 assert.throws(()=>parseCalendarHtml(calendarHtml(),{year:2027}),errorCode('CALENDAR_YEAR_MISMATCH'));
 assert.throws(()=>parseCalendarHtml(calendarHtml().replace('2026-01-01','2027-01-01'),{year:2026}),errorCode('CALENDAR_YEAR_MISMATCH'));
 assert.throws(()=>parseCalendarHtml(calendarHtml().replace('<th>說明</th>','<th>其他</th>'),{year:2026}),errorCode('CALENDAR_FIELDS_MISMATCH'));
 assert.throws(()=>parseCalendarHtml('<div>（查無資料）</div>',{year:2027}),errorCode('INVALID_CALENDAR_HTML'));
});
test('unavailable latest OpenAPI and unpublished future year do not discard valid year-specific current calendar',async()=>{
 const fetchImpl=async url=>{
  if(url===SOURCE_URLS.calendar)throw Error('feed unavailable');
  return new Response(url===calendarUrl(2026)?calendarHtml():'<div>（查無資料）</div>',{headers:{'content-type':'text/html; charset=UTF-8'}});
 };
 const calendars=await createOfficialProvider({fetchImpl,clock:()=>now}).fetchCalendar();assert.deepEqual(calendars.map(row=>row.year),[2026]);assert.equal(calendars[0].sourceUrl,calendarUrl(2026));
});
test('one valid latest calendar survives unavailable year-specific report paths',async()=>{
 const fetchImpl=async url=>url===SOURCE_URLS.calendar?new Response(JSON.stringify(calendarRows()),{headers:{'content-type':'application/json'}}):new Response('Unavailable',{status:503});
 const calendars=await createOfficialProvider({fetchImpl,clock:()=>now}).fetchCalendar();assert.deepEqual(calendars.map(row=>row.year),[2026]);assert.equal(calendars[0].sourceUrl,SOURCE_URLS.calendar);
});
test('calendar conflicts fail closed instead of silently preferring one official source',async()=>{
 const altered=calendarRows().filter(row=>row.Date!=='1151225');
 const fetchImpl=async url=>url===SOURCE_URLS.calendar?new Response(JSON.stringify(altered),{headers:{'content-type':'application/json'}}):new Response(url===calendarUrl(2026)?calendarHtml():'<div>（查無資料）</div>',{headers:{'content-type':'text/html'}});
 await assert.rejects(createOfficialProvider({fetchImpl,clock:()=>now}).fetchCalendar(),error=>{assert.equal(error.code,'CALENDAR_SOURCE_MISMATCH');assert.deepEqual(error.years,[2026]);return true;});
});
test('a conflicted requested calendar year rejects even when the other requested year succeeds',async()=>{
 // Synthetic future-year fixture tests conflict handling; it does not assert
 // publication of the real 2027 calendar (which was unavailable at research).
 const next=calendarRows().map(row=>{const date=parseOfficialDate(row.Date).replace('2026','2027');return {...row,Date:date,Weekday:'日一二三四五六'[new Date(date+'T00:00:00Z').getUTCDay()]};});
 const marker=next.find(row=>row.Name==='國曆新年開始交易日');marker.Date='2027-01-04';marker.Weekday='一';
 next.push({Date:'2027-02-22',Name:'市場無交易，僅辦理結算交割作業',Description:'',Weekday:'一'});
 assert.equal(parseCalendar(next).year,2027);
 for(const conflictedYear of [2026,2027]){
  const latest=(conflictedYear===2026?calendarRows():next).filter(row=>parseOfficialDate(row.Date)!==`${conflictedYear}-12-25`);
  const fetchImpl=async url=>url===SOURCE_URLS.calendar?new Response(JSON.stringify(latest),{headers:{'content-type':'application/json'}}):new Response(url===calendarUrl(2026)?calendarHtml():calendarHtml(next,2027),{headers:{'content-type':'text/html'}});
  await assert.rejects(createOfficialProvider({fetchImpl,clock:()=>now}).fetchCalendar(),error=>{assert.equal(error.code,'CALENDAR_SOURCE_MISMATCH');assert.deepEqual(error.years,[conflictedYear]);return true;});
 }
});
test('live-shaped current month returns exact-date closes and leaves absent days to the calendar',async()=>{
 const mock=mockFetch(),result=await createOfficialProvider({...mock,clock:()=>now}).fetchCloses({from:'2026-10-01',to:'2026-10-07'});
 assert.equal(result.closes.length,4);assert.equal(result.failures.length,0);
 const latest=result.closes.at(-1);assert.equal(latest.returnPct,'0.22');assert.equal(latest.returnPctSource,'official-published');assert.equal(latest.evidence.length,3);
 assert.equal(result.closes[0].returnPctSource,'computed-from-official-close-change');assert.equal(result.closes[0].evidence.length,2);
 assert.ok(latest.evidence.every(row=>/^[0-9a-f]{64}$/.test(row.sha256)));assert.equal(mock.calls.length,3);
});
test('previous-month catch-up uses only paired verified official print URLs with actual title months',async()=>{
 const mock=mockFetch(),result=await createOfficialProvider({...mock,clock:()=>now}).fetchCloses({from:'2026-09-30',to:'2026-10-01'});
 assert.deepEqual(result.failures,[]);assert.equal(result.closes.length,2);assert.equal(result.closes[0].returnPct,'0.65');
 assert.equal(result.closes[0].sourceUrl,monthlyUrl('market','2026-09'));assert.equal(mock.calls.length,5);
 assert.ok(result.closes[0].evidence.every(row=>row.url.includes('date=20260901&response=html')));
});
test('14:00 Taipei is only an eligibility gate and never publication proof',async()=>{
 const before=Date.parse('2026-10-06T05:59:59Z'),provider=createOfficialProvider({...mockFetch(),clock:()=>before});
 assert.equal((await provider.fetchCloses({from:'2026-10-06',to:'2026-10-06'})).closes.length,0);
 const result=await createOfficialProvider({...mockFetch(),clock:()=>now}).fetchCloses({from:'2026-10-07',to:'2026-10-07'});assert.equal(result.failures.length,0);assert.equal(result.closes.length,0);
});
test('matching two feeds cannot bypass a stale daily primary for the current date',async()=>{
 const data=sources();data.history.push({...data.history.at(-1),Date:'1151007'});data.market.push({...data.market.at(-1),Date:'1151007',Change:'0.00'});
 const result=await createOfficialProvider({...mockFetch(data),clock:()=>now}).fetchCloses({from:'2026-10-07',to:'2026-10-07'});assert.equal(result.closes.length,0);assert.equal(result.failures.length,0);
});
test('monthly HTML parses exact headers, ROC row dates, comma prices and signed changes',()=>{
 const history=parseMonthlyHtml(monthlyHtml('history'),{kind:'history',month:'2026-09'}),market=parseMonthlyHtml(monthlyHtml('market'),{kind:'market',month:'2026-09'});
 assert.equal(history.get('2026-09-30').closeCents,4794013);assert.equal(market.get('2026-09-30').returnPct,'0.65');assert.equal(market.get('2026-09-29').changeCents,-39264);
 assert.equal(market.get('2026-09-30').closeCents-market.get('2026-09-29').closeCents,30817);
});
test('wrong monthly title, row month, fields, structure or duplicate date fails closed',()=>{
 const html=monthlyHtml('history'),parse=value=>parseMonthlyHtml(value,{kind:'history',month:'2026-09'});
 for(const [value,code] of [
  [html.replace('115年09月','115年08月'),'HISTORY_MONTH_MISMATCH'],[html.replace('115/09/29','115/08/29'),'HISTORY_MONTH_MISMATCH'],
  [html.replace('開盤指數','開盤價'),'HISTORY_FIELDS_MISMATCH'],[html.replace('<tbody>',''),'INVALID_HISTORY_HTML'],
  [html.replace('115/09/29','115/09/30'),'DUPLICATE_DATE'],[html+html,'INVALID_HISTORY_HTML']
 ])assert.throws(()=>parse(value),errorCode(code));
});
test('historical report failures leave current-month successes intact',async()=>{
 const mock=mockFetch(sources(),({url,body})=>new Response(body,{status:url.includes('?')?503:200,headers:{'content-type':'application/json'}}));
 const result=await createOfficialProvider({...mock,clock:()=>now}).fetchCloses({from:'2026-09-30',to:'2026-10-01'});
 assert.equal(result.closes.length,1);assert.deepEqual(result.failures,[{targetDate:'2026-09-30',code:'OFFICIAL_HTTP_STATUS'}]);
});
test('one-sided missing date is an exact-date inconsistency rather than a fabricated holiday',async()=>{
 const data=sources();data.market.pop();const result=await createOfficialProvider({...mockFetch(data),clock:()=>now}).fetchCloses({from:'2026-10-06',to:'2026-10-06'});
 assert.equal(result.closes.length,0);assert.equal(result.failures[0].code,'OFFICIAL_DATE_MISMATCH');
});
test('mismatching official close, change, or prior-close sequence blocks settlement',async()=>{
 for(const [mutate,code] of [
  [data=>{data.history.at(-1).ClosingIndex='49822.54';},'OFFICIAL_CLOSE_MISMATCH'],
  [data=>{data.market.at(-1).Change='110.52';},'PREVIOUS_CLOSE_MISMATCH'],
  [data=>{data.index[0]['漲跌點數']='110.52';},'OFFICIAL_INDEX_MISMATCH']
 ]){const data=sources();mutate(data);const result=await createOfficialProvider({...mockFetch(data),clock:()=>now}).fetchCloses({from:'2026-10-06',to:'2026-10-06'});assert.equal(result.closes.length,0);assert.equal(result.failures[0].code,code);}
});
test('future source dates, malformed schemas and duplicate rows invalidate all candidate closes',async()=>{
 for(const [mutate,code] of [
  [data=>{data.index[0]['日期']='1151008';},'FUTURE_SOURCE_DATE'],
  [data=>{data.history.push(data.history[0]);},'DUPLICATE_DATE'],
  [data=>{data.market={data:data.market};},'INVALID_SCHEMA']
 ]){const data=sources();mutate(data);const result=await createOfficialProvider({...mockFetch(data),clock:()=>now}).fetchCloses({from:'2026-10-05',to:'2026-10-06'});assert.equal(result.closes.length,0);assert.equal(result.failures.length,2);assert.ok(result.failures.every(row=>row.code===code));}
});
test('HTTP failures, non-JSON, invalid JSON, declared and streamed oversized bodies fail closed',async()=>{
 const cases=[
  [()=>new Response('{}',{status:503,headers:{'content-type':'application/json'}}),'OFFICIAL_HTTP_STATUS'],
  [()=>new Response('{}',{headers:{'content-type':'text/html'}}),'OFFICIAL_CONTENT_TYPE'],
  [()=>new Response('{broken',{headers:{'content-type':'application/json'}}),'OFFICIAL_INVALID_JSON'],
  [()=>new Response('{}',{headers:{'content-type':'application/json','content-length':String(MAX_BYTES+1)}}),'OFFICIAL_BODY_TOO_LARGE'],
  [()=>new Response('x'.repeat(MAX_BYTES+1),{headers:{'content-type':'application/json'}}),'OFFICIAL_BODY_TOO_LARGE']
 ];
 for(const [mutate,code] of cases){const provider=createOfficialProvider({...mockFetch(sources(),mutate),clock:()=>now});await assert.rejects(provider.fetchCalendar(),errorCode(code));}
});
test('redirect flags and unexpected response destination are rejected even with valid JSON',async()=>{
 for(const redirect of [{redirected:true},{url:'https://example.org/other'}]){
  const fetchImpl=async()=>Object.assign({status:200,headers:new Headers({'content-type':'application/json'}),body:new Response('[]').body},redirect);
  await assert.rejects(createOfficialProvider({fetchImpl}).fetchCalendar(),errorCode('OFFICIAL_REDIRECT'));
 }
});
test('caller cancellation promptly ends a fetch that does not honor abort',async()=>{
 const controller=new AbortController(),fetchImpl=()=>new Promise(()=>{}),provider=createOfficialProvider({fetchImpl});
 const result=provider.fetchCalendar({signal:controller.signal});controller.abort();await assert.rejects(result,errorCode('OFFICIAL_REQUEST_ABORTED'));
});
test('ten-second deadline bounds stalled fetches without relying on implementation abort support',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const provider=createOfficialProvider({fetchImpl:()=>new Promise(()=>{})}),result=provider.fetchCalendar();
 const rejected=assert.rejects(result,errorCode('OFFICIAL_SOURCE_TIMEOUT'));t.mock.timers.tick(REQUEST_TIMEOUT_MS);await rejected;
});
test('already-aborted calls do not make outbound requests',async()=>{
 const mock=mockFetch(),controller=new AbortController();controller.abort();
 await assert.rejects(createOfficialProvider({...mock}).fetchCalendar({signal:controller.signal}),errorCode('OFFICIAL_REQUEST_ABORTED'));assert.equal(mock.calls.length,0);
});
test('month rollover may validate the primary date using historical reports rather than unrelated live rows',async()=>{
 const data=sources();data.index=[indexRow({'日期':'1150930','收盤指數':'47940.13','漲跌點數':'308.17','漲跌百分比':'0.65'})];
 const result=await createOfficialProvider({...mockFetch(data),clock:()=>now}).fetchCloses({from:'2026-09-30',to:'2026-09-30'});
 assert.equal(result.closes.length,1);assert.equal(result.closes[0].returnPctSource,'official-published');assert.equal(result.closes[0].evidence.length,3);
 assert.equal(result.closes[0].evidence[0].url,SOURCE_URLS.index);assert.ok(result.closes[0].evidence.slice(1).every(row=>row.url.includes('date=20260901')));
});
test('date ranges are validated before any outbound requests',async()=>{
 const mock=mockFetch(),provider=createOfficialProvider({...mock,clock:()=>now});
 for(const range of [{from:'2026-02-30',to:'2026-03-01'},{from:'2026-10-07',to:'2026-10-01'}])await assert.rejects(provider.fetchCloses(range),errorCode('INVALID_DATE_RANGE'));
 await assert.rejects(provider.fetchCloses({from:'2025-01-01',to:'2026-10-01'}),errorCode('DATE_RANGE_TOO_LARGE'));assert.equal(mock.calls.length,0);
});

test('known calendar disagreement stays fenced when one source disappears and only matching two-source recovery clears it',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{openDatabase}=require('../src/db'),{MarketStore}=require('../src/market/store'),{MarketAutomationStore}=require('../src/market/automation-store'),{MarketAutomation,RETRY_MS}=require('../src/market/automation');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-conflict-fence-')),db=openDatabase(path.join(root,'app.sqlite'));let time=Date.parse('2026-10-08T06:00:00Z'),phase=0;
 const clock=()=>time,changed=calendarRows().filter(row=>row.Date!=='1151009'),fetchImpl=async url=>{
  if(url===SOURCE_URLS.calendar)return new Response(JSON.stringify(phase===2?calendarRows():changed),{headers:{'content-type':'application/json'}});
  if(url===calendarUrl(2026))return phase===1?new Response('Unavailable',{status:503}):new Response(calendarHtml(),{headers:{'content-type':'text/html'}});
  return new Response('Unavailable',{status:503});
 };
 const store=new MarketAutomationStore(db,new MarketStore(db,clock),{clock}),provider=createOfficialProvider({fetchImpl,clock});provider.fetchCloses=async()=>({closes:[],failures:[]});const runner=new MarketAutomation(store,{clock,provider});
 t.after(async()=>{await runner.stop();db.close();fs.rmSync(root,{recursive:true,force:true});});
 await runner.tick();assert.deepEqual(store.state().calendarBlockedYears,[2026]);assert.equal(store.plan(),null);
 phase=1;time+=RETRY_MS;await runner.tick();assert.deepEqual(store.state().calendarBlockedYears,[2026]);assert.equal(store.state().calendarFailed,true);assert.equal(store.isTradingDay('2026-10-09'),null);assert.equal(db.prepare('SELECT COUNT(*) n FROM market_rounds').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM market_calendar_years').get().n,0);
 phase=2;time+=RETRY_MS;await runner.tick();assert.deepEqual(store.state().calendarBlockedYears,[]);assert.equal(store.isTradingDay('2026-10-09'),false);assert.equal(store.view().automation.nextTradingDate,'2026-10-12');assert.equal(JSON.parse(db.prepare('SELECT calendar_json FROM market_calendar_years WHERE year=2026').get().calendar_json).evidence.length,2);
});
