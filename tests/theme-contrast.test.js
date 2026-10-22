const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const theme = fs.readFileSync(path.join(__dirname, '../public/shared/playful-theme.css'), 'utf8');
function declarations(block) {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}
const light = declarations(theme.slice(theme.indexOf('{') + 1, theme.indexOf('}')));
const nightStart = theme.indexOf('color-scheme: dark;');
const dark = { ...light, ...declarations(theme.slice(nightStart, theme.indexOf('}', nightStart))) };
function resolve(tokens, name, seen = new Set()) {
  assert.ok(!seen.has(name), 'cyclic color token ' + name);
  seen.add(name);
  const value = tokens[name];
  assert.ok(value, 'missing token ' + name);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? resolve(tokens, alias[1], seen) : value;
}
function luminance(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
for (const [scheme, tokens] of Object.entries({ light, dark }))
  test(scheme + ' shared content, paper and widget text pairs retain readable contrast', () => {
    for (const [foreground, background] of [
      ['--ui-text', '--ui-surface-panel'],
      ['--ui-muted', '--ui-surface-panel'],
      ['--ui-widget-text', '--ui-widget-panel'],
      ['--ui-widget-error', '--ui-widget-panel'],
      ['--ui-widget-selected-text', '--ui-widget-selected'],
      ['--ui-paper-text', '--ui-paper-background'],
      ['--ui-paper-muted', '--ui-paper-background'],
    ]) {
      const ratio = contrast(resolve(tokens, foreground), resolve(tokens, background));
      assert.ok(ratio >= 4.5, `${scheme} ${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
  });
test('regression examples distinguish unreadable inherited night ink and old selected-tab fallback', () => {
  assert.ok(contrast(resolve(dark, '--play-ink'), '#fffdf8') < 1.2);
  assert.ok(contrast(resolve(dark, '--green'), '#fffdf6') < 1.2);
  assert.ok(
    contrast(resolve(dark, '--ui-widget-selected-text'), resolve(dark, '--ui-widget-selected')) >=
      4.5,
  );
});
test('bare themed buttons pair their actual background and ink in both schemes', () => {
  const rule = theme.match(
    /:where\(body\[data-visual-theme=["']playful["']\]\) button\s*\{([^}]+)\}/,
  );
  assert.ok(rule, 'neutral themed button rule is missing');
  const background = rule[1].match(/background:\s*var\((--[\w-]+)\)/)?.[1];
  const foreground = rule[1].match(/color:\s*var\((--[\w-]+)\)/)?.[1];
  for (const tokens of [light, dark])
    assert.ok(contrast(resolve(tokens, foreground), resolve(tokens, background)) >= 4.5);
});

test('chat message and destination text keep panel ink despite game-level paragraph colors', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/shared/chat.css'), 'utf8');
  const scoped = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(
    (m) => m[1].includes('.shared-chat') && /color\s*:\s*inherit(?:;|$)/.test(m[2]),
  );
  for (const tag of ['p', 'label', 'time'])
    assert.ok(
      scoped.some((m) => new RegExp('(?:^|[\\s,(])' + tag + '(?:$|[\\s,)])').test(m[1])),
      tag + ' must inherit chat panel ink',
    );
  assert.ok(
    contrast('#6e7c71', resolve(dark, '--play-surface')) < 4.5,
    'old majority paragraph ink reproduces poor night contrast',
  );
  for (const tokens of [light, dark])
    assert.ok(contrast(resolve(tokens, '--play-ink'), resolve(tokens, '--play-surface')) >= 4.5);
});

test('Stitch selected paper keeps body, muted, link and focus pairs readable in both schemes', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '../frontend/src/styles/stitch-tokens.scss'),
    'utf8',
  );
  const start = css.indexOf(':root {'),
    night = css.indexOf("html[data-color-scheme='dark']");
  const day = declarations(css.slice(start, night)),
    nightTokens = { ...day, ...declarations(css.slice(night)) };
  for (const tokens of [day, nightTokens])
    for (const name of [
      '--stitch-selected-ink',
      '--stitch-selected-muted',
      '--stitch-selected-link',
      '--stitch-selected-focus',
    ])
      assert.ok(
        contrast(resolve(tokens, name), resolve(tokens, '--stitch-selected-bg')) >= 4.5,
        name,
      );
  assert.ok(
    contrast(resolve(nightTokens, '--stitch-muted'), resolve(nightTokens, '--stitch-selected-bg')) <
      2,
    'page muted is not selected-paper muted',
  );
});

// #186: night mode left white page ink on 同頻's light selected cards.
test('同頻 selected and winning cards pair the selected paper with its own ink', () => {
  const css = fs.readFileSync(path.join(__dirname, '../frontend/src/styles/majority.scss'), 'utf8');
  const unpaired = [],
    stack = [];
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') stack.push(i);
    else if (css[i] === '}') {
      const start = stack.pop(),
        own = css.slice(start + 1, i).replace(/\{[^]*\}/g, '');
      if (
        /background:\s*var\(--stitch-selected-bg\)/.test(own) &&
        !/color:\s*var\(--stitch-selected-ink\)/.test(own)
      )
        unpaired.push(css.slice(0, start).split('\n').length);
    }
  }
  assert.deepEqual(unpaired, [], 'selected background without selected ink at lines');
  for (const selector of ['&.is-my-choice {', '&.is-winner {']) {
    const at = css.indexOf(selector);
    assert.ok(at > 0, selector);
    assert.match(css.slice(at, css.indexOf('}', at)), /@include surfaces\.selected;/, selector);
  }
});
