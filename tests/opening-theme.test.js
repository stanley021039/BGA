'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  vm = require('node:vm');
function fixture(fetch, saved = 'default') {
  const values = new Map([['bga-website-opening', saved]]),
    window = {},
    document = { documentElement: { dataset: {} } };
  vm.runInNewContext(
    fs.readFileSync(require.resolve('../frontend/src/engines/opening-theme.js'), 'utf8'),
    {
      window,
      document,
      fetch,
      AbortController,
      setTimeout,
      clearTimeout,
      localStorage: {
        getItem: (key) => values.get(key),
        setItem: (key, value) => values.set(key, value),
      },
    },
  );
  return { opening: window.EntryOpening, document, values };
}
test('a fresh browser restores the server-owned website opening rather than overwriting it with its default', async () => {
  const f = fixture(async () => ({ ok: true, json: async () => ({ theme: 'soul-world' }) }));
  assert.equal(f.opening.get(), 'default');
  const result = await f.opening.resolve();
  assert.equal(result.id, 'soul-world');
  assert.equal(result.sound, 'entrance-soul-world');
  assert.equal(f.opening.get(), 'soul-world');
  assert.equal(f.document.documentElement.dataset.entryOpening, 'soul-world');
});
test('reset or another account revokes the locally cached special opening', async () => {
  const f = fixture(
    async () => ({ ok: true, json: async () => ({ theme: 'default' }) }),
    'soul-world',
  );
  assert.equal((await f.opening.resolve()).id, 'default');
  assert.equal(f.opening.get(), 'default');
  assert.equal(f.document.documentElement.dataset.entryOpening, 'default');
});
test('an unavailable profile falls back to the ordinary opening and clears the special image', async () => {
  const f = fixture(async () => {
    throw Error('offline');
  }, 'soul-world');
  assert.equal((await f.opening.resolve()).sound, 'entry-intro');
  assert.equal(f.document.documentElement.dataset.entryOpening, 'default');
});

test('the free family opening is restored with its own image and audio', async () => {
  const f = fixture(
    async () => ({ ok: true, json: async () => ({ theme: 'home-family' }) }),
    'home-family',
  );
  assert.equal(f.opening.get(), 'home-family');
  const result = await f.opening.resolve();
  assert.equal(result.image, '/assets/auth/home-family.jpg');
  assert.equal(result.sound, 'entry-home-family');
});
