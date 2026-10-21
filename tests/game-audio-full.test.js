'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  { Readable } = require('node:stream');
const {
    GameAudioFull,
    suggest,
    formatOf,
    execute,
    MAX_FULL,
  } = require('../src/music/game-audio-full'),
  { GameAudioLibrary } = require('../src/music/game-audio'),
  { CATALOG } = require('../src/games/musicquiz-library'),
  { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth');
function pcm(seconds = 120) {
  const b = Buffer.alloc(seconds * 4000 * 4);
  for (let i = 0; i < seconds * 4000; i++) {
    const sec = i / 4000,
      level = sec < 1 ? 0 : sec >= 50 && sec < 90 ? 0.6 : 0.1;
    b.writeFloatLE(Math.sin((i / 4000) * Math.PI * 400) * level, i * 4);
  }
  return b;
}
function mp3(seconds) {
  const frame = Buffer.alloc(417);
  frame.set([255, 251, 144, 0]);
  return Buffer.concat(Array.from({ length: Math.round((seconds * 44100) / 1152) }, () => frame));
}
const wav = Buffer.from('RIFF0000WAVEfmt ' + ' '.repeat(80));
function fakeRunner() {
  const state = { fail: false, calls: [] };
  state.run = async (args) => {
    state.calls.push(args);
    if (args[0] === '-version') return Buffer.from('ffmpeg');
    if (state.fail) throw Error('decode failed');
    assert.ok(args.includes('-protocol_whitelist'));
    assert.equal(args[args.indexOf('-protocol_whitelist') + 1], 'file,pipe');
    if (args.at(-1) === 'pipe:1') {
      const mono = pcm();
      if (args[args.indexOf('-ac') + 1] !== '2') return mono;
      const stereo = Buffer.alloc(mono.length * 2);
      for (let i = 0; i < mono.length / 4; i++) {
        const x = mono.readFloatLE(i * 4);
        stereo.writeFloatLE(x, i * 8);
        stereo.writeFloatLE(-x, i * 8 + 4);
      }
      return stereo;
    }
    const seconds = Number(args[args.indexOf('-t') + 1]);
    fs.writeFileSync(args.at(-1), mp3(seconds));
    return Buffer.alloc(0);
  };
  return state;
}
function unit(t, runner) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-full-audio-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }));
  const library = new GameAudioLibrary(dir),
    service = new GameAudioFull(library, { run: runner.run });
  return { dir, library, service };
}
function request(bytes = wav) {
  const req = Readable.from([bytes]);
  req.headers = {
    'x-song-id': CATALOG[0].id,
    'content-type': 'audio/wav',
    'content-length': String(bytes.length),
  };
  return req;
}
test('audio analysis skips leading silence and suggests an audible middle window without claiming chorus detection', () => {
  const s = suggest(pcm());
  assert.equal(s.introStart, 0.8);
  assert.ok(s.highlightStart >= 50 && s.highlightStart <= 60);
  assert.equal(s.duration, 120);
  assert.throws(() => suggest(Buffer.alloc(120 * 4000 * 4)), /聲音/);
  assert.throws(() => suggest(pcm(10)), /30秒/);
  assert.equal(formatOf(wav), 'wav');
  assert.throws(() => formatOf(Buffer.from('#EXTM3U\nhttp://localhost/private')));
});
test('full audio remains a private draft until publish; manual recuts retain logical song lookup and explicit review metadata', async (t) => {
  const fake = fakeRunner(),
    { dir, library, service } = unit(t, fake),
    draft = await service.upload(request(), 'owner');
  assert.equal(draft.published, false);
  assert.equal(new GameAudioFull(library, { run: fake.run }).list('owner')[0].id, draft.id);
  assert.deepEqual(service.list('other'), []);
  assert.equal(Object.keys(library.read()).length, 0);
  assert.equal(fs.existsSync(path.join(dir, 'drafts', draft.id, 'source.audio')), true);
  assert.throws(() => service.load(draft.id, 'other'), /自己/);
  assert.throws(() => service.load('../secret', 'owner'));
  const adjusted = await service.reclip(
    { draftId: draft.id, introStart: 2.5, highlightStart: 75 },
    'owner',
  );
  assert.equal(adjusted.highlightStart, 75);
  assert.notEqual(adjusted.preview.intro, draft.preview.intro);
  assert.equal(Object.keys(library.read()).length, 0);
  await assert.rejects(
    () => service.reclip({ draftId: draft.id, introStart: 2, highlightStart: 119 }, 'owner'),
    /起點/,
  );
  assert.equal(service.load(draft.id, 'owner').highlightStart, 75);
  service.publish({ draftId: draft.id, reviewed: true }, 'owner');
  const row = library.read()[CATALOG[0].id];
  assert.equal(row.clips.intro.sourceStart, 2.5);
  assert.equal(row.clips.intro.seconds, 8);
  assert.equal(row.clips.highlight.sourceStart, 75);
  assert.equal(row.clips.highlight.start, CATALOG[0].highlightStart);
  assert.equal(row.clipReviewed, true);
  assert.ok(library.clip(CATALOG[0].videoId, 'highlight', CATALOG[0].highlightStart));
  assert.equal(row.fullSourceId, draft.id);
  assert.equal(
    new GameAudioFull(library, { run: fake.run }).load(draft.id, 'owner').publishedAt.length > 0,
    true,
  );
  assert.throws(() => service.discard({ draftId: draft.id }, 'owner'), /保留/);
});
test('bad sources, oversized uploads and failed conversion do not replace existing clips; drafts can be removed', async (t) => {
  const fake = fakeRunner(),
    { dir, library, service } = unit(t, fake),
    draft = await service.upload(request(), 'owner');
  service.publish({ draftId: draft.id }, 'owner');
  const before = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8');
  fake.fail = true;
  await assert.rejects(() => service.upload(request(), 'owner'));
  assert.equal(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'), before);
  fake.fail = false;
  await assert.rejects(() => service.upload(request(Buffer.from('#EXTM3U')), 'owner'), /有效/);
  const oversized = request();
  oversized.headers['content-length'] = String(MAX_FULL + 1);
  await assert.rejects(() => service.upload(oversized, 'owner'), /100MB/);
  const second = await service.upload(request(), 'owner');
  service.discard({ draftId: second.id }, 'owner');
  assert.equal(fs.existsSync(path.join(dir, 'drafts', second.id)), false);
  assert.equal(library.read()[CATALOG[0].id].status, 'ready');
});
test('converter serializes work and releases its slot after errors; missing FFmpeg does not consume a source', async (t) => {
  const fake = fakeRunner(),
    { service } = unit(t, fake);
  let release, entered;
  const gate = new Promise((r) => (release = r)),
    started = new Promise((r) => (entered = r)),
    real = fake.run;
  service.run = async (...args) => {
    if (args[0].at(-1) === 'pipe:1') {
      entered();
      await gate;
    }
    return real(...args);
  };
  const pending = service.upload(request(), 'owner');
  await started;
  await assert.rejects(
    () => service.upload(request(), 'owner'),
    (e) => e.status === 429,
  );
  release();
  await pending;
  assert.equal(service.busy, false);
  const unavailable = new GameAudioFull(service.library, {
    run: async () => {
      throw Error('missing');
    },
  });
  const req = request();
  await assert.rejects(
    () => unavailable.upload(req, 'owner'),
    (e) => e.status === 503,
  );
  assert.equal(req.readableDidRead, false);
});
test('external converter is cancelled and its timeout is bounded', async () => {
  const controller = new AbortController();
  const task = execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(
    () => task,
    (e) => e.code === 'CONVERSION_CANCELLED',
  );
  await assert.rejects(
    () => execute(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout: 40 }),
    (e) => e.code === 'CONVERSION_TIMEOUT',
  );
});
test('full-audio HTTP routes enforce role and origin before conversion and support private ranged previews', async (t) => {
  const fake = fakeRunner(),
    { base, config } = await appFixture(t, {
      config: (p) => ({
        gameAudioDir: path.join(path.dirname(p.dbFile), 'audio'),
        gameAudioProcessor: fake.run,
        achievementPurpose: 'test',
        marketAutomationEnabled: false,
      }),
      seed: async (db) => {
        const a = createAuth(db);
        await a.bootstrap('fullowner', 'synthetic-full-audio');
        const u = db.prepare('SELECT * FROM users WHERE username=?').get('fullowner'),
          invite = a.createInvite(u, { days: 1 });
        await a.register(
          {
            username: 'fullpeer',
            displayName: 'Peer',
            password: 'synthetic-full-audio',
            confirmPassword: 'synthetic-full-audio',
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
      body: JSON.stringify({ username, password: 'synthetic-full-audio' }),
    });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  };
  const admin = await login('fullowner'),
    peer = await login('fullpeer');
  const upload = (cookie, extra = {}) =>
    fetch(base + '/api/admin/game-audio/full', {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'Content-Type': 'audio/wav',
        'X-Song-Id': CATALOG[0].id,
        ...extra,
      },
      body: wav,
    });
  assert.equal((await upload(null)).status, 401);
  assert.equal((await upload(peer)).status, 403);
  assert.equal((await upload(admin, { Origin: 'https://other.invalid' })).status, 403);
  assert.equal(fake.calls.length, 0);
  let r = await upload(admin);
  assert.equal(r.status, 200, await r.clone().text());
  const draft = await r.json();
  assert.equal(draft.published, false);
  assert.equal(fs.existsSync(path.join(config.gameAudioDir, 'manifest.json')), false);
  let res = await fetch(base + draft.preview.intro, {
    headers: { Cookie: admin, Range: 'bytes=0-9' },
  });
  assert.equal(res.status, 206);
  assert.equal((await res.arrayBuffer()).byteLength, 10);
  assert.equal(
    (await fetch(base + draft.preview.intro, { headers: { Cookie: peer } })).status,
    403,
  );
  assert.equal((await fetch(base + draft.preview.intro)).status, 401);
  res = await fetch(base + draft.preview.intro, { method: 'HEAD', headers: { Cookie: admin } });
  assert.equal(res.status, 200);
  assert.equal((await res.arrayBuffer()).byteLength, 0);
  res = await fetch(base + draft.preview.intro, {
    headers: { Cookie: admin, Range: 'bytes=0-1,3-4' },
  });
  assert.equal(res.status, 416);
  const post = async (route, data) => {
    const r = await fetch(base + '/api/admin/game-audio/' + route, {
      method: 'POST',
      headers: { Cookie: admin, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  };
  const changed = await post('reclip', { draftId: draft.id, introStart: 1.2, highlightStart: 70 });
  assert.equal(changed.highlightStart, 70);
  await post('publish', { draftId: draft.id, reviewed: true });
  const list = await (
    await fetch(base + '/api/admin/game-audio', { headers: { Cookie: admin } })
  ).json();
  assert.equal(list.fullAudio.available, true);
  assert.equal(list.songs.find((s) => s.id === CATALOG[0].id).fullSourceId, draft.id);
  assert.equal(list.songs.find((s) => s.id === CATALOG[0].id).status, 'ready');
});

test('publishing rolls back both clips and manifest if final draft persistence fails', async (t) => {
  const fake = fakeRunner(),
    { dir, service } = unit(t, fake),
    draft = await service.upload(request(), 'owner');
  service.publish({ draftId: draft.id }, 'owner');
  const manifest = path.join(dir, 'manifest.json'),
    clip = path.join(dir, 'clips', CATALOG[0].id + '.intro.mp3'),
    beforeManifest = fs.readFileSync(manifest),
    beforeClip = fs.readFileSync(clip);
  await service.reclip({ draftId: draft.id, introStart: 3, highlightStart: 70 }, 'owner');
  service.save = () => {
    throw Error('simulated persistence failure');
  };
  assert.throws(() => service.publish({ draftId: draft.id }, 'owner'), /persistence/);
  assert.deepEqual(fs.readFileSync(manifest), beforeManifest);
  assert.deepEqual(fs.readFileSync(clip), beforeClip);
});
