'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
const { mediaHarness, mediaSnapshot } = require('./helpers/media-browser.cjs');

test('moving an accepted video rebinds the provider in its destination window at the shared time', async () => {
  const h = mediaHarness({ enabled: true }),
    pip = mediaHarness({ enabled: true });
  h.document.defaultView = h.window;
  pip.document.defaultView = pip.window;
  const audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div');
  videoHost.ownerDocument = h.document;
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  const p = h.window.RoomMediaPlayer.create({
    audioHost,
    videoHost,
    onStatus() {},
    onChange() {},
    onReport() {},
  });
  const snapshot = mediaSnapshot({
    playback: { state: 'playing', anchorPositionSec: 12, anchorServerMs: 100000, rate: 1 },
  });
  p.update(snapshot, snapshot, 100000);
  p.setWindow(true, false, true);
  p.joinVideo();
  await h.flush();
  h.players[0].ready();
  videoHost.ownerDocument = pip.document;
  p.relocate();
  await h.flush();
  assert.equal(h.players[0].destroyed, true);
  assert.equal(pip.players.length, 1);
  pip.players[0].ready();
  assert(pip.players[0].calls.some((c) => c[0] === 'seek' && c[1] >= 12));
  h.hide(true);
  assert.equal(pip.players[0].destroyed, false);
  videoHost.ownerDocument = h.document;
  p.relocate();
  await h.flush();
  assert.equal(pip.players[0].destroyed, true);
  assert.equal(
    h.players.length,
    1,
    'hidden opener waits instead of retaining a stale cross-window provider',
  );
  h.hide(false);
  await h.flush();
  assert.equal(h.players.length, 2);
  p.dispose();
});

