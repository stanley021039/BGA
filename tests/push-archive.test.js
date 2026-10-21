'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { extractArchive } = require('../tools/extract-archive.cjs');

test('push archive extracts exact Git bytes and Chinese paths, and rejects invalid archives', (t) => {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'bga-push-archive-'));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.ok(path.basename(root).startsWith('bga-push-archive-'));
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  });
  const repo = path.join(root, 'source'),
    tree = path.join(root, 'tree');
  fs.mkdirSync(repo);
  fs.mkdirSync(tree);
  const name = 'output/pdf/郎中闖江湖-基本版藥材說明中譯.pdf';
  const bytes = Buffer.from('UTF-8 路徑回歸\n');
  fs.mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
  fs.writeFileSync(path.join(repo, name), bytes);
  fs.writeFileSync(path.join(repo, '.prettierrc.json'), '{"endOfLine":"lf"}\n');
  const git = (args) =>
    execFileSync('git', ['-c', 'core.autocrlf=false', '-C', repo, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git(['init']);
  git(['add', '.']);
  const sha = git(['write-tree']),
    archive = path.join(root, 'commit.tar');
  git(['archive', '--format=tar', '--output=' + archive, sha]);
  extractArchive(archive, tree);
  assert.deepEqual(fs.readFileSync(path.join(tree, name)), bytes);
  assert.equal(
    fs.readFileSync(path.join(tree, '.prettierrc.json'), 'utf8'),
    '{"endOfLine":"lf"}\n',
  );
  fs.writeFileSync(archive, 'not an archive');
  assert.throws(() => extractArchive(archive, tree));
});
