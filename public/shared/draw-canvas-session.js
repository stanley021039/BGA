(function(){
'use strict';
function validCanvasSnapshot(snapshot){
 if(!Number.isSafeInteger(snapshot?.round)||!Number.isSafeInteger(snapshot.version)||snapshot.version<0||!Array.isArray(snapshot.strokes)||snapshot.strokes.length>1000)return false;
 let points=0,fills=0,previous=0;
 for(const stroke of snapshot.strokes){
  if(!validCanvasStroke(stroke,previous,snapshot.version))return false;
  previous=stroke.version;points+=stroke.points.length;if(stroke.tool==='fill')fills++;
 }
 return points<=30000&&fills<=48;
}
function validCanvasStroke(stroke,previous,version){
 if(!Number.isSafeInteger(stroke?.version)||stroke.version<=previous||stroke.version>version||typeof stroke.strokeId!=='string'||!/^[a-f0-9-]{8,36}$/i.test(stroke.strokeId)||!['brush','erase','line','rect','ellipse','fill'].includes(stroke.tool)||!/^#[a-f0-9]{6}$/i.test(stroke.color)||!Number.isInteger(stroke.size)||stroke.size<1||stroke.size>40||!Array.isArray(stroke.points)||stroke.points.length<1||stroke.points.length>64)return false;
 if(stroke.points.some(point=>!Array.isArray(point)||point.length!==2||!Number.isInteger(point[0])||point[0]<0||point[0]>511||!Number.isInteger(point[1])||point[1]<0||point[1]>255))return false;
 if(stroke.curve!==undefined&&(stroke.tool!=='brush'||stroke.curve!=='quadratic'))return false;
 if(stroke.pointTimes!==undefined&&(!['brush','erase'].includes(stroke.tool)||!Array.isArray(stroke.pointTimes)||stroke.pointTimes.length!==stroke.points.length||stroke.pointTimes.some((time,index)=>!Number.isSafeInteger(time)||time<0||time>120000||index>0&&time<stroke.pointTimes[index-1])))return false;
 return !(stroke.tool==='fill'?stroke.points.length!==1:!['brush','erase'].includes(stroke.tool)&&stroke.points.length!==2);
}

function create({canvas,request,syncCanvas,cancelInput, cancelNetwork, feedback,notify,onRendered=()=>{},onBusy=()=>{},onQuota=()=>{},now=()=>performance.now()}){
 let previewFrame=null;
 let state=null,canvasVersion=-1,canvasRound=-1,strokes=[],lastSentAt=-Infinity,lastFillSentAt=-Infinity;
 let sendQueue=Promise.resolve(),canvasCommandBusy=false,canvasCommandEpoch=0;
 let canvasRenderPromise=Promise.resolve(false),canvasRenderEpoch=0,canvasRecovering=false,canvasRenderError=null;
 let canvasQuota={usedFills:0,usedBatches:0,usedPoints:0},canvasTotals={points:0,fills:0};
 const localStrokes=new Map(),drawNow=now;
 const canvasRenderer=StrokeCanvas.createDrawingRenderer(canvas,{separateMutable:true,atomicPresentation:true});
 const drawingPlayback=window.DrawPlayback.create({now:drawNow,onFrame:()=>redrawCanvas()});
 const api=request,drawFeedback=feedback,toast=notify,updateStagePreview=onRendered,updateCanvasBusy=onBusy,updateFillAvailability=onQuota;
 const sameCanvas=data=>!!state?.canvasEpoch&&data?.canvasEpoch===state.canvasEpoch&&data.round===state.round;
 const cancelStrokeInput=cancelInput;
 function cancelPreview(){if(previewFrame!==null)cancelAnimationFrame(previewFrame);previewFrame=null;}
 function scheduleCanvasPreview(){if(previewFrame!==null)return;const epoch=state?.canvasEpoch;previewFrame=requestAnimationFrame(()=>{previewFrame=null;if(state?.canvasEpoch===epoch)redrawCanvas();});}
 const canDraw=()=>!canvasCommandBusy&&!canvasRecovering&&!canvasRenderError&&state?.phase==='drawing'&&state.presenterId===state.me;
 async function waitForCanvasRender(){let render;do{render=canvasRenderPromise;await render;}while(render!==canvasRenderPromise);if(canvasRenderError)throw canvasRenderError;}
const drawingTransport=window.DrawTransport.create({
 send:(data,options,attempt)=>{if(attempt===1&&(canvasQuota.usedBatches>=1000||canvasQuota.usedPoints+data.points.length>30000||data.tool==='fill'&&canvasQuota.usedFills>=48))throw Error('本輪筆畫額度已用完，請等待下一輪。');return api('draw/stroke',data,options);},createId:()=>StrokeCanvas.strokeId(),now:drawNow,
 pacing:()=>({lastStart:lastSentAt,lastFill:lastFillSentAt}),
 isCurrent:(data,draft)=>sameCanvas(data)&&localStrokes.get(data.strokeId)===draft,
 onPending:(draft,change)=>draft.pendingBatches+=change,
 onStart:(data,clock)=>{lastSentAt=clock;if(data.tool==='fill')lastFillSentAt=clock;},
 onAccepted:(result,_data,draft)=>{if(!sameCanvas(result))throw Error('畫布已更新，請重新同步後作畫');updateCanvasQuota(result);draft.ackVersion=Math.max(draft.ackVersion,result.version);if(draft.ackVersion>(draft.resetVersion||0))draft.hiddenByReset=false;if(result.stroke)receiveCanvasStroke(result);if(result.version>canvasVersion)return syncCanvas();},
 onDiscard:(draft,reason)=>{if(reason==='error')draft.failed=true;},
 onError:(error,draft)=>{draft.failed=true;cancelStrokeInput(true);drawFeedback(error.message+'；尚未同步的筆畫已取消，正在回復已確認畫布。','error');toast(error.message);syncCanvas();},
 onSettled:()=>settleLocalStrokes()
});
function redrawCanvas(){
 cancelPreview();
 const visible=[],keys=[],placed=new Set();let mutableFrom=Infinity;
 const key=stroke=>['fill','rect','ellipse','line'].includes(stroke.tool)?JSON.stringify([stroke.strokeId,stroke.tool,stroke.color,stroke.size,!!stroke.filled,stroke.points]):'server:'+stroke.version+':'+stroke.strokeId+':'+(stroke.playbackCount??'complete');
 function placeDraft(draft){
  if(placed.has(draft.strokeId))return;placed.add(draft.strokeId);
  if(draft.hiddenByReset)return;
  mutableFrom=Math.min(mutableFrom,visible.length);visible.push(draft);
  keys.push(['fill','rect','ellipse','line'].includes(draft.tool)?key(draft):'local:'+draft.strokeId+':'+draft.revision);
 }
 for(const stroke of strokes){const draft=localStrokes.get(stroke.strokeId);if(draft)placeDraft(draft);else{const presented=drawingPlayback.view(stroke);if(presented){visible.push(presented);keys.push(key(presented));}}}
 for(const draft of localStrokes.values())placeDraft(draft);
 const token=++canvasRenderEpoch;let result;
 try{result=(canvasRenderer.renderCooperatively||canvasRenderer.render)(visible,{keys,mutableFrom});}
 catch(error){canvasRenderError=error;canvasRenderPromise=Promise.resolve(false);canvasRecovering=false;updateCanvasBusy();drawFeedback('畫布回復失敗：'+error.message,'error');return canvasRenderPromise;}
 if(result&&typeof result.then==='function'){
  if(!canvasRecovering)drawFeedback('正在回復畫布，仍可猜題與查看玩家。');
  canvasRecovering=true;updateCanvasBusy();
  canvasRenderPromise=result.then(changed=>{if(token===canvasRenderEpoch&&changed){canvasRenderError=null;updateStagePreview();}return changed;}).catch(error=>{if(token===canvasRenderEpoch){canvasRenderError=error;drawFeedback('畫布回復失敗：'+error.message,'error');}return false;}).finally(()=>{if(token===canvasRenderEpoch){canvasRecovering=false;updateCanvasBusy();drawFeedback('畫布已同步。','success',{onlyRecovering:true});}});
 }else{canvasRenderPromise=Promise.resolve(result);canvasRecovering=false;updateCanvasBusy();if(result){canvasRenderError=null;updateStagePreview();}}
 return canvasRenderPromise;
}
function settleLocalStrokes(){
 let changed=false;
 for(const [id,draft] of localStrokes){
  if(draft.finished&&draft.pendingBatches===0&&(draft.failed||canvasVersion>=draft.ackVersion)){
   localStrokes.delete(id);changed=true;
  }
 }
 if(changed)redrawCanvas();
}
function updateCanvasQuota(snapshot){
 if(!sameCanvas(snapshot))return;
 const quota=snapshot.quota;
 const fills=quota?.usedFills??strokes.filter(stroke=>stroke.tool==='fill').length,batches=quota?.usedBatches??strokes.length,points=quota?.usedPoints??strokes.reduce((sum,stroke)=>sum+stroke.points.length,0);
 if(Number.isInteger(fills)&&fills>=0&&fills<=48)canvasQuota.usedFills=Math.max(canvasQuota.usedFills,fills);
 if(Number.isInteger(batches)&&batches>=0&&batches<=1000)canvasQuota.usedBatches=Math.max(canvasQuota.usedBatches,batches);
 if(Number.isInteger(points)&&points>=0&&points<=30000)canvasQuota.usedPoints=Math.max(canvasQuota.usedPoints,points);
 updateFillAvailability();
}
function applyCanvasSnapshot(snapshot,reset=false){
 if(!sameCanvas(snapshot)||snapshot.version<canvasVersion)return false;
 if(!validCanvasSnapshot(snapshot))throw Error('畫布資料超過同步上限');
 drawingPlayback.reset();strokes=snapshot.strokes;canvasVersion=snapshot.version;canvasRound=snapshot.round;
 canvasTotals={points:strokes.reduce((sum,stroke)=>sum+stroke.points.length,0),fills:strokes.filter(stroke=>stroke.tool==='fill').length};
 updateCanvasQuota(snapshot);
 if(reset){
  cancelStrokeInput();drawingTransport.cancel({retainInFlight:true});sendQueue=drawingTransport.whenIdle();
  for(const [id,draft] of localStrokes){
   if(draft.pendingBatches>0){draft.finished=true;draft.resetVersion=Math.max(draft.resetVersion||0,snapshot.version);draft.hiddenByReset=!strokes.some(stroke=>stroke.strokeId===id);}
   else localStrokes.delete(id);
  }

 }
 settleLocalStrokes();redrawCanvas();return true;
}
function receiveCanvasStroke(data){
 if(!sameCanvas(data))return;
 if(data.quota)updateCanvasQuota(data);
 if(data.version<=canvasVersion)return;
 if(data.version!==canvasVersion+1){syncCanvas();return;}
 if(data.stroke?.version!==data.version||!validCanvasStroke(data.stroke,canvasVersion,data.version)||strokes.length>=1000||canvasTotals.points+data.stroke.points.length>30000||canvasTotals.fills+(data.stroke.tool==='fill'?1:0)>48){syncCanvas();return;}
 // Existing entries were validated when accepted; an event validates only its new batch.
 strokes.push(data.stroke);canvasVersion=data.version;canvasTotals.points+=data.stroke.points.length;if(data.stroke.tool==='fill')canvasTotals.fills++;
 updateCanvasQuota(data);
 if(state.phase==='drawing'&&state.me!==state.presenterId&&!document.hidden&&data.stroke.pointTimes)drawingPlayback.add(data.stroke);
 else drawingPlayback.finish({notify:false});
 settleLocalStrokes();redrawCanvas();
}
function rejectPendingDrawing(message){
 for(const draft of localStrokes.values()){draft.failed=true;draft.finished=true;}
 cancelStrokeInput(true);drawingTransport.cancel({retainInFlight:true});sendQueue=drawingTransport.whenIdle();
 drawFeedback(message+'；尚未同步的筆畫已取消，正在回復已確認畫布。','error');syncCanvas();settleLocalStrokes();
 return sendQueue;
}
function queueStroke(points,strokeId,style,pointTimes){
 const {tool:mode,color,size,filled}=style;
 if(canvasQuota.usedBatches>=1000||canvasQuota.usedPoints+points.length>30000)return rejectPendingDrawing('本輪筆畫額度已用完，請等待下一輪。');
 if(mode==='fill'&&canvasQuota.usedFills>=48)return rejectPendingDrawing('本輪填色額度已用完，可用畫筆或形狀繼續。');
 if(mode==='fill'&&[...localStrokes.values()].some(draft=>draft.tool==='fill'&&!draft.failed)){drawFeedback('填色正在同步，請稍候再填下一區。');return sendQueue;}
 let draft=localStrokes.get(strokeId);
 if(!draft){
  if(!localCanvasCapacity(points.length)){drawFeedback('畫布同步中的筆畫已達上限，請稍候。','error');return sendQueue;}
  draft={strokeId,tool:mode,color,size,filled,points:[...points],...(mode==='brush'?{curve:'quadratic'}:{}),revision:1,finished:true,pendingBatches:0,ackVersion:0,failed:false};
  localStrokes.set(strokeId,draft);scheduleCanvasPreview();
 }
 const data={canvasEpoch:state.canvasEpoch,round:state.round,strokeId,tool:mode,color:draft.color,size:draft.size,filled:draft.filled,points,...(draft.curve?{curve:draft.curve}:{}),...(pointTimes?{pointTimes}:{} )};
 try{drawingTransport.enqueue(data,draft);}catch(error){rejectPendingDrawing(error.message);toast(error.message);}
 sendQueue=drawingTransport.whenIdle();
 return sendQueue;
}
function localCanvasCapacity(extraPoints=0){
 let count=localStrokes.size,points=extraPoints;
 for(const stroke of strokes)if(!localStrokes.has(stroke.strokeId)){count++;points+=stroke.points.length;}
 for(const draft of localStrokes.values())points+=draft.points.length;
 return count<1016&&points<=31024;
}
async function command(name){
  if([...localStrokes.values()].some(draft=>!draft.finished)){toast('請先完成這一筆');return;}
 if(canvasCommandBusy)return;
 const operation=++canvasCommandEpoch,round=state.round,epoch=state.canvasEpoch;
 const current=()=>operation===canvasCommandEpoch&&state?.round===round&&state?.canvasEpoch===epoch;
 canvasCommandBusy=true;updateCanvasBusy();
 try{
  await sendQueue;await syncCanvas();
  if(!current())return;
  const snapshot=await api('draw/command',{canvasEpoch:epoch,round,command:name});
  if(!current())return;
  if(!sameCanvas(snapshot))throw Error('畫布已更新，請重新同步後操作');
  applyCanvasSnapshot(snapshot,true);await waitForCanvasRender();
 }catch(error){if(current()){drawFeedback(error.message,'error');toast(error.message);}}
 finally{if(current()){canvasCommandBusy=false;updateCanvasBusy();}}
}

 function beginDraft(input){
  if(!localCanvasCapacity(input.points.length))return false;
  localStrokes.set(input.strokeId,{strokeId:input.strokeId,tool:input.tool,color:input.color,size:input.size,filled:input.filled,points:input.points.map(p=>[...p]),...(input.curve?{curve:input.curve}:{}),revision:1,finished:false,pendingBatches:0,ackVersion:0,failed:false});return true;
 }
 function appendDraft(id,point,shape=false){const draft=localStrokes.get(id);if(!draft)return;if(shape)draft.points=[draft.points[0],point];else draft.points.push(point);draft.revision++;}
 function finishDraft(id,failed=false){const draft=localStrokes.get(id);if(draft){draft.finished=true;if(failed)draft.failed=true;}settleLocalStrokes();}
 function suspend(){cancelPreview();cancelInput();drawingPlayback.reset();drawingTransport.cancel();}
 function transition(next){
  const previous=state;state=next;
  if(previous?.round!==next.round||previous?.canvasEpoch!==next.canvasEpoch){
   cancelNetwork();strokes=[];localStrokes.clear();sendQueue=Promise.resolve();lastSentAt=-Infinity;lastFillSentAt=-Infinity;canvasCommandEpoch++;canvasCommandBusy=false;canvasQuota={usedFills:0,usedBatches:0,usedPoints:0};canvasTotals={points:0,fills:0};canvasRound=next.round;canvasVersion=-1;canvasRenderEpoch++;canvasRenderer.reset();canvasRenderPromise=Promise.resolve(false);canvasRecovering=false;canvasRenderError=null;onBusy();onQuota();onRendered();
  }else if(previous?.phase==='drawing'&&next.phase!=='drawing'){cancelNetwork({cancelSync:false});localStrokes.clear();sendQueue=Promise.resolve();redrawCanvas();}
  if(next.strokeVersion>canvasVersion||canvasRound!==next.round)syncCanvas();
 }
 function dispose(){suspend();localStrokes.clear();canvasCommandEpoch++;canvasCommandBusy=false;canvasRenderEpoch++;canvasRenderer.reset();canvasRenderPromise=Promise.resolve(false);canvasRecovering=false;}
 const view=()=>Object.freeze({version:canvasVersion,round:canvasRound,strokeCount:strokes.length,pointCount:canvasTotals.points,draftCount:localStrokes.size,pendingBatches:[...localStrokes.values()].reduce((n,draft)=>n+draft.pendingBatches,0),quota:Object.freeze({...canvasQuota}),commandBusy:canvasCommandBusy,recovering:canvasRecovering,error:canvasRenderError});
 return {view,schedulePreview:scheduleCanvasPreview,cancelPreview,transition,receiveStroke:receiveCanvasStroke,applySnapshot:applyCanvasSnapshot,beginDraft,appendDraft,finishDraft,enqueue:queueStroke,hasCapacity:localCanvasCapacity,canDraw,command,redraw:redrawCanvas,whenIdle:async()=>{await drawingTransport.whenIdle();await waitForCanvasRender();},suspend,dispose,finishPlayback:()=>drawingPlayback.finish()};
}
window.DrawCanvasSession={create,validSnapshot:validCanvasSnapshot};
})();
