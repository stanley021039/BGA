'use strict';
const effects = require('../../public/shared/attack-effects.json');
function ownedAttacks(db, userId) {
  const gacha = require('../gacha/ownership');
  if (gacha.enabled(db)) {
    const owned = new Set(gacha.ownedIds(db, userId, 'attacks'));
    return effects
      .filter((e) => (!e.achievementId && !e.gachaOnly) || owned.has(e.rewardOf ?? e.id))
      .map((e) => e.id);
  }
  const ids = new Set(
    db
      .prepare('SELECT achievement_id FROM user_achievements WHERE user_id=?')
      .all(userId)
      .map((r) => r.achievement_id),
  );
  const all = !!require('./redemption').redeemedAt(db, userId, 'other');
  const starter = new Set(require('./starter-rewards').owned(db, userId, 'attacks'));
  const earned = effects
    .filter(
      (e) =>
        !e.rewardOf &&
        !('paletteHue' in e) &&
        ((!e.achievementId && !e.gachaOnly) ||
          all ||
          ids.has(e.achievementId) ||
          starter.has(e.id)),
    )
    .map((e) => e.id);
  const earnedIds = new Set(earned);
  return effects.filter((e) => earnedIds.has(e.rewardOf ?? e.id)).map((e) => e.id);
}
module.exports = { ownedAttacks };
