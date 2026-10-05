(() => {
 'use strict';
 const $ = id => document.getElementById(id), token = document.querySelector('meta[name="transfer-token"]').content;
 const names = { keygen:'建立備份金鑰', inspect:'盤點來源資料', export:'匯出加密備份', verify:'驗證本機備份', restore:'預演還原' };
 const help = { keygen:'在來源站建立新的二進位金鑰，並與備份包分開保管。遺失金鑰就無法恢復資料。', inspect:'停止所有來源 writer 後，盤點帳戶、素材、題庫、音樂與歷史。', export:'停止來源服務及所有 writer 後，匯出完整加密備份，再到目標站使用上方匯入流程。', verify:'也可展開下方本機路徑，驗證已放在管理工具主機上的備份。', restore:'備份已驗證。預演會檢查還原與資料升級，成功後才能建立全新資料目錄。' };
 const errors = {
  DATA_IN_USE:'資料仍在使用中，請先停止所有 writer。', SOURCE_NOT_STOPPED:'請確認來源已停寫。', PRECONDITION_REQUIRED:'請勾選並確認停寫條件。',
  DESTINATION_EXISTS:'目標已存在，請選尚不存在的全新目錄。', PARTIAL_RESTORE:'新資料目錄發布不完整，已被鎖住。繼續使用舊資料，調查後以新目錄重試。',
  RESTORE_IN_PROGRESS:'這份資料目錄尚未完成，請不要刪除 marker 強行啟動。', AUTHENTICATION_FAILED:'金鑰不符或備份包被修改，請重新確認備份與金鑰。',
  ASSET_VERSION_MISMATCH:'內建素材版本不同，請使用相容的程式與素材。', UNFINISHED_MATCHES:'有未完成對局，請完成對局或明確接受還原時中斷。',
  BUSY:'另一個工作仍在執行，請等待結果。', INVALID_KEY:'金鑰必須是來源站產生的 32-byte 二進位檔案。', CORRUPT_BUNDLE:'備份缺檔或內容損壞，請重新取得完整備份。',
  UPLOAD_LIMIT:'上傳超過工具的容量或批次限制，請清理暫存後重試。', UPLOAD_NOT_FOUND:'這批上傳已不存在，請重新選擇備份。', BUNDLE_CHANGED:'備份身分已改變，請重新驗證與預演；尚未建立新資料目錄。'
 };
 let busy = false, localSubmitting = false, stateEpoch = 0, lastResponse = null, polling;
 let verifiedSignature = '', verifiedBundleId = '', rehearsedSignature = '', createdSignature = '', currentUpload = null, localBundle = null, pendingUploadId = null, savedUploads = [], recoveryNotice = null;

 // Keep the upload contract together; no file contents or keys enter browser storage.
 async function uploadRequest(url, method, body, headers = {}) {
  const response = await fetch(url, { method, headers:{'X-Transfer-Token':token,...headers}, body });
  const payload = await response.json();
  if (!payload || typeof payload.ok !== 'boolean' || (payload.ok ? !payload.result : !payload.error?.code)) throw Error('無法確認伺服器回應，請先查詢狀態。');
  if (!payload.ok) { const error = Error(payload.error.message); error.code = payload.error.code; throw error; }
  return payload.result;
 }
 const uploadApi = {
  start:() => uploadRequest('/api/import-upload/start','POST','{}',{'Content-Type':'application/json'}),
  file:(id,path,file) => uploadRequest('/api/import-upload/'+encodeURIComponent(id)+'/file','PUT',file,{'Content-Type':'application/octet-stream','X-Import-Path':path}),
  key:(id,file) => uploadRequest('/api/import-upload/'+encodeURIComponent(id)+'/key','PUT',file,{'Content-Type':'application/octet-stream'}),
  finish:id => uploadRequest('/api/import-upload/'+encodeURIComponent(id)+'/finish','POST','{}',{'Content-Type':'application/json'}),
  remove:async id => {
   try { return await uploadRequest('/api/import-upload/'+encodeURIComponent(id),'DELETE'); }
   catch (error) { if (error.code === 'UPLOAD_NOT_FOUND') return {deleted:true}; throw error; }
  }
 };
 function bundleSignature() { return JSON.stringify([$('bundleDir').value.trim(),$('keyFile').value.trim(),$('maxBytes').value]); }
 function restoreSignature() { return JSON.stringify([bundleSignature(),verifiedBundleId,$('destinationDir').value.trim(),$('acknowledgeInterruptedMatches').checked]); }
 function verified() { return Boolean(verifiedBundleId && verifiedSignature && verifiedSignature === bundleSignature()); }
 function rehearsed() { return verified() && rehearsedSignature === restoreSignature(); }
 function created() { return Boolean(createdSignature && createdSignature === restoreSignature()); }
 function mode(value) { $('dryMode').checked = value === 'dry'; $('applyMode').checked = value === 'apply'; }
 function request() {
  const action = $('action').value, r = { action };
  if (action !== 'inspect') r.keyFile = $('keyFile').value.trim();
  if (['inspect','export'].includes(action)) {
   r.sourceStopped = $('sourceStopped').checked;
   r.source = { dbFile:$('dbFile').value.trim(), historyDir:$('historyDir').value.trim(), communityDir:$('communityDir').value.trim() };
   if ($('musicDir').value.trim()) r.source.musicDir = $('musicDir').value.trim();
   if (action === 'export') { r.source.envId = $('envId').value.trim(); r.outputDir = $('outputDir').value.trim(); }
  }
  if (['verify','restore'].includes(action)) r.bundleDir = $('bundleDir').value.trim();
  if (action === 'verify' && $('tempDir').value.trim()) r.tempDir = $('tempDir').value.trim();
  if (action === 'restore') { r.destinationDir = $('destinationDir').value.trim(); r.apply = $('applyMode').checked; if (verifiedBundleId) r.expectedBundleId = verifiedBundleId; }
  if (action !== 'keygen' && $('maxBytes').value) r.maxBytes = Number($('maxBytes').value);
  if (['inspect','export','restore'].includes(action) && $('acknowledgeInterruptedMatches').checked) r.acknowledgeInterruptedMatches = true;
  if (action === 'export' && $('forceVacuum').checked) r.forceVacuum = true;
  return r;
 }
 function formatBytes(bytes) {
  if (bytes < 1024) return bytes+' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+' KiB';
  if (bytes < 1024*1024*1024) return (bytes/1024/1024).toFixed(1)+' MiB';
  return (bytes/1024/1024/1024).toFixed(2)+' GiB';
 }
 function selection() {
  const files = Array.from($('bundlePicker').files || []), keys = Array.from($('keyPicker').files || []);
  $('bundleSelection').textContent = files.length ? (files[0].webkitRelativePath || files[0].name).split('/')[0]+' · '+files.length+' 個檔案 · '+formatBytes(files.reduce((n,f)=>n+f.size,0)) : '尚未選擇 · 內含 manifest.json 與 payload/';
  $('keySelection').textContent = keys.length ? keys[0].name+' · '+keys[0].size+' bytes'+(keys.length !== 1 || keys[0].size !== 32 ? '（請選擇 32-byte 金鑰）' : '') : '尚未選擇 · 必須為 32 bytes';
  $('uploadButton').disabled = busy || localSubmitting || !files.length || keys.length !== 1 || keys[0].size !== 32;
 }
 function update() {
  const action = $('action').value, source = ['inspect','export'].includes(action), restore = action === 'restore', importing = ['verify','restore'].includes(action);
  const groups = { keyFields:action !== 'inspect', sourceFields:source, outputFields:action === 'export', bundleFields:importing, restoreFields:restore };
  for (const [id, visible] of Object.entries(groups)) { $(id).hidden = !visible; for (const field of $(id).querySelectorAll('input')) field.disabled = !visible; }
  for (const id of ['keyFile','dbFile','historyDir','communityDir','outputDir','bundleDir','destinationDir']) $(id).required = !$(id).closest('.group').hidden;
  $('envId').required = action === 'export'; $('sourceStopped').required = source;
  const apply = restore && $('applyMode').checked;
  $('applyMode').disabled = !restore || !rehearsed() || created();
  $('targetRequirement').hidden = !apply; $('targetStopped').required = apply; $('targetStopped').disabled = !apply;
  $('advanced').hidden = action === 'keygen'; $('acknowledgeLabel').hidden = !['inspect','export','restore'].includes(action); $('vacuumLabel').hidden = action !== 'export';
  $('maxBytes').disabled = action === 'keygen'; $('acknowledgeInterruptedMatches').disabled = $('acknowledgeLabel').hidden; $('forceVacuum').disabled = $('vacuumLabel').hidden;
  $('tempFields').hidden = action !== 'verify'; $('tempDir').disabled = action !== 'verify';
  $('importGuide').hidden = !importing; $('localPaths').hidden = action === 'inspect';
  $('localPathsHeading').textContent = importing ? (currentUpload ? '已上傳備份的本機暫存路徑／重新驗證' : localBundle ? '目前使用的本機備份／重新驗證' : '備份已在管理工具主機？使用本機完整路徑') : '金鑰在來源站的完整路徑';
  $('actionHelp').textContent = help[action];
  $('runButton').textContent = created() && restore ? '資料目錄已建立' : apply ? '建立新資料目錄' : names[action];
  $('runButton').hidden = action === 'verify' && !$('bundleDir').value.trim() && !$('keyFile').value.trim() && !$('localPaths').open;
  $('runButton').disabled = busy || localSubmitting || (restore && (!verified() || (apply && !rehearsed()) || created()));
  $('restoreGate').textContent = created() ? '資料目錄已建立。請依右側設定隔離驗收，再由部署流程切換服務。' : rehearsed() ? '同一組備份與目標已預演成功；勾選停寫確認後可建立新資料目錄。' : '先成功驗證備份，再預演同一組目錄；預演成功後才能建立資料。';
  $('stepVerify').dataset.state = verified() || created() ? 'done' : 'current';
  $('stepRehearse').dataset.state = created() || rehearsed() ? 'done' : verified() ? 'current' : 'pending';
  $('stepCreate').dataset.state = created() ? 'done' : rehearsed() ? 'current' : 'pending';
  for (const id of ['stepVerify','stepRehearse','stepCreate']) $(id).setAttribute('aria-current',$(id).dataset.state === 'current' ? 'step' : 'false');
  $('uploadSelection').hidden = Boolean(currentUpload || localBundle);
  $('uploadedBundle').hidden = !currentUpload && !localBundle;
  $('selectedBundleHeading').textContent = currentUpload ? '備份已上傳並驗證' : '使用管理工具主機上的已驗證備份';
  $('clearUpload').textContent = currentUpload ? '清除暫存／重選' : '選擇其他備份';
  if (localBundle) $('uploadedDescription').textContent = localBundle.bundleDir+' · 備份 '+localBundle.bundleId;
  $('cleanupUpload').hidden = !pendingUploadId || savedUploads.some(item=>item.uploadId === pendingUploadId);
  $('requestPreview').textContent = JSON.stringify(request(),null,2);
  selection();
 }
 function status(message, kind) { $('status').textContent = message; $('status').dataset.kind = kind; }
 function setBusy(value) {
  busy = value; $('controls').disabled = value || localSubmitting; update();
  if (value || localSubmitting) status('正在執行，請等待完整結果。重新整理後會查詢目前工作，不會自動重送。','busy');
 }
 function startLocal() { localSubmitting = true; stateEpoch++; clearTimeout(polling); recoveryNotice = null; setBusy(true); }
 function finishLocal() { localSubmitting = false; stateEpoch++; setBusy(false); }
 function inventory(data, label) {
  const counts = data?.database?.tableCounts;
  const items = [['帳戶',counts?.users],['作品',counts ? counts.user_artworks || 0 : null],['題庫題目',counts ? (counts.draw_words || 0)+(data.communityQuestions || 0) : null],['音樂檔案',counts ? data.musicFiles || 0 : null],['歷史對局',counts ? data.historyMatches || 0 : null]];
  $('resultSummary').replaceChildren();
  for (const [name,value] of items) { const box=document.createElement('div'), number=document.createElement('strong'), caption=document.createElement('span'); number.textContent=value == null ? '—' : String(value); caption.textContent=name; box.append(number,caption); $('resultSummary').append(box); }
  $('inventoryLabel').textContent = label || '驗證後顯示資料數量';
  $('inventoryDetail').textContent = counts ? '題庫：畫猜 '+(counts.draw_words || 0)+' ＋ 共編 '+(data.communityQuestions || 0)+'；自訂角色 '+(counts.player_characters || 0)+'、禮物 '+(counts.community_gifts || 0)+'。' : '';
 }
 function result(response) {
  if (!response || typeof response.ok !== 'boolean' || (response.ok ? !response.result : !response.error?.code)) throw Error('Invalid operation response');
  lastResponse = response; $('copyResult').disabled = false; $('resultDetails').hidden = false; $('resultDetails').open = false; $('resultOutput').textContent = JSON.stringify(response,null,2);
  $('configPanel').hidden = true; $('nextStepsPanel').hidden = true; $('bootConfig').replaceChildren(); $('nextSteps').replaceChildren();
  if (!response.ok) { status(errors[response.error.code] || '操作失敗（'+response.error.code+'）：'+response.error.message,'error'); return; }
  const r = response.result, label = r.action === 'restore' ? (r.dryRun ? '預演完成，新目錄尚未建立。確認後可建立資料。' : '新資料目錄已建立；尚未切換本站，請依設定隔離驗收。') : names[r.action]+'完成。';
  status(label,'success');
  const data = r.restoredSummary || r.summary || r;
  if (data.database?.tableCounts) inventory(data,(r.origin?.envId ? '來源 '+r.origin.envId+' · ' : '')+(r.action === 'inspect' ? '來源盤點數量' : r.action === 'restore' && !r.dryRun ? '新資料目錄數量' : '已驗證資料數量'));
  if (r.action === 'restore' && r.config) {
   $('configPanel').hidden = false; $('nextStepsPanel').hidden = false; $('configHeading').textContent = r.dryRun ? '預計設定（預演，先勿啟動）' : '新資料目錄設定';
   for (const [key,value] of Object.entries(r.config)) { const label=document.createElement('dt'),field=document.createElement('dd'); label.textContent=key==='EXTERNAL_SIDE_EFFECTS_ENABLED'?'外部投稿':key; field.textContent=key==='EXTERNAL_SIDE_EFFECTS_ENABLED'?'停用（false）':value; $('bootConfig').append(label,field); }
   const steps = r.dryRun ? ['確認資料數量與目標路徑，再建立新資料目錄。'] : ['以回傳設定與獨立 port 隔離啟動，驗原密碼登入、權限與素材。','先核對 HISTORY_* 保留政策；啟動後舊歷史可能依保留期或容量淘汰。','保留舊程式與資料，停止舊 writer，再由部署流程切換服務。','查核待確認投稿後，再決定是否啟用外部投稿。'];
   if (r.changes) steps.unshift((r.dryRun?'預計撤銷 ':'已撤銷 ')+Object.values(r.changes.revoked || {}).reduce((a,b)=>a+b,0)+' 筆舊認證；'+(r.changes.heldSubmissions || 0)+' 筆投稿待查核。');
   for (const text of steps) { const item=document.createElement('li'); item.textContent=text; $('nextSteps').append(item); }
  }
 }
 function resetEvidence(clearInventory = false) {
  verifiedSignature = ''; verifiedBundleId = ''; rehearsedSignature = ''; createdSignature = ''; localBundle = null; $('targetStopped').checked = false; mode('dry');
  if (clearInventory) { inventory(null); $('configPanel').hidden = true; $('nextStepsPanel').hidden = true; }
 }
 function acceptVerification(value) {
  if (!value || typeof value.bundleDir !== 'string' || typeof value.keyFile !== 'string' || value.verification?.action !== 'verify' || typeof value.verification.bundleId !== 'string' || !value.verification.bundleId) throw Error('上傳驗證結果不完整，請重新查詢狀態。');
  $('bundleDir').value = value.bundleDir; $('keyFile').value = value.keyFile;
  resetEvidence(); verifiedSignature = bundleSignature(); verifiedBundleId = value.verification.bundleId; currentUpload = value; pendingUploadId = null;
  $('action').value = 'restore'; $('localPaths').open = false;
  $('uploadedDescription').textContent = value.files+' 個備份檔案 · '+formatBytes(value.bytes)+' · 暫存於管理工具主機';
  $('bundlePicker').value = ''; $('keyPicker').value = '';
  $('uploadProgressPanel').hidden = true;
  result({ok:true,result:value.verification}); status('備份已上傳並驗證。請填管理工具主機上的全新資料目錄，進行預演。','success');
  renderUploads(savedUploads); update();
 }
 function renderUploads(items) {
  savedUploads = Array.isArray(items) ? items : [];
  $('savedUploads').replaceChildren();
  const listed = savedUploads.filter(item=>item.uploadId !== currentUpload?.uploadId);
  $('savedUploadsPanel').hidden = !listed.length;
  const labels = {uploading:'尚未完成',verifying:'驗證中',verified:'已驗證',failed:'驗證／上傳失敗'};
  for (const item of listed) {
   const row=document.createElement('div'),label=document.createElement('p'),actions=document.createElement('div'),remove=document.createElement('button');
   row.className='saved-upload'; actions.className='saved-actions';
   label.textContent=(labels[item.status] || '待查核')+' · '+item.files+' 個檔案 · '+formatBytes(item.bytes)+' · '+String(item.uploadId).slice(0,8);
   if (item.status === 'verified') { const use=document.createElement('button'); use.type='button'; use.textContent='使用此備份'; use.addEventListener('click',()=>{ if (!busy && !localSubmitting) acceptVerification(item); }); actions.append(use); }
   remove.type='button'; remove.textContent='清理暫存'; remove.addEventListener('click',()=>clearUpload(item.uploadId)); actions.append(remove);
   row.append(label,actions); $('savedUploads').append(row);
  }
 }
 async function state() {
  clearTimeout(polling);
  const epoch = ++stateEpoch;
  try {
   const response = await fetch('/api/state',{headers:{'X-Transfer-Token':token},cache:'no-store'}), body = await response.json();
   // Queries dispatched before local uploads/submissions cannot settle a newer operation.
   if (epoch !== stateEpoch || localSubmitting) return;
   if (!body.ok || typeof body.result?.busy !== 'boolean') throw Error('Unable to read state');
   const wasBusy = busy;
   if (Array.isArray(body.result.uploads)) {
    if (!body.result.busy) {
     const ids=new Set(body.result.uploads.map(item=>item.uploadId));
     if (pendingUploadId && !ids.has(pendingUploadId)) pendingUploadId=null;
     if (currentUpload && !ids.has(currentUpload.uploadId)) {
      if ($('bundleDir').value===currentUpload.bundleDir) $('bundleDir').value='';
      if ($('keyFile').value===currentUpload.keyFile) $('keyFile').value='';
      currentUpload=null; resetEvidence(true); if ($('action').value==='restore') $('action').value='verify';
     }
    }
    renderUploads(body.result.uploads);
   }
   setBusy(body.result.busy);
   if (body.result.busy) polling=setTimeout(state,1000);
   else if (recoveryNotice) { status(recoveryNotice,'error'); recoveryNotice=null; }
   else if (body.result.lastResponse) result(body.result.lastResponse);
   else if (wasBusy) status('目前沒有執行中的工作。若先前連線中斷，請先核對備份或 receipt 再決定是否重試。','info');
  } catch {
   if (epoch !== stateEpoch || localSubmitting) return;
   setBusy(true); status('無法確認本機工作狀態，暫停送出並重新查詢。請確認工具仍在執行，避免重送。','error');
   polling=setTimeout(state,2000);
  }
 }
 async function uploadPlan() {
  const files=Array.from($('bundlePicker').files || []), keys=Array.from($('keyPicker').files || []);
  if (!files.length) throw Error('請先選擇完整的加密備份資料夾。');
  if (keys.length !== 1 || keys[0].size !== 32) throw Error('請選擇來源站產生的 32-byte 金鑰檔。');
  const entries=new Map(); let root='';
  for (const file of files) {
   const parts=(file.webkitRelativePath || '').split('/'), folder=parts.shift(), relative=parts.join('/');
   if (!folder || (root && folder !== root) || !/^(manifest\.json|payload\/[0-9]{6}\.bin)$/.test(relative) || entries.has(relative)) throw Error('請選取只含 manifest.json 與 payload/ 的完整備份資料夾；金鑰須另外選取。');
   root=folder; entries.set(relative,file);
  }
  const manifestFile=entries.get('manifest.json');
  if (!manifestFile || manifestFile.size > 5*1024*1024) throw Error('備份根目錄缺少有效的 manifest.json。');
  let manifest; try { manifest=JSON.parse(await manifestFile.text()); } catch { throw Error('manifest.json 不是有效 JSON，請重新取得備份。'); }
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw Error('manifest.json 沒有有效的檔案清單。');
  const paths=new Set(['manifest.json']), ordered=[['manifest.json',manifestFile]];
  for (const entry of manifest.files) {
   if (!/^payload\/[0-9]{6}\.bin$/.test(entry.payload) || paths.has(entry.payload)) throw Error('備份檔案清單含無效或重複路徑。');
   paths.add(entry.payload);
   const file=entries.get(entry.payload);
   if (!file || file.size !== entry.bytes) throw Error('備份缺少 '+entry.payload+' 或檔案大小不符，請重新取得完整備份。');
   ordered.push([entry.payload,file]);
  }
  if (paths.size !== entries.size) throw Error('資料夾含清單以外的檔案，請重新選擇原始加密備份。');
  return {ordered,key:keys[0],bytes:files.reduce((n,file)=>n+file.size,0)};
 }
 function uploadProgress(message, completed, total) {
  $('uploadProgressPanel').hidden = false; $('uploadStatus').textContent = message; $('uploadStatus').dataset.kind = 'busy';
  $('uploadProgress').value = total ? Math.round(completed/total*100) : 0;
 }
 async function upload() {
  if (busy || localSubmitting) return;
  startLocal();
  try {
   const plan=await uploadPlan();
   if (pendingUploadId) { await uploadApi.remove(pendingUploadId); savedUploads=savedUploads.filter(item=>item.uploadId!==pendingUploadId); pendingUploadId=null; }
   resetEvidence(true);
   const started=await uploadApi.start();
   if (typeof started.uploadId !== 'string' || !started.uploadId) throw Error('無法確認上傳批次，請重新查詢狀態。');
   pendingUploadId=started.uploadId;
   let completed=0;
   for (const [path,file] of plan.ordered) {
    uploadProgress('正在上傳 '+path+'（'+formatBytes(completed)+' / '+formatBytes(plan.bytes)+'）',completed,plan.bytes);
    await uploadApi.file(pendingUploadId,path,file); completed+=file.size;
   }
   uploadProgress('備份上傳完成，正在傳送金鑰並驗證內容…',completed,plan.bytes);
   await uploadApi.key(pendingUploadId,plan.key);
   const finished=await uploadApi.finish(pendingUploadId);
   acceptVerification(finished); finishLocal();
  } catch (error) {
   localSubmitting=false; stateEpoch++; setBusy(true);
   const message=errors[error.code] || error.message || '上傳未完成，請查核暫存批次後重試。';
   $('uploadStatus').textContent=message; $('uploadStatus').dataset.kind='error';
   recoveryNotice=message+' 可清理未完成的上傳後重新選擇。';
   await state();
  }
 }
 async function clearUpload(id) {
  if (!id || busy || localSubmitting) return;
  startLocal();
  try {
   await uploadApi.remove(id);
   if (currentUpload?.uploadId === id) {
    if ($('bundleDir').value === currentUpload.bundleDir) $('bundleDir').value='';
    if ($('keyFile').value === currentUpload.keyFile) $('keyFile').value='';
    currentUpload=null; resetEvidence(true); $('action').value='verify'; $('bundlePicker').value=''; $('keyPicker').value='';
   }
   if (pendingUploadId === id) pendingUploadId=null;
   renderUploads(savedUploads.filter(item=>item.uploadId!==id));
   $('uploadProgressPanel').hidden=true; finishLocal(); status('已清理這批上傳暫存。可以重新選擇備份；已建立的資料目錄仍保留。','info');
  } catch (error) {
   localSubmitting=false; stateEpoch++; setBusy(true); recoveryNotice=errors[error.code] || '暫存清理未確認，請等待狀態查詢後重試。'; await state();
  }
 }
 async function copy(text, node) { try { await navigator.clipboard.writeText(text); status('已複製。','success'); } catch { const selection=window.getSelection(), range=document.createRange(); range.selectNodeContents(node); selection.removeAllRanges(); selection.addRange(range); status('瀏覽器未允許複製，已選取內容，請按 Ctrl+C。','error'); } }
 $('transferForm').addEventListener('input',event=>{
  const id=event.target.id;
  if (['dbFile','historyDir','communityDir','musicDir'].includes(id)) $('sourceStopped').checked=false;
  if (['bundleDir','keyFile','maxBytes'].includes(id)) {
   resetEvidence(true);
   if (currentUpload && (currentUpload.bundleDir!==$('bundleDir').value.trim() || currentUpload.keyFile!==$('keyFile').value.trim())) {
    const previous=currentUpload; currentUpload=null;
    renderUploads(savedUploads.some(item=>item.uploadId===previous.uploadId) ? savedUploads : [...savedUploads,{...previous,status:'verified'}]);
   }
   if ($('action').value==='restore') $('action').value='verify';
  }
  if (['destinationDir','acknowledgeInterruptedMatches'].includes(id)) { rehearsedSignature=''; createdSignature=''; $('targetStopped').checked=false; mode('dry'); }
  update();
 });
 $('transferForm').addEventListener('change',event=>{
  if (event.target.name==='restoreMode') $('targetStopped').checked=false;
  if (event.target.id==='action') {
   if (['keygen','export'].includes($('action').value)) $('localPaths').open=true;
   if ($('action').value==='restore' && !verified()) { $('action').value='verify'; $('localPaths').open=true; status('請先驗證這份備份，再預演與建立新資料目錄。','info'); }
  }
  update();
 });
 $('localPaths').addEventListener('toggle',update);
 $('copyRequest').addEventListener('click',()=>copy($('requestPreview').textContent,$('requestPreview')));
 $('copyResult').addEventListener('click',()=>copy(JSON.stringify(lastResponse,null,2),$('resultOutput')));
 $('uploadButton').addEventListener('click',upload);
 $('clearUpload').addEventListener('click',()=>{
  if (busy || localSubmitting) return;
  if (currentUpload) return clearUpload(currentUpload.uploadId);
  if (localBundle) { $('bundleDir').value=''; $('keyFile').value=''; resetEvidence(true); $('action').value='verify'; update(); status('可以選擇另一份備份資料夾與金鑰，或填本機完整路徑。','info'); }
 });
 $('cleanupUpload').addEventListener('click',()=>clearUpload(pendingUploadId));
 $('transferForm').addEventListener('submit',async event => {
  event.preventDefault();
  if (busy || localSubmitting) return;
  const r=request();
  if (r.action==='restore' && (!verified() || (r.apply && (!rehearsed() || created())))) { status('請先完成這組備份與目標的驗證及預演，再建立資料。','error'); return; }
  // Open collapsed path fields before native validation so invalid inputs remain focusable.
  if ((r.action !== 'inspect' && !r.keyFile) || (['verify','restore'].includes(r.action) && !r.bundleDir)) $('localPaths').open=true;
  if (!$('transferForm').reportValidity()) return;
  const confirmations={sourceStopped:$('sourceStopped').checked,targetStopped:$('targetStopped').checked};
  const submittedBundle=bundleSignature(), submittedRestore=restoreSignature();
  if (r.action==='restore' && r.apply) rehearsedSignature='';
  startLocal();
  try {
   const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Transfer-Token':token},body:JSON.stringify({request:r,confirmations})});
   let body=await response.json();
   if (body.ok && r.action==='verify' && (typeof body.result?.bundleId!=='string' || !body.result.bundleId)) throw Error('Missing verified bundle identity');
   if (body.ok && r.action==='restore' && body.result?.bundleId!==r.expectedBundleId) body={ok:false,error:{code:'BUNDLE_CHANGED',message:'The restored bundle differs from the verified backup'}};
   if (body.error?.code==='BUNDLE_CHANGED') { resetEvidence(true); $('action').value='verify'; }
   result(body);
   if (body.ok && body.result.action==='verify' && r.action==='verify' && submittedBundle===bundleSignature()) {
    verifiedSignature=submittedBundle; verifiedBundleId=body.result.bundleId; rehearsedSignature=''; createdSignature=''; mode('dry'); $('action').value='restore'; $('localPaths').open=false;
    if (!currentUpload) localBundle={bundleDir:r.bundleDir,keyFile:r.keyFile,bundleId:body.result.bundleId};
    $('bundlePicker').value=''; $('keyPicker').value='';
   }
   if (body.ok && body.result.action==='restore' && r.action==='restore' && submittedRestore===restoreSignature()) {
    if (body.result.dryRun) { rehearsedSignature=submittedRestore; mode('apply'); $('targetStopped').checked=false; }
    else { createdSignature=submittedRestore; mode('dry'); }
   }
   localSubmitting=false; stateEpoch++; setBusy(body.error?.code==='BUSY');
   if (body.error?.code==='BUSY') await state();
  } catch { localSubmitting=false; stateEpoch++; setBusy(true); await state(); }
 });
 inventory(null); update(); state();
})();
