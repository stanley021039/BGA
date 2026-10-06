const {test}=require('node:test');
const assert=require('node:assert/strict');
const {watchHarness,watchSnapshot,roomState,deferred,json,flush}=require('./helpers/watch-browser.cjs');
const gets=ui=>ui.network.filter(request=>request.options.method!=='POST');
const playing=changes=>watchSnapshot({playback:{state:'playing',anchorPositionSec:12,anchorServerMs:100000,rate:1},...changes});

test('a joined viewer retries the same failed pause or stop marker on existing updates, then stops making watch requests',async t=>{
 for(const action of ['pause','stop'])await t.test(action,async()=>{
  let snapshot=playing(),failed=false;const ui=watchHarness({fetchHandler:()=>{if(snapshot.revision===2&&!failed){failed=true;throw Error('temporary network failure');}return json(snapshot);}});
  ui.update(roomState(snapshot));await ui.open();await ui.join();const player=ui.players.at(-1);player.ready();assert.equal(player.getPlayerState(),1);
  snapshot=action==='pause'?watchSnapshot({revision:2,playback:{state:'paused',anchorPositionSec:31,anchorServerMs:100000,rate:1}}):watchSnapshot({revision:2,video:null,watchSessionId:'stopped-session',canControl:false});
  ui.update(roomState(snapshot));await flush();assert.equal(gets(ui).length,3);assert.match(ui.node('watchStatus').textContent,/temporary network failure/);
  for(let i=0;i<30;i++)ui.update(roomState(snapshot));await flush();assert.equal(gets(ui).length,3);assert.equal(ui.timers.size,1);
  await ui.advance(999);ui.update(roomState(snapshot));await flush();assert.equal(gets(ui).length,3);
  await ui.advance(1);assert.equal(gets(ui).length,3);ui.update(roomState(snapshot));await flush();assert.equal(gets(ui).length,4);
  if(action==='pause'){assert.equal(player.getPlayerState(),2);assert.deepEqual(player.calls.slice(-2),[['cue',{videoId:'M7lc1UVf-VE',startSeconds:31}],['pause']]);assert.equal(ui.node('watchClock').textContent,'0:31 · 已暫停');}
  else{assert.equal(player.destroyed,true);assert.equal(ui.node('watchJoin').disabled,true);assert.equal(ui.node('watchLocal').hidden,true);assert.equal(ui.music.active,0);}
  for(let i=0;i<30;i++){ui.update(roomState(snapshot));await ui.advance(1000);}assert.equal(gets(ui).length,4);assert.equal(ui.network.filter(request=>request.body).length,0);
 });
});

test('an initial failed snapshot also recovers from the unchanged game marker without a new timer or manual reopen',async()=>{
 let calls=0;const ui=watchHarness({youtube:false,fetchHandler:()=>++calls===1?json({error:'temporarily unavailable'},{ok:false,status:503}):json(watchSnapshot())});
 ui.update(roomState());await ui.open();assert.equal(ui.node('watchProposeSubmit').disabled,true);assert.equal(ui.timers.size,1);assert.equal(ui.thirdParty.length,0);
 await ui.advance(1000);assert.equal(calls,1);ui.update(roomState());await flush();assert.equal(calls,2);assert.equal(ui.node('watchProposeSubmit').disabled,false);assert.equal(ui.node('watchJoin').disabled,false);
 for(let i=0;i<100;i++)ui.update(roomState());await ui.advance(100000);assert.equal(calls,2);assert.equal(ui.timers.size,1);await ui.click('watchClose');assert.equal(ui.timers.size,0);
});

test('an initial room without a watch marker can recover its failed opening snapshot through existing game updates',async()=>{
 let calls=0;const ui=watchHarness({youtube:false,fetchHandler:()=>++calls===1?json({error:'temporary outage'},{ok:false,status:503}):json(watchSnapshot({video:null}))});ui.update(roomState(null));await ui.open();assert.equal(calls,1);
 await ui.advance(1000);ui.update(roomState(null));await flush();assert.equal(calls,2);assert.equal(ui.node('watchProposeSubmit').disabled,false);ui.update(roomState(null));await ui.advance(10000);assert.equal(calls,2);
});

test('HTTP timeout, rate limit and malformed JSON failures recover with the same bounded update-driven retry',async t=>{
 const responses={timeout:()=>json({error:'timed out'},{ok:false,status:408}),rateLimit:()=>json({error:'rate limited'},{ok:false,status:429}),malformed:()=>({ok:true,status:200,json:async()=>{throw SyntaxError('invalid response JSON');}})};
 for(const [name,failed] of Object.entries(responses))await t.test(name,async()=>{
  let calls=0;const ui=watchHarness({youtube:false,fetchHandler:()=>++calls===1?failed():json(watchSnapshot())});ui.update(roomState());await ui.open();await ui.advance(999);ui.update(roomState());await flush();assert.equal(calls,1);await ui.advance(1);ui.update(roomState());await flush();assert.equal(calls,2);assert.equal(ui.node('watchJoin').disabled,false);assert.equal(ui.timers.size,1);
 });
});

