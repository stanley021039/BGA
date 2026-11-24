const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../src/services/mobile-landscape.js'), 'utf8');
const { installMobileLandscape } = vm.runInNewContext(
  source.replace('export function', 'function') + '\n({installMobileLandscape})',
);
function fixture() {
  const events = new Map(),
    calls = [],
    hints = [];
  const media = [true, true].map((matches) => ({
    matches,
    addEventListener() {},
    removeEventListener() {},
  }));
  const doc = {
    hidden: false,
    fullscreenElement: null,
    documentElement: {
      async requestFullscreen() {
        calls.push('fullscreen');
        doc.fullscreenElement = this;
      },
    },
    async exitFullscreen() {
      calls.push('exit');
      doc.fullscreenElement = null;
    },
    addEventListener(name, fn) {
      events.set(name, fn);
    },
    removeEventListener(name) {
      events.delete(name);
    },
  };
  const orientation = {
    async lock(value) {
      calls.push(value);
    },
    unlock() {
      calls.push('unlock');
    },
  };
  const win = {
    matchMedia: (query) => media[query.includes('coarse') ? 0 : 1],
    screen: { orientation },
  };
  const controller = installMobileLandscape(win, doc, (value) => hints.push(value));
  const gesture = (overInput = false, trusted = true) =>
    events.get('pointerup')?.({ isTrusted: trusted, target: { closest: () => overInput } });
  return { doc, orientation, media, controller, calls, hints, events, gesture };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
test('mobile requests landscape once from trusted interaction, while forms and desktop remain untouched', async () => {
  const f = fixture();
  f.gesture(true);
  f.gesture(false, false);
  assert.deepEqual(f.calls, []);
  f.gesture();
  await flush();
  f.gesture();
  await flush();
  assert.deepEqual(f.calls, ['fullscreen', 'landscape']);
  f.media[1].matches = false;
  f.events.get('visibilitychange')();
  assert.equal(f.hints.at(-1), false);
  f.controller.stop();
  assert.deepEqual(f.calls, ['fullscreen', 'landscape', 'unlock', 'exit']);
  assert.equal(f.events.size, 0);
  const desktop = fixture();
  desktop.media[0].matches = false;
  desktop.gesture();
  await flush();
  assert.deepEqual(desktop.calls, []);
  desktop.controller.stop();
});
test('unsupported orientation keeps a retry hint and late fullscreen completion releases its ownership', async () => {
  const f = fixture();
  f.orientation.lock = async () => {
    throw Error('unsupported');
  };
  f.gesture();
  await flush();
  assert.equal(f.hints.at(-1), true);
  await f.controller.request();
  assert.equal(f.hints.at(-1), true);
  f.controller.stop();
  assert.ok(!f.calls.includes('unlock'));
  const late = fixture();
  let finish;
  late.doc.documentElement.requestFullscreen = () =>
    new Promise((resolve) => {
      finish = () => {
        late.doc.fullscreenElement = late.doc.documentElement;
        resolve();
      };
    });
  late.gesture();
  late.controller.stop();
  finish();
  await flush();
  assert.deepEqual(late.calls, ['exit']);
});
