const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { parseHTML } = require('linkedom'),
  vue = require('vue'),
  ts = require('typescript');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
function harness(request, { frame = 'load' } = {}) {
  const source = parseHTML(
    '<html lang="zh-Hant" data-color-scheme="dark" class="motion-reduced"><head><link rel="stylesheet" href="http://localhost/theme.css"></head><body data-visual-theme="playful"><div id="scope"><audio></audio></div><span id="after"></span></body></html>',
  );
  Object.defineProperty(source.document, 'baseURI', { value: 'http://localhost/poker/ROOM' });
  // pip is the about:blank PiP window; target is the same-origin frame inside it.
  const pip = parseHTML('<html><head></head><body></body></html>'),
    target = parseHTML('<html><head></head><body></body></html>'),
    blank = parseHTML('<html><head></head><body></body></html>');
  Object.defineProperty(target.document, 'URL', { value: 'http://localhost/media-pip-frame' });
  Object.defineProperty(blank.document, 'URL', { value: 'about:blank' });
  const stored = new Map(),
    calls = [],
    observers = [];
  Object.assign(pip.window, { closed: false, innerWidth: 420, innerHeight: 560 });
  pip.window.close = () => {
    pip.window.dispatchEvent(new pip.window.Event('pagehide'));
    pip.window.closed = true;
  };
  pip.window.focus = () => calls.push('focus');
  const create = pip.document.createElement.bind(pip.document);
  pip.document.createElement = (name) => {
    const element = create(name);
    if (name !== 'iframe') return element;
    let src = '';
    Object.defineProperty(element, 'contentDocument', {
      get: () => (frame === 'blank' ? blank.document : target.document),
    });
    Object.defineProperty(element, 'src', {
      get: () => src,
      set(value) {
        src = value;
        calls.push(['frame', value]);
        if (frame !== 'pending')
          setTimeout(() => element.dispatchEvent(new pip.window.Event('load')));
        else calls.push(() => element.dispatchEvent(new pip.window.Event('load')));
      },
    });
    return element;
  };
  delete source.window.documentPictureInPicture;
  if (request !== null)
    source.window.documentPictureInPicture = {
      requestWindow: async (options) => {
        calls.push(options);
        return request ? request(pip.window) : pip.window;
      },
    };
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/composables/document-pip.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      require: () => vue,
      window: source.window,
      document: source.document,
      HTMLLinkElement: source.window.HTMLLinkElement,
      URL,
      setTimeout,
      clearTimeout,
      localStorage: { getItem: (k) => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
      MutationObserver: class {
        constructor(fn) {
          this.fn = fn;
          observers.push(this);
        }
        observe() {}
        disconnect() {
          this.disconnected = true;
        }
      },
    },
  );
  const scope = vue.effectScope();
  let api;
  const node = source.document.getElementById('scope'),
    audio = node.firstElementChild;
  scope.run(
    () =>
      (api = loaded.exports.useDocumentPip(
        vue.shallowRef(node),
        () => calls.push('moved'),
        () => calls.push('restored'),
        () => calls.push('keydown'),
      )),
  );
  return {
    api,
    source,
    pip,
    target,
    node,
    audio,
    calls,
    stored,
    observers,
    dispose: () => scope.stop(),
  };
}
test('native PiP adopts the same mounted nodes, mirrors theme, and restores before the original sibling', async () => {
  const h = harness();
  try {
    await h.api.open();
    assert.equal(h.api.active.value, true);
    assert.equal(h.node.parentNode, h.target.document.body);
    assert.equal(h.node.firstElementChild, h.audio);
    assert.deepEqual(
      h.calls.find((c) => c[0] === 'frame'),
      ['frame', 'http://localhost/media-pip-frame'],
      'embeds get a same-origin http document instead of about:blank',
    );
    assert.equal(h.pip.document.body.querySelectorAll('iframe').length, 1);
    assert.equal(h.target.document.documentElement.getAttribute('data-color-scheme'), 'dark');
    assert.equal(h.target.document.documentElement.className, 'motion-reduced');
    assert.equal(h.target.document.head.querySelectorAll('link').length, 1);
    h.source.document.documentElement.setAttribute('data-color-scheme', 'light');
    h.observers[0].fn();
    assert.equal(h.target.document.documentElement.getAttribute('data-color-scheme'), 'light');
    h.pip.window.close();
    assert.equal(h.api.active.value, false);
    assert.equal(h.node.parentNode, h.source.document.body);
    assert.equal(h.node.nextElementSibling.id, 'after');
    assert.equal(h.calls.filter((c) => c === 'restored').length, 1);
    assert(h.observers[0].disconnected);
    assert(h.stored.size > 0);
  } finally {
    h.dispose();
  }
});
test('a cancelled in-flight request closes its late window without moving the player', async () => {
  let finish;
  const h = harness(() => new Promise((resolve) => (finish = resolve)));
  try {
    const pending = h.api.open();
    assert.equal(h.api.busy.value, true);
    await h.api.open();
    h.api.close();
    finish(h.pip.window);
    await pending;
    assert.equal(h.pip.window.closed, true);
    assert.equal(h.api.active.value, false);
    assert.equal(h.node.parentNode, h.source.document.body);
    assert.equal(h.calls.filter((c) => typeof c === 'object').length, 1);
  } finally {
    h.dispose();
  }
});
test('unsupported and rejected requests preserve the page player and give a retry/fallback explanation', async () => {
  for (const request of [
    null,
    async () => {
      throw Error('denied');
    },
  ]) {
    const h = harness(request);
    try {
      await h.api.open();
      assert.equal(h.api.active.value, false);
      assert.equal(h.node.parentNode, h.source.document.body);
      assert(h.api.message.value.length > 0);
      assert.equal(h.api.busy.value, false);
    } finally {
      h.dispose();
    }
  }
});
test('opener pagehide and scope disposal close PiP without leaving an orphan window', async () => {
  const h = harness();
  await h.api.open();
  h.source.window.dispatchEvent(new h.source.window.Event('pagehide'));
  assert.equal(h.pip.window.closed, true);
  assert.equal(h.api.active.value, false);
  h.dispose();
});
test('closing while the frame loads, or a frame without a real URL, never moves the player', async () => {
  const h = harness(undefined, { frame: 'pending' });
  try {
    const pending = h.api.open();
    await new Promise((resolve) => setImmediate(resolve));
    h.api.close();
    h.calls.find((c) => typeof c === 'function')();
    await pending;
    assert.equal(h.pip.window.closed, true);
    assert.equal(h.node.parentNode, h.source.document.body);
    assert.equal(h.calls.includes('moved'), false);
  } finally {
    h.dispose();
  }
  const blank = harness(undefined, { frame: 'blank' });
  try {
    await blank.api.open();
    assert.equal(blank.api.active.value, false);
    assert.equal(blank.pip.window.closed, true);
    assert.equal(blank.node.parentNode, blank.source.document.body);
    assert(blank.api.message.value.length > 0);
  } finally {
    blank.dispose();
  }
});
