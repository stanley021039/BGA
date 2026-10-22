const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const vue = fs.readFileSync(
  path.join(__dirname, '../frontend/src/pages/bluff/BluffScene.vue'),
  'utf8',
);
const scss = fs.readFileSync(path.join(__dirname, '../frontend/src/styles/bluff.scss'), 'utf8');
const slot = vue.slice(
  vue.indexOf('class="vue-bluff-private-slot"'),
  vue.indexOf('class="vue-bluff-prepare-controls"'),
);

test('bluff identity card is the reveal control, with no separate reveal button', () => {
  assert.ok(slot.length > 0);
  assert.doesNotMatch(slot, /secretOpen = !secretOpen/, 'old standalone toggle is gone');
  const card = slot.slice(slot.indexOf('<button'), slot.indexOf('</button'));
  assert.match(card, /class="vue-bluff-private-card is-concealed"/);
  assert.match(card, /type="button"/, 'native button gives Enter/Space and focus');
  assert.match(card, /data-ui-hint/, 'shared hover/focus hint, not only native title');
  assert.match(card, /:aria-label="[\s\S]*查看我的秘密角色/);
  assert.match(card, /aria-expanded="false"/);
  assert.match(card, /:disabled="blocked \|\| !bluff\.secretVisible"/);
  assert.match(card, /@click="revealSecret"/);
  assert.match(card, /點卡片查看我的秘密角色/, 'visible touch instruction');
  assert.match(card, /秘密卡預設收起，請勿讓其他人看螢幕。/);
  assert.match(card, /看身分時間已結束，秘密卡已收起/);
  assert.match(slot, /v-if="!bluff\.secretVisible \|\| !secretOpen"/, 'concealed by default');
});

test('revealed bluff card keeps an icon-only hide control and moves focus', () => {
  const article = slot.slice(slot.indexOf('<article'), slot.indexOf('</article'));
  assert.match(article, /icon-only/);
  assert.match(article, /label="收起我的秘密角色"/);
  assert.match(article, /aria-expanded="true"/);
  assert.match(article, /@click="hideSecret"/);
  assert.match(vue, /secretOpen = ref\(false\)/);
  assert.match(vue, /async function revealSecret\(\)[\s\S]*?hideButton\.value[\s\S]*?focus\(\)/);
  assert.match(vue, /async function hideSecret\(\)[\s\S]*?revealCard\.value\?\.focus\(\)/);
  assert.match(vue, /if \(!visible\) secretOpen\.value = false/, 'deadline still re-conceals');
});

test('bluff identity card keeps one fixed box for concealed and revealed states', () => {
  const start = scss.indexOf('.vue-bluff-private-card {'),
    card = scss.slice(start, scss.indexOf('.vue-bluff-role-badge {', start));
  assert.match(card, /block-size:\s*340px/);
  assert.match(card, /&:is\(button\)/);
  assert.match(card, /&:focus-visible\s*\{\s*outline:\s*3px solid var\(--stitch-focus\)/);
  assert.match(card, /> \.vue-bluff-private-hide\s*\{\s*position:\s*absolute/);
});
