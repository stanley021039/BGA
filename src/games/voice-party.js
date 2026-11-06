'use strict';

const { randomUUID } = require('node:crypto');
const { PartyRoom, fail } = require('./party-base');
const { starterOrder } = require('./random-starter');
const { assertCanManageSettings } = require('../rooms/permissions');
const { brainwaveQuestions, dramaQuestions } = require('./voice-party-questions');

const SHAPES = new Set([
  'circle',
  'ellipse',
  'semicircle',
  'arc',
  'square',
  'rectangle',
  'diamond',
  'triangle',
  'line',
  'arrow',
  'cross',
  'zigzag',
]);

function readShape(shape) {
  if (!shape || !SHAPES.has(shape.kind)) fail('INVALID_SHAPE', '請使用畫板提供的圖形', 400);
  const { kind, x1, y1, x2, y2 } = shape;
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
    fail('INVALID_SHAPE', '圖形座標不正確', 400);
  if (x1 === x2 && y1 === y2) fail('EMPTY_SHAPE', '請拖曳出圖形大小', 400);
  return { kind, x1, y1, x2, y2 };
}

function brainwaveScoring(players, actor, correct, guesses, rng) {
  let pool = players.length + 2;
  const deltas = Object.fromEntries(players.map(({ id }) => [id, 0]));
  const take = (id, amount) => {
    const player = players.find((seat) => seat.id === id);
    const paid = Math.min(player.score + deltas[id], amount);
    deltas[id] -= paid;
    return paid;
  };
  const participants = new Set(guesses.map(({ id }) => id));
  for (const { id } of players) if (id !== actor && !participants.has(id)) pool += take(id, 2);

  if (!guesses.some(({ option }) => option === correct)) {
    const die = rng(6);
    if (die === correct || die === 5) take(actor, 2);
    else for (const { id, option } of guesses) if (option === die) deltas[id]++;
    return { deltas, die };
  }

  let rank = 0;
  for (const { id, option } of guesses) {
    if (option === correct) {
      const reward = Math.min(pool, Math.max(1, 3 - rank++));
      deltas[id] += reward;
      pool -= reward;
    } else {
      pool += take(id, 1);
    }
  }
  deltas[actor] += Math.min(5, pool);
  return { deltas, die: null };
}

class VoicePartyRoom extends PartyRoom {
  constructor(type, code, name, rng, now) {
    super(type, code, name, 8, 3, rng, now);
    this.seatOrder = [];
    this.actorId = null;
    this.question = null;
    this.deck = [];
    this.correct = null;
    this.guesses = [];
    this.deadline = null;
  }
  begin(cycles, startingScore) {
    this.prepare();
    this.seatOrder = starterOrder(
      this.activePlayers().map(({ id }) => id),
      this.rng,
    );
    this.roundLimit = this.seatOrder.length * cycles;
    for (const player of this.activePlayers()) player.score = startingScore;
    this.deck = [];
    this.newRound();
  }
  drawQuestion() {
    const bank = this.type === 'brainwave' ? brainwaveQuestions : dramaQuestions;
    if (!this.deck.length) this.deck = bank.map((_, index) => index);
    const [index] = this.deck.splice(this.rng(this.deck.length), 1);
    this.question = bank[index];
    this.correct = null;
  }
  newRound(restart = false) {
    if (!restart) this.round++;
    this.actorId = this.seatOrder[(this.round - 1) % this.seatOrder.length];
    this.roundId = randomUUID();
    this.receipts.clear();
    this.guesses = [];
    this.drawQuestion();
    this.openTurn();
    this.event('round', '第 ' + this.round + ' 回合');
  }
  setPhase(phase, seconds) {
    this.phase = phase;
    this.deadline = seconds ? this.now() + seconds * 1000 : null;
  }
  auto() {
    if (this.deadline !== null && this.now() >= this.deadline) this.advanceTimer();
  }
  act(id, action, data) {
    this.auto();
    this.command(id, action, data, (player) => {
      if (action === 'next' || action === 'restart') {
        assertCanManageSettings(this, id);
        if (action === 'next' && this.phase === 'reveal') return this.newRound();
        if (action === 'restart' && this.deadline !== null) return this.newRound(true);
        fail('INVALID_PHASE', '目前無法切換回合');
      }
      if (action === 'guess') {
        this.guess(player, data.option);
        return;
      }
      this.actorAction(player, action, data);
    });
  }
  guess(player, option) {
    if (this.phase !== this.guessPhase || player.id === this.actorId)
      fail('CANNOT_GUESS', '現在無法提交猜測');
    if (!Number.isInteger(option) || option < 0 || option >= this.optionsCount)
      fail('INVALID_OPTION', '請選擇有效選項', 400);
    const mine = this.guesses.filter(({ id }) => id === player.id);
    if (mine.length >= this.guessLimit || mine.some((entry) => entry.option === option))
      fail('GUESS_UNAVAILABLE', '已選過此選項，或已達出牌上限');
    this.guesses.push({ id: player.id, option });
    this.event('guess', player.name + ' 已提交');
    this.afterGuess();
  }
  afterGuess() {}
  record(result) {
    this.results.push({ round: this.round, actorId: this.actorId, ...result });
    this.setPhase('reveal');
    this.event('reveal', '第 ' + this.round + ' 回合已揭曉');
    if (this.round === this.roundLimit) this.finish();
  }
  view(id) {
    const view = this.baseView(id);
    const visible = !['waiting', 'finished'].includes(this.phase) || !this.interrupted;
    return {
      ...view,
      deadline: this.deadline,
      actorId: this.actorId,
      question: visible ? this.publicQuestion() : null,
      correct: visible && id === this.actorId ? this.correct : null,
      myGuesses: this.guesses.filter((guess) => guess.id === id).map(({ option }) => option),
      submissions: this.guesses.length,
      latest: this.results.at(-1) ?? null,
    };
  }
  publicQuestion() {
    return this.question;
  }
}

