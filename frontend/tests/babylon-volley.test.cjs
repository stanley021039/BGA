const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
const source = fs
  .readFileSync(path.join(__dirname, '../src/services/attack-revision.js'), 'utf8')
  .replace(/export function /g, 'function ');
test('weapons hold at their portals, then split among all actual victims before the Ea finale', () => {
  const scope = {};
  vm.createContext(scope);
  vm.runInContext(source, scope);
  const targets = [
    { x: 641, y: -133 },
    { x: 733, y: 31 },
    { x: 563, y: 181 },
  ];
  function sample(p) {
    const translations = [],
      ctx = new Proxy(
        {},
        {
          get(_t, k) {
            return (...args) => {
              if (k === 'translate') translations.push(args);
              if (k === 'createRadialGradient' || k === 'createLinearGradient')
                return { addColorStop() {} };
            };
          },
          set() {
            return true;
          },
        },
      );
    scope.drawBabylonVolley(ctx, p, targets);
    return translations;
  }
  assert.deepEqual(sample(0.3), sample(0.36), 'weapons stay still during the charging hold');
  const flight = sample(0.54);
  for (const target of targets)
    assert.ok(
      flight.some(([x, y]) => x === target.x && y === target.y),
      JSON.stringify(target),
    );
  assert.notDeepEqual(flight, sample(0.36), 'weapons have left their portals');
  assert.notDeepEqual(sample(0.86), flight, 'the final Ea phase is distinct from the volley');
});
