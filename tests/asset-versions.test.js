'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  sendStatic,
  readStatic,
  PRIVATE_IMMUTABLE,
  PRIVATE_REVALIDATE,
} = require('../src/http/static-cache');
const { versionedAsset, assetPath } = require('../src/http/asset-version');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { createAuth } = require('../src/auth');

// Images carry their file's content version (?v=) so browsers keep them until
// the bytes change (#316).
const file = path.join(__dirname, '../public/assets/characters/traveler-neutral.png');
function response() {
  const headers = {};
  return {
    headers,
    status: 200,
    setHeader(key, value) {
      headers[key.toLowerCase()] = value;
    },
    writeHead(status) {
      this.status = status;
    },
    end() {},
  };
}

test('a static file is cached for good only when the URL names its current bytes', () => {
  const { version } = readStatic(file);
  const send = (url) => {
    const res = response();
    sendStatic({ url, headers: {} }, res, file);
    return res.headers['cache-control'];
  };
  assert.equal(send('/assets/characters/traveler-neutral.png?v=' + version), PRIVATE_IMMUTABLE);
  assert.equal(send('/assets/characters/traveler-neutral.png?v=stale-version'), PRIVATE_REVALIDATE);
  assert.equal(send('/assets/characters/traveler-neutral.png'), PRIVATE_REVALIDATE);
});

test('versioned asset URLs keep their query and leave other URLs alone', () => {
  const { version } = readStatic(file);
  assert.equal(
    versionedAsset('/assets/characters/traveler-neutral.png'),
    '/assets/characters/traveler-neutral.png?v=' + version,
  );
  assert.equal(
    versionedAsset('/assets/characters/traveler-neutral.png?size=256'),
    '/assets/characters/traveler-neutral.png?size=256&v=' + version,
  );
  const once = versionedAsset('/assets/characters/traveler-neutral.png');
  assert.equal(versionedAsset(once), once, 'versioning twice changes nothing');
  for (const url of ['/assets/missing.png', '/assets/music/abc', '/characters/x', null, 'data:x'])
    assert.equal(versionedAsset(url), url);
  assert.equal(assetPath(once), '/assets/characters/traveler-neutral.png');
});

test('built-in character images the API hands out are versioned and cached for good', async (t) => {
  const f = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('version_owner', 'version-test-password'),
  });
  const login = await fetch(f.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'version_owner', password: 'version-test-password' }),
  });
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  const options = await (await fetch(f.base + '/api/profile/options', { headers })).json();
  const url = options.characters.find((c) => c.id === 'builtin:traveler').expressions.neutral;
  assert.match(url, /^\/assets\/characters\/traveler-neutral\.png\?v=[\w-]{12}$/);
  const current = await fetch(f.base + url, { headers });
  assert.equal(current.status, 200);
  assert.equal(current.headers.get('cache-control'), PRIVATE_IMMUTABLE);
  const thumbnail = await fetch(f.base + url.replace('?', '?size=256&'), { headers });
  assert.equal(thumbnail.status, 200);
  const stale = await fetch(f.base + '/assets/characters/traveler-neutral.png?v=old', { headers });
  assert.equal(stale.headers.get('cache-control'), PRIVATE_REVALIDATE);
  const gifts = await (await fetch(f.base + '/api/community/gifts', { headers })).json();
  const builtin = gifts.gifts.find((gift) => gift.image?.startsWith('/assets/gifts/'));
  assert.match(builtin.image, /\?v=[\w-]{12}$/);
  const image = await fetch(f.base + builtin.image, { headers });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('cache-control'), PRIVATE_IMMUTABLE);
});

test('custom gift images are listed as thumbnails that are cached for good', async (t) => {
  const sharp = require('sharp');
  const f = await appFixture(t, {
    seed: (db) => createAuth(db).bootstrap('gift_owner', 'version-test-password'),
  });
  const login = await fetch(f.base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'gift_owner', password: 'version-test-password' }),
  });
  const headers = {
    Cookie: login.headers.get('set-cookie').split(';')[0],
    'Content-Type': 'application/json',
  };
  const catalog = await (await fetch(f.base + '/api/community/gifts', { headers })).json();
  const png = await sharp({
    create: { width: 600, height: 600, channels: 3, background: '#dd9944' },
  })
    .png()
    .toBuffer();
  const created = await fetch(f.base + '/api/community/gifts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: '縮圖測試禮物',
      category: catalog.categories[0],
      image: { base64: png.toString('base64'), mime: 'image/png' },
    }),
  });
  assert.equal(created.status, 200);
  const { image } = await created.json();
  assert.match(image, /^\/assets\/gifts\/shared\/[a-f0-9-]{36}\?size=256$/);
  // The thumbnail is prepared on first use; until then the original is revalidated.
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    response = await fetch(f.base + image, { headers });
    if (response.headers.get('content-type') === 'image/webp') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('cache-control'), PRIVATE_IMMUTABLE);
  assert.ok((await response.arrayBuffer()).byteLength < png.length);
});
