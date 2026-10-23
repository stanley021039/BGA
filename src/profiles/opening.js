'use strict';
const { HttpError } = require('../http/errors');
const { defaults } = require('./appearance');
function selected(db, userId) {
  try {
    return JSON.parse(
      db.prepare('SELECT appearance FROM users WHERE id=?').get(userId)?.appearance || '{}',
    );
  } catch {
    return {};
  }
}
function openingTheme(db, store, userId, input) {
  const owned = store.list(userId).bonusRewards.openings;
  if (input !== undefined) {
    if (!['default', 'soul-world', 'home-family'].includes(input?.theme))
      throw new HttpError(400, 'INVALID_OPENING', '請選擇可用的網站開場');
    if (input.theme !== 'default' && !owned.includes(input.theme))
      throw new HttpError(403, 'OPENING_LOCKED', '完成三款不同遊戲後解鎖屍魂界開場');
    db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
      JSON.stringify({ ...defaults, ...selected(db, userId), entryIntroTheme: input.theme }),
      userId,
    );
  }
  const saved = selected(db, userId).entryIntroTheme;
  return {
    theme: owned.includes(saved) ? saved : 'default',
    unlocked: owned,
  };
}
module.exports = { openingTheme };
