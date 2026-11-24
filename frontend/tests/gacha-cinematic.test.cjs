const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
const { window } = require('linkedom').parseHTML('<html><body></body></html>');
for (const k of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Event'])
  global[k] = k === 'window' ? window : window[k];
const vue = require('vue'),
  { parse, compileScript } = require('vue/compiler-sfc');
function evaluate(raw, imports, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(raw, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) => {
        if (!(id in imports)) throw Error(id);
        return imports[id];
      },
      ...globals,
    },
  );
  return module.exports;
}
const helper = evaluate(
  fs.readFileSync(path.join(__dirname, '../src/services/gacha-cinematic.ts'), 'utf8'),
  {},
);
test('unopened legendary and epic cards play a cue on pulse peaks and stop on pointer leave', async () => {
  const raw = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/GachaRewardCard.vue'), 'utf8'))
      .descriptor,
    { id: 'gacha-card', inlineTemplate: true },
  ).content;
  const stub = (tag) => ({
    default: vue.defineComponent({
      setup(_, ctx) {
        return () => vue.h(tag, ctx.slots.default?.());
      },
    }),
  });
  const calls = [];
  const sounds = [];
  const timers = new Map();
  let timerId = 0;
  let cancelled = 0;
  const card = evaluate(
    raw,
    {
      vue,
      '../engines/barrage-frames.js': { default: { options: [] } },
      '../engines/audio-settings.js': {
        default: {
          playEffect(cue) {
            sounds.push(cue);
            return cue;
          },
          stopEffect(cue) {
            if (cue) sounds.push('stop ' + cue);
          },
        },
      },
      '../services/motion-lifetime.js': { watchMotionCancellation: () => () => {} },
      '../engines/motion-policy.js': {
        default: {
          animate(node, _, timing) {
            calls.push([
              node.closest('section').getAttribute('data-rarity-hint'),
              timing.iterations,
            ]);
            return { cancel: () => cancelled++, ready: Promise.resolve() };
          },
        },
      },
      ...Object.fromEntries(
        [
          'FramePreview',
          'GachaRewardThumbnail',
          'GachaEffectPreview',
          'UiBadge',
          'UiButton',
          'UiHeading',
          'UiIcon',
        ].map((name) => ['./' + name + '.vue', stub('span')]),
      ),
      './UiPanel.vue': stub('section'),
      './UiChoiceCard.vue': stub('button'),
    },
    {
      setTimeout(callback, delay) {
        timers.set(++timerId, { callback, delay });
        return timerId;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
  ).default;
  const host = document.createElement('div');
  const app = vue.createApp({
    render: () =>
      vue.h(
        'div',
        ['legendary', 'epic', undefined].map((rarityHint, index) =>
          vue.h(card, { key: index, number: index + 1, rarityHint, motionEnabled: true }),
        ),
      ),
  });
  app.mount(host);
  try {
    const cards = [...host.querySelectorAll('section')];
    cards[0].dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();
    const [first, { callback, delay }] = [...timers.entries()][0];
    assert.equal(delay, 490);
    timers.delete(first);
    callback();
    assert.deepEqual(sounds, ['gacha-glint']);
    cards[0].dispatchEvent(new Event('pointerleave'));
    assert.deepEqual(sounds, ['gacha-glint', 'stop gacha-glint']);
    assert.equal(timers.size, 0);
    for (const panel of cards.slice(1)) {
      panel.dispatchEvent(new Event('pointerenter'));
      panel.dispatchEvent(new Event('pointerleave'));
    }
    await Promise.resolve();
    assert.equal(timers.size, 0);
    assert.deepEqual(calls, [
      ['legendary', Infinity],
      ['epic', Infinity],
    ]);
    assert.equal(cancelled, 2);
  } finally {
    app.unmount();
  }
});
test('epic or legendary wins before testing all-common or duplicate receipts', () => {
  for (const rarity of ['epic', 'legendary'])
    assert.equal(helper.gachaEnding([{ rarity, duplicate: true }]), 'rise');
  assert.equal(helper.gachaEnding([{ rarity: 'common', duplicate: false }]), 'fall');
  assert.equal(helper.gachaEnding([{ rarity: 'rare', duplicate: true }]), 'fall');
  assert.equal(helper.gachaEnding([{ rarity: 'rare', duplicate: false }]), 'flat');
  assert.equal(
    helper.gachaEnding([
      { rarity: 'common', duplicate: false },
      { rarity: 'rare', duplicate: true },
    ]),
    'flat',
  );
  assert.equal(helper.gachaEnding([]), 'flat');
});
test('fake-outs can swing either way before settlement, for every possible receipt', () => {
  const variantPaths = { rise: new Set(), fall: new Set() };
  const leadDirections = new Set();
  for (const sample of Array.from({ length: 100 }, (_, i) => i / 100)) {
    const good = helper.gachaChart('rise', () => sample);
    const bad = helper.gachaChart('fall', () => sample);
    const mixed = helper.gachaChart('flat', () => sample);
    for (const chart of [bad, mixed]) {
      assert.deepEqual(good.market, chart.market);
      assert.deepEqual(good.candles, chart.candles);
      assert.equal(chart.marketScale, good.marketScale);
      assert.equal(chart.marketOffset, good.marketOffset);
    }
    leadDirections.add(good.market.at(-1).up);
    assert.ok(good.market.some((segment) => segment.up));
    assert.ok(good.market.some((segment) => !segment.up));
    const lastMarket = good.market.at(-1).path.split('L')[1];
    const turnY = Number(lastMarket.split(' ')[1]);
    assert.ok(good.opening >= 40000 && good.opening <= 42999);
    assert.equal(good.baselineY, good.candles[0].y);
    assert.ok(good.last.y < good.baselineY && good.last.y < turnY);
    assert.ok(bad.last.y > bad.baselineY && bad.last.y > turnY);
    assert.ok(good.settlement >= 60000 && good.settlement <= 99999);
    assert.ok(bad.settlement >= 500 && bad.settlement <= 29999);
    assert.ok(mixed.settlement >= 35000 && mixed.settlement <= 45000);
    const openingPoints = [
      good.baselineY,
      ...good.market.map(({ path }) => Number(path.split(' ').at(-1))),
    ];
    const openingSpan = Math.max(...openingPoints) - Math.min(...openingPoints);
    const framed = openingPoints.map((y) => good.marketOffset + good.marketScale * y);
    assert.ok(good.marketScale > 1);
    assert.ok(Math.max(...framed) - Math.min(...framed) >= 130);
    assert.ok(Math.min(...framed) >= 96 - 0.01 && Math.max(...framed) <= 262 + 0.01);
    const lateQuotes = good.market
      .slice(Math.floor(good.market.length / 2))
      .map(({ quote }) => quote);
    assert.ok(Math.max(...lateQuotes) - Math.min(...lateQuotes) >= 12500);
    const quotes = [good.opening, ...good.market.map(({ quote }) => quote)];
    for (const direction of [1, -1]) {
      assert.ok(
        quotes.some(
          (quote, index) =>
            index >= 8 &&
            index < quotes.length - 10 &&
            direction * (quotes[index + 3] - quote) >= 10000,
        ),
        'the middle of the chart can swing sharply both ways within three candles',
      );
    }
    for (const [chart, rising] of [
      [good, true],
      [bad, false],
    ]) {
      const projected = (y) => chart.cameraY + chart.cameraScale * y;
      const lastLeadY = turnY;
      assert.ok(Math.abs(projected(lastLeadY) - projected(chart.last.y)) > openingSpan + 25);
      assert.ok(Math.abs(projected(chart.last.y) - (rising ? 82 : 274)) < 0.01);
      const lastBar = chart.closingCandle;
      const previousMax = Math.max(...chart.candles.slice(-7).map((bar) => bar.height));
      assert.ok(lastBar.height > previousMax);
      assert.ok(rising ? chart.last.y < lastLeadY : chart.last.y > lastLeadY);
      assert.equal(chart.closing.up, rising);
      assert.equal(lastBar.up, rising);
    }
    assert.equal(mixed.cameraScale, mixed.marketScale);
    assert.ok(Math.abs(mixed.cameraY - mixed.marketOffset) < 0.01);
    for (const [ending, chart] of Object.entries({ rise: good, fall: bad, flat: mixed })) {
      assert.equal(chart.closing.path.split('L')[0], `M${lastMarket}`);
      assert.equal(
        chart.candles.length,
        (helper.gachaTimeline.settlement - helper.gachaTimeline.trading) /
          helper.gachaTimeline.candleInterval,
      );
      assert.equal(chart.last.x - chart.panX, 500);
      assert.equal(chart.closing.path.split('L')[1], `${chart.last.x} ${chart.last.y}`);
      assert.equal(chart.closing.quote, chart.settlement);
      for (const { path, quote } of [...chart.market, chart.closing]) {
        const coordinates = path.match(/-?\d+/g).map(Number);
        assert.equal(coordinates[2] - coordinates[0], 20);
        assert.ok(coordinates[1] >= 84 && coordinates[1] <= 278);
        if (path !== chart.closing.path) assert.ok(coordinates[3] >= 84 && coordinates[3] <= 278);
        assert.equal(Math.round(278 - ((quote - 10000) * 194) / 60000) || 0, coordinates[3]);
      }
      variantPaths[ending]?.add(chart.closing.path);
    }
  }
  assert.ok(variantPaths.rise.size > 2);
  assert.ok(variantPaths.fall.size > 2);
  assert.equal(leadDirections.size, 2);
});
test('the same opening and closing prices can play different mid-market moves', () => {
  const paths = new Set();
  const lateSizes = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    let calls = 0;
    let state = seed;
    const random = () => {
      calls += 1;
      if (calls <= 3) return 0.25;
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 2 ** 32;
    };
    const chart = helper.gachaChart('fall', random);
    assert.equal(chart.opening, 40750);
    assert.equal(chart.settlement, 22624);
    const previousMax = Math.max(...chart.candles.slice(-7).map((bar) => bar.height));
    assert.ok(chart.closingCandle.height > previousMax);
    lateSizes.add(
      chart.candles
        .slice(-3)
        .map((bar) => bar.height)
        .join(','),
    );
    paths.add(chart.market.map(({ path }) => path).join(' '));
  }
  assert.equal(paths.size, 20);
  assert.ok(lateSizes.size > 5);
});
function fixture(allowed = true, image, ending = 'rise', extraProps = {}) {
  let now = 0,
    id = 0,
    blocked,
    completed = 0,
    interrupted = false,
    released = 0;
  const jobs = new Map();
  const sounds = [];
  const chart = helper.gachaChart(ending, () => 0.2);
  const raw = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/GachaCinematic.vue'), 'utf8'))
      .descriptor,
    { id: 'gacha-movie', inlineTemplate: true },
  ).content;
  const component = evaluate(
    raw,
    {
      vue,
      '../services/gacha-cinematic': { ...helper, gachaChart: () => chart },
      '../services/motion-lifetime.js': {
        motionAllowed: () => allowed,
        watchMotionCancellation: (fn) => {
          blocked = fn;
          return () => released++;
        },
      },
      './UiBadge.vue': {
        default: vue.defineComponent({
          setup(_, ctx) {
            return () => vue.h('span', ctx.slots.default?.());
          },
        }),
      },
    },
    {
      setTimeout: (fn, ms) => {
        jobs.set(++id, { fn, at: now + ms });
        return id;
      },
      clearTimeout: (i) => jobs.delete(i),
    },
  ).default;
  const host = document.createElement('div');
  document.body.append(host);
  const props = vue.reactive({ name: '測試玩家<img src=x>', image, ending, ...extraProps });
  const app = vue.createApp({
    render: () =>
      vue.h(component, {
        ...props,
        onSound: (cue) => sounds.push([now, cue]),
        onComplete: (cancelled) => {
          completed++;
          interrupted = cancelled;
        },
      }),
  });
  app.mount(host);
  return {
    host,
    jobs,
    sounds,
    chart,
    async setEnding(value) {
      props.ending = value;
      await vue.nextTick();
    },
    get completed() {
      return completed;
    },
    get interrupted() {
      return interrupted;
    },
    get released() {
      return released;
    },
    async advance(ms) {
      now = ms;
      for (const [key, job] of [...jobs])
        if (job.at <= now) {
          jobs.delete(key);
          job.fn();
        }
      await vue.nextTick();
    },
    cancel: () => blocked?.(),
    close: () => {
      app.unmount();
      host.remove();
    },
  };
}
test('cinematic reveals one receipt once and releases finite timers on complete, cancellation or unmount', async () => {
  const portrait = '/characters/01234567-89ab-4cde-8f01-23456789abcd?v=aaBBccDD_efghi-j&size=256';
  const movie = fixture(true, portrait);
  assert.ok(movie.host.textContent.includes('測試玩家<img src=x>'));
  assert.equal(movie.host.querySelector('.stock-caption'), null);
  assert.equal(movie.host.querySelector('img'), null);
  const sprite = movie.host.querySelector('.stock-player');
  assert.equal(sprite.getAttribute('href'), portrait);
  sprite.dispatchEvent(new Event('load'));
  await vue.nextTick();
  assert.equal(movie.host.querySelector('.stock-fallback'), null);
  assert.equal(movie.jobs.size, 5);
  assert.equal(movie.host.querySelectorAll('.stock-cash-note').length, 18);
  assert.equal(movie.host.querySelector('.stock-candles'), null);
  assert.equal(movie.host.querySelector('.stock-index-title').textContent, '呆丸大盤指數');
  assert.equal(movie.host.querySelector('.stock-launch-caption'), null);
  await movie.advance(1150);
  assert.equal(movie.host.querySelector('.stock-cash-rain'), null);
  assert.equal(movie.host.querySelector('.stock-launch-caption').textContent.trim(), '發射!');
  await movie.advance(2350);
  assert.equal(movie.host.querySelector('[data-phase]').getAttribute('data-phase'), 'sync');
  const rush = require('../../public/assets/game-sounds/gacha-manifest.json').files.find(
    ({ file }) => file === 'gacha-rush.mp3',
  );
  const tail = rush.durationMs - helper.gachaTimeline.trading;
  assert.ok(tail >= 200 && tail <= 400, `K-line should begin during the rush tail, got ${tail}ms`);
  await movie.advance(helper.gachaTimeline.trading - 1);
  assert.equal(movie.host.querySelector('.stock-candles'), null);
  await movie.advance(helper.gachaTimeline.trading);
  assert.equal(movie.host.querySelector('[data-phase]').getAttribute('data-phase'), 'trading');
  assert.equal(movie.host.querySelector('.stock-launch-caption'), null);
  const openingSeries = movie.host.querySelector('.stock-series');
  const openingCandles = movie.host.querySelector('.stock-candles');
  assert.ok(openingCandles);
  const bodies = openingCandles.querySelectorAll('rect');
  const smallIndex = movie.chart.candles.findIndex(
    (bar, index) => index > 8 && index < 38 && bar.height < 8,
  );
  assert.ok(smallIndex > 8);
  const small = movie.chart.candles[smallIndex];
  assert.equal(Number(bodies[smallIndex].getAttribute('height')), 8);
  assert.equal(Number(bodies[smallIndex].getAttribute('y')) + 4, small.y + small.height / 2);
  const largeIndex = movie.chart.candles.findIndex((bar) => bar.height > 8);
  assert.ok(largeIndex >= 0);
  assert.equal(
    Number(bodies[largeIndex].getAttribute('height')),
    movie.chart.candles[largeIndex].height,
  );
  assert.match(movie.host.querySelector('.stock-index-opening').textContent, /基準 4\d,\d{3} 點/);
  const live = movie.host.querySelector('.stock-index-live');
  assert.match(live.textContent, /盤中 4\d,\d{3} 點/);
  const [firstMove, secondMove] = movie.host.querySelectorAll('.stock-market path');
  secondMove.dispatchEvent(new Event('animationstart'));
  await vue.nextTick();
  const laterQuote = live.textContent;
  assert.equal(laterQuote.trim(), `盤中 ${movie.chart.market[1].quote.toLocaleString('zh-TW')} 點`);
  firstMove.dispatchEvent(new Event('animationstart'));
  await vue.nextTick();
  assert.equal(live.textContent, laterQuote);
  assert.equal(movie.host.querySelector('.stock-index-ending'), null);
  assert.equal(movie.host.querySelector('.stock-final'), null);
  assert.equal(movie.host.querySelector('[data-ending]'), null);
  await movie.advance(helper.gachaTimeline.settlement - 1);
  assert.equal(movie.host.querySelector('.stock-series'), openingSeries);
  assert.equal(movie.host.querySelector('.stock-candles'), openingCandles);
  movie.host
    .querySelector('.stock-market path:last-child')
    .dispatchEvent(new Event('animationstart'));
  await vue.nextTick();
  assert.equal(
    live.textContent.trim(),
    `盤中 ${movie.chart.market.at(-1).quote.toLocaleString('zh-TW')} 點`,
  );
  assert.equal(movie.host.querySelectorAll('.stock-final-candle').length, 0);
  assert.equal(
    movie.host.querySelector('[data-ending], .stock-limit, .stock-index-ending, .stock-breakout'),
    null,
  );
  assert.ok(
    !movie.host
      .querySelector('.stock-camera')
      .getAttribute('style')
      ?.includes('--stock-camera-scale'),
  );
  await movie.advance(helper.gachaTimeline.settlement);
  assert.equal(movie.host.querySelector('.stock-series'), openingSeries);
  assert.equal(movie.host.querySelectorAll('.stock-final-candle').length, 1);
  assert.equal(movie.host.querySelector('[data-ending]').getAttribute('data-ending'), 'rise');
  assert.match(
    movie.host.querySelector('.stock-index-ending').textContent,
    /收盤 [6-9]\d,\d{3} 點/,
  );
  assert.equal(movie.host.textContent.includes('傳說現身'), false);
  await movie.advance(helper.gachaTimeline.complete);
  assert.equal(movie.completed, 1);
  assert.equal(movie.interrupted, false);
  assert.equal(movie.jobs.size, 0);
  assert.equal(movie.released, 1);
  assert.deepEqual(movie.sounds, [
    [0, 'gacha-rush'],
    [helper.gachaTimeline.trading, 'gacha-shuffle'],
    [helper.gachaTimeline.settlement, 'gacha-success'],
  ]);
  movie.close();
  const cancelled = fixture();
  cancelled.cancel();
  await cancelled.advance(helper.gachaTimeline.complete);
  assert.equal(cancelled.completed, 1);
  assert.equal(cancelled.interrupted, true);
  assert.equal(cancelled.jobs.size, 0);
  assert.deepEqual(cancelled.sounds, [[0, 'gacha-rush']]);
  cancelled.close();
  for (const [ending, closingCue] of [
    ['fall', 'gacha-scream'],
    ['flat', 'gacha-flat'],
  ]) {
    const result = fixture(true, undefined, ending);
    await result.advance(helper.gachaTimeline.settlement);
    assert.deepEqual(result.sounds.at(-1), [helper.gachaTimeline.settlement, closingCue]);
    assert.equal(result.sounds.length, 3);
    result.close();
  }
  const unmounted = fixture();
  unmounted.close();
  assert.equal(unmounted.jobs.size, 0);
  assert.equal(unmounted.completed, 0);
  assert.equal(unmounted.released, 1);
  const reduced = fixture(false);
  assert.equal(reduced.completed, 1);
  assert.equal(reduced.interrupted, true);
  assert.equal(reduced.jobs.size, 0);
  reduced.close();
});

