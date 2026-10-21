'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const { SCENARIOS } = require('../src/games/majority-scenarios'),
  { themes } = require('../src/games/majority-tournament');
function ui() {
  const fields = {},
    nodes = [],
    button = {},
    document = {
      querySelector: (s) => fields[s] || null,
      createElement: () => ({
        innerHTML: '',
        className: '',
        setAttribute() {},
        querySelector: (s) => (s === 'audio' ? null : button),
        remove() {
          this.removed = true;
        },
      }),
      body: { append: (n) => nodes.push(n) },
    };
  document.addEventListener = () => {};
  const w = { addEventListener() {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../public/majority-tournament.js'), 'utf8'),
    { window: w, document, location: { origin: 'https://game.test' } },
  );
  return { api: w.MajorityTournament, fields, nodes, w };
}
test('theme change clamps oversized brackets and cross-mode settings never reuse incompatible themes', () => {
  const { api, fields } = ui(),
    s = {
      options: { mode: 'music', theme: 'all', bracketSize: 32 },
      tournament: {
        themes: [
          { id: 'all', count: 204 },
          { id: 'classical', count: 8 },
        ],
      },
    };
  fields['#majorityMode'] = { value: 'music' };
  fields['#tournamentTheme'] = { value: 'classical' };
  fields['#tournamentSize'] = { value: '32' };
  assert.equal(api.readSettings(s).bracketSize, 8);
  assert.equal(api.readSettings(s).theme, 'classical');
  fields['#majorityMode'].value = 'scenario';
  assert.equal(api.readSettings(s).bracketSize, 8);
  assert.equal(Object.hasOwn(api.readSettings(s), 'theme'), false);
  fields['#majorityMode'].value = 'majority';
  assert.equal(Object.keys(api.readSettings(s)).length, 0);
});
test('personal preview is opt-in, survives own-answer rerender, and tears down at next question', () => {
  const { api, nodes } = ui(),
    listen = { dataset: { tournamentListen: '0' } },
    stage = { querySelectorAll: () => [listen] },
    s = {
      phase: 'answering',
      tournament: { mode: 'music' },
      question: {
        id: 'first',
        entries: [{ label: '<script>bad</script>', videoId: 'sbTVZMJ9Z2I' }],
      },
    };
  api.enhance(s, stage);
  assert.equal(nodes.length, 0);
  listen.onclick();
  assert.equal(nodes.length, 1);
  assert.match(nodes[0].innerHTML, /autoplay=0/);
  assert.ok(!nodes[0].innerHTML.includes('<script>bad'));
  api.enhance({ ...s, ownAnswer: 0 }, stage);
  assert.equal(nodes[0].removed, undefined);
  assert.equal(nodes.length, 1);
  api.enhance({ ...s, question: { ...s.question, id: 'next' } }, stage);
  assert.equal(nodes[0].removed, true);
  listen.onclick();
  assert.equal(nodes.length, 2);
  api.enhance({ ...s, phase: 'finished' }, stage);
  assert.equal(nodes[1].removed, true);
});
test('Stitch art references resolve to reviewed local PNGs or safe standalone SVGs; classical and K-pop are playable themes', () => {
  const images = new Set(SCENARIOS.map((s) => s.image));
  assert.ok(images.size >= 10);
  for (const image of images) {
    const b = fs.readFileSync(path.join(__dirname, '../public', image));
    if (image.endsWith('.svg')) {
      assert.match(b.toString(), /<svg[^>]+xmlns=/);
      assert.doesNotMatch(
        b.toString(),
        /<script|<foreignObject|<image|(?:href|onload|onclick)\s*=/i,
      );
    } else {
      assert.equal(b.subarray(1, 4).toString(), 'PNG');
      assert.ok(b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0);
    }
  }
  const t = themes('music');
  assert.ok(t.find((x) => x.id === 'classical').count >= 8);
  assert.equal(t.filter((x) => /K.?pop/i.test(x.label) && x.id.startsWith('genre:')).length, 1);
});

test('reveal visibly groups all voters with gains, own choice and percentage; answering keeps other votes secret', () => {
  const { api } = ui(),
    s = {
      phase: 'reveal',
      me: 'a',
      ownAnswer: 0,
      participantIds: ['a', 'b', 'c'],
      players: [
        { id: 'a', name: '小甲' },
        { id: 'b', name: '小乙' },
        { id: 'c', name: '小丙' },
      ],
      answers: { a: 0, b: 0, c: 1 },
      question: {
        prompt: '選哪邊',
        entries: [
          { id: 'x', label: '選項甲', detail: '', image: '/a.png' },
          { id: 'y', label: '選項乙', detail: '', image: '/b.png' },
        ],
      },
      tournament: { mode: 'scenario', stage: 8, pair: 1, ranking: [] },
      result: {
        tournament: { counts: [2, 1], advanced: { id: 'x', label: '選項甲' }, tied: false },
        gains: { a: 1, b: 1, c: 0 },
        missingIds: [],
      },
    };
  const html = api.render(s);
  for (const text of [
    '小甲（你）',
    '小乙',
    '小丙',
    '66.7%',
    '33.3%',
    '✓ 你的選擇',
    '+1 分',
    '未加分',
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /aria-label="選擇 A 的玩家"/);
  assert.match(html, /aria-label="選擇 B 的玩家"/);
  const secret = api.render({ ...s, phase: 'answering', result: null, answers: undefined });
  assert.ok(!secret.includes('小乙'));
  assert.ok(!secret.includes('66.7%'));
  assert.ok(secret.includes('✓ 你的選擇'));
});

test('mobile phase changes return the question and result to view without jumping on own-answer updates', () => {
  const { api, fields, w } = ui();
  let jumps = 0,
    resets = 0;
  fields['main.game-barrage-host'] = {
    scrollTo() {
      resets++;
    },
    scrollIntoView() {
      jumps++;
    },
  };
  w.matchMedia = () => ({ matches: true });
  const stage = { querySelectorAll: () => [] },
    s = { phase: 'answering', tournament: { mode: 'scenario' }, question: { id: 'one' } };
  api.enhance(s, stage);
  api.enhance({ ...s, ownAnswer: 0 }, stage);
  assert.equal(jumps, 1);
  api.enhance({ ...s, phase: 'reveal' }, stage);
  assert.equal(jumps, 2);
  api.enhance({ ...s, phase: 'finished', question: null }, stage);
  assert.equal(jumps, 3);
  w.matchMedia = () => ({ matches: false });
  api.enhance({ ...s, question: { id: 'two' } }, stage);
  assert.equal(jumps, 3);
  assert.equal(resets, 4);
});
