const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { execFileSync } = require('node:child_process');
const {
  findings,
  totals,
  check,
  writeBaseline,
  parseBaseline,
  scanSources,
  upgradedLimits,
} = require('../tools/ui-check.cjs');

const silent = { log() {}, error() {} };
function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
}
function put(root, name, text) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), text);
}
function fixture(t, files, { commit = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-ui-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  for (const [name, text] of Object.entries(files)) put(root, name, text);
  writeBaseline(root, totals(findings(root)));
  if (commit) {
    git(root, 'init', '--quiet');
    git(root, 'config', 'user.name', 'UI check fixture');
    git(root, 'config', 'user.email', 'ui-check@example.invalid');
    git(root, 'config', 'commit.gpgSign', 'false');
    git(root, 'add', '.');
    git(root, 'commit', '--quiet', '-m', 'Existing UI drift');
  }
  return root;
}
function passes(root, baseRef = 'HEAD') {
  return check(root, { baseRef, report: silent });
}
function baseline(root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.ui-baseline.json'), 'utf8'));
}

test('ui check covers colours, page controls, old tokens and important', () => {
  const counts = totals(
    scanSources({
      'frontend/src/pages/demo/Demo.vue':
        '<template v-if="ok" #add><button>x</button><input /><UiButton label="ok" /></template>\n<style>a{color:#fff;margin:tokens.space(2)}</style>\n',
      'frontend/src/components/Wrap.vue': '<template><button /></template>\n',
      'frontend/src/styles/demo.css':
        'a { color: #12345678; background: var( --play-ink); margin: space (8); font-size: font(14); padding: t . space (2) ! important; }\n',
      'frontend/src/styles/stitch-tokens.scss':
        ':root { --stitch-ink: #111111; }\n@function space($n) { @return $n; }\n',
    }),
  );
  assert.deepEqual(counts.hex, {
    'frontend/src/pages/demo/Demo.vue': 1,
    'frontend/src/styles/demo.css': 1,
  });
  assert.deepEqual(counts['raw-control'], { 'frontend/src/pages/demo/Demo.vue': 2 });
  assert.deepEqual(counts['old-token'], {
    'frontend/src/pages/demo/Demo.vue': 1,
    'frontend/src/styles/demo.css': 4,
  });
  assert.deepEqual(counts.important, { 'frontend/src/styles/demo.css': 1 });
});

test('comments and Vue slot shorthand are not violations', () => {
  const counts = totals(
    scanSources({
      'frontend/src/pages/demo/Demo.vue':
        '<!-- <button style="color:#abc!important"> -->\n<template\n v-if="ok" #add><UiButton /></template>\n<style>/* color: #fff !important */ a {color:var(--stitch-ink)}</style>\n',
      'frontend/src/styles/demo.scss': '// color:#fff; margin:tokens.space(2) !important\n',
    }),
  );
  assert.deepEqual(counts, { hex: {}, 'raw-control': {}, 'old-token': {}, important: {} });
});

test('only explained comment directives exempt the same or following line', () => {
  const counts = totals(
    scanSources({
      'frontend/src/styles/demo.scss':
        '// ui-check-allow hex: required third-party brand colour\na { color: #fff; }\nb { color: #000; } /* ui-check-allow hex: game card face */\nc {color: #123;}\nd {color:#456;}\n',
      'frontend/src/pages/demo/Demo.vue':
        '<!-- ui-check-allow raw-control: native canvas focus control -->\n<input />\n',
    }),
  );
  assert.deepEqual(counts.hex, { 'frontend/src/styles/demo.scss': 1 });
  assert.deepEqual(counts['raw-control'], {});
});

test('a directive inside a quoted string is not an exception', () => {
  const counts = totals(
    scanSources({
      'frontend/src/pages/demo/Demo.vue':
        '<script>const description = "ui-check-allow hex: example";</script>\n<style>a {color:#fff}</style>\n',
    }),
  );
  assert.equal(counts.hex['frontend/src/pages/demo/Demo.vue'], 1);
});

for (const directive of [
  '// ui-check-allow hex',
  '// ui-check-allow hex:   ',
  '// ui-check-allow hex: ...',
  '// ui-check-allow imaginary: not a rule',
]) {
  test('rejects malformed exception: ' + directive, () => {
    assert.throws(
      () => scanSources({ 'frontend/src/styles/a.scss': directive + '\na {color:#fff}\n' }),
      /invalid ui-check-allow/,
    );
  });
}

test('cleanup can pass without editing the baseline; lowering cannot restore allowance', (t) => {
  const file = 'frontend/src/styles/a.scss',
    root = fixture(t, { [file]: 'a {color:#fff}\n' });
  assert.equal(passes(root), true);
  put(root, file, 'a {color:var(--stitch-ink)}\n');
  assert.equal(passes(root), true, 'a cleanup does not require a baseline edit');
  writeBaseline(root, totals(findings(root)), baseline(root));
  assert.deepEqual(baseline(root).rules.hex, {});
  put(root, file, 'a {color:#fff}\n');
  writeBaseline(root, totals(findings(root)), baseline(root));
  assert.equal(passes(root), false, 'a lowered working baseline cannot grow');
});

test('new violations fail even when an old one is removed in the same file', (t) => {
  const file = 'frontend/src/styles/a.scss',
    root = fixture(t, { [file]: 'a {color:#fff}\n' });
  put(root, file, 'b {color:#000}\n');
  assert.equal(passes(root), false, 'equal counts cannot fund a different occurrence');
});

test('unchanged lines survive inserted blank lines but a duplicate fails', (t) => {
  const file = 'frontend/src/styles/a.scss',
    root = fixture(t, { [file]: 'a {color:#fff}\n' });
  put(root, file, '\n\na {color:#fff}\n');
  assert.equal(passes(root), true);
  put(root, file, 'a {color:#fff}\na {color:#fff}\n');
  assert.equal(passes(root), false);
});

test('manual baseline growth fails, even with no source additions', (t) => {
  const file = 'frontend/src/styles/a.scss',
    root = fixture(t, { [file]: 'a {color:#fff}\n' });
  const changed = baseline(root);
  changed.rules.hex[file] = 99;
  put(root, '.ui-baseline.json', JSON.stringify(changed));
  assert.equal(passes(root), false);
});

test('a new file cannot borrow drift from another file', (t) => {
  const root = fixture(t, { 'frontend/src/styles/a.scss': 'a {color:#fff}\n' });
  put(root, 'frontend/src/styles/a.scss', 'a {color:var(--stitch-ink)}\n');
  put(root, 'frontend/src/styles/b.scss', 'a {color:#fff}\n');
  assert.equal(passes(root), false);
});

test('a new explained exception is explicit and does not consume the baseline', (t) => {
  const file = 'frontend/src/styles/a.scss',
    root = fixture(t, { [file]: 'a {color:var(--stitch-ink)}\n' });
  put(root, file, '// ui-check-allow hex: original third-party logo\n.logo {color:#fff}\n');
  assert.equal(passes(root), true);
  assert.deepEqual(baseline(root).rules.hex, {});
});

test('unknown Git bases and missing Git metadata fail instead of skipping comparison', (t) => {
  const root = fixture(t, { 'frontend/src/styles/a.scss': 'a {color:var(--stitch-ink)}\n' });
  assert.throws(() => passes(root, 'not-a-real-ui-base'), /readable Git base/);
  const plain = fixture(
    t,
    { 'frontend/src/styles/a.scss': 'a {color:var(--stitch-ink)}\n' },
    { commit: false },
  );
  assert.throws(() => passes(plain), /readable Git base/);
});

test('schema rejects numeric strings, nonfinite values, traversal, extra and missing rules', () => {
  const valid = {
    schemaVersion: 2,
    rules: { hex: {}, 'raw-control': {}, 'old-token': {}, important: {} },
  };
  assert.deepEqual(parseBaseline(JSON.stringify(valid)), valid);
  for (const count of ['99', 'Infinity', -1, 1.5, null]) {
    const invalid = structuredClone(valid);
    invalid.rules.hex['frontend/src/styles/a.scss'] = count;
    assert.throws(() => parseBaseline(JSON.stringify(invalid)), /Invalid UI baseline/);
  }
  const traversal = structuredClone(valid);
  traversal.rules.hex['frontend/src/../outside.scss'] = 1;
  assert.throws(() => parseBaseline(JSON.stringify(traversal)), /Invalid UI baseline/);
  const missing = structuredClone(valid);
  delete missing.rules.important;
  assert.throws(() => parseBaseline(JSON.stringify(missing)), /Invalid UI baseline/);
  const extra = structuredClone(valid);
  extra.rules.skip = {};
  assert.throws(() => parseBaseline(JSON.stringify(extra)), /Invalid UI baseline/);
});

test('schema 1 migration only adds coverage found in the supplied committed source', () => {
  const file = 'frontend/src/styles/a.scss',
    sources = {
      [file]: 'a{color:#fff;margin:tokens.space(2);background:var( --play-ink)!important}\n',
    },
    previous = {
      schemaVersion: 1,
      rules: { hex: { [file]: 1 }, 'raw-control': {}, 'old-token': { [file]: 1 } },
    };
  assert.throws(() => parseBaseline(JSON.stringify(previous)), /requires --migrate/);
  assert.deepEqual(parseBaseline(JSON.stringify(previous), { allowLegacy: true }), previous);
  const upgraded = upgradedLimits(previous, sources, totals(scanSources(sources)));
  assert.equal(upgraded.hex[file], 1);
  assert.equal(upgraded['old-token'][file], 2);
  assert.equal(upgraded.important[file], 1);
  const clean = { [file]: 'a{color:var(--stitch-ink)}\n' };
  const lowered = upgradedLimits(previous, clean, totals(scanSources(clean)));
  assert.deepEqual(lowered.hex, {});
});

test('first adoption without a base baseline does not grandfather newly added violations', (t) => {
  const root = fixture(t, { 'frontend/src/styles/a.scss': 'a {color:var(--stitch-ink)}\n' });
  fs.unlinkSync(path.join(root, '.ui-baseline.json'));
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Reference before ratchet adoption');
  const before = git(root, 'rev-parse', 'HEAD');
  put(root, 'frontend/src/styles/a.scss', 'a {color:#fff}\n');
  writeBaseline(root, totals(findings(root)));
  assert.equal(passes(root, before), false);
});

test('CI without an explicit comparison base fails visibly', (t) => {
  const root = fixture(t, { 'frontend/src/styles/a.scss': 'a {color:var(--stitch-ink)}\n' });
  assert.throws(
    () =>
      execFileSync(process.execPath, [path.join(__dirname, '../tools/ui-check.cjs')], {
        cwd: root,
        env: { ...process.env, CI: 'true', UI_CHECK_BASE_SHA: '' },
        stdio: 'pipe',
      }),
    (error) => error.status === 1 && /requires UI_CHECK_BASE_SHA/.test(error.stderr.toString()),
  );
});

test('multiline var and important matches retain their full line span', () => {
  const file = 'frontend/src/styles/a.css';
  const found = scanSources({
    [file]: 'a {\ncolor: var(\n --play-ink\n);\ncolor: red !\n important;\n}\n',
  });
  assert.deepEqual(
    found['old-token'][file].map(({ line, endLine }) => [line, endLine]),
    [[2, 3]],
  );
  assert.deepEqual(
    found.important[file].map(({ line, endLine }) => [line, endLine]),
    [[5, 6]],
  );
});

test('explained comments cover multiline spans without exempting later declarations', () => {
  const file = 'frontend/src/styles/a.css';
  const found = scanSources({
    [file]:
      'a {\n/* ui-check-allow old-token: compatibility bridge */\ncolor:var(\n --ui-ink\n);\ncolor:red !\n important; /* ui-check-allow important: third-party adapter */\npadding:0;\ncolor:blue !important;\n}\n',
  });
  assert.deepEqual(found['old-token'], {});
  assert.deepEqual(
    found.important[file].map(({ line }) => line),
    [9],
  );
});

test('a multiline occurrence touching a newly added line fails', (t) => {
  const file = 'frontend/src/styles/a.css';
  const root = fixture(t, { [file]: 'a {\ncolor:var(\n --play-ink\n);\n}\n' });
  put(root, file, 'a {\ncolor:var(\n  --play-ink\n);\n}\n');
  assert.equal(passes(root), false);
});

test('removing an old declaration cannot fund identical text under a new selector', (t) => {
  const file = 'frontend/src/styles/a.scss';
  const root = fixture(t, { [file]: '.legacy {\n color: #fff;\n}\n.fresh {}\n' });
  put(root, file, '.legacy {}\n.fresh {\n color: #fff;\n}\n');
  assert.equal(passes(root), false);
});

test('an identical native control moved into a new template parent fails', (t) => {
  const file = 'frontend/src/pages/demo/Demo.vue';
  const root = fixture(t, {
    [file]:
      '<template>\n<section class="legacy">\n<input />\n</section>\n<section class="fresh"></section>\n</template>\n',
  });
  put(
    root,
    file,
    '<template>\n<section class="legacy"></section>\n<section class="fresh">\n<input />\n</section>\n</template>\n',
  );
  assert.equal(passes(root), false);
});

test('an untracked native-control file fails even with borrowed baseline allowance', (t) => {
  const file = 'frontend/src/pages/demo/Demo.vue';
  const root = fixture(t, { [file]: '<template><UiButton /></template>\n' });
  put(root, 'frontend/src/pages/demo/New.vue', '<template><input /></template>\n');
  assert.equal(passes(root), false);
});

test('slot shorthand after a quoted comparison is not mistaken for a colour', () => {
  const counts = totals(
    scanSources({
      'frontend/src/pages/demo/Demo.vue':
        '<template v-if="count > 0" #add><UiButton /></template>\n',
    }),
  );
  assert.deepEqual(counts.hex, {});
});

test('hidden Git working-tree changes fail closed rather than skipping added-line checks', (t) => {
  const file = 'frontend/src/styles/a.scss';
  const root = fixture(t, { [file]: 'a {color:#fff}\n' });
  git(root, 'update-index', '--assume-unchanged', file);
  put(root, file, 'b {color:#000}\n');
  assert.throws(() => passes(root), /cannot verify changed source with Git diff/);
});

test('identically named sibling template blocks cannot exchange old raw controls', (t) => {
  const file = 'frontend/src/pages/demo/Demo.vue';
  const root = fixture(t, {
    [file]:
      '<template>\n<section class="same">\n<input />\n</section>\n<section class="same">\n<UiButton />\n</section>\n</template>\n',
  });
  put(
    root,
    file,
    '<template>\n<section class="same">\n<UiButton />\n</section>\n<section class="same">\n<input />\n</section>\n</template>\n',
  );
  assert.equal(passes(root), false);
});
