const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const vue = require('vue');
const ts = require('typescript');

function harness({ deadline = null, me = 'a', submitted = false } = {}) {
  let clock = 100000,
    enabled = true;
  const calls = [],
    stops = [],
    listeners = new Map();
  const events = (prefix) => ({
    addEventListener(name, fn) {
      const key = prefix + name;
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
    },
    removeEventListener(name, fn) {
      listeners.get(prefix + name)?.delete(fn);
    },
  });
  const document = { hidden: false, ...events('d:') };
  const window = {
    document,
    ...events('w:'),
    AudioSettings: {
      playEffect(cue) {
        if (!enabled) return;
        const clip = { at: clock, cue };
        calls.push(clip);
        return clip;
      },
      stopEffect(clip) {
        stops.push(clip);
      },
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, '../../public/shared/game-sounds.js'), 'utf8'),
    { window, Date: { now: () => clock } },
  );
  const module = { exports: {} };
  const compiled = ts.transpileModule(
    fs.readFileSync(
      path.resolve(__dirname, '../src/composables/minimal-countdown-sounds.ts'),
      'utf8',
    ),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    Date: { now: () => clock },
    window,
    document,
    require: () => vue,
  });
  const room = vue.reactive({ connected: true, scope: 1, lastReceivedAt: clock, clockOffset: 0 });
  const state = vue.shallowRef({
    code: 'ABCDEF',
    version: 1,
    me,
    roundId: 'r1',
    phase: 'drawing',
    interrupted: false,
    deadline,
    submitted,
    guesserId: 'g',
    players: [{ id: 'g' }, { id: 'a' }, { id: 'b' }],
    readyIds: deadline ? ['b'] : [],
  });
  const now = vue.ref(clock),
    scope = vue.effectScope();
  scope.run(() =>
    module.exports.useMinimalCountdownSounds(
      room,
      vue.computed(() => state.value),
      now,
    ),
  );
  function update(patch = {}, ms = 0) {
    clock += ms;
    room.lastReceivedAt = clock;
    now.value = clock;
    state.value = { ...state.value, ...patch, version: state.value.version + 1 };
  }
  const emit = (prefix, name) => {
    for (const fn of [...(listeners.get(prefix + name) || [])]) fn();
  };
  return {
    room,
    state,
    calls,
    stops,
    scope,
    listeners,
    update,
    start() {
      update();
      update({ deadline: clock + 10000, readyIds: ['b'] });
    },
    tick(ms) {
      clock += ms;
      now.value = clock;
    },
    hidden(value) {
      document.hidden = value;
      emit('d:', 'visibilitychange');
    },
    event(name) {
      emit('w:', name);
    },
    mute(value) {
      enabled = !value;
    },
  };
}
test('only last artist receives start and 5 through 1 once; identical snapshots and zero are silent', () => {
  const h = harness();
  h.start();
  for (let second = 9; second >= 0; second--) {
    h.update({}, 1000);
    h.update();
    h.update();
  }
  assert.deepEqual(
    h.calls.map((c) => c.at),
    [100000, 105000, 106000, 107000, 108000, 109000],
  );
  assert.ok(h.calls.every((c) => c.cue === 'countdown-warning'));
  assert.ok(h.stops.length > 0);
  h.scope.stop();
  for (const options of [{ me: 'g' }, { me: 'b', submitted: true }]) {
    const quiet = harness(options);
    quiet.start();
    for (let i = 0; i < 10; i++) quiet.update({}, 1000);
    assert.equal(quiet.calls.length, 0);
    quiet.scope.stop();
  }
});
test('reload and first snapshot in active countdown never replay start or elapsed seconds', () => {
  const h = harness({ deadline: 105000 });
  assert.equal(h.calls.length, 0);
  h.update();
  assert.equal(h.calls.length, 0);
  h.update({}, 1000);
  assert.equal(h.calls.length, 1);
  h.scope.stop();
});
test('hidden, BFCache and stale data require fresh baseline and skip missed cues', () => {
  const h = harness();
  h.start();
  h.update({}, 4000);
  h.hidden(true);
  h.tick(1000);
  h.hidden(false);
  h.tick(0);
  assert.equal(h.calls.length, 1);
  h.update();
  assert.equal(h.calls.length, 1);
  h.update({}, 1000);
  assert.equal(h.calls.length, 2);
  h.event('pagehide');
  h.event('pageshow');
  h.tick(1000);
  assert.equal(h.calls.length, 2);
  h.update();
  h.update({}, 1000);
  assert.equal(h.calls.length, 3);
  h.tick(3000);
  h.update();
  assert.equal(h.calls.length, 3);
  h.scope.stop();
});
test('completion, interruption, disconnect, phase change, departure and disposal stop clips', () => {
  for (const change of [
    (h) => h.update({ submitted: true }),
    (h) => h.update({ interrupted: true }),
    (h) => {
      h.room.connected = false;
    },
    (h) => h.update({ phase: 'guessing', deadline: null }),
    (h) => h.update({ phase: 'finished' }),
    (h) => {
      h.state.value = null;
    },
    (h) => h.scope.stop(),
  ]) {
    const h = harness();
    h.start();
    change(h);
    assert.ok(h.stops.length > 0);
    h.scope.stop();
    assert.ok([...h.listeners.values()].every((set) => !set.size || set.size === 1));
  }
});
test('muting consumes warning without replay; next round can warn normally; time jumps do not catch up', () => {
  const h = harness();
  h.mute(true);
  h.start();
  h.mute(false);
  h.update();
  assert.equal(h.calls.length, 0);
  h.update({}, 5000);
  assert.equal(h.calls.length, 0);
  h.update({}, 1000);
  assert.equal(h.calls.length, 1);
  h.update({ roundId: 'r2', deadline: null, readyIds: [] });
  h.start();
  assert.equal(h.calls.length, 2);
  h.scope.stop();
});
test('reconnect at a warning boundary establishes baseline and only future valid seconds play', () => {
  const h = harness();
  h.start();
  h.update({}, 4000);
  h.room.connected = false;
  h.tick(1000);
  h.room.connected = true;
  h.update();
  assert.equal(h.calls.length, 1);
  h.update({}, 1000);
  assert.equal(h.calls.length, 2);
  h.scope.stop();
});

// A normal room poll can receive the new deadline after the tenth-second boundary.
test('a fresh live transition still warns when normal polling receives the deadline late', () => {
  const h = harness();
  h.update();
  h.update({ deadline: 110000, readyIds: ['b'] }, 1200);
  assert.equal(h.calls.length, 1);
  h.update();
  assert.equal(h.calls.length, 1);
  h.scope.stop();
});
