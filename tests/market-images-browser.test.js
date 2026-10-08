const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../public/market-rules');
const {createClient,waitFor,deferred}=require('./helpers/market-client.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/market.js'),'utf8');
const limits={maxUploadBytes:2097152,maxImageBytes:4194304,maxDimension:4096,maxPixels:8000000,maxPerUser:100,maxImages:1000,maxStorageBytes:268435456,maxApprovalBatch:1000};
const image=(id,extra={})=>({id,version:1,authorName:'上傳者 '+id,buckets:['crash','fall'],weekdays:[1,2,3,4,5],width:32,height:32,status:'pending',createdAt:'2027-01-01T08:00:00Z',url:'/api/market/images/'+id+'/media',...extra});
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
async function fixture({role='member',rounds=true,pending=[image('a'),image('b')],mine=[],hash='',hook,beforeHook}={}){
 const events=[];let current={me:{id:'member',username:'server_user',displayName:'伺服器作者',role},serverNow:'2027-01-04T08:00:00Z',rules:R.snapshot(),stats:{score:24,hits:8,played:12},ledger:[],rounds:rounds?['2027-01-06','2027-01-07'].map((targetDate,index)=>({id:'round'+index,targetDate,cutoffAt:R.cutoffFor(targetDate),settlementAfter:R.settlementFor(targetDate),rules:R.snapshot(),phase:'open',result:null,vote:{optionId:'dip',revision:4,updatedAt:'2027-01-04T07:00:00Z'},...(role==='admin'?{voteCount:2,settlementHistory:[]}: {})})):[]};
 let drawNumber=0,approvedRequests=new Map(),uploadedRequests=new Map();
 const fetch=async(url,options={})=>{
  const input=options.body?JSON.parse(options.body):null,event={url,method:options.method||'GET',input};events.push(event);
  // Model HTTP failures that occur before a durable idempotency receipt is read.
  if(beforeHook){const result=await beforeHook({event,events});if(result instanceof Response)return result;}
  let body;
  if(url==='/api/market'||url==='/api/admin/market')body=structuredClone(current);
  else if(url==='/api/market/images/draw'){const metadata=image('draw'+(++drawNumber),{status:'approved',authorName:'伺服器抽圖作者'});body={targetDate:input.targetDate,images:{crash:metadata,fall:null,dip:null,rise:null,rally:null,surge:null}};}
  else if(url==='/api/market/images/mine')body={images:structuredClone(mine),limits};
  else if(url.startsWith('/api/admin/market/images?')||url==='/api/admin/market/images'){
   const query=new URL('http://localhost'+url).searchParams,buckets=query.get('buckets')?.split(',')||[],days=(query.get('weekdays')?.split(',')||[]).map(Number);
   const filtered=pending.filter(item=>item.status==='pending'&&(!buckets.length||item.buckets.some(bucket=>buckets.includes(bucket)))&&(!days.length||item.weekdays.some(day=>days.includes(day))));body={images:structuredClone(filtered),total:filtered.length,limits};
  }
  else if(url==='/api/market/vote'){const round=current.rounds.find(round=>round.id===input.roundId);round.vote={optionId:input.optionId,revision:input.expectedRevision+1,updatedAt:current.serverNow};body={ok:true,revision:round.vote.revision};}
  else if(url==='/api/market/images'){if(uploadedRequests.has(input.requestId))body={ok:true,replayed:true};else{mine.push(image('uploaded',{authorName:current.me.displayName,buckets:input.buckets,weekdays:input.weekdays}));uploadedRequests.set(input.requestId,true);body={ok:true};}}
  else if(url==='/api/admin/market/images/approve'){
   if(approvedRequests.has(input.requestId))body={ok:true,replayed:true};
   else{for(const ref of input.images){const item=pending.find(item=>item.id===ref.id);if(!item||item.status!=='pending'||item.version!==ref.version)return response({code:'STALE_IMAGE_BATCH',error:'批次已變更'},409);}for(const ref of input.images)pending.find(item=>item.id===ref.id).status='approved';approvedRequests.set(input.requestId,true);body={ok:true};}
  }
  else throw Error('Unexpected gallery test route: '+url);
  if(hook){const result=await hook({event,body,events,current,pending,mine});if(result instanceof Response)return result;}
  return response(body);
 };
 const client=await createClient({source,rules:R,fetch,hash});await waitFor(()=>!client.inspect().draw.busy);
 return {client,events,pending,mine,state:()=>current,setState:value=>{current=value;},draws:()=>events.filter(event=>event.url==='/api/market/images/draw'),approvals:()=>events.filter(event=>event.url==='/api/admin/market/images/approve'),uploads:()=>events.filter(event=>event.url==='/api/market/images'&&event.method==='POST')};
}
async function settle(){await new Promise(resolve=>setImmediate(resolve));}
async function review(f){f.client.view('admin');await waitFor(()=>!f.client.inspect().gallery.reviewBusy);}
async function uploads(f){f.client.view('uploads');await waitFor(()=>!f.client.inspect().gallery.mineBusy);}
function selectPending(client,ids){for(const input of client.node('#pendingImages').inputs){input.checked=ids.includes(input.value);client.node('#pendingImages').onchange({target:input});}}
const file=(extra={})=>({name:'測試.png',type:'image/png',size:120,bytes:'image-data',width:32,height:32,...extra});

