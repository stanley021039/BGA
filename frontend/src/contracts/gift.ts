import { array, record, text } from '../services/validation';
import { readRoomSnapshot, type RoomSnapshot, type RoomPlayer } from './room';
export const giftRankKeys = ['great', 'good', 'ok', 'noWay'] as const;
export type GiftRank = (typeof giftRankKeys)[number];
export const giftRankLabels: Record<GiftRank | 'unranked', string> = {
  great: '最想要 · +3',
  good: '想要 · +2',
  ok: '還可以 · +1',
  noWay: '最不想要 · −4',
  unranked: '沒標記 · −1',
};
export interface GiftCard {
  id: string;
  title: string;
  category: string;
  image: string | null;
}
export interface GiftPlayer extends RoomPlayer {
  giveScore: number;
  getScore: number;
}
export interface GiftEntry {
  giverId: string;
  recipientId: string;
  giftId: string;
  rank: GiftRank | 'unranked';
  points: number;
  giveAfter?: number;
  getAfter?: number;
}
export interface GiftResult {
  round: number;
  assignments: Record<string, Record<string, string>>;
  rankings: Record<string, Record<GiftRank, string>>;
  entries: GiftEntry[];
}
export interface GiftSnapshot extends RoomSnapshot {
  type: 'gift';
  phase: 'waiting' | 'choosing' | 'delivering' | 'reveal' | 'finished';
  players: GiftPlayer[];
  round: number;
  target: number;
  customPercent: null | number;
  includeAdult: boolean;
  dealerId: string | null;
  gifts: GiftCard[];
  submittedIds: string[];
  gaveIds: string[];
  wishedIds: string[];
  ownAssignments: Record<string, string> | null;
  ownRanking: Record<GiftRank, string> | null;
  delivery: { recipientId: string; index: number; total: number; entries: GiftEntry[] } | null;
  result: GiftResult | null;
  winner: { ids: string[]; round?: number; reason?: string } | null;
}
const int = (v: unknown): v is number => Number.isSafeInteger(v);
function invalid(): never {
  throw Error('送禮達人房間資料格式不正確。');
}
function ids(value: unknown): string[] {
  const xs = array(value);
  if (!xs.every((x) => !!text(x)) || new Set(xs).size !== xs.length) return invalid();
  return xs as string[];
}
function assignments(value: unknown): Record<string, string> {
  const r = record(value);
  if (!Object.values(r).every((v) => !!text(v))) return invalid();
  return { ...r } as Record<string, string>;
}
function ranking(value: unknown): Record<GiftRank, string> {
  const r = assignments(value);
  if (
    Object.keys(r).length !== 4 ||
    !giftRankKeys.every((k) => r[k]) ||
    new Set(Object.values(r)).size !== 4
  )
    return invalid();
  return r as Record<GiftRank, string>;
}
function entry(value: unknown): GiftEntry {
  const r = record(value),
    points = { great: 3, good: 2, ok: 1, noWay: -4, unranked: -1 };
  if (
    !text(r.giverId) ||
    !text(r.recipientId) ||
    !text(r.giftId) ||
    !Object.hasOwn(points, text(r.rank)) ||
    r.points !== points[r.rank as keyof typeof points] ||
    ['giveAfter', 'getAfter'].some(
      (k) => r[k] !== undefined && (!int(r[k]) || (r[k] as number) < 0),
    )
  )
    return invalid();
  return {
    giverId: text(r.giverId),
    recipientId: text(r.recipientId),
    giftId: text(r.giftId),
    rank: r.rank as GiftEntry['rank'],
    points: r.points as number,
    ...(int(r.giveAfter) ? { giveAfter: r.giveAfter } : {}),
    ...(int(r.getAfter) ? { getAfter: r.getAfter } : {}),
  };
}
export function readGiftSnapshot(value: unknown): GiftSnapshot {
  const base = readRoomSnapshot(value),
    r = record(value);
  if (
    base.type !== 'gift' ||
    !['waiting', 'choosing', 'delivering', 'reveal', 'finished'].includes(base.phase) ||
    !int(r.round) ||
    r.round < 0 ||
    !int(r.target) ||
    r.target < 8 ||
    r.target > 30 ||
    !(r.customPercent === null || [0, 25, 50, 75, 100].includes(r.customPercent as number)) ||
    typeof r.includeAdult !== 'boolean' ||
    (r.dealerId !== null && !text(r.dealerId))
  )
    return invalid();
  // Scores may pass the target (#172); only the 0 floor is enforced.
  const players = base.players.map((p) => {
    if (!int(p.giveScore) || !int(p.getScore) || p.giveScore < 0 || p.getScore < 0)
      return invalid();
    return { ...p, giveScore: p.giveScore, getScore: p.getScore };
  });
  const gifts = array(r.gifts).map((value) => {
    const g = record(value);
    if (
      !text(g.id) ||
      !text(g.title) ||
      !text(g.category) ||
      (g.image !== undefined &&
        g.image !== null &&
        (typeof g.image !== 'string' || !/^\/assets\//.test(g.image) || g.image.startsWith('//')))
    )
      return invalid();
    return {
      id: text(g.id),
      title: text(g.title),
      category: text(g.category),
      image: typeof g.image === 'string' ? g.image : null,
    };
  });
  if (gifts.length > 9 || new Set(gifts.map((g) => g.id)).size !== gifts.length) return invalid();
  const ownAssignments = r.ownAssignments === null ? null : assignments(r.ownAssignments),
    ownRanking = r.ownRanking === null ? null : ranking(r.ownRanking);
  let delivery: GiftSnapshot['delivery'] = null;
  if (r.delivery !== null) {
    const d = record(r.delivery);
    if (
      base.phase !== 'delivering' ||
      !text(d.recipientId) ||
      !int(d.index) ||
      !int(d.total) ||
      d.index < 0 ||
      d.total < 1 ||
      d.index >= d.total ||
      d.total > 8
    )
      return invalid();
    delivery = {
      recipientId: text(d.recipientId),
      index: d.index,
      total: d.total,
      entries: array(d.entries).map(entry),
    };
  }
  if (base.phase === 'delivering' && !delivery) return invalid();
  let result: GiftResult | null = null;
  if (r.result !== null) {
    if (!['reveal', 'finished'].includes(base.phase)) return invalid();
    const q = record(r.result);
    if (!int(q.round) || q.round < 1) return invalid();
    result = {
      round: q.round,
      assignments: Object.fromEntries(
        Object.entries(record(q.assignments)).map(([k, v]) => [k, assignments(v)]),
      ),
      rankings: Object.fromEntries(
        Object.entries(record(q.rankings)).map(([k, v]) => [k, ranking(v)]),
      ),
      entries: array(q.entries).map(entry),
    };
  }
  let winner: GiftSnapshot['winner'] = null;
  if (r.winner !== null) {
    const w = record(r.winner);
    if (
      (w.round !== undefined && !int(w.round)) ||
      (w.reason !== undefined && typeof w.reason !== 'string')
    )
      return invalid();
    winner = {
      ids: ids(w.ids),
      ...(int(w.round) ? { round: w.round } : {}),
      ...(typeof w.reason === 'string' ? { reason: w.reason } : {}),
    };
  }
  return {
    ...base,
    type: 'gift',
    phase: base.phase as GiftSnapshot['phase'],
    players,
    round: r.round,
    target: r.target,
    customPercent: r.customPercent as number | null,
    includeAdult: r.includeAdult,
    dealerId: typeof r.dealerId === 'string' ? r.dealerId : null,
    gifts,
    submittedIds: ids(r.submittedIds),
    gaveIds: ids(r.gaveIds),
    wishedIds: ids(r.wishedIds),
    ownAssignments,
    ownRanking,
    delivery,
    result,
    winner,
  };
}
