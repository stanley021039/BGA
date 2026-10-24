'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
test('every shared header loads the primitive styles used by icon-only theme controls', () => {
  const dir = path.join(__dirname, '../public'),
    pages = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.html'))
      .map((name) => ({ name, html: fs.readFileSync(path.join(dir, name), 'utf8') }))
      .filter((page) => page.html.includes('data-site-header'));
  assert.ok(pages.length >= 20);
  for (const { name, html } of pages) {
    assert.match(
      html,
      /<link\b[^>]*href="\/shared\/ui-primitives\.css"/,
      name + ' must clip the accessible icon caption',
    );
    assert.ok(
      html.indexOf('/shared/ui-primitives.css') < html.indexOf('/shared/site-header.js'),
      name + ' styles must load before header mount',
    );
  }
});

test('every settings entry has the shared player appearance module before it mounts', () => {
  const dir = path.join(__dirname, '../public');
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dir, name), 'utf8');
    if (!html.includes('/shared/site-header.js')) continue;
    assert.equal((html.match(/src="\/shared\/media-appearance.js"/g) || []).length, 1, name);
    assert.ok(
      html.indexOf('/shared/barrage-frames.js') < html.indexOf('/shared/media-appearance.js'),
      name,
    );
    assert.ok(
      html.indexOf('/shared/media-appearance.js') < html.indexOf('/shared/site-header.js'),
      name,
    );
  }
  const settings = fs.readFileSync(path.join(dir, 'settings.html'), 'utf8');
  assert.match(settings, /id="settings-media-frame"/);
  assert.match(settings, /id="settings-media-preview"/);
});
