'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
test('every shared header loads icon caption styles through the head or the scoped button module', () => {
  const pages = fs
    .readdirSync(path.join(__dirname, '../frontend/pages'))
    .map((id) => ({
      name: id,
      html: fs.readFileSync(path.join(__dirname, '../frontend/pages', id, 'index.html'), 'utf8'),
    }))
    .filter((page) => page.html.includes('data-site-header'));
  assert.ok(pages.length >= 20);
  for (const { name, html } of pages) {
    if (html.includes('/shared/ui-primitives.css')) {
      assert.match(html, /<link\b[^>]*href="\/shared\/ui-primitives\.css"/, name);
      assert.ok(html.indexOf('/shared/ui-primitives.css') < html.indexOf('</head'), name);
    } else {
      // New Vue pages must not add retired primitive CSS (AGENTS.md).
      // Their module graph must reach the component that owns caption clipping.
      assert.match(html, new RegExp(`src="/src/pages/${name}/main.ts"`), name);
      const entry = fs.readFileSync(
        path.join(__dirname, '../frontend/src/pages', name, 'main.ts'),
        'utf8',
      );
      assert.match(entry, /import.*mountPage.*runtime\/mount-page/, name);
      assert.match(
        fs.readFileSync(path.join(__dirname, '../frontend/src/runtime/mount-page.ts'), 'utf8'),
        /import SiteHeader/,
      );
      const header = fs.readFileSync(
        path.join(__dirname, '../frontend/src/components/SiteHeader.vue'),
        'utf8',
      );
      assert.match(header, /<UiButton[\s\S]*?icon-only[\s\S]*?@click="theme"/);
      const button = fs.readFileSync(
        path.join(__dirname, '../frontend/src/components/UiButton.vue'),
        'utf8',
      );
      assert.match(button, /'ui-sr-only': iconOnly/);
      assert.match(
        button,
        /<style scoped>[\s\S]*?\.ui-sr-only\s*\{[\s\S]*?clip:\s*rect\(0, 0, 0, 0\)/,
      );
    }
  }
});
