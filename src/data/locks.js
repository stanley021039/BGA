const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');

function dataPaths(config) {
  for (const key of ['dbFile', 'historyDir', 'communityDir']) {
    if (typeof config[key] !== 'string' || !config[key]) throw Error(`Missing data path: ${key}`);
  }
  return {
    dbFile: path.resolve(config.dbFile),
    historyDir: path.resolve(config.historyDir),
    communityDir: path.resolve(config.communityDir),
    musicDir: path.resolve(config.musicDir || path.join(path.dirname(config.dbFile), 'music')),
  };
}

function acquireExclusiveFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, contents, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Comparing contents before unlink cannot prevent another process replacing
    // the file in between. Never reclaim an existing lock, even for a dead PID.
    const busy = Error('Data is already in use or has a residual lock; stop all writers and inspect locks before manual cleanup');
    busy.code = 'DATA_IN_USE'; throw busy;
  }
  let released = false;
  return () => {
    if (released) return;
    if (fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink() && fs.readFileSync(file, 'utf8') === contents) fs.unlinkSync(file);
    released = true;
  };
}

function acquireFile(file, purpose) {
  const owner = { version: 1, pid: process.pid, hostname: os.hostname(), purpose, nonce: randomUUID() };
  return acquireExclusiveFile(file, JSON.stringify(owner));
}

function acquireDataLocks(config, purpose = 'server') {
  const p = dataPaths(config), releases = [];
  for (const ancestor of [path.dirname(p.dbFile), path.dirname(path.dirname(p.dbFile))]) {
    if (fs.existsSync(path.join(ancestor, '.afterhours-restore-in-progress')) || fs.existsSync(path.join(path.dirname(ancestor), '.' + path.basename(ancestor) + '.afterhours-publish-lock'))) {
      const error = Error('Data restore has not completed'); error.code = 'RESTORE_IN_PROGRESS'; throw error;
    }
  }
  const files = [...new Set([
    path.join(path.dirname(p.dbFile), '.' + path.basename(p.dbFile) + '.afterhours-lock'),
    ...[p.historyDir, p.communityDir, p.musicDir].map(dir => path.join(dir, '.afterhours-data-lock')),
  ])].sort();
  try { for (const file of files) releases.push(acquireFile(file, purpose)); }
  catch (error) { for (const release of releases.reverse()) release(); throw error; }
  let closed = false;
  return { paths: p, release() { if (!closed) { closed = true; for (const release of releases.reverse()) release(); } } };
}

function acquirePublishLock(root) {
  return acquireFile(path.join(path.dirname(root), '.' + path.basename(root) + '.afterhours-publish-lock'), 'restore-publication');
}

// The previous server also checks this PID file, so it cannot start during a cold export.
function acquireLegacyHistoryLock(historyDir) {
  return acquireExclusiveFile(path.join(historyDir, '.lock'), String(process.pid));
}

module.exports = { dataPaths, acquireDataLocks, acquireLegacyHistoryLock, acquirePublishLock };
