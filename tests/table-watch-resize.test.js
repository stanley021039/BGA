const {test}=require('node:test');
const assert=require('node:assert/strict');
const {watchHarness,roomState}=require('./helpers/watch-browser.cjs');

const sizeKey='bga.watch.size.v1';
const positionKey='bga.watch.window.v1';
const rect=ui=>ui.node('tableWatch').getBoundingClientRect();
const size=ui=>{const {width,height}=rect(ui);return {width,height};};
const position=ui=>{const {left,top}=rect(ui);return {left,top};};
const frame=ui=>ui.node('watchPlayer').children.find(node=>node.tagName==='IFRAME');
const pointer=(pointerId,x,y,button=0)=>({pointerId,clientX:x,clientY:y,button,preventDefault(){}});
const key=(value,shiftKey=false)=>({key:value,shiftKey,preventDefault(){}});
async function opened(options){const ui=watchHarness(options);ui.update(roomState());await ui.open();await ui.flushFrames();return ui;}
async function joined(options){const ui=await opened(options);await ui.join();ui.players.at(-1).ready();await ui.flushFrames();return ui;}
function assertSafeSize(ui){
 const {width,height}=size(ui);
 assert.ok(Number.isFinite(width)&&Number.isFinite(height));
 assert.ok(width>=280,'the local window keeps its minimum usable width');
 assert.ok(height>=210+44,'the player and a local control row remain in the height budget');
 assert.ok(width<=ui.window.innerWidth-16,'width remains inside the viewport margins');
 assert.ok(height<=ui.window.innerHeight-16,'height remains inside the viewport margins');
}

test('existing saved positions retain the natural window size until the viewer explicitly resizes',async()=>{
 const savedPosition=JSON.stringify({left:500,top:300}),ui=await opened({savedPosition});
 assert.deepEqual(size(ui),{width:600,height:340});
 assert.deepEqual(position(ui),{left:500,top:300});
 assert.equal(ui.node('tableWatch').style.width||'','');
 assert.equal(ui.node('tableWatch').style.height||'','');
 assert.equal(ui.storage.has(sizeKey),false);
 assert.equal(ui.storage.get(positionKey),savedPosition);
 await ui.click('watchClose');await ui.open();await ui.flushFrames();
 assert.deepEqual(size(ui),{width:600,height:340});
 assert.equal(ui.storage.has(sizeKey),false);
});

test('resize accepts only the owning left pointer and persists the final local dimensions separately from position',async()=>{
 const savedPosition=JSON.stringify({left:100,top:100}),ui=await opened({savedPosition}),handle=ui.node('watchResize'),before=size(ui),requests=ui.network.length;
 handle.onpointerdown(pointer(7,100,100,2));handle.onpointermove(pointer(7,300,300));
 assert.equal(handle.hasPointerCapture(7),false);assert.deepEqual(size(ui),before);assert.equal(ui.storage.has(sizeKey),false);
 handle.onpointerdown(pointer(7,100,100));assert.equal(handle.hasPointerCapture(7),true);
 handle.onpointerdown(pointer(8,100,100));assert.equal(handle.hasPointerCapture(8),false);
 const bar=ui.node('watchWindowBar');bar.onpointerdown(pointer(9,100,100));assert.equal(bar.hasPointerCapture(9),false);
 handle.onpointermove(pointer(8,300,300));handle.onpointerup(pointer(8,300,300));await ui.flushFrames();
 assert.deepEqual(size(ui),before);assert.equal(handle.hasPointerCapture(7),true);assert.equal(ui.storage.has(sizeKey),false);
 handle.onpointermove(pointer(7,240,260));await ui.flushFrames();
 assert.ok(size(ui).width>before.width);assert.ok(size(ui).height>before.height);assert.equal(ui.storage.has(sizeKey),false);
 handle.onpointerup(pointer(7,240,260));await ui.flushFrames();
 assert.equal(handle.hasPointerCapture(7),false);assert.deepEqual(JSON.parse(ui.storage.get(sizeKey)),size(ui));
 assert.equal(ui.storage.get(positionKey),savedPosition);assertSafeSize(ui);
 const final=size(ui),stored=ui.storage.get(sizeKey);handle.onpointermove(pointer(7,500,500));handle.onpointerup(pointer(7,500,500));
 assert.deepEqual(size(ui),final);assert.equal(ui.storage.get(sizeKey),stored);assert.equal(ui.network.length,requests);
});

