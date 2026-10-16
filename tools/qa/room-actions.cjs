const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Run against an isolated test site with an admin account supplied in a private file.
// QA_BASE, QA_CREDENTIALS_FILE are required; QA_OUTPUT defaults to an OS temp folder.
const base=process.env.QA_BASE,out=process.env.QA_OUTPUT||fs.mkdtempSync(path.join(require('node:os').tmpdir(),'room-actions-'));
if(!base||!process.env.QA_CREDENTIALS_FILE)throw Error('Set QA_BASE and QA_CREDENTIALS_FILE for an isolated test site');
fs.mkdirSync(out,{recursive:true});
const results=[],errors=[];results.push=(...items)=>{console.log(items.map(i=>i.check).join(','));return Array.prototype.push.apply(results,items);};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'chrome'}:{})});const contexts=[],rooms=[];let qaUserId=null;
 async function post(ctx,route,data){const r=await ctx.request.post(base+'/api/'+route,{data});assert.ok(r.ok(),route+' '+r.status());return r.json();}
 async function state(ctx,code){return (await ctx.request.get(base+'/api/state?code='+code)).json();}
 try{
  const candidates=Object.entries(JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS_FILE,'utf8')));
  for(const [username,account]of candidates.filter(([,a])=>a.password)){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   const r=await context.request.post(base+'/api/auth/login',{data:{username,password:account.password}});
   if(r.ok()){contexts.push(context);break;}await context.close();
  }
  assert.equal(contexts.length,1,'known preview login unavailable');const owner=contexts[0],peer=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(peer);owner.setDefaultTimeout(12000);peer.setDefaultTimeout(12000);
  const invite=await post(owner,'admin/invites',{});const syntheticPassword=require('node:crypto').randomBytes(18).toString('hex');const qaUser=await post(peer,'auth/register',{username:'aq_'+Date.now(),displayName:'操作驗收',password:syntheticPassword,confirmPassword:syntheticPassword,invite:invite.code});qaUserId=qaUser.id;
  const room=await post(owner,'create',{type:'quacks',roomName:'房間操作接線驗收',witches:true}),code=room.code;rooms.push(code);await post(peer,'join',{code});
  const p=await owner.newPage(),q=await peer.newPage();
  for(const page of [p,q]){page.on('pageerror',e=>errors.push(e.message));await page.addLocatorHandler(page.locator('#tableMediaConsent[open]'),()=>page.locator('#mediaConsentDecline').click());await page.goto(base+'/quacks/'+code);await page.locator('.ui-room-controls').waitFor();}
  const primary=p.locator('[data-room-action=start]');await primary.waitFor({state:'visible'});await p.waitForTimeout(600);
  results.push({check:'initial',primary:(await primary.innerText()).trim(),hiddenActions:await p.locator('[data-room-native-action=start],#controls [data-do=bot]').count(),peerPrimaryDisabled:await q.locator('[data-room-action=start]').isDisabled()});
  assert.equal(await p.locator('[data-room-native-action=start]').count(),0);assert.equal(await q.locator('[data-room-action=start]').isDisabled(),true);
  const geometry=()=>p.evaluate(()=>{const box=document.querySelector('.ui-room-controls').getBoundingClientRect(),row=document.querySelector('.ui-room-session-actions').getBoundingClientRect();return {x:box.x,y:box.y+scrollY,width:box.width,height:box.height,rowY:row.y+scrollY,rowHeight:row.height,overflow:document.documentElement.scrollWidth>innerWidth+1};});
  results.push({check:'initial-geometry',value:await geometry()});
  await p.screenshot({path:path.join(out,'desktop-waiting.png'),fullPage:true});
  await primary.click();await p.locator('#bookDialog').waitFor({state:'visible'});await p.locator('#bookDialog [data-q-close]').click();await p.waitForTimeout(300);
  assert.match(await primary.innerText(),/開始遊戲/);assert.equal(await primary.evaluate(n=>n===document.activeElement),true);results.push({check:'prepare-and-focus',ok:true,value:await geometry()});
  // The real shared button must not depend on a native label, handler or DOM mutation scan.
  await p.evaluate(()=>{const n=document.createElement('button');n.id='start';n.textContent='開始偽裝按鈕';n.onclick=()=>{throw Error('legacy action used');};document.querySelector('#controls').append(n);});
  // Save failure must leave the game waiting and prevent the prepare/start continuation.
  let settingsRequests=0;await p.route('**/api/settings',async route=>{settingsRequests++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'驗收用設定儲存失敗'})});});
  const checkbox=p.locator('[data-quacks-setting=hiddenProgress]');await checkbox.check();await p.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('驗收用設定儲存失敗'));
  await primary.click();await p.waitForTimeout(200);assert.equal((await state(owner,code)).phase,'waiting');assert.equal(await p.locator('#bookDialog').isVisible(),false);results.push({check:'save-failure',ok:true,requests:settingsRequests,value:await geometry()});await p.unroute('**/api/settings');
  await checkbox.uncheck();await p.waitForTimeout(500);await checkbox.check();await p.waitForFunction(()=>!document.querySelector('#feedback').textContent);await p.waitForTimeout(400);
  await primary.click();await p.locator('#bookDialog').waitFor({state:'visible'});await p.locator('#bookDialog [data-q-close]').click();
  // Delay a real request to measure pending layout and prevent repeated submissions.
  let botRequests=0;await p.route('**/api/bot',async route=>{botRequests++;await new Promise(r=>setTimeout(r,700));await route.continue();});
  const bot=p.locator('.ui-room-roster-action-button[data-room-action=bot]');const before=await geometry();await bot.click();
  await p.waitForTimeout(100);const pending=await geometry();assert.equal(await primary.isDisabled(),true);assert.equal(await bot.isDisabled(),true);
  await bot.evaluate(n=>{n.click();n.click();});await p.waitForTimeout(1100);assert.equal(botRequests,1);assert.deepEqual(pending,before);assert.deepEqual(await geometry(),before);results.push({check:'pending-single-submit',ok:true,before,pending,after:await geometry()});await p.unroute('**/api/bot');
  for(const width of [390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(300);const g=await geometry();assert.equal(g.overflow,false);const mobileBot=p.locator('.ui-room-roster-action-button[data-room-action=bot]');await p.route('**/api/bot',async route=>{await new Promise(r=>setTimeout(r,400));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'驗收操作失敗訊息'.repeat(14)})});});await mobileBot.click();await p.waitForTimeout(80);assert.deepEqual(await geometry(),g);await p.waitForTimeout(600);assert.deepEqual(await geometry(),g);await p.unroute('**/api/bot');results.push({check:'mobile-'+width,value:g,pendingAndErrorStable:true});await p.screenshot({path:path.join(out,'mobile-'+width+'.png'),fullPage:true});}
  await p.setViewportSize({width:1440,height:1000});let starts=0;await p.route('**/api/start',async route=>{starts++;await new Promise(r=>setTimeout(r,500));await route.continue();});
  await primary.click();await primary.evaluate(n=>n.click());await p.waitForFunction(()=>document.body.dataset.roomPhase!=='waiting');assert.equal(starts,1);assert.notEqual((await state(owner,code)).phase,'waiting');results.push({check:'start-single-submit',ok:true,phase:(await state(owner,code)).phase});
  await p.screenshot({path:path.join(out,'desktop-playing.png'),fullPage:true});
  await post(peer,'leave',{code});await p.waitForFunction(()=>document.body.dataset.roomPhase==='finished');assert.equal(await primary.isVisible(),true);results.push({check:'finished-visible',ok:true});await p.reload();await p.locator('[data-room-action=start]').waitFor({state:'visible'});await p.locator('[data-room-action=start]').click();await p.locator('#bookDialog').waitFor({state:'visible'});await p.locator('#bookDialog [data-q-close]').click();assert.equal(await p.locator('[data-room-action=start]').isEnabled(),true);await p.locator('[data-room-action=start]').click();await p.waitForFunction(()=>document.body.dataset.roomPhase!=='finished');results.push({check:'finished-reload-restart',ok:true});
  const legacy=await post(owner,'create',{type:'poker',roomName:'舊接線相容驗收'});rooms.push(legacy.code);const l=await owner.newPage();l.on('pageerror',e=>errors.push(e.message));await l.addLocatorHandler(l.locator('#tableMediaConsent[open]'),()=>l.locator('#mediaConsentDecline').click());await l.goto(base+'/poker/'+legacy.code);await l.locator('.ui-room-controls').waitFor();assert.equal(await l.locator('[data-room-action=start]').isDisabled(),true);await l.locator('.ui-room-roster-action-button[data-room-common-action=bot]').click();await l.waitForFunction(()=>document.querySelectorAll('.ui-room-roster-card[data-player-id]').length>=2);await l.locator('[data-room-action=start]').click();await l.waitForFunction(()=>document.body.dataset.roomPhase!=='waiting');results.push({check:'legacy-poker',ok:true});
  assert.deepEqual(errors,[]);results.push({check:'page-errors',errors});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{for(const code of rooms){for(const ctx of contexts)try{await ctx.request.post(base+'/api/leave',{data:{code}});}catch{}}if(qaUserId&&contexts[0])await contexts[0].request.post(base+'/api/admin/users/disable',{data:{userId:qaUserId,disabled:true}});await browser.close();}
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,stack:e.stack,results,errors},null,2));console.error(e.message);process.exitCode=1;});
