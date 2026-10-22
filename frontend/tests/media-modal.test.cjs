'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');

// Issue #165: other dialogs must not change the media window presentation.
// Issue #175 separately makes the window's own close action retain playback.
test('opening another modal does not close the room media window', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/components/RoomMedia.vue'),
    'utf8',
  );
  const start = source.indexOf('new MutationObserver(');
  assert.ok(start > 0, 'RoomMedia still watches for dialogs opening');
  const callback = source.slice(start, source.indexOf('observer.observe(', start));
  assert.doesNotMatch(callback, /\bclose\(\)/);
  assert.doesNotMatch(callback, /setWindow\(false/);
  assert.match(callback, /maybeConsent\(\)/);
});

// Issue #176: Safari does not focus buttons on click, so the recent list must
// keep focus in the URL field instead of closing before the click lands.
test('recent video list survives pointer selection and exposes combobox semantics', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/components/RoomMedia.vue'),
    'utf8',
  );
  const section = source.match(/<section[^>]*class="vue-media-recent"[^>]*>/);
  assert.ok(section, 'recent list section exists');
  assert.match(section[0], /@mousedown\.prevent/);
  const input = source.match(/<input[^>]*:id="id \+ '-url'"[^>]*\/>/);
  assert.ok(input, 'URL input exists');
  assert.match(input[0], /role="combobox"/);
  assert.match(input[0], /:aria-expanded="recentOpen"/);
  assert.match(
    source,
    /上傳新歌曲<span aria-hidden="true">↗<\/span>/,
    'the decorative arrow stays out of the link name',
  );
});
