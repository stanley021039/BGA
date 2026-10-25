const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const sass = require('sass');
const { parseHTML } = require('linkedom');

const css = sass.compile(path.resolve(__dirname, '../src/styles/room-surfaces.scss')).css;

test('shared Vue accessibility descriptions remain available without legacy primitive CSS', () => {
  const shared = sass.compile(path.resolve(__dirname, '../src/styles/ui-components.scss')).css;
  const { document } = parseHTML(
    `<html><body><dialog class="vue-room-media"><span class="ui-sr-only" id="move">拖曳頂端移動</span></dialog><style>${shared}</style></body></html>`,
  );
  const hint = document.getElementById('move');
  const rules = [...document.querySelector('style').sheet.cssRules];
  const rule = rules.find((item) => item.selectorText === '.ui-sr-only');
  assert.ok(rule && hint.matches(rule.selectorText));
  assert.equal(rule.style.getPropertyValue('position'), 'absolute');
  assert.equal(rule.style.getPropertyValue('inline-size'), '1px');
  assert.equal(rule.style.getPropertyValue('block-size'), '1px');
  assert.equal(rule.style.getPropertyValue('overflow'), 'hidden');
  assert.match(rule.style.getPropertyValue('clip'), /rect\(0, 0, 0, 0\)/);
  assert.notEqual(rule.style.getPropertyValue('display'), 'none');
  assert.equal(hint.getAttribute('aria-hidden'), null);
  assert.equal(hint.textContent, '拖曳頂端移動');
});
function fixture(draw, scene) {
  const prefix = draw ? 'draw' : 'game';
  const { document } = parseHTML(`<html><body data-visual-theme>
    <div class="vue-${prefix}-workspace vue-room-shell ${scene ? 'has-room-space' : ''}">
      <div class="vue-${prefix}-grid">
        <aside class="vue-${prefix}-roster-panel ${scene ? 'vue-room-side-panel' : ''}"></aside>
        <main class="vue-${prefix}-main"><section class="vue-game-panel"></section></main>
        <aside class="vue-${prefix}-side ${scene ? 'vue-room-side-panel' : ''}"></aside>
      </div>
    </div><style>${css}</style></body></html>`);
  function rules(list) {
    return [...list].flatMap((rule) => (rule.cssRules ? rules(rule.cssRules) : [rule]));
  }
  function surfaces(node) {
    return rules(document.querySelector('style').sheet.cssRules)
      .filter(
        (rule) =>
          rule.selectorText &&
          node.matches(rule.selectorText) &&
          ['background', 'border', 'border-inline-start', 'border-inline-end'].some((name) => {
            const value = rule.style.getPropertyValue(name);
            return value && !/^(0|none|transparent)(\s|$)/.test(value);
          }),
      )
      .map((rule) => rule.selectorText);
  }
  return {
    grid: document.querySelector(`.vue-${prefix}-grid`),
    left: document.querySelector(`.vue-${prefix}-roster-panel`),
    right: document.querySelector(`.vue-${prefix}-side`),
    content: document.querySelector('.vue-game-panel'),
    surfaces,
  };
}

for (const draw of [false, true]) {
  test(`${draw ? 'drawing' : 'shared'} sliding room panels do not inherit the classic opaque tracks`, () => {
    const f = fixture(draw, true);
    for (const node of [f.grid, f.left, f.right]) assert.deepEqual(f.surfaces(node), []);
    assert.ok(f.surfaces(f.content).length, 'the actual game content keeps its surface');
  });
  test(`${draw ? 'drawing' : 'shared'} classic rooms retain their frame and side tracks`, () => {
    const f = fixture(draw, false);
    for (const node of [f.grid, f.left, f.right]) assert.ok(f.surfaces(node).length);
  });
}
