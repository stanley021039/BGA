const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
for (const game of [
  'bluff',
  'telephone',
  'musicquiz',
  'minimal',
  'trpg',
  'gift',
  'draw',
  'majority',
]) {
  test(game + ' room metadata uses the shared information/action container', () => {
    const html = fs.readFileSync(path.join(__dirname, '../public', game + '.html'), 'utf8');
    const tag =
      /<(div|nav)\b[^>]*class="[^"]*\bui-info-actions\b[^"]*"[^>]*>([\s\S]*?)<\/\1\s*>/.exec(html);
    assert.ok(tag, 'room actions must have an explicit layout parent');
    assert.match(tag[0], /\bui-control-row\b/);
    assert.match(tag[2], /id="roomTag"[^>]*class="ui-room-code"/);
    assert.match(tag[2], /<button\b/, 'metadata and actions belong to the same row');
    assert.match(html, /href="\/shared\/ui-primitives.css"/);
    if (['bluff', 'telephone', 'musicquiz', 'minimal', 'trpg'].includes(game)) {
      assert.match(tag[2], /id="leave"[^>]*hidden/, 'leave keeps its original visibility contract');
    }
  });
}
