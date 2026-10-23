'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { parseHTML } = require('linkedom');
const { window } = parseHTML('<html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[key] = key === 'window' ? window : window[key];
window.HTMLElement.prototype.focus = function () {};
window.HTMLElement.prototype.showModal = function () {
  this.open = true;
};
window.HTMLElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new window.Event('close'));
};
const vue = require('vue');
const ts = require('typescript');
const { parse, compileScript } = require('vue/compiler-sfc');
const { QuacksRoom } = require('../../src/games/quacks');
function fixture() {
  const engine = new QuacksRoom(
    'ABCDEF',
    'UI',
    () => 0,
    () => 1000,
  );
  const host = engine.add('房主'),
    peer = engine.add('夥伴');
  engine.start();
  engine.deck = ['second'];
  engine.drawFortune();
  const room = vue.reactive({ scope: 1, connected: true, terminal: null });
  const game = vue.reactive({
    state: null,
    own: null,
    mine: null,
    selectedPot: host.id,
    get viewed() {
      return this.state?.recipes.find((p) => p.id === this.selectedPot && !p.hidden) || this.own;
    },
    available: true,
    notice: '',
    pending: false,
  });
  const calls = [];
  let rejectClose = false;
  function refresh() {
    game.state = engine.view(host.id);
    game.own = game.state.recipes.find((p) => p.id === host.id);
    game.mine = game.state.mine;
  }
  game.command = async (action, data = {}) => {
    calls.push([action, data]);
    if (action === 'close-bag' && rejectClose) return false;
    engine.act(host.id, action, { roundId: engine.roundId, requestId: randomUUID(), ...data });
    refresh();
    return true;
  };
  refresh();
  const cache = new Map();
  function load(name) {
    const file = path.resolve(__dirname, '../src', name);
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const source = compileScript(parse(fs.readFileSync(file, 'utf8')).descriptor, {
      id: file,
      inlineTemplate: true,
    }).content;
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module: loaded,
        exports: loaded.exports,
        document,
        window,
        setTimeout,
        clearTimeout,
        HTMLElement,
        Node: window.Node,
        ResizeObserver: class {
          observe() {}
          disconnect() {}
        },
        require: (id) =>
          id === 'vue'
            ? vue
            : id.includes('contracts/quacks')
              ? { ingredientNames: require('../../src/games/quacks-catalog').NAMES }
              : id.includes('contracts/room')
                ? {
                    playerRoomRole: (player, state) =>
                      player.id === state.host ? 'host' : 'player',
                  }
                : id.includes('stores/quacks')
                  ? { useQuacksStore: () => game }
                  : id.includes('stores/room')
                    ? { useRoomStore: () => room }
                    : id.includes('stores/achievements')
                      ? { useAchievementsStore: () => ({ load: async () => {}, loaded: false }) }
                      : id.endsWith('UiDialog.vue')
                        ? load('components/UiDialog.vue')
                        : id.endsWith('UiPopover.vue')
                          ? {
                              default: {
                                props: ['id', 'title'],
                                emits: ['closed'],
                                setup(props, { expose, slots, emit }) {
                                  // The browser verifies native popover positioning; here test the real reserve actions.
                                  const visible = vue.ref(false);
                                  expose({
                                    visible,
                                    async open() {
                                      visible.value = true;
                                    },
                                    close() {
                                      if (visible.value) {
                                        visible.value = false;
                                        emit('closed');
                                      }
                                    },
                                  });
                                  return () =>
                                    visible.value
                                      ? vue.h(
                                          'div',
                                          { id: props.id, 'aria-label': props.title },
                                          slots.default?.(),
                                        )
                                      : null;
                                },
                              },
                            }
                          : id.endsWith('RoomPlayerCard.vue')
                            ? load('components/RoomPlayerCard.vue')
                            : id.endsWith('UiButton.vue')
                              ? load('components/UiButton.vue')
                              : /Quacks(Glyph|Flask|EssenceReward|PatientBoard|AlchemyRules|ShoppingBag)\.vue$/.test(
                                    id,
                                  )
                                ? load('pages/quacks/' + path.basename(id))
                                : id.endsWith('QuacksBag.vue')
                                  ? load('pages/quacks/QuacksBag.vue')
                                  : id.endsWith('QuacksPot.vue')
                                    ? {
                                        default: {
                                          props: ['recipe'],
                                          setup: (p) => () =>
                                            vue.h('div', { 'data-pot-owner': p.recipe.id }),
                                        },
                                      }
                                    : { default: { setup: () => () => null } },
      },
    );
    return loaded.exports;
  }
  function mount(name, props) {
    const element = document.createElement('div');
    document.body.append(element);
    const app = vue.createApp(load('pages/quacks/' + name + '.vue').default, props);
    app.mount(element);
    return {
      element,
      dispose() {
        app.unmount();
        element.remove();
      },
    };
  }
  return {
    engine,
    host,
    peer,
    game,
    calls,
    mount,
    refresh,
    rejectClose(value) {
      rejectClose = value;
    },
  };
}
async function click(button) {
  assert.ok(button);
  button.click();
  await vue.nextTick();
  await vue.nextTick();
  await vue.nextTick();
  await vue.nextTick();
}

