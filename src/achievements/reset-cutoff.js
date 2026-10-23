'use strict';
function resetCutoff(db, userId) {
  try {
    const value = JSON.parse(
      db.prepare('SELECT appearance FROM users WHERE id=?').get(userId)?.appearance || '{}',
    ).achievementResetAt;
    return typeof value === 'string' &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value
      ? value
      : '';
  } catch {
    return '';
  }
}
module.exports = { resetCutoff };
