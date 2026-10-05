const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rasterCanvas}=require('./helpers/raster-canvas.cjs');
const window={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/shared/stroke-canvas.js'),'utf8'),{window});
const {createRenderer,redraw,floodFill}=window.StrokeCanvas;
const fill=(version,color=version%2?'#ff0000':'#0000ff')=>({version,strokeId:'a0000000-'+version,tool:'fill',color,size:1,points:[[0,0]]});
const keys=strokes=>strokes.map(stroke=>String(stroke.version));

test('48 alternating full-region fills apply once each instead of replaying their prefix',()=>{
 const canvas=rasterCanvas(),renderer=createRenderer(canvas),strokes=[];
 for(let version=1;version<=48;version++){strokes.push(fill(version));renderer.render(strokes,{keys:keys(strokes)});}
 assert.equal(renderer.metrics().fillApplications,48);
 assert.equal(renderer.metrics().filledPixels,48*canvas.width*canvas.height);
 assert.deepEqual(canvas.pixel(20,10),[0,0,255,255]);
 assert.ok(renderer.metrics().checkpoints<=16);
 assert.ok(renderer.metrics().checkpointBytes<=16*canvas.width*canvas.height*4);
 const before=renderer.metrics();
 assert.equal(renderer.render(JSON.parse(JSON.stringify(strokes)),{keys:keys(strokes)}),false);
 assert.equal(renderer.metrics().fillApplications,before.fillApplications,'reconnect with identical snapshot does no fill work');
});

test('a mutable brush preview does not replay fills behind its checkpoint',()=>{
 const canvas=rasterCanvas(),renderer=createRenderer(canvas),strokes=Array.from({length:48},(_,index)=>fill(index+1));
 renderer.render(strokes,{keys:keys(strokes)});
 for(let revision=1;revision<=200;revision++){
  const preview={tool:'brush',color:'#000000',size:1,points:[[5,5],[5+revision%10,8]]};
  renderer.render([...strokes,preview],{keys:[...keys(strokes),'local:'+revision],mutableFrom:strokes.length});
 }
 assert.equal(renderer.metrics().fillApplications,48);
 assert.equal(renderer.metrics().strokeApplications,248);
});

test('successive undo restores bounded checkpoints and preserves the exact prior pixels',()=>{
 const canvas=rasterCanvas(),renderer=createRenderer(canvas),strokes=[];
 for(let version=1;version<=48;version++){strokes.push(fill(version));renderer.render(strokes,{keys:keys(strokes)});}
 for(let count=47;count>=0;count--){
  renderer.render(strokes.slice(0,count),{keys:keys(strokes.slice(0,count))});
  assert.deepEqual(canvas.pixel(20,10),count?count%2?[255,0,0,255]:[0,0,255,255]:[255,255,255,255]);
 }
 assert.ok(renderer.metrics().fillApplications<48*8,'deep undo uses spaced checkpoints, not replay of all remaining fills');
 assert.equal(renderer.metrics().checkpointBytes,0);
});

test('a replaced suffix and a new renderer reconstruct the same canonical canvas',()=>{
 const original=Array.from({length:24},(_,index)=>fill(index+1));
 const canvas=rasterCanvas(),renderer=createRenderer(canvas);renderer.render(original,{keys:keys(original)});
 const changed=[...original.slice(0,13),fill(30,'#00ff00'),{version:31,strokeId:'shape-31',tool:'rect',color:'#000000',size:1,filled:true,points:[[3,3],[8,8]]}];
 renderer.render(changed,{keys:keys(changed)});
 const reconnected=rasterCanvas();createRenderer(reconnected).render(changed,{keys:keys(changed)});
 const canonical=rasterCanvas();redraw(canonical,changed);
 assert.deepEqual(canvas.pixels(),canonical.pixels());assert.deepEqual(reconnected.pixels(),canonical.pixels());
});

test('filled shapes, region fill, brush, erase and ellipse retain their shared drawing contract',()=>{
 const canvas=rasterCanvas(16,16),renderer=createRenderer(canvas);
 const strokes=[
  {version:1,tool:'rect',color:'#000000',size:1,filled:true,points:[[2,2],[12,12]]},
  {version:2,tool:'rect',color:'#ffffff',size:1,filled:true,points:[[3,3],[11,11]]},
  {version:3,tool:'fill',color:'#ff0000',size:1,points:[[5,5]]},
 ];
 renderer.render(strokes,{keys:keys(strokes)});
 assert.deepEqual(canvas.pixel(5,5),[255,0,0,255]);assert.deepEqual(canvas.pixel(2,2),[0,0,0,255]);assert.deepEqual(canvas.pixel(0,0),[255,255,255,255]);
 strokes.push({version:4,tool:'brush',color:'#0000ff',size:2,points:[[5,5],[8,5]]},{version:5,tool:'erase',color:'#0000ff',size:2,points:[[5,5],[8,5]]},{version:6,tool:'ellipse',color:'#00ff00',size:1,filled:true,points:[[4,4],[10,10]]});
 renderer.render(strokes,{keys:keys(strokes)});
 const canonical=rasterCanvas(16,16);redraw(canonical,strokes);assert.deepEqual(canvas.pixels(),canonical.pixels());
});

test('renderer rejects excessive recovery work before painting or allocating checkpoints',()=>{
 const canvas=rasterCanvas(),renderer=createRenderer(canvas);
 assert.throws(()=>renderer.render(Array.from({length:50},(_,index)=>fill(index+1))),/work limit/);
 assert.throws(()=>renderer.render(Array.from({length:1017},()=>({tool:'brush',points:[[0,0]]}))),/stroke limit/);
 assert.equal(renderer.metrics().strokeApplications,0);assert.equal(renderer.metrics().checkpointBytes,0);
});

test('studio fill still uses supplied flattened alpha source at its own resolution',()=>{
 const canvas=rasterCanvas(5,3),context=canvas.getContext('2d'),source=context.getImageData();
 source.data.fill(0);source.data.set([10,20,30,0],0);source.data.set([20,40,60,0],4);
 // With an explicit source the target may match it, but the output layer differs.
 assert.equal(floodFill(context,[0,0],'#ffffff',0,source),15);
 assert.equal(canvas.pixel(4,2)[3],0);
});

test('filling the seed color still normalizes connected pixels within the existing tolerance',()=>{
 const canvas=rasterCanvas(3,1),context=canvas.getContext('2d');
 context.fillStyle='#ffffff';context.fillRect(0,0,3,1);context.fillStyle='#f0f0f0';context.fillRect(1,0,1,1);
 assert.equal(floodFill(context,[0,0],'#ffffff'),3);
 assert.deepEqual(canvas.pixel(1,0),[255,255,255,255]);
});
