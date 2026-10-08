const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../public/market-rules');
const C=require('../public/market-curve');
const {createClient,waitFor,deferred}=require('./helpers/market-client.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/market.js'),'utf8');
const slots=['crash','fall','center','rally','surge'];
async function fixture({settled=false,hook,blank=false,role='member'}={}){
 const events=[];let drawNumber=0;
 const numeric={id:'curve',targetDate:'2027-01-07',cutoffAt:R.cutoffFor('2027-01-07'),settlementAfter:R.settlementFor('2027-01-07'),rules:C.createCurveSnapshot({targetDate:'2027-01-07',frozenAt:'2027-01-04T08:00:00Z'}),phase:settled?'settled':'open',vote:null,result:settled?{returnPct:12,points:0,bucket:'curve',revision:1}:null};
 const legacy={id:'old',targetDate:'2027-01-06',cutoffAt:R.cutoffFor('2027-01-06'),settlementAfter:R.settlementFor('2027-01-06'),rules:R.snapshot(),phase:'closed',vote:{optionId:'dip',revision:2,updatedAt:'2027-01-04T07:00:00Z'},result:{returnPct:-1,points:5,bucket:'dip',revision:1}};
 const state={me:{id:'me',role},serverNow:'2027-01-04T08:00:00Z',rules:R.snapshot(),rounds:[numeric,legacy],stats:{score:0,hits:0,played:0},ledger:[]};
 const fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;events.push({url,body});if(hook){const response=await hook({url,body,state,events});if(response)return response;}
  if(url==='/api/market'||url==='/api/admin/market')return Response.json(state);
  if(url==='/api/market/images/draw'){drawNumber++;const keys=body.layout==='curve-five'?slots:R.CONFIG.options.map(option=>option.id);return Response.json({targetDate:body.targetDate,images:Object.fromEntries(keys.map((key,i)=>[key,blank?null:{id:key+'-'+drawNumber,authorName:'作者 '+key,buckets:key==='center'?['dip']:key==='surge'?['surge']: [key],weekdays:[4],width:100+i,height:200-i}]))});}
  if(url==='/api/market/vote'){const r=state.rounds.find(row=>row.id===body.roundId);r.vote={...('forecastTick' in body?{forecastTick:body.forecastTick}:{optionId:body.optionId}),revision:body.expectedRevision+1,updatedAt:state.serverNow};return Response.json({ok:true});}
  throw Error('Unexpected URL '+url);
 };
 const client=await createClient({source,rules:R,fetch});await waitFor(()=>!client.inspect().draw.busy);
 return {client,events,state,choose(tick){client.node('#forecastTick').value=String(tick);client.node('#forecastTick').oninput();},draws:()=>events.filter(row=>row.url==='/api/market/images/draw'),votes:()=>events.filter(row=>row.url==='/api/market/vote')};
}
function preview(client,key='center'){
 const button=client.node('#curveImages').querySelectorAll('[data-preview-option]').find(button=>button.dataset.previewOption===key);assert.ok(button);button.focus();client.node('#curveImages').onclick({target:button,preventDefault(){},stopPropagation(){}});
}
test('v3 defaults to a valid zero forecast and submits numeric ticks without legacy option IDs',async()=>{
 const f=await fixture();assert.equal(f.client.node('#options').hidden,true);assert.equal(f.client.node('#curvePanel').hidden,false);assert.equal(f.client.inspect().draft.forecastTick,0);assert.equal(f.client.node('#saveVote').disabled,false);
 f.choose(-37);assert.equal(f.client.node('#forecastValue').textContent,'-3.7%');assert.equal(f.votes().length,0);f.client.submit();await waitFor(()=>!f.client.inspect().busy);
 assert.equal(f.votes().length,1);assert.equal(f.votes()[0].body.forecastTick,-37);assert.equal('optionId' in f.votes()[0].body,false);assert.match(f.client.node('#voteStatus').textContent,/-3.7%/);assert.equal(f.client.node('#saveVote').disabled,true);
});
test('all five slots preload only thumbnails once; range changes, resizing and refresh never reload them',async()=>{
 const f=await fixture();assert.deepEqual(f.draws()[0].body,{targetDate:'2027-01-07',layout:'curve-five'});assert.deepEqual(f.client.imageLoads,slots.map(slot=>'/api/market/images/'+slot+'-1/media/thumbnail'));
 assert.equal((f.client.node('#curveImages').innerHTML.match(/<img loading="eager"/g)||[]).length,5,'CSS-hidden slots must load before becoming visible');
 assert.equal((f.client.node('#curveImages').innerHTML.match(/class="curve-image-slot"/g)||[]).length,5);assert.match(f.client.node('#curveImages').innerHTML,/此圖原適用：小跌怡情/);
 const markup=f.client.node('#curveImages').innerHTML,buttons=f.client.node('#curveImages').buttons,requests=f.events.length;
 for(const tick of [-100,-60,-20,0,20,60,100]){f.choose(tick);f.client.resize();}
 assert.equal(f.events.length,requests);assert.equal(f.client.imageLoads.length,5);assert.equal(f.client.node('#curveImages').buttons,buttons);assert.equal(f.client.node('#curveImages').innerHTML,markup);
 await f.client.refresh();assert.equal(f.draws().length,1);assert.equal(f.client.imageLoads.length,5);assert.equal(f.client.node('#curveImages').buttons,buttons);
 await f.client.node('#rerollImages').onclick();await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(f.draws().length,2);assert.equal(f.client.imageLoads.length,10);
});
test('missing media still retains five slots without inventing network loads',async()=>{
 const f=await fixture({blank:true});assert.equal((f.client.node('#curveImages').innerHTML.match(/class="curve-image-slot"/g)||[]).length,5);assert.equal(f.client.imageLoads.length,0);assert.match(f.client.node('#curveImages').innerHTML,/尚無符合圖片/);
});
test('curve preview never changes the forecast, preserves attribution and returns current focus',async()=>{
 const f=await fixture();f.choose(42);const before=f.client.inspect().draft,requests=f.events.length;
 for(let i=0;i<3;i++){preview(f.client);assert.equal(f.client.node('#imagePreviewDialog').open,true);assert.match(f.client.node('#imagePreviewCredit').textContent,/作者 center/);f.client.node('#closeImagePreview').onclick();assert.equal(f.client.active().dataset.previewOption,'center');}
 assert.deepEqual(f.client.inspect().draft,before);assert.equal(f.events.length,requests);preview(f.client);await f.client.refresh();f.client.node('#closeImagePreview').onclick();assert.equal(f.client.active().dataset.previewOption,'center');
 preview(f.client);f.client.view('records');assert.equal(f.client.node('#imagePreviewDialog').open,false);f.client.view('daily');assert.equal(f.client.node('#imagePreviewDialog').open,false);
});
test('each full-size curve image is selected only by its preview click, with no thumbnail reload',async()=>{
 const f=await fixture(),markup=f.client.node('#curveImages').innerHTML;
 assert.ok(f.client.imageLoads.every(url=>url.endsWith('/media/thumbnail')));
 for(const slot of slots){
  const before=f.client.imageLoads.length;preview(f.client,slot);
  assert.equal(f.client.node('#imagePreviewImage').src,'/api/market/images/'+slot+'-1/media');
  assert.equal(f.client.imageLoads.length,before+1);assert.equal(f.client.imageLoads.at(-1),f.client.node('#imagePreviewImage').src);
  f.client.node('#closeImagePreview').onclick();assert.equal(f.client.imageLoads.length,before+1);
 }
 assert.equal(f.client.node('#curveImages').innerHTML,markup);assert.equal(f.draws().length,1);
 assert.equal(f.client.imageLoads.filter(url=>url.endsWith('/thumbnail')).length,5);
});
test('numeric and legacy navigation preserve each scoring contract and draw layout',async()=>{
 const f=await fixture();f.client.round('old');await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(f.client.node('#curvePanel').hidden,true);assert.equal(f.client.node('#options').hidden,false);assert.equal(f.draws().at(-1).body.layout,undefined);assert.equal(f.client.inspect().draft.optionId,'dip');assert.equal(f.client.inspect().draft.forecastTick,undefined);assert.match(f.client.node('#scoreRules').innerHTML,/猜中/);assert.match(f.client.node('#history').innerHTML,/小跌怡情/);
 f.client.round('curve');await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(f.client.inspect().draft.forecastTick,0);assert.equal(f.client.inspect().draft.optionId,undefined);assert.equal(f.draws().at(-1).body.layout,'curve-five');assert.match(f.client.node('#expectation').textContent,/非均勻/);assert.doesNotMatch(f.client.node('#expectation').textContent,/六項/);
});
test('primary curve holds actual outcome fixed, peaks at that forecast and never submits scenario input',async()=>{
 const f=await fixture();f.client.node('#curveActualExample').value='4';f.client.node('#curveActualExample').oninput();assert.match(f.client.node('#curveAxes').textContent,/橫軸：你的預測.*假設收盤 \+4%/);
 const points=f.client.node('#curvePlot').innerHTML.match(/points="([^"]+)"/)[1].split(' ').map(pair=>pair.split(',').map(Number));const peak=points.reduce((best,p,i)=>p[1]<points[best][1]?i:best,0);assert.equal(peak,140);
 f.choose(40);assert.match(f.client.node('#curveSelectedScore').textContent,/目前預測 \+4%/);assert.match(f.client.node('#curveSelectedScore').textContent,/示範，不是已得分/);assert.equal(f.votes().length,0);assert.match(f.client.node('#curveSnapshot').textContent,/不足 30 筆/);assert.match(f.client.node('#curveSnapshot').textContent,/2027/);assert.match(f.client.node('#curveExamples').textContent,/合法預測最低 .* 分，最高 .* 分/);
});
test('settled true outcomes outside range remain truthful and show numeric history',async()=>{
 const f=await fixture({settled:true});f.client.round('curve');await waitFor(()=>!f.client.inspect().draw.busy);assert.equal(f.client.node('#forecastTick').disabled,true);assert.equal(f.client.node('#saveVote').disabled,true);assert.equal(f.client.node('#curveActualControl').hidden,true);assert.match(f.client.node('#curveAxes').textContent,/真實收盤 \+12%/);assert.match(f.client.node('#voteStatus').textContent,/收盤 \+12% · 曲線計分/);
});
test('unknown result, stale revision, cutoff and repeated submit maintain numeric draft safeguards',async()=>{
 let stale=true;const f=await fixture({hook:({url,state})=>{if(url==='/api/market/vote'&&stale){stale=false;state.rounds[0].vote={forecastTick:10,revision:4,updatedAt:state.serverNow};return Response.json({code:'STALE_VOTE',error:'stale'},{status:409});}}});
 f.choose(-21);f.client.submit();await waitFor(()=>!f.client.inspect().busy);assert.equal(f.client.inspect().draft.forecastTick,-21);assert.equal(f.client.inspect().draft.expectedRevision,4);assert.equal(f.client.inspect().draft.optionId,undefined);
 f.client.submit();f.client.submit();await waitFor(()=>!f.client.inspect().busy);assert.equal(f.votes().length,2);assert.equal(f.votes()[1].body.forecastTick,-21);
 f.state.serverNow='2027-01-06T16:00:00Z';await f.client.refresh();assert.equal(f.client.node('#forecastTick').disabled,true);f.choose(99);assert.notEqual(f.client.inspect().draft.forecastTick,99);
});
test('fixed anchor positions and symmetric 1–5 subsets are CSS-only and all controls are named',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../public/market.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../public/market.html'),'utf8');
 assert.match(css,/margin-left:clamp\(0px,calc\(var\(--anchor\) - var\(--card-width\)\/2\),calc\(100% - var\(--card-width\)\)\)/);assert.match(css,/@media\(min-width:901px\) and \(max-width:1100px\).*data-slot="center"/);assert.match(css,/@media\(min-width:651px\) and \(max-width:900px\).*data-slot="fall".*data-slot="rally"/);assert.match(css,/@media\(min-width:441px\) and \(max-width:650px\).*data-slot="crash".*data-slot="center".*data-slot="surge"/);
 assert.doesNotMatch(source,/addEventListener\(['"]resize|onresize|matchMedia/);assert.match(html,/<label for="forecastTick"/);assert.match(html,/id="forecastTick"[^>]*type="range"[^>]*min="-100" max="100" step="1"/);assert.ok(html.indexOf('/market-curve.js')<html.indexOf('/market.js'));assert.match(html,/真實收盤超出 ±10% 時仍用真值計分/);
});


test('closing after a responsive slot disappears restores focus to the numeric slider',async()=>{
 const f=await fixture();preview(f.client,'crash');const button=f.client.node('#curveImages').buttons.find(button=>button.dataset.previewOption==='crash');button.hidden=true;f.client.node('#closeImagePreview').onclick();assert.equal(f.client.active(),f.client.node('#forecastTick'));assert.equal(f.client.node('#imagePreviewDialog').open,false);
});
test('returning from legacy chooses the current numeric preview trigger rather than a hidden old card',async()=>{
 const f=await fixture();f.client.round('old');await waitFor(()=>!f.client.inspect().draw.busy);f.client.round('curve');await waitFor(()=>!f.client.inspect().draw.busy);preview(f.client,'crash');f.client.node('#closeImagePreview').onclick();assert.equal(f.client.active(),f.client.node('#curveImages').buttons.find(button=>button.dataset.previewOption==='crash'));
});


test('responsive anchored cards have nonnegative edge space and at least 8px between neighbors',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../public/market.css'),'utf8');assert.match(css,/--card-width:calc\(40% - 8px\)/);
 for(const [viewport,container,anchors,ratio] of [[390,298,[.5],1],[500,380,[.3,.7],.4],[650,540,[.3,.7],.4],[700,590,[.1,.5,.9],.3],[900,790,[.1,.5,.9],.3],[950,840,[.1,.3,.7,.9],.2],[1100,990,[.1,.3,.7,.9],.2],[1200,1080,[.1,.3,.5,.7,.9],.2]]){
  const width=ratio===1?container:container*ratio-8,boxes=anchors.map(anchor=>{const left=Math.max(0,Math.min(container-width,container*anchor-width/2));return {left,right:left+width};});
  for(let index=0;index<boxes.length;index++){assert.ok(boxes[index].left>=0&&boxes[index].right<=container,`viewport ${viewport} stays inside`);if(index)assert.ok(boxes[index].left-boxes[index-1].right>=7.99,`viewport ${viewport} retains gap`);}
 }
});


test('numeric settlement confirmation shows positive/negative/zero counts and two-decimal points',async()=>{
 const f=await fixture({role:'admin',hook:({url})=>url==='/api/admin/market/preview'?Response.json({targetDate:'2027-01-07',returnPct:1.25,bucket:'curve',voteCount:3,counts:{positive:1,negative:1,zero:1},ownPrevious:0.000001,ownNext:12.345678,ownScoreAfter:20.123456}):undefined});
 f.state.serverNow='2027-01-07T08:00:00Z';await f.client.refresh();f.client.node('#adminRound').value='curve';f.client.node('#adminRound').onchange();const form=f.client.node('#settleForm');form.elements.returnPct.value='1.25';await form.onsubmit({preventDefault(){},target:form});const html=f.client.node('#previewContent').innerHTML;
 assert.match(html,/正分 1 人 · 負分 1 人 · 零分 1 人/);assert.doesNotMatch(html,/undefined|猜中/);assert.match(html,/0\.00 → \+12\.35/);assert.match(html,/\+20\.12 分/);
});


test('Enter in the scenario-only number input cannot implicitly submit a forecast',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/market.html'),'utf8');
 assert.match(html,/<input id="curveActualExample" form="curveScenarioForm" type="number"/);
 assert.match(html,/<form id="curveScenarioForm"[^>]*><\/form>\s*<form id="voteForm">/);
 const f=await fixture(),input=f.client.node('#curveActualExample');input.value='4';input.oninput();
 const draft=f.client.inspect().draft,requests=f.events.length;let prevented=0;
 input.onkeydown({key:'Enter',preventDefault(){prevented++;}});
 f.client.node('#curveScenarioForm').onsubmit({preventDefault(){prevented++;}});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(prevented,2);assert.equal(f.votes().length,0);assert.equal(f.events.length,requests);assert.deepEqual(f.client.inspect().draft,draft);
 f.choose(40);f.client.submit();await waitFor(()=>!f.client.inspect().busy);assert.equal(f.votes().length,1);assert.equal(f.votes()[0].body.forecastTick,40);
});


