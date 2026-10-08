(()=>{'use strict';
 const $=s=>document.querySelector(s),R=window.MarketRules,C=window.MarketCurve,escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=value=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 const formatSnapshot=value=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));
 const signed=n=>n>0?'+'+n:String(n),name=(id,r)=>id==='curve'?'曲線計分':id==='tie'?'和局':r.options?.find(o=>o.id===id)?.name||'—';
 // getRandomValues also works on BGA's HTTP LAN origin; randomUUID needs HTTPS.
 const requestId=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
 let state=null,draft=null,busy=false,uncertain=false,serverAnchor=0,localAnchor=0,preview=null,loadSequence=0,votingClosed=true,followCurrentRound=true;
 let sharedTabs=null,confirmDialogBinding=null,approvalDialogBinding=null;const formBindings=[];
 function labelButton(selector,label,icon){const button=$(selector);button.textContent=label;window.GameUI?.decorateButton?.(button,icon,{iconOnly:true,label});}
 const validForm=form=>window.GameUI?.validateForm?.(form)??true;
 const now=()=>serverAnchor+performance.now()-localAnchor;
 const round=()=>state?.rounds.find(r=>r.id===$('#roundSelect').value);
 const currentRound=()=>state?.rounds.slice().reverse().find(r=>r.phase==='open'&&!r.result&&now()<Date.parse(r.cutoffAt));
 const dateLabel=value=>R.validDate(value)?value+'（'+new Intl.DateTimeFormat('zh-TW',{timeZone:'UTC',weekday:'long'}).format(new Date(value+'T12:00:00Z'))+'）':String(value||'—');
 const lastPredictionDate=r=>new Date(Date.parse(r.targetDate+'T00:00:00Z')-1).toISOString().slice(0,10);
 const cutoffLabel=r=>r.rules.version>=2?'可預測至 '+lastPredictionDate(r)+' 23:59:59.999（23:59 整分鐘）；'+r.targetDate+' 00:00 起截止（台北）':'沿用舊規則：前一晚 '+r.rules.cutoffTime+' 截止（台北）';
 const displayTime=value=>value&&Number.isFinite(Date.parse(value))?format(value):'—';
 const numeric=(value,{plus=false}={})=>Number.isFinite(value)?(plus&&value>0?'+':'')+new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:4}).format(value):'—';
 function actionButton(selector,icon,label){const button=$(selector);if(window.GameUI?.decorateButton)window.GameUI.decorateButton(button,icon,{iconOnly:true,label});else button.textContent=label;}
 function officialUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['twse.com.tw','www.twse.com.tw','openapi.twse.com.tw'].includes(url.hostname)?url.href:null;}catch{return null;}}
 function renderPrediction(){const r=currentRound();$('#currentPredictionDate').textContent=r?dateLabel(r.targetDate):'等待下一個交易日開放';$('#currentPredictionCutoff').textContent=r?cutoffLabel(r):'依官方交易日曆確認，暫無可提交的預測；已截止輪次仍會繼續查核收盤結果。';$('#goCurrentRound').hidden=!r||r.id===round()?.id;$('#goCurrentRound').disabled=busy||uncertain;}
 function renderAutomation(){
  const a=state.automation,status=a?.status||'unavailable';
  const labels={ok:'自動結算正常',waiting:'等待官方同日收盤資料','calendar-unavailable':'官方交易日曆尚未確認',disabled:'自動結算已停用',error:'自動查核暫時失敗',unavailable:'自動結算狀態尚未提供'};
  $('#automationStatus').textContent=labels[status]||'自動查核狀態待確認';
  $('#automationPanel').classList.toggle('attention',['error','calendar-unavailable','disabled'].includes(status)||!!a?.reviewDates?.length);
  const details=['交易日 14:00（台北）起查核，只採同日正式收盤報表'];
  if(a?.lastAttemptAt)details.push('最近查核 '+displayTime(a.lastAttemptAt));if(a?.lastSuccessAt)details.push('最近成功 '+displayTime(a.lastSuccessAt));if(a?.nextAttemptAt)details.push('下次查核 '+displayTime(a.nextAttemptAt));
  if(a?.nextTradingDate)details.push('下一交易日 '+dateLabel(a.nextTradingDate));
  $('#automationDetails').textContent=details.join(' · ');
  const notes=[];if(a?.waitingDates?.length)notes.push('等待資料：'+a.waitingDates.map(dateLabel).join('、'));if(a?.reviewDates?.length)notes.push('需管理員複核：'+a.reviewDates.map(dateLabel).join('、'));
  if(status==='calendar-unavailable')notes.push('官方行事曆年份覆蓋未確認；已取得年份：'+(a?.calendarYears?.length?a.calendarYears.join('、'):'尚無')+'。不推測休市日或開放未知日期。');if(status==='error')notes.push('保留目前結果與積分，等待下次重試。');if(status==='disabled')notes.push('目前不會自動抓取或結算，請洽管理員。');
  if(a?.waitingDates?.length)notes.push('缺少資料不等於休市；下一輪依已確認日曆獨立開放。');$('#automationDates').textContent=notes.join(' ');
 }
 function renderMarketHistory(){
  const history=state.marketHistory,rows=history?.rows||[],waiting=history?.waitingDates||[];
  $('#marketHistoryRange').textContent=history?history.from+' ～ '+history.to+'（台北）':'日期範圍尚未取得';
  const messages=[history?(rows.length?'已取得 '+rows.length+' 個交易日的官方收盤資料。':'這段期間尚無已驗證的官方收盤資料。'):'行情資料尚未載入，請按更新重試。'];
  if(waiting.length)messages.push('等待資料：'+waiting.map(dateLabel).join('、')+'。缺少資料不等於休市。');if(rows.some(row=>row.reviewRequired))messages.push('標示「待複核」的日期需管理員確認。');
  if(rows.some(row=>row.returnPctSource==='computed-from-official-close-change'))messages.push('「計算值」依同一交易日的官方收盤指數與漲跌點數計算：漲跌點數 ÷（收盤指數 − 漲跌點數）× 100，四捨五入至小數點後 2 位；不是交易所直接發布的百分比。');
  $('#marketHistoryStatus').textContent=messages.join(' ');
  $('#marketHistoryRows').innerHTML=rows.length?rows.map(row=>{const url=officialUrl(row.sourceUrl),changeClass=row.change>0?'market-up':row.change<0?'market-down':'',source=url?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+escape('查看 '+row.targetDate+' 證交所官方資料（另開視窗）')+'">證交所官方資料 ↗</a>':'官方來源連結待確認';return '<tr><th scope="row">'+escape(dateLabel(row.targetDate))+'</th><td class="number">'+numeric(row.close)+'</td><td class="number '+changeClass+'">'+numeric(row.change,{plus:true})+'</td><td class="number '+changeClass+'">'+numeric(row.returnPct,{plus:true})+'%'+(row.returnPctSource==='computed-from-official-close-change'?'<small class="computed-return">計算值</small>':'')+'</td><td>'+source+'<small>取得於 '+escape(displayTime(row.fetchedAt))+'</small>'+(row.reviewRequired?'<strong class="review-badge">待複核</strong>':'')+'</td></tr>';}).join(''):'<tr><td colspan="5" class="empty-cell">官方資料確認後會顯示於此</td></tr>';
 }
 function renderLeaderboard(){
  const board=state.leaderboard,rows=(board?.rows||[]).slice(0,100),own=board?.ownRank;
  $('#leaderboardCount').textContent=board?'共 '+board.totalParticipants+' 位玩家':'';
  $('#leaderboardStatus').textContent=!board?'排行榜尚未載入，請按更新重試。':!rows.length?'尚無已結算的預測，首筆結算後即可上榜。':!own?'你尚無已結算的預測，結算後會顯示排名。':'同分玩家依固定順序顯示，不代表名次高低。';
  const rowMarkup=row=>'<tr'+(row.isMe?' class="is-me"':'')+'><td class="rank-number">'+escape(row.rank)+'</td><th scope="row">'+escape(row.displayName)+(row.isMe?' <span class="self-tag">你</span>':'')+'</th><td class="number">'+escape(pointsLabel(row.score))+'</td></tr>';
  $('#leaderboardRows').innerHTML=rows.length?rows.map(rowMarkup).join(''):'<tr><td colspan="3" class="empty-cell">尚無排名</td></tr>';
  $('#ownRank').hidden=!own||rows.some(row=>row.isMe);$('#ownRank').textContent=own?'你的排名：第 '+own.rank+' 名 · '+own.displayName+' · '+pointsLabel(own.score)+' 分（不在上方名單內）':'';
 }

 function message(s,error=false){$('#message').textContent=s;$('#message').classList.toggle('error',error);if(error&&!state){$('#automationStatus').textContent='自動結算狀態尚未載入';$('#automationDates').textContent='請按更新重新確認官方資料與交易日。';$('#currentPredictionDate').textContent='預測日期尚未載入';$('#marketHistoryStatus').textContent=$('#leaderboardStatus').textContent='資料載入失敗，請按更新重試。';$('#saveVote').disabled=true;}}
 async function api(path,data){const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});let value;try{value=await res.json();}catch{throw Error('伺服器回應無法辨識，請更新確認狀態');}if(!res.ok){if(res.status===401)location.href='/login?next=/market';const error=Error(value.error||'操作失敗');error.code=value.code;error.status=res.status;throw error;}return value;}
 const isCurve=r=>r?.rules?.version===3;
 const percent=tick=>signed(tick/10)+'%';
 const pointsLabel=value=>{const rounded=Number(Number(value).toFixed(2));return (rounded>0?'+':'')+rounded.toFixed(2);};
 const voteLabel=r=>r?.vote?(isCurve(r)?percent(r.vote.forecastTick):name(r.vote.optionId,r.rules)):'未投票';
 function selectDraft(){const r=round();draft=r?{roundId:r.id,...(isCurve(r)?{forecastTick:r.vote?.forecastTick??0}:{optionId:r.vote?.optionId||null}),expectedRevision:r.vote?.revision||0}:null;}

 async function load(quiet=false){const sequence=++loadSequence,value=await api(state?.me.role==='admin'?'/api/admin/market':'/api/market');if(sequence!==loadSequence)return;
  if(value.me.role==='admin'&&!('voteCount' in (value.rounds[0]||{}))&&!state){const admin=await api('/api/admin/market');if(sequence!==loadSequence)return;state=admin;}else state=value;
  serverAnchor=Date.parse(state.serverNow);localAnchor=performance.now();const previous=$('#roundSelect').value;
  $('#roundSelect').innerHTML=state.rounds.slice().reverse().map(r=>'<option value="'+escape(r.id)+'">'+escape(dateLabel(r.targetDate))+' · '+({open:'可預測',closed:'待結算',settled:'已結算',void:'休市／已取消'}[r.phase]||'狀態待確認')+'</option>').join('');
  const preferred=currentRound()||state.rounds[0];$('#roundSelect').value=!followCurrentRound&&state.rounds.some(r=>r.id===previous)?previous:preferred?.id||'';
  if(!draft||draft.roundId!==$('#roundSelect').value)selectDraft();
  $('#score').textContent=pointsLabel(state.stats.score);$('#hits').textContent=state.stats.hits;$('#played').textContent=state.stats.played;
  $('[data-view=admin]').hidden=state.me.role!=='admin';uncertain=false;syncDrawTarget();renderVote();renderRecords();renderAutomation();renderMarketHistory();renderLeaderboard();renderAdmin();setView();
  if(!quiet)message(currentRound()?(isCurve(currentRound())?'拖動滑桿預測漲跌幅，核對曲線後送出；截止前可修改。':'選一個區間，截止前可修改。'):state.rounds.length?'目前沒有開放中的預測，可查看歷史與待結算輪次。':'目前等待官方交易日曆確認；尚無可提交的預測。');
 }
 function renderVote(){const focused=document.activeElement?.name==='optionId'?document.activeElement.value:null,focusedPreview=document.activeElement?.dataset?.previewOption,r=round(),rules=r?.rules||state?.rules||R.CONFIG,labels=isCurve(r)?[]:R.labels(rules),closed=!r||r.phase==='void'||!!r.result||now()>=Date.parse(r.cutoffAt);votingClosed=closed;
  $('#options').hidden=isCurve(r);$('#curvePanel').hidden=!isCurve(r);
  if(isCurve(r)){$('#options').innerHTML='';renderCurve(r,closed);}else $('#options').innerHTML=rules.options.map((o,i)=>'<article class="choice ui-interactive-card '+(draft?.optionId===o.id?'selected ':'')+(closed?'closed':'')+'"><label class="choice-select"><input type="radio" name="optionId" value="'+escape(o.id)+'" '+(draft?.optionId===o.id?'checked ':'')+(closed||busy||uncertain?'disabled':'')+' aria-label="'+escape(o.name+' '+labels[i])+'"><div class="choice-heading"><strong>'+escape(o.name)+'</strong><span>'+escape(labels[i])+'</span></div></label>'+drawMarkup(o)+'</article>').join('');
  if(focused){const input=[...$('#options').querySelectorAll('input')].find(x=>x.value===focused);if(input&&!input.disabled)input.focus({preventScroll:true});}
  if(focusedPreview)previewTrigger(focusedPreview)?.focus({preventScroll:true});
  if(!isCurve(r)){$('#scoreRules').innerHTML='猜中 '+signed(rules.hit)+' · 猜錯 '+signed(rules.miss)+'<br>剛好 0% 為和局，皆不計分';
  $('#expectation').textContent='等機率隨機選六項時，非和局的期望積分為 (1/6 × '+rules.hit+') + (5/6 × '+rules.miss+') = '+((rules.hit+5*rules.miss)/6)+'。這不代表各區間真實發生機率相同，也不代表每個區間的真實期望值為 0。剛好 0% 的和局積分為 0。';}
  $('#gameplaySummary').textContent=isCurve(r)?'預測下一交易日台股加權指數的收盤漲跌幅：-10%～+10%，每格 0.1%。每帳號每交易日一票，截止前可修改。圖片僅為裝飾，點圖只會放大。':'本交易日沿用六區間舊規則，每帳號每交易日一票，截止前可修改。';
  $('#phase').textContent=!r?'等待開放':r.phase==='void'?'休市／本輪已取消':r.result?'已結算':closed?'已截止 · 等待官方結算':'預測開放中';$('#cutoff').textContent=!r?'等待確認官方交易日曆':cutoffLabel(r);renderPrediction();
  const voteText=r?.vote?'已提交：'+voteLabel(r)+' · '+format(r.vote.updatedAt):'尚未投票';
  $('#voteStatus').textContent=!r?'尚未建立交易日。':r.phase==='void'?'本輪已取消，不計分。'+(r.voidReason||'官方休市公告已確認。'):r.result?'收盤 '+signed(r.result.returnPct)+'% · '+name(r.result.bucket,rules)+' · '+(r.vote?'本日 '+pointsLabel(r.result.points)+' 分':'未投票，不計分'):closed?voteText+'。投票已截止。':voteText+'。截止前可修改。';
  actionButton('#saveVote',r?.vote?'save':'send',r?.vote?'儲存修改':'送出預測');$('#saveVote').disabled=busy||uncertain||closed||(isCurve(r)?!curveReady||!Number.isInteger(draft?.forecastTick)||draft.forecastTick===r?.vote?.forecastTick:!draft?.optionId||draft.optionId===r?.vote?.optionId);
  $('#roundSelect').disabled=busy||uncertain||!state?.rounds.length;
 }
 function renderCurve(r,closed){
  if(curveExampleRound!==r.id){curveExampleRound=r.id;curveExampleActual=0;}
  const actual=r.result?.returnPct??curveExampleActual;$('#curveActualControl').hidden=!!r.result;$('#curveActualExample').value=String(curveExampleActual);
  $('#curveChartTitle').textContent=r.result?'本日結算計分曲線':'示範計分曲線（尚未知道真實收盤）';
  $('#curveAxes').textContent='橫軸：你的預測漲跌幅 · 縱軸：所得分數 · 固定'+(r.result?'真實':'假設')+'收盤 '+signed(actual)+'% · 虛線：你目前的預測';
  const tick=draft?.forecastTick??0,rules=r.rules,input=$('#forecastTick');input.value=String(tick);input.disabled=closed||busy||uncertain;
  input.setAttribute('aria-valuetext',percent(tick));$('#forecastValue').textContent=percent(tick);
  $('#scoreRules').textContent='依精準程度曲線計分 · 單日最高 +100 分 · 0% 也計分';
  $('#expectation').textContent='本輪採用開場時凍結、以 0% 為中心的非均勻猜測分布 p。若隨機猜測 X 遵循本輪 p，對每個固定真實收盤 y，未取整分數的期望為 0；每分百萬單位取整後的期望誤差不超過 0.0000005 分。這不保證真實市場分布、個人策略或每個猜測本身的期望為 0。';
  const e=rules.estimation;$('#curveSnapshot').textContent='本輪規則凍結於 '+formatSnapshot(rules.frozenAt)+'（台北）；p 的標準差參數 τ = '+numeric(rules.scaleTau)+'%。'+(e.method==='fixed-prior'?'目前有 '+e.sampleCount+' 筆可用歷史，不足 '+e.minObservations+' 筆，使用固定先驗 τ = '+e.fallbackScale+'%。':'由凍結前 '+e.sampleCount+' 筆已完成交易日估計，歷史範圍 '+e.historyStart+' ～ '+e.historyEnd+'。')+' 凍結後不使用未來資料或事後修正改寫本輪曲線。';
  $('#curveSources').innerHTML=(rules.observations||[]).map(row=>{const url=officialUrl(row.sourceUrl);return '<li>'+escape(row.targetDate)+'：'+escape(signed(row.returnPct))+'% · 取得 '+escape(formatSnapshot(row.fetchedAt))+(url?' · <a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">官方來源（另開視窗）</a>':' · 官方來源連結未提供')+'</li>';}).join('')||'<li>尚無可用歷史；本輪採固定先驗，沒有額外虛構資料。</li>';
  curveReady=false;
  try{
   const scores=Array.from({length:201},(_,index)=>C.scorePrediction(index-100,actual,rules));
   const points=scores.map((score,index)=>{return (44+index*2.6).toFixed(2)+','+(122-score*.9).toFixed(2);}).join(' ');
   $('#curvePlot').innerHTML='<svg viewBox="0 0 600 250" role="img" aria-label="'+escape((r.result?'真實':'示範假設')+'收盤 '+signed(actual)+'% 的計分曲線：橫軸玩家預測漲跌幅，縱軸所得分數')+'"><path d="M44 32H564 M44 122H564 M44 212H564" class="curve-grid"/><path d="M44 24V218 M44 122H570" class="curve-axis"/><polyline points="'+points+'" class="score-curve"/><path d="M'+(44+(tick+100)*2.6)+' 24V218" class="forecast-marker"/><text x="2" y="36">+100</text><text x="23" y="126">0</text><text x="2" y="216">−100</text><text x="44" y="238">−10%</text><text x="298" y="238">0%</text><text x="529" y="238">+10%</text></svg>';
   $('#curveSelectedScore').textContent='你目前預測 '+percent(tick)+'，在此'+(r.result?'真實':'假設')+'收盤下得 '+pointsLabel(C.scorePrediction(tick,actual,rules))+' 分。'+(r.result?'':'這是示範，不是已得分。');
   $('#curveExamples').textContent=[-4,0,4].map(actual=>'若收盤 '+signed(actual)+'%，得 '+pointsLabel(C.scorePrediction(tick,actual,rules))+' 分').join('；')+'（顯示至小數第 2 位，內部以百萬分之一分保存）。此'+(r.result?'實際':'示範')+'收盤下，合法預測最低 '+pointsLabel(Math.min(...scores))+' 分，最高 '+pointsLabel(Math.max(...scores))+' 分。';
   curveReady=true;
   $('#curveFormula').textContent='x = 你的預測，y = 真實收盤漲跌幅。K(x,y) = exp(−(x−y)² / 8)，μ(y) = Σ pᵢ K(xᵢ,y)，D = 1 − minⱼ μ(xⱼ)。得分 = 100 × [K(x,y) − μ(y)] / max(D, 1 − μ(y))。使用同一個 y 的共同分母，不逐人截斷分數。';
  }catch{ $('#curvePlot').innerHTML='';$('#curveExamples').textContent='計分曲線暫時無法驗證，請更新後再提交。';input.disabled=true; }
  renderCurveImages();
 }
 function renderCurveImages(){
  const key=drawState.targetDate+':'+drawState.sequence+':'+Object.values(drawState.images).map(image=>image?.id||'').join('|');if(curveImageKey===key)return;curveImageKey=key;
  $('#curveImages').innerHTML=curveSlots.map(slot=>{
   const image=drawState.images[slot.id],option={id:slot.id,name:signed(slot.anchor)+'% 區段',color:'#e7eadf'};
   return '<span class="curve-image-anchor" data-slot="'+slot.id+'" style="left:'+((slot.anchor+10)*5)+'%" aria-hidden="true">'+escape(signed(slot.anchor)+'%')+'</span><article class="curve-image-slot" data-slot="'+slot.id+'" style="--anchor:'+((slot.anchor+10)*5)+'%"><p class="curve-slot-label">'+escape(slot.label)+'</p>'+drawMarkup(option)+(image?'<p class="curve-image-eligibility">此圖原適用：'+escape(imageRules(image))+'</p>':'')+'</article>';
  }).join('');
 }
 function renderRecords(){const rows=state.rounds;$('#history').innerHTML=rows.length?rows.map(r=>'<article class="record"><div><strong>'+escape(r.targetDate)+'</strong><small>'+escape(r.phase==='void'?'休市／本輪已取消':r.result?'已結算 · 第 '+r.result.revision+' 版':r.phase==='open'?'投票中':'等待結算')+'</small></div><p>我的預測：'+escape(voteLabel(r))+'</p><p>'+escape(r.phase==='void'?'不計分 · '+(r.voidReason||'官方休市公告'):r.result?'收盤 '+signed(r.result.returnPct)+'% · '+name(r.result.bucket,r.rules):'等待官方收盤結果')+'</p><div class="result-points">'+(r.result?(r.vote?pointsLabel(r.result.points):'0')+'<small>積分</small>':'—')+'</div></article>').join(''):'<p class="helper">有交易日後，預測與結果會出現在這裡。</p>';
  $('#ledger').innerHTML=state.ledger.length?state.ledger.map(l=>'<div class="ledger-row"><span>'+pointsLabel(l.points)+' 分</span><strong>'+escape(l.targetDate)+'</strong> · 第 '+l.revision+' 版 · '+(l.kind==='reversal'?'撤銷第 '+l.reverses_revision+' 版':'結算')+'<br>'+escape(format(l.at))+' · '+escape(l.reason||'首次結算')+'</div>').join(''):'<p class="helper">尚無積分異動。</p>';
 }
 function renderAdmin(){if(state.me.role!=='admin')return;const old=$('#adminRound').value;$('#adminRound').innerHTML=state.rounds.map(r=>'<option value="'+escape(r.id)+'">'+escape(r.targetDate)+' · '+(r.phase==='void'?'休市／已取消':r.result?'已結算／可更正':'待結算')+'</option>').join('');if(state.rounds.some(r=>r.id===old))$('#adminRound').value=old;$('#settlementAudit').innerHTML=state.rounds.flatMap(r=>(r.settlementHistory||[]).map(s=>'<div class="ledger-row"><strong>'+escape(r.targetDate)+'</strong> · 第 '+s.revision+' 版 · '+signed(s.returnPct)+'%<br>'+escape(format(s.at))+' · '+escape(s.actorSource==='system'?'系統':s.administrator)+' · '+escape(s.reason||'首次結算')+'</div>')).join('')||'<p class="helper">尚無結算紀錄。</p>';updateAdmin();}
 function updateAdmin(){const r=state?.rounds.find(r=>r.id===$('#adminRound').value);$('#settleStatus').textContent=!r?'先建立交易日。':r.phase==='void'?'本輪已取消，不能結算。'+(r.voidReason||''):(r.result?'目前收盤 '+signed(r.result.returnPct)+'% · 第 '+r.result.revision+' 版。更正必填原因。':'參與 '+r.voteCount+' 人。')+' 可結算時間：'+format(r.settlementAfter)+'（台北）';$('#previewButton').disabled=busy||uncertain||!r||r.phase==='void'||now()<Date.parse(r.settlementAfter);}
 function setView(){let view=location.hash.slice(1);if(!['daily','uploads','records','marketHistory','leaderboard','admin'].includes(view)||view==='admin'&&state?.me.role!=='admin')view='daily';if(sharedTabs){sharedTabs.refresh({notify:false});sharedTabs.select(view,{notify:false});}else{for(const section of ['daily','uploads','records','marketHistory','leaderboard','admin'])$('#'+section).hidden=view!==section;}$('#adminAudit').hidden=view!=='admin'||state?.me.role!=='admin';for(const button of document.querySelectorAll('[data-view]')){button.setAttribute('aria-pressed',String(button.dataset.view===view));}galleryView(view);}
 function setBusy(value){busy=value;$('#refresh').disabled=value;for(const element of document.querySelectorAll('#createForm input,#createForm button,#settleForm input,#settleForm select,#settleForm button,#confirmSettlement,#cancelConfirm,#calendarOverrideForm input,#calendarOverrideForm select,#calendarOverrideForm button'))element.disabled=value||uncertain;renderVote();updateAdmin();}
 async function mutate(path,payload,success){setBusy(true);try{await api(path,{...payload,requestId:requestId()});await load(true);selectDraft();renderVote();message(success);}
  catch(error){message(error.message,true);try{await load(true);const r=round();if(error.code==='STALE_VOTE'&&r?.id===payload.roundId){draft={roundId:r.id,...(isCurve(r)?{forecastTick:payload.forecastTick}:{optionId:payload.optionId}),expectedRevision:r.vote?.revision||0};renderVote();message(votingClosed?'投票已在另一個頁面更新，目前已截止。':'投票已在另一個頁面更新。已同步最新版本並保留您的選擇，請核對後再提交。',true);}}catch{uncertain=true;message('操作結果未確認。請按「更新」取得伺服器狀態後再操作。',true);}}
  finally{setBusy(false);}}
 // Gallery state is independent of votes, score refreshes and settlement requests.
 const weekdays=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
 const defaultLimits={maxUploadBytes:2097152,maxImageBytes:4194304,maxDimension:4096,maxPixels:8000000,maxPerUser:100,maxImages:1000,maxStorageBytes:268435456,maxApprovalBatch:1000};
 const gallery={view:null,limits:{...defaultLimits},mine:null,mineBusy:false,mineSequence:0,review:null,reviewBusy:false,reviewSequence:0,selected:new Set(),upload:null,uploadSequence:0,uploadReading:false,uploadBusy:false,uploadAttempt:null,approval:null,approvalBusy:false,approvalSequence:0};
 const curveSlots=[{id:'crash',anchor:-8,label:'-10% ～ -6%',rank:4},{id:'fall',anchor:-4,label:'-6% ～ -2%',rank:2},{id:'center',anchor:0,label:'-2% ～ +2%',rank:1},{id:'rally',anchor:4,label:'+2% ～ +6%',rank:3},{id:'surge',anchor:8,label:'+6% ～ +10%',rank:5}];
 let curveImageKey=null,preloadedImages=[],curveReady=false,curveExampleRound=null,curveExampleActual=0;
 const drawState={targetDate:null,layout:null,images:{},sequence:0,requested:false,busy:false,error:''};
 // A timed-out or rate-limited retry may never reach an earlier committed receipt.
 const unresolvedGalleryError=error=>!error.status||error.status>=500||error.status===408||error.status===429;
 const checkedValues=selector=>[...$(selector).querySelectorAll('input:checked')].map(input=>input.value);
 const imageUrl=image=>'/api/market/images/'+encodeURIComponent(image.id)+'/media';
 const imageRules=image=>(image.buckets||[]).map(id=>name(id,R.CONFIG)).join('、')+' · '+((image.weekdays||[]).length===7?'不限星期':(image.weekdays||[]).map(day=>weekdays[day]).join('、'));
 function galleryMessage(selector,text,error=false){$(selector).textContent=text;$(selector).classList.toggle('error',error);}
 function rememberLimits(value){if(value?.limits)gallery.limits={...defaultLimits,...value.limits};}
 function pickMarkup(options,kind){return '<legend>'+escape(kind)+'</legend>'+options.map(option=>'<label class="check"><input type="checkbox" value="'+escape(option.id)+'">'+escape(option.name)+'</label>').join('');}
 function initGallery(){
  const days=weekdays.map((label,id)=>({id,name:label}));
  $('#uploadBuckets').innerHTML=pickMarkup(R.CONFIG.options,'適用區間（至少選一項）');
  $('#uploadWeekdays').innerHTML=pickMarkup(days,'適用星期（目標交易日，至少選一天）');
  $('#reviewBuckets').innerHTML=pickMarkup(R.CONFIG.options,'篩選適用區間');
  $('#reviewWeekdays').innerHTML=pickMarkup(days,'篩選適用星期');
 }
 function syncDrawTarget(){const targetDate=round()?.targetDate||null,layout=isCurve(round())?'curve-five':null;if(drawState.targetDate!==targetDate||drawState.layout!==layout){closeImagePreview(false);drawState.sequence++;drawState.targetDate=targetDate;drawState.layout=layout;curveImageKey=null;preloadedImages=[];drawState.images={};drawState.requested=false;drawState.busy=false;drawState.error='';}renderDrawStatus();}
 function renderDrawStatus(){
  $('#rerollImages').disabled=!drawState.targetDate||drawState.busy;
  $('#drawStatus').textContent=!drawState.targetDate?'建立交易日後才會抽選圖片。':drawState.busy?'正在抽選 '+drawState.targetDate+' 的圖片…':drawState.error||'圖片依 '+drawState.targetDate+'（'+weekdays[new Date(drawState.targetDate+'T00:00:00Z').getUTCDay()]+'）與各區間抽選；換圖不影響投票。';
  $('#drawStatus').classList.toggle('error',!!drawState.error);
 }
 // The preview button is a sibling of the voting label, never an interactive child of it.
 function drawMarkup(option){
  const image=drawState.targetDate===round()?.targetDate?drawState.images[option.id]:null;
  return image?'<div class="choice-media" style="background:'+escape(option.color)+'"><button type="button" class="choice-image-preview" data-preview-option="'+escape(option.id)+'" aria-label="'+escape('放大'+option.name+'圖片')+'" aria-haspopup="dialog" aria-controls="imagePreviewDialog"><img loading="eager" src="'+escape(imageUrl(image))+'" alt="'+escape(option.name+'圖片')+'"><span class="image-preview-hint">'+(window.GameUI?.symbol('expand')||'')+'<span>點擊放大</span></span></button><span class="image-credit">上傳者：'+escape(image.authorName)+'</span></div>':'<div class="placeholder" style="background:'+escape(option.color)+'" aria-label="'+escape(option.name+'：無符合的已核准圖片')+'">尚無符合圖片</div>';
 }
 let imagePreviewOption=null;
 function previewTrigger(optionId){return [...$(isCurve(round())?'#curveImages':'#options').querySelectorAll('[data-preview-option]')].find(button=>button.dataset.previewOption===optionId&&(!button.getClientRects||button.getClientRects().length));}
 function closeImagePreview(restoreFocus=true){
  const dialog=$('#imagePreviewDialog'),optionId=imagePreviewOption;imagePreviewOption=null;
  if(dialog.open)dialog.close();
  $('#imagePreviewImage').removeAttribute('src');$('#imagePreviewImage').alt='';$('#imagePreviewCredit').textContent='';
  if(restoreFocus&&optionId&&!$('#daily').hidden)(previewTrigger(optionId)||(isCurve(round())&&!$('#forecastTick').disabled?$('#forecastTick'):$('#rerollImages'))).focus({preventScroll:true});
 }
 function openImagePreview(optionId){
  const image=drawState.targetDate===round()?.targetDate?drawState.images[optionId]:null;
  if(!image||$('#daily').hidden||drawState.busy)return;
  imagePreviewOption=optionId;$('#imagePreviewTitle').textContent=(isCurve(round())?(signed(curveSlots.find(slot=>slot.id===optionId)?.anchor||0)+'% 區段'):name(optionId,round()?.rules||R.CONFIG))+'圖片';
  $('#imagePreviewImage').src=imageUrl(image);$('#imagePreviewImage').alt=$('#imagePreviewTitle').textContent;
  $('#imagePreviewCredit').textContent='上傳者：'+image.authorName;
  const dialog=$('#imagePreviewDialog');if(!dialog.open)dialog.showModal();$('#closeImagePreview').focus({preventScroll:true});
 }
 async function drawImages(){
  const targetDate=drawState.targetDate;if(!targetDate)return;
  closeImagePreview(false);
  const sequence=++drawState.sequence;drawState.requested=true;drawState.busy=true;drawState.error='';renderDrawStatus();
  try{const value=await api('/api/market/images/draw',{targetDate,...(drawState.layout?{layout:drawState.layout}:{})});if(sequence!==drawState.sequence||targetDate!==drawState.targetDate)return;if(value.targetDate!==targetDate)throw Error('圖片交易日不符，請重新換圖。');drawState.images=value.images||{};if(drawState.layout==='curve-five'){preloadedImages=curveSlots.map(slot=>{const image=drawState.images[slot.id];if(!image)return null;const preload=new Image();preload.src=imageUrl(image);return preload;});}renderVote();}
  catch(error){if(sequence!==drawState.sequence||targetDate!==drawState.targetDate)return;drawState.error='圖片載入失敗：'+error.message+' 請按「換一組圖片」重試。';}
  finally{if(sequence===drawState.sequence&&targetDate===drawState.targetDate){drawState.busy=false;renderDrawStatus();}}
 }
 function renderMine(){const images=gallery.mine?.images||[];$('#myImages').innerHTML=images.length?images.map(image=>'<article class="gallery-card ui-interactive-card"><img src="'+escape(imageUrl(image))+'" alt="我的投稿預覽" loading="lazy"><div><strong>'+escape(image.authorName)+'</strong><span class="image-status">'+(image.status==='approved'?'已核准':'待核准')+'</span><p>'+escape(imageRules(image))+'</p><small>'+escape(image.width+' × '+image.height)+' · '+escape(format(image.createdAt))+'</small></div></article>').join(''):'<p class="helper">尚無投稿。選擇圖片及適用規則後送出，等待管理員核准。</p>';updateUploadControls();}
 async function loadMine(){const sequence=++gallery.mineSequence;gallery.mineBusy=true;$('#refreshMine').disabled=true;galleryMessage('#mineStatus','正在載入我的投稿…');try{const value=await api('/api/market/images/mine');if(sequence!==gallery.mineSequence)return;gallery.mine=value;rememberLimits(value);renderMine();galleryMessage('#mineStatus','共 '+value.images.length+' / '+gallery.limits.maxPerUser+' 張投稿');}catch(error){if(sequence===gallery.mineSequence)galleryMessage('#mineStatus',error.message,true);throw error;}finally{if(sequence===gallery.mineSequence){gallery.mineBusy=false;$('#refreshMine').disabled=false;}}}
 function updateUploadControls(){
  const frozen=!!gallery.uploadAttempt,busy=gallery.uploadBusy||gallery.uploadReading;
  for(const input of document.querySelectorAll('#uploadForm input,#uploadForm .weekday-actions button'))input.disabled=frozen||busy;
  const hasRules=checkedValues('#uploadBuckets').length>0&&checkedValues('#uploadWeekdays').length>0,quota=(gallery.mine?.images.length||0)>=gallery.limits.maxPerUser;
  $('#submitUpload').disabled=busy||(!frozen&&(!gallery.upload||!hasRules||quota));
  labelButton('#submitUpload',gallery.uploadBusy?'正在送出…':frozen?'重試確認同一筆投稿':'送出投稿',frozen?'refresh':'upload');
 }
 async function readUpload(file){
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('無法讀取圖片，請重新選擇。'));reader.readAsDataURL(file);});
  const dimensions=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(Error('無法解碼此圖片，請使用有效的 PNG、JPEG 或 WebP。'));img.src=dataUrl;});
  if(!dimensions.width||!dimensions.height||dimensions.width>gallery.limits.maxDimension||dimensions.height>gallery.limits.maxDimension||dimensions.width*dimensions.height>gallery.limits.maxPixels)throw Error('圖片尺寸最多 '+gallery.limits.maxDimension+' × '+gallery.limits.maxDimension+'，總像素最多 800 萬。');
  const base64=String(dataUrl).split(',')[1];if(!base64)throw Error('圖片格式無法辨識。');
  return {mime:file.type,base64,dataUrl,filename:file.name,...dimensions};
 }
 async function chooseUpload(){
  if(gallery.uploadBusy||gallery.uploadAttempt)return;
  const sequence=++gallery.uploadSequence,file=$('#uploadFile').files?.[0];gallery.upload=null;gallery.uploadReading=false;$('#uploadPreview').innerHTML='<span>選擇檔案後顯示預覽</span>';galleryMessage('#uploadStatus','');
  if(!file){updateUploadControls();return;}
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){galleryMessage('#uploadStatus','只接受 PNG、JPEG 或 WebP 圖片。',true);updateUploadControls();return;}
  if(file.size<=0||file.size>gallery.limits.maxUploadBytes){galleryMessage('#uploadStatus','圖片檔案須大於 0 且不超過 2 MiB。',true);updateUploadControls();return;}
  gallery.uploadReading=true;galleryMessage('#uploadStatus','正在檢查圖片…');updateUploadControls();
  try{const image=await readUpload(file);if(sequence!==gallery.uploadSequence)return;gallery.upload=image;$('#uploadPreview').innerHTML='<img src="'+escape(image.dataUrl)+'" alt="待投稿圖片預覽"><span>'+escape(image.filename)+' · '+image.width+' × '+image.height+'</span>';galleryMessage('#uploadStatus','請確認圖片及適用區間、星期後送出。');}
  catch(error){if(sequence===gallery.uploadSequence)galleryMessage('#uploadStatus',error.message,true);}
  finally{if(sequence===gallery.uploadSequence){gallery.uploadReading=false;updateUploadControls();}}
 }
 async function submitUpload(event){
  event.preventDefault();if(gallery.uploadBusy||gallery.uploadReading||!validForm($('#uploadForm')))return;
  if(!gallery.uploadAttempt){const buckets=checkedValues('#uploadBuckets'),weekdays=checkedValues('#uploadWeekdays').map(Number);if(!gallery.upload||!buckets.length||!weekdays.length){galleryMessage('#uploadStatus','請選擇有效圖片、至少一個區間及一天星期。',true);return;}if((gallery.mine?.images.length||0)>=gallery.limits.maxPerUser){galleryMessage('#uploadStatus','已達每人投稿數量上限。',true);return;}gallery.uploadAttempt={payload:{requestId:requestId(),mime:gallery.upload.mime,base64:gallery.upload.base64,buckets,weekdays},acknowledged:false};}
  const attempt=gallery.uploadAttempt;gallery.uploadBusy=true;updateUploadControls();galleryMessage('#uploadStatus','正在送出投稿…');
  try{if(!attempt.acknowledged){await api('/api/market/images',attempt.payload);attempt.acknowledged=true;}await loadMine();if(gallery.uploadAttempt!==attempt)return;gallery.uploadAttempt=null;gallery.upload=null;$('#uploadFile').value='';$('#uploadPreview').innerHTML='<span>選擇檔案後顯示預覽</span>';galleryMessage('#uploadStatus','投稿已送出，等待管理員核准。');}
  catch(error){if(gallery.uploadAttempt!==attempt)return;if(!unresolvedGalleryError(error)&&!attempt.acknowledged){gallery.uploadAttempt=null;galleryMessage('#uploadStatus',error.message,true);}else galleryMessage('#uploadStatus',(attempt.acknowledged?'投稿已保存，但清單更新失敗。':'投稿結果尚未確認。')+' 請按「重試確認同一筆投稿」，不會新增重複投稿。',true);}
  finally{if(gallery.uploadAttempt===attempt||!gallery.uploadAttempt){gallery.uploadBusy=false;updateUploadControls();}}
 }
 function reviewFilters(){return {buckets:checkedValues('#reviewBuckets'),weekdays:checkedValues('#reviewWeekdays').map(Number)};}
 function updateReviewControls(){const images=gallery.review?.images||[],blocked=gallery.reviewBusy||gallery.approvalBusy||!!gallery.approval;labelButton('#approveSelected','核准已勾選（'+gallery.selected.size+'）','check');$('#reviewSelectionCount').textContent='已勾選 '+gallery.selected.size+' / '+images.length+' 張';$('#approveSelected').disabled=blocked||!gallery.selected.size;labelButton('#approveFiltered','核准全部篩選結果（'+images.length+'）','users');$('#approveFiltered').disabled=blocked||!images.length;$('#refreshReview').disabled=gallery.reviewBusy;$('#resumeApproval').hidden=!gallery.approval||$('#approvalDialog').open||gallery.approvalBusy;for(const input of $('#pendingImages').querySelectorAll('input'))input.disabled=gallery.approvalBusy;}
 function renderReview(){const images=gallery.review?.images||[];gallery.selected=new Set([...gallery.selected].filter(id=>images.some(image=>image.id===id)));$('#pendingImages').innerHTML=images.length?images.map(image=>'<label class="gallery-card review-card ui-interactive-card"><input type="checkbox" value="'+escape(image.id)+'" '+(gallery.selected.has(image.id)?'checked ':'')+' aria-label="'+escape('選擇 '+image.authorName+' 的投稿')+'"><img src="'+escape(imageUrl(image))+'" alt="待核准投稿預覽" loading="lazy"><div><strong>'+escape(image.authorName)+'</strong><p>'+escape(imageRules(image))+'</p><small>'+escape(image.width+' × '+image.height)+' · '+escape(format(image.createdAt))+' · 版本 '+escape(image.version)+'</small></div></label>').join(''):'<p class="helper">沒有符合篩選的待核准圖片。</p>';updateReviewControls();}
 async function loadReview(){
  if(state?.me.role!=='admin')return;const sequence=++gallery.reviewSequence,filters=reviewFilters(),query=[filters.buckets.length?'buckets='+encodeURIComponent(filters.buckets.join(',')):'',filters.weekdays.length?'weekdays='+encodeURIComponent(filters.weekdays.join(',')):''].filter(Boolean).join('&');
  gallery.reviewBusy=true;updateReviewControls();galleryMessage('#reviewStatus','正在載入待核准圖片…');
  try{const value=await api('/api/admin/market/images'+(query?'?'+query:''));if(sequence!==gallery.reviewSequence)return;gallery.review=value;rememberLimits(value);renderReview();galleryMessage('#reviewStatus','符合篩選：'+value.images.length+' 張待核准圖片');}
  catch(error){if(sequence===gallery.reviewSequence)galleryMessage('#reviewStatus',error.message,true);throw error;}
  finally{if(sequence===gallery.reviewSequence){gallery.reviewBusy=false;updateReviewControls();}}
 }
 function showApproval(){const attempt=gallery.approval;if(!attempt||gallery.approvalBusy)return;$('#approvalSummary').textContent='本次將核准 '+attempt.images.length+' 張圖片。';$('#approvalItems').innerHTML=attempt.details.map(image=>'<div><strong>'+escape(image.authorName)+'</strong> · '+escape(imageRules(image))+'<small>圖片 '+escape(image.id)+' · 版本 '+escape(image.version)+'</small></div>').join('');$('#approvalError').textContent=attempt.error||'';labelButton('#confirmApproval',attempt.uncertain?'重試確認同一批':'確認核准 '+attempt.images.length+' 張',attempt.uncertain?'refresh':'check');$('#confirmApproval').disabled=!!attempt.invalid;$('#cancelApproval').disabled=false;if(approvalDialogBinding)approvalDialogBinding.open($(attempt.uncertain?'#resumeApproval':attempt.trigger));else $('#approvalDialog').showModal();updateReviewControls();}
 function openApproval(all){
  if(state?.me.role!=='admin'||gallery.approvalBusy||gallery.reviewBusy||gallery.approval)return;
  const details=(gallery.review?.images||[]).filter(image=>all||gallery.selected.has(image.id));if(!details.length)return;
  if(details.length>gallery.limits.maxApprovalBatch){galleryMessage('#reviewStatus','單批最多核准 '+gallery.limits.maxApprovalBatch+' 張，請縮小篩選。',true);return;}
  // Copy both IDs and versions now. Refreshes and newer uploads cannot join this batch.
  gallery.approval={token:++gallery.approvalSequence,trigger:all?'#approveFiltered':'#approveSelected',requestId:requestId(),images:details.map(image=>({id:image.id,version:image.version})),details:details.map(image=>({...image,buckets:[...image.buckets],weekdays:[...image.weekdays]})),uncertain:false,acknowledged:false,error:''};showApproval();
 }
 function closeApproval(){if(gallery.approvalBusy)return;const attempt=gallery.approval;if(!attempt?.uncertain)gallery.approval=null;$('#approvalDialog').close();updateReviewControls();const target=attempt?.uncertain?'#resumeApproval':attempt?.trigger;if(gallery.view==='admin'&&target&&!$(target).disabled)$(target).focus({preventScroll:true});}
 async function confirmApproval(){
  const attempt=gallery.approval;if(!attempt||gallery.approvalBusy||attempt.invalid||!$('#approvalDialog').open)return;
  gallery.approvalBusy=true;$('#confirmApproval').disabled=true;$('#cancelApproval').disabled=true;$('#approvalError').textContent='';updateReviewControls();
  try{if(!attempt.acknowledged){await api('/api/admin/market/images/approve',{requestId:attempt.requestId,confirmed:true,images:attempt.images});attempt.acknowledged=true;}await loadReview();if(gallery.approval!==attempt)return;gallery.approval=null;gallery.selected.clear();$('#approvalDialog').close();galleryMessage('#reviewStatus','已核准本次確認的 '+attempt.images.length+' 張圖片。');}
  catch(error){if(gallery.approval!==attempt)return;attempt.uncertain=unresolvedGalleryError(error)||attempt.acknowledged;attempt.invalid=!attempt.uncertain;attempt.error=attempt.uncertain?(attempt.acknowledged?'圖片已核准，但清單更新失敗。':'核准結果尚未確認。')+' 重試只確認同一批圖片與版本。':error.message+' 請返回清單更新後重新確認。';$('#approvalError').textContent=attempt.error;labelButton('#confirmApproval',attempt.uncertain?'重試確認同一批':'請重新確認清單',attempt.uncertain?'refresh':'check');$('#confirmApproval').disabled=attempt.invalid;}
  finally{gallery.approvalBusy=false;$('#cancelApproval').disabled=false;if(gallery.approval===attempt)$('#confirmApproval').disabled=!!attempt.invalid;updateReviewControls();}
 }
 function galleryView(view){
  const previous=gallery.view;gallery.view=view;
  if(view!=='daily')closeImagePreview(false);
  if(view!=='admin'&&$('#approvalDialog').open){$('#approvalDialog').close();if(!gallery.approvalBusy&&!gallery.approval?.uncertain)gallery.approval=null;updateReviewControls();}
  if(view==='daily'&&drawState.targetDate&&!drawState.requested)drawImages();
  if(view==='uploads'){const author=state?.me.displayName||state?.me.username||'';$('#uploadAuthor').textContent='上傳者：'+author+'（依登入帳號記錄）';if(previous!==view)loadMine().catch(()=>{});}
  if(view==='admin'&&previous!==view)loadReview().catch(()=>{});
 }
 initGallery();
 actionButton('#closeImagePreview','close','關閉圖片預覽');
 $('#curveImages').onclick=$('#options').onclick=event=>{const button=event.target.closest?.('[data-preview-option]');if(!button)return;event.preventDefault();event.stopPropagation();openImagePreview(button.dataset.previewOption);};
 $('#closeImagePreview').onclick=()=>closeImagePreview();
 $('#imagePreviewDialog').addEventListener('cancel',event=>{event.preventDefault();closeImagePreview();});
 $('#imagePreviewDialog').addEventListener('click',event=>{if(event.target!==$('#imagePreviewDialog'))return;const box=event.target.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeImagePreview();});
 window.addEventListener('pagehide',()=>closeImagePreview(false));
 $('#rerollImages').onclick=()=>{if(!drawState.busy)drawImages();};
 $('#uploadFile').onchange=chooseUpload;
 $('#uploadBuckets').onchange=$('#uploadWeekdays').onchange=updateUploadControls;
 $('#allUploadWeekdays').onclick=()=>{if(gallery.uploadBusy||gallery.uploadAttempt||gallery.uploadReading)return;for(const input of $('#uploadWeekdays').querySelectorAll('input'))input.checked=true;updateUploadControls();};
 $('#clearUploadWeekdays').onclick=()=>{if(gallery.uploadBusy||gallery.uploadAttempt||gallery.uploadReading)return;for(const input of $('#uploadWeekdays').querySelectorAll('input'))input.checked=false;updateUploadControls();};
 $('#uploadForm').onsubmit=submitUpload;
 $('#refreshMine').onclick=()=>{if(!gallery.mineBusy)return loadMine().catch(()=>{});};
 $('#refreshReview').onclick=()=>{if(!gallery.reviewBusy)return loadReview().catch(()=>{});};
 $('#reviewBuckets').onchange=$('#reviewWeekdays').onchange=()=>{gallery.review=null;gallery.selected.clear();renderReview();loadReview().catch(()=>{});};
 $('#pendingImages').onchange=event=>{if(gallery.approvalBusy||event.target.type!=='checkbox')return;if(event.target.checked)gallery.selected.add(event.target.value);else gallery.selected.delete(event.target.value);updateReviewControls();};
 $('#approveSelected').onclick=()=>openApproval(false);$('#approveFiltered').onclick=()=>openApproval(true);$('#resumeApproval').onclick=showApproval;
 $('#cancelApproval').onclick=closeApproval;$('#confirmApproval').onclick=confirmApproval;
 if(!window.GameUI?.bindDialog){$('#cancelApproval').onclick=closeApproval;$('#approvalDialog').addEventListener('cancel',event=>{if(gallery.approvalBusy)event.preventDefault();else closeApproval();});}else $('#cancelApproval').onclick=null;

 // Scenario controls have a separate form owner: Enter cannot submit a forecast.
 $('#curveScenarioForm').onsubmit=event=>event.preventDefault();
 $('#curveActualExample').onkeydown=event=>{if(event.key==='Enter')event.preventDefault();};
 $('#curveActualExample').oninput=()=>{const value=$('#curveActualExample').value,actual=Number(value);if(value===''||!Number.isFinite(actual)||!isCurve(round())||round().result)return;curveExampleActual=actual;renderVote();};
 $('#forecastTick').oninput=()=>{const r=round(),tick=Number($('#forecastTick').value);if(!isCurve(r)||!draft||busy||uncertain||votingClosed||!Number.isInteger(tick)||tick< -100||tick>100)return;draft.forecastTick=tick;renderVote();};
 // Mutation responses are never used as account or score authority; refresh from the server.
 $('#options').onchange=event=>{if(event.target.name==='optionId'&&draft){draft.optionId=event.target.value;renderVote();}};
 $('#roundSelect').onchange=()=>{followCurrentRound=false;selectDraft();syncDrawTarget();renderVote();if(drawState.targetDate)drawImages();};
 $('#goCurrentRound').onclick=()=>{if(busy||uncertain)return;const r=currentRound();if(!r)return;followCurrentRound=true;$('#roundSelect').value=r.id;selectDraft();syncDrawTarget();renderVote();if(drawState.targetDate&&!drawState.requested)drawImages();};
 $('#voteForm').onsubmit=event=>{event.preventDefault();if(!busy&&!$('#saveVote').disabled)mutate('/api/market/vote',{...draft},'預測已儲存。');};
 $('#refresh').onclick=async()=>{if(busy)return;const focused=document.activeElement?.name==='optionId'?document.activeElement.value:null;setBusy(true);try{await load();selectDraft();}catch(error){message(error.message,true);}finally{setBusy(false);if(focused){const input=[...$('#options').querySelectorAll('input')].find(x=>x.value===focused);if(input&&!input.disabled)input.focus({preventScroll:true});}}};
 sharedTabs=window.GameUI?.mountTabs?.($('#market-tabs'),{activation:'manual',onChange:view=>{if(location.hash.slice(1)!==view)location.hash=view;else setView();}});
 if(!sharedTabs)for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{location.hash=button.dataset.view;setView();};window.addEventListener('hashchange',setView);
 $('#createForm').elements.targetDate.onchange=event=>{try{$('#createDeadline').textContent=cutoffLabel({targetDate:event.target.value,cutoffAt:R.cutoffFor(event.target.value),rules:R.CONFIG});}catch{$('#createDeadline').textContent='請選擇有效日期。';}};
 $('#createForm').onsubmit=event=>{event.preventDefault();if(busy||uncertain||!validForm(event.target))return;const form=event.target;mutate('/api/admin/market/rounds',{targetDate:form.elements.targetDate.value,confirmed:form.elements.confirmed.checked},'交易日已建立。');};
 $('#calendarOverrideForm').onsubmit=event=>{event.preventDefault();if(busy||uncertain||state?.me.role!=='admin')return;const form=event.target,date=form.elements.targetDate.value,open=form.elements.isOpen.value,reason=form.elements.reason.value.trim(),sourceUrl=officialUrl(form.elements.sourceUrl.value);if(!R.validDate(date)||!['true','false'].includes(open)||!reason||!sourceUrl||!form.elements.confirmed.checked){message('請填寫有效日期、開休市狀態、修正原因及證交所官方網址，並勾選確認。',true);return;}mutate('/api/admin/market/calendar-override',{targetDate:date,isOpen:open==='true',reason,sourceUrl,confirmed:true},'官方交易日曆修正已保存。');};
 $('#adminRound').onchange=()=>{$('#settleForm').elements.returnPct.value='';$('#settleForm').elements.reason.value='';updateAdmin();};
 $('#settleForm').onsubmit=async event=>{event.preventDefault();if(busy||$('#previewButton').disabled||!validForm(event.target))return;const form=event.target,r=state.rounds.find(r=>r.id===$('#adminRound').value),payload={roundId:r.id,expectedRevision:r.result?.revision||0,returnPct:form.elements.returnPct.value,reason:form.elements.reason.value};setBusy(true);try{const result=await api('/api/admin/market/preview',payload);preview={...payload,returnPct:result.returnPct};$('#previewContent').innerHTML='<p>目標交易日：<strong>'+escape(result.targetDate)+'</strong></p><p class="big-result">'+signed(result.returnPct)+'%</p><p>'+escape(name(result.bucket,r.rules))+' · '+result.voteCount+' 人投票</p>'+(isCurve(r)?'<p>正分 '+result.counts.positive+' 人 · 負分 '+result.counts.negative+' 人 · 零分 '+result.counts.zero+' 人</p>':'<p>猜中 '+result.counts.hit+' 人 · 猜錯 '+result.counts.miss+' 人 · 和局 '+result.counts.tie+' 人</p>')+(payload.expectedRevision?'<p><strong>更正會先撤銷第 '+payload.expectedRevision+' 版積分，再以新結果重新計分。</strong></p><p>原因：'+escape(payload.reason)+'</p>':'<p>確認後將保存結果並結算所有已提交的預測。</p>')+'<p>我的本日積分：'+pointsLabel(result.ownPrevious)+' → '+pointsLabel(result.ownNext)+'；累積將為 '+pointsLabel(result.ownScoreAfter)+' 分。</p>';$('#confirmError').textContent='';if(confirmDialogBinding)confirmDialogBinding.open($('#previewButton'));else $('#confirmDialog').showModal();}catch(error){message(error.message,true);}finally{setBusy(false);}};
 const cancelSettlement=()=>{preview=null;$('#confirmDialog').close();};
 if(!window.GameUI?.bindDialog){$('#cancelConfirm').onclick=cancelSettlement;$('#confirmDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();else preview=null;});}
 else{confirmDialogBinding=window.GameUI.bindDialog($('#confirmDialog'),{canClose:()=>!busy,onRequestClose:cancelSettlement});approvalDialogBinding=window.GameUI.bindDialog($('#approvalDialog'),{canClose:()=>!gallery.approvalBusy,onRequestClose:closeApproval});}

 $('#confirmSettlement').onclick=async()=>{if(!preview||busy)return;const payload=preview;preview=null;$('#confirmDialog').close();await mutate('/api/admin/market/settle',{...payload,confirmed:true},'結算已完成，積分與異動紀錄已更新。');};
 for(const selector of ['#voteForm','#uploadForm','#createForm','#settleForm']){const binding=window.GameUI?.bindForm?.($(selector));if(binding)formBindings.push(binding);}
 for(const [selector,icon]of [['#refresh','refresh'],['#rerollImages','refresh'],['#refreshMine','refresh'],['#refreshReview','refresh'],['#allUploadWeekdays','check'],['#clearUploadWeekdays','undo'],['#previewButton','expand'],['#cancelConfirm','undo'],['#confirmSettlement','check'],['#cancelApproval','undo'],['#resumeApproval','refresh']])window.GameUI?.decorateButton?.($(selector),icon,{iconOnly:true});
 window.addEventListener('pagehide',event=>{if(!event.persisted){sharedTabs?.destroy();for(const binding of formBindings)binding.destroy();confirmDialogBinding?.destroy();approvalDialogBinding?.destroy();}});
 setInterval(()=>{if(!state)return;$('#clock').textContent=format(now());const r=round(),closed=!r||r.phase==='void'||!!r.result||now()>=Date.parse(r.cutoffAt);if(closed!==votingClosed)renderVote();else renderPrediction();updateAdmin();},1000);
 setInterval(()=>{if(!busy&&!uncertain&&document.visibilityState==='visible')load(true).catch(()=>message('更新暫時失敗，請確認連線並按「更新」。',true));},15000);
 actionButton('#refresh','refresh','更新行情與預測');actionButton('#goCurrentRound','next','返回目前預測');actionButton('#saveCalendarOverride','check','套用交易日曆修正');
 load().catch(error=>{uncertain=true;message(error.message,true);});
})();
