const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { findings, totals, check, writeBaseline } = require('../tools/ui-check.cjs');

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-ui-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}
const quiet = (fn) => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};

test('ui check counts raw colours, raw page controls and old tokens', (t) => {
  const root = fixture(t, {
    'frontend/src/pages/demo/Demo.vue':
      '<template #add><button>x</button><input /><UiButton label="ok" /></template>\n<style>a{color:#fff;margin:tokens.space(2)}</style>\n',
    'frontend/src/components/Wrap.vue': '<template><button /></template>\n',
    'frontend/src/styles/demo.scss':
      'a { color: #12345678; background: var(--play-ink); }\n.b{color:var(--stitch-ink)}\n',
    'frontend/src/styles/stitch-tokens.scss': ':root { --stitch-ink: #111111; }\n',
  });
  const counts = totals(findings(root));
  assert.deepEqual(counts.hex, {
    'frontend/src/pages/demo/Demo.vue': 1,
    'frontend/src/styles/demo.scss': 1,
  });
  assert.deepEqual(counts['raw-control'], { 'frontend/src/pages/demo/Demo.vue': 2 });
  assert.deepEqual(counts['old-token'], {
    'frontend/src/pages/demo/Demo.vue': 1,
    'frontend/src/styles/demo.scss': 1,
  });
});

test('ui check only lets a baseline shrink and honours allow comments', (t) => {
  const root = fixture(t, { 'frontend/src/styles/a.scss': 'a { color: #fff; }\n' });
  writeBaseline(root, totals(findings(root)));
  assert.equal(check(root), true);
  fs.appendFileSync(path.join(root, 'frontend/src/styles/a.scss'), 'b { color: #000; }\n');
  assert.equal(
    quiet(() => check(root)),
    false,
    'a new raw colour fails',
  );
  fs.writeFileSync(
    path.join(root, 'frontend/src/styles/a.scss'),
    'a { color: #fff; }\n// ui-check-allow hex: third-party brand colour\nb { color: #000; }\n',
  );
  assert.equal(check(root), true, 'an explained exception passes');
  fs.writeFileSync(
    path.join(root, 'frontend/src/styles/a.scss'),
    'a { color: var(--stitch-ink); }\n',
  );
  assert.equal(
    quiet(() => check(root)),
    false,
    'a cleanup must lower the baseline',
  );
  writeBaseline(
    root,
    totals(findings(root)),
    JSON.parse(fs.readFileSync(path.join(root, '.ui-baseline.json'))),
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.ui-baseline.json'))).rules.hex, {});
  fs.writeFileSync(path.join(root, 'frontend/src/styles/a.scss'), 'a { color: #fff; }\n');
  writeBaseline(
    root,
    totals(findings(root)),
    JSON.parse(fs.readFileSync(path.join(root, '.ui-baseline.json'))),
  );
  assert.equal(
    quiet(() => check(root)),
    false,
    '--update never raises the baseline',
  );
});
