const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
const base=process.env.QA_BASE,out=process.env.QA_OUTPUT||fs.mkdtempSync(require('path').join(require('os').tmpdir(),'ui-autosave-wait-'));
if(!base||!process.env.QA_CREDENTIALS_FILE)throw Error('Set QA_BASE and QA_CREDENTIALS_FILE for an isolated test site');
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});let c,code;const errors=[],unhandled=[],requests=[],checks=[];
try{
for(const [username,a]of Object.entries(JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS_FILE,'utf8')))){if(!a.password)continue;const x=await browser.newContext();if((await x.request.post(base+'/api/auth/login',{data:{username,password:a.password}})).ok()){c=x;break;}await x.close();}
assert.ok(c);const r=await c.request.post(base+'/api/create',{data:{type:'draw',roomName:'autosave等待驗收'}});assert.ok(r.ok());code=(await r.json()).code;
const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));await p.addInitScript(()=>{window.__unhandled=[];window.addEventListener('unhandledrejection',e=>window.__unhandled.push(String(e.reason)));});
await p.addLocatorHandler(p.locator('#tableMediaConsent[open]'),()=>p.locator('#mediaConsentDecline').click());await p.goto(base+'/draw/'+code);await p.locator('.ui-room-controls').waitFor();
await p.route('**/api/settings',async route=>{requests.push(route.request().postDataJSON());if(requests.length===1){await new Promise(r=>setTimeout(r,600));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'驗收延遲保存失敗'})});}else await route.continue();});
const first=await p.evaluate(()=>document.querySelector('input[name=seconds]:checked').value==='90'?'60':'90');await Promise.all([p.waitForRequest(r=>new URL(r.url()).pathname==='/api/settings'),p.evaluate(v=>[...document.querySelectorAll('input[name=seconds]')].find(n=>n.value===v).click(),first)]);
// A second valid edit while A is outstanding exercises both the timer waiter and an explicit flush waiter.
await p.evaluate(()=>{const n=[...document.querySelectorAll('input[name=seconds]')].find(n=>n.value==='120');n.checked=true;n.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(250);const state=await p.evaluate(async()=>{await roomSettingsAutoSave.flush();return {pending:roomSettingsAutoSave.pending(),error:roomSettingsAutoSave.error()};});
await p.waitForTimeout(350);const saved=await (await c.request.get(base+'/api/state?code='+code)).json();assert.equal(saved.options.seconds,120);assert.deepEqual(state,{pending:false,error:''});assert.equal(requests.length,2);
checks.push({check:'failed-first-save-queued-retry',savedSeconds:saved.options.seconds,requests:requests.length,...state});
await p.locator('.ui-room-roster-action-button[data-room-action=bot]').click();await p.waitForFunction(()=>document.querySelector('[data-room-action=start]')&&!document.querySelector('[data-room-action=start]').disabled);
await p.locator('[data-room-action=start]').click();await p.waitForFunction(()=>document.body.dataset.roomPhase!=='waiting');checks.push({check:'start-after-successful-retry',phase:await p.evaluate(()=>document.body.dataset.roomPhase)});
unhandled.push(...await p.evaluate(()=>window.__unhandled));assert.deepEqual(errors,[]);assert.deepEqual(unhandled,[]);checks.push({check:'browser-errors',errors,unhandled});
fs.writeFileSync(out+'/results.json',JSON.stringify(checks,null,2));await p.screenshot({path:out+'/after-start.png',fullPage:true});console.log(out);
}finally{if(c&&code)await c.request.post(base+'/api/leave',{data:{code}});await browser.close();}})().catch(e=>{fs.writeFileSync(out+'/failure.json',JSON.stringify({message:e.message,stack:e.stack},null,2));console.error(e);process.exitCode=1;});