test('spectators resume the current market and settle only on the owner update without advancing cards', async () => {
  const elapsedMs = helper.gachaTimeline.trading + 400;
  const movie = fixture(true, undefined, 'fall', { spectator: true, elapsedMs, ending: undefined });
  await movie.advance(0);
  assert.equal(movie.host.querySelector('[data-phase]').getAttribute('data-phase'), 'trading');
  const series = movie.host.querySelector('.stock-series');
  assert.ok(series);
  assert.ok(movie.host.querySelector('.stock-candle').getAttribute('style').includes('-400ms'));
  assert.equal(movie.host.querySelector('.stock-index-ending'), null);
  await movie.advance(helper.gachaTimeline.complete);
  assert.equal(movie.completed, 0);
  assert.equal(movie.host.querySelector('[data-phase]').getAttribute('data-phase'), 'trading');
  await movie.setEnding('fall');
  assert.equal(movie.host.querySelector('[data-phase]').getAttribute('data-phase'), 'settled');
  assert.equal(movie.host.querySelector('.stock-series'), series);
  assert.ok(movie.host.querySelector('.stock-final-candle'));
  assert.deepEqual(movie.sounds, []);
  movie.close();
  assert.equal(movie.jobs.size, 0);
  const settled = fixture(true, undefined, 'rise', {
    spectator: true,
    elapsedMs: helper.gachaTimeline.settlement + 100,
  });
  await settled.advance(0);
  assert.equal(settled.host.querySelector('[data-ending]').getAttribute('data-ending'), 'rise');
  assert.equal(settled.jobs.size, 0);
  assert.equal(settled.completed, 0);
  settled.close();
});