test('pointer resize clamps both extremes and cancellation releases capture without changing the room',async()=>{
 const ui=await opened(),handle=ui.node('watchResize'),requests=ui.network.length;
 handle.onpointerdown(pointer(1,100,100));handle.onpointermove(pointer(1,10000,10000));await ui.flushFrames();assertSafeSize(ui);
 const largest=size(ui);handle.onpointerup(pointer(1,10000,10000));await ui.flushFrames();
 handle.onpointerdown(pointer(2,100,100));handle.onpointermove(pointer(2,-10000,-10000));await ui.flushFrames();assertSafeSize(ui);
 assert.ok(size(ui).width<largest.width);assert.ok(size(ui).height<largest.height);
 handle.onpointercancel(pointer(2,-10000,-10000));await ui.flushFrames();assert.equal(handle.hasPointerCapture(2),false);
 const final=size(ui);handle.onpointermove(pointer(2,10000,10000));assert.deepEqual(size(ui),final);assert.equal(ui.network.length,requests);
});

test('closing during a resize releases capture and late gestures cannot persist a size or recreate the player',async()=>{
 const ui=await joined(),handle=ui.node('watchResize'),player=ui.players.at(-1),requests=ui.network.length;
 handle.onpointerdown(pointer(9,100,100));handle.onpointermove(pointer(9,140,180));assert.equal(handle.hasPointerCapture(9),true);
 await ui.click('watchClose');await ui.flushFrames();assert.equal(handle.hasPointerCapture(9),false);
 const after=size(ui),stored=ui.storage.get(sizeKey);
 handle.onpointermove(pointer(9,500,500));handle.onpointerup(pointer(9,500,500));handle.onpointercancel(pointer(9,500,500));await ui.flushFrames();
 assert.deepEqual(size(ui),after);assert.equal(ui.storage.get(sizeKey),stored);assert.equal(ui.node('tableWatch').open,false);
 assert.equal(player.destroyed,true);assert.equal(ui.players.length,1);assert.equal(ui.music.active,0);assert.equal(ui.audio.active,0);
 assert.equal(ui.frames.size,0);assert.equal(ui.timers.size,0);assert.equal(ui.network.length,requests);
});

test('keyboard resizing supports normal and Shift steps while Home and the size reset preserve the saved position',async()=>{
 const savedPosition=JSON.stringify({left:50,top:50}),ui=await opened({savedPosition}),handle=ui.node('watchResize'),initial=size(ui);
 assert.match(handle.getAttribute('aria-label')||'',/大小|尺寸/);
 assert.ok(handle.tagName==='BUTTON'||handle.getAttribute('tabindex')==='0','the resize control is keyboard focusable');
 handle.focus();assert.equal(ui.document.activeElement,handle);
 handle.onkeydown(key('ArrowRight'));await ui.flushFrames();const normal=size(ui);assert.ok(normal.width>initial.width);
 handle.onkeydown(key('ArrowRight',true));await ui.flushFrames();const shifted=size(ui);assert.ok(shifted.width-normal.width>normal.width-initial.width);
 handle.onkeydown(key('ArrowUp'));await ui.flushFrames();assert.ok(size(ui).height<=shifted.height);assertSafeSize(ui);
 const stored=ui.storage.get(sizeKey),before=size(ui);let prevented=false;
 handle.onkeydown({...key('Enter'),preventDefault(){prevented=true;}});assert.equal(prevented,false);assert.deepEqual(size(ui),before);assert.equal(ui.storage.get(sizeKey),stored);
 handle.onkeydown(key('Home'));await ui.flushFrames();assert.deepEqual(size(ui),initial);assert.equal(ui.storage.has(sizeKey),false);
 handle.onkeydown(key('ArrowRight'));await ui.flushFrames();assert.equal(ui.storage.has(sizeKey),true);
 await ui.click('watchResetSize');await ui.flushFrames();assert.deepEqual(size(ui),initial);assert.equal(ui.storage.has(sizeKey),false);
 assert.equal(ui.storage.get(positionKey),savedPosition);assert.deepEqual(position(ui),{left:50,top:50});
});

