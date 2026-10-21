'use strict';
const { randomUUID } = require('node:crypto');
const copy = (v) => JSON.parse(JSON.stringify(v)),
  MODES = new Set(['music', 'scenario']),
  BRACKET_SIZES = Object.freeze([8, 16, 32, 64, 128, 256]);
function normalizeTheme(mode, theme) {
  const aliases = require('./musicquiz-library').BANK_ALIASES;
  return mode === 'music' && Object.hasOwn(aliases, theme) ? aliases[theme] : theme;
}
function themes(mode) {
  if (mode === 'scenario') {
    const { SCENARIO_BANKS, SCENARIOS } = require('./majority-scenarios');
    return [
      {
        id: 'daily-mix',
        label: '生活雷點綜合',
        prompt: '這兩種生活情境，猜大家比較受不了哪一種？',
        count: SCENARIOS.filter((s) => !['powers', 'food'].includes(s.bank)).length,
      },
      ...SCENARIO_BANKS.map((b) => ({
        ...b,
        count: SCENARIOS.filter((s) => s.bank === b.id).length,
      })),
    ];
  }
  const { CATALOG, BANKS } = require('./musicquiz-library');
  const songs = CATALOG.filter((s) => s.aiGenerated === false && s.familiarity !== 'obscure');
  return [
    { id: 'all', label: '熱門歌曲綜合', count: songs.length },
    ...BANKS.filter((b) => b.id !== 'custom').map((b) => ({
      ...b,
      count: songs.filter((s) => s.bank === b.id).length,
    })),
    ...Array.from(new Set(songs.flatMap((s) => s.genres)))
      .sort()
      .map((g) => ({
        id: 'genre:' + g,
        label: g,
        count: songs.filter((s) => s.genres.includes(g)).length,
      })),
  ].filter((b) => b.count >= 8);
}
function pool(mode, theme) {
  theme = normalizeTheme(mode, theme);
  if (mode === 'scenario')
    return require('./majority-scenarios').SCENARIOS.filter((s) =>
      theme === 'daily-mix' ? !['powers', 'food'].includes(s.bank) : s.bank === theme,
    );
  const { CATALOG } = require('./musicquiz-library');
  return CATALOG.filter(
    (s) =>
      s.aiGenerated === false &&
      s.familiarity !== 'obscure' &&
      (theme === 'all' ||
        s.bank === theme ||
        (theme.startsWith('genre:') && s.genres.includes(theme.slice(6)))),
  ).map((s) => ({
    id: s.id,
    label: s.title,
    detail: s.artist,
    bank: s.bank,
    videoId: s.videoId,
    source: s.source,
    image: '/assets/playful/game-musicquiz.svg',
  }));
}
function validate(mode, theme, size) {
  theme = normalizeTheme(mode, theme);
  if (!themes(mode).some((b) => b.id === theme) || !BRACKET_SIZES.includes(size))
    throw Error('請選擇有效的主題與 8／16／32／64／128／256 強');
  if (pool(mode, theme).length < size) throw Error('此主題數量不足，請縮小賽程或更換主題');
}
const methods = {
  isTournament() {
    return MODES.has(this.options.mode);
  },
  initTournament() {
    validate(this.options.mode, this.options.theme, this.options.bracketSize);
    const entries = pool(this.options.mode, this.options.theme).map(copy),
      chosen = [];
    while (chosen.length < this.options.bracketSize)
      chosen.push(entries.splice(this.rng(entries.length), 1)[0]);
    this.roundLimit = chosen.length - 1;
    this.tournamentState = {
      size: chosen.length,
      level: chosen,
      next: [],
      pair: 0,
      stage: chosen.length,
      eliminated: [],
      champion: null,
    };
    this.questionQueue = [];
  },
  nextTournamentQuestion() {
    const t = this.tournamentState,
      entries = t.level.slice(t.pair * 2, t.pair * 2 + 2);
    if (entries.length !== 2) throw Error('賽程配對不完整');
    const bank =
      this.options.mode === 'scenario'
        ? themes('scenario').find((b) => b.id === this.options.theme)
        : null;
    this.question = {
      id: randomUUID(),
      stage: t.stage,
      pair: t.pair + 1,
      topic: this.options.mode,
      type: 'two',
      prompt:
        this.options.mode === 'music'
          ? '這兩首歌，猜大家會選哪一首？'
          : bank?.prompt || '這兩個情境，猜大家會選哪一個？',
      options: entries.map((x) => x.label),
      entries: copy(entries),
      images: entries.map((x) => x.image),
    };
    this.topic = this.options.mode;
    this.questionType = 'two';
    this.phase = 'answering';
    this.deadline = Date.now() + 120000;
    this.event(
      'ask',
      t.stage === 2
        ? '冠軍決選，請秘密投票'
        : t.stage + ' 強・第 ' + (t.pair + 1) + ' 組，請秘密投票',
    );
  },
  scoreTournament() {
    if (this.phase !== 'answering' || !this.tournamentState || this.result)
      throw Error('本題已結算');
    const counts = [0, 0];
    for (const g of this.groups) counts[Number(g.key)] = g.count;
    if (counts[0] + counts[1] === 0) throw Error('至少需要一人投票才能結束');
    const tied = counts[0] === counts[1],
      win = tied ? this.rng(2) : counts[0] > counts[1] ? 0 : 1,
      gains = Object.fromEntries(this.players.map((p) => [p.id, 0]));
    for (const g of this.groups) {
      g.winner = !tied && Number(g.key) === win;
      if (g.winner)
        for (const id of g.playerIds) {
          gains[id] = 1;
          this.player(id).score++;
        }
    }
    const t = this.tournamentState,
      entry = this.question.entries[win],
      loser = this.question.entries[1 - win];
    t.eliminated.push({ ...copy(loser), rank: t.stage / 2 + 1 });
    t.next.push(copy(entry));
    t.pair++;
    if (t.next.length === t.stage / 2) {
      if (t.stage === 2) t.champion = copy(entry);
      else {
        t.level = t.next;
        t.next = [];
        t.pair = 0;
        t.stage /= 2;
      }
    }
    this.phase = 'reveal';
    this.deadline = null;
    this.result = {
      points: tied ? 0 : 1,
      presenterPenalty: 0,
      round: this.round,
      groups: copy(this.groups),
      answers: copy(this.answers),
      gains,
      missingIds: this.participantIds.filter((id) => !Object.hasOwn(this.answers, id)),
      reason: this.closedReason,
      tournament: {
        advanced: copy(entry),
        eliminated: copy(loser),
        tied,
        counts,
        decidedBy: tied ? 'draw' : 'votes',
      },
    };
    this.event(
      'reveal',
      tied
        ? '平票不加分，抽籤由「' + entry.label + '」晉級'
        : '「' + entry.label + '」晉級，選到多數的玩家各得 1 分',
    );
    this.completeAchievementUnit('rules_completed');
  },
  tournamentView() {
    if (!this.isTournament()) return null;
    const t = ['waiting'].includes(this.phase) ? null : this.tournamentState,
      visible = ['reveal', 'finished'].includes(this.phase),
      scores = this.activePlayers()
        .filter((p) => !p.waitingForNextRound)
        .map((p) => ({ id: p.id, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score);
    return {
      mode: this.options.mode,
      themes: themes(this.options.mode),
      size: this.options.bracketSize,
      stage: this.question?.stage || t?.stage || this.options.bracketSize,
      pair: this.question?.pair || (t?.pair || 0) + 1,
      champion: t?.champion && visible ? copy(t.champion) : null,
      ranking: scores.map((p) => ({
        ...p,
        rank: 1 + scores.filter((x) => x.score > p.score).length,
      })),
      entryRanking:
        this.phase === 'finished' && t?.champion
          ? [
              { ...copy(t.champion), rank: 1 },
              ...copy(t.eliminated).sort((a, b) => a.rank - b.rank),
            ]
          : [],
      completed: this.phase === 'finished',
    };
  },
};
module.exports = { MODES, BRACKET_SIZES, themes, pool, validate, normalizeTheme, methods };
