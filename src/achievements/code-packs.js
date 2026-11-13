'use strict';
const { randomInt, createHash } = require('node:crypto');
const { transaction } = require('../db');
const { HttpError } = require('../http/errors');
const Ownership = require('../gacha/ownership');
const { defaults } = require('../profiles/appearance');
const definitions = Object.freeze({
  author: { label: '我愛作者', draws: 300, attackSlot: 'r' },
  starter: { label: '新手大禮包', draws: 100, attackSlot: 'q' },
});
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const eventId = (key, userId) => `reward-code-v2:${key}:${userId}`;
function receipts(db, userId) {
  const saved = Ownership.appearance(db, userId);
  const result = {};
  for (const [key, def] of Object.entries(definitions)) {
    const pack = saved.rewardCodePacks?.[key];
    if (pack === undefined) continue;
    const event = db
      .prepare('SELECT fingerprint FROM gacha_ledger WHERE event_id=? AND user_id=?')
      .get(eventId(key, userId), userId);
    if (
      !pack ||
      pack.version !== 2 ||
      pack.draws !== def.draws ||
      !Ownership.validAt(pack.redeemedAt) ||
      !Array.isArray(pack.rewards) ||
      pack.rewards.length !== 5 ||
      event?.fingerprint !== digest(pack)
    )
      throw Error('Invalid reward code receipt');
    result[key] = pack;
  }
  return result;
}
function availableTickets(db, userId) {
  const granted = Object.values(receipts(db, userId)).reduce((sum, pack) => sum + pack.draws, 0);
  const used = db
    .prepare(
      "SELECT COALESCE(SUM(json_array_length(response_json,'$.results')),0) AS n FROM gacha_requests WHERE user_id=? AND operation='draw' AND json_extract(response_json,'$.useTickets')=1",
    )
    .get(userId).n;
  if (!Number.isSafeInteger(used) || used > granted) throw Error('Invalid reward ticket balance');
  return granted - used;
}
function redeem(store, userId, key, { choose = randomInt } = {}) {
  const def = definitions[key];
  if (!def) throw new HttpError(400, 'INVALID_REWARD_CODE', '兌換碼不正確，請重新確認');
  const redemption = transaction(store.db, () => {
    const user = store.db
      .prepare('SELECT appearance FROM users WHERE id=? AND disabled=0')
      .get(userId);
    if (!user) throw new HttpError(403, 'REWARD_CODE_UNAVAILABLE', '目前帳號無法兌換');
    const saved = Ownership.appearance(store.db, userId),
      previous = receipts(store.db, userId)[key];
    if (previous) return { group: key, label: def.label, ...previous, alreadyRedeemed: true };
    // Existing receipts remain one-time claims; do not revoke or reissue old gifts.
    const oldAt =
      key === 'author'
        ? require('./redemption').redeemedAt(store.db, userId, 'other')
        : require('./starter-rewards').receipt(store.db, userId)?.redeemedAt;
    if (oldAt)
      return {
        group: key,
        label: def.label,
        alreadyRedeemed: true,
        redeemedAt: oldAt,
        draws: 0,
        rewards: [],
      };
    const { catalog } = require('../gacha/catalog'),
      { GachaStore } = require('../gacha/store'),
      { fitsSlot } = require('../rooms/scene-energy');
    const gacha = new GachaStore(store.db),
      owned = gacha.owned(userId),
      at = new Date().toISOString();
    const slots = [
      ['sounds', '語音'],
      ['frames', '彈幕框'],
      ['media', '播放器風格'],
      ['entrances', '進場特效'],
      ['attacks', def.attackSlot === 'r' ? '大招' : '普通招式'],
    ];
    let fragments = 0;
    const rewards = slots.map(([kind, label]) => {
      const pool = catalog.filter(
        (item) => item.kind === kind && (kind !== 'attacks' || fitsSlot(def.attackSlot, item.id)),
      );
      const unseen = pool.filter((item) => !owned[kind].has(item.id)),
        eligible = unseen.length ? unseen : pool;
      if (!eligible.length) throw Error('Empty reward code category: ' + kind);
      const index = choose(eligible.length);
      if (!Number.isSafeInteger(index) || index < 0 || index >= eligible.length)
        throw Error('Invalid reward sample');
      const item = eligible[index],
        duplicate = owned[kind].has(item.id),
        gained = duplicate ? item.duplicateFragments : 0;
      fragments += gained;
      if (!duplicate)
        store.db
          .prepare(
            "INSERT INTO gacha_ownership(user_id,kind,reward_id,source,acquired_at) VALUES(?,?,?,'draw',?) ON CONFLICT(user_id,kind,reward_id) DO UPDATE SET source='draw',acquired_at=excluded.acquired_at",
          )
          .run(userId, kind, item.id, at);
      return {
        key: kind,
        label,
        requested: 1,
        items: [
          {
            id: item.id,
            key: item.key,
            label: item.label,
            rarity: item.rarity,
            rarityLabel: item.rarityLabel,
            duplicate,
            fragments: gained,
          },
        ],
      };
    });
    const pack = { version: 2, redeemedAt: at, draws: def.draws, rewards };
    gacha.ledger(eventId(key, userId), userId, 'login', 0, fragments, digest(pack), at);
    store.db.prepare('UPDATE users SET appearance=? WHERE id=?').run(
      JSON.stringify({
        ...defaults,
        ...saved,
        rewardCodePacks: { ...saved.rewardCodePacks, [key]: pack },
        ...(key === 'author'
          ? { achievementRewardCodes: { ...saved.achievementRewardCodes, other: at } }
          : {}),
      }),
      userId,
    );
    return { group: key, label: def.label, ...pack, alreadyRedeemed: false };
  });
  return { ...store.list(userId), redemption };
}
function validate(db) {
  for (const { id } of db.prepare('SELECT id FROM users').iterate()) availableTickets(db, id);
  for (const event of db
    .prepare("SELECT * FROM gacha_ledger WHERE event_id LIKE 'reward-code-v2:%'")
    .iterate()) {
    const parts = event.event_id.split(':'),
      pack = receipts(db, event.user_id)[parts[1]];
    if (
      parts.length !== 3 ||
      parts[2] !== event.user_id ||
      !pack ||
      event.reason !== 'login' ||
      event.coins_delta !== 0 ||
      event.fragments_delta !==
        pack.rewards.reduce(
          (n, row) => n + row.items.reduce((sum, item) => sum + item.fragments, 0),
          0,
        )
    )
      throw Error('Invalid reward code ledger');
  }
}
module.exports = { definitions, receipts, availableTickets, redeem, validate };
