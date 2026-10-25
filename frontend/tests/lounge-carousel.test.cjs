const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const ts = require('typescript'),
  vue = require('vue'),
  { parse, compileScript } = require('vue/compiler-sfc');
function execute(source, mocks) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) => mocks[id] || {},
      performance: { now: () => 1000 },
      console,
    },
  );
  return module.exports;
}
test('lounge participates in real carousel keyboard selection and cyclic navigation', async () => {
  const catalog = execute(
    fs.readFileSync(path.join(__dirname, '../src/pages/lobby/catalog.ts'), 'utf8'),
    {},
  );
  assert.equal(catalog.gameCards.filter((c) => c.id === 'lounge').length, 1);
  const prefs = { motion: { enabled: false } },
    props = vue.reactive({ modelValue: 'thunder' }),
    events = [];
  const script = compileScript(
    parse(fs.readFileSync(path.join(__dirname, '../src/pages/lobby/GameCarousel.vue'), 'utf8'))
      .descriptor,
    { id: 'lounge-carousel' },
  ).content;
  const component = execute(script, {
    vue: { ...vue, onMounted() {}, onBeforeUnmount() {} },
    './catalog': catalog,
    '../../stores/preferences': { usePreferencesStore: () => prefs },
  }).default;
  const scope = vue.effectScope();
  let state;
  scope.run(
    () =>
      (state = component.setup(props, {
        expose() {},
        emit: (event, value) => {
          events.push([event, value]);
          if (event === 'update:modelValue') props.modelValue = value;
        },
      })),
  );
  try {
    let prevented = 0;
    state.key({
      key: 'End',
      preventDefault() {
        prevented++;
      },
    });
    await vue.nextTick();
    assert.equal(props.modelValue, 'lounge');
    assert.equal(state.chosen.value.title, '場外休憩區');
    assert.equal(state.visible(state.index.value), true);
    assert.equal(state.cardStyle(state.index.value)['--slot'], 0);
    assert.equal(prevented, 1);
    await state.select(catalog.gameCards.length);
    assert.equal(props.modelValue, catalog.gameCards[0].id);
    await state.select(-1);
    assert.equal(props.modelValue, 'lounge');
    assert.equal(events.filter((e) => e[1] === 'lounge').length, 2);
  } finally {
    scope.stop();
  }
});
