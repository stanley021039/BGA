const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
test('hero flight moves the real body on server timing, caps concurrent jobs and restores immediately on cancellation', () => {
  const code = fs
    .readFileSync(path.join(__dirname, '../src/services/scene-hero-flight.js'), 'utf8')
    .replace(/^import .*;\r?\n/, '')
    .replace('export function ', 'function ');
  const jobs = [],
    cancellations = new Set();
  let allowed = true;
  const scope = {
    motionAllowed: () => allowed,
    watchMotionCancellation(fn) {
      cancellations.add(fn);
      return () => cancellations.delete(fn);
    },
  };
  vm.createContext(scope);
  vm.runInContext(code, scope);
  const node = {
    closest: () => ({ getBoundingClientRect: () => ({ width: 1000, height: 600 }) }),
    animate(frames, options) {
      const a = {
        frames,
        options,
        cancelled: 0,
        cancel() {
          this.cancelled++;
        },
      };
      jobs.push(a);
      return a;
    },
  };
  const event = { fromX: 20, fromY: 50, toX: 60, toY: 60, ageMs: 200 };
  Array.from({ length: 9 }, () => scope.playHeroFlight(node, event));
  assert.equal(jobs.length, 6);
  assert.equal(jobs[0].options.duration, 2100);
  assert.equal(jobs[0].currentTime, 200);
  assert.equal(jobs[0].frames.at(-1).translate, '400px 60px');
  assert.equal(jobs[0].frames[2].translate, '200px -150px');
  for (const stop of [...cancellations]) stop();
  assert.equal(cancellations.size, 0);
  assert.ok(jobs.every((a) => a.cancelled === 1));
  allowed = false;
  scope.playHeroFlight(node, event);
  assert.equal(jobs.length, 6);
  allowed = true;
  scope.playHeroFlight(node, { ...event, ageMs: 2100 });
  scope.playHeroFlight(node, { ...event, cancelled: true });
  assert.equal(jobs.length, 6);
});
