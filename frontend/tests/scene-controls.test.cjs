'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');

function fixture(send = async () => true) {
  let time = 10000,
    id = 0;
  const timers = new Map(),
    listeners = new Map();
  const document = {
    hidden: false,
    activeElement: null,
    blocked: false,
    querySelector() {
      return this.blocked ? {} : null;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  class Element {
    closest() {
      return true;
    }
  }
  const loaded = { exports: {} };
  const source = fs.readFileSync(require.resolve('../src/services/scene-controls.ts'), 'utf8');
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      require: () => vue,
      document,
      Element,
      Date: { now: () => time },
      setTimeout(fn, delay) {
        const key = ++id;
        timers.set(key, { fn, at: time + delay });
        return key;
      },
      clearTimeout(key) {
        timers.delete(key);
      },
    },
  );
  const state = vue.reactive({
    context: 'room-a',
    enabled: true,
    snapshot: {
      selfId: 'me',
      serverNow: time,
      attacks: [],
      visitors: [{ id: 'me', health: 100 }],
    },
  });
  const scope = vue.effectScope();
  const controls = scope.run(() =>
    loaded.exports.useSceneControls({
      context: () => state.context,
      enabled: () => state.enabled,
      snapshot: () => state.snapshot,
      send,
    }),
  );
  return {
    controls,
    state,
    document,
    Element,
    timers,
    listeners,
    async advance(ms) {
      time += ms;
      for (const [key, timer] of [...timers]) {
        if (timer.at <= time) {
          timers.delete(key);
          timer.fn();
        }
      }
      await vue.nextTick();
    },
    dispose() {
      scope.stop();
    },
  };
}
test('one pending request per slot, independent slots and server cooldown after success', async () => {
  const jobs = [],
    calls = [];
  const f = fixture(
    (action) =>
      new Promise((resolve) => {
        calls.push(action);
        jobs.push(resolve);
      }),
  );
  try {
    const q = f.controls.run('q');
    assert.equal(await f.controls.run('q'), false);
    const e = f.controls.run('e');
    assert.deepEqual(calls, ['q', 'e']);
    jobs.forEach((resolve) => resolve(true));
    await Promise.all([q, e]);
    assert.equal(f.controls.seconds('q'), 2);
    assert.equal(await f.controls.run('q'), false);
    await f.advance(2000);
    assert.equal(f.controls.disabled('q'), false);
    assert.equal(f.timers.size, 0);
  } finally {
    f.dispose();
  }
});
test('failed action unlocks immediately and does not invent a successful cooldown', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return false;
  });
  try {
    await f.controls.run('q');
    await f.controls.run('q');
    assert.equal(calls, 2);
    assert.equal(f.controls.seconds('q'), 0);
    assert.equal(f.controls.pending.q, false);
  } finally {
    f.dispose();
  }
});
test('room change invalidates old response without clearing a new request lock', async () => {
  const jobs = [];
  const f = fixture(() => new Promise((resolve) => jobs.push(resolve)));
  try {
    const old = f.controls.run('r');
    f.state.context = 'room-b';
    const current = f.controls.run('r');
    jobs[0](true);
    await old;
    assert.equal(f.controls.pending.r, true);
    assert.equal(f.controls.seconds('r'), 0);
    jobs[1](true);
    await current;
    assert.equal(f.controls.seconds('r'), 1);
  } finally {
    f.dispose();
  }
});
test('hidden, dialogs, input, disconnected and knocked-out characters cannot act', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return true;
  });
  try {
    f.document.hidden = true;
    await f.controls.run('q');
    f.document.hidden = false;
    f.document.blocked = true;
    await f.controls.run('q');
    f.document.blocked = false;
    f.document.activeElement = new f.Element();
    await f.controls.run('r');
    f.document.activeElement = null;
    f.state.enabled = false;
    await f.controls.run('q');
    f.state.enabled = true;
    f.state.snapshot.visitors[0].health = 0;
    await f.controls.run('up');
    assert.equal(calls, 0);
    f.state.snapshot.visitors[0].health = 100;
    await f.controls.run('up');
    assert.equal(calls, 1);
    assert.equal(await f.controls.run('left'), false);
    await f.advance(200);
    assert.equal(f.controls.disabled('left'), false);
  } finally {
    f.dispose();
  }
});
test('recent server attack recovers remaining cooldown; other players do not lock controls', async () => {
  const f = fixture();
  try {
    f.state.snapshot = {
      ...f.state.snapshot,
      serverNow: 10000,
      attacks: [
        { fromId: 'other', slot: 'e', at: 10000 },
        { fromId: 'me', slot: 'q', at: 9000 },
      ],
    };
    await vue.nextTick();
    assert.equal(f.controls.seconds('q'), 1);
    assert.equal(f.controls.seconds('e'), 0);
    await f.advance(1000);
    assert.equal(f.controls.disabled('q'), false);
  } finally {
    f.dispose();
  }
});
test('cooldown timers pause in background, resume without replay and dispose all resources', async () => {
  let resolve;
  const f = fixture(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const job = f.controls.run('q');
  resolve(true);
  await job;
  assert.equal(f.timers.size, 1);
  f.document.hidden = true;
  f.listeners.get('visibilitychange')();
  assert.equal(f.timers.size, 0);
  await f.advance(3000);
  f.document.hidden = false;
  f.listeners.get('visibilitychange')();
  assert.equal(f.controls.seconds('q'), 0);
  f.dispose();
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(await f.controls.run('q'), false);
});
