'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {openDatabase}=require('../../src/db'),{createAuth}=require('../../src/auth'),{createApp}=require('../../src/app');
const {chromium}=require('playwright');
// Controlled legal draws keep this UI scenario reproducible, while explosion QA uses natural RNG.
const {QuacksRoom}=require('../../src/games/quacks');QuacksRoom.prototype.index=n=>n===9?6:0;
const output=path.resolve(__dirname,'../../work/qa/quacks-workshop');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const root=fs.mkdtempSync(path.join(output,'data-alchemy-qa-')),dbFile=path.join(root,'app.sqlite'),db=openDatabase(dbFile);
 try{await createAuth(db).bootstrap('alchemy_qa','synthetic-browser-password');}finally{db.close();}
 const app=createApp({host:'127.0.0.1',port:0,dbFile,historyDir:path.join(root,'history'),communityDir:path.join(root,'community'),musicDir:path.join(root,'music'),achievementPurpose:'test',externalSideEffectsEnabled:false,marketAutomationEnabled:false,githubClient:{configured:false}});
 let browser;
 try{
  const {port}=await app.listen(),base='http://127.0.0.1:'+port;
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'msedge'}:{})});
  const owner=await browser.newContext({viewport:{width:1280,height:900}}),peer=await browser.newContext({viewport:{width:1280,height:900}}),contexts=[owner,peer];
for(const ctx of contexts)await ctx.addInitScript(()=>{window.__settlementPlaying=[];const NativeAudio=window.Audio;window.Audio=function(...args){const clip=new NativeAudio(...args);clip.addEventListener('playing',()=>{if(clip.src.includes('quacks-settlement.wav'))window.__settlementPlaying.push({at:performance.now(),volume:clip.volume});});return clip;};window.Audio.prototype=NativeAudio.prototype;});
  async function post(ctx,route,data){const res=await ctx.request.post(base+'/api/'+route,{data});if(!res.ok())throw Error(route+' '+await res.text());return res.json();}
  await post(owner,'auth/login',{username:'alchemy_qa',password:'synthetic-browser-password'});
  const invite=await post(owner,'admin/invites',{});await post(peer,'auth/register',{username:'alchemy_peer',password:'synthetic-browser-password',confirmPassword:'synthetic-browser-password',invite:invite.code});
  const room=await post(owner,'create',{type:'quacks',roomName:'煉金術士介面驗收',alchemists:true,witches:true,hiddenProgress:false}),code=room.code;await post(peer,'join',{code});
  const setupPage=await owner.newPage();await setupPage.addLocatorHandler(setupPage.locator('#tableMediaConsent[open]'),()=>setupPage.locator('#mediaConsentDecline').click());setupPage.on('pageerror',e=>console.error('Setup page error: '+e.message));await setupPage.goto(base+'/quacks/'+code);
const toggle=setupPage.locator('label').filter({hasText:'加入煉金術士擴充'}).locator('input');await toggle.waitFor();

