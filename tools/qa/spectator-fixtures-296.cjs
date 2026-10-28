'use strict';
// Isolated QA only. Uses real engines/AI commands; never accepts production rooms.
const { runTestAIStep } = require('../../src/ai');
const { randomUUID } = require('node:crypto');
const types = {
  poker: ['poker', 'Room'],
  thunder: ['thunder', 'ThunderRoom'],
  majority: ['majority', 'MajorityRoom'],
  gift: ['gift', 'GiftRoom'],
  draw: ['draw-guess', 'DrawGuessRoom'],
  trpg: ['trpg', 'TrpgRoom'],
  telephone: ['telephone', 'TelephoneRoom'],
  musicquiz: ['musicquiz', 'MusicQuizRoom'],
  minimal: ['minimal', 'MinimalRoom'],
  bluff: ['bluff', 'BluffRoom'],
  quacks: ['quacks', 'QuacksRoom'],
  ceo: ['ceo-room', 'CeoRoom'],
  'second-wind': ['second-wind/room', 'SecondWindRoom'],
  lounge: ['lounge', 'LoungeRoom'],
};
const classes = Object.fromEntries(
  Object.entries(types).map(([type, [file, key]]) => [
    type,
    require('../../src/games/' + file)[key],
  ]),
);
function phaseKey(room) {
  const game = room.observerGame?.();
  return [
    room.phase,
    room.type === 'telephone' && room.phase === 'passing' ? 'page-' + room.round : '',
    room.stage || '',
    game?.phase || '',
    game?.pending ? 'choice' : '',
    room.diceCheck ? 'dice-' + room.diceCheck.status : '',
  ]
    .filter(Boolean)
    .join('-');
}
function freezeBots(room) {
  for (const p of room.players) {
    p.bot = false;
    p.lastSeen = Date.now();
  }
  room.botAt = Infinity;
}
function advance(room, step) {
  const type = room.type || 'poker';
  for (const p of room.players) {
    p.bot = true;
    p.lastSeen = Date.now();
  }
  try {
    if (type === 'poker') {
      const p = room.players[room.turn];
      if (!p) return false;
      room.act(p.id, room.currentBet > p.bet ? 'call' : 'check');
      return true;
    }
    if (type === 'thunder') {
      if (room.diceCheck?.status === 'rolling') room.diceCheck.readyAt = Date.now() - 1;
      room.auto();
      return true;
    }
    if (runTestAIStep(room, { now: Date.now() + step * 3000 })) return true;
    if (type === 'majority' && room.phase === 'review') {
      room.act(room.host, 'score', {});
      return true;
    }
    if (
      (['majority', 'gift', 'bluff', 'minimal'].includes(type) && room.phase === 'reveal') ||
      (type === 'quacks' && room.phase === 'between')
    ) {
      room.act(room.host, 'next', { roundId: room.roundId, requestId: randomUUID() });
      return true;
    }
    if (Number.isFinite(room.deadline)) room.deadline = (room.now?.() ?? Date.now()) - 1;
    if (Number.isFinite(room.nextRoundAt)) room.nextRoundAt = (room.now?.() ?? Date.now()) - 1;
    return !!room.auto?.();
  } finally {
    freezeBots(room);
  }
}
function create(type) {
  const room = new classes[type]('ABCDEF', '合成觀戰測試');
  for (let i = 0; i < (type === 'lounge' ? 1 : 3); i++) room.add('測試玩家' + i, true);
  if (type === 'musicquiz') room.configure(room.host, { target: 3 });
  if (type === 'gift') room.configure(room.host, { target: 8 });
  if (type === 'majority') room.configure(room.host, { rounds: 3 });
  return room;
}
module.exports = { classes, phaseKey, advance, freezeBots, create };