test('entry draws six slots once; repeated rerolls preserve selected draft, revision and server scores',async()=>{
 const f=await fixture();assert.equal(f.draws().length,1);assert.equal(f.draws()[0].input.targetDate,'2027-01-07');
 f.client.choose('rally');const before=f.client.inspect();
 for(let i=0;i<3;i++){await f.client.node('#rerollImages').onclick();await waitFor(()=>!f.client.inspect().draw.busy);}
 const after=f.client.inspect();assert.equal(f.draws().length,4);assert.deepEqual(after.draft,before.draft);assert.deepEqual(after.state.stats,before.state.stats);assert.deepEqual(after.state.rounds,before.state.rounds);assert.equal(f.events.filter(event=>event.url==='/api/market/vote').length,0);
 assert.match(f.client.node('#options').innerHTML,/伺服器抽圖作者/);assert.match(f.client.node('#options').innerHTML,/尚無符合圖片/);
});

test('radio selection, render, score polling, busy transitions and vote saves never reroll images',async()=>{
 const f=await fixture(),original=f.client.inspect().draw.images;
 f.client.choose('surge');f.client.tick(1000);f.client.tick(15000);await settle();assert.equal(f.draws().length,1);
 f.client.submit();await waitFor(()=>!f.client.inspect().busy);assert.equal(f.draws().length,1);assert.deepEqual(f.client.inspect().draw.images,original);assert.equal(f.client.inspect().draft.optionId,'surge');assert.equal(f.client.inspect().draft.expectedRevision,5);assert.equal(f.client.inspect().state.stats.score,24);
 await f.client.refresh();assert.equal(f.draws().length,1);f.client.view('records');f.client.view('daily');await settle();assert.equal(f.draws().length,1);
});

test('target round change clears old images immediately and ignores a late draw from the prior date',async()=>{
 let hold=false;const gate=deferred();const f=await fixture({hook:({event})=>hold&&event.url==='/api/market/images/draw'&&event.input.targetDate==='2027-01-07'?gate.promise:undefined});
 hold=true;f.client.node('#rerollImages').onclick();await waitFor(()=>f.client.inspect().draw.busy);
 f.client.round('round0');assert.equal(f.client.inspect().draw.targetDate,'2027-01-06');assert.deepEqual(f.client.inspect().draw.images,{});await waitFor(()=>!f.client.inspect().draw.busy);const newer=f.client.inspect().draw;
 gate.resolve();await settle();assert.deepEqual(f.client.inspect().draw,newer);assert.equal(f.client.node('#rerollImages').disabled,false);assert.equal(f.draws().length,3);
});

test('late draw cleanup cannot clear a newer request busy flag, and duplicate reroll clicks make one request',async()=>{
 const old=deferred(),newer=deferred();let held=false;const f=await fixture({hook:({event})=>held&&event.url==='/api/market/images/draw'?(event.input.targetDate==='2027-01-07'?old.promise:newer.promise):undefined});
 held=true;f.client.node('#rerollImages').onclick();f.client.node('#rerollImages').onclick();assert.equal(f.draws().length,2);
 f.client.round('round0');await waitFor(()=>f.draws().length===3);old.resolve();await settle();assert.equal(f.client.inspect().draw.busy,true);assert.equal(f.client.node('#rerollImages').disabled,true);newer.resolve();await waitFor(()=>!f.client.inspect().draw.busy);
});

test('no target day makes no draw; a newly created first round draws on next daily entry',async()=>{
 const f=await fixture({rounds:false});assert.equal(f.draws().length,0);assert.equal(f.client.node('#rerollImages').disabled,true);
 f.client.view('records');const replacement=structuredClone(f.state());replacement.rounds=[{id:'new',targetDate:'2027-01-08',rules:R.snapshot(),phase:'open',result:null,vote:null,cutoffAt:R.cutoffFor('2027-01-08'),settlementAfter:R.settlementFor('2027-01-08')}];f.setState(replacement);f.client.tick(15000);await settle();assert.equal(f.draws().length,0);
 f.client.view('daily');await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(f.draws().length,1);assert.equal(f.draws()[0].input.targetDate,'2027-01-08');
});

test('failed draw requires explicit reroll; poll and view changes do not repeatedly retry',async()=>{
 let failed=false;const f=await fixture({hook:({event})=>{if(event.url==='/api/market/images/draw'&&!failed){failed=true;throw Error('offline');}}});
 assert.match(f.client.node('#drawStatus').textContent,/載入失敗/);f.client.tick(15000);await settle();f.client.view('records');f.client.view('daily');await settle();assert.equal(f.draws().length,1);
 await f.client.node('#rerollImages').onclick();await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(f.draws().length,2);assert.equal(f.client.inspect().draw.error,'');
});

