'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {dom}=require('./helpers/widget-dom.cjs'),{QuacksRoom}=require('../src/games/quacks');
function setup(){
 const {document}=dom('<section id="bookVoting"></section>'),calls=[],r=new QuacksRoom('ABCDEF','選藥測試'),a=r.add('甲'),b=r.add('乙');
 const node=(tag,text)=>{const n=document.createElement(tag);n.style.setProperty=(k,v)=>{n.style[k]=v;};if(text!==undefined)n.textContent=text;return n;};
 const context=vm.createContext({document,state:r.view(a.id),bookSetupReady:true,busy:false,$:s=>document.querySelector(s),node,art:{palette:Object.fromEntries(['orange','blue','red','yellow','green','black','purple','locoweed'].map(c=>[c,['#333']])),token:()=>node('svg')},window:{GameUI:{decorateButton:(b,icon,options)=>{b.setAttribute('aria-label',options?.label||b.textContent);}}},button:(label,icon,fn,blocked)=>{const b=node('button',label);b.onclick=fn;b.disabled=!!blocked;b.dataset.blocked=String(!!blocked);return b;},act:(action,data)=>calls.push({action,...data}),lock:()=>{for(const b of document.querySelectorAll('button'))b.disabled=context.busy||b.dataset.blocked==='true';}});
 const source=fs.readFileSync('public/quacks.js','utf8'),start=source.indexOf('const bookPages='),end=source.indexOf('function renderBooks',start);vm.runInContext(source.slice(start,end),context);
 function render(){context.state=r.view(a.id);vm.runInContext('renderBookVoting(state)',context);}
 const card=color=>document.querySelector('[data-ingredient="'+color+'"]'),control=(color,kind)=>document.querySelector('[data-book-control="'+color+'-'+kind+'"]');render();return {document,r,a,b,calls,context,render,card,control};
}

