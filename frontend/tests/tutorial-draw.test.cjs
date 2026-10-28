'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  { randomUUID } = require('node:crypto');
const { parseHTML } = require('linkedom'),
  { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');
function fixture() {
  let resolve, reject;
  const calls = [],
    accepted = [];
  const room = vue.reactive({
    scope: 1,
    accept: (value) => {
      accepted.push(value);
      return true;
    },
    request: async (route, body) => {
      calls.push({ route, body });
      return new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      });
    },
  });
  const file = path.resolve(__dirname, '../src/pages/tutorial/TutorialDraw.vue');
  const source = compileScript(
    parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor,
    { id: 'tutorial-test', inlineTemplate: true },
  ).content;
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      crypto: { randomUUID },
      document,
      require(id) {
        if (id === 'vue') return vue;
        if (id.endsWith('/room')) return { useRoomStore: () => room };
        if (id.endsWith('/validation')) return { record: (v) => v };
        if (id.endsWith('/drawing-palette')) return { drawingColors: [['#111111', 'black']] };
        if (id.endsWith('UiPanel.vue'))
          return {
            default: {
              setup(_, ctx) {
                return () => vue.h('section', ctx.slots.default?.());
              },
            },
          };
        if (id.endsWith('UiButton.vue'))
          return {
            default: {
              props: ['label'],
              setup(props, ctx) {
                return () => vue.h('button', { onClick: () => ctx.emit('click') }, props.label);
              },
            },
          };
        return { default: { render: () => null } };
      },
    },
  );
  const snapshot = vue.ref({
      phase: 'drawing',
      presenterId: 'p',
      me: 'p',
      round: 1,
      canvasEpoch: 'epoch1',
      candidates: [],
      question: null,
      result: null,
    }),
    canvas = vue.ref({ strokes: [] });
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({
    render: () => vue.h(module.exports.default, { snapshot: snapshot.value, canvas: canvas.value }),
  });
  app.mount(host);
  const svg = host.querySelector('svg');
  svg.getBoundingClientRect = () => ({ x: 0, y: 0, width: 512, height: 256 });
  svg.setPointerCapture = () => {};
  const event = (name, extra = {}) => {
    const e = new window.Event(name, { bubbles: true, cancelable: true });
    Object.assign(e, extra);
    svg.dispatchEvent(e);
  };
  return {
    host,
    svg,
    snapshot,
    canvas,
    calls,
    accepted,
    event,
    resolve: () => resolve?.({}),
    reject: () => reject?.(Error('temporary')),
    close: () => {
      app.unmount();
      host.remove();
    },
  };
}
const flush = async () => {
  await Promise.resolve();
  await vue.nextTick();
  await Promise.resolve();
  await vue.nextTick();
};
test('tutorial strokes stay visible while held and awaiting ACK, then use canonical strokes without a blank frame', async () => {
  const f = fixture();
  try {
    f.event('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    f.event('pointermove', { pointerId: 1, clientX: 100, clientY: 50 });
    await flush();
    assert.ok(f.svg.querySelector('polyline').getAttribute('points'));
    f.event('pointerup', { pointerId: 1 });
    await flush();
    assert.equal(f.calls.length, 1);
    assert.ok(
      f.svg.querySelector('polyline').getAttribute('points'),
      'pending local line stays visible',
    );
    f.canvas.value = { strokes: [{ ...f.calls[0].body }] };
    f.resolve();
    await flush();
    assert.ok(f.svg.querySelector('polyline').getAttribute('points'));
    assert.equal(f.svg.querySelectorAll('polyline')[1].getAttribute('points'), '');
  } finally {
    f.close();
  }
});
test('failed stroke keeps its geometry and retries with the same batch identity', async () => {
  const f = fixture();
  try {
    f.event('pointerdown', { pointerId: 2, clientX: 20, clientY: 20 });
    f.event('pointermove', { pointerId: 2, clientX: 60, clientY: 60 });
    f.event('pointerup', { pointerId: 2 });
    f.reject();
    await flush();
    assert.ok(f.svg.querySelector('polyline').getAttribute('points'));
    f.host.querySelector('button').click();
    await flush();
    assert.equal(f.calls.length, 2);
    assert.equal(f.calls[0].body.batchId, f.calls[1].body.batchId);
    f.resolve();
    await flush();
  } finally {
    f.close();
  }
});
test('keyboard drawing works, and switching the teaching scope discards an old pending draft', async () => {
  const f = fixture();
  try {
    f.event('keydown', { key: ' ' });
    f.event('keydown', { key: 'ArrowRight' });
    f.event('keydown', { key: ' ' });
    await flush();
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].body.points.length, 2);
    f.snapshot.value = { ...f.snapshot.value, canvasEpoch: 'epoch2' };
    await flush();
    assert.equal(f.svg.querySelector('polyline').getAttribute('points'), '');
    f.resolve();
    await flush();
    assert.equal(f.svg.querySelector('polyline').getAttribute('points'), '');
    assert.equal(f.accepted.length, 0, 'old epoch reply must not be adopted');
  } finally {
    f.close();
  }
});
