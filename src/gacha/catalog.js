'use strict';
const overrides = require('../../public/shared/gacha-rarities.json');
const poolGroups = require('../../public/shared/gacha-pools.json');
const { exchangeCosts } = require('../../public/shared/gacha-economy.json');
const definitions = new Map(require('../achievements/catalog').definitions.map((d) => [d.id, d]));
const { BUILTIN_FRAME_OPTIONS } = require('../barrage/builtins');
const { variants: entranceVariants } = require('../../public/shared/entrance-palette.json');
const tiers = Object.freeze({
  common: { label: '普通', weight: 75, duplicateFragments: 1, exchangeCost: exchangeCosts.common },
  rare: { label: '稀有', weight: 18, duplicateFragments: 5, exchangeCost: exchangeCosts.rare },
  epic: { label: '史詩', weight: 5, duplicateFragments: 10, exchangeCost: exchangeCosts.epic },
  legendary: {
    label: '傳說',
    weight: 2,
    duplicateFragments: 20,
    exchangeCost: exchangeCosts.legendary,
  },
});
const poolLabels = Object.freeze({
  all: '綜合卡池',
  ...Object.fromEntries(Object.entries(poolGroups).map(([id, group]) => [id, group.label])),
});
const kinds = Object.freeze(Object.values(poolGroups).flatMap((group) => group.kinds));
const intro = (id) =>
  /intro|regular|participation/.test((definitions.get(id)?.category || '') + ' ' + id)
    ? 'common'
    : 'rare';
const items = [];
function add(kind, id, label, rarity, achievementIds = [], legacy = true, gachaExclusive = false) {
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
      gachaExclusive,
      achievementIds: achievementIds.filter(Boolean),
    }),
  );
}
const attacks = require('../../public/shared/attack-effects.json');
for (const e of attacks.filter((e) => !('paletteHue' in e) && (e.achievementId || e.gachaOnly)))
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
for (const [kind, variants] of [
  ['attacks', attacks.filter((e) => 'paletteHue' in e)],
  ['entrances', entranceVariants],
]) {
  const parentRarities = new Map(
    items.filter((item) => item.kind === kind).map((item) => [item.id, item.rarity]),
  );
  for (const e of variants)
    add(kind, e.id, e.label, parentRarities.get(e.variantOf) || 'common', [], false, true);
}
for (const e of require('../../public/shared/lobby-backgrounds.json').filter(
  (e) => e.achievementId || e.id === 'castle',
))
  add(
    'backgrounds',
    e.id,
    e.label,
    e.achievementId ? intro(e.achievementId) : 'common',
    [e.achievementId],
    !!e.achievementId,
    !e.achievementId,
  );
for (const e of require('../achievements/rewards').rewards)
  for (const kind of ['frames', 'media'])
    add(kind, e.frameId, e.label, intro(e.achievementId), [
      e.achievementId,
      e.legacyAchievementId,
      ...(e.previousAchievementIds || []),
    ]);
for (const e of BUILTIN_FRAME_OPTIONS.filter((e) => e.id !== 'default' && !e.achievementId))
  for (const kind of ['frames', 'media']) add(kind, e.id, e.label, 'common', [], false, true);
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
for (const { id, label, gachaOnly } of require('../../public/shared/ping-voices.json'))
  if (gachaOnly) add('sounds', 'ping-voice-' + id, label, 'common', [], false, true);
const catalog = Object.freeze(items);
const byKey = new Map(catalog.map((i) => [i.key, i]));
function poolItems(pool) {
  if (typeof pool !== 'string') return null;
  if (pool === 'all') return catalog;
  // Older requests and their persisted receipts still use single-kind pool IDs.
  const included = Object.hasOwn(poolGroups, pool)
    ? poolGroups[pool].kinds
    : kinds.includes(pool)
      ? [pool]
      : null;
  return included ? catalog.filter((item) => included.includes(item.kind)) : null;
}
function publicItem(i) {
  const { key, kind, id, label, rarity, rarityLabel, weight, duplicateFragments, exchangeCost } = i;
  return { key, kind, id, label, rarity, rarityLabel, weight, duplicateFragments, exchangeCost };
}
module.exports = { catalog, tiers, kinds, poolGroups, poolLabels, poolItems, byKey, publicItem };
