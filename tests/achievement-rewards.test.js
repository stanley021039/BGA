'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  { randomUUID } = require('node:crypto');
const { openDatabase } = require('../src/db'),
  { AchievementStore, definitions } = require('../src/achievements/store');
const { validateRewardsDatabase } = require('../src/achievements/reward-store'),
  { rewards } = require('../src/achievements/rewards'),
  { attachMatchAchievements } = require('../src/achievements/match-tracker');
function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const ids = [randomUUID(), randomUUID()];
  for (let i = 0; i < ids.length; i++)
    db.prepare(
      'INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',
    ).run(ids[i], 'rewards' + i, '同名', 'unused', 'member', '2026-10-16T00:00:00.000Z');
  return { db, ids, store: new AchievementStore(db) };
}
function match(user, game = 'musicquiz', eligible = true) {
  return {
    id: randomUUID(),
    game,
    completed_at: '2026-10-16T01:00:00.000Z',
    participants: [{ user_id: user, seat_id: 'one', eligible }],
  };
}
test('all twelve games have distinct original rewards and additional attainable milestones', () => {
  assert.equal(rewards.length, 24);
  assert.equal(new Set(rewards.map((r) => r.game)).size, 12);
  assert.equal(new Set(rewards.map((r) => r.frameId)).size, 24);
  assert.equal(definitions.length, 57);
  for (const r of rewards) {
    assert.ok(definitions.some((d) => d.id === r.achievementId));
    assert.ok(definitions.some((d) => d.id === r.game + '-regular'));
    assert.ok(definitions.some((d) => d.id === r.game + '-veteran'));
  }
});
test('claims require earned prerequisites, stay personal and are idempotent across store recreation', (t) => {
  const f = fixture(t),
    [a, b] = f.ids;
  assert.throws(
    () => f.store.claim(a, 'vinyl'),
    (e) => e.code === 'ACHIEVEMENT_LOCKED',
  );
  assert.throws(
    () => f.store.assertFrame(a, 'vinyl'),
    (e) => e.code === 'FRAME_LOCKED',
  );
  const m = match(a);
  f.store.recordMatch(m);
  assert.equal(f.store.list(a).rewards.find((r) => r.frameId === 'vinyl').earned, true);
  f.store.assertFrame(a, 'jelly');
  const data = f.store.claim(a, 'vinyl'),
    date = data.rewards.find((r) => r.frameId === 'vinyl').claimedAt;
  f.store.assertFrame(a, 'vinyl');
  assert.throws(() => f.store.assertFrame(b, 'vinyl'));
  assert.equal(
    new AchievementStore(f.db).claim(a, 'vinyl').rewards.find((r) => r.frameId === 'vinyl')
      .claimedAt,
    date,
  );
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM user_cosmetic_rewards').get().n, 1);
  assert.equal(validateRewardsDatabase(f.db), true);
});
test('only production eligible unique completions count; conflicts and disabled accounts cannot mint rewards', (t) => {
  const f = fixture(t),
    a = f.ids[0],
    m = match(a);
  f.store.recordMatch(m, { purpose: 'test' });
  f.store.recordMatch(match(a, 'musicquiz', false));
  assert.equal(
    f.store.list(a).achievements.find((a) => a.id === 'musicquiz-regular').progress.current,
    0,
  );
  f.store.recordMatch(m);
  f.store.recordMatch(m);
  f.store.recordMatch(match(a));
  f.store.recordMatch(match(a));
  assert.equal(
    f.store.list(a).achievements.find((a) => a.id === 'musicquiz-regular').progress.current,
    3,
  );
  assert.ok(f.store.list(a).achievements.find((a) => a.id === 'musicquiz-regular').unlockedAt);
  assert.throws(
    () => f.store.recordMatch({ ...m, game: 'bluff' }),
    (e) => e.code === 'MATCH_EVENT_CONFLICT',
  );
  f.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(a);
  assert.throws(() => f.store.claim(a, 'vinyl'));
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM user_cosmetic_rewards').get().n, 0);
});
test('existing round and hand games count effective accepted operations and preserve badge dates', (t) => {
  const f = fixture(t),
    a = f.ids[0];
  for (let i = 0; i < 10; i++)
    f.store.processUnit({
      unit_event_id: randomUUID(),
      match_id: randomUUID(),
      game_type: 'draw',
      unit: 'round',
      round: 1,
      status: 'rules_completed',
      completed_at: '2026-10-16T01:00:00.000Z',
      participants: [
        { user_id: a, seat_id: 'one', eligible: true, artist: true, strokeAccepted: i !== 1 },
      ],
      metrics: { participantCount: 1 },
    });
  let data = f.store.list(a);
  assert.equal(data.achievements.find((a) => a.id === 'draw-regular').progress.current, 9);
  assert.equal(data.achievements.find((a) => a.id === 'draw-veteran').unlockedAt, null);
  assert.equal(data.rewards.find((r) => r.frameId === 'palette').earned, true);
  f.store.claim(a, 'palette');
  assert.equal(validateRewardsDatabase(f.db), true);
});
test('transfer validator rejects modified match facts and forged cosmetic prerequisite mappings', (t) => {
  const f = fixture(t),
    a = f.ids[0];
  f.store.recordMatch(match(a));
  f.store.claim(a, 'vinyl');
  f.db.prepare("UPDATE user_cosmetic_rewards SET achievement_id='all-first-table'").run();
  assert.throws(() => validateRewardsDatabase(f.db));
  f.db.prepare("UPDATE user_cosmetic_rewards SET achievement_id='musicquiz-first-match'").run();
  f.db.prepare('UPDATE achievement_match_events SET fingerprint=?').run('0'.repeat(64));
  assert.throws(() => validateRewardsDatabase(f.db));
});
function bind(room, user) {
  const p = room.add('本人');
  attachMatchAchievements(room);
  Object.defineProperty(room, 'achievementUnitStart', {
    value: () => [{ user_id: user, seat_id: p.id }],
  });
  return p;
}
const act = (r, p, action, extra = {}) =>
  r.act(p.id, action, { roundId: r.roundId, requestId: randomUUID(), ...extra });
