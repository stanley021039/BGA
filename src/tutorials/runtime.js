'use strict';
const { randomUUID, randomInt } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { planTutorialAction } = require('../ai');
const classes = {
  poker: require('../games/poker').Room,
  thunder: require('../games/thunder').ThunderRoom,
  majority: require('../games/majority').MajorityRoom,
  gift: require('../games/gift').GiftRoom,
  draw: require('../games/draw-guess').DrawGuessRoom,
  trpg: require('../games/trpg').TrpgRoom,
  quacks: require('../games/quacks').QuacksRoom,
  bluff: require('../games/bluff').BluffRoom,
  telephone: require('../games/telephone').TelephoneRoom,
  musicquiz: require('../games/musicquiz').MusicQuizRoom,
  minimal: require('../games/minimal').MinimalRoom,
  ceo: require('../games/ceo-room').CeoRoom,
  'second-wind': require('../games/second-wind/room').SecondWindRoom,
};
const types = Object.freeze(Object.keys(classes));
const labels = {
  call: '跟注',
  check: '過牌',
  fold: '棄牌',
  draw: '抽取',
  stop: '停手',
  submit: '送出作品',
  guess: '作答',
  plan: '準備行動',
  resolve: '擲骰檢定',
  next: '下一步',
  answer: '送出答案',
  give: '選擇送禮',
  wish: '標記喜好',
  accept: '收下禮物',
  spoken: '說明身分',
  ready: '準備完成',
  choose: '選擇題目',
  listen: '開始前奏',
  place: '排列年代',
  pass: '略過挑戰',
  draft: '選擇運動員',
  select: '選擇出賽者',
  roll: '擲骰',
  acquire: '收購公司',
  dividend: '分配股利',
  ask: '選擇題目',
  assign: '分配車輛與骰子',
  move: '移動車輛',
  bonus: '處理公路加速',
  shoot: '射擊',
  airplace: '部署直升機',
  airshoot: '空中射擊',
  effects: '處理事件',
  'bonus-ready': '確認獎勵骰',
  'confirm-effects': '確認藥材結算',
  'settle-ready': '完成結算',
  choice: '完成效果選擇',
  reward: '領取本輪獎勵',
  rollDice: '擲骰',
  acceptDice: '確認檢定結果',
  'draw-stroke': '畫一筆',
  'draw-fortune': '翻開占卜卡',
  buy: '購買藥材',
  'shop-ready': '完成採購',
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const fail = (status, code, message) => {
  throw new HttpError(status, code, message);
};
const op = (actor, action, input = {}) => ({
  actor,
  action,
  input,
  run: (r) => r.act(actor, action, input),
});
function createTutorials({
  now = Date.now,
  rng = randomInt,
  maxSessions = 32,
  ttl = 30 * 60000,
} = {}) {
  const sessions = new Map();
  function expire() {
    for (const [id, s] of sessions) if (now() - s.touched >= ttl) sessions.delete(id);
  }
  function get(owner, id) {
    expire();
    const s = sessions.get(id);
    if (!s || s.owner !== owner) fail(404, 'TUTORIAL_NOT_FOUND', '教學已結束或逾時，請重新開始');
    s.touched = now();
    return s;
  }
  function complete(s) {
    const r = s.room;
    return (
      ['finished', 'showdown'].includes(r.phase) ||
      (r.phase === 'reveal' && (r.results?.length || r.result || r.round)) ||
      (r.type === 'quacks' && r.phase === 'between') ||
      (r.type === 'thunder' && r.players.every((p) => p.turns >= 1)) ||
      (r.type === 'second-wind' && r.view(r.host).game?.phase === 'race-result')
    );
  }
  function prepare(s) {
    s.done = !!complete(s);
    s.planned = [];
    if (s.done) return;
    const r = s.room;
    if (!r.type) {
      const p = r.players[r.turn];
      if (p) s.planned.push(op(p.id, p.bet < r.currentBet ? 'call' : 'check'));
      return;
    }
    if (r.type === 'thunder') {
      s.planned.push({
        actor: r.actor(),
        action: r.diceCheck
          ? r.diceCheck.status === 'awaiting'
            ? 'rollDice'
            : r.diceCheck.status === 'rolling'
              ? '查看擲骰結果'
              : 'acceptDice'
          : r.phase,
        run: (room) => {
          if (room.diceCheck?.status === 'rolling') room.diceCheck.readyAt = 0;
          room.auto();
        },
      });
      return;
    }
    const key = [r.round, r.phase, r.presenterId, r.canvas?.epoch].join(':');
    if (s.cacheKey !== key) {
      s.cacheKey = key;
      s.caches = new Map();
    }
    for (let n = 0; n < r.players.length; n++) {
      const p = r.players[(s.cursor + n) % r.players.length];
      if (p.kicked) continue;
      if (!s.caches.has(p.id)) s.caches.set(p.id, {});
      const planned = planTutorialAction(r, p, s.caches.get(p.id));
      if (planned) s.planned.push(planned);
    }
    // Timers are advanced only on this private teaching table, never global clocks or real rooms.
    if (!s.planned.length && !s.done) {
      s.planned.push({
        actor: r.host,
        action: '查看本階段結果',
        run: (room) => {
          s.clock.value = Math.max(
            s.clock.value + 1000,
            (room.deadline || room.nextRoundAt || s.clock.value) + 1,
          );
          for (const p of room.players) p.lastSeen = s.clock.value;
          if (typeof room.auto === 'function') room.auto(s.clock.value);
          else if (typeof room.tick === 'function') room.tick(s.clock.value);
        },
      });
    }
  }
  function view(s) {
    const r = s.room,
      snapshot = copy(r.view(s.player));
    if (r.type === 'draw') snapshot.savedResultIds = [];
    snapshot.type = r.type || 'poker';
    snapshot.serverNow = now();
    snapshot.hostId = r.host;
    // Keep the original validated deadlines without expiring while a learner reads.
    if (snapshot.deadline != null) snapshot.deadline = now() + 86400000;
    if (snapshot.playback) {
      snapshot.playback = {
        provider: 'audio',
        stage: snapshot.playback.stage,
        seconds: snapshot.playback.stage === 'intro' ? 8 : 30,
        start: 0,
        url:
          '/api/game-song-audio?code=FEED00&roundId=' +
          encodeURIComponent(r.roundId) +
          '&tutorial=' +
          s.id,
      };
    }
    return {
      id: s.id,
      type: snapshot.type,
      revision: s.revision,
      done: s.done,
      steps: s.steps,
      actorId: s.planned[0]?.actor || null,
      actor: s.planned[0] ? r.players.find((p) => p.id === s.planned[0].actor)?.name : null,
      suggested: s.planned[0]
        ? {
            action: s.planned[0].action,
            label:
              labels[s.planned[0].action] ||
              (/^[a-z-]+$/i.test(s.planned[0].action) ? '處理本階段操作' : s.planned[0].action),
          }
        : null,
      snapshot,
      events: s.events.slice(-8),
      ...(r.type === 'draw' ? { canvas: r.canvasSnapshot() } : {}),
    };
  }
  function start(owner, type) {
    expire();
    if (!types.includes(type)) fail(400, 'INVALID_TUTORIAL', '這款遊戲尚未註冊教學');
    for (const [id, s] of sessions) if (s.owner === owner) sessions.delete(id);
    if (sessions.size >= maxSessions) fail(429, 'TUTORIAL_BUSY', '教學桌暫時已滿，請稍後再試');
    const clock = { value: now() };
    const room = new classes[type]('FEED00', '獨立教學桌', rng, () => clock.value);
    for (const name of ['學員小明', '教學小晴', '教學阿哲'].slice(
      0,
      ['poker', 'thunder', 'quacks'].includes(type) ? 2 : 3,
    ))
      room.add(name, false);
    const s = {
      id: randomUUID(),
      owner,
      room,
      clock,
      player: room.players[0].id,
      revision: 0,
      steps: 0,
      cursor: 0,
      touched: now(),
      events: [],
      receipts: new Map(),
      caches: new Map(),
      planned: [],
      done: false,
    };
    if (type === 'musicquiz') {
      room.settings.banks = ['custom'];
      room.customSongs = copy(require('./audio').songs);
    }
    room.start();
    prepare(s);
    sessions.set(s.id, s);
    return view(s);
  }
  function apply(owner, data, route = 'step') {
    const s = get(owner, data.id);
    if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))
      fail(400, 'INVALID_REQUEST_ID', '請重新送出教學操作');
    const fingerprint = JSON.stringify([data.revision, route, data.body]);
    if (s.receipts.has(data.requestId)) {
      if (s.receipts.get(data.requestId) !== fingerprint)
        fail(409, 'REQUEST_CONFLICT', '教學操作內容不一致');
      return view(s);
    }
    if (data.revision !== s.revision) fail(409, 'STALE_TUTORIAL', '教學已更新，請讀取目前步驟');
    if (s.done) return view(s);
    if (s.steps >= 2000) fail(409, 'TUTORIAL_LIMIT', '本次練習步驟已達上限，請重新開始');
    const r = s.room,
      body = data.body || {};
    let operation;
    if (route === 'step') operation = s.planned[0];
    else if (route === 'action')
      operation = {
        actor: s.player,
        action: body.action,
        run: (room) => room.act(s.player, body.action, room.type ? body : body.amount),
      };
    else if (route === 'draw/stroke')
      operation = {
        actor: s.player,
        action: 'draw-stroke',
        run: (room) => room.addStroke(s.player, body),
      };
    else if (route === 'telephone/draft')
      operation = {
        actor: s.player,
        action: 'draft',
        run: (room) => room.saveDraft(s.player, body),
      };
    else fail(400, 'TUTORIAL_ROUTE', '教學不提供此操作');
    if (!operation) fail(409, 'TUTORIAL_WAIT', '請重新讀取教學狀態');
    if (route === 'step' || operation.action === 'guess') s.clock.value += 800;
    for (const p of r.players) p.lastSeen = s.clock.value;
    operation.run(r);
    operation.after?.();
    s.steps++;
    s.revision++;
    s.cursor = (r.players.findIndex((p) => p.id === operation.actor) + 1) % r.players.length;
    s.events.push({
      id: s.revision,
      actor: r.players.find((p) => p.id === operation.actor)?.name || '教學',
      action:
        labels[operation.action] ||
        (/^[a-z-]+$/i.test(operation.action) ? '處理本階段操作' : operation.action),
    });
    s.events = s.events.slice(-8);
    s.receipts.set(data.requestId, fingerprint);
    if (s.receipts.size > 64) s.receipts.delete(s.receipts.keys().next().value);
    prepare(s);
    return view(s);
  }
  function perspective(owner, data) {
    const s = get(owner, data.id);
    if (data.revision !== s.revision) fail(409, 'STALE_TUTORIAL', '教學已更新，請讀取目前步驟');
    if (!s.room.players.some((p) => p.id === data.playerId && !p.kicked))
      fail(400, 'TUTORIAL_PLAYER', '請選擇教學桌內的角色');
    s.player = data.playerId;
    s.revision++;
    return view(s);
  }
  return {
    types,
    start,
    state: (owner, id) => view(get(owner, id)),
    apply,
    perspective,
    close: (owner, id) => {
      get(owner, id);
      sessions.delete(id);
      return { ok: true };
    },
    audio: (owner, id, roundId) => {
      const s = get(owner, id);
      if (s.room.type !== 'musicquiz' || s.room.roundId !== roundId)
        fail(404, 'TUTORIAL_AUDIO', '教學音檔已換輪');
      return require('./audio').clip(
        Number(s.room.current.id.split('-').at(-1)),
        s.room.phase === 'intro' ? 8 : 30,
      );
    },
    clear: () => sessions.clear(),
    size: () => {
      expire();
      return sessions.size;
    },
  };
}
module.exports = { createTutorials, types };
