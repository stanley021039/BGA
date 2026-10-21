'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { GameAudioLibrary } = require('../src/music/game-audio'),
  { CATALOG } = require('../src/games/musicquiz-library'),
  { MusicQuizRoom } = require('../src/games/musicquiz');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');
function assets(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-game-audio-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'clips'));
  const songs = {};
  for (const s of CATALOG.slice(0, 3)) {
    const clips = {};
    for (const stage of ['intro', 'highlight']) {
      const file = 'clips/' + s.videoId + '.' + stage + '.mp3';
      fs.writeFileSync(
        path.join(dir, file),
        Buffer.alloc(stage === 'intro' ? 128000 : 480000, 123),
      );
      clips[stage] = {
        file,
        start: stage === 'intro' ? s.introStart : s.highlightStart,
        seconds: stage === 'intro' ? 8 : 30,
        reviewed: false,
      };
    }
    songs[s.id] = { videoId: s.videoId, status: 'ready', clips };
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ songs }));
  return { dir, songs };
}
function room() {
  const r = new MusicQuizRoom(
      'ABCDEF',
      'audio',
      () => 0,
      () => Date.now(),
    ),
    p = r.add('Owner');
  r.configure(p.id, { banks: ['custom'], customSongs: CATALOG.slice(0, 3).map((s) => ({ ...s })) });
  r.start();
  r.act(p.id, 'listen', { roundId: r.roundId, requestId: randomUUID() });
  return { r, p };
}

test('audio projection keeps current round hidden-title contract and refuses stale custom cuts or unsafe manifest paths', (t) => {
  const { dir, songs } = assets(t),
    lib = new GameAudioLibrary(dir),
    { r, p } = room(),
    raw = r.view(p.id),
    view = lib.decorate(r, raw);
  assert.equal(view.playback.provider, 'audio');
  assert.equal(Object.hasOwn(view.playback, 'videoId'), false);
  assert.equal(view.playback.start, 0);
  assert.equal(view.playback.seconds, 8);
  assert.equal(raw.playback.seconds, 8);
  assert.equal(view.playback.clipReviewed, false);
  assert.equal(view.song, null);
  assert.ok(view.playback.url.startsWith('/api/game-song-audio?code=ABCDEF&roundId='));
  assert.equal(raw.playback.provider, 'youtube');
  assert.equal(lib.clip(r.current.videoId, 'intro', r.current.introStart + 1), null);
  const row =
    songs[r.current.id] || Object.values(songs).find((s) => s.videoId === r.current.videoId);
  row.clips.intro.file = '../outside.mp3';
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ songs }));
  lib.cacheStamp = null;
  assert.equal(lib.decorate(r, raw).playback.provider, 'youtube');
  fs.writeFileSync(path.join(dir, 'manifest.json'), 'bad json');
  lib.cacheStamp = null;
  assert.equal(lib.decorate(r, raw).playback.provider, 'youtube');
});

test('music two-choice exposes only current pair audio; scenario, past questions and mismatched stages never grant files', (t) => {
  const { dir } = assets(t),
    lib = new GameAudioLibrary(dir),
    song = CATALOG[0],
    r = {
      type: 'majority',
      code: 'ABCDEF',
      phase: 'answering',
      options: { mode: 'music' },
      question: {
        id: 'question-one',
        entries: [
          { id: song.id, label: song.title },
          { id: CATALOG[1].id, label: 'Other' },
        ],
      },
    };
  const v = lib.decorate(r, { question: r.question });
  assert.ok(v.question.entries[0].audioUrl);
  assert.equal(lib.context(r, {}, 2), null);
  assert.equal(lib.context(r, {}, 0).roundId, 'question-one');
  r.phase = 'finished';
  assert.equal(lib.context(r, {}, 0), null);
  r.phase = 'answering';
  r.options.mode = 'scenario';
  assert.equal(lib.context(r, {}, 0), null);
});

