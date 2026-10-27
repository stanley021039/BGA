'use strict';
const { randomInt } = require('node:crypto');
const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const { defaults } = require('../profiles/appearance');
const limits = Object.freeze({
  entrances: 5,
  attacks: 5,
  frames: 3,
  media: 3,
  pingIcons: 3,
  sounds: 3,
  backgrounds: 3,
});
const labels = {
  entrances: '進場特效',
  attacks: '攻擊特效',
  frames: '彈幕框',
  media: '播放器風格',
  pingIcons: '房間標記圖示',
  sounds: '房間標記語音',
  backgrounds: '大廳共用背景',
};
function catalog() {
  const frames = require('./rewards').rewards.map((r) => ({ id: r.frameId, label: r.label }));
  return {
    entrances: require('./entrance-rewards').rewards,
    attacks: require('../../public/shared/attack-effects.json').filter((r) => r.achievementId),
    frames,
    media: frames,
    // All ten current icons are free. Do not relock existing choices to manufacture gifts.
    pingIcons: [],
    sounds: [
      ...new Map(
        require('./bonus-rewards').pairs.flatMap(([, , ids, names]) =>
          ids.map((id, i) => ['ping-voice-' + id, { id: 'ping-voice-' + id, label: names[i] }]),
        ),
      ).values(),
    ],
    backgrounds: require('../../public/shared/lobby-backgrounds.json').filter(
      (r) => r.achievementId,
    ),
  };
}
function receipt(db, userId) {
  try {
    const row = db.prepare('SELECT appearance FROM users WHERE id=? AND disabled=0').get(userId);
    const saved = JSON.parse(row?.appearance || '{}').starterRewardPack;
    if (
      saved?.version !== 1 ||
      typeof saved.redeemedAt !== 'string' ||
      !Number.isFinite(Date.parse(saved.redeemedAt)) ||
      new Date(saved.redeemedAt).toISOString() !== saved.redeemedAt
    )
      return null;
    const pools = catalog(),
      grants = {};
    for (const [key, limit] of Object.entries(limits)) {
      const allowed = new Set(pools[key].map((r) => r.id));
      grants[key] = [...new Set(Array.isArray(saved.grants?.[key]) ? saved.grants[key] : [])]
        .filter((id) => allowed.has(id))
        .slice(0, limit);
    }
    return { version: 1, redeemedAt: saved.redeemedAt, grants };
  } catch {
    return null;
  }
}
function owned(db, userId, key) {
  return receipt(db, userId)?.grants[key] || [];
}
function redeem(store, userId) {
  const redemption = transaction(store.db, () => {
    const user = store.db
      .prepare('SELECT appearance FROM users WHERE id=? AND disabled=0')
      .get(userId);
    if (!user) throw new HttpError(403, 'REWARD_CODE_UNAVAILABLE', '目前帳號無法兌換');
    let appearance;
    try {
      appearance = JSON.parse(user.appearance || '{}');
    } catch {
      appearance = {};
    }
    let pack = receipt(store.db, userId);
    const alreadyRedeemed = !!pack;
    const pools = catalog();
    if (!pack) {
      const rewards = require('./reward-store');
      rewards.refreshMilestones(store, userId);
      const data = {
          rewards: rewards.rewardList(store, userId),
          bonusRewards: require('./bonus-rewards').owned(store, userId),
        },
        grants = {};
      for (const [key, count] of Object.entries(limits)) {
        const have = new Set(
          key === 'frames' || key === 'media'
            ? data.rewards
                .filter((r) =>
                  key === 'frames' ? r.claimedAt || r.earned : r.mediaClaimedAt || r.earned,
                )
                .map((r) => r.frameId)
            : data.bonusRewards[key],
        );
        const remaining = pools[key].filter((r) => !have.has(r.id));
        grants[key] = [];
        while (remaining.length && grants[key].length < count)
          grants[key].push(remaining.splice(randomInt(remaining.length), 1)[0].id);
      }
      pack = { version: 1, redeemedAt: new Date().toISOString(), grants };
      store.db
        .prepare('UPDATE users SET appearance=? WHERE id=?')
        .run(JSON.stringify({ ...defaults, ...appearance, starterRewardPack: pack }), userId);
    }
    return {
      group: 'starter',
      label: '新手大禮包',
      alreadyRedeemed,
      redeemedAt: pack.redeemedAt,
      rewards: Object.entries(limits).map(([key, requested]) => ({
        key,
        label: labels[key],
        requested,
        items: pack.grants[key].map((id) => ({
          id,
          label: pools[key].find((r) => r.id === id).label,
        })),
      })),
    };
  });
  return { ...store.list(userId), redemption };
}
module.exports = { limits, catalog, receipt, owned, redeem };
