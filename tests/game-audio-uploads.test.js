'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth'),
  { CATALOG } = require('../src/games/musicquiz-library'),
  { duration } = require('../src/music/game-audio-uploads');
const timedFetch = (url, options = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
function mp3(seconds) {
  const frame = Buffer.alloc(417);
  frame.set([255, 251, 144, 0]);
  return Buffer.concat(Array.from({ length: Math.round((seconds * 44100) / 1152) }, () => frame));
}
test('MP3 duration comes from frames; damaged and fake content is rejected', () => {
  assert.ok(Math.abs(duration(mp3(8)) - 8) < 0.1);
  assert.throws(() => duration(Buffer.from('<script>bad</script>')));
  assert.throws(() => duration(mp3(8).subarray(0, -4)));
});
test(
  'admin uploads are bounded, same-origin, paired and immediately used; music card frames are shared with peers and rewards protected',
  { timeout: 30000 },
  async (t) => {
    const { base, config } = await appFixture(t, {
      config: (paths) => ({
        gameAudioDir: path.join(path.dirname(paths.dbFile), 'game-audio'),
        achievementPurpose: 'test',
        marketAutomationEnabled: false,
      }),
      seed: async (db) => {
        const a = createAuth(db);
        await a.bootstrap('audiomanager', 'synthetic-test-password');
        const u = db.prepare('SELECT * FROM users WHERE username=?').get('audiomanager'),
          invite = a.createInvite(u, { days: 1 });
        await a.register(
          {
            username: 'audiofriend',
            displayName: 'Friend',
            password: 'synthetic-test-password',
            confirmPassword: 'synthetic-test-password',
            invite: invite.code,
          },
          { setHeader() {} },
        );
      },
    });
    const login = async (username) => {
      const r = await timedFetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'synthetic-test-password' }),
      });
      assert.equal(r.status, 200);
      return r.headers.get('set-cookie').split(';')[0];
    };
    const admin = await login('audiomanager'),
      peer = await login('audiofriend');
    const upload = (cookie, bytes, stage = 'intro', extra = {}) =>
      timedFetch(base + '/api/admin/game-audio/upload', {
        method: 'POST',
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          'Content-Type': 'audio/mpeg',
          'X-Song-Id': CATALOG[0].id,
          'X-Audio-Stage': stage,
          ...extra,
        },
        body: bytes,
      });
    assert.equal((await upload(null, mp3(8))).status, 401);
    assert.equal((await upload(peer, mp3(8))).status, 403);
    assert.equal(
      (await upload(admin, mp3(8), 'intro', { Origin: 'https://attacker.invalid' })).status,
      403,
    );
    assert.equal(
      (await timedFetch(base + '/admin/game-audio', { headers: { Cookie: peer } })).status,
      403,
    );
    assert.equal((await upload(admin, mp3(5))).status, 400);
    assert.equal((await upload(admin, mp3(6.5))).status, 400);
    assert.equal((await upload(admin, Buffer.alloc(2 * 1024 * 1024 + 1))).status, 413);
    let r = await upload(admin, mp3(8));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, 'processing');
    r = await upload(admin, mp3(30), 'highlight');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, 'ready');
    const manifest = path.join(path.dirname(config.dbFile), 'game-audio/manifest.json'),
      before = fs.readFileSync(manifest, 'utf8');
    assert.equal((await upload(admin, Buffer.from('fake'))).status, 400);
    assert.equal(fs.readFileSync(manifest, 'utf8'), before);
    const catalog = await (
      await timedFetch(base + '/api/admin/game-audio', { headers: { Cookie: admin } })
    ).json();
    assert.ok(catalog.banks.some((b) => b.id === 'jp'));
    assert.equal(catalog.songs.find((s) => s.id === CATALOG[0].id).status, 'ready');
    const post = async (route, data, cookie = admin) => {
      const r = await timedFetch(base + '/api/' + route, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      assert.equal(r.status, 200, await r.clone().text());
      return r.json();
    };
    const { code } = await post('create', { type: 'musicquiz' });
    let s = await post('join', { code }, peer);
    s = await (
      await timedFetch(base + '/api/state?code=' + code, { headers: { Cookie: admin } })
    ).json();
    await post('action', {
      code,
      action: 'card-frame',
      frameId: 'jelly',
      roundId: s.roundId,
      requestId: randomUUID(),
    });
    let other = await (
      await timedFetch(base + '/api/state?code=' + code, { headers: { Cookie: peer } })
    ).json();
    assert.equal(other.players.find((p) => p.id === s.me).musicCardFrame.id, 'jelly');
    r = await timedFetch(base + '/api/action', {
      method: 'POST',
      headers: { Cookie: admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        action: 'card-frame',
        frameId: 'vinyl',
        roundId: s.roundId,
        requestId: randomUUID(),
      }),
    });
    assert.equal(r.status, 403);
    await post('action', {
      code,
      action: 'configure',
      roundId: s.roundId,
      requestId: randomUUID(),
      banks: ['custom'],
      customSongs: CATALOG.slice(0, 4),
    });
    s = await post('start', { code });
    const djCookie = s.djId === s.me ? admin : peer;
    s = await post(
      'action',
      { code, action: 'listen', roundId: s.roundId, requestId: randomUUID() },
      djCookie,
    );
    // Assets for a different current song must not be exposed simply because one upload exists.
    if (s.playback.provider === 'audio') assert.equal(s.playback.seconds, 8);
  },
);
