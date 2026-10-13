'use strict';
// Optional browser regression: NODE_PATH must expose playwright; uses only local assets.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage();for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});
 const styles=['shared/ui-foundation.css','shared/ui-primitives.css','shared/playful-theme.css','quacks.css','shared/chat.css','shared/room-controls.css','shared/game-shell.css'].map(f=>fs.readFileSync(path.join(root,'public',f),'utf8')).join('\n');
 await page.setContent(`<html><head><style>${styles}</style><style>body{margin:20px}.ui-game-chat-host{box-sizing:border-box;width:min(320px,100%);padding:20px;border:2px solid}#controls{min-height:240px}.shared-chat button{box-sizing:border-box;height:44px;padding:0}</style></head><body data-game-kind="quacks" data-room-phase="fortune" data-visual-theme="playful"><section class="ui-game-chat-host"><h2>你的操作</h2><div id="controls" class="ui-room-panel-host"><p>等其他玩家抽占卜牌。</p></div><section class="shared-chat chat-inline ui-panel-frame" data-game-chat="true"><h2 class="chat-heading ui-panel-header">聊天室</h2><div id="chat-content" class="ui-panel-body"><ol class="chat-messages ui-panel-content"></ol><footer class="ui-panel-footer"><p class="chat-status"></p><div class="chat-room-tools"><button>表情</button><button>媒體</button><button>離開</button></div><form><div class="chat-compose"><input aria-label="房間彈幕"><button type="submit">送出</button></div></form></footer></div></section></section></body></html>`);
 let previous;for(const state of ['empty','messages','feedback','long-actions']){
  await page.evaluate(state=>{if(state==='messages')document.querySelector('.chat-messages').innerHTML='<li>聊天訊息</li>'.repeat(50);if(state==='feedback')document.querySelector('.chat-status').textContent='多行提示測試。'.repeat(50);if(state==='long-actions')document.querySelector('#controls').innerHTML='<p>較長遊戲操作</p>'.repeat(50);},state);
  const result=await page.evaluate(()=>{const host=document.querySelector('.ui-game-chat-host'),chat=host.querySelector('.shared-chat'),h=host.getBoundingClientRect(),c=chat.getBoundingClientRect(),f=chat.querySelector('footer').getBoundingClientRect();return {width:h.width,height:h.height,footer:f.top-h.top,contained:[...chat.querySelectorAll('input,[type=submit],footer')].every(n=>{const r=n.getBoundingClientRect();return r.left>=h.left&&r.right<=h.right&&r.bottom<=c.bottom+.5&&r.bottom<=h.bottom}),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert(result.contained,`${width} ${state}: composer clipped`);assert(!result.overflow);if(previous)assert.deepEqual(result,previous,`${width}: state changed frame/footer geometry`);previous=result;
 }console.log(`PASS ${width}px: composer contained and frame/footer stable across four states`);
}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});