assert.equal(await toggle.isChecked(),true);await toggle.uncheck();
async function awaitSetting(value){for(let n=0;n<30;n++){const st=await (await owner.request.get(base+'/api/state?code='+code)).json();if(st.options.alchemists===value)return;await new Promise(r=>setTimeout(r,150));}throw Error('setting did not auto-save');}
await awaitSetting(false);await toggle.check();await awaitSetting(true);assert.equal(await setupPage.getByRole('button',{name:'保存設定',exact:true}).count(),0);assert.equal(await setupPage.locator('#bookVoting').isVisible(),false);await setupPage.getByRole('button',{name:'設定完成，選藥材書',exact:true}).click();await setupPage.locator('#bookVoting .book-face').first().waitFor();
await setupPage.locator('#bookVoting .book-face').first().hover();await setupPage.locator('#potTooltip').waitFor({state:'visible'});assert.ok((await setupPage.locator('#potTooltip p').innerText()).length>5);
await setupPage.keyboard.press('Escape');assert.equal(await setupPage.locator('#potTooltip').isVisible(),false);
const blue=setupPage.locator('#bookVoting button[data-book-color="blue"][data-book-set="2"]');await blue.click();await setupPage.waitForFunction(()=>document.querySelector('#bookVoting button[data-book-color="blue"][data-book-set="2"]')?.getAttribute('aria-pressed')==='true');assert.equal(await setupPage.locator('#bookVoting .tie-controls').count(),0);await setupPage.waitForFunction(()=>!document.querySelector('#bookVoting .book-card[data-ingredient="blue"] .tie-controls'));const bookPeer=await peer.newPage();await bookPeer.addLocatorHandler(bookPeer.locator('#tableMediaConsent[open]'),()=>bookPeer.locator('#mediaConsentDecline').click());await bookPeer.goto(base+'/quacks/'+code);await bookPeer.locator('#bookVoting button[data-book-color="blue"][data-book-set="3"]').click();await setupPage.waitForFunction(()=>document.querySelector('#bookVoting button[data-book-color="blue"][data-book-set="3"]')?.getAttribute('aria-pressed')==='true');await blue.click();await bookPeer.waitForFunction(()=>document.querySelector('#bookVoting button[data-book-color="blue"][data-book-set="2"]')?.getAttribute('aria-pressed')==='true');assert.equal(await bookPeer.locator('#bookVoting select').count(),0);await bookPeer.close();await setupPage.screenshot({path:path.join(output,'workshop-settings.png'),fullPage:true});await setupPage.getByRole('button',{name:'開始遊戲',exact:true}).click();await setupPage.locator('#alchemy .patient-card').first().waitFor();await setupPage.close();
  const pages=[await owner.newPage(),await peer.newPage()],errors=[];for(const p of pages){await p.addLocatorHandler(p.locator('#tableMediaConsent[open]'),()=>p.locator('#mediaConsentDecline').click());p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/quacks/'+code);await p.evaluate(()=>AudioSettings.set('effects',{enabled:true,volume:.25}));await p.locator('#phase').click();await p.locator('#alchemy .patient-card').first().waitFor();}
  
await pages[0].setViewportSize({width:1440,height:900});
const columns=await pages[0].evaluate(()=>{const f=document.querySelector('.room-stage-friends').getBoundingClientRect(),w=document.querySelector('.room-stage-work').getBoundingClientRect(),c=document.querySelector('.room-stage-chat').getBoundingClientRect();return {friends:f.x,work:w.x,chat:c.x,width:innerWidth,scroll:document.documentElement.scrollWidth};});
assert.ok(columns.friends<columns.work&&columns.work<columns.chat,JSON.stringify(columns));assert.ok(columns.scroll<=columns.width+1);
assert.equal(await pages[0].locator('.player-card').count(),0);
const badgePlace=await pages[0].evaluate(()=>{const pot=document.querySelector('#cauldron').getBoundingClientRect(),badge=document.querySelector('#potBadge').getBoundingClientRect();return {potBottom:pot.bottom,badgeTop:badge.top,potLeft:pot.left,badgeLeft:badge.left};});assert.ok(badgePlace.badgeTop>=badgePlace.potBottom);assert.ok(Math.abs(badgePlace.badgeLeft-badgePlace.potLeft)<2);assert.equal(await pages[0].locator('#potBadge').getByText('準備選擇',{exact:true}).count(),0);
const toolbarPlace=await pages[0].evaluate(()=>{const panel=document.querySelector('.cauldron-panel').getBoundingClientRect(),pot=document.querySelector('#cauldron').getBoundingClientRect(),tools=document.querySelector('.pot-toolbar').getBoundingClientRect();return {gap:pot.top-panel.top,toolsTop:tools.top,potBottom:pot.bottom};});assert.ok(toolbarPlace.gap<24,JSON.stringify(toolbarPlace));assert.ok(toolbarPlace.toolsTop>=toolbarPlace.potBottom);
await pages[0].locator('#alchemy .essence-vessel').first().hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip').innerText()).includes('每種彩色'));await pages[0].keyboard.press('Escape');await pages[0].locator('#alchemy [data-essence="3"]').first().hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip').innerText()).includes('第 3 格'));
await pages[0].keyboard.press('Escape');
await pages[0].screenshot({path:path.join(output,'workshop-desktop.png'),fullPage:true});await pages[0].locator('.score-panel').click();await pages[0].locator('#scoreZoom').waitFor({state:'visible'});assert.equal(await pages[0].locator('#scoreZoom .score-pawn').count(),2);await pages[0].locator('#scoreZoom').screenshot({path:path.join(output,'scoreboard-expanded.png')});await pages[0].keyboard.press('Escape');assert.equal(await pages[0].locator('#scoreZoom').isVisible(),false);
await pages[0].setViewportSize({width:1280,height:900});

  await pages[0].evaluate(()=>{document.documentElement.setAttribute('data-color-scheme','dark');scrollTo(0,0);});await pages[0].waitForTimeout(150);await pages[0].screenshot({path:path.join(output,'workshop-dark-desktop.png'),fullPage:true});
  await pages[0].setViewportSize({width:1440,height:1400});await pages[0].locator('.cauldron-panel').scrollIntoViewIfNeeded();await pages[0].waitForTimeout(150);await pages[0].screenshot({path:path.join(output,'workshop-dark-pot.png')});await pages[0].locator('.pot-details').screenshot({path:path.join(output,'lower-left-resources.png')});
  await pages[0].setViewportSize({width:390,height:844});
  const mobile=await pages[0].evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:document.querySelectorAll('#alchemy .patient-card').length}));
  assert.ok(mobile.scroll<=mobile.width+1,JSON.stringify(mobile));assert.equal(mobile.cards,3);
  await pages[0].screenshot({path:path.join(output,'alchemy-patients-mobile.png'),fullPage:true});
  await pages[0].setViewportSize({width:1280,height:900});
  await pages[0].locator('#alchemy .patient-card button').first().click();await pages[1].locator('#alchemy .patient-card button').first().click();
  async function state(ctx){return (await ctx.request.get(base+'/api/state?code='+code)).json();}
  async function action(ctx,s,name,extra={}){return post(ctx,'action',{code,action:name,roundId:s.roundId,requestId:randomUUID(),...extra});}
  let current=await state(owner),n=0;
  while(!(current.phase==='settlement'&&current.stage==='essence')){
   assert.ok(++n<130,'reaches essence');
   for(const ctx of contexts){const s=await state(ctx),m=s.mine;
    if(m.pending){const q=m.pending,o=q.options.find(o=>!o.disabled);await action(ctx,s,'choice',{choiceId:q.id,optionId:o.id});}
    else if(s.phase==='fortune'&&s.me===s.roundStarterId)await action(ctx,s,'draw-fortune');
    else if(s.phase==='brewing'&&m.canDraw){
 if(ctx===owner){const control=pages[0].locator(m.draws?'#controls .stop-action':'#controls .draw-action');await control.waitFor();if(!m.draws){await control.hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip').innerText()).includes('繼續抽藥'));
 const where=await control.evaluate(el=>({parent:el.closest('.cauldron-panel')!==null,icon:el.dataset.uiIcon}));assert.deepEqual(where,{parent:true,icon:'draw-bag'});
 await pages[0].locator('#witches .witch-slot').first().hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});
 await pages[0].screenshot({path:path.join(output,'pot-circle-controls.png'),fullPage:true});
 const drawRect=await pages[0].locator('#controls .draw-action').boundingBox(),stopRect=await pages[0].locator('#controls .stop-action').boundingBox();assert.ok(Math.abs(drawRect.y-stopRect.y)<4,'draw and stop share one row');assert.equal(drawRect.width,stopRect.width);assert.equal(drawRect.height,stopRect.height);assert.equal(drawRect.width,66);assert.equal(drawRect.height,64);await pages[0].keyboard.press('Escape');await pages[0].locator('.pot-action-dock').screenshot({path:path.join(output,'neon-action-dock.png')});}
 await control.click();await pages[0].waitForTimeout(50);if(!m.draws){await pages[0].screenshot({path:path.join(output,'brewing-pot-visible.png')});const visible=await pages[0].locator('#cauldron').boundingBox();assert.ok(visible.y>=-2&&visible.y+visible.height<=900,JSON.stringify(visible));assert.ok(visible.height>630,JSON.stringify(visible));assert.equal((await pages[0].locator('#customizePot').boundingBox()).width,28);}
 }else await action(ctx,s,m.draws?'stop':'draw',{step:s.step});
 }
    else if(s.phase==='brewing'&&s.stage==='reserves'){const c=m.reserve[0];await action(ctx,s,c?'reserve':'reserve-done',c?{chipId:c.id}:{});}
    else if(s.phase==='settlement'&&s.stage==='witches'&&!m.ready)await action(ctx,s,'settle-ready');
   }
   current=await state(owner);
  }
  await pages[0].locator('#alchemy [data-quacks-action][data-blocked="false"]').first().waitFor();const essenceState=await state(owner);assert.equal(essenceState.mine.alchemy.essence,essenceState.mine.alchemy.max);assert.ok((await pages[0].locator('#alchemy .essence-flask').getAttribute('aria-label')).includes('第'+essenceState.mine.alchemy.max+'格'));await pages[0].locator('#alchemy .essence-vessel').hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip').innerText()).includes('本回合彩色'));await pages[0].keyboard.press('Escape');assert.equal(await pages[0].locator('#alchemy').getByText('滑過格位查看獎勵。',{exact:true}).count(),0);assert.equal(await pages[0].locator('#alchemy .alchemy-summary p').count(),0);assert.equal(await pages[0].locator('#scoreboard [data-milestone="6"] .ingredient-token').count(),0);assert.equal(await pages[0].locator('#scoreboard [data-milestone="6"]').count(),1);
  assert.ok((await pages[0].locator('#alchemy .essence-flask').boundingBox()).width<=400);assert.equal(await pages[0].locator('#alchemy .alchemy-summary').evaluate(n=>getComputedStyle(n).justifyContent),'flex-start');await pages[0].screenshot({path:path.join(output,'alchemy-essence-desktop.png'),fullPage:true});
  
