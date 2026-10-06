const {test}=require('node:test');
const assert=require('node:assert/strict');
const {watchHarness,watchSnapshot,roomState,deferred,json,flush}=require('./helpers/watch-browser.cjs');
const posts=ui=>ui.network.filter(request=>request.options.method==='POST');
const scripts=ui=>ui.thirdParty.filter(node=>node.parentNode);
const iframe=ui=>ui.node('watchPlayer').children.filter(node=>node.tagName==='IFRAME');
const last=values=>values.at(-1);
const windowKey='bga.watch.window.v1';
const windowRect=ui=>{const {left,top}=ui.node('tableWatch').getBoundingClientRect();return {left,top};};
const pointer=(pointerId,x,y,button=0)=>({pointerId,clientX:x,clientY:y,button,preventDefault(){}});
const key=(value,shiftKey=false)=>({key:value,shiftKey,preventDefault(){}});

test('closed viewers receive existing game markers without any watch request, timer or third-party load',async()=>{
 const ui=watchHarness({youtube:false});
 for(let revision=0;revision<30;revision++){ui.update(roomState(watchSnapshot({revision})));await ui.advance(1000);}
 assert.equal(ui.node('tableWatchOpen').hidden,false);assert.match(ui.node('tableWatchOpen').getAttribute('aria-label'),/房主/);
 assert.equal(ui.network.length,0);assert.equal(ui.timers.size,0);assert.equal(scripts(ui).length,0);assert.equal(iframe(ui).length,0);assert.equal(ui.music.active,0);
 ui.update(null);assert.equal(ui.node('tableWatchOpen').hidden,true);assert.equal(ui.network.length,0);
});

test('closed launcher uses the latest remote controller and stop marker instead of its cached snapshot without fetching or reopening',async()=>{
 const original=watchSnapshot({controllerName:'第一位控制者'}),ui=watchHarness({youtube:false,fetchHandler:()=>json(original)});ui.update(roomState(original));await ui.open();assert.match(ui.node('tableWatchOpen').title,/第一位控制者/);await ui.click('watchClose');const requests=ui.network.length;
 ui.update(roomState({...original,revision:2,controllerId:'next-seat',controllerName:'第二位控制者'}));assert.equal(ui.node('tableWatchOpen').title,'YouTube 共看 · 第二位控制者 控制');assert.equal(ui.node('tableWatchOpen').getAttribute('aria-label'),'YouTube 共看 · 第二位控制者 控制');assert.equal(ui.node('tableWatchOpen').classList.contains('has-video'),true);
 ui.update(roomState({...original,revision:3,video:null,controllerId:null,controllerName:null}));assert.equal(ui.node('tableWatchOpen').title,'YouTube 共看');assert.equal(ui.node('tableWatchOpen').getAttribute('aria-label'),'YouTube 共看');assert.equal(ui.node('tableWatchOpen').classList.contains('has-video'),false);await ui.advance(30000);assert.equal(ui.network.length,requests);assert.equal(posts(ui).length,0);assert.equal(ui.node('tableWatch').open,false);assert.equal(iframe(ui).length,0);assert.equal(scripts(ui).length,0);assert.equal(ui.timers.size,0);
});

test('opening consent fetches once; identical steady markers and anchor clock progression make no network traffic',async()=>{
 const playing=watchSnapshot({playback:{state:'playing',anchorPositionSec:12,anchorServerMs:100000,rate:1}}),ui=watchHarness({youtube:false,fetchHandler:()=>json(playing)});
 ui.update(roomState(playing));await ui.open();assert.equal(ui.network.length,1);assert.equal(ui.node('watchConsent').hidden,false);assert.equal(ui.node('watchLocal').hidden,true);
 for(let i=0;i<60;i++){ui.update(roomState(playing));await ui.advance(1000);}
 assert.equal(ui.node('watchClock').textContent,'1:12 · 播放中');assert.equal(ui.network.length,1);assert.equal(scripts(ui).length,0);assert.equal(iframe(ui).length,0);assert.equal(ui.music.active,0);
 await ui.click('watchClose');assert.equal(ui.timers.size,0);assert.equal(ui.node('tableWatch').open,false);
});

test('only an explicit join loads the third-party API and privacy-enhanced player at the authoritative anchor',async()=>{
 const ui=watchHarness({youtube:false});ui.update(roomState());await ui.open();assert.equal(scripts(ui).length,0);await ui.join();
 assert.equal(ui.network.length,2);assert.equal(posts(ui).length,0);assert.equal(scripts(ui).length,1);assert.equal(scripts(ui)[0].src,'https://www.youtube.com/iframe_api');assert.equal(iframe(ui).length,0);
 ui.installYT();await flush();assert.equal(ui.players.length,1);const frame=iframe(ui)[0];assert.match(frame.src,/^https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?/);assert.match(frame.src,/enablejsapi=1&controls=1/);assert.match(frame.src,/origin=http%3A%2F%2Flocalhost%3A3000/);assert.equal(frame.getAttribute('referrerpolicy'),'strict-origin-when-cross-origin');assert.equal(frame.getAttribute('allow'),'autoplay; encrypted-media; fullscreen; picture-in-picture');
 ui.players[0].ready();assert.deepEqual(ui.players[0].calls.slice(-2),[['cue',{videoId:'M7lc1UVf-VE',startSeconds:12}],['pause']]);assert.equal(ui.music.active,1);assert.equal(ui.audio.active,1);assert.equal(posts(ui).length,0);
});