test('a moved video blocked from sound autoplay keeps playing muted until a gesture in its window', async () => {
  const h = mediaHarness({ enabled: true }),
    pip = mediaHarness({ enabled: true }),
    statuses = [];
  h.document.defaultView = h.window;
  pip.document.defaultView = pip.window;
  const audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div');
  videoHost.ownerDocument = h.document;
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  const p = h.window.RoomMediaPlayer.create({
    audioHost,
    videoHost,
    onStatus(message) {
      statuses.push(message);
    },
    onChange() {},
    onReport() {},
  });
  const snapshot = mediaSnapshot({
    playback: { state: 'playing', anchorPositionSec: 12, anchorServerMs: 100000, rate: 1 },
  });
  p.update(snapshot, snapshot, 100000);
  p.setWindow(true, false, true);
  p.joinVideo();
  await h.flush();
  h.players[0].ready();
  h.players[0].blocked();
  assert.equal(
    h.players[0].calls.filter((c) => c[0] === 'mute').length,
    0,
    'the page player keeps its accepted prompt-only behavior',
  );
  videoHost.ownerDocument = pip.document;
  p.relocate();
  await h.flush();
  const moved = pip.players[0];
  moved.ready();
  moved.calls.length = 0;
  moved.blocked();
  assert.deepEqual(
    moved.calls.map((c) => c[0]),
    ['mute', 'seek', 'play'],
  );
  assert.match(statuses.at(-1), /靜音/);
  h.window.AudioSettings?.set?.({ music: { enabled: true, volume: 0.5 } });
  moved.state(1);
  assert.match(statuses.at(-1), /靜音/, 'starting muted playback keeps the restore-sound prompt');
  assert.equal(
    moved.calls.filter((c) => c[0] === 'unmute').length,
    0,
    'stay muted without a gesture',
  );
  h.document.dispatch('pointerdown');
  assert.equal(
    moved.calls.filter((c) => c[0] === 'unmute').length,
    0,
    'only the PiP window gesture counts',
  );
  pip.document.dispatch('pointerdown');
  assert.equal(moved.calls.filter((c) => c[0] === 'unmute').length, 1);
  assert.equal(moved.calls.at(-1)[0], 'play');
  pip.document.dispatch('keydown');
  assert.equal(
    moved.calls.filter((c) => c[0] === 'unmute').length,
    1,
    'the gesture listener is one-shot',
  );
  p.dispose();
});
test('moving music keeps the same audio element and observes the PiP document visibility', async () => {
  const h = mediaHarness({ enabled: true }),
    pip = mediaHarness({ enabled: true });
  h.document.defaultView = h.window;
  pip.document.defaultView = pip.window;
  const audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div');
  videoHost.ownerDocument = h.document;
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  const p = h.window.RoomMediaPlayer.create({
    audioHost,
    videoHost,
    onStatus() {},
    onChange() {},
    onReport() {},
  });
  const snapshot = mediaSnapshot({
    current: { id: 'song', type: 'music', trackId: 'song-a', title: 'Song', durationSec: 100 },
    playback: { state: 'playing', anchorPositionSec: 12, anchorServerMs: 100000, rate: 1 },
  });
  p.update(snapshot, snapshot, 100000);
  p.setWindow(true);
  p.resume();
  await h.flush();
  const audio = audioHost.children[0];
  assert.equal(audio.paused, false);
  videoHost.ownerDocument = pip.document;
  p.relocate();
  await h.flush();
  h.hide(true);
  assert.equal(audioHost.children[0], audio);
  assert.equal(audio.paused, false, 'hidden opener must not pause visible PiP music');
  pip.hide(true);
  assert.equal(audio.paused, true);
  p.dispose();
});
test('Vue YouTube player survives tab visibility changes and still stops on explicit close', async () => {
  const h = mediaHarness({ enabled: true }),
    audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div'),
    views = [];
  h.context.innerWidth = 1280;
  h.context.innerHeight = 720;
  h.context.getComputedStyle = () => ({
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  h.document.body.append(audioHost, videoHost);
  const p = h.window.RoomMediaPlayer.create({
      audioHost,
      videoHost,
      onStatus() {},
      onChange: (v) => views.push(v),
      onReport() {},
    }),
    snapshot = mediaSnapshot({
      playback: { state: 'playing', anchorPositionSec: 12, anchorServerMs: 100000, rate: 1 },
    });
  p.update(snapshot, snapshot, 100000);
  p.setWindow(true);
  p.joinVideo();
  await h.flush();
  assert.equal(h.players.length, 1);
  const yt = h.players[0];
  yt.getVideoData = () => ({ video_id: snapshot.current.videoId, title: '實際影片名稱' });
  yt.ready();
  assert.equal(views.at(-1).videoTitle, '實際影片名稱');
  assert.equal(views.at(-1).videoTitleId, snapshot.current.videoId);
  yt.getVideoData = () => ({ video_id: 'other-video', title: '前一部影片' });
  yt.state(3);
  assert.equal(
    views.at(-1).videoTitle,
    '',
    'stale provider metadata must not rename another video',
  );
  yt.getVideoData = () => {
    throw Error('metadata unavailable');
  };
  yt.state(3);
  assert.equal(views.at(-1).videoWanted, true, 'metadata failure does not interrupt playback');
  h.hide(true);
  yt.state(3);
  assert.equal(yt.destroyed, false);
  assert.equal(views.at(-1).videoWanted, true);
  h.hide(false);
  await h.flush();
  assert.equal(h.players.length, 1);
  assert.equal(yt.destroyed, false);
  p.setWindow(false);
  assert.equal(yt.destroyed, true);
  p.dispose();
});

test('privacy embed failures retry the standard YouTube host once and preserve the video ID', async () => {
  const h = mediaHarness({ enabled: true }),
    audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div'),
    messages = [];
  h.context.innerWidth = 1280;
  h.context.innerHeight = 720;
  h.context.getComputedStyle = () => ({ overflow: 'visible' });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  h.document.body.append(audioHost, videoHost);
  const p = h.window.RoomMediaPlayer.create({
      audioHost,
      videoHost,
      onStatus: (s) => messages.push(s),
      onChange() {},
      onReport() {},
    }),
    s = mediaSnapshot();
  s.current.videoId = 'p13tH7Etlzc';
  p.update(s, s, 100000);
  p.setWindow(true);
  p.joinVideo();
  await h.flush();
  assert.match(h.players[0].iframe.src, /youtube-nocookie.com\/embed\/p13tH7Etlzc/);
  h.players[0].error(150);
  await h.flush();
  assert.equal(h.players.length, 2);
  assert.equal(h.players[0].destroyed, true);
  assert.match(h.players[1].iframe.src, /www.youtube.com\/embed\/p13tH7Etlzc/);
  h.players[1].error(150);
  await h.flush();
  assert.equal(h.players.length, 2);
  assert.match(messages.at(-1), /YouTube錯誤 150/);
  p.dispose();
});

test('opted-in window hiding, request pane and visibility observers retain the same playing provider', async () => {
  const h = mediaHarness({ enabled: true });
  h.context.innerWidth = 1280;
  h.context.innerHeight = 720;
  h.context.getComputedStyle = () => ({ overflow: 'visible' });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  const audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div');
  h.document.body.append(audioHost, videoHost);
  const views = [],
    reports = [];
  const p = h.window.RoomMediaPlayer.create({
    audioHost,
    videoHost,
    onStatus() {},
    onChange: (v) => views.push(v),
    onReport: (...v) => reports.push(v),
  });
  const s = mediaSnapshot({
    playback: { state: 'playing', anchorPositionSec: 12, anchorServerMs: 100000, rate: 1 },
  });
  p.setWindow(true, false, true);
  p.update(s, s, 100000);
  p.joinVideo();
  await h.flush();
  const yt = h.players[0],
    iframe = yt.iframe;
  yt.ready();
  const seeks = yt.calls.filter((c) => c[0] === 'seek').length;
  for (const [open, concealed] of [
    [true, true],
    [false, true],
    [true, false],
    [true, true],
    [true, false],
  ]) {
    p.setWindow(open, concealed, true);
    for (const observer of h.observers.filter((o) => o.target === iframe))
      observer.emit([{ intersectionRatio: 0 }]);
    await h.flush();
    assert.equal(yt.destroyed, false);
    assert.equal(h.players.length, 1);
    assert.equal(videoHost.querySelector('iframe'), iframe);
    assert.equal(views.at(-1).videoWanted, true);
  }
  assert.equal(
    yt.calls.filter((c) => c[0] === 'seek').length,
    seeks,
    'reopening does not reset playback time',
  );
  assert.equal(reports.length, 0, 'personal presentation must not control table playback');
  p.exitVideo();
  assert.equal(yt.destroyed, true, 'explicit personal exit still stops the provider');
  p.dispose();
});

test('hidden playback follows table pause and next item, then disconnect retires it', async () => {
  const h = mediaHarness({ enabled: true });
  h.context.innerWidth = 1280;
  h.context.innerHeight = 720;
  h.context.getComputedStyle = () => ({ overflow: 'visible' });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/shared/media-player.js'), 'utf8'),
    h.context,
  );
  const audioHost = h.document.createElement('div'),
    videoHost = h.document.createElement('div');
  h.document.body.append(audioHost, videoHost);
  const p = h.window.RoomMediaPlayer.create({
    audioHost,
    videoHost,
    onStatus() {},
    onChange() {},
    onReport() {},
  });
  const s = mediaSnapshot({
    playback: { state: 'playing', anchorPositionSec: 12, anchorServerMs: 100000, rate: 1 },
  });
  p.setWindow(true, false, true);
  p.update(s, s, 100000);
  p.joinVideo();
  await h.flush();
  const first = h.players[0];
  first.ready();
  p.setWindow(false, true, true);
  const paused = { ...s, revision: s.revision + 1, playback: { ...s.playback, state: 'paused' } };
  p.update(paused, paused, 100000);
  assert.equal(first.destroyed, false);
  assert.ok(first.calls.some((c) => c[0] === 'pause'));
  const next = {
    ...paused,
    revision: paused.revision + 1,
    playbackSessionId: 'next-session',
    current: { ...s.current, id: 'next', videoId: 'p13tH7Etlzc' },
  };
  p.update(next, next, 100000);
  await h.flush();
  assert.equal(first.destroyed, true);
  assert.equal(h.players.length, 2, 'next table item still loads while the window is hidden');
  p.disconnect();
  assert.equal(h.players[1].destroyed, true);
  assert.equal(videoHost.querySelector('iframe'), null);
  p.dispose();
});
