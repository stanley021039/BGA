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
test('alchemy uses the approved distillery and retains every reward tooltip and guarded action', () => {
  // 2026-10-23: the user approved the original glass board for both preview and selection.
  const flask = read('QuacksFlask.vue'),
    board = read('QuacksPatientBoard.vue');
  assert.match(flask, /<QuacksPatientBoard/);
  assert.match(flask, /props.selecting/);
  assert.match(flask, /n <= \(props.max/);
  assert.match(flask, /game.available/);
  assert.match(board, /quacks-distillery-track/);
  assert.match(board, /quacks-distillery-rewards/);
  assert.match(board, /props.patient.track\[n\]/);
  assert.match(board, /aria-label/);
  assert.match(board, /data-ui-hint/);
  assert.match(board, /aria-label="開啟調製規則"/);
  assert.match(board, /<QuacksAlchemyRules/);
  assert.match(board, /@focus=/);
  assert.match(board, /QuacksEssenceReward/);
  assert.match(board, /n <= \(props.max/);
  assert.match(read('QuacksAlchemyRules.vue'), /\{\{ patient.text \}\}/);
  assert.match(read('QuacksAlchemy.vue'), /<QuacksFlask/);
  assert.doesNotMatch(read('QuacksAlchemy.vue'), /vue-quacks-essence-track/);
});