test('paused anchors cue without seek-induced playback; playing anchors seek then play, and native callbacks stay local',async t=>{
 const commands=(state,anchor)=>state==='paused'?[['cue',{videoId:'M7lc1UVf-VE',startSeconds:anchor}],['pause']]:[['seek',anchor,true],['play']];
 for(const state of ['paused','playing'])await t.test(state,async()=>{let snapshot=watchSnapshot({playback:{state,anchorPositionSec:12,anchorServerMs:100000,rate:1}});const ui=watchHarness({fetchHandler:()=>json(snapshot)});ui.update(roomState(snapshot));await ui.open();await ui.join();const player=last(ui.players);player.ready();
  assert.deepEqual(player.calls.slice(-2),commands(state,12));assert.equal(player.getPlayerState(),state==='paused'?2:1);assert.equal(posts(ui).length,0);
  const next=state==='paused'?'playing':'paused';snapshot=watchSnapshot({revision:2,playback:{state:next,anchorPositionSec:25,anchorServerMs:100000,rate:1}});ui.update(roomState(snapshot));await flush();assert.deepEqual(player.calls.slice(-2),commands(next,25));assert.equal(player.getPlayerState(),next==='paused'?2:1);assert.equal(posts(ui).length,0);
  const requests=ui.network.length,clock=ui.node('watchClock').textContent;for(const value of [1,2,3,0])player.state(value);assert.equal(ui.network.length,requests);assert.equal(ui.node('watchClock').textContent,clock);assert.equal(posts(ui).length,0);
 });
});

test('explicit transport controls send one revision-bound POST and block duplicate gestures until ACK',async()=>{
 const pending=deferred(),ui=watchHarness({fetchHandler:request=>request.body?pending.promise:json(watchSnapshot())});ui.update(roomState());await ui.open();
 const sending=ui.node('watchPlay').click();await flush();await ui.click('watchPlay');assert.equal(posts(ui).length,1);
 const body=posts(ui)[0].body;assert.equal(body.action,'play');assert.equal(body.code,'ABC123');assert.equal(body.roomInstanceId,'room-instance-a');assert.equal(body.watchSessionId,'watch-session-a');assert.equal(body.expectedRevision,1);assert.equal(body.controllerEpoch,1);assert.match(body.requestId,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
 pending.resolve(json(watchSnapshot({revision:2,playback:{state:'playing',anchorPositionSec:12,anchorServerMs:100000,rate:1}})));await sending;assert.equal(ui.node('watchPlay').disabled,true);assert.equal(ui.node('watchPause').disabled,false);assert.equal(ui.node('watchClock').textContent,'0:12 · 播放中');
});

test('seeks and proposals are explicit, validate local input, and permission-disabled gestures send nothing',async()=>{
 let snapshot=watchSnapshot();const ui=watchHarness({fetchHandler:request=>{if(!request.body)return json(snapshot);snapshot={...snapshot,revision:snapshot.revision+1};return json(snapshot);}});ui.update(roomState());await ui.open();
 for(const value of ['', '-1','86401','Infinity']){ui.node('watchSeek').value=value;await ui.submit('watchSeekForm');}assert.equal(posts(ui).length,0);
 ui.node('watchSeek').value='25.5';await ui.submit('watchSeekForm');assert.equal(posts(ui).length,1);assert.equal(posts(ui)[0].body.action,'seek');assert.equal(posts(ui)[0].body.positionSec,25.5);
 ui.node('watchUrl').value=' https://youtu.be/M7lc1UVf-VE ';await ui.submit('watchPropose');assert.equal(posts(ui).length,2);assert.equal(posts(ui)[1].body.action,'propose');assert.equal(posts(ui)[1].body.url,'https://youtu.be/M7lc1UVf-VE');assert.equal(ui.node('watchUrl').value,'');
 snapshot=watchSnapshot({revision:4,canControl:false,isHost:false,controllerName:'其他玩家'});ui.update(roomState(snapshot));await flush();assert.equal(ui.node('watchPlay').disabled,true);assert.equal(ui.node('watchStop').disabled,true);assert.equal(ui.node('watchTakeover').hidden,true);await ui.click('watchPlay');await ui.click('watchStop');assert.equal(posts(ui).length,2);
});

test('native YouTube state, buffering, autoplay and errors never broadcast; personal play stays local',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();await ui.join();const player=last(ui.players);player.ready();
 for(const value of [1,2,3,0])player.state(value);player.blocked();assert.match(ui.node('watchStatus').textContent,/需要你允許播放/);
 for(const error of [2,5,100,101,150,153,999]){player.error(error);assert.match(ui.node('watchStatus').textContent,/其他人的播放不受影響/);}
 await ui.click('watchLocalPlay');assert.deepEqual(last(player.calls),['play']);assert.equal(posts(ui).length,0);
 const count=player.calls.length;for(let i=0;i<5;i++){ui.update(roomState());await ui.advance(1000);}assert.equal(player.calls.length,count);assert.equal(ui.network.length,2);
});

