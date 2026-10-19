'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const prettier = require('prettier');

const root = process.cwd();
const mode = process.argv[2];
const baselineName = '.format-baseline.json';
const extensions = /\.(?:[cm]?js|[cm]?ts|tsx|jsx|vue|css|scss|html|json|ya?ml)$/i;
const digest = (text) =>
  crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

function files() {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  if (top.status === 0 && fs.realpathSync(top.stdout.trim()) === fs.realpathSync(root)) {
    const result = spawnSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (result.status !== 0) throw Error('Unable to enumerate repository files');
    return [...new Set(result.stdout.split('\0').filter(Boolean))].sort();
  }
  // A push check runs against an archive, which deliberately has no Git metadata.
  const found = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.posix.join(directory, entry.name);
      if (
        ['.git', 'node_modules'].includes(entry.name) ||
        ['runtime', 'data', '.private', '.local', 'frontend/dist'].includes(relative)
      )
        continue;
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile()) found.push(relative);
    }
  }
  walk('');
  return found.sort();
}

async function main() {
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 3) {
    throw Error('Usage: node tools/format.cjs --write|--check');
  }
  if (prettier.version !== '3.9.10') throw Error('Run npm ci to install Prettier 3.9.10');
  const config = JSON.parse(fs.readFileSync(path.join(root, '.prettierrc.json'), 'utf8'));
  const baselinePath = path.join(root, baselineName);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  if (
    baseline.schemaVersion !== 1 ||
    baseline.formatter !== 'prettier@3.9.10' ||
    !baseline.files ||
    Array.isArray(baseline.files)
  ) {
    throw Error('Invalid formatting baseline');
  }
  for (const [name, hash] of Object.entries(baseline.files)) {
    if (
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      !/^[a-f0-9]{64}$/.test(hash)
    ) {
      throw Error('Invalid formatting baseline entry');
    }
    if (name.startsWith('frontend/') || name === baselineName)
      throw Error('New frontend code cannot be exempted by the baseline');
  }
  const ignorePath = ['.prettierignore', '.gitignore'].map((name) => path.join(root, name));
  let checked = 0,
    unchangedLegacy = 0,
    updated = 0,
    failed = 0,
    removed = 0;
  for (const relative of files()) {
    if (!extensions.test(relative)) continue;
    const absolute = path.join(root, relative);
    if (
      !fs.existsSync(absolute) ||
      !fs.lstatSync(absolute).isFile() ||
      fs.lstatSync(absolute).isSymbolicLink()
    )
      continue;
    const info = await prettier.getFileInfo(absolute, { ignorePath, resolveConfig: false });
    if (info.ignored || !info.inferredParser) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    if (baseline.files[relative] === digest(source)) {
      unchangedLegacy++;
      continue;
    }
    checked++;
    try {
      const options = await prettier.resolveConfig(absolute, {
        config: path.join(root, '.prettierrc.json'),
      });
      const formatted = await prettier.format(source, { ...options, filepath: absolute });
      if (formatted !== source) {
        if (mode === '--write') {
          fs.writeFileSync(absolute, formatted);
          updated++;
          console.log(`Formatted ${relative}`);
        } else {
          failed++;
          console.error(`Unformatted: ${relative}`);
        }
      }
      if (mode === '--write' && Object.hasOwn(baseline.files, relative)) {
        delete baseline.files[relative];
        removed++;
      }
    } catch (error) {
      failed++;
      console.error(`Cannot format ${relative}: ${error.message}`);
    }
  }
  if (mode === '--write' && removed) {
    const options = await prettier.resolveConfig(baselinePath, {
      config: path.join(root, '.prettierrc.json'),
    });
    fs.writeFileSync(
      baselinePath,
      await prettier.format(JSON.stringify(baseline), { ...options, filepath: baselinePath }),
    );
  }
  console.log(
    `Formatting: ${checked} checked, ${updated} formatted, ${unchangedLegacy} unchanged legacy files, ${failed} failures.`,
  );
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
