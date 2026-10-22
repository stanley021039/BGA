'use strict';
const { randomUUID } = require('node:crypto');
const { PartyRoom, fail, clone, text } = require('./party-base'),
  { QUESTIONS } = require('./bluff-catalog');
class BluffRoom extends PartyRoom {
  constructor(code, name, rng, now) {
    super('bluff', code, name, 9, 3, rng, now);
    this.options = { levels: [1, 2, 3], roleSeconds: 30 };
    this.deadline = null;
    this.botMemories = {};
    this.sequence = [];
    this.roles = {};
    this.readyIds = [];
    this.spokenIds = [];
    this.challenges = [];
    this.botStatements = {};
    this.botStatementAt = {};
    this.thinkerId = null;
    this.question = null;
    this.choices = [];
    this.banBallots = {};
    this.reactions = [];
    this.reactionTimes = {};
    this.captions = {};
    this.transcript = [];
  }
  offeredChoices() {
    const seen = new Set();
    return [...this.choices, ...(this.spareQuestions || [])]
      .filter((q) => this.available(q) && !seen.has(q.id) && seen.add(q.id))
      .slice(0, 3);
  }
  available(q) {
    return !this.questionExclusionProvider?.(q.id);
  }
  configure(id, data) {
    if (id !== this.host) fail('HOST_ONLY', '只有房主可以設定', 403);
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '開始後不能改難度');
    const levels = data.levels === undefined ? this.options.levels : data.levels,
      roleSeconds = data.roleSeconds === undefined ? this.options.roleSeconds : data.roleSeconds;
    if (![10, 30, 60].includes(roleSeconds))
      fail('INVALID_ROLE_SECONDS', '看身分時間只能選 10 秒、30 秒或 1 分鐘', 400);
    if (
      !Array.isArray(levels) ||
      !levels.length ||
      levels.length > 3 ||
      new Set(levels).size !== levels.length ||
      levels.some((n) => ![1, 2, 3].includes(n))
    )
      fail('INVALID_LEVELS', '請選 1–3 級難度', 400);
    if (
      QUESTIONS.filter((q) => levels.includes(q.level) && this.available(q)).length <
      this.activePlayers().length + 2
    )
      fail('NOT_ENOUGH_QUESTIONS', '未禁用題數不足三選一', 400);
    this.options = { levels: levels.slice(), roleSeconds };
    this.event('settings', '更新題目難度與看身分時間');
  }
  index(n) {
    const i = this.rng(n);
    if (!Number.isInteger(i) || i < 0 || i >= n) throw Error('無效抽題結果');
    return i;
  }
  start() {
    const pool = QUESTIONS.filter(
        (q) => this.options.levels.includes(q.level) && this.available(q),
      ),
      seats = this.activePlayers().map((p) => p.id),
      count = seats.length;
    if (count < 3) fail('NEED_PLAYERS', '至少 3 人，可加入測試 AI', 400);
    if (pool.length < count + 2) fail('NOT_ENOUGH_QUESTIONS', '未禁用題數不足三選一', 400);
    const sequence = [];
    while (sequence.length < count) sequence.push(pool.splice(this.index(pool.length), 1)[0]);
    const honestSeats = sequence.map(() => this.index(count - 1)),
      first = this.index(count),
      thinkerOrder = seats.slice(first).concat(seats.slice(0, first));
    this.prepare();
    this.players.forEach((p) => (p.score = 3));
    this.sequence = sequence;
    this.spareQuestions = pool;
    this.honestSeats = honestSeats;
    this.thinkerOrder = thinkerOrder;
    this.banBallots = {};
    this.reactions = [];
    this.reactionTimes = {};
    this.roundLimit = count;
    this.nextRound();
  }
  nextRound() {
    const next = this.round + 1,
      choices = [this.sequence[next - 1], ...this.spareQuestions]
        .filter((q) => this.available(q))
        .slice(0, 3);
    if (choices.length < 3) fail('NOT_ENOUGH_QUESTIONS', '剩餘未禁用題目不足三選一', 400);
    this.round = next;
    this.roundId = randomUUID();
    this.question = null;
    this.choices = choices;
    this.thinkerId = this.thinkerOrder[this.round - 1];
    const others = this.players.filter((p) => p.id !== this.thinkerId),
      honest = others[this.honestSeats[this.round - 1]].id;
    this.roles = Object.fromEntries(
      this.players.map((p) => [
        p.id,
        p.id === this.thinkerId ? 'thinker' : p.id === honest ? 'honest' : 'bluffer',
      ]),
    );
    this.readyIds = [];
    this.spokenIds = [];
    this.challenges = [];
    this.botStatements = {};
    this.botStatementAt = {};
    this.captions = {};
    this.transcript = [];
    this.phase = 'selecting';
    this.deadline = null;
    this.botMemories = {};
    this.event('round', '第 ' + this.round + ' 輪：想想三選一抽題。');
  }
  act(id, action, data = {}) {
    return this.command(id, action, data, (p) => {
      if (action === 'choose') {
        if (this.phase !== 'selecting') fail('INVALID_PHASE', '現在不能選題');
        if (id !== this.thinkerId) fail('THINKER_ONLY', '只有想想可以選題', 403);
        const q = this.offeredChoices().find((q) => q.id === data.questionId);
        if (!q) fail('INVALID_QUESTION', '題目已禁用或不是本輪選項', 400);
        const primary = this.sequence[this.round - 1];
        this.spareQuestions = this.spareQuestions.filter((v) => v.id !== q.id);
        if (primary.id !== q.id && this.available(primary)) this.spareQuestions.push(primary);
        this.sequence[this.round - 1] = q;
        this.question = q;
        this.choices = [];
        this.phase = 'preparing';
        this.deadline = this.now() + this.options.roleSeconds * 1000;
        this.botMemories = Object.fromEntries(
          this.players.filter((p) => p.bot).map((p) => [p.id, this.view(p.id).secretAnswer]),
        );
        this.event('choose', '題目已選定，查看自己的角色。');
      } else if (action === 'ban') {
        if (!['reveal', 'finished'].includes(this.phase) || this.interrupted)
          fail('INVALID_PHASE', '揭曉後才能投票');
        if (p.bot) fail('HUMAN_ONLY', '測試 AI 不參與禁題', 403);
        const ballot = this.banBallots[data.resultId];
        if (!ballot || !ballot.electorate.includes(id))
          fail('INVALID_BALLOT', '不是此輪投票玩家', 403);
        if (ballot.votes.includes(id) || ballot.banned) return;
        const votes = [...ballot.votes, id];
        if (votes.length >= ballot.required) {
          if (!this.questionBanWriter) fail('BAN_UNAVAILABLE', '暫時無法儲存禁題', 503);
          this.questionBanWriter(ballot.questionId, {
            roomCode: this.code,
            resultId: data.resultId,
            electorate: ballot.electorate,
            votes,
            required: ballot.required,
          });
          ballot.banned = true;
        }
        ballot.votes = votes;
        this.event('ban', ballot.banned ? '此題已全站禁用' : p.name + ' 投票禁用此題');
      } else if (action === 'reaction') {
        if (this.phase !== 'discussion') fail('INVALID_PHASE', '口說期間才能反應');
        if (p.bot) fail('REACTION_ONLY', '測試 AI 不使用反應音效', 403);
        if (this.reactionTimes[id] != null && this.now() - this.reactionTimes[id] < 5000)
          fail('REACTION_COOLDOWN', '請等 5 秒再反應', 429);
        this.reactionTimes[id] = this.now();
        this.reactions.push({
          id: randomUUID(),
          name: p.name,
          text: '質疑你',
          at: this.now(),
          roundId: this.roundId,
        });
        this.reactions = this.reactions.slice(-12);
        this.event('reaction', p.name + ' 質疑你');
      } else if (action === 'ready') {
        if (this.phase !== 'preparing' || this.now() >= this.deadline)
          fail('INVALID_PHASE', '看身分時間已結束');
        if (this.readyIds.includes(id)) fail('ALREADY_READY', '已準備');
        this.readyIds.push(id);
        this.event('ready', p.name + ' 已準備');
        if (this.readyIds.length === this.players.length) this.beginDiscussion();
      } else if (action === 'spoken') {
        if (this.phase !== 'discussion' || id === this.thinkerId)
          fail('INVALID_PHASE', '只有解釋者能標記說明完畢');
        if (this.spokenIds.includes(id)) fail('ALREADY_SPOKEN', '已標記');
        if (p.bot) {
          const statement = text(data.text, 240);
          if (!statement) fail('INVALID_TEXT', '測試說詞不可空白', 400);
          this.botStatements[id] = statement;
          this.botStatementAt[id] = this.now();
        }
        this.spokenIds.push(id);
        this.event('spoken', p.name + ' 已說明');
      } else if (action === 'challenge') {
        this.requireThinker(id);
        this.target(data.targetId);
        if (this.challenges.includes(data.targetId) || this.challenges.length >= 2)
          fail('NO_CHALLENGE', '每輪最多兩張，且不能重複質疑同一人');
        this.challenges.push(data.targetId);
        this.event('challenge', '想想質疑 ' + this.player(data.targetId).name + '：公三小！');
      } else if (action === 'guess') {
        this.requireThinker(id);
        const target = this.target(data.targetId);
        if (this.spokenIds.length !== this.players.length - 1)
          fail('NOT_READY', '請等每位解釋者標記說明完畢');
        if (data.confirmed !== true) fail('CONFIRM_REQUIRED', '請確認你的選擇', 400);
        const honest = this.players.find((q) => this.roles[q.id] === 'honest'),
          thinker = this.player(this.thinkerId),
          deltas = Object.fromEntries(this.players.map((q) => [q.id, 0]));
        if (target.id === honest.id) {
          deltas[thinker.id] += this.question.level;
          deltas[honest.id] += this.question.level;
        } else deltas[target.id] += this.question.level;
        for (const challenged of this.challenges) {
          if (challenged === honest.id) deltas[thinker.id] -= 3;
          else {
            deltas[challenged]--;
            deltas[thinker.id]++;
          }
        }
        this.players.forEach((q) => (q.score += deltas[q.id]));
        const resultId = this.roundId,
          electorate = this.activePlayers()
            .filter((q) => !q.bot)
            .map((q) => q.id);
        this.banBallots[resultId] = {
          questionId: this.question.id,
          electorate,
          votes: [],
          required: Math.floor(electorate.length / 2) + 1,
          banned: false,
        };
        this.results.push({
          resultId,
          questionId: this.question.id,
          round: this.round,
          title: this.question.title,
          level: this.question.level,
          answer: this.question.answer,
          explanation: this.question.explanation,
          source: this.question.source,
          thinkerName: thinker.name,
          honestName: honest.name,
          selectedName: target.name,
          correct: target.id === honest.id,
          challenges: this.challenges.map((pid) => this.player(pid).name),
          // Everyone's words in the order they were said, script partners included.
          transcript: [
            ...this.transcript,
            ...Object.entries(this.botStatements).map(([pid, statement]) => ({
              name: this.player(pid)?.name || 'AI',
              text: statement,
              at: this.botStatementAt[pid] ?? 0,
            })),
          ]
            .sort((a, b) => a.at - b.at)
            .map((e) => ({ name: e.name, text: e.text })),
          roles: this.players.map((q) => ({
            name: q.name,
            role: this.roles[q.id],
            delta: deltas[q.id],
            score: q.score,
          })),
        });
        this.deadline = null;
        this.botMemories = {};
        this.phase = 'reveal';
        this.event('reveal', '老實人是 ' + honest.name + '，本輪已計分。');
        if (this.round === this.roundLimit) this.finish();
      } else if (action === 'next') {
        if (id !== this.host) fail('HOST_ONLY', '只有房主可以換輪', 403);
        if (this.phase !== 'reveal') fail('INVALID_PHASE', '先完成本輪');
        this.nextRound();
      } else fail('INVALID_ACTION', '不支援的操作', 400);
    });
  }
  // Live subtitles from the speaker's own browser speech recognizer. They stay in
  // memory, outside the action history; final lines join this round's speech
  // log, which is kept with the round result.
  caption(id, data) {
    const p = this.player(id);
    if (!p) fail('NOT_SEATED', '尚未入座', 403);
    if (p.bot) fail('HUMAN_ONLY', '測試 AI 不使用語音', 403);
    if (this.phase !== 'discussion') fail('INVALID_PHASE', '口說階段才能錄製發言');
    if (data.roundId !== this.roundId) fail('STALE_ROUND', '已換輪，請更新畫面');
    if (typeof data.utteranceId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(data.utteranceId))
      fail('INVALID_UTTERANCE', '發言識別碼不正確', 400);
    if (
      typeof data.final !== 'boolean' ||
      (data.text !== undefined && typeof data.text !== 'string')
    )
      fail('INVALID_CAPTION', '字幕格式不正確', 400);
    const line = String(data.text || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (!line) {
      if (this.captions[id]?.utteranceId === data.utteranceId) delete this.captions[id];
      return;
    }
    this.captions[id] = {
      utteranceId: data.utteranceId,
      text: line,
      final: data.final,
      at: this.now(),
    };
    if (!data.final) return;
    const known = this.transcript.find((e) => e.id === data.utteranceId && e.playerId === id);
    if (known) known.text = line;
    else if (this.transcript.length < 120)
      this.transcript.push({
        id: data.utteranceId,
        playerId: id,
        name: p.name,
        text: line,
        at: this.now(),
      });
  }
  beginDiscussion() {
    this.phase = 'discussion';
    this.deadline = null;
    this.event('discussion', '看身分結束，輪流解釋與質問；想想最後選一位老實人。');
  }
  auto() {
    if (this.phase === 'preparing' && this.deadline != null && this.now() >= this.deadline)
      this.beginDiscussion();
  }
  requireThinker(id) {
    if (this.phase !== 'discussion') fail('INVALID_PHASE', '現在不能判斷');
    if (id !== this.thinkerId) fail('THINKER_ONLY', '只有想想可以判斷', 403);
  }
  target(id) {
    const p = this.player(id);
    if (!p || id === this.thinkerId) fail('INVALID_TARGET', '請選另一位解釋者', 400);
    return p;
  }
  view(id) {
    const base = this.baseView(id),
      active = ['preparing', 'discussion'].includes(this.phase),
      role = this.phase === 'preparing' && this.now() < this.deadline ? this.roles[id] : null,
      q = this.question;
    return clone({
      ...base,
      results: this.results.map((r) => {
        const b = this.banBallots[r.resultId];
        return {
          ...r,
          ban: b
            ? {
                votes: b.votes.length,
                required: b.required,
                banned: b.banned || !this.available({ id: r.questionId }),
                voted: b.votes.includes(id),
                canVote:
                  b.electorate.includes(id) &&
                  ['reveal', 'finished'].includes(this.phase) &&
                  !this.interrupted,
              }
            : null,
        };
      }),
      choices:
        this.phase === 'selecting' && id === this.thinkerId
          ? this.offeredChoices().map((q) => ({ id: q.id, title: q.title, level: q.level }))
          : [],
      reactions: this.reactions.filter(
        (r) => r.roundId === this.roundId && this.now() - r.at < 6000,
      ),
      options: this.options,
      deadline: this.deadline,
      serverNow: this.now(),
      thinkerId: this.thinkerId,
      myRole: role,
      secretAnswer: active && role === 'honest' ? q.answer : null,
      secretExplanation: active && role === 'honest' ? q.explanation : null,
      prompt: active
        ? {
            title: q.title,
            level: q.level,
            hints:
              q.level === 1
                ? [q.category]
                : q.level === 2
                  ? [...new Set(QUESTIONS.map((q) => q.category))]
                      .filter(
                        (c) =>
                          c === q.category ||
                          ['氣象', '動物', '天文']
                            .filter((c) => c !== q.category)
                            .slice(0, 2)
                            .includes(c),
                      )
                      .sort()
                  : [],
          }
        : null,
      // Subtitles last six seconds; the speech log is public while people talk.
      captions:
        this.phase === 'discussion'
          ? Object.entries(this.captions)
              .filter(([pid, c]) => this.player(pid) && this.now() - c.at < 6000)
              .map(([playerId, c]) => ({ playerId, text: c.text, final: c.final }))
          : [],
      transcript:
        this.phase === 'discussion'
          ? this.transcript
              .filter((e) => this.player(e.playerId))
              .map((e) => ({ id: e.id, playerId: e.playerId, name: e.name, text: e.text }))
          : [],
      readyIds: this.readyIds,
      spokenIds: this.spokenIds,
      challenges: this.challenges,
      botStatements: this.botStatements,
      canGuess:
        this.phase === 'discussion' &&
        id === this.thinkerId &&
        this.spokenIds.length === this.players.length - 1,
    });
  }
}
module.exports = { BluffRoom };
