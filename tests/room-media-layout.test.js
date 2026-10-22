const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const scss = fs.readFileSync(
  path.join(__dirname, '../frontend/src/styles/room-media.scss'),
  'utf8',
);
const vue = fs.readFileSync(
  path.join(__dirname, '../frontend/src/components/RoomMedia.vue'),
  'utf8',
);
const block = (source, selector, from = 0) => {
  const start = source.indexOf(selector + ' {', from);
  assert.ok(start >= 0, selector);
  return source.slice(start, source.indexOf('}', start));
};
test('room media volume stays below wrapping playback controls in its own full-width row', () => {
  const controls = block(scss, '.vue-media-controls'),
    volume = block(scss, '.vue-media-volume');
  assert.match(controls, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(44px,\s*1fr\)\)/);
  assert.match(controls, /gap:\s*8px\s+2px/);
  assert.match(volume, /grid-column:\s*1\s*\/\s*-1/);
  assert.match(volume, /inline-size:\s*100%/);
  const narrow = scss.indexOf('@container (max-width:340px)');
  assert.ok(narrow >= 0);
  assert.match(
    block(scss, '.vue-media-controls', narrow),
    /gap:\s*8px\s+0/,
    'narrow layout keeps the row gap',
  );
  const group = vue.slice(
    vue.indexOf('class="vue-media-controls"'),
    vue.indexOf('</section>', vue.indexOf('class="vue-media-controls"')),
  );
  assert.ok(
    group.includes('label="退出自己的影片"'),
    'explicit exit is distinct from hiding the window',
  );
  assert.ok(
    group.indexOf('class="vue-media-volume"') > group.lastIndexOf('icon="share"'),
    'volume row follows the control buttons',
  );
});