test('patient preview opens the original board independently and cannot confirm an essence choice', async () => {
  const { catalog } = require('../../src/games/quacks-alchemy');
  const f = fixture();
  f.game.state.phase = 'patients';
  f.game.state.options.alchemists = true;
  f.game.state.patients = catalog().filter((p) => ['eyes', 'carrot', 'earworm'].includes(p.id));
  const ui = f.mount('QuacksAlchemy');
  try {
    assert.equal(ui.element.querySelectorAll('details').length, 0);
    assert.equal(ui.element.querySelectorAll('[data-essence]').length, 0);
    const previews = [...ui.element.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') === '查看獎勵軌道',
    );
    assert.equal(previews.length, 3);
    assert.doesNotMatch(ui.element.textContent, /本場隨機三名病患/);
    assert.ok(
      [...ui.element.querySelectorAll('button')].some(
        (b) => b.getAttribute('aria-label') === '治療耳蟲',
      ),
    );
    await click(previews[0]);
    const nodes = [...ui.element.querySelectorAll('[data-essence]')];
    assert.equal(nodes.length, 11);
    assert.equal(new Set(nodes.map((n) => n.dataset.essence)).size, 11);
    assert.ok(ui.element.querySelector('.quacks-distillery-pipes'));
    assert.equal(ui.element.querySelectorAll('.quacks-reward-vial').length, 10);
    assert.equal(ui.element.querySelectorAll('.quacks-patient-board-hint').length, 0);
    await click(ui.element.querySelector('[aria-label="開啟調製規則"]'));
    assert.match(ui.element.textContent, /每種非白色藥材 \+1/);
    assert.match(ui.element.textContent, /只領所選那格的獎勵/);
    assert.match(ui.element.textContent, /確認後不能修改/);
    assert.match(ui.element.textContent, /耳蟲 · 病患能力/);
    assert.equal(f.calls.length, 0);
    const rulesClose = ui.element.querySelector('[aria-label="關閉調製規則"]');
    await click(rulesClose);
    await click(nodes[10]);
    assert.equal(f.calls.length, 0, 'preview must never submit an essence choice');
  } finally {
    ui.dispose();
  }
});