await pages[0].locator('#potTabs button').nth(1).click();assert.ok((await pages[0].locator('#potBadge').innerText()).includes('alchemy_peer'));
await pages[0].locator('#potTabs button').first().click();
await pages[0].locator('#cauldron .pot-space').first().hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip').innerText()).includes('金幣'));
await pages[0].keyboard.press('Escape');
await pages[0].locator('#bagButton').click();await pages[0].locator('#peekBag').click();await pages[0].locator('#bag .bag-item').first().waitFor();await pages[0].locator('#bag .bag-item').first().hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip p').innerText()).length>3);await pages[0].locator('#closeBag').click();
await pages[0].locator('#customizePot').click();await pages[0].locator('#potNameInput').fill('介面驗收鍋');await pages[0].locator('#savePotName').click();await pages[0].locator('#closeCustomize').click();await pages[0].locator('#potHeading').filter({hasText:'介面驗收鍋'}).waitFor();
await pages[0].locator('#gameFocusToggle').click();
  assert.equal(await pages[0].evaluate(()=>window.GameFocus.isActive()),true);
  assert.equal(await pages[0].locator('#alchemy').isVisible(),true);
  assert.equal(await pages[0].locator('.site-header').isVisible(),false);assert.equal(await pages[0].locator('.room-stage-friends').isVisible(),false);assert.equal(await pages[0].locator('.room-stage-chat').isVisible(),false);
  await pages[0].screenshot({path:path.join(output,'alchemy-essence-focus.png'),fullPage:true});
  await pages[0].waitForTimeout(800);const audioBefore=await pages[0].evaluate(()=>__settlementPlaying.length);
