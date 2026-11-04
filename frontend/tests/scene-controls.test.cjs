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
      require: (id) =>
        id === 'vue' ? vue : { default: require('../../public/shared/scene-rules.json') },
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
      const end = time + ms;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      time = end;
      await vue.nextTick();
    },
    dispose() {
      scope.stop();
    },
  };
}
test('R requires synchronized full energy while C remains an independent teleport', async () => {
  const calls = [];
  const f = fixture(async (action) => {
    calls.push(action);
    return true;
  });
  try {
    assert.equal(await f.controls.run('r'), false);
    assert.equal(await f.controls.run('c'), true);
    f.state.snapshot.visitors[0].energy = 99;
    assert.equal(f.controls.disabled('r'), true);
    f.state.snapshot.visitors[0].energy = 100;
    assert.equal(await f.controls.run('r'), true);
    assert.deepEqual(calls, ['c', 'r']);
    f.state.snapshot.visitors[0].energy = 0;
    await f.advance(1600);
    assert.equal(f.controls.disabled('r'), true);
    f.state.snapshot.visitors[0].energy = 100;
    assert.equal(f.controls.disabled('r'), false);
  } finally {
    f.dispose();
  }
});

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
    await f.advance(1599);
    assert.equal(f.controls.disabled('q'), true);
    await f.advance(1);
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
    const old = f.controls.run('c');
    f.state.context = 'room-b';
    const current = f.controls.run('c');
    jobs[0](true);
    await old;
    assert.equal(f.controls.pending.c, true);
    assert.equal(f.controls.seconds('c'), 0);
    jobs[1](true);
    await current;
    assert.equal(f.controls.seconds('c'), 1);
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
    await f.controls.run('c');
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
    await f.advance(599);
    assert.equal(f.controls.disabled('q'), true);
    await f.advance(1);
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
