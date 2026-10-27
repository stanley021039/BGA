'use strict';
const { createHash } = require('node:crypto');
const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const { rewards } = require('./rewards');
const Challenges = require('./challenges');
const { resetCutoff } = require('./reset-cutoff');
const { normalizeUnit, effectiveParticipants, UUID } = require('./units');
const MATCH_GAMES = new Set(['quacks', 'musicquiz', 'bluff', 'minimal', 'telephone', 'trpg']);
const bad = () => {
  throw new HttpError(400, 'INVALID_ACHIEVEMENT_MATCH', '成就完局資料不正確');
};
function normalizeMatch(input) {
  if (
    !input ||
    !UUID.test(input.id) ||
    !MATCH_GAMES.has(input.game) ||
    !['production', 'test', 'tutorial'].includes(input.purpose) ||
    !Array.isArray(input.participants) ||
    input.participants.length > 12 ||
    !input.participants.length ||
    !Number.isFinite(Date.parse(input.completed_at)) ||
    new Date(input.completed_at).toISOString() !== input.completed_at
  )
    bad();
  const users = new Set(),
    seats = new Set();
  const participants = input.participants
    .map((p) => {
      if (
        !p ||
        !UUID.test(p.user_id) ||
        typeof p.seat_id !== 'string' ||
        !p.seat_id.length ||
        p.seat_id.length > 128 ||
        users.has(p.user_id.toLowerCase()) ||
        seats.has(p.seat_id) ||
        typeof p.eligible !== 'boolean'
      )
        bad();
      users.add(p.user_id.toLowerCase());
      seats.add(p.seat_id);
      if (
        p.challenges !== undefined &&
        !Challenges.validChallenges(input.game, p.challenges, Challenges.match)
      )
        bad();
      return {
        user_id: p.user_id,
        seat_id: p.seat_id,
        eligible: p.eligible,
        ...(p.challenges !== undefined ? { challenges: [...p.challenges].sort() } : {}),
      };
    })
    .sort((a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
  return {
    id: input.id,
    game: input.game,
    completed_at: input.completed_at,
    purpose: input.purpose,
    participants,
  };
}
const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function progressCounts(db, userId) {
  const cutoff = resetCutoff(db, userId);
  const counts = {};
  for (const row of db
    .prepare('SELECT facts_json FROM processed_unit_events WHERE purpose=? AND status=?')
    .iterate('production', 'rules_completed')) {
    const raw = JSON.parse(row.facts_json),
      unit = normalizeUnit(raw, { legacy: ['poker', 'thunder'].includes(raw.game_type) });
    if (unit.completed_at > cutoff && effectiveParticipants(unit).some((p) => p.user_id === userId))
      counts[unit.game_type] = (counts[unit.game_type] || 0) + 1;
  }
  for (const row of db
    .prepare("SELECT facts_json FROM achievement_match_events WHERE purpose='production'")
    .iterate()) {
    const m = normalizeMatch(JSON.parse(row.facts_json));
    if (m.completed_at > cutoff && m.participants.some((p) => p.user_id === userId && p.eligible))
      counts[m.game] = (counts[m.game] || 0) + 1;
  }
  // Count each settled trading day once, including numeric forecasts; revisions
  // and void rounds never create extra participation credit.
  const hasCurve = !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='market_curve_ledger'")
    .get();
  const hasVoid = db
    .prepare('PRAGMA table_info(market_rounds)')
    .all()
    .some((c) => c.name === 'void_at');
  const select = (table) =>
    'SELECT l.round_id FROM ' +
    table +
    " l JOIN market_rounds r ON r.id=l.round_id AND r.result_revision=l.revision WHERE l.user_id=? AND l.kind='award' " +
    (hasVoid ? ' AND r.void_at IS NULL' : '') +
    ' AND (SELECT s.created_at FROM market_settlements s WHERE s.round_id=l.round_id AND s.revision=l.revision)>?';
  const market = db
    .prepare(
      'SELECT COUNT(DISTINCT round_id) n FROM (' +
        select('market_ledger') +
        (hasCurve ? ' UNION ' + select('market_curve_ledger') : '') +
        ')',
    )
    .get(...(hasCurve ? [userId, cutoff, userId, cutoff] : [userId, cutoff]));
  counts.market = market.n;
  return counts;
}
function marketCountertrend(db, userId, roundId = null, revision = null) {
  const hasCurve = !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='market_curve_ledger'")
    .get();
  const select = (table, points) =>
    'SELECT l.round_id,l.revision,l.user_id,' +
    points +
    ' AS points,(SELECT s.created_at FROM market_settlements s WHERE s.round_id=l.round_id AND s.revision=l.revision) AS settled_at FROM ' +
    table +
    " l JOIN market_rounds r ON r.id=l.round_id WHERE l.kind='award' " +
    (roundId
      ? 'AND l.round_id=? AND l.revision=?'
      : 'AND l.revision=r.result_revision AND r.void_at IS NULL');
  const sql =
    select('market_ledger', 'l.points') +
    (hasCurve ? ' UNION ALL ' + select('market_curve_ledger', 'l.points_units') : '');
  const args = roundId
    ? hasCurve
      ? [roundId, revision, roundId, revision]
      : [roundId, revision]
    : [];
  const groups = new Map();
  for (const r of db.prepare(sql).all(...args)) {
    const key = r.round_id + ':' + r.revision;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()]
    .filter(
      (rows) =>
        rows[0].settled_at > resetCutoff(db, userId) &&
        rows.length >= 3 &&
        rows.some((r) => r.user_id === userId && r.points > 0) &&
        rows.filter((r) => r.points < 0).length > rows.length / 2,
    )
    .map((rows) => ({ roundId: rows[0].round_id, revision: rows[0].revision }));
}
function refreshMilestones(store, userId, at = new Date().toISOString()) {
  if (!store.db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(userId)) return {};
  const counts = progressCounts(store.db, userId);
  for (const background of require('../../public/shared/lobby-backgrounds.json'))
    if (background.achievementId && (counts[background.game] || 0) >= background.target)
      store.insert.run(userId, background.achievementId, 'background:' + background.id, at);
  for (const e of marketCountertrend(store.db, userId))
    store.insert.run(
      userId,
      'market-countertrend',
      'challenge-market:' + e.roundId + ':' + e.revision,
      at,
    );
  for (const [game, n] of Object.entries(counts))
    for (const [threshold, suffix] of [
      [3, 'regular'],
      [10, 'veteran'],
    ])
      if (n >= threshold)
        store.insert.run(userId, game + '-' + suffix, 'milestone:' + game + ':' + threshold, at);
  if (Object.values(counts).filter((n) => n > 0).length >= 2)
    store.insert.run(userId, 'all-two-tables', 'milestone:all:2', at);
  if (
    Object.entries(counts).filter(([game, n]) => !['trpg', 'market'].includes(game) && n > 0)
      .length >= 3
  )
    store.insert.run(userId, 'all-three-games', 'milestone:all:3', at);
  return counts;
}
function recordMatch(store, input) {
  const match = normalizeMatch(input);
  if (match.purpose !== 'production') return [];
  return transaction(store.db, () => {
    const text = JSON.stringify(match),
      hash = fingerprint(match),
      old = store.db
        .prepare('SELECT fingerprint FROM achievement_match_events WHERE event_id=?')
        .get(match.id);
    if (old) {
      if (old.fingerprint !== hash)
        throw new HttpError(409, 'MATCH_EVENT_CONFLICT', '同一完局識別碼內容不一致');
      return [];
    }
    if (text.length > 131072) bad();
    store.db
      .prepare('INSERT INTO achievement_match_events VALUES(?,?,?,?,?,?)')
      .run(match.id, match.game, match.completed_at, match.purpose, hash, text);
    const awards = [];
    for (const p of match.participants) {
      if (match.completed_at <= resetCutoff(store.db, p.user_id)) continue;
      if (
        !p.eligible ||
        !store.db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(p.user_id)
      )
        continue;
      const ids = [
        'all-first-table',
        ...(match.game === 'quacks' ? [] : [match.game + '-first-match']),
        ...(p.challenges || []),
      ];
      for (const id of ids)
        if (store.insert.run(p.user_id, id, 'match:' + match.id, match.completed_at).changes)
          awards.push({ user_id: p.user_id, achievement_id: id });
      refreshMilestones(store, p.user_id, match.completed_at);
    }
    return awards;
  });
}
function earnedRewardId(store, userId, reward) {
  const rows = new Map(store.find.all(userId).map((r) => [r.achievement_id, r.unlocked_at]));
  if (rows.has(reward.achievementId)) return reward.achievementId;
  const legacy = rows.get(reward.legacyAchievementId);
  return legacy ? reward.legacyAchievementId : null;
}
function rewardList(store, userId) {
  const redemption = require('./redemption').redeemedAt(store.db, userId, 'frames');
  const starter = require('./starter-rewards').receipt(store.db, userId);
  const claimed = new Map(
    store.db
      .prepare('SELECT frame_id,claimed_at FROM user_cosmetic_rewards WHERE user_id=?')
      .all(userId)
      .map((r) => [r.frame_id, r.claimed_at]),
  );
  return rewards.map((r) => ({
    ...r,
    earned: !!redemption || !!earnedRewardId(store, userId, r),
    claimedAt:
      claimed.get(r.frameId) ||
      redemption ||
      (starter?.grants.frames.includes(r.frameId) ? starter.redeemedAt : null),
    mediaClaimedAt:
      claimed.get(r.frameId) ||
      redemption ||
      (starter?.grants.media.includes(r.frameId) ? starter.redeemedAt : null),
  }));
}
function assertFrame(store, userId, id) {
  const reward = rewards.find((r) => r.frameId === id);
  if (
    reward &&
    !require('./redemption').redeemedAt(store.db, userId, 'frames') &&
    !require('./starter-rewards').owned(store.db, userId, 'frames').includes(id) &&
    !store.db
      .prepare('SELECT 1 FROM user_cosmetic_rewards WHERE user_id=? AND frame_id=?')
      .get(userId, id)
  )
    throw new HttpError(403, 'FRAME_LOCKED', '請先達成對應成就並領取這個彈幕框');
}
function claimReward(store, userId, frameId) {
  const reward = rewards.find((r) => r.frameId === frameId);
  if (!reward) throw new HttpError(400, 'INVALID_REWARD', '找不到這個成就獎勵');
  if (require('./redemption').redeemedAt(store.db, userId, 'frames')) return store.list(userId);
  transaction(store.db, () => {
    refreshMilestones(store, userId);
    if (
      !store.db.prepare('SELECT 1 FROM users WHERE id=? AND disabled=0').get(userId) ||
      !earnedRewardId(store, userId, reward)
    )
      throw new HttpError(409, 'ACHIEVEMENT_LOCKED', '尚未達成這個獎勵的成就');
    store.db
      .prepare('INSERT OR IGNORE INTO user_cosmetic_rewards VALUES(?,?,?,?)')
      .run(userId, frameId, earnedRewardId(store, userId, reward), new Date().toISOString());
  });
  return store.list(userId);
}
function validateRewardsDatabase(db) {
  const matches = new Map();
  for (const row of db.prepare('SELECT * FROM achievement_match_events').iterate()) {
    const m = normalizeMatch(JSON.parse(row.facts_json));
    if (
      JSON.stringify(m) !== row.facts_json ||
      fingerprint(m) !== row.fingerprint ||
      row.event_id !== m.id ||
      row.game_type !== m.game ||
      row.completed_at !== m.completed_at ||
      row.purpose !== m.purpose
    )
      bad();
    for (const p of m.participants)
      if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(p.user_id)) bad();
    matches.set(m.id, m);
  }
  const counts = new Map(),
    getCounts = (id) => {
      if (!counts.has(id)) counts.set(id, progressCounts(db, id));
      return counts.get(id);
    };
  for (const row of db
    .prepare(
      "SELECT * FROM user_achievements WHERE source_key LIKE 'match:%' OR source_key LIKE 'milestone:%'",
    )
    .iterate()) {
    if (row.source_key.startsWith('match:')) {
      const m = matches.get(row.source_key.slice(6));
      if (
        !m ||
        m.purpose !== 'production' ||
        !m.participants.some((p) => p.user_id === row.user_id && p.eligible) ||
        row.unlocked_at !== m.completed_at ||
        ![
          'all-first-table',
          m.game + '-first-match',
          ...(m.participants.find((p) => p.user_id === row.user_id)?.challenges || []),
        ].includes(row.achievement_id)
      )
        bad();
    } else {
      const [, game, n] = row.source_key.split(':'),
        c = getCounts(row.user_id);
      if (game === 'all') {
        if (
          !['2', '3'].includes(n) ||
          row.achievement_id !== (n === '2' ? 'all-two-tables' : 'all-three-games') ||
          Object.entries(c).filter(
            ([type, value]) => value > 0 && (n === '2' || !['market', 'trpg'].includes(type)),
          ).length < Number(n)
        )
          bad();
      } else if (
        !['3', '10'].includes(n) ||
        row.achievement_id !== game + (n === '3' ? '-regular' : '-veteran') ||
        (c[game] || 0) < Number(n)
      )
        bad();
    }
  }
  for (const row of db
    .prepare("SELECT * FROM user_achievements WHERE source_key LIKE 'challenge-market:%'")
    .iterate()) {
    const [, id, rev] = row.source_key.split(':');
    if (
      row.achievement_id !== 'market-countertrend' ||
      !UUID.test(id) ||
      !Number.isSafeInteger(Number(rev)) ||
      Number(rev) < 1 ||
      !marketCountertrend(db, row.user_id, id, Number(rev)).length
    )
      bad();
  }
  for (const row of db
    .prepare("SELECT * FROM user_achievements WHERE source_key LIKE 'background:%'")
    .iterate()) {
    const background = require('../../public/shared/lobby-backgrounds.json').find(
      (item) => item.id === row.source_key.slice(11),
    );
    if (
      !background ||
      row.achievement_id !== background.achievementId ||
      (getCounts(row.user_id)[background.game] || 0) < background.target
    )
      bad();
  }
  for (const row of db.prepare('SELECT * FROM user_cosmetic_rewards').iterate()) {
    const r = rewards.find((r) => r.frameId === row.frame_id);
    const a =
      r &&
      db
        .prepare('SELECT unlocked_at FROM user_achievements WHERE user_id=? AND achievement_id=?')
        .get(row.user_id, row.achievement_id);
    if (
      !r ||
      ![r.achievementId, r.legacyAchievementId, ...(r.previousAchievementIds || [])].includes(
        row.achievement_id,
      ) ||
      !a ||
      !Number.isFinite(Date.parse(row.claimed_at)) ||
      row.claimed_at < a.unlocked_at
    )
      bad();
  }
  return true;
}
module.exports = {
  normalizeMatch,
  recordMatch,
  refreshMilestones,
  rewardList,
  assertFrame,
  claimReward,
  validateRewardsDatabase,
  progressCounts,
  marketCountertrend,
};
