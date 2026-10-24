'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

// Explicit contracts, not a dependency-graph guarantee. Unmapped paths run everything.
const AUTH_TESTS = [
  'auth-artwork',
  'auth',
  'app',
  'merged-app-resources',
  'site-header-primitives',
  'game-focus',
  'theme-contrast',
  'playful-assets',
  'ui-component-assets',
  'ui-widgets',
  'ui-widget-pages',
  'compact-ui-regression',
  'freehand-assets',
].map((name) => `tests/${name}.test.js`);
const RULES = [
  {
    matches: (file) => file === 'tools/test-affected.cjs',
    reason: '測試選取工具',
    tests: ['tests/test-affected.test.js', 'tests/release.test.js'],
  },
  {
    matches: (file) => file === 'tools/release.cjs',
    reason: '打版工具',
    tests: ['tests/release.test.js', 'tests/test-affected.test.js'],
  },
  {
    matches: (file) => file === '.github/workflows/ci.yml',
    reason: 'CI 接線；另須核對實際 CI 與提交身分',
    tests: ['tests/test-affected.test.js', 'tests/release.test.js'],
  },
  {
    matches: (file) =>
      ['public/login.html', 'public/login.js'].includes(file) ||
      file.startsWith('public/assets/auth/'),
    reason: '登入／註冊及跨頁資源契約',
    tests: AUTH_TESTS,
  },
];

