const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { parseHTML } = require('linkedom');
test('arena portrait sizing cannot select a summoned giant image', () => {
  const { document } = parseHTML(
    '<html><body data-visual-theme="dark" class="vue-lobby-battle"><div class="lobby-avatar"><img class="scene-avatar-image"><div class="scene-summon"><div class="scene-summon-gesture"><img class="giant"></div></div></div></body></html>',
  );
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/lobby-arena.scss'), 'utf8');
  const selectors = [
    ...css.matchAll(/(:root body\[data-visual-theme\]\.vue-lobby-battle \.lobby-avatar [^{]+)\{/g),
  ]
    .map((m) => m[1].trim())
    .filter((s) => s.includes('img'));
  assert.ok(selectors.length >= 2);
  for (const selector of selectors) {
    assert.ok(document.querySelector('.scene-avatar-image').matches(selector));
    assert.equal(document.querySelector('.giant').matches(selector), false);
  }
});
