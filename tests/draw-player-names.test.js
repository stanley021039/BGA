const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness,drawingState}=require('./helpers/draw-browser.cjs');

test('every tied winner keeps a character card and an independently bounded full-name slot',()=>{
 const ui=browserHarness(),names=['林','超長暱稱也是朋友','小雨','字'.repeat(16),'小星','阿哲','阿言','小熊'];
 ui.context.window.GameUI={playerName:name=>'<span class="ui-player-name" title="'+name+'"><span class="ui-player-name-text">'+name+'</span></span>'};
 const players=names.map((name,i)=>({id:'p'+i,name,score:798}));
 ui.context.scene={...drawingState('guest'),phase:'finished',players,winner:{ids:players.map(p=>p.id),reason:'共同獲勝'},result:null};
 const html=vm.runInContext('stageScene(scene)',ui.context);
 assert.equal((html.match(/class="stage-player-card stage-winner"/g)||[]).length,8);
 assert.equal((html.match(/class="ui-player-name"/g)||[]).length,8,'each ranked player has one name slot without duplicating the ranking');
 assert.doesNotMatch(html,/stage-tie-summary/);
 assert.match(html,/title="超長暱稱也是朋友"/);
 assert.match(html,/798 分/);
 assert.match(html,/stage-card-win ui-symbol/);
});

test('a missing name component retains escaped names rather than allowing markup from a nickname',()=>{
 const ui=browserHarness();ui.context.scene={...drawingState('guest'),phase:'finished',players:[{id:'a',name:'<script>"bad"',score:3}],winner:{ids:['a']},result:null};
 const html=vm.runInContext('stageScene(scene)',ui.context);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/title="&lt;script&gt;&quot;bad&quot;"/);
 assert.match(html,/3 分/);
});

test('non-winning players keep their full-name and score cards alongside the winner',()=>{
 const ui=browserHarness();ui.context.scene={...drawingState('guest'),phase:'finished',players:[{id:'a',name:'獲勝玩家',score:100},{id:'b',name:'另一位超長暱稱的朋友',score:20}],winner:{ids:['a']},result:null};
 const html=vm.runInContext('stageScene(scene)',ui.context);
 assert.equal((html.match(/class="stage-player-card(?: stage-winner)?"/g)||[]).length,2);
 assert.equal((html.match(/class="stage-player-card stage-winner"/g)||[]).length,1);
 assert.match(html,/title="另一位超長暱稱的朋友"/);assert.match(html,/20 分/);
});
