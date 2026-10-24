'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('vue'),
  ts = require('typescript');
function harness() {
  let height = 260,
    observer;
  const listeners = new Map();
  const element = {
    open: true,
    querySelector: () => null,
    getBoundingClientRect: () => ({ height }),
  };
  const context = {
    module: { exports: {} },
    exports: {},
    innerWidth: 1200,
    innerHeight: 900,
    require: () => vue,
    localStorage: {
      getItem: (key) => (key.includes('size') ? '{"width":480,"height":900}' : null),
      setItem() {},
    },
    document: { querySelector: () => null },
    window: {
      addEventListener: (key, fn) => listeners.set(key, fn),
      removeEventListener: (key) => listeners.delete(key),
    },
    ResizeObserver: class {
      constructor(fn) {
        this.notify = fn;
        this.disconnected = false;
        observer = this;
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/composables/media-window.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    context,
  );
  const scope = vue.effectScope(),
    mode = vue.ref('full'),
    opened = vue.ref(true);
  let geometry;
  scope.run(() => {
    geometry = context.module.exports.useMediaWindow(vue.shallowRef(element), opened, mode);
  });
  return {
    geometry,
    mode,
    context,
    listeners,
    observer,
    element,
    setHeight(value) {
      height = value;
      observer.notify();
    },
    dispose: () => scope.stop(),
  };
}
test('saved manual heights never override automatic content height', () => {
  const h = harness();
  try {
    h.geometry.layout();
    assert.equal(h.geometry.style.value.height, 'auto');
    assert.equal(h.geometry.box.value.width, 480);
    assert.equal(h.geometry.box.value.height, 260);
    h.setHeight(410);
    assert.equal(h.geometry.box.value.height, 410);
    assert.equal(h.geometry.style.value.height, 'auto');
  } finally {
    h.dispose();
  }
});
test('width resizing retains natural height and collapsed bar stays 56px', () => {
  const h = harness();
  try {
    h.geometry.layout();
    h.geometry.keyboard(
      { target: { closest: () => null }, key: 'ArrowLeft', preventDefault() {} },
      'w',
    );
    assert.equal(h.geometry.box.value.width, 500);
    assert.equal(h.geometry.box.value.height, 260);
    assert.equal(h.geometry.style.value.height, 'auto');
    assert.deepEqual(
      Array.from(h.geometry.edges, (edge) => edge[0]),
      ['w', 'e'],
    );
    h.mode.value = 'bar';
    h.geometry.layout();
    assert.equal(h.geometry.style.value.height, '56px');
    h.mode.value = 'full';
    h.geometry.layout();
    assert.equal(h.geometry.style.value.height, 'auto');
  } finally {
    h.dispose();
  }
});
test('viewport cap remains available and resize observation is cleaned up', () => {
  const h = harness();
  h.geometry.layout();
  h.context.innerHeight = 480;
  h.listeners.get('resize')();
  assert.equal(h.geometry.style.value.maxHeight, '464px');
  h.dispose();
  assert.equal(h.observer.disconnected, true);
  assert.equal(h.listeners.size, 0);
});

test('overflowing content uses the full viewport instead of retaining a cramped position', () => {
  const h = harness();
  try {
    h.context.innerHeight = 480;
    h.element.querySelector = () => ({ scrollHeight: 517, clientHeight: 202 });
    h.geometry.layout();
    assert.equal(h.geometry.box.value.top, 8);
    assert.equal(h.geometry.box.value.height, 464);
    assert.equal(h.geometry.style.value.maxHeight, '464px');
    assert.equal(h.geometry.style.value.height, 'auto');
  } finally {
    h.dispose();
  }
});