await pages[0].locator('#alchemy [data-quacks-action][data-blocked="false"]').first().click();await pages[0].waitForFunction(n=>__settlementPlaying.length>n,audioBefore);assert.equal((await state(owner)).stage,'essence');
  await pages[1].locator('#alchemy [data-quacks-action][data-blocked="false"]').first().waitFor();await pages[1].locator('#alchemy [data-quacks-action][data-blocked="false"]').first().click();
  await pages[0].locator('#phase').filter({hasText:'獎勵骰'}).waitFor();
  await pages[0].locator('#gameFocusToggle').click();assert.equal(await pages[0].evaluate(()=>window.GameFocus.isActive()),false);
  
let purchasedVerified=false;let finished=await state(owner),settlementLoops=0;while(finished.phase!=='between'){
 assert.ok(++settlementLoops<100);for(const ctx of contexts){const s=await state(ctx),m=s.mine;if(m.pending){const q=m.pending,o=q.options.find(o=>!o.disabled);await action(ctx,s,'choice',{choiceId:q.id,optionId:o.id});}
 else if(s.phase==='settlement'&&!m.ready){if(s.stage==='bonus')await action(ctx,s,m.bonusEligible&&!m.bonusRolled?'roll-bonus':'bonus-ready');else if(s.stage==='effects-confirm'){if(ctx===owner){await pages[0].locator('.settlement-effects').waitFor();assert.equal(await pages[0].locator('.settlement-effects .ingredient-token').count(),3);assert.match(await pages[0].locator('.settlement-effects').innerText(),/^[\d\s]*$/);await pages[0].locator('.settlement-effects span').first().hover();await pages[0].locator('#potTooltip').waitFor({state:'visible'});assert.ok((await pages[0].locator('#potTooltip').innerText()).includes('結算效果'));await pages[0].keyboard.press('Escape');}await action(ctx,s,'confirm-effects');}else if(s.stage==='rewards')await action(ctx,s,'reward',{mode:'score'});else if(s.stage==='shopping'){if(ctx===owner&&!purchasedVerified){const offer=s.books.flatMap(b=>b.offers.map(o=>({...o,color:b.color}))).find(o=>o.price<=m.budget);assert.ok(offer&&m.canBuy);const target=pages[0].locator('#controls button[data-purchase-color="'+offer.color+'"][data-purchase-value="'+offer.value+'"]');await target.waitFor();await target.waitFor({state:'visible'});await pages[0].waitForFunction(sel=>!document.querySelector(sel)?.disabled,'#controls button[data-purchase-color="'+offer.color+'"][data-purchase-value="'+offer.value+'"]');const columns=await pages[0].locator('.purchase-grid').first().evaluate(n=>({display:getComputedStyle(n).display,columns:getComputedStyle(n).gridTemplateColumns.split(' ').length,children:n.children.length,height:n.getBoundingClientRect().height}));assert.equal(columns.display,'grid');assert.ok(columns.columns>=2,JSON.stringify(columns));await pages[0].locator('.purchase-grid').first().screenshot({path:path.join(output,'compact-ingredient-market.png')});await target.click();await pages[0].waitForFunction(sel=>document.querySelector(sel)?.getAttribute('aria-pressed')==='true','#controls button[data-purchase-color="'+offer.color+'"][data-purchase-value="'+offer.value+'"]');const bought=await state(owner);assert.equal(bought.mine.budget,m.budget-offer.price);await target.click();await pages[0].waitForFunction(sel=>document.querySelector(sel)?.getAttribute('aria-pressed')==='false','#controls button[data-purchase-color="'+offer.color+'"][data-purchase-value="'+offer.value+'"]');assert.equal((await state(owner)).mine.budget,m.budget);await pages[0].getByRole('button',{name:'水滴前進 1 格',exact:true}).waitFor();assert.equal(await pages[0].getByRole('button',{name:'水滴前進 1 格',exact:true}).locator('svg.droplet').count(),1);assert.equal(await pages[0].getByRole('button',{name:'補滿藥水瓶',exact:true}).locator('svg.potion').count(),1);purchasedVerified=true;}await action(ctx,s,'shop-ready');}}
 }finished=await state(owner);
}
assert.equal(purchasedVerified,true);await pages[0].waitForTimeout(1500);assert.ok(await pages[0].evaluate(()=>__settlementPlaying.length>=4));assert.ok(await pages[1].evaluate(()=>__settlementPlaying.length>=2));await pages[0].getByRole('button',{name:'下一回合',exact:true}).waitFor();await pages[0].getByRole('button',{name:'下一回合',exact:true}).click();await pages[0].locator('#phase').filter({hasText:'第 2 回合'}).waitFor();

