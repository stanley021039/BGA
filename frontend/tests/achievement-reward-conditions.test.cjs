const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  path = require('node:path'),
  fs = require('node:fs'),
  vm = require('node:vm');
const ts = require('../node_modules/typescript'),
  { parse, compileScript } = require('../node_modules/vue/compiler-sfc');
const { definitions } = require('../../src/achievements/catalog'),
  { rewards } = require('../../src/achievements/rewards');
test('reward cards show the actual catalog unlock condition for all 24 frames', async () => {
  const file = path.resolve(__dirname, '../src/components/AchievementRewards.vue');
  const script = compileScript(parse(fs.readFileSync(file, 'utf8')).descriptor, {
    id: 'conditions',
  }).content;
  let resourceLoader;
  const module = { exports: {} };
  const validation = {
    record: (v) => v,
    array: (v) => (Array.isArray(v) ? v : []),
    text: (v) => (typeof v === 'string' ? v : ''),
  };
  vm.runInNewContext(
    ts.transpileModule(script, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      require: (id) =>
        id === 'vue'
          ? { ...require('../node_modules/vue'), onMounted() {} }
          : id.includes('resource')
            ? {
                useResource: (fn) => {
                  resourceLoader = fn;
                  return {};
                },
              }
            : id.includes('mutation')
              ? { useMutation: () => ({}) }
              : id.includes('preferences')
                ? { usePreferencesStore: () => ({}) }
                : id.includes('validation')
                  ? validation
                  : {},
    }),
  );
  module.exports.default.setup({}, { expose() {} });
  const result = await resourceLoader(async () => ({ achievements: definitions, rewards }));
  assert.equal(result.length, 24);
  for (const card of result) {
    const rule = definitions.find(
      (a) => a.id === rewards.find((r) => r.frameId === card.frameId).achievementId,
    );
    assert.ok(rule);
    assert.equal(card.condition, rule.description);
    assert.ok(card.condition.length > 8);
  }
});
