'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {QUESTIONS}=require('../src/games/bluff-catalog'),manifest=require('../docs/research/BLUFF-QUIZLET-IMPORT.json');
test('every user-provided Quizlet item is accounted for and only verified canonical topics enter the draw pool',()=>{
 const byId=new Map(QUESTIONS.map(q=>[q.id,q])),items=manifest.sets.flatMap(s=>s.items),included=new Set();
 assert.equal(manifest.sets.length,4);assert.equal(items.length,111);assert.equal(manifest.pending.length,8);
 for(const item of items){if(item.status==='pending'){assert.ok(item.reason);assert.ok(!QUESTIONS.some(q=>q.title===item.title||q.aliases.includes(item.title)));}else{const q=byId.get(item.questionId);assert.ok(q);assert.equal(q.title,item.canonicalTitle);assert.ok(q.title===item.title||q.aliases.includes(item.title));included.add(q.id);}}
 assert.equal(included.size,89);assert.equal(items.filter(i=>i.status==='pending').length,8);
 assert.equal(items.find(i=>i.title==='光冠').questionId,'bk13');
});
test('corrected definitions distinguish additive triangle, stimulant medicine and disputed brand history',()=>{
 const text=title=>QUESTIONS.find(q=>q.title===title).explanation.detail;
 assert.match(text('巴斯卡三角形'),/相加/);assert.match(text('利他能'),/刺激/);
 assert.match(text('軍刀症候群'),/靜脈/);assert.match(text('蝌蝌啃蠟'),/爭議/);
});
