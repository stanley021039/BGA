const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
function fixture() {
  const callbacks = new Set(),
    created = [];
  const abilities = require('../../public/shared/boss-abilities.json');
  const source = fs
    .readFileSync(path.join(__dirname, '../src/services/boss-puppet.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/export function /g, 'function ');
  const scope = {
    abilities,
    motionAllowed: () => true,
    watchMotionCancellation: (cb) => {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },
  };
  vm.runInNewContext(
    source + '\nthis.create=createBossPuppet;this.profile=bossMotionProfile;',
    scope,
  );
  function element() {
    return {
      setAttribute() {},
      removeAttribute() {},
      querySelector() {
        return element();
      },
      animate(frames, options) {
        const a = {
          frames,
          options,
          cancelled: false,
          cancel() {
            this.cancelled = true;
          },
        };
        created.push(a);
        return a;
      },
    };
  }
  return { scope, element, created, callbacks };
}
test('boss puppets cap native tracks, synchronise windup and impact, and release on death or policy cancellation', () => {
  const f = fixture(),
    first = f.scope.create(f.element(), 'cthulhu'),
    second = f.scope.create(f.element(), 'thanos');
  assert.ok(first && second);
  assert.equal(f.scope.create(f.element(), 'gyo'), null);
  const spec = require('../../public/shared/boss-abilities.json').find(
    (a) => a.boss === 'thanos' && a.slot === 'r',
  );
  const state = {
    moving: true,
    connected: true,
    health: 100,
    intent: { effect: spec.id, until: 3600 },
  };
  first.update(state, 1000);
  assert.equal(f.created.length, 4);
  assert.equal(f.created[3].options.duration, spec.windup + spec.duration);
  assert.equal(f.created[3].frames[2].offset, (spec.windup / (spec.windup + spec.duration)) * 0.98);
  first.update(state, 1100);
  assert.equal(f.created.length, 4, 'polling does not restart cast');
  first.update({ ...state, health: 90 }, 1200);
  assert.equal(f.created.length, 5);
  first.dispose();
  assert.ok(f.created.every((a) => a.cancelled));
  assert.ok(f.scope.create(f.element(), 'gyo'), 'released quota can be reused');
  for (const stop of [...f.callbacks]) stop();
  second.dispose();
  assert.ok(f.created.every((a) => a.cancelled));
  const third = f.scope.create(f.element(), 'greeza');
  third.update({ ...state, intent: null }, 1000);
  third.update({ ...state, health: 0 }, 1100);
  assert.ok(f.created.every((a) => a.cancelled));
});
test('organic, flying, mechanical, stalking and heavy bosses have different gait profiles', () => {
  const f = fixture(),
    profiles = ['cthulhu', 'greeza', 'steel-behemoth', 'arkveld', 'thanos'].map((id) =>
      f.scope.profile(id),
    );
  assert.equal(new Set(profiles.map((p) => p.gait)).size, 5);
  assert.ok(profiles.every((p) => p.period >= 1000 && p.sway <= 3.5 && p.lift <= 7));
});
