const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  ts = require('typescript');
function fixture() {
  let allowed = true,
    gateAllowed = true;
  const cancellation = new Set(),
    listeners = new Set(),
    jobs = [],
    done = [];
  const api = {
    createGate() {
      let scope = '',
        ready = false;
      return {
        update(s, { connected }) {
          const live = ready && scope === s.code && connected && gateAllowed;
          scope = s.code;
          ready = true;
          return live;
        },
        take() {
          return true;
        },
        dispose() {},
      };
    },
    animate(node, frames, options) {
      let finish, reject;
      const job = {
        node,
        frames,
        options,
        cancelled: 0,
        finished: new Promise((a, b) => {
          finish = a;
          reject = b;
        }),
        finish: () => finish(),
        cancel() {
          this.cancelled++;
          reject(Error('cancelled'));
        },
      };
      jobs.push(job);
      return job;
    },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const raw = fs.readFileSync(file, 'utf8');
    vm.runInNewContext(
      ts.transpileModule(raw, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        module,
        exports: module.exports,
        window: {
          addEventListener(_type, fn) {
            listeners.add(fn);
          },
          removeEventListener(_type, fn) {
            listeners.delete(fn);
          },
        },
        require(id) {
          if (id.includes('motion-policy')) return { default: api };
          if (id.includes('motion-lifetime'))
            return {
              motionAllowed: () => allowed,
              watchMotionCancellation(fn) {
                cancellation.add(fn);
                return () => cancellation.delete(fn);
              },
            };
          return load(path.resolve(path.dirname(file), id + '.ts'));
        },
      },
    );
    return module.exports;
  }
  const exports = load(path.resolve(__dirname, '../src/pages/second-wind/athlete-motion.ts'));
  let stopped = 0;
  const owner = exports.createAthleteMotion(
    (id) => done.push(id),
    () => stopped++,
  );
  const nodes = Array.from({ length: 6 }, (_, i) => ({
    id: 'r' + i,
    getAttribute: () => String(i + 1),
  }));
  const pieces = Array.from({ length: 6 }, (_, i) => ({
    id: 'r' + i,
    getAttribute: () => 'r' + i,
  }));
  const track = {
    getBoundingClientRect: () => ({ width: 1000, height: 300 }),
    querySelectorAll(selector) {
      return selector === '[data-athlete-racer]' ? pieces : [];
    },
  };
  const root = { querySelector: () => track, querySelectorAll: () => nodes };
  const game = (events = [], revision = events.at(-1)?.id || 0) => ({
    revision,
    phase: 'racing',
    race: 1,
    direction: 1,
    players: ['a', 'b', 'c'],
    events,
    racers: pieces.map((p, i) => ({ id: p.id, playerId: ['a', 'b', 'c'][i % 3], position: 5 })),
  });
  return {
    ...exports,
    owner,
    root,
    game,
    jobs,
    done,
    listeners,
    cancellation,
    get stopped() {
      return stopped;
    },
    block() {
      allowed = false;
      for (const fn of [...cancellation]) fn();
    },
    allow() {
      allowed = true;
    },
    rejectGap() {
      gateAllowed = false;
    },
  };
}
const move = (id = 1, racer = 'r0', from = 0, to = 5) => ({
  id,
  type: 'move',
  racer,
  playerId: 'a',
  from,
  to,
  race: 1,
  direction: 1,
});
const die = (id = 1, value = 3) => ({
  id,
  type: 'die',
  playerId: 'a',
  racer: 'r0',
  value,
  race: 1,
});
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('paths visit each real grid point, warp skips intervening cells, reverse geometry and trip stay explicit', () => {
  const f = fixture(),
    g = f.game();
  const p = f.planAthletePaths(
    [
      move(),
      { ...move(2, 'r0', 5, 12), type: 'warp' },
      { id: 3, type: 'trip', racer: 'r0', playerId: 'a', from: 12, direction: -1 },
    ],
    g,
  )[0];
  assert.deepEqual(
    Array.from(p.steps, (s) => s.position),
    [0, 1, 2, 3, 4, 5, 12, 12],
  );
  assert(p.steps[6].warp);
  assert(p.steps[7].trip);
  assert.equal(p.steps[7].direction, -1);
  const frames = f.athletePathFrames(p, { position: 5, direction: 1 }, 1000, 300);
  assert(frames.some((frame) => frame.opacity === 0));
  assert(frames.some((frame) => frame.transform.includes('rotate(75deg)')));
  assert.equal(frames.at(-1).transform, 'translate(0px, 0px)');
  assert.equal(f.planAthletePaths([{ ...move(), race: 2 }], g).length, 0);
  assert.equal(f.planAthletePaths([move(1, 'r0', 0, 999)], g).length, 0);
  f.owner.dispose();
});

