'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { mediaHarness, mediaSnapshot } = require('./helpers/media-browser.cjs');
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
  yt.ready();
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
