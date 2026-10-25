'use strict';

// CMYK 2025 base game, updated English rulebook pp.24–27 (publisher-authored PDF).
// Keep this roster distinct from Second Wind and from older editions/fan packs.
const rows = [
  ['alchemist', 'Alchemist', 24, '主移動擲出一或二時，可改為四格。'],
  ['blimp', 'Blimp', 24, '回合開始在第二彎前，主移動加三；否則減一。'],
  ['coach', 'Coach', 24, '與自己同格的角色，主移動加一，包含自己。'],
  ['baba-yaga', 'Baba Yaga', 24, '有人停到自己格上，或自己停到他人格上，使對方絆倒。'],
  ['centaur', 'Centaur', 24, '超越其他角色時，使對方倒退兩格。'],
  ['copy-cat', 'Copy Cat', 24, '持續複製領先角色的能力；並列時選一位。'],
  ['banana', 'Banana', 24, '超越自己的角色絆倒。'],
  ['cheerleader', 'Cheerleader', 24, '回合開始可讓全部最後方角色前進二，之後自己前進一。'],
  ['dicemonger', 'Dicemonger', 24, '任何角色每回合可額外重擲一次；其他人使用時自己前進一。'],
  ['duelist', 'Duelist', 25, '同格時可決鬥，各擲骰，較高者前進二；平手自己勝。'],
  ['genius', 'Genius', 25, '主移動前可預測骰值；猜中取得額外回合。'],
  ['heckler', 'Heckler', 25, '角色回合結束時，若離其起始位置不超過一格，自己前進二。'],
  ['egg', 'Egg', 25, '開賽前抽三名未招募角色，選一位取得能力。'],
  ['gunk', 'Gunk', 25, '其他角色的主移動減一，不改骰值。'],
  ['huge-baby', 'Huge Baby', 25, '起點以外不與其他角色同格；其他角色被放到自己後一格。'],
  ['flip-flop', 'Flip Flop', 25, '可不擲主移動骰，改與另一角色同時交換位置。'],
  ['hare', 'Hare', 25, '主移動加二；回合開始獨自領先時略過主移動。'],
  ['hypnotist', 'Hypnotist', 25, '回合開始可傳送另一角色到自己格上。'],
  ['inchworm', 'Inchworm', 26, '別人主移動擲出一時，取消其主移動，自己主移動一格。'],
  ['legs', 'Legs', 26, '可不擲主移動骰，改為主移動五格。'],
  ['mastermind', 'Mastermind', 26, '首次回合預測冠軍；猜中立即取得亞軍並結束本場。'],
  ['lackey', 'Lackey', 26, '另一角色主移動擲出六時，自己前進二，先於對方移動。'],
  ['loveable-loser', 'Loveable Loser', 26, '回合開始獨自最後時獲得一分。'],
  ['mouth', 'M.O.U.T.H.', 26, '停在恰有另一名角色的格子時，淘汰對方。'],
  ['leaptoad', 'Leaptoad', 26, '移動跳過被其他角色佔據的格子，倒退也適用。'],
  ['magician', 'Magician', 26, '每回合可重擲自己的主移動骰至多兩次，必須使用最後結果。'],
  [
    'party-animal',
    'Party Animal',
    26,
    '回合開始所有其他角色向自己移動一；同格每位對手使主移動加一。',
  ],
  ['rocket-scientist', 'Rocket Scientist', 27, '擲骰後可將主移動骰值加倍，使用後絆倒。'],
  ['sisyphus', 'Sisyphus', 27, '開賽前得四分；主移動骰為六時改傳起點並失去一分。'],
  ['suckerfish', 'Suckerfish', 27, '同格角色開始移動時，可跟隨其完整移動，原角色先結算。'],
  ['romantic', 'Romantic', 27, '角色停在恰有另一位角色的格子時，自己前進二。'],
  ['skipper', 'Skipper', 27, '任何角色主移動骰為一時，自己接著行動，之後從自己左手邊輪替。'],
  ['third-wheel', 'Third Wheel', 27, '回合開始可傳送到恰有兩名角色的格子，之後仍做主移動。'],
  ['scoocher', 'Scoocher', 27, '其他角色能力生效時，自己前進一。'],
  ['stickler', 'Stickler', 27, '其他角色必須恰好抵達終點，超出的移動整段取消。'],
  ['twin', 'Twin', 27, '開賽前可複製先前賽事冠軍的角色能力。'],
];
const baseRacers = Object.freeze(
  rows.map(([id, name, page, summary]) =>
    Object.freeze({
      id,
      name,
      summary,
      notes: '',
      set: 'base',
      trigger: 'base-rule',
      optional: true,
      source: `cmyk-2025-base-rulebook:pdf-page-${page}`,
      implementation: 'candidate',
    }),
  ),
);
module.exports = { baseRacers };
