const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  sass = require('sass'),
  { parseHTML } = require('linkedom');
const css = ['room-space.scss', 'room-fullscreen.scss']
  .map((file) => sass.compile(path.resolve(__dirname, '../src/styles', file)).css)
  .join('\n');
function fixture(kind, focus) {
  const { document } = parseHTML(
    `<html><body data-visual-theme class="${focus}"><div class="vue-game-workspace vue-room-shell has-room-space"><nav></nav><div class="vue-game-grid"><div class="vue-room-background"></div><aside class="vue-room-side-panel" data-panel-side="left" data-panel-open="true"><div class="vue-room-panel-content"><section><header></header><ul></ul></section></div><div class="vue-room-panel-handle-slot"></div></aside><main class="vue-game-main ${kind === 'draw' ? 'vue-draw-main' : ''}"></main><aside class="vue-room-side-panel" data-panel-side="right" data-panel-open="true"><div class="vue-room-panel-content"><section><header></header><ol></ol></section></div><div class="vue-room-panel-handle-slot"></div></aside></div></div><style>${css}</style></body></html>`,
  );
  function flatten(rules) {
    return [...rules].flatMap((r) => (r.cssRules ? flatten(r.cssRules) : [r]));
  }
  const rules = flatten(document.querySelector('style').sheet.cssRules);
  return {
    document,
    value(node, property) {
      return (
        rules
          .filter(
            (r) =>
              r.selectorText &&
              !/:focus-visible/.test(r.selectorText) &&
              node.matches(r.selectorText),
          )
          .map((r) => r.style.getPropertyValue(property))
          .filter(Boolean)
          .at(-1) || ''
      );
    },
  };
}
for (const kind of ['game', 'draw'])
  test(
    kind + ' fullscreen occupies viewport and hides background/panels without hiding stage',
    () => {
      const f = fixture(kind, 'vue-' + kind + '-focus'),
        q = (s) => f.document.querySelector(s);
      assert.equal(f.value(q('.vue-game-grid'), 'position'), 'fixed');
      assert.equal(f.value(q('.vue-game-grid'), 'height'), '100dvh');
      assert.equal(f.value(q('.vue-room-background'), 'display'), 'none');
      for (const panel of f.document.querySelectorAll('.vue-room-side-panel'))
        assert.equal(f.value(panel, 'display'), 'none');
      assert.notEqual(f.value(q('main'), 'display'), 'none');
      // Game sheets (Quacks) may win the column template; the stage must still span it.
      for (const property of ['grid-column', 'grid-row'])
        assert.equal(f.value(q('main'), property).replace(/\s/g, ''), '1/-1');
    },
  );
test('panel controls reserve header space without taking a column from player/chat content', () => {
  const f = fixture('game', '');
  for (const side of ['left', 'right']) {
    const panel = f.document.querySelector('[data-panel-side=' + side + ']'),
      content = panel.querySelector('.vue-room-panel-content'),
      handle = panel.querySelector('.vue-room-panel-handle-slot');
    assert.equal(f.value(content, 'padding-inline-start'), '');
    assert.equal(f.value(content, 'padding-inline-end'), '');
    assert(!f.value(handle, 'inset-block-start').includes('50%'), 'handle belongs at the top');
    assert.equal(f.value(handle, 'height'), '44px');
    assert(
      f
        .value(
          panel.querySelector('header'),
          side === 'left' ? 'padding-inline-start' : 'padding-inline-end',
        )
        .includes('44px'),
    );
  }
});
test('closed mobile drawers keep their handle off the site header', () => {
  const { document } = parseHTML(
    `<html><body data-visual-theme><aside class="vue-room-side-panel" data-panel-side="left" data-panel-open="false"><div class="vue-room-panel-handle-slot"></div></aside><style>${css}</style></body></html>`,
  );
  const handle = document.querySelector('.vue-room-panel-handle-slot');
  const mobile = [...document.querySelector('style').sheet.cssRules]
    .filter((r) => r.media && /max-width:\s*1180px/.test(r.conditionText || r.media.mediaText))
    .flatMap((r) => [...r.cssRules])
    .filter((r) => r.selectorText && handle.matches(r.selectorText))
    .map((r) => r.style.getPropertyValue('inset-block-start'))
    .filter(Boolean);
  assert.equal(mobile.at(-1)?.replace(/\s/g, ''), 'calc(50%-22px)');
});
test('fullscreen rules do not change the market layout', () => {
  const f = fixture('game', 'vue-market-focus');
  const grid = f.document.querySelector('.vue-game-grid');
  assert.notEqual(f.value(grid, 'position'), 'fixed');
});
