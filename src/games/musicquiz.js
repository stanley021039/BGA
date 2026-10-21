'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { PartyRoom, fail, clone, text, normalize } = require('./party-base');
const { CATALOG, BANKS, BANK_ALIASES } = require('./musicquiz-library');
const { builtinFrameDescriptor } = require('../barrage/builtins');
const card = (s) => ({
  id: s.id,
  title: s.title,
  language: s.language || s.bank,
  artist: s.artist,
  year: s.year,
  genres: s.genres,
  bank: s.bank,
  yearBasis: s.yearBasis || 'first-release',
  source: s.source,
});
class MusicQuizRoom extends PartyRoom {
  constructor(code, name, rng, now) {
    super('musicquiz', code, name, 8, 1, rng, now);
    Object.assign(this, {
      settings: {
        banks: ['zh', 'tw', 'jp', 'kr', 'yue', 'viral', 'en', 'foreign'],
        genres: [],
        target: 10,
        introSeconds: 8,
        obscure: false,
      },
      customSongs: [],
      sequence: [],
      cursor: 0,
      current: null,
      djIndex: 0,
      answers: {},
      introChoices: [],
      correctChoiceId: null,
      challenges: {},
      passed: [],
      placement: null,
      deadline: null,
    });
  }
  random(n) {
    const x = this.rng(n);
    if (!Number.isInteger(x) || x < 0 || x >= n) throw Error('無效抽曲結果');
    return x;
  }
  configure(id, data) {
    if (id !== this.host) fail('HOST_ONLY', '只有房主可以設定', 403);
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '本局已開始');
    const next = { ...this.settings };
    let custom = this.customSongs;
    if (data.banks !== undefined) {
      if (!Array.isArray(data.banks) || !data.banks.length || data.banks.length > 32)
        fail('INVALID_SETTINGS', '請選擇有效題庫', 400);
      const mapped = data.banks.map((id) =>
        Object.hasOwn(BANK_ALIASES, id) ? BANK_ALIASES[id] : id,
      );
      if (mapped.some((id) => !BANKS.some((b) => b.id === id)))
        fail('INVALID_SETTINGS', '請選擇有效題庫', 400);
      next.banks = [...new Set(mapped)];
    }
    if (data.genres !== undefined) {
      if (
        !Array.isArray(data.genres) ||
        data.genres.length > 25 ||
        data.genres.some((x) => typeof x !== 'string' || x.length > 20)
      )
        fail('INVALID_SETTINGS', '曲風格式不正確', 400);
      next.genres = [...new Set(data.genres)];
    }
    if (data.target !== undefined) {
      if (!Number.isInteger(data.target) || data.target < 3 || data.target > 10)
        fail('INVALID_SETTINGS', '目標為3–10張', 400);
      next.target = data.target;
    }
    if (data.obscure !== undefined) {
      if (typeof data.obscure !== 'boolean') fail('INVALID_SETTINGS', '冷門設定不正確', 400);
      next.obscure = data.obscure;
    }
    if (data.customSongs !== undefined) {
      if (!Array.isArray(data.customSongs) || data.customSongs.length > 200)
        fail('INVALID_SONGS', '自建題庫最多200首', 400);
      custom = data.customSongs.map((s, i) => {
        if (
          !s ||
          s.aiGenerated !== false ||
          !Number.isInteger(s.year) ||
          s.year < 1600 ||
          s.year > new Date(this.now()).getUTCFullYear() ||
          typeof s.videoId !== 'string' ||
          !/^[a-zA-Z0-9_-]{11}$/.test(s.videoId)
        )
          fail('INVALID_SONGS', '第' + (i + 1) + '首需有效年份、影片及非AI確認', 400);
        const introStart = s.introStart ?? 0,
          highlightStart = s.highlightStart ?? 60;
        if (![introStart, highlightStart].every((n) => Number.isFinite(n) && n >= 0 && n <= 21600))
          fail('INVALID_SONGS', '片段秒數不正確', 400);
        return {
          id:
            'custom-' +
            createHash('sha256')
              .update(s.videoId + ':' + introStart)
              .digest('hex')
              .slice(0, 16),
          bank: 'custom',
          title: text(s.title),
          artist: text(s.artist),
          year: s.year,
          videoId: s.videoId,
          introStart,
          highlightStart,
          aliases: [],
          artistAliases: [],
          genres: ['自選'],
          aiGenerated: false,
          familiarity: s.familiarity === 'obscure' ? 'obscure' : 'familiar',
          source: 'https://www.youtube.com/watch?v=' + s.videoId,
        };
      });
      if (
        custom.some((s) => !s.title || !s.artist) ||
        new Set(custom.map((s) => s.id)).size !== custom.length
      )
        fail('INVALID_SONGS', '歌名／藝人不可空白，影片不可重複', 400);
    }
    this.settings = next;
    this.customSongs = custom;
    this.event('settings', '已更新本局題庫');
  }
  pool() {
    return [...CATALOG, ...this.customSongs].filter(
      (s) =>
        s.aiGenerated === false &&
        this.settings.banks.includes(s.bank) &&
        (this.settings.obscure || s.familiarity !== 'obscure') &&
        (!this.settings.genres.length || s.genres.some((g) => this.settings.genres.includes(g))),
    );
  }
  historyState() {
    const { sequence, ...state } = this;
    return {
      ...state,
      sequence: sequence.map((song) => song.id),
      completedRounds: this.results.length,
    };
  }
  start() {
    const pool = this.pool();
    if (pool.length < this.activePlayers().length + 2)
      fail('NOT_ENOUGH_SONGS', '至少需玩家人數加2首，請增加題庫或曲風', 400);
    const groups = new Map();
    for (const s of pool) {
      if (!groups.has(s.bank)) groups.set(s.bank, []);
      groups.get(s.bank).push(s);
    }
    const sequence = [];
    let obscureCount = 0;
    while (groups.size) {
      const ids = [...groups.keys()],
        bank = ids[this.random(ids.length)],
        group = groups.get(bank),
        song = group.splice(this.random(group.length), 1)[0];
      if (!group.length) groups.delete(bank);
      if (song.familiarity === 'obscure') {
        if (obscureCount >= Math.floor(sequence.length / 9)) continue;
        obscureCount++;
      }
      sequence.push(song);
    }
    if (sequence.length < this.activePlayers().length + 2)
      fail('NOT_ENOUGH_SONGS', '熟悉歌曲不足，請增加一般題庫', 400);
    const djIndex = this.random(this.activePlayers().length);
    this.prepare();
    this.sequence = sequence;
    this.cursor = 0;
    this.djIndex = djIndex;
    this.roundLimit = sequence.length - this.players.length;
    for (const p of this.players) {
      p.timeline = [card(this.sequence[this.cursor++])];
      p.tokens = 2;
      p.bonus = 0;
      p.score = 1;
    }
    this.nextRound();
  }
  dj() {
    return this.activePlayers()[this.djIndex % this.activePlayers().length];
  }
  nextRound() {
    if (this.cursor >= this.sequence.length) return this.finishTimeline(true);
    this.round++;
    this.roundId = randomUUID();
    this.current = this.sequence[this.cursor++];
    this.createIntroChoices();
    this.answers = {};
    this.challenges = {};
    this.passed = [];
    this.placement = null;
    this.phase = 'pick';
    this.deadline = null;
    this.event('round', '第' + this.round + '首，由' + this.dj().name + '擔任DJ');
  }
  createIntroChoices() {
    const current = this.current,
      seen = new Set([normalize(current.title)]),
      titles = [current.title];
    const pool = this.pool(),
      candidates = [
        ...pool.filter((s) => s.bank === current.bank),
        ...pool.filter((s) => s.bank !== current.bank),
        ...CATALOG.filter((s) => s.bank === current.bank),
        ...CATALOG,
      ];
    const unique = [];
    for (const s of candidates) {
      const key = normalize(s.title);
      if (!seen.has(key) && s.aiGenerated === false && s.familiarity !== 'obscure') {
        seen.add(key);
        unique.push(s.title);
      }
    }
    // Prefer distractors from the selected language, and fill tiny custom banks from the catalogue.
    const sameBank = new Set(
      [...pool, ...CATALOG].filter((s) => s.bank === current.bank).map((s) => s.title),
    );
    const preferred = unique.filter((t) => sameBank.has(t)),
      rest = unique.filter((t) => !sameBank.has(t));
    for (const group of [preferred, rest])
      while (group.length && titles.length < 10)
        titles.push(group.splice(this.random(group.length), 1)[0]);
    if (titles.length !== 10) fail('NOT_ENOUGH_CHOICES', '歌名選項不足10個', 400);
    const options = titles.map((title) => ({
      id: randomUUID(),
      title,
      language:
        [...pool, ...CATALOG].find((s) => s.title === title)?.language ||
        [...pool, ...CATALOG].find((s) => s.title === title)?.bank ||
        '',
    }));
    this.correctChoiceId = options[0].id;
    for (let i = options.length - 1; i > 0; i--) {
      const j = this.random(i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    this.introChoices = options;
  }
  addCard(p, song) {
    p.timeline.push(card(song));
    p.timeline.sort((a, b) => a.year - b.year);
    p.score = p.timeline.length;
  }
  finishTimeline(exhausted = false) {
    this.phase = 'finished';
    this.deadline = null;
    const max = Math.max(...this.activePlayers().map((p) => p.timeline.length));
    this.winner = {
      score: max,
      names: this.activePlayers()
        .filter((p) => p.timeline.length === max)
        .map((p) => p.name),
    };
    this.event(
      'finish',
      exhausted ? '題庫已用完，依年代卡張數排名。' : '已集滿' + this.settings.target + '張年代卡！',
    );
  }
  correct(slot) {
    const t = this.dj().timeline,
      y = this.current.year;
    return (slot === 0 || t[slot - 1].year <= y) && (slot === t.length || y <= t[slot].year);
  }
  beginTimeline() {
    this.phase = 'timeline';
    this.deadline = this.now() + 60000;
    this.event('timeline', '播放精華，DJ選擇年代位置。');
  }
  resolve() {
    const song = this.current,
      dj = this.dj(),
      djCorrect = this.correct(this.placement);
    let receiver = djCorrect ? dj : null;
    if (!receiver)
      for (const [id, slot] of Object.entries(this.challenges))
        if (this.correct(slot)) {
          receiver = this.player(id);
          break;
        }
    const answers = this.activePlayers().map((p) => {
      const a = this.answers[p.id] || { choiceId: null, text: '' },
        titleCorrect = a.choiceId === this.correctChoiceId,
        bonus = Number(titleCorrect);
      p.bonus += bonus;
      if (titleCorrect) p.tokens = Math.min(5, p.tokens + 1);
      return {
        id: p.id,
        name: p.name,
        choiceId: a.choiceId,
        text: a.text,
        titleCorrect,
        bonus,
        tokenEarned: titleCorrect,
      };
    });
    if (receiver) this.addCard(receiver, song);
    this.results.push({
      round: this.round,
      ...card(song),
      answers,
      djId: dj.id,
      djCorrect,
      receiverId: receiver?.id || null,
      receiverName: receiver?.name || null,
      placement: this.placement,
      challenges: { ...this.challenges },
    });
    this.phase = 'reveal';
    this.deadline = null;
    this.event(
      'reveal',
      song.title +
        ' · ' +
        song.artist +
        ' · ' +
        song.year +
        (receiver ? '，' + receiver.name + '取得年代卡' : '，本輪棄牌'),
    );
    if (this.activePlayers().some((p) => p.timeline.length >= this.settings.target))
      this.finishTimeline();
  }
  auto() {
    if (this.deadline === null || this.now() < this.deadline) return false;
    if (this.phase === 'intro') {
      this.beginTimeline();
      return true;
    }
    if (this.phase === 'timeline') {
      this.placement = 0;
      this.phase = 'challenge';
      this.deadline = this.now() + 15000;
      this.event('place', 'DJ逾時，放在最前方；開放插歌。');
      return true;
    }
    if (this.phase === 'challenge') {
      this.resolve();
      return true;
    }
    return false;
  }
  act(id, action, data = {}) {
    return this.command(id, action, data, (p) => {
      if (action === 'card-frame') {
        p.musicCardFrame = builtinFrameDescriptor(data.frameId);
        this.event('card-frame', p.name + '更新音樂卡外觀');
        return;
      }
      if (action === 'configure') {
        this.configure(id, data);
        return;
      }
      if (action === 'listen') {
        if (id !== this.dj().id) fail('DJ_ONLY', '由本輪DJ開始', 403);
        if (this.phase !== 'pick') fail('INVALID_PHASE', '已開始聆聽');
        this.phase = 'intro';
        this.deadline = this.now() + 30000;
        this.event('intro', '聽8秒前奏；30秒內從10個歌名選1個，或略過。');
      } else if (action === 'guess') {
        if (this.phase !== 'intro' || this.now() >= this.deadline)
          fail('INVALID_PHASE', '前奏已結束');
        if (this.answers[id]) fail('ALREADY_SUBMITTED', '本輪已作答');
        let choice = null;
        if (data.pass !== true) {
          choice = this.introChoices.find((c) => c.id === data.choiceId);
          if (!choice) fail('INVALID_CHOICE', '請選擇本輪的歌名選項，或略過', 400);
        }
        this.answers[id] = { choiceId: choice?.id || null, text: choice?.title || '' };
        this.event('answer', p.name + '已作答');
        if (this.activePlayers().every((q) => this.answers[q.id])) this.beginTimeline();
      } else if (action === 'place') {
        if (this.phase !== 'timeline' || this.now() >= this.deadline)
          fail('INVALID_PHASE', '目前不能放牌');
        if (id !== this.dj().id) fail('DJ_ONLY', '只有DJ可以放牌', 403);
        if (!Number.isInteger(data.slot) || data.slot < 0 || data.slot > p.timeline.length)
          fail('INVALID_SLOT', '年代位置不正確', 400);
        this.placement = data.slot;
        this.phase = 'challenge';
        this.deadline = this.now() + 15000;
        this.event('place', 'DJ已放牌，開放插歌。');
        if (this.activePlayers().length === 1) this.resolve();
      } else if (action === 'challenge' || action === 'pass') {
        if (this.phase !== 'challenge' || this.now() >= this.deadline)
          fail('INVALID_PHASE', '插歌已結束');
        if (id === this.dj().id) fail('DJ_ONLY', 'DJ不需插歌', 403);
        if (Object.hasOwn(this.challenges, id) || this.passed.includes(id))
          fail('ALREADY_SUBMITTED', '已完成選擇');
        if (action === 'challenge') {
          if (p.tokens < 1) fail('NOT_ENOUGH_TOKENS', '需要1枚標記');
          if (
            !Number.isInteger(data.slot) ||
            data.slot < 0 ||
            data.slot > this.dj().timeline.length ||
            data.slot === this.placement ||
            Object.values(this.challenges).includes(data.slot)
          )
            fail('INVALID_SLOT', '請選未使用位置', 400);
          p.tokens--;
          this.challenges[id] = data.slot;
        } else this.passed.push(id);
        this.event(action, p.name + (action === 'challenge' ? '花1枚標記插歌' : '不插歌'));
        if (
          this.activePlayers()
            .filter((q) => q.id !== this.dj().id)
            .every((q) => Object.hasOwn(this.challenges, q.id) || this.passed.includes(q.id))
        )
          this.resolve();
      } else if (action === 'skip') {
        if (!['pick', 'intro', 'timeline'].includes(this.phase) || id !== this.dj().id)
          fail('INVALID_PHASE', '只有DJ放牌前可切歌');
        if (p.tokens < 1) fail('NOT_ENOUGH_TOKENS', '需要1枚標記');
        p.tokens--;
        this.event('skip', p.name + '花1枚標記切歌');
        this.nextRound();
      } else if (action === 'buy') {
        if (this.phase !== 'pick') fail('INVALID_PHASE', '買歌須在聽歌前');
        if (p.tokens < 3) fail('NOT_ENOUGH_TOKENS', '需要3枚標記');
        if (this.cursor >= this.sequence.length) fail('DECK_EMPTY', '已無可購買歌曲');
        p.tokens -= 3;
        this.addCard(p, this.sequence[this.cursor++]);
        this.event('buy', p.name + '買歌');
        if (p.timeline.length >= this.settings.target) this.finishTimeline();
      } else if (action === 'next') {
        if (this.phase !== 'reveal') fail('INVALID_PHASE', '先完成本輪');
        if (id !== this.host && id !== this.dj().id) fail('HOST_ONLY', '由房主或DJ開始下一首', 403);
        this.djIndex = (this.djIndex + 1) % this.activePlayers().length;
        this.nextRound();
      } else fail('INVALID_ACTION', '不支援的操作', 400);
    });
  }
  audio(id, roundId) {
    if (!this.player(id)) fail('NOT_SEATED', '尚未入座', 403);
    if (roundId !== this.roundId) fail('STALE_ROUND', '已換輪');
    fail('PLAYER_UPDATED', '猜歌已改為公開影片片段，請重新整理', 410);
  }
  view(id) {
    const base = this.baseView(id),
      p = this.player(id),
      current = this.current,
      visible = ['reveal', 'finished'].includes(this.phase);
    return clone({
      ...base,
      settings: this.settings,
      banks: BANKS.map((b) => ({
        ...b,
        count: [...CATALOG, ...this.customSongs].filter(
          (s) => s.bank === b.id && s.familiarity !== 'obscure',
        ).length,
      })),
      genres: [...new Set(CATALOG.flatMap((s) => s.genres))],
      customSongs: ['waiting', 'finished'].includes(this.phase) ? this.customSongs : [],
      availableCount: this.pool().length,
      players: base.players.map((q) => {
        const p = this.player(q.id);
        return {
          ...q,
          musicCardFrame: p.musicCardFrame || builtinFrameDescriptor('default'),
          timeline: p.timeline || [],
          tokens: p.tokens ?? 2,
          bonus: p.bonus || 0,
        };
      }),
      djId: this.players.length ? this.dj().id : null,
      deadline: this.deadline,
      submitted: !!this.answers[id],
      myAnswer: this.answers[id]
        ? {
            ...this.answers[id],
            titleCorrect: this.answers[id].choiceId
              ? this.answers[id].choiceId === this.correctChoiceId
              : null,
          }
        : null,
      introChoices: this.phase === 'intro' ? this.introChoices : [],
      readyIds: Object.keys(this.answers),
      challenges: this.challenges,
      passed: this.passed,
      placement: this.placement,
      song: visible && current ? card(current) : null,
      playback:
        current && ['intro', 'timeline', 'challenge', 'reveal', 'finished'].includes(this.phase)
          ? {
              provider: 'youtube',
              videoId: current.videoId,
              start: this.phase === 'intro' ? current.introStart : current.highlightStart,
              seconds: this.phase === 'intro' ? 8 : 30,
              stage: this.phase === 'intro' ? 'intro' : 'highlight',
              clipReviewed: current.clipReviewed === true,
            }
          : null,
      mine: { tokens: p.tokens ?? 2, bonus: p.bonus || 0, timeline: p.timeline || [] },
    });
  }
}
module.exports = { MusicQuizRoom };
