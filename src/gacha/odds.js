'use strict';
const { createHash } = require('node:crypto');
const { bonusInterval, bonusPercent } = require('../../public/shared/gacha-economy.json');
const { catalog, poolGroups, tiers } = require('./catalog');
const { HttpError } = require('../http/errors');
const names = Object.keys(tiers);
const defaults = Object.freeze(Object.fromEntries(names.map((name) => [name, tiers[name].weight])));
const settingName = 'draw_odds_v3';
const legacySettingName = 'draw_odds_v1';
const legacyNames = names.filter((name) => name !== 'epic');
const catalogRevision = createHash('sha256')
  .update(JSON.stringify([poolGroups, catalog.map(({ key, rarity }) => [key, rarity])]))
  .digest('hex');
function weights(value, tiers = names) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== tiers.length ||
    tiers.some(
      (name) =>
        !Object.hasOwn(value, name) ||
        !Number.isSafeInteger(value[name]) ||
        value[name] < 1 ||
        value[name] > 1000000,
    )
  )
    throw new HttpError(400, 'INVALID_GACHA_WEIGHTS', '每種稀有度權重須為1到1,000,000的整數');
  return Object.fromEntries(tiers.map((name) => [name, value[name]]));
}
function revision(value) {
  return createHash('sha256')
    .update(JSON.stringify([settingName, catalogRevision, bonusInterval, bonusPercent, value]))
    .digest('hex');
}
function readSaved(db, name, tiers) {
  const saved = db.prepare('SELECT value FROM gacha_settings WHERE name=?').get(name);
  if (saved) {
    const current = JSON.parse(saved.value);
    if (
      !current ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      Object.keys(current).length !== 3 ||
      typeof current.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(current.updatedAt)) ||
      typeof current.updatedBy !== 'string' ||
      !current.updatedBy.length
    )
      throw Error('Invalid stored gacha odds');
    return { ...current, weights: weights(current.weights, tiers) };
  }
}
function read(db) {
  // Keep the old setting for restore validation, but the four-tier model has its own defaults.
  readSaved(db, legacySettingName, legacyNames);
  readSaved(db, 'draw_odds_v2', names);
  const current = readSaved(db, settingName, names) || {
    weights: defaults,
    updatedAt: null,
    updatedBy: null,
  };
  return { ...current, revision: revision(current.weights) };
}
function distribution(items, weights, boost = false) {
  const entriesByRarity = Object.fromEntries(names.map((name) => [name, []]));
  for (const item of items) entriesByRarity[item.rarity].push(item);
  const tiers = names
    .filter((name) => entriesByRarity[name].length)
    .map((name) => ({
      weight: boost ? bonusPercent[name] : weights[name],
      items: entriesByRarity[name],
    }));
  return { tiers, totalWeight: tiers.reduce((total, tier) => total + tier.weight, 0) };
}
function select({ tiers, totalWeight }, choose) {
  const sample = (limit) => {
    const roll = choose(limit);
    if (!Number.isSafeInteger(roll) || roll < 0 || roll >= limit)
      throw Error('Invalid server gacha random sample');
    return roll;
  };
  let roll = sample(totalWeight);
  for (const tier of tiers) {
    if (roll < tier.weight) return tier.items[sample(tier.items.length)];
    roll -= tier.weight;
  }
  throw Error('Missing gacha rarity tier');
}
function save(db, actorId, input, at) {
  if (!db.prepare("SELECT 1 FROM users WHERE id=? AND role='admin' AND disabled=0").get(actorId))
    throw new HttpError(403, 'ADMIN_REQUIRED', '只有管理者可以調整抽卡權重');
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length !== 2 ||
    !Object.hasOwn(input, 'revision') ||
    !Object.hasOwn(input, 'weights')
  )
    throw new HttpError(400, 'INVALID_GACHA_WEIGHTS', '抽卡權重設定格式不正確');
  const next = weights(input.weights);
  if (input.revision !== read(db).revision)
    throw new HttpError(409, 'GACHA_ODDS_CHANGED', '抽卡權重已更新，請重新載入後再調整');
  db.prepare(
    'INSERT INTO gacha_settings(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value',
  ).run(settingName, JSON.stringify({ weights: next, updatedAt: at, updatedBy: actorId }));
  return read(db);
}
module.exports = { defaults, settingName, read, save, distribution, select };
