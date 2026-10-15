(function(){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
 function createStore({loadResult,saveResult,voteResult,onState,validateCanvas=()=>true,onChange=()=>{}}){
  let room='',gameRunId=null,generation=0,results=[],selectedId=null,loading=false,loadError=null,selection=0,savingId=null,savePromise=null,voteSignature='';
  const snapshots=new Map(),loads=new Map(),saves=new Map(),resultVotes=new Map(),voteJobs=new Map(),voteErrors=new Map();
  function summary(id){return snapshots.get(id)?.result||results.find(item=>item.resultId===id)||null;}
  function voteView(id=selectedId){return {resultId:id,summary:summary(id),vote:resultVotes.get(id)||null,pending:voteJobs.has(id),error:voteErrors.get(id)||null,recent:results.some(item=>item.resultId===id)};}
  function view(){return {room,gameRunId,results,selectedId,summary:summary(selectedId),snapshot:snapshots.get(selectedId)||null,loading,error:loadError,savingId,save:saves.get(selectedId)||null,vote:voteView()};}
  function changed(){onChange(view());}
  function prune(){const keep=new Set(results.map(item=>item.resultId));if(selectedId)keep.add(selectedId);if(savingId)keep.add(savingId);for(const id of voteJobs.keys())keep.add(id);for(const values of [snapshots,saves,voteErrors])for(const key of values.keys())if(!keep.has(key))values.delete(key);}
  function reset(){generation++;selection++;room='';gameRunId=null;results=[];selectedId=null;loading=false;loadError=null;savingId=null;savePromise=null;voteSignature='';snapshots.clear();loads.clear();saves.clear();resultVotes.clear();voteJobs.clear();voteErrors.clear();changed();}
  function update(state){
   const nextRoom=String(state.code||'');if(room&&room!==nextRoom)reset();room=nextRoom;const nextRunId=state.gameRunId||null,runChanged=gameRunId!==nextRunId;gameRunId=nextRunId;
   const list=(Array.isArray(state.recentResults)?state.recentResults:state.result?.resultId?[state.result]:[]).filter(item=>typeof item?.resultId==='string').slice(0,8);
   const resultsChanged=runChanged||list.map(item=>item.resultId).join('|')!==results.map(item=>item.resultId).join('|');
   if(resultsChanged)results=freeze(copy(list));
   // Votes are live room data. Public artwork metadata and pixels stay frozen.
   const votes=(Array.isArray(state.resultVotes)?state.resultVotes:[]).filter(item=>typeof item?.resultId==='string').slice(0,8).map(item=>({...item,banned:Boolean(item.banned||resultVotes.get(item.resultId)?.banned)}));
   const nextVoteSignature=JSON.stringify(votes),votesChanged=nextVoteSignature!==voteSignature;
   if(votesChanged){voteSignature=nextVoteSignature;resultVotes.clear();for(const item of votes){resultVotes.set(item.resultId,freeze(copy(item)));if(item.voted||item.banned)voteErrors.delete(item.resultId);}}
   if(resultsChanged||votesChanged){prune();changed();}
  }
  async function load(id,reload=false){
   if(!reload&&snapshots.has(id))return snapshots.get(id);
   if(loads.has(id))return loads.get(id);
   const started=generation,requestedRoom=room;
   const pending=(async()=>{
    const value=await loadResult(id,requestedRoom);
    if(value?.result?.resultId!==id||value.canvas?.canvasEpoch!==value.result.canvasEpoch||value.canvas?.round!==value.result.round||!validateCanvas(value.canvas))throw Error('這輪畫作資料不完整，請重試載入。');
    const snapshot=freeze(copy(value));
    if(started===generation){snapshots.set(id,snapshot);prune();}
    return snapshot;
   })();
   loads.set(id,pending);
   try{return await pending;}finally{if(loads.get(id)===pending)loads.delete(id);}
  }
  async function select(id=selectedId||results[0]?.resultId,{reload=false}={}){
   const token=++selection;selectedId=id||null;loadError=null;loading=Boolean(id);changed();
   if(!id)return null;
   try{const result=await load(id,reload);if(token===selection){loading=false;changed();}return result;}
   catch(error){if(token===selection){loading=false;loadError=error;changed();}return null;}
  }
  function save(id=selectedId,{recollect=false}={}){
   if(savingId)return savingId===id?savePromise:Promise.resolve(null);
   const snapshot=snapshots.get(id);if(!snapshot)return Promise.resolve(null);
   if(saves.get(id)?.status==='saved')return Promise.resolve(saves.get(id).receipt);
   const started=generation,requestedRoom=room;savingId=id;saves.set(id,{status:'pending'});changed();
   savePromise=(async()=>{
    try{
     const receipt=await saveResult(snapshot,{recollect,isCurrent:()=>started===generation},requestedRoom);
     if(receipt?.resultId!==id||receipt.canvasEpoch!==snapshot.result.canvasEpoch)throw Error('收藏回應與這輪畫作不符，請重試確認。');
     if(started===generation)saves.set(id,{status:'saved',receipt});
     return receipt;
    }catch(error){if(started===generation)saves.set(id,{status:'error',error});return null;}
    finally{if(started===generation){savingId=null;savePromise=null;prune();changed();}}
   })();
   return savePromise;
  }
  function vote(id=selectedId){
   if(voteJobs.has(id))return voteJobs.get(id).promise;
   const current=voteView(id);if(!voteResult||!current.summary?.answer||!current.vote?.canVote||current.vote.voted||current.vote.banned)return Promise.resolve(null);
   const started=generation,requestedRoom=room,job={promise:null};voteJobs.set(id,job);voteErrors.delete(id);
   job.promise=Promise.resolve().then(async()=>{
    try{
     if(started!==generation)return null;
     const response=await voteResult(id,requestedRoom),ack=response?.resultVotes?.find(item=>item.resultId===id);
     if(response?.type!=='draw'||response.code!==requestedRoom||!ack||(!ack.voted&&!ack.banned))throw Error('投票回應尚未確認，請重試。');
     if(started===generation){if(onState)onState(response);else update(response);}
     return response;
    }catch(error){if(started===generation&&!resultVotes.get(id)?.voted&&!resultVotes.get(id)?.banned)voteErrors.set(id,error);return null;}
    finally{if(started===generation&&voteJobs.get(id)===job){voteJobs.delete(id);prune();changed();}}
   });
   changed();return job.promise;
  }
  return {update,select,save,vote,voteView,load,view,reset,forgetSave(id){saves.delete(id);changed();}};
 }
 function votePresentation({summary,vote,pending,error,recent}){
  const unavailable=!summary?.answer?'這輪未選題，無法投票。':!vote?recent?'投票資訊尚未同步，請稍候。':'這輪已不在最近 8 輪，無法投票。':!vote.canVote&&!vote.voted&&!vote.banned?'你在這輪揭曉後才加入，沒有投票權。':'';
  const accepted=vote?.banned||vote?.voted,label=vote?.banned?'已移除題庫':vote?.voted?'已投票':pending?'送出投票…':error&&!unavailable?'重試禁止題目':'禁止題目';
  return {label,disabled:Boolean(unavailable||pending||accepted),summary:vote?vote.votes+' / '+vote.total+' 票，需 '+vote.required+' 票；'+(vote.banned?'此題全站已停止抽選。':'通過後全站不再抽到此題。'):'通過後全站不再抽到此題。',status:vote?.banned?'畫作與得分仍會保留。':vote?.voted?'已記錄你的投票，不能取消。':pending?'正在送出這一題的投票…':unavailable||error?.message||'每人一票，送出後不能取消。',kind:error&&!accepted&&!unavailable?'error':accepted?'success':'info'};
 }
 function renderVote(button,summary,status,presentation){
  if(!button||!summary||!status)return;
  button.disabled=presentation.disabled;button.setAttribute('aria-busy',String(presentation.label==='送出投票…'));
  if(button.dataset.voteLabel!==presentation.label){button.dataset.voteLabel=presentation.label;button.textContent=presentation.label;window.GameUI?.decorateButton(button,'ban',{label:presentation.label});}
  if(summary.textContent!==presentation.summary)summary.textContent=presentation.summary;
  if(window.GameUI)window.GameUI.setStatus(status,presentation.status,{kind:presentation.kind});else{status.textContent=presentation.status;status.dataset.kind=presentation.kind;}
 }
 function mount({trigger,dialog,validateCanvas,onUnauthorized,onState,onVoteChange}={}){
  if(!trigger||!dialog)return null;
  const $=id=>document.getElementById(id),preview=$('drawResultCanvas'),renderer=window.StrokeCanvas.createDrawingRenderer(preview,{maxCheckpoints:2});
  let shownId=null,paintedSnapshot=null,painting=0,paintError=null,paintBusy=false,listSignature='',lastSaveStates=new Map();const encoders=new Set();
  async function request(url,body){
   const response=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
   const result=await response.json();
   if(!response.ok){if(response.status===401)onUnauthorized?.();const error=Error(result.error||'暫時無法讀取，請重試。');error.code=result.code;throw error;}
   return result;
  }
  const store=createStore({
   validateCanvas,onState,
   voteResult:(id,room)=>request('/api/draw/result/ban',{code:room,resultId:id}),
   loadResult:(id,room)=>request('/api/draw/result?code='+encodeURIComponent(room)+'&resultId='+encodeURIComponent(id)),
   saveResult:async(snapshot,{recollect,isCurrent},room)=>{
    // The encoder owns a separate canvas for this immutable result. Changing the
    // live round or browsing another result cannot alter an in-flight save.
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
    const encoder=window.StrokeCanvas.createDrawingRenderer(canvas,{maxCheckpoints:2});
    encoders.add(encoder);
    try{
     await encoder.renderCooperatively(snapshot.canvas.strokes);
     if(!isCurrent())throw Error('已離開這個房間，尚未送出收藏。');
     const base64=window.StrokeCanvas.drawingDataURL(canvas,1024*1024).split(',')[1];
     return await request('/api/draw/result/save',{code:room,resultId:snapshot.result.resultId,base64,...(recollect?{recollect:true}:{})});
    }finally{encoders.delete(encoder);encoder.reset();canvas.width=0;canvas.height=0;}
   },
   onChange:render
  });
  const tactile=Boolean(document.body.dataset.uiTemplate);
  let filter='all',myId=null,knownSaved=new Set(),galleryBusy=false;
  let filters,favorite,downloadButton,exportButton,exportStatus;
  if(tactile){
   filters=document.createElement('nav');filters.className='st-gallery-filters';filters.setAttribute('aria-label','篩選公開畫作');
   for(const [value,label]of [['all','最近全部'],['mine','我作畫的'],['saved','已收藏']]){
    const button=document.createElement('button');button.type='button';button.dataset.filter=value;button.textContent=label;
    button.onclick=()=>{filter=value;listSignature='';render(store.view());const first=filtered(store.view())[0];if(first&&!filtered(store.view()).some(item=>item.resultId===store.view().selectedId))store.select(first.resultId);};filters.append(button);
   }
   dialog.querySelector('.draw-results-head').after(filters);
   const actions=$('drawResultSave').parentElement;
   downloadButton=document.createElement('button');downloadButton.type='button';downloadButton.textContent='下載畫作 PNG';downloadButton.className='st-art-download';
   favorite=document.createElement('button');favorite.type='button';favorite.className='st-art-favorite';
   exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='匯出畫作集';exportButton.className='st-art-export';
   exportStatus=document.createElement('p');exportStatus.className='st-export-status';exportStatus.setAttribute('role','status');actions.prepend(downloadButton,favorite);actions.append(exportStatus);filters.append(exportButton);
   downloadButton.onclick=()=>withExport(async()=>{const snapshot=store.view().snapshot;if(!snapshot)throw Error('畫作仍在載入');window.ArtworkExport.download(await window.ArtworkExport.png(snapshot),window.ArtworkExport.name(snapshot));});
   exportButton.onclick=()=>exportAll();
   favorite.onclick=async()=>{
    const view=store.view(),id=view.selectedId;if(!id||galleryBusy)return;
    if(!knownSaved.has(id))return store.save();
    if(!await window.StitchGameUI.confirm({title:'取消這幅畫的收藏？',text:'這會移除私人素材庫中的收藏；房間公開畫作與得分會保留。',label:'取消收藏',danger:true,trigger:favorite}))return;
    galleryBusy=true;render(store.view());
    try{const state=await request('/api/draw/result/unsave',{code:view.room,resultId:id,confirmed:true});knownSaved.delete(id);store.forgetSave(id);onState?.(state);}
    catch(error){message(exportStatus,error.message,'error');}
    finally{galleryBusy=false;render(store.view());}
   };
  }
  function filtered(view){return view.results.filter(item=>filter==='mine'?item.artist?.id===myId:filter==='saved'?knownSaved.has(item.resultId):true);}
  async function withExport(job){if(galleryBusy)return;galleryBusy=true;render(store.view());try{await job();message(exportStatus,'畫作已匯出。','success');}catch(error){message(exportStatus,error.message,'error');}finally{galleryBusy=false;render(store.view());}}
  function exportAll({currentRun=false}={}){return withExport(async()=>{
   const view=store.view(),list=currentRun?view.results.filter(item=>item.gameRunId===view.gameRunId):filtered(view),entries=[];
   if(!list.length)throw Error('目前沒有可以匯出的公開畫作');
   for(const item of list){const snapshot=await store.load(item.resultId);entries.push({name:window.ArtworkExport.name(snapshot),blob:await window.ArtworkExport.png(snapshot)});}
   window.ArtworkExport.download(await window.ArtworkExport.zip(entries),'你畫我猜_畫作集.zip');
  });}
  function message(node,text,kind='info'){if(window.GameUI)window.GameUI.setStatus(node,text,{kind});else{node.textContent=text;node.dataset.kind=kind;}}
  function renderList(view){
   const next=JSON.stringify([view.results.map(item=>item.resultId),view.selectedId,view.gameRunId,filter,[...knownSaved]]);if(listSignature===next)return;listSignature=next;
   $('drawResultList').replaceChildren();
   for(const result of tactile?filtered(view):view.results){
    const button=document.createElement('button'),round=document.createElement('strong'),answer=document.createElement('span'),artist=document.createElement('small');
    button.type='button';button.className='draw-result-choice';button.dataset.resultId=result.resultId;button.setAttribute('aria-pressed',String(result.resultId===view.selectedId));
    round.textContent=(result.gameRunId===view.gameRunId?'本局':'先前對局')+' · 第 '+result.round+' 輪';answer.textContent=result.answer||'未選定題目';artist.textContent=result.artist?.name||'畫者';
    if(knownSaved.has(result.resultId))artist.textContent+=' · ★ 已收藏';
    button.append(round,answer,artist);button.addEventListener('click',()=>store.select(result.resultId));$('drawResultList').append(button);
   }
   if(tactile&&!filtered(view).length){const empty=document.createElement('p');empty.className='st-filter-empty';empty.textContent='此篩選目前沒有畫作。';$('drawResultList').append(empty);}
  }
  function render(view){
   if(tactile&&view.save?.status==='saved')knownSaved.add(view.selectedId);
   if(tactile&&view.selectedId&&!filtered(view).some(item=>item.resultId===view.selectedId)){store.select(filtered(view)[0]?.resultId||null);return;}
   if(filters){for(const button of filters.querySelectorAll('[data-filter]')){const mode=button.dataset.filter,count=view.results.filter(item=>mode==='mine'?item.artist?.id===myId:mode==='saved'?knownSaved.has(item.resultId):true).length;button.setAttribute('aria-pressed',String(mode===filter));button.textContent=({all:'最近全部',mine:'我作畫的',saved:'已收藏'})[mode]+' ('+count+')';}
    favorite.textContent=knownSaved.has(view.selectedId)?'★ 已收藏 · 取消收藏':'☆ 收藏這幅畫';favorite.setAttribute('aria-pressed',String(knownSaved.has(view.selectedId)));favorite.disabled=!view.snapshot||view.loading||Boolean(view.savingId)||galleryBusy;
    downloadButton.disabled=!view.snapshot||view.loading||galleryBusy;exportButton.disabled=!filtered(view).length||galleryBusy;
   }
   trigger.disabled=!view.results.length;trigger.textContent='最近畫作'+(view.results.length?' · '+view.results.length:'');
   renderList(view);
   const info=view.summary;$('drawResultEmpty').hidden=Boolean(info);$('drawResultBody').hidden=!info;
   if(info){
    $('drawResultAnswer').textContent=info.answer||'這輪沒有選定題目';
    $('drawResultAuthor').textContent=(info.gameRunId===view.gameRunId?'本局':'先前對局')+' · 第 '+info.round+' 輪 · 畫者 '+(info.artist?.name||'朋友');
    $('drawResultReason').textContent=info.reason||'';
    $('drawResultScores').replaceChildren();
    for(const score of info.scores||[]){const item=document.createElement('li'),name=document.createElement('span'),points=document.createElement('strong'),total=document.createElement('small');name.textContent=score.name||'朋友';points.textContent=(score.roundPoints>=0?'+':'')+(score.roundPoints||0)+' 分';total.textContent='累計 '+(score.score||0);item.append(name,points,total);$('drawResultScores').append(item);}
   }
   const previousStatus=lastSaveStates.get(view.selectedId);lastSaveStates.set(view.selectedId,view.save?.status);
   const retained=new Set(view.results.map(item=>item.resultId));retained.add(view.selectedId);retained.add(view.savingId);for(const id of lastSaveStates.keys())if(!retained.has(id))lastSaveStates.delete(id);
   $('drawResultSave').disabled=!view.snapshot||view.loading||Boolean(view.savingId)||view.save?.status==='saved';
   $('drawResultSave').textContent=view.save?.status==='saved'?'✓ 已收藏':view.save?.status==='pending'?'收藏中…':view.savingId?'另一幅正在收藏…':view.save?.status==='error'?'重試收藏':'收藏這幅畫';
   $('drawResultRecollect').hidden=view.save?.error?.code!=='DRAW_SAVED_ARTWORK_DELETED';$('drawResultRecollect').disabled=Boolean(view.savingId);
   if(!$('drawResultRecollect').hidden)$('drawResultSave').disabled=true;
   const saveText=view.save?.status==='saved'?'已加入你的私人素材庫。':view.save?.status==='pending'?'正在收藏這輪已公開的畫作；遊戲繼續進行。':view.save?.status==='error'?view.save.error.code==='DRAW_SAVED_ARTWORK_DELETED'?'之前收藏的作品已被刪除。可明確選擇重新收藏。':view.save.error.message:'收藏會保存目前選定的這一輪。';
   message($('drawResultSaveStatus'),saveText,view.save?.status==='error'?'error':view.save?.status==='saved'?'success':'info');
   if(view.save?.status==='saved'&&previousStatus==='pending'&&dialog.open)window.MotionPolicy?.confirm($('drawResultSave'));
   if(shownId!==view.selectedId){shownId=view.selectedId;paintedSnapshot=null;painting++;renderer.reset();preview.hidden=true;paintBusy=false;paintError=null;}
   if(dialog.open&&view.snapshot&&!view.loading&&paintedSnapshot!==view.snapshot){paintedSnapshot=view.snapshot;paint(view.snapshot);}
   renderCanvasStatus(view);
   renderVote($('drawResultBan'),$('drawResultBanSummary'),$('drawResultBanStatus'),votePresentation(view.vote));
   onVoteChange?.();
  }
  function renderCanvasStatus(view=store.view()){
   const error=view.error||paintError;
   message($('drawResultCanvasStatus'),error?error.code==='DRAW_RESULT_NOT_FOUND'?'這輪已不在最近畫作中；答案與得分仍保留在目前畫面。':error.message:view.loading?'正在讀取這輪畫作…':paintBusy?'正在還原畫作，仍可關閉回到遊戲。':'',error?'error':'info');
   $('drawResultRetry').hidden=!error;$('drawResultRetry').disabled=view.loading||paintBusy;
   preview.setAttribute('aria-busy',String(view.loading||paintBusy));
  }
  async function paint(snapshot){
   const token=++painting;paintBusy=true;paintError=null;preview.hidden=true;renderCanvasStatus();
   try{await renderer.renderCooperatively(snapshot.canvas.strokes);if(token!==painting)return;preview.hidden=false;preview.setAttribute('aria-label','第 '+snapshot.result.round+' 輪，'+(snapshot.result.artist?.name||'畫者')+' 的畫作：'+(snapshot.result.answer||'未選題'));}
   catch(error){if(token===painting)paintError=error;}
   finally{if(token===painting){paintBusy=false;renderCanvasStatus();}}
  }
  function open(id,opener=trigger){
   if(tactile&&id&&!filtered(store.view()).some(item=>item.resultId===id)){filter='all';listSignature='';}
   if(window.GameUI?.openDialog)window.GameUI.openDialog(dialog,opener);else if(!dialog.open)dialog.showModal();
   return store.select(id||store.view().selectedId||(tactile?filtered(store.view()):store.view().results)[0]?.resultId||null);
  }
  trigger.addEventListener('click',()=>open());
  $('closeDrawResults').addEventListener('click',()=>dialog.close());
  $('drawResultSave').addEventListener('click',()=>store.save());
  $('drawResultBan')?.addEventListener('click',()=>store.vote());
  $('drawResultRecollect').addEventListener('click',()=>store.save(undefined,{recollect:true}));
  $('drawResultRetry').addEventListener('click',()=>{paintedSnapshot=null;paintError=null;return store.select(undefined,{reload:true});});
  dialog.addEventListener('close',()=>{painting++;paintedSnapshot=null;paintBusy=false;renderer.reset();});
  window.addEventListener('pagehide',()=>{painting++;renderer.reset();for(const encoder of encoders)encoder.reset();store.reset();});
  window.GameUI?.decorateButton($('closeDrawResults'),'close',{iconOnly:true,label:'關閉最近畫作'});
  return {update(state){myId=state.me;if(tactile&&Array.isArray(state.savedResultIds))knownSaved=new Set(state.savedResultIds);store.update(state);if(tactile)render(store.view());if(dialog.open&&!store.view().selectedId&&store.view().results.length)store.select();},open,exportAll,save:store.save,vote:store.vote,votePresentation:id=>votePresentation(store.voteView(id)),reset(){painting++;renderer.reset();for(const encoder of encoders)encoder.reset();knownSaved.clear();store.reset();},store};
 }
 window.DrawResults={createStore,mount,renderVote,votePresentation};
})();