test('unified essence buttons keep unreachable positions read only and final-round rewards become points', async () => {
  const { catalog } = require('../../src/games/quacks-alchemy');
  const f = fixture();
  f.game.command = async (...args) => {
    f.calls.push(args);
  };
  const props = vue.reactive({
    patient: catalog().find((p) => p.id === 'eyes'),
    value: 3,
    max: 3,
    selecting: true,
    final: false,
  });
  const ui = f.mount('QuacksFlask', props);
  try {
    await click(ui.element.querySelector('[data-essence="10"]'));
    assert.equal(f.calls.length, 0);
    assert.match(
      ui.element.querySelector('[data-essence="10"]').getAttribute('aria-label'),
      /擲骰 4 次/,
    );
    await click(ui.element.querySelector('[data-essence="2"]'));
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [['essence', { position: 2 }]]);
    f.game.available = false;
    await click(ui.element.querySelector('[data-essence="1"]'));
    assert.equal(f.calls.length, 1);
  } finally {
    ui.dispose();
  }
  const finalUI = f.mount('QuacksFlask', { ...props, final: true });
  try {
    // The board keeps the number node and its reward vial as separate, linked buttons.
    const last = finalUI.element.querySelector('[data-essence="10"]'),
      vial = [...finalUI.element.querySelectorAll('.quacks-reward-vial')].at(-1);
    assert.match(vial.textContent, /10 分/);
    assert.doesNotMatch(last.getAttribute('aria-label'), /擲骰/);
    assert.doesNotMatch(vial.getAttribute('aria-label'), /擲骰/);
    assert.equal(vial.querySelectorAll('.vue-quacks-glyph').length, 0);
  } finally {
    finalUI.dispose();
  }
});
test('own bag uses the header close for its once-per-round snapshot; failed close retains the modal', async () => {
  const f = fixture(),
    ui = f.mount('QuacksBag');
  try {
    await click(ui.element.querySelector('.vue-quacks-bag-button'));
    assert.equal(
      ui.element.querySelector('.vue-quacks-bag-button').getAttribute('data-quacks-bag'),
      f.host.id,
    );
    assert.equal(ui.element.querySelector('dialog').open, true);
    assert.equal(ui.element.querySelectorAll('.vue-dialog-content button').length, 1);
    assert.match(ui.element.textContent, /查看（本輪只有一次哦！）/);
    await click(ui.element.querySelector('.vue-dialog-content button'));
    assert.equal(f.engine.player(f.host.id).bagPeekUsed, true);
    assert.equal(f.engine.player(f.peer.id).bagPeekUsed, false);
    assert.equal(ui.element.querySelectorAll('.vue-quacks-bag-grid > div').length, 5);
    assert.equal(ui.element.querySelectorAll('.vue-dialog-content button').length, 0);
    assert.match(ui.element.textContent, /本輪不能再查看/);
    const close = ui.element.querySelector('.vue-dialog-header button');
    assert.equal(close.disabled, false);
    f.rejectClose(true);
    await click(close);
    assert.equal(ui.element.querySelector('dialog').open, true);
    assert.ok(f.engine.player(f.host.id).bagPeek);
    f.rejectClose(false);
    await click(close);
    assert.equal(ui.element.querySelector('dialog').open, false);
    assert.equal(f.engine.player(f.host.id).bagPeek, null);
    await click(ui.element.querySelector('.vue-quacks-bag-button'));
    assert.equal(ui.element.querySelectorAll('.vue-dialog-content button').length, 0);
    assert.match(ui.element.textContent, /本輪不能再查看/);
    assert.throws(
      () =>
        f.engine.act(f.host.id, 'peek-bag', { roundId: f.engine.roundId, requestId: randomUUID() }),
      /本回合只能查看一次/,
    );
  } finally {
    ui.dispose();
  }
});
test('player cards switch public pots, keep the selected pot read only, and reject hidden pots', async () => {
  const f = fixture(),
    ui = f.mount('QuacksScene');
  try {
    assert.equal(
      ui.element.querySelector('[data-pot-owner]').getAttribute('data-pot-owner'),
      f.host.id,
    );
    assert.equal(ui.element.querySelector('[aria-label="切換大釜"]'), null);
    assert.equal(ui.element.querySelector('.vue-quacks-scene-header'), null);
    assert.ok(ui.element.querySelector('.vue-quacks-pot-heading [aria-label="大釜命名與換色"]'));
    assert.ok(
      ui.element.querySelector(
        '.vue-quacks-board-space [aria-label="占卜、女巫、特效藥與大釜設定"]',
      ),
    );
    const roster = f.mount('QuacksRoster');
    try {
      const peerCard = roster.element.querySelector(`[data-quacks-player="${f.peer.id}"]`);
      assert.equal(peerCard.getAttribute('role'), 'button');
      await click(peerCard);
      assert.equal(f.game.selectedPot, f.peer.id);
      assert.equal(
        ui.element.querySelector('[data-pot-owner]').getAttribute('data-pot-owner'),
        f.peer.id,
      );
      assert.equal(ui.element.querySelector('[aria-label="大釜命名與換色"]'), null);
      assert.equal(ui.element.querySelector('.vue-quacks-bag-button'), null);
      assert.equal(ui.element.querySelector('.vue-quacks-board-reserves'), null);
      await click(ui.element.querySelector('[aria-label="返回我的大釜"]'));
      assert.equal(
        ui.element.querySelector('[data-pot-owner]').getAttribute('data-pot-owner'),
        f.host.id,
      );
      const key = new window.Event('keydown', { bubbles: true });
      key.key = 'Enter';
      peerCard.dispatchEvent(key);
      await vue.nextTick();
      assert.equal(f.game.selectedPot, f.peer.id);
      f.game.selectedPot = f.host.id;
      f.game.state.recipes.find((p) => p.id === f.peer.id).hidden = true;
      await vue.nextTick();
      assert.equal(peerCard.getAttribute('aria-disabled'), 'true');
      await click(peerCard);
      assert.equal(f.game.selectedPot, f.host.id);
      peerCard.dispatchEvent(key);
      await vue.nextTick();
      assert.equal(f.game.selectedPot, f.host.id);
    } finally {
      roster.dispose();
    }
  } finally {
    ui.dispose();
  }
});

