const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  path = require('node:path'),
  vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../public/shared/color-scheme.js'), 'utf8');
function fixture({ dark = false, saved, blocked = false, noMedia = false } = {}) {
  const storage = new Map(saved === undefined ? [] : [['ah-color-scheme', saved]]),
    events = {},
    media = {
      matches: dark,
      addEventListener(type, fn) {
        this.change = fn;
      },
    },
    document = { documentElement: { dataset: {} } };
  const window = {
    addEventListener(type, fn) {
      events[type] = fn;
    },
  };
  if (!noMedia) window.matchMedia = () => media;
  const localStorage = {
    getItem(key) {
      if (blocked) throw Error('blocked');
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (blocked) throw Error('blocked');
      storage.set(key, value);
    },
  };
  vm.runInNewContext(source, { window, document, localStorage });
  return {
    api: window.ColorScheme,
    storage,
    document,
    events,
    system(value) {
      media.matches = value;
      media.change?.();
    },
  };
}
test('appearance follows system by default, reacts live and boots before styles on every themed page', () => {
  const f = fixture({ dark: true });
  assert.equal(f.document.documentElement.dataset.colorScheme, 'dark');
  f.system(false);
  assert.equal(f.api.get().scheme, 'light');
  // Every page is a Vue shell in frontend/pages/<id>/index.html (#233).
  const directory = path.join(__dirname, '../frontend/pages'),
    pages = fs
      .readdirSync(directory)
      .map((id) => ({
        name: id,
        html: fs.readFileSync(path.join(directory, id, 'index.html'), 'utf8'),
      }))
      .filter((page) => page.html.includes('data-visual-theme="playful"'));
  assert.equal(pages.length, 31); // Includes COC.
  assert.ok(pages.some((page) => page.name === 'coc'));
  for (const { name, html } of pages) {
    const decorated = require('../src/http/entry-intro').withEntryIntro(html);
    assert.ok(decorated.indexOf('data-prepaint') < decorated.indexOf('rel="stylesheet"'), name);
    assert.doesNotMatch(html, /src="\/shared\/color-scheme.js"/);
  }
});
test('manual toggle overrides system, survives reload and can restore following the system', () => {
  const f = fixture({ dark: true });
  f.api.toggle();
  assert.equal(f.api.get().preference, 'light');
  assert.equal(f.storage.get('ah-color-scheme'), 'light');
  f.system(true);
  assert.equal(f.api.get().scheme, 'light');
  const reloaded = fixture({ dark: true, saved: f.storage.get('ah-color-scheme') });
  assert.equal(reloaded.api.get().scheme, 'light');
  reloaded.api.set('auto');
  assert.equal(reloaded.api.get().scheme, 'dark');
  reloaded.system(false);
  assert.equal(reloaded.api.get().scheme, 'light');
});
test('saved dark works against a light system and unrelated or invalid input cannot change preference', () => {
  const f = fixture({ saved: 'dark' });
  assert.equal(f.api.get().scheme, 'dark');
  f.api.set('untrusted');
  f.events.storage({ key: 'ah-session' });
  assert.equal(f.api.get().preference, 'dark');
  assert.equal(f.storage.size, 1);
  assert.equal(fixture({ saved: 'invalid' }).api.get().preference, 'auto');
});
test('appearance synchronizes across tabs and clearing storage restores system preference', () => {
  const f = fixture({ dark: true, saved: 'dark' });
  f.storage.set('ah-color-scheme', 'light');
  f.events.storage({ key: 'ah-color-scheme' });
  assert.equal(f.api.get().scheme, 'light');
  f.storage.clear();
  f.events.storage({ key: null });
  assert.equal(f.api.get().preference, 'auto');
  assert.equal(f.api.get().scheme, 'dark');
});
test('unavailable storage or media still allows a manual appearance without throwing', () => {
  const f = fixture({ dark: true, blocked: true });
  assert.equal(f.api.get().scheme, 'dark');
  f.api.toggle();
  assert.equal(f.api.get().scheme, 'light');
  const fallback = fixture({ noMedia: true });
  assert.equal(fallback.api.get().scheme, 'light');
  fallback.api.set('dark');
  assert.equal(fallback.document.documentElement.dataset.colorScheme, 'dark');
});
test('subscribers receive current state and unsubscribe without affecting the room storage', () => {
  const f = fixture(),
    seen = [];
  f.storage.set('ah-draw', 'unchanged-session');
  const stop = f.api.subscribe((state) => seen.push(state.scheme));
  f.api.set('dark');
  stop();
  f.api.set('light');
  assert.deepEqual(seen, ['light', 'dark']);
  assert.equal(f.storage.get('ah-draw'), 'unchanged-session');
});
