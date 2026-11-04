'use strict';
const overrides = require('../../public/shared/gacha-rarities.json');
const definitions = new Map(require('../achievements/catalog').definitions.map((d) => [d.id, d]));
const tiers = Object.freeze({
  common: { label: '普通', weight: 100, duplicateFragments: 1, exchangeCost: 20 },
  rare: { label: '稀有', weight: 20, duplicateFragments: 5, exchangeCost: 100 },
  legendary: { label: '傳說', weight: 2, duplicateFragments: 20, exchangeCost: 400 },
});
const poolLabels = Object.freeze({
  all: '綜合卡池',
  attacks: '攻擊招式',
  entrances: '進場特效',
  backgrounds: '大廳背景',
  frames: '彈幕框',
  media: '播放器風格',
  sounds: '標記語音',
});
const intro = (id) =>
  /intro|regular|participation/.test((definitions.get(id)?.category || '') + ' ' + id)
    ? 'common'
    : 'rare';
const items = [];
function add(kind, id, label, rarity, achievementIds = [], legacy = true) {
  const key = kind + ':' + id;
  rarity = overrides[key] || rarity;
  if (!Object.hasOwn(tiers, rarity)) throw Error('Invalid gacha rarity: ' + key);
  if (items.some((i) => i.key === key)) throw Error('Duplicate gacha reward: ' + key);
  const { weight, duplicateFragments, exchangeCost } = tiers[rarity];
  items.push(
    Object.freeze({
      key,
      kind,
      id,
      label,
      rarity,
      weight,
      duplicateFragments,
      exchangeCost,
      rarityLabel: tiers[rarity].label,
      // A new skill must not be retroactively granted by an old achievement.
      legacy,
      achievementIds: achievementIds.filter(Boolean),
    }),
  );
}
for (const e of require('../../public/shared/attack-effects.json').filter(
  (e) => e.achievementId || e.gachaOnly,
))
  add(
    'attacks',
    e.id,
    e.label,
    e.area || ['shaohua_devour'].includes(e.variantOf || e.id)
      ? 'legendary'
      : ['shield', 'chains', 'sphere'].includes(e.id)
        ? 'common'
        : 'rare',
    [e.achievementId],
    !e.gachaOnly,
  );
for (const e of require('../../public/shared/entrance-requirements.json'))
  add('entrances', e.id, e.label, intro(e.achievementId), [e.achievementId]);
for (const e of require('../../public/shared/lobby-backgrounds.json').filter(
  (e) => e.achievementId,
))
  add('backgrounds', e.id, e.label, intro(e.achievementId), [e.achievementId]);
for (const e of require('../achievements/rewards').rewards)
  for (const kind of ['frames', 'media'])
    add(kind, e.frameId, e.label, intro(e.achievementId), [
      e.achievementId,
      e.legacyAchievementId,
      ...(e.previousAchievementIds || []),
    ]);
const voices = new Map();
for (const [a, , ids, names] of require('../achievements/bonus-rewards').pairs)
  ids.forEach((id, i) => {
    const key = 'ping-voice-' + id,
      old = voices.get(key);
    if (old) {
      old.achievementIds.push(a);
      if (intro(a) === 'common') old.rarity = 'common';
    } else voices.set(key, { label: names[i], rarity: intro(a), achievementIds: [a] });
  });
for (const [id, e] of voices) add('sounds', id, e.label, e.rarity, e.achievementIds);
const catalog = Object.freeze(items);
const byKey = new Map(catalog.map((i) => [i.key, i]));
function poolItems(pool) {
  return typeof pool !== 'string'
    ? null
    : pool === 'all'
      ? catalog
      : Object.hasOwn(poolLabels, pool)
        ? catalog.filter((i) => i.kind === pool)
        : null;
}
function publicItem(i) {
  const { key, kind, id, label, rarity, rarityLabel, weight, duplicateFragments, exchangeCost } = i;
  return { key, kind, id, label, rarity, rarityLabel, weight, duplicateFragments, exchangeCost };
}
module.exports = { catalog, tiers, poolLabels, poolItems, byKey, publicItem };