test('saved dimensions restore across reopening and an independent load, without rewriting the old position object',async()=>{
 const savedPosition=JSON.stringify({left:50,top:50}),ui=await opened({savedPosition}),handle=ui.node('watchResize');
 handle.onpointerdown(pointer(1,100,100));handle.onpointermove(pointer(1,300,300));handle.onpointerup(pointer(1,300,300));await ui.flushFrames();
 const preferred=size(ui),savedSize=ui.storage.get(sizeKey);assert.equal(ui.storage.get(positionKey),savedPosition);
 await ui.click('watchClose');await ui.open();await ui.flushFrames();assert.deepEqual(size(ui),preferred);assert.equal(ui.storage.get(sizeKey),savedSize);
 const loaded=await opened({savedPosition,savedSize});assert.deepEqual(size(loaded),preferred);assert.equal(loaded.storage.get(positionKey),savedPosition);
});

test('temporary viewport clamps preserve preferred dimensions and location, then restore them on a larger viewport',async()=>{
 const savedPosition=JSON.stringify({left:160,top:70}),savedSize=JSON.stringify({width:1000,height:620}),ui=await opened({savedPosition,savedSize});
 assert.deepEqual(size(ui),{width:1000,height:620});assert.deepEqual(position(ui),{left:160,top:70});const requests=ui.network.length;
 ui.window.innerWidth=800;ui.window.innerHeight=500;ui.window.dispatch('resize');await ui.flushFrames();assertSafeSize(ui);
 assert.ok(size(ui).width<1000);assert.ok(size(ui).height<620);assert.equal(ui.storage.get(sizeKey),savedSize);assert.equal(ui.storage.get(positionKey),savedPosition);
 const constrained=rect(ui);assert.ok(constrained.left>=8&&constrained.top>=8);assert.ok(constrained.right<=800-8&&constrained.bottom<=500-8);
 ui.window.innerWidth=1280;ui.window.innerHeight=720;ui.window.dispatch('resize');await ui.flushFrames();
 assert.deepEqual(size(ui),{width:1000,height:620});assert.deepEqual(position(ui),{left:160,top:70});
 assert.equal(ui.storage.get(sizeKey),savedSize);assert.equal(ui.storage.get(positionKey),savedPosition);assert.equal(ui.network.length,requests);
});

test('minimum height follows measured window chrome rather than a fixed small-screen estimate',async()=>{
 const savedSize=JSON.stringify({width:600,height:260}),measurements={watchWindowBar:{height:72},watchStatus:{height:24},watchResizeBar:{height:44}};
 const normal=await opened({savedSize,measurements});assertSafeSize(normal);
 const larger=await opened({savedSize,measurements:{...measurements,watchWindowBar:{height:128},watchResizeBar:{height:64}}});assertSafeSize(larger);
 assert.ok(size(larger).height>size(normal).height,'wrapping or larger controls increase the safe window-height budget');
 assert.equal(normal.storage.get(sizeKey),savedSize);assert.equal(larger.storage.get(sizeKey),savedSize);
 const before=size(larger).height;larger.node('watchWindowBar').rect.height+=32;larger.window.dispatch('resize');await larger.flushFrames();
 assert.ok(size(larger).height>before);assert.equal(larger.storage.get(sizeKey),savedSize);
});

