const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const figures = fs
  .readFileSync(path.join(__dirname, '../src/services/attack-figures.js'), 'utf8')
  .replace(/export function /g, 'function ');
const source =
  fs
    .readFileSync(path.join(__dirname, '../src/services/attack-revision.js'), 'utf8')
    .replace(/export function /g, 'function ') +
  figures +
  fs
    .readFileSync(path.join(__dirname, '../src/services/attack-area.js'), 'utf8')
    .replace(/^import .*attack-figures.js';\n/m, '')
    .replace(/^import .*attack-revision.js';\n/m, '')
    .replace('export function createAreaAttack', 'function createAreaAttack');
const effects = require('../../public/shared/attack-effects.json').filter((effect) => effect.area);

test('all nine adapted Stitch area effects render finite bounded geometry, one impact and a finite lifetime', () => {
  for (const effect of effects)
    for (const [width, height, preview] of [
      [1920, 1080, false],
      [340, 180, false],
      [1920, 240, true],
      [264, 240, true],
    ]) {
      let calls = 0,
        impacts = 0,
        maximum = 0;
      const labels = [];
      const ctx = new Proxy(
        {},
        {
          get(_target, name) {
            return (...args) => {
              calls++;
              if (name === 'fillText') {
                labels.push(args[0]);
                assert.ok(args[3] <= width - 32, 'title fits viewport');
              }
              args.forEach((arg) => {
                if (typeof arg === 'number')
                  assert.ok(Number.isFinite(arg), effect.id + ' ' + String(name));
              });
              if (name === 'arc') assert.ok(args[2] >= 0);
              if (name === 'ellipse') assert.ok(args[2] >= 0 && args[3] >= 0);
              if (name === 'createLinearGradient' || name === 'createRadialGradient')
                return { addColorStop() {} };
            };
          },
          set() {
            return true;
          },
        },
      );
      const sandbox = {};
      vm.createContext(withEngineImports(sandbox));
      vm.runInContext(source, sandbox);
      const draw = sandbox.createAreaAttack(
        ctx,
        {
          ...effect,
          effect: effect.id,
          width,
          height,
          preview,
          from: { x: width * 0.18, y: height * 0.65 },
          to: { x: width * 0.78, y: height * 0.65 },
          range: 65,
          hits: Array.from({ length: 32 }, (_, i) => ({
            toId: String(i),
            x: width * (0.45 + i * 0.005),
            y: height * (0.5 + i * 0.003),
          })),
        },
        () => impacts++,
      );
      draw(350);
      assert.deepEqual(labels, [effect.label], effect.id + ' title before attack');
      assert.equal(impacts, 0, effect.id + ' no impact during title');
      for (let time = 0; time <= 4100; time += 30) {
        calls = 0;
        draw(time);
        maximum = Math.max(maximum, calls);
      }
      assert.equal(impacts, 1, effect.id);
      assert.ok(maximum < 6000, effect.id + ' drawing budget ' + maximum);
      calls = 0;
      draw(4101);
      assert.equal(calls, 0, effect.id + ' stopped');
    }
});
