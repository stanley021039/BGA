const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { dom } = require('./helpers/widget-dom.cjs');

function fixture({
  reduced = false,
  blocked = false,
  animationError = false,
  entryEnabled = true,
} = {}) {
  const { document } = dom(
    '<main><figure id="authArtwork"><img src="/assets/auth/login-576.webp"></figure><form><button>登入</button></form></main>',
  );
  document.documentElement = document.createElement('html');
  document.head = document.createElement('head');
  const image = document.querySelector('img');
  image.complete = true;
  image.naturalWidth = 576;
  image.getBoundingClientRect = () => ({ x: 350, y: 280, width: 576, height: 324 });
  image.style.removeProperty = (name) => {
    delete image.style[name];
  };
  let frames,
    options,
    cancelled = 0,
    id = 0;
  image.animate = (keys, config) => {
    if (animationError) throw Error('animation unavailable');
    frames = keys;
    options = config;
    return {
      cancel() {
        cancelled++;
      },
    };
  };
  const timers = new Map(),
    storage = new Map(),
    events = new Map();
  const window = {
    EntryPreferences: { get: () => ({ enabled: entryEnabled }) },
    innerWidth: 1920,
    innerHeight: 1080,
    location: new URL('http://localhost/login'),
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: {
      setItem(k, v) {
        if (blocked) throw Error('blocked');
        storage.set(k, v);
      },
    },
    addEventListener: (k, fn) => events.set(k, fn),
    removeEventListener: (k) => events.delete(k),
  };
  vm.runInNewContext(fs.readFileSync('public/shared/auth-entry.js', 'utf8'), {
    window,
    document,
    URL,
    localStorage: { getItem: () => null },
    setTimeout(fn, delay) {
      timers.set(++id, { fn, delay });
      return id;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
  });
  return {
    document,
    image,
    storage,
    events,
    timers,
    window,
    get frames() {
      return frames;
    },
    get options() {
      return options;
    },
    get cancelled() {
      return cancelled;
    },
    start: () => window.EntryIntro.playFrom(image, '/quacks/ABC123'),
    finish: () => [...timers.values()].find((t) => t.delay === 3000).fn(),
  };
}

test('auth animates the same image without reparenting or rebuilding; navigation waits three seconds', async () => {
  const f = fixture(),
    parent = f.image.parentElement;
  let navigated = false;
  const result = f.start();
  result.then(() => {
    navigated = true;
  });
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), true);
  assert.equal(f.image.parentElement, parent);
  assert.equal(f.document.querySelectorAll('img').length, 1);
  assert.equal(f.frames[0].transform, 'none');
  assert.match(f.frames[1].transform, /translate\(322px, 98px\)/);
  assert.equal(f.options.duration, 3000);
  assert.equal(navigated, false);
  assert.equal(f.start(), result);
  f.finish();
  await result;
  assert.equal(navigated, true);
  assert.equal(JSON.parse(f.storage.get('bga-entry-intro-completed')).path, '/quacks/ABC123');
  assert.equal(f.image.style.opacity, '0');
  f.events.get('pagehide')();
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), false);
  assert.equal(f.image.style.opacity, undefined);
  assert.equal(f.cancelled, 1);
  assert.equal(f.timers.size, 0);
});

test('skip resolves immediately and reduced-motion avoids scaling', async () => {
  const f = fixture({ reduced: true });
  const result = f.start();
  assert.equal(f.frames[1].transform, 'none');
  f.document.querySelector('.entry-auth-skip').dispatch('click');
  await result;
  assert.equal(f.document.querySelector('.entry-auth-skip').hidden, true);
});

test('Escape finishes the auth animation without waiting for its timer', async () => {
  const f = fixture();
  const result = f.start();
  const event = f.document.body.dispatch('keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true);
  await result;
  assert.equal(f.cancelled, 1);
  assert.equal(
    [...f.timers.values()].some((timer) => timer.delay === 3000),
    false,
  );
});

test('blocked storage and unavailable animation still complete, and failed navigation recovers the auth UI', async () => {
  const f = fixture({ blocked: true, animationError: true });
  const result = f.start();
  f.finish();
  await result;
  assert.match(f.document.cookie, /bga_entry_intro=/);
  [...f.timers.values()].find((t) => t.delay === 10000).fn();
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), false);
  assert.equal(f.document.querySelector('.entry-auth-skip'), null);
});

test('disabled entry returns immediately without hiding auth UI, creating timers or completion records', async () => {
  const f = fixture({ entryEnabled: false });
  await f.start();
  assert.equal(f.frames, undefined);
  assert.equal(f.timers.size, 0);
  assert.equal(f.storage.size, 0);
  assert.equal(f.document.documentElement.classList.contains('entry-auth-playing'), false);
  assert.equal(f.document.querySelector('.entry-auth-skip'), null);
  assert.equal(f.image.style.opacity, undefined);
});
