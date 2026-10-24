'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  vm = require('node:vm'),
  { dom } = require('./helpers/widget-dom.cjs');
test('floating media keeps its header tools and owned scroll region in place', () => {
  const { document } = dom(
      '<dialog class="table-media-window" id="media"><header id="bar"><button id="min">最小化</button><button id="close">關閉</button></header><div id="scroll">清單</div></dialog>',
    ),
    dialog = document.querySelector('#media'),
    bar = document.querySelector('#bar'),
    scroll = document.querySelector('#scroll'),
    source = fs.readFileSync(
      require('node:path').join(__dirname, '../public/shared/ui-components.js'),
      'utf8',
    ),
    scope = { document };
  vm.createContext(scope);
  vm.runInContext(
    source.slice(
      source.indexOf(' function frameDialog('),
      source.indexOf(' function mountDialogFrames('),
    ),
    scope,
  );
  scope.frameDialog(dialog);
  scope.frameDialog(dialog);
  assert.equal(dialog.children.length, 2);
  assert.equal(document.querySelector('#min').parentElement, bar);
  assert.equal(scroll.parentElement, dialog);
  assert.equal(dialog.querySelector('.ui-dialog-footer'), null);
  assert.equal(dialog.dataset.uiDialogFrame, 'true');
});
