const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState}=require('./helpers/draw-browser.cjs');
const run=(ui,code)=>vm.runInContext(code,ui.context);
async function setup(t,me){const ui=browserHarness();ui.receive(drawingState(me));await new Promise(resolve=>setImmediate(resolve));t.after(()=>ui.listeners.get('window:pagehide')({persisted:false}));return ui;}
test('artist role comes from player card; successful guesses appear in chat without a redundant status line',async t=>{
 const artist=await setup(t,'artist');assert.equal(artist.element('#drawActions').innerHTML,'');assert.match(artist.element('#players').innerHTML,/畫圖中/);
 const guest=await setup(t,'guest'),original=guest.context.RoomApi.request;guest.context.RoomApi.request=async(route,data,options)=>route==='action'?{...drawingState('guest'),guesses:[{id:'guest',name:'猜者',answer:data.answer,correct:false,at:Date.now()}]}:original(route,data,options);
 guest.element('#guessInput').value='小馬';await guest.listeners.get('#guessForm:submit')({preventDefault(){}});assert.equal(guest.element('#guessInput').value,'');assert.equal(guest.element('#drawGuessStatus').textContent,'');assert.equal(guest.element('#guessFeed').children.at(-1).textContent,'猜者：小馬');
});
test('generic completion stays quiet, while failed guesses and saved settings retain actionable feedback',async t=>{
 const ui=await setup(t,'guest'),original=ui.context.RoomApi.request;ui.context.RoomApi.request=async(route,data,options)=>route==='action'?Promise.reject(Error('猜題時間已結束')):['settings','start'].includes(route)?drawingState('guest'):original(route,data,options);
 ui.element('#guessInput').value='保留草稿';await ui.listeners.get('#guessForm:submit')({preventDefault(){}});assert.equal(ui.element('#guessInput').value,'保留草稿');assert.equal(ui.element('#drawGuessStatus').textContent,'猜題時間已結束');
 await run(ui,'roomAction("start")');assert.equal(ui.element('#drawStatus').textContent,'');await run(ui,'roomAction("settings")');assert.equal(ui.element('#roomSettingsFeedback').textContent,'房間設定已儲存。');
});