test('a rejected permission response stops automatic retries even when its error body cannot be parsed',async()=>{
 const ui=watchHarness({youtube:false,fetchHandler:()=>({ok:false,status:403,json:async()=>{throw SyntaxError('invalid JSON');}})});ui.update(roomState());await ui.open();for(let i=0;i<10;i++){await ui.advance(10000);ui.update(roomState());await flush();}assert.equal(gets(ui).length,1);assert.match(ui.node('watchStatus').textContent,/關閉後重開/);
});

test('permanent transient failure consumes only three attempts with one and four second gates, and a new marker starts its own budget',async()=>{
 const ui=watchHarness({youtube:false,fetchHandler:()=>json({error:'temporarily unavailable'},{ok:false,status:503})});ui.update(roomState());await ui.open();
 for(let i=0;i<100;i++)ui.update(roomState());await flush();assert.equal(gets(ui).length,1);
 await ui.advance(999);ui.update(roomState());await flush();assert.equal(gets(ui).length,1);
 await ui.advance(1);ui.update(roomState());await flush();assert.equal(gets(ui).length,2);
 await ui.advance(3999);ui.update(roomState());await flush();assert.equal(gets(ui).length,2);
 await ui.advance(1);ui.update(roomState());await flush();assert.equal(gets(ui).length,3);assert.match(ui.node('watchStatus').textContent,/關閉後重開.*返回全桌進度/);
 for(let i=0;i<100;i++){ui.update(roomState());await ui.advance(10000);}assert.equal(gets(ui).length,3);assert.equal(ui.timers.size,1);
 ui.update(roomState(watchSnapshot({revision:2})));await flush();assert.equal(gets(ui).length,4);for(let i=0;i<100;i++)ui.update(roomState(watchSnapshot({revision:2})));await flush();assert.equal(gets(ui).length,4);
});

test('permission and missing-room HTTP errors do not retry on game updates',async t=>{
 for(const status of [401,403,404,422])await t.test(String(status),async()=>{
  const ui=watchHarness({youtube:false,fetchHandler:()=>json({error:'request rejected'},{ok:false,status})});ui.update(roomState());await ui.open();assert.match(ui.node('watchStatus').textContent,/關閉後重開/);
  for(let i=0;i<10;i++){ui.update(roomState());await ui.advance(10000);}assert.equal(gets(ui).length,1);await ui.click('watchClose');assert.equal(ui.timers.size,0);
 });
});

test('explicit rejoin can start a fresh budget after automatic retries are exhausted',async()=>{
 let snapshot=playing(),fail=false;const ui=watchHarness({fetchHandler:()=>fail?json({error:'temporary outage'},{ok:false,status:503}):json(snapshot)});ui.update(roomState(snapshot));await ui.open();await ui.join();const player=ui.players.at(-1);player.ready();
 snapshot=watchSnapshot({revision:2});fail=true;ui.update(roomState(snapshot));await flush();await ui.advance(1000);ui.update(roomState(snapshot));await flush();await ui.advance(4000);ui.update(roomState(snapshot));await flush();assert.equal(gets(ui).length,5);
 fail=false;await ui.click('watchRejoin');assert.equal(gets(ui).length,6);assert.equal(player.getPlayerState(),2);assert.equal(ui.node('watchClock').textContent,'0:12 · 已暫停');ui.update(roomState(snapshot));await flush();assert.equal(gets(ui).length,6);
});

test('closing or changing room invalidates a failed request and does not exhaust the next view retry budget',async t=>{
 for(const change of ['close','room','instance'])await t.test(change,async()=>{
  const old=deferred();let calls=0;const fresh=watchSnapshot({roomInstanceId:change==='instance'?'room-instance-b':'room-instance-a',controllerName:'最新控制者'});const ui=watchHarness({youtube:false,fetchHandler:()=>++calls===1?old.promise:calls===2?json({error:'new view temporarily unavailable'},{ok:false,status:503}):json(fresh)});
  ui.update(roomState());const firstOpen=ui.node('tableWatchOpen').click();await flush();const signal=gets(ui)[0].options.signal;
  if(change==='close')await ui.click('watchClose');else ui.update(roomState(fresh,{code:change==='room'?'NEW456':'ABC123'}));assert.equal(signal.aborted,true);assert.equal(ui.timers.size,0);
  await ui.open();assert.equal(calls,2);const status=ui.node('watchStatus').textContent;old.resolve(json({error:'old forbidden'},{ok:false,status:403}));await firstOpen;assert.equal(ui.node('watchStatus').textContent,status);
  await ui.advance(1000);ui.update(roomState(fresh,{code:change==='room'?'NEW456':'ABC123'}));await flush();assert.equal(calls,3);assert.equal(ui.node('watchController').textContent,'控制者：最新控制者');
 });
});

