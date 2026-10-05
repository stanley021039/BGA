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

function isAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return true;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

function acquireFile(file, purpose) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const owner = { version: 1, pid: process.pid, hostname: os.hostname(), purpose, nonce: randomUUID() };
  const contents = JSON.stringify(owner);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, contents, { flag: 'wx', mode: 0o600 });
      return () => {
        if (fs.existsSync(file) && !fs.lstatSync(file).isSymbolicLink() && fs.readFileSync(file, 'utf8') === contents) fs.unlinkSync(file);
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (fs.lstatSync(file).isSymbolicLink()) throw Error('Data lock cannot be a symbolic link');
      const previous = fs.readFileSync(file, 'utf8');
      let saved; try { saved = JSON.parse(previous); } catch { throw Error('Unrecognized data lock; inspect the stopped writer first'); }
      if (saved.hostname !== os.hostname() || isAlive(saved.pid)) {
        const busy = Error('Data is already in use by a server or transfer'); busy.code = 'DATA_IN_USE'; throw busy;
      }
      if (fs.readFileSync(file, 'utf8') === previous) fs.unlinkSync(file);
    }
  }
  const busy = Error('Data lock changed during acquisition'); busy.code = 'DATA_IN_USE'; throw busy;
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
  const file = path.join(historyDir, '.lock');
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('History lock cannot be a symbolic link');
    const previous = fs.readFileSync(file, 'utf8');
    if (!/^\d+$/.test(previous.trim()) || isAlive(Number(previous))) {
      const error = Error('History is in use; stop the source server first'); error.code = 'DATA_IN_USE'; throw error;
    }
    if (fs.readFileSync(file, 'utf8') === previous) fs.unlinkSync(file);
  }
  fs.writeFileSync(file, String(process.pid), { flag: 'wx', mode: 0o600 });
  return () => { if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === String(process.pid)) fs.unlinkSync(file); };
}

module.exports = { dataPaths, acquireDataLocks, acquireLegacyHistoryLock, acquirePublishLock };