test('chip actions page lists each reserve with both actions and keeps mandatory and availability guards', async () => {
  const f = fixture(),
    chip = f.engine.player(f.host.id).bag.find((c) => c.color === 'green');
  f.game.mine.reserve = [{ ...chip, must: true }];
  const commands = [];
  f.game.command = async (...args) => {
    commands.push(args);
    return true;
  };
  const ui = f.mount('QuacksReserves');
  try {
    const card = ui.element.querySelector('.vue-quacks-reserve-card');
    assert.match(card.getAttribute('aria-label'), /本輪必須投入/);
    assert.equal(card.querySelector('[aria-label="放回藥袋"]').disabled, true);
    const place = card.querySelector('[aria-label="投入暫存"]');
    f.game.available = false;
    await vue.nextTick();
    assert.equal(place.disabled, true);
    f.game.available = true;
    await vue.nextTick();
    await click(place);
    assert.deepEqual(
      commands.map(([a, d]) => [a, JSON.parse(JSON.stringify(d))]),
      [['reserve', { chipId: chip.id }]],
    );
    f.game.mine.reserve[0].must = false;
    await vue.nextTick();
    assert.equal(card.querySelector('[aria-label="放回藥袋"]').disabled, false);
    f.game.own.chosen = true;
    await vue.nextTick();
    assert.equal(card.querySelector('[aria-label="放回藥袋"]').disabled, true);
  } finally {
    ui.dispose();
  }
});
test('chip actions hide behind a counted dock badge and never block the cauldron', async () => {
  const f = fixture(),
    chip = f.engine.player(f.host.id).bag.find((c) => c.color === 'green');
  const ui = f.mount('QuacksScene', {});
  try {
    const badge = () => ui.element.querySelector('.vue-quacks-chip-actions-button');
    assert.equal(!!badge(), false, 'no badge without actions');
    f.game.mine.reserve = [{ ...chip, must: false }];
    await vue.nextTick();
    assert.equal(badge().querySelector('.vue-quacks-action-badge').textContent.trim(), '1');
    assert.equal(!!ui.element.querySelector('[data-pot-owner]'), true, 'pot stays full size');
    await click(badge());
    assert.equal(!!ui.element.querySelector('.vue-quacks-stage-overlay'), true);
    const back = ui.element.querySelector('.vue-quacks-pot-peek');
    assert.equal(back.getAttribute('aria-label'), '返回大釜');
    await click(back);
    assert.equal(!!ui.element.querySelector('.vue-quacks-stage-overlay'), false);
    assert.equal(f.calls.length, 0, 'opening the page never forces an action');
  } finally {
    ui.dispose();
  }
});
test('round progress follows server phases and includes only enabled expansion stages', async () => {
  const f = fixture(),
    ui = f.mount('QuacksRoundProgress', { state: f.game.state });
  try {
    assert.equal(
      ui.element.querySelector('[aria-current="step"]').textContent.replace('→', '').trim(),
      '抽藥',
    );
    assert.doesNotMatch(ui.element.textContent, /女巫|特效藥|病患/);
    f.game.state.options.witches = true;
    f.game.state.options.alchemists = true;
    f.game.state.phase = 'patients';
    f.game.state.round = 0;
    await vue.nextTick();
    assert.equal(
      ui.element.querySelector('[aria-current="step"]').textContent.replace('→', '').trim(),
      '病患',
    );
    f.game.state.round = 1;
    f.game.state.phase = 'settlement';
    f.game.state.stage = 'essence';
    await vue.nextTick();
    assert.match(ui.element.textContent, /女巫/);
    assert.match(ui.element.textContent, /病患/);
    assert.equal(
      ui.element.querySelector('[aria-current="step"]').textContent.replace('→', '').trim(),
      '特效藥',
    );
    f.game.state.stage = 'effects-confirm';
    await vue.nextTick();
    assert.equal(
      ui.element.querySelector('[aria-current="step"]').textContent.replace('→', '').trim(),
      '藥材效果',
    );
    f.game.state.round = 9;
    f.game.state.stage = 'shopping';
    await vue.nextTick();
    assert.equal(
      ui.element.querySelector('[aria-current="step"]').textContent.replace('→', '').trim(),
      '最終換分',
    );
    f.game.state.phase = 'finished';
    await vue.nextTick();
    assert.equal(
      ui.element.querySelector('[aria-current="step"]').textContent.replace('→', '').trim(),
      '完成',
    );
  } finally {
    ui.dispose();
  }
});

