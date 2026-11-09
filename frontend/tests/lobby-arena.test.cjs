'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
const ts = require('typescript');
function load(file) {
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id) =>
        load(path.resolve(path.dirname(file), /\.(ts|js|json)$/.test(id) ? id : id + '.ts')),
    },
  );
  return module.exports;
}
const { readLobbyArena } = load(path.join(__dirname, '../src/contracts/lobby-arena.ts'));
const { createLobby } = require('../../src/rooms/lobby');
function snapshot() {
  const lobby = createLobby(() => 1000),
    a = { id: 'a', display_name: 'A' },
    b = { id: 'b', display_name: 'B' };
  lobby.view(a);
  lobby.view(b);
  lobby.arena(a, { action: 'team', team: 'red' });
  lobby.arena(b, { action: 'team', team: 'blue' });
  return lobby.arena(a, { action: 'start', mode: 'pk', matchId: null }).arena;
}
test('new arena contract preserves authoritative roster, cover geometry and clock', () => {
  const source = snapshot(),
    parsed = readLobbyArena(source);
  assert.deepEqual(JSON.parse(JSON.stringify(parsed)), JSON.parse(JSON.stringify(source)));
  assert.equal(parsed.match.players.length, 2);
  assert.equal(parsed.match.remainingMs, 60000);
});
test('older lobby snapshots remain compatible without arena data', () => {
  assert.equal(readLobbyArena(undefined), null);
  assert.equal(readLobbyArena(null), null);
});
test('malformed team, score, time, geometry and match phase cannot enter the client store', () => {
  for (const mutate of [
    (s) => (s.teams[0].team = 'green'),
    (s) => (s.match.players[0].score = -1),
    (s) => (s.match.players[0].score = 1.5),
    (s) => (s.match.remainingMs = Infinity),
    (s) => (s.covers[0].width = 101),
    (s) => (s.match.phase = 'won'),
  ]) {
    const source = JSON.parse(JSON.stringify(snapshot()));
    mutate(source);
    assert.throws(() => readLobbyArena(source));
  }
});
test('pickup contract preserves server types and rejects unknown, repeated or excessive loot', () => {
  const { readPickups, readPickupEffects } = load(
    path.join(__dirname, '../src/contracts/lobby-pickups.ts'),
  );
  const source = { id: 'loot', kind: 'speed', x: 10, y: 85, at: 1000, until: 31000 };
  assert.deepEqual(JSON.parse(JSON.stringify(readPickups([source]))), [source]);
  assert.equal(readPickups(undefined).length, 0);
  for (const value of [
    [{ ...source, kind: 'money' }],
    [{ ...source, x: 101 }],
    [{ ...source, until: 1000 }],
    [source, source],
    Array(4).fill(source),
  ])
    assert.throws(() => readPickups(value));
  assert.equal(readPickupEffects(undefined), undefined);
  const effect = {
    speedUntil: 7000,
    shieldUntil: 0,
    last: { id: 'loot', kind: 'speed', at: 1000, until: 5000 },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(readPickupEffects(effect))), effect);
  assert.throws(() => readPickupEffects({ ...effect, speedUntil: Infinity }));
});

test('new terrain, sword, archetypes and damage totals survive real contract without truncating walls', () => {
  const source = snapshot();
  const parsed = readLobbyArena(source);
  assert(parsed.covers.length > 3);
  assert.equal(parsed.hazards.length, 3);
  assert.equal(parsed.match.players[0].archetype, 'attack');
  assert.equal(parsed.match.players[0].damageTaken, 0);
  for (const mutate of [
    (s) => (s.match.players[0].damageTaken = -1),
    (s) => (s.teams[0].archetype = 'hacked'),
    (s) => (s.hazards[0].width = 101),
    (s) => (s.covers = Array(65).fill(s.covers[0])),
  ]) {
    const bad = JSON.parse(JSON.stringify(source));
    mutate(bad);
    assert.throws(() => readLobbyArena(bad));
  }
});
test('avatar interpolation honors server speed and slow durations without crossing waypoint', () => {
  const { interpolateSceneVisitor } = load(
    path.join(__dirname, '../src/services/scene-interpolation.ts'),
  );
  for (const duration of [500, 1000, 2000]) {
    const v = { x: 10, y: 20, targetX: 22, targetY: 20, remainingMs: duration };
    assert.equal(interpolateSceneVisitor(v, duration / 2).x, 16);
    assert.equal(interpolateSceneVisitor(v, duration * 2).x, 22);
  }
});
