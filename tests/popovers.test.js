const {test}=require('node:test');
const assert=require('node:assert/strict');
const {placement}=require('../public/shared/popovers');
const view={width:1280,height:720};
test('a menu with space below stays next to its trigger',()=>{
 const result=placement({left:980,right:1240,top:300,bottom:344},{width:300,height:220},view,{align:'end'});
 assert.equal(result.side,'bottom');assert.equal(result.top,352);assert.equal(result.left,940);assert.equal(result.maxHeight,220);
});
test('a menu near the bottom flips above and limits a long list',()=>{
 const result=placement({left:980,right:1240,top:610,bottom:654},{width:300,height:900},view);
 assert.equal(result.side,'top');assert.equal(result.top,8);assert.equal(result.maxHeight,594);
});
test('a wide menu shifts inside a narrow viewport without losing its contents',()=>{
 const result=placement({left:300,right:380,top:220,bottom:264},{width:600,height:200},{width:390,height:600});
 assert.equal(result.left,8);assert.equal(result.width,374);assert.equal(result.top,272);
});
test('visual viewport offsets and explicit top placement are respected',()=>{
 const result=placement({left:500,right:570,top:460,bottom:504},{width:190,height:160},{left:400,top:300,width:390,height:400},{placement:'top'});
 assert.equal(result.side,'bottom');assert.ok(result.left>=408);assert.ok(result.top>=308);assert.ok(result.top+result.maxHeight<=692);
});
