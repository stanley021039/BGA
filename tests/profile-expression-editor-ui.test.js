const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const source = fs.readFileSync(
  path.join(__dirname, '../public/profile-expression-editor.js'),
  'utf8',
);
class Node {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.nodes = new Map();
    this.dataset = {};
    this.files = [];
    this.value = '';
    this.open = false;
    this.hidden = false;
    this.handlers = {};
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  after(node) {
    this.next = node;
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  querySelector(s) {
    const key = s.match(/^\[data-([a-z]+)\]$/)?.[1];
    if (key) {
      const child = this.children.find((c) => key in c.dataset);
      if (child) return child;
    }
    if (!this.nodes.has(s)) this.nodes.set(s, new Node(s));
    return this.nodes.get(s);
  }
  querySelectorAll() {
    return [...this.nodes.values(), ...this.children];
  }
  addEventListener(type, fn) {
    this.handlers[type] = fn;
  }
  reset() {
    for (const n of this.nodes.values()) {
      n.value = '';
      n.files = [];
    }
  }
  close() {
    this.open = false;
  }
}
function fixture({ post, imagePayload = async () => ({ base64: 'png' }) } = {}) {
  const body = new Node('body'),
    gallery = new Node(),
    requests = [],
    removed = [],
    messages = [],
    a = {
      id: 'user:11111111-1111-4111-8111-111111111111',
      owned: true,
      expressions: { neutral: '/neutral', happy: '/happy' },
      labels: { neutral: '平常', happy: '開心' },
    };
  let character = a,
    appearance;
  const document = { body, createElement: (tag) => new Node(tag), querySelector: () => gallery },
    window = {
      GameUI: {
        decorateButton(b, icon, options) {
          b.label = options.label;
        },
        openDialog(d) {
          d.open = true;
        },
      },
    };
  vm.runInNewContext(source, {
    window,
    document,
    Option: class {
      constructor(label, value) {
        this.label = label;
        this.value = value;
      }
    },
  });
  const api = {
    character: () => character,
    appearance: () => appearance,
    artworks: () => [],
    label: (c, e) => c.labels[e],
    json: async (url, options) => {
      requests.push({ url, options });
      if (post) return post(url, options);
      return { ok: true };
    },
    imagePayload,
    removed: (target) => removed.push(target),
    refreshGallery: async () => {},
    message: (text) => messages.push(text),
  };
  window.ProfileExpressionEditor.mount(api);
  const tools = gallery.next,
    [edit, remove] = body.children;
  const click = (key) =>
    tools.querySelector('[data-' + key + ']').onclick({ currentTarget: tools });
  return {
    tools,
    edit,
    remove,
    requests,
    removed,
    messages,
    editor: window.ProfileExpressionEditor,
    click,
    select(c = a, e = 'happy') {
      character = c;
      appearance = { characterId: c.id, expression: e };
      window.ProfileExpressionEditor.refresh();
    },
    save: () => edit.querySelector('form').onsubmit({ preventDefault() {} }),
    destroy: () => remove.querySelector('[data-confirm]').onclick(),
  };
}
test('expression tools initialize before profile load and remain owner-only; neutral cannot be deleted', () => {
  const f = fixture();
  assert.equal(f.tools.hidden, true);
  f.select();
  assert.equal(f.tools.hidden, false);
  assert.equal(f.tools.querySelector('[data-remove]').hidden, false);
  f.select(undefined, 'neutral');
  assert.equal(f.tools.querySelector('[data-remove]').hidden, true);
  f.click('remove');
  assert.equal(f.remove.open, false);
  f.select(
    {
      id: 'user:friend',
      owned: false,
      expressions: { neutral: '/friend' },
      labels: { neutral: '平常' },
    },
    'neutral',
  );
  assert.equal(f.tools.hidden, true);
  f.click('edit');
  assert.equal(f.edit.open, false);
});
test('edit cancellation makes no request; dirty tracking and failed save allow retry', async () => {
  let failure = true;
  const f = fixture({
    post: async () => {
      if (failure) throw Error('儲存失敗');
    },
  });
  f.select();
  f.click('edit');
  f.edit.querySelector('[name="name"]').value = '新版';
  assert.equal(f.editor.hasUnsavedChanges(), true);
  f.edit.querySelector('[data-cancel]').onclick();
  assert.equal(f.requests.length, 0);
  assert.equal(f.editor.hasUnsavedChanges(), false);
  f.click('edit');
  f.edit.querySelector('[name="name"]').value = '新版';
  await f.save();
  assert.equal(f.edit.open, true);
  assert.equal(f.edit.querySelector('.upload-status').textContent, '儲存失敗');
  assert.equal(f.editor.hasUnsavedChanges(), true);
  failure = false;
  await f.save();
  assert.equal(f.edit.open, false);
  assert.equal(f.editor.hasUnsavedChanges(), false);
  assert.equal(JSON.parse(f.requests[1].options.body).name, '新版');
});
test('pending image replacement captures original target, rejects duplicate submits, and blocks dismissal', async () => {
  let resolve;
  const wait = new Promise((ok) => (resolve = ok)),
    f = fixture({ imagePayload: () => wait });
  f.select();
  f.click('edit');
  f.edit.querySelector('[name="image"]').files = [{ name: 'new.png' }];
  f.edit.querySelector('[name="name"]').value = '新版';
  const saving = f.save();
  let prevented = false;
  f.edit.handlers.cancel({
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  f.edit.querySelector('[data-cancel]').onclick();
  assert.equal(f.edit.open, true);
  await f.save();
  f.select(
    {
      id: 'user:22222222-2222-4222-8222-222222222222',
      owned: true,
      expressions: { neutral: '/second' },
      labels: { neutral: '平常' },
    },
    'neutral',
  );
  resolve({ base64: 'new-image' });
  await saving;
  assert.equal(f.requests.length, 1);
  assert.match(f.requests[0].url, /11111111.*happy\/edit$/);
  assert.equal(JSON.parse(f.requests[0].options.body).base64, 'new-image');
});
test('delete requires a second confirmation; failures unlock retry and success cleans captured target only', async () => {
  let fail = true,
    resolve;
  const wait = new Promise((ok) => (resolve = ok)),
    f = fixture({
      post: async () => {
        if (fail) throw Error('刪除失敗');
        return wait;
      },
    });
  f.select();
  f.click('remove');
  assert.equal(f.requests.length, 0);
  f.remove.querySelector('[data-cancel]').onclick();
  assert.equal(f.requests.length, 0);
  f.click('remove');
  await f.destroy();
  assert.equal(f.remove.open, true);
  assert.equal(f.remove.querySelector('[role="status"]').textContent, '刪除失敗');
  fail = false;
  const saving = f.destroy();
  await f.destroy();
  f.select(undefined, 'neutral');
  resolve({ ok: true });
  await saving;
  assert.equal(f.requests.length, 2);
  assert.equal(f.removed.length, 1);
  assert.equal(f.removed[0].expression, 'happy');
  assert.equal(f.remove.open, false);
  assert.equal(f.editor.hasUnsavedChanges(), false);
});
