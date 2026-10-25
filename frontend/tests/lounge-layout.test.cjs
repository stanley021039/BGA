const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  sass = require('sass'),
  { parseHTML } = require('linkedom');
const css = ['room-header.scss', 'room-fullscreen.scss', 'lounge.scss']
  .map((file) => sass.compile(path.resolve(__dirname, '../src/styles', file)).css)
  .join('\n');
function fixture({ overlay = true, integrated = true, focus = false } = {}) {
  const { document } = parseHTML(
    `<html><body data-visual-theme class="${focus ? 'vue-game-focus' : ''}"><div class="vue-game-workspace vue-room-shell has-room-space ${integrated ? 'is-header-integrated' : ''}" data-room-kind="lounge">${integrated ? '' : '<nav></nav>'}<div class="vue-room-status-row ${overlay ? 'is-overlay' : ''}"></div><div class="vue-game-grid"><aside class="vue-room-side-panel"></aside><main class="vue-game-main"><section class="vue-lounge"><div class="vue-lounge-stage"></div></section></main></div></div><style>${css}</style></body></html>`,
  );
  const flatten = (rules) => [...rules].flatMap((r) => (r.cssRules ? flatten(r.cssRules) : [r]));
  const rules = flatten(document.querySelector('style').sheet.cssRules);
  return {
    document,
    value(selector, property) {
      const node = document.querySelector(selector);
      return (
        rules
          .filter((r) => r.selectorText && node.matches(r.selectorText))
          .map((r) => r.style.getPropertyValue(property))
          .filter(Boolean)
          .at(-1) || ''
      );
    },
  };
}
for (const integrated of [true, false])
  test(`floating notices do not allocate the 48px phase track (integrated=${integrated})`, () => {
    const overlay = fixture({ integrated }),
      normal = fixture({ integrated, overlay: false });
    assert.equal(
      overlay.value('.vue-game-workspace', 'grid-template-rows'),
      integrated ? 'minmax(0, 1fr)' : 'auto minmax(0, 1fr)',
    );
    assert.equal(
      normal.value('.vue-game-workspace', 'grid-template-rows'),
      integrated ? '48px minmax(0, 1fr)' : 'auto 48px minmax(0, 1fr)',
    );
  });
test('the lounge grid sizes its panels and movement background; stage borders fit within fullscreen', () => {
  const normal = fixture(),
    focus = fixture({ focus: true });
  assert(normal.value('.vue-game-grid', 'min-block-size').includes('100dvh'));
  assert.equal(normal.value('.vue-lounge-stage', 'min-block-size'), '0');
  assert.equal(normal.value('.vue-lounge-stage', 'box-sizing'), 'border-box');
  assert.equal(focus.value('.vue-game-grid', 'min-block-size'), '0');
  assert.equal(focus.value('.vue-game-main', 'overflow'), 'hidden');
});

test('empty floating notices do not intercept panel handles; active notices remain interactive', () => {
  const f = fixture();
  const notice = f.document.createElement('div');
  notice.className = 'ui-notice-slot';
  f.document.querySelector('.vue-room-status-row').appendChild(notice);
  assert.equal(f.value('.ui-notice-slot', 'pointer-events'), 'none');
  assert.equal(f.value('.ui-notice-slot', 'visibility'), 'hidden');
  f.document.querySelector('.ui-notice-slot').setAttribute('data-visible', 'true');
  assert.equal(f.value('.ui-notice-slot', 'pointer-events'), 'auto');
  assert.notEqual(f.value('.ui-notice-slot', 'visibility'), 'hidden');
});
