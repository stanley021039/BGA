'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { randomUUID } = require('node:crypto'),
  { QuacksRoom } = require('../src/games/quacks'),
  { FORTUNES } = require('../src/games/quacks-expansion-fortunes');
function trade() {
  const r = new QuacksRoom('ABCDEF', 'choices', () => 0),
    a = r.add('A'),
    b = r.add('B');
  r.configure(a.id, { witches: true });
  r.start();
  r.fortune = FORTUNES.find((f) => f.id === 'witch-trade');
  r.applyExpansionFortune();
  return { r, a, b };
}
function ui() {
  const { document } = require('./helpers/widget-dom.cjs').dom(),
    calls = [];
  let busy = false;
  const node = (t, text) => {
      const n = document.createElement(t);
      if (text !== undefined) n.textContent = text;
      return n;
    },
    button = (label, _icon, fn, disabled = false, key) => {
      const n = node('button', label);
      n.disabled = disabled;
      n.dataset.quacksActionKey = key;
      n.onclick = fn;
      return n;
    },
    art = {
      token(c) {
        const n = node('svg');
        n.className = 'ingredient-token';
        n.dataset.color = c.color;
        n.dataset.value = c.value;
        return n;
      },
      resource(kind) {
        const n = node('svg');
        n.dataset.resource = kind;
        return n;
      },
    };
  const source = fs.readFileSync(require.resolve('../public/quacks.js'), 'utf8'),
    scope = vm.createContext({});
  vm.runInContext(
    source.slice(
      source.indexOf('function createChoiceUI('),
      source.search(/const\s+choiceUI\s*=/),
    ) + ';globalThis.create=createChoiceUI;',
    scope,
  );
  const renderer = scope.create({
    node,
    button,
    art,
    hint() {},
    onChoose: (...args) => calls.push(args),
    isBusy: () => busy,
  });
  return {
    document,
    calls,
    render: (p, key = 'same-room-round') => {
      const root = renderer.render(p, key);
      document.body.replaceChildren(root);
      return root;
    },
    busy: (value) => (busy = value),
  };
}
test('witch trade publishes only safe artwork and still executes the original combined operation once', () => {
  const { r, a } = trade(),
    pending = r.view(a.id).mine.pending;
  assert.equal(pending.kind, 'witch-trade');
  const offer = pending.options.find(
    (o) => o.coin === 'gold' && o.ingredient.color === 'blue' && o.ingredient.value === 2,
  );
  assert.ok(offer);
  assert.equal(offer.ops, undefined);
  assert.deepEqual(Object.keys(offer.ingredient).sort(), ['color', 'value']);
  const before = a.bag.length;
  r.act(a.id, 'choice', {
    roundId: r.roundId,
    requestId: randomUUID(),
    choiceId: pending.id,
    optionId: offer.id,
  });
  assert.equal(a.coins.gold, false);
  assert.equal(a.coins.silver, true);
  assert.equal(a.bag.length, before + 1);
  assert.equal(a.bag.at(-1).color, 'blue');
  assert.equal(a.bag.at(-1).value, 2);
});
test('coin selection is local, survives room updates and submits only the chosen ingredient option', () => {
  const { r, a } = trade(),
    p = r.view(a.id).mine.pending,
    f = ui();
  let root = f.render(p);
  assert.equal(root.querySelectorAll('.q-choice-coin').length, 3);
  assert.equal(root.querySelectorAll('.ingredient-token').length, 0);
  root.querySelector('[data-quacks-action-key="choice-coin:' + p.id + ':copper"]').onclick();
  assert.equal(f.calls.length, 0);
  root = f.render(p);
  assert.equal(root.querySelectorAll('.q-choice-coin').length, 0);
  assert.equal(
    root.querySelectorAll('.q-choice-ingredient').length,
    p.options.filter((o) => o.coin === 'copper').length,
  );
  const offer = p.options.find((o) => o.coin === 'copper');
  root.querySelector('[data-quacks-action-key="choice:' + p.id + ':' + offer.id + '"]').onclick();
  assert.deepEqual(f.calls, [[p.id, offer.id]]);
  root.querySelector('[data-quacks-action-key="choice-back:' + p.id + '"]').onclick();
  assert.equal(root.querySelectorAll('.q-choice-coin').length, 3);
});
test('disabled coins, stale rooms, preserve choice and busy local actions remain safe', () => {
  const { r, a } = trade(),
    p = r.view(a.id).mine.pending,
    f = ui();
  for (const o of p.options) if (o.coin === 'silver') o.disabled = true;
  let root = f.render(p),
    silver = root.querySelector('[data-quacks-action-key="choice-coin:' + p.id + ':silver"]');
  assert.equal(silver.disabled, true);
  silver.onclick();
  assert.equal(root.querySelectorAll('.q-choice-coin').length, 3);
  f.busy(true);
  root.querySelector('[data-quacks-action-key="choice-coin:' + p.id + ':gold"]').onclick();
  assert.equal(root.querySelectorAll('.q-choice-coin').length, 3);
  f.busy(false);
  root.querySelector('[data-quacks-action-key="choice-coin:' + p.id + ':gold"]').onclick();
  root = f.render(p, 'different-room');
  assert.equal(root.querySelectorAll('.q-choice-coin').length, 3);
  const keep = p.options.find((o) => !o.coin);
  root.querySelector('[data-quacks-action-key="choice:' + p.id + ':' + keep.id + '"]').onclick();
  assert.deepEqual(f.calls, [[p.id, keep.id]]);
});
test('ordinary ingredient choices carry icon, cost and upgrade data without operation payloads', () => {
  const { r, a } = trade();
  a.pending = [];
  const chip = r.chip('red', 1);
  a.bag.push(chip);
  r.queue(a, '藥材選擇', [
    r.option('付1紅寶石換花園蜘蛛2', [
      { op: 'ruby', amount: -1 },
      { op: 'grant', color: 'green', value: 2 },
    ]),
    r.option('升級毒蘑菇', [{ op: 'upgrade', chipId: chip.id, value: 4 }]),
  ]);
  const p = r.view(a.id).mine.pending;
  assert.equal(p.kind, null);
  assert.deepEqual(p.options[0].cost, { resource: 'ruby', amount: 1 });
  assert.deepEqual(p.options[1].ingredient, { color: 'red', value: 4, fromValue: 1 });
  const f = ui(),
    root = f.render(p);
  assert.equal(root.querySelectorAll('.ingredient-token').length, 3);
  assert.equal(root.querySelectorAll('.q-choice-cost').length, 1);
});

