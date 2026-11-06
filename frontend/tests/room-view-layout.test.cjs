const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  sass = require('sass'),
  { parseHTML } = require('linkedom');
const css = ['room-space.scss', 'room-fullscreen.scss']
  .map((file) => sass.compile(path.resolve(__dirname, '../src/styles', file)).css)
  .join('\n');
function fixture(kind, focus, pageCss = '') {
  const { document } = parseHTML(
    `<html><body data-visual-theme data-game-kind="${kind}" class="${focus}"><div class="vue-game-workspace vue-room-shell has-room-space"><nav></nav><div class="vue-game-grid"><div class="vue-room-background"></div><aside class="vue-room-side-panel" data-panel-side="left" data-panel-open="true"><div class="vue-room-panel-content"><section><header></header><ul></ul></section></div><div class="vue-room-panel-handle-slot"></div></aside><main class="vue-game-main ${kind === 'draw' ? 'vue-draw-main' : ''}"></main><aside class="vue-room-side-panel" data-panel-side="right" data-panel-open="true"><div class="vue-room-panel-content"><section><header></header><ol></ol></section></div><div class="vue-room-panel-handle-slot"></div></aside></div></div><style>${pageCss}${css}</style></body></html>`,
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
test('voice party documents give the desktop room grid a bounded viewport', () => {
  const pageCss = sass.compile(path.resolve(__dirname, '../src/styles/party-338.scss')).css;
  for (const kind of ['brainwave', 'drama-bar']) {
    const html = fs.readFileSync(path.resolve(__dirname, '../pages', kind, 'index.html'), 'utf8');
    const page = parseHTML(html).document;
    const f = fixture(kind, page.body.className, pageCss);
    const shell = f.document.createElement('div');
    shell.className = 'vue-game-document';
    const app = f.document.createElement('div');
    app.id = 'voice-party-app';
    shell.append(app);
    app.append(f.document.querySelector('.vue-game-workspace'));
    f.document.body.append(shell);

    assert.equal(f.value(shell, 'block-size'), '100dvh', kind);
    assert.equal(f.value(app, 'min-block-size'), '0', kind);
    assert.equal(f.value(app.firstElementChild, 'block-size'), '100%', kind);
  }
});
test('Oracle keeps its drawing stage in a main box above the interactive room background', () => {
  const drawCss = sass.compile(path.resolve(__dirname, '../src/styles/draw-page.scss')).css;
  const f = fixture('draw', '', drawCss);
  const main = f.document.querySelector('main');
  assert.equal(f.value(main, 'display'), 'contents');
  main.classList.add('vue-draw-oracle-main');
  assert.notEqual(f.value(main, 'display'), 'contents');
  assert.equal(f.value(main, 'position'), 'relative');
  assert.equal(f.value(main, 'z-index'), '1');
});

test('desktop artists can draw across the frame while guessers see the entire canvas', () => {
  const drawCss = sass.compile(path.resolve(__dirname, '../src/styles/draw-page.scss')).css;
  const f = fixture('draw', '', drawCss);
  const main = f.document.querySelector('main');
  main.innerHTML =
    '<section class="vue-drawing-surface"><div class="vue-drawing-frame"><canvas></canvas></div></section>';
  const canvas = main.querySelector('canvas');
  const frame = canvas.parentElement;
  assert.equal(f.value(canvas, 'inline-size').replace(/\s/g, ''), 'min(100cqw,200cqh)');
  main.firstElementChild.classList.add('is-artist');
  assert.equal(f.value(canvas, 'inline-size'), '100%');
  assert.equal(f.value(canvas, 'aspect-ratio'), '2');
  assert.equal(f.value(canvas, 'max-block-size'), 'none');
  assert.equal(f.value(frame, 'overflow-y'), 'auto');
});

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
