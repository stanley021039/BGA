const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const k of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[k] = k === 'window' ? window : window[k];
const vue = require('vue'),
  ts = require('typescript'),
  { parse, compileScript } = require('vue/compiler-sfc');
class Pointer extends window.Event {
  constructor(type, pointerType) {
    super(type);
    this.pointerType = pointerType;
  }
}
function fixture(showHelp = true) {
  const calls = [];
  const Popover = vue.defineComponent({
    props: ['autofocus'],
    emits: ['closed'],
    setup(props, { expose, emit, slots }) {
      const visible = vue.ref(false);
      expose({
        open: async (source) => {
          visible.value = true;
          calls.push({ focus: props.autofocus, source });
        },
        close: () => {
          visible.value = false;
          emit('closed');
        },
      });
      return () => (visible.value ? vue.h('aside', slots.default?.()) : null);
    },
  });
  const Button = vue.defineComponent({
    props: ['label'],
    setup(props, { attrs }) {
      return () => vue.h('button', attrs, props.label);
    },
  });
  const raw = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/UiHoverInfo.vue'), 'utf8'))
      .descriptor,
    { id: 'hover-test', inlineTemplate: true },
  ).content;
  const m = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(raw, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: m,
      exports: m.exports,
      require: (id) =>
        id === 'vue' ? vue : { default: id.includes('UiPopover') ? Popover : Button },
      setTimeout,
      clearTimeout,
      document,
      window,
      Element: window.Element,
      HTMLElement: window.HTMLElement,
      PointerEvent: Pointer,
    },
  );
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({
    render: () =>
      vue.h(
        m.exports.default,
        { title: '中文能力', disabled: true, showHelp },
        { default: () => vue.h('span', '卡面'), info: () => vue.h('p', '完整中文能力') },
      ),
  });
  app.mount(host);
  return {
    host,
    calls,
    dispose: () => {
      app.unmount();
      host.remove();
    },
  };
}
test('hover preview preserves focus, remains available for disabled cards, and Escape clears it', async () => {
  const f = fixture();
  try {
    const root = f.host.firstElementChild;
    assert.equal(root.getAttribute('tabindex'), '0');
    root.dispatchEvent(new Pointer('pointerenter', 'mouse'));
    await vue.nextTick();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].focus, false);
    assert.match(f.host.textContent, /完整中文能力/);
    const escape = new window.Event('keydown');
    escape.key = 'Escape';
    document.dispatchEvent(escape);
    await vue.nextTick();
    assert.doesNotMatch(f.host.textContent, /完整中文能力/);
    root.dispatchEvent(new Pointer('pointerenter', 'mouse'));
    await vue.nextTick();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(f.calls.length, 1, 'closing does not immediately reopen under the pointer');
  } finally {
    f.dispose();
  }
});
test('touch enter does not preview or select, while the separate help action opens a pinned description', async () => {
  const f = fixture();
  try {
    f.host.firstElementChild.dispatchEvent(new Pointer('pointerenter', 'touch'));
    await vue.nextTick();
    assert.equal(f.calls.length, 0);
    const help = f.host.querySelector('button');
    help.dispatchEvent(new window.Event('focusin', { bubbles: true }));
    await vue.nextTick();
    assert.equal(f.calls.length, 0, 'touch-induced help focus must not obscure its pending click');
    help.click();
    await vue.nextTick();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(f.calls[0].focus, true);
    assert.equal(f.calls[0].source, help);
    f.host.firstElementChild.dispatchEvent(new Pointer('pointerleave', 'touch'));
    await new Promise((r) => setTimeout(r, 220));
    assert.match(f.host.textContent, /完整中文能力/);
  } finally {
    f.dispose();
  }
});
test('card-only preview has no controls and closes immediately when the pointer leaves the card', async () => {
  const f = fixture(false);
  try {
    const root = f.host.firstElementChild;
    root.dispatchEvent(new Pointer('pointerenter', 'mouse'));
    await vue.nextTick();
    await new Promise((r) => setTimeout(r, 0));
    assert.match(f.host.textContent, /完整中文能力/);
    assert.equal(f.host.querySelector('button'), null);
    root.dispatchEvent(new Pointer('pointerleave', 'mouse'));
    await vue.nextTick();
    assert.doesNotMatch(f.host.textContent, /完整中文能力/);
  } finally {
    f.dispose();
  }
});
test('a quick pass across a card cannot open a stale preview after leaving', async () => {
  const f = fixture(false);
  try {
    const root = f.host.firstElementChild;
    root.dispatchEvent(new Pointer('pointerenter', 'mouse'));
    root.dispatchEvent(new Pointer('pointerleave', 'mouse'));
    await vue.nextTick();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(f.calls.length, 0);
    assert.doesNotMatch(f.host.textContent, /完整中文能力/);
  } finally {
    f.dispose();
  }
});
