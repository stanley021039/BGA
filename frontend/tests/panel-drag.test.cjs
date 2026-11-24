const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { createPanelDrag } = require('../src/services/panel-drag.js');
function fixture() {
  const listeners = new Map(),
    captures = new Set();
  let resized;
  const box = { left: 16, top: 80, width: 320, height: 220 };
  const node = {
    getBoundingClientRect: () => ({ ...box }),
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  };
  const win = {
    innerWidth: 844,
    innerHeight: 390,
    addEventListener: (n, f) => listeners.set(n, f),
    removeEventListener: (n) => listeners.delete(n),
    ResizeObserver: class {
      constructor(f) {
        resized = f;
      }
      observe() {}
      disconnect() {
        resized = null;
      }
    },
  };
  const changes = [];
  const drag = createPanelDrag(node, win, (style) => {
    changes.push(style);
    if (style.left) {
      box.left = parseFloat(style.left);
      box.top = parseFloat(style.top);
    }
  });
  const event = (x, y, kind = 'heading') => ({
    pointerId: 1,
    button: 0,
    clientX: x,
    clientY: y,
    preventDefault() {},
    target: {
      closest: (selector) =>
        selector === '.ui-panel-heading'
          ? true
          : selector === '[data-panel-drag]'
            ? kind === 'handle'
            : kind === 'button',
    },
  });
  return { drag, box, win, changes, captures, listeners, event, resize: () => resized?.() };
}
test('expanded and minimized panels drag from the header while buttons do not start a drag', () => {
  const f = fixture();
  f.drag.start(f.event(20, 90, 'button'));
  f.drag.move(f.event(100, 120));
  assert.equal(f.changes.length, 0);
  f.drag.start(f.event(20, 90));
  f.drag.move(f.event(120, 120));
  assert.equal(f.box.left, 116);
  assert.equal(f.box.top, 110);
  f.drag.end({ pointerId: 1 });
  assert.equal(f.captures.size, 0);
  f.box.height = 68;
  f.drag.start(f.event(120, 120, 'handle'));
  f.drag.move(f.event(180, 150));
  assert.equal(f.box.left, 176);
  assert.equal(f.box.top, 140);
  f.drag.end({ pointerId: 1 });
  f.box.height = 260;
  f.resize();
  assert.equal(f.box.top, 122);
  assert.equal(f.box.left, 176);
  f.drag.dispose();
  assert.equal(f.listeners.size, 0);
});
test('pointer movement and keyboard stay inside resized viewports and release capture on disposal', () => {
  const f = fixture();
  f.drag.start(f.event(20, 90));
  f.drag.move(f.event(2000, 2000));
  assert.equal(f.box.left, 516);
  assert.equal(f.box.top, 162);
  f.win.innerWidth = 390;
  f.resize();
  assert.equal(f.box.left, 62);
  f.drag.key({ key: 'ArrowLeft', shiftKey: true, preventDefault() {}, stopPropagation() {} });
  assert.equal(f.box.left, 38);
  f.drag.key({ key: 'Home', preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(f.changes.at(-1), {});
  f.drag.dispose();
  assert.equal(f.captures.size, 0);
  const n = f.changes.length;
  f.drag.move(f.event(30, 40));
  assert.equal(f.changes.length, n);
});
