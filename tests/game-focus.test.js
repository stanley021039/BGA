'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs');
function fixture(native = false, withHeader = false) {
  const events = {},
    classes = () => {
      const s = new Set();
      return {
        add: (k) => s.add(k),
        remove: (k) => s.delete(k),
        contains: (k) => s.has(k),
        toggle(k, on) {
          if (on) s.add(k);
          else s.delete(k);
        },
      };
    };
  const element = () => ({
    tagName: 'DIV',
    children: [],
    classList: classes(),
    dataset: {},
    attrs: {},
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    removeAttribute(k) {
      delete this.attrs[k];
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    hasAttribute(k) {
      return Object.hasOwn(this.attrs, k);
    },
    focus() {
      doc.activeElement = this;
    },
    isConnected: true,
    append(n) {
      if (n.parentElement)
        n.parentElement.children = n.parentElement.children.filter((x) => x !== n);
      this.children.push(n);
      n.parentElement = this;
    },
  });
  const body = element(),
    shell = element(),
    game = element(),
    header = element(),
    side = element(),
    doc = {
      body,
      documentElement: element(),
      activeElement: header,
      fullscreenElement: null,
      createElement: element,
      querySelector: (s) =>
        s === '#game' ? game : withHeader && s.includes('[data-site-header]') ? header : null,
      addEventListener: (k, f) => (events[k] = f),
      exitFullscreen: async () => {
        doc.fullscreenElement = null;
        events.fullscreenchange?.();
      },
    };
  body.dataset = { gameFocus: '#game' };
  body.append(shell);
  shell.append(header);
  shell.append(game);
  shell.append(side);
  let mutation;
  const window = {
    scrollX: 5,
    scrollY: 70,
    scrollTo: (x, y) => {
      window.scrollX = x;
      window.scrollY = y;
    },
    addEventListener: (k, f) => (events[k] = f),
  };
  if (native)
    doc.documentElement.requestFullscreen = async () => {
      doc.fullscreenElement = doc.documentElement;
      events.fullscreenchange?.();
    };
  vm.runInNewContext(fs.readFileSync('public/shared/game-focus.js', 'utf8'), {
    window,
    document: doc,
    MutationObserver: class {
      constructor(fn) {
        mutation = fn;
      }
      observe() {}
    },
  });
  return {
    doc,
    window,
    game,
    shell,
    header,
    side,
    toggle: withHeader ? header.children[0] : body.children[1],
    events,
    mutation,
    element,
  };
}
test('focus hides peripheral UI, retains game DOM, click restores exact focus and scroll', async () => {
  const f = fixture();
  await f.toggle.onclick();
  assert.equal(f.window.GameFocus.isActive(), true);
  assert.ok(f.shell.hasAttribute('data-game-focus-container'));
  assert.ok(f.header.classList.contains('game-focus-excluded'));
  assert.ok(f.side.classList.contains('game-focus-excluded'));
  assert.equal(f.game.classList.contains('game-focus-excluded'), false);
  assert.equal(f.toggle.classList.contains('game-focus-excluded'), false);
  assert.equal(f.toggle.attrs['aria-pressed'], 'true');
  const extra = f.element();
  f.shell.append(extra);
  f.mutation();
  assert.ok(extra.classList.contains('game-focus-excluded'));
  await f.toggle.onclick();
  assert.equal(f.window.GameFocus.isActive(), false);
  assert.equal(f.header.classList.contains('game-focus-excluded'), false);
  assert.equal(extra.classList.contains('game-focus-excluded'), false);
  assert.equal(f.shell.hasAttribute('data-game-focus-container'), false);
  assert.equal(f.window.scrollY, 70);
  assert.equal(f.doc.activeElement, f.header);
});
test('native fullscreen exit and fallback Escape restore focused mode', async () => {
  for (const native of [false, true]) {
    const f = fixture(native);
    await f.toggle.onclick();
    if (native) {
      assert.equal(f.doc.fullscreenElement, f.doc.documentElement);
      f.doc.fullscreenElement = null;
      f.events.fullscreenchange();
    } else f.events.keydown({ key: 'Escape', preventDefault() {} });
    assert.equal(f.window.GameFocus.isActive(), false);
    assert.equal(f.toggle.attrs['aria-pressed'], 'false');
  }
});
test('all twelve games opt into the shared focus contract, non-games do not', () => {
  const catalog = fs.readFileSync('public/index.html', 'utf8');
  const games = [
    ...new Set(
      [...catalog.matchAll(/data-game="([^"]+)"/g)].map((m) =>
        m[1] === 'thunder' ? 'race' : m[1],
      ),
    ),
    'market',
  ];
  assert.ok(games.length >= 11);
  for (const game of games) {
    const html = fs.readFileSync('public/' + game + '.html', 'utf8');
    assert.match(html, /<body\s+data-game-focus="[^"]+"/);
    assert.match(html, /href="\/shared\/ui-primitives.css"/);
    assert.equal((html.match(/src="\/shared\/game-focus.js\?v=2.3.0"/g) || []).length, 1);
    assert.match(html, /href="\/shared\/game-focus.css\?v=2.3.0"/);
  }
  for (const p of ['login', 'settings', 'admin', 'index'])
    assert.doesNotMatch(fs.readFileSync('public/' + p + '.html', 'utf8'), /data-game-focus=/);
});

test('game overlays and necessary dialogs remain visible in focus while unrelated UI hides', async () => {
  const f = fixture(),
    overlay = f.element(),
    dialog = f.element();
  overlay.setAttribute('data-game-focus-overlay', '');
  dialog.tagName = 'DIALOG';
  f.doc.body.append(overlay);
  f.doc.body.append(dialog);
  await f.toggle.onclick();
  assert.equal(overlay.classList.contains('game-focus-excluded'), false);
  assert.equal(dialog.classList.contains('game-focus-excluded'), false);
  assert.ok(f.header.classList.contains('game-focus-excluded'));
});

test('header focus control remains available while its header is hidden and returns after Escape', async () => {
  const f = fixture(false, true),
    toggle = f.toggle;
  assert.equal(toggle.parentElement, f.header);
  assert.ok(toggle.classList.contains('game-focus-in-header'));
  await toggle.onclick();
  assert.equal(toggle.parentElement, f.doc.body);
  assert.ok(f.header.classList.contains('game-focus-excluded'));
  assert.equal(toggle.classList.contains('game-focus-excluded'), false);
  f.events.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(toggle.parentElement, f.header);
  assert.equal(f.window.GameFocus.isActive(), false);
  await toggle.onclick();
  await toggle.onclick();
  assert.equal(toggle.parentElement, f.header);
  assert.equal(f.doc.activeElement, f.header);
});
