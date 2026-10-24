const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
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
    withEngineImports({
      module,
      exports: module.exports,
      require: (id) =>
        id.startsWith('.') ? load(path.resolve(path.dirname(file), id + '.ts')) : require(id),
    }),
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
  // The selectable track lives in QuacksPatientBoard; QuacksFlask only forwards `choose`.
  const { catalog } = require('../../src/games/quacks-alchemy');
  const filename = path.resolve(__dirname, '../src/pages/quacks/QuacksPatientBoard.vue');
  const source = compileScript(parse(fs.readFileSync(filename, 'utf8')).descriptor, {
    id: 'distillery',
  }).content;
  const emitted = [];
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      require: (id) => (id === 'vue' ? { ...vue, onBeforeUnmount() {} } : {}),
      document: { hidden: true },
      window: {},
    }),
  );
  const props = vue.reactive({
    patient: catalog().find((p) => p.id === 'eyes'),
    value: 6,
    max: 6,
    selecting: true,
    available: true,
    final: false,
  });
  const scope = vue.effectScope();
  let component;
  scope.run(() => {
    component = module.exports.default.setup(props, {
      expose() {},
      emit: (...args) => emitted.push(args),
    });
  });
  const event = { currentTarget: {} };
  try {
    assert.equal(component.slots.value.length, 11);
    await component.choose(10, event);
    assert.equal(emitted.length, 0, 'unreachable slots only open their description');
    assert.equal(component.inspected.value, 10);
    assert.match(component.hint(10), /擲骰 4 次/);
    await component.choose(2, event);
    assert.deepEqual(JSON.parse(JSON.stringify(emitted)), [['choose', 2]]);
    props.available = false;
    await component.choose(1, event);
    props.available = true;
    props.selecting = false;
    await component.choose(3, event);
    assert.equal(emitted.length, 1);
    props.final = true;
    await vue.nextTick();
    assert.match(component.hint(10), /10 分/);
    assert.doesNotMatch(component.hint(10), /擲骰/);
  } finally {
    scope.stop();
  }
});
