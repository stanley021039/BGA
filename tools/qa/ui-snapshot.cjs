/* Actual-browser QA; never run against production.
 * QA_CREDENTIALS_FILE: private JSON { username: { password } }; QA_BASE defaults to forwarded test site.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const base=process.env.QA_BASE||'http://127.0.0.1:13115';
const out=process.env.QA_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'ui-snapshot-'));
if(!process.env.QA_CREDENTIALS_FILE)throw Error('Set QA_CREDENTIALS_FILE to a private test account file');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})});
 const results=[],errors=[];let context,code;
 try{
  for(const [username,a]of Object.entries(JSON.parse(fs.readFileSync(process.env.QA_CREDENTIALS_FILE,'utf8')))){
   if(!a.password)continue;
   const c=await browser.newContext();
   if((await c.request.post(base+'/api/auth/login',{data:{username,password:a.password}})).ok()){context=c;break;}
   await c.close();
  }
  assert.ok(context,'test login unavailable');
  const created=await context.request.post(base+'/api/create',{data:{type:'draw',roomName:'UI snapshot QA'}});
  assert.ok(created.ok(),'create room');code=(await created.json()).code;
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));
  await p.addLocatorHandler(p.locator('#tableMediaConsent[open]'),()=>p.locator('#mediaConsentDecline').click());
  await p.goto(base+'/draw/'+code);await p.locator('.ui-room-controls').waitFor();
  const snapshot=await (await context.request.get(base+'/api/state?code='+code)).json();
  results.push(await p.evaluate(s=>{
   const slots=[['RoomHost','renderSnapshot'],['RoomWaiting','update'],['RoomControls','update'],['SharedChat','updateRoom'],['TableMedia','update'],['GameShell','renderSnapshot']];
   const counts={},originals=[];
   for(const [name,method]of slots){const old=window[name][method],key=name+'.'+method;counts[key]=0;originals.push(()=>window[name][method]=old);window[name][method]=function(...args){counts[key]++;return old.apply(this,args);};}
   try{
    const checks=[];
    function reset(){for(const k of Object.keys(counts))counts[k]=0;}
    function record(check,accepted){checks.push({check,accepted,counts:{...counts}});}
    RoomUI.update(s,next=>RoomUI.update(next));
    reset();record('callback-one-dispatch',RoomUI.acceptSnapshot(s));
    reset();record('same-version-clock-refresh',RoomUI.acceptSnapshot({...s,serverNow:s.serverNow+1}));
    reset();record('older-clock-rejected',RoomUI.acceptSnapshot({...s,serverNow:s.serverNow-1}));
    RoomUI.update({...s,serverNow:s.serverNow+1},()=>{});
    reset();record('callback-skips-render-fallback',RoomUI.acceptSnapshot({...s,serverNow:s.serverNow+2}));
    RoomUI.stop();reset();record('stop-rejects-response',RoomUI.acceptSnapshot(s));
    return {check:'dispatch-contract',checks};
   }finally{for(const restore of originals)restore();}
  },snapshot));
  for(const c of results[0].checks){
   const expected=/rejected|stop-/.test(c.check)?0:1;
   for(const n of Object.values(c.counts))assert.equal(n,expected,c.check);
   assert.equal(c.accepted,expected===1,c.check);
  }
  await p.reload();await p.locator('.ui-room-controls').waitFor();
  await p.evaluate(()=>{window.__socialSnapshots=[];const old=RoomUI.acceptSnapshot;RoomUI.acceptSnapshot=function(s){const accepted=old.call(this,s);window.__socialSnapshots.push({accepted,social:s.social||[],version:s.version});return accepted;};});
  const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/social'&&r.request().method()==='POST');
  const sent=p.evaluate(()=>GameShell.sendEmoji('🔥'));const r=await response;assert.ok(r.ok());const body=await r.json();assert.equal(await sent,true);
  const observed=await p.evaluate(()=>window.__socialSnapshots);
  assert.ok(observed.some(s=>s.accepted&&s.version===body.version),'social response was accepted');
  assert.ok(observed.some(s=>s.social.some(item=>item.emoji==='🔥'||item.message==='🔥')),'social data retained');
  results.push({check:'social-response-after-reload',ok:true});
  results.push({check:'page-errors',errors});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(out);
 }finally{if(context&&code)await context.request.post(base+'/api/leave',{data:{code}}).catch(()=>{});await browser.close();}
})().catch(error=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));console.error(error);process.exitCode=1;});
