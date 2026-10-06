const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { acquireDataLocks, acquireLegacyHistoryLock, acquirePublishLock } = require('../src/data/locks');
const { HistoryStore } = require('../src/history/store');
const { safeError } = require('../src/data/transfer');

function harness(t, kind) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-lock-race-')), children = [];
  const historyDir = path.join(root, 'history'), destination = path.join(root, 'restored');
  const config = worker => ({ dbFile: path.join(root, 'db', 'shared.sqlite'),
    historyDir: path.join(root, worker, 'history'), communityDir: path.join(root, worker, 'community'), musicDir: path.join(root, worker, 'music') });
  const lockFile = kind === 'data' ? path.join(root, 'db', '.shared.sqlite.afterhours-lock') :
    kind === 'publish' ? path.join(root, '.restored.afterhours-publish-lock') : path.join(historyDir, '.lock');
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  t.after(async () => {
    await Promise.all(children.map(async child => {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit'); child.kill(); await exited;
      }
    }));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function worker(name, pauseDeletion = false, workerKind = kind) {
    const child = fork(path.join(__dirname, 'helpers', 'data-lock-worker.cjs'), [JSON.stringify({
      kind: workerKind, config: config(name), destination, historyDir, lockFile,
      pauseDeletion, gate: path.join(root, 'continue-deletion'),
    })], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    children.push(child);
    const queue = [], waiters = [];
    child.on('message', message => { const waiter = waiters.shift(); if (waiter) waiter(message); else queue.push(message); });
    return { send: command => child.send(command), next: () => {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve, reject) => {
        const receive = message => { clearTimeout(timer); resolve(message); };
        const timer = setTimeout(() => { waiters.splice(waiters.indexOf(receive), 1); reject(Error('Worker message timed out')); }, 15000);
        waiters.push(receive);
      });
    } };
  }
  return { root, historyDir, destination, config, lockFile, worker };
}

for (const kind of ['data', 'publish', 'legacy', 'history']) {
  test(`${kind}: two processes preserve a dead owner's lock instead of reclaiming it`, { timeout: 30000 }, async t => {
    const f = harness(t, kind);
    const ended = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
    assert.equal(ended.status, 0);
    const stale = ['legacy', 'history'].includes(kind) ? ended.stdout : JSON.stringify({
      version: 1, pid: Number(ended.stdout), hostname: os.hostname(), purpose: 'stopped-writer', nonce: 'old-owner',
    });
    fs.writeFileSync(f.lockFile, stale);
    const b = f.worker('b', true); assert.equal((await b.next()).event, 'ready'); b.send('acquire');
    let second = await b.next();
    const a = f.worker('a'); assert.equal((await a.next()).event, 'ready'); a.send('acquire');
    const first = await a.next();
    if (second.event === 'before-unlink') {
      fs.writeFileSync(path.join(f.root, 'continue-deletion'), 'go');
      second = await b.next();
    }
    assert.deepEqual([first, second].map(({ event, code }) => ({ event, code })), [
      { event: 'rejected', code: 'DATA_IN_USE' }, { event: 'rejected', code: 'DATA_IN_USE' },
    ], 'neither process may delete the stale lock or replace a new owner');
    assert.equal(fs.readFileSync(f.lockFile, 'utf8'), stale);
  });
}

for (const kind of ['data', 'publish', 'legacy']) {
  test(`${kind}: a held lock excludes another process and becomes available after release`, { timeout: 30000 }, async t => {
    const f = harness(t, kind), a = f.worker('a'), b = f.worker('b', false, kind === 'legacy' ? 'history' : kind);
    assert.equal((await a.next()).event, 'ready'); assert.equal((await b.next()).event, 'ready');
    a.send('acquire'); assert.equal((await a.next()).event, 'acquired');
    const owner = fs.readFileSync(f.lockFile, 'utf8');
    b.send('acquire'); const rejected = await b.next();
    assert.equal(rejected.event, 'rejected'); assert.equal(rejected.code, 'DATA_IN_USE');
    assert.equal(fs.readFileSync(f.lockFile, 'utf8'), owner);
    a.send('release'); assert.equal((await a.next()).event, 'released');
    b.send('acquire'); assert.equal((await b.next()).event, 'acquired');
    b.send('release'); assert.equal((await b.next()).event, 'released');
    assert.equal(fs.existsSync(f.lockFile), false);
  });
}

test('failed acquisition releases earlier data locks and preserves an unrecognized lock', t => {
  const f = harness(t, 'data'), config = f.config('a'), existing = path.join(config.musicDir, '.afterhours-data-lock');
  fs.mkdirSync(config.musicDir, { recursive: true }); fs.writeFileSync(existing, 'unrecognized');
  assert.throws(() => acquireDataLocks(config), { code: 'DATA_IN_USE' });
  assert.equal(fs.readFileSync(existing, 'utf8'), 'unrecognized');
  for (const file of [f.lockFile, ...[config.historyDir, config.communityDir].map(dir => path.join(dir, '.afterhours-data-lock'))]) {
    assert.equal(fs.existsSync(file), false, file);
  }
});

test('repeated history close cannot remove a later lock acquired in the same process', t => {
  const f = harness(t, 'legacy'), history = new HistoryStore(f.historyDir);
  history.close();
  const release = acquireLegacyHistoryLock(f.historyDir);
  history.close(); assert.equal(fs.existsSync(f.lockFile), true);
  release(); release(); assert.equal(fs.existsSync(f.lockFile), false);
});

test('an existing publication symlink is rejected without changing its target', t => {
  const f = harness(t, 'publish'), target = path.join(f.root, 'target');
  fs.mkdirSync(target); fs.symlinkSync(target, f.lockFile, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => acquirePublishLock(f.destination), { code: 'DATA_IN_USE' });
  assert.equal(fs.lstatSync(f.lockFile).isSymbolicLink(), true); assert.equal(fs.existsSync(target), true);
});

test('transfer errors explain residual-lock recovery without disclosing the lock path', () => {
  const error = safeError({ code: 'DATA_IN_USE', message: 'private path' });
  assert.equal(error.code, 'DATA_IN_USE'); assert.match(error.message, /lock/i); assert.match(error.message, /manual/i);
  assert.equal(error.message.includes('private path'), false);
});
