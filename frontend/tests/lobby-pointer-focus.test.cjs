const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { parseHTML } = require('linkedom'),
  ts = require('typescript');
function load() {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, '../src/services/pointer-focus.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    { module, exports: module.exports },
  );
  return module.exports.focusFromPointer;
}
function page() {
  const { document } = parseHTML(
    '<html><body><div class="lobby-backdrop" tabindex="0"></div><button>next</button></body></html>',
  );
  const stage = document.querySelector('.lobby-backdrop'),
    button = document.querySelector('button');
  let active = document.body;
  // Linkedom has no focus model; track activeElement and fire blur like a browser.
  Object.defineProperty(document, 'activeElement', { get: () => active });
  for (const element of [stage, button]) {
    element.focus = () => {
      if (active === element) return;
      const previous = active;
      active = element;
      previous.dispatchEvent(new document.defaultView.Event('blur'));
    };
  }
  return { stage, button, document };
}
test('pointer focus marks the lobby stage until focus moves elsewhere', () => {
  const focusFromPointer = load(),
    { stage, button, document } = page();
  let listeners = 0;
  const add = stage.addEventListener.bind(stage);
  stage.addEventListener = (type, listener) => {
    if (type === 'blur') listeners++;
    add(type, listener);
  };
  focusFromPointer(stage);
  focusFromPointer(stage);
  assert.equal(listeners, 1, 'repeated clicks reuse one blur listener');
  assert.equal(document.activeElement, stage);
  assert.equal(stage.hasAttribute('data-pointer-focus'), true);
  // A window switch blurs without changing the active element.
  stage.dispatchEvent(new document.defaultView.Event('blur'));
  assert.equal(stage.hasAttribute('data-pointer-focus'), true);
  button.focus();
  assert.equal(stage.hasAttribute('data-pointer-focus'), false);
  // Tabbing back is keyboard focus and keeps the ring.
  stage.focus();
  assert.equal(stage.hasAttribute('data-pointer-focus'), false);
});
test('lobby click uses pointer focus and the stage ring skips pointer focus', () => {
  const vue = fs.readFileSync(path.join(__dirname, '../src/pages/lobby/LobbyBackdrop.vue'), 'utf8'),
    scss = fs.readFileSync(path.join(__dirname, '../src/styles/lobby.scss'), 'utf8');
  assert.match(vue, /focusFromPointer\(stage\.value\)/);
  assert.doesNotMatch(vue, /stage\.value\?\.focus\(/);
  assert.match(
    scss,
    /&:focus-visible:not\(\[data-pointer-focus\]\)\s*\{\s*outline: 3px solid #f6a54b/,
  );
});