function inventory(root) {
  return fs
    .readdirSync(path.join(root, 'tests'))
    .filter((name) => name.endsWith('.test.js'))
    .map((name) => 'tests/' + name)
    .sort();
}
function planChanges(files, allTests, { safePackageFiles = [] } = {}) {
  if (!allTests.length) throw Error('找不到 tests/*.test.js，不能宣稱測試通過');
  const selected = new Set(),
    changes = [],
    fullReasons = [];
  for (const file of [...new Set(files)].sort()) {
    let reason,
      tests = [];
    if (file === 'AGENTS.md' || file === 'README.md' || /^docs\/.*\.md$/.test(file))
      reason = '協作／說明文件；仍須審查';
    else if (safePackageFiles.includes(file)) {
      reason = '僅版號或 test:affected 指令接線';
      tests = ['tests/release.test.js', 'tests/test-affected.test.js'];
    } else if (/^tests\/[^/]+\.test\.js$/.test(file) && allTests.includes(file)) {
      reason = '直接修改測試檔';
      tests = [file];
    } else {
      const rule = RULES.find((rule) => rule.matches(file));
      if (rule) {
        reason = rule.reason;
        tests = rule.tests;
      } else {
        reason = '核心／共用、未知路徑或已刪測試：回退全套';
        fullReasons.push(file);
      }
    }
    for (const test of tests) {
      if (!allTests.includes(test)) fullReasons.push(`${file}：對照測試不存在 ${test}`);
      else selected.add(test);
    }
    changes.push({ file, reason });
  }
  return {
    mode: fullReasons.length ? 'full' : selected.size ? 'affected' : 'none',
    changes,
    fullReasons,
    tests: fullReasons.length ? [...allTests].sort() : [...selected].sort(),
    totalTests: allTests.length,
  };
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
}
function resolveRef(root, ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\x00-\x1f\x7f]/.test(ref))
    throw Error('無效的基準 ref');
  return git(root, ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}']).trim();
}
function packageOnlySafeChange(file, before, after) {
  const a = structuredClone(before),
    b = structuredClone(after);
  delete a.version;
  delete b.version;
  if (file === 'package.json') {
    // No arbitrary npm script may gain the narrow exception.
    const expected = 'node tools/test-affected.cjs';
    for (const pkg of [a, b])
      if (pkg.scripts && Object.hasOwn(pkg.scripts, 'test:affected')) {
        if (pkg.scripts['test:affected'] !== expected) return false;
        delete pkg.scripts['test:affected'];
      }
  } else {
    if (a.packages?.['']) delete a.packages[''].version;
    if (b.packages?.['']) delete b.packages[''].version;
  }
  return isDeepStrictEqual(a, b);
}
function createPlan(root, { base } = {}) {
  const allTests = inventory(root),
    requestedBase = base ?? 'origin/main';
  let head, baseSha, mergeBase;
  const fallback = () => ({
    ...planChanges(['<Git 或 origin/main 基準不可用>'], allTests),
    head: head ?? null,
    requestedBase,
    baseSha: null,
    mergeBase: null,
    dirty: null,
  });
  try {
    head = resolveRef(root, 'HEAD');
  } catch (error) {
    if (base !== undefined)
      throw Error('無法解析基準或共同祖先：' + requestedBase, { cause: error });
    return fallback();
  }
  if (git(root, ['diff', '--name-only', '--diff-filter=U', '-z']).length)
    throw Error('有未解合併衝突，請先解決後再測試');
  try {
    baseSha = resolveRef(root, requestedBase);
    mergeBase = git(root, ['merge-base', baseSha, head]).trim();
  } catch (error) {
    if (base !== undefined)
      throw Error('無法解析基準或共同祖先：' + requestedBase, { cause: error });
    return fallback();
  }
  // Union, not a net diff: staged edits can be reverted only in the working tree.
  const diffArgs = [
    ['diff', '--name-only', '--no-renames', '-z', mergeBase, head, '--'],
    ['diff', '--cached', '--name-only', '--no-renames', '-z', '--'],
    ['diff', '--name-only', '--no-renames', '-z', '--'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ];
  const files = diffArgs.flatMap((args) => git(root, args).split('\0')).filter(Boolean);
  const safePackageFiles = [];
  for (const file of ['package.json', 'package-lock.json'])
    if (files.includes(file)) {
      try {
        const before = JSON.parse(git(root, ['show', mergeBase + ':' + file]));
        const versions = [
          JSON.parse(git(root, ['show', head + ':' + file])),
          JSON.parse(git(root, ['show', ':' + file])),
          JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')),
        ];
        if (versions.every((after) => packageOnlySafeChange(file, before, after)))
          safePackageFiles.push(file);
      } catch {
        /* Deleted, new or unreadable package metadata must run the full suite. */
      }
    }
  return {
    ...planChanges(files, allTests, { safePackageFiles }),
    head,
    requestedBase,
    baseSha,
    mergeBase,
    dirty: git(root, ['status', '--porcelain', '-z', '--untracked-files=normal']).length > 0,
  };
}
function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--base' && !Object.hasOwn(options, 'base')) {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw Error('--base 需要有效 ref');
      options.base = value;
    } else if ((flag === '--list' || flag === '--json') && !options[flag.slice(2)])
      options[flag.slice(2)] = true;
    else
      throw Error(
        '未知或重複參數：' +
          flag +
          '；用法：npm run test:affected -- [--base <ref>] [--list] [--json]',
      );
  }
  return options;
}
function executePlan(plan, root, { spawn = spawnSync } = {}) {
  // A caller running inside node:test must not cause the child runner to skip files.
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = (args) => {
    const result = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      env,
    });
    if (result.error) throw result.error;
    if (result.signal || result.status === null) return 1;
    return result.status;
  };
  const release = run([path.join(root, 'tools', 'release.cjs'), 'check']);
  if (release !== 0) return release;
  return plan.tests.length ? run(['--test', ...plan.tests]) : 0;
}
function main(args, root = path.resolve(__dirname, '..')) {
  const options = parseArgs(args),
    plan = createPlan(root, options);
  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return 0;
  }
  console.log(`test:affected：${plan.mode}，${plan.tests.length}/${plan.totalTests} 個測試檔`);
  console.log(
    `HEAD=${plan.head ?? '未知'}；基準=${plan.requestedBase}；merge-base=${plan.mergeBase ?? '不可用'}；工作區=${plan.dirty === null ? '未知' : plan.dirty ? '有未提交變更' : '乾淨'}`,
  );
  for (const change of plan.changes) console.log(`  ${change.file} → ${change.reason}`);
  if (plan.fullReasons.length) console.log('回退原因：' + plan.fullReasons.join('；'));
  for (const test of plan.tests) console.log('  測試：' + test);
  if (plan.mode === 'none')
    console.log('沒有選到自動測試；這不是完整測試或審查通過，仍會檢查版號一致性。');
  return options.list ? 0 : executePlan(plan, root);
}
if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { planChanges, packageOnlySafeChange, createPlan, parseArgs, executePlan, main };