test('local exit destroys its iframe and releases music, observers and settings without stopping the room',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();await ui.join();const player=last(ui.players);player.ready();
 await ui.click('watchExit');assert.equal(player.destroyed,true);assert.equal(iframe(ui).length,0);assert.equal(ui.music.active,0);assert.equal(ui.audio.active,0);assert.equal(ui.music.released,1);assert.equal(ui.node('tableWatch').open,true);assert.equal(ui.node('watchConsent').hidden,false);assert.equal(posts(ui).length,0);assert.equal(ui.observers.filter(observer=>observer.target!==ui.document.body&&observer.disconnected).length,2);
 const requests=ui.network.length;ui.update(roomState());await ui.advance(30000);assert.equal(ui.network.length,requests);assert.equal(ui.players.length,1);assert.equal(ui.music.released,1);
 await ui.join();last(ui.players).ready();assert.equal(ui.music.active,1);assert.equal(ui.players.length,2);await ui.click('watchClose');assert.equal(ui.music.active,0);assert.equal(ui.music.released,2);assert.equal(ui.timers.size,0);assert.equal(posts(ui).length,0);
});

test('header close, Escape, background, pagehide, another modal and disconnect all clean locally and never auto-reopen',async t=>{
 const closers={header:ui=>ui.node('watchClose').click(),Escape:ui=>ui.node('tableWatch').cancel(),hidden:ui=>ui.hidden(),pagehide:ui=>ui.pagehide(),otherDialog:ui=>ui.otherDialog(),dialogContract:ui=>ui.close(),disconnect:ui=>ui.window.TableWatch.disconnected(),stop:ui=>ui.window.TableWatch.stop()};
 for(const [name,close] of Object.entries(closers))await t.test(name,async()=>{const ui=watchHarness();ui.update(roomState());await ui.open();await ui.join();const player=last(ui.players);player.ready();close(ui);await flush();
  assert.equal(player.destroyed,true);assert.equal(ui.node('tableWatch').open,false);assert.equal(iframe(ui).length,0);assert.equal(ui.music.active,0);assert.equal(ui.audio.active,0);assert.equal(ui.timers.size,0);assert.equal(posts(ui).length,0);
  const requests=ui.network.length;ui.hidden(false);ui.update(roomState());await ui.advance(30000);assert.equal(ui.node('tableWatch').open,false);assert.equal(ui.network.length,requests);assert.equal(ui.players.length,1);
 });
});

test('marker changes coalesce while a GET is pending and stale markers never add a fetch',async()=>{
 const pending=deferred();let snapshot=watchSnapshot(),gets=0;const ui=watchHarness({fetchHandler:()=>{gets++;return gets===2?pending.promise:json(snapshot);}});ui.update(roomState(snapshot));await ui.open();
 snapshot=watchSnapshot({revision:2});ui.update(roomState(snapshot));await flush();assert.equal(gets,2);snapshot=watchSnapshot({revision:3});ui.update(roomState(snapshot));ui.update(roomState(snapshot));await flush();assert.equal(gets,2);
 pending.resolve(json(watchSnapshot({revision:2})));await flush();assert.equal(gets,3);assert.equal(ui.node('watchController').textContent,'控制者：房主');ui.update(roomState(watchSnapshot({revision:1})));await flush();await ui.advance(20000);assert.equal(gets,3);
});

test('a newer command ACK wins over an earlier in-flight snapshot and does not rewind the player',async()=>{
 const earlier=deferred();let gets=0;const current=watchSnapshot({revision:3,playback:{state:'playing',anchorPositionSec:40,anchorServerMs:100000,rate:1}}),ui=watchHarness({fetchHandler:request=>request.body?json(current):(++gets===2?earlier.promise:json(watchSnapshot()))});ui.update(roomState());await ui.open();ui.update(roomState(watchSnapshot({revision:2})));await flush();
 await ui.click('watchPlay');assert.equal(ui.node('watchClock').textContent,'0:40 · 播放中');earlier.resolve(json(watchSnapshot({revision:2,playback:{state:'paused',anchorPositionSec:2,anchorServerMs:100000,rate:1}})));await flush();assert.equal(ui.node('watchClock').textContent,'0:40 · 播放中');assert.equal(ui.node('watchPause').disabled,false);assert.equal(posts(ui).length,1);
});