test('authenticated room audio supports HEAD and byte ranges; outsiders, old rounds, wrong stages and arbitrary files are rejected', async (t) => {
  const { dir } = assets(t);
  let invite;
  const { base } = await appFixture(t, {
    config: { gameAudioDir: dir, achievementPurpose: 'test', marketAutomationEnabled: false },
    seed: async (db) => {
      const a = createAuth(db);
      await a.bootstrap('audioowner', 'synthetic-audio-password');
      const u = db.prepare("SELECT * FROM users WHERE username='audioowner'").get();
      invite = a.createInvite(u, { days: 1 });
      await a.register(
        {
          username: 'audiopeer',
          displayName: 'peer',
          password: 'synthetic-audio-password',
          confirmPassword: 'synthetic-audio-password',
          invite: invite.code,
        },
        { setHeader() {} },
      );
    },
  });
  const login = async (username) => {
    const r = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'synthetic-audio-password' }),
    });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  };
  const owner = await login('audioowner'),
    peer = await login('audiopeer');
  const post = async (route, data) => {
    const r = await fetch(base + '/api/' + route, {
      method: 'POST',
      headers: { Cookie: owner, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(r.status, 200, route + ' ' + (await r.clone().text()));
    return r.json();
  };
  const { code } = await post('create', { type: 'musicquiz' });
  // Settings use their own route, preserving the production action grammar.
  const before = await (
    await fetch(base + '/api/state?code=' + code, { headers: { Cookie: owner } })
  ).json();
  await post('action', {
    code,
    roundId: before.roundId,
    action: 'configure',
    requestId: randomUUID(),
    banks: ['custom'],
    customSongs: CATALOG.slice(0, 3),
  });
  let s = await post('start', { code });
  s = await post('action', { code, action: 'listen', roundId: s.roundId, requestId: randomUUID() });
  const url = base + s.playback.url;
  assert.equal(s.playback.provider, 'audio');
  const get = (headers = {}, method = 'GET', u = url) =>
    fetch(u, { method, headers: { Cookie: owner, ...headers } });
  let res = await get({ Range: 'bytes=0-9' });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 0-9/128000');
  assert.equal((await res.arrayBuffer()).byteLength, 10);
  res = await get({ Range: 'bytes=-10' });
  assert.equal(res.status, 206);
  assert.equal((await res.arrayBuffer()).byteLength, 10);
  res = await get({}, 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/mpeg');
  assert.equal(res.headers.get('content-length'), '128000');
  assert.equal((await res.arrayBuffer()).byteLength, 0);
  for (const range of ['bytes=9999999-', 'bytes=3-1', 'bytes=0-1,4-5', 'bytes=-0', 'bad']) {
    res = await get({ Range: range });
    assert.equal(res.status, 416);
    await res.arrayBuffer();
  }
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Cookie: peer } })).status, 403);
  assert.equal((await get({}, 'GET', url.replace(s.roundId, 'stale-round'))).status, 404);
  assert.equal((await get({}, 'GET', url.replace('stage=intro', 'stage=bad'))).status, 404);
  assert.equal((await get({ 'Content-Type': 'application/json' }, 'POST')).status, 405);
  const old = url;
  s = await post('action', {
    code,
    action: 'guess',
    roundId: s.roundId,
    pass: true,
    requestId: randomUUID(),
  });
  assert.equal(s.phase, 'timeline');
  assert.equal(s.playback.provider, 'audio');
  assert.equal((await get({}, 'GET', old)).status, 404);
  assert.equal((await get({}, 'GET', base + s.playback.url)).status, 200);
});

test('four movements sharing one source resolve their own offsets rather than the first matching video', (t) => {
  const { dir, songs } = assets(t),
    lib = new GameAudioLibrary(dir),
    video = 'aryDMAP6oug';
  for (const offset of [0, 609, 1242, 1916]) {
    const id = video + (offset ? '-' + offset : ''),
      file = 'clips/' + id + '.intro.mp3';
    fs.writeFileSync(path.join(dir, file), Buffer.alloc(128000, offset % 255));
    songs[id] = {
      id,
      videoId: video,
      status: 'ready',
      clips: { intro: { file, start: offset, seconds: 8 } },
    };
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ songs }));
  for (const offset of [0, 609, 1242, 1916])
    assert.ok(
      lib
        .clip(video, 'intro', offset)
        ?.file.endsWith(video + (offset ? '-' + offset : '') + '.intro.mp3'),
    );
  assert.equal(lib.clip(video, 'intro', 608), null);
});

test('too-short MP3 output is unavailable rather than falsely advertised as a full 30-second clip', (t) => {
  const { dir } = assets(t),
    lib = new GameAudioLibrary(dir),
    song = CATALOG[0];
  assert.ok(lib.clip(song.videoId, 'highlight', song.highlightStart));
  fs.writeFileSync(path.join(dir, 'clips', song.videoId + '.highlight.mp3'), Buffer.alloc(64000));
  assert.equal(lib.clip(song.videoId, 'highlight', song.highlightStart), null);
  assert.ok(lib.clip(song.videoId, 'intro', song.introStart));
});
