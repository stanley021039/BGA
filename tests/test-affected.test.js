'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('./helpers/browser-modules.cjs'),
  os = require('node:os'),
  path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
  planChanges,
  packageOnlySafeChange,
  createPlan,
  parseArgs,
  executePlan,
} = require('../tools/test-affected.cjs');
const all = fs
  .readdirSync(__dirname)
  .filter((n) => n.endsWith('.test.js'))
  .map((n) => 'tests/' + n);
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-affected-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), value);
  };
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const commit = () => {
    git(['add', '.']);
    git([
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'fixture',
    ]);
  };
  write('.gitignore', 'work/\n');
  write('tests/leaf.test.js', "require('node:test')('leaf',()=>{});\n");
  write('tests/release.test.js', '');
  write('tests/test-affected.test.js', '');
  write('tools/release.cjs', 'process.exitCode=0;');
  write(
    'package.json',
    JSON.stringify({
      version: '1.0.0',
      scripts: { test: 'node --test tests/*.test.js' },
      dependencies: { example: '1.0.0' },
    }),
  );
  write(
    'package-lock.json',
    JSON.stringify({
      version: '1.0.0',
      packages: { '': { version: '1.0.0' }, 'node_modules/example': { version: '1.0.0' } },
    }),
  );
  git(['init', '-q', '-b', 'main']);
  commit();
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  return { root, write, git, commit };
}

test('explicit mapping unions tests, direct tests select themselves, and docs select none', () => {
  const plan = planChanges(
    [
      'frontend/src/pages/login/main.ts',
      'frontend/src/pages/login/LoginPage.vue',
      'tests/auth.test.js',
    ],
    all,
  );
  assert.equal(plan.mode, 'affected');
  assert.ok(plan.tests.includes('tests/auth.test.js'));
  assert.ok(plan.tests.includes('tests/merged-app-resources.test.js'));
  assert.equal(plan.tests.length, new Set(plan.tests).size);
  assert.deepEqual(plan.tests, [...plan.tests].sort());
  assert.equal(planChanges(['docs/PR-REVIEW.md', 'AGENTS.md', 'README.md'], all).mode, 'none');
  assert.equal(planChanges([], all).mode, 'none');
  assert.deepEqual(planChanges(['tests/auth.test.js'], all).tests, ['tests/auth.test.js']);
});

test('unknown, shared, core, dependency, fixture and deleted-test paths fall back to all tests', () => {
  for (const file of [
    'src/app.js',
    'src/auth/index.js',
    'src/db/index.js',
    'public/shared/ui-components.js',
    'public/club-pages.css',
    'public/login.html',
    'public/login.js',
    'new-feature.js',
    'tests/helpers/new.cjs',
    'tests/deleted.test.js',
    'package.json',
    'package-lock.json',
  ]) {
    const plan = planChanges([file, 'tests/auth.test.js'], all);
    assert.equal(plan.mode, 'full', file);
    assert.equal(plan.tests.length, all.length, file);
    assert.ok(plan.fullReasons.length);
  }
  assert.equal(
    planChanges(['frontend/src/pages/login/LoginPage.vue'], ['tests/only.test.js']).mode,
    'full',
    'missing mapped tests cannot silently disappear',
  );
  assert.throws(() => planChanges([], []), /找不到/);
});

test('package exception allows only version metadata and the exact affected command', () => {
  const original = {
    version: '1.0.0',
    scripts: { test: 'node --test tests/*.test.js' },
    engines: { node: '>=22' },
    dependencies: { x: '1' },
  };
  const next = structuredClone(original);
  next.version = '1.1.0';
  next.scripts['test:affected'] = 'node tools/test-affected.cjs';
  assert.equal(packageOnlySafeChange('package.json', original, next), true);
  for (const mutate of [
    (p) => (p.dependencies.x = '2'),
    (p) => (p.engines.node = '>=24'),
    (p) => (p.scripts.test = 'exit 0'),
    (p) => (p.scripts['test:affected'] = 'echo skipped'),
    (p) => (p.scripts.pretest = 'exit 0'),
  ]) {
    const changed = structuredClone(next);
    mutate(changed);
    assert.equal(packageOnlySafeChange('package.json', original, changed), false);
  }
  const lock = {
      version: '1.0.0',
      packages: { '': { version: '1.0.0' }, 'node_modules/x': { version: '1' } },
    },
    updated = structuredClone(lock);
  updated.version = '1.1.0';
  updated.packages[''].version = '1.1.0';
  assert.equal(packageOnlySafeChange('package-lock.json', lock, updated), true);
  updated.packages['node_modules/x'].version = '2';
  assert.equal(packageOnlySafeChange('package-lock.json', lock, updated), false);
});