test('malformed, non-finite or unavailable size storage is harmless, and finite extreme sizes are bounded',async t=>{
 const invalid={malformed:{savedSize:'not JSON'},missingHeight:{savedSize:JSON.stringify({width:700})},wrongType:{savedSize:JSON.stringify({width:'700',height:500})},nonFinite:{savedSize:'{"width":1e400,"height":500}'},unavailable:{storageFailure:true}};
 for(const [name,options] of Object.entries(invalid))await t.test(name,async()=>{
  const ui=await opened(options);assert.deepEqual(size(ui),{width:600,height:340});
  ui.node('watchResize').onkeydown(key('ArrowRight'));await ui.flushFrames();assertSafeSize(ui);
  await ui.click('watchResetSize');await ui.flushFrames();assert.deepEqual(size(ui),{width:600,height:340});
 });
 for(const preferred of [{width:10,height:10},{width:100000,height:100000}])await t.test(JSON.stringify(preferred),async()=>{
  const savedSize=JSON.stringify(preferred),ui=await opened({savedSize});assertSafeSize(ui);assert.equal(ui.storage.get(sizeKey),savedSize);
 });
});

test('narrow layout follows the local window width on a wide desktop and toggling controls does not rebuild the iframe',async()=>{
 const ui=await joined({savedSize:JSON.stringify({width:700,height:600})}),player=ui.players.at(-1),originalFrame=frame(ui),requests=ui.network.length,calls=player.calls.length;
 assert.equal(ui.window.innerWidth,1280);assert.equal(ui.node('tableWatch').classList.contains('watch-narrow'),true);
 await ui.click('watchControlsToggle');await ui.flushFrames();assert.equal(ui.node('watchRoomControls').hidden,false);assert.equal(ui.node('tableWatch').classList.contains('watch-narrow'),true);
 const handle=ui.node('watchResize');handle.onpointerdown(pointer(3,100,100));handle.onpointermove(pointer(3,320,100));handle.onpointerup(pointer(3,320,100));await ui.flushFrames();
 assert.ok(size(ui).width>=850);assert.equal(ui.node('tableWatch').classList.contains('watch-narrow'),false);
 await ui.click('watchControlsToggle');await ui.flushFrames();assert.equal(ui.node('watchRoomControls').hidden,true);
 assert.equal(frame(ui),originalFrame);assert.equal(ui.players.at(-1),player);assert.equal(ui.players.length,1);assert.equal(player.destroyed,false);
 assert.equal(player.calls.length,calls);assert.equal(ui.network.length,requests);
});

test('two viewers resize, reset and restore independently without GET/POST, iframe churn or playback commands',async()=>{
 const a=await joined(),b=await joined(),beforeB={size:size(b),position:position(b)},players=[a.players.at(-1),b.players.at(-1)],frames=[frame(a),frame(b)],counts=[a.network.length,b.network.length],calls=players.map(player=>player.calls.length);
 const handle=a.node('watchResize');handle.onpointerdown(pointer(4,100,100));handle.onpointermove(pointer(4,260,280));handle.onpointerup(pointer(4,260,280));await a.flushFrames();
 assert.notDeepEqual(size(a),beforeB.size);assert.deepEqual(size(b),beforeB.size);assert.deepEqual(position(b),beforeB.position);assert.equal(b.storage.has(sizeKey),false);
 await a.click('watchResetSize');await a.flushFrames();assert.deepEqual(size(b),beforeB.size);
 for(const [index,ui] of [a,b].entries()){
  assert.equal(frame(ui),frames[index]);assert.equal(ui.players.at(-1),players[index]);assert.equal(ui.players.length,1);assert.equal(players[index].destroyed,false);
  assert.equal(players[index].calls.length,calls[index]);assert.equal(ui.network.length,counts[index]);assert.equal(ui.music.active,1);assert.equal(ui.audio.active,1);
  assert.equal(ui.network.filter(request=>request.options.method==='POST').length,0);
 }
});