let potionVerified=false;
for(let attempt=0;attempt<5&&!potionVerified;attempt++){
 const potionRoom=await post(owner,'create',{type:'quacks',roomName:'藥水瓶圖示驗收',alchemists:false,witches:false});const pc=potionRoom.code;await post(peer,'join',{code:pc});await post(owner,'start',{code:pc});
 const ps=async ctx=>(await ctx.request.get(base+'/api/state?code='+pc)).json(),pa=(ctx,st,name,extra={})=>post(ctx,'action',{code:pc,action:name,roundId:st.roundId,requestId:randomUUID(),...extra});
 for(let step=0;step<40&&!potionVerified;step++){
  let st=await ps(owner);
  if(st.mine.canPotion){
   const potionPage=await owner.newPage();await potionPage.addLocatorHandler(potionPage.locator('#tableMediaConsent[open]'),()=>potionPage.locator('#mediaConsentDecline').click());potionPage.on('pageerror',e=>errors.push(e.message));await potionPage.addInitScript(()=>{window.__potionPlaying=0;const NativeAudio=window.Audio;window.Audio=function(...args){const audio=new NativeAudio(...args);audio.addEventListener('playing',()=>{if(audio.src.includes('quacks-potion.wav'))window.__potionPlaying++;});return audio;};window.Audio.prototype=NativeAudio.prototype;});await potionPage.goto(base+'/quacks/'+pc);await potionPage.evaluate(()=>AudioSettings.set('effects',{enabled:true,volume:.25}));const pb=potionPage.locator('#controls .potion-action');await pb.waitFor();assert.equal(await pb.locator('svg.potion').count(),1);const three=await potionPage.locator('#controls .quacks-dock-button').evaluateAll(list=>list.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));assert.equal(three.length,3);assert.ok(three.every(x=>x.width===66&&x.height===64),JSON.stringify(three));await pb.hover();await potionPage.locator('#potTooltip').waitFor({state:'visible'});assert.ok((await potionPage.locator('#potTooltip').innerText()).includes('白色炸彈'));await potionPage.keyboard.press('Escape');await potionPage.locator('.pot-action-dock').screenshot({path:path.join(output,'neon-potion-controls.png')});const before=await ps(owner);await pb.click();for(let n=0;n<20;n++){st=await ps(owner);if(!st.mine.potion)break;await potionPage.waitForTimeout(100);}assert.equal(st.mine.potion,false);assert.equal(st.recipes.find(p=>p.id===st.me).bagCount,before.recipes.find(p=>p.id===before.me).bagCount+1);await potionPage.waitForFunction(()=>window.__potionPlaying===1);await potionPage.waitForTimeout(1300);assert.equal(await potionPage.evaluate(()=>window.__potionPlaying),1);await potionPage.close();potionVerified=true;break;
  }
  if(st.phase==='settlement'||st.phase==='between')break;
  for(const ctx of contexts){st=await ps(ctx);if(st.mine.pending){const q=st.mine.pending,o=q.options.find(o=>!o.disabled);await pa(ctx,st,'choice',{choiceId:q.id,optionId:o.id});}else if(st.phase==='fortune'&&st.me===st.roundStarterId)await pa(ctx,st,'draw-fortune');else if(st.phase==='brewing'&&st.mine.canDraw)await pa(ctx,st,'draw',{step:st.step});}
 }
}
assert.ok(potionVerified,'basic potion button returns a white bomb');