test('a failed in-flight marker still fetches the newest coalesced marker exactly once',async()=>{
 const old=deferred(),latest=deferred();let calls=0;const ui=watchHarness({fetchHandler:()=>++calls===1?json(watchSnapshot()):calls===2?old.promise:latest.promise});ui.update(roomState());await ui.open();
 ui.update(roomState(watchSnapshot({revision:2})));await flush();ui.update(roomState(watchSnapshot({revision:3})));ui.update(roomState(watchSnapshot({revision:4})));ui.update(roomState(watchSnapshot({revision:4})));await flush();assert.equal(calls,2);
 old.resolve(json({error:'temporary outage'},{ok:false,status:503}));await flush();assert.equal(calls,3);assert.equal(gets(ui)[2].options.signal.aborted,false);
 latest.resolve(json(watchSnapshot({revision:4,playback:{state:'paused',anchorPositionSec:44,anchorServerMs:100000,rate:1}})));await flush();assert.equal(ui.node('watchClock').textContent,'0:44 · 已暫停');for(let i=0;i<20;i++)ui.update(roomState(watchSnapshot({revision:4})));await ui.advance(100000);assert.equal(calls,3);
});

test('a response newer than the coalesced marker already satisfies it without an extra snapshot GET',async()=>{
 const pending=deferred();let calls=0;const latest=watchSnapshot({revision:4,playback:{state:'paused',anchorPositionSec:44,anchorServerMs:100000,rate:1}});const ui=watchHarness({fetchHandler:()=>++calls===1?json(watchSnapshot()):calls===2?pending.promise:json(latest)});ui.update(roomState());await ui.open();
 ui.update(roomState(watchSnapshot({revision:2})));await flush();ui.update(roomState(watchSnapshot({revision:3})));await flush();assert.equal(calls,2);
 pending.resolve(json(latest));await flush();assert.equal(ui.node('watchClock').textContent,'0:44 · 已暫停');assert.equal(calls,2);
 for(let i=0;i<20;i++){ui.update(roomState(watchSnapshot({revision:3})));await ui.advance(1000);}assert.equal(calls,2);
});

test('repeated updates during the same in-flight marker do not create an eager failure loop',async()=>{
 const pending=deferred();let calls=0;const ui=watchHarness({youtube:false,fetchHandler:()=>++calls===1?pending.promise:json(watchSnapshot())});ui.update(roomState());const opening=ui.node('tableWatchOpen').click();await flush();
 for(let i=0;i<100;i++)ui.update(roomState());pending.reject(Error('lost response'));await opening;await flush();assert.equal(calls,1);
 await ui.advance(10000);assert.equal(calls,1);ui.update(roomState());await flush();assert.equal(calls,2);assert.equal(ui.node('watchJoin').disabled,false);
});

test('a superseded explicit GET failure cannot overwrite current status or consume the current marker budget',async()=>{
 const old=deferred(),newer=deferred();let calls=0;const ui=watchHarness({fetchHandler:()=>++calls<=2?json(playing()):calls===3?old.promise:calls===4?newer.promise:json(watchSnapshot({revision:2}))});ui.update(roomState(playing()));await ui.open();await ui.join();ui.players.at(-1).ready();
 const first=ui.node('watchRejoin').click(),second=ui.node('watchRejoin').click();await flush();ui.update(roomState(watchSnapshot({revision:2})));newer.resolve(json({error:'current temporary error'},{ok:false,status:503}));await second;await flush();assert.equal(calls,5);assert.equal(ui.node('watchClock').textContent,'0:12 · 已暫停');
 const status=ui.node('watchStatus').textContent;old.resolve(json({error:'superseded forbidden'},{ok:false,status:403}));await first;assert.equal(ui.node('watchStatus').textContent,status);ui.update(roomState(watchSnapshot({revision:2})));await ui.advance(10000);assert.equal(calls,5);
});

test('a stale successful HTTP body does not reset the missing marker retry budget on every game update',async()=>{
 const ui=watchHarness({youtube:false,fetchHandler:()=>json(watchSnapshot())});ui.update(roomState());await ui.open();ui.update(roomState(watchSnapshot({revision:2})));await flush();assert.equal(gets(ui).length,2);
 for(let i=0;i<10;i++)ui.update(roomState(watchSnapshot({revision:2})));await flush();assert.equal(gets(ui).length,2);await ui.advance(1000);ui.update(roomState(watchSnapshot({revision:2})));await flush();assert.equal(gets(ui).length,3);
 await ui.advance(4000);ui.update(roomState(watchSnapshot({revision:2})));await flush();assert.equal(gets(ui).length,4);for(let i=0;i<100;i++){ui.update(roomState(watchSnapshot({revision:2})));await ui.advance(1000);}assert.equal(gets(ui).length,4);
});
