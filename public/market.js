(()=>{'use strict';
 const $=s=>document.querySelector(s),R=window.MarketRules,escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=value=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
 const signed=n=>n>0?'+'+n:String(n),name=(id,r)=>id==='tie'?'和局':r.options.find(o=>o.id===id)?.name||'—';
 // getRandomValues also works on BGA's HTTP LAN origin; randomUUID needs HTTPS.
 const requestId=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
 let state=null,draft=null,busy=false,uncertain=false,serverAnchor=0,localAnchor=0,preview=null,loadSequence=0,votingClosed=true;
 const now=()=>serverAnchor+performance.now()-localAnchor;
 const round=()=>state?.rounds.find(r=>r.id===$('#roundSelect').value);
 function message(s,error=false){$('#message').textContent=s;$('#message').classList.toggle('error',error);}
 async function api(path,data){const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});let value;try{value=await res.json();}catch{throw Error('伺服器回應無法辨識，請更新確認狀態');}if(!res.ok){if(res.status===401)location.href='/login?next=/market';const error=Error(value.error||'操作失敗');error.code=value.code;error.status=res.status;throw error;}return value;}
 function selectDraft(){const r=round();draft=r?{roundId:r.id,optionId:r.vote?.optionId||null,expectedRevision:r.vote?.revision||0}:null;}
 async function load(quiet=false){const sequence=++loadSequence,value=await api(state?.me.role==='admin'?'/api/admin/market':'/api/market');if(sequence!==loadSequence)return;
  if(value.me.role==='admin'&&!('voteCount' in (value.rounds[0]||{}))&&!state){const admin=await api('/api/admin/market');if(sequence!==loadSequence)return;state=admin;}else state=value;
  serverAnchor=Date.parse(state.serverNow);localAnchor=performance.now();const previous=$('#roundSelect').value;
  $('#roundSelect').innerHTML=state.rounds.slice().reverse().map(r=>'<option value="'+escape(r.id)+'">'+escape(r.targetDate)+' · '+({open:'可預測',closed:'待結算',settled:'已結算'}[r.phase])+'</option>').join('');
  const preferred=state.rounds.slice().reverse().find(r=>r.phase==='open')||state.rounds[0];$('#roundSelect').value=state.rounds.some(r=>r.id===previous)?previous:preferred?.id||'';
  if(!draft||draft.roundId!==$('#roundSelect').value)selectDraft();
  $('#score').textContent=signed(state.stats.score);$('#hits').textContent=state.stats.hits;$('#played').textContent=state.stats.played;
  $('[data-view=admin]').hidden=state.me.role!=='admin';syncDrawTarget();renderVote();renderRecords();renderAdmin();setView();uncertain=false;
  if(!quiet)message(state.rounds.length?'選一個區間，截止前可修改。':'目前尚未建立交易日，請等待管理員更新。');
 }
 function renderVote(){const focused=document.activeElement?.name==='optionId'?document.activeElement.value:null,r=round(),rules=r?.rules||state?.rules||R.CONFIG,labels=R.labels(rules),closed=!r||!!r.result||now()>=Date.parse(r.cutoffAt);votingClosed=closed;
  $('#options').innerHTML=rules.options.map((o,i)=>'<label class="choice '+(draft?.optionId===o.id?'selected ':'')+(closed?'closed':'')+'"><input type="radio" name="optionId" value="'+escape(o.id)+'" '+(draft?.optionId===o.id?'checked ':'')+(closed||busy||uncertain?'disabled':'')+' aria-label="'+escape(o.name+' '+labels[i])+'"><div class="choice-heading"><strong>'+escape(o.name)+'</strong><span>'+escape(labels[i])+'</span></div>'+drawMarkup(o)+'</label>').join('');
  if(focused){const input=[...$('#options').querySelectorAll('input')].find(x=>x.value===focused);if(input&&!input.disabled)input.focus({preventScroll:true});}
  $('#scoreRules').innerHTML='猜中 '+signed(rules.hit)+' · 猜錯 '+signed(rules.miss)+'<br>剛好 0% 為和局，皆不計分';
  $('#expectation').textContent='等機率隨機選六項時，非和局的期望積分為 (1/6 × '+rules.hit+') + (5/6 × '+rules.miss+') = '+((rules.hit+5*rules.miss)/6)+'。這不代表各區間真實發生機率相同，也不代表每個區間的真實期望值為 0。剛好 0% 的和局積分為 0。';
  $('#phase').textContent=!r?'等待開放':r.result?'已結算':closed?'已截止 · 等待結算':'預測開放中';$('#cutoff').textContent=!r?'由管理員手動建立交易日':r.rules.version===2?'前一晚 23:59 整分鐘可預測 · '+format(r.cutoffAt)+' 起截止（台北）':'沿用舊規則：前一晚 '+r.rules.cutoffTime+' 截止（台北）';
  const voteText=r?.vote?'已提交：'+name(r.vote.optionId,rules)+' · '+format(r.vote.updatedAt):'尚未投票';
  $('#voteStatus').textContent=!r?'尚未建立交易日。':r.result?'收盤 '+signed(r.result.returnPct)+'% · '+name(r.result.bucket,rules)+' · '+(r.vote?'本日 '+signed(r.result.points)+' 分':'未投票，不計分'):closed?voteText+'。投票已截止。':voteText+'。截止前可修改。';
  $('#saveVote').textContent=r?.vote?'儲存修改 ↗':'送出預測 ↗';$('#saveVote').disabled=busy||uncertain||closed||!draft?.optionId||draft.optionId===r?.vote?.optionId;
  $('#roundSelect').disabled=busy||uncertain||!state?.rounds.length;
 }
 function renderRecords(){const rows=state.rounds;$('#history').innerHTML=rows.length?rows.map(r=>'<article class="record"><div><strong>'+escape(r.targetDate)+'</strong><small>'+escape(r.result?'已結算 · 第 '+r.result.revision+' 版':r.phase==='open'?'投票中':'等待結算')+'</small></div><p>我的預測：'+escape(r.vote?name(r.vote.optionId,r.rules):'未投票')+'</p><p>'+escape(r.result?'收盤 '+signed(r.result.returnPct)+'% · '+name(r.result.bucket,r.rules):'收盤結果待更新')+'</p><div class="result-points">'+(r.result?(r.vote?signed(r.result.points):'0')+'<small>積分</small>':'—')+'</div></article>').join(''):'<p class="helper">有交易日後，預測與結果會出現在這裡。</p>';
  $('#ledger').innerHTML=state.ledger.length?state.ledger.map(l=>'<div class="ledger-row"><span>'+signed(l.points)+' 分</span><strong>'+escape(l.targetDate)+'</strong> · 第 '+l.revision+' 版 · '+(l.kind==='reversal'?'撤銷第 '+l.reverses_revision+' 版':'結算')+'<br>'+escape(format(l.at))+' · '+escape(l.reason||'首次結算')+'</div>').join(''):'<p class="helper">尚無積分異動。</p>';
 }
 function renderAdmin(){if(state.me.role!=='admin')return;const old=$('#adminRound').value;$('#adminRound').innerHTML=state.rounds.map(r=>'<option value="'+escape(r.id)+'">'+escape(r.targetDate)+' · '+(r.result?'已結算／可更正':'待結算')+'</option>').join('');if(state.rounds.some(r=>r.id===old))$('#adminRound').value=old;$('#settlementAudit').innerHTML=state.rounds.flatMap(r=>(r.settlementHistory||[]).map(s=>'<div class="ledger-row"><strong>'+escape(r.targetDate)+'</strong> · 第 '+s.revision+' 版 · '+signed(s.returnPct)+'%<br>'+escape(format(s.at))+' · '+escape(s.administrator)+' · '+escape(s.reason||'首次結算')+'</div>')).join('')||'<p class="helper">尚無結算紀錄。</p>';updateAdmin();}
 function updateAdmin(){const r=state?.rounds.find(r=>r.id===$('#adminRound').value);$('#settleStatus').textContent=!r?'先建立交易日。':(r.result?'目前收盤 '+signed(r.result.returnPct)+'% · 第 '+r.result.revision+' 版。更正必填原因。':'參與 '+r.voteCount+' 人。')+' 可結算時間：'+format(r.settlementAfter)+'（台北）';$('#previewButton').disabled=busy||uncertain||!r||now()<Date.parse(r.settlementAfter);}
 function setView(){let view=location.hash.slice(1);if(!['daily','uploads','records','admin'].includes(view)||view==='admin'&&state?.me.role!=='admin')view='daily';for(const section of ['daily','uploads','records','admin'])$('#'+section).hidden=view!==section;$('#adminAudit').hidden=view!=='admin'||state?.me.role!=='admin';for(const button of document.querySelectorAll('[data-view]'))button.setAttribute('aria-selected',String(button.dataset.view===view));galleryView(view);}
 function setBusy(value){busy=value;$('#refresh').disabled=value;for(const element of document.querySelectorAll('#createForm input,#createForm button,#settleForm input,#settleForm select,#settleForm button,#confirmSettlement,#cancelConfirm'))element.disabled=value||uncertain;renderVote();updateAdmin();}
 async function mutate(path,payload,success){setBusy(true);try{await api(path,{...payload,requestId:requestId()});await load(true);selectDraft();renderVote();message(success);}
  catch(error){message(error.message,true);try{await load(true);const r=round();if(error.code==='STALE_VOTE'&&r?.id===payload.roundId){draft={roundId:r.id,optionId:payload.optionId,expectedRevision:r.vote?.revision||0};renderVote();message(votingClosed?'投票已在另一個頁面更新，目前已截止。':'投票已在另一個頁面更新。已同步最新版本並保留您的選擇，請核對後再提交。',true);}}catch{uncertain=true;message('操作結果未確認。請按「更新」取得伺服器狀態後再操作。',true);}}
  finally{setBusy(false);}}
 // Gallery state is independent of votes, score refreshes and settlement requests.
 const weekdays=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
 const defaultLimits={maxUploadBytes:2097152,maxImageBytes:4194304,maxDimension:4096,maxPixels:8000000,maxPerUser:100,maxImages:1000,maxStorageBytes:268435456,maxApprovalBatch:1000};
 const gallery={view:null,limits:{...defaultLimits},mine:null,mineBusy:false,mineSequence:0,review:null,reviewBusy:false,reviewSequence:0,selected:new Set(),upload:null,uploadSequence:0,uploadReading:false,uploadBusy:false,uploadAttempt:null,approval:null,approvalBusy:false,approvalSequence:0};
 const drawState={targetDate:null,images:{},sequence:0,requested:false,busy:false,error:''};
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
 function syncDrawTarget(){const targetDate=round()?.targetDate||null;if(drawState.targetDate!==targetDate){drawState.sequence++;drawState.targetDate=targetDate;drawState.images={};drawState.requested=false;drawState.busy=false;drawState.error='';}renderDrawStatus();}
 function renderDrawStatus(){
  $('#rerollImages').disabled=!drawState.targetDate||drawState.busy;
  $('#drawStatus').textContent=!drawState.targetDate?'建立交易日後才會抽選圖片。':drawState.busy?'正在抽選 '+drawState.targetDate+' 的圖片…':drawState.error||'圖片依 '+drawState.targetDate+'（'+weekdays[new Date(drawState.targetDate+'T00:00:00Z').getUTCDay()]+'）與各區間抽選；換圖不影響投票。';
  $('#drawStatus').classList.toggle('error',!!drawState.error);
 }
 function drawMarkup(option){const image=drawState.targetDate===round()?.targetDate?drawState.images[option.id]:null;return image?'<div class="placeholder choice-media" style="background:'+escape(option.color)+'"><img src="'+escape(imageUrl(image))+'" alt="'+escape(option.name+'圖片')+'"><span class="image-credit">上傳者：'+escape(image.authorName)+'</span></div>':'<div class="placeholder" style="background:'+escape(option.color)+'" aria-label="'+escape(option.name+'：無符合的已核准圖片')+'">尚無符合圖片</div>';}
 async function drawImages(){
  const targetDate=drawState.targetDate;if(!targetDate)return;
  const sequence=++drawState.sequence;drawState.requested=true;drawState.busy=true;drawState.error='';renderDrawStatus();
  try{const value=await api('/api/market/images/draw',{targetDate});if(sequence!==drawState.sequence||targetDate!==drawState.targetDate)return;if(value.targetDate!==targetDate)throw Error('圖片交易日不符，請重新換圖。');drawState.images=value.images||{};renderVote();}
  catch(error){if(sequence!==drawState.sequence||targetDate!==drawState.targetDate)return;drawState.error='圖片載入失敗：'+error.message+' 請按「換一組圖片」重試。';}
  finally{if(sequence===drawState.sequence&&targetDate===drawState.targetDate){drawState.busy=false;renderDrawStatus();}}
 }
 function renderMine(){const images=gallery.mine?.images||[];$('#myImages').innerHTML=images.length?images.map(image=>'<article class="gallery-card"><img src="'+escape(imageUrl(image))+'" alt="我的投稿預覽" loading="lazy"><div><strong>'+escape(image.authorName)+'</strong><span class="image-status">'+(image.status==='approved'?'已核准':'待核准')+'</span><p>'+escape(imageRules(image))+'</p><small>'+escape(image.width+' × '+image.height)+' · '+escape(format(image.createdAt))+'</small></div></article>').join(''):'<p class="helper">尚無投稿。選擇圖片及適用規則後送出，等待管理員核准。</p>';updateUploadControls();}
 async function loadMine(){const sequence=++gallery.mineSequence;gallery.mineBusy=true;$('#refreshMine').disabled=true;galleryMessage('#mineStatus','正在載入我的投稿…');try{const value=await api('/api/market/images/mine');if(sequence!==gallery.mineSequence)return;gallery.mine=value;rememberLimits(value);renderMine();galleryMessage('#mineStatus','共 '+value.images.length+' / '+gallery.limits.maxPerUser+' 張投稿');}catch(error){if(sequence===gallery.mineSequence)galleryMessage('#mineStatus',error.message,true);throw error;}finally{if(sequence===gallery.mineSequence){gallery.mineBusy=false;$('#refreshMine').disabled=false;}}}
 function updateUploadControls(){
  const frozen=!!gallery.uploadAttempt,busy=gallery.uploadBusy||gallery.uploadReading;
  for(const input of document.querySelectorAll('#uploadForm input,#uploadForm .weekday-actions button'))input.disabled=frozen||busy;
  const hasRules=checkedValues('#uploadBuckets').length>0&&checkedValues('#uploadWeekdays').length>0,quota=(gallery.mine?.images.length||0)>=gallery.limits.maxPerUser;
  $('#submitUpload').disabled=busy||(!frozen&&(!gallery.upload||!hasRules||quota));
  $('#submitUpload').textContent=gallery.uploadBusy?'正在送出…':frozen?'重試確認同一筆投稿':'送出投稿';
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
  event.preventDefault();if(gallery.uploadBusy||gallery.uploadReading)return;
  if(!gallery.uploadAttempt){const buckets=checkedValues('#uploadBuckets'),weekdays=checkedValues('#uploadWeekdays').map(Number);if(!gallery.upload||!buckets.length||!weekdays.length){galleryMessage('#uploadStatus','請選擇有效圖片、至少一個區間及一天星期。',true);return;}if((gallery.mine?.images.length||0)>=gallery.limits.maxPerUser){galleryMessage('#uploadStatus','已達每人投稿數量上限。',true);return;}gallery.uploadAttempt={payload:{requestId:requestId(),mime:gallery.upload.mime,base64:gallery.upload.base64,buckets,weekdays},acknowledged:false};}
  const attempt=gallery.uploadAttempt;gallery.uploadBusy=true;updateUploadControls();galleryMessage('#uploadStatus','正在送出投稿…');
  try{if(!attempt.acknowledged){await api('/api/market/images',attempt.payload);attempt.acknowledged=true;}await loadMine();if(gallery.uploadAttempt!==attempt)return;gallery.uploadAttempt=null;gallery.upload=null;$('#uploadFile').value='';$('#uploadPreview').innerHTML='<span>選擇檔案後顯示預覽</span>';galleryMessage('#uploadStatus','投稿已送出，等待管理員核准。');}
  catch(error){if(gallery.uploadAttempt!==attempt)return;if(!unresolvedGalleryError(error)&&!attempt.acknowledged){gallery.uploadAttempt=null;galleryMessage('#uploadStatus',error.message,true);}else galleryMessage('#uploadStatus',(attempt.acknowledged?'投稿已保存，但清單更新失敗。':'投稿結果尚未確認。')+' 請按「重試確認同一筆投稿」，不會新增重複投稿。',true);}
  finally{if(gallery.uploadAttempt===attempt||!gallery.uploadAttempt){gallery.uploadBusy=false;updateUploadControls();}}
 }
 function reviewFilters(){return {buckets:checkedValues('#reviewBuckets'),weekdays:checkedValues('#reviewWeekdays').map(Number)};}
 function updateReviewControls(){const images=gallery.review?.images||[],blocked=gallery.reviewBusy||gallery.approvalBusy||!!gallery.approval;$('#approveSelected').textContent='核准已勾選（'+gallery.selected.size+'）';$('#approveSelected').disabled=blocked||!gallery.selected.size;$('#approveFiltered').textContent='核准全部篩選結果（'+images.length+'）';$('#approveFiltered').disabled=blocked||!images.length;$('#refreshReview').disabled=gallery.reviewBusy;$('#resumeApproval').hidden=!gallery.approval||$('#approvalDialog').open||gallery.approvalBusy;for(const input of $('#pendingImages').querySelectorAll('input'))input.disabled=gallery.approvalBusy;}
 function renderReview(){const images=gallery.review?.images||[];gallery.selected=new Set([...gallery.selected].filter(id=>images.some(image=>image.id===id)));$('#pendingImages').innerHTML=images.length?images.map(image=>'<label class="gallery-card review-card"><input type="checkbox" value="'+escape(image.id)+'" '+(gallery.selected.has(image.id)?'checked ':'')+' aria-label="'+escape('選擇 '+image.authorName+' 的投稿')+'"><img src="'+escape(imageUrl(image))+'" alt="待核准投稿預覽" loading="lazy"><div><strong>'+escape(image.authorName)+'</strong><p>'+escape(imageRules(image))+'</p><small>'+escape(image.width+' × '+image.height)+' · '+escape(format(image.createdAt))+' · 版本 '+escape(image.version)+'</small></div></label>').join(''):'<p class="helper">沒有符合篩選的待核准圖片。</p>';updateReviewControls();}
 async function loadReview(){
  if(state?.me.role!=='admin')return;const sequence=++gallery.reviewSequence,filters=reviewFilters(),query=[filters.buckets.length?'buckets='+encodeURIComponent(filters.buckets.join(',')):'',filters.weekdays.length?'weekdays='+encodeURIComponent(filters.weekdays.join(',')):''].filter(Boolean).join('&');
  gallery.reviewBusy=true;updateReviewControls();galleryMessage('#reviewStatus','正在載入待核准圖片…');
  try{const value=await api('/api/admin/market/images'+(query?'?'+query:''));if(sequence!==gallery.reviewSequence)return;gallery.review=value;rememberLimits(value);renderReview();galleryMessage('#reviewStatus','符合篩選：'+value.images.length+' 張待核准圖片');}
  catch(error){if(sequence===gallery.reviewSequence)galleryMessage('#reviewStatus',error.message,true);throw error;}
  finally{if(sequence===gallery.reviewSequence){gallery.reviewBusy=false;updateReviewControls();}}
 }
 function showApproval(){const attempt=gallery.approval;if(!attempt||gallery.approvalBusy)return;$('#approvalSummary').textContent='本次將核准 '+attempt.images.length+' 張圖片。';$('#approvalItems').innerHTML=attempt.details.map(image=>'<div><strong>'+escape(image.authorName)+'</strong> · '+escape(imageRules(image))+'<small>圖片 '+escape(image.id)+' · 版本 '+escape(image.version)+'</small></div>').join('');$('#approvalError').textContent=attempt.error||'';$('#confirmApproval').textContent=attempt.uncertain?'重試確認同一批':'確認核准 '+attempt.images.length+' 張';$('#confirmApproval').disabled=!!attempt.invalid;$('#cancelApproval').disabled=false;$('#approvalDialog').showModal();updateReviewControls();}
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
  catch(error){if(gallery.approval!==attempt)return;attempt.uncertain=unresolvedGalleryError(error)||attempt.acknowledged;attempt.invalid=!attempt.uncertain;attempt.error=attempt.uncertain?(attempt.acknowledged?'圖片已核准，但清單更新失敗。':'核准結果尚未確認。')+' 重試只確認同一批圖片與版本。':error.message+' 請返回清單更新後重新確認。';$('#approvalError').textContent=attempt.error;$('#confirmApproval').textContent=attempt.uncertain?'重試確認同一批':'請重新確認清單';$('#confirmApproval').disabled=attempt.invalid;}
  finally{gallery.approvalBusy=false;$('#cancelApproval').disabled=false;if(gallery.approval===attempt)$('#confirmApproval').disabled=!!attempt.invalid;updateReviewControls();}
 }
 function galleryView(view){
  const previous=gallery.view;gallery.view=view;
  if(view!=='admin'&&$('#approvalDialog').open){$('#approvalDialog').close();if(!gallery.approvalBusy&&!gallery.approval?.uncertain)gallery.approval=null;updateReviewControls();}
  if(view==='daily'&&drawState.targetDate&&!drawState.requested)drawImages();
  if(view==='uploads'){const author=state?.me.displayName||state?.me.username||'';$('#uploadAuthor').textContent='上傳者：'+author+'（依登入帳號記錄）';if(previous!==view)loadMine().catch(()=>{});}
  if(view==='admin'&&previous!==view)loadReview().catch(()=>{});
 }
 initGallery();
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
 $('#approvalDialog').addEventListener('cancel',event=>{if(gallery.approvalBusy)event.preventDefault();else closeApproval();});

 // Mutation responses are never used as account or score authority; refresh from the server.
 $('#options').onchange=event=>{if(event.target.name==='optionId'&&draft){draft.optionId=event.target.value;renderVote();}};
 $('#roundSelect').onchange=()=>{selectDraft();syncDrawTarget();renderVote();if(drawState.targetDate)drawImages();};
 $('#voteForm').onsubmit=event=>{event.preventDefault();if(!busy&&!$('#saveVote').disabled)mutate('/api/market/vote',{...draft},'預測已儲存。');};
 $('#refresh').onclick=async()=>{if(busy)return;const focused=document.activeElement?.name==='optionId'?document.activeElement.value:null;setBusy(true);try{await load();selectDraft();}catch(error){message(error.message,true);}finally{setBusy(false);if(focused){const input=[...$('#options').querySelectorAll('input')].find(x=>x.value===focused);if(input&&!input.disabled)input.focus({preventScroll:true});}}};
 for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{location.hash=button.dataset.view;setView();};window.addEventListener('hashchange',setView);
 $('#createForm').elements.targetDate.onchange=event=>{try{$('#createDeadline').textContent='前一晚 23:59 整分鐘仍可預測；'+format(R.cutoffFor(event.target.value))+' 起截止（台北）。';}catch{$('#createDeadline').textContent='請選擇有效日期。';}};
 $('#createForm').onsubmit=event=>{event.preventDefault();if(busy||uncertain)return;const form=event.target;mutate('/api/admin/market/rounds',{targetDate:form.elements.targetDate.value,confirmed:form.elements.confirmed.checked},'交易日已建立。');};
 $('#adminRound').onchange=()=>{$('#settleForm').elements.returnPct.value='';$('#settleForm').elements.reason.value='';updateAdmin();};
 $('#settleForm').onsubmit=async event=>{event.preventDefault();if(busy||$('#previewButton').disabled)return;const form=event.target,r=state.rounds.find(r=>r.id===$('#adminRound').value),payload={roundId:r.id,expectedRevision:r.result?.revision||0,returnPct:form.elements.returnPct.value,reason:form.elements.reason.value};setBusy(true);try{const result=await api('/api/admin/market/preview',payload);preview={...payload,returnPct:result.returnPct};$('#previewContent').innerHTML='<p>目標交易日：<strong>'+escape(result.targetDate)+'</strong></p><p class="big-result">'+signed(result.returnPct)+'%</p><p>'+escape(name(result.bucket,r.rules))+' · '+result.voteCount+' 人投票</p><p>猜中 '+result.counts.hit+' 人 · 猜錯 '+result.counts.miss+' 人 · 和局 '+result.counts.tie+' 人</p>'+(payload.expectedRevision?'<p><strong>更正會先撤銷第 '+payload.expectedRevision+' 版積分，再以新結果重新計分。</strong></p><p>原因：'+escape(payload.reason)+'</p>':'<p>確認後將保存結果並結算所有已提交的預測。</p>')+'<p>我的本日積分：'+signed(result.ownPrevious)+' → '+signed(result.ownNext)+'；累積將為 '+signed(result.ownScoreAfter)+' 分。</p>';$('#confirmError').textContent='';$('#confirmDialog').showModal();}catch(error){message(error.message,true);}finally{setBusy(false);}};
 $('#cancelConfirm').onclick=()=>{preview=null;$('#confirmDialog').close();};$('#confirmDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();else preview=null;});
 $('#confirmSettlement').onclick=async()=>{if(!preview||busy)return;const payload=preview;preview=null;$('#confirmDialog').close();await mutate('/api/admin/market/settle',{...payload,confirmed:true},'結算已完成，積分與異動紀錄已更新。');};
 setInterval(()=>{if(!state)return;$('#clock').textContent=format(now());const r=round(),closed=!r||!!r.result||now()>=Date.parse(r.cutoffAt);if(closed!==votingClosed)renderVote();updateAdmin();},1000);
 setInterval(()=>{if(!busy&&!uncertain&&document.visibilityState==='visible')load(true).catch(()=>message('更新暫時失敗，請確認連線並按「更新」。',true));},15000);
 load().catch(error=>{uncertain=true;message(error.message,true);});
})();
