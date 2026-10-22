'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');

// Issue #165: closing the media window exits a playing YouTube video, so other
// dialogs (invite, confirm, help) must leave it open underneath them.
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