test('book selection explains numeric draws, ruby landing and pumpkin thresholds in plain Chinese',()=>{
 const f=setup();
 assert.match(f.card('blue').textContent,/抽出 1／2／4 片，最多選一片放入大釜，其餘放回藥袋。/);
 f.control('blue','next').onclick();f.control('blue','next').onclick();
 assert.equal(f.card('blue').querySelectorAll('.book-effect-copy').find(n=>n.getAttribute('aria-hidden')!=='true').textContent,'若放在紅寶石格，立即得 1 顆紅寶石。');
 assert.match(f.card('red').textContent,/若先前有 1–2 片南瓜，額外前進 1 格；3 片以上則額外前進 2 格。/);
 assert.equal(f.calls.length,0);
});
test('browsing changes visible face and prices without changing shared choice, explicit choice sends displayed face',()=>{
 const f=setup();assert.match(f.card('blue').textContent,/已選/);f.control('blue','next').onclick();assert.equal(f.calls.length,0);assert.match(f.card('blue').textContent,/已選第 1 面/);assert.match(f.card('blue').textContent,/第 2 面/);const expected=f.r.bookSelection().find(b=>b.color==='blue').candidates[1];assert.match(f.card('blue').textContent,new RegExp(expected.effect.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));for(const o of expected.offers)assert.match(f.card('blue').textContent,new RegExp(o.price+' 金幣'));
 f.control('blue','choose').onclick();assert.equal(JSON.stringify(f.calls),JSON.stringify([{action:'book-select',color:'blue',set:2}]));
 f.r.act(f.a.id,'book-select',{color:'blue',set:2,roundId:f.r.roundId,requestId:require('node:crypto').randomUUID()});f.render();assert.equal(f.card('blue').querySelector('.book-selected-stamp').textContent,'已選');assert.equal(f.control('blue','choose').disabled,true);
});
test('peer choices and unchanged refresh retain browsed face, focus and fixed-face controls',()=>{
 const f=setup();f.control('blue','next').onclick();f.control('blue','next').focus();f.r.act(f.b.id,'book-select',{color:'red',set:2,roundId:f.r.roundId,requestId:require('node:crypto').randomUUID()});f.render();assert.match(f.card('blue').textContent,/第 2 面/);assert.equal(f.document.activeElement.dataset.bookControl,'blue-next');f.render();const before=f.card('blue');f.render();assert.equal(f.card('blue'),before);assert.equal(f.control('orange','previous').disabled,true);assert.equal(f.control('orange','next').disabled,true);assert.equal(f.control('orange','choose').disabled,true);
});
test('shared last choice updates selection and author, expansion switches discard unavailable browsed faces',()=>{
 const f=setup();f.r.act(f.b.id,'book-select',{color:'blue',set:2,roundId:f.r.roundId,requestId:require('node:crypto').randomUUID()});f.render();assert.match(f.card('blue').textContent,/已選第 2 面/);assert.match(f.card('blue').textContent,/由 乙 選擇/);assert.doesNotMatch(f.card('blue').textContent,/票|平票/);
 f.context.state=f.r.view(f.b.id);vm.runInContext('renderBookVoting(state)',f.context);assert.equal(f.document.querySelector('[data-book-control="settings"]'),null);
 f.r.configure(f.a.id,{witches:true});f.render();for(let i=0;i<5;i++)f.control('blue','next').onclick();assert.match(f.card('blue').textContent,/第 6 面/);f.r.configure(f.a.id,{witches:false});f.render();assert.doesNotMatch(f.card('blue').textContent,/第 6 面/);
});
test('book heading omits help and room settings, busy browsing cannot move the face',()=>{
 const f=setup();assert.equal(f.document.querySelector('[data-book-control="help"]'),null);assert.equal(f.document.querySelector('[data-book-control="settings"]'),null);assert.equal(f.document.querySelector('#bookVotingHelp'),null);assert.equal(f.control('orange','next').disabled,true);assert.equal(f.control('blue','choose').disabled,true);f.context.busy=true;f.control('blue','next').onclick();assert.doesNotMatch(f.card('blue').textContent,/已選第 1 面/);
});
test('every face reserves description space while only the browsed effect is exposed',()=>{
 const f=setup(),row=f.r.bookSelection().find(b=>b.color==='blue');
 function check(set){const effect=f.card('blue').querySelector('.book-page-effect'),copies=effect.querySelectorAll('.book-effect-copy');assert.equal(copies.length,row.candidates.length);const visible=copies.filter(n=>n.getAttribute('aria-hidden')!=='true');assert.equal(visible.length,1);assert.equal(visible[0].textContent,row.candidates.find(c=>c.set===set).effect);assert.equal(effect.querySelectorAll('.book-effect-measure').length,row.candidates.length-1);}
 check(1);f.control('blue','next').onclick();check(2);assert.equal(f.calls.length,0);
});

test('flipping and shared random selection keep book cards limited to the active color tab',()=>{
 const f=setup();
 f.context.window.QuacksStitch={syncBookTabs:()=>{for(const card of f.document.querySelectorAll('#bookVoting .book-card'))card.hidden=card.dataset.ingredient!=='blue';}};
 f.control('blue','next').onclick();
 assert.equal(f.card('blue').hidden,false);
 assert.equal(f.card('red').hidden,true);
 f.r.rng=n=>n-1;f.r.act(f.b.id,'book-random',{roundId:f.r.roundId,requestId:require('crypto').randomUUID()});f.render();
 assert.equal(f.card('blue').hidden,false);
 assert.equal(f.card('red').hidden,true);
});

 test('ingredient mappings preserve actual line breaks and reserve their full height',()=>{
 const {EFFECTS}=require('../src/games/quacks-catalog');
 assert.equal(EFFECTS.blue[1],'保護接下來 1／2／4 片；期間若爆炸，仍可得分及購買，但不能擲獎勵骰。');
 assert.equal(EFFECTS.green[1],'結算時，最後兩片中的花園蜘蛛各得一片藥材：\n1 → 南瓜 1\n2 → 烏鴉頭骨 1 或毒蘑菇 1\n4 → 曼德拉草 1 或幽靈氣息 1');
 for(const index of [0,2,3])assert.ok(EFFECTS.purple[index].includes('\n'));
 assert.match(fs.readFileSync('public/quacks.css','utf8'),/\.book-page-effect>\.book-effect-copy\{white-space:pre-line\}/);
 });

