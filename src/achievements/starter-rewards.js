'use strict';
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
    attacks: require('../../public/shared/attack-effects.json').filter(
      (r) => !r.rewardOf && !('paletteHue' in r) && (r.achievementId || r.gachaOnly),
    ),
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
  return require('./code-packs').redeem(store, userId, 'starter');
}
module.exports = { limits, catalog, receipt, owned, redeem };
