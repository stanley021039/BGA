'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('@vue/compiler-sfc');

function harness() {
  const calls = [],
    lifecycle = {};
  const provider = Object.fromEntries(
    ['setWindow', 'setMarker', 'update', 'disconnect', 'dispose', 'joinVideo'].map((key) => [
      key,
      (...args) => calls.push([key, ...args]),
    ]),
  );
  const media = vue.reactive({
    context: 1,
    enabled: true,
    connected: true,
    receipt: 0,
    marker: {},
    snapshot: { roomInstanceId: 'room-a', myPlayerId: 'host', current: null },
    position: () => 0,
    serverNow: () => 1000,
    library() {},
    async load() {},
    cancelSnapshot: () => calls.push(['cancelSnapshot']),
    report() {},
  });
  const geometry = {
    style: vue.ref({}),
    box: vue.ref({ width: 430, height: 720 }),
    layout() {},
    cancel() {},
    edges: [],
  };
  const source = compileScript(
    parse(fs.readFileSync(path.resolve(__dirname, '../src/components/RoomMedia.vue'), 'utf8'))
      .descriptor,
    { id: 'media-lifecycle' },
  ).content;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? {
              ...vue,
              useId: () => 'media-test',
              onMounted: (fn) => (lifecycle.mount = fn),
              onBeforeUnmount: (fn) => (lifecycle.unmount = fn),
            }
          : id.includes('stores/media')
            ? { useMediaStore: () => media }
            : id.includes('stores/preferences')
              ? {
                  usePreferencesStore: () => ({
                    media: 'default',
                    audio: { music: { enabled: true, volume: 0.3 } },
                  }),
                }
              : id.includes('composables/media-window')
                ? { useMediaWindow: () => geometry }
                : id.includes('contracts/media')
                  ? { mediaCurrentKey: () => '', mediaPlaybackKey: () => '' }
                  : {},
      localStorage: { getItem: () => null },
      window: {
        RoomMediaPlayer: {
          create: () => {
            calls.push(['create']);
            return provider;
          },
        },
      },
      document: {
        hidden: false,
        querySelector: () => null,
        addEventListener() {},
        removeEventListener() {},
      },
      MutationObserver: class {
        observe() {}
        disconnect() {}
      },
      setInterval: () => 1,
      clearInterval() {},
      URLSearchParams,
    },
  );
  const scope = vue.effectScope();
  let component;
  scope.run(() => (component = module.exports.default.setup({ connected: true }, { expose() {} })));
  component.audioHost.value = {};
  component.videoHost.value = {};
  component.frameArt.value = { replaceChildren() {} };
  component.dialog.value = {
    open: false,
    show() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    focus() {},
  };
  lifecycle.mount();
  return {
    component,
    calls,
    media,
    dispose() {
      lifecycle.unmount();
      scope.stop();
    },
  };
}

test('actual Vue window opts into hidden video playback across request, close, Escape and reopen', async () => {
  const h = harness();
  try {
    await h.component.show();
    h.component.setTab('request');
    assert.deepEqual(h.calls.filter((c) => c[0] === 'setWindow').at(-1), [
      'setWindow',
      true,
      true,
      true,
    ]);
    h.component.close();
    assert.equal(h.component.opened.value, false);
    assert.deepEqual(h.calls.filter((c) => c[0] === 'setWindow').at(-1), [
      'setWindow',
      false,
      true,
      true,
    ]);
    await h.component.open();
    h.component.setTab('player');
    assert.deepEqual(h.calls.filter((c) => c[0] === 'setWindow').at(-1), [
      'setWindow',
      true,
      false,
      true,
    ]);
    h.component.escape({ key: 'Escape', preventDefault() {} });
    assert.equal(h.component.opened.value, false);
    assert.equal(h.calls.filter((c) => c[0] === 'create').length, 1);
    assert.equal(h.calls.filter((c) => ['disconnect', 'dispose'].includes(c[0])).length, 0);
    h.media.context++;
    await vue.nextTick();
    assert.equal(
      h.calls.filter((c) => c[0] === 'disconnect').length,
      1,
      'leaving the room still clears playback',
    );
  } finally {
    h.dispose();
  }
  assert.equal(h.calls.filter((c) => c[0] === 'dispose').length, 1);
});
