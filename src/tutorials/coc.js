'use strict';
const { openDatabase } = require('../db');
const { CocLibrary } = require('../coc/library');
const { CocCampaignStore } = require('../coc/campaign-store');
const { CocRoom } = require('../games/coc');
const { uid, stamp, fail, requestId, fingerprint } = require('../coc/util');
const { ACTIONS } = require('../coc/scenario');
function createCocTutorials({ now = Date.now, rng, ttl = 30 * 60000, maxSessions = 32 } = {}) {
  const sessions = new Map();
  function dispose(s) {
    s.store.close();
    s.db.close();
    sessions.delete(s.id);
  }
  function expire() {
    for (const s of sessions.values()) if (now() - s.touched >= ttl) dispose(s);
  }
  function closeOwner(owner) {
    for (const s of sessions.values()) if (s.owner === owner) dispose(s);
  }
  function get(owner, id) {
    expire();
    const s = sessions.get(id);
    if (!s || s.owner !== owner) fail('TUTORIAL_NOT_FOUND', '教學已結束或逾時，請重新開始', 404);
    s.touched = now();
    return s;
  }
  function planned(s) {
    const state = s.store.state(s.room),
      actor = s.player;
    if (state.clues.includes('notebook')) return null;
    if (state.status === 'paused') return { action: 'resume', body: {}, label: '恢復教學' };
    if (state.sanityQueue.length)
      return {
        action: 'sanity',
        body: { checkId: state.sanityQueue[0].id },
        label: state.sanityQueue[0].status === 'rolled' ? '接受理智損失' : '擲理智／INT 骰',
      };
    if (state.offer)
      return {
        action: 'confirm',
        body: { offerId: state.offer.id, approve: true },
        label: '確認全隊移動',
      };
    if (state.check)
      return {
        action: state.check.status === 'awaitingRoll' ? 'roll' : 'acceptRoll',
        body: { checkId: state.check.id, luck: 0 },
        label: state.check.status === 'awaitingRoll' ? '擲百分骰' : '接受已保存的檢定結果',
      };
    if (!state.clues.includes('farr'))
      return { action: 'preset', body: { actionId: 'examine-farr' }, label: '調查眼前的事件' };
    const visited = state.journal.some(
      (e) => e.kind === 'action' && e.text.includes('說明調查理由並探視 Farr'),
    );
    if (!visited)
      return state.scene === 'sanitarium'
        ? { action: 'preset', body: { actionId: 'visit-farr' }, label: '探視 Farr，練習非戰鬥檢定' }
        : { action: 'move', body: { destination: 'sanitarium' }, label: '提出前往療養院' };
    return state.scene === 'walnut'
      ? { action: 'preset', body: { actionId: 'search-farr' }, label: '調查公寓並取得基本線索' }
      : { action: 'move', body: { destination: 'walnut' }, label: '提出前往核桃街' };
  }
  function view(s) {
    const plan = planned(s),
      snapshot = s.room.view(s.player);
    snapshot.actions = snapshot.actions.filter((a) =>
      ['examine-farr', 'visit-farr', 'search-farr', 'study-lamps', 'talk-caruso'].includes(a.id),
    );
    snapshot.destinations = snapshot.destinations.filter((d) =>
      ['home', 'sanitarium', 'walnut'].includes(d.id),
    );
    if (!plan) {
      snapshot.phase = 'finished';
      snapshot.actions = [];
      snapshot.destinations = [];
      snapshot.result = {
        summary: '已完成基本調查、共同移動與非戰鬥檢定。可使用上方的重新練習再試一次。',
      };
    }
    return {
      id: s.id,
      type: 'coc',
      revision: s.revision,
      done: !plan,
      steps: s.steps,
      actorId: plan ? s.player : null,
      actor: plan ? '學員小明' : null,
      suggested: plan ? { action: plan.action, label: plan.label } : null,
      snapshot: {
        ...snapshot,
        serverNow: now(),
        hostId: s.room.host,
        gameRevision: 0,
        tutorial: true,
        botSupport: { supported: false, canAdd: false },
      },
      events: s.events.slice(-8),
    };
  }
  function start(owner) {
    expire();
    closeOwner(owner);
    if (sessions.size >= maxSessions) fail('TUTORIAL_BUSY', '教學桌暫時已滿', 429);
    const db = openDatabase(':memory:');
    try {
      db.prepare(
        "INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES(?,?,?,'tutorial-no-login','member',?)",
      ).run(owner, 'coc-tutorial', '學員小明', stamp());
      const user = db.prepare('SELECT * FROM users WHERE id=?').get(owner),
        room = new CocRoom('FEED00', '獨立 COC 教學桌', rng, now),
        p = room.add('學員小明');
      const library = new CocLibrary(db, { rng });
      const store = new CocCampaignStore(
        db,
        library,
        {
          resolve: () => ({
            provider: 'openai',
            scope: 'station',
            ownerId: null,
            key: 'tutorial-never-sent',
            model: 'tutorial-fixture',
          }),
        },
        {
          accounts: () => [[owner, p.id]],
          findRoom: () => room,
          changed: () => {},
          rng,
          tutorial: true,
        },
      );
      Object.defineProperties(room, {
        cocStart: { value: () => store.start(room) },
        cocAct: { value: (id, action, data) => store.act(room, id, action, data) },
        cocView: { value: (id) => store.project(room, id) },
        cocLeave: { value: () => {} },
        cocTick: { value: () => {} },
      });
      store.sync(room);
      const character = library.create(user, {
        requestId: uid(),
        name: '教學偵探',
        occupation: 'investigator',
        pregen: true,
      });
      room.act(p.id, 'character', {
        requestId: uid(),
        revision: store.row(room.campaignId).revision,
        characterId: character.id,
      });
      room.start();
      const s = {
        id: uid(),
        owner,
        db,
        store,
        room,
        player: p.id,
        revision: 0,
        steps: 0,
        touched: now(),
        events: [],
        receipts: new Map(),
      };
      sessions.set(s.id, s);
      return view(s);
    } catch (error) {
      db.close();
      throw error;
    }
  }
  function apply(owner, data, route = 'step') {
    const s = get(owner, data.id),
      id = requestId(data.requestId),
      print = fingerprint({ revision: data.revision, route, body: data.body || {} });
    if (s.receipts.has(id)) {
      if (s.receipts.get(id) !== print) fail('REQUEST_CONFLICT', '教學操作內容不一致');
      return view(s);
    }
    if (data.revision !== s.revision) fail('STALE_TUTORIAL', '教學已更新，請讀取目前步驟');
    if (s.steps >= 200) fail('TUTORIAL_LIMIT', '教學步驟已達上限，請重新開始');
    const plan = planned(s);
    if (!plan) return view(s);
    const body =
      route === 'step'
        ? { action: plan.action, ...plan.body }
        : route === 'action'
          ? data.body
          : null;
    if (
      !body ||
      ![
        'preset',
        'move',
        'confirm',
        'roll',
        'acceptRoll',
        'sanity',
        'intent',
        'pause',
        'resume',
      ].includes(body.action)
    )
      fail('TUTORIAL_ROUTE', '此功能不在這次教學範圍', 400);
    if (
      body.action === 'preset' &&
      !['examine-farr', 'visit-farr', 'search-farr', 'study-lamps', 'talk-caruso'].includes(
        body.actionId,
      )
    )
      fail('TUTORIAL_ROUTE', '本次先練習眼前事件、療養院與核桃街的基本調查', 400);
    if (body.action === 'move' && !['home', 'sanitarium', 'walnut'].includes(body.destination))
      fail('TUTORIAL_ROUTE', '本次教學僅使用三個基本調查地點', 400);
    s.room.player(s.player).lastSeen = Date.now();
    s.room.act(s.player, body.action, {
      ...body,
      requestId: uid(),
      revision: s.store.row(s.room.campaignId).revision,
    });
    s.steps++;
    s.revision++;
    s.receipts.set(id, print);
    if (s.receipts.size > 64) s.receipts.delete(s.receipts.keys().next().value);
    const label =
      body.action === 'preset'
        ? ACTIONS.find((a) => a.id === body.actionId)?.label
        : {
            move: '提出全隊移動',
            confirm: '確認共同決策',
            roll: '擲百分骰',
            acceptRoll: '確認檢定結果',
            sanity: '處理理智檢定',
            intent: '描述行動目標',
            pause: '暫停教學',
            resume: '繼續教學',
          }[body.action];
    s.events.push({
      id: s.revision,
      actor: '學員小明',
      action: route === 'step' ? plan.label : '手動練習：' + (label || '處理目前行動'),
    });
    return view(s);
  }
  return {
    start,
    apply,
    expire,
    closeOwner,
    has: (id) => sessions.has(id),
    state: (owner, id) => view(get(owner, id)),
    perspective: (owner, data) => {
      const s = get(owner, data.id);
      if (data.playerId !== s.player) fail('TUTORIAL_PLAYER', '本教學只有一位真人調查者', 400);
      return view(s);
    },
    close: (owner, id) => {
      dispose(get(owner, id));
      return { ok: true };
    },
    clear: () => {
      for (const s of sessions.values()) dispose(s);
    },
    size: () => {
      expire();
      return sessions.size;
    },
  };
}
module.exports = { createCocTutorials };