test('all-filtered confirmation freezes count, IDs and versions while newer uploads and refreshes stay outside it',async()=>{
 const f=await fixture({role:'admin'});await review(f);f.client.node('#approveFiltered').onclick();assert.equal(f.client.node('#approvalDialog').open,true);assert.match(f.client.node('#approvalSummary').textContent,/2 張/);
 const frozen=f.client.inspect().gallery.approval;f.pending.push(image('new'));await f.client.node('#refreshReview').onclick();assert.equal(f.client.inspect().gallery.review.images.length,3);assert.match(f.client.node('#approvalSummary').textContent,/2 張/);assert.deepEqual(f.client.inspect().gallery.approval.images,frozen.images);
 await f.client.node('#confirmApproval').onclick();assert.deepEqual(f.approvals()[0].input.images,[{id:'a',version:1},{id:'b',version:1}]);assert.equal(f.approvals()[0].input.confirmed,true);assert.equal(f.pending.find(item=>item.id==='new').status,'pending');assert.equal(f.client.inspect().gallery.review.images.length,1);
});

test('selected approval freezes only selected pending images and all-filtered filters are OR within, AND between',async()=>{
 const f=await fixture({role:'admin',pending:[image('a',{buckets:['crash'],weekdays:[1]}),image('b',{buckets:['fall'],weekdays:[2]}),image('c',{buckets:['rise'],weekdays:[1]}),image('d',{buckets:['crash'],weekdays:[5]})]});await review(f);
 f.client.check('#reviewBuckets',['crash','fall']);f.client.check('#reviewWeekdays',[1,2]);await waitFor(()=>!f.client.inspect().gallery.reviewBusy);assert.deepEqual(f.client.inspect().gallery.review.images.map(item=>item.id),['a','b']);assert.match(f.client.node('#approveFiltered').textContent,/2/);
 selectPending(f.client,['b']);f.client.node('#approveSelected').onclick();assert.deepEqual(f.client.inspect().gallery.approval.images,[{id:'b',version:1}]);await f.client.node('#confirmApproval').onclick();assert.equal(f.pending.find(item=>item.id==='a').status,'pending');assert.equal(f.pending.find(item=>item.id==='b').status,'approved');
});

test('cancel, Escape and browser Back invalidate unsubmitted confirmations; stale confirm clicks are inert',async()=>{
 const f=await fixture({role:'admin'});await review(f);f.client.node('#approveFiltered').onclick();f.client.node('#cancelApproval').onclick();await f.client.node('#confirmApproval').onclick();assert.equal(f.approvals().length,0);
 f.client.node('#approveFiltered').onclick();f.client.cancelApproval();await f.client.node('#confirmApproval').onclick();assert.equal(f.approvals().length,0);
 f.client.node('#approveFiltered').onclick();f.client.view('records');assert.equal(f.client.node('#approvalDialog').open,false);await f.client.node('#confirmApproval').onclick();assert.equal(f.approvals().length,0);assert.equal(f.client.inspect().gallery.approval,null);
});

test('duplicate approval clicks and Escape during submission do not add writes or cancel an in-flight batch',async()=>{
 const gate=deferred();let hold=false;const f=await fixture({role:'admin',hook:({event})=>hold&&event.url==='/api/admin/market/images/approve'?gate.promise:undefined});await review(f);f.client.node('#approveFiltered').onclick();hold=true;const submit=f.client.node('#confirmApproval').onclick();f.client.node('#confirmApproval').onclick();f.client.node('#cancelApproval').onclick();assert.equal(f.client.cancelApproval().prevented,true);assert.equal(f.approvals().length,1);assert.equal(f.client.inspect().busy,false);
 f.client.view('records');gate.resolve();await submit;assert.equal(f.client.node('#approvalDialog').open,false);assert.equal(f.client.node('#records').hidden,false);assert.equal(f.client.inspect().gallery.approvalBusy,false);
});

test('unknown approval response retries the same request ID and frozen batch after cancel and return',async()=>{
 let lost=false;const f=await fixture({role:'admin',hook:({event})=>{if(event.url==='/api/admin/market/images/approve'&&!lost){lost=true;throw Error('response lost');}}});await review(f);f.client.node('#approveFiltered').onclick();await f.client.node('#confirmApproval').onclick();assert.equal(f.client.inspect().gallery.approval.uncertain,true);const initial=f.approvals()[0].input;
 f.client.node('#cancelApproval').onclick();assert.equal(f.client.node('#resumeApproval').hidden,false);f.pending.push(image('new'));await f.client.node('#refreshReview').onclick();f.client.node('#approveFiltered').onclick();assert.deepEqual(f.client.inspect().gallery.approval.images,initial.images);f.client.node('#resumeApproval').onclick();await f.client.node('#confirmApproval').onclick();assert.deepEqual(f.approvals()[1].input,initial);assert.equal(f.pending.find(item=>item.id==='new').status,'pending');assert.equal(f.client.inspect().gallery.approval,null);
});

