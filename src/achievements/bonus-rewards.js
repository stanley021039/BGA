'use strict';
// Each sound achievement grants a pair. Existing ping sounds stay available
// only after the corresponding achievement or Ping reward code is owned.
const pairs = Object.freeze([
  ['draw-fastest-correct', 'draw', ['amazing', 'look'], ['太神啦', '讓我看看']],
  ['gift-first-gift', 'gift', ['legacy', 'goodnight'], ['傳承精神', '晚安']],
  ['majority-one-channel', 'majority', ['cry', 'huh'], ['你在哭哦', '蛤']],
  ['poker-first-hand', 'poker', ['card-check', 'bad'], ['窩咬驗牌', '他很壞']],
  ['thunder-first-drive', 'thunder', ['practice', 'coward'], ['菜就多練', '俗仔']],
  ['quacks-double-explosion', 'quacks', ['what', 'sleep'], ['靠北三小', '那我也要睡了啦']],
  ['telephone-first-match', 'telephone', ['legacy', 'goodnight'], ['傳承精神', '晚安']],
  ['musicquiz-rescue', 'musicquiz', ['amazing', 'look'], ['太神啦', '讓我看看']],
  ['bluff-convincing', 'bluff', ['no-bluff', 'senior'], ['不要瞎掰', '野獸前輩']],
  ['minimal-first-match', 'minimal', ['cry', 'huh'], ['你在哭哦', '蛤']],
]);
function rewardLabels(id) {
  const pair = pairs.find(([achievement]) => achievement === id);
  return [
    ...(pair ? pair[3].map((name) => '音效：' + name) : []),
    ...require('./entrance-rewards')
      .rewards.filter((reward) => reward.achievementId === id)
      .map((reward) => '進場特效：' + reward.label),
    ...require('../../public/shared/lobby-backgrounds.json')
      .filter((background) => background.achievementId === id)
      .map((background) => '大廳背景：' + background.label),
    ...require('../../public/shared/attack-effects.json')
      .filter((effect) => effect.achievementId === id)
      .map((effect) => '攻擊特效：' + effect.label),
    ...(id === 'all-three-games' ? ['網站開場：歡迎來到我的屍魂界'] : []),
  ];
}
function owned(store, userId) {
  const ids = new Set(store.find.all(userId).map((row) => row.achievement_id));
  const grants = require('./redemption').grants(store.db, userId);
  return {
    attacks: require('./attack-rewards').ownedAttacks(store.db, userId),
    sounds: [
      ...new Set(
        pairs
          .filter(([id]) => grants.pings || ids.has(id))
          .flatMap(([, , sounds]) => sounds.map((name) => 'ping-voice-' + name)),
      ),
    ],
    entrances: require('./entrance-rewards')
      .rewards.filter((reward) => grants.entrances || ids.has(reward.achievementId))
      .map((reward) => reward.id),
    backgrounds: require('../../public/shared/lobby-backgrounds.json')
      .filter(
        (background) =>
          grants.other || !background.achievementId || ids.has(background.achievementId),
      )
      .map((background) => background.id),
    openings: [
      'home-family',
      ...(grants.entrances || ids.has('all-three-games') ? ['soul-world'] : []),
    ],
    pingIcons: grants.pings ? Object.keys(require('../../public/shared/ping-model').types) : [],
  };
}
function ownedSounds(db, userId) {
  const ids = new Set(
    db
      .prepare('SELECT achievement_id FROM user_achievements WHERE user_id=?')
      .all(userId)
      .map((row) => row.achievement_id),
  );
  const all = !!require('./redemption').redeemedAt(db, userId, 'pings');
  return [
    ...new Set(
      pairs
        .filter(([id]) => all || ids.has(id))
        .flatMap(([, , sounds]) => sounds.map((name) => 'ping-voice-' + name)),
    ),
  ];
}
module.exports = { pairs, rewardLabels, owned, ownedSounds };
