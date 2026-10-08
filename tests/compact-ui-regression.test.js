const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../public'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('three vehicle icons highlight only available cars and actor without online/count text',()=>{
const source=read('race.js');const scope={window:{},esc:String,sizes:['輕型','中型','重型']};vm.createContext(scope);const icons=read('shared/ui-components.js');vm.runInContext(icons.slice(0,icons.indexOf(' /* One hover/focus'))+'})();',scope);
vm.runInContext(source.slice(source.indexOf('function crewCard('),source.indexOf('function heli(')),scope);
const p={id:'p1',name:'朋友',color:'#abc',online:true,dice:[]};const state={phase:'move',me:'p1',actor:'p1',cars:[{owner:'p1',size:0,damage:[],moved:false},{owner:'p1',size:1,damage:[],moved:true},{owner:'p1',size:2,damage:[],dead:true}]};
const markup=scope.crewCard(state,p);assert.equal((markup.match(/class="crew-car /g)||[]).length,3);assert.equal((markup.match(/is-available/g)||[]).length,1);assert.equal((markup.match(/<svg/g)||[]).length,3);assert.match(markup,/crew-pill current/);assert.match(markup,/目前行動玩家/);assert.doesNotMatch(markup,/輛可用|在線|行動中|crew-detail/);assert.match(markup,/輕型：可用/);assert.match(markup,/中型：已動/);assert.match(markup,/重型：淘汰/);
assert.match(scope.crewCard(state,{...p,online:false}),/離線/);assert.equal(scope.crewCard(state,null),'');
});
test('barrage input suppresses autofill and frame chooser lives in personal settings',()=>{
const shell=read('shared/game-shell.js');assert.match(shell,/<form id="shared-barrage" class="ui-control-row" autocomplete="off"><input autocomplete="off"/);assert.doesNotMatch(shell,/shared-frame-toggle/);assert.match(read('settings.html'),/id="settings-barrage-frame"/);assert.match(read('settings.js'),/BarrageFrames.openPicker\(trigger\)/);assert.match(read('shared/site-header.js'),/BarrageFrames.openPicker\(frameButton\)/);
});
