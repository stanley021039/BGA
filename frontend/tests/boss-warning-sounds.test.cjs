const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const fs = require('../../tests/helpers/browser-modules.cjs');

function fixture() {
  let enabled = true;
  const calls = [],
    stopped = [],
    listeners = new Map();
  const events = (prefix) => ({
    addEventListener(name, fn) {
      const key = prefix + name;
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
    },
    removeEventListener(name, fn) {
      listeners.get(prefix + name)?.delete(fn);
    },
  });
  const document = { hidden: false, ...events('d:') };
  const window = {
    document,
    ...events('w:'),
    AudioSettings: {
      playEffect(cue) {
        if (!enabled) return;
        const clip = { cue };
        calls.push(clip);
        return clip;
      },
      stopEffect(clip) {
        stopped.push(clip);
      },
    },
  };
  const context = vm.createContext({ window, Date: { now: () => 1000 } });
  vm.runInContext(
    fs.browserSource(path.resolve(__dirname, '../src/engines/game-sounds.js')),
    context,
  );
  vm.runInContext(
    fs.fixtureSource(
      fs.readFileSync(path.resolve(__dirname, '../src/services/boss-warning-sounds.js'), 'utf8'),
    ),
    context,
  );
  return {
    owner: context.createBossWarningSounds(),
    calls,
    stopped,
    listeners,
    mute() {
      enabled = false;
    },
    hide() {
      document.hidden = true;
      for (const fn of listeners.get('d:visibilitychange')) fn();
    },
    show() {
      document.hidden = false;
      for (const fn of listeners.get('d:visibilitychange')) fn();
    },
  };
}
const arrival = (id) => ({ id, spawnAt: 6000 });
test('warning plays once for simultaneous arrivals, never on countdown updates, and stops at spawn/cancel', () => {
  const f = fixture();
  f.owner.update([arrival('a'), arrival('b')], 1000, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].cue, 'boss-warning');
  f.owner.update([arrival('a'), arrival('b')], 2000, true);
  assert.equal(f.calls.length, 1);
  f.owner.update([], 3000, true);
  assert.equal(f.stopped.length, 1);
  f.owner.update([arrival('a')], 4000, true);
  assert.equal(f.calls.length, 1);
  f.owner.update([arrival('c')], 4000, true);
  assert.equal(f.calls.length, 2);
  f.owner.update([arrival('c')], 6000, true);
  assert.equal(f.stopped.length, 2);
  f.owner.destroy();
});
test('mute, hidden pages, disconnect and disposal cannot replay an old warning', () => {
  const f = fixture();
  f.owner.update([arrival('a')], 1000, true);
  f.hide();
  assert.equal(f.stopped.length, 1);
  f.show();
  f.owner.update([arrival('a')], 2000, true);
  assert.equal(f.calls.length, 1);
  f.owner.update([], 2000, false);
  f.owner.update([arrival('a')], 3000, true);
  assert.equal(f.calls.length, 1);
  f.mute();
  f.owner.update([arrival('b')], 3000, true);
  assert.equal(f.calls.length, 1);
  f.owner.destroy();
  assert.equal(f.listeners.get('w:pagehide').size, 0);
  f.owner.update([arrival('c')], 4000, true);
  assert.equal(f.calls.length, 1);
});
