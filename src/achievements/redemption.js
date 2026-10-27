'use strict';
const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const { defaults } = require('../profiles/appearance');
const codes = Object.freeze([
  { code: '我愛少華', group: 'frames', label: '彈幕與播放器外觀' },
  { code: '我愛其學', group: 'entrances', label: '進場特效與網站開場動畫' },
  { code: '我愛士憲', group: 'pings', label: 'Ping 圖示與音效' },
  { code: '我愛作者', group: 'other', label: '其他獎勵（大廳背景、攻擊特效與戰鬥加成）' },
]);
const validAt = (at) =>
  typeof at === 'string' && Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at;
function grants(db, userId) {
  try {
    const row = db.prepare('SELECT appearance FROM users WHERE id=? AND disabled=0').get(userId);
    if (!row) return {};
    const saved = JSON.parse(row.appearance || '{}'),
      result = {};
    for (const { group } of codes) {
      const at = saved.achievementRewardCodes?.[group];
      if (validAt(at)) result[group] = at;
      // Preserve rewards already redeemed before the four-code split; the old code is no longer accepted.
      else if (validAt(saved.achievementRewardCodeAt))
        result[group] = saved.achievementRewardCodeAt;
    }
    return result;
  } catch {
    return {};
  }
}
function redeemedAt(db, userId, group) {
  return grants(db, userId)[group] || null;
}
function redeem(store, userId, code) {
  if (typeof code === 'string' && code.length <= 80 && code.trim() === '新手大禮包')
    return require('./starter-rewards').redeem(store, userId);
  const item =
    typeof code === 'string' && code.length <= 80
      ? codes.find((item) => item.code === code.trim())
      : null;
  if (!item) throw new HttpError(400, 'INVALID_REWARD_CODE', '兌換碼不正確，請重新確認');
  const redemption = transaction(store.db, () => {
    const user = store.db
      .prepare('SELECT appearance FROM users WHERE id=? AND disabled=0')
      .get(userId);
    if (!user) throw new HttpError(403, 'REWARD_CODE_UNAVAILABLE', '目前帳號無法兌換');
    const owned = grants(store.db, userId),
      previous = owned[item.group],
      at = previous || new Date().toISOString();
    if (!previous) {
      let saved;
      try {
        saved = JSON.parse(user.appearance || '{}');
      } catch {
        saved = defaults;
      }
      const next = {
        ...defaults,
        ...saved,
        achievementRewardCodes: { ...owned, [item.group]: at },
      };
      delete next.achievementRewardCodeAt;
      store.db
        .prepare('UPDATE users SET appearance=? WHERE id=?')
        .run(JSON.stringify(next), userId);
    }
    return { group: item.group, label: item.label, alreadyRedeemed: !!previous, redeemedAt: at };
  });
  return { ...store.list(userId), redemption };
}
module.exports = { codes, grants, redeemedAt, redeem };
