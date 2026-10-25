const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
const vue = require('vue'),
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
// Linkedom has no :modal or :popover-open; tests choose what an open modal query returns.
const query = document.querySelector.bind(document);
let modal = null;
document.querySelector = (selector) =>
  selector === 'dialog:modal, :popover-open' ? modal : query(selector);
const settle = () => new Promise((resolve) => setImmediate(resolve));
function read(file) {
  return fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
}
function harness() {
  const lobby = document.createElement('div'),
    stage = document.createElement('div'),
    dialog = document.createElement('dialog');
  lobby.className = 'vue-lobby';
  stage.className = 'lobby-backdrop';
  dialog.className = 'vue-approved-lobby-expressions';
  stage.focus = () => {};
  document.body.append(lobby, stage, dialog);
  const source = compileScript(parse(read('components/SceneViewToggle.vue')).descriptor, {
    id: 'scene-view-dialog',
    inlineTemplate: true,
  }).content;
  const loaded = { exports: {} };
  const button = {
    props: ['label'],
    setup(props, { attrs }) {
      return () => vue.h('button', { ...attrs, type: 'button' }, props.label);
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
      HTMLElement,
      require(id) {
        if (id === 'vue') return vue;
        if (id.endsWith('UiButton.vue')) return { default: button };
        return {};
      },
    }),
  );
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp(loaded.exports.default);
  app.mount(host);
  return {
    lobby,
    dialog,
    hidden: () => document.body.classList.contains('scene-ui-hidden'),
    async enter() {
      host.querySelector('button').dispatchEvent(new window.Event('click'));
      await settle();
    },
    escape() {
      const event = new window.Event('keydown', { cancelable: true });
      event.key = 'Escape';
      document.dispatchEvent(event);
      return event;
    },
    dispose() {
      app.unmount();
      for (const element of [host, lobby, stage, dialog]) element.remove();
      modal = null;
    },
  };
}
function inert(element) {
  for (let node = element; node; node = node.parentElement) if (node.inert) return true;
  return false;
}
test('lobby dialogs render on body so background mode cannot inert or hide them', () => {
  const template = parse(read('pages/lobby/LobbyBackdrop.vue')).descriptor.template.ast;
  const dialogs = [];
  (function walk(node, ancestors) {
    if (node.tag === 'UiDialog') dialogs.push(ancestors);
    for (const child of node.children || []) walk(child, [...ancestors, node]);
  })(template, []);
  assert.equal(dialogs.length, 2, 'expression and chat dialogs');
  for (const ancestors of dialogs)
    assert(
      ancestors.some(
        (node) =>
          node.tag === 'Teleport' &&
          node.props.some((prop) => prop.name === 'to' && prop.value?.content === 'body'),
      ),
      'each lobby dialog is teleported to body',
    );
});
test('background mode leaves a body-level dialog usable and Escape closes it first', async () => {
  const h = harness();
  try {
    await h.enter();
    assert(h.hidden());
    assert.equal(h.lobby.inert, true, 'lobby page is inert in background mode');
    assert.equal(inert(h.dialog), false, 'the expression dialog stays interactive');
    modal = h.dialog;
    assert.equal(h.escape().defaultPrevented, false, 'Escape reaches the dialog');
    assert(h.hidden(), 'background mode stays while the dialog is open');
    modal = null;
    const handled = new window.Event('keydown', { cancelable: true });
    handled.key = 'Escape';
    handled.preventDefault();
    document.dispatchEvent(handled);
    assert(h.hidden(), 'Escape already handled elsewhere does not restore the UI');
    assert(h.escape().defaultPrevented);
    await settle();
    assert.equal(h.hidden(), false);
    assert.equal(!!h.lobby.inert, false, 'leaving background mode restores interaction');
  } finally {
    h.dispose();
  }
});