test('cold thumbnails retry only their source, recover in place and never refetch the draw or successful images',async()=>{
 const f=await fixture(),image=f.client.node('#curveImages').images[2],status=image.nextElementSibling,requests=f.events.length,markup=f.client.node('#curveImages').innerHTML;
 f.client.imageError(image);f.client.imageError(image);assert.equal(f.client.pendingTimers().length,1);assert.equal(f.client.pendingTimers()[0].delay,1000);
 assert.equal(image.hidden,true);assert.equal(status.hidden,false);assert.equal(status.getAttribute('role'),'status');assert.match(status.textContent,/自動重試/);
 f.client.advanceTimers(999);assert.equal(f.client.imageLoads.length,5);f.client.advanceTimers(1);assert.equal(f.client.imageLoads.length,6);assert.equal(f.client.imageLoads.at(-1),'/api/market/images/center-1/media/thumbnail');
 f.client.imageLoaded(image);assert.equal(image.hidden,false);assert.equal(status.hidden,true);assert.equal(f.client.pendingTimers().length,0);
 f.choose(42);f.client.resize();f.client.advanceTimers(60000);assert.equal(f.client.imageLoads.length,6);assert.equal(f.events.length,requests);assert.equal(f.draws().length,1);assert.equal(f.client.node('#curveImages').innerHTML,markup);
});

