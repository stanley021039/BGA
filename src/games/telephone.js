'use strict';
const { randomInt, randomUUID, createHash } = require('node:crypto');
const { HttpError } = require('../http/errors');
const { assertRecordCapacity } = require('../rooms/membership');
const { PROMPTS, SOURCES } = require('./telephone-prompts');
const clone = (x) => JSON.parse(JSON.stringify(x));
const fail = (code, message, status = 409) => {
  throw new HttpError(status, code, message);
};
function drawing(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100)
    fail('INVALID_DRAWING', '畫作需有 1–100 筆', 400);
  let points = 0;
  return input.map((s) => {
    if (
      !s ||
      !['brush', 'erase', 'line', 'rect', 'ellipse', 'fill'].includes(s.tool) ||
      !/^#[a-f0-9]{6}$/i.test(s.color) ||
      !Number.isInteger(s.size) ||
      s.size < 1 ||
      s.size > 40 ||
      !Array.isArray(s.points) ||
      !s.points.length ||
      s.points.length > 256
    )
      fail('INVALID_DRAWING', '筆畫格式不正確', 400);
    points += s.points.length;
    if (points > 3000) fail('DRAWING_LIMIT', '每頁最多 3,000 點', 400);
    const coordinates = s.points.map((p) => {
      if (
        !Array.isArray(p) ||
        p.length !== 2 ||
        !p.every(Number.isInteger) ||
        p[0] < 0 ||
        p[0] > 511 ||
        p[1] < 0 ||
        p[1] > 255
      )
        fail('INVALID_DRAWING', '畫作座標不正確', 400);
      return p.slice();
    });
    if (s.filled !== undefined && typeof s.filled !== 'boolean')
      fail('INVALID_DRAWING', '填滿格式不正確', 400);
    return {
      tool: s.tool,
      color: s.color,
      size: s.size,
      points: coordinates,
      ...(s.filled !== undefined ? { filled: s.filled } : {}),
    };
  });
}
function guessText(input, allowEmpty = false) {
  if (
    typeof input !== 'string' ||
    (!allowEmpty && ![...input.trim()].length) ||
    [...input.trim()].length > 80 ||
    /[\u0000-\u001f\u007f]/.test(input)
  )
    fail('INVALID_TEXT', '猜詞需 1–80 字且不能換行', 400);
  return input.trim();
}
function makePage(player, round, data, skipped = false) {
  const kind = round % 2 ? 'drawing' : 'text',
    page = { kind, authorName: player.name, authorId: player.id, skipped };
  if (skipped)
    return kind === 'drawing' ? { ...page, strokes: [] } : { ...page, text: '（本頁略過）' };
  return kind === 'drawing'
    ? { ...page, strokes: drawing(data.strokes) }
    : { ...page, text: guessText(data.text) };
}

