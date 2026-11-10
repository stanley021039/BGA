const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
test('hero flight moves the real body on server timing, caps concurrent jobs and restores immediately on cancellation', () => {
  const curve = fs
    .readFileSync(path.join(__dirname, '../src/services/hero-flight-path.js'), 'utf8')
    .replace(/^export /gm, '');
  const code = fs
    .readFileSync(path.join(__dirname, '../src/services/scene-hero-flight.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
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
  vm.runInContext(curve + code, scope);
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
  const peak = jobs[0].frames.reduce((highest, frame) =>
    Number.parseFloat(frame.translate.split(' ')[1]) <
    Number.parseFloat(highest.translate.split(' ')[1])
      ? frame
      : highest,
  );
  assert.ok(Number.parseFloat(peak.translate.split(' ')[1]) < -175);
  assert.ok(peak.offset < 1350 / 2100);
  assert.equal(scope.heroFlightLift(600, 36, 42), 0, 'no overshoot past the top edge');
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
