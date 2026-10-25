const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
('use strict');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const ts = require('../node_modules/typescript');

function load(connection) {
  const links = [],
    idle = [],
    module = { exports: {} };
  const window = { requestIdleCallback: (task) => idle.push(task), setTimeout };
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.resolve(__dirname, '../src/services/preload.ts'), 'utf8'),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    withEngineImports({
      module,
      exports: module.exports,
      window,
      navigator: { connection },
      document: {
        createElement: () => ({}),
        head: { append: (link) => links.push(link) },
      },
    }),
  );
  return { ...module.exports, links, idle };
}

test('warming prefetches each URL once, at idle time', () => {
  const preload = load(undefined);
  preload.warm(['/a.webp', '/b.mp3', '/a.webp', '']);
  assert.equal(preload.links.length, 0);
  preload.idle.splice(0).forEach((task) => task());
  assert.deepEqual(
    preload.links.map((link) => [link.rel, link.href]),
    [
      ['prefetch', '/a.webp'],
      ['prefetch', '/b.mp3'],
    ],
  );
  preload.warm(['/a.webp', '/c.js'], { idle: false });
  assert.deepEqual(
    preload.links.map((link) => link.href),
    ['/a.webp', '/b.mp3', '/c.js'],
  );
});

test('save-data and slow connections skip warming entirely', () => {
  for (const connection of [
    { saveData: true },
    { effectiveType: '2g' },
    { effectiveType: 'slow-2g' },
    { effectiveType: '3g' },
  ]) {
    const preload = load(connection);
    assert.equal(preload.preloadAllowed(), false);
    preload.warm(['/a.webp'], { idle: false });
    assert.equal(preload.links.length, 0);
  }
  assert.equal(load({ effectiveType: '4g' }).preloadAllowed(), true);
});