test('same-revision reordered explicit rejoin replies keep the newer clock sample and do not repeat an older seek',async()=>{
 const old=deferred(),newer=deferred();let gets=0;const playing=watchSnapshot({playback:{state:'playing',anchorPositionSec:12,anchorServerMs:100000,rate:1}}),ui=watchHarness({fetchHandler:()=>++gets<=2?json(playing):gets===3?old.promise:newer.promise});ui.update(roomState(playing));await ui.open();await ui.join();const player=last(ui.players);player.ready();
 const first=ui.node('watchRejoin').click(),second=ui.node('watchRejoin').click();await flush();newer.resolve(json({...playing,serverNowMs:120000}));await second;assert.equal(ui.node('watchClock').textContent,'0:32 · 播放中');const seeks=player.calls.filter(call=>call[0]==='seek').length;
 old.resolve(json(playing));await first;assert.equal(ui.node('watchClock').textContent,'0:32 · 播放中');assert.equal(player.calls.filter(call=>call[0]==='seek').length,seeks);assert.equal(posts(ui).length,0);
});

test('an accepted stop clears only joined adapters; consent observers do not reconnect and no native callback echoes it',async()=>{
 const stopped=watchSnapshot({revision:2,watchSessionId:'watch-session-cleared',video:null,canControl:false,controllerId:null,controllerName:null}),ui=watchHarness({fetchHandler:request=>json(request.body?stopped:watchSnapshot())});ui.update(roomState());await ui.open();await ui.join();const player=last(ui.players);player.ready();await ui.click('watchStop');
 assert.equal(posts(ui).length,1);assert.equal(posts(ui)[0].body.action,'stop');assert.equal(player.destroyed,true);assert.equal(iframe(ui).length,0);assert.equal(ui.music.active,0);assert.equal(ui.node('watchTransport').hidden,true);assert.equal(ui.node('watchJoin').disabled,true);player.state(2);player.error(153);assert.equal(posts(ui).length,1);await ui.advance(10000);assert.equal(ui.network.length,3);assert.equal(ui.players.length,1);
});

test('late replies after room switch or dialog close cannot overwrite a reopened room',async t=>{
 for(const mode of ['room','instance','view'])await t.test(mode,async()=>{const old=deferred();let calls=0;const fresh=watchSnapshot({roomInstanceId:mode==='view'?'room-instance-a':'room-instance-b',revision:2,controllerName:'新房控制者',playback:{state:'paused',anchorPositionSec:50,anchorServerMs:100000,rate:1}});const ui=watchHarness({fetchHandler:()=>++calls===1?old.promise:json(fresh)});ui.update(roomState());const opening=ui.node('tableWatchOpen').click();await flush();const signal=ui.network[0].options.signal;
  if(mode==='view')await ui.click('watchClose');else ui.update(roomState(fresh,{code:mode==='room'?'NEW456':'ABC123'}));assert.equal(signal.aborted,true);await ui.open();assert.equal(ui.node('watchClock').textContent,'0:50 · 已暫停');old.resolve(json(watchSnapshot({revision:100,controllerName:'舊房控制者'})));await opening;await flush();assert.equal(ui.node('watchController').textContent,'控制者：新房控制者');assert.equal(ui.node('watchClock').textContent,'0:50 · 已暫停');assert.equal(ui.node('tableWatch').open,true);
 });
});

test('a POST reply after leaving never opens or changes the next room; cleanup aborts the request',async()=>{
 const pending=deferred();let latest=watchSnapshot();const ui=watchHarness({fetchHandler:request=>request.body?pending.promise:json(latest)});ui.update(roomState());await ui.open();const sending=ui.node('watchPlay').click();await flush();const signal=posts(ui)[0].options.signal;
 latest=watchSnapshot({roomInstanceId:'room-instance-b',controllerName:'另一桌',canControl:false,isHost:false});ui.update(roomState(latest,{code:'NEW456',me:'new-seat'}));assert.equal(signal.aborted,true);assert.equal(ui.node('tableWatch').open,false);await ui.open();pending.resolve(json(watchSnapshot({revision:50,controllerName:'旧桌'})));await sending;assert.equal(ui.node('watchController').textContent,'控制者：另一桌');assert.equal(ui.node('watchPlay').disabled,true);assert.equal(posts(ui).length,1);
});

test('uncertain network outcomes retry the same explicit operation UUID; HTTP rejection refreshes state and creates a new request',async()=>{
 let count=0;const initial=watchSnapshot(),updated=watchSnapshot({revision:2});const ui=watchHarness({fetchHandler:request=>{if(!request.body)return json(initial);count++;if(count===1)throw Error('lost response');if(count===2)return json({error:'狀態已更新',state:updated},{ok:false,status:409});return json(watchSnapshot({revision:3,playback:{state:'playing',anchorPositionSec:12,anchorServerMs:100000,rate:1}}));}});ui.update(roomState(initial));await ui.open();await ui.click('watchPlay');assert.match(ui.node('watchStatus').textContent,/安全重試/);assert.equal(ui.node('watchPlay').disabled,false);
 await ui.click('watchPlay');assert.deepEqual(posts(ui)[1].body,posts(ui)[0].body);assert.equal(ui.node('watchPlay').disabled,false);await ui.click('watchPlay');assert.notEqual(posts(ui)[2].body.requestId,posts(ui)[0].body.requestId);assert.equal(posts(ui)[2].body.expectedRevision,2);assert.equal(ui.node('watchPlay').disabled,true);
});

