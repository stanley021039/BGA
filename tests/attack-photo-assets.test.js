'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs'),
  { createAuth } = require('../src/auth'),
  { versionedAsset } = require('../src/http/asset-version');
test('attack portraits are authenticated WebP bytes with versioned immutable and stale revalidation routes', async (t) => {
  const { base } = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('photo_check', 'test-photos-2026'),
  });
  const urls = [
    'shaohua-closed.webp',
    'shaohua-open.webp',
    'reaper-person-768.webp',
    'reaper-person-128.webp',
    'reaper-person-256.webp',
    'reaper-person-512.webp',
  ].map((name) => '/assets/attacks/' + name);
  assert.equal((await fetch(base + urls[0])).status, 401);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'photo_check', password: 'test-photos-2026' }),
  });
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  for (const url of urls) {
    const current = versionedAsset(url);
    assert.match(current, /\?v=[A-Za-z0-9_-]+$/);
    const response = await fetch(base + current, { headers });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/webp/);
    assert.match(response.headers.get('cache-control'), /immutable/);
    assert.ok(
      Buffer.from(await response.arrayBuffer()).equals(
        fs.readFileSync(path.join(__dirname, '../public', url)),
      ),
    );
    for (const request of [url, url + '?v=stale']) {
      const r = await fetch(base + request, { headers });
      assert.equal(r.status, 200);
      assert.match(r.headers.get('cache-control'), /private, no-cache/);
    }
  }
  assert.equal((await fetch(base + '/assets/attacks/unknown.webp', { headers })).status, 404);
});
