const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { withEntryIntro } = require('../src/http/entry-intro');
const { dom } = require('./helpers/widget-dom.cjs');

function fixture({
  elapsed = 0,
  stored = null,
  brokenStorage = false,
  completed = null,
  loading = false,
  cookie = '',
  entryStored = null,
  writeBlocked = false,
} = {}) {
  const { document } = dom(
    '<button id="before">Before</button><dialog id="entry-intro" open><div class="entry-intro-art"><img></div><button>略過開場</button></dialog>',
  );
  document.documentElement = document.createElement('html');
  document.readyState = loading ? 'loading' : 'complete';
  document.cookie = cookie;
  const panel = document.getElementById('entry-intro');
  const art = panel.querySelector('.entry-intro-art');
  Object.assign(art, { offsetWidth: 1000, offsetHeight: 562.5, offsetLeft: 200, offsetTop: 100 });
  art.style.setProperty = (key, value) => {
    art.style[key] = value;
  };
  const storage = new Map(
    completed ? [['bga-entry-intro-completed', JSON.stringify(completed)]] : [],
  );
  const preferences = new Map(
    entryStored === null ? [] : [['bga-entry-intro-settings', entryStored]],
  );
  panel.getAnimations = () => [{ animationName: 'entry-intro-curtain', currentTime: elapsed }];
  document.getElementById('before').focus();
  const timers = new Map(),
    events = new Map();
  let timerId = 0,
    disconnected = 0,
    observer;
  class Observer {
    constructor(callback) {
      observer = callback;
    }
    observe() {}
    disconnect() {
      disconnected++;
    }
  }
  const window = {
    location: { pathname: '/', search: '' },
    MutationObserver: Observer,
    sessionStorage: {
      getItem(key) {
        if (brokenStorage) throw Error('blocked');
        return storage.get(key) || null;
      },
      setItem(key, value) {
        if (brokenStorage) throw Error('blocked');
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    addEventListener(type, callback) {
      events.set(type, callback);
    },
  };
  vm.runInNewContext(fs.readFileSync('public/shared/entry-intro.js', 'utf8'), {
    window,
    document,
    location: { pathname: '/', search: '' },
    MutationObserver: Observer,
    localStorage: {
      getItem(key) {
        if (brokenStorage) throw Error('blocked');
        return key === 'ah-motion-settings' ? stored : preferences.get(key) || null;
      },
      setItem(key, value) {
        if (brokenStorage || writeBlocked) throw Error('blocked');
        preferences.set(key, value);
      },
    },
    setTimeout(callback, delay) {
      timers.set(++timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  return {
    document,
    panel,
    window,
    storage,
    preferences,
    events,
    timers,
    observer,
    get disconnected() {
      return disconnected;
    },
    finish() {
      [...timers.values()][0].callback();
    },
  };
}

test('entry decoration preserves Vue/legacy markup and adds one external bootstrap without changing navigation', () => {
  for (const html of [
    '<html><head></head><body class="auth-page"><form action="/api/auth/login"></form></body></html>',
    '<html><head><script type="module" src="/frontend-assets/app.js"></script></head><body><main id="app"></main></body></html>',
    '<html><meta charset="utf-8"><title>Legacy</title><main id="app"></main></html>',
    '<html><head></head\n><body><main id="app"></main></body></html>',
  ]) {
    const result = withEntryIntro(Buffer.from(html));
    assert.equal((result.match(/id="entry-intro"/g) || []).length, 1);
    assert.match(result, /entry-intro\.css/);
    assert.match(result, /src="\/shared\/entry-intro.js"/);
    assert.ok(
      result.includes(
        html.includes('form') ? '<form action="/api/auth/login">' : '<main id="app">',
      ),
    );
    assert.equal(withEntryIntro(result), result);
  }
  assert.equal(withEntryIntro('<main>not a document</main>'), '<main>not a document</main>');
});

test('auth page stays visible; destination consumes completion once without replaying', () => {
  const html = withEntryIntro('<html><head></head><body><main id="auth"></main></body></html>', {
    authPage: true,
  });
  assert.doesNotMatch(html, /id="entry-intro"/);
  assert.match(html, /auth-entry.js/);
  const completed = { at: Date.now(), path: '/' };
  const next = fixture({ completed });
  assert.equal(next.panel.hidden, true);
  assert.equal(next.panel.open, false);
  assert.equal(next.timers.size, 0);
  assert.equal(next.storage.size, 0);
  const stale = fixture({ completed: { ...completed, at: Date.now() - 60000 } });
  assert.equal(stale.timers.size, 1);
  const other = fixture({ completed: { ...completed, path: '/settings' } });
  assert.equal(other.timers.size, 1);
  next.events.get('pageshow')({ persisted: true });
  assert.equal(next.panel.hidden, false);
  assert.equal(next.timers.size, 1);
});
test('completed auth suppresses the overlay before body parsing, including cookie fallback', () => {
  const completed = { at: Date.now(), path: '/' };
  for (const options of [
    { completed },
    {
      brokenStorage: true,
      cookie: 'bga_entry_intro=' + encodeURIComponent(JSON.stringify(completed)),
    },
  ]) {
    const f = fixture({ ...options, loading: true });
    assert.equal(f.document.documentElement.classList.contains('entry-intro-skipped'), true);
    assert.equal(f.timers.size, 0);
    f.document.body.dispatch('DOMContentLoaded');
    assert.equal(f.panel.hidden, true);
    assert.equal(f.panel.open, false);
    assert.equal(f.document.documentElement.classList.contains('entry-intro-skipped'), false);
  }
});

test('shared dialog framing leaves the owned intro artwork centered and skip button in place', () => {
  const html = withEntryIntro('<html><head></head><body></body></html>');
  const { document } = dom(html);
  const panel = document.getElementById('entry-intro');
  const artwork = panel.querySelector('.entry-intro-art');
  const skip = panel.querySelector('button');
  const source = fs.readFileSync('public/shared/ui-components.js', 'utf8');
  const scope = { document };
  vm.createContext(scope);
  vm.runInContext(
    source.slice(
      source.indexOf(' function frameDialog('),
      source.indexOf(' function mountDialogFrames('),
    ),
    scope,
  );
  scope.frameDialog(panel);
  assert.equal(artwork.parentElement, panel);
  assert.equal(skip.parentElement, panel);
  assert.equal(panel.querySelector('.ui-dialog-header'), null);
});

test('intro ends at three seconds, closes its modal and restores the prior focus', () => {
  const f = fixture();
  assert.equal(f.panel.open, true);
  assert.equal([...f.timers.values()][0].delay, 3000);
  f.finish();
  assert.equal(f.panel.open, false);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.document.documentElement.classList.contains('entry-intro-active'), false);
  assert.equal(f.document.activeElement.id, 'before');
  assert.equal(f.disconnected, 1);
});

test('skip and Escape finish immediately without waiting or changing login/session storage', () => {
  for (const event of ['click', 'cancel']) {
    const f = fixture();
    (event === 'click' ? f.panel.querySelector('button') : f.panel).dispatch(event);
    assert.equal(f.panel.hidden, true);
    assert.equal(f.timers.size, 0);
  }
});

test('BFCache entry plays again while pagehide cancels the previous timer and observer', () => {
  const f = fixture();
  f.events.get('pagehide')();
  assert.equal(f.timers.size, 0);
  f.events.get('pageshow')({ persisted: true });
  assert.equal(f.panel.hidden, false);
  assert.equal(f.timers.size, 1);
  f.events.get('pageshow')({ persisted: true });
  assert.equal(f.timers.size, 1);
  f.finish();
});

test('late scripts, blocked storage and reduced-motion preference cannot strand the page', () => {
  const late = fixture({ elapsed: 3500 });
  assert.equal([...late.timers.values()][0].delay, 0);
  late.finish();
  assert.equal(late.panel.hidden, true);
  const blocked = fixture({ brokenStorage: true });
  blocked.finish();
  assert.equal(blocked.panel.hidden, true);
  const reduced = fixture({ stored: '{"version":1,"enabled":false}' });
  assert.equal(reduced.panel.classList.contains('entry-intro-reduced'), true);
  reduced.finish();
});

test('other automatic dialogs remain open and are revealed after the introduction', () => {
  const f = fixture(),
    other = f.document.createElement('dialog');
  f.document.body.append(other);
  other.showModal();
  f.observer([{ target: other }]);
  assert.equal(other.open, true);
  assert.ok(f.panel.modalCalls >= 2);
  f.finish();
  assert.equal(other.open, true);
  assert.equal(f.panel.hidden, true);
});

test('entry preference defaults on and rejects invalid or unsupported saved values', () => {
  for (const entryStored of [
    null,
    '{bad',
    'null',
    'false',
    '{"version":2,"enabled":false}',
    '{"version":1,"enabled":"false"}',
  ]) {
    const f = fixture({ entryStored });
    assert.equal(f.window.EntryPreferences.get().enabled, true);
    assert.equal(f.window.EntryPreferences.get().persisted, true);
    assert.equal(f.timers.size, 1);
  }
});

test('disabled entry is suppressed before body parsing and remains skipped on reload and BFCache', () => {
  const f = fixture({
    loading: true,
    entryStored: '{"version":1,"enabled":false}',
    completed: { at: Date.now(), path: '/' },
    cookie: 'bga_entry_intro=old',
  });
  assert.equal(f.document.documentElement.classList.contains('entry-intro-disabled'), true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.storage.size, 0);
  assert.match(f.document.cookie, /Max-Age=0/);
  f.document.body.dispatch('DOMContentLoaded');
  assert.equal(f.panel.hidden, true);
  assert.equal(f.panel.open, false);
  f.events.get('pageshow')({ persisted: true });
  assert.equal(f.timers.size, 0);
  assert.equal(f.panel.open, false);
  const reload = fixture({ entryStored: f.preferences.get('bga-entry-intro-settings') });
  assert.equal(reload.panel.hidden, true);
  assert.equal(reload.timers.size, 0);
});

test('switching entry preference persists, cancels active entry, and re-enables only on the next entry', () => {
  const f = fixture();
  const values = [];
  const unsubscribe = f.window.EntryPreferences.subscribe((value) => values.push(value.enabled));
  f.window.EntryPreferences.set(false);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(JSON.parse(f.preferences.get('bga-entry-intro-settings')), {
    version: 1,
    enabled: false,
  });
  f.window.EntryPreferences.set(true);
  assert.equal(
    f.timers.size,
    0,
    'changing the setting must not replay an intro over the settings dialog',
  );
  f.events.get('pageshow')({ persisted: true });
  assert.equal(f.timers.size, 1);
  assert.equal(f.panel.hidden, false);
  assert.deepEqual(values, [true, false, true]);
  unsubscribe();
  f.window.EntryPreferences.set(false);
  assert.deepEqual(values, [true, false, true]);
});

test('other-tab opt-out and storage clearing update the preference without affecting game motion', () => {
  const f = fixture({ stored: '{"version":1,"enabled":false}' });
  f.preferences.set('bga-entry-intro-settings', '{"version":1,"enabled":false}');
  f.events.get('storage')({ key: 'unrelated' });
  assert.equal(f.panel.hidden, false);
  f.events.get('storage')({ key: 'bga-entry-intro-settings' });
  assert.equal(f.panel.hidden, true);
  assert.equal(f.timers.size, 0);
  f.preferences.clear();
  f.events.get('storage')({ key: null });
  assert.equal(f.window.EntryPreferences.get().enabled, true);
  f.events.get('pageshow')({ persisted: true });
  assert.equal(f.panel.classList.contains('entry-intro-reduced'), true);
});

test('storage refusal never reports a saved opt-out or blocks entry', () => {
  for (const options of [{ brokenStorage: true }, { writeBlocked: true }]) {
    const f = fixture(options);
    const value = f.window.EntryPreferences.set(false);
    assert.equal(value.enabled, true);
    assert.equal(value.persisted, false);
    assert.equal(f.window.EntryPreferences.get().enabled, true);
    assert.equal(f.timers.size, 1);
  }
});

test('auth documents load the same blocking preference owner before the deferred image animator', () => {
  const html = withEntryIntro('<html><head></head><body><main></main></body></html>', {
    authPage: true,
  });
  assert.ok(html.indexOf('src="/shared/entry-intro.js"') < html.indexOf('<body>'));
  assert.ok(
    html.indexOf('src="/shared/entry-intro.js"') < html.indexOf('src="/shared/auth-entry.js"'),
  );
  assert.match(html, /<script defer src="\/shared\/auth-entry.js"/);
  assert.doesNotMatch(html, /id="entry-intro"/);
});
