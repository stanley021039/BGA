'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { extractArchive } = require('./extract-archive.cjs');

const root = path.resolve(__dirname, '..');

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tips(input) {
  const commits = new Set();
  for (const line of input.split(/\r?\n/).filter((value) => value.trim())) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(fields[1])) {
      throw Error('Invalid pre-push ref input; refusing to skip the format check.');
    }
    const sha = fields[1];
    if (/^0+$/.test(sha)) continue;
    commits.add(git(['rev-parse', '--verify', '--end-of-options', `${sha}^{commit}`]));
  }
  return commits;
}

function check() {
  const commits = tips(fs.readFileSync(0, 'utf8'));
  if (!commits.size) return;
  let packagePath;
  try {
    packagePath = require.resolve('prettier/package.json', { paths: [root] });
  } catch {
    throw Error('Prettier is missing. Run npm ci before pushing.');
  }
  if (JSON.parse(fs.readFileSync(packagePath, 'utf8')).version !== '3.9.10') {
    throw Error('Expected Prettier 3.9.10. Run npm ci before pushing.');
  }
  const runner = path.join(root, 'tools', 'format.cjs');
  if (!fs.existsSync(runner)) throw Error('Missing local tools/format.cjs.');
  for (const sha of commits) {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'afterhours-push-format-'));
    try {
      const archive = path.join(temporary, 'commit.tar');
      const tree = path.join(temporary, 'tree');
      fs.mkdirSync(tree);
      git(['archive', '--format=tar', `--output=${archive}`, sha]);
      extractArchive(archive, tree);
      const required = [
        '.prettierrc.json',
        '.prettierignore',
        '.gitignore',
        '.format-baseline.json',
        'tools/format.cjs',
      ];
      if (required.some((file) => !fs.existsSync(path.join(tree, file)))) {
        throw Error(`Commit ${sha} lacks the committed formatting configuration or baseline.`);
      }
      console.log(`Checking committed push tip ${sha} with Prettier 3.9.10`);
      const result = spawnSync(process.execPath, [runner, '--check'], {
        cwd: tree,
        stdio: 'inherit',
      });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw Error(
          `Commit ${sha} failed formatting. Run npm run format and npm run format:check, commit the changes, then push again.`,
        );
      }
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}

try {
  check();
} catch (error) {
  console.error(`Push format check: ${error.message}`);
  process.exitCode = 1;
}