class TelephoneRoom {
  constructor(code, name, rng = randomInt, now = Date.now) {
    Object.assign(this, {
      type: 'telephone',
      code,
      name,
      rng,
      players: [],
      host: null,
      phase: 'waiting',
      version: 0,
      updated: now(),
      round: 0,
      roundLimit: 0,
      stepId: null,
      books: [],
      roster: [],
      submissions: {},
      options: { sources: ['everyday', 'silly'], seconds: 90 },
      deadline: null,
      events: [],
      log: [],
      interrupted: false,
      revealIndex: -1,
    });
    Object.defineProperty(this, 'receipts', { value: new Map(), enumerable: false });
    Object.defineProperty(this, 'books', { value: [], writable: true, enumerable: false });
    Object.defineProperty(this, 'now', { value: now, enumerable: false });
    Object.defineProperty(this, 'drafts', { value: {}, writable: true, enumerable: false });
    Object.defineProperty(this, 'draftReceipts', { value: new Map(), enumerable: false });
    Object.defineProperty(this, 'topicReceipts', { value: new Map(), enumerable: false });
    this.runId = null;
    this.pageCommits = [];
  }
  activePlayers() {
    return this.players.filter((p) => !p.kicked);
  }
  player(id) {
    return this.activePlayers().find((p) => p.id === id);
  }
  event(kind, text) {
    this.events.push({ id: ++this.version, kind, text });
    this.events = this.events.slice(-30);
    this.log.unshift(text);
    this.log = this.log.slice(0, 60);
    this.updated = this.now();
  }
  add(name, bot = false) {
    if (!['waiting', 'finished'].includes(this.phase))
      fail('MATCH_STARTED', '傳遞中不能加入，請等下一場');
    if (this.activePlayers().length >= 8) fail('ROOM_FULL', '房間已滿', 400);
    assertRecordCapacity(this);
    const p = {
      id: randomUUID(),
      name: String(name).slice(0, 16),
      secret: randomUUID(),
      bot: !!bot,
      kicked: false,
      lastSeen: this.now(),
    };
    this.players.push(p);
    this.host ||= p.id;
    this.event('join', p.name + ' 入座');
    return p;
  }
  configure(id, data) {
    if (id !== this.host) fail('HOST_ONLY', '只有房主可以設定', 403);
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '傳遞中不能改題庫');
    if (
      !Array.isArray(data.sources) ||
      !data.sources.length ||
      data.sources.length > 2 ||
      new Set(data.sources).size !== data.sources.length ||
      data.sources.some((x) => !SOURCES.some((s) => s.id === x))
    )
      fail('INVALID_SOURCES', '請選擇有效題庫', 400);
    this.options.sources = data.sources.slice();
    this.event('settings', '房主更新獨立情境題庫');
  }
  start() {
    if (!['waiting', 'finished'].includes(this.phase)) fail('MATCH_STARTED', '已經開始傳遞');
    const active = this.activePlayers();
    if (active.length < 3) fail('NEED_PLAYERS', '至少三人，可加入腳本測試夥伴', 400);
    const pool = PROMPTS.filter((p) => this.options.sources.includes(p.source)),
      books = [];
    // Allocate all prompts before mutating: bad RNG cannot partially start a match.
    for (const p of active) {
      const index = this.rng(pool.length);
      if (!Number.isInteger(index) || index < 0 || index >= pool.length)
        throw Error('無效抽題結果');
      const prompt = pool.splice(index, 1)[0];
      books.push({
        ownerId: p.id,
        ownerName: p.name,
        promptId: prompt.id,
        pages: [
          { kind: 'text', authorName: p.name, authorId: p.id, skipped: true, text: '（尚未出題）' },
        ],
      });
    }
    this.players = active;
    this.roster = active.map((p) => p.id);
    this.books = books;
    this.runId = randomUUID();
    this.pageCommits = [];
    this.round = 0;
    this.roundLimit = active.length % 2 ? active.length - 1 : active.length;
    this.phase = 'prompting';
    this.deadline = this.now() + this.options.seconds * 1000;
    this.stepId = randomUUID();
    this.submissions = {};
    this.drafts = {};
    this.draftReceipts.clear();
    this.interrupted = false;
    this.receipts.clear();
    this.topicReceipts.clear();
    this.revealIndex = -1;
    this.event('start', '先各自想一個主題；90 秒內全員送出即可提早開始作畫。');
  }
  bookFor(id) {
    const seat = this.roster.indexOf(id);
    return this.books[(seat - this.round + this.roster.length) % this.roster.length];
  }
  topicPage(player, data, fallback = false, timedOut = false) {
    const book = this.books[this.roster.indexOf(player.id)];
    const prompt = fallback ? PROMPTS.find((row) => row.id === book.promptId) : null;
    return {
      kind: 'text',
      authorName: fallback ? '情境題庫' : player.name,
      ...(fallback ? { topicFallback: true } : { authorId: player.id }),
      text: fallback ? prompt.text : guessText(data.text),
      ...(timedOut ? { timedOut: true } : {}),
    };
  }
  beginDrawing(now) {
    this.phase = 'passing';
    this.round = 1;
    this.deadline = now + this.options.seconds * 1000;
    this.stepId = randomUUID();
    this.submissions = {};
    this.drafts = {};
    this.draftReceipts.clear();
    this.event('pass', '主題已備妥，傳給下一位玩家開始作畫。');
  }
  act(id, action, data = {}) {
    const p = this.player(id);
    if (!p) fail('NOT_SEATED', '尚未入座', 403);
    if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))
      fail('INVALID_REQUEST_ID', '操作識別碼不正確', 400);
    const key = id + ':' + data.requestId,
      fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            action,
            data.stepId,
            data.text ?? null,
            data.strokes ?? null,
            data.expectedIndex ?? null,
          ]),
        )
        .digest('hex');
    if (data.stepId !== this.stepId) {
      const receipt = this.topicReceipts.get(key);
      if (this.phase === 'passing' && this.round === 1 && receipt?.stepId === data.stepId) {
        if (receipt.fingerprint !== fingerprint) fail('REQUEST_CONFLICT', '操作識別碼內容不一致');
        return;
      }
      fail('STALE_STEP', '已換頁，請更新畫面');
    }
    if (this.receipts.has(key)) {
      if (this.receipts.get(key) !== fingerprint) fail('REQUEST_CONFLICT', '操作識別碼內容不一致');
      return;
    }
    if (action === 'reveal') {
      if (this.phase !== 'finished') fail('INVALID_PHASE', '尚未進入故事回顧');
      if (id !== this.host) fail('HOST_ONLY', '只有房主可以播放下一頁', 403);
      if (!Number.isInteger(data.expectedIndex) || data.expectedIndex !== this.revealIndex)
        fail('STALE_REVIEW', '播放進度已更新，請查看目前頁面');
      const total = this.books.reduce((sum, book) => sum + book.pages.length, 0);
      if (this.revealIndex >= total - 1) fail('REVIEW_COMPLETE', '所有故事已播放完畢');
      this.revealIndex++;
      this.event('reveal', '房主揭曉第 ' + (this.revealIndex + 1) + '／' + total + ' 個故事片段');
      this.receipts.set(key, fingerprint);
      if (this.receipts.size > 128) this.receipts.delete(this.receipts.keys().next().value);
      return;
    }
    if (!['prompting', 'passing'].includes(this.phase)) fail('INVALID_PHASE', '這場已結束');
    if (action === 'advance') fail('TIMED_PASSING', '時間到會自動傳下一頁，不能提早傳頁');
    if (this.now() >= this.deadline) fail('PAGE_CLOSED', '本頁時間已到，正在傳下一頁');
    if (action !== 'submit' && action !== 'skip') fail('INVALID_ACTION', '不支援的操作', 400);
    if (this.submissions[id]) fail('ALREADY_SUBMITTED', '這頁已送出');
    if (this.phase === 'prompting') {
      const page = this.topicPage(p, data, action === 'skip');
      const bookIndex = this.roster.indexOf(id);
      this.books[bookIndex].pages[0] = page;
      this.pageCommits = [{ bookIndex, round: 0, page }];
      this.submissions[id] = page;
      delete this.drafts[id];
      this.receipts.set(key, fingerprint);
      this.topicReceipts.set(key, { stepId: data.stepId, fingerprint });
      this.event('topic', p.name + ' 已送出主題');
      if (this.roster.every((seat) => this.submissions[seat])) this.beginDrawing(this.now());
      return;
    }
    this.submissions[id] = makePage(p, this.round, data, action === 'skip');
    delete this.drafts[id];
    this.event('submit', p.name + ' 已送出');
    this.receipts.set(key, fingerprint);
    if (this.receipts.size > 128) this.receipts.delete(this.receipts.keys().next().value);
  }
  // Private autosave stays bounded in memory; only committed pages enter history.
  saveDraft(id, data = {}) {
    const p = this.player(id);
    if (!p) fail('NOT_SEATED', '尚未入座', 403);
    if (data.stepId !== this.stepId) fail('STALE_STEP', '已換頁，請更新畫面');
    if (!['prompting', 'passing'].includes(this.phase)) fail('INVALID_PHASE', '這場已結束');
    if (typeof data.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId))
      fail('INVALID_REQUEST_ID', '操作識別碼不正確', 400);
    const key = id + ':' + data.requestId,
      fingerprint = createHash('sha256')
        .update(JSON.stringify([data.stepId, data.text ?? null, data.strokes ?? null]))
        .digest('hex');
    if (this.draftReceipts.has(key)) {
      if (this.draftReceipts.get(key) !== fingerprint)
        fail('REQUEST_CONFLICT', '操作識別碼內容不一致');
      return;
    }
    if (this.now() >= this.deadline) fail('PAGE_CLOSED', '本頁時間已到，正在傳下一頁');
    if (this.submissions[id]) fail('ALREADY_SUBMITTED', '這頁已送出');
    const draft =
      this.round % 2
        ? {
            strokes:
              Array.isArray(data.strokes) && !data.strokes.length ? [] : drawing(data.strokes),
          }
        : { text: guessText(data.text, true) };
    this.drafts[id] = draft;
    this.draftReceipts.set(key, fingerprint);
    if (this.draftReceipts.size > 128)
      this.draftReceipts.delete(this.draftReceipts.keys().next().value);
  }
  auto() {
    const now = this.now();
    if (
      !['prompting', 'passing'].includes(this.phase) ||
      !Number.isFinite(this.deadline) ||
      now < this.deadline
    )
      return false;
    if (this.phase === 'prompting') {
      this.pageCommits = [];
      for (const seat of this.roster) {
        const bookIndex = this.roster.indexOf(seat);
        const draft = this.drafts[seat];
        const page =
          this.submissions[seat] ||
          this.topicPage(this.player(seat), draft || {}, !draft?.text, true);
        this.books[bookIndex].pages[0] = page;
        this.pageCommits.push({ bookIndex, round: 0, page });
      }
      this.beginDrawing(now);
      return true;
    }
    for (const seat of this.roster)
      if (!this.submissions[seat]) {
        const draft = this.drafts[seat],
          empty = this.round % 2 ? !draft?.strokes.length : !draft?.text;
        this.submissions[seat] = {
          ...makePage(this.player(seat), this.round, draft || {}, empty),
          timedOut: true,
        };
      }
    this.commitPages();
    this.drafts = {};
    this.draftReceipts.clear();
    if (this.round === this.roundLimit) {
      this.phase = 'finished';
      this.deadline = null;
      this.event('finish', '時間到，全部故事揭曉！沒有排名，一起看看故事如何變形。');
    } else {
      this.round++;
      this.deadline = now + this.options.seconds * 1000;
      this.stepId = randomUUID();
      this.event('pass', '時間到，第 ' + this.round + ' 頁：' + (this.round % 2 ? '畫圖' : '猜詞'));
    }
    return true;
  }
  kick(id, targetId, leaving = false) {
    if (id !== this.host && !leaving) fail('HOST_ONLY', '只有房主可以移除席位', 403);
    const p = this.player(targetId);
    if (!p) fail('PLAYER_NOT_FOUND', '找不到玩家', 404);
    p.kicked = true;
    if (this.host === targetId) this.host = this.activePlayers()[0]?.id ?? null;
    if (['prompting', 'passing'].includes(this.phase)) {
      this.commitPages();
      this.drafts = {};
      this.draftReceipts.clear();
      this.interrupted = true;
      this.phase = 'finished';
      this.deadline = null;
      this.event('interrupted', '有人離席，傳遞中止；只揭曉已送出的頁面，不冒充正常完局。');
    }
    this.event('leave', p.name + ' 離席');
  }
  commitPages() {
    this.pageCommits = [];
    for (const seat of this.roster) {
      const page = this.submissions[seat];
      if (!page) continue;
      const book = this.bookFor(seat);
      if (this.phase === 'prompting') book.pages[0] = page;
      else book.pages.push(page);
      this.pageCommits.push({ bookIndex: this.books.indexOf(book), round: this.round, page });
    }
    this.submissions = {};
  }
  view(id) {
    if (!this.player(id)) fail('NOT_SEATED', '尚未入座', 403);
    const passing = ['prompting', 'passing'].includes(this.phase),
      book = passing ? this.bookFor(id) : null;
    return clone({
      type: this.type,
      code: this.code,
      name: this.name,
      me: id,
      host: this.host,
      version: this.version,
      phase: this.phase,
      round: this.round,
      roundLimit: this.roundLimit,
      stepId: this.stepId,
      deadline: this.deadline,
      serverNow: this.now(),
      interrupted: this.interrupted,
      options: this.options,
      sources: SOURCES,
      players: this.activePlayers().map((p) => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        avatar: p.avatar,
        ready: !!this.submissions[p.id],
        offline: !p.bot && this.now() - p.lastSeen >= 15000,
      })),
      task: passing
        ? {
            kind: this.round % 2 ? 'drawing' : 'text',
            previous:
              this.phase === 'prompting'
                ? { kind: 'text', authorName: '你', text: '想一個主題，交給下一位玩家作畫。' }
                : book.pages.at(-1),
            submitted: !!this.submissions[id],
            draft: this.submissions[id] ? null : this.drafts[id] || null,
          }
        : null,
      books: this.phase === 'finished' ? this.books : [],
      review:
        this.phase === 'finished'
          ? {
              index: this.revealIndex,
              total: this.books.reduce((sum, book) => sum + book.pages.length, 0),
            }
          : null,
      events: this.events,
      log: this.log,
    });
  }
}
module.exports = { TelephoneRoom, drawing };
