'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { checkTeachingSources, checkRepository } = require('../tools/check-race-teaching.cjs');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const fixture = {
  html: read('public/race.html'),
  thunder: read('src/games/thunder.js'),
  tutorial: read('src/games/tutorial.js'),
};

test('race teaching embeds the exact authoritative engine and tutorial sources', () => {
  assert.doesNotThrow(() => checkRepository());
});

test('race teaching source check accepts independent Windows and Unix line endings', () => {
  for (const key of ['html', 'thunder', 'tutorial']) {
    assert.doesNotThrow(() => checkTeachingSources({ ...fixture, [key]: fixture[key].replace(/\r?\n/g, '\r\n') }));
  }
});

for (const [source, token, replacement] of [
  ['thunder', 'class ThunderRoom', 'class ChangedThunderRoom'],
  ['tutorial', 'const missions=', 'const changedMissions='],
]) {
  test(`race teaching rejects a changed ${source} token in either copy`, () => {
    assert.ok(fixture[source].includes(token));
    for (const key of ['html', source]) {
      assert.throws(() => checkTeachingSources({ ...fixture, [key]: fixture[key].replace(token, replacement) }), /source mismatch/);
    }
  });
}

test('race teaching does not ignore whitespace, comments, exports, or wrapper changes', () => {
  for (const [token, replacement] of [
    ['const module={exports:{}};', 'const module = {exports:{}};'],
    ['Math.floor(Math.random()*n)', 'Math.ceil(Math.random()*n)'],
    ["require=()=>TutorialEngine;", "require=()=>null;"],
    ['return module.exports;})();', 'return {};})();'],
    ['// Thunder Road: Vendetta', '// Changed Thunder Road: Vendetta'],
    ['module.exports={ThunderRoom,neighbor,', 'module.exports={ThunderRoom,'],
  ]) {
    assert.ok(fixture.html.includes(token));
    assert.throws(() => checkTeachingSources({ ...fixture, html: fixture.html.replace(token, replacement) }), /source mismatch/);
  }
  assert.throws(() => checkTeachingSources({ ...fixture, thunder: fixture.thunder.trimEnd() }), /source mismatch/);
});

test('race teaching rejects missing, duplicate, and prematurely closed boundaries', () => {
  for (const html of [
    fixture.html.replace('<script data-teaching-table>', '<script>'),
    fixture.html + '<script data-teaching-table>',
    fixture.html.replace('const exitHref=', 'const changedExitHref='),
    fixture.html.replace('const missions=', '</script>const missions='),
    fixture.html.replace('const missions=', '(()=>{\nconst $=s=>document.querySelector(s);\nconst exitHref=const missions='),
  ]) assert.throws(() => checkTeachingSources({ ...fixture, html }));
});

test('race teaching leaves the handwritten shell and unrelated HTML outside source ownership', () => {
  assert.ok(fixture.html.includes('配件 · 車子：敵我辨識'));
  const html = fixture.html.replace('配件 · 車子：敵我辨識', '手寫教學章節').replace('<!doctype html>', '<!doctype html>\n');
  assert.doesNotThrow(() => checkTeachingSources({ ...fixture, html }));
});

test('race teaching check-only CLI works outside the repository working directory', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'tools/check-race-teaching.cjs')], { cwd: path.dirname(root), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /race teaching sources match/);
});


test('race teaching CLI returns nonzero for either embedded token drift without rewriting files', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-race-sources-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const name of ['tools', 'public', 'src/games']) fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.copyFileSync(path.join(root, 'tools/check-race-teaching.cjs'), path.join(dir, 'tools/check-race-teaching.cjs'));
  fs.writeFileSync(path.join(dir, 'src/games/thunder.js'), fixture.thunder);
  fs.writeFileSync(path.join(dir, 'src/games/tutorial.js'), fixture.tutorial);
  for (const token of ['class ThunderRoom', 'const missions=']) {
    const html = fixture.html.replace(token, token + 'Changed');
    fs.writeFileSync(path.join(dir, 'public/race.html'), html);
    const result = spawnSync(process.execPath, [path.join(dir, 'tools/check-race-teaching.cjs')], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /source mismatch/);
    assert.equal(fs.readFileSync(path.join(dir, 'public/race.html'), 'utf8'), html);
  }
});
