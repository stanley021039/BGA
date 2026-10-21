'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs');
const { mediaHarness } = require('./helpers/media-browser.cjs');
const stage = fs.readFileSync('public/shared/room-layout.js', 'utf8');
function fixture(type) {
  const f = mediaHarness();
  f.context.matchMedia = () => ({ matches: false, addEventListener() {} });
  f.document.createComment = () => f.document.createElement('comment');
  f.document.getElementById = (id) => f.document.querySelector('#' + id);
  const root = f.document.createElement('main');
  root.id = 'game';
  root.innerHTML =
    type === 'quacks'
      ? '<header class="game-heading"></header><div class="round-top"></div><section id="alchemy"></section><section id="tableDice"></section><div class="game-grid"><section class="action-panel"><div id="controls"></div></section></div><details><div id="books"></div></details><section class="ui-room-roster"></section>'
      : '<section><h2 id="phase"></h2><div id="players"></div></section><div id="roleCountdown"></div><div class="task-layout"><section id="source"></section><section><div id="controls"></div></section></div><section><div id="botStatements"></div></section><section id="currentReveal"><div id="roundReveal"></div></section>';
  const hero = f.document.createElement('section'),
    roster = f.document.createElement('section');
  root.append(hero, roster);
  f.document.body.append(root);
  vm.runInContext(stage, f.context);
  const s = {
    type,
    phase: 'brewing',
    me: 'a',
    potColors: { green: { liquid: ['a', 'b'] } },
    recipes: [
      { id: 'a', name: '甲', potColor: 'green', score: 4 },
      { id: 'b', name: '乙', score: 1 },
    ],
  };
  return {
    ...f,
    root,
    s,
    update: (waiting) => {
      s.phase = waiting ? 'waiting' : 'brewing';
      f.document.body.dataset.roomPhase = s.phase;
      f.window.RoomLayout.update(s, { hero, roster });
      return root.querySelector('.room-stage-chat');
    },
  };
}
test('workshop layout moves controls without recreating them and restores original homes on rematch', () => {
  const f = fixture('quacks'),
    controls = f.document.querySelector('#controls'),
    parent = controls.parentElement,
    grid = f.root.querySelector('.game-grid'),
    home = grid.parentElement;
  let clicks = 0;
  controls.onclick = () => clicks++;
  const chat = f.update(false);
  assert.equal(chat.className, 'room-stage-chat');
  assert.equal(grid.parentElement.className, 'room-stage-work');
  assert.equal(controls.parentElement, parent);
  controls.onclick();
  assert.equal(clicks, 1);
  const layout = f.root.querySelector('.room-stage-layout');
  f.update(false);
  assert.equal(f.root.querySelectorAll('.room-stage-layout').length, 1);
  f.update(true);
  assert.equal(layout.hidden, true);
  assert.equal(grid.parentElement, home);
  f.update(false);
  assert.equal(layout.hidden, false);
  assert.equal(f.document.querySelector('#controls'), controls);
  assert.equal(f.root.querySelectorAll('.room-stage-layout').length, 1);
  controls.onclick();
  assert.equal(clicks, 2);
});
test('bluff places the live reveal with its voting controls in the middle and friends on the left', () => {
  const f = fixture('bluff'),
    players = f.document.querySelector('#players'),
    reveal = f.document.querySelector('#roundReveal'),
    original = players.parentElement;
  f.update(false);
  assert.equal(players.parentElement.className, 'room-stage-roster');
  assert.equal(reveal.closest('section').parentElement.className, 'room-stage-work');
  f.update(true);
  assert.equal(players.parentElement, original);
  f.update(false);
  assert.equal(f.document.querySelector('#roundReveal'), reveal);
});

test('pot action docking never pulls saved settings out of the waiting-room grid on polling', () => {
  const f = fixture('quacks'),
    panel = f.document.querySelector('.action-panel'),
    waiting = f.document.createElement('div');
  f.root.append(waiting);
  f.context.$ = (selector) => f.document.querySelector(selector);
  f.context.viewedPotId = 'a';
  const source = fs.readFileSync('public/quacks.js', 'utf8');
  vm.runInContext(
    source.slice(
      source.search(/const\s+actionPanel\s*=\s*\$\('#controls'\)/),
      source.search(/function\s+render\(s\)\s*\{/),
    ),
    f.context,
  );
  waiting.append(panel);
  f.context.restorePotActions();
  assert.equal(panel.parentElement, waiting, 'initial waiting poll retains settings location');
  const pot = f.document.createElement('section');
  pot.className = 'cauldron-panel';
  f.root.querySelector('.game-grid').append(pot);
  f.context.arrangePotActions(f.s);
  assert.equal(panel.parentElement, pot);
  assert.equal(panel.hidden, false);
  f.context.arrangePotActions(f.s);
  assert.equal(panel.parentElement, pot);
  f.context.viewedPotId = 'b';
  f.context.arrangePotActions(f.s);
  assert.equal(panel.hidden, true, 'actions only appear on the own pot');
  f.context.restorePotActions();
  assert.equal(panel.classList.contains('pot-action-dock'), false);
  waiting.append(panel);
  f.context.restorePotActions();
  assert.equal(
    panel.parentElement,
    waiting,
    'saving settings after rematch cannot move the waiting controls again',
  );
});