test('reward columns preview points and budget, auto-check when safe, and ask only after an explosion', async () => {
  const f = fixture();
  f.engine.phase = 'settlement';
  f.engine.player(f.host.id).position = 9;
  f.engine.rewardPhase();
  f.refresh();
  let ui = f.mount('QuacksRewards', {});
  try {
    const field = f.engine.field(f.engine.player(f.host.id));
    const numbers = [...ui.element.querySelectorAll('.vue-quacks-reward-number')].map((n) =>
      Number(n.textContent),
    );
    assert.deepEqual(numbers, [field.points, field.coins]);
    assert.equal(ui.element.querySelectorAll('.vue-quacks-reward-check').length, 2);
    assert.equal(ui.element.querySelectorAll('button').length, 0, 'safe pots need no choice');
  } finally {
    ui.dispose();
  }
  f.engine.player(f.host.id).exploded = true;
  f.refresh();
  ui = f.mount('QuacksRewards', {});
  try {
    assert.equal(ui.element.querySelectorAll('.vue-quacks-reward-check').length, 0);
    await click(ui.element.querySelector('button[aria-label="選擇購物預算"]'));
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))), ['reward', { mode: 'buy' }]);
    assert.equal(f.engine.player(f.host.id).settlementChoice, 'buy');
  } finally {
    ui.dispose();
  }
});
test('shopping bag lists every owned chip and can be reopened during shopping', async () => {
  const f = fixture(),
    p = f.engine.player(f.host.id);
  p.pot.push(p.bag.pop());
  f.engine.phase = 'settlement';
  f.engine.stage = 'shopping';
  f.refresh();
  const ui = f.mount('QuacksShoppingBag', {});
  try {
    const total = p.bag.length + p.pot.length;
    assert.equal(
      f.game.mine.shoppingBag.length,
      total,
      'pot chips return next round, so they count',
    );
    const button = ui.element.querySelector('button');
    assert.match(button.getAttribute('aria-label'), new RegExp('共 ' + total + ' 片'));
    for (let i = 0; i < 2; i++) {
      await click(button);
      assert.equal(ui.element.querySelector('dialog').open, true);
      ui.element.querySelector('dialog').close();
    }
    assert.equal(
      f.calls.length,
      0,
      'viewing the shopping bag sends no command and never spends the brewing peek',
    );
  } finally {
    ui.dispose();
  }
});
test('settlement witches show only use buttons while keeping full rules accessible', async () => {
  const f = fixture();
  f.engine.options.witches = true;
  f.refresh();
  f.game.state.witches = {
    gold: { name: '金女巫', text: '完整金女巫規則' },
    copper: { name: '銅女巫', text: '完整銅女巫規則' },
    silver: { name: '銀女巫', text: '完整銀女巫規則' },
  };
  f.game.mine.witchAvailable = { gold: true, copper: false, silver: false };
  f.game.command = async (...args) => {
    f.calls.push(args);
  };
  const ui = f.mount('QuacksWitches', { compact: true });
  try {
    const buttons = [...ui.element.querySelectorAll('button')];
    assert.equal(buttons.length, 3);
    assert.equal(
      ui.element.querySelector('h2, h3, p'),
      null,
      'no heading or prose above the options',
    );
    assert.match(buttons[0].getAttribute('aria-label'), /完整金女巫規則/);
    assert.equal(buttons[1].disabled, true);
    await click(buttons[0]);
    assert.deepEqual(f.calls.at(-1)?.[0], 'witch');
  } finally {
    ui.dispose();
  }
});