test('four failed thumbnail retries stop with readable recovery guidance; preview and explicit refresh still work',async()=>{
 const f=await fixture(),image=f.client.node('#curveImages').images[2],status=image.nextElementSibling;
 for(const delay of [1000,3000,10000,30000]){f.client.imageError(image);assert.equal(f.client.pendingTimers().length,1);assert.equal(f.client.pendingTimers()[0].delay,delay);f.client.advanceTimers(delay);}
 f.client.imageError(image);assert.equal(f.client.imageLoads.length,9);assert.equal(f.client.pendingTimers().length,0);assert.equal(status.hidden,false);assert.match(status.textContent,/仍可點擊放大原圖.*更新重試/);assert.equal(image.hidden,true);
 f.client.advanceTimers(120000);f.client.imageError(image);assert.equal(f.client.pendingTimers().length,0);assert.equal(f.client.imageLoads.length,9);
 preview(f.client);assert.equal(f.client.imageLoads.at(-1),'/api/market/images/center-1/media');f.client.node('#closeImagePreview').onclick();
 await f.client.refresh();assert.equal(f.draws().length,1);assert.equal(f.client.pendingTimers().length,1);assert.equal(f.client.pendingTimers()[0].delay,1000);
 f.client.advanceTimers(1000);f.client.imageLoaded(image);assert.equal(image.hidden,false);assert.equal(status.hidden,true);
 const loaded=f.client.imageLoads.length;await f.client.refresh();f.client.advanceTimers(60000);assert.equal(f.client.imageLoads.length,loaded,'refresh must not reload a successful stable thumbnail');
});

