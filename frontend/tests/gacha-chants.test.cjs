const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { catalog } = require('../../src/gacha/catalog');
const attacks = require('../../public/shared/attack-effects.json');
const variants = require('../../public/shared/entrance-palette.json').variants;
const source = fs.readFileSync(
  path.join(__dirname, '../src/components/GachaSpotlight.vue'),
  'utf8',
);
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const code = ts.transpileModule(script, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function chant(item) {
  const definition = attacks.find((effect) => effect.id === item.id);
  return new Function(
    'exports',
    'require',
    'defineProps',
    'defineEmits',
    code + '\nreturn chant.value;',
  )(
    {},
    (name) => {
      if (name === 'vue')
        return {
          computed: (get) => ({
            get value() {
              return get();
            },
          }),
          ref: (value) => ({ value }),
          onMounted() {},
          onBeforeUnmount() {},
        };
      if (name === '../services/entrance-effects')
        return {
          isEntranceEffect: () => item.kind === 'entrances',
          entranceVariant: (id) => variants.find((effect) => effect.id === id),
        };
      if (name.endsWith('attack-effects.json')) return { default: attacks };
      if (
        name.endsWith('.vue') ||
        name.endsWith('motion-lifetime.js') ||
        name.endsWith('audio-settings.js')
      )
        return {};
      throw Error(name);
    },
    () => ({
      item,
      attackId: item.kind === 'attacks' ? definition?.variantOf || item.id : undefined,
    }),
    () => () => {},
  );
}
test('every legendary reward resolves two chant lines, including alternate entrance inheritance', () => {
  for (const item of catalog.filter((item) => item.rarity === 'legendary')) {
    const lines = chant(item);
    assert.equal(lines?.length, 2, item.key);
    assert.ok(
      lines.every((line) => typeof line === 'string' && line.trim()),
      item.key,
    );
    const variant = item.kind === 'entrances' && variants.find((effect) => effect.id === item.id);
    if (variant)
      assert.deepEqual(
        lines,
        chant(catalog.find((base) => base.key === 'entrances:' + variant.variantOf)),
        item.key,
      );
  }
});
test('coffin dance uses the user-approved chant without substituting the draft', () => {
  assert.deepEqual(chant(catalog.find((item) => item.key === 'entrances:arrival-coffin-dance')), [
    '黑人抬轎，鼓點開路。',
    '今夜不送別，只迎我登場',
  ]);
});