test('a failed snapshot load can close and reopen successfully without a third-party connection',async()=>{
 let fail=true;const ui=watchHarness({youtube:false,fetchHandler:()=>fail?json({error:'伺服器稍後再試'},{ok:false,status:503}):json(watchSnapshot())});ui.update(roomState());await ui.open();assert.match(ui.node('watchStatus').textContent,/稍後再試/);assert.equal(ui.node('watchProposeSubmit').disabled,true);assert.equal(scripts(ui).length,0);
 await ui.click('watchClose');fail=false;await ui.open();assert.equal(ui.node('watchJoin').disabled,false);assert.equal(ui.node('watchProposeSubmit').disabled,false);assert.equal(ui.network.length,2);assert.equal(scripts(ui).length,0);
});

test('YouTube API load failure and close cancellation release resources and allow a fresh explicit join',async t=>{
 for(const mode of ['error','timeout','close'])await t.test(mode,async()=>{const ui=watchHarness({youtube:false});ui.update(roomState());await ui.open();await ui.join();const script=scripts(ui)[0];assert.equal(ui.music.active,1);
  if(mode==='error')script.onerror();else if(mode==='timeout')await ui.advance(20000);else await ui.click('watchClose');await flush();assert.equal(script.parentNode,null);assert.equal(ui.music.active,0);assert.equal(ui.audio.active,0);assert.equal(iframe(ui).length,0);
  if(mode==='close'){ui.installYT();await flush();assert.equal(ui.players.length,0);await ui.open();}else assert.match(ui.node('watchStatus').textContent,/未能載入/);
  await ui.join();if(!ui.window.YT)ui.installYT();await flush();assert.equal(ui.players.length,1);last(ui.players).ready();assert.equal(ui.music.active,1);await ui.click('watchClose');assert.equal(ui.music.active,0);assert.equal(ui.timers.size,0);assert.equal(posts(ui).length,0);
 });
});

test('individual exit during API loading immediately removes its script and timeout, then a new explicit join succeeds',async()=>{
 const ui=watchHarness({youtube:false});ui.update(roomState());await ui.open();await ui.join();const firstScript=scripts(ui)[0];assert.equal(ui.timers.size,2);assert.equal(ui.music.active,1);assert.equal(ui.audio.active,1);
 await ui.click('watchExit');assert.equal(ui.node('tableWatch').open,true);assert.equal(firstScript.parentNode,null);assert.equal(scripts(ui).length,0);assert.equal(ui.timers.size,1);assert.equal([...ui.timers.values()][0].repeat,1000);assert.equal(ui.window.onYouTubeIframeAPIReady,undefined);assert.equal(iframe(ui).length,0);assert.equal(ui.music.active,0);assert.equal(ui.audio.active,0);assert.match(ui.node('watchStatus').textContent,/自己的影片已關閉/);
 const requests=ui.network.length;await ui.advance(30000);assert.equal(ui.network.length,requests);assert.equal(ui.players.length,0);assert.match(ui.node('watchStatus').textContent,/自己的影片已關閉/);assert.equal(posts(ui).length,0);
 await ui.join();assert.equal(scripts(ui).length,1);assert.notEqual(scripts(ui)[0],firstScript);ui.installYT();await flush();assert.equal(ui.players.length,1);last(ui.players).ready();assert.deepEqual(last(ui.players).calls.slice(-2),[['cue',{videoId:'M7lc1UVf-VE',startSeconds:12}],['pause']]);assert.equal(ui.music.active,1);assert.equal(ui.audio.active,1);
 await ui.click('watchClose');assert.equal(ui.timers.size,0);assert.equal(ui.music.active,0);assert.equal(ui.audio.active,0);assert.equal(posts(ui).length,0);
});

test('personal sound settings affect only this adapter and release their subscription with the music suspension',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();await ui.join();const player=last(ui.players);player.ready();assert.ok(player.calls.some(call=>call[0]==='mute'));
 await ui.click('watchSound');assert.equal(ui.node('watchSound').getAttribute('aria-pressed'),'true');assert.deepEqual(last(player.calls),['unmute']);assert.equal(ui.audio.changes[0].kind,'music');assert.equal(ui.audio.changes[0].options.gesture,true);
 ui.node('watchVolume').value='65';ui.node('watchVolume').oninput();assert.equal(ui.node('watchVolumeValue').textContent,'65%');assert.ok(player.calls.some(call=>call[0]==='volume'&&call[1]===65));assert.equal(posts(ui).length,0);
 await ui.click('watchClose');const count=player.calls.length;ui.window.AudioSettings.set('music',{volume:.2});assert.equal(player.calls.length,count);assert.equal(ui.audio.active,0);assert.equal(ui.audio.unsubscriptions,1);assert.equal(ui.music.released,1);
});

