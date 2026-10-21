'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../node_modules/typescript');
const vue = require('../node_modules/vue');
const { parse, compileScript } = require('../node_modules/vue/compiler-sfc');
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id),
    },
  );
  return module.exports;
}
test('all eight server patient tracks retain structured rewards and reject malformed rewards', () => {
  const { QuacksRoom } = require('../../src/games/quacks');
  const { catalog } = require('../../src/games/quacks-alchemy');
  const room = new QuacksRoom(
    'ABCDEF',
    'test',
    () => 0,
    () => 1000,
  );
  const host = room.add('host');
  const raw = { ...room.view(host.id), serverNow: 1000, patients: catalog() };
  const { readQuacksSnapshot } = load(path.resolve(__dirname, '../src/contracts/quacks.ts'));
  const parsed = readQuacksSnapshot(raw);
  assert.equal(parsed.patients.length, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.patients)), raw.patients);
  for (const invalid of [
    { dice: -1 },
    { chip: { color: 'unknown', value: 1 } },
    { refill: 'yes' },
  ]) {
    const broken = structuredClone(raw);
    Object.assign(broken.patients[0].track[1], invalid);
    assert.throws(() => readQuacksSnapshot(broken));
  }
});
test('actual distillery component only confirms reachable slots while available; inspecting is read only', async () => {
  const { catalog } = require('../../src/games/quacks-alchemy');
  const filename = path.resolve(__dirname, '../src/pages/quacks/QuacksFlask.vue');
  const source = compileScript(parse(fs.readFileSync(filename, 'utf8')).descriptor, {
    id: 'distillery',
  }).content;
  const calls = [];
  const game = vue.reactive({ available: true, command: (...args) => calls.push(args) });
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? { ...vue, onBeforeUnmount() {} }
          : id.includes('stores/quacks')
            ? { useQuacksStore: () => game }
            : {},
      document: { hidden: true },
      window: {},
    },
  );
  const props = vue.reactive({
    patient: catalog().find((p) => p.id === 'eyes'),
    value: 6,
    max: 6,
    selecting: true,
    final: false,
  });
  const scope = vue.effectScope();
  let component;
  scope.run(() => {
    component = module.exports.default.setup(props, { expose() {} });
  });
  try {
    assert.equal(component.slots.value.length, 11);
    component.choose(10);
    assert.equal(calls.length, 0);
    assert.match(component.hint(10), /擲骰 4 次/);
    component.choose(2);
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['essence', { position: 2 }]]);
    game.available = false;
    component.choose(1);
    props.selecting = false;
    game.available = true;
    component.choose(3);
    assert.equal(calls.length, 1);
    props.final = true;
    await vue.nextTick();
    assert.match(component.hint(10), /10 分/);
    assert.doesNotMatch(component.hint(10), /擲骰/);
    assert.equal(component.inspected.value, null);
    assert.equal(component.shown.value, 6);
  } finally {
    scope.stop();
  }
});