const uiPage=await owner.newPage();let fixtureMode='glow',returned=null;const stable=await state(owner);
function fixtureState(){const s=structuredClone(stable);s.version=stable.version+1000+(returned?1:0);s.phase=fixtureMode==='glow'?'settlement':'brewing';s.stage=fixtureMode==='glow'?'effects-confirm':'drawing';s.round=2;s.mine.ready=false;s.mine.pending=null;s.mine.canDraw=false;s.mine.effectSummary=[{color:'black',text:'水滴 +1',triggered:true},{color:'green',text:'紅寶石 +1',triggered:true},{color:'purple',text:'未觸發',triggered:false}];s.mine.alchemy.returnable=fixtureMode==='return'&&!returned?[{id:'return-blue',color:'blue',value:2},{id:'return-green',color:'green',value:1}]:[];return s;}
await uiPage.route('**/api/state?*',route=>route.fulfill({json:fixtureState()}));
await uiPage.route('**/api/action',async route=>{returned=route.request().postDataJSON();await route.fulfill({json:fixtureState()});});
await uiPage.addLocatorHandler(uiPage.locator('#tableMediaConsent[open]'),()=>uiPage.locator('#mediaConsentDecline').click());await uiPage.goto(base+'/quacks/'+code);
await uiPage.locator('.settlement-effects [data-effect-color=black]').waitFor();assert.equal(await uiPage.locator('.settlement-effects .effect-triggered').count(),2);
assert.equal(await uiPage.locator('.settlement-effects [data-effect-color=purple]').evaluate(n=>getComputedStyle(n).boxShadow),'none');
assert.notEqual(await uiPage.locator('.settlement-effects [data-effect-color=green]').evaluate(n=>getComputedStyle(n).boxShadow),'none');
await uiPage.locator('.settlement-effects').screenshot({path:path.join(output,'triggered-effects-glow.png')});
fixtureMode='return';await uiPage.reload();const returnButton=uiPage.locator('[data-return-chip="return-blue"]');await returnButton.waitFor();
assert.equal(await returnButton.locator('.ingredient-token').count(),1);assert.equal(await returnButton.locator('svg.essence').count(),1);assert.equal(await returnButton.getAttribute('aria-label'),'收回 烏鴉頭骨 2（花2格特效藥）');
assert.match((await returnButton.innerText()).replace(await returnButton.locator('.ui-sr-only').innerText(),'').trim(),/^2\s*2$/);assert.equal(await returnButton.locator('.ui-sr-only').evaluate(n=>getComputedStyle(n).clip),'rect(0px, 0px, 0px, 0px)');await returnButton.hover();await uiPage.locator('#potTooltip').waitFor({state:'visible'});assert.ok((await uiPage.locator('#potTooltip').innerText()).includes('消耗 2 格'));
await uiPage.keyboard.press('Escape');await uiPage.locator('.alchemy-return-choices').screenshot({path:path.join(output,'icon-only-returns.png')});await returnButton.click();assert.equal(returned.action,'alchemy-return');assert.equal(returned.chipId,'return-blue');await uiPage.close();