test('Git collection includes branch commits, index, working tree, and untracked files but not ignored files', (t) => {
  const f = fixture(t);
  f.git(['switch', '-qc', 'feature']);
  f.write('tests/leaf.test.js', '// branch\n');
  f.commit();
  f.write('tests/staged.test.js', '');
  f.git(['add', 'tests/staged.test.js']);
  f.write('README.md', 'unstaged');
  f.write('tests/untracked.test.js', '');
  f.write('work/ignored.js', '');
  const plan = createPlan(f.root);
  assert.equal(plan.mode, 'affected');
  assert.equal(plan.dirty, true);
  assert.deepEqual(
    plan.changes.map((c) => c.file),
    ['README.md', 'tests/leaf.test.js', 'tests/staged.test.js', 'tests/untracked.test.js'],
  );
  assert.deepEqual(plan.tests, [
    'tests/leaf.test.js',
    'tests/staged.test.js',
    'tests/untracked.test.js',
  ]);
  assert.equal(plan.mergeBase, f.git(['rev-parse', 'origin/main']));
});

test('index changes reverted in the working tree are still selected; staged dependencies force full', (t) => {
  const f = fixture(t),
    original = fs.readFileSync(path.join(f.root, 'tests/leaf.test.js'), 'utf8');
  f.write('tests/leaf.test.js', '// staged');
  f.git(['add', 'tests/leaf.test.js']);
  f.write('tests/leaf.test.js', original);
  assert.deepEqual(createPlan(f.root).tests, ['tests/leaf.test.js']);
  const pkg = fs.readFileSync(path.join(f.root, 'package.json'), 'utf8'),
    changed = JSON.parse(pkg);
  changed.dependencies.example = '2.0.0';
  f.write('package.json', JSON.stringify(changed));
  f.git(['add', 'package.json']);
  f.write('package.json', pkg);
  assert.equal(createPlan(f.root).mode, 'full');
});

test('package-only version and command wiring select release and selector tests', (t) => {
  const f = fixture(t),
    pkg = JSON.parse(fs.readFileSync(path.join(f.root, 'package.json')));
  pkg.version = '1.1.0';
  pkg.scripts['test:affected'] = 'node tools/test-affected.cjs';
  f.write('package.json', JSON.stringify(pkg));
  assert.deepEqual(createPlan(f.root).tests, [
    'tests/release.test.js',
    'tests/test-affected.test.js',
  ]);
});

test('merge-base excludes unrelated upstream commits rather than comparing directly with upstream', (t) => {
  const f = fixture(t);
  f.git(['switch', '-qc', 'feature']);
  f.write('tests/leaf.test.js', '// branch');
  f.commit();
  const head = f.git(['rev-parse', 'HEAD']);
  f.git(['switch', '-q', 'main']);
  f.write('unrelated.js', 'upstream');
  f.commit();
  f.git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  f.git(['switch', '-q', 'feature']);
  const plan = createPlan(f.root);
  assert.equal(plan.head, head);
  assert.deepEqual(
    plan.changes.map((c) => c.file),
    ['tests/leaf.test.js'],
  );
});

