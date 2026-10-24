const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
// Linkedom does not implement the browser :popover-open selector.
const querySelector = document.querySelector.bind(document);
document.querySelector = (selector) =>
  querySelector(selector.replaceAll(':popover-open', '[data-popover-open]'));
const vue = require('vue'),
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
function harness(initial = {}) {
  let sent = 0;
  const chat = vue.reactive({
    visible: true,
    enabled: true,
    viewerId: 'player',
    pending: false,
    status: '',
    loading: false,
    messages: [{ id: 'm1', name: '朋友', message: '聊天室測試', at: Date.now() }],
    unread: 0,
    draft: '',
    show(value) {
      this.visible = value;
    },
    compose(value) {
      this.draft = value;
      return true;
    },
    async send() {
      sent++;
    },
    poll() {},
  });
  const source = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/RoomChat.vue'), 'utf8'))
      .descriptor,
    { id: 'room-chat-visibility', inlineTemplate: true },
  ).content;
  const loaded = { exports: {} };
  const button = {
    props: ['label', 'type'],
    setup(props, { attrs }) {
      return () => vue.h('button', { ...attrs, type: props.type || 'button' }, props.label);
    },
  };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module: loaded,
      exports: loaded.exports,
      document,
      window,
      setInterval: () => 1,
      clearInterval() {},
      require(id) {
        if (id === 'vue') return vue;
        if (id.includes('stores/chat')) return { useChatStore: () => chat };
        if (id.includes('stores/reactions'))
          return {
            useReactionsStore: () => vue.reactive({ pending: false, message: '', failed: false }),
          };
        if (id.includes('stores/room'))
          return {
            useRoomStore: () =>
              vue.reactive({
                type: 'draw',
                snapshot: { phase: 'waiting' },
                connected: true,
                scope: 1,
                clockOffset: 0,
              }),
          };
        return {
          default: id.endsWith('UiButton.vue')
            ? button
            : {
                setup() {
                  return () => null;
                },
              },
        };
      },
    }),
  );
  const props = vue.reactive({ ...initial }),
    host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({ render: () => vue.h(loaded.exports.default, { ...props }) });
  app.mount(host);
  return {
    chat,
    props,
    host,
    get sent() {
      return sent;
    },
    content: () => host.querySelector('.vue-room-chat-content'),
    dispose() {
      app.unmount();
      host.remove();
    },
  };
}
test('inline draw chat renders messages and composer when panelVisible is omitted', async () => {
  const h = harness();
  try {
    assert.equal(h.chat.visible, true);
    assert.notEqual(h.content().style.display, 'none');
    assert.match(h.content().textContent, /聊天室測試/);
    assert.ok(h.host.querySelector('input[placeholder="輸入彈幕或閒聊…"]'));
    h.host
      .querySelector('form')
      .dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await vue.nextTick();
    assert.equal(h.sent, 1);
  } finally {
    h.dispose();
  }
});
test('controlled panel visibility respects false, true, and fallback to inline', async () => {
  const h = harness({ panelVisible: false });
  try {
    assert.equal(h.chat.visible, false);
    assert.equal(h.content().style.display, 'none');
    h.props.panelVisible = true;
    await vue.nextTick();
    assert.equal(h.chat.visible, true);
    assert.notEqual(h.content().style.display, 'none');
    h.props.panelVisible = false;
    await vue.nextTick();
    assert.equal(h.chat.visible, false);
    h.props.panelVisible = undefined;
    await vue.nextTick();
    assert.equal(h.chat.visible, true);
  } finally {
    h.dispose();
  }
});
test('toggle header remains collapsed by default and can expand', async () => {
  const h = harness({ inline: false });
  try {
    assert.equal(h.chat.visible, false);
    h.host.querySelector('button').dispatchEvent(new window.Event('click', { bubbles: true }));
    await vue.nextTick();
    assert.equal(h.chat.visible, true);
  } finally {
    h.dispose();
  }
});
