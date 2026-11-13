const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { parseHTML } = require('linkedom');
const originals = require('../../public/shared/entrance-requirements.json');
const palettes = require('../../public/shared/entrance-palette.json');
const imported = require('../../public/shared/entrance-stitch.json');
const services = path.join(__dirname, '../src/services');

function load(name, require) {
  const output = ts.transpileModule(fs.readFileSync(path.join(services, name), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const exports = {};
  new Function('exports', 'require', output)(exports, require);
  return exports;
}
const artwork = load('entrance-refined-art.ts', (id) => {
  if (id.endsWith('entrance-requirements.json')) return originals;
  if (id.endsWith('entrance-palette.json')) return palettes;
  throw Error(id);
});

test('four refined imported entrances keep three authored colours, distinct alternate geometry and bounded static vectors', () => {
  for (const id of [
    'stitch-gilgamesh',
    'stitch-blue-eyes',
    'stitch-lightning',
    'stitch-hyorinmaru',
  ]) {
    const base = artwork.refinedStitchArtwork(id),
      alternate = artwork.refinedStitchArtwork(id, id + '-alt');
    for (const item of [base, alternate]) {
      assert.equal(new Set(item.colors).size, 3, id);
      assert.ok(item.colors.every((color) => /^#[a-f\d]{6}$/i.test(color)));
      const { document } = parseHTML('<main>' + item.html + '</main>');
      assert.equal(document.querySelectorAll('svg').length, 1);
      assert.ok(document.querySelectorAll('*').length < 160, id);
      assert.doesNotMatch(item.html, /<script|\son\w+=|(?:href|src)="https?:|<rect|<image/i);
    }
    assert.notEqual(base.html, alternate.html, id + ' alternate has its own engraving or geometry');
  }
  assert.equal(artwork.refinedStitchArtwork('stitch-purple'), null);
  assert.equal(artwork.refinedStitchArtwork('stitch-gilgamesh', 'stitch-blue-eyes-alt'), null);
});

test('refined imported effects namespace every local paint reference and clean both simultaneous instances', () => {
  const { document } = parseHTML('<div id="layer"></div>');
  const layer = document.querySelector('#layer');
  const player = load('stitch-entrances.ts', (id) => {
    if (id.endsWith('entrance-stitch.json')) return imported;
    if (id === './entrance-refined-art') return artwork;
    if (/\.(?:css|scss)$/.test(id)) return {};
    throw Error(id);
  });
  // The production player only needs document; keep other browser state untouched.
  const previous = global.document;
  global.document = document;
  try {
    for (const id of [
      'stitch-gilgamesh',
      'stitch-blue-eyes',
      'stitch-lightning',
      'stitch-hyorinmaru',
    ]) {
      const stops = [undefined, id + '-alt'].map((variant) =>
        player.playStitchEntrance(id, layer, 160, 180, 'hue-rotate(90deg)', variant),
      );
      assert.equal(layer.children.length, 2);
      const ids = [...layer.querySelectorAll('[id]')].map((n) => n.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const node of layer.children) {
        assert.equal(node.dataset.entranceRefined, 'true');
        assert.equal(node.style.getPropertyValue('--entrance-palette'), 'none');
        for (const [, reference] of node.innerHTML.matchAll(/url\(#([^)]*)\)/g))
          assert.ok(
            [...node.querySelectorAll('[id]')].some((n) => n.id === reference),
            reference,
          );
      }
      stops[0]();
      stops[0]();
      assert.equal(layer.children.length, 1);
      stops[1]();
      assert.equal(layer.children.length, 0);
    }
  } finally {
    if (previous === undefined) delete global.document;
    else global.document = previous;
  }
});