test('missing default base falls back to full; invalid explicit bases and flags fail', (t) => {
  const f = fixture(t);
  f.git(['update-ref', '-d', 'refs/remotes/origin/main']);
  assert.equal(createPlan(f.root).mode, 'full');
  assert.throws(() => createPlan(f.root, { base: 'missing-ref' }), /無法解析/);
  for (const args of [
    ['--base'],
    ['--base', '-x'],
    ['--base', 'HEAD', '--base', 'HEAD'],
    ['--unknown'],
    ['--list', '--list'],
  ])
    assert.throws(() => parseArgs(args));
  assert.deepEqual(parseArgs(['--base', 'HEAD', '--json']), { base: 'HEAD', json: true });
});

test('deletion, rename, and filenames with spaces do not escape conservative selection', (t) => {
  const f = fixture(t);
  f.write('tests/space name.test.js', '');
  assert.ok(createPlan(f.root).tests.includes('tests/space name.test.js'));
  f.git(['mv', 'tests/leaf.test.js', 'tests/renamed.test.js']);
  const plan = createPlan(f.root);
  assert.equal(plan.mode, 'full');
  assert.ok(plan.changes.some((c) => c.file === 'tests/leaf.test.js'));
  assert.ok(plan.changes.some((c) => c.file === 'tests/renamed.test.js'));
});

test('unresolved conflicts are rejected before invoking tests', (t) => {
  const f = fixture(t);
  f.git(['switch', '-qc', 'other']);
  f.write('tests/leaf.test.js', 'other');
  f.commit();
  f.git(['switch', '-q', 'main']);
  f.write('tests/leaf.test.js', 'main');
  f.commit();
  assert.equal(
    spawnSync(
      'git',
      ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'merge', 'other'],
      { cwd: f.root, stdio: 'ignore' },
    ).status,
    1,
  );
  assert.throws(() => createPlan(f.root), /未解合併衝突/);
  f.git(['update-ref', '-d', 'refs/remotes/origin/main']);
  assert.throws(
    () => createPlan(f.root),
    /未解合併衝突/,
    'missing default base must not bypass conflict rejection',
  );
});

test('runner checks release first, uses argv without a shell and preserves failures', () => {
  const calls = [],
    plan = { tests: ['tests/space name.test.js'] };
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  };
  assert.equal(executePlan(plan, __dirname, { spawn }), 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].args.at(-1), 'check');
  assert.deepEqual(calls[1].args, ['--test', 'tests/space name.test.js']);
  assert.equal(calls[1].options.shell, false);
  assert.equal(executePlan(plan, __dirname, { spawn: () => ({ status: 7 }) }), 7);
  let step = 0;
  assert.equal(
    executePlan(plan, __dirname, { spawn: () => ({ status: step++ === 0 ? 0 : 3 }) }),
    3,
  );
  assert.equal(
    executePlan(plan, __dirname, { spawn: () => ({ status: null, signal: 'SIGTERM' }) }),
    1,
  );
  assert.throws(
    () => executePlan(plan, __dirname, { spawn: () => ({ error: Error('cannot start') }) }),
    /cannot start/,
  );
});

test('CLI JSON is read-only and running selected failing tests exits nonzero', (t) => {
  const f = fixture(t),
    tool = path.resolve(__dirname, '../tools/test-affected.cjs');
  f.write(
    'tests/leaf.test.js',
    "require('node:test')('failure',()=>{throw Error('expected failure');});",
  );
  const script =
    'process.exitCode=require(process.argv[1]).main(JSON.parse(process.argv[2]),process.argv[3]);';
  // Keep the outer test context: the command must still execute real child tests.
  const result = execFileSync(
    process.execPath,
    ['-e', script, tool, JSON.stringify(['--json']), f.root],
    { encoding: 'utf8' },
  );
  assert.equal(JSON.parse(result).mode, 'affected');
  const failed = spawnSync(process.execPath, ['-e', script, tool, '[]', f.root], {
    encoding: 'utf8',
  });
  assert.equal(failed.status, 1, failed.stdout + '\n' + failed.stderr);
  assert.match(failed.stdout, /expected failure/);
  f.write('tests/leaf.test.js', "require('node:test')('pass',()=>{});");
  assert.equal(
    spawnSync(process.execPath, ['-e', script, tool, '[]', f.root], { stdio: 'ignore' }).status,
    0,
  );
});