class BrainwaveRoom extends VoicePartyRoom {
  constructor(code, name, rng, now) {
    super('brainwave', code, name, rng, now);
    this.optionsCount = 5;
    this.guessLimit = 3;
    this.guessPhase = 'drawing';
    this.boards = {};
    this.changedQuestion = false;
  }
  start() {
    const count = this.activePlayers().length;
    this.begin(count === 3 ? 4 : count === 4 ? 3 : 2, 5);
  }
  openTurn() {
    this.boards = Object.fromEntries(this.seatOrder.map((id) => [id, []]));
    this.changedQuestion = false;
    this.setPhase('prepare', 30);
  }
  publicQuestion() {
    return this.phase === 'prepare' ? null : this.question;
  }
  actorAction(player, action, data) {
    if (action === 'shape' && this.phase === 'drawing') {
      const board = this.boards[player.id];
      if (!board || board.length >= 96) fail('DRAWING_FULL', '畫板已達圖形上限');
      board.push(readShape(data.shape));
      this.version++;
      return;
    }
    if (action === 'undo' && this.phase === 'drawing') {
      this.boards[player.id].pop();
      this.version++;
      return;
    }
    if (player.id !== this.actorId || this.phase !== 'prepare')
      fail('CANNOT_LEAD', '目前無法操作領圖回合');
    if (action === 'change-question' && !this.changedQuestion) {
      this.drawQuestion();
      this.changedQuestion = true;
      this.event('prepare', '領圖者已換題');
      return;
    }
    if (action === 'ready') return this.beginDrawing();
    fail('INVALID_ACTION', '無法執行此操作', 400);
  }
  beginDrawing() {
    this.correct = this.rng(this.optionsCount);
    this.setPhase('drawing', 60);
    this.event('drawing', '開始領圖與搶答');
  }
  advanceTimer() {
    if (this.phase === 'prepare') return this.beginDrawing();
    const { deltas, die } = brainwaveScoring(
      this.activePlayers(),
      this.actorId,
      this.correct,
      this.guesses,
      this.rng,
    );
    for (const player of this.activePlayers()) player.score += deltas[player.id];
    this.record({
      question: this.question,
      correct: this.correct,
      guesses: [...this.guesses].reverse(),
      deltas,
      die,
    });
  }
  view(id) {
    const view = super.view(id);
    return {
      ...view,
      question: this.phase === 'prepare' && id === this.actorId ? this.question : view.question,
      changedQuestion: id === this.actorId && this.changedQuestion,
      board: this.boards[id] || [],
      revealedBoards:
        this.phase === 'reveal' || (this.phase === 'finished' && !this.interrupted)
          ? this.boards
          : null,
    };
  }
}

class DramaBarRoom extends VoicePartyRoom {
  constructor(code, name, rng, now) {
    super('drama-bar', code, name, rng, now);
    this.options = { cycles: 1 };
    this.optionsCount = 6;
    this.guessLimit = 1;
    this.guessPhase = 'guessing';
  }
  configure(id, { cycles }) {
    assertCanManageSettings(this, id);
    if (this.phase !== 'waiting') fail('MATCH_STARTED', '只能在等待室設定');
    if (![1, 2, 3].includes(cycles)) fail('INVALID_CYCLES', '請選擇每人演出 1–3 次', 400);
    this.options = { cycles };
    this.event('settings', '已更新演出次數');
  }
  start() {
    this.begin(this.options.cycles, 0);
  }
  openTurn() {
    this.correct = this.rng(this.optionsCount);
    this.setPhase('performing', 45);
  }
  actorAction(player, action) {
    if (player.id === this.actorId && action === 'performed' && this.phase === 'performing')
      return this.beginGuessing();
    fail('INVALID_ACTION', '目前無法結束演出');
  }
  beginGuessing() {
    this.setPhase('guessing', 20);
    this.event('guessing', '開始猜情境');
  }
  afterGuess() {
    if (this.guesses.length === this.seatOrder.length - 1) this.reveal();
  }
  advanceTimer() {
    if (this.phase === 'performing') return this.beginGuessing();
    this.reveal();
  }
  reveal() {
    const guesses = Object.fromEntries(this.guesses.map(({ id, option }) => [id, option]));
    const others = this.seatOrder.filter((id) => id !== this.actorId);
    const missed = others.filter((id) => guesses[id] !== this.correct);
    const penalized = missed.length === others.length ? [this.actorId] : missed;
    for (const id of penalized) this.player(id).score++;
    this.record({ question: this.question, correct: this.correct, guesses, penalized });
  }
  finish() {
    this.phase = 'finished';
    const score = Math.min(...this.activePlayers().map((player) => player.score));
    this.winner = {
      score,
      names: this.activePlayers()
        .filter((p) => p.score === score)
        .map((p) => p.name),
    };
    this.event('finish', '本場完成，杯數最少者勝出');
  }
  view(id) {
    return { ...super.view(id), options: this.options };
  }
}

module.exports = { BrainwaveRoom, DramaBarRoom, brainwaveScoring };
