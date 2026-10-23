'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  Module = require('node:module');
const { parse, compileScript } = require('vue/compiler-sfc');
const { createSSRApp, h } = require('vue');
const { renderToString } = require('vue/server-renderer');
const ts = require('typescript');

// Issue #207: the shared components are the only way pages draw controls, so
// their rendered contract (Stitch look, labels, ARIA wiring) is pinned here.
const components = path.resolve(__dirname, '../src/components');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const { descriptor } = parse(fs.readFileSync(file, 'utf8'), { filename: file });
  const script = compileScript(descriptor, {
    id: path.basename(file),
    inlineTemplate: true,
    genDefaultAs: '__component',
  });
  const code =
    ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + '\nexports.default = __component;';
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = module.paths;
  mod.require = (request) => {
    // SSR checks markup and behaviour; component styles are side-effect imports.
    if (/\.(?:css|scss)$/.test(request)) return {};
    return request.endsWith('.vue')
      ? load(path.resolve(path.dirname(file), request))
      : require(request);
  };
  mod._compile(code, file);
  cache.set(file, mod.exports);
  return mod.exports;
}
const render = (name, props, slots) =>
  renderToString(
    createSSRApp({ render: () => h(load(path.join(components, name)).default, props, slots) }),
  );

test('UiButton always renders the Stitch look with a role variant', async () => {
  const html = await render('UiButton.vue', { label: '儲存' });
  assert.match(html, /class="ui-button vue-button ui-stitch-button"/);
  assert.match(html, /data-stitch-variant="secondary"/);
  const primary = await render('UiButton.vue', {
    label: '開始',
    variant: 'primary',
    pending: true,
  });
  assert.match(primary, /data-stitch-variant="primary"/);
  assert.match(primary, /disabled/);
  assert.match(primary, /aria-busy="true"/);
  const source = fs.readFileSync(path.join(components, 'UiButton.vue'), 'utf8');
  assert.doesNotMatch(source, /\b(?:stitch|legacy)\?:/, 'no second look can be selected');
});

test('UiLink is drawn as a Stitch button', async () => {
  const html = await render('UiLink.vue', { href: '/collection', label: '收藏庫' });
  assert.match(html, /ui-stitch-button/);
  assert.match(html, /data-stitch-variant="secondary"/);
});

test('UiField labels its control and wires hint, error and caller attributes', async () => {
  const html = await render('UiField.vue', {
    id: 'nickname',
    label: '顯示暱稱',
    class: 'page-slot',
    maxlength: '32',
    'aria-describedby': 'outside',
    hint: '1–16 字',
    modelValue: '小雨',
  });
  const fieldLabel = html.match(/^<label\b[^>]*>/)?.[0];
  assert.ok(fieldLabel, 'field renders its native label');
  assert.match(fieldLabel, /class="ui-field page-slot"/);
  assert.match(fieldLabel, /\sfor="nickname"/);
  assert.match(html, /<input[^>]*id="nickname"/);
  assert.match(html, /<input[^>]*maxlength="32"/);
  assert.match(html, /<input[^>]*aria-describedby="outside nickname-message"/);
  assert.match(html, /<input[^>]*value="小雨"/);
  assert.match(html, /<span id="nickname-message" class="ui-field-message">1–16 字<\/span>/);
  assert.doesNotMatch(html, /<input[^>]*page-slot/, 'class stays on the label');

  const select = await render('UiField.vue', {
    label: '來源',
    control: 'select',
    error: '請選擇',
    modelValue: 'b',
    options: [
      { value: 'a', label: '甲' },
      { value: 'b', label: '乙' },
    ],
  });
  assert.match(select, /<select[^>]*class="ui-field-control"/);
  assert.match(select, /aria-invalid="true"/);
  assert.match(select, /<option value="a">甲<\/option><option value="b">乙<\/option>/);
  assert.match(select, /role="alert"/);
});

test('UiPanel names its region by its title and renders the action slot', async () => {
  const html = await render(
    'UiPanel.vue',
    {
      title: '房間標記',
      description: '挑選五個常用標記',
      note: '必填',
      tone: 'raised',
      density: 'compact',
    },
    { actions: () => h('button', '恢復預設'), default: () => h('p', '內容') },
  );
  const labelled = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(labelled, 'panel is labelled');
  const heading = html.match(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/);
  assert.ok(heading, 'panel renders a level-two heading');
  assert.equal(heading[1], labelled, 'panel references its actual heading');
  assert.equal(
    heading[2].replace(/<!--[\s\S]*?-->|<[^>]+>/g, '').trim(),
    '房間標記',
    'heading keeps the visible title through nested markup',
  );
  assert.match(heading[0], /class="[^"]*\bui-heading\b[^"]*"/);
  assert.match(heading[0], /data-kind="section"/);
  assert.match(html, /data-tone="raised"/);
  assert.match(html, /data-density="compact"/);
  assert.match(html, /class="ui-panel-description">挑選五個常用標記/);
  assert.match(html, /class="ui-panel-note">必填/);
  // SSR wraps slot content in <!--[-->…<!--]--> fragment markers.
  assert.match(
    html,
    /<button>恢復預設<\/button>(?:<!--\]-->)?<\/header>(?:<!--\[-->)?<p>內容<\/p>/,
  );
  const plain = await render('UiPanel.vue', {}, { default: () => 'x' });
  assert.doesNotMatch(plain, /aria-labelledby|<header/);
});

test('UiCheckbox and UiFilePick keep a visible label around the native control', async () => {
  const box = await render('UiCheckbox.vue', { label: '常用', modelValue: true, disabled: true });
  const label = box.match(/<label\b([^>]*)>([\s\S]*?)<\/label>/);
  assert.ok(label, 'checkbox keeps its visible label around the native input');
  assert.match(label[1], /class="[^"]*\bui-checkbox\b[^"]*"/);
  const checkbox = label[2].match(/<input\b[^>]*>/)?.[0];
  assert.ok(checkbox, 'label contains a native control');
  assert.match(checkbox, /\btype="checkbox"/);
  assert.match(checkbox, /\schecked(?:\s|\/?>)/, 'native checkbox is checked');
  assert.match(checkbox, /\sdisabled(?:\s|\/?>)/, 'native checkbox is disabled');
  assert.match(label[2], /<span class="ui-checkbox-label">常用<\/span>/);
  const unset = await render('UiCheckbox.vue', {
    label: '常用',
    modelValue: null,
    disabled: false,
  });
  const unsetInput = unset.match(/<input\b[^>]*>/)?.[0];
  assert.ok(unsetInput, 'unset model still renders a native checkbox');
  assert.doesNotMatch(unsetInput, /\schecked(?:\s|\/?>)/, 'unset model is unchecked');
  assert.doesNotMatch(unsetInput, /\sdisabled(?:\s|\/?>)/, 'false does not disable the input');
  const file = await render('UiFilePick.vue', {
    label: '上傳頭像',
    accept: 'image/png',
    current: 'a.png',
  });
  assert.match(file, /<label class="ui-file-pick"><span class="file-pick-label">上傳頭像/);
  assert.match(file, /type="file"/);
  assert.match(file, /a\.png/);
});
