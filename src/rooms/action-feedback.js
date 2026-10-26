'use strict';
const { randomUUID } = require('node:crypto');
const rooms = new WeakMap();
// Only public action categories are emitted. Never serialize input, answers, cards or private targets.
const labels = {
  start: '開始遊戲',
  next: '前往下一輪',
  call: '跟注',
  check: '過牌',
  fold: '棄牌',
  raise: '加注',
  allin: 'ALL IN',
  answer: '送出答案',
  ask: '選定題目',
  choose: '選定題目',
  give: '完成秘密送禮',
  wish: '完成喜好排序',
  accept: '收下禮物',
  submit: '送出作品',
  guess: '送出猜測',
  plan: '準備好行動',
  resolve: '擲骰檢定',
  draw: '抽取',
  stop: '停手',
  ready: '準備完成',
  spoken: '完成發言',
  'draw-fortune': '翻開占卜卡',
  'roll-bonus': '擲出獎勵骰',
  reward: '領取本輪獎勵',
  buy: '購買藥材',
  undoBuy: '取消購買',
  'shop-ready': '完成採購',
  'settle-ready': '完成結算',
  choice: '完成效果選擇',
  listen: '開始前奏',
  place: '放置年代卡',
  pass: '略過挑戰',
  roll: '擲骰',
  draft: '選擇運動員',
  select: '選擇出賽者',
  acquire: '收購公司',
  dividend: '分配股利',
  trade: '交易股票',
  begin: '指派車輛與骰子',
  move: '移動車輛',
  movePath: '移動車輛',
  shoot: '射擊',
  slam: '處理碰撞',
  bonus: '處理公路加速',
  rollDice: '擲出檢定骰',
  acceptDice: '確認檢定結果',
  rerollDice: '重擲檢定骰',
};
function recordActionFeedback(room, operation, at = Date.now()) {
  if (!operation?.actor || !Array.isArray(room.players)) return;
  const action = operation.action === 'action' ? operation.input?.action : operation.action;
  if (!Object.hasOwn(labels, action)) return;
  if (action === 'draft' && room.type !== 'second-wind') return;
  const actor = room.players.find((p) => p.id === operation.actor);
  if (!actor) return;
  let state = rooms.get(room);
  if (!state) {
    state = { events: [], seen: new Set() };
    rooms.set(room, state);
  }
  const requestId = operation.input?.requestId,
    key =
      typeof requestId === 'string'
        ? actor.id +
          ':' +
          String(
            operation.input?.roundId || operation.input?.stepId || room.hand || room.round || '',
          ) +
          ':' +
          requestId
        : null;
  if (key && state.seen.has(key)) return;
  if (key) {
    state.seen.add(key);
    if (state.seen.size > 128) state.seen.delete(state.seen.values().next().value);
  }
  const event = {
    id: randomUUID(),
    at,
    actor: { id: actor.id, name: actor.name },
    action: labels[action],
  };
  if (room.type === 'thunder' && action === 'shoot') {
    const target = room.cars.find((c) => c.id === operation.input?.target),
      owner = room.players.find((p) => p.id === target?.owner);
    if (owner) event.target = { id: owner.id, name: owner.name };
  }
  if (room.type === 'quacks' && action === 'buy') {
    const { color, value } = operation.input || {};
    if (
      ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'black'].includes(color) &&
      [1, 2, 4].includes(value)
    )
      event.item = { color, value };
  }
  state.events.push(event);
  state.events = state.events.slice(-20);
}
function actionFeedback(room) {
  return (rooms.get(room)?.events || []).map((e) => ({
    ...e,
    actor: { ...e.actor },
    ...(e.target ? { target: { ...e.target } } : {}),
    ...(e.item ? { item: { ...e.item } } : {}),
  }));
}
module.exports = { recordActionFeedback, actionFeedback };
