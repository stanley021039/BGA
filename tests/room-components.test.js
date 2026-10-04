const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/shared/game-shell.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf(' const escape='),source.indexOf(' window.GameShell='))+'globalThis.renderPlayer=playerRow;',context);
test('shared player row keeps roles, connection state and separate gift metrics',()=>{
 const row=context.renderPlayer({id:'a',name:'朋友',avatar:'/avatar.png'},{me:'a',status:'本輪畫者 · 暫時離線',metrics:[{label:'送禮分數',value:15},{label:'收禮分數',value:25}]});
 assert.match(row,/朋友 · 你/);assert.match(row,/本輪畫者 · 暫時離線/);
 assert.match(row,/送禮分數：15/);assert.match(row,/收禮分數：25/);assert.match(row,/src="\/avatar.png"/);
});
test('shared player row escapes user content and displays a fallback avatar',()=>{
 const row=context.renderPlayer({id:'a',name:'<img onerror="bad">',score:0},{me:'other',status:'<script>'});
 assert.match(row,/room-avatar-fallback/);assert.doesNotMatch(row,/<img|<script>/);assert.match(row,/&lt;img/);assert.match(row,/分數：0/);assert.doesNotMatch(row,/ · 你/);
});
