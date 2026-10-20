import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomPlayer, type RoomSnapshot } from './room';
export type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export interface PokerPlayer extends RoomPlayer {
  stack: number;
  bet: number;
  total: number;
  folded: boolean;
  cards: (number | null)[];
  action: string;
}
export interface PokerResult {
  name: string;
  amount: number;
  hand: string;
}
export interface PokerSnapshot extends RoomSnapshot {
  type: 'poker';
  phase: PokerPhase;
  hand: number;
  board: number[];
  button: number;
  turn: number;
  deadline: number | null;
  currentBet: number;
  minRaise: number;
  pot: number;
  canRaise: boolean;
  results: PokerResult[];
  players: PokerPlayer[];
  log: string[];
}
const integer = (value: unknown, min = 0): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min;
const card = (value: unknown): value is number => integer(value) && value < 52;
function invalid(): never {
  throw Error('德州撲克牌桌資料格式不正確。');
}
export function readPokerSnapshot(value: unknown): PokerSnapshot {
  const base = readRoomSnapshot(value),
    r = record(value);
  if (
    base.type !== 'poker' ||
    !['waiting', 'preflop', 'flop', 'turn', 'river', 'showdown'].includes(base.phase) ||
    !integer(r.hand) ||
    !integer(r.button, -1) ||
    !integer(r.turn, -1) ||
    !integer(r.currentBet) ||
    !integer(r.minRaise, 1) ||
    !integer(r.pot) ||
    typeof r.canRaise !== 'boolean'
  )
    return invalid();
  const board = array(r.board);
  if (board.length > 5 || !board.every(card)) return invalid();
  const players = base.players.map((p) => {
    const cards = array(p.cards);
    if (
      !integer(p.stack) ||
      !integer(p.bet) ||
      !integer(p.total) ||
      p.bet > p.total ||
      typeof p.folded !== 'boolean' ||
      cards.length > 2 ||
      !cards.every((c) => c === null || card(c))
    )
      return invalid();
    if (
      p.id !== base.me &&
      (base.phase !== 'showdown' || p.folded || base.players.filter((q) => !q.folded).length < 2) &&
      cards.some((c) => c !== null)
    )
      return invalid();
    return {
      ...p,
      stack: p.stack,
      bet: p.bet,
      total: p.total,
      folded: p.folded,
      cards: cards as (number | null)[],
      action: text(p.action),
    };
  });
  if (
    !players.length ||
    players.length > 6 ||
    r.button >= players.length ||
    r.turn >= players.length ||
    !players.some((p) => p.id === base.me) ||
    r.pot !== players.reduce((sum, p) => sum + p.total, 0)
  )
    return invalid();
  const active = !['waiting', 'showdown'].includes(base.phase);
  if (
    active &&
    (r.hand < 1 ||
      r.turn < 0 ||
      !Number.isFinite(r.deadline) ||
      players[r.turn]?.folded ||
      players[r.turn]?.stack === 0)
  )
    return invalid();
  if (
    (base.phase === 'waiting' && (r.hand !== 0 || board.length !== 0)) ||
    (base.phase === 'preflop' && board.length !== 0) ||
    (base.phase === 'flop' && board.length !== 3) ||
    (base.phase === 'turn' && board.length !== 4) ||
    (base.phase === 'river' && board.length !== 5)
  )
    return invalid();
  const results = array(r.results).map((value) => {
    const p = record(value);
    if (!text(p.name) || !integer(p.amount) || !text(p.hand)) return invalid();
    return { name: text(p.name), amount: p.amount, hand: text(p.hand) };
  });
  if (results.length > 6 || (base.phase !== 'showdown' && results.length)) return invalid();
  const visible = [
    ...board,
    ...players.flatMap((p) => p.cards.filter((c): c is number => c !== null)),
  ];
  if (new Set(visible).size !== visible.length) return invalid();
  return {
    ...base,
    type: 'poker',
    phase: base.phase as PokerPhase,
    hand: r.hand,
    board: board as number[],
    button: r.button,
    turn: r.turn,
    deadline: typeof r.deadline === 'number' && Number.isFinite(r.deadline) ? r.deadline : null,
    currentBet: r.currentBet,
    minRaise: r.minRaise,
    pot: r.pot,
    canRaise: r.canRaise,
    results,
    players,
    log: array(r.log)
      .map((v) => text(v))
      .slice(0, 30),
  };
}
export interface PokerContributionTier {
  amount: number;
  from: number;
  to: number;
  contributors: PokerPlayer[];
  eligible: PokerPlayer[];
}
// Public contribution accounting only. The engine's aggregate payouts remain authoritative.
export function pokerContributionTiers(players: PokerPlayer[]): PokerContributionTier[] {
  let previous = 0;
  return [...new Set(players.map((p) => p.total).filter(Boolean))]
    .sort((a, b) => a - b)
    .map((to) => {
      const contributors = players.filter((p) => p.total >= to),
        tier = {
          amount: (to - previous) * contributors.length,
          from: previous,
          to,
          contributors,
          eligible: contributors.filter((p) => !p.folded),
        };
      previous = to;
      return tier;
    });
}
