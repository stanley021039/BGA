const {test}=require('node:test');
const assert=require('node:assert/strict');
const {watchHarness,watchSnapshot,roomState,json}=require('./helpers/watch-browser.cjs');
const posts=ui=>ui.network.filter(request=>request.options.method==='POST');
const uuidV4=/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;

test('native randomUUID is preferred and the cryptographic fallback is not called',async()=>{
 let nativeCalls=0;const expected='a6153d9f-c248-4a86-9b3c-54c4ac9ab060';const source={randomUUID(){assert.equal(this,source);nativeCalls++;return expected;},getRandomValues(){throw Error('fallback should not run');}};
 const ui=watchHarness({crypto:source});ui.update(roomState());await ui.open();await ui.click('watchPlay');assert.equal(posts(ui).length,1);assert.equal(posts(ui)[0].body.requestId,expected);assert.equal(nativeCalls,1);
});

test('a missing randomUUID uses getRandomValues and produces correct v4 version and variant bits',async t=>{
 for(const [byte,expected] of [[0,'00000000-0000-4000-8000-000000000000'],[255,'ffffffff-ffff-4fff-bfff-ffffffffffff']])await t.test(String(byte),async()=>{
  let calls=0;const source={randomUUID:undefined,getRandomValues(bytes){assert.equal(this,source);assert.equal(bytes.BYTES_PER_ELEMENT,1);assert.equal(bytes.byteLength,16);calls++;bytes.fill(byte);return bytes;}};
  const ui=watchHarness({crypto:source});ui.update(roomState());await ui.open();await ui.click('watchPlay');assert.equal(posts(ui).length,1);assert.equal(posts(ui)[0].body.requestId,expected);assert.match(posts(ui)[0].body.requestId,uuidV4);assert.equal(calls,1);
 });
});

test('two different accepted operations create separate secure UUIDs',async()=>{
 let randomCalls=0,snapshot=watchSnapshot();const source={getRandomValues(bytes){bytes.fill(++randomCalls);return bytes;}};
 const ui=watchHarness({crypto:source,fetchHandler:request=>{if(request.body)snapshot=watchSnapshot({revision:snapshot.revision+1,playback:{state:request.body.action==='play'?'playing':'paused',anchorPositionSec:12,anchorServerMs:100000,rate:1}});return json(snapshot);}});
 ui.update(roomState());await ui.open();await ui.click('watchPlay');await ui.click('watchPause');assert.equal(posts(ui).length,2);assert.equal(randomCalls,2);assert.notEqual(posts(ui)[0].body.requestId,posts(ui)[1].body.requestId);for(const request of posts(ui))assert.match(request.body.requestId,uuidV4);
});

test('missing or failing secure randomness shows a recoverable UI error without POST or a rejected command promise',async t=>{
 const cases={missing:undefined,null:null,noMethods:{},fallbackThrows:{getRandomValues(){throw Error('secure random source blocked');}},nativeThrows:{randomUUID(){throw Error('UUID source blocked');}}};
 for(const [name,crypto] of Object.entries(cases))await t.test(name,async()=>{
  const ui=watchHarness({crypto});if(name==='missing')delete ui.context.crypto;ui.update(roomState());await ui.open();await assert.doesNotReject(()=>ui.click('watchPlay'));assert.equal(posts(ui).length,0);assert.equal(ui.node('watchPlay').disabled,false);assert.match(ui.node('watchStatus').textContent,/安全.*識別碼|source blocked/);
  ui.node('watchUrl').value='https://youtu.be/M7lc1UVf-VE';await ui.submit('watchPropose');assert.equal(posts(ui).length,0);assert.equal(ui.node('watchProposeSubmit').disabled,false);
  ui.context.crypto={getRandomValues(bytes){bytes.fill(12);return bytes;}};await ui.click('watchPlay');assert.equal(posts(ui).length,1);assert.match(posts(ui)[0].body.requestId,uuidV4);
 });
});

test('an uncertain retry reuses the same fallback UUID without requiring new randomness, while a rejected operation creates a new ID',async()=>{
 let randomCalls=0,postCalls=0;const initial=watchSnapshot(),source={getRandomValues(bytes){bytes.fill(++randomCalls);return bytes;}};
 const ui=watchHarness({crypto:source,fetchHandler:request=>{if(!request.body)return json(initial);postCalls++;if(postCalls===1)throw Error('lost response');if(postCalls===2)return json({error:'state changed',state:watchSnapshot({revision:2})},{ok:false,status:409});return json(watchSnapshot({revision:3}));}});
 ui.update(roomState());await ui.open();await ui.click('watchPlay');assert.match(ui.node('watchStatus').textContent,/安全重試/);delete ui.context.crypto;
 await ui.click('watchPlay');assert.deepEqual(posts(ui)[1].body,posts(ui)[0].body);assert.equal(randomCalls,1);await ui.click('watchPlay');assert.equal(posts(ui).length,2);assert.match(ui.node('watchStatus').textContent,/安全.*識別碼/);
 ui.context.crypto=source;await ui.click('watchPlay');assert.equal(posts(ui).length,3);assert.equal(randomCalls,2);assert.notEqual(posts(ui)[2].body.requestId,posts(ui)[0].body.requestId);assert.equal(posts(ui)[2].body.expectedRevision,2);
});
