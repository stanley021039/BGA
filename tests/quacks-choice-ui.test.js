'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('./helpers/browser-modules.cjs'),
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
