'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const effects = require('../public/shared/entrance-stitch.json'),
  requirements = require('../public/shared/entrance-requirements.json');
const backgrounds = require('../public/shared/lobby-backgrounds.json'),
  { definitions } = require('../src/achievements/catalog');
const root = path.resolve(__dirname, '..');
test('all twenty imported entrance artworks have complete local animation definitions and safe static markup', () => {
  assert.equal(effects.length, 20);
  assert.equal(new Set(effects.map((e) => e.id)).size, 20);
  const css = ['entrance-stitch.css', 'entrance-stitch-repairs.css', 'entrance-stitch-update.css']
    .map((file) => fs.readFileSync(path.join(root, 'frontend/src/assets', file), 'utf8'))
    .join('\n');
  const frames = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const keywords = new Set([
    'none',
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'step-start',
    'step-end',
    'infinite',
    'normal',
    'reverse',
    'alternate',
    'alternate-reverse',
    'forwards',
    'backwards',
    'both',
    'running',
    'paused',
  ]);
  for (const effect of effects) {
    assert.match(effect.id, /^stitch-[a-z-]+$/);
    assert.ok(effect.duration >= 3000 && effect.duration <= 15000);
    assert.doesNotMatch(
      effect.html,
      /<\s*(?:script|iframe|img|image|foreignObject|audio|video)\b|\son\w+\s*=|(?:https?:|javascript:|data:)/i,
    );
    let count = 0;
    for (const animation of effect.html.matchAll(/\banimation:\s*([^";]+)/g)) {
      const value = animation[1].replace(/(?:cubic-bezier|steps)\([^)]*\)/g, '');
      for (const token of value
        .split(/[\s,]+/)
        .filter((token) => /^[a-zA-Z]/.test(token) && !keywords.has(token))) {
        assert.ok(frames.has(token), effect.id + ' missing ' + token);
        count++;
      }
    }
    assert.ok(count > 0, effect.id + ' includes real animation');
  }
  assert.equal(requirements.length, 20);
  for (const reward of requirements) {
    assert.ok([...reward.description].length <= 28);
    assert.ok(reward.description.endsWith('。'));
    assert.ok(effects.some((effect) => effect.id === reward.id));
    const definition = definitions.find((item) => item.id === reward.achievementId);
    assert.ok(definition);
    assert.ok(!['trpg', 'market'].includes(definition.game));
  }
});
test('nine Stitch backgrounds include eight personal achievement unlocks and exclude the unwanted black theme', () => {
  assert.equal(backgrounds.length, 10);
  assert.equal(backgrounds.filter((background) => background.achievementId).length, 8);
  assert.ok(!backgrounds.some((background) => background.id === 'black'));
  for (const background of backgrounds.filter((background) => background.id !== 'default')) {
    const svg = fs.readFileSync(
      path.join(root, 'frontend/src/assets/lobby-' + background.id + '-stitch.svg'),
      'utf8',
    );
    assert.match(svg, /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.doesNotMatch(svg, /<script|\son\w+=|(?:href|src)="https?:/i);
    if (background.achievementId) {
      const definition = definitions.find((item) => item.id === background.achievementId);
      assert.ok(definition);
      assert.equal(definition.game, background.game);
      assert.ok(!['market', 'trpg'].includes(definition.game));
    }
  }
});

test('the exact nine selected dynamic card artworks are local and have animation definitions', () => {
  const scenes = require('../public/shared/lobby-background-live.json');
  assert.equal(scenes.length, 9);
  assert.deepEqual(
    scenes.map((s) => s.id),
    ['castle', 'garden', 'courtroom', 'cosmic', 'ballroom', 'classroom', 'prison', 'lab', 'aurora'],
  );
  for (const scene of scenes) {
    assert.match(scene.svg, /viewBox="0 0 300 160"/);
    assert.match(scene.svg, /class="anim-/);
    assert.doesNotMatch(scene.svg, /<script|<image|<foreignObject|\son\w+=/i);
  }
  const css = fs.readFileSync(
    path.join(root, 'frontend/src/assets/lobby-background-live.css'),
    'utf8',
  );
  assert.match(css, /@keyframes lobby-live-/);
  assert.doesNotMatch(css, /@import|url\(https?:/i);
});
