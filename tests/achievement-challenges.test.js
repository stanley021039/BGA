'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto'),
  { openDatabase } = require('../src/db'),
  { AchievementStore } = require('../src/achievements/store'),
  { attachMatchAchievements } = require('../src/achievements/match-tracker'),
  { validateRewardsDatabase } = require('../src/achievements/reward-store');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const ids = Array.from({ length: 3 }, () => randomUUID());
  for (const [i, id] of ids.entries())
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(id, 'challenge' + i, '玩家' + i, 'unused', 'member', '2026-10-19T00:00:00.000Z');
  return { db, ids, store: new AchievementStore(db) };
}
function bind(r, ids) {
  const seats = ids.map((id, i) => r.add('玩家' + i));
  attachMatchAchievements(r);
  Object.defineProperty(r, 'achievementUnitStart', {
    value: () => seats.map((p, i) => ({ user_id: ids[i], seat_id: p.id })),
  });
  return seats;
}
const act = (r, p, a, d = {}) =>
  r.act(p.id, a, { roundId: r.roundId, requestId: randomUUID(), ...d });
test('old unlocks retain their frame while creative challenges grant an independent new frame', (t) => {
  const f = fixture(t),
    a = f.ids[0],
    b = f.ids[1],
    at = '2026-10-19T12:00:00.000Z';
  const match = (user, challenges) => ({
    id: randomUUID(),
    game: 'musicquiz',
    completed_at: at,
    participants: [
      { user_id: user, seat_id: 'one', eligible: true, ...(challenges ? { challenges } : {}) },
    ],
  });
  f.store.recordMatch(match(a));
  f.store.claim(a, 'vinyl');
  f.store.recordMatch(match(b, ['musicquiz-intro-streak']));
  assert.ok(f.store.list(b).achievements.find((a) => a.id === 'musicquiz-intro-streak').unlockedAt);
  f.store.claim(b, 'encore');
  assert.throws(
    () => f.store.claim(a, 'encore'),
    (e) => e.code === 'ACHIEVEMENT_LOCKED',
  );
  assert.equal(f.store.list(a).rewards.find((r) => r.frameId === 'vinyl').claimedAt !== null, true);
  assert.equal(
    f.store.list(b).rewards.find((r) => r.frameId === 'encore').claimedAt !== null,
    true,
  );
  assert.equal(validateRewardsDatabase(f.db), true);
  assert.throws(
    () => f.store.recordMatch(match(b, ['bluff-convincing'])),
    (e) => e.code === 'INVALID_ACHIEVEMENT_MATCH',
  );
});
test('real TRPG assist plans unlock a support challenge; ordinary completion still preserves the entry reward', (t) => {
  const f = fixture(t),
    { TrpgRoom } = require('../src/games/trpg'),
    r = new TrpgRoom('ABCDEF', '支援', (n) => n - 1),
    [p] = bind(r, [f.ids[0]]);
  r.start();
  while (r.phase !== 'finished') {
    const d = { sceneId: r.sceneId, requestId: randomUUID() };
    if (r.phase === 'planning') {
      r.act(p.id, 'plan', { ...d, stance: 'assist', approach: 'connect', note: '大家一起支援' });
      r.act(p.id, 'resolve', { sceneId: r.sceneId, requestId: randomUUID() });
    } else r.act(p.id, 'next', d);
  }
  r.matchAchievements.finish();
  assert.ok(
    r.matchAchievements.completed.participants[0].challenges.includes('trpg-support-three'),
  );
  f.store.recordMatch(r.matchAchievements.completed);
  f.store.claim(f.ids[0], 'lantern');
  assert.equal(validateRewardsDatabase(f.db), true);
});
test('real bluff decisions use seat identity and award the chosen bluffer, not another player with the same name', (t) => {
  const f = fixture(t),
    { BluffRoom } = require('../src/games/bluff'),
    r = new BluffRoom('ABCDEF', '說書', () => 0),
    seats = bind(r, f.ids);
  for (const p of seats) p.name = '同名';
  r.start();
  const tricked = new Set();
  while (r.phase !== 'finished') {
    const thinker = r.player(r.thinkerId);
    if (r.phase === 'selecting')
      act(r, thinker, 'choose', { questionId: r.offeredChoices()[0].id });
    else if (r.phase === 'preparing') for (const p of seats) act(r, p, 'ready');
    else if (r.phase === 'discussion') {
      for (const p of seats.filter((p) => p.id !== r.thinkerId)) act(r, p, 'spoken');
      const target = seats.find((p) => r.roles[p.id] === 'bluffer');
      tricked.add(target.id);
      act(r, thinker, 'guess', { targetId: target.id, confirmed: true });
    } else act(r, seats[0], 'next');
  }
  r.matchAchievements.finish();
  for (const p of r.matchAchievements.completed.participants)
    assert.equal(p.challenges.includes('bluff-convincing'), tricked.has(p.seat_id));
  f.store.recordMatch(r.matchAchievements.completed);
  for (const p of r.matchAchievements.completed.participants.filter((p) => tricked.has(p.seat_id)))
    assert.ok(
      f.store.list(p.user_id).achievements.find((a) => a.id === 'bluff-convincing').unlockedAt,
    );
  assert.equal(validateRewardsDatabase(f.db), true);
});

