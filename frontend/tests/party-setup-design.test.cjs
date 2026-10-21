'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const vue = require('../node_modules/vue'),
  ts = require('../node_modules/typescript'),
  { parse, compileScript } = require('../node_modules/vue/compiler-sfc');
test('mode cards share the actual queued settings and preserve host/busy guards', () => {
  const game = vue.reactive({
      editable: true,
      uncertain: false,
      settings: { mode: 'majority' },
      queue: () => calls.push(game.settings.mode),
    }),
    room = vue.reactive({ busy: false }),
    calls = [];
  const file = path.resolve(__dirname, '../src/pages/majority/MajoritySetup.vue');
  const script = compileScript(parse(fs.readFileSync(file, 'utf8')).descriptor, {
      id: 'setup-design',
    }).content,
    module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(script, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? vue
          : id.includes('stores/room')
            ? { useRoomStore: () => room }
            : id.includes('stores/majority')
              ? { useMajorityStore: () => game }
              : {},
    },
  );
  const component = module.exports.default.setup({}, { expose() {} });
  component.selectMode('music');
  component.selectMode('music');
  assert.deepEqual(calls, ['music']);
  game.editable = false;
  component.selectMode('cruel');
  assert.equal(game.settings.mode, 'music');
  game.editable = true;
  room.busy = true;
  component.selectMode('scenario');
  assert.equal(game.settings.mode, 'music');
  room.busy = false;
  component.selectMode('scenario');
  assert.deepEqual(calls, ['music', 'scenario']);
});
test('settings templates do not emit stray angle brackets into the visible page', () => {
  for (const name of ['musicquiz/MusicQuizScene', 'majority/MajoritySetup', 'quacks/QuacksFlask']) {
    const parsed = parse(
      fs.readFileSync(path.resolve(__dirname, '../src/pages', name + '.vue'), 'utf8'),
    );
    assert.deepEqual(parsed.errors, []);
    function walk(node) {
      if (node.type === 2) assert.notEqual(node.content.trim(), '>', name);
      for (const child of node.children || []) walk(child);
    }
    walk(parsed.descriptor.template.ast);
  }
});
