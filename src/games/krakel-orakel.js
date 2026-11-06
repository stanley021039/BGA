'use strict';

const { randomUUID } = require('node:crypto');
const { PartyRoom, fail } = require('./party-base');
const { starterIndex } = require('./random-starter');
const { assertCanManageSettings } = require('../rooms/permissions');
const { WORDS } = require('./draw-guess-words');

const BOARD_COUNT = 8;
const DRAWING_SECONDS = 120;
const ELIMINATION_SECONDS = 30;

function pathsFor(variant, side) {
  const offset = variant * 2 + side;
  const points = Array.from({ length: 64 }, (_, index) => {
    const x = index % 8;
    const y = Math.floor(index / 8);
    const shift = (factor) => ((index * factor + offset * 17) % 43) - 21;
    return [80 + x * 120 + shift(13), 80 + y * 120 + shift(29)];
  });
  const segments = [];
  const append = (a, b, bend) => {
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    const mid = [(x1 + x2) / 2 + bend, (y1 + y2) / 2 - bend];
    segments.push([[x1, y1], mid], [mid, [x2, y2]]);
  };
  for (let index = 0; index < points.length; index++) {
    const x = index % 8;
    const y = Math.floor(index / 8);
    if (x < 7 && (index + offset) % 5 !== 0) append(index, index + 1, ((y % 3) - 1) * 22);
    if (y < 7 && (index + offset * 3) % 5 !== 1) append(index, index + 8, ((x % 3) - 1) * 22);
    if (x < 7 && y < 7 && (index + offset) % 4 === 0) append(index, index + 9, 15);
  }
  return segments;
}

const templates = Array.from({ length: BOARD_COUNT }, (_, variant) => [
  pathsFor(variant, 0),
  pathsFor(variant, 1),
]);

function readTrace(value, length) {
  if (!Array.isArray(value) || !value.length || value.length > 48)
    fail('INVALID_TRACE', '描線長度不正確', 400);
  return value.map((segment) => {
    const { index, from, to } = segment ?? {};
    if (
      ![index, from, to].every(Number.isInteger) ||
      index < 0 ||
      index >= length ||
      from < 0 ||
      to > 100 ||
      from >= to
    )
      fail('INVALID_TRACE', '請沿畫板虛線描畫', 400);
    return { index, from, to };
  });
}