test('ten result cards keep one live preview and cancel on selection, motion preference, hidden and unmount', async () => {
  const raw = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/GachaEffectPreview.vue'), 'utf8'))
      .descriptor,
    { id: 'live-gacha-effect', inlineTemplate: true },
  ).content;
  const prefs = vue.reactive({ motion: { enabled: true, reduced: false } });
  let allowed = true,
    alive = 0,
    peak = 0;
  const cancellations = new Set();
  const artwork = vue.defineComponent({
    setup(_, ctx) {
      vue.onMounted(() => {
        alive++;
        peak = Math.max(peak, alive);
      });
      vue.onBeforeUnmount(() => alive--);
      return () => vue.h('canvas', { 'data-live-art': true, onClick: () => ctx.emit('complete') });
    },
  });
  const preview = evaluate(raw, {
    vue,
    '../stores/preferences': { usePreferencesStore: () => prefs },
    '../services/entrance-effects': { isEntranceEffect: () => true },
    '../services/motion-lifetime.js': {
      motionAllowed: () => allowed,
      watchMotionCancellation: (cancel) => {
        cancellations.add(cancel);
        return () => cancellations.delete(cancel);
      },
    },
    './AttackArtwork.vue': { default: artwork },
    './EntrancePreview.vue': { default: artwork },
    './UiIcon.vue': { default: vue.defineComponent({ setup: () => () => vue.h('span') }) },
  }).default;
  const selected = vue.ref(0),
    replay = vue.ref(0);
  const app = vue.createApp({
    setup: () => () =>
      Array.from({ length: 10 }, (_, i) =>
        vue.h(preview, {
          key: i,
          kind: 'attacks',
          effect: 'beam',
          active: selected.value === i,
          playKey: replay.value,
        }),
      ),
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  app.mount(host);
  const flush = async () => {
    await vue.nextTick();
    await vue.nextTick();
  };
  await flush();
  assert.equal(alive, 1);
  assert.equal(cancellations.size, 1);
  selected.value = 7;
  await flush();
  assert.equal(alive, 1);
  assert.equal(peak, 1);
  prefs.motion.enabled = false;
  await flush();
  assert.equal(alive, 0);
  assert.equal(cancellations.size, 0);
  prefs.motion.enabled = true;
  await flush();
  assert.equal(alive, 0);
  replay.value++;
  await flush();
  assert.equal(alive, 1);
  allowed = false;
  for (const cancel of [...cancellations]) cancel();
  await flush();
  assert.equal(alive, 0);
  allowed = true;
  await flush();
  assert.equal(alive, 0);
  replay.value++;
  await flush();
  assert.equal(alive, 1);
  host.querySelector('canvas').click();
  await flush();
  assert.equal(alive, 0);
  assert.equal(cancellations.size, 0);
  replay.value++;
  await flush();
  assert.equal(alive, 1);
  app.unmount();
  host.remove();
  assert.equal(alive, 0);
  assert.equal(cancellations.size, 0);
});

test('single effect cards autoplay while compact cards play only when selected', async () => {
  const raw = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/GachaRewardCard.vue'), 'utf8'))
      .descriptor,
    { id: 'card-preview-defaults', inlineTemplate: true },
  ).content;
  const states = [];
  const stub = (tag) => ({
    default: vue.defineComponent({ setup: (_, ctx) => () => vue.h(tag, ctx.slots.default?.()) }),
  });
  const component = evaluate(
    raw,
    {
      vue,
      '../engines/barrage-frames.js': { default: { options: [] } },
      '../engines/audio-settings.js': { default: { stopEffect() {} } },
      '../engines/motion-policy.js': { default: {} },
      '../services/motion-lifetime.js': { watchMotionCancellation: () => () => {} },
      ...Object.fromEntries(
        [
          'FramePreview',
          'GachaRewardThumbnail',
          'UiBadge',
          'UiButton',
          'UiHeading',
          'UiIcon',
          'UiChoiceCard',
        ].map((name) => ['./' + name + '.vue', stub('span')]),
      ),
      './UiPanel.vue': stub('section'),
      './GachaEffectPreview.vue': {
        default: vue.defineComponent({
          props: { active: Boolean },
          setup: (props) => {
            states.push(props.active);
            return () => vue.h('canvas');
          },
        }),
      },
    },
    { setTimeout, clearTimeout },
  ).default;
  const item = {
    key: 'attacks:shield',
    id: 'shield',
    kind: 'attacks',
    label: '六角能量護盾',
    rarity: 'common',
    rarityLabel: '普通',
    duplicate: false,
    fragments: 0,
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = vue.createApp({
    render: () => [
      vue.h(component, { item, number: 1, prominent: true }),
      vue.h(component, { item, number: 2, compact: true }),
      vue.h(component, { item, number: 3, compact: true, previewActive: true }),
    ],
  });
  app.mount(host);
  await vue.nextTick();
  assert.deepEqual(states, [true, false, true]);
  app.unmount();
  host.remove();
});

test('background previews contain the full scene while lobby artwork keeps cover and isolates every gradient', async () => {
  const scenes = require('../../public/shared/lobby-background-live.json');
  const original = scenes.find((s) => s.id === 'mars').svg;
  const raw = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/components/LobbyBackgroundArt.vue'), 'utf8'))
      .descriptor,
    { id: 'static-background-fit', inlineTemplate: true },
  ).content;
  const component = evaluate(raw, {
    vue,
    '../../../public/shared/lobby-background-live.json': { default: scenes },
    '../assets/lobby-background-live.css': {},
  }).default;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = vue.createApp({
    render: () => [
      vue.h(component, { id: 'mars' }),
      vue.h(component, { id: 'mars', fit: 'contain' }),
    ],
  });
  app.mount(host);
  await vue.nextTick();
  const svgs = host.querySelectorAll('svg');
  assert.equal(svgs.length, 2);
  assert.equal(svgs[0].getAttribute('preserveAspectRatio'), 'xMidYMid slice');
  assert.equal(svgs[1].getAttribute('preserveAspectRatio'), 'xMidYMid meet');
  const ids = [...host.querySelectorAll('svg [id]')].map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(scenes.find((s) => s.id === 'mars').svg, original);
  app.unmount();
  host.remove();
});