test('stale batch errors require fresh confirmation and never overwrite versions automatically',async()=>{
 const f=await fixture({role:'admin'});await review(f);f.client.node('#approveFiltered').onclick();f.pending[0].version=2;await f.client.node('#confirmApproval').onclick();assert.equal(f.client.inspect().gallery.approval.invalid,true);await f.client.node('#confirmApproval').onclick();assert.equal(f.approvals().length,1);assert.ok(f.pending.every(item=>item.status==='pending'));
 f.client.node('#cancelApproval').onclick();await f.client.node('#refreshReview').onclick();f.client.node('#approveFiltered').onclick();assert.equal(f.client.inspect().gallery.approval.images[0].version,2);await f.client.node('#confirmApproval').onclick();assert.equal(f.approvals().length,2);
});

test('out-of-order filter responses cannot replace newer results or unlock a newer review request',async()=>{
 const old=deferred(),current=deferred();let hold=false;const f=await fixture({role:'admin',pending:[image('a',{buckets:['crash']}),image('b',{buckets:['fall']})],hook:({event})=>hold&&event.url.startsWith('/api/admin/market/images?')?(event.url.includes('crash')?old.promise:current.promise):undefined});await review(f);hold=true;f.client.check('#reviewBuckets',['crash']);f.client.check('#reviewBuckets',['fall']);old.resolve();await settle();assert.equal(f.client.inspect().gallery.reviewBusy,true);assert.equal(f.client.node('#approveFiltered').disabled,true);current.resolve();await waitFor(()=>!f.client.inspect().gallery.reviewBusy);assert.deepEqual(f.client.inspect().gallery.review.images.map(item=>item.id),['b']);
});

test('upload requires valid file and at least one bucket and weekday; metadata shows server author',async()=>{
 const f=await fixture();await uploads(f);await f.client.file(file());assert.match(f.client.node('#uploadPreview').innerHTML,/待投稿圖片預覽/);assert.match(f.client.node('#uploadAuthor').textContent,/伺服器作者/);
 await f.client.upload();assert.equal(f.uploads().length,0);f.client.check('#uploadBuckets',['crash','surge']);await f.client.upload();assert.equal(f.uploads().length,0);f.client.check('#uploadWeekdays',[0,6]);assert.equal(f.client.node('#submitUpload').disabled,false);await f.client.upload();assert.equal(f.uploads().length,1);assert.deepEqual(f.uploads()[0].input.buckets,['crash','surge']);assert.deepEqual(f.uploads()[0].input.weekdays,[0,6]);assert.equal(f.uploads()[0].input.authorName,undefined);assert.equal(f.uploads()[0].input.userId,undefined);assert.match(f.client.node('#myImages').innerHTML,/伺服器作者/);assert.match(f.client.node('#myImages').innerHTML,/星期日、星期六/);assert.equal(f.draws().length,1);
});

test('upload rejects MIME, empty/over-2MiB files and dimension/pixel excess before a POST',async()=>{
 const f=await fixture();await uploads(f);f.client.check('#uploadBuckets',['crash']);f.client.check('#uploadWeekdays',[1]);
 for(const input of [file({type:'image/gif'}),file({type:'text/html'}),file({size:0}),file({size:2097153}),file({width:4097}),file({width:4096,height:4096}),file({decodeError:true})]){await f.client.file(input);assert.equal(f.client.node('#submitUpload').disabled,true);await f.client.upload();assert.equal(f.uploads().length,0);}
 await f.client.file(file({type:'image/jpeg',size:2097152,width:4000,height:2000}));assert.equal(f.client.node('#submitUpload').disabled,false);await f.client.upload();assert.equal(f.uploads().length,1);
});

test('all seven weekdays are explicit, all/clear controls work, and saved rules have no in-place edit',async()=>{
 const f=await fixture({mine:[image('approved',{status:'approved',weekdays:[0,1,2,3,4,5,6]})]});await uploads(f);assert.match(f.client.node('#myImages').innerHTML,/已核准/);assert.match(f.client.node('#myImages').innerHTML,/不限星期/);assert.doesNotMatch(f.client.node('#myImages').innerHTML,/<(?:input|button)/);
 await f.client.file(file({type:'image/webp'}));f.client.check('#uploadBuckets',['dip']);f.client.node('#allUploadWeekdays').onclick();assert.equal(f.client.node('#submitUpload').disabled,false);f.client.node('#clearUploadWeekdays').onclick();assert.equal(f.client.node('#submitUpload').disabled,true);f.client.node('#allUploadWeekdays').onclick();await f.client.upload();assert.deepEqual(f.uploads()[0].input.weekdays,[0,1,2,3,4,5,6]);
});

test('duplicate upload submission and navigation keep gallery busy separate from voting',async()=>{
 const gate=deferred();let hold=false;const f=await fixture({hook:({event})=>hold&&event.url==='/api/market/images'?gate.promise:undefined});await uploads(f);await f.client.file(file());f.client.check('#uploadBuckets',['crash']);f.client.check('#uploadWeekdays',[1]);hold=true;const submission=f.client.upload();f.client.upload();assert.equal(f.uploads().length,1);assert.equal(f.client.inspect().gallery.uploadBusy,true);assert.equal(f.client.inspect().busy,false);
 f.client.view('daily');f.client.choose('rally');f.client.submit();await waitFor(()=>!f.client.inspect().busy);assert.equal(f.client.inspect().draft.expectedRevision,5);gate.resolve();await submission;assert.equal(f.client.node('#daily').hidden,false);assert.equal(f.client.inspect().gallery.uploadBusy,false);assert.equal(f.client.inspect().draft.optionId,'rally');assert.equal(f.draws().length,1);
});

