const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { withEntryIntro } = require('../src/http/entry-intro');
const { dom } = require('./helpers/widget-dom.cjs');

function fixture({ elapsed = 0, stored = null, brokenStorage = false, origin = null } = {}) {
  const { document } = dom(
    '<button id="before">Before</button><dialog id="entry-intro" open><div class="entry-intro-art"><img></div><button>略過開場</button></dialog>',
  );
  document.documentElement = document.createElement('html');
  const panel = document.getElementById('entry-intro');
  const art = panel.querySelector('.entry-intro-art');
  Object.assign(art, { offsetWidth: 1000, offsetHeight: 562.5, offsetLeft: 200, offsetTop: 100 });
  art.style.setProperty = (key, value) => {
    art.style[key] = value;
  };
  const storage = new Map(origin ? [['bga-entry-intro-origin', JSON.stringify(origin)]] : []);
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
    MutationObserver: Observer,
    localStorage: {
      getItem() {
        if (brokenStorage) throw Error('blocked');
        return stored;
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
    assert.match(result, /defer src="\/shared\/entry-intro.js"/);
    assert.ok(
      result.includes(
        html.includes('form') ? '<form action="/api/auth/login">' : '<main id="app">',
      ),
    );
    assert.equal(withEntryIntro(result), result);
  }
  assert.equal(withEntryIntro('<main>not a document</main>'), '<main>not a document</main>');
});

test('auth page stays visible and successful auth hands the original image geometry to one entry', () => {
  const html = withEntryIntro('<html><head></head><body><main id="auth"></main></body></html>', {
    authPage: true,
  });
  assert.doesNotMatch(html, /id="entry-intro"/);
  assert.match(html, /entry-intro.js/);
  const f = fixture();
  f.window.EntryIntro.prepareFrom({
    currentSrc: '/assets/auth/register-576.webp',
    getBoundingClientRect: () => ({ x: 20, y: 80, width: 500, height: 281.25 }),
  });
  const origin = JSON.parse(f.storage.get('bga-entry-intro-origin'));
  assert.equal(origin.kind, 'register');
  assert.equal(origin.width, 500);
  const next = fixture({ origin });
  assert.equal(next.storage.has('bga-entry-intro-origin'), false);
  assert.equal(next.panel.classList.contains('entry-intro-from-auth'), true);
  assert.equal(next.panel.querySelector('.entry-intro-art').style['--entry-from-sx'], '0.5');
  assert.equal(next.panel.querySelector('img').src, '/assets/auth/register-576.webp');
  const stale = fixture({ origin: { ...origin, at: Date.now() - 60000 } });
  assert.equal(stale.panel.classList.contains('entry-intro-from-auth'), false);
  const blocked = fixture({ brokenStorage: true });
  assert.doesNotThrow(() =>
    blocked.window.EntryIntro.prepareFrom({
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 500, height: 281 }),
    }),
  );
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
