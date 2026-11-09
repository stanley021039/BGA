'use strict';
const voiceLabels = new Map(
  require('../../public/shared/ping-voices.json').map(({ id, label }) => [id, label]),
);
// Each sound achievement grants a pair. Existing ping sounds stay available
// only after the corresponding achievement or Ping reward code is owned.
const pairs = Object.freeze(
  [
    ['draw-fastest-correct', 'draw', ['amazing', 'look']],
    ['gift-first-gift', 'gift', ['legacy', 'goodnight']],
    ['majority-one-channel', 'majority', ['cry', 'huh']],
    ['poker-first-hand', 'poker', ['card-check', 'bad']],
    ['thunder-first-drive', 'thunder', ['practice', 'coward']],
    ['quacks-double-explosion', 'quacks', ['what', 'sleep']],
    ['telephone-first-match', 'telephone', ['legacy', 'goodnight']],
    ['musicquiz-rescue', 'musicquiz', ['amazing', 'look']],
    ['bluff-convincing', 'bluff', ['no-bluff', 'senior']],
    ['minimal-first-match', 'minimal', ['cry', 'huh']],
  ].map(([achievement, game, ids]) => [
    achievement,
    game,
    ids,
    ids.map((id) => voiceLabels.get(id)),
  ]),
);
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
  const gacha = require('../gacha/ownership');
  if (gacha.enabled(store.db)) {
    const saved = gacha.appearance(store.db, userId);
    const ids = (kind) => gacha.ownedIds(store.db, userId, kind, saved);
    return {
      attacks: require('./attack-rewards').ownedAttacks(store.db, userId),
      sounds: ids('sounds'),
      entrances: ids('entrances'),
      backgrounds: [
        ...new Set(
          require('../../public/shared/lobby-backgrounds.json')
            .filter((b) => !b.achievementId)
            .map((b) => b.id)
            .concat(ids('backgrounds')),
        ),
      ],
      openings: ['home-family', ...ids('openings')],
      pingIcons: [],
    };
  }
  const ids = new Set(store.find.all(userId).map((row) => row.achievement_id));
  const grants = require('./redemption').grants(store.db, userId);
  const starter = require('./starter-rewards').receipt(store.db, userId)?.grants || {};
  return {
    attacks: require('./attack-rewards').ownedAttacks(store.db, userId),
    sounds: ownedSounds(store.db, userId),
    entrances: require('./entrance-rewards')
      .rewards.filter(
        (reward) => ids.has(reward.achievementId) || starter.entrances?.includes(reward.id),
      )
      .map((reward) => reward.id),
    backgrounds: require('../../public/shared/lobby-backgrounds.json')
      .filter(
        (background) =>
          grants.other ||
          !background.achievementId ||
          ids.has(background.achievementId) ||
          starter.backgrounds?.includes(background.id),
      )
      .map((background) => background.id),
    openings: ['home-family', ...(ids.has('all-three-games') ? ['soul-world'] : [])],
    pingIcons: [],
  };
}
function ownedSounds(db, userId) {
  const gacha = require('../gacha/ownership');
  if (gacha.enabled(db)) return gacha.ownedIds(db, userId, 'sounds');
  const ids = new Set(
    db
      .prepare('SELECT achievement_id FROM user_achievements WHERE user_id=?')
      .all(userId)
      .map((row) => row.achievement_id),
  );
  return [
    ...new Set(
      pairs
        .filter(([id]) => ids.has(id))
        .flatMap(([, , sounds]) => sounds.map((name) => 'ping-voice-' + name))
        .concat(require('./starter-rewards').owned(db, userId, 'sounds')),
    ),
  ];
}
module.exports = { pairs, rewardLabels, owned, ownedSounds };
