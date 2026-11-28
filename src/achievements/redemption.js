'use strict';
const { HttpError } = require('../http/errors');
const codes = Object.freeze([
  { code: '我愛作者我愛作者', group: 'other', label: '其他獎勵（戰鬥加成）' },
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
      else if (
        saved.rewardCodePacks?.authorRenewal?.version === 2 &&
        validAt(saved.rewardCodePacks.authorRenewal.redeemedAt)
      )
        result[group] = saved.rewardCodePacks.authorRenewal.redeemedAt;
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
  if (typeof code === 'string' && code.length <= 80 && code.trim() === '野獸前輩')
    return require('../profiles/boss-control').redeem(store, userId);
  if (
    typeof code === 'string' &&
    code.length <= 80 &&
    ['我愛作者我愛作者', '新手大禮包'].includes(code.trim())
  )
    return require('./code-packs').redeem(
      store,
      userId,
      code.trim() === '新手大禮包' ? 'starter' : 'authorRenewal',
    );
  throw new HttpError(400, 'INVALID_REWARD_CODE', '兌換碼不正確，請重新確認');
}
module.exports = { codes, grants, redeemedAt, redeem };
