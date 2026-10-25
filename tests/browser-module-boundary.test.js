'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { check } = require('../tools/check-frontend-modules.cjs');
const catalog = require('../tools/browser-modules.json');

test('new game documents retain their mount and module entry after classic script removal', () => {
  const pages = require('../frontend/pages.json');
  for (const game of ['ceo', 'second-wind']) {
    assert.ok(pages.some((page) => page.id === game && page.route === '/' + game));
    const html = fs.readFileSync(
      path.join(__dirname, '../frontend/pages', game, 'index.html'),
      'utf8',
    );
    assert.match(html, new RegExp(`id="${game}-app"`));
    assert.match(html, /id="site-header-app"/);
    assert.match(html, /<title>[^<]+<\/title\s*>/);
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)];
    assert.equal(scripts.length, 1);
    assert.match(scripts[0][1], /type="module"/);
    assert.ok(scripts[0][1].includes(`/src/pages/${game}/main.ts`));
  }
});

test('all retired script URLs fail closed, while documents require their registered Vite build', async (t) => {
  const { base } = await appFixture(t);
  for (const [old] of Object.values(catalog)) {
    const route = '/' + old.replace(/^public\//, '');
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  for (const route of [
    '/lobby.js',
    '/shared/table-media.js',
    '/sound-library.js',
    '/game-audio-admin.js',
  ])
    assert.equal((await fetch(base + route)).status, 404, route);
  assert.deepEqual(check(), []);
});

test('module boundary check rejects newly added classic scripts and global API dependencies', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-module-boundary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['public', 'frontend/pages/probe', 'frontend/src', 'tools'])
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, 'tools/browser-modules.json'), JSON.stringify(catalog));
  fs.writeFileSync(
    path.join(root, 'frontend/pages/probe/index.html'),
    '<script type="module" src="/src/main.ts"></script>',
  );
  assert.deepEqual(check(root), []);
  fs.writeFileSync(path.join(root, 'public/forgotten.js'), 'window.MotionPolicy = {};');
  fs.writeFileSync(
    path.join(root, 'frontend/pages/probe/index.html'),
    '<script src="/forgotten.js"></script>',
  );
  fs.writeFileSync(path.join(root, 'frontend/src/main.ts'), 'window.AudioSettings?.stopEffects();');
  const errors = check(root);
  assert.equal(errors.length, 3);
  assert.ok(errors.some((error) => error.includes('executable source')));
  assert.ok(errors.some((error) => error.includes('ES module entries')));
  assert.ok(errors.some((error) => error.includes('AudioSettings')));
});
