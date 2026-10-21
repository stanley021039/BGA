'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { MajorityRoom } = require('../src/games/majority'),
  { HistoryStore, DEFAULT_LIMITS } = require('../src/history/store');
test('12 players finish a 256-candidate bracket within default history quotas with every vote archived', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bga-large-bracket-')),
    h = new HistoryStore(dir);
  t.after(() => {
    h.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(dir).startsWith('bga-large-bracket-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const r = new MajorityRoom('ABCDEF', 'large history', () => 0);
  h.attach(r);
  for (let i = 0; i < 12; i++)
    h.transact(r, { action: 'join' }, () => r.add('長名字測試玩家第' + i + '號'));
  h.transact(r, { action: 'configure' }, () =>
    r.configure(r.host, { mode: 'scenario', theme: 'daily-mix', bracketSize: 256 }),
  );
  h.transact(r, { action: 'start' }, () => r.start());
  for (let round = 0; round < 255; round++) {
    for (const p of r.players)
      h.transact(r, { action: 'answer', playerId: p.id }, () =>
        r.act(p.id, 'answer', { questionId: r.question.id, answer: round % 2 }),
      );
    h.transact(r, { action: 'next' }, () => r.act(r.host, 'next'));
  }
  assert.equal(r.phase, 'finished');
  assert.equal(r.results.length, 255);
  assert.equal(r.view(r.host).tournament.entryRanking.length, 256);
  const meta = h.list()[0];
  assert.equal(meta.status, 'finished');
  assert.equal(meta.count, 3316);
  const size = fs.statSync(path.join(dir, meta.id + '.jsonl')).size;
  assert.ok(size < DEFAULT_LIMITS.maxMatchBytes, 'archive ' + size + ' exceeds match quota');
  const snap = r.historyState();
  assert.equal(snap.completedRounds, 255);
  assert.ok(!Object.hasOwn(snap, 'results'));
  assert.equal(snap.tournamentState.champion.id, r.tournamentState.champion.id);
  assert.ok(Buffer.byteLength(JSON.stringify(snap)) < DEFAULT_LIMITS.maxResultBytes / 2);
});
