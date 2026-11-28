const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const { bossFor } = require('../rooms/scene-bosses');
const { validAt } = require('../gacha/ownership');
const { defaults } = require('./appearance');
function saved(db, userId) {
  const user = db.prepare('SELECT appearance FROM users WHERE id=? AND disabled=0').get(userId);
  if (!user) throw new HttpError(403, 'BOSS_CONTROL_UNAVAILABLE', '目前帳號無法使用 Boss 操控');
  try {
    return { ...defaults, ...JSON.parse(user.appearance || '{}') };
  } catch {
    return { ...defaults };
  }
}
function state(db, userId) {
  const value = saved(db, userId),
    unlocked = validAt(value.bossControlGrantedAt);
  return {
    unlocked,
    selected: unlocked && bossFor(value.controlledBossId) ? value.controlledBossId : null,
  };
}
function select(db, userId, bossId) {
  if (bossId !== null && !bossFor(bossId))
    throw new HttpError(400, 'INVALID_CONTROLLED_BOSS', '請選擇有效 Boss');
  const value = saved(db, userId);
  if (!validAt(value.bossControlGrantedAt))
    throw new HttpError(403, 'BOSS_CONTROL_LOCKED', '請先兌換「野獸前輩」開放 Boss 操控');
  db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
    JSON.stringify({ ...value, controlledBossId: bossId }),
    userId,
  );
  return state(db, userId);
}
function redeem(store, userId) {
  const redemption = transaction(store.db, () => {
    const value = saved(store.db, userId),
      alreadyRedeemed = validAt(value.bossControlGrantedAt);
    const redeemedAt = alreadyRedeemed ? value.bossControlGrantedAt : new Date().toISOString();
    if (!alreadyRedeemed)
      store.db
        .prepare('UPDATE users SET appearance=? WHERE id=?')
        .run(JSON.stringify({ ...value, bossControlGrantedAt: redeemedAt }), userId);
    return {
      label: '野獸前輩',
      redeemedAt,
      alreadyRedeemed,
      draws: 0,
      rewards: [],
      features: ['Boss 操控已開放，可至「機器人與 Boss → 自己」選擇 Boss。'],
    };
  });
  return { ...store.list(userId), redemption };
}
module.exports = { state, select, redeem };
