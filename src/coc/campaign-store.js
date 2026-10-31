'use strict';
const { transaction } = require('../db');
const { structuredCall } = require('./provider');
const { shortReply, intentRequest, narrationRequest } = require('./keeper');
const { revealedMedia, assetFile } = require('./media');
const {
  DEFAULT,
  getScenario,
  listScenarios,
  available,
  destinations,
  sceneFor,
} = require('./scenario-registry');
const { META, TRUTH } = DEFAULT;
const { RULES_VERSION, SKILLS, ATTRIBUTES } = require('./catalog');
const rules = require('./rules');
const { CocCombat } = require('./combat');
const { fail, clone, uid, stamp, text, integer, requestId, fingerprint } = require('./util');

class CocCampaignStore {
  constructor(
    db,
    library,
    keyring,
    { accounts, changed, findRoom, rng, tutorial = false, enabled = true } = {},
  ) {
    Object.assign(this, {
      db,
      library,
      keyring,
      accounts,
      changed,
      findRoom,
      rng,
      tutorial,
      enabled,
    });
    this.jobs = new Map();
    this.controllers = new Map();
    this.closing = false;
    this.combat = new CocCombat(this);
    // A crashed provider request is uncertain, never an instruction to reroll.
    db.prepare(
      "UPDATE coc_ai_calls SET status='uncertain',error_code='COC_RESTART' WHERE status='reserved'",
    ).run();
    for (const row of db
      .prepare("SELECT * FROM coc_campaigns WHERE status IN ('playing','paused')")
      .all()) {
      const state = JSON.parse(row.state_json);
      state.status = 'paused';
      state.pauseReason = '伺服器重新啟動，請確認同伴已回到座位後繼續';
      if (state.pending && ['running', 'queued'].includes(state.pending.status)) {
        state.pending.status = 'uncertain';
        state.pending.error = '上次 AI 請求可能已計費；遊戲結果已保存，可由房主重試同一次敘事。';
      }
      db.prepare(
        "UPDATE coc_campaigns SET status='paused',revision=revision+1,state_json=?,updated_at=? WHERE id=?",
      ).run(JSON.stringify(state), stamp(), row.id);
    }
  }
  row(id) {
    const row = this.db.prepare('SELECT * FROM coc_campaigns WHERE id=?').get(id);
    if (!row) fail('COC_CAMPAIGN_NOT_FOUND', '找不到冒險存檔', 404);
    return row;
  }
  state(room) {
    return JSON.parse(this.row(room.campaignId).state_json);
  }
  account(room, seat) {
    const id = this.accounts(room).find(([, value]) => value === seat)?.[0];
    if (!id) fail('COC_NOT_MEMBER', '找不到帳號與座位的對應', 403);
    return id;
  }
  user(room, seat) {
    const id = this.account(room, seat),
      user = this.db.prepare('SELECT * FROM users WHERE id=? AND disabled=0').get(id);
    if (!user) fail('COC_NOT_MEMBER', '帳號無法使用', 403);
    return user;
  }
  ensure(room) {
    if (room.campaignId) {
      this.row(room.campaignId);
      return;
    }
    const host = this.account(room, room.host),
      id = uid(),
      at = stamp();
    const state = {
      id,
      module: META.id,
      truthHash: fingerprint(TRUTH),
      status: 'waiting',
      scene: 'home',
      minutes: 540,
      heroes: {},
      retired: [],
      clues: [],
      flags: {},
      journal: [],
      rolls: [],
      ai: { provider: 'openai', source: this.keyring.cli ? 'cli' : 'user', tokenLimit: 500000 },
      pending: null,
      offer: null,
      check: null,
      sanityQueue: [],
      session: 1,
      sessionActions: 0,
      sessionClosed: false,
      excluded: [],
      result: null,
    };
    transaction(this.db, () => {
      const previous = this.db
        .prepare('SELECT id FROM coc_campaigns WHERE room_code=?')
        .get(room.code);
      if (previous)
        this.db
          .prepare('UPDATE coc_campaigns SET room_code=? WHERE id=?')
          .run('archived:' + previous.id, previous.id);
      this.db
        .prepare('INSERT INTO coc_campaigns VALUES(?,?,?,?,1,?,?,?)')
        .run(id, room.code, host, 'waiting', JSON.stringify(state), at, at);
      for (const [userId, seatId] of this.accounts(room))
        this.db
          .prepare('INSERT INTO coc_members VALUES(?,?,?,?,?,1,?)')
          .run(id, userId, seatId, null, null, at);
    });
    room.campaignId = id;
  }
  sync(room) {
    this.ensure(room);
    const state = this.state(room),
      active = new Set(room.activePlayers().map((p) => p.id));
    for (const [userId, seatId] of this.accounts(room)) {
      if (state.excluded.includes(userId) || !active.has(seatId)) continue;
      this.db
        .prepare(
          `INSERT INTO coc_members(campaign_id,user_id,seat_id,active,joined_at) VALUES(?,?,?,1,?)
        ON CONFLICT(campaign_id,user_id) DO UPDATE SET seat_id=excluded.seat_id,active=1`,
        )
        .run(room.campaignId, userId, seatId, stamp());
    }
  }
  log(state, kind, message, detail = null) {
    state.journal.push({
      id: uid(),
      kind,
      text: message,
      minutes: state.minutes,
      ...(detail ? { detail } : {}),
    });
    state.journal = state.journal.slice(-300);
  }
  write(room, row, state, kind, actor = null) {
    state.presentSeats = room.activePlayers().map((p) => p.id);
    if (state.status !== 'waiting')
      state.visitedScenes = [...new Set([...this.exploredScenes(state), state.scene])];
    if (state.truthHash !== fingerprint(getScenario(state).TRUTH))
      fail('COC_MODULE_VERSION', '此冒險需要原版本劇本，請保留存檔並聯絡管理者', 503);
    const revision = row.revision + 1,
      host = this.accounts(room).find(([, id]) => id === room.host)?.[0] || row.host_user_id;
    const result = this.db
      .prepare(
        'UPDATE coc_campaigns SET host_user_id=?,status=?,revision=?,state_json=?,updated_at=? WHERE id=? AND revision=?',
      )
      .run(host, state.status, revision, JSON.stringify(state), stamp(), row.id, row.revision);
    if (!result.changes) fail('COC_STALE', '冒險已更新，請重新讀取');
    for (const [seat, sheet] of Object.entries(state.heroes)) {
      const member = this.db
        .prepare('SELECT user_id FROM coc_members WHERE campaign_id=? AND seat_id=?')
        .get(row.id, seat);
      if (member)
        this.db
          .prepare(
            'UPDATE coc_members SET character_id=?,character_json=? WHERE campaign_id=? AND user_id=?',
          )
          .run(sheet.sourceCharacterId || null, JSON.stringify(sheet), row.id, member.user_id);
    }
    this.db
      .prepare('INSERT INTO coc_events VALUES(?,?,?,?,?,?)')
      .run(
        row.id,
        revision,
        kind,
        actor,
        JSON.stringify({ kind, scene: state.scene, minutes: state.minutes }),
        stamp(),
      );
    room.phase = state.status;
    room.version = Math.max(room.version + 1, revision);
    room.updated = Date.now();
    return revision;
  }
  mutate(room, seat, data, kind, run) {
    this.sync(room);
    const user = this.user(room, seat),
      id = requestId(data.requestId),
      scope = room.campaignId + ':' + kind,
      print = fingerprint({ scope, ...data });
    const result = transaction(this.db, () => {
      const receipt = this.db
        .prepare('SELECT * FROM coc_receipts WHERE user_id=? AND request_id=?')
        .get(user.id, id);
      if (receipt) {
        if (receipt.scope !== scope || receipt.fingerprint !== print)
          fail('COC_REQUEST_REUSED', '同一操作識別碼不可套用不同內容');
        return JSON.parse(receipt.response_json);
      }
      const row = this.row(room.campaignId),
        state = JSON.parse(row.state_json);
      if (data.revision !== row.revision) fail('COC_STALE', '冒險已更新，請讀取最新畫面後再操作');
      state.presentSeats = room.activePlayers().map((p) => p.id);
      run(state, user);
      getScenario(state).settle?.(this, room, state);
      this.pauseForReplacement(room, state);
      const revision = this.write(room, row, state, kind, user.id),
        reply = { ok: true, revision };
      this.db
        .prepare('INSERT INTO coc_receipts VALUES(?,?,?,?,?,?)')
        .run(user.id, id, scope, print, JSON.stringify(reply), stamp());
      return reply;
    });
    this.schedule(room);
    return result;
  }
  actionsFor(room, state) {
    const teacher = room
      .activePlayers()
      .some((p) => state.heroes[p.id]?.knowsChant && state.heroes[p.id]?.condition === 'healthy');
    return available(state).filter((a) => a.id !== 'teach-chant' || teacher);
  }
  moveAction(state, destination) {
    return {
      id: 'move:' + destination.id,
      label: '全隊前往 ' + destination.name,
      minutes: destination.minutes,
      moveTo: destination.id,
      party: true,
      unanimous: true,
      confirm: true,
      risk:
        '全隊轉移地點，故事時間前進 ' +
        destination.minutes +
        ' 分鐘；須所有在席玩家確認。' +
        (state.flags.ritual ? '移動會中斷吟唱，已耗魔力與理智不退回。' : ''),
    };
  }
  intentActions(room, state, seat) {
    return [
      ...this.actionsFor(room, state).filter((a) => !a.actorOnly || a.actorOnly === seat),
      ...destinations(state).map((d) => this.moveAction(state, d)),
    ];
  }
  hostOnly(room, seat) {
    if (room.host !== seat) fail('COC_HOST_ONLY', '只有房主可以調整這項設定', 403);
  }
  hero(state, seat) {
    const sheet = state.heroes[seat];
    if (!sheet) fail('COC_CHARACTER_REQUIRED', '請先選擇調查者');
    return sheet;
  }
  pauseForReplacement(room, state) {
    if (getScenario(state).deferReplacement === true && state.status !== 'finished') return;
    if (
      state.status === 'playing' &&
      !state.combat &&
      !state.sanityQueue.length &&
      !state.pending &&
      !state.check &&
      !state.offer &&
      room.activePlayers().some((p) => ['dead', 'retired'].includes(state.heroes[p.id]?.condition))
    ) {
      state.status = 'paused';
      state.pauseReason = '調查者永久退場，請由該玩家選擇新角色，再由房主恢復冒險';
    }
  }
  ready(room, state) {
    if (state.status !== 'playing') fail('COC_PAUSED', '冒險已暫停，請先恢復遊玩');
    if (this.pendingRecovery(room, state).length)
      fail('COC_RECOVERY_PENDING', '請先由每位調查者完成本次跑團的幸運恢復擲骰');
    if (state.pending || state.offer || state.check || state.sanityQueue.length || state.combat)
      fail('COC_PENDING', '請先完成目前的確認、檢定、戰鬥或 AI 回覆');
    if (room.activePlayers().some((p) => Date.now() - p.lastSeen > 30000))
      fail('COC_OFFLINE', '仍有同伴離線，冒險須先暫停');
  }
  pendingRecovery(room, state) {
    if (state.status === 'finished') return [];
    return room
      .activePlayers()
      .map((p) => p.id)
      .filter(
        (id) =>
          state.luckRecovery?.[id]?.status === 'pending' &&
          state.luckRecovery[id].session === state.session &&
          !['dead', 'retired'].includes(state.heroes[id]?.condition),
      );
  }
  start(room) {
    if (!this.enabled && !this.tutorial)
      fail('COC_PREVIEW', '完整冒險尚未開放；角色庫、AI 設定與獨立教學可以先使用');
    this.sync(room);
    this.keyring.resolve(
      this.account(room, room.host),
      this.state(room).ai.source,
      this.state(room).ai.provider,
    );
    transaction(this.db, () => {
      const row = this.row(room.campaignId),
        state = JSON.parse(row.state_json);
      if (state.status !== 'waiting') fail('COC_STARTED', '這份冒險已開始；請使用存檔繼續');
      for (const p of room.activePlayers()) this.hero(state, p.id);
      state.status = 'playing';
      getScenario(state).start?.(this, state);
      this.log(state, 'scene', sceneFor(state).description);
      this.narrate(state, room.host, [sceneFor(state).description]);
      this.write(room, row, state, 'start', this.account(room, room.host));
    });
    this.schedule(room);
  }
  narrate(state, actor, facts, roleplay = null) {
    if (this.tutorial) {
      this.log(state, 'keeper', '教學示範（不連接 AI）：' + facts.join(' '));
      return;
    }
    state.pending = {
      id: uid(),
      stage: 'narration',
      actor,
      facts: clone(facts),
      status: 'queued',
      ...(roleplay ? { roleplay } : {}),
    };
  }
  act(room, seat, action, data) {
    return this.mutate(room, seat, data, action, (state, user) => {
      if (action === 'character') {
        if (!['waiting', 'paused'].includes(state.status))
          fail('COC_CHARACTER_LOCKED', '請在等待時選角，或角色永久退場後暫停更換');
        if (state.status !== 'waiting' && getScenario(state).deferReplacement === true)
          fail('COC_CHARACTER_LOCKED', '這個劇本須先完成當前夢境與後果結算，不能中途換入新角色');
        if (state.combat || state.check || state.offer || state.sanityQueue.length || state.pending)
          fail('COC_PENDING', '請先完成目前的戰鬥與待處理結果，再於暫停時安排新角色加入');
        const previous = state.heroes[seat];
        if (
          previous &&
          state.status !== 'waiting' &&
          !['dead', 'retired'].includes(previous.condition)
        )
          fail('COC_CHARACTER_LOCKED', '存活角色不能在冒險中重新配點');
        if (previous && state.status !== 'waiting')
          state.retired.push({ seat, sheet: clone(previous), minutes: state.minutes });
        state.heroes[seat] = this.library.getReady(user, data.characterId);
        state.heroes[seat].lastLuckRecoverySession = state.session;
        if (state.luckRecovery) delete state.luckRecovery[seat];
        this.log(
          state,
          'character',
          user.display_name + ' 選擇了調查者 ' + state.heroes[seat].name,
        );
        return;
      }
      if (action === 'module') {
        this.hostOnly(room, seat);
        if (state.status !== 'waiting') fail('COC_STARTED', '開局後不能更換劇本；請另開新局');
        if (this.tutorial) fail('COC_TUTORIAL', '教學使用獨立的示範劇本');
        const selected = getScenario(data.moduleId);
        state.module = selected.META.id;
        state.truthHash = fingerprint(selected.TRUTH);
        state.scene = selected.initial?.scene || 'home';
        state.minutes = selected.initial?.minutes ?? 540;
        state.flags = {};
        state.visitedScenes = [];
        state.clues = [];
        state.journal = [];
        state.rolls = [];
        this.log(
          state,
          'module',
          '房主選擇了劇本《' + selected.META.title + '》；開局後固定使用這個版本。',
        );
        return;
      }
      if (action === 'aiSettings') {
        this.hostOnly(room, seat);
        if (
          !['waiting', 'paused'].includes(state.status) ||
          (state.pending && !['failed', 'uncertain'].includes(state.pending.status))
        )
          fail('COC_PENDING', '請在沒有進行中 AI 請求的等待或暫停狀態調整');
        if (
          !['openai', 'anthropic'].includes(data.provider) ||
          !['station', 'user', 'cli'].includes(data.source) ||
          (data.source === 'cli' && (data.provider !== 'openai' || !this.keyring.cli))
        )
          fail('COC_AI_SETTINGS', 'AI 設定不正確', 400);
        state.ai = {
          provider: data.provider,
          source: data.source,
          tokenLimit: integer(data.tokenLimit, 10000, 2000000),
        };
        return;
      }
      if (action === 'pause') {
        if (state.status !== 'playing') fail('COC_PHASE', '目前無須暫停');
        state.status = 'paused';
        state.pauseReason = '玩家主動暫停';
        this.log(state, 'pause', '冒險暫停，故事時間停止。');
        return;
      }
      if (action === 'endInvestigation') {
        if (!this.canEndInvestigation(room, state) || state.offer)
          fail('COC_PHASE', '只有全隊無法行動且沒有待處理結果時，才能提出結束調查');
        return this.propose(room, state, seat, {
          id: 'end-investigation',
          effect: 'endInvestigation',
          label: '結束本篇調查',
          minutes: 0,
          confirm: true,
          party: true,
          unanimous: true,
          risk: '本篇調查將永久結束，記為全隊失去行動能力。保留每人的傷勢、資源與歷史；不假定獲救、撤離或死亡。全員同意後執行，不能恢復本篇。',
        });
      }
      if (action === 'resume') {
        this.hostOnly(room, seat);
        if (state.status !== 'paused') fail('COC_PHASE', '目前沒有暫停的冒險');
        if (room.activePlayers().some((p) => Date.now() - p.lastSeen > 30000))
          fail('COC_OFFLINE', '請等待所有參與者恢復連線');
        if (
          state.combat &&
          Object.values(state.deferredCombat || {}).some(
            (item) => item.battleId === state.combat.id,
          )
        )
          fail('COC_OFFLINE', '請等待離席者回到原座位，完成已保存的戰鬥決定後再繼續');
        if (
          getScenario(state).deferReplacement !== true &&
          !state.combat &&
          !state.sanityQueue.length &&
          room
            .activePlayers()
            .some((p) => ['dead', 'retired'].includes(state.heroes[p.id]?.condition))
        )
          fail('COC_CHARACTER_REQUIRED', '請先由永久退場的玩家選擇新角色，再恢復冒險');
        if (
          !state.combat &&
          !state.sanityQueue.length &&
          this.partyUnable(room, state) &&
          !getScenario(state).resumeUnavailable?.(state)
        )
          fail(
            'COC_PARTY_UNABLE',
            '全隊目前無法行動；可先使用合法傷勢恢復，或由全員確認結束本篇調查',
          );
        this.keyring.resolve(user.id, state.ai.source, state.ai.provider);
        state.status = 'playing';
        state.pauseReason = null;
        if (state.sessionClosed) {
          state.session++;
          state.sessionClosed = false;
          state.luckRecoverySession = state.session;
          state.luckRecovery = {};
          for (const p of room.activePlayers())
            if (state.heroes[p.id] && !['dead', 'retired'].includes(state.heroes[p.id].condition))
              state.luckRecovery[p.id] = { session: state.session, status: 'pending' };
          this.log(state, 'recovery', '新一場跑團開始，請每位調查者自行按鈕擲幸運恢復骰。');
        }
        this.log(state, 'resume', '全隊恢復冒險。');
        this.combat.pump(room, state);
        return;
      }
      if (action === 'retryAi') {
        this.hostOnly(room, seat);
        if (!state.pending || !['failed', 'uncertain'].includes(state.pending.status))
          fail('COC_PENDING', '目前沒有可重試的 AI 回覆');
        state.pending.status = 'queued';
        delete state.pending.error;
        return;
      }
      if (action === 'cancelIntent') {
        if (!state.pending || state.pending.stage !== 'intent' || state.pending.actor !== seat)
          fail('COC_PENDING', '只能取消自己尚未執行的意圖');
        this.controllers.get(state.pending.id)?.abort();
        state.pending = null;
        if (state.intentContext) delete state.intentContext[seat];
        this.log(
          state,
          'action',
          '玩家取消尚未執行的意圖，沒有執行角色行動、擲骰或扣除角色資源；已送出的 AI 請求可能仍計費。',
        );
        return;
      }
      if (action === 'confirm') return this.confirm(room, state, seat, data);
      if (action === 'roll') return this.rollCheck(room, state, seat, data);
      if (action === 'sanity') return this.resolveSanity(room, state, seat, data);
      if (action === 'acceptRoll') return this.acceptRoll(room, state, seat, data);
      if (action === 'recoverLuck') {
        const checkpoint = state.luckRecovery?.[seat];
        if (
          state.status !== 'playing' ||
          checkpoint?.status !== 'pending' ||
          checkpoint.session !== state.session
        )
          fail('COC_RECOVERY', '目前沒有等待你擲骰的幸運恢復');
        if (data.luck || data.push) fail('COC_LUCK', '幸運恢復不能花幸運值或孤注一擲');
        const h = this.hero(state, seat);
        if (['dead', 'retired'].includes(h.condition)) fail('COC_RECOVERY', '退場角色不能恢復幸運');
        const result = rules.luckRecovery(h, this.rng);
        h.luck = result.luck;
        h.lastLuckRecoverySession = state.session;
        checkpoint.status = 'done';
        checkpoint.result = clone(result);
        this.log(
          state,
          'recovery',
          h.name +
            ' 擲幸運恢復骰 ' +
            result.roll +
            '，恢復 ' +
            result.gained +
            ' 幸運（上限 99）。',
          { actor: seat, ...result },
        );
        return;
      }
      if (action === 'develop') {
        const checkpoint = state.developmentChecks?.[seat],
          h = this.hero(state, seat);
        if (
          state.status !== 'finished' ||
          checkpoint?.status !== 'pending' ||
          ['dead', 'retired'].includes(h.condition)
        )
          fail('COC_DEVELOPMENT', '目前沒有等待你擲骰的成長檢定');
        if (data.luck || data.push) fail('COC_LUCK', '成長檢定不能花幸運值或孤注一擲');
        h.development = clone(checkpoint.skills);
        const results = rules.growth(h, this.rng);
        checkpoint.status = 'done';
        checkpoint.results = clone(results);
        const reward = state.result.rewards.find((item) => item.seat === seat);
        if (reward) reward.growth = clone(results);
        for (const result of results)
          this.log(
            state,
            'development',
            h.name +
              ' · ' +
              SKILLS[result.skill][0] +
              ' 成長骰 ' +
              result.roll +
              '，提升 ' +
              result.increase +
              '。',
            { actor: seat, ...result },
          );
        return;
      }
      if (action === 'endSession') {
        this.ready(room, state);
        this.hostOnly(room, seat);
        if (state.sessionActions < 10)
          fail(
            'COC_SESSION',
            '請使用一般暫停；至少完成十次故事行動後，才能結束本次跑團並在下次開始恢復幸運值',
          );
        state.status = 'paused';
        state.sessionClosed = true;
        state.sessionActions = 0;
        state.pauseReason = '本次跑團結束，所有進度已保存；下次由房主恢復';
        this.log(state, 'session', state.pauseReason);
        return;
      }
      if (action === 'pulpLuck') {
        if (!['scratch', 'escapeDeath'].includes(data.kind))
          fail('COC_LUCK', '戰鬥以外請使用恢復傷勢或避免死亡');
        if (
          !['playing', 'paused'].includes(state.status) ||
          state.combat ||
          state.pending ||
          state.offer ||
          state.check
        )
          fail('COC_PENDING', '請先處理目前操作；戰鬥中的傷勢請使用戰鬥控制');
        const h = this.hero(state, seat),
          result = rules.pulpLuck(h, data.kind, this.rng);
        h.luck -= result.cost;
        Object.assign(h, result);
        delete h.cost;
        if (data.kind === 'escapeDeath') h.returnFromScene = state.scene;
        this.log(state, 'recovery', h.name + ' 支出 ' + result.cost + ' 幸運值處理傷勢。');
        return;
      }
      if (action === 'recover') {
        this.ready(room, state);
        const healer = this.hero(state, seat),
          patient = state.heroes[data.target];
        if (
          state.flags.ritual &&
          (state.flags.ritual.caster === seat || state.flags.ritual.helpers.includes(seat))
        )
          fail('COC_CHANT', '持續吟唱時不能同時治療；請先決定是否中止儀式');
        if (
          !patient ||
          !room.activePlayers().some((p) => p.id === data.target) ||
          patient.condition === 'dead' ||
          ['dead', 'retired', 'dying', 'unconscious', 'returnNextScene'].includes(
            healer.condition,
          ) ||
          patient.hp >= patient.maxHp
        )
          fail('COC_HEAL', '目前無法治療這位同伴');
        const skill =
          data.method === 'medicine' ? 'medicine' : data.method === 'firstAid' ? 'firstAid' : null;
        if (!skill) fail('COC_HEAL', '請選擇急救或醫學');
        if (
          (skill === 'firstAid' && patient.firstAidWound === patient.woundId) ||
          (skill === 'medicine' && patient.medicineDay === Math.floor(state.minutes / 1440))
        )
          fail('COC_HEAL', '同一傷勢不能重複急救，醫學治療每天最多一次');
        return this.propose(room, state, seat, {
          id: 'heal:' + skill,
          label: (skill === 'medicine' ? '醫學治療' : '急救') + '：' + patient.name,
          minutes: skill === 'medicine' ? 60 : 0.1,
          effect: 'heal',
          target: data.target,
          check: { skill, difficulty: 'regular' },
          confirm: true,
          risk:
            skill === 'medicine'
              ? '需要一小時；成功恢復 1d4 體力。當天不能重複治療。'
              : '需要一回合；成功恢復 1d4 體力，同一傷勢只能嘗試一次。瀕死者若遭遇大失敗可能死亡。',
        });
      }
      if (action === 'combat') {
        if (state.status !== 'playing') fail('COC_PAUSED', '請先恢復冒險');
        if (room.activePlayers().some((p) => Date.now() - p.lastSeen > 30000))
          fail('COC_OFFLINE', '請等同伴恢復連線');
        return this.combat.act(room, state, seat, data);
      }
      this.ready(room, state);
      const sheet = this.hero(state, seat);
      if (
        ['dead', 'retired', 'returnNextScene', 'unconscious', 'dying'].includes(sheet.condition) &&
        !(action === 'preset' && getScenario(state).reactiveAction?.(state, seat, data.actionId))
      )
        fail('COC_UNABLE', '角色目前無法採取一般行動，請先處理傷勢或更換角色');
      if (action === 'preset') {
        const selected = this.actionsFor(room, state).find(
          (a) => a.id === data.actionId && (!a.actorOnly || a.actorOnly === seat),
        );
        if (!selected) fail('COC_ACTION', '目前不能採取這個行動');
        if (state.intentContext) delete state.intentContext[seat];
        return this.propose(room, state, seat, selected);
      }
      if (action === 'move') {
        const destination = destinations(state).find((d) => d.id === data.destination);
        if (!destination) fail('COC_DESTINATION', '尚未得知這個地點，或已經在該處');
        if (state.intentContext) delete state.intentContext[seat];
        return this.propose(room, state, seat, this.moveAction(state, destination));
      }
      if (action === 'intent') {
        const intent = text(data.text, 500);
        if (this.tutorial) {
          this.log(
            state,
            'keeper',
            '教學示範不呼叫 AI。正式冒險會請主持人理解「' +
              intent +
              '」；本次請選擇預設調查行動繼續練習。',
          );
          return;
        }
        state.pending = {
          id: uid(),
          stage: 'intent',
          actor: seat,
          intent,
          context:
            state.intentContext?.[seat]?.scene === state.scene
              ? clone(state.intentContext[seat])
              : null,
          status: 'queued',
          actions: this.intentActions(room, state, seat).map((a) => ({
            id: a.id,
            label: a.label,
            minutes: a.minutes || 0,
            confirm: !!a.confirm,
            risk: a.risk || '',
          })),
        };
        this.log(state, 'intent', sheet.name + '：' + intent);
        return;
      }
      fail('COC_ACTION', '不支援的跑團操作', 400);
    });
  }
  partyUnable(room, state) {
    const players = room.activePlayers();
    return (
      players.length > 0 &&
      players.every((p) =>
        ['dead', 'retired', 'unconscious', 'dying', 'returnNextScene'].includes(
          state.heroes[p.id]?.condition,
        ),
      )
    );
  }
  canEndInvestigation(room, state) {
    return (
      !getScenario(state).resumeUnavailable?.(state) &&
      state.status === 'paused' &&
      !state.combat &&
      !state.pending &&
      !state.check &&
      !state.sanityQueue.length &&
      this.partyUnable(room, state)
    );
  }
  propose(room, state, seat, action) {
    if (action.actorOnly && action.actorOnly !== seat)
      fail('COC_NOT_ACTOR', '這項行動需由目前的施法者完成');
    if (action.confirm || action.party) {
      state.offer = {
        id: uid(),
        actor: seat,
        action: clone(action),
        votes: { [seat]: null },
        electorate: room.activePlayers().map((p) => p.id),
      };
      return;
    }
    this.execute(room, state, seat, action);
  }
  confirm(room, state, seat, data) {
    const offer = state.offer;
    if (
      state.status !== 'playing' &&
      !(state.status === 'paused' && offer?.action.effect === 'endInvestigation')
    )
      fail('COC_PAUSED', '請先恢復冒險');
    if (!offer || offer.id !== data.offerId) fail('COC_STALE', '這項確認已結束');
    const action = offer.action;
    if (!action.party && seat !== offer.actor) fail('COC_NOT_ACTOR', '此行動由提出者決定', 403);
    if (!offer.electorate.includes(seat)) fail('COC_VOTE', '你不在這次決策的參與者之中', 403);
    if (typeof data.approve !== 'boolean') fail('COC_VOTE', '請選擇確認或取消', 400);
    offer.votes[seat] = data.approve;
    const votes = action.party ? offer.electorate : [offer.actor],
      yes = votes.filter((id) => offer.votes[id] === true).length,
      no = votes.filter((id) => offer.votes[id] === false).length;
    const accepted = action.unanimous ? yes === votes.length : yes > votes.length / 2;
    const rejected = action.unanimous ? no > 0 : no >= Math.ceil(votes.length / 2);
    if (rejected) {
      state.offer = null;
      this.log(state, 'decision', '取消：' + action.label);
      return;
    }
    if (accepted) {
      state.offer = null;
      this.execute(room, state, offer.actor, action);
    }
  }
  execute(room, state, seat, action) {
    if (action.effect === 'endInvestigation') {
      if (!this.canEndInvestigation(room, state)) fail('COC_PHASE', '隊伍狀態已改變，請重新確認');
      this.finish(state, 'overwhelmed');
      return;
    }
    if (action.actorOnly && action.actorOnly !== seat)
      fail('COC_NOT_ACTOR', '這項行動需由目前的施法者完成');
    if (action.check) {
      const descriptor = clone(action);
      if (descriptor.check.opposedTarget !== undefined)
        descriptor.opposition = rules.percentile(descriptor.check.opposedTarget, 0, this.rng);
      if (action.effect === 'ritualSustain') {
        descriptor.opposition = rules.percentile(125, 0, this.rng);
        descriptor.check.targetOverride =
          this.hero(state, seat).attributes.POW + (state.flags.ritual?.helpers.length || 0) * 25;
      }
      state.check = {
        id: uid(),
        actor: seat,
        action: descriptor,
        status: 'awaitingRoll',
        pushed: false,
      };
      return;
    }
    this.applyAction(room, state, seat, action, null);
  }
  rollCheck(room, state, seat, data) {
    if (state.status !== 'playing') fail('COC_PAUSED', '請先恢復冒險');
    const check = state.check;
    if (
      !check ||
      check.id !== data.checkId ||
      check.actor !== seat ||
      check.status !== 'awaitingRoll'
    )
      fail('COC_CHECK', '目前沒有等待你擲骰的檢定');
    const sheet = this.hero(state, seat),
      skill = check.action.check.skill,
      target = check.action.check.targetOverride ?? sheet.attributes[skill] ?? sheet.skills[skill];
    const bonus = rules.talentBonus(sheet, skill) - (sheet.bout?.until > state.minutes ? 1 : 0);
    if (check.action.tiebreak) {
      const own = rules.die(100, this.rng),
        other = rules.die(100, this.rng);
      check.roll = { roll: own, target: 100, level: own < other ? 1 : 0, bonus: 0 };
      check.action.opposition = { roll: other, target: 100, level: other < own ? 1 : 0, bonus: 0 };
    } else check.roll = rules.percentile(target, bonus, this.rng);
    check.status = 'rolled';
    state.rolls.push({
      id: check.id,
      actor: seat,
      skill,
      ...clone(check.roll),
      pushed: check.pushed,
      tiebreak: check.action.tiebreak === true,
    });
    state.rolls = state.rolls.slice(-100);
    this.log(
      state,
      'roll',
      sheet.name +
        ' · ' +
        (SKILLS[skill]?.[0] || ATTRIBUTES[skill] || skill) +
        (check.action.tiebreak ? ' · 平手決勝 D100：' : '：') +
        check.roll.roll +
        (check.action.tiebreak ? '；對方 ' + check.action.opposition.roll : '／' + target),
      clone(check.roll),
    );
  }
  acceptRoll(room, state, seat, data) {
    if (state.status !== 'playing') fail('COC_PAUSED', '請先恢復冒險');
    const check = state.check;
    if (!check || check.id !== data.checkId || check.actor !== seat || check.status !== 'rolled')
      fail('COC_CHECK', '目前沒有可處理的骰值');
    const sheet = this.hero(state, seat);
    if (check.action.tiebreak && (data.luck || data.push))
      fail('COC_LUCK', '平手決勝只比 D100 點數，不能支出幸運值或孤注一擲');
    if (data.push === true) {
      if (
        check.action.noPush ||
        check.pushed ||
        rules.passed(check.roll, check.action.check.difficulty) ||
        check.roll.luckSpent
      )
        fail('COC_PUSH', '這次檢定不能孤注一擲');
      text(data.justification, 300);
      check.pushed = true;
      check.status = 'awaitingRoll';
      check.previous = check.roll;
      delete check.roll;
      this.log(
        state,
        'push',
        sheet.name + ' 選擇孤注一擲；再次失敗將多耗兩小時，且可能引來當地人的阻撓。',
      );
      return;
    }
    if (data.luck) {
      const amount = integer(data.luck, 1, 100);
      check.roll = rules.spendLuck(sheet, check.roll, amount, {
        pushed: check.pushed,
        kind: 'skill',
      });
      sheet.luck -= amount;
    }
    const opposition = check.action.opposition;
    if (
      opposition &&
      check.roll.level === opposition.level &&
      check.roll.target === opposition.target
    ) {
      this.log(
        state,
        'roll',
        check.action.tiebreak
          ? '決勝骰再次同點，請玩家重新擲 D100；不再支付儀式資源或推進故事時間。'
          : '雙方同級且數值相同，請玩家擲 D100 決勝，點數較低者勝出。',
        { actor: seat, own: clone(check.roll), opposition: clone(opposition) },
      );
      check.id = uid();
      check.status = 'awaitingRoll';
      check.action.tiebreak = true;
      check.action.noPush = true;
      delete check.roll;
      return;
    }
    const passed = rules.passed(check.roll, check.action.check.difficulty);
    if (
      passed &&
      !check.roll.luckSpent &&
      !['credit', 'mythos'].includes(check.action.check.skill) &&
      sheet.skills[check.action.check.skill] !== undefined
    )
      sheet.development = [...new Set([...sheet.development, check.action.check.skill])];
    if (!passed && check.pushed) {
      this.advance(state, 120);
      state.flags.localSuspicion = true;
    }
    state.check = null;
    state.lastCheckRoll = { ...clone(check.roll), pushed: check.pushed };
    state.lastOpposition = check.action.opposition ? clone(check.action.opposition) : null;
    if (check.action.tiebreak)
      state.lastOpposedWin = check.roll.roll < check.action.opposition.roll;
    this.applyAction(room, state, seat, check.action, check.roll);
    delete state.lastCheckRoll;
    delete state.lastOpposition;
    delete state.lastOpposedWin;
  }
  discover(state, ids, facts) {
    for (const id of ids || [])
      if (!state.clues.includes(id)) {
        state.clues.push(id);
        const clue = getScenario(state).CLUES[id];
        if (clue) {
          facts.push(clue.text);
          this.log(state, 'clue', clue.title + '：' + clue.text);
        }
      }
  }
  advance(state, minutes, { exposed = true } = {}) {
    if (getScenario(state).advance) {
      state.minutes = Number((state.minutes + minutes).toFixed(6));
      getScenario(state).advance(this, state, minutes);
      return;
    }
    const previous = state.minutes;
    state.minutes += minutes;
    if (state.flags.ritual?.boundAt !== undefined)
      state.flags.perceptionDenied =
        (state.flags.perceptionDenied || 0) +
        Math.max(0, state.minutes - Math.max(previous, state.flags.ritual.boundAt));
    const passedDays = Math.floor(state.minutes / 1440) - Math.floor(previous / 1440);
    for (const sheet of Object.values(state.heroes)) {
      if (passedDays > 0) {
        sheet.sanDayStart = sheet.san;
        sheet.sanDayLoss = 0;
        if (!['dead', 'retired', 'dying'].includes(sheet.condition))
          sheet.hp = Math.min(sheet.maxHp, sheet.hp + passedDays * 2);
      }
      const recovery = (sheet.mpRecoveryMinutes || 0) + minutes;
      sheet.mp = Math.min(sheet.maxMp, sheet.mp + Math.floor(recovery / 60));
      sheet.mpRecoveryMinutes = recovery % 60;
      if (sheet.condition === 'returnNextScene' && state.scene !== sheet.returnFromScene)
        sheet.condition = 'healthy';
      const night = state.minutes % 1440 >= 1080 || state.minutes % 1440 < 360;
      let rate = !exposed
        ? 0
        : state.scene === 'walnut' && night && !state.flags.lampsStopped
          ? sheet.attributes.POW / 5 / 60
          : state.scene === 'cave'
            ? sheet.attributes.POW / 60
            : state.scene === 'hill' && state.flags.landslide
              ? (sheet.attributes.POW * 2) / 5
              : 0;
      sheet.exposure = (sheet.exposure || 0) + rate * minutes;
      sheet.sight =
        sheet.exposure >= 150 && sheet.attributes.POW >= 75
          ? 3
          : sheet.exposure >= 100 && sheet.attributes.POW >= 65
            ? 2
            : sheet.exposure >= 70 && sheet.attributes.POW >= 50
              ? 1
              : 0;
    }
    if (!state.flags.lampsStopped) {
      if (state.minutes >= 2 * 1440 + 120 && !state.flags.carusoDied) {
        state.flags.carusoDied = true;
        this.log(state, 'news', '報紙傳來核桃街又有居民遇害的消息。');
      }
      if (state.minutes >= 5 * 1440 + 120 && !state.flags.secondIncident) {
        state.flags.secondIncident = true;
        this.log(state, 'news', '核桃街再傳死亡與失蹤事件，居民更加恐懼。');
      }
    }
    if (state.minutes >= 5 * 1440 + 720 && !state.clues.includes('duncanAlly'))
      this.discover(state, ['duncanAlly'], []);
    if (state.minutes >= 6 * 1440 + 720 && !state.clues.includes('appointment'))
      this.discover(state, ['appointment'], []);
    this.timeline(state);
  }
  applyAction(room, state, seat, action, roll) {
    if (state.result) return;
    const sheet = this.hero(state, seat),
      facts = [],
      pass = !action.check || rules.passed(roll, action.check.difficulty);
    if (action.moveTo && state.flags.ritual) {
      delete state.flags.ritual;
      this.log(state, 'action', '全隊移動使儀式中斷，已耗魔力與理智不退回。');
    }
    if (action.effect !== 'stopDuncanResult')
      this.advance(state, action.minutes || 0, { exposed: !action.moveTo });
    state.sessionActions++;
    if (state.result) return;
    if (getScenario(state).interrupted?.(state, action)) {
      this.log(
        state,
        'action',
        sheet.name + '：' + action.label + '在期限到達時被中斷，未取得原定效果。',
      );
      this.narrate(state, seat, ['期限在動作完成前到達；原定調查或操作未完成，請處理眼前的威脅。']);
      return;
    }
    this.discover(state, action.clues, facts);
    if (roll) {
      facts.push(pass ? '檢定達到要求。' : '檢定未達要求。');
      if (pass) {
        this.discover(state, action.check.detailClues, facts);
        if (action.check.detail) facts.push(action.check.detail);
      } else {
        if (action.check.failure) facts.push(action.check.failure);
        if (action.check.extraMinutes) this.advance(state, action.check.extraMinutes);
      }
    }
    if (action.moveTo) {
      state.scene = action.moveTo;
      facts.push(sceneFor(state).description);
      for (const hero of Object.values(state.heroes))
        if (hero.condition === 'returnNextScene') hero.condition = 'healthy';
    }
    if (action.effect) this.effect(room, state, seat, action, pass, facts);
    if (action.effect === 'stopDuncanResult') this.advance(state, action.minutes || 0);
    if (action.sanity)
      for (const p of room.activePlayers())
        if (!['dead', 'retired', 'returnNextScene'].includes(state.heroes[p.id]?.condition))
          state.sanityQueue.push({
            id: uid(),
            actor: p.id,
            loss: action.sanity,
            mundane: action.mundane === true,
            status: 'awaitingRoll',
            reason: action.label,
          });
    this.log(state, 'action', sheet.name + '：' + action.label);
    if (!state.pending && !state.check && state.status !== 'finished')
      this.narrate(state, seat, facts.length ? facts : [action.label + '已完成。']);
  }
  effect(room, state, seat, action, pass, facts) {
    const moduleEffect = getScenario(state).effect;
    if (moduleEffect && action.effect.startsWith('soup:'))
      return moduleEffect(this, room, state, seat, action, pass, facts);
    if (action.effect === 'cancelRitual') {
      delete state.flags.ritual;
      facts.push('施法者停止吟唱，儀式中斷；已維持的時間留在記錄中，魔力與理智不退回。');
      return;
    }
    if (action.effect === 'heal') {
      const h = state.heroes[action.target],
        skill = action.check.skill;
      if (skill === 'firstAid') h.firstAidWound = h.woundId;
      else h.medicineDay = Math.floor(state.minutes / 1440);
      if (pass) {
        const amount = state.lastCheckRoll.level >= 3 ? 4 : rules.die(4, this.rng);
        h.hp = Math.min(h.maxHp, h.hp + amount);
        h.condition = 'healthy';
        facts.push(h.name + ' 恢復 ' + amount + ' 體力。');
      } else if (
        h.condition === 'dying' &&
        (state.lastCheckRoll.level === -1 || state.lastCheckRoll.pushed)
      ) {
        h.condition = 'dead';
        facts.push(h.name + ' 傷勢惡化，已死亡；仍可依規則選擇避免死亡。');
      } else facts.push('這次治療未能改善傷勢。');
      return;
    }
    if (['findBook', 'findNotes', 'houseAccess'].includes(action.effect)) {
      if (pass) state.flags[action.effect] = true;
      return;
    }
    if (['stopLamps', 'breakLamps'].includes(action.effect)) {
      state.flags.lampsStopped = true;
      facts.push('全部新路燈已停止照明並遮光收存，核桃街的異常照明源受到控制。');
      if (action.effect === 'breakLamps') state.flags.localSuspicion = true;
      return;
    }
    if (action.effect === 'learnChant' || action.effect === 'learnBook') {
      const sheet = this.hero(state, seat),
        hours = 40 - Math.floor(sheet.attributes.INT / 5);
      this.advance(state, hours * 60);
      const target = Math.floor(
        (sheet.attributes.INT * (action.effect === 'learnChant' ? 2 : 1)) / 5,
      );
      // This PC check remains manual: create the check before any die is rolled.
      // Replace the provisional descriptor, not the character's INT.
      state.check = {
        id: uid(),
        actor: seat,
        action: {
          id: 'learn-result',
          label: '理解儀式',
          minutes: 0,
          effect: 'learnResult',
          check: { skill: 'INT', difficulty: 'regular', targetOverride: target },
        },
        status: 'awaitingRoll',
        pushed: false,
      };
      facts.push('完成一輪研讀，請由玩家擲骰確認是否掌握儀式。');
      return;
    }
    if (action.effect === 'learnResult') {
      if (pass) {
        this.hero(state, seat).knowsChant = true;
        facts.push('你已掌握儀式，可教導其他同伴。');
      } else facts.push('尚未掌握儀式，可繼續研讀或改用其他方法處理威脅。');
      return;
    }
    if (action.effect === 'caveExposure') {
      this.discover(state, ['sleeping'], facts);
      for (const p of room.activePlayers()) {
        const h = state.heroes[p.id];
        if (h.sight && !h.seenSleeping) {
          h.seenSleeping = true;
          state.sanityQueue.push({
            id: uid(),
            actor: p.id,
            loss: ['1d3', '1d10'],
            status: 'awaitingRoll',
            reason: '柱林後的沉睡巨物',
          });
        }
      }
      return;
    }
    if (action.effect === 'guardedDais') {
      this.combat.start(room, state, { kind: 'cave', actor: seat });
      facts.push('穿越柱林時，守衛們向調查者包圍而來。');
      return;
    }
    if (action.effect === 'truck') {
      const appointment = 6 * 1440 + 22 * 60 + 30;
      if (state.minutes < appointment) this.advance(state, appointment - state.minutes);
      state.flags.truckSeen = true;
      facts.push(
        '倉庫裡傳來引擎聲。Duncan 駕駛工程卡車衝出大門，朝 Crawford’s Rise 方向駛去。你們預留的車道讓他從身旁掠過。',
      );
      return;
    }
    if (action.effect === 'followTruck') {
      state.flags.duncanPresent = true;
      facts.push(
        '抵達山坡時，Duncan 已爬到洞口附近，正在架設炸藥。他注意到追來的人影，動作更加急促。',
      );
      return;
    }
    if (action.effect === 'stopDuncan') {
      if (!state.flags.duncanPresent || state.flags.landslide || state.flags.duncanStopped)
        fail('COC_ACTION', '目前沒有能攔下的 Duncan');
      state.check = {
        id: uid(),
        actor: seat,
        action: {
          id: 'stop-duncan-result',
          label: '讓 Duncan 暫停爆破',
          minutes: 0,
          effect: 'stopDuncanResult',
          check: { skill: 'persuade', difficulty: 'hard' },
        },
        status: 'awaitingRoll',
        pushed: false,
      };
      facts.push('你先在安全距離說明已知證據，試著讓他相信你沒有替那些生物工作。');
      return;
    }
    if (action.effect === 'stopDuncanResult') {
      if (state.flags.landslide || state.flags.duncanStopped)
        fail('COC_ACTION', '攔下 Duncan 的時機已經改變');
      if (pass) {
        state.flags.duncanStopped = true;
        facts.push('Duncan 同意放下引爆器，讓你們協助處理威脅。');
        if (state.flags.lampsStopped) this.finish(state, 'prevented');
        else {
          this.lastMeal(state);
          facts.push('雖然炸藥尚未引爆，洞內仍傳來甦醒的動靜。');
        }
      } else this.landslide(room, state, facts);
      return;
    }
    if (action.effect === 'rescueDuncan') {
      if (state.flags.duncanSaved || state.flags.lastMealAt)
        fail('COC_ACTION', '救援的時機已經改變');
      this.combat.start(room, state, { kind: 'hill', actor: seat, objective: 'rescue' });
      facts.push('碎石遮住了 Duncan，需要先找到他並在守衛的襲擊中搬開岩塊。');
      return;
    }
    if (action.effect === 'ritual') return this.beginRitual(room, state, seat, facts);
    if (action.effect === 'ritualResult') return this.ritualResult(room, state, seat, pass, facts);
    if (action.effect === 'ritualSustain')
      return this.ritualSustain(room, state, seat, pass, facts);
    if (action.effect === 'watchAwakening') {
      if (state.flags.duncanPresent && !state.flags.duncanStopped && !state.flags.landslide)
        this.landslide(room, state, facts);
      else if (!state.flags.lastMealAt && state.flags.landslide) {
        if (state.flags.duncanSaved && state.flags.lampsStopped) this.finish(state, 'prevented');
        else {
          this.lastMeal(state);
          facts.push('守衛帶著最後一份食物返回洞窟，隨後全數退入黑暗。');
        }
      }
      if (state.flags.lastMealAt && state.minutes < state.flags.lastMealAt + 10)
        this.advance(state, state.flags.lastMealAt + 10 - state.minutes);
      this.timeline(state);
      facts.push(
        state.flags.awakeAt
          ? '巨物停在洞口，仰向肉眼看不到的星光。'
          : '山坡仍沉寂；你可以繼續調查或等待。',
      );
      return;
    }
    if (action.effect === 'attackSleeper') {
      if (!state.flags.awakeAt) fail('COC_ACTION', '巨物尚未來到洞口');
      this.combat.start(room, state, { kind: 'sleeper', actor: seat });
      return;
    }
    if (action.effect === 'retreat') {
      this.finish(
        state,
        state.flags.duncanStopped && state.flags.lampsStopped && !state.flags.lastMealAt
          ? 'prevented'
          : 'escaped',
      );
      return;
    }
    if (action.effect === 'wait') return;
    if (action.effect === 'teachChant') {
      const sheet = this.hero(state, seat);
      const teacher = Object.entries(state.heroes).find(
        ([id, h]) =>
          room.activePlayers().some((p) => p.id === id) &&
          h.knowsChant &&
          h.condition === 'healthy',
      );
      if (!teacher || sheet.knowsChant)
        fail('COC_CHANT', '需要一位已掌握儀式的在席同伴教導尚未學會的角色');
      this.advance(state, 30 - Math.floor(sheet.attributes.INT / 5));
      state.check = {
        id: uid(),
        actor: seat,
        action: {
          id: 'taught-chant',
          label: '理解同伴傳授的儀式',
          minutes: 0,
          effect: 'learnResult',
          check: { skill: 'INT', difficulty: 'regular' },
        },
        status: 'awaitingRoll',
        pushed: false,
      };
      return;
    }
    fail('COC_EFFECT_UNAVAILABLE', '此行動與目前的劇本版本不相容，進度保持不變', 503);
  }
  lastMeal(state) {
    if (state.flags.lastMealAt !== undefined) return;
    state.flags.lastMealAt = state.minutes;
    this.log(
      state,
      'scene',
      '侍從攜帶最後一份食物返回洞內，其他守衛隨之退去。巨物的觸肢開始緩慢擺動。',
    );
  }
  landslide(room, state, facts) {
    state.flags.landslide = true;
    state.flags.duncanHp = 5;
    state.flags.blastAt = state.minutes;
    facts.push('爆炸造成大片岩坡崩塌，洞口反而被擴大。Duncan 被埋在坡下，洞內的綠光照向整座山坡。');
    // The party's stop attempt was made from a safe distance. Reaching the
    // climbing route is a separate explicitly confirmed action, never an
    // implied move chosen by the narrator.
    this.combat.start(room, state, { kind: 'hill', objective: 'rescue' });
  }
  timeline(state) {
    // The adaptation moves the warehouse appointment to 22:00 so a ritual
    // that can start only after 23:00 has a fair window. These deadlines keep
    // NPC events moving even when investigators choose to sleep or leave.
    const arrival = 6 * 1440 + 23 * 60 + 30,
      blast = arrival + 15;
    if (!state.flags.duncanStopped && state.minutes >= arrival) state.flags.duncanPresent = true;
    if (!state.flags.duncanStopped && !state.flags.landslide && state.minutes >= blast) {
      state.flags.landslide = true;
      state.flags.duncanHp = 5;
      state.flags.blastAt = blast;
      if (['hill', 'cave'].includes(state.scene))
        this.log(state, 'scene', 'Duncan 引爆炸藥。岩坡大幅崩塌，洞口反而擴大；他被埋在碎石下。');
    }
    if (
      state.flags.landslide &&
      state.flags.lastMealAt === undefined &&
      state.minutes >= (state.flags.blastAt ?? blast) + 1.5 &&
      (!state.flags.duncanSaved || !state.flags.lampsStopped)
    ) {
      state.flags.lastMealAt = (state.flags.blastAt ?? blast) + 1.5;
      if (['hill', 'cave'].includes(state.scene))
        this.log(state, 'scene', '侍從攜帶最後一份食物返回洞內，其他守衛隨之退去。');
    }
    const meal = state.flags.lastMealAt;
    if (meal === undefined) return;
    if (state.minutes >= meal + 10 && !state.flags.awakeAt) {
      state.flags.awakeAt = meal + 10;
      if (['hill', 'cave'].includes(state.scene))
        this.log(
          state,
          'scene',
          '巨物移到洞窟入口，仰向星空；它暫時沒有攻擊，仍有阻止永久甦醒的機會。',
        );
      for (const [actor, h] of Object.entries(state.heroes))
        if (
          (state.presentSeats || Object.keys(state.heroes)).includes(actor) &&
          !['dead', 'retired'].includes(h.condition) &&
          ['hill', 'cave'].includes(state.scene)
        )
          state.sanityQueue.push({
            id: uid(),
            actor,
            loss: h.seenSleeping ? ['1d3', '1d10'] : ['1d6', '1d20'],
            status: 'awaitingRoll',
            reason: '洞口甦醒中的巨物',
          });
    }
    if (state.flags.awakeAt && state.minutes >= state.flags.awakeAt + 180 && !state.result)
      this.finish(state, (state.flags.perceptionDenied || 0) >= 90 ? 'banished' : 'escaped');
  }
  beginRitual(room, state, seat, facts) {
    const h = this.hero(state, seat),
      helpers = room
        .activePlayers()
        .map((p) => p.id)
        .filter(
          (id) =>
            id !== seat &&
            state.heroes[id]?.knowsChant &&
            state.heroes[id]?.condition === 'healthy',
        );
    if (!h.knowsChant || h.condition !== 'healthy')
      fail('COC_CHANT', '施法者需要已掌握儀式且能持續吟唱');
    if (state.minutes % 1440 < 23 * 60 && state.minutes % 1440 >= 360)
      fail('COC_CHANT_TIME', '必須等到夜間十一點後才能開始施法');
    if (!state.flags.awakeAt || state.minutes + 60 > state.flags.awakeAt + 180)
      fail('COC_CHANT_TIME', '目標尚未出現，或已沒有完成一小時施法的時間');
    if (h.attributes.POW * 2 + helpers.length * 20 < 200)
      fail(
        'COC_CHANT_SIZE',
        '施法者與同伴的力量不足以籠罩這個體型的目標；可教導同伴後再試，或尋找其他阻止方式',
      );
    if (h.mp < 12 || helpers.some((id) => state.heroes[id].mp < 5))
      fail('COC_MP', '施法者需要 12 魔力，每位協助者需要 5 魔力');
    h.mp -= 12;
    for (const id of helpers) state.heroes[id].mp -= 5;
    state.flags.ritual = { caster: seat, helpers, started: state.minutes };
    this.advance(state, 60);
    // Seven-edition characteristic scale, opposed POW versus the fixed target.
    const target = h.attributes.POW + helpers.length * 25,
      opposition = rules.percentile(125, 0, this.rng);
    state.check = {
      id: uid(),
      actor: seat,
      action: {
        id: 'ritual-result',
        label: '引導儀式籠罩巨物',
        minutes: 0,
        effect: 'ritualResult',
        check: { skill: 'POW', difficulty: 'regular', targetOverride: target },
        opposition,
        noPush: true,
      },
      status: 'awaitingRoll',
      pushed: false,
    };
    facts.push('一小時吟唱完成，魔力已付出。請施法者擲 POW，對抗目標的意志；此次不可孤注一擲。');
  }
  ritualResult(room, state, seat, pass, facts) {
    const ritual = state.flags.ritual,
      h = this.hero(state, seat),
      roll = state.lastCheckRoll,
      opposition = state.lastOpposition;
    const won =
      state.lastOpposedWin ??
      (roll && opposition
        ? roll.level > opposition.level ||
          (roll.level === opposition.level && roll.target > opposition.target)
        : pass);
    if (!won) {
      delete state.flags.ritual;
      facts.push('能量網消散；這次施法失敗，已耗魔力不退回，可重新準備儀式。');
      return;
    }
    ritual.boundAt = state.minutes;
    const loss = rules.dice('1d4+1d8', this.rng).total;
    h.san = Math.max(0, h.san - loss);
    h.sanDayLoss = (h.sanDayLoss || 0) + loss;
    h.indefiniteInsanity =
      h.indefiniteInsanity || h.sanDayLoss >= (h.sanDayStart || h.attributes.POW) / 5;
    if (h.san === 0) {
      h.condition = 'retired';
      delete state.flags.ritual;
      state.status = 'paused';
      state.pauseReason = '施法者永久退場，儀式中斷';
      return;
    }
    if (loss >= 5)
      state.sanityQueue.push({
        id: uid(),
        actor: seat,
        loss: ['0', '0'],
        status: 'awaitingInt',
        reason: '共享巨物的感知',
        result: { loss, int: null },
      });
    facts.push(
      '感官連結成立，你感受到完全陌生的異界景象，損失 ' +
        loss +
        ' 理智；須保持吟唱，每小時巨物有機會掙脫。',
    );
  }
  ritualSustain(room, state, seat, pass, facts) {
    const ritual = state.flags.ritual;
    if (ritual?.boundAt === undefined) fail('COC_CHANT', '目前沒有可維持的儀式');
    const defender = state.lastCheckRoll,
      attacker = state.lastOpposition;
    const escaped =
      state.lastOpposedWin !== undefined
        ? !state.lastOpposedWin
        : attacker &&
          (attacker.level > defender.level ||
            (attacker.level === defender.level && attacker.target > defender.target));
    if (escaped) {
      delete state.flags.ritual;
      facts.push('巨物掙脫能量網；已維持的時間仍留在記錄中。');
      return;
    }
    facts.push('眾人穩住儀式，巨物繼續失去感知。');
  }
  finish(state, ending) {
    if (state.result) return;
    const module = getScenario(state);
    module.beforeFinish?.(this, state, ending);
    const labels = {
      ...module.endings,
      prevented:
        '你們阻止了這次甦醒。路燈受到控制，Duncan 的危險計畫也停止了。山洞裡的存在仍須警戒。',
      banished: '被剝奪感官的巨物錯失星光，退回洞窟再次沉睡。',
      repelled: '你們迫使巨物退回洞窟，阻止它永久甦醒。',
      overwhelmed:
        '全隊已失去行動能力，經玩家一致確認，結束本篇調查。每人的傷勢、資源與歷史均已保留；後續命運尚未決定。',
      escaped: '隊伍保全了仍可撤離的同伴，但沒有遏止巨物的甦醒；當地的危機仍未結束。',
    };
    const rewards = [];
    for (const [seat, h] of Object.entries(state.heroes)) {
      if (['dead', 'retired'].includes(h.condition)) continue;
      const understood = state.clues.includes('powder') && state.clues.includes('sleeping');
      const amount = module.reward
        ? module.reward(this, state, seat, ending)
        : rules.dice(
            ending === 'overwhelmed'
              ? '0'
              : ending === 'prevented'
                ? '2d6'
                : ending === 'banished' || ending === 'repelled'
                  ? '1d20'
                  : understood
                    ? '-1d6'
                    : '0',
            this.rng,
          ).total + (ending === 'prevented' && understood ? rules.dice('1d10', this.rng).total : 0);
      h.san = Math.max(0, Math.min(99 - (h.skills.mythos || 0), h.san + amount));
      if (h.san === 0) h.condition = 'retired';
      const growth = [];
      const skills = [...new Set(h.development || [])].filter(
        (id) => SKILLS[id] && !['credit', 'mythos'].includes(id),
      );
      if (h.condition !== 'retired' && skills.length) {
        state.developmentChecks ??= {};
        state.developmentChecks[seat] = { status: 'pending', skills };
      }
      h.history.push({ module: state.module, ending, minutes: state.minutes });
      rewards.push({ seat, sanity: amount, growth });
    }
    state.result = { ending, summary: labels[ending], rewards, finishedAt: stamp() };
    state.status = 'finished';
    state.pending = null;
    state.offer = null;
    state.check = null;
    state.combat = null;
    state.sanityQueue = [];
    state.deferredSanity = {};
    state.deferredCombat = {};
    state.luckRecovery = {};
    this.log(state, 'ending', labels[ending]);
  }
  resolveSanity(room, state, seat, data) {
    if (state.status !== 'playing') fail('COC_PAUSED', '請先恢復冒險');
    const check = state.sanityQueue[0];
    if (!check || check.id !== data.checkId || check.actor !== seat)
      fail('COC_CHECK', '請由目前的調查者完成理智檢定');
    const sheet = this.hero(state, seat);
    if (check.status === 'awaitingRoll') {
      check.result = rules.sanity(sheet, ...check.loss, {
        rng: this.rng,
        mundane: check.mundane,
        minutes: state.minutes,
        deferInt: true,
      });
      check.status = 'rolled';
      return;
    }
    if (check.status === 'awaitingInt') {
      const int = rules.percentile(sheet.attributes.INT, 0, this.rng);
      check.result.int = int;
      if (rules.passed(int)) {
        sheet.insaneUntil = state.minutes + rules.die(10, this.rng) * 60;
        const rounds = rules.die(10, this.rng);
        sheet.bout = { kind: 9, rounds, until: state.minutes + rounds / 10 };
        const phobia = '對「' + check.reason + '」的相關景物感到恐懼';
        sheet.phobias = [...new Set([...(sheet.phobias || []), phobia])];
      }
      if (rules.passed(int) && !check.mundane) {
        sheet.skills.mythos =
          (sheet.skills.mythos || 0) + (sheet.mythosInsanityExperienced ? 1 : 5);
        sheet.mythosInsanityExperienced = true;
        sheet.san = Math.min(sheet.san, 99 - sheet.skills.mythos);
      }
      this.log(state, 'sanity', sheet.name + ' 完成 INT 檢定。', { int, bout: sheet.bout || null });
      state.sanityQueue.shift();
      this.combat.pump(room, state);
      return;
    }
    const result = check.result;
    let loss = result.loss;
    if (data.halve === true) {
      const cost = loss * 2;
      if (!result.roll || rules.passed(result.roll) || sheet.luck < cost)
        fail('COC_LUCK', '這次理智損失不能以幸運值減半');
      sheet.luck -= cost;
      loss = Math.ceil(loss / 2);
    }
    sheet.san = Math.max(0, sheet.san - loss);
    sheet.sanDayLoss = (sheet.sanDayLoss || 0) + loss;
    sheet.indefiniteInsanity =
      sheet.indefiniteInsanity ||
      sheet.sanDayLoss >= (sheet.sanDayStart || sheet.attributes.POW) / 5;
    if (sheet.san === 0) {
      sheet.condition = 'retired';
      this.combat.retire(state, seat);
      this.log(
        state,
        'character',
        sheet.name + ' 永久退場；完成其餘理智檢定與眼前戰鬥後，冒險會暫停安排新角色加入。',
      );
    }
    this.log(state, 'sanity', sheet.name + ' 損失 ' + loss + ' 理智。', { roll: result.roll });
    if (loss >= 5 && sheet.san > 0) check.status = 'awaitingInt';
    else state.sanityQueue.shift();
    state.sanityQueue = state.sanityQueue.filter(
      (c) => !['dead', 'retired'].includes(state.heroes[c.actor]?.condition),
    );
    this.combat.pump(room, state);
  }
  tick(room) {
    if (!room.campaignId || room.phase !== 'playing') return;
    const offline = room.activePlayers().filter((p) => Date.now() - p.lastSeen > 30000);
    if (!offline.length) return;
    transaction(this.db, () => {
      const row = this.row(room.campaignId),
        state = JSON.parse(row.state_json);
      if (state.status !== 'playing') return;
      state.status = 'paused';
      state.pauseReason = '同伴離線：' + offline.map((p) => p.name).join('、');
      this.log(state, 'pause', state.pauseReason + '；故事時間停止。');
      this.write(room, row, state, 'offline');
    });
    this.changed(room);
  }
  leave(room, seat, leaving) {
    if (!room.campaignId) return;
    const userId = this.account(room, seat);
    transaction(this.db, () => {
      const row = this.row(room.campaignId),
        state = JSON.parse(row.state_json);
      if (!leaving && !state.excluded.includes(userId)) state.excluded.push(userId);
      if (state.offer) {
        state.offer = null;
        this.log(state, 'decision', '隊伍變更，尚未完成的共同決策已取消。');
      }
      if (state.check?.actor === seat) {
        this.log(state, 'action', '離席者的未完成檢定已取消，已保存骰值仍留在紀錄。');
        state.check = null;
      }
      // Keep committed SAN rolls for the returning account rather than granting
      // another roll by leaving and rejoining.
      const deferred = state.sanityQueue.filter((c) => c.actor === seat);
      if (deferred.length) {
        state.deferredSanity ??= {};
        state.deferredSanity[seat] = [...(state.deferredSanity[seat] || []), ...deferred];
      }
      state.sanityQueue = state.sanityQueue.filter((c) => c.actor !== seat);
      if (state.pending?.stage === 'intent' && state.pending.actor === seat) {
        this.controllers.get(state.pending.id)?.abort();
        state.pending = null;
        if (state.intentContext) delete state.intentContext[seat];
      }
      if (state.pending && row.host_user_id === userId) {
        this.controllers.get(state.pending.id)?.abort();
        state.pending.status = 'failed';
        state.pending.error = '房主已離席；新房主確認本人金鑰與額度後，可重試已保存的敘事。';
      }
      if (
        state.flags.ritual &&
        (state.flags.ritual.caster === seat || state.flags.ritual.helpers.includes(seat))
      ) {
        delete state.flags.ritual;
        this.log(state, 'action', '吟唱者離席，儀式中斷；已付出的魔力與理智不退回。');
      }
      if (state.combat) {
        const b = state.combat,
          current = b.order[b.index]?.id;
        const saved = {
          battleId: b.id,
          waiting: b.waiting?.actor === seat ? clone(b.waiting) : null,
          resolution: b.resolution?.actor === seat ? clone(b.resolution) : null,
          injuries: [b.injury, ...(b.injuries || [])].filter((i) => i?.actor === seat).map(clone),
        };
        const unresolved = saved.waiting || saved.resolution || saved.injuries.length;
        if (unresolved) {
          state.deferredCombat ??= {};
          state.deferredCombat[seat] = saved;
        }
        b.departed ??= {};
        b.departed[seat] = { escaped: b.escaped.includes(seat) };
        b.heroes = b.heroes.filter((id) => id !== seat);
        b.escaped = [...new Set([...b.escaped, seat])];
        if (!unresolved) b.order = b.order.filter((t) => !t.pc || t.id !== seat);
        if (current !== seat)
          b.index = Math.max(
            0,
            b.order.findIndex((t) => t.id === current),
          );
        if (b.waiting?.actor === seat) {
          b.waiting = null;
        }
        if (b.resolution?.actor === seat) {
          b.resolution = null;
        }
        if (b.injury?.actor === seat) b.injury = null;
        b.injuries = (b.injuries || []).filter((i) => i.actor !== seat);
        if (!b.injury) b.injury = b.injuries.shift() || null;
      }
      if (state.status === 'playing') {
        state.status = 'paused';
        state.pauseReason = '參與者離席，請確認隊伍後繼續';
      }
      this.db
        .prepare('UPDATE coc_members SET active=0 WHERE campaign_id=? AND user_id=?')
        .run(row.id, userId);
      this.log(state, 'membership', '一位參與者離席，原角色與記錄保存在存檔中。');
      this.write(room, row, state, 'leave', userId);
    });
  }
  list(user) {
    return {
      campaigns: this.db
        .prepare(
          'SELECT c.*,m.character_json FROM coc_campaigns c JOIN coc_members m ON m.campaign_id=c.id WHERE m.user_id=? ORDER BY c.updated_at DESC LIMIT 100',
        )
        .all(user.id)
        .filter((row) => !JSON.parse(row.state_json).excluded.includes(user.id))
        .map((row) => {
          const state = JSON.parse(row.state_json);
          return {
            id: row.id,
            code: row.room_code,
            status: row.status,
            revision: row.revision,
            module: getScenario(state).META,
            title: getScenario(state).META.title,
            character: row.character_json ? JSON.parse(row.character_json).name : null,
            updatedAt: row.updated_at,
          };
        }),
    };
  }
  exportCharacter(user, data) {
    return this.library.receipt(user, data, 'campaign-export', () => {
      const saved = this.resumeRecord(user, data.id),
        member = this.db
          .prepare('SELECT seat_id FROM coc_members WHERE campaign_id=? AND user_id=?')
          .get(saved.row.id, user.id),
        h = saved.state.heroes[member.seat_id];
      if (
        saved.state.status !== 'finished' ||
        !h ||
        ['dead', 'retired', 'dying', 'unconscious'].includes(h.condition) ||
        h.hp <= 0
      )
        fail('COC_CONTINUATION', '只能另存已結束冒險中仍可接續的倖存角色');
      if (saved.state.developmentChecks?.[member.seat_id]?.status === 'pending')
        fail('COC_DEVELOPMENT', '請先回冒險完成自己的成長檢定，再另存倖存角色');
      const existing = this.db
        .prepare(
          "SELECT * FROM coc_characters WHERE owner_id=? AND json_extract(sheet_json,'$.continuedFrom')=?",
        )
        .get(user.id, saved.row.id);
      if (existing) return this.library.view(existing);
      if (
        this.db.prepare('SELECT count(*) n FROM coc_characters WHERE owner_id=?').get(user.id).n >=
        40
      )
        fail('COC_LIBRARY_FULL', '角色庫已達 40 張');
      const id = uid(),
        at = stamp(),
        sheet = clone(h);
      sheet.continuedFrom = saved.row.id;
      sheet.condition = sheet.condition === 'returnNextScene' ? 'healthy' : sheet.condition;
      delete sheet.sourceCharacterId;
      delete sheet.sourceRevision;
      this.db
        .prepare('INSERT INTO coc_characters VALUES(?,?,?,?,1,?,?,?,?,?)')
        .run(
          id,
          user.id,
          sheet.name,
          'ready',
          RULES_VERSION,
          JSON.stringify(sheet),
          JSON.stringify(sheet),
          at,
          at,
        );
      return this.library.view(this.library.row(user, id));
    });
  }
  resumeRecord(user, id) {
    const row = this.row(text(id, 80)),
      state = JSON.parse(row.state_json);
    const member = this.db
      .prepare('SELECT * FROM coc_members WHERE campaign_id=? AND user_id=?')
      .get(row.id, user.id);
    if (!member || state.excluded.includes(user.id))
      fail('COC_NOT_MEMBER', '只有原參與者可以恢復這份冒險', 403);
    const members = this.db
      .prepare(
        'SELECT m.*,u.display_name FROM coc_members m JOIN users u ON u.id=m.user_id WHERE m.campaign_id=? AND u.disabled=0 AND (m.active=1 OR m.user_id=?) ORDER BY m.joined_at,m.user_id',
      )
      .all(row.id, user.id)
      .filter((m) => !state.excluded.includes(m.user_id));
    if (members.length > 4) fail('COC_ROOM_FULL', '這份冒險已有四位在席玩家，請先由房主整理席位');
    return { row, state, members };
  }
  resumed(room, user) {
    transaction(this.db, () => {
      const row = this.row(room.campaignId),
        state = JSON.parse(row.state_json);
      this.db.prepare('UPDATE coc_campaigns SET room_code=? WHERE id=?').run(room.code, row.id);
      if (!['waiting', 'finished'].includes(state.status)) {
        state.status = 'paused';
        state.pauseReason = '冒險存檔已恢復，請等同伴回來再繼續';
      }
      this.write(room, row, state, 'resume-save', user.id);
    });
    this.sync(room);
    this.rejoined(room, user);
  }
  rejoined(room, user) {
    const seat = this.accounts(room).find(([id]) => id === user.id)?.[1];
    if (!seat || !room.activePlayers().some((p) => p.id === seat)) return;
    const row = this.row(room.campaignId),
      state = JSON.parse(row.state_json);
    const returning = state.combat && state.heroes[seat] && !state.combat.heroes.includes(seat);
    const deferred = state.deferredSanity?.[seat] || [];
    const savedCombat = state.deferredCombat?.[seat];
    const needsRecovery =
      state.status !== 'finished' &&
      state.luckRecoverySession === state.session &&
      state.heroes[seat] &&
      !['dead', 'retired'].includes(state.heroes[seat].condition) &&
      state.heroes[seat].lastLuckRecoverySession !== state.session &&
      !state.luckRecovery?.[seat];
    if (!returning && !deferred.length && !savedCombat && !needsRecovery) return;
    transaction(this.db, () => {
      if (needsRecovery) {
        state.luckRecovery ??= {};
        state.luckRecovery[seat] = { session: state.session, status: 'pending' };
      }
      if (returning) {
        const b = state.combat;
        b.heroes.push(seat);
        const escaped = b.departed?.[seat]?.escaped === true;
        if (!escaped) b.escaped = b.escaped.filter((id) => id !== seat);
        if (b.departed) delete b.departed[seat];
        // Keep the current order and declared weapon; the actor rejoins next round.
        if (b.order.length) b.prepared[seat] ??= { weapon: 'unarmed', readied: false };
        if (savedCombat?.battleId === b.id) {
          if (savedCombat.waiting) b.waiting = savedCombat.waiting;
          if (savedCombat.resolution) b.resolution = savedCombat.resolution;
          b.injuries = [...savedCombat.injuries, ...(b.injury ? [b.injury] : []), ...b.injuries];
          b.injury = b.injuries.shift() || null;
        }
        this.log(
          state,
          'membership',
          state.heroes[seat].name +
            (savedCombat?.battleId === b.id
              ? ' 回到原座位，接續已保存的戰鬥決定。'
              : escaped
                ? ' 回到原座位，仍在近戰範圍外等待同伴。'
                : ' 回到原座位，下一回合重新加入戰鬥。'),
        );
      }
      state.sanityQueue.push(
        ...deferred.filter(
          (c) =>
            !['dead', 'retired'].includes(state.heroes[c.actor]?.condition) &&
            !state.sanityQueue.some((q) => q.id === c.id),
        ),
      );
      if (state.deferredSanity) delete state.deferredSanity[seat];
      if (state.deferredCombat) delete state.deferredCombat[seat];
      if (returning) this.combat.encounterSanity(state);
      this.write(room, row, state, 'rejoin', user.id);
    });
  }
  exploredScenes(state) {
    if (Array.isArray(state.visitedScenes)) return state.visitedScenes;
    // Old saves already have durable scene events; do not infer exploration from AI prose.
    return this.db
      .prepare(
        "SELECT DISTINCT json_extract(event_json,'$.scene') AS scene FROM coc_events WHERE campaign_id=?",
      )
      .all(state.id)
      .map((item) => item.scene)
      .filter((id) => typeof id === 'string');
  }
  mediaFile(user, campaignId, assetId, size = 1024) {
    const member = this.db
      .prepare('SELECT active FROM coc_members WHERE campaign_id=? AND user_id=?')
      .get(campaignId, user.id);
    if (!member?.active) fail('COC_MEDIA_NOT_FOUND', '找不到這份調查素材', 404);
    const state = JSON.parse(this.row(campaignId).state_json);
    const file = assetFile(state, assetId, this.exploredScenes(state), size);
    if (!file) fail('COC_MEDIA_NOT_FOUND', '找不到這份調查素材', 404);
    return file;
  }
  project(room, seat) {
    this.sync(room);
    const row = this.row(room.campaignId),
      state = JSON.parse(row.state_json);
    room.phase = state.status;
    const pending = state.pending
      ? {
          id: state.pending.id,
          actor: state.pending.actor,
          stage: state.pending.stage,
          status: state.pending.status,
          error: state.pending.error || null,
        }
      : null;
    const offer = state.offer
      ? {
          id: state.offer.id,
          actor: state.offer.actor,
          label: state.offer.action.label,
          risk: state.offer.action.risk || '是否執行？',
          minutes: state.offer.action.minutes,
          unanimous: state.offer.action.unanimous === true,
          party: state.offer.action.party === true,
          votes: state.offer.votes,
          electorate: state.offer.electorate,
        }
      : null;
    const check = state.check
      ? {
          id: state.check.id,
          actor: state.check.actor,
          label: state.check.action.label,
          skill: state.check.action.check.skill,
          difficulty: state.check.action.check.difficulty,
          status: state.check.status,
          pushed: state.check.pushed,
          noPush: state.check.action.noPush === true,
          tiebreak: state.check.action.tiebreak === true,
          opposition:
            state.check.status === 'rolled' && state.check.action.opposition
              ? {
                  level: state.check.action.opposition.level,
                  roll: state.check.action.tiebreak ? state.check.action.opposition.roll : null,
                }
              : null,
          roll: state.check.roll || null,
        }
      : null;
    const san = state.sanityQueue[0];
    const usage = this.db
      .prepare(
        'SELECT COALESCE(SUM(input_tokens),0) input,COALESCE(SUM(output_tokens),0) output,COALESCE(SUM(reserved_tokens),0) budgetUsed FROM coc_ai_calls WHERE campaign_id=?',
      )
      .get(row.id);
    return {
      phase: state.status,
      playEnabled: this.enabled || this.tutorial,
      canEndInvestigation: this.canEndInvestigation(room, state),
      replacementDeferred:
        getScenario(state).deferReplacement === true && state.status !== 'finished',
      campaignRevision: row.revision,
      campaignId: row.id,
      module: getScenario(state).META,
      modules: this.tutorial ? [META] : listScenarios(),
      scene: sceneFor(state),
      exploration: revealedMedia(state, this.exploredScenes(state)),
      minutes: state.minutes,
      ai: state.ai,
      cli: this.keyring.cli
        ? this.keyring.cli.status()
        : { enabled: false, ready: false, model: '', message: '' },
      usage,
      skillLabels: Object.fromEntries(Object.entries(SKILLS).map(([id, [name]]) => [id, name])),
      attributeLabels: ATTRIBUTES,
      pauseReason: state.pauseReason || null,
      heroes: Object.entries(state.heroes).map(([id, sheet]) => ({ seat: id, ...clone(sheet) })),
      clues: state.clues.map((id) => ({ id, ...getScenario(state).CLUES[id] })),
      journal: state.journal,
      rolls: state.rolls,
      pending,
      offer,
      check,
      sanity: san
        ? {
            id: san.id,
            actor: san.actor,
            reason: san.reason,
            status: san.status,
            ...(san.status === 'rolled' ? { result: clone(san.result) } : {}),
          }
        : null,
      combat: this.combat.project(state),
      actions:
        state.status === 'playing'
          ? this.actionsFor(room, state)
              .filter((a) => !a.actorOnly || a.actorOnly === seat)
              .map(({ id, label, minutes, confirm, risk }) => ({
                id,
                label,
                minutes,
                confirm: !!confirm,
                risk: risk || '',
              }))
          : [],
      destinations: state.status === 'playing' ? destinations(state) : [],
      result: state.result,
      session: state.session,
      recovery: this.pendingRecovery(room, state).length
        ? { session: state.session, pending: this.pendingRecovery(room, state) }
        : null,
      development: Object.entries(state.developmentChecks || {}).map(([actor, item]) => ({
        actor,
        status: item.status,
        skills: item.skills,
      })),
    };
  }
  schedule(room) {
    if (this.closing || this.tutorial || !room.campaignId) return;
    const state = this.state(room),
      p = state.pending;
    if (!p || p.status !== 'queued') return;
    if (p.stage === 'intent' && state.status !== 'playing') return;
    const key = room.campaignId + ':' + p.id;
    if (this.jobs.has(key)) return;
    const job = new Promise((resolve) => setImmediate(resolve))
      .then(() => this.dispatch(room, p.id))
      .catch(() => {})
      .finally(() => this.jobs.delete(key));
    this.jobs.set(key, job);
  }
  async dispatch(room, operation) {
    const state = this.state(room),
      pending = state.pending;
    if (
      !pending ||
      pending.id !== operation ||
      pending.status !== 'queued' ||
      this.closing ||
      (pending.stage === 'intent' && state.status !== 'playing')
    )
      return;
    let credentials;
    const controller = new AbortController();
    this.controllers.set(operation, controller);
    const ids = (pending.actions || []).map((a) => a.id);
    const recent = state.journal
      .filter((e) => ['intent', 'keeper', 'action', 'scene', 'clue'].includes(e.kind))
      .slice(-8)
      .map((e) => ({ kind: e.kind, text: e.text }));
    const request =
      pending.stage === 'intent'
        ? intentRequest({
            scene: sceneFor(state),
            actor: {
              name: this.hero(state, pending.actor).name,
              equipment: this.hero(state, pending.actor).equipment,
            },
            intent: pending.intent,
            context: pending.context || null,
            actions: pending.actions,
            knownClues: state.clues.map((id) => getScenario(state).CLUES[id]),
            recent,
          })
        : narrationRequest({
            scene: sceneFor(state),
            facts: pending.facts,
            ...(pending.roleplay
              ? {
                  dialogue: pending.roleplay,
                  publicKnowledge: state.clues.map((id) => getScenario(state).CLUES[id]),
                }
              : {}),
            recent,
          });
    const estimate =
      Buffer.byteLength(JSON.stringify(request), 'utf8') +
      request.maxTokens +
      (state.ai.source === 'cli' ? 16000 : 0);
    let call;
    try {
      credentials = this.keyring.resolve(
        this.account(room, room.host),
        state.ai.source,
        state.ai.provider,
      );
      transaction(this.db, () => {
        const prior = this.db
          .prepare(
            "SELECT * FROM coc_ai_calls WHERE campaign_id=? AND (operation_id=? OR operation_id LIKE ?) AND stage=? AND status='completed' ORDER BY created_at DESC LIMIT 1",
          )
          .get(room.campaignId, operation, operation + '#%', pending.stage);
        if (prior) {
          call = prior;
          return;
        }
        const used = this.db
          .prepare(
            'SELECT COALESCE(SUM(reserved_tokens),0) n FROM coc_ai_calls WHERE campaign_id=?',
          )
          .get(room.campaignId).n;
        if (used + estimate > state.ai.tokenLimit)
          fail('COC_AI_BUDGET', '本冒險的 AI token 上限已到，請房主在暫停後調整或更換費用來源');
        if (credentials.scope === 'station') {
          const usedToday = this.db
            .prepare(
              "SELECT COALESCE(SUM(reserved_tokens),0) n FROM coc_ai_calls WHERE key_scope='station' AND created_at>=?",
            )
            .get(stamp().slice(0, 10) + 'T00:00:00.000Z').n;
          const limit = this.keyring.environment?.stationTokensPerDay || 500000;
          if (usedToday + estimate > limit)
            fail(
              'COC_STATION_BUDGET',
              '站方今日的 AI 額度已到，請房主暫停後改用本人金鑰，或稍後繼續',
            );
        }
        const at = stamp();
        const attempts = this.db
          .prepare(
            'SELECT count(*) n FROM coc_ai_calls WHERE campaign_id=? AND (operation_id=? OR operation_id LIKE ?) AND stage=?',
          )
          .get(room.campaignId, operation, operation + '#%', pending.stage).n;
        call = { id: uid(), status: 'reserved' };
        this.db
          .prepare(
            'INSERT INTO coc_ai_calls(id,campaign_id,operation_id,stage,provider,model,payer_id,key_scope,status,reserved_tokens,request_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .run(
            call.id,
            room.campaignId,
            operation + '#' + (attempts + 1),
            pending.stage,
            credentials.provider,
            credentials.model,
            credentials.ownerId,
            credentials.scope,
            'reserved',
            estimate,
            JSON.stringify({
              operationId: operation,
              transport: credentials.transport || 'api',
              ...(credentials.cliMode ? { cliMode: credentials.cliMode } : {}),
              request,
            }),
            at,
            at,
          );
        const row = this.row(room.campaignId),
          next = JSON.parse(row.state_json);
        if (next.pending?.id === operation) {
          next.pending.status = 'running';
          this.write(room, row, next, 'ai-request');
        }
      });
      this.changed(room);
      const result =
        call.status === 'completed'
          ? JSON.parse(call.result_json)
          : await structuredCall(credentials, { ...request, signal: controller.signal });
      transaction(this.db, () => {
        if (call.status !== 'completed')
          this.db
            .prepare(
              "UPDATE coc_ai_calls SET status='completed',reserved_tokens=?,input_tokens=?,output_tokens=?,result_json=?,updated_at=? WHERE id=?",
            )
            .run(
              result.usage.input !== null && result.usage.output !== null
                ? result.usage.input + result.usage.output
                : estimate,
              result.usage.input ?? 0,
              result.usage.output ?? 0,
              JSON.stringify(result),
              stamp(),
              call.id,
            );
        const row = this.row(room.campaignId),
          next = JSON.parse(row.state_json);
        if (next.pending?.id !== operation) return;
        if (pending.stage === 'intent') {
          if (next.status !== 'playing') {
            // The completed call is durable above. Resume reuses it without another model call.
            next.pending.status = 'queued';
            this.write(room, row, next, 'ai-deferred');
            return;
          }
          const id = result.value.actionId;
          if (![...ids, 'clarify', 'roleplay', 'improvise'].includes(id))
            fail('COC_AI_OUTPUT', 'AI 意圖格式不正確', 503);
          const clarification = text(result.value.clarification || '', 500, true);
          const narration = text(result.value.narration || '', 2000, true);
          next.pending = null;
          if (id === 'clarify' && !pending.context) {
            const question = shortReply(clarification || '你要對哪個對象做什麼？');
            next.intentContext ??= {};
            next.intentContext[pending.actor] = {
              intent: pending.intent,
              question,
              scene: next.scene,
            };
            this.log(next, 'keeper', question);
          } else {
            if (next.intentContext) delete next.intentContext[pending.actor];
            if (id === 'clarify')
              this.log(
                next,
                'keeper',
                shortReply(
                  narration && !/[？?]/u.test(narration)
                    ? narration
                    : '目前缺少可執行的具體對象，這次嘗試沒有改變局面。',
                ),
              );
            else if (id === 'roleplay') {
              if (narration) this.log(next, 'keeper', shortReply(narration));
              else
                this.narrate(
                  next,
                  pending.actor,
                  ['這次交談不改動調查成果、資源或時間。'],
                  pending.intent,
                );
            } else if (id === 'improvise') {
              if (!narration || !['minor', 'blocked'].includes(result.value.consequence))
                fail('COC_AI_OUTPUT', '主持裁定格式不正確', 503);
              if (result.value.consequence === 'minor') {
                this.advance(next, 1);
                next.sessionActions++;
                if (!next.result) {
                  if (getScenario(next).interrupted?.(next, { effect: 'improvise' }))
                    this.narrate(next, pending.actor, [
                      '期限在小動作完成前到達，請處理已出現的威脅。',
                    ]);
                  else this.log(next, 'keeper', shortReply(narration));
                }
              } else this.log(next, 'keeper', shortReply(narration));
            } else {
              const action = this.intentActions(room, next, pending.actor).find((a) => a.id === id);
              if (!action) fail('COC_STALE', '局面已變，請重新提出行動');
              this.propose(room, next, pending.actor, action);
            }
          }
        } else {
          this.log(next, 'keeper', shortReply(result.value.narration));
          next.pending = null;
        }
        this.pauseForReplacement(room, next);
        this.write(room, row, next, 'ai-result');
      });
    } catch (error) {
      transaction(this.db, () => {
        const code =
          typeof error.code === 'string' && error.code.startsWith('COC_')
            ? error.code
            : 'COC_AI_UNCERTAIN';
        if (call && call.status !== 'completed') {
          const rejected = ['COC_AI_CREDENTIALS', 'COC_AI_LIMIT'].includes(code);
          this.db
            .prepare(
              'UPDATE coc_ai_calls SET status=?,reserved_tokens=CASE WHEN ? THEN 0 ELSE reserved_tokens END,error_code=?,updated_at=? WHERE id=?',
            )
            .run(rejected ? 'failed' : 'uncertain', rejected ? 1 : 0, code, stamp(), call.id);
        }
        const row = this.row(room.campaignId),
          next = JSON.parse(row.state_json);
        if (next.pending?.id !== operation) return;
        next.pending.status = code === 'COC_AI_UNCERTAIN' ? 'uncertain' : 'failed';
        next.pending.error = error.code?.startsWith('COC_')
          ? error.message
          : 'AI 暫時無法回覆，已保存的遊戲結果不變。';
        this.write(room, row, next, 'ai-error');
      });
    } finally {
      this.controllers.delete(operation);
      this.changed(room);
      this.schedule(room);
    }
  }
  async close() {
    this.closing = true;
    for (const c of this.controllers.values()) c.abort();
    await Promise.allSettled([...this.jobs.values()]);
  }
}
module.exports = { CocCampaignStore };
