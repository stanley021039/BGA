'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
test('every shared header loads the primitive styles used by icon-only theme controls', () => {
  // Page shells are the Vue entry documents (#233); styles must be in the head before the header mounts.
  const pages = fs
    .readdirSync(path.join(__dirname, '../frontend/pages'))
    .map((id) => ({
      name: id,
      html: fs.readFileSync(path.join(__dirname, '../frontend/pages', id, 'index.html'), 'utf8'),
    }))
    .filter((page) => page.html.includes('data-site-header'));
  assert.ok(pages.length >= 20);
  for (const { name, html } of pages) {
    assert.match(
      html,
      /<link\b[^>]*href="\/shared\/ui-primitives\.css"/,
      name + ' must clip the accessible icon caption',
    );
    assert.ok(
      html.indexOf('/shared/ui-primitives.css') < html.indexOf('</head'),
      name + ' styles must load before header mount',
    );
  }
});