test('next bonus notice follows independent pool counters, live odds and the 50-draw boundary', async () => {
  const raw = compileScript(
    parse(
      fs.readFileSync(path.join(__dirname, '../src/components/GachaNextBonusNotice.vue'), 'utf8'),
    ).descriptor,
    { id: 'next-bonus-notice', inlineTemplate: true },
  ).content;
  const notice = evaluate(raw, {
    vue,
    '../../../public/shared/gacha-economy.json': { default: { bonusInterval: 50 } },
    './UiNotice.vue': {
      default: vue.defineComponent({
        props: { message: String, persistent: Boolean },
        setup: (props) => () => vue.h('p', { 'data-persistent': props.persistent }, props.message),
      }),
    },
  }).default;
  const pool = vue.ref({
    id: 'combat',
    label: '攻擊招式與大廳背景',
    drawCount: 39,
    bonusWeights: { common: 0, rare: 0, epic: 65, legendary: 35 },
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = vue.createApp({ render: () => vue.h(notice, { pool: pool.value }) });
  app.mount(host);
  assert.equal(host.textContent, '');
  pool.value.drawCount = 40;
  await vue.nextTick();
  assert.match(host.textContent, /再十連第 10 張觸發 50 抽加成/);
  pool.value.drawCount = 48;
  await vue.nextTick();
  assert.match(host.textContent, /再十連第 2 張觸發 50 抽加成/);
  pool.value.drawCount = 49;
  await vue.nextTick();
  assert.match(host.textContent, /下一抽觸發 50 抽加成/);
  assert.match(host.textContent, /史詩 65%／傳說 35%/);
  assert.equal(host.querySelector('p').getAttribute('data-persistent'), 'true');
  pool.value = {
    id: 'arrival',
    label: '進場特效',
    drawCount: 50,
    bonusWeights: { common: 0, rare: 0, epic: 65, legendary: 35 },
  };
  await vue.nextTick();
  assert.equal(host.textContent, '');
  pool.value.drawCount = 99;
  pool.value.bonusWeights = { common: 1, rare: 4, epic: 55, legendary: 40 };
  await vue.nextTick();
  assert.match(host.textContent, /^進場特效：/);
  assert.match(host.textContent, /普通 1%／稀有 4%／史詩 55%／傳說 40%/);
  pool.value.drawCount = 100;
  await vue.nextTick();
  assert.equal(host.textContent, '');
  app.unmount();
  host.remove();
});
