const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
// Linkedom omits fieldset.disabled; Vue relies on the reflected DOM property.
Object.defineProperty(window.HTMLElement.prototype, 'disabled', {
  configurable: true,
  get() {
    return this.hasAttribute('disabled');
  },
  set(value) {
    this.toggleAttribute('disabled', !!value);
  },
});
const nativeQuery = document.querySelector.bind(document);
document.querySelector = (selector) =>
  nativeQuery(
    selector
      .replaceAll('dialog:modal', 'dialog[open]')
      .replaceAll(':popover-open', '[data-popover-open]'),
  );
const vue = require('vue'),
  pinia = require('pinia'),
  ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const cache = new Map();
const empty = { setup: () => () => null };
const button = {
  props: ['label'],
  setup:
    (props, { attrs }) =>
    () =>
      vue.h('button', attrs, props.label),
};
function load(file) {
  file = path.resolve(__dirname, '../src', file);
  if (cache.has(file)) return cache.get(file);
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.vue'))
    source = compileScript(parse(source).descriptor, { id: file, inlineTemplate: true }).content;
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      document,
      window,
      HTMLElement,
      setTimeout,
      clearTimeout,
      AbortController,
      DOMException,
      require(id) {
        if (id === 'vue') return vue;
        if (id === 'pinia') return pinia;
        if (id.endsWith('.scss')) return {};
        if (id.endsWith('UiButton.vue')) return { default: button };
        if (id.endsWith('StatusSlot.vue')) return { default: empty };
        if (id.startsWith('.')) {
          const relative = path.resolve(path.dirname(file), id);
          return load(relative + (path.extname(relative) ? '' : '.ts'));
        }
        return require(id);
      },
    },
  );
  cache.set(file, loaded.exports);
  return loaded.exports;
}
const contracts = load('contracts/room.ts');
function snapshot(role = 'manager') {
  return {
    code: 'ABCDEF',
    type: 'draw',
    me: 'manager',
    host: 'host',
    phase: 'waiting',
    serverNow: 1,
    players: [
      { id: 'host', name: '房主' },
      { id: 'manager', name: '管理者' },
    ],
    permissions: { role, canManageSettings: role !== 'member', canStartGame: role !== 'member' },
    options: { seconds: 60, topics: ['food'] },
  };
}
test('settings/start capabilities require explicit role and grant, with host-only legacy fallback', () => {
  for (const name of ['canManageSettings', 'canStartGame']) {
    assert.equal(contracts[name](snapshot()), true);
    assert.equal(contracts[name](snapshot('member')), false);
    assert.equal(
      contracts[name]({ ...snapshot(), permissions: { ...snapshot().permissions, [name]: false } }),
      false,
    );
    assert.equal(
      contracts[name]({
        ...snapshot(),
        permissions: { ...snapshot().permissions, role: 'member' },
      }),
      false,
    );
    assert.equal(contracts[name]({ ...snapshot(), permissions: undefined }), false);
    assert.equal(contracts[name]({ ...snapshot(), permissions: undefined, host: true }), true);
    assert.equal(contracts[name](null), false);
  }
});
test('actual room store revokes both powers on demotion, terminal state and loss of seat', () => {
  pinia.setActivePinia(pinia.createPinia());
  const room = load('stores/room.ts').useRoomStore();
  room.seat = { code: 'ABCDEF', type: 'draw' };
  room.snapshot = snapshot();
  assert.equal(room.host, false);
  assert.equal(room.settingsManager, true);
  assert.equal(room.gameManager, true);
  room.snapshot = snapshot('member');
  assert.equal(room.settingsManager, false);
  assert.equal(room.gameManager, false);
  room.snapshot = snapshot();
  room.terminal = 'kicked';
  assert.equal(room.settingsManager, false);
  assert.equal(room.gameManager, false);
  room.terminal = null;
  room.seat = null;
  assert.equal(room.settingsManager, false);
  assert.equal(room.gameManager, false);
});
test('mounted DrawSettings enables manager edits, adopts remote settings and discards queued edits on demotion', async () => {
  const owner = pinia.createPinia();
  pinia.setActivePinia(owner);
  const room = load('stores/room.ts').useRoomStore();
  room.seat = { code: 'ABCDEF', type: 'draw' };
  room.snapshot = snapshot();
  let sent = 0;
  room.command = async () => {
    sent++;
    return true;
  };
  const host = document.createElement('div');
  document.body.append(host);
  const app = vue.createApp({
    setup: () => () =>
      vue.h(load('pages/draw/DrawSettings.vue').default, { snapshot: room.snapshot }),
  });
  app.use(owner);
  app.mount(host);
  const fieldset = () => host.querySelector('fieldset');
  assert.equal(fieldset().hasAttribute('disabled'), false);
  const seconds = (value) => host.querySelector('input[type="radio"][value="' + value + '"]');
  room.snapshot = { ...snapshot(), options: { seconds: 90, topics: ['food'] } };
  await vue.nextTick();
  assert.equal(seconds(90).checked, true);
  seconds(120).checked = true;
  seconds(120).dispatchEvent(new window.Event('change', { bubbles: true }));
  room.snapshot = snapshot('member');
  await vue.nextTick();
  assert.equal(fieldset().hasAttribute('disabled'), true);
  assert.equal(seconds(60).checked, true);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(sent, 0);
  app.unmount();
  host.remove();
});
test('#220 background control restores UI and prior inert state on Esc, button and unmount', async () => {
  for (const exit of ['escape', 'button', 'unmount']) {
    const host = document.createElement('div');
    host.innerHTML =
      '<header data-site-header></header><div class="vue-game-workspace"><nav></nav><div class="vue-game-grid"><div class="vue-room-background" tabindex="-1"></div><main></main></div></div>';
    document.body.append(host);
    const header = host.querySelector('header'),
      nav = host.querySelector('nav');
    header.inert = true;
    nav.inert = false;
    const mount = document.createElement('div');
    host.append(mount);
    const app = vue.createApp(load('components/SceneViewToggle.vue').default);
    app.mount(mount);
    mount.querySelector('button').click();
    await vue.nextTick();
    assert.equal(document.body.classList.contains('scene-ui-hidden'), true);
    assert.equal(nav.inert, true);
    if (exit === 'escape') {
      const event = new window.Event('keydown');
      event.key = 'Escape';
      document.dispatchEvent(event);
    } else if (exit === 'button') document.querySelector('.scene-view-restore button').click();
    else app.unmount();
    await vue.nextTick();
    assert.equal(document.body.classList.contains('scene-ui-hidden'), false);
    assert.equal(nav.inert, false);
    assert.equal(header.inert, true);
    if (exit !== 'unmount') app.unmount();
    host.remove();
  }
});
