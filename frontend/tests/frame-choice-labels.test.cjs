const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const { parse, compileScript } = require('vue/compiler-sfc');
const { createSSRApp, h } = require('vue');
const { renderToString } = require('vue/server-renderer');
const ts = require('typescript');
const { parseHTML } = require('linkedom');
const frames = [
  { id: 'default', label: '預設' },
  { id: 'palette', label: '彩筆調色盤', achievementId: 'draw-regular' },
  ...['星儀觀測台', '深海琉璃', '日蝕劇院'].map((label, i) => ({ id: 'legend-' + i, label })),
];
async function render(kind, owned = false) {
  const file = path.resolve(__dirname, '../src/components/FrameChoices.vue');
  const script = compileScript(
    parse(fs.readFileSync(file, 'utf8'), { filename: file }).descriptor,
    { id: 'frame-labels', inlineTemplate: true, genDefaultAs: '__component' },
  );
  const mod = new Module(file, module);
  mod.paths = module.paths;
  mod.require = (name) =>
    name === '../stores/preferences'
      ? {
          usePreferencesStore: () => ({
            frames,
            barrage: { selected: 'default' },
            media: 'default',
            canUse: (id) => id === 'default' || owned,
            setFrame() {},
          }),
        }
      : name === './FramePreview.vue'
        ? { default: { render: () => null } }
        : name === './UiChoiceCard.vue'
          ? {
              default: {
                props: ['label', 'disabled'],
                setup:
                  (props, { slots }) =>
                  () =>
                    h('button', { disabled: props.disabled }, [
                      slots.label?.(),
                      slots.selection?.(),
                    ]),
              },
            }
          : require(name);
  mod._compile(
    ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + '\nexports.default=__component;',
    file,
  );
  return parseHTML(
    '<html><body>' +
      (await renderToString(createSSRApp({ render: () => h(mod.exports.default, { kind }) }))) +
      '</body></html>',
  ).document;
}
for (const kind of ['barrage', 'media'])
  test(`${kind} distinguishes gacha locks from achievements and preserves owned selection`, async () => {
    const locked = [...(await render(kind)).querySelectorAll('button')];
    assert.match(locked[0].textContent, /使用中/);
    assert.match(locked[1].textContent, /成就尚未解鎖/);
    for (const card of locked.slice(2)) {
      assert.match(card.textContent, /抽卡或碎片兌換解鎖/);
      assert.ok(card.hasAttribute('disabled'));
    }
    const owned = [...(await render(kind, true)).querySelectorAll('button')];
    for (const card of owned.slice(1)) {
      assert.match(card.textContent, /套用外觀/);
      assert.equal(card.hasAttribute('disabled'), false);
    }
  });
