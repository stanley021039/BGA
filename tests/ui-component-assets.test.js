const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  os = require('node:os'),
  path = require('node:path');
const { createApp } = require('../src/app');
const assets = ['color-scheme.js', 'ui-widgets.js', 'ui-widgets.css'];
test('new shared component assets are fixed routes with correct content types and immutable source bytes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-ui-pattern-assets-'));
  const app = createApp({
    port: 0,
    host: '127.0.0.1',
    dbFile: path.join(directory, 'app.sqlite'),
    historyDir: path.join(directory, 'history'),
    communityDir: path.join(directory, 'community'),
    musicDir: path.join(directory, 'music'),
    externalSideEffectsEnabled: false,
  });
  try {
    const { port } = await app.listen();
    for (const asset of assets) {
      const response = await fetch('http://127.0.0.1:' + port + '/shared/' + asset);
      assert.equal(response.status, asset.endsWith('.js') ? 404 : 200, asset);
      if (asset.endsWith('.js')) continue;
      assert.match(
        response.headers.get('content-type'),
        asset.endsWith('.css') ? /^text\/css/ : /^text\/javascript/,
      );
      assert.equal(response.headers.get('cache-control'), 'private, no-cache');
      assert.equal(
        await response.text(),
        fs.readFileSync(path.join(__dirname, '../public/shared', asset), 'utf8'),
      );
    }
    assert.equal(
      (await fetch('http://127.0.0.1:' + port + '/shared/ui-widgets.js-extra')).status,
      404,
    );
  } finally {
    await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('game feedback pages load common helpers before game controllers and retain native media', () => {
  // Page shells are the Vue entry documents (#233).
  for (const name of ['lobby', 'poker', 'draw', 'gift', 'majority', 'race']) {
    const html = fs.readFileSync(
      path.join(__dirname, '../frontend/pages', name, 'index.html'),
      'utf8',
    );
    assert.ok(html.includes('/shared/ui-widgets.css'), name);
    assert.doesNotMatch(html, /src="\/shared\/[^"]+\.js/);
    assert.match(html, /type="module"/);
  }
});
