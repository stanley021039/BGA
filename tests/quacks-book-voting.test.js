'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
  vm = require('node:vm');
const { dom } = require('./helpers/widget-dom.cjs'),
  { QuacksRoom } = require('../src/games/quacks');
function setup() {
  const { document } = dom('<section id="bookVoting"></section>'),
    calls = [],
    r = new QuacksRoom('ABCDEF', '選藥測試'),
    a = r.add('甲'),
    b = r.add('乙');
  const node = (tag, text) => {
    const n = document.createElement(tag);
    n.style.setProperty = (k, v) => {
      n.style[k] = v;
    };
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const context = vm.createContext({
    document,
    state: r.view(a.id),
    bookSetupReady: true,
    busy: false,
    $: (s) => document.querySelector(s),
    node,
    art: {
      palette: Object.fromEntries(
        ['orange', 'blue', 'red', 'yellow', 'green', 'black', 'purple', 'locoweed'].map((c) => [
          c,
          ['#333'],
        ]),
      ),
      token: () => node('svg'),
    },
    window: {
      GameUI: {
        decorateButton: (b, icon, options) => {
          b.setAttribute('aria-label', options?.label || b.textContent);
        },
      },
    },
    button: (label, icon, fn, blocked) => {
      const b = node('button', label);
      b.onclick = fn;
      b.disabled = !!blocked;
      b.dataset.blocked = String(!!blocked);
      return b;
    },
    act: (action, data) => calls.push({ action, ...data }),
    lock: () => {
      for (const b of document.querySelectorAll('button'))
        b.disabled = context.busy || b.dataset.blocked === 'true';
    },
  });
  const source = fs.readFileSync('public/quacks.js', 'utf8'),
    start = source.search(/const\s+bookPages\s*=/),
    end = source.indexOf('function renderBooks', start);
  vm.runInContext(source.slice(start, end), context);
  function render() {
    context.state = r.view(a.id);
    vm.runInContext('renderBookVoting(state)', context);
  }
  const card = (color) => document.querySelector('[data-ingredient="' + color + '"]'),
    control = (color, kind) =>
      document.querySelector('[data-book-control="' + color + '-' + kind + '"]');
  render();
  return { document, r, a, b, calls, context, render, card, control };
}

test('ingredient mappings preserve actual line breaks and reserve their full height', () => {
  const { EFFECTS } = require('../src/games/quacks-catalog');
  assert.equal(
    EFFECTS.blue[1],
    '保護接下來 1／2／4 片；期間若爆炸，仍可得分及購買，但不能擲獎勵骰。',
  );
  assert.equal(
    EFFECTS.green[1],
    '結算時，最後兩片中的花園蜘蛛各得一片藥材：\n1 → 南瓜 1\n2 → 烏鴉頭骨 1 或毒蘑菇 1\n4 → 曼德拉草 1 或幽靈氣息 1',
  );
  for (const index of [0, 2, 3]) assert.ok(EFFECTS.purple[index].includes('\n'));
  assert.match(
    fs.readFileSync('public/quacks.css', 'utf8').replace(/\s*([{}:;>])\s*/g, '$1'),
    /\.book-page-effect>\.book-effect-copy\{white-space:pre-line\}/,
  );
});

test('effect copy names neighboring opponents and the purple chips being discarded, with arrow mappings', () => {
  const { EFFECTS } = require('../src/games/quacks-catalog');
  for (const effects of Object.values(EFFECTS))
    for (const text of effects) assert.equal(text.includes('>'), false);
  for (const text of EFFECTS.black.slice(0, 4)) {
    assert.match(text, /與左、右相鄰的玩家比較。/);
    assert.doesNotMatch(text, /不跳過/);
  }
  assert.match(EFFECTS.purple[3], /南瓜、白色炸彈不能升級。/);
  assert.match(EFFECTS.purple[1], /永久棄掉大釜中的 1–3 片幽靈氣息/);
  assert.match(EFFECTS.purple[1], /棄 2 片 → 花園蜘蛛 1、烏鴉頭骨 2、3 分、水滴前進 1 格/);
});