test('real minimal drawings of three shapes or fewer unlock a creative route without granting idle players credit', (t) => {
  const f = fixture(t),
    { MinimalRoom } = require('../src/games/minimal'),
    r = new MinimalRoom('ABCDEF', '三筆', () => 0),
    seats = bind(r, f.ids);
  r.start();
  const understood = new Set();
  while (r.phase !== 'finished') {
    if (r.phase === 'drawing')
      for (const p of r.artists())
        act(r, p, 'submit', { shapes: [{ kind: 'line', x1: 1, y1: 1, x2: 10, y2: 10 }] });
    else if (r.phase === 'guessing') {
      understood.add(r.order[r.shown]);
      act(r, r.player(r.guesserId), 'guess', { text: r.question.title });
    } else act(r, seats[0], 'next');
  }
  r.matchAchievements.finish();
  f.store.recordMatch(r.matchAchievements.completed);
  for (const p of r.matchAchievements.completed.participants)
    assert.equal(p.challenges.includes('minimal-three-shapes'), understood.has(p.seat_id));
  assert.equal(validateRewardsDatabase(f.db), true);
});
test('countertrend reward needs a real positive settlement against more than half the table, not three ordinary days', (t) => {
  const f = fixture(t),
    { MarketStore } = require('../src/market/store');
  f.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(f.ids[0]);
  let now = Date.parse('2026-10-19T00:00:00Z');
  const m = new MarketStore(f.db, () => now),
    owner = { id: f.ids[0] };
  const { roundId } = m.create(owner, {
      requestId: randomUUID(),
      targetDate: '2026-10-20',
      confirmed: true,
    }),
    round = m.round(roundId),
    rules = JSON.parse(round.rules_json);
  for (const [i, id] of f.ids.entries())
    m.vote(
      { id },
      {
        requestId: randomUUID(),
        roundId,
        expectedRevision: 0,
        ...(rules.version === 3
          ? { forecastTick: i ? -50 : 2 }
          : { optionId: i ? 'crash' : 'rise' }),
      },
    );
  now = Date.parse(round.settlement_after);
  m.settle(owner, {
    requestId: randomUUID(),
    roundId,
    expectedRevision: 0,
    returnPct: 0.2,
    reason: '真實結算測試',
    confirmed: true,
  });
  assert.ok(
    f.store.list(f.ids[0]).achievements.find((a) => a.id === 'market-countertrend').unlockedAt,
  );
  assert.equal(
    f.store.list(f.ids[1]).achievements.find((a) => a.id === 'market-countertrend').unlockedAt,
    null,
  );
  f.store.claim(f.ids[0], 'rebound');
  assert.equal(validateRewardsDatabase(f.db), true);
  const ledgers = f.db.prepare('SELECT COUNT(*) n FROM market_ledger').get().n;
  // A historical pre-removal reset snapshot still suppresses regrant from old history.
  const cutoff = new Date().toISOString();
  for (const user of f.ids)
    f.db
      .prepare('UPDATE users SET appearance=? WHERE id=?')
      .run(JSON.stringify({ achievementResetAt: cutoff }), user);
  f.db.exec(
    'DELETE FROM user_cosmetic_rewards; DELETE FROM achievement_progress; DELETE FROM user_achievements; DELETE FROM processed_unit_events; DELETE FROM achievement_match_events;',
  );
  assert.deepEqual(
    f.store.list(f.ids[0]).achievements.filter((item) => item.unlockedAt),
    [],
  );
  const reopened = new AchievementStore(f.db);
  assert.deepEqual(
    reopened.list(f.ids[0]).achievements.filter((item) => item.unlockedAt),
    [],
  );
  assert.equal(
    f.db.prepare('SELECT COUNT(*) n FROM market_ledger').get().n,
    ledgers,
    'reset leaves trading history intact',
  );
});
