'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  { randomUUID } = require('node:crypto');
const ts = require('../node_modules/typescript'),
  { createTutorials, types } = require('../../src/tutorials/runtime');
function load(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      URL,
      require: (id) =>
        id === 'vue'
          ? require('../node_modules/vue')
          : load(path.resolve(path.dirname(file), /\.js$/.test(id) ? id : id + '.ts'), cache),
    },
  );
  return module.exports;
}
const { lessons, tutorialType } = load(
  path.resolve(__dirname, '../src/pages/tutorial/registry.ts'),
);
test('every lobby game has a typed tutorial, a discoverable learn URL and a server adapter', () => {
  const { gameCards } = load(path.resolve(__dirname, '../src/pages/lobby/catalog.ts'));
  assert.deepEqual(new Set(Object.keys(lessons)), new Set(types));
  for (const card of gameCards) {
    if (card.id === 'lounge') {
      assert.equal(card.guide, '');
      continue;
    }
    if (card.id === 'market') {
      assert.equal(card.guide, '/market?learn=1');
      continue;
    }
    const type = card.id === 'race' ? 'thunder' : card.id;
    assert.ok(lessons[type], card.id);
    assert.ok(card.guide.includes('learn=1'), card.id);
    assert.equal(tutorialType(card.guide.split('?')[0]), type);
    assert.ok(lessons[type].points.length >= 3);
  }
});
for (const type of types)
  test(`${type} tutorial snapshots pass the real shipped parser at every engine step`, () => {
    let seed = 123;
    const runtime = createTutorials({
      rng: (n) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % n;
      },
    });
    let s = runtime.start('owner', type),
      steps = 0;
    while (true) {
      const parsed = lessons[type].reader(s.snapshot);
      assert.equal(parsed.type, type);
      assert.equal(parsed.code, 'FEED00');
      if (type === 'musicquiz' && parsed.playback) {
        assert.equal(parsed.playback.provider, 'audio');
        assert.ok(parsed.playback.url.includes('tutorial='));
      }
      if (s.done) break;
      assert.ok(steps++ < 500);
      s = runtime.apply('owner', { id: s.id, revision: s.revision, requestId: randomUUID() });
    }
  });
const { mergeChatTimeline, readActionFeedback } = load(
  path.resolve(__dirname, '../src/services/action-feedback.ts'),
);
const event = (id, at = 1000) => ({ id, at, actor: { id: 'a', name: '小明' }, action: '送出答案' });
test('chat timeline interleaves public actions and messages once, with stable identities and public targets', () => {
  const messages = [{ id: 'same', name: '聊天者', message: '你好', at: 1500 }];
  const first = event('same', 1000),
    last = {
      ...event('last', 2000),
      actor: { id: 'b', name: '小明' },
      target: { id: 'c', name: '對象' },
      item: { color: 'red', value: 2 },
    };
  const rows = mergeChatTimeline(messages, [first, first, last]);
  assert.deepEqual(
    Array.from(rows, (r) => r.id),
    ['action:same', 'chat:same', 'action:last'],
  );
  assert.equal(rows[0].name, rows[2].name);
  assert.equal(rows[0].feedback.actor.id, 'a');
  assert.equal(rows[2].feedback.actor.id, 'b');
  assert.equal(rows[2].message, '送出答案 → 對象');
  assert.deepEqual({ ...rows[2].feedback.item }, { color: 'red', value: 2 });
  assert.equal(messages[0].id, 'same', 'merging must not mutate the received chat');
  assert.equal(
    mergeChatTimeline(messages, [first, first, last]).length,
    3,
    'a snapshot refresh does not append duplicates',
  );
});
test('chat action timeline is bounded and ignores malformed feedback without dropping normal chat', () => {
  const messages = Array.from({ length: 70 }, (_, i) => ({
    id: 'm' + i,
    name: '朋友',
    message: '聊天',
    at: i,
  }));
  const events = Array.from({ length: 40 }, (_, i) => event('e' + i, i));
  assert.equal(mergeChatTimeline(messages, events).length, 70);
  const rows = mergeChatTimeline(messages, { invalid: true });
  assert.equal(rows.length, 50);
  assert.equal(rows[0].id, 'chat:m20');
  assert.equal(
    mergeChatTimeline([], []).length,
    0,
    'an empty room does not retain another room timeline',
  );
  const malformed = readActionFeedback([{ id: 'bad', actor: null }, event('good')]);
  assert.deepEqual(
    Array.from(malformed, (e) => e.id),
    ['good'],
  );
});

const { createMarketPractice, tutorialForecastTick } = load(
  path.resolve(__dirname, '../src/pages/tutorial/market-practice.ts'),
);
test('market practice freezes the forecast and scores a clearly hypothetical quote with the shipped curve', () => {
  const a = createMarketPractice();
  assert.throws(() => a.forecast(101));
  assert.throws(() => a.forecast(2.5));
  a.forecast(8);
  a.next();
  assert.equal(a.snapshot().forecast, 0.8);
  assert.throws(() => a.forecast(-5));
  a.next();
  assert.equal(a.snapshot().actual, 0.8);
  a.next();
  assert.equal(a.snapshot().done, true);
  assert.ok(Number.isFinite(a.snapshot().points));
  const b = createMarketPractice();
  b.forecast(-100);
  b.next();
  b.next();
  b.next();
  assert.ok(a.snapshot().points > b.snapshot().points);
  assert.equal(createMarketPractice().snapshot().phase, 0);
});

test('market teaching input requires an explicit value on the exact 0.1% grid', () => {
  for (const v of ['', null, undefined, 0.101, 10.1, Infinity])
    assert.throws(() => tutorialForecastTick(v));
  assert.equal(tutorialForecastTick('0.8'), 8);
  assert.equal(tutorialForecastTick(-10), -100);
  assert.equal(tutorialForecastTick(10), 100);
});