test('insufficient or hidden player geometry exits only locally; video changes invalidate old callbacks',async()=>{
 let snapshot=watchSnapshot();const ui=watchHarness({fetchHandler:()=>json(snapshot)});ui.update(roomState(snapshot));await ui.open();await ui.join();const old=last(ui.players);old.ready();
 snapshot=watchSnapshot({revision:2,watchSessionId:'watch-session-b',video:{provider:'youtube',id:'dQw4w9WgXcQ'}});ui.update(roomState(snapshot));await flush();const fresh=last(ui.players);assert.notEqual(fresh,old);assert.equal(old.destroyed,true);assert.equal(ui.music.active,1);fresh.ready();const status=ui.node('watchStatus').textContent;old.error(153);old.state(0);old.ready();assert.equal(ui.node('watchStatus').textContent,status);
 const intersection=ui.observers.findLast(observer=>observer.target===fresh.iframe);intersection.emit([{intersectionRatio:.3}]);assert.equal(fresh.destroyed,true);assert.equal(ui.node('tableWatch').open,true);assert.equal(ui.music.active,0);assert.equal(posts(ui).length,0);
 ui.node('watchPlayer').rect={width:190,height:190,top:60,bottom:250};await ui.join();assert.equal(ui.players.length,2);assert.equal(ui.music.active,0);assert.match(ui.node('watchStatus').textContent,/200 × 200/);assert.equal(posts(ui).length,0);
});

test('watch opens nonmodally and compact controls expand without reloading, rebuilding or commanding the video',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();assert.equal(ui.node('tableWatch').modal,false);assert.equal(ui.music.collapsed,1);assert.equal(ui.document.activeElement,ui.node('watchClose'));assert.equal(ui.node('watchControlsToggle').disabled,true);assert.equal(ui.node('watchRoomControls').hidden,false);
 await ui.click('watchControlsToggle');assert.equal(ui.node('watchRoomControls').hidden,false);await ui.join();const player=last(ui.players);player.ready();const frame=iframe(ui)[0],requests=ui.network.length,calls=player.calls.length;
 assert.equal(ui.node('tableWatch').classList.contains('watch-compact'),true);assert.equal(ui.node('watchRoomControls').hidden,true);assert.equal(ui.node('watchControlsToggle').getAttribute('aria-expanded'),'false');
 await ui.click('watchControlsToggle');assert.equal(ui.node('tableWatch').classList.contains('watch-compact'),false);assert.equal(ui.node('watchRoomControls').hidden,false);assert.equal(ui.node('watchControlsToggle').getAttribute('aria-expanded'),'true');assert.match(ui.node('watchControlsToggle').getAttribute('aria-label'),/收合/);
 await ui.click('watchControlsToggle');assert.equal(ui.node('watchRoomControls').hidden,true);assert.equal(iframe(ui)[0],frame);assert.equal(last(ui.players),player);assert.equal(player.calls.length,calls);assert.equal(ui.network.length,requests);assert.equal(posts(ui).length,0);
});

test('the focusable toolbar replaces the move button and dragging its title moves only the local window',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();const bar=ui.node('watchWindowBar');assert.equal(ui.document.getElementById('watchMove'),null);assert.equal(bar.tagName,'HEADER');assert.equal(bar.getAttribute('role'),'toolbar');assert.equal(bar.getAttribute('aria-label'),'影片視窗工具列');assert.equal(bar.getAttribute('tabindex'),'0');assert.equal(bar.getAttribute('aria-describedby'),'watchMoveHint');bar.focus();assert.equal(ui.document.activeElement,bar);
 const title=ui.node('watchTitle'),text=ui.document.createElement('span');bar.append(title);title.append(text);const requests=ui.network.length;const down={...pointer(21,100,100),target:text};bar.onpointerdown(down);assert.equal(bar.hasPointerCapture(21),true);bar.onpointermove({...pointer(21,50,70),target:text});bar.onpointerup({...pointer(21,50,70),target:text});assert.deepEqual(windowRect(ui),{left:622,top:342});assert.equal(bar.hasPointerCapture(21),false);
 bar.onkeydown({...key('ArrowLeft'),target:title});assert.deepEqual(windowRect(ui),{left:602,top:342});assert.deepEqual(JSON.parse(ui.storage.get(windowKey)),{left:602,top:342});assert.equal(ui.network.length,requests);assert.equal(posts(ui).length,0);
});

