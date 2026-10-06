const fs = require('node:fs');
const path = require('node:path');
const { acquireDataLocks, acquirePublishLock, acquireLegacyHistoryLock } = require('../../src/data/locks');
const { HistoryStore } = require('../../src/history/store');
const options = JSON.parse(process.argv[2]);
let release, held = false;

// Pause the old implementation after its content comparison, just before unlink.
// The fixed implementation rejects the existing lock without reaching this hook.
const unlink = fs.unlinkSync;
fs.unlinkSync = function(file, ...args) {
  if (options.pauseDeletion && !held && path.resolve(file) === options.lockFile) {
    process.send({ event: 'before-unlink' });
    const deadline = Date.now() + 10000, wait = new Int32Array(new SharedArrayBuffer(4));
    while (!fs.existsSync(options.gate)) {
      if (Date.now() > deadline) throw Error('Deletion barrier timed out');
      Atomics.wait(wait, 0, 0, 10);
    }
  }
  return unlink.call(fs, file, ...args);
};

process.on('message', command => {
  if (command === 'acquire') {
    try {
      if (options.kind === 'data') {
        const guard = acquireDataLocks(options.config, 'regression-worker');
        release = () => guard.release();
      } else if (options.kind === 'publish') release = acquirePublishLock(options.destination);
      else if (options.kind === 'legacy') release = acquireLegacyHistoryLock(options.historyDir);
      else {
        const history = new HistoryStore(options.historyDir);
        release = () => history.close();
      }
      held = true;
      process.send({ event: 'acquired' });
    } catch (error) { process.send({ event: 'rejected', code: error.code, message: error.message }); }
  } else if (command === 'release') {
    if (release) { release(); release(); }
    process.send({ event: 'released' });
  }
});
process.send({ event: 'ready' });