test('lost upload response freezes payload and retries the same request ID; acknowledged uploads only refresh',async()=>{
 let lost=false;const f=await fixture({hook:({event})=>{if(event.url==='/api/market/images'&&!lost){lost=true;throw Error('lost');}}});await uploads(f);await f.client.file(file());f.client.check('#uploadBuckets',['crash']);f.client.check('#uploadWeekdays',[1]);await f.client.upload();const initial=f.uploads()[0].input;assert.equal(f.client.inspect().gallery.uploadBusy,false);assert.ok(f.client.inspect().gallery.uploadAttempt);await f.client.file(file({name:'replacement.png',bytes:'different'}));assert.deepEqual(f.client.inspect().gallery.uploadAttempt.payload,initial);await f.client.upload();assert.deepEqual(f.uploads()[1].input,initial);
 assert.equal(f.mine.length,1,'same-ID upload replay must leave one stored image');
 let failedRead=false;const acknowledged=await fixture({hook:({event,events})=>{if(event.url==='/api/market/images/mine'&&events.some(item=>item.url==='/api/market/images')&&!failedRead){failedRead=true;throw Error('read failed');}}});await uploads(acknowledged);await acknowledged.client.file(file());acknowledged.client.check('#uploadBuckets',['crash']);acknowledged.client.check('#uploadWeekdays',[1]);await acknowledged.client.upload();assert.equal(acknowledged.client.inspect().gallery.uploadAttempt.acknowledged,true);await acknowledged.client.upload();assert.equal(acknowledged.uploads().length,1);assert.equal(acknowledged.client.inspect().gallery.uploadAttempt,null);
});

test('late file decoder result cannot replace a newer selection or clear its busy state',async()=>{
 const f=await fixture();await uploads(f);const old=deferred(),current=deferred();const first=f.client.file(file({name:'old.png',bytes:'old',decodeGate:old.promise}));const next=f.client.file(file({name:'new.png',bytes:'new',decodeGate:current.promise}));old.resolve();await first;assert.equal(f.client.inspect().gallery.uploadReading,true);assert.equal(f.client.inspect().gallery.upload,null);current.resolve();await next;assert.equal(f.client.inspect().gallery.upload.filename,'new.png');assert.match(f.client.node('#uploadPreview').innerHTML,/new.png/);
});

test('member cannot expose admin review through a hash, and legacy/new cutoff labels match each snapshot',async()=>{
 const f=await fixture();f.client.view('admin');assert.equal(f.client.node('#admin').hidden,true);assert.equal(f.events.filter(event=>event.url.startsWith('/api/admin/market/images')).length,0);assert.match(f.client.node('#cutoff').textContent,/23:59 整分鐘/);assert.match(f.client.node('#cutoff').textContent,/起截止/);
 const replacement=structuredClone(f.state());const legacy={...R.snapshot(),version:1,cutoffTime:'21:00'};delete legacy.cutoffExclusive;replacement.rounds[0].rules=legacy;replacement.rounds[0].cutoffAt=R.cutoffFor(replacement.rounds[0].targetDate,legacy);f.setState(replacement);await f.client.refresh();f.client.round('round0');assert.match(f.client.node('#cutoff').textContent,/舊規則.*21:00/);
});

test('per-member upload quota and the approval batch bound block client writes with visible counts',async()=>{
 const f=await fixture({mine:Array.from({length:100},(_,index)=>image('mine'+index))});await uploads(f);await f.client.file(file());f.client.check('#uploadBuckets',['crash']);f.client.check('#uploadWeekdays',[1]);assert.equal(f.client.node('#submitUpload').disabled,true);await f.client.upload();assert.equal(f.uploads().length,0);assert.match(f.client.node('#uploadStatus').textContent,/上限/);assert.match(f.client.node('#mineStatus').textContent,/100 \/ 100/);
 const large=await fixture({role:'admin',pending:Array.from({length:1001},(_,index)=>image('batch'+index))});await review(large);large.client.node('#approveFiltered').onclick();assert.equal(large.client.node('#approvalDialog').open,false);assert.match(large.client.node('#reviewStatus').textContent,/最多核准 1000/);assert.equal(large.approvals().length,0);
});

test('legacy draw, member gallery and admin review cards select thumbnails, with full PNG deferred to preview',async()=>{
 const f=await fixture({role:'admin',mine:[image('mine')],pending:[image('review')]});
 assert.deepEqual(f.client.imageLoads,['/api/market/images/draw1/media/thumbnail']);
 await uploads(f);assert.match(f.client.node('#myImages').innerHTML,/src="\/api\/market\/images\/mine\/media\/thumbnail"/);
 await review(f);assert.match(f.client.node('#pendingImages').innerHTML,/src="\/api\/market\/images\/review\/media\/thumbnail"/);
 assert.ok(f.client.imageLoads.every(url=>url.endsWith('/media/thumbnail')),'no full PNG before a preview click');
 assert.equal(f.client.node('#imagePreviewImage').src,undefined);
 f.client.view('daily');const before=f.client.imageLoads.length;openPreview(f.client);
 assert.equal(f.client.imageLoads.length,before+1);assert.equal(f.client.imageLoads.at(-1),'/api/market/images/draw1/media');
 f.client.node('#closeImagePreview').onclick();assert.equal(f.client.imageLoads.length,before+1);
 assert.equal(f.draws().length,1);
});