test('actual music actions require three resolved songs, not listening, passing or waiting', (t) => {
  const f = fixture(t),
    { MusicQuizRoom } = require('../src/games/musicquiz'),
    r = new MusicQuizRoom('ABCDEF', '測試', (n) => 0),
    p = bind(r, f.ids[0]);
  r.configure(p.id, {
    banks: ['custom'],
    target: 10,
    customSongs: Array.from({ length: 6 }, (_, i) => ({
      title: '歌' + i,
      artist: '藝人',
      year: 2000 + i,
      videoId: 'dQw4w9WgXc' + i,
      introStart: 0,
      highlightStart: 20,
      aiGenerated: false,
    })),
  });
  r.start();
  while (r.phase !== 'finished') {
    if (r.phase === 'pick') act(r, p, 'listen');
    else if (r.phase === 'intro') act(r, p, 'guess', { choiceId: r.correctChoiceId });
    else if (r.phase === 'timeline') act(r, p, 'place', { slot: 0 });
    else if (r.phase === 'reveal') act(r, p, 'next');
    else throw Error(r.phase);
  }
  r.matchAchievements.finish();
  assert.equal(r.matchAchievements.completed.participants[0].eligible, true);
  assert.ok(!JSON.stringify(r).includes('user_id'));
  f.store.recordMatch(r.matchAchievements.completed);
  assert.ok(
    f.store.list(f.ids[0]).achievements.find((a) => a.id === 'musicquiz-first-match').unlockedAt,
  );
});
test('six real TRPG plans qualify, host skips or waiting do not substitute for personal plans', (t) => {
  const f = fixture(t),
    { TrpgRoom } = require('../src/games/trpg'),
    r = new TrpgRoom('ABCDEF', '冒險', (n) => 0),
    p = bind(r, f.ids[0]);
  r.start();
  while (r.phase !== 'finished') {
    const data = { sceneId: r.sceneId, requestId: randomUUID() };
    if (r.phase === 'planning') {
      r.act(p.id, 'plan', { ...data, stance: 'recover', approach: 'connect', note: '' });
      r.act(p.id, 'resolve', { sceneId: r.sceneId, requestId: randomUUID() });
    } else r.act(p.id, 'next', data);
  }
  r.matchAchievements.finish();
  assert.equal(r.matchAchievements.completed.participants[0].eligible, true);
  f.store.recordMatch(r.matchAchievements.completed);
  f.store.claim(f.ids[0], 'lantern');
});

