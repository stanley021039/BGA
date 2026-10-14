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
 assert.match(f.card('blue').textContent,/抽出與這片數值（1／2／4）相同片數，最多選一片放入，其餘放回藥袋。/);
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
test('help is available by click, busy browsing cannot move the face',()=>{
 const f=setup();const help=f.document.querySelector('[data-book-control="help"]');help.onclick();assert.equal(f.document.querySelector('#bookVotingHelp').hidden,false);assert.equal(f.control('orange','next').disabled,true);assert.equal(f.control('blue','choose').disabled,true);f.context.busy=true;f.control('blue','next').onclick();assert.doesNotMatch(f.card('blue').textContent,/已選第 1 面/);
});
test('every face reserves description space while only the browsed effect is exposed',()=>{
 const f=setup(),row=f.r.bookSelection().find(b=>b.color==='blue');
 function check(set){const effect=f.card('blue').querySelector('.book-page-effect'),copies=effect.querySelectorAll('.book-effect-copy');assert.equal(copies.length,row.candidates.length);const visible=copies.filter(n=>n.getAttribute('aria-hidden')!=='true');assert.equal(visible.length,1);assert.equal(visible[0].textContent,row.candidates.find(c=>c.set===set).effect);assert.equal(effect.querySelectorAll('.book-effect-measure').length,row.candidates.length-1);}
 check(1);f.control('blue','next').onclick();check(2);assert.equal(f.calls.length,0);
});