test('toolbar buttons and their nested icons do not start dragging or intercept native keyboard behavior',async()=>{
 const ui=watchHarness({savedPosition:JSON.stringify({left:100,top:100})});ui.update(roomState());await ui.open();const bar=ui.node('watchWindowBar'),buttons=['watchClose','watchResetPosition','watchControlsToggle'].map(id=>ui.node(id)),controls=[...buttons,...['a','input','select','textarea'].map(tag=>ui.document.createElement(tag))];const before=windowRect(ui),stored=ui.storage.get(windowKey),requests=ui.network.length;
 for(const control of controls){bar.append(control);const icon=ui.document.createElement('svg'),path=ui.document.createElement('path');control.append(icon);icon.append(path);for(const target of [control,path]){let prevented=false;bar.onpointerdown({...pointer(31,100,100),target,preventDefault(){prevented=true;}});assert.equal(prevented,false);assert.equal(bar.hasPointerCapture(31),false);bar.onpointermove({...pointer(31,10,10),target});bar.onpointerup({...pointer(31,10,10),target});assert.deepEqual(windowRect(ui),before);
   for(const value of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home']){prevented=false;bar.onkeydown({...key(value),target,preventDefault(){prevented=true;}});assert.equal(prevented,false);assert.deepEqual(windowRect(ui),before);assert.equal(ui.storage.get(windowKey),stored);}
  }}
 assert.equal(ui.network.length,requests);assert.equal(posts(ui).length,0);await ui.click('watchResetPosition');assert.deepEqual(windowRect(ui),{left:672,top:372});await ui.click('watchClose');assert.equal(ui.node('tableWatch').open,false);assert.equal(ui.document.activeElement,ui.node('music-expand'));
});

test('drag clamps the entire window, ignores unrelated pointers, saves only its finishing pointer and cancels cleanly',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();const move=ui.node('watchWindowBar'),original=windowRect(ui),requests=ui.network.length;
 move.onpointerdown(pointer(7,100,100,2));move.onpointermove(pointer(7,-1000,-1000));assert.deepEqual(windowRect(ui),original);assert.equal(move.hasPointerCapture(7),false);
 move.onpointerdown(pointer(7,100,100));assert.equal(move.hasPointerCapture(7),true);move.onpointermove(pointer(8,-1000,-1000));assert.deepEqual(windowRect(ui),original);move.onpointerup(pointer(8,100,100));assert.equal(move.hasPointerCapture(7),true);assert.equal(ui.storage.has(windowKey),false);
 move.onpointermove(pointer(7,-1000,-1000));assert.deepEqual(windowRect(ui),{left:8,top:8});assert.equal(ui.storage.has(windowKey),false);move.onpointermove(pointer(7,9000,9000));assert.deepEqual(windowRect(ui),{left:672,top:372});move.onpointercancel(pointer(7,9000,9000));assert.equal(move.hasPointerCapture(7),false);assert.deepEqual(JSON.parse(ui.storage.get(windowKey)),{left:672,top:372});
 const saved=ui.storage.get(windowKey);move.onpointermove(pointer(7,-1000,-1000));assert.deepEqual(windowRect(ui),{left:672,top:372});assert.equal(ui.storage.get(windowKey),saved);
 move.onpointerdown(pointer(9,100,100));move.onpointermove(pointer(9,50,40));move.onpointerup(pointer(9,50,40));assert.deepEqual(windowRect(ui),{left:622,top:312});assert.deepEqual(JSON.parse(ui.storage.get(windowKey)),{left:622,top:312});assert.equal(move.hasPointerCapture(9),false);assert.equal(ui.network.length,requests);assert.equal(posts(ui).length,0);
});

test('closing during drag releases capture and makes later pointer events inert',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();await ui.join();last(ui.players).ready();const move=ui.node('watchWindowBar');move.onpointerdown(pointer(1,100,100));move.onpointermove(pointer(1,50,50));assert.equal(move.hasPointerCapture(1),true);assert.deepEqual(windowRect(ui),{left:622,top:322});await ui.click('watchClose');assert.equal(move.hasPointerCapture(1),false);assert.equal(ui.node('tableWatch').open,false);const before=windowRect(ui);
 move.onpointermove(pointer(1,500,500));move.onpointerup(pointer(1,500,500));assert.deepEqual(windowRect(ui),before);assert.equal(ui.storage.has(windowKey),false);assert.equal(ui.timers.size,0);assert.equal(ui.music.active,0);assert.equal(posts(ui).length,0);assert.equal(ui.document.activeElement,ui.node('music-expand'));
});

test('keyboard moves, Home/reset and viewport resize stay bounded; resize alone never writes personal storage',async()=>{
 const ui=watchHarness({savedPosition:JSON.stringify({left:500,top:300})});ui.update(roomState());await ui.open();const move=ui.node('watchWindowBar');assert.deepEqual(windowRect(ui),{left:500,top:300});const requests=ui.network.length;
 move.onkeydown(key('ArrowLeft'));move.onkeydown(key('ArrowUp',true));assert.deepEqual(windowRect(ui),{left:480,top:250});assert.deepEqual(JSON.parse(ui.storage.get(windowKey)),{left:480,top:250});
 const before=ui.storage.get(windowKey);ui.window.innerWidth=800;ui.window.innerHeight=500;ui.window.dispatch('resize');assert.deepEqual(windowRect(ui),{left:192,top:152});assert.equal(ui.storage.get(windowKey),before);
 move.onkeydown(key('ArrowLeft'));assert.deepEqual(windowRect(ui),{left:172,top:152});assert.deepEqual(JSON.parse(ui.storage.get(windowKey)),{left:172,top:152});move.onkeydown(key('Home'));assert.deepEqual(windowRect(ui),{left:192,top:152});move.onkeydown(key('ArrowUp'));await ui.click('watchResetPosition');assert.deepEqual(windowRect(ui),{left:192,top:152});assert.deepEqual(JSON.parse(ui.storage.get(windowKey)),{left:192,top:152});
 move.onkeydown(key('ArrowLeft'));await ui.click('watchClose');await ui.open();assert.deepEqual(windowRect(ui),{left:172,top:152});assert.equal(ui.network.length,requests+1);assert.equal(posts(ui).length,0);
 const reloaded=watchHarness({savedPosition:ui.storage.get(windowKey)});reloaded.update(roomState());await reloaded.open();assert.deepEqual(windowRect(reloaded),{left:172,top:152});assert.equal(posts(reloaded).length,0);
});

