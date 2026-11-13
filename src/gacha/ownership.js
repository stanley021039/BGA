'use strict';
const retiredAchievementKinds = new Set([
  'attacks',
  'frames',
  'media',
  'entrances',
  'openings',
  'sounds',
]);
const validAt = (at) =>
  typeof at === 'string' && Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at;
function enabled(db) {
  return (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gacha_ownership'").get()
      ?.name === 'gacha_ownership'
  );
}
function appearance(db, userId) {
  const row = db.prepare('SELECT appearance FROM users WHERE id=?').get(userId);
  try {
    return JSON.parse(row?.appearance || '{}');
  } catch {
    return {};
  }
}
function ownedIds(db, userId, kind, saved = appearance(db, userId)) {
  const result = new Set();
  if (enabled(db))
    for (const row of db
      .prepare('SELECT reward_id,source FROM gacha_ownership WHERE user_id=? AND kind=?')
      .all(userId, kind))
      if (row.source !== 'legacy' || !retiredAchievementKinds.has(kind)) result.add(row.reward_id);
  if (
    kind === 'backgrounds' &&
    saved.rewardCodePacks?.author?.version !== 2 &&
    (validAt(saved.achievementRewardCodes?.other) || validAt(saved.achievementRewardCodeAt))
  ) {
    for (const i of require('./catalog').catalog)
      if (i.kind === kind && !i.gachaExclusive) result.add(i.id);
  }
  const starter = saved.starterRewardPack;
  if (starter?.version === 1 && validAt(starter.redeemedAt)) {
    const allowed = new Set(
      require('./catalog')
        .catalog.filter((i) => i.kind === kind && !i.gachaExclusive)
        .map((i) => i.id),
    );
    for (const id of Array.isArray(starter.grants?.[kind]) ? starter.grants[kind] : [])
      if (allowed.has(id)) result.add(id);
  }
  return [...result];
}
module.exports = { enabled, appearance, ownedIds, validAt };
