'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function install() {
  if (process.env.CI && !['0', 'false'].includes(process.env.CI.toLowerCase())) {
    console.log('Git hooks: skipped in CI.');
    return;
  }
  if (!fs.existsSync(path.join(root, '.git'))) {
    console.log('Git hooks: skipped outside a Git checkout.');
    return;
  }
  const top = git(['rev-parse', '--show-toplevel']);
  if (top.status !== 0) throw Error(top.stderr.trim() || 'Cannot find Git checkout.');
  if (fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(root)) {
    throw Error('Refusing to install hooks in a different parent checkout.');
  }
  const existing = git(['config', '--get', 'core.hooksPath']);
  if (existing.status !== 0 && existing.status !== 1) {
    throw Error(existing.stderr.trim() || 'Cannot read core.hooksPath.');
  }
  if (existing.status === 0 && existing.stdout.trim() !== '.githooks') {
    throw Error(
      'core.hooksPath already points elsewhere. Integrate its hooks with .githooks before installing; no configuration was overwritten.',
    );
  }
  const hook = path.join(root, '.githooks', 'pre-push');
  if (!fs.existsSync(hook)) throw Error('Missing .githooks/pre-push.');
  if (process.platform !== 'win32') fs.chmodSync(hook, 0o755);
  const result = git(['config', '--local', 'core.hooksPath', '.githooks']);
  if (result.status !== 0) throw Error(result.stderr.trim() || 'Cannot install hooks.');
  console.log('Git hooks: installed .githooks/pre-push.');
}

try {
  install();
} catch (error) {
  console.error(`Git hooks: ${error.message}`);
  process.exitCode = 1;
}