test('Bluff completion requires every real explanation/judgment; bots and early departure do not earn the microphone', (t) => {
  const f = fixture(t),
    { BluffRoom } = require('../src/games/bluff'),
    r = new BluffRoom('ABCDEF', '口說', (n) => 0),
    p = bind(r, f.ids[0]);
  r.add('腳本1', true);
  r.add('腳本2', true);
  r.start();
  while (r.phase !== 'finished') {
    const thinker = r.player(r.thinkerId);
    if (r.phase === 'selecting')
      act(r, thinker, 'choose', { questionId: r.offeredChoices()[0].id });
    else if (r.phase === 'preparing') for (const q of r.players) act(r, q, 'ready');
    else if (r.phase === 'discussion') {
      for (const q of r.players.filter((q) => q.id !== r.thinkerId))
        act(r, q, 'spoken', { text: '測試說明' });
      act(r, thinker, 'guess', {
        targetId: r.players.find((q) => r.roles[q.id] === 'honest').id,
        confirmed: true,
      });
    } else if (r.phase === 'reveal') act(r, p, 'next');
    else throw Error(r.phase);
  }
  r.matchAchievements.finish();
  assert.deepEqual(
    r.matchAchievements.completed.participants.map((p) => p.eligible),
    [true],
  );
  f.store.recordMatch(r.matchAchievements.completed);
  f.store.claim(f.ids[0], 'mic');
  const interrupted = new BluffRoom('AAAAAA', '中止', (n) => 0),
    q = bind(interrupted, f.ids[1]);
  interrupted.add('a', true);
  const b = interrupted.add('b', true);
  interrupted.start();
  interrupted.kick(q.id, b.id);
  interrupted.matchAchievements.finish();
  assert.equal(interrupted.matchAchievements.completed, null);
});
test('Minimal nonempty submissions and guesses count, while empty drawings alone cannot unlock the geometry frame', (t) => {
  const f = fixture(t),
    { MinimalRoom } = require('../src/games/minimal');
  for (const empty of [false, true]) {
    const r = new MinimalRoom('ABCDEF', '幾何', (n) => 0),
      p = bind(r, f.ids[empty ? 1 : 0]);
    r.add('腳本1', true);
    r.add('腳本2', true);
    r.start();
    while (r.phase !== 'finished') {
      if (r.phase === 'drawing')
        for (const q of r.artists())
          act(r, q, 'submit', {
            shapes: empty && q.id === p.id ? [] : [{ kind: 'line', x1: 1, y1: 1, x2: 10, y2: 10 }],
          });
      else if (r.phase === 'guessing')
        act(r, r.player(r.guesserId), 'guess', { text: r.question.title });
      else act(r, p, 'next');
    }
    r.matchAchievements.finish();
    assert.equal(r.matchAchievements.completed.participants[0].eligible, !empty);
  }
});
test('Telephone requires drawing and guessing pages; topics cannot replace skipped or timed-out pages', (t) => {
  const f = fixture(t),
    { TelephoneRoom } = require('../src/games/telephone');
  for (const skip of [false, true]) {
    let now = 1000000;
    const r = new TelephoneRoom(
        'ABCDEF',
        '接力',
        (n) => 0,
        () => now,
      ),
      p = bind(r, f.ids[skip ? 1 : 0]);
    r.add('a', true);
    r.add('b', true);
    r.start();
    require('./helpers/telephone.cjs').completeTelephoneTopics(r);
    while (r.phase !== 'finished') {
      for (const q of r.players)
        r.act(q.id, skip && q.id === p.id ? 'skip' : 'submit', {
          stepId: r.stepId,
          requestId: randomUUID(),
          ...(r.round % 2
            ? {
                strokes: [
                  {
                    tool: 'brush',
                    color: '#112233',
                    size: 2,
                    points: [
                      [1, 1],
                      [2, 2],
                    ],
                  },
                ],
              }
            : { text: '接力猜詞' }),
        });
      now = r.deadline;
      r.auto();
    }
    r.matchAchievements.finish();
    assert.equal(r.matchAchievements.completed.participants[0].eligible, !skip);
    if (!skip) {
      f.store.recordMatch(r.matchAchievements.completed);
      f.store.claim(f.ids[0], 'letters');
    }
  }
});
test('replaying a topic receipt cannot replace a missing drawing for achievements', (t) => {
  const f = fixture(t),
    { TelephoneRoom } = require('../src/games/telephone');
  let now = 1000000;
  const room = new TelephoneRoom(
    'ABCDEF',
    '重送',
    () => 0,
    () => now,
  );
  const player = bind(room, f.ids[0]);
  room.add('a', true);
  room.add('b', true);
  room.start();
  const topic = { stepId: room.stepId, requestId: randomUUID(), text: '我的主題' };
  room.act(player.id, 'submit', topic);
  for (const peer of room.players.slice(1))
    room.act(peer.id, 'submit', { stepId: room.stepId, requestId: randomUUID(), text: '同伴主題' });
  room.act(player.id, 'submit', topic);
  assert.equal(room.submissions[player.id], undefined);
  now = room.deadline;
  room.auto();
  for (const peer of room.players)
    room.act(peer.id, 'submit', {
      stepId: room.stepId,
      requestId: randomUUID(),
      text: '第二頁猜詞',
    });
  now = room.deadline;
  room.auto();
  room.matchAchievements.finish();
  assert.equal(room.matchAchievements.completed.participants[0].eligible, false);
});