class KrakelOrakel {
  constructor() {
    this.roundId = null;
    this.seats = [];
    this.boards = {};
    this.terms = [];
    this.used = [];
    this.eliminated = [];
    this.perSeat = 1;
    this.errors = 0;
    this.summary = null;
    this.receipts = new Map();
  }
  start(room) {
    const seats = room.activePlayers().map(({ id }) => id);
    if (seats.length < 2 || seats.length > 8) fail('NEED_PLAYERS', '需要 2 至 8 位玩家', 400);
    this.seats = seats;
    this.first = starterIndex(seats, room.rng);
    this.perSeat = seats.length < 4 ? 2 : 1;
    this.errors = 0;
    this.used = [];
    this.summary = null;
    room.round = 0;
    room.roundLimit = 4;
    room.gameRunId = randomUUID();
    room.results = [];
    room.winner = null;
    room.presenterId = null;
    room.players = room.activePlayers();
    for (const player of room.players) {
      player.score = 0;
      player.waitingForNextRound = false;
    }
    this.nextRound(room);
  }
  nextRound(room) {
    const used = new Set(this.used);
    const difficulty = room.options.oracleDifficulty === 'hard' ? 'hard' : 'easy';
    const words = [
      ...new Set(
        WORDS.filter(
          (word) =>
            word.difficulty === difficulty &&
            word.topic !== 'meme' &&
            !room.wordExclusionProvider?.(word),
        ).map((word) => word.title),
      ),
    ].filter((word) => !used.has(word));
    const count = this.seats.length * this.perSeat;
    if (words.length < count * 2) fail('ORACLE_NEEDS_WORDS', '神諭題庫的可用詞語不足');
    room.round++;
    this.roundId = randomUUID();
    this.receipts.clear();
    this.eliminated = [];
    const seatCount = this.seats.length;
    const boardOffset = (room.round - 1) % seatCount;
    this.eliminationStarter = (this.first + seatCount - boardOffset) % seatCount;
    this.boards = Object.fromEntries(
      this.seats.map((id, index) => [
        id,
        {
          variant: (index + seatCount - boardOffset) % seatCount,
          side: 0,
          rotation: 0,
          marks: [],
          submitted: false,
        },
      ]),
    );
    const terms = Array.from({ length: count * 2 }, (_, index) => {
      const [word] = words.splice(room.rng(words.length), 1);
      return {
        id: randomUUID(),
        word,
        artist: this.seats[Math.floor(index / this.perSeat)] ?? null,
      };
    });
    this.used.push(...terms.map(({ word }) => word));
    for (let i = terms.length - 1; i > 0; i--) {
      const j = room.rng(i + 1);
      [terms[i], terms[j]] = [terms[j], terms[i]];
    }
    this.terms = terms;
    room.phase = 'oracle-drawing';
    room.deadline = room.now() + DRAWING_SECONDS * 1000;
    room.event('oracle-drawing', '第 ' + room.round + ' 輪開始描線');
  }
  turnId() {
    return this.seats[(this.eliminationStarter + this.eliminated.length) % this.seats.length];
  }
  beginElimination(room) {
    room.phase = 'oracle-guessing';
    room.deadline = room.now() + ELIMINATION_SECONDS * 1000;
    room.event('oracle-guessing', '作品已公開，輪流排除詞語');
  }
  eliminate(room, id, termId) {
    if (room.phase !== 'oracle-guessing' || this.turnId() !== id)
      fail('ORACLE_NOT_TURN', '現在還不能淘汰');
    if (!this.terms.some((term) => term.id === termId) || this.eliminated.includes(termId))
      fail('ORACLE_INVALID_TERM', '此詞語已淘汰或不存在', 400);
    this.eliminated.push(termId);
    if (this.eliminated.length < this.terms.length / 2) {
      room.deadline = room.now() + ELIMINATION_SECONDS * 1000;
      room.event('oracle-eliminate', '已淘汰一張詞卡');
      return;
    }
    const mistakes = this.terms.filter(
      (term) => term.artist && this.eliminated.includes(term.id),
    ).length;
    this.errors += mistakes;
    this.summary = { mistakes, round: room.round };
    room.deadline = null;
    if (this.errors > this.seats.length || room.round === room.roundLimit) {
      room.phase = 'finished';
      room.winner = { ids: this.errors <= this.seats.length ? this.seats : [], score: this.errors };
    } else {
      room.phase = 'oracle-reveal';
    }
    room.event('oracle-reveal', '本輪答案已揭曉');
  }
  auto(room) {
    if (room.deadline === null || room.now() < room.deadline) return false;
    if (room.phase === 'oracle-drawing') this.beginElimination(room);
    else if (room.phase === 'oracle-guessing') {
      // A disconnected seat must not be able to stall the whole table.
      const available = this.terms.filter((term) => !this.eliminated.includes(term.id));
      this.eliminate(room, this.turnId(), available[room.rng(available.length)].id);
    } else return false;
    return true;
  }
  act(room, id, action, data) {
    this.auto(room);
    const context = {
      roundId: this.roundId,
      receipts: this.receipts,
      player: (playerId) => room.activePlayers().find((player) => player.id === playerId),
    };
    PartyRoom.prototype.command.call(context, id, action, data, () => {
      if (action === 'oracle-next') {
        assertCanManageSettings(room, id);
        if (room.phase !== 'oracle-reveal') fail('INVALID_PHASE', '揭曉後才能進入下一輪');
        return this.nextRound(room);
      }
      if (action === 'oracle-eliminate') return this.eliminate(room, id, data.termId);
      const board = this.boards[id];
      if (room.phase !== 'oracle-drawing' || !board || board.submitted)
        fail('ORACLE_BOARD_LOCKED', '現在無法修改畫板');
      if (action === 'oracle-trace') {
        if (board.marks.length >= 160) fail('DRAWING_FULL', '畫板已達筆畫上限');
        board.marks.push(readTrace(data.trace, templates[board.variant][board.side].length));
      } else if (action === 'oracle-undo') {
        board.marks.pop();
      } else if (action === 'oracle-board') {
        if (![0, 1].includes(data.side) || ![0, 1, 2, 3].includes(data.rotation))
          fail('INVALID_BOARD', '畫板設定不正確', 400);
        if (data.side !== board.side && board.marks.length)
          fail('ORACLE_BOARD_MARKED', '請先復原筆畫再翻面');
        board.side = data.side;
        board.rotation = data.rotation;
      } else if (action === 'oracle-submit') {
        board.submitted = true;
        if (Object.values(this.boards).every((item) => item.submitted)) this.beginElimination(room);
      } else {
        fail('INVALID_ACTION', '無法執行此操作', 400);
      }
      room.version++;
    });
  }
  interrupt(room) {
    if (!room.phase.startsWith('oracle-')) return;
    room.phase = 'finished';
    room.deadline = null;
    room.winner = { ids: [], score: this.errors, reason: '本場中止' };
    this.summary = null;
    room.event('finish', '有玩家離席，本場中止');
  }
  view(room, id) {
    if (room.phase === 'waiting' || !this.roundId) return null;
    const reveal = room.phase === 'oracle-reveal' || (room.phase === 'finished' && !!this.summary);
    const publicBoards = reveal || room.phase === 'oracle-guessing';
    const boardView = (board) => ({ ...board, paths: templates[board.variant][board.side] });
    return {
      roundId: this.roundId,
      deadline: room.deadline,
      seats: this.seats,
      turnId: room.phase === 'oracle-guessing' ? this.turnId() : null,
      errors: this.errors,
      maxErrors: this.seats.length,
      readyCount: Object.values(this.boards).filter((board) => board.submitted).length,
      board: room.phase === 'oracle-drawing' && this.boards[id] ? boardView(this.boards[id]) : null,
      words:
        room.phase === 'oracle-drawing'
          ? this.terms.filter((term) => term.artist === id).map(({ word }) => word)
          : [],
      boards: publicBoards
        ? Object.fromEntries(
            Object.entries(this.boards).map(([player, board]) => [player, boardView(board)]),
          )
        : {},
      terms: publicBoards
        ? this.terms.map(({ id, word, artist }) => ({
            id,
            word,
            eliminated: this.eliminated.includes(id),
            ...(reveal ? { artist } : {}),
          }))
        : [],
      summary: reveal ? this.summary : null,
    };
  }
}

module.exports = { KrakelOrakel };
