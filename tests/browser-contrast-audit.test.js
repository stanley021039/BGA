const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../tools/browser-contrast-audit.js'), 'utf8');

function inspect({
  color = 'rgb(0, 0, 0)',
  backgrounds = ['rgb(255, 255, 255)'],
  ...options
} = {}) {
  const nodes = backgrounds.map((backgroundColor, index) => ({
    tagName: index ? 'DIV' : 'P',
    classList: [],
    childNodes: index ? [] : [{ nodeType: 3, textContent: '驗證文字' }],
    getBoundingClientRect: () => ({
      top: 0,
      left: 0,
      right: 100,
      bottom: 30,
      width: 100,
      height: 30,
    }),
    closest: (selector) =>
      selector.includes('.ui-sr-only') && options.srOnly
        ? {}
        : selector.startsWith(':disabled') && options.disabled
          ? {}
          : selector.includes('.barrage-frame-preview') && options.artwork
            ? {}
            : null,
    style: {
      color,
      backgroundColor,
      opacity: '1',
      filter: 'none',
      mixBlendMode: 'normal',
      textShadow: 'none',
      backgroundImage: 'none',
      visibility: 'visible',
      display: 'block',
      overflowX: 'visible',
      overflowY: 'visible',
      ...(index ? {} : options.style),
    },
  }));
  nodes.forEach((node, i) => (node.parentElement = nodes[i + 1] || null));
  const run = vm.runInNewContext(source, {
    document: {
      documentElement: { dataset: { colorScheme: 'dark' } },
      querySelector: () => null,
      querySelectorAll: () => [nodes[0]],
    },
    getComputedStyle: (node) => node.style,
    innerWidth: 390,
    innerHeight: 844,
  });
  return run();
}

test('browser contrast audit detects the actual minimal hero regression and readable replacement', () => {
  const bad = inspect({ color: 'rgb(247, 241, 231)', backgrounds: ['rgb(255, 242, 196)'] });
  assert.equal(bad.failures[0].ratio, 1);
  assert.equal(
    inspect({ color: 'rgb(90, 91, 82)', backgrounds: ['rgb(255, 242, 196)'] }).failures.length,
    0,
  );
  assert.equal(inspect().counts.checked, 1);
});
test('audit composites text and multiple translucent backgrounds rather than discarding alpha', () => {
  assert.ok(inspect({ color: 'rgba(0, 0, 0, 0.5)' }).failures[0].ratio < 4.5);
  const layered = inspect({
    color: 'rgb(255, 255, 255)',
    backgrounds: ['rgba(0, 0, 0, 0.5)', 'rgb(255, 255, 255)'],
  });
  assert.equal(layered.failures[0].ratio, 3.98);
  assert.equal(inspect({ color: 'color(srgb 0 0 0)' }).counts.checked, 1);
});
test('uncertain rendering stays manual and cannot be counted as a contrast pass', () => {
  for (const options of [
    { style: { backgroundImage: 'linear-gradient(black,white)' } },
    { style: { opacity: '.5' } },
    { artwork: true },
    { backgrounds: ['rgba(0,0,0,0)'] },
    { color: 'unsupported' },
  ]) {
    const result = inspect(options);
    assert.equal(result.counts.checked, 0);
    assert.equal(result.manual.length, 1);
  }
});
test('hidden and disabled content is separate from checked text', () => {
  assert.equal(inspect({ disabled: true }).counts.disabled, 1);
  assert.equal(inspect({ style: { visibility: 'hidden' } }).counts.hidden, 1);
  assert.equal(inspect({ srOnly: true }).counts.checked, 0);
});
