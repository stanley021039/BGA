'use strict';
// Isolated Chromium fixture: production markup/styles/controllers, synthetic room and leave responses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,'public',p),'utf8');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const mode of ['common','fallback'])for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:844,height:390}])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport,colorScheme:theme}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const styles=['shared/ui-foundation.css','shared/ui-primitives.css','shared/playful-theme.css','shared/room-controls.css','shared/ui-widgets.css'].map(read).join('\n');
  await page.route('http://127.0.0.1/**',async r=>{if(new URL(r.request().url()).pathname==='/assets/room-leave-thumbnail.jpg')return r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(root,'public/assets/room-leave-thumbnail.jpg'))});return r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body data-visual-theme="playful"><a id="trigger" href="/">返回大廳</a></body></html>'});});
  await page.goto('http://127.0.0.1/draw/ABC123');await page.evaluate(theme=>{document.documentElement.dataset.colorScheme=theme;window.__calls=[];window.__fail=true;window.__forgot=[];window.RoomReconnect={forget:c=>__forgot.push(c)};window.fetch=async(url,options)=>{__calls.push({url,body:JSON.parse(options.body)});return {ok:!__fail,json:async()=>__fail?{code:'UNAVAILABLE',error:'測試暫時失敗'}:{}}};},theme);
  for(const file of ['shared/ui-components.js','shared/ui-widgets.js'])await page.addScriptTag({content:read(file)});
  if(mode==='common'){await page.addScriptTag({content:read('shared/room-controls.js')});await page.evaluate(()=>RoomControls.update({code:'ABC123',me:'ME',type:'draw',phase:'drawing',version:1}));}
  else{const source=read('shared/game-shell.js');await page.addScriptTag({content:"(()=>{let state={code:'ABC123'};function feedback(message){window.__error=message;}"+source.slice(source.indexOf(' if(!window.RoomControls){'),source.indexOf(" const library=document.createElement('dialog')"))+'})();'});}
  const trigger=page.locator('#trigger'),dialog=page.locator('.room-leave-dialog'),confirm=dialog.getByRole('button',{name:'確認離開',exact:true}),cancel=dialog.getByRole('button',{name:'留在房間',exact:true});
  await trigger.click();await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('.ui-room-leave-thumbnail').naturalWidth===640);
  const layout=await dialog.evaluate(n=>{const r=n.getBoundingClientRect(),img=n.querySelector('img'),i=img.getBoundingClientRect(),content=n.querySelector('.ui-dialog-content');return {inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,imageInside:i.left>=r.left&&i.right<=r.right,ratio:i.width/i.height,overflow:content.scrollWidth>content.clientWidth,framed:!!n.querySelector('.ui-dialog-footer'),alt:img.alt};});
  assert(layout.inside&&layout.imageInside&&!layout.overflow&&layout.framed);assert(Math.abs(layout.ratio-640/361)<0.01);assert.match(layout.alt,/虎頭蛇尾/);
  if(mode==='common'&&theme==='light'&&viewport.height>400){const out=path.join(root,'.local/leave-thumbnail');fs.mkdirSync(out,{recursive:true});await dialog.screenshot({path:path.join(out,viewport.width+'.png')});}
  await cancel.click();assert.equal(await page.evaluate(()=>__calls.length),0);assert(await trigger.evaluate(n=>document.activeElement===n));
  await trigger.click();await page.keyboard.press('Escape');assert(!await dialog.evaluate(n=>n.open));assert.equal(await page.evaluate(()=>__calls.length),0);
  await trigger.click();await confirm.click();await page.waitForFunction(()=>__calls.length===1);if(mode==='common'){await page.waitForFunction(()=>document.querySelector('.ui-room-leave-status').textContent.includes('測試暫時失敗'));assert(await confirm.isEnabled());await page.evaluate(()=>window.__fail=false);await confirm.click();}else{await page.waitForFunction(()=>window.__error==='測試暫時失敗');await page.evaluate(()=>window.__fail=false);await trigger.click();await confirm.click();}
  await page.waitForURL(url=>url.pathname==='/');assert.deepEqual(errors,[]);console.log('PASS '+mode+' '+viewport.width+'x'+viewport.height+' '+theme+': image, layout, cancel/focus, Escape, failure/retry/leave');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