const bluff=await post(owner,'create',{type:'bluff',roomName:'左右版型驗收'});await post(peer,'join',{code:bluff.code});await post(owner,'bot',{code:bluff.code});await post(owner,'start',{code:bluff.code});
const bp=await owner.newPage();await bp.addLocatorHandler(bp.locator('#tableMediaConsent[open]'),()=>bp.locator('#mediaConsentDecline').click());bp.on('pageerror',e=>errors.push(e.message));await bp.goto(base+'/bluff/'+bluff.code);await bp.locator('.room-stage-work').waitFor();

assert.equal(await bp.locator('.room-stage-friends #players').count(),1);assert.equal(await bp.locator('.room-stage-chat .shared-chat').count(),1);
await bp.setViewportSize({width:390,height:844});assert.ok(await bp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await bp.screenshot({path:path.join(output,'bluff-workshop-mobile.png'),fullPage:true});await bp.close();
assert.deepEqual(errors,[]);

  fs.writeFileSync(path.join(output,'alchemy-browser-evidence.json'),JSON.stringify({at:new Date().toISOString(),headlessEdge:true,mobile,columns,hoverHints:true,potSwitch:true,bagTooltip:true,potName:true,patients:current.patients.map(p=>p.name),focus:true,patientClicks:true,essenceClicks:true,sharedBookClicks:true,peerSelectionSynced:true,nativeStart:true,purchaseGrid:true,scoreZoom:true,potionNativePlaying:1,settlementNativePlaying:await pages[0].evaluate(()=>__settlementPlaying.length),effectGlowFixture:true,returnIconsFixture:true,largerPot:true,essenceWidthMax400:true,brewingPotVisible:true,errors},null,2));
  console.log(JSON.stringify({passed:true,mobile,focus:true,errors}));
 }finally{await browser?.close();await app.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