test('fortune card shows the back to every seat and only the starter can draw', async () => {
  const f = fixture(),
    base = {
      fortune: { name: '測試占卜', text: '完整占卜效果', timing: 'round' },
      caption: '等待房主抽占卜牌',
    };
  let ui = f.mount('QuacksFortuneCard', { ...base, flipped: false, canDraw: false });
  try {
    const card = ui.element.querySelector('.quacks-fortune-card');
    assert.ok(card.querySelector('.is-back img[src="/assets/quacks/fortune-back.svg"]'));
    assert.equal(card.disabled, true, 'non-starters see the back but cannot draw');
    assert.doesNotMatch(card.getAttribute('aria-label'), /完整占卜效果/);
  } finally {
    ui.dispose();
  }
  ui = f.mount('QuacksFortuneCard', { ...base, flipped: true, canDraw: false });
  try {
    const card = ui.element.querySelector('.quacks-fortune-card');
    assert.ok(card.classList.contains('is-flipped'));
    assert.match(card.getAttribute('aria-label'), /完整占卜效果/);
  } finally {
    ui.dispose();
  }
});
test('choice screens show the source rule beside the title on hover', async () => {
  const f = fixture();
  f.game.state.fortune = { name: '強大藥水', text: '完整占卜效果', timing: 'immediate' };
  f.game.mine.pending = {
    id: 'q',
    title: '強大藥水',
    kind: null,
    options: [{ id: 'o', label: '不交換', disabled: false }],
  };
  let ui = f.mount('QuacksChoices', {});
  try {
    const help = ui.element.querySelector('.vue-quacks-choice-heading button');
    assert.equal(help.getAttribute('aria-label'), '強大藥水：完整占卜效果');
    assert.ok(help.hasAttribute('data-ui-hint'));
  } finally {
    ui.dispose();
  }
  f.game.mine.pending = { ...f.game.mine.pending, title: '未知來源' };
  ui = f.mount('QuacksChoices', {});
  try {
    assert.equal(ui.element.querySelector('.vue-quacks-choice-heading button'), null);
  } finally {
    ui.dispose();
  }
});
test('choice screens show droplet, rat start, position, rubies and a reusable owned-chip view', async () => {
  const f = fixture(),
    p = f.engine.player(f.host.id);
  assert.equal(f.game.mine.shoppingBag, null, 'no owned-chip list outside shopping or choices');
  f.engine.queue(p, '強大藥水', [f.engine.option('不交換', [])]);
  f.refresh();
  assert.equal(f.game.mine.shoppingBag.length, p.bag.length + p.pot.length + p.overflow.length);
  const ui = f.mount('QuacksChoices', {});
  try {
    const status = ui.element.querySelector('.vue-quacks-choice-status').textContent;
    for (const text of ['水滴 ' + p.droplet, '起點 ', '當前 ' + p.position, '紅寶石 ' + p.rubies])
      assert.ok(status.includes(text), text);
    const bag = ui.element.querySelector('.vue-quacks-choice-status button');
    assert.equal(bag.disabled, false);
    await click(bag);
    await click(bag);
    assert.equal(f.calls.length, 0, 'viewing owned chips sends no command');
  } finally {
    ui.dispose();
  }
});
test('a covering choice screen can flip back to the own cauldron and return', async () => {
  const f = fixture(),
    p = f.engine.player(f.host.id);
  f.engine.queue(p, '強大藥水', [f.engine.option('不交換', [])]);
  f.refresh();
  const ui = f.mount('QuacksScene', {});
  try {
    const peek = () => ui.element.querySelector('.vue-quacks-pot-peek');
    assert.equal(!!ui.element.querySelector('.vue-quacks-stage-overlay'), true);
    assert.equal(!!ui.element.querySelector('[data-pot-owner]'), false);
    assert.equal(peek().getAttribute('aria-label'), '查看大釜');
    await click(peek());
    assert.equal(!!ui.element.querySelector('.vue-quacks-stage-overlay'), false);
    assert.equal(ui.element.querySelector('[data-pot-owner]').dataset.potOwner, f.host.id);
    assert.equal(peek().getAttribute('aria-label'), '返回選擇');
    await click(peek());
    assert.equal(!!ui.element.querySelector('.vue-quacks-stage-overlay'), true);
    assert.equal(f.calls.length, 0);
  } finally {
    ui.dispose();
  }
});
test('pot peek survives ordinary state polling and resets only when the screen changes', async () => {
  const f = fixture(),
    p = f.engine.player(f.host.id);
  f.engine.queue(p, '強大藥水', [f.engine.option('不交換', [])]);
  f.refresh();
  const ui = f.mount('QuacksScene', {});
  try {
    await click(ui.element.querySelector('.vue-quacks-pot-peek'));
    for (let i = 0; i < 3; i++) {
      f.refresh();
      await vue.nextTick();
    }
    assert.equal(
      !!ui.element.querySelector('.vue-quacks-stage-overlay'),
      false,
      'polls keep the pot',
    );
    p.pending = [];
    f.engine.queue(p, '另一個選擇', [f.engine.option('好', [])]);
    f.refresh();
    await vue.nextTick();
    await vue.nextTick();
    assert.equal(
      !!ui.element.querySelector('.vue-quacks-stage-overlay'),
      true,
      'a new choice returns',
    );
  } finally {
    ui.dispose();
  }
});
