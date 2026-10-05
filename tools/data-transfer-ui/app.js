(() => {
 'use strict';
 const $ = id => document.getElementById(id), token = document.querySelector('meta[name="transfer-token"]').content;
 const names = { keygen:'建立備份金鑰', inspect:'盤點來源資料', export:'匯出加密備份', verify:'驗證備份包', restore:'預演還原' };
 const help = { keygen:'先產生一份新的二進位金鑰。遺失金鑰就無法恢復，請與備份包分開保管。', inspect:'停止所有來源 writer 後，檢查帳戶、素材、音樂與歷史的完整性。', export:'先停止來源服務及所有 writer，產生加密完整備份；不會自動停止遊戲。', verify:'驗證加密包、帳戶與素材完整性，完成後清理暫存，不建立新資料代。', restore:'預設只預演。確認成功後，明確選擇建立資料代，再隔離啟動驗收及切換服務。' };
 const errors = { DATA_IN_USE:'資料仍在使用中，請先停止所有 writer。', SOURCE_NOT_STOPPED:'請確認來源已停寫。', PRECONDITION_REQUIRED:'請勾選並確認停寫條件。', DESTINATION_EXISTS:'目標已存在，請選全新的目錄。', PARTIAL_RESTORE:'新資料代發布不完整，已被鎖住。繼續使用舊資料代，調查後以新目錄重試。', RESTORE_IN_PROGRESS:'這份資料代尚未完成，請不要刪除 marker 強行啟動。', AUTHENTICATION_FAILED:'金鑰不符或備份包被修改，請確認來源。', ASSET_VERSION_MISMATCH:'內建素材版本不同，請使用相容的程式與素材。', UNFINISHED_MATCHES:'有未完成對局，請完成對局或明確接受還原時中斷。', BUSY:'另一個工作仍在執行，請等待結果。' };
 let busy = false, lastResponse = null, polling;
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
  if (action === 'restore') { r.destinationDir = $('destinationDir').value.trim(); r.apply = document.querySelector('[name="restoreMode"]:checked').value === 'apply'; }
  if (action !== 'keygen' && $('maxBytes').value) r.maxBytes = Number($('maxBytes').value);
  if (['inspect','export','restore'].includes(action) && $('acknowledgeInterruptedMatches').checked) r.acknowledgeInterruptedMatches = true;
  if (action === 'export' && $('forceVacuum').checked) r.forceVacuum = true;
  return r;
 }
 function update() {
  const action = $('action').value, source = ['inspect','export'].includes(action), restore = action === 'restore';
  const groups = { keyFields:action !== 'inspect', sourceFields:source, outputFields:action === 'export', bundleFields:['verify','restore'].includes(action), restoreFields:restore };
  for (const [id, visible] of Object.entries(groups)) { $(id).hidden = !visible; for (const field of $(id).querySelectorAll('input')) field.disabled = !visible; }
  for (const id of ['keyFile','dbFile','historyDir','communityDir','outputDir','bundleDir','destinationDir']) $(id).required = !$(id).closest('.group').hidden;
  $('envId').required = action === 'export'; $('sourceStopped').required = source;
  const apply = restore && document.querySelector('[name="restoreMode"]:checked').value === 'apply';
  $('targetRequirement').hidden = !apply; $('targetStopped').required = apply;
  $('advanced').hidden = action === 'keygen'; $('acknowledgeLabel').hidden = !['inspect','export','restore'].includes(action); $('vacuumLabel').hidden = action !== 'export';
  $('maxBytes').disabled = action === 'keygen'; $('acknowledgeInterruptedMatches').disabled = $('acknowledgeLabel').hidden; $('forceVacuum').disabled = $('vacuumLabel').hidden;
  $('tempFields').hidden = action !== 'verify'; $('tempDir').disabled = action !== 'verify';
  $('actionHelp').textContent = help[action]; $('runButton').textContent = apply ? '建立新資料代' : names[action];
  $('requestPreview').textContent = JSON.stringify(request(),null,2);
 }
 function status(message, kind) { $('status').textContent = message; $('status').dataset.kind = kind; }
 function setBusy(value) { busy = value; $('controls').disabled = value; if (value) status('正在執行，請等待完整結果。重新整理後會查詢目前工作，不會自動重送。','busy'); }
 function result(response) {
  lastResponse = response; $('copyResult').disabled = false; $('resultOutput').hidden = false; $('resultOutput').textContent = JSON.stringify(response,null,2);
  $('resultSummary').replaceChildren(); $('resultSummary').hidden = true;
  if (!response.ok) { status(errors[response.error.code] || `操作失敗（${response.error.code}）：${response.error.message}`,'error'); return; }
  const r = response.result, label = r.action === 'restore' ? (r.dryRun ? '預演完成，新目錄尚未建立。' : '新資料代已建立，請使用回傳設定隔離驗收。') : names[r.action]+'完成。'; status(label,'success');
  const data = r.restoredSummary || r.summary || r, counts = data.database?.tableCounts;
  const items = counts ? [['帳戶',counts.users],['歷史對局',data.historyMatches],['音樂檔案',data.musicFiles],['共編題目',data.communityQuestions]] : [];
  if (r.changes) items.push(['撤銷舊認證',Object.values(r.changes.revoked).reduce((a,b)=>a+b,0)],['待查核投稿',r.changes.heldSubmissions]);
  for (const [name,value] of items) { const box=document.createElement('div'), number=document.createElement('strong'), caption=document.createElement('span');number.textContent=String(value ?? 0);caption.textContent=name;box.append(number,caption);$('resultSummary').append(box); }
  $('resultSummary').hidden = !items.length;
 }
 async function state() {
  clearTimeout(polling);
  try {
   const response = await fetch('/api/state',{headers:{'X-Transfer-Token':token},cache:'no-store'}), body = await response.json();
   if (!body.ok) throw Error('Unable to read state');
   setBusy(body.result.busy);
   if (body.result.busy) polling=setTimeout(state,1000);
   else if (body.result.lastResponse) result(body.result.lastResponse);
  } catch { setBusy(false); status('無法連到本機工具。請確認程序仍在執行；重新查詢工作狀態後再決定是否操作，避免重送。','error'); }
 }
 async function copy(text, node) { try { await navigator.clipboard.writeText(text); status('已複製。','success'); } catch { const selection=window.getSelection(), range=document.createRange();range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);status('瀏覽器未允許複製，已選取內容，請按 Ctrl+C。','error'); } }
 $('transferForm').addEventListener('input',event=>{if(['dbFile','historyDir','communityDir','musicDir'].includes(event.target.id))$('sourceStopped').checked=false;if(event.target.id==='destinationDir')$('targetStopped').checked=false;update();});
 $('transferForm').addEventListener('change',event=>{if(event.target.name==='restoreMode')$('targetStopped').checked=false;update();});
 $('copyRequest').addEventListener('click',()=>copy($('requestPreview').textContent,$('requestPreview')));
 $('copyResult').addEventListener('click',()=>copy(JSON.stringify(lastResponse,null,2),$('resultOutput')));
 $('transferForm').addEventListener('submit',async event => {
  event.preventDefault(); if (busy || !$('transferForm').reportValidity()) return;
  const r=request(), confirmations={sourceStopped:$('sourceStopped').checked,targetStopped:$('targetStopped').checked};
  setBusy(true);
  try { const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Transfer-Token':token},body:JSON.stringify({request:r,confirmations})});const body=await response.json();setBusy(false);result(body);if(body.error?.code==='BUSY')state(); }
  catch { await state(); }
 });
 update(); state();
})();
