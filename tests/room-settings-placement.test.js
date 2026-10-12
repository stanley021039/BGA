'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,'public',name),'utf8');
test('lobby creation contains room identity only, with no duplicate game settings inputs',()=>{
 const html=read('index.html'),client=read('hub.js');assert.doesNotMatch(html,/id="(?:drawEnding|drawEndMode|drawEndValue|bluffCreateOptions|bluffRoleSeconds)"/);assert.doesNotMatch(client,/drawEndMode|drawEndValue|bluffRoleSeconds|bluffCreateOptions/);assert.match(client,/ending:\{mode:'rounds',value:8\}/);assert.match(html,/房間設定/);
});
function drawHelpers(){const nodes=new Map(),source=read('draw.js'),scope={topicChoices:[['animals','動物'],['custom','自定義']],GameShell:{settingsActions:()=>'<p id="roomSettingsFeedback"></p>'},$:s=>nodes.get(s),document:{querySelectorAll:()=>[{value:'animals'}]}};vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function options('),source.indexOf('function waitingActions(')),scope);return {scope,nodes};}
test('draw room settings own endings, limits, legacy display and host-only editing',()=>{
 const {scope,nodes}=drawHelpers(),settings={seconds:90,topics:['animals'],ending:{mode:'rounds',value:8}};
 const host=scope.roomSettingsMarkup({host:true,options:settings}),member=scope.roomSettingsMarkup({host:false,options:settings});assert.match(host,/房間設定/);assert.match(host,/drawEndMode/);assert.match(host,/value="8"/);assert.doesNotMatch(host,/class="room-settings-fields" disabled/);assert.match(member,/class="room-settings-fields" disabled/);
 const score=scope.endingSettings({...settings,ending:{mode:'score',value:100}});assert.match(score,/min="10" max="1000"/);assert.match(score,/最多 64 題/);
 const legacy=scope.endingSettings({...settings,ending:{mode:'rounds',value:null}});assert.match(legacy,/value="legacy" selected/);assert.match(legacy,/每位玩家畫一次/);
 nodes.set('#stage input[name="seconds"]:checked',{value:'90'});nodes.set('#drawEndMode',{value:'rounds'});nodes.set('#drawEndValue',{value:'8'});assert.deepEqual(JSON.parse(JSON.stringify(scope.readRoomSettings())),{seconds:90,topics:['animals'],ending:{mode:'rounds',value:8}});
 nodes.get('#drawEndValue').value='8.5';assert.throws(()=>scope.readRoomSettings(),/整數/);nodes.get('#drawEndMode').value='legacy';assert.equal(Object.hasOwn(scope.readRoomSettings(),'ending'),false);
});
test('draw settings are auto-saved from the room and available for restart; entry no longer asks topics',()=>{
 const source=read('draw.js');assert.match(source,/read:readRoomSettings/);assert.match(source,/canSave:.*\['waiting','finished'\]\.includes\(state.phase\)/);assert.doesNotMatch(source,/entry-topic/);assert.match(source,/api\(code\?'join':'create',\{type:'draw',code\}\)/);
 const bluff=read('bluff.js');assert.match(bluff,/el\('summary','房間設定'\)/);assert.match(bluff,/select.dataset.blocked=String\(!host\)/);
});