test('gallery output escapes server names and never loads metadata-provided third-party image URLs',async()=>{
 const hostile=image('a',{authorName:'<script>alert(1)</script>',url:'https://untrusted.example/image.png'});const f=await fixture({role:'admin',pending:[hostile],mine:[hostile]});await uploads(f);assert.match(f.client.node('#myImages').innerHTML,/&lt;script&gt;/);assert.doesNotMatch(f.client.node('#myImages').innerHTML,/<script>|https:\/\//);await review(f);f.client.node('#approveFiltered').onclick();assert.match(f.client.node('#approvalItems').innerHTML,/&lt;script&gt;/);assert.doesNotMatch(f.client.node('#pendingImages').innerHTML,/<script>|https:\/\//);assert.ok(f.client.imageLoads.every(url=>/^\/api\/market\/images\/[^/]+\/media\/thumbnail$/.test(url)));
});

for(const status of [408,429]){
 test(`upload preserves an unresolved request through HTTP ${status} and later replays without duplication`,async()=>{
  let writes=0;
  const f=await fixture({beforeHook:({event})=>{if(event.url==='/api/market/images'&&++writes===2)return response({code:'TRANSIENT_HTTP',error:'temporarily unavailable'},status);},hook:({event})=>{if(event.url==='/api/market/images'&&writes===1)throw Error('successful response lost');}});
  await uploads(f);await f.client.file(file());f.client.check('#uploadBuckets',['crash','fall']);f.client.check('#uploadWeekdays',[0,2]);
  await f.client.upload();const frozen=f.client.inspect().gallery.uploadAttempt.payload;assert.equal(f.mine.length,1);assert.equal(f.client.inspect().gallery.uploadAttempt.acknowledged,false);
  await f.client.upload();assert.deepEqual(f.client.inspect().gallery.uploadAttempt?.payload,frozen);assert.equal(f.client.inspect().gallery.uploadAttempt.acknowledged,false);assert.equal(f.client.inspect().gallery.uploadBusy,false);assert.equal(f.client.node('#submitUpload').disabled,false);assert.match(f.client.node('#submitUpload').textContent,/重試確認同一筆/);
  f.client.view('records');await f.client.file(file({name:'new.png',bytes:'new'}));await uploads(f);assert.deepEqual(f.client.inspect().gallery.uploadAttempt.payload,frozen);assert.equal(f.client.inspect().gallery.upload.filename,'測試.png');
  await f.client.upload();assert.equal(f.client.inspect().gallery.uploadAttempt,null);assert.equal(f.mine.length,1);assert.equal(f.uploads().length,3);for(const event of f.uploads())assert.deepEqual(event.input,frozen);assert.equal(f.client.inspect().busy,false);
 });

 test(`approval preserves frozen IDs, versions and count through HTTP ${status}, cancellation and resume`,async()=>{
  let writes=0;
  const f=await fixture({role:'admin',pending:[image('a',{version:3}),image('b',{version:7})],beforeHook:({event})=>{if(event.url==='/api/admin/market/images/approve'&&++writes===2)return response({code:'TRANSIENT_HTTP',error:'temporarily unavailable'},status);},hook:({event})=>{if(event.url==='/api/admin/market/images/approve'&&writes===1)throw Error('successful response lost');}});
  await review(f);f.client.node('#approveFiltered').onclick();await f.client.node('#confirmApproval').onclick();const original=f.approvals()[0].input,frozen=f.client.inspect().gallery.approval;
  assert.deepEqual(original.images,[{id:'a',version:3},{id:'b',version:7}]);f.client.node('#cancelApproval').onclick();f.pending.push(image('later'));await f.client.node('#refreshReview').onclick();assert.equal(f.client.inspect().gallery.review.images.length,1);
  f.client.node('#resumeApproval').onclick();assert.match(f.client.node('#approvalSummary').textContent,/2 張/);await f.client.node('#confirmApproval').onclick();const after=f.client.inspect().gallery.approval;assert.equal(after.uncertain,true);assert.equal(after.invalid,false);assert.equal(after.requestId,frozen.requestId);assert.deepEqual(after.images,frozen.images);assert.deepEqual(after.details,frozen.details);assert.equal(f.client.node('#confirmApproval').disabled,false);
  f.client.cancelApproval();f.client.view('records');await review(f);f.client.node('#resumeApproval').onclick();assert.match(f.client.node('#approvalSummary').textContent,/2 張/);await f.client.node('#confirmApproval').onclick();assert.equal(f.client.inspect().gallery.approval,null);assert.equal(f.approvals().length,3);for(const event of f.approvals())assert.deepEqual(event.input,original);assert.equal(f.pending.find(item=>item.id==='later').status,'pending');assert.equal(f.client.inspect().busy,false);
 });
}

test('six lost successful upload responses followed by pre-receipt rate limiting retain one upload identity',async()=>{
 let writes=0;
 const f=await fixture({beforeHook:({event})=>{if(event.url==='/api/market/images'&&++writes===7)return response({code:'RATE_LIMITED',error:'too many requests'},429);},hook:({event})=>{if(event.url==='/api/market/images'&&writes<=6)throw Error('successful response lost');}});
 await uploads(f);await f.client.file(file());f.client.check('#uploadBuckets',['crash']);f.client.check('#uploadWeekdays',[1]);
 for(let index=0;index<7;index++)await f.client.upload();const original=f.uploads()[0].input;assert.deepEqual(f.client.inspect().gallery.uploadAttempt?.payload,original);assert.equal(f.mine.length,1);await f.client.upload();assert.equal(f.mine.length,1);assert.equal(f.client.inspect().gallery.uploadAttempt,null);assert.equal(f.uploads().length,8);for(const event of f.uploads())assert.deepEqual(event.input,original);
});

test('genuine definite upload and approval 4xx errors still release or invalidate their attempts',async()=>{
 const f=await fixture({beforeHook:({event})=>event.url==='/api/market/images'?response({code:'INVALID_MARKET_IMAGE',error:'invalid image'},400):undefined});await uploads(f);await f.client.file(file());f.client.check('#uploadBuckets',['crash']);f.client.check('#uploadWeekdays',[1]);await f.client.upload();assert.equal(f.client.inspect().gallery.uploadAttempt,null);assert.equal(f.client.node('#uploadFile').disabled,false);assert.match(f.client.node('#uploadStatus').textContent,/invalid image/);assert.equal(f.mine.length,0);
 const admin=await fixture({role:'admin',beforeHook:({event})=>event.url==='/api/admin/market/images/approve'?response({code:'STALE_IMAGE_BATCH',error:'stale batch'},409):undefined});await review(admin);admin.client.node('#approveFiltered').onclick();await admin.client.node('#confirmApproval').onclick();assert.equal(admin.client.inspect().gallery.approval.uncertain,false);assert.equal(admin.client.inspect().gallery.approval.invalid,true);assert.equal(admin.client.node('#confirmApproval').disabled,true);admin.client.node('#cancelApproval').onclick();assert.equal(admin.client.inspect().gallery.approval,null);
});

// VM coverage exercises the shipped event handlers; native dialog focus trapping,
// keyboard activation and actual layout still require a browser smoke test.
function openPreview(client,optionId='crash'){
 const button=client.node('#options').querySelectorAll('[data-preview-option]').find(item=>item.dataset.previewOption===optionId);
 assert.ok(button);button.focus();const event={target:button,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
 client.node('#options').onclick(event);return event;
}
test('preview is separate from voting, preserves draft and attribution, and repeatedly returns focus',async()=>{
 const f=await fixture();f.client.choose('rally');const before=f.client.inspect(),events=f.events.length;
 assert.match(f.client.node('#options').innerHTML,/<\/label><div class="choice-media"/);
 assert.doesNotMatch(f.client.node('#options').innerHTML,/<label[^>]*>(?:(?!<\/label>)[\s\S])*<button/);
 for(let i=0;i<3;i++){
  const event=openPreview(f.client);assert.ok(event.prevented&&event.stopped);assert.equal(f.client.node('#imagePreviewDialog').open,true);
  assert.equal(f.client.active(),f.client.node('#closeImagePreview'));assert.match(f.client.node('#imagePreviewImage').src,/^\/api\/market\/images\/draw1\/media$/);
  assert.match(f.client.node('#imagePreviewCredit').textContent,/伺服器抽圖作者/);
  f.client.node('#closeImagePreview').onclick();assert.equal(f.client.node('#imagePreviewDialog').open,false);assert.equal(f.client.active().dataset.previewOption,'crash');assert.equal(f.client.node('#imagePreviewImage').src,undefined);
 }
 assert.deepEqual(f.client.inspect().draft,before.draft);assert.deepEqual(f.client.inspect().state,before.state);assert.equal(f.events.length,events);
});
test('preview Escape and genuine backdrop close, dialog surface clicks do not',async()=>{
 const f=await fixture(),dialog=f.client.node('#imagePreviewDialog');openPreview(f.client);
 dialog.dispatch('click',{target:dialog,clientX:30,clientY:30});assert.equal(dialog.open,true);
 dialog.dispatch('click',{target:f.client.node('#imagePreviewImage'),clientX:0,clientY:0});assert.equal(dialog.open,true);
 dialog.dispatch('click',{target:dialog,clientX:0,clientY:0});assert.equal(dialog.open,false);assert.equal(f.client.active().dataset.previewOption,'crash');
 openPreview(f.client);let prevented=false;dialog.dispatch('cancel',{preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(dialog.open,false);assert.equal(f.client.active().dataset.previewOption,'crash');
});
test('refresh replaces trigger nodes but preview remains stable and restores the current trigger',async()=>{
 const f=await fixture();openPreview(f.client);const image=f.client.node('#imagePreviewImage').src;
 await f.client.refresh();assert.equal(f.client.node('#imagePreviewDialog').open,true);assert.equal(f.client.node('#imagePreviewImage').src,image);
 f.client.node('#closeImagePreview').onclick();assert.equal(f.client.active(),f.client.node('#options').querySelectorAll('[data-preview-option]')[0]);
 f.client.active().focus();await f.client.refresh();assert.equal(f.client.active(),f.client.node('#options').querySelectorAll('[data-preview-option]')[0]);
});
test('reroll, round navigation, Back/Forward views and page exit clear the preview without reopening it',async()=>{
 const f=await fixture(),dialog=f.client.node('#imagePreviewDialog');openPreview(f.client);
 await f.client.node('#rerollImages').onclick();await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(dialog.open,false);assert.equal(f.client.node('#imagePreviewImage').src,undefined);
 openPreview(f.client);assert.match(f.client.node('#imagePreviewImage').src,/draw2/);f.client.round('round0');assert.equal(dialog.open,false);await waitFor(()=>!f.client.inspect().draw.busy);
 openPreview(f.client);f.client.view('records');assert.equal(dialog.open,false);f.client.view('daily');assert.equal(dialog.open,false);
 openPreview(f.client);f.client.pagehide();assert.equal(dialog.open,false);assert.equal(f.events.filter(event=>event.url==='/api/market/vote').length,0);
});
test('preview uses local media URLs and text-only attribution even with hostile metadata',async()=>{
 const f=await fixture({hook:({event,body})=>{if(event.url==='/api/market/images/draw'){body.images.crash.authorName='<img src=x onerror=alert(1)>';body.images.crash.url='https://untrusted.example/image.png';}}});
 openPreview(f.client);assert.equal(f.client.node('#imagePreviewCredit').textContent,'上傳者：<img src=x onerror=alert(1)>');assert.match(f.client.node('#imagePreviewImage').src,/^\/api\/market\/images\//);assert.doesNotMatch(f.client.node('#options').innerHTML,/https:\/\/untrusted|<img src=x/);
});
test('prediction layout and dialog retain responsive contain sizing and accessible controls',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../public/market.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../public/market.html'),'utf8');
 assert.match(css,/#options\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);assert.match(css,/@media\(max-width:900px\)\{#options\{grid-template-columns:repeat\(2/);assert.match(css,/@media\(max-width:440px\)\{#options\{grid-template-columns:minmax\(0,1fr\)/);
 assert.ok([...css.matchAll(/\.placeholder\{height:([^;}]+)/g)].every(match=>match[1]==='200px'),'all placeholder height declarations retain the image-area height');
 assert.match(css,/\.choice-image-preview\{[^}]*height:200px/);assert.match(css,/\.choice-image-preview img\{[^}]*object-fit:contain/);assert.match(css,/\.image-preview-dialog>img\{[^}]*object-fit:contain/);
 assert.match(html,/<dialog id="imagePreviewDialog"[^>]*aria-labelledby="imagePreviewTitle"[^>]*aria-describedby="imagePreviewCredit"/);assert.match(html,/<button id="closeImagePreview" type="button" autofocus>/);assert.match(source,/aria-haspopup="dialog" aria-controls="imagePreviewDialog"/);
});


for(const view of ['uploads','admin'])test(view+' thumbnails have bounded retries, readable exhaustion and cancel replacement callbacks',async()=>{
 const f=await fixture({role:'admin',mine:[image('mine')],pending:[image('review')]}),selector=view==='uploads'?'#myImages':'#pendingImages',refresh=view==='uploads'?'#refreshMine':'#refreshReview';
 if(view==='uploads')await uploads(f);else await review(f);
 const img=f.client.node(selector).images[0],status=img.nextElementSibling,requests=f.events.length;
 for(const delay of [1000,3000,10000,30000]){f.client.imageError(img);assert.equal(f.client.pendingTimers()[0].delay,delay);f.client.advanceTimers(delay);}
 f.client.imageError(img);assert.equal(f.client.pendingTimers().length,0);assert.equal(status.hidden,false);assert.match(status.textContent,/請更新圖片清單重試/);assert.equal(f.events.length,requests);assert.ok(f.client.imageLoads.every(url=>url.endsWith('/thumbnail')));
 await f.client.node(refresh).onclick();const replacement=f.client.node(selector).images[0];f.client.imageError(replacement);const stale=f.client.pendingTimers()[0].callback;
 await f.client.node(refresh).onclick();const loads=f.client.imageLoads.length;stale();f.client.advanceTimers(60000);assert.equal(f.client.imageLoads.length,loads);assert.equal(f.client.pendingTimers().length,0);
 const current=f.client.node(selector).images[0];f.client.imageError(current);const afterNavigation=f.client.pendingTimers()[0].callback;f.client.view('records');const before=f.client.imageLoads.length;afterNavigation();f.client.advanceTimers(60000);assert.equal(f.client.imageLoads.length,before);assert.equal(f.client.pendingTimers().length,0);
});
