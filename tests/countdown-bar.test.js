const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/shared/countdown-bar.js'),'utf8');
function fixture(){let time=1000,reduce=false;const jobs=[],node={style:{},animate(frames,options){const job={frames,options,cancelled:false,cancel(){this.cancelled=true;}};jobs.push(job);return job;}};const context={window:{}};vm.runInNewContext(source,context);const bar=context.window.CountdownBar.create(node,{now:()=>time,reducedMotion:()=>reduce});return {bar,node,jobs,advance:ms=>time+=ms,reduce:value=>reduce=value};}
test('countdown uses one compositor animation with exact server remaining duration, not a per-frame JS loop',()=>{
 const f=fixture(),state={key:'epoch:drawing',deadline:100000,duration:120000,offset:1000};f.bar.sync(state);assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].options.duration,100000);assert.equal(f.jobs[0].options.easing,'linear');assert.equal(f.jobs[0].frames[0].transform,'scaleX('+100000/120000+')');assert.equal(f.jobs[0].frames[1].transform,'scaleX(0)');
 f.advance(250);f.bar.sync(state);f.advance(250);f.bar.sync({...state,offset:1010});assert.equal(f.jobs.length,1,'ticks and small poll jitter do not restart the animation');
 f.bar.sync({...state,offset:1050});assert.equal(f.jobs.length,2);assert.equal(f.jobs[0].cancelled,true);assert.equal(f.jobs[1].options.duration,99550);
});
test('phase changes, hiding, BFCache reset and reduced motion cancel the old timeline and rebuild from current deadline',()=>{
 const f=fixture(),state={key:'epoch:drawing',deadline:10000,duration:120000};f.bar.sync(state);f.advance(2000);f.bar.sync({...state,visible:false});assert.equal(f.jobs[0].cancelled,true);assert.equal(f.node.style.transform,'scaleX(0)');f.bar.sync(state);assert.equal(f.jobs[1].options.duration,7000);
 f.bar.sync({key:'epoch:reveal',deadline:11000,duration:8000});assert.equal(f.jobs[1].cancelled,true);assert.equal(f.jobs[2].options.duration,8000);f.bar.reset();assert.equal(f.jobs[2].cancelled,true);
 f.reduce(true);f.bar.sync(state);assert.equal(f.jobs.length,3);assert.equal(f.node.style.transform,'scaleX('+7000/120000+')');f.advance(20000);f.bar.sync(state);assert.equal(f.node.style.transform,'scaleX(0)');assert.equal(f.jobs.length,3);
});
test('a throttled compositor catches up to server time instead of leaving the visible bar behind the numeric timer',()=>{
 const f=fixture(),state={key:'epoch:drawing',deadline:10000,duration:120000};f.bar.sync(state);f.jobs[0].currentTime=0;f.advance(1500);f.bar.sync(state);assert.equal(f.jobs[0].cancelled,true);assert.equal(f.jobs[1].options.duration,7500);assert.equal(f.node.style.transform,'scaleX('+7500/120000+')');
});