test('locoweed returns use actual pot chip artwork and fortune upgrades show both values', () => {
  const { r, a } = trade();
  a.pending = [];
  a.pot = [r.chip('green', 1), r.chip('purple', 1), r.chip('locoweed', 1)];
  r.selectChip(a, '愚人草：收回一片彩色藥材', a.pot, 'remove');
  let pending = r.view(a.id).mine.pending;
  assert.deepEqual(
    pending.options.slice(0, 3).map((o) => o.ingredient),
    [
      { color: 'green', value: 1 },
      { color: 'purple', value: 1 },
      { color: 'locoweed', value: 1 },
    ],
  );
  assert.equal(ui().render(pending).querySelectorAll('.ingredient-token').length, 3);
  a.pending = [];
  const chip = r.chip('blue', 2);
  a.bag.push(chip);
  r.selectChip(a, '鹹魚翻身：選一片升級', [chip], 'fortuneUpgrade');
  assert.deepEqual(r.view(a.id).mine.pending.options[0].ingredient, {
    color: 'blue',
    value: 4,
    fromValue: 2,
  });
});

test('alchemy purchase, upgrade, held-chip costs and color swaps all expose accurate artwork', () => {
  const { r, a } = trade();
  a.pending = [];
  const chip = r.chip('red', 1);
  a.bag.push(chip);
  r.queue(a, 'other ingredient paths', [
    r.option('獨立購藥', [{ op: 'alchemyBuy', color: 'green', value: 4 }]),
    r.option('升級', [{ op: 'alchemyUpgrade', chipId: chip.id, value: 2 }]),
    r.option('交換', [{ op: 'expSwap', chipId: chip.id, color: 'blue', value: 1 }]),
    r.option('特效藥投入', [{ op: 'alchemyPlace', chip: r.chip('white', 2), cost: 3 }]),
    r.option('駝峰獎勵', [{ op: 'alchemyHump', reward: 'yellow', cost: 2 }]),
  ]);
  const p = r.view(a.id).mine.pending;
  assert.deepEqual(p.options[0].ingredient, { color: 'green', value: 4 });
  assert.deepEqual(p.options[1].ingredient, { color: 'red', value: 2, fromValue: 1 });
  assert.deepEqual(p.options[2].ingredient, {
    color: 'blue',
    value: 1,
    fromValue: 1,
    fromColor: 'red',
  });
  assert.deepEqual(p.options[3].cost, { resource: 'essence', amount: 3 });
  assert.deepEqual(p.options[4].ingredient, { color: 'yellow', value: 1 });
  const root = ui().render(p);
  assert.equal(root.querySelectorAll('.ingredient-token').length, 7);
  assert.equal(root.querySelectorAll('.q-choice-cost').length, 2);
});

