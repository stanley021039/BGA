const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('particle alternate colours travelling dots but restores sampled portrait colours during assembly', () => {
  const source = fs.readFileSync(
    require('node:path').join(__dirname, '../src/pages/lobby/apparition.ts'),
    'utf8',
  );
  const start = source.indexOf('const particles: Effect =');
  const end = source.indexOf('const effects:', start);
  for (const variantId of [undefined, 'particles-alt']) {
    let draw;
    const paints = [],
      properties = {};
    const context = {
      scale() {},
      clearRect() {},
      fillRect() {
        paints.push(this.fillStyle);
      },
    };
    const sandbox = {
      document: {
        createElement: () => ({
          getContext: () => ({
            drawImage() {},
            getImageData: () => ({
              data: new Uint8ClampedArray([
                200, 100, 50, 255, 200, 100, 50, 255, 200, 100, 50, 255, 200, 100, 50, 255,
              ]),
            }),
          }),
        }),
      },
      canvas: () => ({
        node: {
          style: { setProperty: (key, value) => (properties[key] = value) },
          getContext: () => context,
          remove() {},
        },
        scale: 1,
      }),
      animate: (_duration, render) => {
        draw = render;
        return () => {};
      },
      sparks() {
        throw Error('unexpected fallback');
      },
      DURATION: { particles: 1500 },
      ease: (n) => 1 - Math.pow(1 - n, 3),
      Math,
      Uint8ClampedArray,
    };
    vm.runInNewContext(
      ts.transpileModule(source.slice(start, end) + '\nglobalThis.play=particles;', {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      sandbox,
    );
    sandbox.play({ img: { complete: true, naturalWidth: 2 }, width: 2, height: 2, variantId });
    assert.equal(properties['--entrance-palette'], 'none');
    draw(0);
    assert.deepEqual(paints, [variantId ? '#6ff1bd' : 'rgb(200, 100, 50)']);
    paints.length = 0;
    draw(0.8);
    assert.deepEqual(paints, ['rgb(200, 100, 50)']);
  }
});