test('market milestones count settled days once, including corrections, and ignore nonvoters', (t) => {
  const f = fixture(t),
    { MarketStore } = require('../src/market/store');
  f.db.prepare("UPDATE users SET role='admin' WHERE id=?").run(f.ids[0]);
  const admin = { id: f.ids[0] },
    member = { id: f.ids[1] };
  let now = Date.parse('2026-10-01T00:00:00Z');
  const market = new MarketStore(f.db, () => now);
  for (const date of ['2026-10-02', '2026-10-05', '2026-10-06']) {
    now = Date.parse(date + 'T00:00:00Z') - 86400000;
    const { roundId } = market.create(admin, {
        requestId: randomUUID(),
        targetDate: date,
        confirmed: true,
      }),
      round = market.round(roundId),
      rules = JSON.parse(round.rules_json);
    market.vote(member, {
      requestId: randomUUID(),
      roundId,
      expectedRevision: 0,
      ...(rules.version === 3 ? { forecastTick: 0 } : { optionId: rules.options[0].id }),
    });
    now = Date.parse(round.settlement_after);
    market.settle(admin, {
      requestId: randomUUID(),
      roundId,
      returnPct: '0.0',
      expectedRevision: 0,
      confirmed: true,
    });
    market.settle(admin, {
      requestId: randomUUID(),
      roundId,
      returnPct: '0.1',
      expectedRevision: 1,
      confirmed: true,
      reason: '測試更正',
    });
  }
  const result = f.store.list(member.id);
  assert.equal(result.achievements.find((a) => a.id === 'market-regular').progress.current, 3);
  assert.equal(f.store.list(admin.id).rewards.find((r) => r.frameId === 'market').earned, false);
  f.store.claim(member.id, 'market');
  assert.equal(validateRewardsDatabase(f.db), true);
});

test('new reward descriptors and client art preserve every old ID while enforcing independent prerequisites', () => {
  const fs = require('node:fs'),
    vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../public/shared/barrage-frames.js'), 'utf8');
  const optionsMatch = source.match(
    /const\s+options\s*=\s*Object\.freeze\(\s*(\[[\s\S]*?\])\s*\.map\(Object\.freeze\)/,
  );
  assert.ok(optionsMatch, 'client options remain an immutable declared array');
  const options = vm.runInNewContext('(' + optionsMatch[1] + ')');
  const artworkMatch = source.match(/const\s+artwork\s*=\s*(Object\.freeze\(\{[\s\S]*?\n\s*\}\));/);
  assert.ok(artworkMatch, 'client artwork remains an immutable declared dictionary');
  const artwork = vm.runInNewContext('(' + artworkMatch[1] + ')');
  for (const r of rewards) {
    const option = options.find((o) => o.id === r.frameId);
    assert.equal(option.achievementId, r.achievementId);
    assert.equal(option.achievementTitle, r.achievementTitle);
    assert.equal(option.group, '成就獎勵');
    assert.ok(r.frameId.length <= 7);
    assert.ok(artwork[r.frameId].startsWith('<div'), r.frameId + ' has real client artwork');
  }
  assert.equal(options.length, 48);
  assert.equal(rewards.find((r) => r.frameId === 'vinyl').achievementId, 'musicquiz-first-match');
  assert.equal(rewards.find((r) => r.frameId === 'encore').achievementId, 'musicquiz-intro-streak');
  new vm.Script(source);
});

test('previously claimed shared-frame records survive the new reward split without unlocking the new frame', (t) => {
  const f = fixture(t),
    a = f.ids[0];
  const m = match(a);
  m.participants[0].challenges = ['musicquiz-intro-streak'];
  f.store.recordMatch(m);
  f.store.claim(a, 'vinyl');
  const before = f.store.list(a).rewards.find((r) => r.frameId === 'vinyl').claimedAt;
  f.db
    .prepare(
      "UPDATE user_cosmetic_rewards SET achievement_id='musicquiz-intro-streak' WHERE user_id=? AND frame_id='vinyl'",
    )
    .run(a);
  assert.equal(validateRewardsDatabase(f.db), true);
  const restored = new AchievementStore(f.db);
  restored.assertFrame(a, 'vinyl');
  assert.equal(restored.list(a).rewards.find((r) => r.frameId === 'vinyl').claimedAt, before);
  assert.equal(restored.list(a).rewards.find((r) => r.frameId === 'encore').claimedAt, null);
  assert.throws(
    () => restored.assertFrame(a, 'encore'),
    (e) => e.code === 'FRAME_LOCKED',
  );
  restored.claim(a, 'encore');
  assert.equal(validateRewardsDatabase(f.db), true);
});
