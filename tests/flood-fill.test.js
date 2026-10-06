const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8'),{window});
const {fillRegion}=window.StrokeCanvas;
function image(rows){return {width:rows[0].length,height:rows.length,data:Uint8ClampedArray.from(rows.flatMap(row=>[...row].flatMap(char=>char==='#'?[0,0,0,255]:[255,255,255,255])))};}
test('bucket fills only the clicked enclosed region and preserves boundary and other regions',()=>{
 const source=image(['#########','#  ##   #','#  ##   #','#########']),output={...source,data:source.data.slice()};
 assert.equal(fillRegion(source,output,1,1,[255,0,0,255]),4);
 assert.deepEqual([...output.data.slice((1*9+1)*4,(1*9+1)*4+4)],[255,0,0,255]);
 assert.deepEqual([...output.data.slice((1*9+5)*4,(1*9+5)*4+4)],[255,255,255,255]);
 assert.deepEqual([...output.data.slice(0,4)],[0,0,0,255]);
 assert.equal(fillRegion(source,output,-1,1,[0,0,0,255]),0);
});
test('transparent pixels ignore invisible RGB; alpha and disconnected diagonal boundaries remain intact',()=>{
 const source=image([' #','# ']);source.data.set([20,40,60,0],0);source.data.set([200,0,100,0],12);
 const output={...source,data:source.data.slice()};
 assert.equal(fillRegion(source,output,0,0,[0,128,255,128]),1);
 assert.deepEqual([...output.data.slice(0,4)],[0,128,255,128]);
 assert.equal(output.data[15],0);
});
test('fill tolerates small color variation without leaking across a dark outline',()=>{
 const source=image(['   # ']);source.data.set([240,240,240,255],4);
 const output={...source,data:source.data.slice()};
 assert.equal(fillRegion(source,output,0,0,[1,2,3,255]),3);
 assert.equal(output.data[16],255);
});