for(const action of ['navigation','reroll','round','pagehide','detached'])test('thumbnail retries ignore stale callbacks after '+action,async()=>{
 const f=await fixture(),image=f.client.node('#curveImages').images[2];f.client.imageError(image);const stale=f.client.pendingTimers()[0].callback;
 if(action==='navigation')f.client.view('records');else if(action==='reroll'){f.client.node('#rerollImages').onclick();await waitFor(()=>!f.client.inspect().draw.busy);}else if(action==='round'){f.client.round('old');await waitFor(()=>!f.client.inspect().draw.busy);}else if(action==='pagehide')f.client.pagehide();else image.isConnected=false;
 const loads=f.client.imageLoads.length;stale();f.client.advanceTimers(60000);assert.equal(f.client.imageLoads.length,loads);assert.equal(f.client.pendingTimers().length,0);
});


test('a repeated image in all five slots retains independent retry budgets and recovers every card',async()=>{
 const f=await fixture({hook:({url,body})=>url==='/api/market/images/draw'?Response.json({targetDate:body.targetDate,images:Object.fromEntries(slots.map(slot=>[slot,{id:'shared',authorName:'作者',buckets:['crash','fall','dip','rally','surge'],weekdays:[4]}]))}):undefined});
 const images=f.client.node('#curveImages').images;
 for(const delay of [1000,3000,10000,30000]){
  for(const image of images)f.client.imageError(image);
  assert.equal(f.client.pendingTimers().length,5);assert.ok(f.client.pendingTimers().every(timer=>timer.delay===delay));f.client.advanceTimers(delay);
 }
 for(const image of images){f.client.imageLoaded(image);assert.equal(image.hidden,false);assert.equal(image.nextElementSibling.hidden,true);}
 assert.equal(f.client.pendingTimers().length,0);assert.equal(f.client.imageLoads.length,25);assert.ok(f.client.imageLoads.every(url=>url==='/api/market/images/shared/media/thumbnail'));assert.equal(f.draws().length,1);
});

test('thumbnail success cancels an already scheduled retry without an extra source assignment',async()=>{
 const f=await fixture(),image=f.client.node('#curveImages').images[2];f.client.imageError(image);const queued=f.client.pendingTimers()[0].callback;
 f.client.imageLoaded(image);const count=f.client.imageLoads.length;queued();f.client.advanceTimers(60000);assert.equal(f.client.imageLoads.length,count);assert.equal(f.client.pendingTimers().length,0);assert.equal(image.hidden,false);
});
