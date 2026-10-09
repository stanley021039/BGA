'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appFixture } = require('./helpers/app-fixture.cjs');
const { openDatabase } = require('../src/db');

// Capture the same after hook node:test invokes without intentionally failing
// a child test (which would make the entire suite fail).
function context() {
  const hooks = [];
  return { hooks, after(fn) { hooks.push(fn); } };
}

test('app fixture isolates concurrent data paths, binds ephemeral loopback ports and leaves globals alone', async t => {
  const env = { ...process.env }, cwd = process.cwd();
  const [a, b] = await Promise.all([appFixture(t), appFixture(t)]);
  assert.notEqual(a.root, b.root);
  assert.notEqual(a.base, b.base);
  for (const key of ['dbFile', 'historyDir', 'communityDir', 'musicDir']) {
    assert.equal(path.dirname(a.config[key]), a.root);
    assert.equal(path.dirname(b.config[key]), b.root);
    assert.notEqual(a.config[key], b.config[key]);
  }
  fs.writeFileSync(path.join(a.config.musicDir, 'only-a.txt'), 'fixture-a');
  assert.equal(fs.existsSync(path.join(b.config.musicDir, 'only-a.txt')), false);
  assert.equal((await fetch(a.base + '/api/version')).status, 200);
  assert.equal((await fetch(b.base + '/api/version')).status, 200);
  await Promise.all([a.dispose(), a.dispose()]);
  assert.equal(a.app.server.listening, false);
  assert.equal(fs.existsSync(a.root), false);
  assert.equal((await fetch(b.base + '/api/version')).status, 200);
  assert.deepEqual({ ...process.env }, env);
  assert.equal(process.cwd(), cwd);
});

test('app fixture owns data paths and disables external services even with caller config', async t => {
  const f = await appFixture(t, { config: { dbFile: 'not-owned.sqlite', musicDir: 'not-owned', host: '0.0.0.0', port: 12345, externalSideEffectsEnabled: true, githubClient: { configured: true } } });
  assert.equal(f.config.dbFile, path.join(f.root, 'app.sqlite'));
  assert.equal(f.config.musicDir, path.join(f.root, 'music'));
  assert.equal(f.config.host, '127.0.0.1');
  assert.equal(f.config.port, 0);
  assert.equal(f.config.externalSideEffectsEnabled, false);
  assert.deepEqual(f.config.githubClient, { configured: false });
});

test('app fixture awaits seeding, closes its seed database and preserves seeded data', async t => {
  let seedDb;
  const f = await appFixture(t, { async seed(db) {
    seedDb = db;
    await new Promise(resolve => setImmediate(resolve));
    db.exec('CREATE TABLE fixture_marker (value TEXT); INSERT INTO fixture_marker VALUES (\'fixed-seed\')');
  } });
  assert.throws(() => seedDb.prepare('SELECT 1'), /not open|closed/i);
  const db = openDatabase(f.config.dbFile);
  try { assert.equal(db.prepare('SELECT value FROM fixture_marker').get().value, 'fixed-seed'); }
  finally { db.close(); }
});

test('app fixture cleans up a rejected seed before returning the error', async () => {
  const t = context(), failure = new Error('synthetic seed failure');
  let root, seedDb;
  await assert.rejects(appFixture(t, {
    config(paths) { assert.equal(Object.isFrozen(paths), true); root = path.dirname(paths.dbFile); return {}; },
    async seed(db) { seedDb = db; await Promise.resolve(); throw failure; },
  }), error => error === failure);
  assert.equal(t.hooks.length, 1);
  assert.throws(() => seedDb.prepare('SELECT 1'), /not open|closed/i);
  assert.equal(fs.existsSync(root), false);
  await t.hooks[0]();
});

test('app fixture removes owned data when config or real app construction fails', async () => {
  for (const failConfig of [true, false]) {
    const t = context(); let root;
    await assert.rejects(appFixture(t, { config(paths) {
      root = path.dirname(paths.dbFile);
      if (failConfig) throw new Error('synthetic config failure');
      return { achievementPurpose: 'invalid-fixture-purpose' };
    } }), failConfig ? /synthetic config failure/ : /Invalid achievement purpose/);
    assert.equal(fs.existsSync(root), false);
    await t.hooks[0]();
  }
});

test('app fixture closes a failed listener exactly once before removing its directory', async () => {
  const t = context(), failure = new Error('synthetic listen failure');
  let root, closes = 0, timer, listener;
  await assert.rejects(appFixture(t, { appFactory(config) {
    root = path.dirname(config.dbFile);
    timer = setInterval(() => {}, 1000);
    listener = () => {};
    process.on('bga-fixture-test-event', listener);
    return {
      async listen() { throw failure; },
      async close() {
        closes++;
        clearInterval(timer);
        process.off('bga-fixture-test-event', listener);
        assert.equal(fs.existsSync(root), true);
      },
    };
  } }), error => error === failure);
  assert.equal(closes, 1);
  assert.equal(process.listeners('bga-fixture-test-event').includes(listener), false);
  assert.equal(fs.existsSync(root), false);
  await t.hooks[0]();
  assert.equal(closes, 1);
});

test('app fixture registers teardown before caller HTTP assertions and reports close failures without deleting open data', async () => {
  const t = context();
  const f = await appFixture(t);
  try { assert.fail('synthetic caller assertion'); }
  catch (error) { assert.match(error.message, /synthetic caller assertion/); }
  await t.hooks[0]();
  assert.equal(f.app.server.listening, false);
  assert.equal(fs.existsSync(f.root), false);

  const failing = context(), setupError = new Error('listen failed'), closeError = new Error('close failed');
  let root;
  try {
    await assert.rejects(appFixture(failing, { appFactory(config) {
      root = path.dirname(config.dbFile);
      return { async listen() { throw setupError; }, async close() { throw closeError; } };
    } }), error => error instanceof AggregateError && error.errors[0] === setupError && error.errors[1] === closeError);
    assert.equal(fs.existsSync(root), true);
    await assert.rejects(failing.hooks[0](), error => error === closeError);
  } finally {
    // This fault-injected app never opened resources; safe test-owned cleanup.
    if (root) fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});
