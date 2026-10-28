const { withEngineImports } = require('../../tests/helpers/browser-modules.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path'),
  ts = require('typescript');
const lifetime = fs
  .readFileSync(path.join(__dirname, '../src/services/motion-lifetime.js'), 'utf8')
  .toString();
const code = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/pages/lobby/apparition.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
test('all imported entrances share mid-flight cancellation, finite concurrency and quota cleanup', () => {
  let allowed = true,
    started = 0,
    stopped = 0,
    sequence = 0;
  const subscriptions = new Set(),
    bodyAnimations = [],
    timers = new Map();
  const root = {
    document: { hidden: false },
    MotionPolicy: {
      allowsMotion: () => allowed,
      subscribe(fn) {
        subscriptions.add(fn);
        fn();
        return () => subscriptions.delete(fn);
      },
    },
  };
  const sandbox = {
    window: root,
    exports: {},
    setTimeout(fn) {
      const id = ++sequence;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.createContext(withEngineImports(sandbox));
  vm.runInContext(
    require('../../tests/helpers/browser-modules.cjs').fixtureSource(lifetime),
    sandbox,
  );
  sandbox.require = (name) =>
    name.includes('motion-lifetime')
      ? {
          motionAllowed: sandbox.motionAllowed,
          watchMotionCancellation: sandbox.watchMotionCancellation,
          acquireEffectContext: sandbox.acquireEffectContext,
        }
      : name.includes('stitch-entrances')
        ? {
            stitchEntrances: [{ id: 'stitch-imported', duration: 2000 }],
            playStitchEntrance() {
              started++;
              return () => stopped++;
            },
          }
        : name.includes('entrance-body')
          ? { playEntranceBody: sandbox.playEntranceBody }
          : {};
  vm.runInContext(
    fs
      .readFileSync(path.join(__dirname, '../src/services/entrance-body.js'), 'utf8')
      .replace('export function ', 'function '),
    sandbox,
  );
  vm.runInContext(code, sandbox);
  const anchors = [];
  const play = () => {
    const classes = new Set();
    const anchor = {
      dataset: {},
      querySelector: () => ({
        animate() {
          const a = {
            cancelled: 0,
            cancel() {
              this.cancelled++;
            },
          };
          bodyAnimations.push(a);
          return a;
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 72, height: 78, bottom: 78 }),
      }),
      classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 72, height: 78, bottom: 78 }),
    };
    anchors.push({ anchor, classes });
    return sandbox.exports.apparate(
      anchor,
      { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      'stitch-imported',
    );
  };
  for (let i = 0; i < 7; i++) play();
  assert.equal(started, 6);
  assert.equal(timers.size, 6);
  allowed = false;
  for (const fn of [...subscriptions]) fn();
  assert.equal(stopped, 6);
  assert.equal(subscriptions.size, 0);
  assert.equal(timers.size, 0);
  assert.ok(anchors.every((a) => !a.classes.has('is-apparating')));
  assert.equal(bodyAnimations.length, 12);
  assert.ok(bodyAnimations.every((a) => a.cancelled === 1));
  play();
  assert.equal(started, 6);
  allowed = true;
  const stop = play();
  assert.equal(started, 7);
  stop();
  stop();
  assert.equal(stopped, 7);
  assert.equal(timers.size, 0);
  assert.equal(subscriptions.size, 0);
});
