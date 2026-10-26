import { readRoomSnapshot, type RoomSnapshot } from './room';
import { array, record, text } from '../services/validation';

export const industries: Record<string, string> = {
  entertainment: '娛樂',
  finance: '金融',
  hardware: '硬體',
  mobile: '3C',
  retail: '零售',
  technology: '科技',
};
export interface CeoCard {
  id: string;
  name: string;
  industry: string;
  income: number;
  assets?: number;
  adjustment?: 'up' | 'down' | null;
  score: { kind: 'fixed' | 'industry' | 'pair'; points: number; industries?: string[] };
}
export interface CeoGroup {
  id: string;
  card: CeoCard;
  playerId: string | null;
  publicAssets: number;
  companies: CeoCard[];
  adjustmentCount: number;
  adjustments: number[] | null;
  income: number;
  nextStockPrice: number | null;
}
export interface CeoGame {
  phase: 'playing' | 'finished';
  revision: number;
  round: number;
  turnId: string | null;
  countdown: number | null;
  endingTriggered: boolean;
  endingReason: string | null;
  players: { id: string; cash: number; holdings: { groupId: string; count: number }[] }[];
  groups: CeoGroup[];
  market: { card: CeoCard; extraCost: number; discardsLeftmost: boolean }[];
  remainingCompanies: number;
  results: null | {
    ranking: { groupId: string; npc: boolean; assets: number; rank: number; stockValue: number }[];
    players: {
      playerId: string;
      stockScore: number;
      companiesScore: number;
      cashScore: number;
      total: number;
      companies: { cardId: string; score: number }[];
      stock: { groupId: string; count: number; value: number }[];
    }[];
    winners: string[];
  };
}
export interface CeoSnapshot extends RoomSnapshot {
  type: 'ceo';
  roundId: string | null;
  interrupted?: boolean;
  catalogNotice: string;
  game: CeoGame | null;
}
function invalid(): never {
  throw Error('執行長房間資料格式不正確。');
}
function number(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) invalid();
  return value;
}
function card(value: unknown): CeoCard {
  const row = record(value),
    score = record(row.score);
  if (
    !text(row.id) ||
    !text(row.name) ||
    !industries[text(row.industry)] ||
    !['fixed', 'industry', 'pair'].includes(text(score.kind))
  )
    invalid();
  number(row.income);
  number(score.points);
  if (row.assets !== undefined) number(row.assets);
  if (
    score.kind !== 'fixed' &&
    (!Array.isArray(score.industries) ||
      !score.industries.length ||
      !score.industries.every((x: unknown) => industries[text(x)]))
  )
    invalid();
  return row as unknown as CeoCard;
}
export function readCeoSnapshot(value: unknown): CeoSnapshot {
  const base = readRoomSnapshot(value),
    row = record(value);
  if (
    base.type !== 'ceo' ||
    !['waiting', 'playing', 'finished'].includes(base.phase) ||
    !(row.roundId === null || !!text(row.roundId))
  )
    invalid();
  if (row.game !== null) {
    const game = record(row.game);
    if (!['playing', 'finished'].includes(text(game.phase))) invalid();
    number(game.revision);
    number(game.round, 1);
    number(game.remainingCompanies);
    if (game.countdown !== null && ![1, 2].includes(Number(game.countdown))) invalid();
    if (game.turnId !== null && !text(game.turnId)) invalid();
    for (const value of array(game.players)) {
      const player = record(value);
      if (!text(player.id)) invalid();
      number(player.cash);
      for (const entry of array(player.holdings)) {
        const h = record(entry);
        if (!text(h.groupId)) invalid();
        number(h.count);
      }
    }
    const groups = array(game.groups);
    if (groups.length !== 6) invalid();
    for (const value of groups) {
      const group = record(value);
      if (!text(group.id) || !(group.playerId === null || text(group.playerId))) invalid();
      card(group.card);
      array(group.companies).forEach(card);
      number(group.publicAssets);
      number(group.income);
      number(group.adjustmentCount);
      if (group.nextStockPrice !== null) number(group.nextStockPrice);
      if (group.adjustments !== null)
        array(group.adjustments).forEach((x) => number(x, -Number.MAX_SAFE_INTEGER));
    }
    for (const value of array(game.market)) {
      const slot = record(value);
      card(slot.card);
      number(slot.extraCost);
      if (typeof slot.discardsLeftmost !== 'boolean') invalid();
    }
    if (game.phase === 'finished') {
      const result = record(game.results);
      for (const value of array(result.ranking)) {
        const rank = record(value);
        if (!text(rank.groupId)) invalid();
        number(rank.assets, -Number.MAX_SAFE_INTEGER);
        number(rank.rank, 1);
        number(rank.stockValue);
      }
      for (const value of array(result.players)) {
        const player = record(value);
        if (!text(player.playerId)) invalid();
        for (const key of ['stockScore', 'companiesScore', 'cashScore', 'total'])
          number(player[key]);
        for (const value of array(player.companies)) {
          const c = record(value);
          if (!text(c.cardId)) invalid();
          number(c.score);
        }
        for (const value of array(player.stock)) {
          const s = record(value);
          if (!text(s.groupId)) invalid();
          number(s.count);
          number(s.value);
        }
      }
      if (!array(result.winners).every((x) => !!text(x))) invalid();
    } else if (game.results !== null) invalid();
  }
  return base as CeoSnapshot;
}
export function scoreText(card: CeoCard): string {
  const score = card.score,
    names = (score.industries || []).map((id) => industries[id]).join('、');
  return score.kind === 'fixed'
    ? `固定 ${score.points} 分`
    : score.kind === 'pair'
      ? `${names}每配對一組 ${score.points} 分`
      : `${names}公司每張 ${score.points} 分（含集團卡）`;
}
