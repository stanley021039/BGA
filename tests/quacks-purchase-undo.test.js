
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {QuacksRoom}=require('../src/games/quacks');
function setup({witches=false,fortune='test',blackSet=1}={}){
 const r=new QuacksRoom('ABCDEF','cart',n=>0),a=r.add('A'),b=r.add('B');r.configure(a.id,{witches});r.start();r.phase='settlement';r.stage='shopping';r.round=4;r.fortune={id:fortune};r.activeBooks.black=blackSet;
 for(const p of [a,b]){p.ready=false;p.canBuy=true;p.budget=80;p.pending=[];}return {r,a,b,act(action,data={}){r.act(a.id,action,{roundId:r.roundId,requestId:randomUUID(),...data});}};
}
test('cancel the first of two purchases refunds only its cost and removes only the new chip',()=>{
 const f=setup(),{r,a,act}=f,before=a.bag.map(c=>c.id);act('buy',{color:'orange',value:1});const price=a.bought[0].price;act('buy',{color:'blue',value:1});const blue=a.bought[1].price;
 const packet={roundId:r.roundId,requestId:randomUUID(),color:'orange',value:1};r.act(a.id,'unbuy',packet);r.act(a.id,'unbuy',packet);
 assert.equal(a.budget,80-blue);assert.deepEqual(a.bought.map(c=>c.color),['blue']);assert.ok(before.every(id=>a.bag.some(c=>c.id===id)));assert.equal(a.bag.length,before.length+1);assert.ok(price>0);
 act('buy',{color:'red',value:1});assert.equal(a.bought.length,2);assert.equal(r.view(a.id).mine.bought.every(c=>c.canUndo),true);
});
test('twin-shopping cancellation retracts the bonus and a new pair earns it once',()=>{
 const {a,act}=setup({fortune:'twin-shopping'}),count=a.bag.length;act('buy',{color:'orange',value:1});act('buy',{color:'blue',value:1});assert.equal(a.bag.length,count+3);assert.equal(a.freeCheap,true);
 act('unbuy',{color:'orange',value:1});assert.equal(a.bag.length,count+1);assert.equal(a.freeCheap,false);act('buy',{color:'red',value:1});assert.equal(a.bag.length,count+3);act('unbuy',{color:'red',value:1});assert.equal(a.bag.length,count+1);
});
test('black fifth face cancellation retracts the exact neighbor gift and actual droplet advancement',()=>{
 const {a,b,act}=setup({witches:true,blackSet:5}),aBag=a.bag.length,bBag=b.bag.length;act('buy',{color:'black',value:1});assert.equal(a.bag.length,aBag);assert.equal(b.bag.length,bBag+1);assert.equal(a.droplet,1);act('unbuy',{color:'black',value:1});assert.equal(b.bag.length,bBag);assert.equal(a.droplet,0);assert.equal(a.budget,80);
});
test('independent purple budget cancellation does not refund ordinary money',()=>{
 const {a,act}=setup();a.extraBudget=20;a.extraBought=[];const count=a.bag.length;act('extra-buy',{color:'orange',value:1});assert.ok(a.extraBudget<20);act('unbuy',{color:'orange',value:1,extra:true});assert.equal(a.extraBudget,20);assert.equal(a.budget,80);assert.equal(a.bag.length,count);
});
test('dependent currency/effects commit cart entries and finalized or stale-round cancellations are rejected',()=>{
 const {r,a,act}=setup();a.rubies=4;act('buy',{color:'orange',value:1});act('ruby',{mode:'droplet'});const before=JSON.stringify(a);assert.equal(r.view(a.id).mine.bought[0].canUndo,false);assert.throws(()=>act('unbuy',{color:'orange',value:1}));assert.equal(JSON.stringify(a),before);a.ready=true;assert.throws(()=>act('unbuy',{color:'orange',value:1}));assert.throws(()=>r.act(a.id,'unbuy',{roundId:'old',requestId:randomUUID(),color:'orange',value:1}));
});
test('a consumed neighbor grant cannot be canceled or refunded again',()=>{
 const {r,a,b,act}=setup({witches:true,blackSet:5});act('buy',{color:'black',value:1});const edit=a.purchaseEdits[0],id=edit.changes[1].chips[0];b.bag=b.bag.filter(c=>c.id!==id);assert.equal(r.view(a.id).mine.bought[0].canUndo,false);const money=a.budget;assert.throws(()=>act('unbuy',{color:'black',value:1}));assert.equal(a.budget,money);
});