test('effect copy names neighboring opponents and the purple chips being discarded, with arrow mappings',()=>{
 const {EFFECTS}=require('../src/games/quacks-catalog');
 for(const effects of Object.values(EFFECTS))for(const text of effects)assert.equal(text.includes('>'),false);
 for(const text of EFFECTS.black.slice(0,4)){assert.match(text,/與左、右相鄰的玩家比較。/);assert.doesNotMatch(text,/不跳過/);}
 assert.match(EFFECTS.purple[3],/南瓜、白色炸彈不能升級。/);
 assert.match(EFFECTS.purple[1],/永久棄掉大釜中的 1–3 片幽靈氣息/);
 assert.match(EFFECTS.purple[1],/棄 2 片 → 花園蜘蛛 1、烏鴉頭骨 2、3 分、水滴前進 1 格/);
});

test('black fifth face explains each acquisition and both ruby rewards',()=>{
 const {EFFECTS}=require('../src/games/quacks-catalog');
 assert.match(EFFECTS.black[4],/每獲得 1 片，就將該片交給左鄰玩家，自己的水滴前進 1 格/);
 assert.match(EFFECTS.black[4],/左鄰大釜每片非洲骷髏天蛾，讓你得 1 顆紅寶石/);
 assert.match(EFFECTS.black[4],/自己最後兩片中的每片非洲骷髏天蛾，也各得 1 顆紅寶石/);
 const f=setup();f.r.configure(f.a.id,{witches:true});f.render();f.control('black','next').onclick();
 assert.match(f.card('black').querySelectorAll('.book-effect-copy').find(n=>n.getAttribute('aria-hidden')!=='true').textContent,/每獲得 1 片/);
});


test('a fresh random choice follows the selected effect on both pages and preserves random-button focus',()=>{const f=setup();f.control('blue','face-2').onclick();const random=f.document.querySelector('[data-book-control="random"]');random.focus();random.onclick();assert.equal(f.calls.at(-1).action,'book-random');f.r.rng=n=>n-1;f.r.act(f.a.id,'book-random',{roundId:f.r.roundId,requestId:require('crypto').randomUUID()});f.render();for(const row of f.r.bookSelection()){const card=f.card(row.color);assert.equal(card.querySelector('.book-page-effect strong').textContent,'第 '+row.selected+' 面效果');assert.equal(card.querySelector('.book-selected-stamp').textContent,'已選');assert.equal(f.control(row.color,'face-'+row.selected).getAttribute('aria-pressed'),'true');assert.equal(card.querySelector('.book-page-top small').textContent,'第 '+row.selected+' 面 · 本局採用');}assert.equal(f.document.activeElement.dataset.bookControl,'random');});
test('peer random and repeated identical random results resync browsing, regular refresh does not',()=>{const f=setup();f.r.rng=n=>n-1;const random=()=>f.r.act(f.b.id,'book-random',{roundId:f.r.roundId,requestId:require('crypto').randomUUID()});random();f.render();assert.equal(f.card('blue').querySelector('.book-page-effect strong').textContent,'第 4 面效果');f.control('blue','face-2').onclick();const card=f.card('blue');f.render();assert.equal(f.card('blue'),card);assert.equal(card.querySelector('.book-page-effect strong').textContent,'第 2 面效果');random();f.render();assert.equal(f.card('blue').querySelector('.book-page-effect strong').textContent,'第 4 面效果');assert.equal(f.card('blue').querySelector('.book-selected-stamp').textContent,'已選');});
test('rolling old random events out of history does not snap browsing; the next random choice still syncs',()=>{const f=setup();f.r.rng=n=>n-1;f.r.act(f.b.id,'book-random',{roundId:f.r.roundId,requestId:require('crypto').randomUUID()});f.render();f.control('blue','face-2').onclick();for(let i=0;i<35;i++)f.r.event('test','unrelated');f.render();assert.equal(f.card('blue').querySelector('.book-page-effect strong').textContent,'第 2 面效果');f.r.act(f.b.id,'book-random',{roundId:f.r.roundId,requestId:require('crypto').randomUUID()});f.render();assert.equal(f.card('blue').querySelector('.book-page-effect strong').textContent,'第 4 面效果');});
