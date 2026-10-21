const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.join(__dirname, '../frontend/src/pages/quacks'),
  read = (n) => fs.readFileSync(path.join(root, n), 'utf8');
test('ingredient and effect surfaces retain graphic aliases and the complete hover description', () => {
  for (const name of ['QuacksAlchemy', 'QuacksWitches', 'QuacksPlay'])
    assert.match(read(name + '.vue'), /<QuacksRuleVisual/);
  const s = read('QuacksRuleVisual.vue');
  assert.match(s, /:title="text"/);
  assert.match(s, /:aria-label="text"/);
  assert.match(s, /tabindex="0"/);
  assert.match(s, /<QuacksGlyph/);
  assert.doesNotMatch(
    s,
    /ruleSymbols|matchAll|v-for|quacks-rule-explanation/,
    'do not derive new diagrams from prose or show paragraphs',
  );
  assert.match(read('QuacksBooks.vue'), /\{\{ candidate.effect \}\}/);
  assert.doesNotMatch(read('QuacksBooks.vue'), /<QuacksRuleVisual/);
});
test('alchemy uses the original flask art and retains every reward tooltip and guarded action', () => {
  const s = read('QuacksFlask.vue');
  assert.match(s, /QuacksArt\?\.essenceFlask/);
  assert.match(s, /props.patient.track\[n\]/);
  assert.match(s, /aria-label/);
  assert.match(s, /createElementNS/);
  assert.match(s, /props.selecting/);
  assert.match(s, /n <= \(props.max/);
  assert.match(read('QuacksAlchemy.vue'), /<QuacksFlask/);
  assert.doesNotMatch(read('QuacksAlchemy.vue'), /vue-quacks-essence-track/);
});
