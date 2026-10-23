const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/motion-lifetime.js'), 'utf8')
  .replace(/export /g, '');
function harness(blocked = false) {
  const listeners = new Map(),
    subscriptions = new Set(),
    prefs = { enabled: !blocked },
    media = { matches: false };
  const eventTarget = (name) => ({
    addEventListener(t, fn) {
      listeners.set(name + t, new Set([...(listeners.get(name + t) || []), fn]));
    },
    removeEventListener(t, fn) {
      listeners.get(name + t)?.delete(fn);
    },
  });
  const document = { ...eventTarget('doc'), hidden: false };
  const window = {
    ...eventTarget('win'),
    document,
    matchMedia: () => media,
    MotionPolicy: {
      allowsMotion: () => prefs.enabled,
      subscribe(fn) {
        subscriptions.add(fn);
        fn();
        return () => subscriptions.delete(fn);
      },
    },
  };
  Object.assign(media, eventTarget('media'));
  const box = { window, Set };
  vm.createContext(box);
  vm.runInContext(source, box);
  const fire = (key) => [...(listeners.get(key) || [])].forEach((fn) => fn());
  return {
    box,
    window,
    document,
    media,
    prefs,
    subscriptions,
    listeners,
    fire,
    notify: () => [...subscriptions].forEach((fn) => fn()),
  };
}
for (const reason of ['policy', 'reduce', 'hidden', 'pagehide'])
  test(
    'in-flight cosmetic job cancels immediately on ' + reason + ' and releases all listeners',
    () => {
      const f = harness();
      let cancelled = 0;
      const release = f.box.watchMotionCancellation(() => cancelled++);
      if (reason === 'policy') {
        f.prefs.enabled = false;
        f.notify();
      }
      if (reason === 'reduce') {
        f.media.matches = true;
        f.fire('mediachange');
      }
      if (reason === 'hidden') {
        f.document.hidden = true;
        f.fire('docvisibilitychange');
      }
      if (reason === 'pagehide') f.fire('winpagehide');
      assert.equal(cancelled, 1);
      assert.equal(f.subscriptions.size, 0);
      assert.equal(
        [...f.listeners.values()].reduce((n, s) => n + s.size, 0),
        0,
      );
      f.prefs.enabled = true;
      f.media.matches = false;
      f.document.hidden = false;
      f.notify();
      f.fire('winpagehide');
      release();
      assert.equal(cancelled, 1);
    },
  );
test('already blocked synchronous subscription releases itself, normal completion does not call cancel', () => {
  const f = harness(true);
  let count = 0;
  f.box.watchMotionCancellation(() => count++);
  assert.equal(count, 1);
  assert.equal(f.subscriptions.size, 0);
  const g = harness();
  const release = g.box.watchMotionCancellation(() => count++);
  release();
  release();
  g.fire('winpagehide');
  assert.equal(count, 1);
  assert.equal(g.subscriptions.size, 0);
});
test('context quota is shared, finite and returned on cleanup', () => {
  const f = harness(),
    a = {},
    b = {},
    c = {};
  let acquired = 0,
    released = 0;
  f.window.GameFxLayer = {
    acquireContext() {
      acquired++;
      return true;
    },
    releaseContext() {
      released++;
    },
  };
  const one = f.box.acquireEffectContext(a),
    two = f.box.acquireEffectContext(b);
  assert.ok(one && two);
  assert.equal(f.box.acquireEffectContext(c), null);
  one();
  one();
  assert.equal(released, 1);
  const three = f.box.acquireEffectContext(c);
  assert.ok(three);
  two();
  three();
  assert.equal(released, 3);
  assert.equal(acquired, 3);
  f.window.GameFxLayer.acquireContext = () => false;
  assert.equal(f.box.acquireEffectContext({}), null);
});