test('multi-chip options show every affected chip instead of implying a single-chip action', () => {
  const { r, a } = trade();
  a.pending = [];
  const chips = [r.chip('white', 1), r.chip('white', 2)];
  a.pot.push(...chips);
  r.queue(a, '清除白色炸彈', [
    r.option(
      '收回兩片',
      chips.map((c) => ({ op: 'remove', chipId: c.id })),
    ),
  ]);
  const p = r.view(a.id).mine.pending;
  assert.deepEqual(p.options[0].ingredients, [
    { color: 'white', value: 1 },
    { color: 'white', value: 2 },
  ]);
  assert.equal(ui().render(p).querySelectorAll('.ingredient-token').length, 2);
});

test('generous fortune exposes distinct public rewards', () => {
  const { r, a } = trade();
  a.pending = [];
  r.fortune = FORTUNES.find((f) => f.id === 'generous-choice');
  r.applyExpansionFortune();
  assert.deepEqual(
    r.view(a.id).mine.pending.options.map((o) => o.rewards),
    [
      [{ resource: 'rat', amount: 8 }],
      [{ resource: 'dice', amount: 4 }],
      [{ resource: 'droplet', amount: 3 }],
    ],
  );
});

test('every base and expansion fortune exposes readable choices and bounded public reward data', () => {
  const base = require('../src/games/quacks-catalog').FORTUNES;
  for (const fortune of [...base, ...FORTUNES]) {
    const r = new QuacksRoom('ABCDEF', 'fortune audit', () => 0),
      a = r.add('A');
    r.add('B');
    r.configure(a.id, { witches: true, alchemists: true });
    r.start();
    for (const player of r.players)
      r.act(player.id, 'patient', {
        patientId: r.patientChoices[0],
        roundId: r.roundId,
        requestId: randomUUID(),
      });
    for (const p of r.players) {
      p.pending = [];
      p.rat = 3;
      p.rubies = 4;
    }
    r.fortune = fortune;
    r.applyFortune();
    assert.ok(['round', 'immediate'].includes(fortune.timing), fortune.id);
    for (const player of r.players)
      for (const pending of [r.view(player.id).mine.pending].filter(Boolean))
        for (const option of pending.options) {
          assert.ok(option.label.trim().length > 0, fortune.id);
          assert.ok(Array.isArray(option.rewards), fortune.id);
          for (const reward of option.rewards) {
            assert.ok(['progress', 'ruby', 'droplet', 'rat', 'dice'].includes(reward.resource));
            assert.ok(Number.isInteger(reward.amount) && reward.amount > 0);
          }
          assert.equal('ops' in option, false, 'private operations are not exposed');
        }
  }
});