test('first snapshot and reconnect establish a baseline; duplicates, truncated history and scope changes never replay', () => {
  const f = fixture();
  assert.equal(f.owner.observe('round1', f.game([die()]), true).cue, null);
  const live = f.owner.observe('round1', f.game([die(), move(2)]), true).cue;
  assert(live);
  f.owner.play(f.root, live);
  assert.equal(f.jobs.length, 1);
  assert.equal(f.owner.observe('round1', f.game([die(), move(2)]), true).cue, null);
  f.owner.observe('round1', f.game([die(), move(2)]), false);
  assert.equal(f.owner.observe('round1', f.game([die(), move(2), die(3)]), true).cue, null);
  assert(f.owner.observe('round1', f.game([die(), move(2), die(3), die(4)]), true).cue);
  assert.equal(f.owner.observe('round1', f.game([die(120)]), true).cue, null);
  assert.equal(f.owner.observe('round2', f.game([die(121)]), true).cue, null);
  f.owner.dispose();
});

test('server faces are never randomized; six dice and six paths are bounded and movement follows the roll', () => {
  const f = fixture();
  f.owner.observe('s', f.game(), true);
  const events = [
    ...Array.from({ length: 6 }, (_, i) => die(i + 1, i + 1)),
    ...Array.from({ length: 6 }, (_, i) => move(i + 7, 'r' + i)),
  ];
  const result = f.owner.observe('s', f.game(events), true);
  assert.deepEqual(
    Array.from(result.dice, (d) => d.value),
    [1, 2, 3, 4, 5, 6],
  );
  f.owner.play(f.root, result.cue);
  assert.equal(f.owner.active(), 12);
  assert.equal(f.jobs.filter((j) => j.options.delay === 650).length, 6);
  assert(f.jobs.every((j) => j.options.duration + j.options.delay <= 2850));
  f.owner.dispose();
  assert.equal(f.owner.active(), 0);
  assert(f.jobs.every((j) => j.cancelled > 0));
});

test('mid-flight policy/visibility cancellation, stale async work and disposal release every owned resource', async () => {
  const f = fixture();
  f.owner.observe('s', f.game(), true);
  const cue = f.owner.observe('s', f.game([die(), move(2)]), true).cue;
  f.owner.play(f.root, cue);
  assert.equal(f.cancellation.size, 1);
  f.block();
  assert.equal(f.owner.active(), 0);
  assert.equal(f.cancellation.size, 0);
  assert(f.jobs.every((j) => j.cancelled > 0));
  f.allow();
  f.owner.play(f.root, cue);
  assert.equal(f.owner.active(), 0, 'cancelled tick cannot replay');
  f.owner.observe('s', f.game([die(), move(2)]), true);
  const next = f.owner.observe('s', f.game([die(), move(2), die(3)]), true).cue;
  f.owner.play(f.root, next);
  assert(f.owner.active() > 0);
  for (const listener of [...f.listeners]) listener();
  assert.equal(f.owner.active(), 0);
  f.owner.dispose();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.cancellation.size, 0);
  await flush();
  assert.equal(f.owner.active(), 0);
});

test('finishing and replacing a batch cannot let old completion callbacks erase a new actor with a reused id', async () => {
  const f = fixture();
  f.owner.observe('s', f.game(), true);
  const first = f.owner.observe('s', f.game([move()]), true).cue;
  f.owner.play(f.root, first);
  f.owner.observe('new-scope', f.game(), true);
  const second = f.owner.observe('new-scope', f.game([move()]), true).cue;
  f.owner.play(f.root, second);
  await flush();
  assert.equal(f.done.length, 0);
  f.jobs.at(-1).finish();
  await flush();
  assert.deepEqual(f.done, ['1']);
  assert.equal(f.owner.active(), 0);
  assert.equal(f.cancellation.size, 0);
  f.owner.dispose();
});

test('a fresh server-timed action after human idle still animates, while delayed events stay static', () => {
  const f = fixture();
  f.owner.observe('s', f.game(), true, 10000);
  f.rejectGap();
  assert(f.owner.observe('s', f.game([{ ...die(), at: 20000 }]), true, 20000).cue);
  assert.equal(f.owner.observe('s', f.game([{ ...die(2), at: 20000 }]), true, 30000).cue, null);
  f.owner.observe('s', f.game([{ ...die(2), at: 20000 }]), false, 30000);
  assert.equal(f.owner.observe('s', f.game([{ ...die(3), at: 30000 }]), true, 30000).cue, null);
  f.owner.dispose();
});

test('live displacement, finale reposition and direction reversal use previous public geometry without replay on reconnect', () => {
  const f = fixture(),
    before = f.game(),
    after = f.game([{ id: 1, type: 'displace', racer: 'r0', playerId: 'a' }], 1);
  after.racers[0].position = 2;
  const displaced = f.planAthletePaths(after.events, after, before);
  assert.deepEqual(
    Array.from(displaced[0].steps, (s) => s.position),
    [5, 4, 3, 2],
  );
  const finale = f.game([{ id: 2, type: 'finale' }], 2);
  finale.racers[0].position = 15;
  assert(f.planAthletePaths(finale.events, finale, before)[0].steps.at(-1).warp);
  const reverse = f.game([{ id: 3, type: 'twist' }], 3);
  reverse.direction = -1;
  assert.equal(f.planAthletePaths(reverse.events, reverse, before).length, 6);
  f.owner.observe('s', before, true);
  assert(f.owner.observe('s', after, true).cue.paths.length);
  f.owner.observe('s', after, false);
  assert.equal(f.owner.observe('s', finale, true).cue, null);
  f.owner.dispose();
});
