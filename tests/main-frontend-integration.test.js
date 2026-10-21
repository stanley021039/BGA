'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth'),
  { settings } = require('../src/config');
test('Vue documents survive native-audio integration, keep authenticated routes and admin-only audio management', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-vue-document-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const page of require('../frontend/pages.json')) {
    const dir = path.join(root, 'pages', page.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      '<!doctype html><main>compiled-vue-' + page.id + '</main>',
    );
  }
  fs.mkdirSync(path.join(root, 'frontend-assets'));
  fs.writeFileSync(path.join(root, 'frontend-assets', 'probe.js'), 'window.vueProbe=true;');
  const { base } = await appFixture(t, {
    config: { frontendEnabled: true, frontendRoot: root },
    seed: async (db) => {
      const auth = createAuth(db);
      await auth.bootstrap('vueowner', 'synthetic-vue-password');
      const user = db.prepare("SELECT * FROM users WHERE username='vueowner'").get(),
        invite = auth.createInvite(user, { days: 1 });
      await auth.register(
        {
          username: 'vuepeer',
          displayName: 'peer',
          password: 'synthetic-vue-password',
          confirmPassword: 'synthetic-vue-password',
          invite: invite.code,
        },
        { setHeader() {} },
      );
    },
  });
  const anonymous = await fetch(base + '/musicquiz/ABCDEF', { redirect: 'manual' });
  assert.equal(anonymous.status, 302);
  assert.match(anonymous.headers.get('location'), /^\/login\?next=/);
  assert.match(await (await fetch(base + '/login')).text(), /compiled-vue-login/);
  const login = async (username) => {
    const r = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'synthetic-vue-password' }),
    });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  };
  const admin = await login('vueowner'),
    peer = await login('vuepeer');
  for (const route of [
    '/musicquiz/ABCDEF',
    '/majority/ABCDEF',
    '/quacks/ABCDEF',
    '/profile',
    '/achievements',
  ]) {
    const r = await fetch(base + route, { headers: { Cookie: admin } });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /compiled-vue-/);
  }
  assert.equal(
    (await fetch(base + '/admin/game-audio', { headers: { Cookie: peer } })).status,
    403,
  );
  assert.equal(
    (await fetch(base + '/admin/game-audio', { headers: { Cookie: admin } })).status,
    200,
  );
  assert.equal((await fetch(base + '/frontend-assets/probe.js')).status, 200);
  assert.equal((await fetch(base + '/frontend-assets/missing.js')).status, 404);
});
test('Vue selection and native audio settings coexist after config merge', () => {
  const config = settings({
    FRONTEND_ENABLED: 'true',
    GAME_AUDIO_DIR: 'local-audio/six-half-second',
    FFMPEG_PATH: 'example-ffmpeg',
  });
  assert.equal(config.frontendEnabled, true);
  assert.equal(config.ffmpegPath, 'example-ffmpeg');
  assert.match(config.gameAudioDir, /six-half-second$/);
  assert.throws(() => settings({ FRONTEND_ENABLED: 'yes' }), /FRONTEND_ENABLED/);
});
