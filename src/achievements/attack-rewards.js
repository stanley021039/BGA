'use strict';
const effects = require('../../public/shared/attack-effects.json');
function ownedAttacks(db, userId) {
  const ids = new Set(
    db
      .prepare('SELECT achievement_id FROM user_achievements WHERE user_id=?')
      .all(userId)
      .map((r) => r.achievement_id),
  );
  const all = !!require('./redemption').redeemedAt(db, userId, 'other');
  const starter = new Set(require('./starter-rewards').owned(db, userId, 'attacks'));
  return effects
    .filter((e) => !e.achievementId || all || ids.has(e.achievementId) || starter.has(e.id))
    .map((e) => e.id);
}
module.exports = { ownedAttacks };
