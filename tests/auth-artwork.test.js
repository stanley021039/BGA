const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('./helpers/browser-modules.cjs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require('sharp');
const { createApp } = require('../src/app');

function page(search = '') {
  const image = { dataset: {} },
    artwork = { querySelector: () => image };
  const forms = Object.fromEntries(
    ['login', 'register', 'reset'].map((name) => [
      name,
      { elements: { invite: {} }, querySelector: () => ({}) },
    ]),
  );
  const nodes = {
    '#authArtwork': artwork,
    '.auth-tabs': {},
    '#authTitle': {},
    '#authIntro': {},
    '#message': {},
  };
  for (const [name, form] of Object.entries(forms)) nodes['#' + name + 'Form'] = form;
  const tabs = ['login', 'register'].map((mode) => ({
    dataset: { mode },
    setAttribute(key, value) {
      this[key] = value;
    },
  }));
  const context = {
    document: { querySelector: (selector) => nodes[selector], querySelectorAll: () => tabs },
    location: { search },
    URLSearchParams,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/login.js'), 'utf8'), context);
  return { image, artwork, forms, nodes, tabs };
}

test('public auth artwork endpoints serve only the approved reduced WebP variants', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-auth-art-'));
  const app = createApp({
    port: 0,
    host: '127.0.0.1',
    communityDir: path.join(root, 'community'),
    dbFile: path.join(root, 'app.sqlite'),
    externalSideEffectsEnabled: false,
    marketAutomationEnabled: false,
    achievementPurpose: 'test',
  });
  try {
    const { port } = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    for (const [mode, widths] of [
      ['login', [320, 480, 576, 864]],
      ['register', [320, 480, 576]],
    ]) {
      for (const width of widths) {
        const response = await fetch(`${base}/assets/auth/${mode}-${width}.webp`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'image/webp');
        const bytes = Buffer.from(await response.arrayBuffer()),
          meta = await sharp(bytes).metadata();
        assert.equal(meta.width, width);
        assert.equal(meta.height, (width * 9) / 16);
        assert.ok(bytes.length < 30000);
      }
    }
    for (const name of ['stanley021039', 'x55662306', 'azrael04']) {
      for (const width of [64, 88, 176]) {
        const response = await fetch(`${base}/assets/auth/${name}-${width}.webp`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'image/webp');
        const bytes = Buffer.from(await response.arrayBuffer()),
          meta = await sharp(bytes).metadata();
        assert.equal(meta.width, width);
        assert.equal(meta.height, width);
        assert.ok(bytes.length < 10000);
      }
    }
    for (const name of [
      'login-1280.webp',
      'register-640.webp',
      'login.jpg',
      'register.jpg',
      '../auth/source.jpg',
    ])
      assert.equal((await fetch(`${base}/assets/auth/${name}`)).status, 404);
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