test('temporary viewport and mocked panel-size clamps preserve the preferred location for restoration without network or iframe churn',async()=>{
 const saved=JSON.stringify({left:500,top:300}),ui=watchHarness({savedPosition:saved});ui.update(roomState());await ui.open();await ui.join();const player=last(ui.players);player.ready();const frame=iframe(ui)[0],requests=ui.network.length,calls=player.calls.length;
 assert.deepEqual(windowRect(ui),{left:500,top:300});ui.window.innerWidth=800;ui.window.innerHeight=500;ui.window.dispatch('resize');assert.deepEqual(windowRect(ui),{left:192,top:152});assert.equal(ui.storage.get(windowKey),saved);
 ui.window.innerWidth=1280;ui.window.innerHeight=720;ui.window.dispatch('resize');assert.deepEqual(windowRect(ui),{left:500,top:300});assert.equal(ui.storage.get(windowKey),saved);
 const panel=ui.node('tableWatch');panel.rect={...panel.rect,width:1000,height:600};await ui.click('watchControlsToggle');assert.deepEqual(windowRect(ui),{left:272,top:112});assert.equal(ui.node('watchRoomControls').hidden,false);assert.equal(ui.storage.get(windowKey),saved);
 panel.rect={...panel.rect,width:600,height:340};await ui.click('watchControlsToggle');assert.deepEqual(windowRect(ui),{left:500,top:300});assert.equal(ui.node('watchRoomControls').hidden,true);assert.equal(ui.storage.get(windowKey),saved);assert.equal(iframe(ui)[0],frame);assert.equal(player.calls.length,calls);assert.equal(ui.network.length,requests);assert.equal(posts(ui).length,0);
});

test('malformed or unavailable position storage is harmless and finite saved positions are clamped',async t=>{
 const cases={malformed:{savedPosition:'not JSON'},wrongTypes:{savedPosition:JSON.stringify({left:'100',top:20})},unavailable:{storageFailure:true},offscreen:{savedPosition:JSON.stringify({left:-10000,top:99999})}};
 for(const [name,options] of Object.entries(cases))await t.test(name,async()=>{const ui=watchHarness(options);ui.update(roomState());await ui.open();assert.deepEqual(windowRect(ui),name==='offscreen'?{left:8,top:372}:{left:672,top:372});ui.node('watchWindowBar').onkeydown(key('ArrowLeft'));await ui.click('watchResetPosition');assert.deepEqual(windowRect(ui),{left:672,top:372});assert.equal(posts(ui).length,0);});
});

test('two independent clients move, resize, toggle and exit without changing each other or adding room traffic',async()=>{
 const a=watchHarness(),b=watchHarness();for(const ui of [a,b]){ui.update(roomState());await ui.open();await ui.join();last(ui.players).ready();}const otherRect=windowRect(b),otherFrame=iframe(b)[0],otherPlayer=last(b.players),counts=[a.network.length,b.network.length],calls=otherPlayer.calls.length;
 a.node('watchWindowBar').onkeydown(key('ArrowLeft',true));await a.click('watchControlsToggle');a.window.innerWidth=800;a.window.innerHeight=500;a.window.dispatch('resize');assert.notDeepEqual(windowRect(a),otherRect);assert.deepEqual(windowRect(b),otherRect);assert.equal(b.node('watchRoomControls').hidden,true);assert.equal(b.storage.has(windowKey),false);assert.equal(a.storage.has(windowKey),true);
 await a.click('watchClose');assert.equal(b.node('tableWatch').open,true);assert.equal(iframe(b)[0],otherFrame);assert.equal(otherPlayer.destroyed,false);assert.equal(otherPlayer.calls.length,calls);assert.equal(b.music.active,1);assert.deepEqual([a.network.length,b.network.length],counts);assert.equal(posts(a).length,0);assert.equal(posts(b).length,0);
});

test('nonmodal Escape closes locally and a late initial GET cannot steal focus back from the music launcher',async()=>{
 const ui=watchHarness();ui.update(roomState());await ui.open();await ui.join();last(ui.players).ready();ui.document.dispatch('keydown',key('Escape'));assert.equal(ui.node('tableWatch').open,false);assert.equal(ui.document.activeElement,ui.node('music-expand'));assert.equal(ui.music.active,0);assert.equal(ui.timers.size,0);assert.equal(posts(ui).length,0);
 const pending=deferred(),late=watchHarness({fetchHandler:()=>pending.promise});late.update(roomState());const opening=late.node('tableWatchOpen').click();await flush();await late.click('watchClose');assert.equal(late.document.activeElement,late.node('music-expand'));pending.resolve(json(watchSnapshot()));await opening;assert.equal(late.node('tableWatch').open,false);assert.equal(late.document.activeElement,late.node('music-expand'));
});
