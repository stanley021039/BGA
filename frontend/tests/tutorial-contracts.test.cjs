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
const { createActionFeedbackQueue, readActionFeedback } = load(
  path.resolve(__dirname, '../src/services/action-feedback.ts'),
);
const event = (id, at = 1000) => ({ id, at, actor: { id: 'a', name: '小明' }, action: '送出答案' });
test('action feedback is queued by event ID, not actor name, and does not replay baseline, stale or cross-room events', () => {
  const q = createActionFeedbackQueue();
  q.update('room1', [event('old')], 1000);
  assert.equal(q.next().length, 0);
  q.update('room1', [event('old'), event('a'), event('b'), event('c'), event('d')], 1000);
  assert.deepEqual(
    Array.from(q.next(), (e) => e.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    Array.from(q.next(), (e) => e.id),
    ['d'],
  );
  q.update('room1', [event('a'), event('stale', 0)], 20000);
  assert.equal(q.next().length, 0);
  q.update('room2', [event('next')], 1000);
  assert.equal(q.next().length, 0);
  q.update('room2', [event('hidden')], 1000, true);
  assert.equal(q.next().length, 0);
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
