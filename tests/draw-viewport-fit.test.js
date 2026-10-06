const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {browserHarness}=require('./helpers/draw-browser.cjs');
function fitted(dimensions){const ui=browserHarness();ui.context.dimensions=dimensions;return vm.runInContext('fitDrawingWidth(dimensions)',ui.context);}

test('a tall drawing board uses the available width while reserving the chat and header',()=>{
 const size={width:846,height:812,overhead:160,chatHeight:203,gap:16};
 assert.equal(fitted(size),846);
 assert.ok(fitted(size)/2+size.overhead+size.chatHeight+size.gap<=size.height);
});

test('a short viewport scales both drawing dimensions before it would displace the chat input',()=>{
 const size={width:686,height:532,overhead:152,chatHeight:156,gap:12};
 assert.equal(fitted(size),424);
 assert.equal(fitted(size)/2+size.overhead+size.chatHeight+size.gap,size.height);
 assert.equal(fitted({...size,height:250}),0,'insufficient space never produces a negative canvas size');
});
